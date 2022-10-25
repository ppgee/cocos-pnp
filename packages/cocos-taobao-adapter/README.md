## 淘宝适配构建插件

### 使用说明

1. 将 `build-templates` 复制到需要构建项目的根目录中
2. 构建 `taobao-builder`
3. 将 `taobao-builder/dist/taobao-builder` 文件夹复制到需要构建项目根目录的 `packages` 中
4. 开始构建Cocos项目，发布平台请选择 `支付宝小游戏`，构建完成后即可运行

#### 下载地址
1.0.0下载：
[https://github.com/ppgee/cocos-pnp/releases/download/taobao-adapter-1.0.0/taobao-builder.zip](https://github.com/ppgee/cocos-pnp/releases/download/taobao-adapter-1.0.0/taobao-builder.zip)

### build-templates 中 main、sub 文件夹有什么作用？

当我们游戏包体积大于淘宝官方要求时，需要将游戏包进行分包，而在淘宝开发者工具中，使用分包功能会使开发者工具无法正常显示游戏，所以在开发过程中，请使用 `main` 文件夹里面的文件覆盖对应游戏根目录文件，当需要上传时再使用 `sub`。构建默认使用 `main`


