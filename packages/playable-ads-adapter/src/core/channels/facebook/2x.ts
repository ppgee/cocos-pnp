import { removeXMLHttpRequest } from "@/core/utils"
import { exportDirZipFormSingleFile } from "@/core/exporter/2x"

export const export2xFacebook = async (options: TChannelPkgOptions) => {
  await exportDirZipFormSingleFile({
    ...options,
    channel: 'Facebook',
    transformScript: async ($) => {
      const jsStr = removeXMLHttpRequest($.text())
      $.text(jsStr)
    }
  })
}