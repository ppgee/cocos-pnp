import { AD_SDK_SCRIPT, LANDSCAPE_META, PORTRAIT_META } from './inject-vars'
import { exportSingleFile } from "@/core/exporter/3x"
import { getChannelRCSdkScript } from '@/core/utils'

export const export3xGoogle = async (options: TChannelPkgOptions) => {
  const { orientation } = options
  const channel = 'Google'

  await exportSingleFile({
    ...options,
    channel: 'Google',
    transformHTML: async ($) => {
      // 增加横竖屏meta
      const orientationStr = orientation === 'landscape' ? LANDSCAPE_META : PORTRAIT_META
      $(orientationStr).appendTo('head')

      // 加入广告sdk脚本
      const sdkInjectScript = getChannelRCSdkScript(channel) || AD_SDK_SCRIPT
      $(sdkInjectScript).appendTo('head')

      // 3D引擎需要补充在body里
      // $(SDK_EXIT_A_TAG).appendTo('body')
    },
    // transform: async (destPath) => {
    //   await zipToPath(destPath)
    //   unlinkSync(destPath)
    // }
  })
}