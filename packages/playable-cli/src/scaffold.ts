import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export type ScaffoldTemplateId = 'canvas' | 'pixijs' | 'threejs';

export const SCAFFOLD_TEMPLATES: Array<{
  id: ScaffoldTemplateId;
  displayName: string;
  description: string;
}> = [
  {
    id: 'canvas',
    displayName: 'Vanilla HTML5 Canvas 2D',
    description: 'Zero-build, zero-dependency 2D Canvas playable with window.playable, __PLAYABLE_CONFIG__ variants, deferred Web Audio, and dual-orientation layout.'
  },
  {
    id: 'pixijs',
    displayName: 'PixiJS v8 + Vite',
    description: 'PixiJS v8 WebGL/Canvas playable starter with Vite relative bundling, window.playable lifecycle, responsive stage, and CTA button.'
  },
  {
    id: 'threejs',
    displayName: 'Three.js 3D + Vite',
    description: 'Three.js 3D interactive playable starter with raycast tap-to-collect, portrait/landscape camera adaptation, and window.playable integration.'
  }
];

export interface ScaffoldOptions {
  targetDir: string;
  template?: ScaffoldTemplateId;
  name?: string;
  force?: boolean;
}

export interface ScaffoldResult {
  targetDir: string;
  template: ScaffoldTemplateId;
  name: string;
  files: string[];
}

function sanitizePkgName(raw: string): string {
  return (raw || 'my-playable')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/^-+|-+$/g, '') || 'my-playable';
}

function buildConfigJson(inputPath: string, name: string): string {
  return `${JSON.stringify(
    {
      inputPath,
      outputDir: './playable-dist',
      engine: 'auto',
      packageName: name.replace(/[^a-zA-Z0-9_]/g, '_'),
      channels: ['applovin', 'unity', 'google', 'meta', 'tiktok', 'mintegral', 'moloco', 'liftoff'],
      orientation: 'auto',
      compress: true,
      encoding: 'auto',
      targetSize: 'auto',
      injectSdkBridge: true,
      storeUrls: {
        iosUrl: 'https://apps.apple.com/app/id0000000000',
        androidUrl: 'https://play.google.com/store/apps/details?id=com.example.playable'
      },
      variants: [
        {
          id: 'en_default',
          label: 'English Default',
          config: { lang: 'en', title: 'Tap to Collect!', ctaText: 'Install Now', targetScore: 3 }
        },
        {
          id: 'ja_default',
          label: 'Japanese Variant',
          config: { lang: 'ja', title: 'タップして集めよう！', ctaText: '今すぐダウンロード', targetScore: 3 }
        }
      ],
      validate: true
    },
    null,
    2
  )}\n`;
}

function buildCanvasFiles(name: string): Record<string, string> {
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover" />
  <title>${name}</title>
  <link rel="stylesheet" href="./style.css" />
</head>
<body>
  <canvas id="game"></canvas>
  <div class="hud">
    <div id="title" class="title">Tap to Collect!</div>
    <div id="score" class="score">0 / 3</div>
  </div>
  <button id="ctaBtn" class="cta" type="button" data-playable-cta>Install Now</button>
  <script src="./game.js"></script>
</body>
</html>
`;

  const styleCss = `* { box-sizing: border-box; user-select: none; -webkit-user-select: none; }
html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #0f172a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #f8fafc; }
#game { display: block; width: 100%; height: 100%; touch-action: none; }
.hud { position: fixed; top: 18px; left: 0; right: 0; text-align: center; pointer-events: none; z-index: 2; }
.title { font-size: clamp(18px, 4.5vw, 28px); font-weight: 800; text-shadow: 0 2px 10px rgba(0,0,0,0.45); }
.score { margin-top: 4px; font-size: 15px; color: #fde047; font-weight: 700; }
.cta { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 3; border: 0; border-radius: 999px; padding: 14px 32px; font-size: 17px; font-weight: 800; color: #fff; background: linear-gradient(135deg, #f97316, #ef4444); box-shadow: 0 10px 28px rgba(239,68,68,0.45); cursor: pointer; }
.cta:active { transform: translateX(-50%) scale(0.96); }
`;

  const gameJs = `(function () {
  var cfg = Object.assign(
    { title: 'Tap to Collect!', ctaText: 'Install Now', targetScore: 3, accentColor: '#fbbf24' },
    window.__PLAYABLE_CONFIG__ || {}
  );

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var titleEl = document.getElementById('title');
  var scoreEl = document.getElementById('score');
  var ctaBtn = document.getElementById('ctaBtn');

  titleEl.textContent = cfg.title;
  ctaBtn.textContent = cfg.ctaText;

  var width = window.innerWidth;
  var height = window.innerHeight;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var paused = false;
  var muted = false;
  var score = 0;
  var ended = false;
  var audioCtx = null;

  var orbs = [
    { nx: 0.28, ny: 0.42, r: 34, hit: false, phase: 0 },
    { nx: 0.72, ny: 0.46, r: 34, hit: false, phase: 2.1 },
    { nx: 0.50, ny: 0.62, r: 34, hit: false, phase: 4.2 }
  ];

  function playChime() {
    if (muted) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioCtx) audioCtx = new AC();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var osc = audioCtx.createOscillator();
      var gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520 + score * 110, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.14, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.16);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.16);
    } catch (_) {}
  }

  function resize(w, h) {
    width = w || window.innerWidth;
    height = h || window.innerHeight;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function updateScore() {
    scoreEl.textContent = score + ' / ' + cfg.targetScore;
    if (score >= cfg.targetScore && !ended) {
      ended = true;
      titleEl.textContent = 'Awesome!';
      if (window.playable) window.playable.gameEnd();
    }
  }

  canvas.addEventListener('pointerdown', function (ev) {
    var rect = canvas.getBoundingClientRect();
    var px = ev.clientX - rect.left;
    var py = ev.clientY - rect.top;
    for (var i = 0; i < orbs.length; i++) {
      var o = orbs[i];
      if (o.hit) continue;
      var ox = o.nx * width;
      var oy = o.ny * height;
      if (Math.hypot(px - ox, py - oy) <= o.r * 1.35) {
        o.hit = true;
        score += 1;
        playChime();
        updateScore();
        break;
      }
    }
  });

  ctaBtn.addEventListener('click', function () {
    if (window.playable) window.playable.cta();
  });

  function render(t) {
    if (!paused) {
      var grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      for (var i = 0; i < orbs.length; i++) {
        var o = orbs[i];
        if (o.hit) continue;
        var ox = o.nx * width;
        var oy = o.ny * height + Math.sin(t * 0.004 + o.phase) * 9;
        ctx.beginPath();
        ctx.arc(ox, oy, o.r, 0, Math.PI * 2);
        ctx.fillStyle = cfg.accentColor;
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#fef3c7';
        ctx.stroke();

        ctx.fillStyle = '#78350f';
        ctx.font = '800 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', ox, oy + 1);
      }
    }
    requestAnimationFrame(render);
  }

  function start() {
    resize(window.innerWidth, window.innerHeight);
    updateScore();
    requestAnimationFrame(render);
    if (window.playable) window.playable.ready();
  }

  if (window.playable && typeof window.playable.init === 'function') {
    window.playable.init({
      onStart: start,
      onPause: function () { paused = true; muted = true; },
      onResume: function () { paused = false; muted = false; },
      onMute: function (m) { muted = Boolean(m); },
      onResize: function (size) { resize(size.width, size.height); }
    });
  } else {
    window.addEventListener('resize', function () { resize(window.innerWidth, window.innerHeight); });
    start();
  }
})();
`;

  return {
    'src/index.html': indexHtml,
    'src/style.css': styleCss,
    'src/game.js': gameJs,
    'playable.config.json': buildConfigJson('./src', name)
  };
}

function buildPixiFiles(name: string): Record<string, string> {
  const pkgJson = `${JSON.stringify(
    {
      name,
      version: '0.1.0',
      private: true,
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        'build:playable': 'vite build && npx @ppgee/playable-cli build ./dist -o ./playable-dist --channel all --target-size auto --encoding auto --check --report ./playable-dist/report.html'
      },
      dependencies: {
        'pixi.js': '^8.6.0'
      },
      devDependencies: {
        vite: '^6.0.0'
      }
    },
    null,
    2
  )}\n`;

  const viteConfig = `import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    sourcemap: false
  }
});
`;

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover" />
  <title>${name}</title>
  <style>
    * { box-sizing: border-box; user-select: none; }
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #0f172a; }
    #ctaBtn { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 10; border: 0; border-radius: 999px; padding: 14px 32px; font: 800 17px/1 -apple-system,sans-serif; color: #fff; background: linear-gradient(135deg,#f97316,#ef4444); box-shadow: 0 10px 28px rgba(239,68,68,0.45); cursor: pointer; }
  </style>
</head>
<body>
  <button id="ctaBtn" type="button" data-playable-cta>Install Now</button>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
`;

  const mainJs = `import { Application, Graphics, Text } from 'pixi.js';

const cfg = Object.assign(
  { title: 'Tap Coins!', ctaText: 'Install Now', targetScore: 3 },
  window.__PLAYABLE_CONFIG__ || {}
);

const ctaBtn = document.getElementById('ctaBtn');
if (ctaBtn) {
  ctaBtn.textContent = cfg.ctaText;
  ctaBtn.addEventListener('click', () => window.playable?.cta());
}

async function boot() {
  const app = new Application();
  await app.init({
    background: '#111827',
    resizeTo: window,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true
  });
  document.body.prepend(app.canvas);

  let score = 0;
  const title = new Text({
    text: \`\${cfg.title} (0/\${cfg.targetScore})\`,
    style: { fill: '#f8fafc', fontSize: 24, fontWeight: '800', fontFamily: 'sans-serif' }
  });
  title.anchor.set(0.5, 0);
  app.stage.addChild(title);

  const coins = [
    { nx: 0.3, ny: 0.44 },
    { nx: 0.7, ny: 0.48 },
    { nx: 0.5, ny: 0.62 }
  ].map((pos, idx) => {
    const g = new Graphics().circle(0, 0, 34).fill('#fbbf24').stroke({ color: '#fef3c7', width: 4 });
    g.eventMode = 'static';
    g.cursor = 'pointer';
    g.on('pointerdown', () => {
      if (!g.visible) return;
      g.visible = false;
      score += 1;
      title.text = \`\${cfg.title} (\${score}/\${cfg.targetScore})\`;
      if (score >= cfg.targetScore) window.playable?.gameEnd();
    });
    app.stage.addChild(g);
    return { g, pos, phase: idx * 2 };
  });

  const layout = () => {
    const w = app.screen.width;
    const h = app.screen.height;
    title.position.set(w / 2, 24);
    coins.forEach((c) => c.g.position.set(c.pos.nx * w, c.pos.ny * h));
  };
  layout();

  let elapsed = 0;
  app.ticker.add((ticker) => {
    elapsed += ticker.deltaMS * 0.004;
    const h = app.screen.height;
    coins.forEach((c) => {
      if (c.g.visible) c.g.y = c.pos.ny * h + Math.sin(elapsed + c.phase) * 8;
    });
  });

  window.playable?.init({
    onStart: () => window.playable?.ready(),
    onPause: () => app.ticker.stop(),
    onResume: () => app.ticker.start(),
    onResize: () => layout()
  });
}

boot();
`;

  return {
    'package.json': pkgJson,
    'vite.config.js': viteConfig,
    'index.html': indexHtml,
    'src/main.js': mainJs,
    'playable.config.json': buildConfigJson('./dist', name)
  };
}

function buildThreeFiles(name: string): Record<string, string> {
  const pkgJson = `${JSON.stringify(
    {
      name,
      version: '0.1.0',
      private: true,
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        'build:playable': 'vite build && npx @ppgee/playable-cli build ./dist -o ./playable-dist --channel all --target-size auto --encoding auto --check --report ./playable-dist/report.html'
      },
      dependencies: {
        three: '^0.172.0'
      },
      devDependencies: {
        vite: '^6.0.0'
      }
    },
    null,
    2
  )}\n`;

  const viteConfig = `import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    sourcemap: false
  }
});
`;

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover" />
  <title>${name}</title>
  <style>
    * { box-sizing: border-box; user-select: none; }
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #0b1120; font-family: -apple-system,sans-serif; color: #f8fafc; }
    #hud { position: fixed; top: 18px; left: 0; right: 0; text-align: center; font-size: 22px; font-weight: 800; pointer-events: none; z-index: 2; }
    #ctaBtn { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 10; border: 0; border-radius: 999px; padding: 14px 32px; font: 800 17px/1 -apple-system,sans-serif; color: #fff; background: linear-gradient(135deg,#3b82f6,#6366f1); box-shadow: 0 10px 28px rgba(99,102,241,0.45); cursor: pointer; }
  </style>
</head>
<body>
  <div id="hud">Tap the 3D Gems! (0 / 3)</div>
  <button id="ctaBtn" type="button" data-playable-cta>Install Now</button>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
`;

  const mainJs = `import * as THREE from 'three';

const cfg = Object.assign(
  { title: 'Tap the 3D Gems!', ctaText: 'Install Now', targetScore: 3 },
  window.__PLAYABLE_CONFIG__ || {}
);

const hud = document.getElementById('hud');
const ctaBtn = document.getElementById('ctaBtn');
if (ctaBtn) {
  ctaBtn.textContent = cfg.ctaText;
  ctaBtn.addEventListener('click', () => window.playable?.cta());
}

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0f172a');

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / Math.max(1, window.innerHeight), 0.1, 100);
camera.position.set(0, 0, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.prepend(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
keyLight.position.set(3, 5, 4);
scene.add(keyLight);

const gemGeo = new THREE.OctahedronGeometry(0.68, 0);
const colors = [0x38bdf8, 0xfbbf24, 0xf472b6];
const gems = [-1.6, 0, 1.6].map((x, idx) => {
  const mesh = new THREE.Mesh(
    gemGeo,
    new THREE.MeshStandardMaterial({ color: colors[idx], metalness: 0.35, roughness: 0.25 })
  );
  mesh.position.set(x, idx === 1 ? -0.4 : 0.4, 0);
  scene.add(mesh);
  return mesh;
});

let score = 0;
let paused = false;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function syncHud() {
  if (hud) hud.textContent = \`\${cfg.title} (\${score} / \${cfg.targetScore})\`;
}
syncHud();

function resize(w = window.innerWidth, h = window.innerHeight) {
  camera.aspect = w / Math.max(1, h);
  camera.position.z = w < h ? 7.2 : 5.2;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

renderer.domElement.addEventListener('pointerdown', (ev) => {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(gems.filter((g) => g.visible));
  if (hits.length > 0) {
    hits[0].object.visible = false;
    score += 1;
    syncHud();
    if (score >= cfg.targetScore) window.playable?.gameEnd();
  }
});

function animate() {
  requestAnimationFrame(animate);
  if (paused) return;
  gems.forEach((g, idx) => {
    if (!g.visible) return;
    g.rotation.y += 0.02 + idx * 0.004;
    g.rotation.x += 0.01;
  });
  renderer.render(scene, camera);
}

function start() {
  resize();
  animate();
  window.playable?.ready();
}

if (window.playable?.init) {
  window.playable.init({
    onStart: start,
    onPause: () => { paused = true; },
    onResume: () => { paused = false; },
    onResize: ({ width, height }) => resize(width, height)
  });
} else {
  window.addEventListener('resize', () => resize());
  start();
}
`;

  return {
    'package.json': pkgJson,
    'vite.config.js': viteConfig,
    'index.html': indexHtml,
    'src/main.js': mainJs,
    'playable.config.json': buildConfigJson('./dist', name)
  };
}

export async function scaffoldPlayableProject(options: ScaffoldOptions): Promise<ScaffoldResult> {
  const template: ScaffoldTemplateId = options.template || 'canvas';
  if (!['canvas', 'pixijs', 'threejs'].includes(template)) {
    throw new Error(`Unsupported template "${template}". Choose one of: canvas, pixijs, threejs.`);
  }

  const targetDir = path.resolve(options.targetDir);
  if (existsSync(targetDir) && !options.force) {
    const existing = await fs.readdir(targetDir);
    if (existing.length > 0) {
      throw new Error(`Target directory "${targetDir}" is not empty. Pass --force to overwrite.`);
    }
  }

  const name = sanitizePkgName(options.name || path.basename(targetDir));
  const filesMap =
    template === 'pixijs'
      ? buildPixiFiles(name)
      : template === 'threejs'
        ? buildThreeFiles(name)
        : buildCanvasFiles(name);

  await fs.mkdir(targetDir, { recursive: true });
  const written: string[] = [];
  for (const [relPath, content] of Object.entries(filesMap)) {
    const absPath = path.join(targetDir, relPath);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, content, 'utf-8');
    written.push(relPath);
  }

  return {
    targetDir,
    template,
    name,
    files: written
  };
}
