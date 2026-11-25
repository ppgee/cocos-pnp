# 2026 主流试玩广告平台（Playable Ads）技术规范参考

本文档是 `@ppgee/playable-validator` 与后续 `@ppgee/playable-core` 共用的 8 大核心出海买量渠道规范基线（校准时间：2026-11）。

---

## 一、8 大渠道核心规范总览

| 渠道 | 接受格式 | 体积上限 | 文件数 / 命名 / 后缀限制 | MRAID 政策 | 必选 CTA API | 关键生命周期与特殊要求 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **AppLovin** (`applovin`) | 仅单 HTML | <= 5 MB（建议 2-4 MB） | 零外链，全资源内联 | 必选（v2.0） | `mraid.open()` | 必须支持横竖屏；等 `mraid` ready；禁止首触即跳；交互前静音 |
| **Unity Ads / LevelPlay** (`unity`) | 仅单 HTML | <= 5 MB（建议 <= 4 MB） | 零外链，全资源内联 | 必选（v3.0，兼容 2.0） | `mraid.open()` | ironSource 直投已于 2026-04 并入 LevelPlay，**弃用旧版 DAPI**；需等 `ready` + `viewableChange` 才启游戏/音频；必须支持横竖屏 |
| **Google Ads** (`google`) | 仅 ZIP | <= 5 MB | <= 512 文件；根目录 `index.html`；相对路径；**仅允许 html/css/js/png/jpg/jpeg/gif/svg** | 禁止 | `ExitApi.exit()` | 必须含 `<meta name="ad.orientation">` **或** `<meta name="ad.size">`（**二者不可同时输出**，否则官方 Validator 报 `Ad Dimensions` 错误）；需引入官方 `exitapi.js`；严格 CSP；音频/字体/WASM 需内联 |
| **Meta** (`meta`, `facebook`) | 单 HTML 或 ZIP | 单 HTML <= 2 MB；ZIP <= 5 MB 且 **ZIP 内 `index.html` 仍须 <= 2 MB** | ZIP <= 100 文件；根目录 `index.html` | 禁止 | `FbPlayableAd.onCTAClick()`（**无参**） | 禁止 `mraid.js`、零外链、禁止 `window.open`/`location` 原生跳转 |
| **TikTok / Pangle** (`tiktok`, `pangle`) | 仅 ZIP | <= 5 MB | 根目录 `index.html` + `config.json`（禁止嵌套目录） | 禁止 | `window.openAppStore()` | 必须引入 `playable-sdk.js`；`config.json` 需含 `playable_orientation`（`0` 双屏 / `1` 竖屏推荐 / `2` 横屏）；禁止硬编码跳转 |
| **Mintegral** (`mintegral`, `mtg`) | ZIP（推荐）或单 HTML | <= 5 MB | 经典同名结构 `<name>.zip -> <name>/<name>.html`，或根目录 `index.html`；**名称仅允许字母、数字和下划线（禁止 `-`）** | 禁止 | `window.install()` | 必须调用 `window.gameReady()`（加载完成）和 `window.gameEnd()`（游玩结束）；建议定义 `window.gameStart` / `window.gameClose` |
| **Moloco** (`moloco`) | 仅单 HTML | <= 5 MB | 零外链，全资源内联；拒收 ZIP | 禁止 | `FbPlayableAd.onCTAClick()`（**无参**） | 禁止 `mraid.js` 和原生 JS 跳转；必须支持横竖屏 |
| **Liftoff / Vungle** (`liftoff`, `vungle`) | ZIP（推荐）或单 HTML | <= 5 MB | 根目录 `index.html` 或 `ad.html`；**所有路径仅小写 ASCII 且无空格**；仅相对路径；**禁止 `<iframe>`** | 可选 | `mraid.open()`（Accelerate DSP 优先）+ `parent.postMessage('download', '*')`（Vungle/Monetize） | 真实游玩完成后发 `parent.postMessage('complete', '*')`（禁止绑定在点击上）；监听 `ad-event-pause` / `ad-event-resume` |

---

## 二、已落地自动化校验覆盖度

通过 `pnpm playable check <artifact> --channel <list>` 自动执行两层体检：

1. **静态合规与体积归因体检**（[static-checker.ts](../packages/playable-validator/src/static-checker.ts)、[archive.ts](../packages/playable-validator/src/archive.ts)）：
   - 交付格式匹配、ZIP 入口结构（标准根目录 / Liftoff `ad.html` / Mintegral 同名目录）；
   - 总包体积上限、Meta ZIP 内部 `index.html <= 2MB` 二次校验、文件数上限（Google 512 / Meta 100）、Base64 膨胀开销与 Top-N 体积归因；
   - Google 允许文件后缀白名单、根绝对路径检查、Liftoff 小写 ASCII 路径命名检查；
   - TikTok `config.json` 与 `playable-sdk.js`、Google `ad.orientation`/`ad.size`/`exitapi.js`、Mintegral `gameReady`/`gameEnd`、MRAID 冲突与旧版 ironSource DAPI 弃用告警、原生 JS 跳转禁止检查、静态外链与未静音 `autoplay` 标签扫描。
2. **Playwright 无头浏览器运行时体检**（[runtime-checker.ts](../packages/playable-validator/src/runtime-checker.ts)）：
   - 内存本地 HTTP Server + 8 渠道隔离 Mock 宿主环境（`mraid` / `ExitApi` / `FbPlayableAd` / `openAppStore` / `gameReady+install` / `postMessage`）；
   - 实时拦截所有非白名单外部网络请求；
   - 捕获未捕获异常、Console Error、首屏纯色黑屏检测；
   - 针对 AppLovin / Unity / Moloco 自动执行 **竖屏 + 横屏双视口渲染校验**；
   - 劫持 `HTMLMediaElement.play` 与 Web Audio API，精准区分“交互前自动出声（违规）”与“交互后出声”；
   - 自动/指定选择器点击验证目标渠道 CTA 回调是否真实触发。

---

## 三、仍需实测校准的“后台暗规则”清单

公开文档无法覆盖所有平台上传后台的私有校验细节。在发布正式版本前，建议用真实试玩包在以下官方免费校验器做一次交叉核验并回写规则库：

1. **Google Ads HTML5 Validator**：确认内联 Base64 音频/WASM 在最新 CSP 下的通过情况。
2. **Meta Playable Preview Tool**：确认 ZIP 包多 JS 文件加载在 iOS/Android 容器中的表现及 3 秒互动提示。
3. **AppLovin Playable Preview & Unity LevelPlay Test App**：确认真机 MRAID `viewableChange` 切后台静音恢复和横竖屏切换安全区。
4. **TikTok Playable Preview**：核对 `playable-sdk.js` 最新官方 CDN 路径及白名单。
5. **Mindworks / Playturbo Reviewer (Mintegral)**：核对单 HTML 与同名 ZIP 两种结构的最新上传通过率。
