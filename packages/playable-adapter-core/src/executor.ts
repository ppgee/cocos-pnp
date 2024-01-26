import { execTinify } from "@/helpers/tinify"
import { genSingleFile as gen2xSingleFile } from '@/merger/2x'
import { genSingleFile as gen3xSingleFile } from '@/merger/3x'
import { genChannelsPkg as gen2xChannelsPkg } from '@/packager/2x'
import { genChannelsPkg as gen3xChannelsPkg } from '@/packager/3x'
import { TMode } from "@/packager/base"
import { TAdapterRC } from "@/typings"
import { getAdapterRCJson } from "@/utils"
import { mountGlobalVars, unmountGlobalVars } from "@/global"

type TOptions = {
  buildFolderPath: string,
  adapterBuildConfig?: TAdapterRC | null
}

export const exec2xAdapter = async (options: TOptions, config?: { mode: TMode }) => {
  mountGlobalVars(options)
  try {
    // 执行压缩
    const { success, msg } = await execTinify()
    if (!success) {
      console.warn(`${msg}，aborting the image compression process`)
    }
  } catch (error) {
    console.error(error)
  }

  const { zipRes, notZipRes } = await gen2xSingleFile()
  const { orientation = 'auto' } = getAdapterRCJson() || {}
  const { mode = 'parallel' } = config ?? { mode: 'parallel' }
  await gen2xChannelsPkg({
    orientation,
    zipRes,
    notZipRes
  }, mode)
  unmountGlobalVars()
}

export const exec3xAdapter = async (options: TOptions, config?: { mode: TMode }) => {
  mountGlobalVars(options)
  try {
    const { success, msg } = await execTinify()
    if (!success) {
      console.warn(`${msg}，aborting the image compression process`)
    }
  } catch (error) {
    console.error(error)
  }

  const { zipRes, notZipRes } = await gen3xSingleFile()
  const { orientation = 'auto' } = getAdapterRCJson() || {}
  const { mode = 'parallel' } = config ?? { mode: 'parallel' }
  await gen3xChannelsPkg({
    orientation,
    zipRes,
    notZipRes
  }, mode)
  unmountGlobalVars()
}
