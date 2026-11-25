import { promises as fs } from 'node:fs';
import path from 'node:path';
import { load as loadHtml } from 'cheerio';
import JSZip from 'jszip';
import { generateChannelBridgeScript } from '@ppgee/playable-sdk';
import type { ChannelId, ChannelSpec } from '@ppgee/playable-validator';
import {
  prepareGoogleZipFiles,
  SKIP_EXTENSIONS,
  splitSingleHtmlToSlimZip
} from './vfs/html-utils.js';
import type {
  BuildPlayableOptions,
  ChannelBuildArtifact,
  LoadedSource,
  OrientationMode,
  VirtualFile
} from './types.js';

const LEGACY_CHANNEL_PLACEHOLDER = '{{__adv_channels_adapter__}}';
const V2_CHANNEL_PLACEHOLDER = '{{__playable_channel__}}';
const V2_VARIANT_PLACEHOLDER = '{{__playable_variant__}}';

function escapeInlineScriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

const CHANNEL_FILE_LABEL: Record<ChannelId, string> = {
  applovin: 'AppLovin',
  unity: 'Unity',
  google: 'Google',
  meta: 'Meta',
  tiktok: 'TikTok',
  mintegral: 'Mintegral',
  moloco: 'Moloco',
  liftoff: 'Liftoff'
};

const GOOGLE_EXITAPI_SCRIPT =
  '<script type="text/javascript" src="https://tpc.googlesyndication.com/pagead/gadgets/html5/api/exitapi.js"></script>';

const TIKTOK_SDK_SCRIPT =
  '<script type="text/javascript" src="https://sf16-muse-va.ibytedtos.com/obj/union-fe-nc-i18n/playable/sdk/playable-sdk.js"></script>';

const MRAID_SCRIPT = '<script src="mraid.js"></script>';

const TEXT_REWRITE_EXTS = new Set(['.js', '.mjs', '.cjs', '.css', '.html', '.htm', '.json']);

function replacePlaceholders(content: string, channel: ChannelId, variantId?: string): string {
  const legacyLabel = channel === 'meta' ? 'Facebook' : CHANNEL_FILE_LABEL[channel];
  return content
    .replaceAll(LEGACY_CHANNEL_PLACEHOLDER, legacyLabel)
    .replaceAll(V2_CHANNEL_PLACEHOLDER, channel)
    .replaceAll(V2_VARIANT_PLACEHOLDER, variantId ?? '');
}

function sanitizeLowercaseAsciiPath(p: string): string {
  return p
    .split('/')
    .map((seg) =>
      seg
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9._-]/g, '_')
    )
    .join('/');
}

/**
 * Engine-agnostic entry point to build a self-contained single HTML string via the
 * source's resolved EngineAdapter plugin.
 */
export function buildSingleHtml(source: LoadedSource, options: BuildPlayableOptions): string {
  const fileMap = new Map<string, VirtualFile>();
  for (const f of source.files) {
    if (SKIP_EXTENSIONS.has(f.ext)) continue;
    fileMap.set(f.path, f);
  }

  const entryFile = fileMap.get(source.entryHtmlPath);
  if (!entryFile) {
    throw new Error(`Missing entry HTML "${source.entryHtmlPath}"`);
  }

  const $ = loadHtml(entryFile.content.toString('utf-8'));
  const adapterOptions: Record<string, unknown> = {
    ...(options.adapterOptions ?? {}),
    ...(options.disableSplash !== undefined ? { disableSplash: options.disableSplash } : {})
  };

  return source.adapter.transformSingleHtml({
    $,
    entryHtmlPath: source.entryHtmlPath,
    fileMap,
    compress: options.compress,
    encoding: options.encoding,
    adapterOptions
  });
}

function applyChannelHtmlTransforms(
  rawHtml: string,
  spec: ChannelSpec,
  options: BuildPlayableOptions
): string {
  const htmlWithPlaceholders = replacePlaceholders(rawHtml, spec.id, options.variantId);
  const $ = loadHtml(htmlWithPlaceholders);
  const orientation: OrientationMode = options.orientation ?? 'auto';
  const custom = options.injectOptions?.[spec.id];

  // Strip mraid.js tags on channels that explicitly forbid MRAID
  if (spec.mraidPolicy === 'forbidden') {
    $('script[src]').each((_i, el) => {
      const src = ($(el).attr('src') || '').toLowerCase();
      if (src.includes('mraid.js')) {
        $(el).remove();
      }
    });
  }

  // Channel-specific head meta & official SDK scripts
  if (spec.id === 'applovin' || spec.id === 'unity') {
    const hasMraidTag = $('script[src]').toArray().some((el) =>
      ($(el).attr('src') || '').toLowerCase().includes('mraid.js')
    );
    if (!hasMraidTag) {
      $('head').prepend(custom?.sdkScript || MRAID_SCRIPT);
    }
  } else if (spec.id === 'google') {
    const orientationVal =
      orientation === 'portrait'
        ? 'portrait'
        : orientation === 'landscape'
          ? 'landscape'
          : 'portrait,landscape';

    // Official Google Ads HTML5 Validator (h5validator.appspot.com) fails with
    // "Ad Dimensions: Invalid file dimensions" if BOTH ad.orientation AND ad.size are emitted.
    // Emit only ad.orientation when no dimension meta tag is already declared.
    if ($('meta[name="ad.orientation"]').length === 0 && $('meta[name="ad.size"]').length === 0) {
      $('head').prepend(`<meta name="ad.orientation" content="${orientationVal}">`);
    }
    const hasExitApi = $('script[src]').toArray().some((el) =>
      ($(el).attr('src') || '').toLowerCase().includes('exitapi.js')
    );
    if (!hasExitApi) {
      $('head').prepend(custom?.sdkScript || GOOGLE_EXITAPI_SCRIPT);
    }
  } else if (spec.id === 'tiktok') {
    const hasTikTokSdk = $('script[src]').toArray().some((el) =>
      ($(el).attr('src') || '').toLowerCase().includes('playable-sdk.js')
    );
    if (!hasTikTokSdk) {
      $('head').prepend(custom?.sdkScript || TIKTOK_SDK_SCRIPT);
    }
  } else if (custom?.sdkScript) {
    $('head').prepend(custom.sdkScript);
  }

  // Inject runtime variant config before game scripts execute
  if (options.runtimeConfig !== undefined || options.variantId) {
    const cfgParts: string[] = [];
    if (options.variantId) {
      cfgParts.push(`window.__PLAYABLE_VARIANT__=${escapeInlineScriptJson(options.variantId)};`);
    }
    if (options.runtimeConfig !== undefined) {
      cfgParts.push(`window.__PLAYABLE_CONFIG__=${escapeInlineScriptJson(options.runtimeConfig)};`);
    }
    const cfgScript = `<script data-id="playable-variant-config">${cfgParts.join('')}</script>`;
    const firstScript = $('head script').first();
    if (firstScript.length > 0) {
      firstScript.before(cfgScript);
    } else {
      $('head').prepend(cfgScript);
    }
  }

  // Inject zero-dependency, channel-isolated @ppgee/playable-sdk bridge
  if (options.injectSdkBridge !== false) {
    const bridgeCode = generateChannelBridgeScript(spec.id, options.storeUrls);
    $('head').append(`<script data-id="playable-sdk-bridge">${bridgeCode}</script>`);
  }

  if (custom?.head) {
    $('head').append(custom.head);
  }
  if (custom?.body) {
    $('body').prepend(custom.body);
  }

  return $.html();
}

function replaceTextInFiles(files: VirtualFile[], channel: ChannelId, variantId?: string): VirtualFile[] {
  return files.map((f) => {
    if (TEXT_REWRITE_EXTS.has(f.ext)) {
      const updated = replacePlaceholders(f.content.toString('utf-8'), channel, variantId);
      return { ...f, content: Buffer.from(updated, 'utf-8') };
    }
    return f;
  });
}

function normalizeRelativePathsForZip(html: string): string {
  const $ = loadHtml(html);
  const fix = (selector: string, attr: string) => {
    $(selector).each((_i, el) => {
      const val = ($(el).attr(attr) || '').trim();
      if (val.startsWith('/') && !val.startsWith('//')) {
        $(el).attr(attr, `.${val}`);
      }
    });
  };
  fix('script[src]', 'src');
  fix('link[href]', 'href');
  fix('img[src]', 'src');
  fix('audio[src], video[src], source[src]', 'src');
  return $.html();
}

export interface EmitContext {
  getCachedSingleHtml?: () => string;
}

/**
 * Purely engine-agnostic decision: defers to `adapter.preferSlimZip` and the target
 * channel's file-count / entry-HTML size limits without hardcoding any engine name.
 */
function shouldUseSlimZip(source: LoadedSource, spec: ChannelSpec): boolean {
  if (source.adapter.preferSlimZip) {
    return true;
  }
  if (spec.maxFileCount && source.files.length > spec.maxFileCount - 5) {
    return true;
  }
  const entry = source.files.find((f) => f.path === source.entryHtmlPath);
  if (spec.maxEntryHtmlBytes && entry && entry.content.byteLength > spec.maxEntryHtmlBytes * 0.9) {
    return true;
  }
  return false;
}

export async function emitChannelArtifact(
  source: LoadedSource,
  spec: ChannelSpec,
  options: BuildPlayableOptions,
  context: EmitContext = {}
): Promise<ChannelBuildArtifact> {
  await fs.mkdir(options.outputDir, { recursive: true });
  const label = CHANNEL_FILE_LABEL[spec.id];
  const baseName = (
    options.packageName ||
    path.basename(source.inputPath, path.extname(source.inputPath)) ||
    'playable'
  )
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase();

  const getSingleHtml = () =>
    context.getCachedSingleHtml ? context.getCachedSingleHtml() : buildSingleHtml(source, options);

  // Case 1: Single-HTML channels (AppLovin, Unity, Moloco)
  if (spec.preferredFormat === 'single-html') {
    const finalHtml = applyChannelHtmlTransforms(getSingleHtml(), spec, options);
    const outPath = path.join(options.outputDir, `${label}.html`);
    const buf = Buffer.from(finalHtml, 'utf-8');
    await fs.writeFile(outPath, buf);
    return {
      channel: spec.id,
      displayName: spec.displayName,
      format: 'single-html',
      outputPath: outPath,
      bytes: buf.byteLength,
      ...(options.variantId ? { variant: options.variantId, variantLabel: options.variantLabel } : {})
    };
  }

  // Case 2: ZIP channels (Google, Meta, TikTok, Mintegral, Liftoff)
  const zip = new JSZip();
  let zipFileName = `${label}.zip`;

  if (spec.id === 'mintegral') {
    // Official Playturbo / Mintegral Reviewer restricts names to ASCII letters, digits, and underscores (no hyphens).
    const mtgBase = baseName.replace(/[^a-zA-Z0-9_]/g, '_');
    const variantSuffix =
      options.variantId && !options.packageName
        ? `_${options.variantId.replace(/[^a-zA-Z0-9_]/g, '_')}`
        : '';
    const mtgName = `${mtgBase}${variantSuffix}_mintegral`;
    zipFileName = `${mtgName}.zip`;
    const finalHtml = applyChannelHtmlTransforms(getSingleHtml(), spec, options);
    zip.file(`${mtgName}/${mtgName}.html`, finalHtml);
  } else if (shouldUseSlimZip(source, spec)) {
    const transformedSingle = applyChannelHtmlTransforms(getSingleHtml(), spec, options);
    const { html: slimHtml, jsFiles } = splitSingleHtmlToSlimZip(transformedSingle);
    zip.file('index.html', slimHtml);
    for (const jsFile of jsFiles) {
      zip.file(jsFile.path, jsFile.content);
    }

    if (spec.id === 'tiktok') {
      const orientCode =
        options.orientation === 'portrait' ? 1 : options.orientation === 'landscape' ? 2 : 0;
      zip.file('config.json', JSON.stringify({ playable_orientation: orientCode }, null, 2));
    }
  } else if (spec.id === 'google') {
    const prepared = prepareGoogleZipFiles(source, spec.allowedFileExtensions ?? [], {
      compress: options.compress,
      encoding: options.encoding
    });
    const finalHtml = applyChannelHtmlTransforms(prepared.html, spec, options);
    zip.file('index.html', finalHtml);
    for (const file of replaceTextInFiles(prepared.files, spec.id, options.variantId)) {
      zip.file(file.path, file.content);
    }
  } else {
    const entryFile = source.files.find((f) => f.path === source.entryHtmlPath);
    if (!entryFile) {
      throw new Error(`Missing entry HTML "${source.entryHtmlPath}"`);
    }
    const otherFiles = replaceTextInFiles(
      source.files.filter((f) => f.path !== source.entryHtmlPath),
      spec.id,
      options.variantId
    );

    let htmlContent = normalizeRelativePathsForZip(entryFile.content.toString('utf-8'));

    if (spec.id === 'liftoff') {
      const renames = new Map<string, string>();
      const renamedFiles: VirtualFile[] = otherFiles.map((file) => {
        const cleanPath = sanitizeLowercaseAsciiPath(file.path);
        if (cleanPath !== file.path) {
          renames.set(file.path, cleanPath);
        }
        return { ...file, path: cleanPath };
      });

      const applyRenames = (text: string): string => {
        let out = text;
        for (const [oldPath, newPath] of renames.entries()) {
          out = out.replaceAll(oldPath, newPath);
        }
        return out;
      };

      htmlContent = applyRenames(htmlContent);
      for (const file of renamedFiles) {
        if (renames.size > 0 && TEXT_REWRITE_EXTS.has(file.ext)) {
          zip.file(file.path, applyRenames(file.content.toString('utf-8')));
        } else {
          zip.file(file.path, file.content);
        }
      }
    } else {
      for (const file of otherFiles) {
        zip.file(file.path, file.content);
      }
    }

    const finalHtml = applyChannelHtmlTransforms(htmlContent, spec, options);
    zip.file('index.html', finalHtml);

    if (spec.id === 'tiktok') {
      const orientCode =
        options.orientation === 'portrait' ? 1 : options.orientation === 'landscape' ? 2 : 0;
      zip.file('config.json', JSON.stringify({ playable_orientation: orientCode }, null, 2));
    }
  }

  const outPath = path.join(options.outputDir, zipFileName);
  const zipBuf = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });
  await fs.writeFile(outPath, zipBuf);

  return {
    channel: spec.id,
    displayName: spec.displayName,
    format: 'zip',
    outputPath: outPath,
    bytes: zipBuf.byteLength,
    ...(options.variantId ? { variant: options.variantId, variantLabel: options.variantLabel } : {})
  };
}
