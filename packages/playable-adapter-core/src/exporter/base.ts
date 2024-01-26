import { join } from "path"
import { CheerioAPI, load } from "cheerio";
import { mkdirSync } from "fs"
import { MAX_ZIP_SIZE, REPLACE_SYMBOL } from "@/constants";
import { injectFromRCJson } from "@/helpers/dom";
import { TBuilderOptions, TZipFromSingleFileOptions } from "@/typings";
import { getGlobalProjectBuildPath } from '@/global'
import { writeToPath, readToPath, getOriginPkgPath, copyDirToPath, replaceGlobalSymbol, rmSync } from "@/utils"
import JSZip from "jszip";

const globalReplacer = async (options: Pick<TBuilderOptions, 'channel' | 'zipRes' | 'notZipRes'> & { $: CheerioAPI }) => {
  const { channel, zipRes, notZipRes, $ } = options

  if (!zipRes && !notZipRes) {
    return
  }

  // Compressed files are required.
  const isZip = Object.keys(zipRes || {}).length > 0
  if (isZip) {
    let zip = new JSZip();

    for (const key in zipRes) {
      let data = zipRes[key];
      data = data.replaceAll(REPLACE_SYMBOL, channel)
      zip.file(key, data, { compression: 'DEFLATE' })
    }

    // Add compressed files.
    const content = await zip.generateAsync({ type: 'nodebuffer' })
    let strBase64 = Buffer.from(content).toString('base64');

    let splitSize = Number((MAX_ZIP_SIZE * .8).toFixed(0))
    let splitCount = Math.ceil(strBase64.length / splitSize)
    for (let index = 0; index < splitCount; index++) {
      const str = strBase64.slice(index * splitSize, (index + 1) * splitSize);
      if (index === 0) {
        $(`script[data-id="adapter-zip-0"]`).html(`window.__adapter_zip__="${str}";`)
      } else {
        $(`script[data-id="adapter-zip-${index - 1}"]`).after(`<script data-id="adapter-zip-${index}">window.__adapter_zip__+="${str}";</script>`)
      }
    }
  }

  // Non-compressed files are not required.
  for (const key in notZipRes) {
    if (Object.prototype.hasOwnProperty.call(notZipRes, key)) {
      const data = notZipRes[key];
      notZipRes[key] = data.replaceAll(REPLACE_SYMBOL, channel)
    }
  }
  $(`script[data-id="adapter-resource"]`).html(`window.__adapter_resource__=${JSON.stringify(notZipRes)};`)
}

export const exportSingleFile = async (singleFilePath: string, options: TBuilderOptions) => {
  const { channel, transformHTML, transform, zipRes, notZipRes } = options

  console.info(`【${channel}】adaptation started`)
  const singleHtml = readToPath(singleFilePath, 'utf-8')
  const targetPath = join(getGlobalProjectBuildPath(), `${channel}.html`)

  // Replace global variables.
  let $ = load(singleHtml)
  await globalReplacer({
    channel,
    zipRes: zipRes ? { ...zipRes } : {},
    notZipRes: notZipRes ? { ...notZipRes } : {},
    $
  })

  // Inject additional configuration.
  await injectFromRCJson($, channel)
  writeToPath(targetPath, $.html())

  if (transformHTML) {
    await transformHTML($)
    writeToPath(targetPath, $.html())
  }

  if (transform) {
    await transform(targetPath)
  }

  console.info(`【${channel}】adaptation completed`)
}

export const exportZipFromPkg = async (options: TBuilderOptions) => {
  const { channel, transformHTML, transform } = options

  console.info(`【${channel}】adaptation started`)
  // Copy the folder.
  const originPkgPath = getOriginPkgPath()
  const projectBuildPath = getGlobalProjectBuildPath()
  const destPath = join(projectBuildPath, channel)
  copyDirToPath(originPkgPath, destPath)

  // Replace global variables.
  replaceGlobalSymbol(destPath, channel)

  // Inject additional configuration.
  const singleHtmlPath = join(destPath, '/index.html')
  const singleHtml = readToPath(singleHtmlPath, 'utf-8')
  const $ = load(singleHtml)
  await injectFromRCJson($, channel)

  // Add the SDK script.
  if (transformHTML) {
    await transformHTML($)
  }

  // Update the HTML file.
  writeToPath(singleHtmlPath, $.html())

  if (transform) {
    await transform(destPath)
  }

  console.info(`【${channel}】adaptation completed`)
}

export const exportDirZipFromSingleFile = async (singleFilePath: string, options: TZipFromSingleFileOptions) => {
  const { channel, transformHTML, transform, transformScript, zipRes, notZipRes } = options

  console.info(`【${channel}】adaptation started`)
  // Copy the folder.
  const singleHtmlPath = singleFilePath
  const projectBuildPath = getGlobalProjectBuildPath()
  const destPath = join(projectBuildPath, channel)

  // Empty the contents of the folder first.
  rmSync(destPath)

  // HTML file path.
  const htmlPath = join(destPath, '/index.html')

  // Create a "js" directory.
  const jsDirname = '/js'
  const jsDirPath = join(destPath, jsDirname)
  mkdirSync(jsDirPath, { recursive: true })

  let $ = load(readToPath(singleHtmlPath, 'utf-8'))

  // Replace global variables.
  await globalReplacer({
    channel,
    zipRes: zipRes ? { ...zipRes } : {},
    notZipRes: notZipRes ? { ...notZipRes } : {},
    $
  })

  // Inject configuration file.
  await injectFromRCJson($, channel)

  // To extract all scripts and generate a JavaScript file
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

  console.info(`【${channel}】adaptation completed`)
}