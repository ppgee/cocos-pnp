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
  // Original package path
  const originPkgPath = getOriginPkgPath()

  // Convert external CSS files into inline tags
  $('link[type="text/css"]').toArray().forEach((item) => {
    const href = $(item).attr('href')
    if (!href) {
      return
    }
    const cssStr = readToPath(join(originPkgPath, href), 'utf-8')
    // Add some tags
    $(`<style>${cssStr}</style>`).appendTo('head')
  })
  $('link[type="text/css"]').remove()

  if (!enableSplash) return
  // Support for splash screen
  $('head').find('style').each((_index, elem) => {
    // Match css url
    const cssUrlReg = /url\("?'?.*"?'?\)/g
    let styleTagStr = $(elem).html() || ''

    const matchStrList = styleTagStr.match(cssUrlReg)
    if (!matchStrList) return

    matchStrList.forEach((str) => {
      // Match url
      const strReg = /"|'|url|\(|\)/g
      const imgUrl = str.replace(strReg, '')
      const imgBase64 = getBase64FromFile(join(originPkgPath, imgUrl))
      styleTagStr = styleTagStr.replace(cssUrlReg, `url(${imgBase64})`)
    })
    $(elem).html(styleTagStr).html()
  })
}

const paddingScriptTags = ($: CheerioAPI) => {
  // Original package path
  const originPkgPath = getOriginPkgPath()

  let scriptTags = ''
  $('script[type="systemjs-importmap"]').toArray().forEach((item) => {
    const href = $(item).attr('src')
    if (!href) {
      return
    }
    let scriptStr = readToPath(join(originPkgPath, href), 'utf-8')
    // Add some tags
    scriptTags += `<script type="systemjs-importmap">${scriptStr}</script>`
  })

  // Clear script tags in HTML
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
  // Original package path
  const originPkgPath = getOriginPkgPath()

  let zip = isZip ? new JSZip() : null

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
      if (zip) {
        zip.file(objKey, data, { compression: 'DEFLATE' })
      }
    }
  })

  if (isZip && zip) {
    // Inject decompression library
    // $(`<script data-id="jszip">${getJSZipInjectScript()}</script>`).appendTo('body')
    $(`<script data-id="jszip">${jszipCode}</script>`).appendTo('body')

    // Inject compressed files
    const content = await zip.generateAsync({ type: 'nodebuffer' })
    let strBase64 = Buffer.from(content).toString('base64');
    $(`<script data-id="adapter-zip-0">window.__adapter_zip__="${strBase64}";</script>`).appendTo('body')
  }

  // Files that do not need to be compressed
  $(`<script data-id="adapter-resource">window.__adapter_resource__=${JSON.stringify(notZipRes)}</script>`).appendTo('body')
  // Inject related code
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
  // Original package path
  const originPkgPath = getOriginPkgPath()

  // Build related directories and file paths
  const htmlPath = join(originPkgPath, '/index.html')
  const htmlStr = readToPath(htmlPath, 'utf-8')

  const $ = load(htmlStr)

  // Fill style files into HTML
  paddingStyleTags($)

  // Clear script tags in HTML
  paddingScriptTags($)

  // Embed resources into HTML
  const { zipRes, notZipRes } = await paddingAllResToMapped({
    injectsCode,
    $
  })

  writeToPath(singleFilePath, $.html())

  console.info(`【Single file template successfully generated】 File size: ${getFileSize(singleFilePath) / 1024}kb`)

  return {
    zipRes,
    notZipRes
  }
}
