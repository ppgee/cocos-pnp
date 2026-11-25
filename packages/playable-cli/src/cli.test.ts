import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { detectBrowserExecutable, validatePlayable } from '@cocos-pnp/playable-validator';
import { generateValidationHtmlReport } from './html-report.js';
import { startPreviewServer } from './preview-server.js';

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

describe('@cocos-pnp/playable-cli MCP stdio server', () => {
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

describe('@cocos-pnp/playable-cli local interactive preview workbench', () => {
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

describe('@cocos-pnp/playable-cli self-contained HTML audit report', () => {
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
