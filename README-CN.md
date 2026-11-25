# cocos-pnp v2 — HTML5 & Cocos 试玩广告打包、合规体检与 MCP 工具链

[English Documentation](./README.md)

**面向全引擎（Web / Vite / PixiJS / Three.js / AI 生成 H5 / Cocos Creator 3.x）的试玩广告（Playable Ads）多渠道打包、体积归因与无头浏览器合规体检工具链。**

一次编写业务逻辑，一键产出符合 **2026 八大主流海外买量平台规范**的投放包，并自动通过本机 Chrome 无头真跑验收（双视口防黑屏、外链拦截、交互前出声检测、CTA 回调触发验证）。内置标准 **MCP Server** 与 **Agent Skill**，让 AI Coding Agent 直接跑通“生成试玩 → 打包 → 体检 → 自动修错”闭环。

---

## 核心特性

1. **8 大主流渠道 2026 规范同源对齐**（详见 [docs/channel-specs-2026.md](./docs/channel-specs-2026.md)）
   - `AppLovin`、`Unity Ads / LevelPlay`（已迁移废弃的 ironSource DAPI）、`Google Ads`、`Meta (Facebook)`、`TikTok / Pangle`、`Mintegral`、`Moloco`、`Liftoff / Vungle`。
2. **静态 + 无头浏览器真跑双层体检（`@cocos-pnp/playable-validator`）**
   - 自动复用本机已安装的 Chrome/Chromium（无需下载数百 MB 浏览器），也支持 `--static-only` 零浏览器快检；
   - 检测体积红线（含 Meta ZIP 内 `index.html <= 2MB` 与 100 文件限制）、Google 文件后缀白名单、TikTok `config.json`、Mintegral 同名目录与 `gameReady`/`gameEnd`、Liftoff 小写 ASCII 路径、Base64 ~33% 膨胀归因；
   - 运行时真实检测未捕获异常、Console 报错、非白名单外链拦截、竖屏/横屏双视口黑屏、交互前自动播音与目标渠道 CTA 回调触发。
3. **引擎无关内核 + 可插拔 `EngineAdapter` + 零残留统一 SDK（`@cocos-pnp/playable-core` + `@cocos-pnp/playable-sdk`）**
   - 底层浏览器 VFS 一次性拦截 **7 大原生资源加载入口**（`SafeURL`、`fetch`、`XMLHttpRequest`、`WebAssembly.instantiateStreaming`、`Image.src`、`Audio/Media.src`、`FontFace`）；
   - 内置 **6 大引擎适配器**自动识别（`cocos-3x`、`cocos-2x`、`playcanvas`、`godot-4`、`unity-webgl`、`generic-web` 通吃 Vite/PixiJS/Three.js/Phaser/AI H5），并支持传入自定义 `EngineAdapter` 零改内核扩展；
   - 支持 `playable.config.json` 与自动兼容读取 v1 老版 `.adapterrc` 配置；
   - 业务代码只需调用统一的 `window.playable.init / ready / gameEnd / cta`，打包期按目标渠道生成零残留桥接代码（Google / Meta / TikTok / Mintegral / Moloco 产物中零 `mraid` 残留）；
   - 自动 `pako` 净收益压缩与瘦壳 ZIP 外置拆分，避免超限与 Base64 无意义膨胀。
4. **AI Agent 原生支持（CLI + MCP Server + Skill）**
   - 所有命令支持 `--json` 结构化输出；
   - `playable mcp` 启动标准 stdio MCP Server，暴露 `get_channel_specs`、`build_playable`、`check_playable`、`inspect_playable_size`；
   - 配套现成 Agent Skill：[skills/playable-ads-workflow/SKILL.md](./skills/playable-ads-workflow/SKILL.md)。

---

## 支持的 8 大渠道（2026 基线）

| 渠道 | 输出格式 | 体积限制 | MRAID | CTA API | 关键规则 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **AppLovin** (`applovin`) | 单 HTML | <= 5 MB | 必选 v2.0 | `mraid.open()` | 零外链，横竖屏双视口 |
| **Unity / LevelPlay** (`unity`) | 单 HTML | <= 5 MB | 必选 v3.0 | `mraid.open()` | 弃用旧 ironSource DAPI；`ready` + `viewableChange` 门控；双视口 |
| **Google Ads** (`google`) | ZIP | <= 5 MB | 禁止 | `ExitApi.exit()` | <= 512 文件；`ad.orientation` + `ad.size` + `exitapi.js`；严格后缀白名单 |
| **Meta** (`meta`, `facebook`) | ZIP / 单 HTML | ZIP <= 5 MB 且 `index.html` <= 2 MB | 禁止 | `FbPlayableAd.onCTAClick()` | <= 100 文件；无参 CTA；禁止原生 JS 跳转 |
| **TikTok / Pangle** (`tiktok`, `pangle`) | ZIP | <= 5 MB | 禁止 | `window.openAppStore()` | 根目录 `index.html` + `config.json`；需引 `playable-sdk.js` |
| **Mintegral** (`mintegral`, `mtg`) | ZIP / 单 HTML | <= 5 MB | 禁止 | `window.install()` | 同名结构 `<name>.zip -> <name>/<name>.html`；必调 `gameReady()` / `gameEnd()` |
| **Moloco** (`moloco`) | 单 HTML | <= 5 MB | 禁止 | `FbPlayableAd.onCTAClick()` | 拒收 ZIP；无参 CTA；横竖屏双视口 |
| **Liftoff / Vungle** (`liftoff`, `vungle`) | ZIP / 单 HTML | <= 5 MB | 可选 | `parent.postMessage('download', '*')` | 根目录 `index.html`/`ad.html`；全小写 ASCII 路径；`complete` 生命周期 |

---

## 快速开始

环境要求：Node.js `>= 20`（推荐 `22+`）、`pnpm >= 9`。如需运行时真跑体检，本机需安装 Chrome / Chromium / Edge（或通过 `--browser-path` 指定）。

```bash
# 1. 安装依赖并构建全部 v2 包
pnpm install
pnpm run build:v2

# 2. 用内置可玩示例一键打包全部 8 渠道（可选 --optimize 离线压缩图片），并自动执行无头 Chrome 体检
pnpm playable build examples/mini-playable -o ./playable-dist --channel all --optimize --check

# 3. 启动本地交互式 8 渠道预览调试台（竖屏/横屏/平板切换、静音与切后台模拟、实时 CTA 监视）
pnpm playable preview ./playable-dist/AppLovin.html --channel applovin

# 4. 独立离线压缩图片资产（零 API Key，PNG 量化 + MozJPEG）
pnpm playable optimize ./your-dist --dry-run

# 5. 单独体检任意已有 .html / .zip / 构建目录
pnpm playable check ./playable-dist/Google.zip --channel google
pnpm playable check ./build/web-mobile --channel applovin,unity --static-only

# 6. 查看 8 渠道 2026 规范、内置引擎列表或初始化配置文件
pnpm playable specs
pnpm playable engines
pnpm playable init
```

### 在业务代码中使用统一 SDK

无需在项目里写任何渠道判断，直接调用打包期注入的 `window.playable`（完整示例见 [examples/mini-playable/game.js](./examples/mini-playable/game.js)）：

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

// 游玩结束时调用（Mintegral / Liftoff 必选）
window.playable.gameEnd();

// CTA 按钮点击时调用（建议给按钮加 data-playable-cta 便于自动化验包）
ctaButton.addEventListener('click', () => {
  window.playable.cta();
});
```

---

## 接入 AI Coding Agent（MCP Server）

将以下配置添加到 Claude Code / Cursor / Antigravity / Codex 等支持 MCP 的客户端：

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

可用 MCP 工具：
- `get_channel_specs`：查询 8 渠道 2026 规范红线
- `build_playable`：一键打包 Web / Cocos 3.x 目录并可选自动验包
- `check_playable`：执行静态 + 无头浏览器真跑体检，返回结构化错误码与修复建议
- `inspect_playable_size`：输出体积拆解与 Base64 膨胀归因

---

## Monorepo 结构

```text
packages/
├── playable-sdk/            # v2 零依赖多渠道统一运行时 SDK 与隔离桥接生成器
├── playable-validator/      # v2 8 渠道 2026 规范表、静态体检、体积归因与 Playwright 无头验包
├── playable-core/           # v2 无状态多渠道打包引擎（Generic Web + Cocos 3.x WASM）
├── playable-cli/            # v2 命令行工具（build / check / specs / mcp）
├── playable-adapter-core/   # v1 Cocos 2.x/3.x 适配核心（Legacy 兼容保留）
└── playable-ads-adapter/    # v1 Cocos 2.x/3.x 编辑器插件（Legacy 兼容保留）
examples/mini-playable/      # 零依赖双视口可玩演示工程
skills/playable-ads-workflow/# AI Coding Agent Skill 模板
docs/                        # 2026 渠道规范基线与 v1->v2 迁移指南
```

---

## 运行测试

```bash
# 运行全部 4 个 v2 包的构建与端到端自动化测试（含 8 渠道真跑验收与 MCP 协议测试）
pnpm run test:v2
```

---

## v1 Cocos Creator 编辑器插件（Legacy）

- **v1 → v2 迁移指南**：[docs/v2-migration.md](./docs/v2-migration.md)
- **v1 插件历史版本下载**（Cocos Creator 2.4.x / 3.8.2）：[GitHub Releases](https://github.com/ppgee/cocos-pnp/releases?q=playable-ads-adapter&expanded=true)
- v1 的 `packages/playable-ads-adapter` 与 `.adapterrc` 配置方式仍保留在仓库中；Cocos 3.8.5+ 及新项目推荐直接使用 v2 CLI（`pnpm playable build ./build/web-mobile -o ./playable-dist --channel all --check`）。

### [Contributors](https://github.com/ppgee/cocos-pnp/graphs/contributors)

<a href="https://github.com/ppgee/cocos-pnp/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=ppgee/cocos-pnp" />
</a>
