import type { VirtualFile } from '../types.js';
import { genericWebAdapter } from './generic-web.js';
import type { AdapterTransformContext, EngineAdapter } from './types.js';

/**
 * PlayCanvas WebGL engine adapter.
 * Detects PlayCanvas exports (`__start__.js` + `config.json` / `playcanvas*.js`) and
 * leverages the shared 7-entry browser VFS shim (XHR, fetch, Image.src, Audio, FontFace, WASM)
 * with slim-ZIP packaging enabled for multi-asset builds.
 */
export const playcanvasAdapter: EngineAdapter = {
  id: 'playcanvas',
  displayName: 'PlayCanvas',
  preferSlimZip: true,

  detect(files: VirtualFile[]): boolean {
    const names = new Set(files.map((f) => f.path.toLowerCase()));
    const hasStart = names.has('__start__.js');
    const hasConfig = names.has('config.json');
    const hasEngine = files.some((f) => /(^|\/)playcanvas(-stable)?(\.min)?\.js$/i.test(f.path));
    return (hasStart && hasConfig) || (hasEngine && hasConfig);
  },

  transformSingleHtml(ctx: AdapterTransformContext): string {
    // Strip PlayCanvas manifest/favicon links that point to non-essential external/missing icons
    ctx.$('link[rel="manifest"], link[rel="icon"]').each((_i, el) => {
      const href = ctx.$(el).attr('href') || '';
      if (!href.startsWith('data:')) {
        ctx.$(el).remove();
      }
    });
    return genericWebAdapter.transformSingleHtml(ctx);
  }
};
