import readline from 'node:readline';
import { buildPlayable, optimizeDirectory } from '@cocos-pnp/playable-core';
import {
  ALL_CHANNEL_IDS,
  analyzeSizeBreakdown,
  CHANNEL_SPECS,
  loadArtifact,
  resolveChannels,
  validatePlayable,
  VALIDATOR_VERSION
} from '@cocos-pnp/playable-validator';

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
          description: 'Enable offline local image optimization (PNG quantization + MozJPEG via sharp) before packaging.'
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
      'Compress PNG/JPEG/WebP images in a playable directory offline (zero external API keys) using PNG palette quantization and MozJPEG.',
    inputSchema: {
      type: 'object',
      required: ['inputDir'],
      properties: {
        inputDir: { type: 'string', description: 'Source directory containing playable assets.' },
        outputDir: { type: 'string', description: 'Optional output directory (ignored when dryRun=true).' },
        quality: { type: 'number', description: 'Compression quality 1-100 (default: 75).' },
        maxDimension: { type: 'number', description: 'Optional maximum width/height in pixels.' },
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
        validate: Boolean(args.validate),
        optimize: Boolean(args.optimize),
        staticOnly: Boolean(args.staticOnly)
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
      };
    }

    if (name === 'optimize_playable_assets') {
      const inputDir = String(args.inputDir || '');
      if (!inputDir) {
        throw new Error('inputDir is required.');
      }
      const result = await optimizeDirectory({
        inputDir,
        outputDir: typeof args.outputDir === 'string' ? args.outputDir : undefined,
        quality: typeof args.quality === 'number' ? args.quality : undefined,
        maxDimension: typeof args.maxDimension === 'number' ? args.maxDimension : undefined,
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
      const report = await validatePlayable({
        inputPath,
        channels: Array.isArray(args.channels) ? args.channels.map(String) : undefined,
        staticOnly: Boolean(args.staticOnly),
        ctaSelector: typeof args.ctaSelector === 'string' ? args.ctaSelector : undefined,
        settleMs: typeof args.settleMs === 'number' ? args.settleMs : undefined
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(report, null, 2) }]
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
