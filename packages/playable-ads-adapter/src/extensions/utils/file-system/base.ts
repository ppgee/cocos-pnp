import { readFileSync } from 'fs'

export const getRealPath = (pathStr: string) => {
  let realPath = pathStr
  // 适配window路径
  if (realPath.indexOf('\\') !== -1) {
    realPath = realPath.replace(/\\/g, '/')
  }

  return realPath
}

export const readToPath = (filepath: string, encoding?: BufferEncoding) => {
  const fileBuffer = readFileSync(filepath)
  return fileBuffer.toString(encoding)
}