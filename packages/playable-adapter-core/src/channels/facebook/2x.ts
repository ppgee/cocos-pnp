import { removeXMLHttpRequest } from "@/utils"
import { exportDirZipFormSingleFile } from "@/exporter/2x"
import { TChannel, TChannelPkgOptions } from "@/typings"

export const export2xFacebook = async (options: TChannelPkgOptions) => {
  const channel: TChannel = 'Facebook'

  await exportDirZipFormSingleFile({
    ...options,
    channel,
    transformScript: async ($) => {
      const jsStr = removeXMLHttpRequest($.text())
      $.text(jsStr)
    }
  })
}