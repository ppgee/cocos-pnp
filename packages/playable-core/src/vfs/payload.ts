import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { deflate } from 'pako';
import { encodeBase122, INLINE_BASE122_DECODER } from './base122.js';

export type PayloadEncoding = 'base64' | 'base122' | 'auto';

const require = createRequire(import.meta.url);
const CHUNK_SIZE = 1_500_000;

let cachedPakoInflate: string | null = null;

export function getPakoInflateCode(): string {
  if (cachedPakoInflate === null) {
    const inflatePath = require.resolve('pako/dist/pako_inflate.min.js');
    cachedPakoInflate = readFileSync(inflatePath, 'utf-8');
  }
  return cachedPakoInflate;
}

export interface InjectedScriptBlock {
  id: string;
  code: string;
}

/**
 * Serializes a virtual filesystem map into inline script blocks.
 * Enables pako deflate ONLY when net size (including ~21KB pako_inflate runtime)
 * is smaller than raw JSON. Supports Base64 (default), Base122 (~14% smaller UTF-8
 * payload vs Base64), or 'auto' (picks whichever yields fewer UTF-8 bytes).
 */
export function buildVfsPayloadScripts(
  vfs: Record<string, string>,
  options: { compress?: boolean; encoding?: PayloadEncoding } = {}
): {
  scripts: InjectedScriptBlock[];
  compressed: boolean;
  encoding: 'none' | 'base64' | 'base122';
  rawBytes: number;
  emittedBytes: number;
} {
  const rawJson = JSON.stringify(vfs);
  const rawBytes = Buffer.byteLength(rawJson, 'utf-8');
  const requestedEncoding: PayloadEncoding = options.encoding ?? 'base64';

  if (options.compress !== false && rawBytes > 32 * 1024) {
    const pakoCode = getPakoInflateCode();
    const deflated = deflate(rawJson);

    const b64 = requestedEncoding === 'base122' ? '' : Buffer.from(deflated).toString('base64');
    const b122 = requestedEncoding === 'base64' ? '' : encodeBase122(deflated);

    const b64NetBytes = b64 ? Buffer.byteLength(b64, 'utf-8') + pakoCode.length + 512 : Number.POSITIVE_INFINITY;
    const b122NetBytes = b122
      ? Buffer.byteLength(b122, 'utf-8') + pakoCode.length + INLINE_BASE122_DECODER.length + 512
      : Number.POSITIVE_INFINITY;

    const useBase122 =
      requestedEncoding === 'base122' ||
      (requestedEncoding === 'auto' && b122NetBytes < b64NetBytes);

    const chosenPayload = useBase122 ? b122 : b64;
    const chosenNetBytes = useBase122 ? b122NetBytes : b64NetBytes;

    if (chosenNetBytes < rawBytes) {
      const scripts: InjectedScriptBlock[] = [
        { id: 'playable-pako-inflate', code: pakoCode }
      ];
      const chunkCount = Math.ceil(chosenPayload.length / CHUNK_SIZE);
      const varName = useBase122 ? '__PLAYABLE_VFS_B122__' : '__PLAYABLE_VFS_ZIP__';
      for (let i = 0; i < chunkCount; i++) {
        const slice = chosenPayload.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        scripts.push({
          id: useBase122 ? `playable-vfs-b122-${i}` : `playable-vfs-zip-${i}`,
          code: i === 0 ? `window.${varName}="${slice}";` : `window.${varName}+="${slice}";`
        });
      }
      scripts.push({
        id: 'playable-vfs-unzip',
        code: useBase122
          ? `(function(){${INLINE_BASE122_DECODER};var u=__d122(window.${varName}||'');window.__PLAYABLE_VFS__=JSON.parse(window.pako.inflate(u,{to:'string'}));delete window.${varName};})();`
          : `(function(){var b=atob(window.${varName}||'');var u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);window.__PLAYABLE_VFS__=JSON.parse(window.pako.inflate(u,{to:'string'}));delete window.${varName};})();`
      });

      const emittedBytes = scripts.reduce((sum, s) => sum + Buffer.byteLength(s.code, 'utf-8'), 0);
      return {
        scripts,
        compressed: true,
        encoding: useBase122 ? 'base122' : 'base64',
        rawBytes,
        emittedBytes
      };
    }
  }

  const scripts: InjectedScriptBlock[] = [];
  if (rawBytes <= CHUNK_SIZE) {
    scripts.push({
      id: 'playable-vfs-0',
      code: `window.__PLAYABLE_VFS__=${rawJson};`
    });
  } else {
    let chunk: Record<string, string> = {};
    let chunkSize = 0;
    let chunkIndex = 0;

    const flush = () => {
      const json = JSON.stringify(chunk);
      scripts.push({
        id: `playable-vfs-${chunkIndex}`,
        code:
          chunkIndex === 0
            ? `window.__PLAYABLE_VFS__=${json};`
            : `Object.assign(window.__PLAYABLE_VFS__,${json});`
      });
      chunk = {};
      chunkSize = 0;
      chunkIndex++;
    };

    for (const [k, v] of Object.entries(vfs)) {
      const entryLen = k.length + v.length + 8;
      if (chunkSize > 0 && chunkSize + entryLen > CHUNK_SIZE) {
        flush();
      }
      chunk[k] = v;
      chunkSize += entryLen;
      if (chunkSize >= CHUNK_SIZE) {
        flush();
      }
    }
    if (chunkSize > 0) {
      flush();
    }
  }

  const emittedBytes = scripts.reduce((sum, s) => sum + Buffer.byteLength(s.code, 'utf-8'), 0);
  return { scripts, compressed: false, encoding: 'none', rawBytes, emittedBytes };
}
