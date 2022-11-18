import { shell } from 'electron'
import path from "path";
import { IBuildResult, IBuildTaskOption, Platform } from "~types/packages/builder/@types";
import { run } from "node-cmd"
import { BUILDER_NAME } from "@/extensions/constants";
import { getAdapterRCJson, getProjectBuildPath, getRCSkipBuild, getRealPath } from "@/core/utils";
import { checkOSPlatform, readAdapterRCFile } from "@/extensions/utils";
import { unmountAllGlobalVars, mountBuildGlobalVars, mountProjectGlobalVars } from "@/core/global";
import { genSingleFile } from "@/core/merger/3x";
import { genChannelsPkg } from '@/core/packager/3x'
import { execTinify } from "@/core/helpers/tinify";

const prepareBuildStart = (platform?: Platform): Platform => {
  mountProjectGlobalVars({
    projectRootPath: Editor.Project.path,
    projectBuildPath: '/build',
  })

  const adapterBuildConfig = readAdapterRCFile()
  let buildPlatform = platform
  if (!buildPlatform) {
    buildPlatform = adapterBuildConfig?.buildPlatform ?? 'web-mobile'
  }
  mountBuildGlobalVars({
    platform: buildPlatform!,
    injectsPath: path.join(__dirname, './injects'),
    adapterBuildConfig
  })

  return buildPlatform!
}

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
  prepareBuildStart(options.platform!)
  console.log(`${BUILDER_NAME} 跳过预构建处理`)
}

export const initBuildFinishedEvent = async (options: Partial<IBuildTaskOption>, result?: IBuildResult) => {
  console.info(`${BUILDER_NAME} 开始适配，导出平台 ${options.platform}`)
  const start = new Date().getTime();

  try {
    // 执行压缩
    const { success, msg } = await execTinify()
    if (!success) {
      console.warn(`${msg}，跳出压缩图片流程`)
    }
  } catch (error) {
    console.error(error)
  }

  const { zipRes, notZipRes } = await genSingleFile()
  // 适配文件
  const { orientation = 'auto' } = getAdapterRCJson() || {}
  await genChannelsPkg({
    orientation,
    zipRes,
    notZipRes
  })
  const end = new Date().getTime();

  unmountAllGlobalVars()
  console.log(`${BUILDER_NAME} 适配完成，共耗时${((end - start) / 1000).toFixed(0)}秒`)
}

export const builder3x = async () => {
  try {
    const buildPlatform = prepareBuildStart()
    console.log(`开始构建项目，导出${buildPlatform}包`)
    const isSkipBuild = getRCSkipBuild()
    const projectBuildPath = getProjectBuildPath()

    await initBuildStartEvent({
      platform: buildPlatform
    })
    if (!isSkipBuild) {
      await runBuilder(buildPlatform)
    }
    await initBuildFinishedEvent({
      platform: buildPlatform
    })
    shell.openPath(projectBuildPath)
    console.log('构建完成')
  } catch (error) {
    console.error(error)
  }
}
