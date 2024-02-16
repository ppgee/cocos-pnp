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
import { deflate } from 'pako'
import { TRANSPARENT_GIF } from "@/constants"

type TOptions = {
  singleFilePath: string
  injectsCode: {
    init: string
    main: string
  }
}

const paddingStyleTags = ($: CheerioAPI) => {
  const { enableSplash = true } = getAdapterRCJson() || {}
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
      const imgBase64 = enableSplash ? getBase64FromFile(join(originPkgPath, imgUrl)) : TRANSPARENT_GIF
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

const getJsListFromSettingsJson = (data: string): { jsList: string[], settingsData: { [key: string]: any } } => {
  let jsonData = JSON.parse(data)
  jsonData.plugins = {
    jsList: [],
    ...jsonData.plugins
  }
  const jsList = [...jsonData.plugins.jsList]
  jsonData.plugins.jsList = []
  return {
    jsList,
    settingsData: jsonData
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
  const { isZip = true, enableSplash = true } = getAdapterRCJson() || {}

  const { injectsCode, $ } = options
  // Original package path
  const originPkgPath = getOriginPkgPath()

  let pluginJsList: string[] = []
  const { resMapper } = await getResourceMapper({
    dirPath: originPkgPath,
    rmHttp: true,
    mountCbFn: (objKey, data) => {
      if (objKey.indexOf('src/settings.json') !== -1) { // get jsList in settings.json
        const { jsList, settingsData } = getJsListFromSettingsJson(data)
        pluginJsList = jsList
        // Remove the splash screen in version 3.x.x.
        if (!enableSplash && settingsData?.splashScreen?.totalTime) {
          settingsData.splashScreen.totalTime = 0
        }

        return JSON.stringify(settingsData)
      } else if (objKey.indexOf('src/settings.js') !== -1) { // get jsList in settings.js
        const { jsList, settingsData } = getJsListFromSettingsJs(data)
        pluginJsList = jsList
        return settingsData
      }

      return data
    }
  })

  let resStr = JSON.stringify(resMapper)
  let compDiff = 0

  if (isZip) {
    const zip = deflate(resStr)
    // Uint8Array to base64
    const zipStr = Buffer.from(zip).toString('base64')
    console.log('【Origin Pkg Size】', resStr.length, '【Compressed Pkg Size】', zipStr.length)
    if (zipStr.length < resStr.length) {
      compDiff = resStr.length - zipStr.length
      console.log('【Compressed】', compDiff)
      resStr = zipStr
    } else {
      console.log('【Compressed】', 'Compression is not recommended, the compressed file is too large')
    }
  }

  if (compDiff > 0) {
    // Inject decompression library
    $(`<script data-id="jszip">${jszipCode}</script>`).appendTo('body')

    // Inject compressed files
    $(`<script data-id="adapter-zip-0">window.__adapter_zip__="${resStr}";</script>`).appendTo('body')
  } else {
    // Inject uncompressed files
    $(`<script data-id="adapter-resource-0">window.__adapter_resource__=${resStr}</script>`).appendTo('body')
  }

  // Inject related code
  $(`<script data-id="adapter-plugins">window.__adapter_plugins__=${JSON.stringify(pluginJsList)}</script>`).appendTo('body')
  $(`<script data-id="adapter-init">${injectsCode.init}</script>`).appendTo('body')
  $(`<script data-id="adapter-main">${injectsCode.main}</script>`).appendTo('body')

  return {
    resMapper,
    compDiff
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
  const { resMapper, compDiff } = await paddingAllResToMapped({
    injectsCode,
    $
  })

  writeToPath(singleFilePath, $.html())

  console.info(`【Single file template successfully generated】 File size: ${getFileSize(singleFilePath) / 1024}kb`)

  return {
    resMapper,
    compDiff
  }
}
