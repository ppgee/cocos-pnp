import Axios from 'axios';
import { readFileSync } from 'fs';
import { checkImgType, getAllFilesFormDir, getOriginPkgPath, getRCTinify, writeToPath } from "@/utils"

// Upload file remotely
const postFileToRemote = (filePath: string, data: Buffer): Promise<void> => {
  const { tinifyApiKey } = getRCTinify()
  return new Promise((resolve, reject) => {
    console.log('【Preparing to upload image to TinyPng】 ', filePath)
    Axios.request({
      method: 'post',
      url: 'https://api.tinify.com/shrink',
      auth: {
        username: `api:${tinifyApiKey}`,
        password: '',
      },
      data
    }).then((response) => {
      console.log('【Preparing to download compressed image】 ', filePath)
      Axios.request({
        method: 'get',
        url: response.data.output.url,
        responseType: 'arraybuffer'
      }).then((fileResponse) => {
        writeToPath(filePath, Buffer.from(fileResponse.data))
        console.log('【Image compression completed】 ', filePath)
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
      msg: 'Compression not enabled'
    }
  }

  // Whether there is an API key
  if (!tinifyApiKey) {
    return {
      success: false,
      msg: 'You need to provide your API key, get it from: https://tinify.cn/developers'
    }
  }

  // Original package path
  const originPkgPath = getOriginPkgPath()
  const files = getAllFilesFormDir(originPkgPath).filter((filePath) => {
    return checkImgType(filePath)
  })

  let promiseList: Promise<void>[] = []
  for (let index = 0; index < files.length; index++) {
    const filePath = files[index];
    promiseList.push(postFileToRemote(filePath, readFileSync(filePath)))
  }
  const results = await Promise.allSettled(promiseList)
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
  if (failed.length > 0) {
    failed.forEach((f) => console.warn('【TinyPng compression failed for an image】', f.reason))
  }

  return {
    success: failed.length < results.length || results.length === 0,
    msg:
      failed.length === 0
        ? 'Compression completed'
        : `Compression completed with ${failed.length}/${results.length} failed image(s)`
  }
}
