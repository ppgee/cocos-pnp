import { exportDirZipFromSingleFile } from "@/exporter/3x"
import { TChannel, TChannelPkgOptions } from "@/typings"

export const export3xMintegral = async (options: TChannelPkgOptions) => {
  const channel: TChannel = 'Mintegral'

  await exportDirZipFromSingleFile({
    ...options,
    channel,
  })
}