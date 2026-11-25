# Changelog

All notable changes to `cocos-pnp` are documented in this file.

## [2.0.0] - 2026-11-25

First stable release of the `cocos-pnp` v2 multi-network Playable Ads toolchain (`@ppgee/playable-cli`, `@ppgee/playable-core`, `@ppgee/playable-validator`, `@ppgee/playable-sdk`), alongside maintained Cocos Creator 2.x/3.x editor plugins (`playable-2x.zip`, `playable-3x.zip`).

### Added
- **Multi-Variant Matrix Packaging (`--variants` & `playable.config.json` `variants`)**:
  - Build one playable across multiple languages, difficulty presets, or CTA configurations (`window.__PLAYABLE_CONFIG__` / `window.__PLAYABLE_VARIANT__`) × all 8 ad networks in a single pass, sharing asset optimization and generating a unified multi-variant HTML audit report.
- **LAN Real-Device QR Code Preview (`playable preview --lan`)**:
  - Zero-dependency ISO/IEC 18004 QR code generator rendering both terminal QR codes and a `Phone QR` modal (`/api/qr.svg`) in the Preview Workbench, with standalone mobile fullscreen CTA/error toast notifications.
- **Starter Project Scaffolding (`playable create`)**:
  - Ready-to-build templates for Vanilla HTML5 `canvas`, `pixijs` (v8 + Vite), and `threejs` (3D + Vite) wired to `window.playable` and multi-variant `playable.config.json`.
- **Cocos Creator 3.x Lightweight v2 CLI Bridge (`useV2Cli`)**:
  - Setting `"useV2Cli": true` in `.adapterrc` allows `playable-3x.zip` to invoke `@ppgee/playable-cli` automatically after Cocos Creator builds without bundling platform-specific native binaries.
- **Documentation & Showcase**:
  - Practical, plain-language English & Chinese READMEs with setup paths by engine, embedded audit report & preview workbench screenshots, and `npx` quick-start commands.

### Fixed
- **Preview Workbench `<script>` Escaping**: Escaped `<`, `>`, `\u2028`, and `\u2029` in embedded workbench JSON so diagnostics containing `</script>` never terminate the workbench script tag.
- **Google Ads ZIP CSS & Media Asset Inlining**: Rewrote CSS `url(...)` inside `<style>` / `.css` files and static HTML media `src` attributes when Google's extension whitelist moves non-whitelisted files (such as `.ttf`, `.woff2`, `.webp`, `.wav`) into the inline VFS, eliminating runtime 404s.
- **Security & Dependency Hygiene**: Upgraded `sharp` (`^0.35.5`), `axios` (`^1.21.1`), `rollup` (`^2.80.0`), and transitive dev overrides, bringing `pnpm audit` from 64 alerts down to **0 vulnerabilities**.

---

## [2.0.0-alpha.0] - 2026-11-25

### Added
- **Engine-Agnostic v2 Toolchain (`@ppgee/playable-sdk`, `@ppgee/playable-validator`, `@ppgee/playable-core`, `@ppgee/playable-cli`)**:
  - **Unified Runtime SDK (`@ppgee/playable-sdk`)**: Zero-dependency `<2KB` channel-isolated bridge (`window.playable.init/ready/gameEnd/complete/cta/isMuted`) with zero `mraid` leaks on non-MRAID networks.
  - **2026 8-Channel Spec & Dual-Layer Validator (`@ppgee/playable-validator`)**: Static compliance + size/Base64 attribution + Playwright headless Chrome runtime checks (portrait & landscape blank-screen detection, external request blocking, pre-interaction audio probe, live CTA trigger verification, optional JPEG screenshot capture).
  - **Official Ad Network Validator Calibration**: Verified live against official validators for AppLovin, Google Ads App Campaigns (`ad.orientation` vs `ad.size` mutual exclusion), Mintegral / Playturbo (`[a-zA-Z0-9_]` naming), and Liftoff Accelerate (`mraid.open` + no `<iframe>`).
  - **Pluggable Engine Core (`@ppgee/playable-core`)**: 7-entry browser VFS shim (`SafeURL`, `fetch`, `XMLHttpRequest`, `WebAssembly.instantiateStreaming`, `Image.src`, `Audio/Media.src`, `FontFace`), 6 built-in auto-detected adapters (`cocos-3x`, `cocos-2x`, `playcanvas`, `godot-4`, `unity-webgl`, `generic-web`) + custom `EngineAdapter` plugin API, slim-ZIP externalizer, `playable.config.json` + legacy `.adapterrc` loader, and lossless **Base122** VFS encoding (~14% smaller than Base64).
  - **Full Offline Asset Optimizer & 4-Tier Size Budget Engine**: `sharp` PNG8/MozJPEG image compression, local `ffmpeg` audio/video transcoding (with H.264 Baseline + `-movflags +faststart` `moov`-first), `subset-font` HarfBuzz WASM font subsetting, `svgo` SVG optimization + optional raster-to-SVG icon vectorization, `esbuild` ES module tree-shaking & JS/CSS minification, JSON minification, and deterministic multi-pass `--target-size` auto-escalation.
  - **CLI, Interactive Preview Workbench, Offline HTML Audit Report & MCP Server (`@ppgee/playable-cli`)**:
    - Commands: `build`, `check`, `preview`, `optimize`, `specs`, `engines`, `init`, `mcp`.
    - Interactive local preview workbench with 8-network selector, portrait/landscape/tablet viewports, mute/viewable toggles, tabbed live events / static compliance / size breakdown panels, and one-click HTML report export.
    - Self-contained offline HTML compliance & size audit report (`--report`) with embedded portrait & landscape runtime screenshots.
    - Standard stdio JSON-RPC 2.0 MCP Server exposing `get_channel_specs`, `build_playable`, `optimize_playable_assets`, `check_playable`, and `inspect_playable_size`, plus Agent Skill at `skills/playable-ads-workflow/SKILL.md`.
- **CI & Pre-Publish Verification**:
  - `.github/workflows/ci-v2.yml`: Full v2 test suite, `pnpm run pack:check` tarball verification, 8-channel Step Summary, and automated `playable-audit-report` artifact archival.
  - `.github/workflows/release-v2.yml`: Tag (`v2.*`) and manual dry-run npm publish workflow with provenance and `playable-2x.zip` / `playable-3x.zip` release asset attachment.

### Fixed (Legacy v1 `playable-adapter-core`)
- Replaced `URL.createObjectURL(blob)` in Cocos 3.x `System.createScript` with inline `<script>` to prevent strict CSP black screens on Google Ads / Meta (#16, #18, #26, #33, #35).
- Added `SafeURL` wrapper and generic `.wasm` matching for `blob:null` AdWebViews (#22, #23, #32).
- Fixed MD5 cache `settings.<hash>.json` and `import-map.<hash>.json` matching (#47).
- Replaced `Promise.all` with `Promise.allSettled` in TinyPNG helper to prevent single-image errors from aborting the batch (#27).
