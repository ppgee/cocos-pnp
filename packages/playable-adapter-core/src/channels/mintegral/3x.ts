import { exportDirZipFormSingleFile } from "@/exporter/3x"
import { TChannel, TChannelPkgOptions } from "@/channels/base"

export const export3xMintegral = async (options: TChannelPkgOptions) => {
  const channel: TChannel = 'Mintegral'

  await exportDirZipFormSingleFile({
    ...options,
    channel,
  })
}