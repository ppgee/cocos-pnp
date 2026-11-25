# 从 v1（Cocos 编辑器插件）迁移到 v2（通用 CLI / SDK / 体检 / MCP）

## 为什么要升级到 v2？

- **2026 渠道规范更新**：ironSource 直投已于 2026-04 关停并合并至 Unity LevelPlay（MRAID v3.0），Google Ads 要求 ZIP + 后缀白名单，Meta 要求 ZIP 内 `index.html <= 2MB` 且 `<= 100` 文件，Moloco 禁止 MRAID 并走 `FbPlayableAd.onCTAClick()`。
- **引擎无关 + Cocos 3.8.5+ 兼容**：摆脱 Cocos 编辑器 Electron 环境限制，同时支持普通 Web/Vite/PixiJS/Three.js、AI 生成 H5 与 Cocos Creator 3.8.x（通用 `.wasm` 拦截）。
- **新增无头真跑验包与 AI Agent 闭环**：打包后自动通过本机 Chrome 运行时检测黑屏、横竖屏崩坏、外链拦截、交互前出声与 CTA 触发，并原生支持 MCP Server。

---

## v1 用户如何平滑迁移？

### 1. 继续保留 v1 插件（Cocos 2.x 存量项目）
原有 `packages/playable-adapter-core` 与 `packages/playable-ads-adapter` 完整保留在仓库中，未做破坏性改动，Cocos 2.4.x 存量项目可继续按原方式使用。

### 2. Cocos 3.x / 4.0 项目切到 v2 CLI（推荐）
在 Cocos Creator 正常导出 `web-mobile` 构建目录后，直接运行：

```bash
pnpm playable build ./build/web-mobile -o ./playable-dist --channel all --check
```

- **占位符完全兼容**：代码里已有的 `'{{__adv_channels_adapter__}}'` 继续生效（同时支持新版 `'{{__playable_channel__}}'`）。
- **逐步替换手写渠道判断**：新项目建议改用统一 `window.playable` API（由 `@cocos-pnp/playable-sdk` 自动按渠道零残留注入）：
  - `window.playable.init({ onStart, onPause, onResume, onResize })`
  - `window.playable.ready()`
  - `window.playable.gameEnd()`
  - `window.playable.cta()`
- **已弃用渠道映射**：传入 `--channel ironsource` 会自动映射到 `unity`（MRAID v3.0）并给出弃用提示；`facebook` 映射到 `meta`；`pangle` 映射到 `tiktok`；`vungle` 映射到 `liftoff`。

### 3. `.adapterrc` 配置对照表

| v1 `.adapterrc` 字段 | v2 CLI 参数 / `buildPlayable` 选项 |
| :--- | :--- |
| `exportChannels` | `--channel applovin,unity,google,...` / `channels` |
| `orientation` | `--orientation portrait\|landscape\|auto` / `orientation` |
| `enableSplash: false` | `disableSplash: true`（API 选项） |
| `injectOptions` | `injectOptions`（API 选项，保持按渠道 `head`/`body`/`sdkScript` 兼容） |
| `tinify` | v2 不再强绑付费 TinyPNG；ZIP 渠道默认保留原始二进制避免 Base64 膨胀，同时提供 `inspect_playable_size` 定位 Top-N 大文件 |
