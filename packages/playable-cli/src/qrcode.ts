/**
 * Zero-dependency ISO/IEC 18004 QR Code generator (Byte mode, EC Level L, Versions 1–6).
 * Supports URLs up to 134 UTF-8 bytes — ideal for LAN real-device preview QR codes.
 */

interface QrVersionSpec {
  version: number;
  size: number;
  totalDataCodewords: number;
  ecPerBlock: number;
  blocks: number;
  alignCenters: number[];
}

// ISO/IEC 18004 Table 9 — EC Level L for Versions 1 to 6
const VERSION_SPECS: QrVersionSpec[] = [
  { version: 1, size: 21, totalDataCodewords: 19, ecPerBlock: 7, blocks: 1, alignCenters: [] },
  { version: 2, size: 25, totalDataCodewords: 34, ecPerBlock: 10, blocks: 1, alignCenters: [6, 18] },
  { version: 3, size: 29, totalDataCodewords: 55, ecPerBlock: 15, blocks: 1, alignCenters: [6, 22] },
  { version: 4, size: 33, totalDataCodewords: 80, ecPerBlock: 20, blocks: 1, alignCenters: [6, 26] },
  { version: 5, size: 37, totalDataCodewords: 108, ecPerBlock: 26, blocks: 1, alignCenters: [6, 30] },
  { version: 6, size: 41, totalDataCodewords: 136, ecPerBlock: 18, blocks: 2, alignCenters: [6, 34] }
];

// GF(256) with primitive polynomial 0x11d (x^8 + x^4 + x^3 + x^2 + 1)
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly: Uint8Array = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

function rsComputeEc(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = rsGeneratorPoly(ecCount);
  const rem = new Uint8Array(ecCount);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    rem.copyWithin(0, 1);
    rem[ecCount - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecCount; j++) {
        rem[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return rem;
}

function buildCodewords(bytes: Uint8Array, spec: QrVersionSpec): Uint8Array {
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  };

  // Byte mode indicator (0100) + 8-bit char count (versions 1..9)
  pushBits(0b0100, 4);
  pushBits(bytes.length, 8);
  for (const b of bytes) {
    pushBits(b, 8);
  }

  const maxDataBits = spec.totalDataCodewords * 8;
  const terminatorLen = Math.min(4, maxDataBits - bits.length);
  pushBits(0, terminatorLen);
  while (bits.length % 8 !== 0) bits.push(0);

  const dataBytes = new Uint8Array(spec.totalDataCodewords);
  for (let i = 0; i < bits.length / 8; i++) {
    let val = 0;
    for (let b = 0; b < 8; b++) {
      val = (val << 1) | bits[i * 8 + b];
    }
    dataBytes[i] = val;
  }

  const padSeq = [0xec, 0x11];
  let padIdx = 0;
  for (let i = bits.length / 8; i < spec.totalDataCodewords; i++) {
    dataBytes[i] = padSeq[padIdx++ % 2];
  }

  // Split into RS blocks (all equal size for Versions 1..6 EC-L)
  const blockDataLen = spec.totalDataCodewords / spec.blocks;
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  for (let b = 0; b < spec.blocks; b++) {
    const slice = dataBytes.subarray(b * blockDataLen, (b + 1) * blockDataLen);
    dataBlocks.push(slice);
    ecBlocks.push(rsComputeEc(slice, spec.ecPerBlock));
  }

  const out = new Uint8Array(spec.totalDataCodewords + spec.blocks * spec.ecPerBlock);
  let pos = 0;
  for (let i = 0; i < blockDataLen; i++) {
    for (let b = 0; b < spec.blocks; b++) {
      out[pos++] = dataBlocks[b][i];
    }
  }
  for (let i = 0; i < spec.ecPerBlock; i++) {
    for (let b = 0; b < spec.blocks; b++) {
      out[pos++] = ecBlocks[b][i];
    }
  }
  return out;
}

function computeFormatBits(mask: number): number {
  // EC Level L = 0b01
  const data = (0b01 << 3) | (mask & 7);
  let rem = data << 10;
  for (let i = 14; i >= 10; i--) {
    if ((rem >> i) & 1) rem ^= 0x537 << (i - 10);
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function maskCondition(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0: return (r + c) % 2 === 0;
    case 1: return r % 2 === 0;
    case 2: return c % 3 === 0;
    case 3: return (r + c) % 3 === 0;
    case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    case 7: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    default: return false;
  }
}

function scorePenalty(modules: boolean[][]): number {
  const n = modules.length;
  let penalty = 0;

  // Rule 1: adjacent runs >= 5
  for (let r = 0; r < n; r++) {
    let runColor = modules[r][0];
    let runLen = 1;
    for (let c = 1; c < n; c++) {
      if (modules[r][c] === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runColor = modules[r][c];
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }
  for (let c = 0; c < n; c++) {
    let runColor = modules[0][c];
    let runLen = 1;
    for (let r = 1; r < n; r++) {
      if (modules[r][c] === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runColor = modules[r][c];
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }

  // Rule 2: 2x2 blocks
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = modules[r][c];
      if (v === modules[r][c + 1] && v === modules[r + 1][c] && v === modules[r + 1][c + 1]) {
        penalty += 3;
      }
    }
  }

  // Rule 4: dark ratio balance
  let dark = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (modules[r][c]) dark++;
    }
  }
  const pct = (dark * 100) / (n * n);
  penalty += Math.floor(Math.abs(pct - 50) / 5) * 10;

  return penalty;
}

export function encodeQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  // Byte mode overhead is 4 + 8 = 12 bits -> max bytes = totalDataCodewords - 2
  const spec = VERSION_SPECS.find((s) => bytes.length <= s.totalDataCodewords - 2);
  if (!spec) {
    throw new Error(`QR payload too long (${bytes.length} bytes, max 134 bytes).`);
  }

  const n = spec.size;
  const codewords = buildCodewords(bytes, spec);

  const isFunc = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  const base = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));

  const setFunc = (r: number, c: number, dark: boolean) => {
    if (r < 0 || r >= n || c < 0 || c >= n) return;
    isFunc[r][c] = true;
    base[r][c] = dark;
  };

  // Finder patterns + separators
  const drawFinder = (top: number, left: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = top + dr;
        const c = left + dc;
        if (r < 0 || r >= n || c < 0 || c >= n) continue;
        const dist = Math.max(Math.abs(dr - 3), Math.abs(dc - 3));
        const dark = dist !== 2 && dist !== 4;
        setFunc(r, c, dark);
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, n - 7);
  drawFinder(n - 7, 0);

  // Alignment patterns
  for (const rCenter of spec.alignCenters) {
    for (const cCenter of spec.alignCenters) {
      if (isFunc[rCenter][cCenter]) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dist = Math.max(Math.abs(dr), Math.abs(dc));
          setFunc(rCenter + dr, cCenter + dc, dist !== 1);
        }
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < n - 8; i++) {
    setFunc(6, i, i % 2 === 0);
    setFunc(i, 6, i % 2 === 0);
  }

  // Reserve format info & dark module
  for (let i = 0; i <= 8; i++) {
    if (!isFunc[8][i]) setFunc(8, i, false);
    if (!isFunc[i][8]) setFunc(i, 8, false);
  }
  for (let i = n - 8; i < n; i++) {
    if (!isFunc[8][i]) setFunc(8, i, false);
    if (!isFunc[i][8]) setFunc(i, 8, false);
  }
  setFunc(n - 8, 8, true); // Dark module

  // Place data bits in zig-zag columns from right to left
  let bitIdx = 0;
  const totalBits = codewords.length * 8;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((n - 1 - right) >> 1) % 2 === 0;
    for (let step = 0; step < n; step++) {
      const r = upward ? n - 1 - step : step;
      for (let colOff = 0; colOff < 2; colOff++) {
        const c = right - colOff;
        if (isFunc[r][c]) continue;
        let dark = false;
        if (bitIdx < totalBits) {
          dark = ((codewords[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1) === 1;
          bitIdx++;
        }
        base[r][c] = dark;
      }
    }
  }

  // Evaluate all 8 masks and pick the lowest penalty
  let bestMask = 0;
  let bestScore = Infinity;
  let bestModules = base;

  for (let mask = 0; mask < 8; mask++) {
    const candidate = base.map((row, r) =>
      row.map((val, c) => (isFunc[r][c] ? val : maskCondition(mask, r, c) ? !val : val))
    );

    // Write format info bits (MSB = bit 14 -> LSB = bit 0)
    const fmt = computeFormatBits(mask);
    const bitAt = (i: number) => ((fmt >> i) & 1) === 1;

    // Top-left horizontal & vertical
    for (let i = 0; i <= 5; i++) candidate[8][i] = bitAt(14 - i);
    candidate[8][7] = bitAt(8);
    candidate[8][8] = bitAt(7);
    candidate[7][8] = bitAt(6);
    for (let i = 0; i <= 5; i++) candidate[5 - i][8] = bitAt(5 - i);

    // Bottom-left vertical & top-right horizontal
    for (let i = 0; i <= 6; i++) candidate[n - 1 - i][8] = bitAt(14 - i);
    for (let i = 0; i <= 7; i++) candidate[8][n - 8 + i] = bitAt(7 - i);

    const score = scorePenalty(candidate);
    if (score < bestScore) {
      bestScore = score;
      bestMask = mask;
      bestModules = candidate;
    }
  }

  void bestMask;
  return bestModules;
}

/**
 * Render a QR code using Unicode half-blocks (compact height, dark modules on light quiet zone).
 */
export function renderQrTerminal(text: string, border = 2): string {
  const m = encodeQrMatrix(text);
  const n = m.length;
  const total = n + border * 2;
  const isDark = (r: number, c: number): boolean => {
    const rr = r - border;
    const cc = c - border;
    if (rr < 0 || rr >= n || cc < 0 || cc >= n) return false;
    return m[rr][cc];
  };

  // Use light foreground blocks on dark terminal: white = light module, space = dark module
  // Wait: invert logic so dark terminals render high-contrast white quiet zone & dark modules!
  const lines: string[] = [];
  for (let r = 0; r < total; r += 2) {
    let line = '';
    for (let c = 0; c < total; c++) {
      const topLight = !isDark(r, c);
      const botLight = r + 1 < total ? !isDark(r + 1, c) : true;
      if (topLight && botLight) line += '█';
      else if (topLight && !botLight) line += '▀';
      else if (!topLight && botLight) line += '▄';
      else line += ' ';
    }
    lines.push(line);
  }
  return lines.join('\n');
}

/**
 * Render a crisp self-contained SVG QR code (scalable for Preview Workbench modal).
 */
export function renderQrSvg(text: string, border = 3): string {
  const m = encodeQrMatrix(text);
  const n = m.length;
  const total = n + border * 2;
  const rects: string[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (m[r][c]) {
        rects.push(`M${c + border},${r + border}h1v1h-1z`);
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#ffffff"/><path d="${rects.join('')}" fill="#0d1117"/></svg>`;
}
