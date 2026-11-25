import type { BridgeGeneratorOptions } from '@cocos-pnp/playable-sdk';
import type { ChannelId, ValidationReport } from '@cocos-pnp/playable-validator';
import type { EngineAdapter } from './adapters/types.js';
import type { AssetOptimizeOptions, OptimizationSummary } from './optimizer/asset-optimizer.js';

export type OrientationMode = 'portrait' | 'landscape' | 'auto';

export interface CustomChannelInject {
  head?: string;
  body?: string;
  sdkScript?: string;
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
  /** Enable zero-API-key offline local asset optimization (sharp images + ffmpeg audio/video + JSON/SVG/CSS minification) */
  optimize?: boolean | AssetOptimizeOptions;
  /**
   * Optional target final package size budget (e.g. "5MB", "2MB", 4500000, or "auto" to fit the tightest target channel limit).
   * Automatically enables optimization and escalates compression presets from clean originals until emitted artifacts fit under budget.
   */
  targetSize?: number | string | 'auto';
  /** Whether to inject @cocos-pnp/playable-sdk channel bridge automatically (default: true) */
  injectSdkBridge?: boolean;
  /** Store URLs for MRAID channels (AppLovin / Unity) */
  storeUrls?: BridgeGeneratorOptions;
  /** Optional per-channel custom HTML snippets (compatible with .adapterrc style) */
  injectOptions?: Partial<Record<ChannelId, CustomChannelInject>>;
  /** Adapter-specific extra options (e.g. `{ disableSplash: true }` for Cocos 3.x) */
  adapterOptions?: Record<string, unknown>;
  /** @deprecated Pass via adapterOptions.disableSplash or keep for convenience */
  disableSplash?: boolean;
  /** Run @cocos-pnp/playable-validator on every generated output artifact (default: false) */
  validate?: boolean;
  /** When validate=true, skip headless browser runtime checks */
  staticOnly?: boolean;
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
  validation?: ValidationReport;
}

export interface BuildPlayableResult {
  inputPath: string;
  outputDir: string;
  /** Matched engine adapter id */
  engine: string;
  /** Optional asset optimization summary when `optimize` is enabled */
  optimization?: OptimizationSummary;
  artifacts: ChannelBuildArtifact[];
  allValid: boolean;
}
