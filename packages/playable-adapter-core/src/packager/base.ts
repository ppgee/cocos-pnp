import {
  TChannel,
  TChannelPkgOptions,
} from '@/typings'
import { getAdapterRCJson } from '@/utils'

type TChannelExport = { [key in TChannel]: (options: TChannelPkgOptions) => Promise<void> }

export type TMode = 'parallel' | 'serial'

type TGenParams = { channelExports: TChannelExport, options: TChannelPkgOptions, resolve: (value: void | PromiseLike<void>) => void, reject: (reason?: any) => void }

const serialGen = async (params: TGenParams) => {
  const { channelExports, options, resolve, reject } = params
  try {
    const { exportChannels = [] } = getAdapterRCJson() || {}

    let channelKeys = exportChannels.length === 0 ? <TChannel[]>Object.keys(channelExports) : exportChannels

    for (let index = 0; index < channelKeys.length; index++) {
      const key = channelKeys[index];
      await channelExports[key](options)
    }

    resolve()
  } catch (error) {
    reject(error)
  }
}

const parallelGen = (params: TGenParams) => {
  const { channelExports, options, resolve, reject } = params

  const { exportChannels = [] } = getAdapterRCJson() || {}

  let channelKeys = exportChannels.length === 0 ? <TChannel[]>Object.keys(channelExports) : exportChannels

  let tasks: Promise<void>[] = []
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
}

export const genChannelsPkg = (channelExports: TChannelExport, options: TChannelPkgOptions, mode?: TMode): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    mode === 'serial'
      ? serialGen({
        channelExports,
        options,
        resolve,
        reject
      })
      : parallelGen({
        channelExports,
        options,
        resolve,
        reject
      })
  })
}