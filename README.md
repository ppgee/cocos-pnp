# cocos-pnp v2 — HTML5 & Cocos Playable Ads Packager, Validator & MCP Toolchain

[中文文档](./README-CN.md)

**An engine-agnostic multi-network Playable Ads packager, size analyzer, and headless-browser compliance validator for HTML5 (Vite, PixiJS, Three.js, AI-generated H5) and Cocos Creator 3.x builds.**

Write your playable once, build submission-ready `.html` / `.zip` packages for **8 major ad networks (2026 specs)** in a single command, and automatically verify every artifact in headless Chrome (portrait & landscape blank-screen detection, unauthorized external request blocking, pre-interaction audio detection, and live CTA trigger verification). Includes a built-in **MCP Server** and **Agent Skill** for autonomous AI Coding Agent workflows.

---

## Highlights

1. **8 Major Ad Networks Aligned with 2026 Specs** (see [docs/channel-specs-2026.md](./docs/channel-specs-2026.md))
   - `AppLovin`, `Unity Ads / LevelPlay` (migrated from sunset ironSource DAPI), `Google Ads`, `Meta (Facebook)`, `TikTok / Pangle`, `Mintegral`, `Moloco`, and `Liftoff / Vungle`.
2. **Static + Headless Chrome Runtime Validation (`@cocos-pnp/playable-validator`)**
   - Automatically reuses your locally installed Chrome/Chromium/Edge (no 300MB browser download required), with `--static-only` for zero-browser CI fast checks.
   - Audits size ceilings (including Meta's `index.html <= 2 MB` inside 5 MB ZIP & 100-file limit), Google's allowed extension whitelist, TikTok `config.json` & `playable-sdk.js`, Mintegral matching-folder layout & `gameReady`/`gameEnd`, Liftoff lowercase ASCII path naming, and inline Base64 overhead attribution.
   - Verifies runtime behavior in mocked network hosts: uncaught exceptions, console errors, blocked external requests, portrait + landscape dual-orientation rendering, pre-interaction audio playback, and CTA API invocation.
3. **Engine-Agnostic Core + Pluggable `EngineAdapter` + Zero-Leak Runtime SDK (`@cocos-pnp/playable-core` + `@cocos-pnp/playable-sdk`)**
   - Shared 7-entry browser VFS shim (`SafeURL`, `fetch`, `XMLHttpRequest`, `WebAssembly.instantiateStreaming`, `Image.src`, `Audio/Media.src`, `FontFace`);
   - 6 built-in auto-detected engine adapters (`cocos-3x`, `cocos-2x`, `playcanvas`, `godot-4`, `unity-webgl`, and `generic-web` for Vite/PixiJS/Three.js/Phaser/AI H5), plus custom adapter plugin registration via `options.adapters`;
   - Native `playable.config.json` support with transparent fallback for legacy v1 `.adapterrc` files;
   - Channel-isolated bridge generation guarantees zero `mraid` references on non-MRAID networks (Google, Meta, TikTok, Mintegral, Moloco);
   - Net-benefit `pako` deflate compression and slim-ZIP externalization to stay under Meta/Google/Liftoff caps.
4. **AI Agent Ready (CLI + MCP Server + Skill)**
   - `--json` output across all CLI commands;
   - `playable mcp` runs a zero-dependency stdio MCP Server exposing `get_channel_specs`, `build_playable`, `check_playable`, and `inspect_playable_size`;
   - Reusable Agent Skill at [skills/playable-ads-workflow/SKILL.md](./skills/playable-ads-workflow/SKILL.md).

---

## Supported Ad Networks (2026 Baseline)

| Network | Format | Size Ceiling | MRAID | CTA API | Key Constraints |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **AppLovin** (`applovin`) | Single HTML | <= 5 MB | Required v2.0 | `mraid.open()` | Zero external requests; dual orientation |
| **Unity / LevelPlay** (`unity`) | Single HTML | <= 5 MB | Required v3.0 | `mraid.open()` | Legacy ironSource DAPI deprecated; `ready` + `viewableChange` gating; dual orientation |
| **Google Ads** (`google`) | ZIP | <= 5 MB | Forbidden | `ExitApi.exit()` | <= 512 files; `ad.orientation` **or** `ad.size` (never both) + `exitapi.js`; strict extension whitelist |
| **Meta** (`meta`, `facebook`) | ZIP / Single HTML | ZIP <= 5 MB & `index.html` <= 2 MB | Forbidden | `FbPlayableAd.onCTAClick()` | <= 100 files; zero-arg CTA; no raw JS redirects |
| **TikTok / Pangle** (`tiktok`, `pangle`) | ZIP | <= 5 MB | Forbidden | `window.openAppStore()` | Root `index.html` + `config.json`; `playable-sdk.js` required |
| **Mintegral** (`mintegral`, `mtg`) | ZIP / Single HTML | <= 5 MB | Forbidden | `window.install()` | Classic `<name>.zip -> <name>/<name>.html` (`[a-zA-Z0-9_]` only); `gameReady()` & `gameEnd()` required |
| **Moloco** (`moloco`) | Single HTML | <= 5 MB | Forbidden | `FbPlayableAd.onCTAClick()` | Rejects ZIP; zero-arg CTA; dual orientation |
| **Liftoff / Vungle** (`liftoff`, `vungle`) | ZIP / Single HTML | <= 5 MB | Optional | `mraid.open()` + `postMessage('download')` | Root `index.html`/`ad.html`; lowercase ASCII paths; no `<iframe>`; `complete` lifecycle |

---

## Quick Start

Requirements: Node.js `>= 20` (recommended `22+`) and `pnpm >= 9`. For headless runtime checks, a local Chrome/Chromium/Edge binary is auto-detected (or pass `--browser-path`).

```bash
# 1. Install dependencies & build v2 packages
pnpm install
pnpm run build:v2

# 2. Build the included playable demo for all 8 networks (with --target-size auto, --encoding auto/base122 ~14% lossless payload savings, and --report offline HTML audit report with screenshots)
pnpm playable build examples/mini-playable -o ./playable-dist --channel all --target-size auto --encoding auto --check --report ./playable-dist/report.html

# 3. Launch the interactive 8-network local preview workbench (portrait/landscape/mute/viewable/CTA monitor)
pnpm playable preview ./playable-dist/AppLovin.html --channel applovin

# 4. Run offline full-asset optimization (sharp images + ffmpeg audio/video with MP4 faststart + HarfBuzz font subsetting + SVGO / icon vectorization + esbuild JS tree-shaking & minification)
pnpm playable optimize ./your-dist --target-size 4MB --vectorize-icons --dry-run

# 5. Validate any existing .html, .zip, or build directory
pnpm playable check ./playable-dist/Google.zip --channel google
pnpm playable check ./build/web-mobile --channel applovin,unity --static-only

# 6. Inspect 2026 network specs, built-in engine adapters, or scaffold playable.config.json
pnpm playable specs
pnpm playable engines
pnpm playable init
```

### Unified Runtime SDK Example

No channel `if/else` branches needed in game code (full example in [examples/mini-playable/game.js](./examples/mini-playable/game.js)):

```js
window.playable.init({
  onStart: () => {
    startGame();
    window.playable.ready();
  },
  onPause: () => pauseAudioAndLoop(),
  onResume: () => resumeAudioAndLoop(),
  onResize: ({ width, height }) => resizeCanvas(width, height)
});

// Call when the playable loop finishes (required by Mintegral & Liftoff)
window.playable.gameEnd();

// Call on explicit CTA click (mark button with data-playable-cta for automated runtime verification)
ctaButton.addEventListener('click', () => {
  window.playable.cta();
});
```

---

## MCP Server Setup (for Claude / Cursor / Antigravity / Codex)

```json
{
  "mcpServers": {
    "cocos-pnp-playable": {
      "command": "node",
      "args": ["/absolute/path/to/cocos-pnp/packages/playable-cli/dist/cli.js", "mcp"]
    }
  }
}
```

Exposed tools: `get_channel_specs`, `build_playable`, `optimize_playable_assets`, `check_playable`, and `inspect_playable_size`.

---

## Running Tests

```bash
pnpm run test:v2
```

---

## Legacy v1 Cocos Creator Editor Plugin

- **Migration guide (v1 -> v2)**: [docs/v2-migration.md](./docs/v2-migration.md)
- **Legacy v1 plugin downloads** (Cocos Creator 2.4.x / 3.8.2): [GitHub Releases](https://github.com/ppgee/cocos-pnp/releases?q=playable-ads-adapter&expanded=true)
- `packages/playable-adapter-core` and `packages/playable-ads-adapter` remain untouched for legacy 2.x/3.x editor workflows. For Cocos 3.8.5+ and new projects, use the v2 CLI directly on your `web-mobile` output.

### [Contributors](https://github.com/ppgee/cocos-pnp/graphs/contributors)

<a href="https://github.com/ppgee/cocos-pnp/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=ppgee/cocos-pnp" />
</a>
