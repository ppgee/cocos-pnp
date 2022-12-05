import {
  TChannel,
  TChannelPkgOptions,
} from '@/typings'
import { getAdapterRCJson } from '@/utils'

type TChannelExport = { [key in TChannel]: (options: TChannelPkgOptions) => Promise<void> }

export const genChannelsPkg = (channelExports: TChannelExport, options: TChannelPkgOptions): Promise<void> => {
  return new Promise((resolve, reject) => {
    const { exportChannels = [] } = getAdapterRCJson() || {}

    let tasks: Promise<void>[] = []
    let channelKeys = exportChannels.length === 0 ? <TChannel[]>Object.keys(channelExports) : exportChannels
    channelKeys.forEach((key: TChannel) => {
      if (exportChannels.length === 0 || exportChannels.includes(key)) {
        tasks.push(channelExports[key](options))
      }
    })
    Promise.all(tasks)
      .then(() => {
        resolve()
      })
      .catch((err) => {
        console.error(err)
        reject(err)
      })
  })
}