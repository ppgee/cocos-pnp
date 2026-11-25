import path from 'node:path';
import type { BuildPlayableResult, OptimizationSummary } from '@ppgee/playable-core';
import {
  CHANNEL_SPECS,
  type ChannelId,
  type ChannelValidationReport,
  type Diagnostic,
  type SizeBreakdown,
  type ValidationReport
} from '@ppgee/playable-validator';

function esc(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function fmtBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function channelLimitBytes(channel: ChannelId, format: 'single-html' | 'zip' | 'directory'): number {
  const spec = CHANNEL_SPECS[channel];
  if (!spec) return 5 * 1024 * 1024;
  return format === 'single-html'
    ? (spec.maxSingleHtmlBytes ?? spec.maxZipBytes ?? 5 * 1024 * 1024)
    : (spec.maxZipBytes ?? spec.maxSingleHtmlBytes ?? 5 * 1024 * 1024);
}

interface UnifiedRow {
  channel: ChannelId;
  displayName: string;
  format: 'single-html' | 'zip' | 'directory';
  bytes: number;
  limitBytes: number;
  outputPath?: string;
  passed: boolean | null;
  errorCount: number;
  warningCount: number;
  loadTimeMs?: number;
  ctaApis: string[];
  portraitBlank?: boolean;
  landscapeBlank?: boolean;
  portraitShot?: string;
  landscapeShot?: string;
  diagnostics: Diagnostic[];
}

function renderOptimizationSection(opt?: OptimizationSummary): string {
  if (!opt || opt.processedCount === 0) return '';
  const kinds = ['image', 'audio', 'video', 'font', 'svg', 'code', 'text'] as const;
  const kindCards = kinds
    .filter((k) => opt.byKind[k] && opt.byKind[k].processed > 0)
    .map((k) => {
      const st = opt.byKind[k];
      return `<div class="mini-card"><div class="mini-label">${esc(k.toUpperCase())}</div><div class="mini-val">-${esc(fmtBytes(st.savedBytes))}</div><div class="mini-sub">${st.optimized}/${st.processed} optimized</div></div>`;
    })
    .join('');

  const budgetPill = opt.budget
    ? `<span class="pill ${opt.budget.met ? 'pill-pass' : 'pill-warn'}">Budget ${esc(fmtBytes(opt.budget.targetBytes))} → ${esc(fmtBytes(opt.budget.finalBytes))} (${opt.budget.met ? 'MET' : 'OVER'}, pass ${opt.budget.passesRun}: ${esc(opt.budget.appliedPreset)})</span>`
    : '';

  const itemRows = opt.items
    .filter((i) => i.applied)
    .slice(0, 25)
    .map((i) => {
      const pct = i.originalBytes > 0 ? ((i.savedBytes / i.originalBytes) * 100).toFixed(1) : '0.0';
      return `<tr><td><span class="tag tag-kind">${esc(i.kind)}</span></td><td class="mono">${esc(i.path)}</td><td class="num">${esc(fmtBytes(i.originalBytes))}</td><td class="num">${esc(fmtBytes(i.optimizedBytes))}</td><td class="num ok">-${esc(fmtBytes(i.savedBytes))} (-${pct}%)</td><td class="muted">${esc(i.reason || '')}</td></tr>`;
    })
    .join('');

  return `<section class="card">
    <div class="section-head">
      <h2>Asset Optimization Summary</h2>
      <div class="pills">
        <span class="pill pill-pass">Saved ${esc(fmtBytes(opt.savedBytes))} (-${opt.savedPercent}%)</span>
        ${budgetPill}
      </div>
    </div>
    <div class="mini-grid">${kindCards}</div>
    ${
      itemRows
        ? `<details class="details-block"><summary>Optimized Assets (${opt.optimizedCount} reduced)</summary>
            <div class="table-wrap"><table><thead><tr><th>Kind</th><th>Asset Path</th><th class="num">Original</th><th class="num">Optimized</th><th class="num">Savings</th><th>Note</th></tr></thead><tbody>${itemRows}</tbody></table></div>
          </details>`
        : ''
    }
  </section>`;
}

function renderSizeBreakdownSection(breakdown?: SizeBreakdown): string {
  if (!breakdown) return '';
  const total = Math.max(1, breakdown.uncompressedBytes);
  const categories = Object.entries(breakdown.byCategory).sort((a, b) => b[1] - a[1]);
  const colors = ['#38bdf8', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#f97316', '#94a3b8'];

  const barSegments = categories
    .map(([cat, bytes], idx) => {
      const pct = ((bytes / total) * 100).toFixed(2);
      return `<div class="stack-seg" style="width:${pct}%;background:${colors[idx % colors.length]}" title="${esc(cat)}: ${esc(fmtBytes(bytes))} (${pct}%)"></div>`;
    })
    .join('');

  const legend = categories
    .map(([cat, bytes], idx) => {
      const pct = ((bytes / total) * 100).toFixed(1);
      return `<span class="legend-item"><i style="background:${colors[idx % colors.length]}"></i>${esc(cat)} <b>${esc(fmtBytes(bytes))}</b> (${pct}%)</span>`;
    })
    .join('');

  const topRows = breakdown.topContributors
    .slice(0, 12)
    .map((item) => {
      const pct = ((item.bytes / total) * 100).toFixed(1);
      return `<tr><td><span class="tag">${esc(item.kind)}</span></td><td class="mono">${esc(item.label)}</td><td class="num">${esc(fmtBytes(item.bytes))}</td><td class="bar-cell"><div class="bar-bg"><div class="bar-fill" style="width:${Math.min(100, Number(pct))}%"></div></div><span>${pct}%</span></td></tr>`;
    })
    .join('');

  const b64Note =
    breakdown.inlineBase64Bytes > 0
      ? `<span class="pill pill-info">Inline Base64: ${esc(fmtBytes(breakdown.inlineBase64Bytes))} (~${esc(fmtBytes(breakdown.estimatedBase64OverheadBytes))} overhead)</span>`
      : '';

  return `<section class="card">
    <div class="section-head">
      <h2>Size Breakdown &amp; Top Contributors</h2>
      <div class="pills">
        <span class="pill">Package: ${esc(fmtBytes(breakdown.totalBytes))}</span>
        <span class="pill">Files: ${breakdown.fileCount}</span>
        ${b64Note}
      </div>
    </div>
    <div class="stack-bar">${barSegments}</div>
    <div class="legend">${legend}</div>
    <div class="table-wrap"><table><thead><tr><th>Kind</th><th>Resource</th><th class="num">Size</th><th>Share</th></tr></thead><tbody>${topRows}</tbody></table></div>
  </section>`;
}

function renderScreenshotsSection(rows: UnifiedRow[]): string {
  const withShots = rows.filter((r) => r.portraitShot || r.landscapeShot);
  if (withShots.length === 0) return '';

  const cards = withShots
    .map((r) => {
      const pImg = r.portraitShot
        ? `<figure><img src="${r.portraitShot}" alt="${esc(r.channel)} portrait" /><figcaption>Portrait (${r.portraitBlank ? 'BLANK' : 'OK'})</figcaption></figure>`
        : '';
      const lImg = r.landscapeShot
        ? `<figure><img src="${r.landscapeShot}" alt="${esc(r.channel)} landscape" /><figcaption>Landscape (${r.landscapeBlank ? 'BLANK' : 'OK'})</figcaption></figure>`
        : '';
      return `<div class="shot-card"><div class="shot-title">${esc(r.displayName)} <span class="mono muted">(${esc(r.channel)})</span></div><div class="shot-pair">${pImg}${lImg}</div></div>`;
    })
    .join('');

  return `<section class="card">
    <div class="section-head"><h2>Runtime Render Screenshots (Headless Chrome)</h2></div>
    <div class="shot-grid">${cards}</div>
  </section>`;
}

function renderDiagnosticsSection(rows: UnifiedRow[]): string {
  const blocks = rows
    .filter((r) => r.diagnostics.length > 0)
    .map((r) => {
      const items = r.diagnostics
        .map((d) => {
          const cls = d.severity === 'error' ? 'sev-err' : d.severity === 'warning' ? 'sev-warn' : 'sev-info';
          return `<div class="diag-item ${cls}"><div class="diag-head"><span class="sev-badge">${esc(d.severity.toUpperCase())}</span><span class="mono diag-code">${esc(d.code)}</span><span class="muted">${esc(d.category)}</span></div><div class="diag-msg">${esc(d.message)}</div>${d.suggestion ? `<div class="diag-fix">Fix: ${esc(d.suggestion)}</div>` : ''}</div>`;
        })
        .join('');
      const openAttr = r.errorCount > 0 || r.warningCount > 0 ? ' open' : '';
      return `<details class="details-block"${openAttr}><summary>${esc(r.displayName)} (${esc(r.channel)}) — ${r.errorCount} error(s), ${r.warningCount} warning(s)</summary><div class="diag-list">${items}</div></details>`;
    })
    .join('');

  if (!blocks) return '';
  return `<section class="card"><div class="section-head"><h2>Compliance Diagnostics</h2></div>${blocks}</section>`;
}

function renderDocument(params: {
  title: string;
  subtitle: string;
  overallPassed: boolean;
  engine?: string;
  timestamp: string;
  rows: UnifiedRow[];
  optimization?: OptimizationSummary;
  sizeBreakdown?: SizeBreakdown;
}): string {
  const passCount = params.rows.filter((r) => r.passed === true).length;
  const totalCount = params.rows.length;
  const maxBytes = Math.max(...params.rows.map((r) => r.bytes), 0);
  const totalErrors = params.rows.reduce((s, r) => s + r.errorCount, 0);
  const totalWarnings = params.rows.reduce((s, r) => s + r.warningCount, 0);

  const matrixRows = params.rows
    .map((r) => {
      const pct = Math.min(100, (r.bytes / Math.max(1, r.limitBytes)) * 100);
      const fillClass = r.bytes > r.limitBytes ? 'fill-err' : pct >= 85 ? 'fill-warn' : 'fill-ok';
      const statusBadge =
        r.passed === null
          ? '<span class="pill">BUILT</span>'
          : r.passed
            ? '<span class="pill pill-pass">PASS</span>'
            : '<span class="pill pill-err">FAIL</span>';
      const ctaText = r.ctaApis.length > 0 ? `<span class="mono ok">${esc(r.ctaApis.join(', '))}</span>` : '<span class="muted">—</span>';
      const runtimeText =
        r.loadTimeMs !== undefined
          ? `${r.loadTimeMs}ms${r.landscapeBlank !== undefined ? (r.landscapeBlank ? ' · LS:BLANK' : ' · LS:OK') : ''}`
          : '<span class="muted">static</span>';
      return `<tr>
        <td><b>${esc(r.displayName)}</b> <span class="mono muted">${esc(r.channel)}</span></td>
        <td><span class="tag">${esc(r.format)}</span></td>
        <td>
          <div class="quota">
            <div class="quota-top"><span>${esc(fmtBytes(r.bytes))}</span><span class="muted">/ ${esc(fmtBytes(r.limitBytes))}</span></div>
            <div class="bar-bg"><div class="bar-fill ${fillClass}" style="width:${pct.toFixed(1)}%"></div></div>
          </div>
        </td>
        <td>${statusBadge}</td>
        <td class="num">${r.errorCount > 0 ? `<span class="err">${r.errorCount}</span>` : '0'} / ${r.warningCount > 0 ? `<span class="warn">${r.warningCount}</span>` : '0'}</td>
        <td>${ctaText}</td>
        <td class="mono">${runtimeText}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${esc(params.title)}</title>
<style>
  :root { --bg:#0b1120; --card:#111827; --border:#1f2937; --text:#e5e7eb; --muted:#9ca3af; --ok:#22c55e; --warn:#f59e0b; --err:#ef4444; --accent:#38bdf8; }
  * { box-sizing:border-box; }
  body { margin:0; padding:28px; background:var(--bg); color:var(--text); font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  .wrap { max-width:1200px; margin:0 auto; display:flex; flex-direction:column; gap:18px; }
  header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; border-bottom:1px solid var(--border); padding-bottom:16px; }
  h1 { margin:0; font-size:22px; letter-spacing:-0.01em; }
  h2 { margin:0; font-size:16px; }
  .subtitle { color:var(--muted); font-size:13px; margin-top:4px; }
  .kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:12px; }
  .kpi { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:14px 16px; }
  .kpi-label { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.04em; }
  .kpi-val { font-size:22px; font-weight:700; margin-top:4px; }
  .card { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:18px; display:flex; flex-direction:column; gap:14px; }
  .section-head { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; }
  .pills { display:flex; gap:8px; flex-wrap:wrap; }
  .pill { display:inline-block; padding:3px 10px; border-radius:999px; font-size:12px; font-weight:600; background:#1f2937; color:var(--text); }
  .pill-pass { background:rgba(34,197,94,.16); color:#4ade80; border:1px solid rgba(34,197,94,.35); }
  .pill-err { background:rgba(239,68,68,.16); color:#f87171; border:1px solid rgba(239,68,68,.35); }
  .pill-warn { background:rgba(245,158,11,.16); color:#fbbf24; border:1px solid rgba(245,158,11,.35); }
  .pill-info { background:rgba(56,189,248,.16); color:#7dd3fc; border:1px solid rgba(56,189,248,.35); }
  .table-wrap { overflow-x:auto; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th, td { text-align:left; padding:9px 10px; border-bottom:1px solid var(--border); vertical-align:middle; }
  th { color:var(--muted); font-weight:600; font-size:12px; text-transform:uppercase; letter-spacing:.03em; }
  .num { text-align:right; font-variant-numeric:tabular-nums; }
  .mono { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px; }
  .muted { color:var(--muted); }
  .ok { color:#4ade80; } .warn { color:#fbbf24; } .err { color:#f87171; }
  .tag { display:inline-block; padding:2px 7px; border-radius:4px; background:#1e293b; color:#cbd5e1; font-size:11px; font-family:ui-monospace,monospace; }
  .tag-kind { background:rgba(56,189,248,.14); color:#7dd3fc; }
  .quota { min-width:155px; }
  .quota-top { display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px; }
  .bar-bg { height:7px; background:#1f2937; border-radius:999px; overflow:hidden; flex:1; }
  .bar-fill { height:100%; background:var(--accent); border-radius:999px; }
  .fill-ok { background:var(--ok); } .fill-warn { background:var(--warn); } .fill-err { background:var(--err); }
  .bar-cell { display:flex; align-items:center; gap:8px; min-width:140px; }
  .stack-bar { display:flex; height:14px; border-radius:999px; overflow:hidden; background:#1f2937; }
  .stack-seg { height:100%; }
  .legend { display:flex; flex-wrap:wrap; gap:12px; font-size:12px; color:#cbd5e1; }
  .legend-item i { display:inline-block; width:9px; height:9px; border-radius:2px; margin-right:5px; vertical-align:middle; }
  .mini-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:10px; }
  .mini-card { background:#0f172a; border:1px solid var(--border); border-radius:8px; padding:10px 12px; }
  .mini-label { font-size:11px; color:var(--muted); font-weight:600; }
  .mini-val { font-size:16px; font-weight:700; color:#4ade80; margin-top:2px; }
  .mini-sub { font-size:11px; color:var(--muted); }
  .shot-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:14px; }
  .shot-card { background:#0f172a; border:1px solid var(--border); border-radius:8px; padding:12px; }
  .shot-title { font-weight:600; margin-bottom:10px; }
  .shot-pair { display:flex; gap:10px; align-items:flex-start; flex-wrap:wrap; }
  figure { margin:0; text-align:center; }
  figure img { max-height:240px; max-width:260px; border-radius:6px; border:1px solid var(--border); display:block; }
  figcaption { font-size:11px; color:var(--muted); margin-top:4px; }
  .details-block { border:1px solid var(--border); border-radius:8px; padding:10px 12px; background:#0f172a; }
  .details-block summary { cursor:pointer; font-weight:600; }
  .diag-list { display:flex; flex-direction:column; gap:8px; margin-top:10px; }
  .diag-item { padding:10px 12px; border-radius:6px; border-left:3px solid var(--border); background:#111827; }
  .sev-err { border-left-color:var(--err); } .sev-warn { border-left-color:var(--warn); } .sev-info { border-left-color:var(--accent); }
  .diag-head { display:flex; gap:8px; align-items:center; font-size:12px; }
  .sev-badge { font-weight:700; }
  .sev-err .sev-badge { color:#f87171; } .sev-warn .sev-badge { color:#fbbf24; } .sev-info .sev-badge { color:#7dd3fc; }
  .diag-code { font-weight:700; }
  .diag-msg { margin-top:4px; }
  .diag-fix { margin-top:4px; font-size:12px; color:#93c5fd; }
  footer { color:var(--muted); font-size:12px; text-align:center; padding-top:6px; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div>
      <h1>${esc(params.title)}</h1>
      <div class="subtitle">${esc(params.subtitle)}${params.engine ? ` · Engine: <b>${esc(params.engine)}</b>` : ''} · Generated ${esc(params.timestamp)}</div>
    </div>
    <div>
      <span class="pill ${params.overallPassed ? 'pill-pass' : 'pill-err'}" style="font-size:14px;padding:6px 14px;">${params.overallPassed ? 'ALL CHECKS PASSED' : 'ISSUES DETECTED'}</span>
    </div>
  </header>

  <section class="kpi-grid">
    <div class="kpi"><div class="kpi-label">Channels Passed</div><div class="kpi-val ${passCount === totalCount ? 'ok' : 'err'}">${passCount} / ${totalCount}</div></div>
    <div class="kpi"><div class="kpi-label">Largest Artifact</div><div class="kpi-val">${esc(fmtBytes(maxBytes))}</div></div>
    <div class="kpi"><div class="kpi-label">Errors / Warnings</div><div class="kpi-val">${totalErrors > 0 ? `<span class="err">${totalErrors}</span>` : '<span class="ok">0</span>'} / ${totalWarnings}</div></div>
    <div class="kpi"><div class="kpi-label">Asset Savings</div><div class="kpi-val ${params.optimization && params.optimization.savedBytes > 0 ? 'ok' : ''}">${params.optimization && params.optimization.savedBytes > 0 ? `-${esc(fmtBytes(params.optimization.savedBytes))} (-${params.optimization.savedPercent}%)` : '—'}</div></div>
  </section>

  <section class="card">
    <div class="section-head"><h2>Ad Network Compliance Matrix</h2></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Network</th><th>Format</th><th>Package Size vs Limit</th><th>Status</th><th class="num">Err / Warn</th><th>Verified CTA</th><th>Runtime</th></tr></thead>
        <tbody>${matrixRows}</tbody>
      </table>
    </div>
  </section>

  ${renderOptimizationSection(params.optimization)}
  ${renderSizeBreakdownSection(params.sizeBreakdown)}
  ${renderScreenshotsSection(params.rows)}
  ${renderDiagnosticsSection(params.rows)}

  <footer>Generated by @ppgee/playable-cli · Self-contained offline audit report (zero external requests)</footer>
</div>
</body>
</html>`;
}

function rowFromChannelReport(
  ch: ChannelValidationReport,
  format: 'single-html' | 'zip' | 'directory',
  bytes: number,
  outputPath?: string
): UnifiedRow {
  return {
    channel: ch.channel,
    displayName: ch.displayName,
    format,
    bytes,
    limitBytes: channelLimitBytes(ch.channel, format),
    outputPath,
    passed: ch.passed,
    errorCount: ch.errorCount,
    warningCount: ch.warningCount,
    loadTimeMs: ch.runtime.executed ? ch.runtime.loadTimeMs : undefined,
    ctaApis: ch.runtime.ctaTriggered.map((c) => c.api),
    portraitBlank: ch.runtime.executed ? ch.runtime.isBlankScreen : undefined,
    landscapeBlank: ch.runtime.landscapeCheck?.executed ? ch.runtime.landscapeCheck.isBlankScreen : undefined,
    portraitShot: ch.runtime.screenshotDataUri,
    landscapeShot: ch.runtime.landscapeCheck?.screenshotDataUri,
    diagnostics: ch.diagnostics
  };
}

export function generateBuildHtmlReport(result: BuildPlayableResult): string {
  const rows: UnifiedRow[] = result.artifacts.map((art) => {
    const ch = art.validation?.channels[0];
    if (ch) {
      return rowFromChannelReport(ch, art.format, art.bytes, art.outputPath);
    }
    return {
      channel: art.channel,
      displayName: art.displayName,
      format: art.format,
      bytes: art.bytes,
      limitBytes: channelLimitBytes(art.channel, art.format),
      outputPath: art.outputPath,
      passed: null,
      errorCount: 0,
      warningCount: 0,
      ctaApis: [],
      diagnostics: []
    };
  });

  // Pick the largest validated artifact's breakdown for the size treemap section
  const richestBreakdown = result.artifacts
    .map((a) => a.validation?.sizeBreakdown)
    .filter((b): b is SizeBreakdown => Boolean(b))
    .sort((a, b) => b.totalBytes - a.totalBytes)[0];

  return renderDocument({
    title: `Playable Build & Compliance Report — ${path.basename(result.inputPath)}`,
    subtitle: `Source: ${result.inputPath} → Output: ${result.outputDir}`,
    overallPassed: result.allValid,
    engine: result.engine,
    timestamp: new Date().toISOString(),
    rows,
    optimization: result.optimization,
    sizeBreakdown: richestBreakdown
  });
}

export function generateValidationHtmlReport(report: ValidationReport): string {
  const rows: UnifiedRow[] = report.channels.map((ch) =>
    rowFromChannelReport(ch, report.format, report.sizeBreakdown.totalBytes)
  );

  return renderDocument({
    title: `Playable Compliance Report — ${path.basename(report.inputPath)}`,
    subtitle: `Target: ${report.inputPath} (${report.format})`,
    overallPassed: report.passed,
    timestamp: report.timestamp,
    rows,
    sizeBreakdown: report.sizeBreakdown
  });
}
