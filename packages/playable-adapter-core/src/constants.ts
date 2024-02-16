import { TPlayableConfig } from '@/typings'

// game config
export const PLAYABLE_DEFAULT_CONFIG: TPlayableConfig = {
  playable_orientation: 0,
  playable_languages: ["ja", "zh", "ar", "es", "en", "ko", "pt", "ru", "vi"]
}

export const REPLACE_SYMBOL = '{{__adv_channels_adapter__}}'
export const ADAPTER_FETCH = 'adapterFetch'
// every channel's adapter zip file size limit
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

export const TRANSPARENT_GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
