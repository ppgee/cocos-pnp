import { load as loadHtml } from 'cheerio';
import type {
  ChannelSpec,
  Diagnostic,
  LoadedArtifact,
  SizeBreakdown
} from './types.js';

const IGNORED_XML_NS_PREFIXES = [
  'http://www.w3.org/',
  'https://www.w3.org/',
  'http://ns.adobe.com/',
  'https://ns.adobe.com/',
  'http://schemas.',
  'https://schemas.'
];

function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isUrlAllowed(url: string, allowedPrefixes: string[]): boolean {
  const lower = url.toLowerCase();
  if (IGNORED_XML_NS_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
    return true;
  }
  return allowedPrefixes.some((prefix) => lower.startsWith(prefix.toLowerCase()));
}

function collectAllTextCorpus(artifact: LoadedArtifact): string {
  const parts: string[] = [];
  for (const entry of artifact.entries) {
    if (entry.ext === '.html' || entry.ext === '.htm' || entry.ext === '.js' || entry.ext === '.mjs') {
      parts.push(entry.content.toString('utf-8'));
    }
  }
  return parts.join('\n');
}

function stripJsComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function checkZipEntryLayout(artifact: LoadedArtifact, spec: ChannelSpec): Diagnostic[] {
  if (artifact.format !== 'zip' || !artifact.entryHtmlPath) {
    return [];
  }

  const diagnostics: Diagnostic[] = [];
  const lowerEntry = artifact.entryHtmlPath.toLowerCase();

  if (spec.zipEntryLayout === 'root-index') {
    if (artifact.hasNestedRootFolder) {
      diagnostics.push({
        code: 'STRUCT_NESTED_ROOT_FOLDER',
        severity: 'error',
        category: 'structure',
        message: `Entry HTML is nested inside a subfolder ("${artifact.entryHtmlPath}") instead of the ZIP root.`,
        suggestion: 'Zip the contents of the build directory directly so index.html sits at the archive root.'
      });
    } else if (lowerEntry !== 'index.html') {
      diagnostics.push({
        code: 'STRUCT_INDEX_NOT_AT_ROOT',
        severity: 'error',
        category: 'structure',
        message: `Expected "index.html" at archive root for ${spec.displayName}, found "${artifact.entryHtmlPath}".`,
        suggestion: 'Rename or move the entry file to "index.html" at the root level.'
      });
    }
  } else if (spec.zipEntryLayout === 'root-index-or-ad') {
    if (artifact.hasNestedRootFolder) {
      diagnostics.push({
        code: 'STRUCT_NESTED_ROOT_FOLDER',
        severity: 'error',
        category: 'structure',
        message: `Entry HTML is nested inside a subfolder ("${artifact.entryHtmlPath}"). ${spec.displayName} expects index.html or ad.html at the ZIP root.`,
        suggestion: 'Place index.html (or ad.html) directly at the root of the ZIP archive.'
      });
    } else if (lowerEntry !== 'index.html' && lowerEntry !== 'ad.html') {
      diagnostics.push({
        code: 'STRUCT_INDEX_NOT_AT_ROOT',
        severity: 'error',
        category: 'structure',
        message: `Expected "index.html" or "ad.html" at archive root for ${spec.displayName}, found "${artifact.entryHtmlPath}".`,
        suggestion: 'Rename the root entry file to "index.html" or "ad.html".'
      });
    }
  } else if (spec.zipEntryLayout === 'matching-folder-or-root') {
    // Mintegral allows classic matching naming: <name>.zip -> <name>/<name>.html, or root index.html
    const expectedClassic = `${artifact.archiveBaseName.toLowerCase()}/${artifact.archiveBaseName.toLowerCase()}.html`;
    if (lowerEntry !== 'index.html' && lowerEntry !== expectedClassic) {
      diagnostics.push({
        code: 'STRUCT_MINTEGRAL_NAMING',
        severity: 'warning',
        category: 'structure',
        message: `Mintegral ZIP entry "${artifact.entryHtmlPath}" does not match classic "<zipName>/<zipName>.html" ("${expectedClassic}") or root "index.html".`,
        suggestion: `Match the ZIP filename, inner folder, and HTML filename identically (e.g. "${artifact.archiveBaseName}.zip" -> "${artifact.archiveBaseName}/${artifact.archiveBaseName}.html"), or place index.html at root.`
      });
    }
  }

  return diagnostics;
}

export function runStaticChecks(
  artifact: LoadedArtifact,
  spec: ChannelSpec,
  sizeBreakdown: SizeBreakdown
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // 1. Entry HTML existence
  if (!artifact.entryHtmlPath || !artifact.entryHtmlContent) {
    diagnostics.push({
      code: 'STRUCT_MISSING_INDEX_HTML',
      severity: 'error',
      category: 'structure',
      message: 'No entry HTML file (index.html) found in artifact.',
      suggestion: 'Ensure index.html exists at the root of the playable package.'
    });
    return diagnostics;
  }

  // 2. Format compatibility check
  if (artifact.format === 'directory') {
    diagnostics.push({
      code: 'FORMAT_DIRECTORY_INPUT',
      severity: 'info',
      category: 'format',
      message: `Input is an unpacked directory. ${spec.displayName} requires ${spec.acceptedFormats.join(' or ')} for final submission.`,
      suggestion: `Package this directory into ${spec.preferredFormat} before uploading to ${spec.displayName}.`
    });
  } else if (!spec.acceptedFormats.includes(artifact.format)) {
    diagnostics.push({
      code: 'FORMAT_UNSUPPORTED',
      severity: 'error',
      category: 'format',
      message: `${spec.displayName} requires ${spec.acceptedFormats.join(' or ')}, but received ${artifact.format}.`,
      suggestion: `Export this playable as ${spec.preferredFormat} for ${spec.displayName}.`
    });
  }

  // 3. ZIP entry layout check
  diagnostics.push(...checkZipEntryLayout(artifact, spec));

  // 4. Total package size limit check
  const effectiveLimit =
    artifact.format === 'single-html'
      ? (spec.maxSingleHtmlBytes ?? spec.maxZipBytes)
      : (spec.maxZipBytes ?? spec.maxSingleHtmlBytes);

  if (effectiveLimit) {
    if (sizeBreakdown.totalBytes > effectiveLimit) {
      const overBytes = sizeBreakdown.totalBytes - effectiveLimit;
      diagnostics.push({
        code: 'SIZE_LIMIT_EXCEEDED',
        severity: 'error',
        category: 'size',
        message: `Package size ${formatMB(sizeBreakdown.totalBytes)} exceeds ${spec.displayName} limit of ${formatMB(effectiveLimit)} (over by ${formatMB(overBytes)}).`,
        suggestion:
          sizeBreakdown.estimatedBase64OverheadBytes > 256 * 1024 && spec.acceptedFormats.includes('zip')
            ? `Compress large images/audio or switch to ZIP delivery to save ~${formatMB(sizeBreakdown.estimatedBase64OverheadBytes)} in Base64 overhead.`
            : 'Compress top contributors (images to WebP/PNG8, lower audio bitrate, trim unused engine modules/fonts).',
        details: {
          totalBytes: sizeBreakdown.totalBytes,
          limitBytes: effectiveLimit,
          overBytes,
          topContributors: sizeBreakdown.topContributors.slice(0, 5)
        }
      });
    } else if (sizeBreakdown.totalBytes > effectiveLimit * 0.85) {
      diagnostics.push({
        code: 'SIZE_NEAR_LIMIT',
        severity: 'warning',
        category: 'size',
        message: `Package size ${formatMB(sizeBreakdown.totalBytes)} is above 85% of ${spec.displayName} limit (${formatMB(effectiveLimit)}).`,
        suggestion: 'Consider trimming large assets to leave headroom for SDK wrappers or localization.'
      });
    }
  }

  // 4b. Entry HTML size ceiling even inside ZIP (e.g. Meta 2MB index.html rule)
  if (
    spec.maxEntryHtmlBytes &&
    artifact.format !== 'single-html' &&
    sizeBreakdown.entryHtmlBytes > spec.maxEntryHtmlBytes
  ) {
    diagnostics.push({
      code: 'SIZE_ENTRY_HTML_EXCEEDED',
      severity: 'error',
      category: 'size',
      message: `Entry HTML "${artifact.entryHtmlPath}" is ${formatMB(sizeBreakdown.entryHtmlBytes)}, exceeding ${spec.displayName} HTML limit of ${formatMB(spec.maxEntryHtmlBytes)} even inside a ZIP.`,
      suggestion: 'Move large inline Base64 images/scripts out of index.html into separate files inside the ZIP archive.',
      details: {
        entryHtmlPath: artifact.entryHtmlPath,
        entryHtmlBytes: sizeBreakdown.entryHtmlBytes,
        limitBytes: spec.maxEntryHtmlBytes
      }
    });
  }

  // 5. File count check (Google 512, Meta 100)
  if (spec.maxFileCount && sizeBreakdown.fileCount > spec.maxFileCount) {
    diagnostics.push({
      code: 'STRUCT_FILE_COUNT_EXCEEDED',
      severity: 'error',
      category: 'structure',
      message: `Package contains ${sizeBreakdown.fileCount} files, exceeding ${spec.displayName} limit of ${spec.maxFileCount} files.`,
      suggestion: 'Merge sprite sheets, bundle scripts, or inline small JSON/asset files.'
    });
  }

  // 5b. Allowed file extensions whitelist (e.g. Google Ads ZIP)
  if (spec.allowedFileExtensions && artifact.format !== 'single-html') {
    const allowedSet = new Set(spec.allowedFileExtensions.map((e) => e.toLowerCase()));
    const disallowedFiles = artifact.entries
      .filter((entry) => !allowedSet.has(entry.ext))
      .map((entry) => entry.path);

    if (disallowedFiles.length > 0) {
      diagnostics.push({
        code: 'STRUCT_DISALLOWED_FILE_TYPE',
        severity: 'error',
        category: 'structure',
        message: `Found ${disallowedFiles.length} file(s) with extensions not in ${spec.displayName} allowed list (${spec.allowedFileExtensions.join(', ')}).`,
        suggestion:
          'Inline audio, fonts, WASM, or JSON assets into JS/HTML (or convert images to PNG/JPG/GIF/SVG) for Google Ads ZIP compliance.',
        details: { files: disallowedFiles.slice(0, 20) }
      });
    }
  }

  // 5c. Lowercase ASCII path naming rule (Liftoff / Vungle)
  if (spec.requireLowercaseAsciiPaths) {
    const invalidPaths = artifact.entries
      .filter((entry) => !/^[a-z0-9._/-]+$/.test(entry.path))
      .map((entry) => entry.path);
    if (invalidPaths.length > 0) {
      diagnostics.push({
        code: 'PATH_INVALID_ASCII_CASE',
        severity: 'error',
        category: 'structure',
        message: `Found ${invalidPaths.length} path(s) violating ${spec.displayName} lowercase ASCII naming rule (no uppercase, spaces, or non-ASCII characters).`,
        suggestion: 'Rename files and folders to lowercase ASCII characters only (e.g. "assets/hero_bg.png").',
        details: { paths: invalidPaths.slice(0, 20) }
      });
    }
  }

  // 6. Required manifest files check (e.g. TikTok config.json)
  for (const reqFile of spec.requiredFiles) {
    const found = artifact.entries.find((e) => e.path.toLowerCase() === reqFile.toLowerCase());
    if (!found) {
      diagnostics.push({
        code: 'STRUCT_MISSING_REQUIRED_FILE',
        severity: 'error',
        category: 'structure',
        message: `Missing required file "${reqFile}" at package root for ${spec.displayName}.`,
        suggestion:
          reqFile === 'config.json'
            ? 'Add a root config.json containing {"playable_orientation": 1} (0=both, 1=portrait, 2=landscape).'
            : `Include "${reqFile}" at the archive root.`
      });
    } else if (reqFile === 'config.json' && spec.id === 'tiktok') {
      try {
        const parsed = JSON.parse(found.content.toString('utf-8')) as Record<string, unknown>;
        const orientation = parsed.playable_orientation;
        if (orientation !== 0 && orientation !== 1 && orientation !== 2) {
          diagnostics.push({
            code: 'META_INVALID_TIKTOK_CONFIG',
            severity: 'error',
            category: 'metadata',
            message: `Invalid "playable_orientation" in config.json (got ${JSON.stringify(orientation)}). Expected 0, 1, or 2.`,
            suggestion: 'Set "playable_orientation" to 0 (responsive), 1 (portrait, recommended), or 2 (landscape).'
          });
        }
      } catch (err) {
        diagnostics.push({
          code: 'META_MALFORMED_JSON',
          severity: 'error',
          category: 'metadata',
          message: `Failed to parse config.json: ${err instanceof Error ? err.message : String(err)}`,
          suggestion: 'Ensure config.json is valid UTF-8 JSON.'
        });
      }
    }
  }

  // Parse HTML & collect text corpus for deeper checks
  const $ = loadHtml(artifact.entryHtmlContent);
  const corpus = collectAllTextCorpus(artifact);
  const cleanCorpus = stripJsComments(corpus);

  // 7. Required HTML <meta> tags (e.g. Google ad.orientation & ad.size)
  for (const metaName of spec.requiredMetaNames) {
    const metaEl = $(`meta[name="${metaName}"]`);
    if (metaEl.length === 0) {
      diagnostics.push({
        code: 'META_MISSING_TAG',
        severity: 'error',
        category: 'metadata',
        message: `Missing required <meta name="${metaName}"> tag in index.html for ${spec.displayName}.`,
        suggestion:
          metaName === 'ad.orientation'
            ? 'Add <meta name="ad.orientation" content="portrait,landscape"> inside <head>.'
            : metaName === 'ad.size'
              ? 'Add <meta name="ad.size" content="width=320,height=480"> inside <head>.'
              : `Add <meta name="${metaName}" content="..."> inside <head>.`
      });
    } else if (metaName === 'ad.orientation') {
      const content = (metaEl.attr('content') || '').trim().toLowerCase();
      const validValues = new Set(['portrait', 'landscape', 'portrait,landscape', 'landscape,portrait']);
      if (!validValues.has(content)) {
        diagnostics.push({
          code: 'META_INVALID_ORIENTATION',
          severity: 'error',
          category: 'metadata',
          message: `Invalid <meta name="ad.orientation" content="${content}"> value.`,
          suggestion: 'Use "portrait", "landscape", or "portrait,landscape".'
        });
      }
    } else if (metaName === 'ad.size') {
      const content = (metaEl.attr('content') || '').trim();
      if (!/width=\d+\s*,\s*height=\d+/i.test(content)) {
        diagnostics.push({
          code: 'META_INVALID_AD_SIZE',
          severity: 'error',
          category: 'metadata',
          message: `Invalid <meta name="ad.size" content="${content}"> format.`,
          suggestion: 'Use format "width=320,height=480" or "width=480,height=320".'
        });
      }
    }
  }

  // 8. MRAID, MRAID lifecycle gate & legacy DAPI checks
  const hasMraidScriptTag = $('script[src]').toArray().some((el) => {
    const src = ($(el).attr('src') || '').toLowerCase();
    return src.includes('mraid.js');
  });
  const hasMraidRef = /\bmraid\s*\.\s*(open|getState|addEventListener|isViewable)\b/.test(cleanCorpus);

  if (spec.mraidPolicy === 'forbidden' && (hasMraidScriptTag || hasMraidRef)) {
    diagnostics.push({
      code: 'SDK_FORBIDDEN_MRAID',
      severity: 'error',
      category: 'sdk',
      message: `${spec.displayName} forbids MRAID (${hasMraidScriptTag ? 'mraid.js tag' : 'mraid.* reference'} detected).`,
      suggestion: `Remove mraid.js / mraid.* references when exporting for ${spec.displayName}.`
    });
  } else if (spec.mraidPolicy === 'required' && !hasMraidScriptTag && !hasMraidRef) {
    diagnostics.push({
      code: 'SDK_MISSING_MRAID',
      severity: 'error',
      category: 'sdk',
      message: `${spec.displayName} requires MRAID v${spec.mraidVersion ?? '2.0'}, but no mraid.js or mraid.* call was found.`,
      suggestion: 'Include <script src="mraid.js"></script> (or runtime MRAID check) and call mraid.open() on CTA.'
    });
  }

  if (spec.requireMraidViewabilityGate && (hasMraidScriptTag || hasMraidRef)) {
    const hasReadyCheck =
      /mraid\s*\.\s*getState\b/.test(cleanCorpus) ||
      /addEventListener\s*\(\s*['"]ready['"]/.test(cleanCorpus);
    const hasViewableCheck =
      /mraid\s*\.\s*isViewable\b/.test(cleanCorpus) ||
      /addEventListener\s*\(\s*['"]viewableChange['"]/.test(cleanCorpus);

    if (!hasReadyCheck || !hasViewableCheck) {
      diagnostics.push({
        code: 'SDK_MRAID_MISSING_LIFECYCLE_GATE',
        severity: 'warning',
        category: 'lifecycle',
        message: `${spec.displayName} expects MRAID lifecycle gating (ready + viewableChange) before starting gameplay/audio.`,
        suggestion:
          'Check mraid.getState()/ready and mraid.isViewable()/viewableChange before starting timers or audio, and pause when not viewable.'
      });
    }
  }

  const hasLegacyDapi = /\bdapi\s*\.\s*(isReady|addEventListener|openStoreUrl|getScreenSize)\b|DAPI_SERVICE:|DAPI_AD:/.test(
    cleanCorpus
  );
  if (spec.forbidLegacyDapi && hasLegacyDapi) {
    diagnostics.push({
      code: 'SDK_DEPRECATED_DAPI',
      severity: 'warning',
      category: 'sdk',
      message: 'Legacy ironSource DAPI script/calls detected.',
      suggestion:
        'ironSource direct ads merged into Unity LevelPlay (April 2026). Migrate DAPI lifecycle & CTA calls to standard MRAID v3.0.'
    });
  }

  // 9. Required SDK script tags (Google exitapi.js, TikTok playable-sdk.js)
  for (const pattern of spec.requiredSdkScriptPatterns) {
    const hasScript = $('script[src]').toArray().some((el) => {
      const src = ($(el).attr('src') || '').toLowerCase();
      return src.includes(pattern.toLowerCase());
    });
    if (!hasScript) {
      const isGoogle = pattern.includes('exitapi.js');
      diagnostics.push({
        code: isGoogle ? 'SDK_MISSING_GOOGLE_EXITAPI' : 'SDK_MISSING_REQUIRED_SCRIPT',
        severity: 'error',
        category: 'sdk',
        message: `${spec.displayName} requires referencing "${pattern}" in index.html.`,
        suggestion: isGoogle
          ? 'Add <script type="text/javascript" src="https://tpc.googlesyndication.com/pagead/gadgets/html5/api/exitapi.js"></script> inside <head>.'
          : `Include the official ${spec.displayName} SDK script ("${pattern}") inside <head>.`
      });
    }
  }

  // 10. CTA signature static presence check
  const matchedCta = spec.ctaSignatures.filter((sig) => cleanCorpus.includes(sig));
  if (matchedCta.length === 0) {
    diagnostics.push({
      code: 'CTA_SIGNATURE_NOT_FOUND',
      severity: 'error',
      category: 'cta',
      message: `No expected CTA API (${spec.ctaSignatures.join(' / ')}) detected in code for ${spec.displayName}.`,
      suggestion: `Ensure your CTA button invokes ${spec.ctaSignatures[0]} on user tap/click.`
    });
  }

  // 10b. Meta / Moloco FbPlayableAd.onCTAClick must be called without arguments
  if ((spec.id === 'meta' || spec.id === 'moloco') && /FbPlayableAd\s*\.\s*onCTAClick\s*\(\s*[^)\s]/.test(cleanCorpus)) {
    diagnostics.push({
      code: 'CTA_FB_UNEXPECTED_ARGS',
      severity: 'warning',
      category: 'cta',
      message: `Detected arguments passed to FbPlayableAd.onCTAClick() on ${spec.displayName}.`,
      suggestion: 'Call FbPlayableAd.onCTAClick() with no arguments; the ad network resolves the store URL from campaign settings.'
    });
  }

  // 10c. Required lifecycle hooks (e.g. Mintegral gameReady & gameEnd)
  for (const hook of spec.requiredLifecycleHooks) {
    const hookRegex = new RegExp(`\\b${hook}\\s*\\(|window\\s*\\.\\s*${hook}\\b`);
    if (!hookRegex.test(cleanCorpus)) {
      diagnostics.push({
        code: 'LIFECYCLE_MISSING_HOOK',
        severity: 'error',
        category: 'lifecycle',
        message: `Missing required ${spec.displayName} lifecycle hook "${hook}()" in code.`,
        suggestion:
          hook === 'gameReady'
            ? 'Call window.gameReady && window.gameReady() once assets are loaded and the playable is ready to display.'
            : hook === 'gameEnd'
              ? 'Call window.gameEnd && window.gameEnd() when the playable round finishes (win or loss).'
              : `Invoke window.${hook}() according to ${spec.displayName} lifecycle guidelines.`
      });
    }
  }

  // 11. External URL & absolute path static scan
  const externalUrls = new Set<string>();
  const absolutePaths = new Set<string>();
  const checkAttrUrls = (selector: string, attr: string) => {
    $(selector).each((_idx, el) => {
      const val = ($(el).attr(attr) || '').trim();
      if (!val) return;
      if (/^https?:\/\//i.test(val)) {
        if (!isUrlAllowed(val, spec.allowedExternalUrlPrefixes)) {
          externalUrls.add(val);
        }
      } else if (spec.requireRelativePaths && val.startsWith('/') && !val.startsWith('//')) {
        absolutePaths.add(val);
      }
    });
  };
  checkAttrUrls('script[src]', 'src');
  checkAttrUrls('link[href]', 'href');
  checkAttrUrls('img[src]', 'src');
  checkAttrUrls('audio[src], video[src], source[src]', 'src');

  const jsExternalCallRegex = /(?:fetch\s*\(\s*|open\s*\(\s*['"][A-Z]+['"]\s*,\s*)['"](https?:\/\/[^'"\s)]+)['"]/gi;
  let callMatch: RegExpExecArray | null;
  while ((callMatch = jsExternalCallRegex.exec(cleanCorpus)) !== null) {
    const url = callMatch[1];
    if (!isUrlAllowed(url, spec.allowedExternalUrlPrefixes)) {
      externalUrls.add(url);
    }
  }

  if (externalUrls.size > 0) {
    diagnostics.push({
      code: 'NET_EXTERNAL_URL_STATIC',
      severity: 'error',
      category: 'network',
      message: `Found ${externalUrls.size} external HTTP/HTTPS reference(s) disallowed by ${spec.displayName}.`,
      suggestion: 'Bundle all scripts, styles, fonts, images, and API data locally inside the playable package.',
      details: { urls: Array.from(externalUrls) }
    });
  }

  if (absolutePaths.size > 0) {
    diagnostics.push({
      code: 'PATH_ABSOLUTE_REF',
      severity: 'error',
      category: 'structure',
      message: `Found ${absolutePaths.size} root-absolute asset path(s) (starting with "/") disallowed by ${spec.displayName}.`,
      suggestion: 'Convert root-absolute paths to relative paths (e.g. "./assets/hero.png" instead of "/assets/hero.png").',
      details: { paths: Array.from(absolutePaths) }
    });
  }

  // 12. Forbidden raw JS redirects (Meta / TikTok / Moloco / Mintegral)
  if (spec.forbidWindowRedirect) {
    const redirectRegex = /\bwindow\.open\s*\(|\b(?:window\.)?location\.(?:href\s*=|assign\s*\(|replace\s*\()/;
    if (redirectRegex.test(cleanCorpus)) {
      diagnostics.push({
        code: 'SEC_FORBIDDEN_JS_REDIRECT',
        severity: 'error',
        category: 'security',
        message: `Detected raw JS navigation/redirect (window.open / location.*), which is disallowed by ${spec.displayName}.`,
        suggestion: `Use ${spec.ctaSignatures[0]} instead of direct window/location redirects.`
      });
    }
  }

  // 13. Static autoplay audio/video tag check
  if (spec.forbidAutoplayAudio) {
    const unmutedAutoplay = $('audio[autoplay], video[autoplay]').toArray().filter((el) => {
      return $(el).attr('muted') === undefined;
    });
    if (unmutedAutoplay.length > 0) {
      diagnostics.push({
        code: 'AUDIO_AUTOPLAY_TAG',
        severity: 'error',
        category: 'audio',
        message: `Found ${unmutedAutoplay.length} unmuted <audio>/<video> element(s) with autoplay attribute.`,
        suggestion: 'Remove autoplay (or add muted) and only start sound after explicit user interaction.'
      });
    }
  }

  // 13b. iOS AdWebView muted <video autoplay> black-screen risk (issue #45)
  const mutedAutoplayVideo = $('video[autoplay][muted]');
  if (mutedAutoplayVideo.length > 0) {
    diagnostics.push({
      code: 'MEDIA_VIDEO_AUTOPLAY_IOS_RISK',
      severity: 'warning',
      category: 'render',
      message: `Found ${mutedAutoplayVideo.length} <video autoplay muted> tag(s); some iOS AdWebViews (e.g. AppLovin) render black screens on initial video autoplay.`,
      suggestion: 'Consider starting <video> playback after first user interaction or adding playsinline + webkit-playsinline fallback.'
    });
  }

  // 14. Security / CSP risk checks
  if (/\bdocument\.write\s*\(/.test(cleanCorpus)) {
    diagnostics.push({
      code: 'SEC_DOCUMENT_WRITE',
      severity: 'warning',
      category: 'security',
      message: 'Detected document.write(), which is blocked or unreliable in modern ad WebViews.',
      suggestion: 'Use standard DOM APIs (createElement/appendChild) instead of document.write().'
    });
  }

  // Google Ads & Meta strict CSP reject blob: script URLs (issues #16/#18/#26/#33/#35)
  if (
    (spec.id === 'google' || spec.id === 'meta') &&
    /createObjectURL\s*\(/.test(cleanCorpus) &&
    /text\/javascript|application\/javascript|createScript/.test(cleanCorpus)
  ) {
    diagnostics.push({
      code: 'SEC_CSP_BLOB_SCRIPT',
      severity: 'warning',
      category: 'security',
      message: `Detected Blob URL script loading (URL.createObjectURL with JS MIME/createScript); ${spec.displayName} strict CSP commonly blocks "blob:null/..." scripts and causes black screens.`,
      suggestion: 'Load inlined scripts via document.createElement("script") with script.text instead of URL.createObjectURL(blob).'
    });
  }

  if (spec.id === 'google' && /\beval\s*\(|new\s+Function\s*\(/.test(cleanCorpus)) {
    diagnostics.push({
      code: 'SEC_GOOGLE_CSP_EVAL',
      severity: 'warning',
      category: 'security',
      message: 'Detected eval() or new Function() in bundle; Google Ads strict CSP environments may block dynamic code evaluation.',
      suggestion: 'Avoid eval/new Function when targeting Google Ads, or verify against Google HTML5 Validator.'
    });
  }

  return diagnostics;
}
