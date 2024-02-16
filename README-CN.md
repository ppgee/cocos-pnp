# Playable ads adapter

Cocos广告试玩多渠道导出插件

## 插件使用

如果只是使用，可以直接下载构建包，大版本区分2.x和3.x，目前已通过测试的版本是2.4.9、2.4.10、3.6.0、3.8.2，其他版本自行测试，有问题欢迎提issue或者解决提mr

### 下载地址

插件下载地址：

[https://github.com/ppgee/cocos-pnp/releases?q=playable-ads-adapter&expanded=true](https://github.com/ppgee/cocos-pnp/releases?q=playable-ads-adapter&expanded=true)

### 安装插件

将下载好的插件解压后放到Cocos对应的插件文件夹：

- 2.x的插件目录是项目根目录的packages

- 3.x的插件目录是项目根目录的extensions

安装后即可使用（如果找不到插件的，可以选择重启一下项目）

## 使用插件

- 插件有两种方式进行适配，第一种是正常点击项目构建发布（构建渠道请选择 `web-mobile` 或者 `web-desktop`）时，自动触发适配功能

- 项目选项栏中出现 **多渠道构建** ，点击该选项下的 **开始构建**进行构建

## 插件说明

### 支持渠道

|              | AppLovin | Facebook | Google | IronSource | Liftoff | Mintegral | Moloco | Pangle | Rubeex | Tiktok | Unity |
| ------------ | -------- | -------- | ------ | ---------- | ------- | --------- | ------ | ------ | ------ | ------ | ----- |
| **>= 2.4.6** | ✅       | ✅       | ✅     | ✅         | ✅      | ✅        | ✅     | ✅     | ✅     | ✅     | ✅    |
| **3.8.x**    | ✅       | ✅       | ✅     | ✅         | ✅      | ✅        | ✅     | ✅     | ✅     | ✅     | ✅    |

### 额外支持功能

1. 支持全局动态替换渠道名称，方便对某个渠道进行特殊逻辑，该占位符为 `'{{__adv_channels_adapter__}}'` ，例：

```typescript
// 源代码为
window.advChannels = '{{__adv_channels_adapter__}}' // 防止rollup打包时tree-shaking省略掉该代码（dead code），占位符变量可挂载在全局而不失活

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

type TPlatform =
  | 'web-desktop'
  | 'web-mobile';

type TWebOrientations = 'portrait' | 'landscape' | 'auto'

type TAdapterRC = {
  buildPlatform?: TPlatform // Cocos构建平台值
  orientation?: TWebOrientations // Cocos构建设备方向值
  exportChannels?: TChannel[] // 需要指定导出渠道，空或者不填则导出所有渠道
  skipBuild?: boolean // 是否跳过构建流程，默认为false
  enableSplash?: boolean // 是否设置自定义启动图，默认为true
  injectOptions?: {
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

`.adapterrc` 文件示例：

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
      "body": "<script>if(mraid.getState()==='loading'){mraid.addEventListener('ready',onSdkReady)}else{onSdkReady()}function viewableChangeHandler(viewable){if(viewable){}else{}}function onSdkReady(){mraid.addEventListener('viewableChange',viewableChangeHandler);if(mraid.isViewable()){showMyAd()}}var url='ios链接';var android='安卓链接';if(/android/i.test(userAgent)){url=android}function showMyAd(){mraid.open(url)}</script>",
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

5. 支持Pako压缩包，让包体进一步缩小，使用配置如下：

```json
// .adapterrc
{
  ...,
  "isZip": true // 是否开启 Pako 压缩，默认为true
}
```

## 插件开发和构建步骤

### 拉取项目

```bash
git clone git@github.com:ppgee/cocos-pnp.git
```

### 开发设置和安装依赖

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

# 开发3x版本
pnpm watch:3x
```

### 构建项目

```bash
# 安装依赖
pnpm install

# 构建2.4.x版本
pnpm build:2x

# 构建3.x版本
pnpm build:3x
```

### [Contributors](https://github.com/ppgee/cocos-pnp/graphs/contributors)

<a href="https://github.com/ppgee/cocos-pnp/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=ppgee/cocos-pnp" />
</a>

