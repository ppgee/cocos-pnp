import { readFileSync } from 'fs'

export const readToPath = (filepath: string, encoding?: BufferEncoding) => {
  const fileBuffer = readFileSync(filepath)
  return fileBuffer.toString(encoding)
}