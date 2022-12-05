import { removeXMLHttpRequest } from "@/utils"
import { exportDirZipFromSingleFile } from "@/exporter/2x"
import { TChannel, TChannelPkgOptions } from "@/typings"

export const export2xFacebook = async (options: TChannelPkgOptions) => {
  const channel: TChannel = 'Facebook'

  await exportDirZipFromSingleFile({
    ...options,
    channel,
    transformScript: async ($) => {
      const jsStr = removeXMLHttpRequest($.text())
      $.text(jsStr)
    }
  })
}