import { exportDirZipFormSingleFile } from "@/exporter/2x"
import { TChannel, TChannelPkgOptions } from "@/typings"

export const export2xMintegral = async (options: TChannelPkgOptions) => {
  const channel: TChannel = 'Mintegral'

  await exportDirZipFormSingleFile({
    ...options,
    channel,
  })
}