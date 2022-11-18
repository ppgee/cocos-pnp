# Cocos广告试玩多渠道导出插件

## 开发和构建步骤

请先配置热更新插件目录
```javascript
// rollup.config.js
...
const plugins = [
  ...,
  /*
   * src是当前项目导出项目
   * desc是开发者Cocos编辑器全局目录
   */
  cocosPluginUpdater({
    src: `${__dirname}/${outputDir}`,
    dest: `~/.CocosCreator/${is2xBuilder ? 'packages' : 'extensions'}/${appName}`
  }),
]
...

```

```bash
# 安装依赖
pnpm install

# 开发2.4.x版本
pnpm watch:2x

# 开发3.6.x版本
pnpm watch:3x
```

### 构建项目
```bash
# 安装依赖
pnpm install

# 构建2.4.x版本
pnpm build:2x

# 构建3.6.x版本
pnpm build:3x
```

## 使用步骤

大版本区分2.x和3.x，目前已通过测试的版本是2.4.9、2.4.10、3.6.0，其他版本自行测试，有问题欢迎提issue或者是解决提mr

### 安装插件
如果只是执行构建步骤的，需要将构建好的插件文件夹放到对应插件文件夹：

- 2.x的插件目录是项目根目录的packages
- 3.x的插件目录是项目根目录的extensions

安装后即可使用（最好重启一下项目）

## 插件相关说明

#### 支持渠道

- AppLovin
- Facebook
- Google
- IronSource
- Liftoff
- Mintegral
- Moloco
- Pangle
- Rubeex
- Tiktok
- Unity

#### 启动说明

- 插件有两种方式进行适配，第一种是正常点击项目构建发布时，自动触发适配功能
- 项目选项栏中出现 **多渠道构建** ，点击该选项下的 **开始构建**进行构建

#### 额外支持功能

1. 支持全局动态替换渠道名称，方便对某个渠道进行特殊逻辑，该占位符为 `'{{__adv_channels_adapter__}}'` ，例：
```typescript
// 源代码为
window.advChannels = '{{__adv_channels_adapter__}}' // 防止rollup打包进行tree-shaking省略掉该代码（dead code），占位符变量可挂载在全局

// 在Facebook渠道下代码会被替换为
window.advChannels = 'Facebook'
```

2. 支持扩展注入脚本功能，可以在此配置每个渠道下特殊的业务代码，需要在根目录下创建 `.adapterrc`，里面以JSON格式进行编辑，其中里面的配置信息和案例如下：
```typescript
type TChannel =
  | 'AppLovin'
  | 'Facebook'
  | 'Google'
  | 'IronSource'
  | 'Liftoff'
  | 'Mintegral'
  | 'Moloco'
  | 'Pangle'
  | 'Rubeex'
  | 'Tiktok'
  | 'Unity'

type TAdapterRC = {
  skipBuild: boolean // 是否跳过构建流程，默认为false
  buildPlatform: Platform // Cocos构建平台值
  orientation: TWebOrientations // Cocos构建设备方向值
  exportChannels: TChannel[] // 需要指定导出渠道，空或者不填则导出所有渠道
  injectOptions: {
    [key in TChannel]: {
      head: string // 在html的head标签内尾部追加
      body: string // 在html的body标签内，且在所有script前追加
      sdkScript: string // 在渠道对应地方注入sdk脚本
    }
  },
  tinify?: boolean // 是否开启 tinypng 压缩
  tinifyApiKey?: string // tinypng api key
}
```
```json
{
  "buildPlatform": "web-mobile",
  "orientation": "auto",
  "injectOptions": {
    "AppLovin": {
      "head": "<script>console.log('AppLovin')</script>"
    },
    "Google": {
      "body": "<a onclick=\"ExitApi.exit()\" style=\"display: none;\"></a>"
    },
    "Unity": {
      "sdkScript": "<script src=\"./mraid.js\"></script>"
    }
  }
}
```

3. 支持指定选定渠道，使用配置如下：
```json
// .adapterrc
{
  "exportChannels": ["Google", "Facebook"] // 需要指定导出渠道，空或者不填则导出所有渠道
}
```

4. 支持 `Tinypng` 压缩图片，让包体进一步缩小，使用配置如下：
```json
// .adapterrc
{
  ...,
  "tinify": true // 是否开启 tinypng 压缩
  "tinifyApiKey": "填写你的 Tinypng 的 api key" // tinypng api key
}
```
