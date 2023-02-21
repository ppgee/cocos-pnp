export {}

declare global {
  declare module '*?worker' {
    var strPath: string;
    export default strPath
  }

  namespace NodeJS {
    interface ProcessEnv {
      BUILD_VERSION: '2x' | '3x'
    }
  }
}
