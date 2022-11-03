import { CheerioAPI, load } from "cheerio"
import { mkdirSync } from "fs"
import JSZip from "jszip"
import { join } from "path"
import { MAX_ZIP_SIZE, REPLACE_SYMBOL } from "../../constants"
import { readToPath, get3xSingleFilePath, getProjectBuildPath, writeToPath, copyDirToPath, getOriginPkgPath, replaceGlobalSymbol, rmSync, zipDirToPath } from "../../utils"
import { injectFromRCJson } from "../plugins/dom"

const globalReplacer = async (options: Pick<TBuilderOptions, 'channel' | 'zipRes' | 'notZipRes'> & { $: CheerioAPI }) => {
  const { channel, zipRes, notZipRes, $ } = options

  if (!zipRes && !notZipRes) {
    return
  }

  let zip = new JSZip();

  for (const key in zipRes) {
    let data = zipRes[key];
    data = data.replaceAll(REPLACE_SYMBOL, channel)
    zip.file(key, data, { compression: 'DEFLATE' })
  }

  // 增加压缩文件
  const content = await zip.generateAsync({ type: 'nodebuffer' })
  let strBase64 = Buffer.from(content).toString('base64');

  let splitSize = Number((MAX_ZIP_SIZE * .8).toFixed(0))
  let splitCount = Math.ceil(strBase64.length / splitSize)
  for (let index = 0; index < splitCount; index++) {
    const str = strBase64.slice(index * splitSize, (index + 1) * splitSize);
    if (index === 0) {
      $(`script[data-id="adapter-zip-0"]`).html(`window.__adapter_zip__="${str}";`)
    } else {
      $(`script[data-id="adapter-zip-${index-1}"]`).after(`<script data-id="adapter-zip-${index}">window.__adapter_zip__+="${str}";</script>`)
    }
  }

  for (const key in notZipRes) {
    if (Object.prototype.hasOwnProperty.call(notZipRes, key)) {
      const data = notZipRes[key];
      notZipRes[key] = data.replaceAll(REPLACE_SYMBOL, channel)
    }
  }

  // 不需压缩的文件
  $(`script[data-id="adapter-resource"]`).html(`window.__adapter_resource__=${JSON.stringify(notZipRes)};`)
}

export const exportSingleFile = async (options: TBuilderOptions) => {
  const { channel, transformHTML, transform, zipRes, notZipRes } = options

  console.info(`【${channel}】开始适配`)
  const singleHtml = readToPath(get3xSingleFilePath(), 'utf-8')
  const targetPath = join(getProjectBuildPath(), `${channel}.html`)

  // 替换全局变量
  let $ = load(singleHtml)
  await globalReplacer({
    channel,
    zipRes: zipRes ? { ...zipRes } : {},
    notZipRes: notZipRes ? { ...notZipRes } : {},
    $
  })

  // 注入额外配置
  await injectFromRCJson($, channel)
  writeToPath(targetPath, $.html())

  if (transformHTML) {
    await transformHTML($)
    writeToPath(targetPath, $.html())
  }

  if (transform) {
    await transform(targetPath)
  }

  console.info(`【${channel}】完成适配`)
}

export const exportZipFromPkg = async (options: TBuilderOptions) => {
  const { channel, transformHTML, transform } = options

  console.info(`【${channel}】开始适配`)
  // 复制文件夹
  const originPkgPath = getOriginPkgPath()
  const projectBuildPath = getProjectBuildPath()
  const destPath = join(projectBuildPath, channel)
  copyDirToPath(originPkgPath, destPath)

  // 替换全局变量
  replaceGlobalSymbol(destPath, channel)

  // 注入额外配置
  const singleHtmlPath = join(destPath, '/index.html')
  const singleHtml = readToPath(singleHtmlPath, 'utf-8')
  const $ = load(singleHtml)
  await injectFromRCJson($, channel)

  // 增加sdk脚本
  if (transformHTML) {
    await transformHTML($)
  }

  // 更新html文件
  writeToPath(singleHtmlPath, $.html())

  if (transform) {
    await transform(destPath)
  }

  // 压缩文件
  await zipDirToPath(destPath)
  // 删除多余文件夹
  rmSync(destPath)


  console.info(`【${channel}】完成适配`)
}

export const exportDirZipFormSingleFile = async (options: TZipFromSingleFileOptions) => {
  const { channel, transformHTML, transform, transformScript, zipRes, notZipRes } = options

  console.info(`【${channel}】开始适配`)
  // 复制文件夹
  const singleHtmlPath = get3xSingleFilePath()
  const projectBuildPath = getProjectBuildPath()
  const destPath = join(projectBuildPath, channel)

  // 先清空文件夹内容
  rmSync(destPath)

  // html文件路径
  const htmlPath = join(destPath, '/index.html')

  // 创建js目录
  const jsDirname = '/js'
  const jsDirPath = join(destPath, jsDirname)
  mkdirSync(jsDirPath, { recursive: true })

  let $ = load(readToPath(singleHtmlPath, 'utf-8'))

  // 替换全局变量
  await globalReplacer({
    channel,
    zipRes: zipRes ? { ...zipRes } : {},
    notZipRes: notZipRes ? { ...notZipRes } : {},
    $
  })

  // 注入配置文件
  await injectFromRCJson($, channel)

  // 抽离所有script并生成js文件
  const scriptNodes = $('body script[type!="systemjs-importmap"]')
  for (let index = 0; index < scriptNodes.length; index++) {
    const scriptNode = $(scriptNodes[index]);
    if (transformScript) {
      await transformScript(scriptNode)
    }
    let jsStr = scriptNode.text()
    const jsFileName = `index${index}.js`
    const jsPath = join(jsDirPath, jsFileName)
    scriptNode.replaceWith(`<script src=".${jsDirname}/${jsFileName}"></script>`)
    writeToPath(jsPath, jsStr)
  }
  writeToPath(htmlPath, $.html())

  if (transformHTML) {
    await transformHTML($)
    const htmlPath = join(destPath, '/index.html')
    writeToPath(htmlPath, $.html())
  }

  if (transform) {
    await transform(destPath)
  }

  // 压缩文件
  await zipDirToPath(destPath)
  // 删除多余文件夹
  rmSync(destPath)
  console.info(`【${channel}】完成适配`)
}
