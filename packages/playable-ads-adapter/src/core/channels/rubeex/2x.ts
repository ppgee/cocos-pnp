import { APPEND_TO_HEAD, INSERT_BEFORE_SCRIPT } from './inject-vars'
import { exportZipFromPkg } from "@/core/exporter/2x"
import { exportConfigJson, getChannelRCSdkScript } from '@/core/utils'

export const export2xRubeex = async (options: TChannelPkgOptions) => {
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