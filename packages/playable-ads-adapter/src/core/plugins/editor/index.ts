import { Platform } from "../../../../@types/packages/builder/@types"
import { getAdapterRCJson } from "../../../utils"

export const mountBuildGlobalVars = (options: { platform: Platform }) => {
  global.__adapter_build_platform__ = options.platform
  global.__adapter_build_config__ = getAdapterRCJson()
}

export const destroyBuildGlobalVars = () => {
  global.__adapter_build_platform__ = null
  global.__adapter_build_config__ = null
}