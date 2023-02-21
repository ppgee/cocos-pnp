import {
  TChannel,
  TChannelPkgOptions,
} from '@/typings'
import { genChannelsPkg as baseGenChannelsPkg, TMode } from './base'
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
} from '@/channels'

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

export const genChannelsPkg = (options: TChannelPkgOptions, mode?: TMode): Promise<void> => {
  return baseGenChannelsPkg(channelExports, options, mode ?? 'parallel')
}