import { AD_SDK_SCRIPT } from './inject-vars'
import { exportSingleFile } from "@/exporter/2x"
import { getChannelRCSdkScript } from '@/utils'
import { TChannel, TChannelPkgOptions } from "@/typings"

export const export2xIronSource = async (options: TChannelPkgOptions) => {
  const channel: TChannel = 'IronSource'
  await exportSingleFile({
    ...options,
    channel,
    transformHTML: async ($) => {
      const sdkInjectScript = getChannelRCSdkScript(channel) || AD_SDK_SCRIPT
      $(sdkInjectScript).appendTo('head')

      // $(ONLOAD_SCRIPT).appendTo('head')
    }
  })
}