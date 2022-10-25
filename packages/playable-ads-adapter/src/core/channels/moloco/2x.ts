import { removeXMLHttpRequest } from "../../../utils"
import { exportSingleFile } from '../../builder-2x'

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