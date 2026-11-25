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
  parseByteSize,
  type AssetOptimizeOptions,
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
  playable optimize <dir> [options]             Offline image/audio/video/text compression + auto size budget
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
  --optimize                 Enable offline compression (sharp images + ffmpeg audio/video + JSON/SVG/CSS)
  --target-size <size|auto>  Auto-escalate compression until final packages fit budget (e.g. "5MB", "2MB", "auto")
  --quality <1-100>          Image compression quality (default: 75)
  --max-size <px>            Max image width/height in px
  --audio-bitrate <kbps>     Audio transcoding bitrate in kbps (default: 64)
  --audio-sample-rate <hz>   Audio sample rate in Hz (default: 24000)
  --audio-stereo             Keep stereo audio instead of downmixing to mono
  --video-crf <18-42>        Video CRF quality factor (higher = smaller, default: 28)
  --video-max-width <px>     Max video width in px (default: 720, H.264 faststart moov-first)
  --video-fps <fps>          Target video FPS cap (default: 24)
  --strip-video-audio        Strip audio tracks from videos (great for muted endcards/backgrounds)
  --font-chars <chars>       Extra characters guaranteed to stay when subsetting TTF/OTF/WOFF/WOFF2 fonts
  --vectorize-icons          Vectorize small flat PNG/WebP UI icons to SVGO-optimized SVG when strictly smaller
  --svg-precision <0-5>      SVG path coordinate precision for SVGO (default: 2)
  --drop-console             Strip console.* calls during JS minification/tree-shaking
  --ffmpeg-path <path>       Explicit ffmpeg executable path
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
  --target-size <size>       Auto-escalate presets until directory fits target size (e.g. "4MB", "1.8MB")
  --quality <1-100>          Image compression quality (default: 75)
  --max-size <px>            Optional max image width/height in pixels
  --audio-bitrate <kbps>     Audio bitrate in kbps (default: 64)
  --audio-sample-rate <hz>   Audio sample rate in Hz (default: 24000)
  --audio-stereo             Keep stereo audio instead of mono
  --video-crf <18-42>        Video CRF (default: 28)
  --video-max-width <px>     Max video width in px (default: 720)
  --video-fps <fps>          Video FPS cap (default: 24)
  --strip-video-audio        Remove audio track from video files
  --font-chars <chars>       Extra characters preserved during font subsetting
  --vectorize-icons          Convert small low-color PNG/WebP icons to SVG when strictly smaller
  --svg-precision <0-5>      SVG float precision (default: 2)
  --drop-console             Strip console.* calls during JS minification
  --no-images / --no-audio / --no-video / --no-fonts / --no-svg / --no-code / --no-tree-shake / --no-minify-text
  --ffmpeg-path <path>       Explicit ffmpeg executable path
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
  '--quality', '--max-size', '--target-size',
  '--audio-bitrate', '--audio-sample-rate',
  '--video-crf', '--video-max-width', '--video-fps', '--video-audio-bitrate',
  '--font-chars', '--svg-precision',
  '--ffmpeg-path',
  '--cta-selector', '--browser-path',
  '--settle-ms', '--top'
]);

const BOOLEAN_FLAGS = new Set([
  '--static-only',
  '--json',
  '--check',
  '--no-sdk',
  '--no-compress',
  '--optimize',
  '--dry-run',
  '--force',
  '--audio-stereo',
  '--strip-video-audio',
  '--vectorize-icons',
  '--drop-console',
  '--no-images',
  '--no-audio',
  '--no-video',
  '--no-fonts',
  '--no-svg',
  '--no-code',
  '--no-tree-shake',
  '--no-minify-text'
]);

function parseOptionalNumber(val: string | boolean | undefined): number | undefined {
  if (typeof val !== 'string') return undefined;
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
}

function buildOptimizeOptionsFromFlags(flags: Record<string, string | boolean>): AssetOptimizeOptions {
  const opts: AssetOptimizeOptions = {};
  const quality = parseOptionalNumber(flags.quality);
  if (quality !== undefined) opts.quality = quality;
  const maxDimension = parseOptionalNumber(flags['max-size']);
  if (maxDimension !== undefined) opts.maxDimension = maxDimension;
  const audioBitrateKbps = parseOptionalNumber(flags['audio-bitrate']);
  if (audioBitrateKbps !== undefined) opts.audioBitrateKbps = audioBitrateKbps;
  const audioSampleRate = parseOptionalNumber(flags['audio-sample-rate']);
  if (audioSampleRate !== undefined) opts.audioSampleRate = audioSampleRate;
  if (flags['audio-stereo']) opts.audioChannels = 2;
  const videoCrf = parseOptionalNumber(flags['video-crf']);
  if (videoCrf !== undefined) opts.videoCrf = videoCrf;
  const videoMaxWidth = parseOptionalNumber(flags['video-max-width']);
  if (videoMaxWidth !== undefined) opts.videoMaxWidth = videoMaxWidth;
  const videoFps = parseOptionalNumber(flags['video-fps']);
  if (videoFps !== undefined) opts.videoFps = videoFps;
  const videoAudioBitrateKbps = parseOptionalNumber(flags['video-audio-bitrate']);
  if (videoAudioBitrateKbps !== undefined) opts.videoAudioBitrateKbps = videoAudioBitrateKbps;
  if (flags['strip-video-audio']) opts.stripVideoAudio = true;
  if (typeof flags['font-chars'] === 'string') opts.fontSubsetChars = flags['font-chars'];
  if (flags['vectorize-icons']) opts.vectorizeIcons = true;
  const svgPrecision = parseOptionalNumber(flags['svg-precision']);
  if (svgPrecision !== undefined) opts.svgFloatPrecision = svgPrecision;
  if (flags['drop-console']) opts.dropConsole = true;
  if (flags['no-images']) opts.optimizeImages = false;
  if (flags['no-audio']) opts.optimizeAudio = false;
  if (flags['no-video']) opts.optimizeVideo = false;
  if (flags['no-fonts']) opts.optimizeFonts = false;
  if (flags['no-svg']) opts.optimizeSvg = false;
  if (flags['no-code']) opts.minifyCode = false;
  if (flags['no-tree-shake']) opts.treeShakeModules = false;
  if (flags['no-minify-text']) opts.minifyTextAssets = false;
  if (typeof flags['ffmpeg-path'] === 'string') opts.ffmpegPath = flags['ffmpeg-path'];
  return opts;
}

function parseArgv(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '-h' || token === '--help') {
      flags.help = true;
    } else if (token === '-v' || token === '--version') {
      flags.version = true;
    } else if (BOOLEAN_FLAGS.has(token)) {
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
      console.error('Error: Missing input directory. Example: playable optimize ./dist -o ./dist-opt --target-size 4MB');
      return 2;
    }
    try {
      const optOpts = buildOptimizeOptionsFromFlags(parsed.flags);
      if (typeof parsed.flags['target-size'] === 'string') {
        optOpts.targetSizeBytes = parseByteSize(parsed.flags['target-size']);
      }
      const result = await optimizeDirectory({
        ...optOpts,
        inputDir,
        outputDir: typeof parsed.flags.out === 'string' ? parsed.flags.out : undefined,
        dryRun: Boolean(parsed.flags['dry-run'])
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

      const cliOptOpts = buildOptimizeOptionsFromFlags(parsed.flags);
      const hasCliOptOverrides = Object.keys(cliOptOpts).length > 0;
      const targetSize =
        typeof parsed.flags['target-size'] === 'string'
          ? parsed.flags['target-size']
          : cfg.targetSize;
      const optimizeFlag =
        parsed.flags.optimize || hasCliOptOverrides || targetSize !== undefined
          ? {
              ...(typeof cfg.optimize === 'object' ? cfg.optimize : {}),
              ...cliOptOpts
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
        targetSize,
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
