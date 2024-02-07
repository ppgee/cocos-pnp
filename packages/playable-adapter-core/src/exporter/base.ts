import { join } from "path"
import { CheerioAPI, load } from "cheerio";
import { mkdirSync } from "fs"
import { MAX_ZIP_SIZE, REPLACE_SYMBOL } from "@/constants";
import { injectFromRCJson } from "@/helpers/dom";
import { TBuilderOptions, TResourceData, TZipFromSingleFileOptions } from "@/typings";
import { getGlobalProjectBuildPath } from '@/global'
import { writeToPath, readToPath, getOriginPkgPath, copyDirToPath, replaceGlobalSymbol, rmSync } from "@/utils"
import { deflate } from 'pako'
import { jszipCode } from "@/helpers/injects";

const FILE_MAX_SIZE = MAX_ZIP_SIZE * .8

const globalReplacer = async (options: Pick<TBuilderOptions, 'channel' | 'resMapper'> & { $: CheerioAPI }) => {
  const { channel, resMapper, $ } = options
  if (!resMapper) {
    return
  }

  // Non-compressed files are not required.
  for (const [key, value] of Object.entries(resMapper)) {
    resMapper[key] = value.replaceAll(REPLACE_SYMBOL, channel);
  }
}

const compressScripts = ($: CheerioAPI, payload: { resMapper: TBuilderOptions['resMapper'] }) => {
  const { resMapper } = payload

  // Add compressed files.
  const zip = deflate(JSON.stringify(resMapper))
  let strBase64 = Buffer.from(zip).toString('base64');

  let splitSize = Number((FILE_MAX_SIZE).toFixed(0))
  let splitCount = Math.ceil(strBase64.length / splitSize)
  for (let index = 0; index < splitCount; index++) {
    const str = strBase64.slice(index * splitSize, (index + 1) * splitSize);
    if (index === 0) {
      $(`script[data-id="adapter-zip-0"]`).html(`window.__adapter_zip__="${str}";`)
    } else {
      $(`script[data-id="adapter-zip-${index - 1}"]`).after(`<script data-id="adapter-zip-${index}">window.__adapter_zip__+="${str}";</script>`)
    }
  }

  // Inject decompression library.
  $(`<script data-id="jszip">${jszipCode}</script>`).appendTo('body')
}

const restoreScripts = ($: CheerioAPI, payload: { resMapper: TBuilderOptions['resMapper'] }) => {
  const appendScript = (content: TResourceData, index: number) => {
    const str = JSON.stringify(content);
    const scriptTag = `<script data-id="adapter-resource-${index}">Object.assign(window.__adapter_resource__, ${str});</script>`;

    if (index === 0) {
      $(`script[data-id="adapter-resource-0"]`).html(`window.__adapter_resource__=${str};`);
      return;
    }
    $(`script[data-id="adapter-resource-${index - 1}"]`).after(scriptTag);
  };

  const { resMapper } = payload
  if (!resMapper) {
    return
  }

  // chunk resMapper to avoid the maximum size of the script tag
  const splitSize = Number((FILE_MAX_SIZE).toFixed(0));
  let currentChunkSize = 0;
  let currentChunkIndex = 0;
  let currentChunk: TResourceData = {};

  for (const [key, value] of Object.entries(resMapper)) {
    const valueLength = value.length;

    // If a single resource exceeds the chunk size, then create a separate script tag for it.
    if (valueLength >= splitSize) {
      appendScript({ [key]: value }, currentChunkIndex);
      currentChunkIndex++;
      continue;
    }

    // Determine whether the current chunk, when combined with the new resource, will exceed the limit.
    if (currentChunkSize + valueLength >= splitSize) {
      // If it does, first append the current chunk, then reset the chunk size and content.
      appendScript(currentChunk, currentChunkIndex);
      currentChunk = {};
      currentChunkSize = 0;
      currentChunkIndex++;
    }

    // Add the new resource to the current chunk.
    currentChunk[key] = value;
    currentChunkSize += valueLength;
  }

  // If the last chunk has content, it also needs to be appended to the script.
  if (currentChunkSize > 0) {
    appendScript(currentChunk, currentChunkIndex);
  }
}

const fillCodeToHTML = ($: CheerioAPI, options: TBuilderOptions) => {
  const { channel, resMapper, compDiff } = options
  // Replace global variables.
  globalReplacer({
    channel,
    resMapper: resMapper ? { ...resMapper } : {},
    $
  })

  const isCompress = (compDiff ?? 0) > 0
  if (isCompress) {
    compressScripts($, { resMapper })
  } else {
    restoreScripts($, { resMapper })
  }
}

export const exportSingleFile = async (singleFilePath: string, options: TBuilderOptions) => {
  const { channel, transformHTML, transform } = options

  console.info(`【${channel}】adaptation started`)
  const singleHtml = readToPath(singleFilePath, 'utf-8')
  const targetPath = join(getGlobalProjectBuildPath(), `${channel}.html`)

  // Replace global variables.
  let $ = load(singleHtml)
  fillCodeToHTML($, options)

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
  const { channel, transformHTML, transform, transformScript, resMapper, compDiff } = options

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
  fillCodeToHTML($, options)

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