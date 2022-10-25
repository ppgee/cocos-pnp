import { AD_SDK_SCRIPT, ONLOAD_SCRIPT } from './inject-vars'
import { exportSingleFile } from "../../builder-3x"
import { getChannelRCSdkScript } from '../../../utils'

export const export3xIronSource = async (options: TChannelPkgOptions) => {
  const channel = 'IronSource'
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