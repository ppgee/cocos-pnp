import type { VirtualFile } from '../types.js';
import { genericWebAdapter } from './generic-web.js';
import type { AdapterTransformContext, EngineAdapter } from './types.js';

/**
 * Unity WebGL engine adapter (for lightweight uncompressed WebGL exports).
 * Detects Unity WebGL `Build/*.loader.js` builds and bundles `.framework.js`, `.data`,
 * and `.wasm` into the browser VFS shim. Note: Unity's Compression Format must be set
 * to "Disabled" (uncompressed) for offline single-HTML ad WebViews.
 */
export const unityWebglAdapter: EngineAdapter = {
  id: 'unity-webgl',
  displayName: 'Unity WebGL (Uncompressed)',
  preferSlimZip: true,

  detect(files: VirtualFile[]): boolean {
    const hasLoader = files.some((f) => /(^|\/)[^/]+\.loader\.js$/i.test(f.path));
    const hasDataOrWasm = files.some(
      (f) => f.ext === '.data' || f.ext === '.wasm' || /\.framework\.js$/i.test(f.path)
    );
    return hasLoader && hasDataOrWasm;
  },

  transformSingleHtml(ctx: AdapterTransformContext): string {
    // Strip template favicon/manifest links that would 404 inside an offline ad WebView
    ctx.$('link[rel="shortcut icon"], link[rel="icon"], link[rel="manifest"]').each((_i, el) => {
      const href = ctx.$(el).attr('href') || '';
      if (!href.startsWith('data:')) {
        ctx.$(el).remove();
      }
    });
    return genericWebAdapter.transformSingleHtml(ctx);
  }
};
