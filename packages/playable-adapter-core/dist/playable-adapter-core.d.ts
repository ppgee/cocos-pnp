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

type TChannelRC = {
  head: string
  body: string
  sdkScript: string
}

type TAdapterRC = {
  buildPlatform?: TPlatform
  orientation?: TWebOrientations
  skipBuild?: boolean
  exportChannels?: TChannel[]
  injectOptions?: {
    [key in TChannel]: TChannelRC
  }
  tinify?: boolean
  tinifyApiKey?: string
}

declare type TOptions = {
    buildFolderPath: string;
    adapterBuildConfig?: TAdapterRC | null;
};
declare const exec2xAdapter: (options: TOptions) => Promise<void>;
declare const exec3xAdapter: (options: TOptions) => Promise<void>;

export { TAdapterRC, TChannel, TPlatform, TWebOrientations, exec2xAdapter, exec3xAdapter };
