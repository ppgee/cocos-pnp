import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { VirtualFile } from '../types.js';
import {
  JS_EXTS,
  loadEsbuild,
  minifyCodeBuffer,
  treeShakeEsModules,
  type CodeOptimizeOptions
} from './code-optimizer.js';
import {
  extractUsedCharacters,
  FONT_EXTS,
  loadSubsetFont,
  subsetFontBuffer,
  type FontSubsetOptions
} from './font-subsetter.js';
import {
  AUDIO_EXTS,
  detectFfmpegBinary,
  transcodeMediaBuffer,
  VIDEO_EXTS,
  type MediaTranscodeOptions
} from './media-transcoder.js';
import {
  loadSvgo,
  optimizeSvgString,
  vectorizeImageBufferToSvg,
  type SvgOptimizeOptions,
  type VectorizeIconOptions
} from './svg-optimizer.js';

export type OptimizableAssetKind = 'image' | 'audio' | 'video' | 'font' | 'svg' | 'code' | 'text';

export interface AssetOptimizeOptions
  extends MediaTranscodeOptions,
    FontSubsetOptions,
    SvgOptimizeOptions,
    VectorizeIconOptions,
    CodeOptimizeOptions {
  /** Enable local image optimization via sharp (default: true) */
  optimizeImages?: boolean;
  /** Enable local audio transcoding via ffmpeg (default: true) */
  optimizeAudio?: boolean;
  /** Enable local video transcoding via ffmpeg with faststart moov atom (default: true) */
  optimizeVideo?: boolean;
  /** Enable local font subsetting (TTF/OTF/WOFF/WOFF2) via subset-font (default: true) */
  optimizeFonts?: boolean;
  /** Enable SVGO deep vector optimization for .svg assets (default: true) */
  optimizeSvg?: boolean;
  /** Opt-in: vectorize small low-color PNG/WebP UI icons into SVGO-compressed .svg when strictly smaller (default: false) */
  vectorizeIcons?: boolean;
  /** Enable safe whitespace minification for JSON assets (default: true) */
  minifyTextAssets?: boolean;
  /** Image compression quality 1-100 (default: 75) */
  quality?: number;
  /** Optional maximum image width/height in pixels; preserves aspect ratio and never enlarges */
  maxDimension?: number;
  /** Enable 8-bit palette quantization for PNG (TinyPNG-equivalent offline compression, default: true) */
  pngPalette?: boolean;
  /** Minimum bytes saved to keep the optimized version (default: 64) */
  minSavingsBytes?: number;
  /** Optional target total size budget in bytes; escalates across compression presets until met */
  targetSizeBytes?: number;
  /** Concurrency limit for parallel asset processing (default: 3) */
  concurrency?: number;
}

export interface BudgetPreset {
  name: 'balanced' | 'compact' | 'aggressive' | 'ultra';
  quality: number;
  maxDimension: number;
  audioBitrateKbps: number;
  audioSampleRate: number;
  audioChannels: 1;
  videoCrf: number;
  videoMaxWidth: number;
  videoFps: number;
  videoAudioBitrateKbps: number;
  svgFloatPrecision: number;
  dropConsole: boolean;
}

export const BUDGET_PRESETS: readonly BudgetPreset[] = [
  {
    name: 'balanced',
    quality: 75,
    maxDimension: 1024,
    audioBitrateKbps: 64,
    audioSampleRate: 24000,
    audioChannels: 1,
    videoCrf: 28,
    videoMaxWidth: 720,
    videoFps: 24,
    videoAudioBitrateKbps: 48,
    svgFloatPrecision: 2,
    dropConsole: false
  },
  {
    name: 'compact',
    quality: 60,
    maxDimension: 768,
    audioBitrateKbps: 48,
    audioSampleRate: 22050,
    audioChannels: 1,
    videoCrf: 31,
    videoMaxWidth: 540,
    videoFps: 20,
    videoAudioBitrateKbps: 36,
    svgFloatPrecision: 2,
    dropConsole: false
  },
  {
    name: 'aggressive',
    quality: 45,
    maxDimension: 512,
    audioBitrateKbps: 32,
    audioSampleRate: 22050,
    audioChannels: 1,
    videoCrf: 34,
    videoMaxWidth: 480,
    videoFps: 15,
    videoAudioBitrateKbps: 28,
    svgFloatPrecision: 1,
    dropConsole: true
  },
  {
    name: 'ultra',
    quality: 30,
    maxDimension: 384,
    audioBitrateKbps: 24,
    audioSampleRate: 16000,
    audioChannels: 1,
    videoCrf: 37,
    videoMaxWidth: 360,
    videoFps: 12,
    videoAudioBitrateKbps: 24,
    svgFloatPrecision: 1,
    dropConsole: true
  }
];

export interface OptimizedFileItem {
  path: string;
  kind: OptimizableAssetKind;
  originalBytes: number;
  optimizedBytes: number;
  savedBytes: number;
  applied: boolean;
  reason?: string;
}

export interface KindOptimizationStats {
  processed: number;
  optimized: number;
  savedBytes: number;
}

export interface BudgetOptimizationReport {
  targetBytes: number;
  finalBytes: number;
  met: boolean;
  passesRun: number;
  appliedPreset: string;
}

export interface OptimizationSummary {
  available: boolean;
  warning?: string;
  warnings: string[];
  tools: {
    sharp: boolean;
    ffmpeg: boolean;
    subsetFont: boolean;
    svgo: boolean;
    esbuild: boolean;
  };
  processedCount: number;
  optimizedCount: number;
  skippedCount: number;
  originalBytes: number;
  optimizedBytes: number;
  savedBytes: number;
  savedPercent: number;
  byKind: Record<OptimizableAssetKind, KindOptimizationStats>;
  budget?: BudgetOptimizationReport;
  items: OptimizedFileItem[];
}

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const VECTORIZABLE_EXTS = new Set(['.png', '.webp']);
const REF_REWRITE_EXTS = new Set(['.html', '.htm', '.css', '.js', '.mjs', '.cjs', '.json']);

type SharpFn = (input: Buffer) => {
  metadata: () => Promise<{ width?: number; height?: number }>;
  resize: (opts: { width?: number; height?: number; fit: 'inside'; withoutEnlargement: boolean }) => ReturnType<SharpFn>;
  png: (opts: { palette?: boolean; quality?: number; compressionLevel?: number; effort?: number }) => ReturnType<SharpFn>;
  jpeg: (opts: { quality?: number; mozjpeg?: boolean }) => ReturnType<SharpFn>;
  webp: (opts: { quality?: number; effort?: number }) => ReturnType<SharpFn>;
  toBuffer: () => Promise<Buffer>;
};

async function loadSharp(): Promise<SharpFn | null> {
  try {
    const mod = await import('sharp');
    return (mod.default ?? mod) as unknown as SharpFn;
  } catch {
    return null;
  }
}

/**
 * Parses human-readable byte size strings such as "5MB", "2.5mb", "800KB", or raw numbers.
 */
export function parseByteSize(input: string | number): number {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input <= 0) {
      throw new Error(`Invalid byte size "${input}". Expected a positive number.`);
    }
    return Math.round(input);
  }
  const trimmed = input.trim().toLowerCase();
  const match = /^(\d+(?:\.\d+)?)\s*(b|kb|k|mb|m|gb|g)?$/.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid size string "${input}". Examples: "5MB", "2MB", "450KB", "2097152".`);
  }
  const value = Number(match[1]);
  const unit = match[2] || 'b';
  const mult =
    unit === 'gb' || unit === 'g'
      ? 1024 * 1024 * 1024
      : unit === 'mb' || unit === 'm'
        ? 1024 * 1024
        : unit === 'kb' || unit === 'k'
          ? 1024
          : 1;
  const bytes = Math.round(value * mult);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    throw new Error(`Invalid size "${input}".`);
  }
  return bytes;
}

function minifyJsonAsset(content: Buffer): Buffer | null {
  try {
    return Buffer.from(JSON.stringify(JSON.parse(content.toString('utf-8'))), 'utf-8');
  } catch {
    return null;
  }
}

function fallbackMinifyCss(content: Buffer): Buffer {
  const minified = content
    .toString('utf-8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*([{}:;,])\s*/g, '$1')
    .replace(/;}/g, '}')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return Buffer.from(minified, 'utf-8');
}

function classifyAssetKind(ext: string): OptimizableAssetKind | null {
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (AUDIO_EXTS.has(ext)) return 'audio';
  if (VIDEO_EXTS.has(ext)) return 'video';
  if (FONT_EXTS.has(ext)) return 'font';
  if (ext === '.svg') return 'svg';
  if (JS_EXTS.has(ext) || ext === '.css') return 'code';
  if (ext === '.json') return 'text';
  return null;
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) break;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return results;
}

function totalVirtualBytes(files: VirtualFile[]): number {
  let sum = 0;
  for (const f of files) {
    sum += f.content.byteLength;
  }
  return sum;
}

function createEmptyByKind(): Record<OptimizableAssetKind, KindOptimizationStats> {
  return {
    image: { processed: 0, optimized: 0, savedBytes: 0 },
    audio: { processed: 0, optimized: 0, savedBytes: 0 },
    video: { processed: 0, optimized: 0, savedBytes: 0 },
    font: { processed: 0, optimized: 0, savedBytes: 0 },
    svg: { processed: 0, optimized: 0, savedBytes: 0 },
    code: { processed: 0, optimized: 0, savedBytes: 0 },
    text: { processed: 0, optimized: 0, savedBytes: 0 }
  };
}

async function optimizeSinglePass(
  files: VirtualFile[],
  options: AssetOptimizeOptions
): Promise<{ files: VirtualFile[]; summary: OptimizationSummary }> {
  const enableImages = options.optimizeImages !== false;
  const enableAudio = options.optimizeAudio !== false;
  const enableVideo = options.optimizeVideo !== false;
  const enableFonts = options.optimizeFonts !== false;
  const enableSvg = options.optimizeSvg !== false;
  const enableCode = options.minifyCode !== false;
  const enableTreeShake = enableCode && options.treeShakeModules !== false;
  const enableText = options.minifyTextAssets !== false;
  const enableVectorize = Boolean(options.vectorizeIcons);

  const hasImages = enableImages && files.some((f) => IMAGE_EXTS.has(f.ext));
  const hasMedia =
    (enableAudio && files.some((f) => AUDIO_EXTS.has(f.ext))) ||
    (enableVideo && files.some((f) => VIDEO_EXTS.has(f.ext)));
  const hasFonts = enableFonts && files.some((f) => FONT_EXTS.has(f.ext));
  const hasSvg = (enableSvg && files.some((f) => f.ext === '.svg')) || (enableVectorize && hasImages);
  const hasCode = enableCode && files.some((f) => JS_EXTS.has(f.ext) || f.ext === '.css');

  const [sharp, ffmpegBin, subsetFont, svgo, esbuild] = await Promise.all([
    hasImages ? loadSharp() : Promise.resolve(null),
    hasMedia ? detectFfmpegBinary(options.ffmpegPath) : Promise.resolve(null),
    hasFonts ? loadSubsetFont() : Promise.resolve(null),
    hasSvg ? loadSvgo() : Promise.resolve(null),
    hasCode ? loadEsbuild() : Promise.resolve(null)
  ]);

  const warnings: string[] = [];
  if (hasImages && !sharp) {
    warnings.push('Optional dependency "sharp" is not installed. Skipping local image optimization.');
  }
  if (hasMedia && !ffmpegBin) {
    warnings.push('Local "ffmpeg" binary was not found in PATH. Skipping audio/video transcoding (install ffmpeg or pass --ffmpeg-path).');
  }
  if (hasFonts && !subsetFont) {
    warnings.push('Optional dependency "subset-font" is not installed. Skipping font subsetting.');
  }
  if (hasCode && !esbuild) {
    warnings.push('Optional dependency "esbuild" is not installed. Skipping JS tree-shaking and minification.');
  }

  // Extract character set BEFORE code minification/tree-shaking so no rendered glyphs are missed
  const fontChars = hasFonts && subsetFont ? extractUsedCharacters(files, options) : '';

  const minSavingsBytes = options.minSavingsBytes ?? 64;
  const quality = Math.max(10, Math.min(100, options.quality ?? 75));
  const pngPalette = options.pngPalette ?? true;
  const maxDimension = options.maxDimension;
  const concurrency = options.concurrency ?? 3;

  // Phase 1: ES module tree-shaking & bundling via esbuild (if <script type="module"> is present)
  let workingFiles = files;
  const preItems: OptimizedFileItem[] = [];
  let treeShakenPaths = new Set<string>();

  if (enableTreeShake && esbuild) {
    const tsRes = await treeShakeEsModules(files, esbuild, {
      dropConsole: options.dropConsole,
      minSavingsBytes
    });
    workingFiles = tsRes.files;
    treeShakenPaths = tsRes.handledPaths;
    for (const item of tsRes.items) {
      preItems.push({ ...item, kind: 'code' });
    }
  }

  // Track any raster -> SVG vectorization path renames
  const vectorizedRenames = new Map<string, string>();
  const existingPathSet = new Set(workingFiles.map((f) => f.path));

  // Phase 2: Parallel per-file asset optimization
  const processedResults = await runWithConcurrency(workingFiles, concurrency, async (file) => {
    if (treeShakenPaths.has(file.path)) {
      return { file, item: null as OptimizedFileItem | null };
    }

    const kind = classifyAssetKind(file.ext);
    if (!kind) {
      return { file, item: null as OptimizedFileItem | null };
    }

    if (
      (kind === 'image' && (!enableImages || !sharp)) ||
      (kind === 'audio' && (!enableAudio || !ffmpegBin)) ||
      (kind === 'video' && (!enableVideo || !ffmpegBin)) ||
      (kind === 'font' && (!enableFonts || !subsetFont)) ||
      (kind === 'svg' && !enableSvg) ||
      (kind === 'code' && !enableCode) ||
      (kind === 'text' && !enableText)
    ) {
      return { file, item: null as OptimizedFileItem | null };
    }

    const origBytes = file.content.byteLength;
    try {
      let candidate: Buffer | null = null;
      let targetFile: VirtualFile = file;
      let effectiveKind: OptimizableAssetKind = kind;
      let extraReason: string | undefined;

      if (kind === 'image' && sharp) {
        let pipeline = sharp(file.content);
        if (maxDimension && maxDimension > 0) {
          const meta = await pipeline.metadata();
          if ((meta.width && meta.width > maxDimension) || (meta.height && meta.height > maxDimension)) {
            pipeline = pipeline.resize({
              width: maxDimension,
              height: maxDimension,
              fit: 'inside',
              withoutEnlargement: true
            });
          }
        }
        if (file.ext === '.png') {
          pipeline = pipeline.png({
            palette: pngPalette,
            quality,
            compressionLevel: 9,
            effort: 8
          });
        } else if (file.ext === '.jpg' || file.ext === '.jpeg') {
          pipeline = pipeline.jpeg({ quality, mozjpeg: true });
        } else if (file.ext === '.webp') {
          pipeline = pipeline.webp({ quality, effort: 5 });
        }
        candidate = await pipeline.toBuffer();

        // Optional raster-to-SVG vectorization for small flat UI icons (strict net-benefit guard)
        if (enableVectorize && VECTORIZABLE_EXTS.has(file.ext)) {
          const svgPath = file.path.replace(/\.[^.]+$/, '.svg');
          if (!existingPathSet.has(svgPath)) {
            const vec = await vectorizeImageBufferToSvg(file.content, options);
            const bestRasterBytes = Math.min(origBytes, candidate.byteLength);
            if (vec && vec.svg.byteLength + minSavingsBytes < bestRasterBytes) {
              candidate = vec.svg;
              targetFile = { path: svgPath, ext: '.svg', content: vec.svg };
              effectiveKind = 'svg';
              extraReason = `Vectorized ${vec.width}x${vec.height} (${vec.colorCount} colors) -> ${svgPath}`;
              vectorizedRenames.set(file.path, svgPath);
            }
          }
        }
      } else if ((kind === 'audio' || kind === 'video') && ffmpegBin) {
        candidate = await transcodeMediaBuffer(file.content, file.ext, kind, ffmpegBin, options);
      } else if (kind === 'font' && subsetFont) {
        candidate = await subsetFontBuffer(file.content, file.ext, fontChars, subsetFont);
        extraReason = `Subsetted to ${fontChars.length} unique glyph(s)`;
      } else if (kind === 'svg') {
        const res = await optimizeSvgString(file.content.toString('utf-8'), options);
        candidate = Buffer.from(res.data, 'utf-8');
        if (res.usedSvgo) extraReason = 'SVGO multipass';
      } else if (kind === 'code') {
        if (esbuild) {
          candidate = await minifyCodeBuffer(file.content, file.ext, esbuild, {
            dropConsole: options.dropConsole
          });
        } else if (file.ext === '.css') {
          candidate = fallbackMinifyCss(file.content);
        } else {
          return { file, item: null as OptimizedFileItem | null };
        }
      } else if (kind === 'text') {
        candidate = minifyJsonAsset(file.content);
      }

      if (!candidate) {
        return {
          file,
          item: {
            path: file.path,
            kind,
            originalBytes: origBytes,
            optimizedBytes: origBytes,
            savedBytes: 0,
            applied: false,
            reason: 'Skipped (unparseable or unsupported variant)'
          }
        };
      }

      const saved = origBytes - candidate.byteLength;
      if (saved >= minSavingsBytes) {
        return {
          file: targetFile === file ? { ...file, content: candidate } : targetFile,
          item: {
            path: file.path,
            kind: effectiveKind,
            originalBytes: origBytes,
            optimizedBytes: candidate.byteLength,
            savedBytes: saved,
            applied: true,
            reason: extraReason
          }
        };
      }

      return {
        file,
        item: {
          path: file.path,
          kind,
          originalBytes: origBytes,
          optimizedBytes: origBytes,
          savedBytes: 0,
          applied: false,
          reason: 'Already optimal (re-encoding did not shrink file)'
        }
      };
    } catch (err) {
      return {
        file,
        item: {
          path: file.path,
          kind,
          originalBytes: origBytes,
          optimizedBytes: origBytes,
          savedBytes: 0,
          applied: false,
          reason: err instanceof Error ? err.message : String(err)
        }
      };
    }
  });

  // Phase 3: Rewrite references for any icons vectorized from .png/.webp -> .svg
  let outputFiles = processedResults.map((r) => r.file);
  if (vectorizedRenames.size > 0) {
    outputFiles = outputFiles.map((f) => {
      if (!REF_REWRITE_EXTS.has(f.ext)) return f;
      let text = f.content.toString('utf-8');
      let changed = false;
      for (const [oldPath, newPath] of vectorizedRenames.entries()) {
        if (text.includes(oldPath)) {
          text = text.replaceAll(oldPath, newPath);
          changed = true;
        }
        const oldBase = path.posix.basename(oldPath);
        const newBase = path.posix.basename(newPath);
        if (oldBase !== oldPath && text.includes(oldBase)) {
          text = text.replaceAll(oldBase, newBase);
          changed = true;
        }
      }
      return changed ? { ...f, content: Buffer.from(text, 'utf-8') } : f;
    });
  }

  const items: OptimizedFileItem[] = [...preItems];
  for (const res of processedResults) {
    if (res.item) items.push(res.item);
  }

  const byKind = createEmptyByKind();
  let originalTotal = 0;
  let optimizedTotal = 0;
  let optimizedCount = 0;
  let skippedCount = 0;

  for (const item of items) {
    originalTotal += item.originalBytes;
    optimizedTotal += item.optimizedBytes;
    byKind[item.kind].processed++;
    if (item.applied) {
      optimizedCount++;
      byKind[item.kind].optimized++;
      byKind[item.kind].savedBytes += item.savedBytes;
    } else {
      skippedCount++;
    }
  }

  const savedBytes = Math.max(0, originalTotal - optimizedTotal);
  const savedPercent = originalTotal > 0 ? Number(((savedBytes / originalTotal) * 100).toFixed(1)) : 0;
  const available = Boolean(
    sharp ||
      ffmpegBin ||
      subsetFont ||
      svgo ||
      esbuild ||
      (enableText && byKind.text.processed > 0) ||
      (!hasImages && !hasMedia && !hasFonts && !hasCode)
  );

  return {
    files: outputFiles,
    summary: {
      available,
      warning: warnings[0],
      warnings,
      tools: {
        sharp: Boolean(sharp),
        ffmpeg: Boolean(ffmpegBin),
        subsetFont: Boolean(subsetFont),
        svgo: Boolean(svgo),
        esbuild: Boolean(esbuild)
      },
      processedCount: items.length,
      optimizedCount,
      skippedCount,
      originalBytes: originalTotal,
      optimizedBytes: optimizedTotal,
      savedBytes,
      savedPercent,
      byKind,
      items
    }
  };
}

/**
 * Merges a budget preset with base options. Explicit pass 1 overrides are respected;
 * passes 2..4 strictly tighten quality/dimensions/bitrates below previous tiers so
 * auto-budget escalation can always make progress.
 */
export function buildPresetOptimizeOptions(
  preset: BudgetPreset,
  base: AssetOptimizeOptions,
  passIndex: number
): AssetOptimizeOptions {
  if (passIndex === 0) {
    return {
      ...base,
      quality: base.quality ?? preset.quality,
      maxDimension: base.maxDimension ?? preset.maxDimension,
      audioBitrateKbps: base.audioBitrateKbps ?? preset.audioBitrateKbps,
      audioSampleRate: base.audioSampleRate ?? preset.audioSampleRate,
      audioChannels: base.audioChannels ?? preset.audioChannels,
      videoCrf: base.videoCrf ?? preset.videoCrf,
      videoMaxWidth: base.videoMaxWidth ?? preset.videoMaxWidth,
      videoFps: base.videoFps ?? preset.videoFps,
      videoAudioBitrateKbps: base.videoAudioBitrateKbps ?? preset.videoAudioBitrateKbps,
      svgFloatPrecision: base.svgFloatPrecision ?? preset.svgFloatPrecision,
      dropConsole: base.dropConsole ?? preset.dropConsole
    };
  }

  return {
    ...base,
    quality: Math.min(base.quality ?? preset.quality, preset.quality),
    maxDimension: Math.min(base.maxDimension ?? preset.maxDimension, preset.maxDimension),
    audioBitrateKbps: Math.min(base.audioBitrateKbps ?? preset.audioBitrateKbps, preset.audioBitrateKbps),
    audioSampleRate: Math.min(base.audioSampleRate ?? preset.audioSampleRate, preset.audioSampleRate),
    audioChannels: 1,
    videoCrf: Math.max(base.videoCrf ?? preset.videoCrf, preset.videoCrf),
    videoMaxWidth: Math.min(base.videoMaxWidth ?? preset.videoMaxWidth, preset.videoMaxWidth),
    videoFps: Math.min(base.videoFps ?? preset.videoFps, preset.videoFps),
    videoAudioBitrateKbps: Math.min(
      base.videoAudioBitrateKbps ?? preset.videoAudioBitrateKbps,
      preset.videoAudioBitrateKbps
    ),
    svgFloatPrecision: Math.min(base.svgFloatPrecision ?? preset.svgFloatPrecision, preset.svgFloatPrecision),
    dropConsole: Boolean(base.dropConsole || preset.dropConsole)
  };
}

/**
 * Optimizes images (sharp), audio/video (local ffmpeg), fonts (subset-font HarfBuzz WASM),
 * SVGs (SVGO + optional raster-to-SVG icon vectorization), JS/CSS (esbuild tree-shaking &
 * minification), and JSON assets in memory without mutating source files on disk.
 */
export async function optimizeVirtualFiles(
  files: VirtualFile[],
  options: AssetOptimizeOptions = {}
): Promise<{ files: VirtualFile[]; summary: OptimizationSummary }> {
  const targetBytes = options.targetSizeBytes;
  if (!targetBytes || targetBytes <= 0) {
    return optimizeSinglePass(files, options);
  }

  let bestResult: { files: VirtualFile[]; summary: OptimizationSummary } | null = null;
  let bestTotal = Number.POSITIVE_INFINITY;
  let appliedPreset = BUDGET_PRESETS[0].name;
  let passesRun = 0;

  for (let i = 0; i < BUDGET_PRESETS.length; i++) {
    const preset = BUDGET_PRESETS[i];
    passesRun = i + 1;
    const passOpts = buildPresetOptimizeOptions(preset, options, i);
    const res = await optimizeSinglePass(files, passOpts);
    const curTotal = totalVirtualBytes(res.files);

    if (curTotal < bestTotal) {
      bestTotal = curTotal;
      bestResult = res;
      appliedPreset = preset.name;
    }

    if (curTotal <= targetBytes) {
      break;
    }
  }

  const finalRes = bestResult!;
  const finalBytes = totalVirtualBytes(finalRes.files);
  return {
    files: finalRes.files,
    summary: {
      ...finalRes.summary,
      budget: {
        targetBytes,
        finalBytes,
        met: finalBytes <= targetBytes,
        passesRun,
        appliedPreset
      }
    }
  };
}

async function readAllFiles(rootDir: string, curDir = rootDir): Promise<VirtualFile[]> {
  const dirents = await fs.readdir(curDir, { withFileTypes: true });
  const results: VirtualFile[] = [];
  for (const d of dirents) {
    if (d.name === '.DS_Store' || d.name === 'node_modules' || d.name === '.git') continue;
    const abs = path.join(curDir, d.name);
    if (d.isDirectory()) {
      results.push(...(await readAllFiles(rootDir, abs)));
    } else if (d.isFile()) {
      const rel = path.relative(rootDir, abs).replace(/\\/g, '/');
      const content = await fs.readFile(abs);
      results.push({ path: rel, ext: path.extname(rel).toLowerCase(), content });
    }
  }
  return results;
}

export interface OptimizeDirectoryOptions extends AssetOptimizeOptions {
  inputDir: string;
  /** Output directory (if omitted with dryRun=false, writes to <inputDir>-optimized) */
  outputDir?: string;
  /** Measure potential savings without writing any files */
  dryRun?: boolean;
}

export interface OptimizeDirectoryResult {
  inputDir: string;
  outputDir: string | null;
  dryRun: boolean;
  summary: OptimizationSummary;
}

export async function optimizeDirectory(
  options: OptimizeDirectoryOptions
): Promise<OptimizeDirectoryResult> {
  const absInput = path.resolve(options.inputDir);
  const files = await readAllFiles(absInput);
  const { files: optimizedFiles, summary } = await optimizeVirtualFiles(files, options);

  if (options.dryRun) {
    return {
      inputDir: absInput,
      outputDir: null,
      dryRun: true,
      summary
    };
  }

  const absOutput = path.resolve(options.outputDir || `${absInput}-optimized`);
  for (const file of optimizedFiles) {
    const dest = path.join(absOutput, file.path);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, file.content);
  }

  return {
    inputDir: absInput,
    outputDir: absOutput,
    dryRun: false,
    summary
  };
}
