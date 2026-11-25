import { promises as fs } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { buildPlayable, optimizeDirectory, parseByteSize, type PayloadEncoding } from '@cocos-pnp/playable-core';
import {
  ALL_CHANNEL_IDS,
  analyzeSizeBreakdown,
  CHANNEL_SPECS,
  loadArtifact,
  resolveChannels,
  validatePlayable,
  VALIDATOR_VERSION
} from '@cocos-pnp/playable-validator';
import { generateBuildHtmlReport, generateValidationHtmlReport } from './html-report.js';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

const MCP_TOOLS = [
  {
    name: 'get_channel_specs',
    description:
      'Return the 2026 technical specifications (format, size limits, MRAID policy, CTA API, lifecycle hooks, file rules) for major Playable Ad networks.',
    inputSchema: {
      type: 'object',
      properties: {
        channels: {
          type: 'array',
          items: { type: 'string' },
          description: `Optional channel filter. Supported: ${ALL_CHANNEL_IDS.join(', ')} (or aliases like facebook, pangle, vungle, ironsource). Omit for all 8 channels.`
        }
      }
    }
  },
  {
    name: 'build_playable',
    description:
      'Package a generic HTML5/Vite build directory, single HTML file, or Cocos Creator 3.x web-mobile build into submission-ready artifacts for one or more Playable Ad networks.',
    inputSchema: {
      type: 'object',
      required: ['inputPath', 'outputDir'],
      properties: {
        inputPath: {
          type: 'string',
          description: 'Absolute or relative path to the Web/Cocos build directory or entry HTML file.'
        },
        outputDir: {
          type: 'string',
          description: 'Directory where channel-specific HTML/ZIP outputs will be written.'
        },
        channels: {
          type: 'array',
          items: { type: 'string' },
          description: `Target channels to export. Defaults to all 8: ${ALL_CHANNEL_IDS.join(', ')}.`
        },
        engine: {
          type: 'string',
          description: 'Optional engine adapter id (auto, generic-web, playcanvas, cocos-3x). Defaults to auto.'
        },
        orientation: {
          type: 'string',
          enum: ['portrait', 'landscape', 'auto'],
          description: 'Orientation metadata for Google Ads and TikTok config.json (default: auto).'
        },
        packageName: {
          type: 'string',
          description: 'Base name used for Mintegral matching folder/HTML naming.'
        },
        iosUrl: {
          type: 'string',
          description: 'Optional iOS App Store URL used by MRAID channels (AppLovin/Unity).'
        },
        androidUrl: {
          type: 'string',
          description: 'Optional Google Play URL used by MRAID channels (AppLovin/Unity).'
        },
        validate: {
          type: 'boolean',
          description: 'Run compliance validation on every generated output artifact immediately after building.'
        },
        optimize: {
          type: 'boolean',
          description: 'Enable offline local optimization (sharp images + ffmpeg audio/video + JSON/SVG/CSS minification) before packaging.'
        },
        targetSize: {
          type: 'string',
          description: 'Optional final package size budget (e.g. "5MB", "2MB", or "auto" for tightest channel limit). Auto-escalates compression presets until emitted artifacts fit under budget.'
        },
        stripVideoAudio: {
          type: 'boolean',
          description: 'Strip audio track from video assets during optimization.'
        },
        vectorizeIcons: {
          type: 'boolean',
          description: 'Vectorize small low-color PNG/WebP UI icons into SVGO-optimized SVG when strictly smaller.'
        },
        fontSubsetChars: {
          type: 'string',
          description: 'Extra characters guaranteed to stay when subsetting TTF/OTF/WOFF/WOFF2 fonts.'
        },
        dropConsole: {
          type: 'boolean',
          description: 'Strip console.* calls during JS minification/tree-shaking.'
        },
        encoding: {
          type: 'string',
          enum: ['base64', 'base122', 'auto'],
          description: 'Payload encoding for pako-compressed VFS (base122 saves ~14% vs base64 losslessly).'
        },
        reportPath: {
          type: 'string',
          description: 'Optional file path to write a self-contained visual HTML audit report (includes runtime screenshots when validate=true).'
        },
        staticOnly: {
          type: 'boolean',
          description: 'When validate=true, skip headless browser runtime checks.'
        }
      }
    }
  },
  {
    name: 'optimize_playable_assets',
    description:
      'Full offline asset optimizer: images (sharp), audio/video (ffmpeg + MP4 faststart), font subsetting (subset-font HarfBuzz WASM), SVG optimization + optional raster-to-SVG icon vectorization (svgo), JS/CSS tree-shaking & minification (esbuild), and JSON minification with optional target size budget auto-escalation.',
    inputSchema: {
      type: 'object',
      required: ['inputDir'],
      properties: {
        inputDir: { type: 'string', description: 'Source directory containing playable assets.' },
        outputDir: { type: 'string', description: 'Optional output directory (ignored when dryRun=true).' },
        targetSize: { type: 'string', description: 'Optional target total directory size budget (e.g. "4MB", "1.8MB").' },
        quality: { type: 'number', description: 'Image compression quality 1-100 (default: 75).' },
        maxDimension: { type: 'number', description: 'Optional maximum image width/height in pixels.' },
        audioBitrateKbps: { type: 'number', description: 'Audio transcoding bitrate in kbps (default: 64).' },
        audioSampleRate: { type: 'number', description: 'Audio sample rate in Hz (default: 24000).' },
        videoCrf: { type: 'number', description: 'Video CRF quality factor 18-42 (higher = smaller, default: 28).' },
        videoMaxWidth: { type: 'number', description: 'Max video width in pixels (default: 720).' },
        videoFps: { type: 'number', description: 'Target video FPS cap (default: 24).' },
        stripVideoAudio: { type: 'boolean', description: 'Strip audio track from video files.' },
        fontSubsetChars: { type: 'string', description: 'Extra characters preserved during font subsetting.' },
        vectorizeIcons: { type: 'boolean', description: 'Vectorize small flat PNG/WebP UI icons to SVG when strictly smaller.' },
        svgFloatPrecision: { type: 'number', description: 'SVGO coordinate float precision 0-5 (default: 2).' },
        dropConsole: { type: 'boolean', description: 'Strip console.* calls during JS minification.' },
        treeShakeModules: { type: 'boolean', description: 'Bundle and tree-shake local ES modules via esbuild (default: true).' },
        dryRun: { type: 'boolean', description: 'Estimate byte savings without writing files.' }
      }
    }
  },
  {
    name: 'check_playable',
    description:
      'Run static compliance checks, size breakdown, and headless Chrome runtime checks (blank screen, dual orientation, external requests, pre-interaction audio, CTA trigger) on a playable .html, .zip, or build directory.',
    inputSchema: {
      type: 'object',
      required: ['inputPath'],
      properties: {
        inputPath: {
          type: 'string',
          description: 'Path to .html file, .zip archive, or build directory.'
        },
        channels: {
          type: 'array',
          items: { type: 'string' },
          description: `Target channel(s) to validate against. Supported: ${ALL_CHANNEL_IDS.join(', ')}.`
        },
        staticOnly: {
          type: 'boolean',
          description: 'Skip headless browser runtime checks and run static/size checks only.'
        },
        ctaSelector: {
          type: 'string',
          description: 'Optional CSS selector to click when verifying CTA callback trigger.'
        },
        settleMs: {
          type: 'number',
          description: 'Milliseconds to wait after page load before sampling render/errors (default: 1200).'
        },
        reportPath: {
          type: 'string',
          description: 'Optional file path to write a self-contained visual HTML compliance report.'
        }
      }
    }
  },
  {
    name: 'inspect_playable_size',
    description:
      'Analyze file/asset size breakdown, top contributors, and inline Base64 encoding overhead for a playable .html, .zip, or directory.',
    inputSchema: {
      type: 'object',
      required: ['inputPath'],
      properties: {
        inputPath: {
          type: 'string',
          description: 'Path to .html file, .zip archive, or build directory.'
        },
        topN: {
          type: 'number',
          description: 'Number of top size contributors to return (default: 15).'
        }
      }
    }
  }
];

function sendMessage(msg: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(msg)}\n`);
}

async function handleToolCall(name: string, args: Record<string, unknown>): Promise<{
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}> {
  try {
    if (name === 'get_channel_specs') {
      const channels = Array.isArray(args.channels) ? args.channels.map(String) : undefined;
      const specs = channels
        ? resolveChannels(channels).map((r) => r.spec)
        : ALL_CHANNEL_IDS.map((id) => CHANNEL_SPECS[id]);
      return {
        content: [{ type: 'text', text: JSON.stringify(specs, null, 2) }]
      };
    }

    if (name === 'build_playable') {
      const inputPath = String(args.inputPath || '');
      const outputDir = String(args.outputDir || '');
      if (!inputPath || !outputDir) {
        throw new Error('inputPath and outputDir are required.');
      }
      const targetSize =
        typeof args.targetSize === 'string' || typeof args.targetSize === 'number'
          ? args.targetSize
          : undefined;
      const optPayload: Record<string, unknown> = {};
      if (args.stripVideoAudio) optPayload.stripVideoAudio = true;
      if (args.vectorizeIcons) optPayload.vectorizeIcons = true;
      if (typeof args.fontSubsetChars === 'string') optPayload.fontSubsetChars = args.fontSubsetChars;
      if (args.dropConsole) optPayload.dropConsole = true;
      const hasOptPayload = Object.keys(optPayload).length > 0;
      const encoding = (
        args.encoding === 'base64' || args.encoding === 'base122' || args.encoding === 'auto'
          ? args.encoding
          : undefined
      ) as PayloadEncoding | undefined;
      const reportPath = typeof args.reportPath === 'string' ? path.resolve(args.reportPath) : undefined;
      const result = await buildPlayable({
        inputPath,
        outputDir,
        channels: Array.isArray(args.channels) ? args.channels.map(String) : undefined,
        engine: typeof args.engine === 'string' ? args.engine : undefined,
        orientation:
          args.orientation === 'portrait' || args.orientation === 'landscape' || args.orientation === 'auto'
            ? args.orientation
            : 'auto',
        packageName: typeof args.packageName === 'string' ? args.packageName : undefined,
        storeUrls: {
          iosUrl: typeof args.iosUrl === 'string' ? args.iosUrl : undefined,
          androidUrl: typeof args.androidUrl === 'string' ? args.androidUrl : undefined
        },
        encoding,
        validate: Boolean(args.validate) || Boolean(reportPath),
        optimize: hasOptPayload
          ? optPayload
          : Boolean(args.optimize) || targetSize !== undefined,
        targetSize,
        staticOnly: Boolean(args.staticOnly),
        captureScreenshots: Boolean(reportPath) && !args.staticOnly
      });
      if (reportPath) {
        await fs.mkdir(path.dirname(reportPath), { recursive: true });
        await fs.writeFile(reportPath, generateBuildHtmlReport(result), 'utf-8');
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(reportPath ? { ...result, reportPath } : result, null, 2) }]
      };
    }

    if (name === 'optimize_playable_assets') {
      const inputDir = String(args.inputDir || '');
      if (!inputDir) {
        throw new Error('inputDir is required.');
      }
      const targetSizeBytes =
        typeof args.targetSize === 'string' || typeof args.targetSize === 'number'
          ? parseByteSize(args.targetSize)
          : undefined;
      const result = await optimizeDirectory({
        inputDir,
        outputDir: typeof args.outputDir === 'string' ? args.outputDir : undefined,
        targetSizeBytes,
        quality: typeof args.quality === 'number' ? args.quality : undefined,
        maxDimension: typeof args.maxDimension === 'number' ? args.maxDimension : undefined,
        audioBitrateKbps: typeof args.audioBitrateKbps === 'number' ? args.audioBitrateKbps : undefined,
        audioSampleRate: typeof args.audioSampleRate === 'number' ? args.audioSampleRate : undefined,
        videoCrf: typeof args.videoCrf === 'number' ? args.videoCrf : undefined,
        videoMaxWidth: typeof args.videoMaxWidth === 'number' ? args.videoMaxWidth : undefined,
        videoFps: typeof args.videoFps === 'number' ? args.videoFps : undefined,
        stripVideoAudio: Boolean(args.stripVideoAudio),
        fontSubsetChars: typeof args.fontSubsetChars === 'string' ? args.fontSubsetChars : undefined,
        vectorizeIcons: Boolean(args.vectorizeIcons),
        svgFloatPrecision: typeof args.svgFloatPrecision === 'number' ? args.svgFloatPrecision : undefined,
        dropConsole: Boolean(args.dropConsole),
        treeShakeModules: typeof args.treeShakeModules === 'boolean' ? args.treeShakeModules : undefined,
        dryRun: Boolean(args.dryRun)
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    }

    if (name === 'check_playable') {
      const inputPath = String(args.inputPath || '');
      if (!inputPath) {
        throw new Error('inputPath is required.');
      }
      const reportPath = typeof args.reportPath === 'string' ? path.resolve(args.reportPath) : undefined;
      const report = await validatePlayable({
        inputPath,
        channels: Array.isArray(args.channels) ? args.channels.map(String) : undefined,
        staticOnly: Boolean(args.staticOnly),
        ctaSelector: typeof args.ctaSelector === 'string' ? args.ctaSelector : undefined,
        settleMs: typeof args.settleMs === 'number' ? args.settleMs : undefined,
        captureScreenshots: Boolean(reportPath) && !args.staticOnly
      });
      if (reportPath) {
        await fs.mkdir(path.dirname(reportPath), { recursive: true });
        await fs.writeFile(reportPath, generateValidationHtmlReport(report), 'utf-8');
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(reportPath ? { ...report, reportPath } : report, null, 2) }]
      };
    }

    if (name === 'inspect_playable_size') {
      const inputPath = String(args.inputPath || '');
      if (!inputPath) {
        throw new Error('inputPath is required.');
      }
      const artifact = await loadArtifact(inputPath);
      const breakdown = analyzeSizeBreakdown(
        artifact,
        typeof args.topN === 'number' ? args.topN : 15
      );
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                inputPath: artifact.inputPath,
                format: artifact.format,
                sizeBreakdown: breakdown
              },
              null,
              2
            )
          }
        ]
      };
    }

    throw new Error(`Unknown MCP tool "${name}".`);
  } catch (err) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) })
        }
      ]
    };
  }
}

export async function startMcpServer(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity
  });

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line) continue;

    let req: JsonRpcRequest;
    try {
      req = JSON.parse(line) as JsonRpcRequest;
    } catch {
      sendMessage({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' }
      });
      continue;
    }

    // Notifications (no id) require no response
    if (req.id === undefined || req.id === null) {
      continue;
    }

    if (req.method === 'initialize') {
      sendMessage({
        jsonrpc: '2.0',
        id: req.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'cocos-pnp-playable',
            version: VALIDATOR_VERSION
          }
        }
      });
    } else if (req.method === 'ping') {
      sendMessage({ jsonrpc: '2.0', id: req.id, result: {} });
    } else if (req.method === 'tools/list') {
      sendMessage({
        jsonrpc: '2.0',
        id: req.id,
        result: { tools: MCP_TOOLS }
      });
    } else if (req.method === 'tools/call') {
      const toolName = String(req.params?.name || '');
      const toolArgs = (req.params?.arguments as Record<string, unknown>) || {};
      const result = await handleToolCall(toolName, toolArgs);
      sendMessage({
        jsonrpc: '2.0',
        id: req.id,
        result
      });
    } else {
      sendMessage({
        jsonrpc: '2.0',
        id: req.id,
        error: { code: -32601, message: `Method not found: ${req.method}` }
      });
    }
  }
}
