import { Platform } from "../@types/packages/builder/@types";

export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      BUILD_VERSION: '2x' | '3x'
    }
  }

  var __adapter_build_platform__: Platform | null
  var __adapter_build_config__: TAdapterRC | null
}
