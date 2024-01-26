# Playable ads adapter

A Plugin for Exporting Cocos Playable Ads in Multi-Channel.

中文说明，点击[这里](./README-CN.md)

If you only need to use the plugin, you can download [the build package](https://github.com/ppgee/cocos-pnp/releases?q=playable-ads-adapter&expanded=true) directly. The major versions are differentiated between `2.x` and `3.x`. Currently, the tested versions are `2.4.9`, `2.4.10`, and `3.6.x`. For other versions, please test them yourself. If you have any questions, feel free to submit an issue or pull request.

## Download

Plugin download link:

[https://github.com/ppgee/cocos-pnp/releases?q=playable-ads-adapter&expanded=true](https://github.com/ppgee/cocos-pnp/releases?q=playable-ads-adapter&expanded=true)

## Install

After downloading the plugin, extract it and place it in the corresponding plugin folder for Cocos:

- For 2.x, the plugin folder is `packages` in the root directory of the project.

- For 3.x, the plugin folder is `extensions` in the root directory of the project.

Once installed, you can use it. If you cannot find the plugin, try restarting the project.

## Using the Plugin

- There are two ways to adapt the plugin. The first is to automatically trigger the adaptation function when building and publishing the project (select `web-mobile` or `web-desktop` as the build channel).

- In the project option bar, select **多渠道构建**, then click **开始构建** to start the build.

## Plugin Description

### Supported Channels

|              | AppLovin | Facebook | Google | IronSource | Liftoff | Mintegral | Moloco | Pangle | Rubeex | Tiktok | Unity |
| ------------ | -------- | -------- | ------ | ---------- | ------- | --------- | ------ | ------ | ------ | ------ | ----- |
| **>= 2.4.6** | ✅       | ✅       | ✅     | ✅         | ✅      | ✅        | ✅     | ✅     | ✅     | ✅     | ✅    |
| **3.8.x**    | ✅       | ✅       | ✅     | ✅         | ✅      | ✅        | ✅     | ✅     | ✅     | ✅     | ✅    |

### Extend Features

1. Supports global dynamic replacement of channel names, making it easy to handle special logic for a specific channel. The placeholder for this feature is `'{{__adv_channels_adapter__}}'`, for example:

```typescript
// source code
window.advChannels = '{{__adv_channels_adapter__}}' // Prevent rollup dead code elimination from omitting this code, the placeholder variable can be mounted on the global without deactivation

// Code will be replaced with Facebook channel:
window.advChannels = 'Facebook'
```

2. Supports injecting additional scripts for each channel to configure special business logic. You need to create a `.adapterrc` file in the root directory to edit the configuration information in JSON format. An example of the configuration is as follows:

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
  buildPlatform?: TPlatform // Cocos build platform value
  orientation?: TWebOrientations // Cocos build device orientation value
  exportChannels?: TChannel[] // Channels to export. If empty or not specified, export all channels.
  skipBuild?: boolean // Whether to skip the build process. Default is false.
  enableSplash?: boolean // Whether to set a custom splash screen. Default is false.
  injectOptions?: {
    [key in TChannel]: {
      head: string // Appended to the head tag in HTML
      body: string // Appended before all scripts in the body tag in HTML
      sdkScript: string // Injects the SDK script into the corresponding channel
    }
  },
  tinify?: boolean // Whether to compress images with Tinypng.
  tinifyApiKey?: string // Tinypng API key
}
```

`.adapterrc` file example:

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

3. Supports specifying selected channels, using the following configuration:

```json
// .adapterrc
{
  "exportChannels": ["Google", "Facebook"] // Channels to export. If empty or not specified, export all channels.
}
```

4. Supports image compression with `Tinypng` to further reduce the package size, using the following configuration:

```json
// .adapterrc
{
  ...,
  "tinify": true // Whether to compress images with Tinypng
  "tinifyApiKey": "YOUR_TINYPNG_API_KEY" // Tinypng API key
}
```

5. Supports JSZip compression to further reduce the package size, using the following configuration:

```json
// .adapterrc
{
  ...,
  "isZip": true // Whether to compress the package with JSZip, the default is true
}
```

## Plugin Development and Build Steps

### Clone the Project

```bash
git clone git@github.com:ppgee/cocos-pnp.git
```

### Development Setup and Dependency Installation

Please configure the hot update plugin directory first.

```javascript
// rollup.config.js
...
const plugins = [
  ...,
  /*
   * src is the exported project in the current project
   * desc is the global directory of the developer's Cocos editor
   */
  cocosPluginUpdater({
    src: `${__dirname}/${outputDir}`,
    dest: `~/.CocosCreator/${is2xBuilder ? 'packages' : 'extensions'}/${appName}`
  }),
]
...

```

```bash
# Install dependencies
pnpm install

# Develop version 2.4.x
pnpm watch:2x

# Develop version 3.6.x
pnpm watch:3x
```

### Build the Project

```bash
# Install dependencies
pnpm install

# Build version 2.4.x
pnpm build:2x

# Build version 3.6.x
pnpm build:3x
```

### [Contributors](https://github.com/ppgee/cocos-pnp/graphs/contributors)

<a href="https://github.com/ppgee/cocos-pnp/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=ppgee/cocos-pnp" />
</a>

