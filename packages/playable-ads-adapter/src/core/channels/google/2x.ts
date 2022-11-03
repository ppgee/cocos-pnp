import { AD_SDK_SCRIPT, LANDSCAPE_META, PORTRAIT_META } from './inject-vars'
import { exportSingleFile } from "../../builder-2x"
import { getChannelRCSdkScript, zipToPath } from '../../../utils'
import { unlinkSync } from 'fs'

export const export2xGoogle = async (options: TChannelPkgOptions) => {
  const { orientation } = options
  const channel = 'Google'

  await exportSingleFile({
    ...options,
    channel,
    transformHTML: async ($) => {
      // 增加横竖屏meta
      const orientationStr = orientation === 'landscape' ? LANDSCAPE_META : PORTRAIT_META
      $(orientationStr).appendTo('head')

      // 加入广告sdk脚本
      const sdkInjectScript = getChannelRCSdkScript(channel) || AD_SDK_SCRIPT
      $(sdkInjectScript).appendTo('head')
    },
    // transform: async (destPath) => {
    //   await zipToPath(destPath)
    //   unlinkSync(destPath)
    // }
  })
}