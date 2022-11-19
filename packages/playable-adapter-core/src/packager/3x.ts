import { getAdapterRCJson } from '@/utils'
import {
  export3xAppLovin,
  export3xFacebook,
  export3xGoogle,
  export3xIronSource,
  export3xLiftoff,
  export3xMintegral,
  export3xMoloco,
  export3xPangle,
  export3xRubeex,
  export3xTiktok,
  export3xUnity,
  TChannel,
  TChannelPkgOptions,
} from '@/channels'

const channelExports: { [key in TChannel]: (options: TChannelPkgOptions) => Promise<void> } = {
  AppLovin: export3xAppLovin,
  Facebook: export3xFacebook,
  Google: export3xGoogle,
  IronSource: export3xIronSource,
  Liftoff: export3xLiftoff,
  Mintegral: export3xMintegral,
  Moloco: export3xMoloco,
  Pangle: export3xPangle,
  Rubeex: export3xRubeex,
  Tiktok: export3xTiktok,
  Unity: export3xUnity,
}

export const genChannelsPkg = (options: TChannelPkgOptions): Promise<void> => {
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