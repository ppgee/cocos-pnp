import { IBuildResult, IBuildTaskOption, Platform } from "../../../@types/packages/builder/@types";
import { BUILDER_NAME,  } from "../../constants";
import { run } from "node-cmd"
import { getAdapterRCJson, getProjectBuildPath, getRealPath } from "../../utils";
import { gen3xSingleFile } from "../plugins/single-html-3x";
import { genChannelsPkg } from './packager'
import { checkOSPlatform } from "../../utils/os";
import { destroyBuildGlobalVars, mountBuildGlobalVars } from "../plugins/editor";
import { shell } from 'electron'

export * from './builder'

const runBuilder = (buildPlatform: Platform) => {
  return new Promise<void>((resolve, reject) => {
    let cocosBuilderPath = Editor.App.path
    const platform = checkOSPlatform()
    if (platform === 'MAC') {
      cocosBuilderPath = cocosBuilderPath.replace('/Resources/app.asar', '/MacOS/CocosCreator')
    } else if (platform === 'WINDOWS') {
      cocosBuilderPath = getRealPath(cocosBuilderPath).replace('/resources/app.asar', '/CocosCreator.exe')
    } else {
      reject(`不支持${platform}平台构建`)
    }

    const processRef = run(`${cocosBuilderPath} --project ${Editor.Project.path} --build "platform=${buildPlatform}"`, (err, data, stderr) => {
      console.log(err, data, stderr)
      resolve()
    })
    //listen to the python terminal output
    processRef.stdout.on('data', (data: string) => {
      console.log(data);
    });
  })
}

export const initBuildStartEvent = async (options: Partial<IBuildTaskOption>) => {
  console.log(`${BUILDER_NAME} 进行预构建处理`)
  mountBuildGlobalVars({
    platform: options.platform!
  })
  console.log(`${BUILDER_NAME} 跳过预构建处理`)
}

export const initBuildFinishedEvent = async (options: Partial<IBuildTaskOption>, result?: IBuildResult) => {
  console.info(`${BUILDER_NAME} 开始适配，导出平台 ${options.platform}`)
  const start = new Date().getTime();
  const { zipRes, notZipRes } = await gen3xSingleFile()
  // 适配文件
  const { orientation = 'auto' } = getAdapterRCJson() || {}
  await genChannelsPkg({
    orientation,
    zipRes,
    notZipRes
  })
  const end = new Date().getTime();

  destroyBuildGlobalVars()
  console.log(`${BUILDER_NAME} 适配完成，共耗时${((end - start) / 1000).toFixed(0)}秒`)
}

export const builder3x = async () => {
  try {
    const { buildPlatform = 'web-mobile' } = getAdapterRCJson() || {}
    console.log(`开始构建项目，导出${buildPlatform}包`)

    await initBuildStartEvent({
      platform: buildPlatform
    })
    await runBuilder(buildPlatform)
    await initBuildFinishedEvent({
      platform: buildPlatform
    })
    shell.openPath(getProjectBuildPath())
    console.log('构建完成')
  } catch (error) {
    console.error(error)
  }
}
