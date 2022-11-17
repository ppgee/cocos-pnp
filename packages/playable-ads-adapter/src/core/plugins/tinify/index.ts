import Axios from 'axios';
import { readFileSync } from 'fs';
import { checkImgType, getAllFilesFormDir, getOriginPkgPath, getRCTinify, writeToPath } from "@/utils"

// 远程上传文件
export const postFileToRemote = (filePath: string, data: Buffer): Promise<void> => {
  const { tinifyApiKey } = getRCTinify()
  return new Promise((resolve, reject) => {
    console.log('【准备上传图片到TinyPng】 ', filePath)
    Axios.request({
      method: 'post',
      url: 'https://api.tinify.com/shrink',
      auth: {
        username: `api:${tinifyApiKey}`,
        password: '',
      },
      data
    }).then((response) => {
      console.log('【准备下载压缩图片】 ', filePath)
      Axios.request({
        method: 'get',
        url: response.data.output.url,
        responseType: 'arraybuffer'
      }).then((fileResponse) => {
        writeToPath(filePath, Buffer.from(fileResponse.data))
        console.log('【压缩图片完成】 ', filePath)
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
  // 是否压缩
  if (!tinify) {
    return {
      success: false,
      msg: '未开启压缩'
    }
  }

  // 是否有api key
  if (!tinifyApiKey) {
    return {
      success: false,
      msg: '需要提供您的API密钥，获取地址：https://tinify.cn/developers'
    }
  }

  // 原始包路径
  const originPkgPath = getOriginPkgPath()
  const files = getAllFilesFormDir(originPkgPath).filter((filePath) => {
    return checkImgType(filePath)
  })

  let promiseList: Promise<void>[] = []
  for (let index = 0; index < files.length; index++) {
    const filePath = files[index];
    promiseList.push(postFileToRemote(filePath, readFileSync(filePath)))
  }
  await Promise.all(promiseList)

  return {
    success: true,
    msg: '完成压缩'
  }
}