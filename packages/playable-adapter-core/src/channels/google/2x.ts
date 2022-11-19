import { AD_SDK_SCRIPT, LANDSCAPE_META, PORTRAIT_META } from './inject-vars'
import { exportSingleFile } from "@/exporter/2x"
import { getChannelRCSdkScript } from '@/utils'
import { TChannel, TChannelPkgOptions } from "@/channels/base"

export const export2xGoogle = async (options: TChannelPkgOptions) => {
  const { orientation } = options
  const channel: TChannel = 'Google'

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