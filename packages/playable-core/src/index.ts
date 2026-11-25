import path from 'node:path';
import {
  resolveChannels,
  validatePlayable,
  type ChannelSpec
} from '@cocos-pnp/playable-validator';
import { buildSingleHtml, emitChannelArtifact } from './channel-emitter.js';
import {
  BUDGET_PRESETS,
  buildPresetOptimizeOptions,
  optimizeVirtualFiles,
  parseByteSize,
  type AssetOptimizeOptions,
  type OptimizationSummary
} from './optimizer/asset-optimizer.js';
import { loadSource } from './source-loader.js';
import type {
  BuildPlayableOptions,
  BuildPlayableResult,
  ChannelBuildArtifact,
  LoadedSource
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
  BUDGET_PRESETS,
  buildPresetOptimizeOptions,
  optimizeDirectory,
  optimizeVirtualFiles,
  parseByteSize,
  type AssetOptimizeOptions,
  type BudgetOptimizationReport,
  type BudgetPreset,
  type KindOptimizationStats,
  type OptimizableAssetKind,
  type OptimizationSummary,
  type OptimizeDirectoryOptions,
  type OptimizeDirectoryResult,
  type OptimizedFileItem
} from './optimizer/asset-optimizer.js';
export {
  AUDIO_EXTS,
  VIDEO_EXTS,
  detectFfmpegBinary,
  transcodeMediaBuffer,
  type MediaTranscodeOptions
} from './optimizer/media-transcoder.js';
export {
  FONT_EXTS,
  extractUsedCharacters,
  loadSubsetFont,
  subsetFontBuffer,
  type FontSubsetOptions
} from './optimizer/font-subsetter.js';
export {
  loadSvgo,
  optimizeSvgString,
  vectorizeImageBufferToSvg,
  type SvgOptimizeOptions,
  type VectorizeIconOptions
} from './optimizer/svg-optimizer.js';
export {
  JS_EXTS,
  loadEsbuild,
  minifyCodeBuffer,
  treeShakeEsModules,
  type CodeOptimizeOptions,
  type TreeShakeReportItem
} from './optimizer/code-optimizer.js';
export {
  DEFAULT_CONFIG_TEMPLATE,
  loadPlayableConfig,
  type LoadedConfigResult,
  type PlayableConfigFile
} from './config-loader.js';

function effectiveChannelLimitBytes(spec: ChannelSpec): number {
  const rawLimit =
    spec.preferredFormat === 'single-html'
      ? (spec.maxSingleHtmlBytes ?? spec.maxZipBytes ?? 5 * 1024 * 1024)
      : (spec.maxZipBytes ?? spec.maxSingleHtmlBytes ?? 5 * 1024 * 1024);
  // Keep a small 2% safety buffer for ad network wrapper overhead
  return Math.floor(rawLimit * 0.98);
}

async function emitAllChannels(
  source: LoadedSource,
  resolvedChannels: ReturnType<typeof resolveChannels>,
  normalizedOptions: BuildPlayableOptions
): Promise<ChannelBuildArtifact[]> {
  let cachedSingleHtml: string | null = null;
  const getCachedSingleHtml = () => {
    if (cachedSingleHtml === null) {
      cachedSingleHtml = buildSingleHtml(source, normalizedOptions);
    }
    return cachedSingleHtml;
  };

  const artifacts: ChannelBuildArtifact[] = [];
  for (const item of resolvedChannels) {
    const artifact = await emitChannelArtifact(source, item.spec, normalizedOptions, {
      getCachedSingleHtml
    });
    artifacts.push(artifact);
  }
  return artifacts;
}

export async function buildPlayable(options: BuildPlayableOptions): Promise<BuildPlayableResult> {
  const rawSource = await loadSource(options.inputPath, {
    engine: options.engine,
    adapters: options.adapters
  });

  const resolvedChannels = resolveChannels(options.channels);
  const outputDir = path.resolve(options.outputDir);
  const normalizedOptions: BuildPlayableOptions = {
    ...options,
    outputDir
  };

  const baseOptOpts: AssetOptimizeOptions =
    typeof options.optimize === 'object' ? { ...options.optimize } : {};

  // Resolve target size budget (explicit --target-size, optimize.targetSizeBytes, or "auto")
  let explicitTargetBytes: number | undefined = baseOptOpts.targetSizeBytes;
  let isAutoBudget = false;
  if (options.targetSize !== undefined) {
    if (typeof options.targetSize === 'string' && options.targetSize.trim().toLowerCase() === 'auto') {
      isAutoBudget = true;
    } else {
      explicitTargetBytes = parseByteSize(options.targetSize);
    }
  }

  const budgetMode = isAutoBudget || Boolean(explicitTargetBytes && explicitTargetBytes > 0);
  let optimization: OptimizationSummary | undefined;
  let artifacts: ChannelBuildArtifact[] = [];

  if (budgetMode) {
    const perChannelLimits = new Map<string, number>();
    for (const item of resolvedChannels) {
      perChannelLimits.set(
        item.id,
        explicitTargetBytes ?? effectiveChannelLimitBytes(item.spec)
      );
    }
    const tightestTargetBytes = Math.min(...Array.from(perChannelLimits.values()));

    let passesRun = 0;
    let appliedPreset: string = BUDGET_PRESETS[0].name;
    let met = false;

    for (let i = 0; i < BUDGET_PRESETS.length; i++) {
      const preset = BUDGET_PRESETS[i];
      passesRun = i + 1;
      appliedPreset = preset.name;

      // Always re-optimize from clean original buffers (zero generational quality loss)
      const passOpts = buildPresetOptimizeOptions(
        preset,
        { ...baseOptOpts, targetSizeBytes: undefined },
        i
      );
      const optRes = await optimizeVirtualFiles(rawSource.files, passOpts);
      const passSource: LoadedSource = { ...rawSource, files: optRes.files };
      const passArtifacts = await emitAllChannels(passSource, resolvedChannels, normalizedOptions);

      artifacts = passArtifacts;
      const maxArtifactBytes = Math.max(...passArtifacts.map((a) => a.bytes), 0);
      met = passArtifacts.every((a) => a.bytes <= (perChannelLimits.get(a.channel) ?? tightestTargetBytes));

      optimization = {
        ...optRes.summary,
        budget: {
          targetBytes: tightestTargetBytes,
          finalBytes: maxArtifactBytes,
          met,
          passesRun,
          appliedPreset
        }
      };

      if (met) {
        break;
      }
    }
  } else {
    let source = rawSource;
    if (options.optimize) {
      const optRes = await optimizeVirtualFiles(rawSource.files, baseOptOpts);
      source = { ...rawSource, files: optRes.files };
      optimization = optRes.summary;
    }
    artifacts = await emitAllChannels(source, resolvedChannels, normalizedOptions);
  }

  let allValid = true;
  if (options.validate) {
    for (const artifact of artifacts) {
      const report = await validatePlayable({
        inputPath: artifact.outputPath,
        channels: [artifact.channel],
        staticOnly: options.staticOnly,
        browserPath: options.browserPath
      });
      artifact.validation = report;
      if (!report.passed) {
        allValid = false;
      }
    }
  }

  return {
    inputPath: rawSource.inputPath,
    outputDir,
    engine: rawSource.engineId,
    optimization,
    artifacts,
    allValid
  };
}
