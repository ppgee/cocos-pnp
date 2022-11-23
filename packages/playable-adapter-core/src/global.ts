import { TAdapterRC, TPlatform } from "./typings";
import { getRealPath } from "./utils/file-system/resource";

export const mountGlobalVars = (options: {
  buildFolderPath: string,
  platform: TPlatform,
  adapterBuildConfig?: TAdapterRC | null
}) => {
  if (global.__playable_ads_adapter_global__ && global.__playable_ads_adapter_global__.isMount) {
    return
  }
  global.__playable_ads_adapter_global__ = {
    isMount: true,
    buildFolderPath: options.buildFolderPath,
    buildPlatform: options.platform,
    buildConfig: options.adapterBuildConfig ?? null,
  }
}

export const unmountGlobalVars = () => {
  global.__playable_ads_adapter_global__ = {
    isMount: false,
    buildFolderPath: '',
    buildPlatform: null,
    buildConfig: null,
  }
}

export const getGlobalBuildPlatform = () => {
  return global.__playable_ads_adapter_global__.buildPlatform
}

export const getGlobalBuildConfig = () => {
  return global.__playable_ads_adapter_global__.buildConfig
}

export const getGlobalProjectBuildPath = () => {
  const buildPath = getRealPath(global.__playable_ads_adapter_global__.buildFolderPath)
  return buildPath
}
