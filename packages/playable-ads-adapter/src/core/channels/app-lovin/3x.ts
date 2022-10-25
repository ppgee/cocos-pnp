import { getChannelRCSdkScript } from '../../../utils'
import { exportSingleFile } from '../../builder-3x'
import { AD_SDK_SCRIPT } from './inject-vars'

export const export3xAppLovin = async (options: TChannelPkgOptions) => {
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