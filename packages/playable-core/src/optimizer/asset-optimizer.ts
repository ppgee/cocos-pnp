import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { VirtualFile } from '../types.js';

export interface AssetOptimizeOptions {
  /** Image compression quality 1-100 (default: 75) */
  quality?: number;
  /** Optional maximum width/height in pixels; preserves aspect ratio and never enlarges */
  maxDimension?: number;
  /** Enable 8-bit palette quantization for PNG (TinyPNG-equivalent offline compression, default: true) */
  pngPalette?: boolean;
  /** Minimum bytes saved to keep the optimized version (default: 64) */
  minSavingsBytes?: number;
}

export interface OptimizedFileItem {
  path: string;
  originalBytes: number;
  optimizedBytes: number;
  savedBytes: number;
  applied: boolean;
  reason?: string;
}

export interface OptimizationSummary {
  available: boolean;
  warning?: string;
  processedCount: number;
  optimizedCount: number;
  skippedCount: number;
  originalBytes: number;
  optimizedBytes: number;
  savedBytes: number;
  savedPercent: number;
  items: OptimizedFileItem[];
}

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

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
 * Optimizes PNG/JPEG/WebP files in memory (never mutates source files on disk).
 * Preserves original file formats so Google Ads extension whitelists remain 100% compliant.
 */
export async function optimizeVirtualFiles(
  files: VirtualFile[],
  options: AssetOptimizeOptions = {}
): Promise<{ files: VirtualFile[]; summary: OptimizationSummary }> {
  const sharp = await loadSharp();
  if (!sharp) {
    return {
      files,
      summary: {
        available: false,
        warning: 'Optional dependency "sharp" is not installed. Skipping local image optimization.',
        processedCount: 0,
        optimizedCount: 0,
        skippedCount: 0,
        originalBytes: 0,
        optimizedBytes: 0,
        savedBytes: 0,
        savedPercent: 0,
        items: []
      }
    };
  }

  const quality = Math.max(10, Math.min(100, options.quality ?? 75));
  const pngPalette = options.pngPalette ?? true;
  const maxDimension = options.maxDimension;
  const minSavingsBytes = options.minSavingsBytes ?? 64;

  const outputFiles: VirtualFile[] = [];
  const items: OptimizedFileItem[] = [];
  let originalTotal = 0;
  let optimizedTotal = 0;
  let optimizedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    if (!IMAGE_EXTS.has(file.ext)) {
      outputFiles.push(file);
      continue;
    }

    const origBytes = file.content.byteLength;
    originalTotal += origBytes;

    try {
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

      const candidate = await pipeline.toBuffer();
      const saved = origBytes - candidate.byteLength;

      if (saved >= minSavingsBytes) {
        optimizedTotal += candidate.byteLength;
        optimizedCount++;
        outputFiles.push({ ...file, content: candidate });
        items.push({
          path: file.path,
          originalBytes: origBytes,
          optimizedBytes: candidate.byteLength,
          savedBytes: saved,
          applied: true
        });
      } else {
        optimizedTotal += origBytes;
        skippedCount++;
        outputFiles.push(file);
        items.push({
          path: file.path,
          originalBytes: origBytes,
          optimizedBytes: origBytes,
          savedBytes: 0,
          applied: false,
          reason: 'Already optimal (re-encoding did not shrink file)'
        });
      }
    } catch (err) {
      optimizedTotal += origBytes;
      skippedCount++;
      outputFiles.push(file);
      items.push({
        path: file.path,
        originalBytes: origBytes,
        optimizedBytes: origBytes,
        savedBytes: 0,
        applied: false,
        reason: err instanceof Error ? err.message : String(err)
      });
    }
  }

  const savedBytes = Math.max(0, originalTotal - optimizedTotal);
  const savedPercent = originalTotal > 0 ? Number(((savedBytes / originalTotal) * 100).toFixed(1)) : 0;

  return {
    files: outputFiles,
    summary: {
      available: true,
      processedCount: items.length,
      optimizedCount,
      skippedCount,
      originalBytes: originalTotal,
      optimizedBytes: optimizedTotal,
      savedBytes,
      savedPercent,
      items
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
  /** Output directory (defaults to overwriting in place ONLY when dryRun=false and outputDir is set; if omitted with dryRun=false, writes to <inputDir>-optimized) */
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
