import { BUILDER_NAME } from '../../constants'
import { getAdapterRCJson, getExcludedModules, getOriginPkgPath, getProjectBuildPath } from '../../utils'
import { destroyBuildGlobalVars, mountBuildGlobalVars } from '../plugins/editor'
import { gen2xSingleFile } from '../plugins/single-html-2x'
import { genChannelsPkg } from './packager'
import { shell } from 'electron'

export * from './builder'

export const initBuildStartEvent = (options: TBuildOptions, callback?: () => void) => {
  Editor.log(`${BUILDER_NAME} 进行预构建处理`)
  mountBuildGlobalVars({
    platform: options.platform
  })
  Editor.log(`${BUILDER_NAME} 跳过预构建处理`)
  callback && callback()
}

export const initBuildFinishedEvent = async (options: TBuildOptions, callback?: () => void) => {
  Editor.info(`${BUILDER_NAME} 开始适配`)
  const start = new Date().getTime();
  await gen2xSingleFile()
  // 适配文件
  await genChannelsPkg({
    orientation: options.webOrientation
  })
  const end = new Date().getTime();
  destroyBuildGlobalVars()
  Editor.success(`${BUILDER_NAME} 适配完成，共耗时${((end - start) / 1000).toFixed(0)}秒`)
  shell.openPath(getProjectBuildPath())
  callback && callback()
}

export const builder2x = () => {
  const { buildPlatform = 'web-mobile' } = getAdapterRCJson() || {}
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
    Editor.Ipc.sendToMain('builder:start-task', 'build', buildOptions)
  })
}
