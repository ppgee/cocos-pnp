import { execTinify } from "@/helpers/tinify"
import { genSingleFile as gen2xSingleFile } from '@/merger/2x'
import { genSingleFile as gen3xSingleFile } from '@/merger/3x'
import { genChannelsPkg as gen2xChannelsPkg } from '@/packager/2x'
import { genChannelsPkg as gen3xChannelsPkg } from '@/packager/3x'
import { TWebOrientations } from "@/typings"
import { getAdapterRCJson } from "@/utils"

type TOptions = {
  orientation: TWebOrientations
}

export const exec2xAdapter = async (options: TOptions) => {
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
}

export const exec3xAdapter = async () => {
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
}
