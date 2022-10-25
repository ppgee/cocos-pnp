import fs from 'fs';
import path from 'path'
import { globalVar2x, settingsVar2x, ccRequireVar2x } from '../../inject/global-var'
import { deleteRootUnusedFiles } from '../../utils';

export function builder2x(options: { bundles: any; settings: any; dest: any; project: string; }, callback: () => void) {
  Editor.log('开始构建2.x版本, 构建参数：', options)

  const { bundles, settings, dest } = options

  // ccRequire动态注入脚本
  let ccRequireVar2xContent = ''

  // 注入bundles的全局变量
  if (bundles && bundles.length > 0) {
    bundles.forEach((bundle: { scriptDest: any; }) => {
      const scriptPath = `${bundle.scriptDest}/index.js`
      let data = fs.readFileSync(scriptPath).toString()
      data = `${globalVar2x}${data}`
      fs.writeFileSync(scriptPath, data)

      // ccRequire 修改
      let ccBundlePath = scriptPath.replace(dest, '')
      // windows路径调整
      if (ccBundlePath.indexOf('\\') !== -1) {
        ccBundlePath = ccBundlePath.replace(/\\/g, '/')
      }
      const ccBundleFnKey = ccBundlePath.substring(1)
      // Editor.log('ccBundlePath', ccBundlePath)
      ccRequireVar2xContent = `${ccRequireVar2xContent}'${ccBundleFnKey}'() { return require('.${ccBundlePath}') },
  `
    })
  }

  // 注入settings的全局变量
  const jsList = <string[]>settings.jsList
  if (jsList && jsList.length > 0) {
    jsList.forEach((jsPath: string) => {
      const ccPath = `src/${jsPath}`
      const scriptPath = `${dest}/${ccPath}`
      let data = fs.readFileSync(scriptPath).toString()
      data = `${globalVar2x}${data}`
      fs.writeFileSync(scriptPath, data)

      // Editor.log('ccPath', ccPath)
      ccRequireVar2xContent = `${ccRequireVar2xContent}'${ccPath}'() { return require('./${ccPath}') },
  `
    })
  }

  // setting 修改
  const settingsPath = `${dest}/src/settings.js`
  let settingsStr = fs.readFileSync(settingsPath).toString()
  settingsStr = `${settingsVar2x}${`${settingsStr}`.replace(settings.platform, 'taobao')}`
  fs.writeFileSync(settingsPath, settingsStr)

  // ccRequire 修改
  const ccRequirePath = path.join(dest, 'ccRequire.js')
  fs.writeFileSync(ccRequirePath, ccRequireVar2x.replace('{{replace-with-module-map}}', ccRequireVar2xContent))

  // 删除无用文件
  deleteRootUnusedFiles(dest)

  // 返回
  callback()
}
