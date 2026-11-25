import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { deflate } from 'pako';

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
 * is smaller than raw JSON.
 */
export function buildVfsPayloadScripts(
  vfs: Record<string, string>,
  options: { compress?: boolean } = {}
): { scripts: InjectedScriptBlock[]; compressed: boolean; rawBytes: number; emittedBytes: number } {
  const rawJson = JSON.stringify(vfs);
  const rawBytes = Buffer.byteLength(rawJson, 'utf-8');

  if (options.compress !== false && rawBytes > 32 * 1024) {
    const pakoCode = getPakoInflateCode();
    const deflated = deflate(rawJson);
    const b64 = Buffer.from(deflated).toString('base64');
    const netCompressedBytes = b64.length + pakoCode.length + 512;

    if (netCompressedBytes < rawBytes) {
      const scripts: InjectedScriptBlock[] = [
        { id: 'playable-pako-inflate', code: pakoCode }
      ];
      const chunkCount = Math.ceil(b64.length / CHUNK_SIZE);
      for (let i = 0; i < chunkCount; i++) {
        const slice = b64.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        scripts.push({
          id: `playable-vfs-zip-${i}`,
          code: i === 0 ? `window.__PLAYABLE_VFS_ZIP__="${slice}";` : `window.__PLAYABLE_VFS_ZIP__+="${slice}";`
        });
      }
      scripts.push({
        id: 'playable-vfs-unzip',
        code: `(function(){var b=atob(window.__PLAYABLE_VFS_ZIP__||'');var u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);window.__PLAYABLE_VFS__=JSON.parse(window.pako.inflate(u,{to:'string'}));delete window.__PLAYABLE_VFS_ZIP__;})();`
      });

      const emittedBytes = scripts.reduce((sum, s) => sum + Buffer.byteLength(s.code, 'utf-8'), 0);
      return { scripts, compressed: true, rawBytes, emittedBytes };
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
  return { scripts, compressed: false, rawBytes, emittedBytes };
}
