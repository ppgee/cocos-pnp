import type { ChannelId, ChannelSpec } from '../types.js';

const MB = 1024 * 1024;

export const CHANNEL_SPECS: Record<ChannelId, ChannelSpec> = {
  applovin: {
    id: 'applovin',
    displayName: 'AppLovin (MAX / ALX)',
    aliases: ['app-lovin', 'alx', 'max'],
    acceptedFormats: ['single-html'],
    preferredFormat: 'single-html',
    maxSingleHtmlBytes: 5 * MB,
    zipEntryLayout: 'root-index',
    requireRelativePaths: true,
    requireLowercaseAsciiPaths: false,
    mraidPolicy: 'required',
    mraidVersion: '2.0',
    requireMraidViewabilityGate: true,
    forbidLegacyDapi: true,
    forbidWindowRedirect: false,
    requiredFiles: [],
    requiredMetaNames: [],
    requiredSdkScriptPatterns: [],
    ctaSignatures: ['mraid.open'],
    requiredLifecycleHooks: [],
    allowedExternalUrlPrefixes: [],
    forbidAutoplayAudio: true,
    requireDualOrientation: true,
    notes: [
      'Single self-contained HTML file (<= 5 MB; 2-4 MB recommended); ZIP uploads are rejected.',
      'Uses MRAID v2.0 with mraid.open() for CTA; must wait for mraid ready state before invoking MRAID APIs.',
      'Must support both portrait and landscape viewports, mute audio until first interaction, and avoid redirecting on first accidental tap.'
    ]
  },
  unity: {
    id: 'unity',
    displayName: 'Unity Ads / LevelPlay',
    aliases: ['unity-ads', 'levelplay', 'ironsource', 'iron-source'],
    acceptedFormats: ['single-html'],
    preferredFormat: 'single-html',
    maxSingleHtmlBytes: 5 * MB,
    zipEntryLayout: 'root-index',
    requireRelativePaths: true,
    requireLowercaseAsciiPaths: false,
    mraidPolicy: 'required',
    mraidVersion: '3.0',
    requireMraidViewabilityGate: true,
    forbidLegacyDapi: true,
    forbidWindowRedirect: false,
    requiredFiles: [],
    requiredMetaNames: [],
    requiredSdkScriptPatterns: [],
    ctaSignatures: ['mraid.open'],
    requiredLifecycleHooks: [],
    allowedExternalUrlPrefixes: [],
    forbidAutoplayAudio: true,
    requireDualOrientation: true,
    notes: [
      'Single self-contained HTML file (<= 5 MB; <= 4 MB recommended).',
      'ironSource direct ads merged into Unity LevelPlay (April 2026); migrate legacy DAPI calls to MRAID v3.0.',
      'Gate gameplay & audio start on MRAID ready + viewableChange, pause audio when hidden, and adapt to both portrait and landscape.'
    ]
  },
  google: {
    id: 'google',
    displayName: 'Google Ads (App Campaigns)',
    aliases: ['google-ads', 'adwords', 'uac'],
    acceptedFormats: ['zip'],
    preferredFormat: 'zip',
    maxZipBytes: 5 * MB,
    maxFileCount: 512,
    zipEntryLayout: 'root-index',
    allowedFileExtensions: ['.html', '.htm', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg'],
    requireRelativePaths: true,
    requireLowercaseAsciiPaths: false,
    mraidPolicy: 'forbidden',
    requireMraidViewabilityGate: false,
    forbidLegacyDapi: true,
    forbidWindowRedirect: false,
    requiredFiles: [],
    requiredMetaNames: ['ad.orientation', 'ad.size'],
    requiredSdkScriptPatterns: ['tpc.googlesyndication.com/pagead/gadgets/html5/api/exitapi.js'],
    ctaSignatures: ['ExitApi.exit'],
    requiredLifecycleHooks: [],
    allowedExternalUrlPrefixes: [
      'https://tpc.googlesyndication.com/pagead/gadgets/html5/api/exitapi.js',
      'https://fonts.googleapis.com/',
      'https://fonts.gstatic.com/',
      'https://s0.2mdn.net/'
    ],
    forbidAutoplayAudio: true,
    requireDualOrientation: false,
    notes: [
      'ZIP archive (<= 5 MB, <= 512 files) with index.html at the root and relative asset paths.',
      'Official allowed bare file types in ZIP: HTML, CSS, JS, PNG, JPG, JPEG, GIF, SVG (inline audio/fonts/WASM into JS/HTML).',
      'Requires <meta name="ad.orientation">, <meta name="ad.size">, exitapi.js, and ExitApi.exit() for CTA.'
    ]
  },
  meta: {
    id: 'meta',
    displayName: 'Meta (Facebook / Instagram)',
    aliases: ['facebook', 'fb', 'instagram'],
    acceptedFormats: ['single-html', 'zip'],
    preferredFormat: 'zip',
    maxSingleHtmlBytes: 2 * MB,
    maxZipBytes: 5 * MB,
    maxEntryHtmlBytes: 2 * MB,
    maxFileCount: 100,
    zipEntryLayout: 'root-index',
    requireRelativePaths: true,
    requireLowercaseAsciiPaths: false,
    mraidPolicy: 'forbidden',
    requireMraidViewabilityGate: false,
    forbidLegacyDapi: true,
    forbidWindowRedirect: true,
    requiredFiles: [],
    requiredMetaNames: [],
    requiredSdkScriptPatterns: [],
    ctaSignatures: ['FbPlayableAd.onCTAClick'],
    requiredLifecycleHooks: [],
    allowedExternalUrlPrefixes: [],
    forbidAutoplayAudio: true,
    requireDualOrientation: false,
    notes: [
      'Single HTML <= 2 MB; ZIP <= 5 MB (<= 100 files) AND root index.html inside ZIP must still be <= 2 MB.',
      'Forbids mraid.js, external HTTP requests, and raw JS redirects (window.open / location.href).',
      'Use FbPlayableAd.onCTAClick() with no arguments for CTA.'
    ]
  },
  tiktok: {
    id: 'tiktok',
    displayName: 'TikTok / Pangle',
    aliases: ['pangle', 'bytedance', 'tt'],
    acceptedFormats: ['zip'],
    preferredFormat: 'zip',
    maxZipBytes: 5 * MB,
    zipEntryLayout: 'root-index',
    requireRelativePaths: true,
    requireLowercaseAsciiPaths: false,
    mraidPolicy: 'forbidden',
    requireMraidViewabilityGate: false,
    forbidLegacyDapi: true,
    forbidWindowRedirect: true,
    requiredFiles: ['config.json'],
    requiredMetaNames: [],
    requiredSdkScriptPatterns: ['playable-sdk.js'],
    ctaSignatures: ['window.openAppStore', 'openAppStore', 'playableSDK.openAppStore'],
    requiredLifecycleHooks: [],
    allowedExternalUrlPrefixes: [
      'https://sf16-muse-va.ibytedtos.com/',
      'https://sf16-fe-tos-sg.i18n-pglstatp.com/'
    ],
    forbidAutoplayAudio: true,
    requireDualOrientation: false,
    notes: [
      'ZIP archive (<= 5 MB) with index.html and config.json at the root (no nested folder).',
      'config.json must specify playable_orientation (0 = both, 1 = portrait [recommended for TikTok feed], 2 = landscape).',
      'Include TikTok playable-sdk.js and call window.openAppStore(); do NOT include mraid.js or hardcoded redirects.'
    ]
  },
  mintegral: {
    id: 'mintegral',
    displayName: 'Mintegral',
    aliases: ['mtg', 'mindworks'],
    acceptedFormats: ['zip', 'single-html'],
    preferredFormat: 'zip',
    maxSingleHtmlBytes: 5 * MB,
    maxZipBytes: 5 * MB,
    zipEntryLayout: 'matching-folder-or-root',
    requireRelativePaths: true,
    requireLowercaseAsciiPaths: false,
    mraidPolicy: 'forbidden',
    requireMraidViewabilityGate: false,
    forbidLegacyDapi: true,
    forbidWindowRedirect: true,
    requiredFiles: [],
    requiredMetaNames: [],
    requiredSdkScriptPatterns: [],
    ctaSignatures: ['window.install'],
    requiredLifecycleHooks: ['gameReady', 'gameEnd'],
    allowedExternalUrlPrefixes: [],
    forbidAutoplayAudio: true,
    requireDualOrientation: false,
    notes: [
      'ZIP archive (<= 5 MB). Classic Mintegral naming expects matching ZIP/folder/HTML names (e.g. demo.zip -> demo/demo.html), or root index.html.',
      'Does NOT use MRAID; requires proprietary lifecycle hooks: window.gameReady(), window.gameEnd(), and window.install() for CTA.',
      'Define window.gameStart / window.gameClose handlers so Mintegral container can control audio and lifecycle.'
    ]
  },
  moloco: {
    id: 'moloco',
    displayName: 'Moloco',
    aliases: ['moloco-ads'],
    acceptedFormats: ['single-html'],
    preferredFormat: 'single-html',
    maxSingleHtmlBytes: 5 * MB,
    zipEntryLayout: 'root-index',
    requireRelativePaths: true,
    requireLowercaseAsciiPaths: false,
    mraidPolicy: 'forbidden',
    requireMraidViewabilityGate: false,
    forbidLegacyDapi: true,
    forbidWindowRedirect: true,
    requiredFiles: [],
    requiredMetaNames: [],
    requiredSdkScriptPatterns: [],
    ctaSignatures: ['FbPlayableAd.onCTAClick'],
    requiredLifecycleHooks: [],
    allowedExternalUrlPrefixes: [],
    forbidAutoplayAudio: true,
    requireDualOrientation: true,
    notes: [
      'Single self-contained HTML file (<= 5 MB); ZIP archives are rejected.',
      'Strictly forbids mraid.js, external network calls, and raw JS redirects.',
      'Uses Meta-compatible FbPlayableAd.onCTAClick() (no arguments) and must support both portrait and landscape.'
    ]
  },
  liftoff: {
    id: 'liftoff',
    displayName: 'Liftoff / Vungle',
    aliases: ['vungle', 'liftoff-monetize'],
    acceptedFormats: ['zip', 'single-html'],
    preferredFormat: 'zip',
    maxSingleHtmlBytes: 5 * MB,
    maxZipBytes: 5 * MB,
    zipEntryLayout: 'root-index-or-ad',
    requireRelativePaths: true,
    requireLowercaseAsciiPaths: true,
    mraidPolicy: 'optional',
    requireMraidViewabilityGate: false,
    forbidLegacyDapi: true,
    forbidWindowRedirect: false,
    requiredFiles: [],
    requiredMetaNames: [],
    requiredSdkScriptPatterns: [],
    ctaSignatures: ['postMessage(\'download\'', 'postMessage("download"', 'mraid.open'],
    requiredLifecycleHooks: [],
    allowedExternalUrlPrefixes: [],
    forbidAutoplayAudio: true,
    requireDualOrientation: false,
    notes: [
      'ZIP archive or single HTML (<= 5 MB); ZIP root entry must be index.html or ad.html.',
      'All file/folder names must be lowercase ASCII with no spaces, using relative paths only.',
      'Trigger CTA with parent.postMessage("download", "*") (or MRAID fallback), fire parent.postMessage("complete", "*") after genuine gameplay (never on click), and handle ad-event-pause / ad-event-resume.'
    ]
  }
};

export const ALL_CHANNEL_IDS: ChannelId[] = Object.keys(CHANNEL_SPECS) as ChannelId[];

export interface ResolvedChannel {
  id: ChannelId;
  spec: ChannelSpec;
  deprecatedNotice?: string;
}

export function resolveChannel(input: string): ResolvedChannel {
  const normalized = input.trim().toLowerCase();

  if (normalized in CHANNEL_SPECS) {
    const id = normalized as ChannelId;
    return { id, spec: CHANNEL_SPECS[id] };
  }

  for (const spec of Object.values(CHANNEL_SPECS)) {
    if (spec.aliases.includes(normalized)) {
      const deprecatedNotice =
        normalized === 'ironsource' || normalized === 'iron-source'
          ? 'ironSource direct ads merged into Unity LevelPlay (April 2026); mapped to "unity" MRAID v3.0 rules.'
          : undefined;
      return { id: spec.id, spec, deprecatedNotice };
    }
  }

  throw new Error(
    `Unknown channel "${input}". Supported channels: ${ALL_CHANNEL_IDS.join(', ')} (aliases: facebook, pangle, ironsource, vungle, mtg, etc.)`
  );
}

export function resolveChannels(inputs?: string[]): ResolvedChannel[] {
  if (!inputs || inputs.length === 0) {
    return ALL_CHANNEL_IDS.map((id) => ({ id, spec: CHANNEL_SPECS[id] }));
  }

  const expanded = inputs
    .flatMap((item) => item.split(','))
    .map((item) => item.trim())
    .filter(Boolean);

  if (expanded.length === 0 || expanded.some((item) => item.toLowerCase() === 'all')) {
    return ALL_CHANNEL_IDS.map((id) => ({ id, spec: CHANNEL_SPECS[id] }));
  }

  const seen = new Set<ChannelId>();
  const resolved: ResolvedChannel[] = [];
  for (const raw of expanded) {
    const match = resolveChannel(raw);
    if (!seen.has(match.id)) {
      seen.add(match.id);
      resolved.push(match);
    }
  }
  return resolved;
}
