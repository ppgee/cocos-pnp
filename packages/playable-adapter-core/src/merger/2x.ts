import path, { join } from 'path'
import { load, CheerioAPI } from 'cheerio'
import {
  writeToPath,
  get2xSingleFilePath,
  getOriginPkgPath,
  getFileSize,
  getZipResourceMapper,
  readToPath,
} from '@/utils'
import {
  injects2xCode
} from '@/helpers/injects'

const appendScriptNode = ($: CheerioAPI, contentStr: string, tag?: string) => {
  const nodeStr = `
  <script type="text/javascript" charset="utf-8">
    ${contentStr}
  </script>
  `
  $(nodeStr).appendTo(tag || 'body')
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

export const genSingleFile = async () => {
  // 原始包路径
  const originPkgPath = getOriginPkgPath()
  // 2x单文件路径
  const singleFile2xPath = get2xSingleFilePath()

  // 构建相关目录和文件路径
  const htmlPath = path.join(originPkgPath, '/index.html')
  const htmlStr = readToPath(htmlPath, 'utf-8')

  const $ = load(htmlStr)

  // 将style文件填充到html中
  paddingStyleTags($)

  // 清空html中的script tag
  $('head link').remove()
  $('body script').remove()

  // 设置资源script
  const { notZipRes, zipRes } = await getZipResourceMapper({
    dirPath: originPkgPath,
  })
  appendScriptNode($, `window.__adapter_resource__=${JSON.stringify({
    ...notZipRes,
    ...zipRes
  })}`)

  // 注入相关代码
  $(`<script data-id="adapter-init">${injects2xCode.init}</script>`).appendTo('body')
  $(`<script data-id="adapter-main">${injects2xCode.main}</script>`).appendTo('body')

  writeToPath(singleFile2xPath, $.html())

  console.info(`【单文件模板成功生成】文件大小为：${getFileSize(singleFile2xPath) / 1024}kb`)

  return {
    zipRes,
    notZipRes
  }
}