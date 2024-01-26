import { join } from "path"
import { CheerioAPI, load } from "cheerio"
import {
  getAdapterRCJson,
  getBase64FromFile,
  getFileSize,
  getOriginPkgPath,
  getResourceMapper,
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
  const { enableSplash = false } = getAdapterRCJson() || {}
  // 原始包路径
  const originPkgPath = getOriginPkgPath()

  // 将css外链文件转换成内联标签
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

  if (!enableSplash) return
  // 支持封面图
  $('head').find('style').each((_index, elem) => {
    // 匹配css url
    const cssUrlReg = /url\("?'?.*"?'?\)/g
    let styleTagStr = $(elem).html() || ''

    const matchStrList = styleTagStr.match(cssUrlReg)
    if (!matchStrList) return

    matchStrList.forEach((str) => {
      // 匹配url
      const strReg = /"|'|url|\(|\)/g
      const imgUrl = str.replace(strReg, '')
      const imgBase64 = getBase64FromFile(join(originPkgPath, imgUrl))
      styleTagStr = styleTagStr.replace(cssUrlReg, `url(${imgBase64})`)
    })
    $(elem).html(styleTagStr).html()
  })
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

const getJsListFromSettingsJson = (data: string): { jsList: string[], settingsData: string } => {
  let jsonData = JSON.parse(data)
  jsonData.plugins = {
    jsList: [],
    ...jsonData.plugins
  }
  const jsList = [...jsonData.plugins.jsList]
  jsonData.plugins.jsList = []
  return {
    jsList,
    settingsData: JSON.stringify(jsonData)
  }
}

const getJsListFromSettingsJs = (data: string): { jsList: string[], settingsData: string } => {
  const originData = {
    jsList: [],
    settingsData: data
  }

  // check jsList
  let settingsStrList = data.split('jsList:')
  if (settingsStrList.length < 2) {
    return originData
  }

  // get jsList
  const settingsStr = settingsStrList.pop() || ''
  const regExp = /\[[^\]]*\]/
  const jsListStrRegExp = regExp.exec(settingsStr)
  if (!jsListStrRegExp) {
    return originData
  }
  const jsListStr = jsListStrRegExp[0]
  return {
    jsList: JSON.parse(jsListStr),
    settingsData: data.replace(jsListStr, '[]')
  }
}

const paddingAllResToMapped = async (options: {
  injectsCode: TOptions['injectsCode'],
  $: CheerioAPI,
}) => {
  const { isZip = true } = getAdapterRCJson() || {}

  const { injectsCode, $ } = options
  // 原始包路径
  const originPkgPath = getOriginPkgPath()

  let zip = new JSZip();

  let pluginJsList: string[] = []
  const { zipRes, notZipRes } = await getResourceMapper({
    dirPath: originPkgPath,
    rmHttp: true,
    isZip,
    mountCbFn: (objKey, data) => {
      if (objKey.indexOf('src/settings.json') !== -1) { // get jsList in settings.json
        const { jsList, settingsData } = getJsListFromSettingsJson(data)
        pluginJsList = jsList
        return settingsData
      } else if (objKey.indexOf('src/settings.js') !== -1) { // get jsList in settings.js
        const { jsList, settingsData } = getJsListFromSettingsJs(data)
        pluginJsList = jsList
        return settingsData
      }

      return data
    },
    unmountCbFn: (objKey, data) => {
      zip.file(objKey, data, { compression: 'DEFLATE' })
    }
  })

  if (isZip) {
    // 注入解压库
    // $(`<script data-id="jszip">${getJSZipInjectScript()}</script>`).appendTo('body')
    $(`<script data-id="jszip">${jszipCode}</script>`).appendTo('body')

    // 注入压缩文件
    const content = await zip.generateAsync({ type: 'nodebuffer' })
    let strBase64 = Buffer.from(content).toString('base64');
    $(`<script data-id="adapter-zip-0">window.__adapter_zip__="${strBase64}";</script>`).appendTo('body')
  }

  // 不需压缩的文件
  $(`<script data-id="adapter-resource">window.__adapter_resource__=${JSON.stringify(notZipRes)}</script>`).appendTo('body')
  // 注入相关代码
  $(`<script data-id="adapter-plugins">window.__adapter_plugins__=${JSON.stringify(pluginJsList)}</script>`).appendTo('body')
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