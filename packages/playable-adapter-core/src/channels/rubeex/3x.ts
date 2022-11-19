import { APPEND_TO_HEAD, INSERT_BEFORE_SCRIPT } from './inject-vars'
import { exportZipFromPkg } from "@/exporter/3x"
import { TChannel, TChannelPkgOptions } from "@/channels/base"
import { exportConfigJson, getChannelRCSdkScript } from '@/utils'

export const export3xRubeex = async (options: TChannelPkgOptions) => {
  const { orientation } = options
  const channel: TChannel = 'Rubeex'

  await exportZipFromPkg({
    ...options,
    channel,
    transformHTML: async ($) => {
      $(APPEND_TO_HEAD).appendTo('head')
      $('body').attr('onload', 'onLoad()')

      const sdkInjectScript = getChannelRCSdkScript(channel) || INSERT_BEFORE_SCRIPT
      $('body script').first().before(sdkInjectScript)
    },
    transform: async (destPath) => {
      await exportConfigJson({
        destPath,
        orientation
      })
    }
  })
}