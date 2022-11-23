import { execTinify } from "@/helpers/tinify"
import { genSingleFile as gen2xSingleFile } from '@/merger/2x'
import { genSingleFile as gen3xSingleFile } from '@/merger/3x'
import { genChannelsPkg as gen2xChannelsPkg } from '@/packager/2x'
import { genChannelsPkg as gen3xChannelsPkg } from '@/packager/3x'
import { TAdapterRC, TPlatform, TWebOrientations } from "@/typings"
import { getAdapterRCJson } from "@/utils"
import { mountGlobalVars, unmountGlobalVars } from "@/global"

type TOptions = {
  buildFolderPath: string,
  platform: TPlatform,
  adapterBuildConfig?: TAdapterRC | null
}

export const exec2xAdapter = async (options: TOptions & {
  orientation: TWebOrientations
}) => {
  mountGlobalVars(options)
  try {
    // 执行压缩
    const { success, msg } = await execTinify()
    if (!success) {
      console.warn(`${msg}，跳出压缩图片流程`)
    }
  } catch (error) {
    console.error(error)
  }

  await gen2xSingleFile()
  // 适配文件
  await gen2xChannelsPkg({
    orientation: options.orientation
  })
  unmountGlobalVars()
}

export const exec3xAdapter = async (options: TOptions) => {
  mountGlobalVars(options)
  try {
    // 执行压缩
    const { success, msg } = await execTinify()
    if (!success) {
      console.warn(`${msg}，跳出压缩图片流程`)
    }
  } catch (error) {
    console.error(error)
  }

  const { zipRes, notZipRes } = await gen3xSingleFile()
  // 适配文件
  const { orientation = 'auto' } = getAdapterRCJson() || {}
  await gen3xChannelsPkg({
    orientation,
    zipRes,
    notZipRes
  })
  unmountGlobalVars()
}
