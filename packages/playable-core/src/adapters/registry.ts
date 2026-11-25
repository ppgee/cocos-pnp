import type { VirtualFile } from '../types.js';
import { cocos2xAdapter } from './cocos-2x.js';
import { cocos3xAdapter } from './cocos-3x.js';
import { genericWebAdapter } from './generic-web.js';
import { godot4Adapter } from './godot-4.js';
import { playcanvasAdapter } from './playcanvas.js';
import type { EngineAdapter } from './types.js';
import { unityWebglAdapter } from './unity-webgl.js';

/**
 * Built-in engine adapters ordered from most specific to fallback (`generic-web`).
 * Additional engines (LayaAir, Egret, Defold, custom engines) can be plugged in
 * via `options.adapters` without modifying the core pipeline.
 */
export const DEFAULT_ENGINE_ADAPTERS: EngineAdapter[] = [
  cocos3xAdapter,
  cocos2xAdapter,
  playcanvasAdapter,
  godot4Adapter,
  unityWebglAdapter,
  genericWebAdapter
];

export function resolveEngineAdapter(
  files: VirtualFile[],
  requestedEngine?: string,
  customAdapters?: EngineAdapter[]
): EngineAdapter {
  const candidates = [...(customAdapters ?? []), ...DEFAULT_ENGINE_ADAPTERS];

  if (requestedEngine && requestedEngine !== 'auto') {
    const normalized = requestedEngine.trim().toLowerCase();
    const hit = candidates.find((a) => a.id.toLowerCase() === normalized);
    if (!hit) {
      const available = Array.from(new Set(candidates.map((a) => a.id))).join(', ');
      throw new Error(`Unknown engine adapter "${requestedEngine}". Available adapters: ${available}`);
    }
    return hit;
  }

  for (const adapter of candidates) {
    if (adapter.detect(files)) {
      return adapter;
    }
  }

  return genericWebAdapter;
}
