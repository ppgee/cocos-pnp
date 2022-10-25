import { getChannelRCSdkScript } from "../../../utils"
import { exportZipFromPkg } from "../../builder-3x"
import { AD_SDK_SCRIPT } from "./inject-vars"

export const export3xLiftoff = async (options: TChannelPkgOptions) => {
  const channel: TChannel = 'Liftoff'
  await exportZipFromPkg({
    ...options,
    channel,
    transformHTML: async ($) => {
      const sdkInjectScript = getChannelRCSdkScript(channel) || AD_SDK_SCRIPT
      $(sdkInjectScript).appendTo('head')
    }
  })
}