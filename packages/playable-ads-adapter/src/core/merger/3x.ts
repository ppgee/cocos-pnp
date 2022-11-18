import { join } from "path"
import { CheerioAPI, load } from "cheerio"
import { get3xSingleFilePath, getOriginPkgPath, getZipResourceMapper, readToPath, writeToPath, getGameMainInjectScript, getGameInitInjectScript, getJSZipInjectScript } from "@/core/utils"
import JSZip from "jszip"

export const paddingStyleTags = ($: CheerioAPI) => {
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

export const paddingScriptTags = ($: CheerioAPI) => {
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
  $('body script').remove()
  $(scriptTags).appendTo('body')
}

export const paddingAllResToMapped = async ($: CheerioAPI) => {
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
  $(`<script data-id="jszip">${getJSZipInjectScript()}</script>`).appendTo('body')

  // 注入压缩文件
  const content = await zip.generateAsync({ type: 'nodebuffer' })
  let strBase64 = Buffer.from(content).toString('base64');
  $(`<script data-id="adapter-zip-0">window.__adapter_zip__="${strBase64}";</script>`).appendTo('body')

  // 不需压缩的文件
  $(`<script data-id="adapter-resource">window.__adapter_resource__=${JSON.stringify(notZipRes)}</script>`).appendTo('body')
  // 注入相关代码
  $(`<script data-id="adapter-init">${getGameInitInjectScript()}</script>`).appendTo('body')
  $(`<script data-id="adapter-main">${getGameMainInjectScript()}</script>`).appendTo('body')

  return {
    zipRes,
    notZipRes
  }
}

export const genSingleFile = async () => {
  // 原始包路径
  const originPkgPath = getOriginPkgPath()
  // 3x单文件路径
  const singleFile3xPath = get3xSingleFilePath()

  // 构建相关目录和文件路径
  const htmlPath = join(originPkgPath, '/index.html')
  const htmlStr = readToPath(htmlPath, 'utf-8')

  const $ = load(htmlStr)

  // 将style文件填充到html中
  paddingStyleTags($)

  // 清空html中的script tag
  paddingScriptTags($)

  // 将资源打入html中
  const { zipRes, notZipRes } = await paddingAllResToMapped($)

  writeToPath(singleFile3xPath, $.html())

  return {
    zipRes,
    notZipRes
  }
}