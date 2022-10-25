export const COCOS_EDITOR_EVENT: { [key: string]: Editor.ListenEvent } = {
  BEFORE_CHANGE_FILES: 'before-change-files',
  BUILD_FINISHED: 'build-finished',
  BUILD_START: 'build-start',
}
export const BUILDER_NAME = 'taobao-builder'
export const BUILDER_VERSION = '1.0.0'
export const BUILDER_CONFIG = {
  deviceOrientation: "portrait",
  remoteUrl: "",
  startSceneAssetBundle: true
}

// 需要删除的根目录文件
export const DELETE_ROOT_LIST = ['game.js', 'game.json', 'cocos2d-js-min.js', 'adapter-min.js', ]