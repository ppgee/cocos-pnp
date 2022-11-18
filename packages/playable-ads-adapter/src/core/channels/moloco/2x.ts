import { removeXMLHttpRequest } from "@/core/utils"
import { exportSingleFile } from '@/core/exporter/2x'

export const export2xMoloco = async (options: TChannelPkgOptions) => {
  await exportSingleFile({
    ...options,
    channel: 'Moloco',
    transformHTML: async ($) => {
      const htmlStr = removeXMLHttpRequest($('html').html() || '')
      $('html').html(htmlStr)
    }
  })
}