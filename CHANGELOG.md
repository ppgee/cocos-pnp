# Changelog

All notable changes to `cocos-pnp` are documented in this file.

## [2.0.0-alpha.0] - 2026-11-25

### Added
- **Engine-Agnostic v2 Toolchain (`@cocos-pnp/playable-sdk`, `@cocos-pnp/playable-validator`, `@cocos-pnp/playable-core`, `@cocos-pnp/playable-cli`)**:
  - **Unified Runtime SDK (`@cocos-pnp/playable-sdk`)**: Zero-dependency `<2KB` channel-isolated bridge (`window.playable.init/ready/gameEnd/complete/cta/isMuted`) with zero `mraid` leaks on non-MRAID networks.
  - **2026 8-Channel Spec & Dual-Layer Validator (`@cocos-pnp/playable-validator`)**: Static compliance + size/Base64 attribution + Playwright headless Chrome runtime checks (portrait & landscape blank-screen detection, external request blocking, pre-interaction audio probe, live CTA trigger verification, optional JPEG screenshot capture).
  - **Official Ad Network Validator Calibration**: Verified live against official validators for AppLovin, Google Ads App Campaigns (`ad.orientation` vs `ad.size` mutual exclusion), Mintegral / Playturbo (`[a-zA-Z0-9_]` naming), and Liftoff Accelerate (`mraid.open` + no `<iframe>`).
  - **Pluggable Engine Core (`@cocos-pnp/playable-core`)**: 7-entry browser VFS shim (`SafeURL`, `fetch`, `XMLHttpRequest`, `WebAssembly.instantiateStreaming`, `Image.src`, `Audio/Media.src`, `FontFace`), 6 built-in auto-detected adapters (`cocos-3x`, `cocos-2x`, `playcanvas`, `godot-4`, `unity-webgl`, `generic-web`) + custom `EngineAdapter` plugin API, slim-ZIP externalizer, `playable.config.json` + legacy `.adapterrc` loader, and lossless **Base122** VFS encoding (~14% smaller than Base64).
  - **Full Offline Asset Optimizer & 4-Tier Size Budget Engine**: `sharp` PNG8/MozJPEG image compression, local `ffmpeg` audio/video transcoding (with H.264 Baseline + `-movflags +faststart` `moov`-first), `subset-font` HarfBuzz WASM font subsetting, `svgo` SVG optimization + optional raster-to-SVG icon vectorization, `esbuild` ES module tree-shaking & JS/CSS minification, JSON minification, and deterministic multi-pass `--target-size` auto-escalation.
  - **CLI, Interactive Preview Workbench, Offline HTML Audit Report & MCP Server (`@cocos-pnp/playable-cli`)**:
    - Commands: `build`, `check`, `preview`, `optimize`, `specs`, `engines`, `init`, `mcp`.
    - Interactive local preview workbench with 8-network selector, portrait/landscape/tablet viewports, mute/viewable toggles, tabbed live events / static compliance / size breakdown panels, and one-click HTML report export.
    - Self-contained offline HTML compliance & size audit report (`--report`) with embedded portrait & landscape runtime screenshots.
    - Standard stdio JSON-RPC 2.0 MCP Server exposing `get_channel_specs`, `build_playable`, `optimize_playable_assets`, `check_playable`, and `inspect_playable_size`, plus Agent Skill at `skills/playable-ads-workflow/SKILL.md`.
- **CI & Pre-Publish Verification**:
  - `.github/workflows/ci-v2.yml`: Full v2 test suite, `pnpm run pack:check` tarball verification, 8-channel Step Summary, and automated `playable-audit-report` artifact archival.
  - `.github/workflows/release-v2.yml`: Tag (`v2.*`) and manual dry-run npm publish workflow with provenance.

### Fixed (Legacy v1 `playable-adapter-core`)
- Replaced `URL.createObjectURL(blob)` in Cocos 3.x `System.createScript` with inline `<script>` to prevent strict CSP black screens on Google Ads / Meta (#16, #18, #26, #33, #35).
- Added `SafeURL` wrapper and generic `.wasm` matching for `blob:null` AdWebViews (#22, #23, #32).
- Fixed MD5 cache `settings.<hash>.json` and `import-map.<hash>.json` matching (#47).
- Replaced `Promise.all` with `Promise.allSettled` in TinyPNG helper to prevent single-image errors from aborting the batch (#27).
