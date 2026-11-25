import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { detectBrowserExecutable, validatePlayable } from '@ppgee/playable-validator';
import { generateBuildHtmlReport, generateValidationHtmlReport } from './html-report.js';
import { startPreviewServer } from './preview-server.js';
import { encodeQrMatrix, renderQrSvg, renderQrTerminal } from './qrcode.js';
import { scaffoldPlayableProject } from './scaffold.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_ENTRY = path.resolve(__dirname, 'cli.js');
const VALID_FIXTURE = path.resolve(__dirname, '../../playable-validator/fixtures/valid-mraid.html');

function runMcpSession(requests: Array<Record<string, unknown>>): Promise<Array<Record<string, unknown>>> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_ENTRY, 'mcp'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const responses: Array<Record<string, unknown>> = [];
    let buffer = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf-8');
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        responses.push(JSON.parse(trimmed) as Record<string, unknown>);
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf-8');
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`MCP server exited with code ${code}: ${stderr}`));
      } else {
        resolve(responses);
      }
    });

    for (const req of requests) {
      child.stdin.write(`${JSON.stringify(req)}\n`);
    }
    child.stdin.end();
  });
}

describe('@ppgee/playable-cli MCP stdio server', () => {
  it('handles initialize, tools/list, and tools/call (get_channel_specs + check_playable)', async () => {
    const responses = await runMcpSession([
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } }
      },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'get_channel_specs', arguments: { channels: ['moloco', 'liftoff'] } }
      },
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'check_playable',
          arguments: { inputPath: VALID_FIXTURE, channels: ['applovin'], staticOnly: true }
        }
      }
    ]);

    assert.equal(responses.length, 4);

    const initRes = responses[0].result as { serverInfo: { name: string } };
    assert.equal(initRes.serverInfo.name, 'cocos-pnp-playable');

    const listRes = responses[1].result as { tools: Array<{ name: string }> };
    const names = listRes.tools.map((t) => t.name);
    assert.deepEqual(names, [
      'get_channel_specs',
      'build_playable',
      'optimize_playable_assets',
      'check_playable',
      'inspect_playable_size'
    ]);

    const specsRes = responses[2].result as { content: Array<{ text: string }> };
    const specs = JSON.parse(specsRes.content[0].text) as Array<{ id: string }>;
    assert.deepEqual(specs.map((s) => s.id), ['moloco', 'liftoff']);

    const checkRes = responses[3].result as { content: Array<{ text: string }> };
    const report = JSON.parse(checkRes.content[0].text) as { passed: boolean };
    assert.equal(report.passed, true);
  });
});

describe('@ppgee/playable-cli local interactive preview workbench', () => {
  it('serves workbench UI, /api/info static reports, and sandboxed HTML with injected channel mock bridge', async () => {
    const handle = await startPreviewServer({
      inputPath: VALID_FIXTURE,
      channel: 'unity',
      port: 0
    });

    try {
      const uiResp = await fetch(handle.url);
      assert.equal(uiResp.status, 200);
      const uiHtml = await uiResp.text();
      assert.ok(uiHtml.includes('Playable Preview Workbench'));
      assert.ok(uiHtml.includes('Landscape 844x390'));
      assert.ok(uiHtml.includes('Export HTML Report'));
      assert.ok(uiHtml.includes('Package Quota &amp; Breakdown'));
      // Ensure embedded DATA JSON escapes </script> tags so diagnostic suggestions never terminate inline script
      const scriptBlocks = uiHtml.match(/<script>[\s\S]*?<\/script>/g) ?? [];
      assert.equal(scriptBlocks.length, 1);
      assert.ok(scriptBlocks[0].includes('loadChannel(currentChannel);'));

      const reportResp = await fetch(`${handle.url}api/report.html`);
      assert.equal(reportResp.status, 200);
      const reportHtml = await reportResp.text();
      assert.ok(reportHtml.includes('Ad Network Compliance Matrix'));

      const infoResp = await fetch(`${handle.url}api/info`);
      assert.equal(infoResp.status, 200);
      const info = (await infoResp.json()) as {
        initialChannel: string;
        staticReport: { channels: Array<{ channel: string }> };
      };
      assert.equal(info.initialChannel, 'unity');
      assert.equal(info.staticReport.channels.length, 8);

      const sandboxResp = await fetch(`${handle.url}sandbox/valid-mraid.html?__preview_channel=unity`);
      assert.equal(sandboxResp.status, 200);
      const sandboxHtml = await sandboxResp.text();
      assert.ok(sandboxHtml.includes('data-id="playable-preview-host"'));
      assert.ok(sandboxHtml.includes('audioVolumeChange'));
    } finally {
      await handle.close();
    }
  });
});

describe('@ppgee/playable-cli self-contained HTML audit report', () => {
  it('generates offline HTML report with embedded portrait & landscape runtime screenshots', async () => {
    const hasBrowser = Boolean(detectBrowserExecutable());
    const report = await validatePlayable({
      inputPath: VALID_FIXTURE,
      channels: ['applovin'],
      staticOnly: !hasBrowser,
      settleMs: 250,
      captureScreenshots: hasBrowser
    });

    assert.equal(report.passed, true);
    const html = generateValidationHtmlReport(report);
    assert.ok(html.startsWith('<!DOCTYPE html>'));
    assert.ok(html.includes('Ad Network Compliance Matrix'));
    assert.ok(html.includes('Size Breakdown'));
    assert.ok(html.includes('ALL CHECKS PASSED'));

    if (hasBrowser) {
      assert.ok(report.channels[0].runtime.screenshotDataUri?.startsWith('data:image/jpeg;base64,'));
      assert.ok(report.channels[0].runtime.landscapeCheck?.screenshotDataUri?.startsWith('data:image/jpeg;base64,'));
      assert.ok(html.includes('Runtime Render Screenshots'));
      assert.ok(html.includes('data:image/jpeg;base64,'));
    }

    // Verify CLI --report flag writes report file cleanly
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'playable-report-test-'));
    try {
      const reportFile = path.join(tmpDir, 'audit.html');
      const exitCode = await new Promise<number>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          [CLI_ENTRY, 'check', VALID_FIXTURE, '--channel', 'applovin', '--static-only', '--report', reportFile],
          { stdio: 'ignore' }
        );
        child.on('error', reject);
        child.on('close', (code) => resolve(code ?? 1));
      });
      assert.equal(exitCode, 0);
      const written = await fs.readFile(reportFile, 'utf-8');
      assert.ok(written.includes('Playable Compliance Report'));
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('@ppgee/playable-cli LAN QR device preview & scaffold templates', () => {
  it('generates valid ISO 18004 QR matrices, terminal/SVG output, and serves /api/qr.svg with --lan', async () => {
    const url = 'http://192.168.1.42:4173/sandbox/index.html?__preview_channel=applovin';
    const matrix = encodeQrMatrix(url);
    assert.equal(matrix.length, matrix[0].length);
    assert.ok(matrix.length >= 21 && matrix.length <= 41);
    // Verify top-left 7x7 finder pattern border & 3x3 center
    assert.equal(matrix[0][0], true);
    assert.equal(matrix[0][6], true);
    assert.equal(matrix[1][1], false);
    assert.equal(matrix[3][3], true);

    const svg = renderQrSvg(url);
    assert.ok(svg.startsWith('<svg ') && svg.includes('<path '));
    const term = renderQrTerminal(url);
    assert.ok(term.includes('█'));

    const handle = await startPreviewServer({
      inputPath: VALID_FIXTURE,
      channel: 'applovin',
      port: 0,
      lan: true
    });
    try {
      const qrResp = await fetch(`${handle.url}api/qr.svg?url=${encodeURIComponent(url)}`);
      assert.equal(qrResp.status, 200);
      assert.ok((qrResp.headers.get('content-type') || '').includes('image/svg+xml'));
      const qrBody = await qrResp.text();
      assert.ok(qrBody.includes('<svg'));
    } finally {
      await handle.close();
    }
  });

  it('scaffolds canvas, pixijs, and threejs projects and builds+validates the canvas multi-variant template', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'playable-scaffold-test-'));
    try {
      const canvasDir = path.join(tmpDir, 'demo-canvas');
      const pixiDir = path.join(tmpDir, 'demo-pixi');
      const threeDir = path.join(tmpDir, 'demo-three');

      const cRes = await scaffoldPlayableProject({ targetDir: canvasDir, template: 'canvas' });
      const pRes = await scaffoldPlayableProject({ targetDir: pixiDir, template: 'pixijs' });
      const tRes = await scaffoldPlayableProject({ targetDir: threeDir, template: 'threejs' });

      assert.ok(cRes.files.includes('src/index.html'));
      assert.ok(cRes.files.includes('playable.config.json'));
      assert.ok(pRes.files.includes('package.json') && pRes.files.includes('src/main.js'));
      assert.ok(tRes.files.includes('package.json') && tRes.files.includes('src/main.js'));

      // Run CLI build on the scaffolded canvas project with its 2-variant playable.config.json + HTML report
      const reportFile = path.join(canvasDir, 'playable-dist', 'matrix-report.html');
      const hasBrowser = Boolean(detectBrowserExecutable());
      const args = [
        CLI_ENTRY,
        'build',
        '--config',
        path.join(canvasDir, 'playable.config.json'),
        '--channel',
        'applovin,google',
        '--check',
        ...(hasBrowser ? [] : ['--static-only']),
        '--report',
        reportFile,
        '--json'
      ];
      const { code, stdout, stderr } = await new Promise<{ code: number; stdout: string; stderr: string }>(
        (resolve, reject) => {
          const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
          let out = '';
          let err = '';
          child.stdout.on('data', (d: Buffer) => { out += d.toString('utf-8'); });
          child.stderr.on('data', (d: Buffer) => { err += d.toString('utf-8'); });
          child.on('error', reject);
          child.on('close', (c) => resolve({ code: c ?? 1, stdout: out, stderr: err }));
        }
      );

      assert.equal(code, 0, `Scaffold build failed: ${stderr}`);
      const parsed = JSON.parse(stdout) as { allValid: boolean; variants: unknown[]; artifacts: unknown[] };
      assert.equal(parsed.allValid, true);
      assert.equal(parsed.variants.length, 2);
      assert.equal(parsed.artifacts.length, 4);

      const matrixHtml = await fs.readFile(reportFile, 'utf-8');
      assert.ok(matrixHtml.includes('Multi-Variant &amp; Ad Network Compliance Matrix'));
      assert.ok(matrixHtml.includes('en_default'));
      assert.ok(matrixHtml.includes('ja_default'));
      void generateBuildHtmlReport;
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
