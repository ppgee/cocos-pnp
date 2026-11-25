import { load as loadHtml } from 'cheerio';
import type { VirtualFile } from '../types.js';

export const FONT_EXTS = new Set(['.ttf', '.otf', '.woff', '.woff2']);

export interface FontSubsetOptions {
  /** Extra characters guaranteed to be preserved in the subsetted font */
  fontSubsetChars?: string;
  /** Include printable ASCII characters (0x20-0x7E) in addition to extracted text (default: true) */
  fontIncludeAscii?: boolean;
}

type SubsetFontFn = (
  buffer: Buffer,
  text: string,
  options?: { targetFormat?: 'sfnt' | 'woff' | 'woff2' | 'truetype' }
) => Promise<Buffer>;

let subsetFontCache: Promise<SubsetFontFn | null> | null = null;

export function loadSubsetFont(): Promise<SubsetFontFn | null> {
  if (!subsetFontCache) {
    const pkgName = 'subset-font';
    subsetFontCache = import(pkgName)
      .then((mod: unknown) => {
        const m = mod as { default?: SubsetFontFn } | SubsetFontFn;
        const fn = typeof m === 'function' ? m : m?.default;
        return typeof fn === 'function' ? fn : null;
      })
      .catch(() => null);
  }
  return subsetFontCache;
}

const PRINTABLE_ASCII = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('');
const TEXT_SCAN_EXTS = new Set(['.html', '.htm', '.js', '.mjs', '.cjs', '.css', '.json', '.svg']);

function collectUniqueChars(target: Set<string>, text: string): void {
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined && cp >= 0x20 && cp !== 0x7f) {
      target.add(ch);
    }
  }
}

/**
 * Scans HTML visible text, JS/JSON string literals, CSS content/text, and SVG text
 * across the playable bundle to determine the exact character set needed for font subsetting.
 */
export function extractUsedCharacters(
  files: VirtualFile[],
  options: FontSubsetOptions = {}
): string {
  const chars = new Set<string>();
  const includeAscii = options.fontIncludeAscii !== false;

  if (includeAscii) {
    collectUniqueChars(chars, PRINTABLE_ASCII);
  }

  if (options.fontSubsetChars) {
    collectUniqueChars(chars, options.fontSubsetChars);
  }

  for (const file of files) {
    if (!TEXT_SCAN_EXTS.has(file.ext)) continue;
    const raw = file.content.toString('utf-8');

    if (file.ext === '.html' || file.ext === '.htm') {
      try {
        const $ = loadHtml(raw);
        $('script, style').remove();
        collectUniqueChars(chars, $.text());
      } catch {
        collectUniqueChars(chars, raw);
      }
      // Also capture non-ASCII characters inside inline scripts/attributes
      const nonAscii = raw.match(/[^\x00-\x7F]+/g);
      if (nonAscii) {
        for (const chunk of nonAscii) collectUniqueChars(chars, chunk);
      }
    } else if (file.ext === '.svg') {
      try {
        const $ = loadHtml(raw, { xmlMode: true });
        collectUniqueChars(chars, $('text, tspan').text());
      } catch {
        // Ignore malformed SVG
      }
    } else {
      // For JS/JSON/CSS: extract quoted string literals + any non-ASCII characters
      const stringMatches = raw.match(/(?:'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)/g);
      if (stringMatches) {
        for (const lit of stringMatches) {
          const inner = lit.slice(1, -1);
          // Skip long data URIs / base64 blobs
          if (inner.length > 512 && /^[A-Za-z0-9+/=,:;.-]+$/.test(inner.slice(0, 64))) {
            continue;
          }
          collectUniqueChars(chars, inner);
        }
      }
      const nonAscii = raw.match(/[^\x00-\x7F]+/g);
      if (nonAscii) {
        for (const chunk of nonAscii) collectUniqueChars(chars, chunk);
      }
    }
  }

  // Always preserve at least space so HarfBuzz never receives an empty glyph set
  if (chars.size === 0) {
    chars.add(' ');
  }

  return Array.from(chars).join('');
}

function targetFormatForExt(ext: string): 'sfnt' | 'woff' | 'woff2' {
  if (ext === '.woff2') return 'woff2';
  if (ext === '.woff') return 'woff';
  return 'sfnt';
}

/**
 * Subsets a TTF/OTF/WOFF/WOFF2 font buffer in-memory via HarfBuzz WASM (`subset-font`),
 * preserving its original container format so CSS/VFS references stay 100% intact.
 */
export async function subsetFontBuffer(
  content: Buffer,
  ext: string,
  text: string,
  subsetFont: SubsetFontFn
): Promise<Buffer> {
  const format = targetFormatForExt(ext.toLowerCase());
  const result = await subsetFont(content, text, { targetFormat: format });
  return Buffer.isBuffer(result) ? result : Buffer.from(result);
}
