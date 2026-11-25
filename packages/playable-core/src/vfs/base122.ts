const ILLEGALS = [0, 10, 13, 34, 38, 92] as const;
const ILLEGAL_INDEX = new Map<number, number>(ILLEGALS.map((b, i) => [b, i]));
const SHORTENED_TAG = 7;

/**
 * Encodes arbitrary binary bytes into UTF-8-safe, JS double-quoted-string-safe Base122.
 * Overhead is ~14.3% (8/7) vs Base64's ~33.3% (4/3), saving ~14% on single-HTML binary payloads.
 *
 * All emitted characters are either 1-byte ASCII (excluding \0, \n, \r, ", &, \)
 * or 2-byte UTF-8 code points in U+0080..U+047F (no surrogates, no U+2028/U+2029).
 */
export function encodeBase122(input: Uint8Array): string {
  if (input.length === 0) return '';

  let curByte = 0;
  let curBit = 0;

  const next7Bits = (): number | null => {
    if (curByte >= input.length) return null;
    const firstByte = input[curByte];
    const firstShift = curBit;
    let val: number;

    if (firstShift <= 1) {
      val = (firstByte >> (1 - firstShift)) & 0x7f;
    } else {
      const highBits = (firstByte << (firstShift - 1)) & 0x7f;
      const nextByte = curByte + 1 < input.length ? input[curByte + 1] : 0;
      const lowBits = nextByte >> (9 - firstShift);
      val = highBits | lowBits;
    }

    curBit += 7;
    if (curBit >= 8) {
      curBit -= 8;
      curByte++;
    }
    return val;
  };

  const parts: string[] = [];
  while (true) {
    const bits = next7Bits();
    if (bits === null) break;

    const illegalIdx = ILLEGAL_INDEX.get(bits);
    if (illegalIdx === undefined) {
      parts.push(String.fromCharCode(bits));
    } else {
      const nextBits = next7Bits();
      if (nextBits === null) {
        parts.push(String.fromCharCode(0x80 + (SHORTENED_TAG << 7) + bits));
        break;
      }
      parts.push(String.fromCharCode(0x80 + (illegalIdx << 7) + nextBits));
    }
  }

  return parts.join('');
}

/**
 * Decodes a Base122 string produced by `encodeBase122` back into the exact original bytes.
 */
export function decodeBase122(encoded: string): Uint8Array {
  if (!encoded) return new Uint8Array(0);
  const out: number[] = [];
  let bitBuf = 0;
  let bitLen = 0;

  const push7 = (v: number) => {
    bitBuf = (bitBuf << 7) | v;
    bitLen += 7;
    if (bitLen >= 8) {
      bitLen -= 8;
      out.push((bitBuf >> bitLen) & 0xff);
      bitBuf &= (1 << bitLen) - 1;
    }
  };

  for (let i = 0; i < encoded.length; i++) {
    const c = encoded.charCodeAt(i);
    if (c < 128) {
      push7(c);
    } else {
      const x = c - 128;
      const tag = x >> 7;
      const v = x & 127;
      if (tag === SHORTENED_TAG) {
        push7(v);
      } else {
        push7(ILLEGALS[tag]);
        push7(v);
      }
    }
  }

  return new Uint8Array(out);
}

/**
 * Compact (~270B) inline browser decoder matching `encodeBase122`.
 */
export const INLINE_BASE122_DECODER =
  `function __d122(s){var I=[0,10,13,34,38,92],o=[],b=0,n=0;function p(v){b=(b<<7)|v;n+=7;if(n>=8){n-=8;o.push((b>>n)&255);b&=(1<<n)-1}}for(var i=0;i<s.length;i++){var c=s.charCodeAt(i);if(c<128){p(c)}else{var x=c-128,t=x>>7,v=x&127;if(t===7){p(v)}else{p(I[t]);p(v)}}}return new Uint8Array(o)}`;
