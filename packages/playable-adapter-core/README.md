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

| >= 2.4.6 | >= 3.8.x |
| -------- | -------- |
| ✅       |    ✅    |

## Platform Support

|              | AppLovin | Facebook | Google | IronSource | Liftoff | Mintegral | Moloco | Pangle | Rubeex | Tiktok | Unity |
| ------------ | -------- | -------- | ------ | ---------- | ------- | --------- | ------ | ------ | ------ | ------ | ----- |
| **>= 2.4.6** | ✅       | ✅       | ✅     | ✅         | ✅      | ✅        | ✅     | ✅     | ✅     | ✅     | ✅    |
| **>= 3.8.x**    | ✅       | ✅       | ✅     | ✅         | ✅      | ✅        | ✅     | ✅     | ✅     | ✅     | ✅    |

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
import { TPlatform, exec2xAdapter } from "playable-adapter-core";

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
      enableSplash: true,
      skipBuild: true,
      tinify: true,
      tinifyApiKey: "your tinify api key",
    },
  };

  // required
  const version = "2"; // '2' | '3'
  version === "2" ? await exec2xAdapter(config) : await exec3xAdapter(config);
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
import { TPlatform, exec2xAdapter, exec3xAdapter } from "playable-adapter-core";
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
      tinifyApiKey,
    },
  };

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
const exportChannels: TChannel[] = ["Facebook", "Google"];
```

### `enableSplash`

Replace Cocos Splash. ([How to remove or change splash ?](https://blog.csdn.net/qq_38269366/article/details/84994586))

```typescript
let config = {
  enableSplash: false,
};
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
    head: string; // To append to the end of the <head> tag in HTML
    body: string; // To append content within the <body> tag of an HTML document, but before all <script> tags
    sdkScript: string; // To inject an SDK script at the correct location within a channel
  };
} = {};
```

### Tinify

```typescript
let config = {
  tinify: true, // compress resource before build package
  tinifyApiKey: "", // tinify api key, visit to https://tinypng.com/developers
};
```

### Pako

You can configure the use of Pako in your application according to your requirements

```typescript
let config = {
  isZip: true, // default true
};
```

## Breaking Changes

### `v1.0.0`

`URL.createObjectURL` instead of `System.__proto__.createScript`

Since Cocos Creator 3.7 has updated SystemJS, adjustments have been made in the implementation. Instead of modifying `System.__proto__.createScript`, the choice is to use `URL.createObjectURL` to maintain the default behavior of SystemJS. This change does not affect version 2.x.

The `URL.createObjectURL` method is used to create a URL that represents the given object (such as a `File` or `Blob` object) in the parameter. When you directly open an HTML file on the local file system (e.g., using a URL starting with `file:///`), modern browsers typically restrict many file system-related web APIs, including creating object URLs, for security reasons. It is strongly recommended to serve files through an HTTP server instead of trying to bypass the browser's security restrictions.

This behavior is adopted by modern browsers as a security measure to prevent cross-site scripting attacks and data leakage. The browser's same-origin policy restricts how documents or scripts loaded from one origin can interact with resources from another origin. It is an important security mechanism that helps protect user data from certain network attacks.

To resolve this issue, you should serve your application through an HTTP server instead of opening it directly from the file system. This approach not only addresses the issue of having a null origin but also allows your application to run under conditions that closely resemble a production environment.

Here are a few methods to set up a local HTTP server:

1. **Using Python's HTTP server**:
   If you have Python 3.x installed, navigate to your project directory in the command line and run the following command to start a simple HTTP server:

   ```bash
   python -m http.server
   ```

   You can then access your application at `http://localhost:8000`.

2. **Using Node.js with `http-server`**:
   If you have Node.js installed, you can use the `http-server` package. Install it by running the following command in the command line:

   ```bash
   npm install -g http-server
   ```

   Then navigate to your project directory and start the server:

   ```bash
   http-server .
   ```

   Your application will now be available at `http://localhost:8080`.

3. **Using other HTTP server software**:
   You can also choose to use other professional web server software such as Apache, Nginx, or others, but this may require more complex configuration.

Remember, even when using an HTTP server in your local development environment, ensure that all network requests adhere to the same security principles, especially when handling user data.
