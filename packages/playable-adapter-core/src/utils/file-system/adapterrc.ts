import path from "path"
import type { TPlatform, TWebOrientations } from '@/global'
import { getGlobalBuildConfig, getGlobalBuildPlatform, getGlobalProjectBuildPath } from "@/global"
import { TChannel } from "@/channels"

export type TChannelRC = {
  head: string
  body: string
  sdkScript: string
}

export type TAdapterRC = {
  buildPlatform: TPlatform
  skipBuild: boolean
  orientation: TWebOrientations
  exportChannels: TChannel[]
  injectOptions: {
    [key in TChannel]: TChannelRC
  }
  tinify?: boolean
  tinifyApiKey?: string
}

export const getAdapterRCJson = (): TAdapterRC | null => {
  return getGlobalBuildConfig()
}

export const getOriginPkgPath = () => {
  let buildPlatform = getGlobalBuildPlatform()
  if (!buildPlatform) {
    let configJson: Partial<TAdapterRC> = getAdapterRCJson() || {}
    buildPlatform = configJson.buildPlatform || 'web-mobile'
  }

  return path.join(getGlobalProjectBuildPath(), buildPlatform!)
}

export const getChannelRCJson = (channel: TChannel): TChannelRC | null => {
  const adapterRCJson = getAdapterRCJson()
  if (!adapterRCJson || !adapterRCJson.injectOptions || !adapterRCJson.injectOptions[channel]) {
    return null
  }

  return adapterRCJson.injectOptions[channel]
}

export const getRCSkipBuild = (): boolean => {
  const adapterRCJson = getAdapterRCJson()
  if (!adapterRCJson) {
    return false
  }

  return adapterRCJson.skipBuild ?? false
}

export const getRCTinify = (): { tinify: boolean, tinifyApiKey: string, } => {
  const adapterRCJson = getAdapterRCJson()
  if (!adapterRCJson) {
    return {
      tinify: false,
      tinifyApiKey: '',
    }
  }

  return {
    tinify: !!adapterRCJson.tinify,
    tinifyApiKey: adapterRCJson.tinifyApiKey || '',
  }
}

export const getChannelRCSdkScript = (channel: TChannel): string => {
  const channelRCJson = getChannelRCJson(channel)
  return (!channelRCJson || !channelRCJson.sdkScript) ? '' : channelRCJson.sdkScript
}