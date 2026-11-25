import type { VirtualFile } from '../types.js';
import { genericWebAdapter } from './generic-web.js';
import type { AdapterTransformContext, EngineAdapter } from './types.js';

/**
 * Godot 4 HTML5 engine adapter.
 * Recognizes Godot Web exports (`*.pck` + `*.wasm`) and bundles `.pck` / `.wasm`
 * seamlessly into the 7-entry browser VFS shim (fetch + XHR + WebAssembly.instantiateStreaming)
 * with slim-ZIP packaging enabled for multi-file ad networks.
 */
export const godot4Adapter: EngineAdapter = {
  id: 'godot-4',
  displayName: 'Godot 4 (HTML5 / WebAssembly)',
  preferSlimZip: true,

  detect(files: VirtualFile[]): boolean {
    const hasPck = files.some((f) => f.ext === '.pck');
    const hasWasm = files.some((f) => f.ext === '.wasm');
    return hasPck && hasWasm;
  },

  transformSingleHtml(ctx: AdapterTransformContext): string {
    // Strip external icon / PWA manifest references common in Godot HTML5 export templates
    ctx.$('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]').each((_i, el) => {
      const href = ctx.$(el).attr('href') || '';
      if (!href.startsWith('data:')) {
        ctx.$(el).remove();
      }
    });
    return genericWebAdapter.transformSingleHtml(ctx);
  }
};
