import { APPEND_TO_HEAD } from "./inject-vars"
import { exportZipFromPkg } from "@/core/builder-2x"
import { exportConfigJson, getChannelRCSdkScript } from "@/utils"

export const export2xTiktok = async (options: TChannelPkgOptions) => {
  const { orientation } = options
  const channel: TChannel = 'Tiktok'

  await exportZipFromPkg({
    ...options,
    channel,
    transformHTML: async ($) => {
      const sdkInjectScript = getChannelRCSdkScript(channel) || APPEND_TO_HEAD
      $(sdkInjectScript).appendTo('head')
    },
    transform: async (destPath) => {
      await exportConfigJson({
        destPath,
        orientation
      })
    }
  })
}