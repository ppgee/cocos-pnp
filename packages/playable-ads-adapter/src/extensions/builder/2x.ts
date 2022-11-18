import { BUILDER_NAME } from '@/extensions/constants'
import { Platform } from '~types/packages/builder/@types'
import { getOriginPkgPath, getProjectBuildPath, getRCSkipBuild } from '@/core/utils'
import { getExcludedModules, readAdapterRCFile } from '@/extensions/utils'
import { unmountAllGlobalVars, mountBuildGlobalVars, mountProjectGlobalVars } from '@/core/global'
import { genSingleFile } from '@/core/merger/2x'
import { genChannelsPkg } from '@/core/packager/2x'
import { execTinify } from '@/core/helpers/tinify'
import { shell } from 'electron'
import path from 'path'

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

export const initBuildStartEvent = (options: TBuildOptions, callback?: () => void) => {
  Editor.log(`${BUILDER_NAME} 进行预构建处理`)
  prepareBuildStart(options.platform)
  Editor.log(`${BUILDER_NAME} 预构建处理完成`)
  callback && callback()
}

export const initBuildFinishedEvent = async (options: TBuildOptions, callback?: () => void) => {
  Editor.info(`${BUILDER_NAME} 开始适配`)
  const start = new Date().getTime();

  try {
    // 执行压缩
    const { success, msg } = await execTinify()
    if (!success) {
      Editor.warn(`${msg}，跳出压缩图片流程`)
    }
  } catch (error) {
    console.error(error)
  }

  await genSingleFile()
  // 适配文件
  await genChannelsPkg({
    orientation: options.webOrientation
  })
  const end = new Date().getTime();
  Editor.success(`${BUILDER_NAME} 适配完成，共耗时${((end - start) / 1000).toFixed(0)}秒`)
  shell.openPath(getProjectBuildPath())
  unmountAllGlobalVars()
  callback && callback()
}

export const builder2x = () => {
  const buildPlatform = prepareBuildStart()
  Editor.log(`开始构建项目，导出${buildPlatform}包`)

  Editor.Ipc.sendToMain('builder:query-build-options', (err: any, options: TBuildOptions) => {
    const scenes = options.scenes || []
    if (scenes.length === 0) {
      scenes.push(options.startScene)
    }
    const excludedModules = getExcludedModules()
    let buildOptions: TBuildOptions = {
      ...options,
      md5Cache: false,
      inlineSpriteFrames: false,
      inlineSpriteFrames_native: false,
      debug: false,
      platform: buildPlatform,
      actualPlatform: buildPlatform,
      sourceMaps: false,
      scenes,
      excludedModules,
      dest: getOriginPkgPath()
    }

    const isSkipBuild = getRCSkipBuild()
    if (isSkipBuild) {
      initBuildStartEvent(buildOptions, () => {
        initBuildFinishedEvent(buildOptions)
      })
      return
    }
    Editor.Ipc.sendToMain('builder:start-task', 'build', buildOptions)
  })
}
