import { Platform } from "../@types/packages/builder/@types";

export {};

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
    buildPlatform: Platform | null,
    buildConfig: TAdapterRC | null,
    injectsPath: string,
  }
  var __playable_ads_adapter_project__: {
    isMount: boolean,
    projectRootPath: string,
    projectBuildPath: string,
  }
}
