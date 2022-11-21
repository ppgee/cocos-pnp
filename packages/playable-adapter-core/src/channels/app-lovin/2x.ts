import { getChannelRCSdkScript } from '@/utils'
import { exportSingleFile } from '@/exporter/2x'
import { AD_SDK_SCRIPT } from './inject-vars'
import { TChannel, TChannelPkgOptions } from "@/typings"

export const export2xAppLovin = async (options: TChannelPkgOptions) => {
  const channel: TChannel = 'AppLovin'

  await exportSingleFile({
    ...options,
    channel,
    transformHTML: async ($) => {
      const sdkInjectScript = getChannelRCSdkScript(channel) || AD_SDK_SCRIPT
      $(sdkInjectScript).appendTo('head')
    },
  })
}