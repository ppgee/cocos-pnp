import { join } from "path";
import { getRealPath, TAdapterRC } from "./utils";

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
  platform: TPlatform,
  adapterBuildConfig?: TAdapterRC | null
}) => {
  if (global.__playable_ads_adapter_global__ && global.__playable_ads_adapter_global__.isMount) {
    return
  }
  global.__playable_ads_adapter_global__ = {
    isMount: true,
    buildPlatform: options.platform,
    buildConfig: options.adapterBuildConfig ?? null,
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
  }
}

export const getGlobalBuildPlatform = () => {
  return global.__playable_ads_adapter_global__.buildPlatform
}

export const getGlobalBuildConfig = () => {
  return global.__playable_ads_adapter_global__.buildConfig
}

export const getGlobalProjectRootPath = () => {
  const rootPath = getRealPath(global.__playable_ads_adapter_project__.projectRootPath)
  return rootPath
}

export const getGlobalProjectBuildPath = () => {
  const rootPath = getGlobalProjectRootPath()
  const buildPath = getRealPath(global.__playable_ads_adapter_project__.projectBuildPath)
  return join(rootPath, buildPath)
}
