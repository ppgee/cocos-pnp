import { removeXMLHttpRequest } from "@/utils"
import { TChannel, TChannelPkgOptions } from "@/channels/base"
import { exportSingleFile } from '@/exporter/2x'

export const export2xMoloco = async (options: TChannelPkgOptions) => {
  const channel: TChannel = 'Moloco'

  await exportSingleFile({
    ...options,
    channel,
    transformHTML: async ($) => {
      const htmlStr = removeXMLHttpRequest($('html').html() || '')
      $('html').html(htmlStr)
    }
  })
}