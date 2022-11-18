import { exportDirZipFormSingleFile } from "@/core/exporter/3x"

export const export3xFacebook = async (options: TChannelPkgOptions) => {
  await exportDirZipFormSingleFile({
    ...options,
    channel: 'Facebook'
  })
}