import fs from 'fs'
import path from 'path';
import { DELETE_ROOT_LIST } from '../constants';

// 删除无用文件
export const deleteRootUnusedFiles = (dest: string) => {
  const projectFiles = fs.readdirSync(dest)
  projectFiles.forEach((file: string) => {
    const filePath = path.join(dest, file)
    if (fs.statSync(filePath).isFile()) {
      if (DELETE_ROOT_LIST.includes(file)) {
        fs.unlinkSync(filePath)
      }
    }
  })
}