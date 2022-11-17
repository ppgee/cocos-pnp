import { existsSync } from "fs"
import path from "path"
import { ADAPTER_RC_PATH } from "@/constants"
import { readToPath } from "./base"
import { getProjectBuildPath, getProjectRootPath } from "./project"

export const getOriginPkgPath = () => {
  let buildPlatform = global.__adapter_build_platform__
  if (!buildPlatform) {
    let configJson: Partial<TAdapterRC> = getAdapterRCJson() || {}
    buildPlatform = configJson.buildPlatform || 'web-mobile'
  }

  return path.join(getProjectBuildPath(), buildPlatform!)
}

export const getAdapterRCJson = (): TAdapterRC | null => {
  if (global.__adapter_build_config__) {
    return global.__adapter_build_config__
  }
  const projectRootPath = getProjectRootPath()
  const adapterRCJsonPath = `${projectRootPath}${ADAPTER_RC_PATH}`
  if (existsSync(adapterRCJsonPath)) {
    return <TAdapterRC>JSON.parse(readToPath(adapterRCJsonPath))
  }

  return null
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