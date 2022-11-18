import { BUILDER_NAME, COCOS_EDITOR_EVENT } from "@/extensions/constants";
import { builder2x, initBuildStartEvent, initBuildFinishedEvent } from "@/extensions/builder/2x";

/**
 * @en Hooks triggered after extension loading is complete
 * @zh 扩展加载完成后触发的钩子
 */
export function load() {
  console.log(`${BUILDER_NAME} is loaded`);
  Editor.Builder.on(COCOS_EDITOR_EVENT.BUILD_START, initBuildStartEvent);
  Editor.Builder.on(COCOS_EDITOR_EVENT.BUILD_FINISHED, initBuildFinishedEvent);
}

/**
 * @en Hooks triggered after extension uninstallation is complete
 * @zh 扩展卸载完成后触发的钩子
 */
export function unload() {
  console.log(`${BUILDER_NAME} is unloaded`)
  Editor.Builder.removeListener(COCOS_EDITOR_EVENT.BUILD_START, initBuildStartEvent);
  Editor.Builder.removeListener(COCOS_EDITOR_EVENT.BUILD_FINISHED, initBuildFinishedEvent);
}

export const messages = {
  'adapter-build'() {
    builder2x()
  }
}
