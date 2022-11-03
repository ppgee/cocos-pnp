import { join } from "path"
import { load } from 'cheerio'
import { mkdirSync } from "fs"
import { REPLACE_SYMBOL } from "../../constants"
import { writeToPath, readToPath, get2xSingleFilePath, getProjectBuildPath, getOriginPkgPath, copyDirToPath, replaceGlobalSymbol, zipDirToPath, rmSync } from "../../utils"
import { injectFromRCJson } from "../plugins/dom"

export const exportSingleFile = async (options: TBuilderOptions) => {
  const { channel, transformHTML, transform } = options

  Editor.info(`【${channel}】开始适配`)
  const singleHtml = readToPath(get2xSingleFilePath(), 'utf-8')
  const targetPath = join(getProjectBuildPath(), `${channel}.html`)

  // 替换全局变量
  let $ = load(singleHtml)
  const htmlStr = $.html().replaceAll(REPLACE_SYMBOL, channel)
  $ = load(htmlStr)

  // 注入额外配置
  await injectFromRCJson($, channel)
  writeToPath(targetPath, $.html(htmlStr))

  if (transformHTML) {
    await transformHTML($)
    writeToPath(targetPath, $.html())
  }

  if (transform) {
    await transform(targetPath)
  }

  Editor.success(`【${channel}】完成适配`)
}

export const exportZipFromPkg = async (options: TBuilderOptions) => {
  const { channel, transformHTML, transform } = options

  Editor.info(`【${channel}】开始适配`)
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

  // // 压缩文件
  // await zipDirToPath(destPath)
  // // 删除多余文件夹
  // rmSync(destPath)


  Editor.success(`【${channel}】完成适配`)
}

export const exportDirZipFormSingleFile = async (options: TZipFromSingleFileOptions) => {
  const { channel, transformHTML, transform, transformScript } = options

  Editor.info(`【${channel}】开始适配`)
  // 复制文件夹
  const singleHtmlPath = get2xSingleFilePath()
  const projectBuildPath = getProjectBuildPath()
  const destPath = join(projectBuildPath, channel)

  // 先清空文件夹内容
  rmSync(destPath)

  // 创建js目录
  const jsDirname = '/js'
  const jsDirPath = join(destPath, jsDirname)
  mkdirSync(jsDirPath, { recursive: true })

  let $ = load(readToPath(singleHtmlPath, 'utf-8'))

  // 替换全局变量
  const htmlPath = join(destPath, '/index.html')
  const htmlStr = $.html().replaceAll(REPLACE_SYMBOL, channel)
  $ = load(htmlStr)
  await injectFromRCJson($, channel)

  // 抽离所有script并生成js文件
  const scriptNodes = $('body script')
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

  // // 压缩文件
  // await zipDirToPath(destPath)
  // // 删除多余文件夹
  // rmSync(destPath)
  Editor.success(`【${channel}】完成适配`)
}