import { Platform } from "~types/packages/builder/@types"

export const mountProjectGlobalVars = (options: {
  projectRootPath: string,
  projectBuildPath?: string,
}) => {
  if (global.__playable_ads_adapter_project__ && global.__playable_ads_adapter_project__.isMount) {
    return
  }
  global.__playable_ads_adapter_project__ = {
    isMount: true,
    projectRootPath: options.projectRootPath ?? '',
    projectBuildPath: options.projectBuildPath ?? '',
  }
}

export const mountBuildGlobalVars = (options: {
  platform: Platform,
  injectsPath: string,
  adapterBuildConfig?: TAdapterRC | null
}) => {
  if (global.__playable_ads_adapter_global__ && global.__playable_ads_adapter_global__.isMount) {
    return
  }
  global.__playable_ads_adapter_global__ = {
    isMount: true,
    buildPlatform: options.platform,
    buildConfig: options.adapterBuildConfig ?? null,
    injectsPath: options.injectsPath ?? '',
  }
}

export const unmountAllGlobalVars = () => {
  global.__playable_ads_adapter_project__ = {
    isMount: false,
    projectRootPath: '',
    projectBuildPath: '',
  }
  global.__playable_ads_adapter_global__ = {
    isMount: false,
    buildPlatform: null,
    buildConfig: null,
    injectsPath: '',
  }
}

export const getGlobalBuildPlatform = () => {
  return global.__playable_ads_adapter_global__.buildPlatform
}

export const getGlobalBuildConfig = () => {
  return global.__playable_ads_adapter_global__.buildConfig
}

export const getGlobalProjectRootPath = () => {
  return global.__playable_ads_adapter_project__.projectRootPath
}

export const getGlobalProjectBuildPath = () => {
  return global.__playable_ads_adapter_project__.projectBuildPath
}

export const getGlobalInjectsPath = () => {
  return global.__playable_ads_adapter_global__.injectsPath
}