export type ChannelId =
  | 'applovin'
  | 'unity'
  | 'google'
  | 'meta'
  | 'tiktok'
  | 'mintegral'
  | 'moloco'
  | 'liftoff';

export type ArtifactFormat = 'single-html' | 'zip' | 'directory';

export type ZipEntryLayout =
  | 'root-index'
  | 'root-index-or-ad'
  | 'matching-folder-or-root';

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export type DiagnosticCategory =
  | 'format'
  | 'size'
  | 'structure'
  | 'metadata'
  | 'network'
  | 'sdk'
  | 'security'
  | 'runtime'
  | 'audio'
  | 'render'
  | 'cta'
  | 'lifecycle';

export interface Diagnostic {
  code: string;
  severity: DiagnosticSeverity;
  category: DiagnosticCategory;
  message: string;
  suggestion?: string;
  details?: Record<string, unknown>;
}

export interface ChannelSpec {
  id: ChannelId;
  displayName: string;
  aliases: string[];
  /** Allowed final submission formats */
  acceptedFormats: Array<'single-html' | 'zip'>;
  /** Preferred submission format */
  preferredFormat: 'single-html' | 'zip';
  /** Maximum size in bytes for single-html submission */
  maxSingleHtmlBytes?: number;
  /** Maximum size in bytes for zip submission */
  maxZipBytes?: number;
  /** Maximum size in bytes for the entry HTML file itself even inside a ZIP (e.g. Meta 2MB rule) */
  maxEntryHtmlBytes?: number;
  /** Maximum file count inside a zip archive */
  maxFileCount?: number;
  /** Expected ZIP entry layout */
  zipEntryLayout: ZipEntryLayout;
  /** Strict whitelist of allowed file extensions inside ZIP (if applicable, e.g. Google Ads) */
  allowedFileExtensions?: string[];
  /** Disallow root-relative paths like "/assets/foo.png" */
  requireRelativePaths: boolean;
  /** Enforce lowercase ASCII-only paths with no spaces (e.g. Liftoff/Vungle) */
  requireLowercaseAsciiPaths: boolean;
  /** MRAID protocol policy */
  mraidPolicy: 'required' | 'optional' | 'forbidden';
  mraidVersion?: '2.0' | '3.0';
  /** Recommend/require MRAID ready + viewableChange lifecycle gating (e.g. Unity LevelPlay) */
  requireMraidViewabilityGate: boolean;
  /** Whether legacy ironSource DAPI should be flagged as deprecated */
  forbidLegacyDapi: boolean;
  /** Disallow raw JS navigation redirects (window.open / location.href) */
  forbidWindowRedirect: boolean;
  /** Required manifest files at zip root (e.g. TikTok config.json) */
  requiredFiles: string[];
  /** Required HTML meta names (e.g. Google ad.orientation, ad.size) */
  requiredMetaNames: string[];
  /** Required external or local SDK script src substrings (e.g. exitapi.js, playable-sdk.js) */
  requiredSdkScriptPatterns: string[];
  /** Expected CTA API patterns (for static scan & runtime mock verification) */
  ctaSignatures: string[];
  /** Required lifecycle hooks to check in static scan (e.g. Mintegral gameReady & gameEnd) */
  requiredLifecycleHooks: string[];
  /** Allowed external URL prefixes (e.g. Google exitapi.js) */
  allowedExternalUrlPrefixes: string[];
  /** Disallow automatic audio playback before user gesture */
  forbidAutoplayAudio: boolean;
  /** Require responsive support in both portrait and landscape viewports */
  requireDualOrientation: boolean;
  /** Human-readable notes reflecting 2026 network policy */
  notes: string[];
}

export interface ArtifactEntry {
  /** Normalized POSIX relative path inside package, e.g. "index.html" or "assets/hero.png" */
  path: string;
  /** Uncompressed byte length */
  bytes: number;
  /** File extension (lowercase, including dot), e.g. ".png" */
  ext: string;
  /** Raw content buffer */
  content: Buffer;
}

export interface InlineAssetBreakdownItem {
  label: string;
  kind: 'script' | 'style' | 'data-uri-image' | 'data-uri-audio' | 'data-uri-font' | 'data-uri-other' | 'file';
  bytes: number;
  estimatedRawBytes?: number;
  sourcePath: string;
}

export interface SizeBreakdown {
  /** Total package size in bytes (the .html file size, .zip file size, or sum of directory files) */
  totalBytes: number;
  /** Uncompressed total bytes of all entries */
  uncompressedBytes: number;
  /** Entry HTML uncompressed size in bytes */
  entryHtmlBytes: number;
  /** File count */
  fileCount: number;
  /** Grouped byte totals by category */
  byCategory: Record<string, number>;
  /** Top N largest files or inline payloads */
  topContributors: InlineAssetBreakdownItem[];
  /** Total bytes occupied by inline base64 data URIs */
  inlineBase64Bytes: number;
  /** Estimated bytes lost to base64 ~33% encoding overhead */
  estimatedBase64OverheadBytes: number;
}

export interface LoadedArtifact {
  inputPath: string;
  /** Archive/file basename without extension (used for Mintegral matching-folder checks) */
  archiveBaseName: string;
  format: ArtifactFormat;
  /** Byte size of the packaged artifact on disk (or sum of files for directory) */
  artifactBytes: number;
  entries: ArtifactEntry[];
  /** Path to the entry HTML file inside `entries` (e.g. "index.html") */
  entryHtmlPath: string | null;
  /** Uncompressed size of entry HTML */
  entryHtmlBytes: number;
  /** Original HTML string if found */
  entryHtmlContent: string | null;
  /** Whether all entries are wrapped under a single nested top-level folder inside a zip */
  hasNestedRootFolder: boolean;
  /** Name of the single top-level folder if `hasNestedRootFolder` is true */
  nestedRootFolderName: string | null;
}

export interface LandscapeCheckResult {
  executed: boolean;
  viewport: { width: number; height: number };
  isBlankScreen: boolean;
  blankScreenDetails?: string;
  consoleErrors: string[];
  pageErrors: string[];
}

export interface RuntimeCheckResult {
  executed: boolean;
  skippedReason?: string;
  browserExecutablePath?: string;
  loadTimeMs?: number;
  consoleErrors: string[];
  pageErrors: string[];
  blockedExternalRequests: Array<{ url: string; resourceType: string }>;
  audioPlayedBeforeInteraction: Array<{ api: string; timestampMs: number }>;
  audioPlayedAfterInteraction: Array<{ api: string; timestampMs: number }>;
  ctaTriggered: Array<{ channel: string; api: string; args: unknown[] }>;
  lifecycleEvents: string[];
  canvasCount: number;
  isBlankScreen: boolean;
  blankScreenDetails?: string;
  viewport: { width: number; height: number };
  landscapeCheck?: LandscapeCheckResult;
}

export interface ChannelValidationReport {
  channel: ChannelId;
  displayName: string;
  passed: boolean;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  diagnostics: Diagnostic[];
  runtime: RuntimeCheckResult;
}

export interface ValidationReport {
  tool: string;
  version: string;
  timestamp: string;
  inputPath: string;
  format: ArtifactFormat;
  sizeBreakdown: SizeBreakdown;
  passed: boolean;
  channels: ChannelValidationReport[];
}

export interface ValidateOptions {
  /** Path to .html file, .zip archive, or build directory */
  inputPath: string;
  /** Target channel(s) to validate against; defaults to all 8 channels */
  channels?: string[];
  /** Skip Playwright headless runtime check */
  staticOnly?: boolean;
  /** Explicit path to Chrome/Chromium executable */
  browserPath?: string;
  /** Optional CSS selector to click during runtime CTA probe */
  ctaSelector?: string;
  /** Viewport size for headless browser check (defaults to 390x844 mobile portrait) */
  viewport?: { width: number; height: number };
  /** Wait duration after load before sampling render/errors (ms, default 1200) */
  settleMs?: number;
  /** Top N largest size contributors to include in report (default 10) */
  topN?: number;
}
