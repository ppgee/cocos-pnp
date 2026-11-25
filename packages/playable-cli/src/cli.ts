#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  buildPlayable,
  DEFAULT_CONFIG_TEMPLATE,
  DEFAULT_ENGINE_ADAPTERS,
  loadPlayableConfig,
  optimizeDirectory,
  type OrientationMode
} from '@cocos-pnp/playable-core';
import {
  ALL_CHANNEL_IDS,
  CHANNEL_SPECS,
  resolveChannels,
  validatePlayable,
  VALIDATOR_VERSION
} from '@cocos-pnp/playable-validator';
import {
  formatBuildResult,
  formatChannelSpecs,
  formatOptimizeResult,
  formatValidationReport
} from './formatter.js';
import { startMcpServer } from './mcp-server.js';
import { startPreviewServer } from './preview-server.js';

function printHelp(): void {
  console.log(`
playable v${VALIDATOR_VERSION} - Engine-Agnostic HTML5 Playable Ads Packager, Validator, Previewer & MCP Server

Usage:
  playable build [input] [options]              Package any Web/Game Engine build for ad networks
  playable check <path> [options]               Validate a .html, .zip, or build directory
  playable preview <path> [options]             Launch interactive 8-network local preview workbench
  playable optimize <dir> [options]             Offline PNG/JPEG/WebP compression (zero API keys)
  playable specs [channel] [--json]             Show 2026 ad network specifications (8 channels)
  playable engines [--json]                     List built-in engine adapters
  playable init [dir]                           Generate a playable.config.json starter file
  playable mcp                                  Start stdio MCP server for AI Coding Agents

Build Options:
  -o, --out <dir>            Output directory (default: config.outputDir or ./playable-dist)
  -c, --channel <list>       Target channel(s), comma-separated or "all"
                             Supported: ${ALL_CHANNEL_IDS.join(', ')}
  --config <path>            Explicit playable.config.json or legacy .adapterrc path
  --engine <id>              auto | ${DEFAULT_ENGINE_ADAPTERS.map((a) => a.id).join(' | ')}
  --orientation <mode>       portrait | landscape | auto (default: auto)
  --name <pkgName>           Base name (used for Mintegral matching folder/HTML naming)
  --ios-url <url>            iOS App Store URL for MRAID channels
  --android-url <url>        Google Play URL for MRAID channels
  --optimize                 Enable offline local image compression (sharp) before packaging
  --quality <1-100>          Image compression quality when --optimize is enabled (default: 75)
  --max-size <px>            Max image width/height in px when --optimize is enabled
  --no-sdk                   Disable automatic @cocos-pnp/playable-sdk bridge injection
  --no-compress              Disable pako deflate compression for single-HTML bundles
  --check                    Run compliance validation on every built artifact
  --static-only              When --check is set, skip headless browser runtime checks
  --json                     Output machine-readable JSON

Preview Options:
  -c, --channel <id>         Initial simulated ad network (default: applovin)
  -p, --port <port>          HTTP port (default: 4173)

Optimize Options:
  -o, --out <dir>            Output directory (default: <dir>-optimized)
  --quality <1-100>          Compression quality (default: 75)
  --max-size <px>            Optional max width/height in pixels
  --dry-run                  Measure savings without writing files
  --json                     Output machine-readable JSON

Check Options:
  -c, --channel <list>       Target channel(s), comma-separated or "all"
  --static-only              Run static & size checks only (skip headless browser)
  --json                     Output machine-readable JSON (for CI & AI agents)
  --cta-selector <css>       CSS selector to click when verifying runtime CTA trigger
  --browser-path <path>      Explicit path to Chrome/Chromium executable
  --settle-ms <ms>           Wait duration after load before sampling render (default: 1200)
  --top <n>                  Number of top size contributors to show (default: 10)
  -h, --help                 Show this help message
`);
}

interface ParsedArgs {
  command?: string;
  positionals: string[];
  flags: Record<string, string | boolean>;
}

const VALUE_FLAGS = new Set([
  '-c', '--channel', '--channels',
  '-o', '--out', '--output',
  '-p', '--port',
  '--config', '--orientation', '--engine', '--name',
  '--ios-url', '--android-url',
  '--quality', '--max-size',
  '--cta-selector', '--browser-path',
  '--settle-ms', '--top'
]);

function parseArgv(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '-h' || token === '--help') {
      flags.help = true;
    } else if (token === '-v' || token === '--version') {
      flags.version = true;
    } else if (
      token === '--static-only' ||
      token === '--json' ||
      token === '--check' ||
      token === '--no-sdk' ||
      token === '--no-compress' ||
      token === '--optimize' ||
      token === '--dry-run' ||
      token === '--force'
    ) {
      flags[token.slice(2)] = true;
    } else if (VALUE_FLAGS.has(token)) {
      const next = argv[i + 1];
      if (!next || next.startsWith('-')) {
        throw new Error(`Option "${token}" requires a value.`);
      }
      const key =
        token === '-c' || token === '--channels'
          ? 'channel'
          : token === '-o' || token === '--output'
            ? 'out'
            : token === '-p'
              ? 'port'
              : token.slice(2);
      flags[key] = next;
      i++;
    } else if (token.startsWith('--') && token.includes('=')) {
      const [rawKey, ...rest] = token.slice(2).split('=');
      const key = rawKey === 'channels' ? 'channel' : rawKey === 'output' ? 'out' : rawKey;
      flags[key] = rest.join('=');
    } else if (token.startsWith('-')) {
      throw new Error(`Unknown option "${token}". Run "playable --help" for usage.`);
    } else {
      positionals.push(token);
    }
  }

  const [command, ...restPos] = positionals;
  return { command, positionals: restPos, flags };
}

export async function runCli(argv: string[]): Promise<number> {
  let parsed: ParsedArgs;
  try {
    parsed = parseArgv(argv);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    return 2;
  }

  if (parsed.flags.version) {
    console.log(VALIDATOR_VERSION);
    return 0;
  }

  if (parsed.flags.help || !parsed.command) {
    printHelp();
    return 0;
  }

  if (parsed.command === 'mcp') {
    await startMcpServer();
    return 0;
  }

  if (parsed.command === 'preview') {
    const targetPath = parsed.positionals[0];
    if (!targetPath) {
      console.error('Error: Missing target path. Example: playable preview ./playable-dist/AppLovin.html --channel applovin');
      return 2;
    }
    try {
      const port = typeof parsed.flags.port === 'string' ? Number(parsed.flags.port) : 4173;
      const handle = await startPreviewServer({
        inputPath: targetPath,
        channel: typeof parsed.flags.channel === 'string' ? parsed.flags.channel : 'applovin',
        port: Number.isFinite(port) ? port : 4173
      });
      console.log(`\nPlayable Preview Workbench running at: ${handle.url}`);
      console.log('Press Ctrl+C to stop.\n');

      await new Promise<void>((resolve) => {
        const stop = () => {
          handle.close().finally(() => resolve());
        };
        process.once('SIGINT', stop);
        process.once('SIGTERM', stop);
      });
      return 0;
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      return 2;
    }
  }

  if (parsed.command === 'optimize') {
    const inputDir = parsed.positionals[0];
    if (!inputDir) {
      console.error('Error: Missing input directory. Example: playable optimize ./dist -o ./dist-opt --quality 75');
      return 2;
    }
    try {
      const quality = typeof parsed.flags.quality === 'string' ? Number(parsed.flags.quality) : undefined;
      const maxDimension =
        typeof parsed.flags['max-size'] === 'string' ? Number(parsed.flags['max-size']) : undefined;
      const result = await optimizeDirectory({
        inputDir,
        outputDir: typeof parsed.flags.out === 'string' ? parsed.flags.out : undefined,
        dryRun: Boolean(parsed.flags['dry-run']),
        quality: Number.isFinite(quality) ? quality : undefined,
        maxDimension: Number.isFinite(maxDimension) ? maxDimension : undefined
      });
      if (parsed.flags.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatOptimizeResult(result));
      }
      return 0;
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      return 2;
    }
  }

  if (parsed.command === 'engines') {
    const list = DEFAULT_ENGINE_ADAPTERS.map((a) => ({
      id: a.id,
      displayName: a.displayName,
      preferSlimZip: Boolean(a.preferSlimZip)
    }));
    if (parsed.flags.json) {
      console.log(JSON.stringify(list, null, 2));
    } else {
      console.log('\nBuilt-in Engine Adapters (ordered by detection priority):\n');
      for (const item of list) {
        console.log(
          `  - ${item.id.padEnd(14)} ${item.displayName}  [slim-zip: ${item.preferSlimZip ? 'default' : 'auto'}]`
        );
      }
      console.log('');
    }
    return 0;
  }

  if (parsed.command === 'init') {
    const targetDir = path.resolve(parsed.positionals[0] || process.cwd());
    const targetFile = path.join(targetDir, 'playable.config.json');
    if (existsSync(targetFile) && !parsed.flags.force) {
      console.error(`Error: "${targetFile}" already exists. Pass --force to overwrite.`);
      return 2;
    }
    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(targetFile, `${JSON.stringify(DEFAULT_CONFIG_TEMPLATE, null, 2)}\n`, 'utf-8');
    console.log(`Created ${targetFile}`);
    return 0;
  }

  if (parsed.command === 'specs') {
    try {
      const channelArg =
        parsed.positionals[0] ||
        (typeof parsed.flags.channel === 'string' ? parsed.flags.channel : undefined);
      const resolved = channelArg
        ? resolveChannels([channelArg])
        : ALL_CHANNEL_IDS.map((id) => ({ id, spec: CHANNEL_SPECS[id] }));
      const specs = resolved.map((r) => r.spec);
      if (parsed.flags.json) {
        console.log(JSON.stringify(specs, null, 2));
      } else {
        console.log(formatChannelSpecs(specs));
      }
      return 0;
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      return 2;
    }
  }

  if (parsed.command === 'build') {
    try {
      const loadedCfg = await loadPlayableConfig({
        configPath: typeof parsed.flags.config === 'string' ? parsed.flags.config : undefined
      });
      const cfg = loadedCfg.config;

      const inputPath = parsed.positionals[0] || cfg.inputPath;
      if (!inputPath) {
        console.error(
          'Error: Missing input path. Pass <input> or define "inputPath" in playable.config.json.'
        );
        return 2;
      }

      const outputDir =
        (typeof parsed.flags.out === 'string' ? parsed.flags.out : undefined) ||
        cfg.outputDir ||
        './playable-dist';

      const channels =
        typeof parsed.flags.channel === 'string' ? [parsed.flags.channel] : cfg.channels;

      const orientation = (
        parsed.flags.orientation === 'portrait' ||
        parsed.flags.orientation === 'landscape' ||
        parsed.flags.orientation === 'auto'
          ? parsed.flags.orientation
          : cfg.orientation || 'auto'
      ) as OrientationMode;

      const quality = typeof parsed.flags.quality === 'string' ? Number(parsed.flags.quality) : undefined;
      const maxDimension =
        typeof parsed.flags['max-size'] === 'string' ? Number(parsed.flags['max-size']) : undefined;
      const optimizeFlag = parsed.flags.optimize
        ? {
            quality: Number.isFinite(quality) ? quality : undefined,
            maxDimension: Number.isFinite(maxDimension) ? maxDimension : undefined
          }
        : cfg.optimize;

      const result = await buildPlayable({
        ...cfg,
        inputPath,
        outputDir,
        channels,
        engine: typeof parsed.flags.engine === 'string' ? parsed.flags.engine : cfg.engine,
        orientation,
        packageName:
          typeof parsed.flags.name === 'string' ? parsed.flags.name : cfg.packageName,
        compress: parsed.flags['no-compress'] ? false : cfg.compress,
        optimize: optimizeFlag,
        injectSdkBridge: parsed.flags['no-sdk'] ? false : cfg.injectSdkBridge,
        storeUrls: {
          ...cfg.storeUrls,
          ...(typeof parsed.flags['ios-url'] === 'string' ? { iosUrl: parsed.flags['ios-url'] } : {}),
          ...(typeof parsed.flags['android-url'] === 'string'
            ? { androidUrl: parsed.flags['android-url'] }
            : {})
        },
        validate: parsed.flags.check ? true : Boolean(cfg.validate),
        staticOnly: parsed.flags['static-only'] ? true : Boolean(cfg.staticOnly),
        browserPath:
          typeof parsed.flags['browser-path'] === 'string'
            ? parsed.flags['browser-path']
            : cfg.browserPath
      });

      if (parsed.flags.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(formatBuildResult(result));
      }

      return result.allValid ? 0 : 1;
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      return 2;
    }
  }

  if (parsed.command === 'check') {
    const targetPath = parsed.positionals[0];
    if (!targetPath) {
      console.error('Error: Missing target path. Example: playable check ./dist/AppLovin.html --channel applovin');
      return 2;
    }

    try {
      const channels =
        typeof parsed.flags.channel === 'string' ? [parsed.flags.channel] : undefined;
      const settleMs =
        typeof parsed.flags['settle-ms'] === 'string' ? Number(parsed.flags['settle-ms']) : undefined;
      const topN =
        typeof parsed.flags.top === 'string' ? Number(parsed.flags.top) : undefined;

      const report = await validatePlayable({
        inputPath: targetPath,
        channels,
        staticOnly: Boolean(parsed.flags['static-only']),
        browserPath: typeof parsed.flags['browser-path'] === 'string' ? parsed.flags['browser-path'] : undefined,
        ctaSelector: typeof parsed.flags['cta-selector'] === 'string' ? parsed.flags['cta-selector'] : undefined,
        settleMs: Number.isFinite(settleMs) ? settleMs : undefined,
        topN: Number.isFinite(topN) ? topN : undefined
      });

      if (parsed.flags.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(formatValidationReport(report));
      }

      return report.passed ? 0 : 1;
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      return 2;
    }
  }

  console.error(`Error: Unknown command "${parsed.command}". Run "playable --help" for usage.`);
  return 2;
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith('/cli.js') ||
    process.argv[1].endsWith('\\cli.js') ||
    process.argv[1].endsWith('playable'));
if (isMain) {
  runCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
