import { buildBrowserVfsShim } from '../vfs/browser-shim.js';
import {
  escapeInlineScript,
  inlineCssUrls,
  resolveRelPath,
  TEXT_EXTENSIONS,
  toDataUri
} from '../vfs/html-utils.js';
import { buildVfsPayloadScripts } from '../vfs/payload.js';
import type { AdapterTransformContext, EngineAdapter } from './types.js';

/**
 * Default engine-agnostic Web adapter.
 * Works out of the box with Vite, PixiJS, Three.js, Phaser, Godot 4 HTML5, LayaAir,
 * vanilla Canvas/WebGL, and AI-generated HTML5 playables via the 7-entry browser VFS shim.
 */
export const genericWebAdapter: EngineAdapter = {
  id: 'generic-web',
  displayName: 'Generic Web / HTML5 (Vite, PixiJS, Three.js, Phaser, Godot, etc.)',
  preferSlimZip: false,

  detect() {
    // Fallback adapter matches any standard HTML5 build
    return true;
  },

  transformSingleHtml(ctx: AdapterTransformContext): string {
    const { $, entryHtmlPath, fileMap, compress } = ctx;
    const consumedPaths = new Set<string>([entryHtmlPath]);

    // Remove Vite/bundler modulepreload/preload hints pointing to local files that will be inlined
    $('link[rel="modulepreload"][href], link[rel="preload"][href]').each((_i, el) => {
      const href = $(el).attr('href') || '';
      const resolved = resolveRelPath(entryHtmlPath, href);
      if (resolved && fileMap.has(resolved)) {
        $(el).remove();
      }
    });

    // 1. Inline stylesheets & CSS url() assets
    $('link[rel="stylesheet"][href]').each((_i, el) => {
      const href = $(el).attr('href') || '';
      const resolved = resolveRelPath(entryHtmlPath, href);
      if (!resolved) return;
      const file = fileMap.get(resolved);
      if (!file) return;
      consumedPaths.add(resolved);
      const inlinedCss = inlineCssUrls(file.content.toString('utf-8'), resolved, fileMap);
      $(el).replaceWith(`<style>${inlinedCss}</style>`);
    });

    $('style').each((_i, el) => {
      const css = $(el).html() || '';
      $(el).html(inlineCssUrls(css, entryHtmlPath, fileMap));
    });

    // 2. Inline local scripts
    $('script[src]').each((_i, el) => {
      const src = $(el).attr('src') || '';
      const resolved = resolveRelPath(entryHtmlPath, src);
      if (!resolved) return;
      const file = fileMap.get(resolved);
      if (!file) return;
      consumedPaths.add(resolved);
      const typeAttr = $(el).attr('type');
      const typePart = typeAttr ? ` type="${typeAttr}"` : '';
      $(el).replaceWith(`<script${typePart}>${escapeInlineScript(file.content.toString('utf-8'))}</script>`);
    });

    // 3. Inline static local images & media tags
    $('img[src], audio[src], video[src], source[src]').each((_i, el) => {
      const src = $(el).attr('src') || '';
      const resolved = resolveRelPath(entryHtmlPath, src);
      if (!resolved) return;
      const file = fileMap.get(resolved);
      if (!file) return;
      consumedPaths.add(resolved);
      $(el).attr('src', toDataUri(file));
    });

    // 4. Bundle remaining dynamic assets (JSON, WASM, textures loaded via Image.src, Audio, fonts) into VFS
    const vfs: Record<string, string> = {};
    for (const [relPath, file] of fileMap.entries()) {
      if (consumedPaths.has(relPath)) continue;
      vfs[relPath] = TEXT_EXTENSIONS.has(file.ext) ? file.content.toString('utf-8') : toDataUri(file);
    }

    if (Object.keys(vfs).length > 0) {
      const payload = buildVfsPayloadScripts(vfs, { compress });
      const vfsTags = [
        ...payload.scripts.map((blk) => `<script data-id="${blk.id}">${escapeInlineScript(blk.code)}</script>`),
        `<script data-id="playable-vfs-loader">${escapeInlineScript(buildBrowserVfsShim())}</script>`
      ].join('\n');
      // Prepend in <head> so all subsequent scripts see the patched fetch/XHR/Image/Audio/FontFace APIs
      $('head').prepend(vfsTags);
    }

    return $.html();
  }
};
