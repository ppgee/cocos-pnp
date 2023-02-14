import type { Cheerio, CheerioAPI, Element } from "cheerio"

export type TWebOrientations = 'portrait' | 'landscape' | 'auto'

export type TPlatform =
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

export type TPlayableConfig = {
  /** 0 -> 横竖 1 -> 竖屏 2 -> 横屏 */
  playable_orientation: 0 | 1 | 2,
  playable_languages: string[]
}

export type TBuilderOptions = {
  channel: TChannel
  zipRes?: { [key: string]: string }
  notZipRes?: { [key: string]: string }
  transformHTML?: ($: CheerioAPI) => Promise<void>
  transform?: (destPath: string) => Promise<void>
}

export type TZipFromSingleFileOptions = TBuilderOptions & {
  transformScript?: (scriptNode: Cheerio<Element>) => Promise<void>
}

export type TChannel =
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


export type TChannelPkgOptions = {
  orientation: TWebOrientations
  zipRes?: { [key: string]: string }
  notZipRes?: { [key: string]: string }
}

export type TChannelRC = {
  head: string
  body: string
  sdkScript: string
}

export type TAdapterRC = {
  buildPlatform?: TPlatform
  orientation?: TWebOrientations
  skipBuild?: boolean
  exportChannels?: TChannel[]
  enableSplash?: boolean
  injectOptions?: {
    [key in TChannel]: TChannelRC
  }
  tinify?: boolean
  tinifyApiKey?: string
}