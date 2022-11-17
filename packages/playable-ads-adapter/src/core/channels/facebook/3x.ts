import { exportDirZipFormSingleFile } from "@/core/builder-3x"

export const export3xFacebook = async (options: TChannelPkgOptions) => {
  await exportDirZipFormSingleFile({
    ...options,
    channel: 'Facebook'
  })
}