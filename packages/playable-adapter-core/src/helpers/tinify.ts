import { checkImgType, getAllFilesFormDir, getOriginPkgPath, getRCTinify, writeToPath } from "@/utils";
import Axios from 'axios';
import { readFileSync } from 'fs';

// Upload file remotely
const postFileToRemote = (filePath: string, data: Buffer): Promise<void> => {
  const { tinifyApiKey } = getRCTinify()
  return new Promise((resolve, reject) => {
    Axios.request({
      method: 'post',
      url: 'https://api.tinify.com/shrink',
      auth: {
        username: `api:${tinifyApiKey}`,
        password: '',
      },
      data
    }).then((response) => {
      Axios.request({
        method: 'get',
        url: response.data.output.url,
        responseType: 'arraybuffer'
      }).then((fileResponse) => {
        const originalSize = data.length;
        const compressedSize = fileResponse.data.length;
        const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
        
        writeToPath(filePath, new Uint8Array(fileResponse.data))
        console.info(`[压缩] ${filePath} (${(originalSize/1024).toFixed(1)}kb -> ${(compressedSize/1024).toFixed(1)}kb, -${ratio}%)`)
        resolve()
      }).catch((fileErr) => {
        reject(fileErr)
      })
    }).catch((err) => {
      reject(err)
    })
  })
}

export const execTinify = async (): Promise<{ success: boolean, msg: string }> => {
  const { tinify, tinifyApiKey } = getRCTinify()
  // Whether to compress
  if (!tinify) {
    return {
      success: false,
      msg: '未开启图片压缩'
    }
  }

  // Whether there is an API key
  if (!tinifyApiKey) {
    return {
      success: false,
      msg: '请提供 API key, 从这里获取: https://tinify.cn/developers'
    }
  }

  // Original package path
  const originPkgPath = getOriginPkgPath()
  const files = getAllFilesFormDir(originPkgPath).filter((filePath) => {
    return checkImgType(filePath)
  })

  console.info(`[压缩] 共发现 ${files.length} 个图片文件`);

  let promiseList: Promise<void>[] = []
  for (let index = 0; index < files.length; index++) {
    const filePath = files[index];
    promiseList.push(postFileToRemote(filePath, readFileSync(filePath)))
  }
  await Promise.all(promiseList)

  return {
    success: true,
    msg: '压缩完成'
  }
}
