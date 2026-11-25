import { analyzeSizeBreakdown, loadArtifact } from './archive.js';
import { createRuntimeRunner } from './runtime-checker.js';
import { ALL_CHANNEL_IDS, CHANNEL_SPECS, resolveChannel, resolveChannels } from './specs/channels.js';
import { runStaticChecks } from './static-checker.js';
import type {
  ChannelValidationReport,
  Diagnostic,
  RuntimeCheckResult,
  ValidateOptions,
  ValidationReport
} from './types.js';

export * from './types.js';
export { ALL_CHANNEL_IDS, CHANNEL_SPECS, resolveChannel, resolveChannels } from './specs/channels.js';
export { analyzeSizeBreakdown, loadArtifact } from './archive.js';
export { runStaticChecks } from './static-checker.js';
export { detectBrowserExecutable } from './runtime-checker.js';

export const VALIDATOR_VERSION = '2.0.0-alpha.0';

export async function validatePlayable(options: ValidateOptions): Promise<ValidationReport> {
  const resolvedChannels = resolveChannels(options.channels);
  const artifact = await loadArtifact(options.inputPath);
  const sizeBreakdown = analyzeSizeBreakdown(artifact, options.topN ?? 10);

  const viewport = options.viewport ?? { width: 390, height: 844 };
  const settleMs = options.settleMs ?? 1200;

  const runner = options.staticOnly
    ? null
    : await createRuntimeRunner(artifact, {
        browserPath: options.browserPath,
        viewport,
        settleMs,
        ctaSelector: options.ctaSelector,
        captureScreenshots: options.captureScreenshots
      });

  const channelReports: ChannelValidationReport[] = [];

  try {
    for (const item of resolvedChannels) {
      const diagnostics: Diagnostic[] = [];

      if (item.deprecatedNotice) {
        diagnostics.push({
          code: 'CHANNEL_ALIAS_DEPRECATED',
          severity: 'warning',
          category: 'sdk',
          message: item.deprecatedNotice
        });
      }

      const staticDiags = runStaticChecks(artifact, item.spec, sizeBreakdown);
      diagnostics.push(...staticDiags);

      let runtime: RuntimeCheckResult = {
        executed: false,
        skippedReason: 'Skipped because staticOnly=true',
        consoleErrors: [],
        pageErrors: [],
        blockedExternalRequests: [],
        audioPlayedBeforeInteraction: [],
        audioPlayedAfterInteraction: [],
        ctaTriggered: [],
        lifecycleEvents: [],
        canvasCount: 0,
        isBlankScreen: false,
        viewport
      };

      if (runner) {
        const runOut = await runner.checkChannel(item.spec);
        runtime = runOut.result;
        diagnostics.push(...runOut.diagnostics);
      }

      const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
      const warningCount = diagnostics.filter((d) => d.severity === 'warning').length;
      const infoCount = diagnostics.filter((d) => d.severity === 'info').length;

      channelReports.push({
        channel: item.id,
        displayName: item.spec.displayName,
        passed: errorCount === 0,
        errorCount,
        warningCount,
        infoCount,
        diagnostics,
        runtime
      });
    }
  } finally {
    if (runner) {
      await runner.close();
    }
  }

  return {
    tool: '@cocos-pnp/playable-validator',
    version: VALIDATOR_VERSION,
    timestamp: new Date().toISOString(),
    inputPath: artifact.inputPath,
    format: artifact.format,
    sizeBreakdown,
    passed: channelReports.every((c) => c.passed),
    channels: channelReports
  };
}
