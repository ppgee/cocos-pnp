import { getChannelRCSdkScript } from "@/core/utils"
import { exportSingleFile } from "@/core/exporter/3x"
import { INSERT_BEFORE_SCRIPT } from "./inject-vars"

export const export3xUnity = async (options: TChannelPkgOptions) => {
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