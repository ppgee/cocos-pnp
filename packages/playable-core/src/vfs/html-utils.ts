import path from 'node:path';
import { load as loadHtml } from 'cheerio';
import { lookup as lookupMime } from 'mime-types';
import { buildBrowserVfsShim } from './browser-shim.js';
import { buildVfsPayloadScripts, type PayloadEncoding } from './payload.js';
import type { LoadedSource, VirtualFile } from '../types.js';

export const TEXT_EXTENSIONS = new Set([
  '.html', '.htm', '.js', '.mjs', '.cjs', '.css', '.json', '.txt',
  '.xml', '.svg', '.atlas', '.plist', '.fnt', '.vsh', '.fsh', '.tmx', '.tsx', '.glsl', '.wgsl'
]);

export const SKIP_EXTENSIONS = new Set(['.map', '.gz', '.br', '.zip']);

export function escapeInlineScript(js: string): string {
  return js.replace(/<\/script/gi, '<\\/script');
}

export function toDataUri(file: VirtualFile): string {
  const mime = lookupMime(file.path) || 'application/octet-stream';
  return `data:${mime};base64,${file.content.toString('base64')}`;
}

export function resolveRelPath(baseHtmlPath: string, ref: string): string | null {
  const clean = ref.split('?')[0].split('#')[0].trim();
  if (!clean || /^https?:\/\//i.test(clean) || clean.startsWith('data:') || clean.startsWith('blob:')) {
    return null;
  }
  const baseDir = path.posix.dirname(baseHtmlPath);
  const joined = clean.startsWith('/')
    ? clean.replace(/^\/+/, '')
    : path.posix.normalize(path.posix.join(baseDir === '.' ? '' : baseDir, clean));
  return joined.replace(/^\/+/, '');
}

export function inlineCssUrls(
  css: string,
  cssFilePath: string,
  fileMap: Map<string, VirtualFile>
): string {
  return css.replace(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g, (full, _quote, rawRef: string) => {
    const resolved = resolveRelPath(cssFilePath, rawRef);
    if (!resolved) return full;
    const hit = fileMap.get(resolved);
    if (!hit) return full;
    return `url("${toDataUri(hit)}")`;
  });
}

/**
 * Splits a self-contained single HTML into a slim index.html (< 50KB) plus externalized
 * lowercase ASCII js/playable-N.js files for ZIP channels (Meta 2MB HTML & 100-file limits,
 * Google strict extension whitelist, Liftoff lowercase ASCII paths).
 */
export function splitSingleHtmlToSlimZip(singleHtml: string): {
  html: string;
  jsFiles: VirtualFile[];
} {
  const $ = loadHtml(singleHtml);
  const jsFiles: VirtualFile[] = [];
  let scriptIndex = 0;

  $('script').each((_i, el) => {
    const $el = $(el);
    if ($el.attr('src')) return;
    const type = ($el.attr('type') || '').toLowerCase();
    if (type && type !== 'text/javascript' && type !== 'application/javascript' && type !== 'module') {
      return;
    }
    const code = $el.html() || '';
    if (Buffer.byteLength(code, 'utf-8') < 2048) return;

    const fileName = `js/playable-${scriptIndex}.js`;
    scriptIndex++;
    jsFiles.push({
      path: fileName,
      ext: '.js',
      content: Buffer.from(code, 'utf-8')
    });

    const typeAttr = type ? ` type="${type}"` : '';
    $el.replaceWith(`<script${typeAttr} src="./${fileName}"></script>`);
  });

  return { html: $.html(), jsFiles };
}

/**
 * Inlines ONLY files whose extensions are disallowed in Google Ads ZIP archives
 * (such as .mp3, .wasm, .ttf, .webp, .json) while preserving allowed files (.png/.jpg/.js/.css)
 * as raw binary files inside the ZIP.
 */
export function prepareGoogleZipFiles(
  source: LoadedSource,
  allowedExtensions: string[],
  options: { compress?: boolean; encoding?: PayloadEncoding } = {}
): { html: string; files: VirtualFile[] } {
  const allowedSet = new Set(allowedExtensions.map((e) => e.toLowerCase()));
  const keptFiles: VirtualFile[] = [];
  const inlinedVfs: Record<string, string> = {};
  const inlinedFileMap = new Map<string, VirtualFile>();

  let entryHtml = '';
  for (const file of source.files) {
    if (SKIP_EXTENSIONS.has(file.ext)) continue;
    if (file.path === source.entryHtmlPath) {
      entryHtml = file.content.toString('utf-8');
      continue;
    }
    if (allowedSet.has(file.ext)) {
      keptFiles.push(file);
    } else {
      inlinedFileMap.set(file.path, file);
      inlinedVfs[file.path] = TEXT_EXTENSIONS.has(file.ext)
        ? file.content.toString('utf-8')
        : toDataUri(file);
    }
  }

  const $ = loadHtml(entryHtml);

  // Rewrite CSS url(...) inside <style> tags and kept .css files when referencing stripped non-whitelisted assets (e.g. .ttf/.woff/.webp)
  if (inlinedFileMap.size > 0) {
    $('style').each((_i, el) => {
      const css = $(el).html() || '';
      const rewritten = inlineCssUrls(css, source.entryHtmlPath, inlinedFileMap);
      if (rewritten !== css) {
        $(el).html(rewritten);
      }
    });
    for (let i = 0; i < keptFiles.length; i++) {
      if (keptFiles[i].ext === '.css') {
        const css = keptFiles[i].content.toString('utf-8');
        const rewritten = inlineCssUrls(css, keptFiles[i].path, inlinedFileMap);
        if (rewritten !== css) {
          keptFiles[i] = { ...keptFiles[i], content: Buffer.from(rewritten, 'utf-8') };
        }
      }
    }

    // Inline static HTML media tags referencing stripped non-whitelisted assets (e.g. .webp/.wav/.mp4)
    $('img[src], audio[src], video[src], source[src]').each((_i, el) => {
      const src = $(el).attr('src') || '';
      const resolved = resolveRelPath(source.entryHtmlPath, src);
      if (!resolved) return;
      const hit = inlinedFileMap.get(resolved);
      if (!hit) return;
      $(el).attr('src', toDataUri(hit));
    });
  }

  // Inline any <script src> referencing a stripped non-whitelisted file (e.g. import-map .json)
  $('script[src]').each((_i, el) => {
    const src = $(el).attr('src') || '';
    const resolved = resolveRelPath(source.entryHtmlPath, src);
    if (!resolved || !inlinedVfs[resolved]) return;
    const typeAttr = $(el).attr('type');
    const typePart = typeAttr ? ` type="${typeAttr}"` : '';
    $(el).replaceWith(`<script${typePart}>${escapeInlineScript(inlinedVfs[resolved])}</script>`);
  });

  // Normalize root-absolute paths (/foo -> ./foo) required by Google Ads
  const normalizeAttr = (selector: string, attr: string) => {
    $(selector).each((_i, el) => {
      const val = ($(el).attr(attr) || '').trim();
      if (val.startsWith('/') && !val.startsWith('//')) {
        $(el).attr(attr, `.${val}`);
      }
    });
  };
  normalizeAttr('script[src]', 'src');
  normalizeAttr('link[href]', 'href');
  normalizeAttr('img[src]', 'src');
  normalizeAttr('audio[src], video[src], source[src]', 'src');

  if (Object.keys(inlinedVfs).length > 0) {
    const payload = buildVfsPayloadScripts(inlinedVfs, {
      compress: options.compress,
      encoding: options.encoding
    });
    const headTags = [
      ...payload.scripts.map((blk) => `<script data-id="${blk.id}">${escapeInlineScript(blk.code)}</script>`),
      `<script data-id="playable-vfs-loader">${escapeInlineScript(buildBrowserVfsShim())}</script>`
    ].join('\n');
    $('head').prepend(headTags);
  }

  return { html: $.html(), files: keptFiles };
}
