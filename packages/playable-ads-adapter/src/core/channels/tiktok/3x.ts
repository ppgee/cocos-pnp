import { APPEND_TO_HEAD } from "./inject-vars"
import { exportZipFromPkg } from "@/core/exporter/3x"
import { exportConfigJson, getChannelRCSdkScript } from "@/core/utils"

export const export3xTiktok = async (options: TChannelPkgOptions) => {
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