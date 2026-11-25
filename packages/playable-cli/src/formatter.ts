import type { BuildPlayableResult, OptimizeDirectoryResult } from '@ppgee/playable-core';
import type { ChannelSpec, Diagnostic, ValidationReport } from '@ppgee/playable-validator';

const useColor = !process.env.NO_COLOR && process.stdout.isTTY !== false;

const c = {
  reset: (s: string) => (useColor ? `\x1b[0m${s}\x1b[0m` : s),
  bold: (s: string) => (useColor ? `\x1b[1m${s}\x1b[0m` : s),
  dim: (s: string) => (useColor ? `\x1b[2m${s}\x1b[0m` : s),
  red: (s: string) => (useColor ? `\x1b[31m${s}\x1b[0m` : s),
  green: (s: string) => (useColor ? `\x1b[32m${s}\x1b[0m` : s),
  yellow: (s: string) => (useColor ? `\x1b[33m${s}\x1b[0m` : s),
  cyan: (s: string) => (useColor ? `\x1b[36m${s}\x1b[0m` : s)
};

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

function formatDiagnostic(d: Diagnostic): string {
  const tag =
    d.severity === 'error'
      ? c.red('[ERROR]')
      : d.severity === 'warning'
        ? c.yellow('[WARN] ')
        : c.cyan('[INFO] ');
  const lines = [`  ${tag} ${c.bold(d.code)}: ${d.message}`];
  if (d.suggestion) {
    lines.push(`          ${c.dim('Fix: ' + d.suggestion)}`);
  }
  return lines.join('\n');
}

export function formatValidationReport(report: ValidationReport): string {
  const lines: string[] = [];

  const overallBadge = report.passed ? c.green('PASS') : c.red('FAIL');
  lines.push('');
  lines.push(`${c.bold('Playable Compliance Report')}  [${overallBadge}]`);
  lines.push(c.dim(`Input:  ${report.inputPath} (${report.format})`));
  lines.push(
    c.dim(
      `Size:   ${formatBytes(report.sizeBreakdown.totalBytes)} | Files: ${report.sizeBreakdown.fileCount}` +
        (report.sizeBreakdown.inlineBase64Bytes > 0
          ? ` | Inline Base64: ${formatBytes(report.sizeBreakdown.inlineBase64Bytes)} (~${formatBytes(report.sizeBreakdown.estimatedBase64OverheadBytes)} overhead)`
          : '')
    )
  );

  // Size top contributors
  if (report.sizeBreakdown.topContributors.length > 0) {
    lines.push('');
    lines.push(c.bold('Top Size Contributors:'));
    for (const item of report.sizeBreakdown.topContributors.slice(0, 5)) {
      const pct =
        report.sizeBreakdown.uncompressedBytes > 0
          ? ((item.bytes / report.sizeBreakdown.uncompressedBytes) * 100).toFixed(1)
          : '0.0';
      lines.push(`  - ${formatBytes(item.bytes).padStart(9)} (${pct.padStart(5)}%)  ${item.label}`);
    }
  }

  // Per-channel results
  for (const ch of report.channels) {
    lines.push('');
    const badge = ch.passed ? c.green('PASS') : c.red('FAIL');
    const runtimeNote = ch.runtime.executed
      ? c.dim(
          `runtime ${ch.runtime.loadTimeMs ?? 0}ms, canvas=${ch.runtime.canvasCount}, cta=${ch.runtime.ctaTriggered.length}` +
            (ch.runtime.landscapeCheck?.executed
              ? `, landscape=${ch.runtime.landscapeCheck.isBlankScreen ? 'blank' : 'ok'}`
              : '')
        )
      : c.dim(`runtime skipped`);
    lines.push(
      `${c.bold(ch.displayName)} (${ch.channel})  [${badge}]  ` +
        `${c.dim(`${ch.errorCount} error(s), ${ch.warningCount} warning(s)`)}  ${runtimeNote}`
    );

    if (ch.diagnostics.length === 0) {
      lines.push(`  ${c.green('All checks passed with no issues.')}`);
    } else {
      for (const diag of ch.diagnostics) {
        lines.push(formatDiagnostic(diag));
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}

export function formatChannelSpecs(specs: ChannelSpec[]): string {
  const lines: string[] = ['', c.bold('Playable Ad Network Specifications (2026 Baseline)'), ''];
  for (const spec of specs) {
    lines.push(`${c.bold(spec.displayName)} ${c.cyan(`(${spec.id})`)}`);
    lines.push(`  Formats:    ${spec.acceptedFormats.join(', ')} (preferred: ${spec.preferredFormat})`);
    const limits: string[] = [];
    if (spec.maxSingleHtmlBytes) limits.push(`single-html <= ${formatBytes(spec.maxSingleHtmlBytes)}`);
    if (spec.maxZipBytes) limits.push(`zip <= ${formatBytes(spec.maxZipBytes)}`);
    if (spec.maxEntryHtmlBytes) limits.push(`entry-html <= ${formatBytes(spec.maxEntryHtmlBytes)}`);
    if (spec.maxFileCount) limits.push(`files <= ${spec.maxFileCount}`);
    lines.push(`  Limits:     ${limits.join(' | ')}`);
    lines.push(
      `  MRAID:      ${spec.mraidPolicy}${spec.mraidVersion ? ` (v${spec.mraidVersion})` : ''} | Dual-Orient: ${spec.requireDualOrientation ? 'yes' : 'no'} | CTA: ${spec.ctaSignatures.join(', ')}`
    );
    if (spec.requiredFiles.length > 0) {
      lines.push(`  Req Files:  ${spec.requiredFiles.join(', ')}`);
    }
    if (spec.requiredMetaNames.length > 0) {
      lines.push(`  Req Meta:   ${spec.requiredMetaNames.join(', ')}`);
    }
    for (const note of spec.notes) {
      lines.push(`  ${c.dim('- ' + note)}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

const ALL_OPTIMIZE_KINDS = ['image', 'audio', 'video', 'font', 'svg', 'code', 'text'] as const;

export function formatBuildResult(result: BuildPlayableResult): string {
  const lines: string[] = [];
  lines.push('');
  lines.push(`${c.bold('Playable Multi-Channel Build')}  ${c.dim(`(engine: ${result.engine})`)}`);
  lines.push(c.dim(`Input:  ${result.inputPath}`));
  lines.push(c.dim(`Output: ${result.outputDir}`));
  if (result.optimization && result.optimization.processedCount > 0) {
    const opt = result.optimization;
    const kindParts: string[] = [];
    for (const kind of ALL_OPTIMIZE_KINDS) {
      const st = opt.byKind[kind];
      if (st && st.processed > 0) {
        kindParts.push(`${kind} ${st.optimized}/${st.processed} (-${formatBytes(st.savedBytes)})`);
      }
    }
    lines.push(
      c.green(
        `Assets: Optimized ${opt.optimizedCount}/${opt.processedCount} asset(s), saved ${formatBytes(opt.savedBytes)} (-${opt.savedPercent}%)` +
          (kindParts.length > 0 ? ` [${kindParts.join(' | ')}]` : '')
      )
    );
    if (opt.budget) {
      const b = opt.budget;
      const badge = b.met ? c.green('MET') : c.yellow('OVER');
      lines.push(
        `Budget: target ${formatBytes(b.targetBytes)} -> max artifact ${formatBytes(b.finalBytes)} [${badge}, pass ${b.passesRun} (${b.appliedPreset})]`
      );
    }
    for (const w of opt.warnings) {
      lines.push(c.yellow(`Warn:   ${w}`));
    }
  }
  lines.push('');

  for (const item of result.artifacts) {
    const status = item.validation
      ? item.validation.passed
        ? c.green('[PASS]')
        : c.red('[FAIL]')
      : c.cyan('[BUILT]');
    lines.push(
      `  ${status} ${c.bold(item.channel.padEnd(10))} ${formatBytes(item.bytes).padStart(9)}  ${item.outputPath}`
    );
    if (item.validation && !item.validation.passed) {
      for (const ch of item.validation.channels) {
        for (const d of ch.diagnostics.filter((x) => x.severity === 'error')) {
          lines.push(`           ${c.red('[ERROR]')} ${d.code}: ${d.message}`);
        }
      }
    }
  }

  lines.push('');
  return lines.join('\n');
}

export function formatOptimizeResult(result: OptimizeDirectoryResult): string {
  const { summary } = result;
  const lines: string[] = [];
  lines.push('');
  lines.push(
    `${c.bold('Playable Asset Optimization')}  ${result.dryRun ? c.yellow('[DRY RUN]') : c.green('[DONE]')}`
  );
  lines.push(c.dim(`Input:  ${result.inputDir}`));
  if (result.outputDir) {
    lines.push(c.dim(`Output: ${result.outputDir}`));
  }
  const activeTools = [
    summary.tools.sharp ? 'sharp' : null,
    summary.tools.ffmpeg ? 'ffmpeg' : null,
    summary.tools.subsetFont ? 'subset-font' : null,
    summary.tools.svgo ? 'svgo' : null,
    summary.tools.esbuild ? 'esbuild' : null
  ].filter(Boolean);
  if (activeTools.length > 0) {
    lines.push(c.dim(`Tools:  ${activeTools.join(', ')}`));
  }
  for (const w of summary.warnings) {
    lines.push(c.yellow(`Warn:   ${w}`));
  }
  lines.push(
    `Summary: ${summary.optimizedCount}/${summary.processedCount} asset(s) reduced | ` +
      `${formatBytes(summary.originalBytes)} -> ${formatBytes(summary.optimizedBytes)} ` +
      c.green(`(saved ${formatBytes(summary.savedBytes)}, -${summary.savedPercent}%)`)
  );
  const kindParts: string[] = [];
  for (const kind of ALL_OPTIMIZE_KINDS) {
    const st = summary.byKind[kind];
    if (st && st.processed > 0) {
      kindParts.push(`${kind}: ${st.optimized}/${st.processed} (-${formatBytes(st.savedBytes)})`);
    }
  }
  if (kindParts.length > 0) {
    lines.push(c.dim(`Kinds:  ${kindParts.join(' | ')}`));
  }
  if (summary.budget) {
    const b = summary.budget;
    const badge = b.met ? c.green('MET') : c.yellow('OVER');
    lines.push(
      `Budget: target ${formatBytes(b.targetBytes)} -> final ${formatBytes(b.finalBytes)} [${badge}, pass ${b.passesRun} (${b.appliedPreset})]`
    );
  }
  if (summary.items.length > 0) {
    lines.push('');
    for (const item of summary.items) {
      const badge = item.applied ? c.green('[OPT] ') : c.dim('[SKIP]');
      const kindTag = c.cyan(`[${item.kind.padEnd(5)}]`);
      lines.push(
        `  ${badge} ${kindTag} ${item.path}  ${formatBytes(item.originalBytes)} -> ${formatBytes(item.optimizedBytes)}` +
          (item.applied ? c.green(` (-${formatBytes(item.savedBytes)})`) : c.dim(item.reason ? ` (${item.reason})` : ''))
      );
    }
  }
  lines.push('');
  return lines.join('\n');
}
