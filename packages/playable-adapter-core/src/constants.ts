import { TPlayableConfig } from '@/typings'

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
]
