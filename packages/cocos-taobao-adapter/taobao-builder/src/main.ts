import { builder2x } from './core/builder-2x'
import { BUILDER_NAME, COCOS_EDITOR_EVENT } from './constants'

const initBuildStartEvent = (options: any, callback: () => void) => {
  const { platform, actualPlatform } = options
  if (platform === 'mini-game' && actualPlatform === 'alipay') {
    Editor.log(`${BUILDER_NAME} 进行预构建处理`)
    return
  }

  Editor.log(`${BUILDER_NAME} 跳过预构建处理`)
  callback()
}

const initBuildFinishedEvent = (options: any, callback: () => void) => {
  const { platform, actualPlatform } = options
  if (platform === 'mini-game' && actualPlatform === 'alipay') {
    Editor.log(`${BUILDER_NAME} 开始适配`)
    builder2x(options, callback)
    return
  }

  Editor.log(`${BUILDER_NAME} 跳过适配`)
  callback()
}

/**
 * @en Hooks triggered after extension loading is complete
 * @zh 扩展加载完成后触发的钩子
 */
export function load() {
  Editor.log(`${BUILDER_NAME} is loaded`)
  Editor.Builder.on(COCOS_EDITOR_EVENT.BUILD_START, initBuildStartEvent);
  Editor.Builder.on(COCOS_EDITOR_EVENT.BUILD_FINISHED, initBuildFinishedEvent);
}

/**
 * @en Hooks triggered after extension uninstallation is complete
 * @zh 扩展卸载完成后触发的钩子
 */
export function unload() {
  // @ts-ignore
  Editor.log(`${BUILDER_NAME} is unloaded`)
  // @ts-ignore
  Editor.Builder.removeListener(COCOS_EDITOR_EVENT.BUILD_START, initBuildStartEvent);
  // @ts-ignore
  Editor.Builder.removeListener(COCOS_EDITOR_EVENT.BUILD_FINISHED, initBuildFinishedEvent);
}
