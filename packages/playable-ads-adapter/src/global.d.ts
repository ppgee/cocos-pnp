/**
 * portrait => 竖屏
 * landscape => 横屏
 * auto => 横竖
 */
type TWebOrientations = 'portrait' | 'landscape' | 'auto'

type TPlatform =
  | 'web-desktop'
  | 'web-mobile'
  | 'wechatgame'
  | 'oppo-mini-game'
  | 'vivo-mini-game'
  | 'huawei-quick-game'
  | 'alipay-mini-game'
  | 'mac'
  | 'ios'
  | 'linux'
  // | 'ios-app-clip'
  | 'android'
  | 'ohos'
  | 'open-harmonyos'
  | 'windows'
  | 'xiaomi-quick-game'
  | 'baidu-mini-game'
  | 'bytedance-mini-game'
  | 'cocos-play'
  | 'huawei-agc'
  | 'link-sure'
  | 'qtt'
  | 'cocos-runtime'
  | 'xr-meta'
  | 'xr-huaweivr'
  | 'xr-pico'
  | 'xr-rokid'
  | 'xr-monado'
  | 'ar-android'
  | 'ar-ios';

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

type TIpcMsgEvent =
  /** 编译状态更新时，发送的消息 */
  | 'builder:state-changed'
  /** 查看构建的选项 */
  | 'builder:query-build-options'
  /** 开始构建任务 */
  | 'builder:start-task'

declare namespace Editor {
  type ListenEvent =
    | 'before-change-files'
    | 'build-start'
    | 'build-finished'

  const Builder: {
    on(event: ListenEvent, eventFn: (options: any, callback: () => void) => void)
    removeListener(event: ListenEvent, eventFn: (options: any, callback: () => void) => void)
  };

  const Ipc: {
    sendToMain(event: TIpcMsgEvent, ...arg: any[]): void
  }

  function log(message?: any, ...optionalParams: any[]): void
  function error(message?: any, ...optionalParams: any[]): void
  function fatal(message?: any, ...optionalParams: any[]): void
  function failed(message?: any, ...optionalParams: any[]): void
  function info(message?: any, ...optionalParams: any[]): void
  function success(message?: any, ...optionalParams: any[]): void
  function warn(message?: any, ...optionalParams: any[]): void
}

interface Bundle {
  root: string,  // bundle 的根目录
  dest: string,  // bundle 的输出目录
  scriptDest: string, // 脚本的输出目录
  name: string, // bundle 的名称
  priority: number, // bundle 的优先级
  scenes: string[], // bundle 中包含的场景
  compressionType: 'subpackage' | 'normal' | 'none' | 'merge_all_json' | 'zip', // bundle 的压缩类型
  buildResults: BuildResults, // bundle 所构建出来的所有资源
  version: string, // bundle 的版本信息，由 config 生成
  config: BundleConfigDebug, // bundle 的 config.json 文件
  isRemote: boolean // bundle 是否是远程包
}

class BuildResults {
  /**
   * 指定的 uuid 资源是否包含在构建资源中
   * 
   * @param {String} uuid 需要检测的资源 uuid
   * @param {Boolean} [assertContains=false] 不包含时是否打印报错信息
   * @returns {Boolean}
   */
  containsAsset(uuid, assertContains): boolean;

  /**
   * 返回构建资源中包含的所有资源的 uuid
   *
   * @returns {string[]}
   */
  getAssetUuids(): string[];

  /**
   * 获取指定 uuid 资源中的所有依赖资源，返回的列表中不包含自身
   *
   * @param {String} uuid - 指定的 uuid 资源
   * @returns {String[]}
   */
  getDependencies(uuid): string[]

  /**
   * 获取指定 uuid 的资源在引擎中定义的资源类型
   * 同时可以使用 cc.js.getClassByName(type) 进行获取资源的构造函数
   *
   * @param {String} uuid - 指定的 uuid 资源
   * @returns {String}
   */
  getAssetType(uuid): string;

  /**
   * 获取指定 uuid 资源（例如纹理）的存放路径（如果找不到，则返回空字符串）
   *
   * @param {String} uuid - 指定的 uuid 资源
   * @returns {String}
   */
  getNativeAssetPath(uuid: string): string;

  /**
   * 获取指定 uuid 资源（例如纹理）的所有存放路径（如果找不到，则返回空数组）
   * 例如：需要获取纹理多种压缩格式的存放资源路径时，即可使用该函数
   *
   * @param {string} uuid - 指定的 uuid 资源
   * @returns {String[]}
   */
  getNativeAssetPaths(uuid: string): string[];
}

interface BundleConfig {
  // 包内资源列表 <资源uuid索引，<资源相对路径, 资源类型索引>>
  paths: Record<string, [string, number]>;
  // 类型数组 debug没有该字段；
  types: string[];
  // 资源uuid数组
  uuids: string[];
  // 场景 <场景url, 场景资源uuid索引>
  scenes: Record<string, number>;
  // 重新使用[uuid索引,重新使用次数]
  redirect: number[];
  // 依赖的bundle资源包名称
  deps: string[];
  // 合并的资源信息 {[合并的uuid] : [被合并的资源索引,...]}
  packs: Record<string, number[]>;
  // bundle名称
  name: string;
  // 资源前缀 比如cdn链接...
  base: string;
  // json文件夹
  importBase: string;
  // 原生资源信息
  nativeBase: string;
  // 是否是debug模式
  debug: boolean;
  // 是否zip压缩
  isZip: boolean;
  // 脚本是否加密
  encrypted: boolean;
  // 版本信息, 选择md5配置的时候
  versions: {
    // [资源uuid索引, md5, 资源uuid索引, md5,...],
    import: any[];
    // [资源uuid索引, md5, 资源uuid索引, md5,...]
    native: any[];
  }
}

interface BundleConfigDebug {
  // 包内资源列表 <资源uuid, [资源相对路径, 资源类型]>
  paths: Record<string, [string, string]>;
  // 资源uuid数组
  uuids: string[];
  // 场景 <场景url, 场景uuid>
  scenes: Record<string, string>;
  // 重新使用[uuid,重新使用次数]
  redirect: any[];
  // 依赖的bundle资源包名称
  deps: string[];
  // 合并的资源信息 {[合并的uuid] : [被合并的资源uuid,...]}
  packs: Record<string, string[]>;
  // bundle名称
  name: string;
  // 资源前缀 比如cdn链接...
  base: string;
  // json文件夹
  importBase: string;
  // 原生资源信息
  nativeBase: string;
  // 是否是debug模式
  debug: boolean;
  // 是否zip压缩
  isZip: boolean;
  // 脚本是否加密
  encrypted: boolean;
  // 版本信息, 选择md5配置的时候
  versions: {
    // [资源uuid, md5, 资源uuid, md5,...],
    import: string[];
    // [资源uuid, md5, 资源uuid, md5,...]
    native: string[];
  }
}

interface BundleConfigAsset {
  uuid: string;
  path: string;
  type: string;
}

// file: engine/ deserialize-compliled.ts
declare module ImportAsset {
  type ICustomObjectDataContent = any;

  const CUSTOM_OBJ_DATA_CLASS = 0;
  const CUSTOM_OBJ_DATA_CONTENT = 1;
  interface ICustomObjectData extends Array<any> {
    // The index of its Class
    [CUSTOM_OBJ_DATA_CLASS]: number;
    // Content
    [CUSTOM_OBJ_DATA_CONTENT]: ICustomObjectDataContent;
  }


  /*@__DROP_PURE_EXPORT__*/
  const enum File {
    Version = 0,
    Context = 0,

    SharedUuids,
    SharedStrings,
    SharedClasses,
    SharedMasks,

    Instances,
    InstanceTypes,

    Refs,

    DependObjs,
    DependKeys,
    DependUuidIndices,

    ARRAY_LENGTH,
  }

  // Main file structure
  interface IFileData extends Array<any> {
    // version
    [File.Version]: number | FileInfo | any;

    // Shared data area, the higher the number of references, the higher the position

    [File.SharedUuids]: SharedString[] | Empty; // Shared uuid strings for dependent assets
    [File.SharedStrings]: SharedString[] | Empty;
    [File.SharedClasses]: (IClass | string | AnyCCClass)[];
    [File.SharedMasks]: IMask[] | Empty;  // Shared Object layouts for IClassObjectData

    // Data area

    // A one-dimensional array to represent object datas, layout is [...IClassObjectData[], ...OtherObjectData[], RootInfo]
    // If the last element is not RootInfo(number), the first element will be the root object to return and it doesn't have native asset
    [File.Instances]: (IClassObjectData | OtherObjectData | RootInfo)[];
    [File.InstanceTypes]: OtherObjectTypeID[] | Empty;
    // Object references infomation
    [File.Refs]: IRefs | Empty;

    // Result area

    // Asset-dependent objects that are deserialized and parsed into object arrays
    [File.DependObjs]: (object | InstanceIndex)[];
    // Asset-dependent key name or array index
    [File.DependKeys]: (StringIndexBnotNumber | string)[];
    // UUID of dependent assets
    [File.DependUuidIndices]: (StringIndex | string)[];
  }

}

type TBuildOptions = {

  excludeScenes: string[];

  orientation: {

    landscapeLeft: boolean;

    landscapeRight: boolean;

    portrait: boolean;

    upsideDown: boolean;

  }

  packageName: string;

  startScene: string;

  title: string;

  webOrientation: TWebOrientations;

  inlineSpriteFrames: boolean;

  inlineSpriteFrames_native: boolean;

  mainCompressionType: string;

  mainIsRemote: boolean;

  optimizeHotUpdate: boolean;

  md5Cache: boolean;

  encryptJs: boolean;

  xxteaKey: string;

  zipCompressJs: boolean;

  'fb-instant-games': any;

  android: {

    packageName: string;

    REMOTE_SERVER_ROOT: string;

  };

  ios: {

    packageName: string,

    REMOTE_SERVER_ROOT: string;

    ios_enable_jit: boolean;

  };

  mac: {

    packageName: string,

    REMOTE_SERVER_ROOT: string;

    width: number;

    height: number;

  };

  win32: { REMOTE_SERVER_ROOT: string; width: number, height: number };

  'android-instant': {

    packageName: string;

    REMOTE_SERVER_ROOT: string;

    pathPattern: string;

    scheme: string;

    host: string;

    skipRecord: boolean;

    recordPath: string;

  };

  appBundle: boolean;

  agreements: any[];

  platform: Platform;

  actualPlatform: Platform;

  template: string;

  buildPath: string;

  debug: boolean;

  sourceMaps: boolean;

  embedWebDebugger: boolean;

  previewWidth: string;

  previewHeight: string;

  useDebugKeystore: boolean;

  apiLevel: string;

  appABIs: string[];

  vsVersion: string;

  buildScriptsOnly: boolean;

  dest: string;

  separateEngineMode: boolean;

  scenes: string[];

  excludedModules: string[];

  project: string;

  projectName: string;

  debugBuildWorker: boolean;

  bundles: Bundle[];

  configPath: string;
}

type TProjectJson = {
  engine: string
  packages: string
  name: string
  id: string
  version: string
  isNew: boolean
}

type TChannelPkgOptions = {
  orientation: TWebOrientations
  resMapper?: TResourceData
}

type TPlayableConfig = {
  /** 0 -> 横竖 1 -> 竖屏 2 -> 横屏 */
  playable_orientation: 0 | 1 | 2,
  playable_languages: string[]
}

type TChannelRC = {
  head: string
  body: string
  sdkScript: string
}

type TAdapterRC = {
  buildPlatform?: Platform
  skipBuild?: boolean
  orientation?: TWebOrientations
  exportChannels?: TChannel[]
  injectOptions?: {
    [key in TChannel]: TChannelRC
  }
  tinify?: boolean
  tinifyApiKey?: string
}

type TResourceData = { [key: string]: string }

type TResZipInfo = {
  key: string,
  ratio: number,
}

type ConsoleMethodName = 'log' | 'info' | 'warn' | 'error'; // 等等，根据需要添加
type PrefixedConsoleMethodName = `adapter:${ConsoleMethodName}`;
type TWorkerMsg = {
  event: 'adapter:finished' | PrefixedConsoleMethodName
  finished: boolean
  msg: string
}
