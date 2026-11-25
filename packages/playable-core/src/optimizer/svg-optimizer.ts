export interface SvgOptimizeOptions {
  /** Coordinate precision for SVG path rounding (default: 2) */
  svgFloatPrecision?: number;
}

export interface VectorizeIconOptions extends SvgOptimizeOptions {
  /** Maximum width/height in pixels for raster-to-SVG candidate icons (default: 128) */
  vectorizeMaxDimension?: number;
  /** Maximum distinct quantized colors for raster-to-SVG vectorization (default: 8) */
  vectorizeMaxColors?: number;
}

interface SvgoModule {
  optimize: (
    input: string,
    config?: Record<string, unknown>
  ) => { data: string };
}

let svgoCache: Promise<SvgoModule | null> | null = null;

export function loadSvgo(): Promise<SvgoModule | null> {
  if (!svgoCache) {
    const pkgName = 'svgo';
    svgoCache = import(pkgName)
      .then((mod: unknown) => {
        const m = mod as Partial<SvgoModule> & { default?: Partial<SvgoModule> };
        const fn = typeof m.optimize === 'function' ? m.optimize : m.default?.optimize;
        return typeof fn === 'function' ? { optimize: fn } : null;
      })
      .catch(() => null);
  }
  return svgoCache;
}

function fallbackMinifySvg(raw: string): string {
  return raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Optimizes an SVG string via SVGO (removing editor metadata, collapsing groups,
 * merging paths, and rounding path precision). Preserves viewBox/dimensions for safe
 * canvas & CSS layout sizing.
 */
export async function optimizeSvgString(
  raw: string,
  options: SvgOptimizeOptions = {}
): Promise<{ data: string; usedSvgo: boolean }> {
  const svgo = await loadSvgo();
  if (!svgo) {
    return { data: fallbackMinifySvg(raw), usedSvgo: false };
  }

  const floatPrecision = Math.max(0, Math.min(5, Math.round(options.svgFloatPrecision ?? 2)));
  const res = svgo.optimize(raw, {
    multipass: true,
    floatPrecision,
    plugins: [
      {
        name: 'preset-default',
        params: {
          overrides: {
            cleanupNumericValues: { floatPrecision },
            convertPathData: { floatPrecision }
          }
        }
      },
      'sortAttrs'
    ]
  });

  return { data: res.data, usedSvgo: true };
}

function toHexByte(n: number): string {
  return n.toString(16).padStart(2, '0');
}

function rgbaToColorKey(r: number, g: number, b: number, a: number): string {
  // Collapse near-transparent pixels to skip
  if (a < 16) return '';
  const hex = `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
  if (a >= 248) return hex;
  const op = (a / 255).toFixed(2).replace(/\.?0+$/, '');
  return `${hex}|${op}`;
}

interface RectRun {
  x: number;
  y: number;
  w: number;
  h: number;
}

type SharpRawFn = (input: Buffer) => {
  metadata: () => Promise<{ width?: number; height?: number }>;
  ensureAlpha: () => ReturnType<SharpRawFn>;
  png: (opts: { palette?: boolean; colours?: number; dither?: number; effort?: number }) => ReturnType<SharpRawFn>;
  raw: () => {
    toBuffer: (opts: { resolveWithObject: true }) => Promise<{
      data: Buffer;
      info: { width: number; height: number; channels: number };
    }>;
  };
  toBuffer: () => Promise<Buffer>;
};

/**
 * Vectorizes a flat/low-color raster image buffer (PNG/WebP/etc.) into a crisp,
 * SVGO-compressed SVG using palette quantization + merged rectilinear path runs.
 *
 * Returns `null` if `sharp` is unavailable, if the image exceeds `vectorizeMaxDimension`,
 * or if the quantized image has too many distinct colors (e.g. photorealistic textures).
 */
export async function vectorizeImageBufferToSvg(
  input: Buffer,
  options: VectorizeIconOptions = {}
): Promise<{ svg: Buffer; width: number; height: number; colorCount: number } | null> {
  let sharp: SharpRawFn;
  try {
    const pkgName = 'sharp';
    const mod = (await import(pkgName)) as { default?: SharpRawFn } | SharpRawFn;
    const fn = typeof mod === 'function' ? mod : mod?.default;
    if (typeof fn !== 'function') return null;
    sharp = fn;
  } catch {
    return null;
  }

  const maxDim = Math.max(8, Math.min(512, Math.round(options.vectorizeMaxDimension ?? 128)));
  const maxColors = Math.max(2, Math.min(32, Math.round(options.vectorizeMaxColors ?? 8)));

  const meta = await sharp(input).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width <= 0 || height <= 0 || width > maxDim || height > maxDim) {
    return null;
  }

  // Quantize to <= maxColors via sharp's libimagequant palette before reading raw RGBA pixels
  const quantizedPng = await sharp(input)
    .ensureAlpha()
    .png({ palette: true, colours: maxColors, dither: 0, effort: 6 })
    .toBuffer();

  const { data, info } = await sharp(quantizedPng)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;

  // Group horizontal runs per color, then merge identical-span vertical runs into rectangles
  const rectsByColor = new Map<string, RectRun[]>();
  const activeByColor = new Map<string, Map<string, RectRun>>();

  for (let y = 0; y < h; y++) {
    const rowSeen = new Map<string, Set<string>>();
    let x = 0;
    while (x < w) {
      const idx = (y * w + x) * 4;
      const key = rgbaToColorKey(data[idx], data[idx + 1], data[idx + 2], data[idx + 3]);
      if (!key) {
        x++;
        continue;
      }

      const startX = x;
      x++;
      while (x < w) {
        const nIdx = (y * w + x) * 4;
        const nKey = rgbaToColorKey(data[nIdx], data[nIdx + 1], data[nIdx + 2], data[nIdx + 3]);
        if (nKey !== key) break;
        x++;
      }

      const runW = x - startX;
      const spanKey = `${startX}:${runW}`;

      let active = activeByColor.get(key);
      if (!active) {
        active = new Map();
        activeByColor.set(key, active);
        rectsByColor.set(key, []);
      }

      if (rectsByColor.size > maxColors + 2) {
        // Too many color/alpha combinations -> likely a gradient or photo, skip vectorization
        return null;
      }

      let seen = rowSeen.get(key);
      if (!seen) {
        seen = new Set();
        rowSeen.set(key, seen);
      }
      seen.add(spanKey);

      const prev = active.get(spanKey);
      if (prev && prev.y + prev.h === y) {
        prev.h++;
      } else {
        const rect: RectRun = { x: startX, y, w: runW, h: 1 };
        active.set(spanKey, rect);
        rectsByColor.get(key)!.push(rect);
      }
    }

    // Flush spans that ended on previous row
    for (const [colorKey, active] of activeByColor.entries()) {
      const seen = rowSeen.get(colorKey);
      for (const spanKey of active.keys()) {
        if (!seen || !seen.has(spanKey)) {
          active.delete(spanKey);
        }
      }
    }
  }

  if (rectsByColor.size === 0) {
    return null;
  }

  const pathEls: string[] = [];
  for (const [colorKey, rects] of rectsByColor.entries()) {
    const [fill, opacity] = colorKey.split('|');
    const dParts: string[] = [];
    for (const r of rects) {
      dParts.push(`M${r.x} ${r.y}h${r.w}v${r.h}h-${r.w}Z`);
    }
    const opAttr = opacity ? ` fill-opacity="${opacity}"` : '';
    pathEls.push(`<path fill="${fill}"${opAttr} d="${dParts.join('')}"/>`);
  }

  const rawSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${pathEls.join('')}</svg>`;
  const { data: optimizedSvg } = await optimizeSvgString(rawSvg, options);

  return {
    svg: Buffer.from(optimizedSvg, 'utf-8'),
    width: w,
    height: h,
    colorCount: rectsByColor.size
  };
}
