export {}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      BUILD_VERSION: '2x' | '3x'
    }
  }
}
