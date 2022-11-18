import { exportDirZipFormSingleFile } from "@/core/exporter/3x"

export const export3xMintegral = async (options: TChannelPkgOptions) => {
  await exportDirZipFormSingleFile({
    ...options,
    channel: 'Mintegral',
  })
}