import type { Cheerio, CheerioAPI, Element } from "cheerio"
import { TChannel } from "./channels"

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

// 游戏配置json
export const PLAYABLE_DEFAULT_CONFIG: TPlayableConfig = {
  playable_orientation: 0,
  playable_languages: ["ja", "zh", "ar", "es", "en", "ko", "pt", "ru", "vi"]
}

export const REPLACE_SYMBOL = '{{__adv_channels_adapter__}}'
export const ADAPTER_FETCH = 'adapterFetch'
// 每个zip包最大体积
export const MAX_ZIP_SIZE = 2 * 1024 * 1024

export const TO_STRING_EXTNAME = [
  '.txt',
  '.xml',
  '.vsh',
  '.fsh',
  '.atlas',
  '.tmx',
  '.tsx',
  '.json',
  '.ExportJson',
  '.plist',
  '.fnt',
  '.js',
  ".zip"
]

export const TO_SKIP_EXTNAME = [
  '.ico',
  '.html',
  '.css',
  '.wasm'
]
