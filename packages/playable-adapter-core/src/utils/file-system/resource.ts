import { readdirSync, statSync } from "fs"
import JSZip from "jszip"
import { lookup } from "mime-types"
import path, { extname } from "path"
import { REPLACE_SYMBOL, TO_STRING_EXTNAME, TO_SKIP_EXTNAME, ADAPTER_FETCH } from "@/constants"
import { getAllFilesFormDir, readToPath, writeToPath } from "./base"

type TResourceData = { [key: string]: string }

type TResZipInfo = {
  key: string,
  ratio: number,
}

export const getRealPath = (pathStr: string) => {
  let realPath = pathStr
  // 适配window路径
  if (realPath.indexOf('\\') !== -1) {
    realPath = realPath.replace(/\\/g, '/')
  }

  return realPath
}

// 替换全局变量
export const replaceGlobalSymbol = (dirPath: string, replaceText: string) => {
  const fileList = readdirSync(dirPath)
  fileList.forEach((file) => {
    const absPath = path.join(dirPath, file)
    const statInfo = statSync(absPath)
    // 如果是文件夹，递归向下找文件
    if (statInfo.isDirectory()) {
      replaceGlobalSymbol(absPath, replaceText)
    } else if (statInfo.isFile() && path.extname(file) === '.js') {
      let dataStr = readToPath(absPath, 'utf-8')
      if (dataStr.indexOf(REPLACE_SYMBOL) !== -1) {
        dataStr = dataStr.replaceAll(REPLACE_SYMBOL, replaceText)
        writeToPath(absPath, dataStr)
      }
    }
  })
}

//判断图片类型是否支持上传，支持true,不支持false
export const checkImgType = (name: string) => {
  let extname = lookup(name)
  if (typeof extname === 'boolean') {
    return false
  }
  return /(gif|jpg|jpeg|png|webp|image)/i.test(extname)
}

export const getBase64FromFile = (filePath: string) => {
  let data = readToPath(filePath, 'base64')
  return `data:${lookup(filePath)};base64,${data}`
}

export const getTargetResData = (filePath: string) => {
  let resData: string = ''
  const fileExtname = extname(filePath)

  // 不存在文件后缀
  if (!fileExtname) {
    return ''
  }

  if (TO_STRING_EXTNAME.includes(fileExtname)) {
    resData = readToPath(filePath, 'utf-8')
  } else {
    resData = getBase64FromFile(filePath)
  }

  return resData
}

export const getResCompressRatio = async (storePath: string, value: string): Promise<TResZipInfo> => {
  let zip = JSZip()
  zip.file(storePath, value, {
    compression: 'DEFLATE'
  })
  const content = await zip.generateAsync({
    type: 'nodebuffer'
  })

  const strBase64 = Buffer.from(content).toString('base64')
  const ratio = Number((strBase64.length / value.length).toFixed(2))
  return {
    key: storePath,
    ratio,
  }
}

export const getZipResourceMapper = async (options: {
  dirPath: string
  skipFiles?: Array<string>
  pieceCbFn?: (objKey: string, data: string) => void
  rmHttp?: boolean
}) => {
  const { dirPath, rmHttp = false, pieceCbFn, skipFiles = [] } = options

  let zipRes: TResourceData = {}
  let notZipRes: TResourceData = {}

  // 遍历每个文件，并根据每个文件的压缩率进行标记是否进行解压
  const resFiles = getAllFilesFormDir(dirPath)
  for (let index = 0; index < resFiles.length; index++) {
    const filePath = resFiles[index];
    const fileExtname = extname(filePath)

    // 移除不需要的文件后缀
    if (TO_SKIP_EXTNAME.includes(fileExtname)) {
      continue
    }

    // 移除不需要的文件
    if (skipFiles.length > 0 && skipFiles.includes(filePath)) {
      continue
    }

    let data = getTargetResData(filePath)
    if (rmHttp && fileExtname === '.js') {
      data = data.replaceAll('XMLHttpRequest', ADAPTER_FETCH)
    }

    const zipRatioInfo = await getResCompressRatio(filePath, data)

    // 需要移除不必要的路径前缀
    const readPkgPath = getRealPath(`${dirPath}/`)
    const objKey = getRealPath(filePath).replace(readPkgPath, '')
    if (zipRatioInfo.ratio >= 1) {
      notZipRes[objKey] = data
      continue
    }

    zipRes[objKey] = data

    pieceCbFn && pieceCbFn(objKey, data)
  }

  return {
    zipRes,
    notZipRes
  }
}