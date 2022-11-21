import { exportDirZipFormSingleFile } from "@/exporter/3x"
import { TChannel, TChannelPkgOptions } from "@/typings"

export const export3xFacebook = async (options: TChannelPkgOptions) => {
  const channel: TChannel = 'Facebook'

  await exportDirZipFormSingleFile({
    ...options,
    channel
  })
}