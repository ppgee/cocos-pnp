import { TAdapterRC, TPlatform } from './typings'

export {}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      BUILD_VERSION: '2x' | '3x'
    }
  }

  var __adapter_jszip_code__: string
  var __adapter_init_2x_code__: string
  var __adapter_main_2x_code__: string
  var __adapter_init_3x_code__: string
  var __adapter_main_3x_code__: string

  var __playable_ads_adapter_global__: {
    isMount: boolean,
    projectRootPath: string,
    projectBuildPath: string,
    buildPlatform: TPlatform | null,
    buildConfig: TAdapterRC | null,
  }
}
