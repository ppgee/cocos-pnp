export type { TChannel, TChannelPkgOptions } from './channels';
export {
  execTinify
} from './helpers/tinify'
export type {  } from './global'
export {
  TPlatform,
  TWebOrientations,
  getGlobalBuildConfig,
  getGlobalBuildPlatform,
  getGlobalProjectBuildPath,
  getGlobalProjectRootPath,
  mountBuildGlobalVars,
  mountProjectGlobalVars,
  unmountAllGlobalVars
} from './global'
export { genSingleFile as gen2xSingleFile } from './merger/2x'
export { genSingleFile as gen3xSingleFile } from './merger/3x'
export { genChannelsPkg as gen2xChannelsPkg } from './packager/2x'
export { genChannelsPkg as gen3xChannelsPkg } from './packager/3x'
export type {
  TAdapterRC,
  TChannelRC,
} from './utils'
export {
  getRealPath,
  getAdapterRCJson,
  getChannelRCJson,
  getChannelRCSdkScript,
  getOriginPkgPath,
  getRCSkipBuild,
  getRCTinify
} from './utils'