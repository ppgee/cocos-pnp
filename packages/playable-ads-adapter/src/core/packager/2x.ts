import { getAdapterRCJson } from '@/core/utils'
import {
  export2xAppLovin,
  export2xFacebook,
  export2xGoogle,
  export2xIronSource,
  export2xLiftoff,
  export2xMintegral,
  export2xMoloco,
  export2xPangle,
  export2xRubeex,
  export2xTiktok,
  export2xUnity,
} from '@/core/channels'

const channelExports: { [key in TChannel]: (options: TChannelPkgOptions) => Promise<void> } = {
  AppLovin: export2xAppLovin,
  Facebook: export2xFacebook,
  Google: export2xGoogle,
  IronSource: export2xIronSource,
  Liftoff: export2xLiftoff,
  Mintegral: export2xMintegral,
  Moloco: export2xMoloco,
  Pangle: export2xPangle,
  Rubeex: export2xRubeex,
  Tiktok: export2xTiktok,
  Unity: export2xUnity,
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