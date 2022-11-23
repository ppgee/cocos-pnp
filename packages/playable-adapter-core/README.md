<h1 align="center">Playable Adapter Core</h1>

<p align="center">Support exporting playable ads for the cocos plugin and node.js</p>

<div align="center">

[![npm version](https://img.shields.io/npm/v/playable-adapter-core.svg?style=flat-square)](https://www.npmjs.org/package/playable-adapter-core)
[![install size](https://img.shields.io/badge/dynamic/json?url=https://packagephobia.com/v2/api.json?p=playable-adapter-core&query=$.install.pretty&label=install%20size&style=flat-square)](https://packagephobia.com/result?p=playable-adapter-core)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/playable-adapter-core?style=flat-square)](https://bundlephobia.com/package/playable-adapter-core@latest)
[![npm downloads](https://img.shields.io/npm/dm/playable-adapter-core.svg?style=flat-square)](https://npm-stat.com/charts.html?package=playable-adapter-core)

</div>

## Features

- Support some popular platform
- Support exporting a single html for target platform
- Remove `XMLHttpRequest` from single html passing the platform test
- Add [TinyPng](https://tinify.cn/) to compress

## Cocos Version Support

| >= 2.4.6  | 3.6.x     |
| --------- | --------- |
| Latest ✅ | Latest ✅ |

## Platform Support

| platform / version | >= 2.4.6 | 3.6.x |
| ------------------ | -------- | ----- |
| AppLovin           | ✅       | ✅    |
| Facebook           | ✅       | ✅    |
| Google             | ✅       | ✅    |
| IronSource         | ✅       | ✅    |
| Liftoff            | ✅       | ✅    |
| Mintegral          | ✅       | ✅    |
| Moloco             | ✅       | ✅    |
| Pangle             | ✅       | ✅    |
| Rubeex             | ✅       | ✅    |
| Tiktok             | ✅       | ✅    |
| Unity              | ✅       | ✅    |

## Installing

### Package manager

Using npm:

```bash
$ npm install playable-adapter-core
```

Using yarn:

```bash
$ yarn add playable-adapter-core
```

Using pnpm:

```bash
$ pnpm install playable-adapter-core
```

## Example

### common

```typescript
import {
  TPlatform,
  exec2xAdapter,
} from "playable-adapter-core";

const main = async () => {
  const config = {
    buildFolderPath: "/your/build/folder/path",
    adapterRC: {
      buildPlatform: "web-mobile",
      exportChannels: "Facebook",
      injectOptions: {
        Facebook: {},
      },
      orientation: "auto",
      skipBuild: true,
      tinify: true,
      tinifyApiKey: "your tinify api key",
    },
  };

  // required
  const version = "2"; // '2' | '3'
  version === "2"
    ? await exec2xAdapter(config)
    : await exec3xAdapter(config);
};

main();
```

### midway.js/koa etc.

```bash
npm install safeify
```

```typescript
import { Api, useContext } from "@midwayjs/hooks";
import { Context } from "@midwayjs/koa";
import {
  TPlatform,
  exec2xAdapter,
  exec3xAdapter,
} from "playable-adapter-core";
import { Safeify } from "safeify";

export const uploadBuildPkg = Api(Upload(), async () => {
  const ctx = useContext<Context>();

  // 调用接口
  const files = useFiles();
  const fields = useFields() as UploadFields;
  const buildPkgKey = Object.keys(files).pop();
  const buildPkg = <
    {
      data: string;
      fieldName: string;
      filename: string;
      mimeType: string;
      _ext: string;
    }
  >files[buildPkgKey].pop();

  const buildChannels = JSON.parse(fields.channels ?? "[]") as TChannel[];
  const tinify = JSON.parse(fields.tinify ?? "false") as boolean;
  const tinifyApiKey = fields.tinifyApiKey ?? "";
  const injectOptions = JSON.parse(fields.injectOptions ?? "{}") as {
    [key in TChannel]: TChannelRC;
  };
  const webOrientation = fields.webOrientation ?? "auto";
  const version = fields.version ?? "2";

  const zipFilePath = buildPkg.data;
  const zipExt = buildPkg._ext;
  const filename = buildPkg.filename.replaceAll(buildPkg._ext, "") as TPlatform;
  const unzipDir = join(
    dirname(buildPkg.data),
    basename(zipFilePath).replace(zipExt, "")
  );

  const config = {
    buildFolderPath: unzipDir,
    adapterBuildConfig: {
      buildPlatform: filename,
      exportChannels: buildChannels,
      injectOptions,
      orientation: webOrientation,
      skipBuild: true,
      tinify,
      tinifyApiKey
    },
  }

  // 创建 safeify 实例
  const safeVm = new Safeify({
    timeout: 3000,
    asyncTimeout: 120000,
    unrestricted: true,
  });
  await safeVm.run(
    `
      version === '2'
        ? await exec2xAdapter(config)
        : await exec3xAdapter(config)
    `,
    {
      version,
      exec2xAdapter,
      exec3xAdapter,
      config,
    }
  );

  return true;
});
```

## Support

### Global Placeholder `'{{__adv_channels_adapter__}}'`

support dynamic import from cocos source code, just like:

```typescript
// source code
window.advChannels = "{{__adv_channels_adapter__}}"; // 防止rollup打包进行tree-shaking省略掉该代码（dead code），占位符变量可挂载在全局

// 在Facebook渠道下代码会被替换为
window.advChannels = "Facebook";
```

### Config

### `exportChannels`

export package from target platforms

```typescript
const exportChannels: TChannel[] = ['Facebook', 'Google']
```

### `injectOptions`

inject script in building html

```typescript
type TChannel =
  | "AppLovin"
  | "Facebook"
  | "Google"
  | "IronSource"
  | "Liftoff"
  | "Mintegral"
  | "Moloco"
  | "Pangle"
  | "Rubeex"
  | "Tiktok"
  | "Unity";

const injectOptions: {
  [key in TChannel]: {
    head: string; // 在html的head标签内尾部追加
    body: string; // 在html的body标签内，且在所有script前追加
    sdkScript: string; // 在渠道对应地方注入sdk脚本
  };
} = {};
```

### Tinify

```typescript
let config = {
  tinify: true, // compress resource before build package
  tinifyApiKey: '', // tinify api key, visit to https://tinypng.com/developers
}
```
