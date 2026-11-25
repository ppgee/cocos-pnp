import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import JSZip from 'jszip';
import {
  ALL_CHANNEL_IDS,
  detectBrowserExecutable,
  resolveChannel,
  validatePlayable
} from './index.js';

let tmpDir = '';

async function writeZip(filePath: string, files: Record<string, string | Buffer>): Promise<void> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }
  const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  await fs.writeFile(filePath, buf);
}

const VALID_MRAID_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <script src="mraid.js"></script>
  <style>
    html, body { margin: 0; padding: 0; background: #102040; color: #fff; font-family: sans-serif; width: 100%; height: 100%; }
    canvas { display: block; width: 100%; height: 100%; }
    #cta { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 14px 28px; background: #ff5500; color: #fff; border: none; font-size: 16px; }
  </style>
</head>
<body>
  <canvas id="game" width="390" height="400"></canvas>
  <button id="cta" data-playable-cta>Install Now</button>
  <script>
    function draw() {
      const canvas = document.getElementById('game');
      canvas.width = window.innerWidth || 390;
      canvas.height = window.innerHeight || 400;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#183060';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(40, 40, 160, 120);
    }
    if (window.mraid) {
      const onReady = () => {
        if (window.mraid.isViewable()) draw();
        window.mraid.addEventListener('viewableChange', (v) => { if (v) draw(); });
      };
      if (window.mraid.getState() === 'loading') {
        window.mraid.addEventListener('ready', onReady);
      } else {
        onReady();
      }
    } else {
      draw();
    }
    document.getElementById('cta').addEventListener('click', () => {
      if (window.mraid && typeof window.mraid.open === 'function') {
        window.mraid.open('https://example.com/store');
      }
    });
  </script>
</body>
</html>`;

const VALID_GOOGLE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="ad.orientation" content="portrait,landscape" />
  <meta name="ad.size" content="width=320,height=480" />
  <script type="text/javascript" src="https://tpc.googlesyndication.com/pagead/gadgets/html5/api/exitapi.js"></script>
  <style>
    html, body { margin: 0; background: #222; }
    #cta { margin: 40px; padding: 16px 24px; background: #22aa55; color: #fff; }
  </style>
</head>
<body>
  <canvas id="game" width="320" height="320"></canvas>
  <button id="cta" onclick="ExitApi.exit()">Install</button>
  <script>
    const ctx = document.getElementById('game').getContext('2d');
    ctx.fillStyle = '#204080';
    ctx.fillRect(0, 0, 320, 320);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(60, 60, 200, 200);
  </script>
</body>
</html>`;

const VALID_TIKTOK_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <script src="https://sf16-muse-va.ibytedtos.com/obj/union-fe-nc-i18n/playable/sdk/playable-sdk.js"></script>
  <style>
    html, body { margin: 0; background: #111; color: #fff; }
    #cta { margin: 40px; padding: 16px 24px; background: #fe2c55; color: #fff; }
  </style>
</head>
<body>
  <div style="padding:20px;background:#25f4ee;color:#000;">Playable Hero</div>
  <button id="cta" data-playable-cta onclick="window.openAppStore()">Download</button>
</body>
</html>`;

const VALID_MINTEGRAL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    html, body { margin: 0; background: #142850; color: #fff; }
    #cta { margin: 40px; padding: 16px 24px; background: #ff9900; color: #000; }
  </style>
</head>
<body>
  <div style="padding:20px;background:#00cc99;color:#000;">Mintegral Hero</div>
  <button id="cta" data-playable-cta onclick="finishAndInstall()">Install</button>
  <script>
    window.gameStart = function () {};
    window.gameClose = function () {};
    window.onload = function () {
      if (typeof window.gameReady === 'function') window.gameReady();
    };
    function finishAndInstall() {
      if (typeof window.gameEnd === 'function') window.gameEnd();
      if (typeof window.install === 'function') window.install();
    }
  </script>
</body>
</html>`;

const VALID_MOLOCO_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    html, body { margin: 0; width: 100%; height: 100%; background: #1b1f3b; color: #fff; }
    #banner { padding: 24px; background: #5c6bc0; }
    #cta { margin: 24px; padding: 14px 28px; background: #ff7043; color: #fff; border: 0; }
  </style>
</head>
<body>
  <div id="banner">Moloco Dual-Orientation Playable</div>
  <button id="cta" data-playable-cta onclick="FbPlayableAd.onCTAClick()">Install Now</button>
</body>
</html>`;

const VALID_LIFTOFF_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    html, body { margin: 0; background: #112233; color: #fff; }
    #cta { margin: 32px; padding: 16px 24px; background: #00b894; color: #fff; border: 0; }
  </style>
</head>
<body>
  <div style="padding:20px;background:#0984e3;">Liftoff / Vungle Playable</div>
  <button id="cta" data-playable-cta onclick="parent.postMessage('download', '*')">Download</button>
  <script>
    window.addEventListener('ad-event-pause', function () {});
    window.addEventListener('ad-event-resume', function () {});
  </script>
</body>
</html>`;

const BROKEN_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <script src="mraid.js"></script>
  <script src="https://cdn.example.invalid/tracker.js"></script>
</head>
<body>
  <audio autoplay src="data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"></audio>
  <script>
    if (false) { dapi.isReady(); }
    fetch('https://api.example.invalid/ping').catch(function () {});
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctx.resume();
    } catch (e) {}
    setTimeout(function () {
      throw new Error('Synthetic playable boot crash');
    }, 50);
  </script>
</body>
</html>`;

const LANDSCAPE_BLANK_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <script src="mraid.js"></script>
  <style>
    html, body { margin: 0; width: 100%; height: 100%; background: #000000; }
    #box { width: 200px; height: 200px; background: #ff0066; }
    @media (orientation: landscape) {
      #box { display: none; }
    }
  </style>
</head>
<body>
  <div id="box">Portrait Only Content</div>
  <script>
    if (window.mraid) {
      window.mraid.getState();
      window.mraid.isViewable();
    }
    function go() { window.mraid && window.mraid.open('https://example.com'); }
  </script>
</body>
</html>`;

before(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'playable-validator-test-'));
});

after(async () => {
  if (tmpDir) {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

describe('8-channel specification resolution', () => {
  it('supports all 8 channels and resolves aliases & ironSource deprecation', () => {
    assert.equal(ALL_CHANNEL_IDS.length, 8);
    assert.equal(resolveChannel('facebook').id, 'meta');
    assert.equal(resolveChannel('Pangle').id, 'tiktok');
    assert.equal(resolveChannel('vungle').id, 'liftoff');
    assert.equal(resolveChannel('mtg').id, 'mintegral');

    const iron = resolveChannel('ironSource');
    assert.equal(iron.id, 'unity');
    assert.ok(iron.deprecatedNotice && iron.deprecatedNotice.includes('Unity LevelPlay'));
  });
});

describe('Static compliance & size breakdown checks (8 channels)', () => {
  it('passes valid single-HTML MRAID playable for applovin & unity without warnings', async () => {
    const filePath = path.join(tmpDir, 'valid-mraid.html');
    await fs.writeFile(filePath, VALID_MRAID_HTML, 'utf-8');

    const report = await validatePlayable({
      inputPath: filePath,
      channels: ['applovin', 'unity'],
      staticOnly: true
    });

    assert.equal(report.passed, true);
    assert.equal(report.channels[0].errorCount, 0);
    assert.equal(report.channels[0].warningCount, 0);
    assert.equal(report.channels[1].errorCount, 0);
    assert.equal(report.channels[1].warningCount, 0);
  });

  it('catches Meta ZIP internal index.html > 2MB, > 100 files, raw redirect, and onCTAClick args', async () => {
    // Highly compressible 2.2MB HTML compresses to tiny ZIP (<5MB) yet violates Meta's 2MB entry HTML limit
    const bigHtml = `<!DOCTYPE html><html><body>
      <!-- ${'x'.repeat(2_200_000)} -->
      <button onclick="FbPlayableAd.onCTAClick('https://bad-arg.example'); window.open('https://bad.example');">Install</button>
    </body></html>`;

    const files: Record<string, string> = { 'index.html': bigHtml };
    for (let i = 0; i < 105; i++) {
      files[`assets/f${i}.txt`] = 'a';
    }
    const zipPath = path.join(tmpDir, 'meta-bad.zip');
    await writeZip(zipPath, files);

    const report = await validatePlayable({
      inputPath: zipPath,
      channels: ['meta'],
      staticOnly: true
    });

    assert.equal(report.passed, false);
    const codes = report.channels[0].diagnostics.map((d) => d.code);
    assert.ok(codes.includes('SIZE_ENTRY_HTML_EXCEEDED'));
    assert.ok(codes.includes('STRUCT_FILE_COUNT_EXCEEDED'));
    assert.ok(codes.includes('SEC_FORBIDDEN_JS_REDIRECT'));
    assert.ok(codes.includes('CTA_FB_UNEXPECTED_ARGS'));
  });

  it('catches Google Ads disallowed file types (.mp3/.wasm) and root-absolute paths', async () => {
    const html = VALID_GOOGLE_HTML.replace('</body>', '<img src="/assets/hero.png" /></body>');
    const zipPath = path.join(tmpDir, 'google-bad-types.zip');
    await writeZip(zipPath, {
      'index.html': html,
      'assets/sfx.mp3': Buffer.from('fake-mp3'),
      'assets/physics.wasm': Buffer.from('fake-wasm')
    });

    const report = await validatePlayable({
      inputPath: zipPath,
      channels: ['google'],
      staticOnly: true
    });

    assert.equal(report.passed, false);
    const codes = report.channels[0].diagnostics.map((d) => d.code);
    assert.ok(codes.includes('STRUCT_DISALLOWED_FILE_TYPE'));
    assert.ok(codes.includes('PATH_ABSOLUTE_REF'));
  });

  it('catches TikTok missing playable-sdk.js and nested folder', async () => {
    const htmlNoSdk = `<!DOCTYPE html><html><body><button onclick="window.openAppStore()">Go</button></body></html>`;
    const zipPath = path.join(tmpDir, 'tiktok-missing-sdk.zip');
    await writeZip(zipPath, {
      'nested/index.html': htmlNoSdk
    });

    const report = await validatePlayable({
      inputPath: zipPath,
      channels: ['tiktok'],
      staticOnly: true
    });

    assert.equal(report.passed, false);
    const codes = report.channels[0].diagnostics.map((d) => d.code);
    assert.ok(codes.includes('STRUCT_NESTED_ROOT_FOLDER'));
    assert.ok(codes.includes('STRUCT_MISSING_REQUIRED_FILE'));
    assert.ok(codes.includes('SDK_MISSING_REQUIRED_SCRIPT'));
  });

  it('accepts classic Mintegral matching-folder ZIP and rejects missing gameReady/gameEnd', async () => {
    const goodZip = path.join(tmpDir, 'hero_ad.zip');
    await writeZip(goodZip, {
      'hero_ad/hero_ad.html': VALID_MINTEGRAL_HTML
    });

    const goodReport = await validatePlayable({
      inputPath: goodZip,
      channels: ['mintegral'],
      staticOnly: true
    });
    assert.equal(goodReport.passed, true);
    assert.equal(goodReport.channels[0].warningCount, 0);

    const badZip = path.join(tmpDir, 'missing_hooks.zip');
    await writeZip(badZip, {
      'index.html': '<!DOCTYPE html><html><head><script src="mraid.js"></script></head><body><button onclick="window.install()">Go</button></body></html>'
    });
    const badReport = await validatePlayable({
      inputPath: badZip,
      channels: ['mintegral'],
      staticOnly: true
    });
    const codes = badReport.channels[0].diagnostics.map((d) => d.code);
    assert.equal(badReport.passed, false);
    assert.ok(codes.includes('SDK_FORBIDDEN_MRAID'));
    assert.ok(codes.includes('LIFECYCLE_MISSING_HOOK'));
  });

  it('validates Moloco single-HTML rules and rejects ZIP/MRAID', async () => {
    const zipPath = path.join(tmpDir, 'moloco-bad.zip');
    await writeZip(zipPath, { 'index.html': VALID_MRAID_HTML });

    const report = await validatePlayable({
      inputPath: zipPath,
      channels: ['moloco'],
      staticOnly: true
    });
    const codes = report.channels[0].diagnostics.map((d) => d.code);
    assert.equal(report.passed, false);
    assert.ok(codes.includes('FORMAT_UNSUPPORTED'));
    assert.ok(codes.includes('SDK_FORBIDDEN_MRAID'));
    assert.ok(codes.includes('CTA_SIGNATURE_NOT_FOUND'));
  });

  it('validates Liftoff/Vungle ad.html root entry and rejects uppercase/spaced paths', async () => {
    const badZip = path.join(tmpDir, 'liftoff-bad-paths.zip');
    await writeZip(badZip, {
      'ad.html': VALID_LIFTOFF_HTML,
      'Assets/Hero Banner.png': Buffer.from('fake')
    });

    const report = await validatePlayable({
      inputPath: badZip,
      channels: ['liftoff'],
      staticOnly: true
    });
    const codes = report.channels[0].diagnostics.map((d) => d.code);
    assert.equal(report.passed, false);
    assert.ok(codes.includes('PATH_INVALID_ASCII_CASE'));
  });

  it('warns on Blob script loading for Google/Meta (#16/#18) and muted video autoplay for iOS (#45)', async () => {
    const blobHtml = `<!DOCTYPE html><html><body>
      <video autoplay muted src="data:video/mp4;base64,AAAA"></video>
      <button onclick="FbPlayableAd.onCTAClick()">Go</button>
      <script>
        function loadBlob(code) {
          var b = new Blob([code], { type: 'text/javascript' });
          return URL.createObjectURL(b);
        }
      </script>
    </body></html>`;
    const filePath = path.join(tmpDir, 'blob-and-video.html');
    await fs.writeFile(filePath, blobHtml, 'utf-8');

    const report = await validatePlayable({
      inputPath: filePath,
      channels: ['meta'],
      staticOnly: true
    });
    const codes = report.channels[0].diagnostics.map((d) => d.code);
    assert.ok(codes.includes('SEC_CSP_BLOB_SCRIPT'));
    assert.ok(codes.includes('MEDIA_VIDEO_AUTOPLAY_IOS_RISK'));
  });
});

describe('Headless browser runtime compliance checks (including dual-orientation)', () => {
  const hasBrowser = Boolean(detectBrowserExecutable());

  it('verifies valid AppLovin & Unity dual-orientation rendering and mraid.open CTA', { skip: !hasBrowser }, async () => {
    const filePath = path.join(tmpDir, 'runtime-applovin.html');
    await fs.writeFile(filePath, VALID_MRAID_HTML, 'utf-8');

    const report = await validatePlayable({
      inputPath: filePath,
      channels: ['applovin', 'unity'],
      settleMs: 250
    });

    for (const ch of report.channels) {
      assert.equal(ch.runtime.executed, true);
      assert.equal(ch.runtime.isBlankScreen, false);
      assert.equal(ch.runtime.landscapeCheck?.executed, true);
      assert.equal(ch.runtime.landscapeCheck?.isBlankScreen, false);
      assert.equal(ch.runtime.ctaTriggered.length, 1);
      assert.equal(ch.runtime.ctaTriggered[0].api, 'mraid.open');
      assert.equal(ch.passed, true);
    }
  });

  it('detects landscape-only blank screen on dual-orientation channels', { skip: !hasBrowser }, async () => {
    const filePath = path.join(tmpDir, 'runtime-landscape-blank.html');
    await fs.writeFile(filePath, LANDSCAPE_BLANK_HTML, 'utf-8');

    const report = await validatePlayable({
      inputPath: filePath,
      channels: ['applovin'],
      settleMs: 250
    });

    const ch = report.channels[0];
    assert.equal(ch.runtime.isBlankScreen, false);
    assert.equal(ch.runtime.landscapeCheck?.isBlankScreen, true);
    assert.ok(ch.diagnostics.some((d) => d.code === 'RENDER_LANDSCAPE_BLANK_SCREEN'));
    assert.equal(ch.passed, false);
  });

  it('verifies valid Google, TikTok, Mintegral, Moloco, and Liftoff runtimes', { skip: !hasBrowser }, async () => {
    const googleZip = path.join(tmpDir, 'rt-google.zip');
    await writeZip(googleZip, { 'index.html': VALID_GOOGLE_HTML });
    const gReport = await validatePlayable({ inputPath: googleZip, channels: ['google'], settleMs: 200 });
    assert.equal(gReport.passed, true);
    assert.equal(gReport.channels[0].runtime.ctaTriggered[0].api, 'ExitApi.exit');

    const tiktokZip = path.join(tmpDir, 'rt-tiktok.zip');
    await writeZip(tiktokZip, {
      'index.html': VALID_TIKTOK_HTML,
      'config.json': JSON.stringify({ playable_orientation: 1 })
    });
    const tReport = await validatePlayable({ inputPath: tiktokZip, channels: ['tiktok'], settleMs: 200 });
    assert.equal(tReport.passed, true);
    assert.equal(tReport.channels[0].runtime.ctaTriggered[0].api, 'window.openAppStore');

    const mtgZip = path.join(tmpDir, 'rt_mtg.zip');
    await writeZip(mtgZip, { 'rt_mtg/rt_mtg.html': VALID_MINTEGRAL_HTML });
    const mReport = await validatePlayable({ inputPath: mtgZip, channels: ['mintegral'], settleMs: 200 });
    assert.equal(mReport.passed, true);
    assert.ok(mReport.channels[0].runtime.lifecycleEvents.includes('gameReady'));
    assert.ok(mReport.channels[0].runtime.lifecycleEvents.includes('gameEnd'));
    assert.equal(mReport.channels[0].runtime.ctaTriggered[0].api, 'window.install');

    const molocoFile = path.join(tmpDir, 'rt-moloco.html');
    await fs.writeFile(molocoFile, VALID_MOLOCO_HTML, 'utf-8');
    const moReport = await validatePlayable({ inputPath: molocoFile, channels: ['moloco'], settleMs: 200 });
    assert.equal(moReport.passed, true);
    assert.equal(moReport.channels[0].runtime.landscapeCheck?.isBlankScreen, false);
    assert.equal(moReport.channels[0].runtime.ctaTriggered[0].api, 'FbPlayableAd.onCTAClick');

    const liftoffZip = path.join(tmpDir, 'rt-liftoff.zip');
    await writeZip(liftoffZip, { 'ad.html': VALID_LIFTOFF_HTML });
    const lReport = await validatePlayable({ inputPath: liftoffZip, channels: ['liftoff'], settleMs: 200 });
    assert.equal(lReport.passed, true);
    assert.equal(lReport.channels[0].runtime.ctaTriggered[0].api, 'parent.postMessage("download")');
  });

  it('catches runtime uncaught errors, external requests, and pre-interaction audio', { skip: !hasBrowser }, async () => {
    const filePath = path.join(tmpDir, 'runtime-broken.html');
    await fs.writeFile(filePath, BROKEN_HTML, 'utf-8');

    const report = await validatePlayable({
      inputPath: filePath,
      channels: ['applovin'],
      settleMs: 350
    });

    const ch = report.channels[0];
    const codes = ch.diagnostics.map((d) => d.code);
    assert.equal(ch.passed, false);
    assert.ok(codes.includes('RUNTIME_PAGE_ERROR'));
    assert.ok(codes.includes('NET_EXTERNAL_REQUEST_RUNTIME'));
    assert.ok(codes.includes('AUDIO_PLAYED_BEFORE_INTERACTION'));
  });
});
