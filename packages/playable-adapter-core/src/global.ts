import { join } from "path";
import { TAdapterRC, TPlatform } from "./typings";
import { getRealPath } from "./utils/file-system/resource";

export const mountGlobalVars = (options: {
  projectRootPath: string,
  platform: TPlatform,
  projectBuildPath?: string,
  adapterBuildConfig?: TAdapterRC | null
}) => {
  if (global.__playable_ads_adapter_global__ && global.__playable_ads_adapter_global__.isMount) {
    return
  }
  global.__playable_ads_adapter_global__ = {
    isMount: true,
    projectRootPath: options.projectRootPath,
    projectBuildPath: options.projectBuildPath ?? '',
    buildPlatform: options.platform,
    buildConfig: options.adapterBuildConfig ?? null,
  }
}

export const unmountGlobalVars = () => {
  global.__playable_ads_adapter_global__ = {
    isMount: false,
    projectRootPath: '',
    projectBuildPath: '',
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

export const getGlobalProjectRootPath = () => {
  const rootPath = getRealPath(global.__playable_ads_adapter_global__.projectRootPath)
  return rootPath
}

export const getGlobalProjectBuildPath = () => {
  const rootPath = getGlobalProjectRootPath()
  const buildPath = getRealPath(global.__playable_ads_adapter_global__.projectBuildPath)
  return join(rootPath, buildPath)
}
