import { existsSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Page } from 'playwright-core';
import type {
  ChannelSpec,
  Diagnostic,
  LandscapeCheckResult,
  LoadedArtifact,
  RuntimeCheckResult
} from './types.js';

const MIME_MAP: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.cjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.bin': 'application/octet-stream'
};

const CHROME_CANDIDATES: string[] = [
  // macOS
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  // Linux
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  // Windows
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];

export function detectBrowserExecutable(explicitPath?: string): string | null {
  if (explicitPath) {
    return existsSync(explicitPath) ? explicitPath : null;
  }
  const envPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || process.env.CHROME_PATH;
  if (envPath && existsSync(envPath)) {
    return envPath;
  }
  for (const candidate of CHROME_CANDIDATES) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

interface ArtifactServer {
  baseUrl: string;
  entryUrl: string;
  close: () => Promise<void>;
}

async function startArtifactServer(artifact: LoadedArtifact): Promise<ArtifactServer> {
  const fileMap = new Map<string, { content: Buffer; mime: string }>();
  for (const entry of artifact.entries) {
    const normalized = entry.path.replace(/^\/+/, '');
    fileMap.set(normalized, {
      content: entry.content,
      mime: MIME_MAP[entry.ext] || 'application/octet-stream'
    });
  }

  const entryPath = (artifact.entryHtmlPath || 'index.html').replace(/^\/+/, '');

  const server = http.createServer((req, res) => {
    const rawUrl = (req.url || '/').split('?')[0].split('#')[0];
    let relPath = decodeURIComponent(rawUrl.replace(/^\/+/, ''));
    if (!relPath) {
      relPath = entryPath;
    }

    const lowerRel = relPath.toLowerCase();
    // Mock local mraid.js or playable-sdk.js references when not bundled locally
    if ((lowerRel.endsWith('mraid.js') || lowerRel.endsWith('playable-sdk.js')) && !fileMap.has(relPath)) {
      res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
      res.end(`/* ${relPath} provided by playable-validator mock host */`);
      return;
    }

    const hit = fileMap.get(relPath);
    if (!hit) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Not found: ${relPath}`);
      return;
    }

    res.writeHead(200, { 'Content-Type': hit.mime });
    res.end(hit.content);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const addr = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  const entryUrl = `${baseUrl}/${encodeURI(entryPath)}`;

  return {
    baseUrl,
    entryUrl,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      })
  };
}

function buildHostMockScript(spec: ChannelSpec): string {
  const channel = spec.id;
  const mraidVersion = spec.mraidVersion || '2.0';
  const enableMraid = channel === 'applovin' || channel === 'unity' || channel === 'liftoff';
  const enableFbBridge = channel === 'meta' || channel === 'moloco';

  return `(() => {
    const probe = {
      channel: ${JSON.stringify(channel)},
      interacted: false,
      startTime: Date.now(),
      audioBefore: [],
      audioAfter: [],
      ctaTriggered: [],
      lifecycleEvents: []
    };
    window.__PLAYABLE_PROBE__ = probe;

    const recordAudio = (api) => {
      const item = { api, timestampMs: Date.now() - probe.startTime };
      if (probe.interacted) {
        probe.audioAfter.push(item);
      } else {
        probe.audioBefore.push(item);
      }
    };

    const recordCta = (ch, api, args) => {
      probe.ctaTriggered.push({
        channel: ch,
        api,
        args: Array.from(args || []).map((a) => (typeof a === 'string' || typeof a === 'number' || typeof a === 'boolean' ? a : String(a)))
      });
    };

    // Instrument HTMLMediaElement.play()
    if (typeof HTMLMediaElement !== 'undefined' && HTMLMediaElement.prototype.play) {
      const origPlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function (...args) {
        if (!this.muted && this.volume !== 0) {
          recordAudio(this.tagName.toLowerCase() + '.play');
        }
        try {
          const res = origPlay.apply(this, args);
          if (res && typeof res.catch === 'function') {
            return res.catch(() => {});
          }
          return res;
        } catch {
          return Promise.resolve();
        }
      };
    }

    // Instrument Web Audio API
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx && AudioCtx.prototype) {
      if (AudioCtx.prototype.resume) {
        const origResume = AudioCtx.prototype.resume;
        AudioCtx.prototype.resume = function (...args) {
          recordAudio('AudioContext.resume');
          return origResume.apply(this, args);
        };
      }
      if (typeof AudioBufferSourceNode !== 'undefined' && AudioBufferSourceNode.prototype.start) {
        const origStart = AudioBufferSourceNode.prototype.start;
        AudioBufferSourceNode.prototype.start = function (...args) {
          recordAudio('AudioBufferSourceNode.start');
          return origStart.apply(this, args);
        };
      }
      if (typeof OscillatorNode !== 'undefined' && OscillatorNode.prototype.start) {
        const origOscStart = OscillatorNode.prototype.start;
        OscillatorNode.prototype.start = function (...args) {
          recordAudio('OscillatorNode.start');
          return origOscStart.apply(this, args);
        };
      }
    }

    // Channel-specific mock host bridges
    if (${JSON.stringify(enableMraid)}) {
      const listeners = {};
      window.mraid = {
        getVersion: () => ${JSON.stringify(mraidVersion)},
        getState: () => 'default',
        isViewable: () => true,
        getPlacementType: () => 'interstitial',
        getScreenSize: () => ({ width: window.innerWidth, height: window.innerHeight }),
        getMaxSize: () => ({ width: window.innerWidth, height: window.innerHeight }),
        addEventListener: (event, fn) => {
          listeners[event] = listeners[event] || [];
          listeners[event].push(fn);
          probe.lifecycleEvents.push('mraid.on:' + event);
          if (event === 'ready') {
            setTimeout(() => fn(), 0);
          } else if (event === 'viewableChange') {
            setTimeout(() => fn(true), 0);
          }
        },
        removeEventListener: (event, fn) => {
          if (!listeners[event]) return;
          listeners[event] = listeners[event].filter((cb) => cb !== fn);
        },
        open: (...args) => recordCta(${JSON.stringify(channel)}, 'mraid.open', args),
        close: () => {}
      };
    }

    if (${JSON.stringify(channel === 'google')}) {
      window.ExitApi = {
        exit: (...args) => recordCta('google', 'ExitApi.exit', args)
      };
    }

    if (${JSON.stringify(enableFbBridge)}) {
      window.FbPlayableAd = {
        onCTAClick: (...args) => recordCta(${JSON.stringify(channel)}, 'FbPlayableAd.onCTAClick', args)
      };
    }

    if (${JSON.stringify(channel === 'tiktok')}) {
      window.openAppStore = (...args) => recordCta('tiktok', 'window.openAppStore', args);
      window.playableSDK = {
        openAppStore: (...args) => recordCta('tiktok', 'playableSDK.openAppStore', args)
      };
    }

    if (${JSON.stringify(channel === 'mintegral')}) {
      window.gameReady = () => probe.lifecycleEvents.push('gameReady');
      window.gameEnd = () => probe.lifecycleEvents.push('gameEnd');
      window.install = (...args) => recordCta('mintegral', 'window.install', args);
    }

    if (${JSON.stringify(channel === 'liftoff')}) {
      const origPostMessage = window.postMessage.bind(window);
      window.postMessage = function (message, targetOrigin, transfer) {
        if (message === 'download') {
          recordCta('liftoff', 'parent.postMessage("download")', [message]);
        } else if (message === 'complete') {
          probe.lifecycleEvents.push('liftoff:complete');
        }
        try {
          return origPostMessage(message, targetOrigin || '*', transfer);
        } catch {
          return undefined;
        }
      };
    }
  })();`;
}

async function sampleBlankScreen(page: Page): Promise<{ isBlank: boolean; details?: string }> {
  try {
    const screenshotBuf = await page.screenshot({ type: 'png' });
    const dataUrl = `data:image/png;base64,${screenshotBuf.toString('base64')}`;

    const sample = await page.evaluate(async (imgSrc: string) => {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to decode screenshot'));
        img.src = imgSrc;
      });

      const w = 64;
      const h = 64;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d');
      if (!ctx) return { uniqueBuckets: 2, solidHex: null as string | null };

      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      const buckets = new Set<string>();
      const firstR = data[0];
      const firstG = data[1];
      const firstB = data[2];

      for (let i = 0; i < data.length; i += 4) {
        const key = `${data[i] >> 4},${data[i + 1] >> 4},${data[i + 2] >> 4}`;
        buckets.add(key);
        if (buckets.size > 4) break;
      }

      const toHex = (n: number) => n.toString(16).padStart(2, '0');
      return {
        uniqueBuckets: buckets.size,
        solidHex: `#${toHex(firstR)}${toHex(firstG)}${toHex(firstB)}`
      };
    }, dataUrl);

    if (sample.uniqueBuckets <= 1) {
      return {
        isBlank: true,
        details: `Rendered frame is a uniform solid color (${sample.solidHex}).`
      };
    }
    return { isBlank: false };
  } catch (err) {
    return {
      isBlank: false,
      details: `Render probe failed: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}

export interface RuntimeSessionOptions {
  browserPath?: string;
  viewport: { width: number; height: number };
  settleMs: number;
  ctaSelector?: string;
}

export interface RuntimeRunner {
  checkChannel: (spec: ChannelSpec) => Promise<{
    result: RuntimeCheckResult;
    diagnostics: Diagnostic[];
  }>;
  close: () => Promise<void>;
}

function makeSkippedResult(
  viewport: { width: number; height: number },
  reason: string
): RuntimeCheckResult {
  return {
    executed: false,
    skippedReason: reason,
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
}

export async function createRuntimeRunner(
  artifact: LoadedArtifact,
  options: RuntimeSessionOptions
): Promise<RuntimeRunner> {
  if (!artifact.entryHtmlPath || !artifact.entryHtmlContent) {
    const skipped = makeSkippedResult(options.viewport, 'No entry HTML file to execute.');
    return {
      checkChannel: async () => ({ result: skipped, diagnostics: [] }),
      close: async () => {}
    };
  }

  const executablePath = detectBrowserExecutable(options.browserPath);
  if (!executablePath) {
    const reason =
      'No local Chrome/Chromium executable found. Pass --browser-path or set PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to enable headless runtime checks.';
    const skipped = makeSkippedResult(options.viewport, reason);
    return {
      checkChannel: async () => ({
        result: skipped,
        diagnostics: [
          {
            code: 'RUNTIME_SKIPPED_NO_BROWSER',
            severity: 'warning',
            category: 'runtime',
            message: reason
          }
        ]
      }),
      close: async () => {}
    };
  }

  let playwrightCore: typeof import('playwright-core');
  try {
    playwrightCore = await import('playwright-core');
  } catch {
    const reason =
      'playwright-core is not installed. Install playwright-core to enable headless runtime checks.';
    const skipped = makeSkippedResult(options.viewport, reason);
    return {
      checkChannel: async () => ({
        result: skipped,
        diagnostics: [
          {
            code: 'RUNTIME_SKIPPED_NO_PLAYWRIGHT',
            severity: 'warning',
            category: 'runtime',
            message: reason
          }
        ]
      }),
      close: async () => {}
    };
  }

  const server = await startArtifactServer(artifact);
  const browser = await playwrightCore.chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required']
  });

  const setupPageRouting = async (
    page: Page,
    spec: ChannelSpec,
    blocked: Array<{ url: string; resourceType: string }>
  ) => {
    await page.route('**/*', async (route) => {
      const req = route.request();
      const url = req.url();

      if (url.startsWith(server.baseUrl) || url.startsWith('data:') || url.startsWith('blob:')) {
        await route.continue();
        return;
      }

      const isWhitelisted = spec.allowedExternalUrlPrefixes.some((prefix) =>
        url.toLowerCase().startsWith(prefix.toLowerCase())
      );

      if (isWhitelisted) {
        await route.fulfill({
          status: 200,
          contentType: 'application/javascript; charset=utf-8',
          body: '/* whitelisted SDK fulfilled locally by playable-validator */'
        });
        return;
      }

      blocked.push({
        url,
        resourceType: req.resourceType()
      });
      await route.abort('blockedbyclient');
    });
  };

  const checkChannel = async (
    spec: ChannelSpec
  ): Promise<{ result: RuntimeCheckResult; diagnostics: Diagnostic[] }> => {
    const context = await browser.newContext({
      viewport: options.viewport,
      deviceScaleFactor: 1,
      hasTouch: true,
      isMobile: true
    });

    const page = await context.newPage();
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const blockedExternalRequests: Array<{ url: string; resourceType: string }> = [];

    await page.addInitScript(buildHostMockScript(spec));
    await setupPageRouting(page, spec, blockedExternalRequests);

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message || String(err));
    });

    const loadStart = Date.now();
    try {
      await page.goto(server.entryUrl, { waitUntil: 'load', timeout: 15000 });
    } catch (err) {
      pageErrors.push(`Navigation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    const loadTimeMs = Date.now() - loadStart;

    if (options.settleMs > 0) {
      await page.waitForTimeout(options.settleMs);
    }

    const canvasCount = await page
      .evaluate(() => document.querySelectorAll('canvas').length)
      .catch(() => 0);

    const portraitRender = await sampleBlankScreen(page);

    // Mark interaction start and attempt CTA probe
    await page.evaluate(() => {
      const p = (window as unknown as { __PLAYABLE_PROBE__?: { interacted: boolean } }).__PLAYABLE_PROBE__;
      if (p) p.interacted = true;
    });

    try {
      let clicked = false;
      if (options.ctaSelector) {
        const loc = page.locator(options.ctaSelector).first();
        if ((await loc.count()) > 0 && (await loc.isVisible())) {
          await loc.click({ timeout: 2000 });
          clicked = true;
        }
      }

      if (!clicked) {
        const autoTarget = page
          .locator(
            '[data-playable-cta], button:has-text("install"), button:has-text("download"), button:has-text("play"), a:has-text("install"), a:has-text("download"), [onclick*="exit" i], [onclick*="open" i], [onclick*="cta" i], [onclick*="install" i], [onclick*="postMessage" i]'
          )
          .first();
        if ((await autoTarget.count()) > 0 && (await autoTarget.isVisible())) {
          await autoTarget.click({ timeout: 2000 });
          clicked = true;
        }
      }

      if (!clicked) {
        await page.mouse.click(options.viewport.width / 2, options.viewport.height / 2);
      }
      await page.waitForTimeout(300);
    } catch {
      // Non-fatal
    }

    const probeData = await page.evaluate(() => {
      const p = (
        window as unknown as {
          __PLAYABLE_PROBE__?: {
            audioBefore: Array<{ api: string; timestampMs: number }>;
            audioAfter: Array<{ api: string; timestampMs: number }>;
            ctaTriggered: Array<{ channel: string; api: string; args: unknown[] }>;
            lifecycleEvents: string[];
          };
        }
      ).__PLAYABLE_PROBE__;
      return (
        p || {
          audioBefore: [],
          audioAfter: [],
          ctaTriggered: [],
          lifecycleEvents: []
        }
      );
    });

    await context.close();

    // Dual-orientation check (landscape viewport) for channels requiring portrait + landscape support
    let landscapeCheck: LandscapeCheckResult | undefined;
    if (spec.requireDualOrientation) {
      const landscapeViewport = {
        width: Math.max(options.viewport.width, options.viewport.height),
        height: Math.min(options.viewport.width, options.viewport.height)
      };
      const lsContext = await browser.newContext({
        viewport: landscapeViewport,
        deviceScaleFactor: 1,
        hasTouch: true,
        isMobile: true
      });
      const lsPage = await lsContext.newPage();
      const lsConsoleErrors: string[] = [];
      const lsPageErrors: string[] = [];
      const lsBlocked: Array<{ url: string; resourceType: string }> = [];

      await lsPage.addInitScript(buildHostMockScript(spec));
      await setupPageRouting(lsPage, spec, lsBlocked);
      lsPage.on('console', (msg) => {
        if (msg.type() === 'error') lsConsoleErrors.push(msg.text());
      });
      lsPage.on('pageerror', (err) => {
        lsPageErrors.push(err.message || String(err));
      });

      try {
        await lsPage.goto(server.entryUrl, { waitUntil: 'load', timeout: 15000 });
      } catch (err) {
        lsPageErrors.push(`Landscape navigation failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      if (options.settleMs > 0) {
        await lsPage.waitForTimeout(Math.min(options.settleMs, 600));
      }

      const lsRender = await sampleBlankScreen(lsPage);
      await lsContext.close();

      landscapeCheck = {
        executed: true,
        viewport: landscapeViewport,
        isBlankScreen: lsRender.isBlank,
        blankScreenDetails: lsRender.details,
        consoleErrors: lsConsoleErrors,
        pageErrors: lsPageErrors
      };
    }

    const result: RuntimeCheckResult = {
      executed: true,
      browserExecutablePath: executablePath,
      loadTimeMs,
      consoleErrors,
      pageErrors,
      blockedExternalRequests,
      audioPlayedBeforeInteraction: probeData.audioBefore,
      audioPlayedAfterInteraction: probeData.audioAfter,
      ctaTriggered: probeData.ctaTriggered,
      lifecycleEvents: probeData.lifecycleEvents,
      canvasCount,
      isBlankScreen: portraitRender.isBlank,
      blankScreenDetails: portraitRender.details,
      viewport: options.viewport,
      landscapeCheck
    };

    const diagnostics: Diagnostic[] = [];

    if (pageErrors.length > 0) {
      diagnostics.push({
        code: 'RUNTIME_PAGE_ERROR',
        severity: 'error',
        category: 'runtime',
        message: `Encountered ${pageErrors.length} uncaught page error(s) during startup.`,
        suggestion: 'Fix all uncaught exceptions before submitting to ad networks.',
        details: { errors: pageErrors }
      });
    }

    if (consoleErrors.length > 0) {
      diagnostics.push({
        code: 'RUNTIME_CONSOLE_ERROR',
        severity: 'error',
        category: 'runtime',
        message: `Encountered ${consoleErrors.length} console.error message(s) at runtime.`,
        suggestion: 'Inspect and resolve runtime console errors (e.g. missing assets or broken SDK calls).',
        details: { errors: consoleErrors }
      });
    }

    if (blockedExternalRequests.length > 0) {
      diagnostics.push({
        code: 'NET_EXTERNAL_REQUEST_RUNTIME',
        severity: 'error',
        category: 'network',
        message: `Blocked ${blockedExternalRequests.length} unauthorized external network request(s) at runtime.`,
        suggestion: 'Inline or locally bundle all runtime-fetched resources; ad WebViews run offline or block external URLs.',
        details: { requests: blockedExternalRequests }
      });
    }

    if (portraitRender.isBlank) {
      diagnostics.push({
        code: 'RENDER_BLANK_SCREEN',
        severity: 'error',
        category: 'render',
        message: `Portrait first screen appears blank. ${portraitRender.details || ''}`.trim(),
        suggestion: 'Verify initialization sequence, asset loading, and WebGL/Canvas rendering in mobile portrait viewport.'
      });
    }

    if (landscapeCheck) {
      if (landscapeCheck.isBlankScreen) {
        diagnostics.push({
          code: 'RENDER_LANDSCAPE_BLANK_SCREEN',
          severity: 'error',
          category: 'render',
          message: `Landscape viewport (${landscapeCheck.viewport.width}x${landscapeCheck.viewport.height}) appears blank. ${landscapeCheck.blankScreenDetails || ''}`.trim(),
          suggestion: `${spec.displayName} requires both portrait and landscape support; ensure layout & canvas resize cleanly in landscape.`
        });
      }
      if (landscapeCheck.pageErrors.length > 0) {
        diagnostics.push({
          code: 'RUNTIME_LANDSCAPE_ERROR',
          severity: 'error',
          category: 'runtime',
          message: `Encountered ${landscapeCheck.pageErrors.length} uncaught error(s) in landscape viewport.`,
          suggestion: 'Fix layout/resize errors occurring when initialized in landscape orientation.',
          details: { errors: landscapeCheck.pageErrors }
        });
      }
    }

    if (spec.forbidAutoplayAudio && probeData.audioBefore.length > 0) {
      diagnostics.push({
        code: 'AUDIO_PLAYED_BEFORE_INTERACTION',
        severity: 'error',
        category: 'audio',
        message: `Audio playback attempted ${probeData.audioBefore.length} time(s) before first user interaction.`,
        suggestion: 'Defer AudioContext.resume() and audio.play() until the first pointerdown/touchstart/click gesture.',
        details: { events: probeData.audioBefore }
      });
    }

    if (spec.id === 'mintegral' && !probeData.lifecycleEvents.includes('gameReady')) {
      diagnostics.push({
        code: 'LIFECYCLE_MINTEGRAL_GAMEREADY_NOT_CALLED',
        severity: 'warning',
        category: 'lifecycle',
        message: 'window.gameReady() was not invoked during startup.',
        suggestion: 'Call window.gameReady && window.gameReady() right after initial scene/assets load so Mintegral can reveal the playable.'
      });
    }

    if (probeData.ctaTriggered.length > 0) {
      diagnostics.push({
        code: 'CTA_RUNTIME_VERIFIED',
        severity: 'info',
        category: 'cta',
        message: `CTA trigger verified at runtime via ${probeData.ctaTriggered.map((c) => c.api).join(', ')}.`,
        details: { calls: probeData.ctaTriggered }
      });
    } else if (options.ctaSelector) {
      diagnostics.push({
        code: 'CTA_SELECTOR_NOT_TRIGGERED',
        severity: 'error',
        category: 'cta',
        message: `Clicked selector "${options.ctaSelector}" (or could not find it), but no ${spec.displayName} CTA API call was observed.`,
        suggestion: `Ensure clicking "${options.ctaSelector}" invokes ${spec.ctaSignatures[0]}.`
      });
    } else {
      diagnostics.push({
        code: 'CTA_NOT_TRIGGERED_AUTOMATICALLY',
        severity: 'info',
        category: 'cta',
        message: `No ${spec.displayName} CTA call fired during generic auto-click probe (normal if CTA appears only after gameplay).`,
        suggestion: 'Pass --cta-selector "<css-selector>" or mark your CTA button with data-playable-cta for strict runtime CTA verification.'
      });
    }

    return { result, diagnostics };
  };

  return {
    checkChannel,
    close: async () => {
      await browser.close();
      await server.close();
    }
  };
}
