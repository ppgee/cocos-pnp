import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { detectBrowserExecutable } from '@cocos-pnp/playable-validator';
import { buildPlayable, genericWebAdapter, loadPlayableConfig, optimizeDirectory, type EngineAdapter } from './index.js';

let tmpDir = '';

// Valid 1x1 red PNG buffer
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

// Minimal valid silent WAV buffer
const TINY_WAV = Buffer.from(
  'UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA',
  'base64'
);

before(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'playable-core-e2e-'));
});

after(async () => {
  if (tmpDir) {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

describe('@cocos-pnp/playable-core engine-agnostic multi-channel build + validate', () => {
  it('builds ONE channel-agnostic Web game (with dynamic new Image().src + new Audio() + fetch) into ALL 8 networks and passes 8/8 checks', async () => {
    const srcDir = path.join(tmpDir, 'generic-game');
    const outDir = path.join(tmpDir, 'out-all-8');
    await fs.mkdir(path.join(srcDir, 'Assets'), { recursive: true });

    await fs.writeFile(
      path.join(srcDir, 'style.css'),
      `html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #142850; color: #fff; font-family: sans-serif; overflow: hidden; }
canvas { display: block; width: 100%; height: 100%; }
#cta { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); padding: 14px 30px; background: #ff6a00; color: #fff; border: 0; border-radius: 999px; font-size: 16px; font-weight: 700; }`
    );

    // Deliberately tests PixiJS/Phaser/Three.js-style dynamic Image.src & Audio loading from JS!
    await fs.writeFile(
      path.join(srcDir, 'app.js'),
      `window.__ACTIVE_CHANNEL__ = '{{__playable_channel__}}';
window.__LEGACY_CHANNEL__ = '{{__adv_channels_adapter__}}';
var loadedSprite = null;
function draw() {
  const canvas = document.getElementById('stage');
  canvas.width = window.innerWidth || 390;
  canvas.height = window.innerHeight || 844;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#142850';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const s = Math.min(canvas.width, canvas.height) * 0.4;
  ctx.fillStyle = '#ffd166';
  ctx.fillRect((canvas.width - s) / 2, (canvas.height - s) / 2, s, s);
  if (loadedSprite) {
    ctx.drawImage(loadedSprite, 20, 20, 48, 48);
  }
}
window.playable.init({
  onStart: function () {
    var img = new Image();
    img.onload = function () {
      loadedSprite = img;
      draw();
      window.playable.ready();
    };
    img.onerror = function () {
      throw new Error('Dynamic Image.src failed to load from VFS');
    };
    img.src = 'Assets/Dynamic Sprite.png';
  },
  onResize: draw
});
document.getElementById('cta').addEventListener('click', function () {
  var sfx = new Audio('Assets/Pop Sound.wav');
  sfx.muted = true;
  window.playable.gameEnd();
  window.playable.cta();
});`
    );

    await fs.writeFile(path.join(srcDir, 'Assets', 'Dynamic Sprite.png'), TINY_PNG);
    await fs.writeFile(path.join(srcDir, 'Assets', 'Pop Sound.wav'), TINY_WAV);
    await fs.writeFile(path.join(srcDir, 'level.json'), JSON.stringify({ level: 1, speed: 3 }));

    await fs.writeFile(
      path.join(srcDir, 'index.html'),
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Universal Demo Playable</title>
  <link rel="stylesheet" href="./style.css" />
</head>
<body>
  <canvas id="stage" width="390" height="844"></canvas>
  <button id="cta" data-playable-cta>Install Now</button>
  <script src="./app.js"></script>
</body>
</html>`
    );

    const hasBrowser = Boolean(detectBrowserExecutable());
    const result = await buildPlayable({
      inputPath: srcDir,
      outputDir: outDir,
      channels: ['all'],
      orientation: 'portrait',
      packageName: 'demo_game',
      storeUrls: {
        iosUrl: 'https://apps.apple.com/app/id123456',
        androidUrl: 'https://play.google.com/store/apps/details?id=com.example.demo'
      },
      validate: true,
      staticOnly: !hasBrowser
    });

    assert.equal(result.engine, 'generic-web');
    assert.equal(result.artifacts.length, 8);

    const expectedCtaApi: Record<string, string> = {
      applovin: 'mraid.open',
      unity: 'mraid.open',
      google: 'ExitApi.exit',
      meta: 'FbPlayableAd.onCTAClick',
      tiktok: 'window.openAppStore',
      mintegral: 'window.install',
      moloco: 'FbPlayableAd.onCTAClick',
      liftoff: 'parent.postMessage("download")'
    };

    for (const art of result.artifacts) {
      assert.ok(art.validation, `${art.channel} should have validation report`);
      const chReport = art.validation.channels[0];
      assert.equal(
        chReport.passed,
        true,
        `${art.channel} failed validation: ${JSON.stringify(chReport.diagnostics, null, 2)}`
      );

      if (hasBrowser) {
        assert.equal(chReport.runtime.executed, true, `${art.channel} runtime should execute`);
        assert.equal(chReport.runtime.isBlankScreen, false, `${art.channel} should not be blank`);
        assert.equal(chReport.runtime.pageErrors.length, 0, `${art.channel} should have zero page errors`);
        assert.equal(
          chReport.runtime.ctaTriggered[0]?.api,
          expectedCtaApi[art.channel],
          `${art.channel} should trigger ${expectedCtaApi[art.channel]}`
        );
      }
    }

    assert.equal(result.allValid, true);
  });

  it('auto-detects PlayCanvas exports and builds compliant single-HTML & slim ZIP outputs', async () => {
    const pcDir = path.join(tmpDir, 'playcanvas-export');
    const outDir = path.join(tmpDir, 'out-playcanvas');
    await fs.mkdir(path.join(pcDir, 'files', 'assets'), { recursive: true });

    await fs.writeFile(path.join(pcDir, 'config.json'), JSON.stringify({ application_properties: {} }));
    await fs.writeFile(path.join(pcDir, 'playcanvas-stable.min.js'), 'window.pc = { version: "2.0.0" };');
    await fs.writeFile(
      path.join(pcDir, '__start__.js'),
      `window.playable.init({ onStart: function(){ window.playable.ready(); } });`
    );
    await fs.writeFile(path.join(pcDir, 'files', 'assets', 'tex.png'), TINY_PNG);
    await fs.writeFile(
      path.join(pcDir, 'index.html'),
      `<!DOCTYPE html><html><head><link rel="manifest" href="manifest.json" /></head><body>
        <canvas id="application-canvas"></canvas>
        <script src="playcanvas-stable.min.js"></script>
        <script src="__start__.js"></script>
      </body></html>`
    );

    const result = await buildPlayable({
      inputPath: pcDir,
      outputDir: outDir,
      channels: ['applovin', 'google', 'meta'],
      validate: true,
      staticOnly: true
    });

    assert.equal(result.engine, 'playcanvas');
    assert.equal(result.allValid, true);
    const applovinHtml = await fs.readFile(result.artifacts[0].outputPath, 'utf-8');
    assert.equal(applovinHtml.includes('manifest.json'), false, 'PlayCanvas manifest link should be stripped');
    assert.ok(applovinHtml.includes('HTMLImageElement.prototype'), '7-entry browser VFS shim should be active');
  });

  it('auto-detects Cocos 2.x, Godot 4, and Unity WebGL built-in adapters', async () => {
    // 1. Cocos 2.x (2.4.x)
    const c2Dir = path.join(tmpDir, 'cocos-24x-export');
    await fs.mkdir(path.join(c2Dir, 'src'), { recursive: true });
    await fs.writeFile(path.join(c2Dir, 'src', 'settings.js'), 'window._CCSettings={jsList:["ext.js"]};');
    await fs.writeFile(path.join(c2Dir, 'src', 'ext.js'), 'window.__EXT__=1;');
    await fs.writeFile(path.join(c2Dir, 'cocos2d-js-min.js'), 'window.cc={};');
    await fs.writeFile(path.join(c2Dir, 'main.js'), 'window.boot=function(){};');
    await fs.writeFile(path.join(c2Dir, 'index.html'), '<!DOCTYPE html><html><body><canvas></canvas></body></html>');

    const c2Res = await buildPlayable({
      inputPath: c2Dir,
      outputDir: path.join(tmpDir, 'out-c2'),
      channels: ['applovin', 'meta'],
      disableSplash: true,
      validate: true,
      staticOnly: true
    });
    assert.equal(c2Res.engine, 'cocos-2x');
    assert.equal(c2Res.allValid, true);

    // 2. Godot 4 HTML5
    const g4Dir = path.join(tmpDir, 'godot-4-export');
    await fs.mkdir(g4Dir, { recursive: true });
    await fs.writeFile(path.join(g4Dir, 'game.pck'), Buffer.from('GDPC'));
    await fs.writeFile(path.join(g4Dir, 'game.wasm'), Buffer.from([0x00, 0x61, 0x73, 0x6d]));
    await fs.writeFile(path.join(g4Dir, 'index.html'), '<!DOCTYPE html><html><head><link rel="icon" href="icon.png" /></head><body><canvas></canvas></body></html>');

    const g4Res = await buildPlayable({
      inputPath: g4Dir,
      outputDir: path.join(tmpDir, 'out-g4'),
      channels: ['applovin', 'google'],
      validate: true,
      staticOnly: true
    });
    assert.equal(g4Res.engine, 'godot-4');
    assert.equal(g4Res.allValid, true);

    // 3. Unity WebGL (uncompressed)
    const uDir = path.join(tmpDir, 'unity-webgl-export');
    await fs.mkdir(path.join(uDir, 'Build'), { recursive: true });
    await fs.writeFile(path.join(uDir, 'Build', 'demo.loader.js'), 'window.createUnityInstance=function(){};');
    await fs.writeFile(path.join(uDir, 'Build', 'demo.framework.js'), 'window.__UNITY_FW__=1;');
    await fs.writeFile(path.join(uDir, 'Build', 'demo.wasm'), Buffer.from([0x00, 0x61, 0x73, 0x6d]));
    await fs.writeFile(path.join(uDir, 'index.html'), '<!DOCTYPE html><html><body><canvas></canvas><script src="Build/demo.loader.js"></script></body></html>');

    const uRes = await buildPlayable({
      inputPath: uDir,
      outputDir: path.join(tmpDir, 'out-unity-webgl'),
      channels: ['applovin', 'google'],
      validate: true,
      staticOnly: true
    });
    assert.equal(uRes.engine, 'unity-webgl');
    assert.equal(uRes.allValid, true);
  });

  it('supports plugging in custom EngineAdapter plugins without modifying core', async () => {
    const customDir = path.join(tmpDir, 'laya-custom-export');
    const outDir = path.join(tmpDir, 'out-laya');
    await fs.mkdir(customDir, { recursive: true });

    await fs.writeFile(path.join(customDir, 'laya.core.js'), 'window.Laya={};');
    await fs.writeFile(
      path.join(customDir, 'index.html'),
      `<!DOCTYPE html><html><head></head><body><canvas id="canvas"></canvas><script src="laya.core.js"></script></body></html>`
    );

    const customLayaAdapter: EngineAdapter = {
      id: 'laya-3',
      displayName: 'LayaAir 3 (Custom Plugin)',
      preferSlimZip: true,
      detect: (files) => files.some((f) => f.path.includes('laya.core.js')),
      transformSingleHtml: (ctx) => {
        ctx.$('head').append('<meta name="x-engine-adapter" content="laya-3" />');
        return genericWebAdapter.transformSingleHtml(ctx);
      }
    };

    const result = await buildPlayable({
      inputPath: customDir,
      outputDir: outDir,
      channels: ['applovin', 'google'],
      adapters: [customLayaAdapter],
      validate: true,
      staticOnly: true
    });

    assert.equal(result.engine, 'laya-3');
    assert.equal(result.allValid, true);
    const html = await fs.readFile(result.artifacts[0].outputPath, 'utf-8');
    assert.ok(html.includes('x-engine-adapter" content="laya-3"'));
  });

  it('loads playable.config.json and transparently migrates legacy .adapterrc files', async () => {
    const cfgDir = path.join(tmpDir, 'cfg-v2');
    await fs.mkdir(cfgDir, { recursive: true });
    await fs.writeFile(
      path.join(cfgDir, 'playable.config.json'),
      JSON.stringify({
        inputPath: './dist',
        outputDir: './out',
        engine: 'playcanvas',
        channels: ['applovin', 'google']
      })
    );
    const v2 = await loadPlayableConfig({ cwd: cfgDir });
    assert.equal(v2.source, 'playable.config.json');
    assert.equal(v2.config.engine, 'playcanvas');
    assert.equal(v2.config.inputPath, path.join(cfgDir, 'dist'));

    const legacyDir = path.join(tmpDir, 'cfg-v1');
    await fs.mkdir(legacyDir, { recursive: true });
    await fs.writeFile(
      path.join(legacyDir, '.adapterrc'),
      JSON.stringify({
        orientation: 'portrait',
        exportChannels: ['Facebook', 'IronSource', 'Google'],
        enableSplash: false,
        isZip: true,
        injectOptions: {
          Facebook: { head: '<meta name="x-fb" content="1" />' }
        }
      })
    );
    const v1 = await loadPlayableConfig({ cwd: legacyDir });
    assert.equal(v1.source, '.adapterrc');
    assert.deepEqual(v1.config.channels, ['meta', 'unity', 'google']);
    assert.equal(v1.config.adapterOptions?.disableSplash, true);
    assert.equal(v1.config.injectOptions?.meta?.head, '<meta name="x-fb" content="1" />');
  });

  it('auto-detects Cocos 3.8.x builds with MD5 cache (#47) + 120 files, exports ALL 8 channels via slim ZIP, and passes 8/8 validation', async () => {
    const cocosDir = path.join(tmpDir, 'cocos-385-md5-web-mobile');
    const outDir = path.join(tmpDir, 'out-cocos-all-8');
    await fs.mkdir(path.join(cocosDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(cocosDir, 'assets', 'main', 'import'), { recursive: true });

    await fs.writeFile(
      path.join(cocosDir, 'src', 'settings.a1b2c.json'),
      JSON.stringify({
        plugins: { jsList: ['plugin-a.js'] },
        splashScreen: { totalTime: 2000 }
      })
    );
    await fs.writeFile(
      path.join(cocosDir, 'src', 'import-map.d3e4f.json'),
      JSON.stringify({ imports: {} })
    );
    await fs.writeFile(
      path.join(cocosDir, 'src', 'system.bundle.12345.js'),
      'window.System = { import: () => Promise.resolve() };'
    );
    await fs.writeFile(path.join(cocosDir, 'src', 'plugin-a.js'), 'window.__PLUGIN_A_LOADED__ = true;');
    await fs.writeFile(path.join(cocosDir, 'assets', 'spine.f00ba.wasm'), Buffer.from([0x00, 0x61, 0x73, 0x6d]));

    for (let i = 0; i < 115; i++) {
      await fs.writeFile(
        path.join(cocosDir, 'assets', 'main', 'import', `Asset_${i}.json`),
        JSON.stringify({ id: i, tag: 'cocos-asset-payload' })
      );
    }

    await fs.writeFile(
      path.join(cocosDir, 'index.html'),
      `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body>
        <script src="src/system.bundle.12345.js"></script>
      </body></html>`
    );

    const result = await buildPlayable({
      inputPath: cocosDir,
      outputDir: outDir,
      channels: ['all'],
      disableSplash: true,
      validate: true,
      staticOnly: true
    });

    assert.equal(result.engine, 'cocos-3x');
    assert.equal(result.artifacts.length, 8);
    for (const art of result.artifacts) {
      assert.equal(
        art.validation?.passed,
        true,
        `Cocos 3.x ${art.channel} failed: ${JSON.stringify(art.validation?.channels[0]?.diagnostics, null, 2)}`
      );
    }
    assert.equal(result.allValid, true);

    const metaArt = result.artifacts.find((a) => a.channel === 'meta');
    assert.ok(metaArt?.validation);
    assert.ok(metaArt.validation.sizeBreakdown.fileCount <= 10, 'Meta slim ZIP should bundle 120+ assets into <=10 files');
    assert.ok(metaArt.validation.sizeBreakdown.entryHtmlBytes < 50_000, 'Meta index.html should stay slim (<50KB)');

    const applovinArt = result.artifacts.find((a) => a.channel === 'applovin');
    assert.ok(applovinArt);
    const html = await fs.readFile(applovinArt.outputPath, 'utf-8');
    assert.ok(html.includes('WebAssembly.instantiateStreaming'), 'Generic WASM interceptor should be injected');
    assert.ok(html.includes('function SafeURL'), 'SafeURL guard for blob:null AdWebViews should be injected');
    assert.ok(html.includes('OrigXHR.prototype.open'), 'XMLHttpRequest VFS interceptor should be injected');
    assert.ok(html.includes('loadBundle'), 'Cocos loadBundle downloader should be registered');
    assert.ok(html.includes('VideoPlayerImplManager'), 'Cocos VideoPlayerImplManager patch should be registered');
    assert.equal(/type:\s*['"]text\/javascript['"]/.test(html), false, 'Must not use JS Blob URLs for System.createScript');
  });

  it('activates pako compression on large compressible VFS and inflates cleanly in headless Chrome via XHR/fetch', async () => {
    const srcDir = path.join(tmpDir, 'large-vfs-game');
    const outDir = path.join(tmpDir, 'out-large-vfs');
    await fs.mkdir(srcDir, { recursive: true });

    const bigLevelData = JSON.stringify({
      title: 'Pako Inflated Level',
      tiles: Array.from({ length: 4000 }, (_, i) => ({ id: i, type: 'gold_coin', value: 10 }))
    });
    await fs.writeFile(path.join(srcDir, 'level-big.json'), bigLevelData, 'utf-8');

    await fs.writeFile(
      path.join(srcDir, 'index.html'),
      `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>html, body { margin: 0; width: 100%; height: 100%; background: #102040; color: #fff; }</style>
</head>
<body>
  <canvas id="c" width="390" height="400" style="width:100%;height:100%;display:block;"></canvas>
  <button id="cta" data-playable-cta style="position:fixed;bottom:20px;left:20px;padding:12px 24px;">Install</button>
  <script>
    window.playable.init({
      onStart: function () {
        var xhr = new XMLHttpRequest();
        xhr.responseType = 'json';
        xhr.onload = function () {
          var data = xhr.response;
          var ctx = document.getElementById('c').getContext('2d');
          ctx.fillStyle = '#183060';
          ctx.fillRect(0, 0, 390, 400);
          ctx.fillStyle = data && data.tiles && data.tiles.length === 4000 ? '#00e676' : '#ff1744';
          ctx.fillRect(50, 50, 290, 250);
          window.playable.ready();
        };
        xhr.open('GET', './level-big.json');
        xhr.send();
      }
    });
    document.getElementById('cta').addEventListener('click', function () {
      window.playable.cta();
    });
  </script>
</body>
</html>`
    );

    const hasBrowser = Boolean(detectBrowserExecutable());
    const result = await buildPlayable({
      inputPath: srcDir,
      outputDir: outDir,
      channels: ['applovin'],
      compress: true,
      validate: true,
      staticOnly: !hasBrowser
    });

    const art = result.artifacts[0];
    assert.equal(result.allValid, true);
    assert.ok(art.bytes < 60_000, `Expected pako-compressed single HTML < 60KB (raw JSON was ${bigLevelData.length}B), got ${art.bytes}B`);
    const html = await fs.readFile(art.outputPath, 'utf-8');
    assert.ok(html.includes('playable-pako-inflate'), 'pako inflate runtime should be embedded');
    assert.ok(html.includes('__PLAYABLE_VFS_ZIP__'), 'compressed VFS payload should be embedded');
  });

  it('optimizes large PNG assets offline via sharp without mutating source files', async () => {
    const srcDir = path.join(tmpDir, 'opt-image-game');
    const outDir = path.join(tmpDir, 'out-opt-image');
    await fs.mkdir(srcDir, { recursive: true });

    // Generate a 512x512 noisy RGBA PNG using sharp so it has substantial uncompressed entropy
    const sharpMod = await import('sharp');
    const sharp = sharpMod.default;
    const width = 512;
    const height = 512;
    const raw = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        raw[idx] = (x * 7 + y * 3) % 256;
        raw[idx + 1] = (x * 5 + y * 11) % 256;
        raw[idx + 2] = (x * 13 + y * 2) % 256;
        raw[idx + 3] = 255;
      }
    }
    const bigPng = await sharp(raw, { raw: { width, height, channels: 4 } })
      .png({ compressionLevel: 0 })
      .toBuffer();
    const imgPath = path.join(srcDir, 'hero.png');
    await fs.writeFile(imgPath, bigPng);
    await fs.writeFile(
      path.join(srcDir, 'index.html'),
      `<!DOCTYPE html><html><body><img src="./hero.png" /><button onclick="window.playable.cta()">Go</button></body></html>`
    );

    const dryRes = await optimizeDirectory({ inputDir: srcDir, dryRun: true, quality: 70, maxDimension: 256 });
    assert.equal(dryRes.summary.available, true);
    assert.equal(dryRes.summary.optimizedCount, 1);
    assert.ok(dryRes.summary.savedPercent > 50, `Expected >50% savings, got ${dryRes.summary.savedPercent}%`);

    const buildRes = await buildPlayable({
      inputPath: srcDir,
      outputDir: outDir,
      channels: ['applovin', 'google'],
      optimize: { quality: 70, maxDimension: 256 },
      validate: true,
      staticOnly: true
    });
    assert.equal(buildRes.allValid, true);
    assert.ok(buildRes.optimization && buildRes.optimization.savedBytes > 0);
    // Ensure source file on disk was NOT mutated
    const diskSizeAfter = (await fs.stat(imgPath)).size;
    assert.equal(diskSizeAfter, bigPng.byteLength);
  });
});
