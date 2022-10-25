# Cocos相关适配插件

在开发过程中自己遇到需要处理的相关插件

## playable-ads-adapter

Cocos广告试玩多渠道导出插件，详情请看[这里](./packages/playable-ads-adapter/README.md)

### 下载插件包
大版本区分2.x和3.x，目前已通过测试的版本是2.4.9、2.4.10、3.6.0
#### 下载地址
2.4.x下载：
[https://github.com/ppgee/cocos-pnp/releases/download/playable-ads-adapter-1.0.0/2.4.x.zip](https://github.com/ppgee/cocos-pnp/releases/download/playable-ads-adapter-1.0.0/2.4.x.zip)

3.6.x下载：
[https://github.com/ppgee/cocos-pnp/releases/download/playable-ads-adapter-1.0.0/3.6.x.zip](https://github.com/ppgee/cocos-pnp/releases/download/playable-ads-adapter-1.0.0/3.6.x.zip)

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

## cocos-taobao-adapter

适配淘宝小程序工具，详情请看[这里](./packages/cocos-taobao-adapter/README.md)

#### 下载地址
1.0.0下载：
[https://github.com/ppgee/cocos-pnp/releases/download/cocos-taobao-adapter-1.0.0/cocos-taobao-adapter.zip](https://github.com/ppgee/cocos-pnp/releases/download/cocos-taobao-adapter-1.0.0/cocos-taobao-adapter.zip)

### 使用说明

1. 将 `build-templates` 复制到需要构建项目的根目录中
2. 构建 `taobao-builder`
3. 将 `taobao-builder/dist/taobao-builder` 文件夹复制到需要构建项目根目录的 `packages` 中
4. 开始构建Cocos项目，发布平台请选择 `支付宝小游戏`，构建完成后即可运行

### [Contributors](https://github.com/ppgee/cocos-pnp/graphs/contributors)

![Contributors](https://github.com/ppgee/cocos-pnp)