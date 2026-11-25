import path from 'node:path';
import { resolveChannels, validatePlayable } from '@cocos-pnp/playable-validator';
import { buildSingleHtml, emitChannelArtifact } from './channel-emitter.js';
import { optimizeVirtualFiles, type OptimizationSummary } from './optimizer/asset-optimizer.js';
import { loadSource } from './source-loader.js';
import type {
  BuildPlayableOptions,
  BuildPlayableResult,
  ChannelBuildArtifact
} from './types.js';

export * from './types.js';
export type { AdapterTransformContext, EngineAdapter } from './adapters/types.js';
export { DEFAULT_ENGINE_ADAPTERS, resolveEngineAdapter } from './adapters/registry.js';
export { genericWebAdapter } from './adapters/generic-web.js';
export { playcanvasAdapter } from './adapters/playcanvas.js';
export { cocos3xAdapter, buildCocos3xLoaderScript } from './adapters/cocos-3x.js';
export { cocos2xAdapter } from './adapters/cocos-2x.js';
export { godot4Adapter } from './adapters/godot-4.js';
export { unityWebglAdapter } from './adapters/unity-webgl.js';
export { buildBrowserVfsShim } from './vfs/browser-shim.js';
export { buildVfsPayloadScripts } from './vfs/payload.js';
export { prepareGoogleZipFiles, splitSingleHtmlToSlimZip } from './vfs/html-utils.js';
export { loadSource } from './source-loader.js';
export { buildSingleHtml, emitChannelArtifact } from './channel-emitter.js';
export {
  optimizeDirectory,
  optimizeVirtualFiles,
  type AssetOptimizeOptions,
  type OptimizationSummary,
  type OptimizeDirectoryOptions,
  type OptimizeDirectoryResult,
  type OptimizedFileItem
} from './optimizer/asset-optimizer.js';
export {
  DEFAULT_CONFIG_TEMPLATE,
  loadPlayableConfig,
  type LoadedConfigResult,
  type PlayableConfigFile
} from './config-loader.js';

export async function buildPlayable(options: BuildPlayableOptions): Promise<BuildPlayableResult> {
  let source = await loadSource(options.inputPath, {
    engine: options.engine,
    adapters: options.adapters
  });

  let optimization: OptimizationSummary | undefined;
  if (options.optimize) {
    const optOpts = typeof options.optimize === 'object' ? options.optimize : {};
    const optRes = await optimizeVirtualFiles(source.files, optOpts);
    source = { ...source, files: optRes.files };
    optimization = optRes.summary;
  }

  const resolvedChannels = resolveChannels(options.channels);
  const outputDir = path.resolve(options.outputDir);
  const normalizedOptions: BuildPlayableOptions = {
    ...options,
    outputDir
  };

  let cachedSingleHtml: string | null = null;
  const getCachedSingleHtml = () => {
    if (cachedSingleHtml === null) {
      cachedSingleHtml = buildSingleHtml(source, normalizedOptions);
    }
    return cachedSingleHtml;
  };

  const artifacts: ChannelBuildArtifact[] = [];
  let allValid = true;

  for (const item of resolvedChannels) {
    const artifact = await emitChannelArtifact(source, item.spec, normalizedOptions, {
      getCachedSingleHtml
    });

    if (options.validate) {
      const report = await validatePlayable({
        inputPath: artifact.outputPath,
        channels: [item.id],
        staticOnly: options.staticOnly,
        browserPath: options.browserPath
      });
      artifact.validation = report;
      if (!report.passed) {
        allValid = false;
      }
    }

    artifacts.push(artifact);
  }

  return {
    inputPath: source.inputPath,
    outputDir,
    engine: source.engineId,
    optimization,
    artifacts,
    allValid
  };
}
