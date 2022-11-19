import { getChannelRCSdkScript } from "@/utils"
import { exportSingleFile } from "@/exporter/2x"
import { TChannel, TChannelPkgOptions } from "@/channels/base"
import { INSERT_BEFORE_SCRIPT } from "./inject-vars"

export const export2xUnity = async (options: TChannelPkgOptions) => {
  const channel: TChannel = 'Unity'
  await exportSingleFile({
    ...options,
    channel,
    transformHTML: async ($) => {
      const sdkInjectScript = getChannelRCSdkScript(channel) || INSERT_BEFORE_SCRIPT
      $('body script').first().before(sdkInjectScript)
    }
  })
}