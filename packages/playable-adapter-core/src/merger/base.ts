import { join } from "path"
import { CheerioAPI, load } from "cheerio"
import {
  getFileSize,
  getOriginPkgPath,
  getZipResourceMapper,
  readToPath,
  writeToPath
} from "@/utils"
import {
  jszipCode
} from '@/helpers/injects'
import JSZip from "jszip"

type TOptions = {
  singleFilePath: string
  injectsCode: {
    init: string
    main: string
  }
}

const paddingStyleTags = ($: CheerioAPI) => {
  // 原始包路径
  const originPkgPath = getOriginPkgPath()

  $('link[type="text/css"]').toArray().forEach((item) => {
    const href = $(item).attr('href')
    if (!href) {
      return
    }
    const cssStr = readToPath(join(originPkgPath, href), 'utf-8')
    // 增加部分tag
    $(`<style>${cssStr}</style>`).appendTo('head')
  })
  $('link[type="text/css"]').remove()
}

const paddingScriptTags = ($: CheerioAPI) => {
  // 原始包路径
  const originPkgPath = getOriginPkgPath()

  let scriptTags = ''
  $('script[type="systemjs-importmap"]').toArray().forEach((item) => {
    const href = $(item).attr('src')
    if (!href) {
      return
    }
    let scriptStr = readToPath(join(originPkgPath, href), 'utf-8')
    // 增加部分tag
    scriptTags += `<script type="systemjs-importmap">${scriptStr}</script>`
  })

  // 清空html中的script tag
  $('head link').remove()
  $('body script').remove()
  $(scriptTags).appendTo('body')
}

const paddingAllResToMapped = async (options: {
  injectsCode: TOptions['injectsCode'],
  $: CheerioAPI,
}) => {
  const { injectsCode, $ } = options
  // 原始包路径
  const originPkgPath = getOriginPkgPath()

  let zip = new JSZip();
  const { zipRes, notZipRes } = await getZipResourceMapper({
    dirPath: originPkgPath,
    rmHttp: true,
    pieceCbFn: (objKey, data) => {
      zip.file(objKey, data, { compression: 'DEFLATE' })
    }
  })

  // 注入解压库
  // $(`<script data-id="jszip">${getJSZipInjectScript()}</script>`).appendTo('body')
  $(`<script data-id="jszip">${jszipCode}</script>`).appendTo('body')

  // 注入压缩文件
  const content = await zip.generateAsync({ type: 'nodebuffer' })
  let strBase64 = Buffer.from(content).toString('base64');
  $(`<script data-id="adapter-zip-0">window.__adapter_zip__="${strBase64}";</script>`).appendTo('body')

  // 不需压缩的文件
  $(`<script data-id="adapter-resource">window.__adapter_resource__=${JSON.stringify(notZipRes)}</script>`).appendTo('body')
  // 注入相关代码
  $(`<script data-id="adapter-init">${injectsCode.init}</script>`).appendTo('body')
  $(`<script data-id="adapter-main">${injectsCode.main}</script>`).appendTo('body')

  return {
    zipRes,
    notZipRes
  }
}

export const genSingleFile = async (options: TOptions) => {
  const {
    singleFilePath,
    injectsCode
  } = options
  // 原始包路径
  const originPkgPath = getOriginPkgPath()

  // 构建相关目录和文件路径
  const htmlPath = join(originPkgPath, '/index.html')
  const htmlStr = readToPath(htmlPath, 'utf-8')

  const $ = load(htmlStr)

  // 将style文件填充到html中
  paddingStyleTags($)

  // 清空html中的script tag
  paddingScriptTags($)

  // 将资源打入html中
  const { zipRes, notZipRes } = await paddingAllResToMapped({
    injectsCode,
    $
  })

  writeToPath(singleFilePath, $.html())

  console.info(`【单文件模板成功生成】文件大小为：${getFileSize(singleFilePath) / 1024}kb`)

  return {
    zipRes,
    notZipRes
  }
}