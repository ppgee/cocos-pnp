import type { BridgeGeneratorOptions } from '@ppgee/playable-sdk';
import type { ChannelId, ValidationReport } from '@ppgee/playable-validator';
import type { EngineAdapter } from './adapters/types.js';
import type { AssetOptimizeOptions, OptimizationSummary } from './optimizer/asset-optimizer.js';
import type { PayloadEncoding } from './vfs/payload.js';

export type OrientationMode = 'portrait' | 'landscape' | 'auto';

export interface CustomChannelInject {
  head?: string;
  body?: string;
  sdkScript?: string;
}

export interface PlayableVariantConfig {
  /** Variant identifier used for output subfolder & Mintegral naming (e.g. "en_easy", "ja_hard") */
  id: string;
  /** Optional human-readable label shown in audit reports */
  label?: string;
  /** Runtime JSON parameters injected as `window.__PLAYABLE_CONFIG__` before game scripts run */
  config?: Record<string, unknown>;
  /** Optional per-variant channel subset override */
  channels?: string[];
  /** Optional per-variant orientation override */
  orientation?: OrientationMode;
  /** Optional per-variant storeUrls override */
  storeUrls?: BridgeGeneratorOptions;
  /** Optional per-variant packageName override */
  packageName?: string;
}

export interface VariantBuildSummary {
  id: string;
  label?: string;
  config?: Record<string, unknown>;
  outputDir: string;
  artifactCount: number;
  allValid: boolean;
}

export interface BuildPlayableOptions {
  /** Input build directory (Vite/PixiJS/Three.js/PlayCanvas/Cocos/Godot/Laya/etc.) or single .html file */
  inputPath: string;
  /** Output directory where per-channel packages will be written */
  outputDir: string;
  /** Target channel(s) to export; defaults to all 8 channels */
  channels?: string[];
  /** Optional explicit engine adapter id (e.g. 'generic-web', 'playcanvas', 'cocos-3x', or a custom adapter id); defaults to 'auto' */
  engine?: string;
  /** Optional custom EngineAdapter plugins prepended ahead of built-in adapters */
  adapters?: EngineAdapter[];
  /** Orientation metadata for Google & TikTok (default: 'auto') */
  orientation?: OrientationMode;
  /** Base package name (used for Mintegral matching folder/file naming, default: derived from inputPath) */
  packageName?: string;
  /** Enable pako deflate compression for single-HTML bundles when beneficial (default: true) */
  compress?: boolean;
  /** Binary payload encoding for compressed VFS ('base64' default | 'base122' ~14% smaller | 'auto') */
  encoding?: PayloadEncoding;
  /** Enable zero-API-key offline local asset optimization (sharp images + ffmpeg audio/video + JSON/SVG/CSS minification) */
  optimize?: boolean | AssetOptimizeOptions;
  /**
   * Optional target final package size budget (e.g. "5MB", "2MB", 4500000, or "auto" to fit the tightest target channel limit).
   * Automatically enables optimization and escalates compression presets from clean originals until emitted artifacts fit under budget.
   */
  targetSize?: number | string | 'auto';
  /** Whether to inject @ppgee/playable-sdk channel bridge automatically (default: true) */
  injectSdkBridge?: boolean;
  /** Store URLs for MRAID channels (AppLovin / Unity) */
  storeUrls?: BridgeGeneratorOptions;
  /** Optional per-channel custom HTML snippets (compatible with .adapterrc style) */
  injectOptions?: Partial<Record<ChannelId, CustomChannelInject>>;
  /** Optional single-build variant identifier exposed as `window.__PLAYABLE_VARIANT__` */
  variantId?: string;
  /** Optional single-build human label for the variant */
  variantLabel?: string;
  /** Optional single-build runtime config injected as `window.__PLAYABLE_CONFIG__` */
  runtimeConfig?: Record<string, unknown>;
  /** Optional multi-variant matrix (builds each variant x channels into `<outputDir>/<variant.id>/`) */
  variants?: PlayableVariantConfig[];
  /** Adapter-specific extra options (e.g. `{ disableSplash: true }` for Cocos 3.x) */
  adapterOptions?: Record<string, unknown>;
  /** @deprecated Pass via adapterOptions.disableSplash or keep for convenience */
  disableSplash?: boolean;
  /** Run @ppgee/playable-validator on every generated output artifact (default: false) */
  validate?: boolean;
  /** When validate=true, skip headless browser runtime checks */
  staticOnly?: boolean;
  /** When validate=true and staticOnly=false, embed portrait/landscape screenshots in validation report */
  captureScreenshots?: boolean;
  /** Explicit Chrome/Chromium path for runtime validation */
  browserPath?: string;
}

export interface VirtualFile {
  /** Normalized POSIX relative path */
  path: string;
  ext: string;
  content: Buffer;
}

export interface LoadedSource {
  inputPath: string;
  /** Matched engine adapter id (e.g. 'generic-web', 'playcanvas', 'cocos-3x', or custom) */
  engineId: string;
  /** Matched engine adapter instance */
  adapter: EngineAdapter;
  entryHtmlPath: string;
  files: VirtualFile[];
}

export interface ChannelBuildArtifact {
  channel: ChannelId;
  displayName: string;
  format: 'single-html' | 'zip';
  outputPath: string;
  bytes: number;
  variant?: string;
  variantLabel?: string;
  validation?: ValidationReport;
}

export interface BuildPlayableResult {
  inputPath: string;
  outputDir: string;
  /** Matched engine adapter id */
  engine: string;
  /** Optional asset optimization summary when `optimize` is enabled */
  optimization?: OptimizationSummary;
  /** Present when built with multi-variant matrix (`options.variants`) */
  variants?: VariantBuildSummary[];
  artifacts: ChannelBuildArtifact[];
  allValid: boolean;
}
