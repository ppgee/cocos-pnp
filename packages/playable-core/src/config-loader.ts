import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { resolveChannel, type ChannelId } from '@ppgee/playable-validator';
import type {
  BuildPlayableOptions,
  CustomChannelInject,
  OrientationMode,
  PlayableVariantConfig
} from './types.js';

export type PlayableConfigFile = Partial<Omit<BuildPlayableOptions, 'adapters'>>;

export function normalizeVariants(raw: unknown): PlayableVariantConfig[] | undefined {
  if (!raw) return undefined;
  if (Array.isArray(raw)) {
    const out: PlayableVariantConfig[] = [];
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;
      const id = String(obj.id || '').trim();
      if (!id) continue;
      out.push({
        id,
        label: typeof obj.label === 'string' ? obj.label : undefined,
        config:
          obj.config && typeof obj.config === 'object' && !Array.isArray(obj.config)
            ? (obj.config as Record<string, unknown>)
            : undefined,
        channels: Array.isArray(obj.channels) ? obj.channels.map(String) : undefined,
        orientation:
          obj.orientation === 'portrait' ||
          obj.orientation === 'landscape' ||
          obj.orientation === 'auto'
            ? obj.orientation
            : undefined,
        storeUrls:
          obj.storeUrls && typeof obj.storeUrls === 'object'
            ? (obj.storeUrls as PlayableVariantConfig['storeUrls'])
            : undefined,
        packageName: typeof obj.packageName === 'string' ? obj.packageName : undefined
      });
    }
    return out.length > 0 ? out : undefined;
  }

  // Also allow shorthand map: { "en_easy": { "lang": "en", "cta": "Play" }, "ja_hard": { ... } }
  if (typeof raw === 'object') {
    const out: PlayableVariantConfig[] = [];
    for (const [id, val] of Object.entries(raw as Record<string, unknown>)) {
      if (!id.trim() || !val || typeof val !== 'object' || Array.isArray(val)) continue;
      const obj = val as Record<string, unknown>;
      const hasStructuredKeys =
        'config' in obj || 'channels' in obj || 'orientation' in obj || 'label' in obj || 'storeUrls' in obj;
      if (hasStructuredKeys) {
        out.push({
          id: id.trim(),
          label: typeof obj.label === 'string' ? obj.label : undefined,
          config:
            obj.config && typeof obj.config === 'object' && !Array.isArray(obj.config)
              ? (obj.config as Record<string, unknown>)
              : undefined,
          channels: Array.isArray(obj.channels) ? obj.channels.map(String) : undefined,
          orientation:
            obj.orientation === 'portrait' ||
            obj.orientation === 'landscape' ||
            obj.orientation === 'auto'
              ? obj.orientation
              : undefined,
          storeUrls:
            obj.storeUrls && typeof obj.storeUrls === 'object'
              ? (obj.storeUrls as PlayableVariantConfig['storeUrls'])
              : undefined,
          packageName: typeof obj.packageName === 'string' ? obj.packageName : undefined
        });
      } else {
        out.push({ id: id.trim(), config: obj });
      }
    }
    return out.length > 0 ? out : undefined;
  }

  return undefined;
}

interface LegacyAdapterRC {
  orientation?: OrientationMode;
  exportChannels?: string[];
  enableSplash?: boolean;
  isZip?: boolean;
  injectOptions?: Record<string, CustomChannelInject>;
}

export interface LoadedConfigResult {
  configPath: string | null;
  source: 'playable.config.json' | '.adapterrc' | 'explicit' | null;
  config: PlayableConfigFile;
}

function normalizeInjectOptions(
  raw?: Record<string, CustomChannelInject>
): Partial<Record<ChannelId, CustomChannelInject>> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Partial<Record<ChannelId, CustomChannelInject>> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object') continue;
    try {
      const resolved = resolveChannel(key);
      out[resolved.id] = {
        head: typeof value.head === 'string' ? value.head : undefined,
        body: typeof value.body === 'string' ? value.body : undefined,
        sdkScript: typeof value.sdkScript === 'string' ? value.sdkScript : undefined
      };
    } catch {
      // Skip legacy unsupported channels such as Rubeex without crashing
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeConfigPayload(raw: Record<string, unknown>, isLegacyRc: boolean): PlayableConfigFile {
  if (!isLegacyRc) {
    const cfg = raw as PlayableConfigFile;
    return {
      ...cfg,
      variants: normalizeVariants(cfg.variants),
      injectOptions: normalizeInjectOptions(cfg.injectOptions as Record<string, CustomChannelInject> | undefined)
    };
  }

  const rc = raw as LegacyAdapterRC;
  const channels = Array.isArray(rc.exportChannels) && rc.exportChannels.length > 0
    ? rc.exportChannels.flatMap((ch) => {
        try {
          return [resolveChannel(ch).id];
        } catch {
          return [];
        }
      })
    : undefined;

  return {
    orientation: rc.orientation,
    channels: channels && channels.length > 0 ? channels : undefined,
    compress: typeof rc.isZip === 'boolean' ? rc.isZip : undefined,
    adapterOptions: rc.enableSplash === false ? { disableSplash: true } : undefined,
    injectOptions: normalizeInjectOptions(rc.injectOptions)
  };
}

/**
 * Loads `playable.config.json` (preferred) or falls back to legacy `.adapterrc`.
 * Relative `inputPath` / `outputDir` inside the config file are resolved relative to the config's directory.
 */
export async function loadPlayableConfig(options: {
  cwd?: string;
  configPath?: string;
} = {}): Promise<LoadedConfigResult> {
  const baseDir = path.resolve(options.cwd ?? process.cwd());

  let targetPath: string | null = null;
  let source: LoadedConfigResult['source'] = null;
  let isLegacyRc = false;

  if (options.configPath) {
    const abs = path.resolve(baseDir, options.configPath);
    if (!existsSync(abs)) {
      throw new Error(`Config file not found: "${abs}"`);
    }
    targetPath = abs;
    source = 'explicit';
    isLegacyRc = path.basename(abs) === '.adapterrc';
  } else {
    const v2Path = path.join(baseDir, 'playable.config.json');
    const v1Path = path.join(baseDir, '.adapterrc');
    if (existsSync(v2Path)) {
      targetPath = v2Path;
      source = 'playable.config.json';
    } else if (existsSync(v1Path)) {
      targetPath = v1Path;
      source = '.adapterrc';
      isLegacyRc = true;
    }
  }

  if (!targetPath) {
    return { configPath: null, source: null, config: {} };
  }

  const text = await fs.readFile(targetPath, 'utf-8');
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch (err) {
    throw new Error(
      `Failed to parse config "${targetPath}": ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const config = normalizeConfigPayload(parsed, isLegacyRc);
  const configDir = path.dirname(targetPath);

  if (config.inputPath) {
    config.inputPath = path.resolve(configDir, config.inputPath);
  }
  if (config.outputDir) {
    config.outputDir = path.resolve(configDir, config.outputDir);
  }

  return { configPath: targetPath, source, config };
}

export const DEFAULT_CONFIG_TEMPLATE: PlayableConfigFile = {
  inputPath: './dist',
  outputDir: './playable-dist',
  engine: 'auto',
  channels: ['applovin', 'unity', 'google', 'meta', 'tiktok', 'mintegral', 'moloco', 'liftoff'],
  orientation: 'auto',
  compress: true,
  injectSdkBridge: true,
  storeUrls: {
    iosUrl: 'https://apps.apple.com/app/id0000000000',
    androidUrl: 'https://play.google.com/store/apps/details?id=com.example.game'
  },
  validate: true
};
