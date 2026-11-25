---
name: playable-ads-workflow
description: Build, package, and validate HTML5/Cocos Playable Ads for all 8 major ad networks (AppLovin, Unity LevelPlay, Google Ads, Meta, TikTok/Pangle, Mintegral, Moloco, Liftoff/Vungle) using @cocos-pnp/playable-cli and its MCP server.
---

# Playable Ads Build & Compliance Workflow

Use this skill whenever creating, packaging, debugging, or validating an HTML5 or Cocos Creator Playable Ad for mobile user acquisition networks.

## Golden Rules Before Writing Code

1. **Query specs first**: Call MCP tool `get_channel_specs` (or run `playable specs`) before authoring code so you know target size limits, formats, and forbidden APIs.
2. **Never hardcode per-network CTA branches**: Call the unified global bridge injected at build time:
   - `window.playable.init({ onStart, onPause, onResume, onMuteChange, onResize })`
   - `window.playable.ready()` right after initial render/assets load
   - `window.playable.gameEnd()` when the gameplay loop finishes
   - `window.playable.cta()` on explicit CTA button click (mark the CTA element with `data-playable-cta`)
3. **Never touch forbidden APIs**:
   - Do NOT reference `mraid.js` / `mraid.*` in shared source code (injected only for AppLovin/Unity).
   - Do NOT use `window.open()` or `location.href` redirects.
   - Do NOT load external CDNs, remote fonts, or remote APIs at runtime.
   - Do NOT play audio or resume `AudioContext` before the first user pointer/touch/click interaction.
4. **Support both portrait and landscape**: Handle `window.resize` cleanly so the playable renders properly at both `390x844` and `844x390`.
5. **Use lowercase ASCII relative paths**: Keep all asset paths lowercase ASCII without spaces (e.g. `./assets/hero.png`), never root-absolute (`/assets/hero.png`).

## Automated Build -> Check -> Fix Loop

1. **Build for target channels**:
   - Via MCP: call `build_playable` with `{ inputPath, outputDir, channels: ["all"], validate: true }`
   - Via CLI: `pnpm playable build <inputDir> -o <outputDir> --channel all --check --json`
2. **Inspect failures**:
   - Read every `error` diagnostic (`code`, `message`, `suggestion`, `details`) from the JSON report.
   - If `SIZE_LIMIT_EXCEEDED` or `SIZE_ENTRY_HTML_EXCEEDED`: call `inspect_playable_size` (or check `sizeBreakdown.topContributors`), then re-run `build_playable` with `{ targetSize: "auto" }` (or call `optimize_playable_assets` with `targetSize` / `stripVideoAudio: true` / `vectorizeIcons: true` / `fontSubsetChars`) to automatically compress images (sharp), transcode audio/video (ffmpeg + MP4 faststart), subset fonts (HarfBuzz), optimize/vectorize SVGs (SVGO), and tree-shake/minify JS & CSS (esbuild).
   - If `RENDER_BLANK_SCREEN` or `RENDER_LANDSCAPE_BLANK_SCREEN`: inspect canvas sizing/resize logic and initialization order.
   - If `NET_EXTERNAL_REQUEST_RUNTIME` or `NET_EXTERNAL_URL_STATIC`: bundle the flagged resource locally.
   - If `AUDIO_PLAYED_BEFORE_INTERACTION`: move audio playback strictly inside user gesture handlers.
3. **Re-run until green**:
   - Repeat `build_playable` + `check_playable` until every target channel reports `passed: true` with `errorCount: 0`.
