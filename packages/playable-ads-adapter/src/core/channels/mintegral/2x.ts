import { exportZipFromPkg } from "@/core/exporter/2x"

export const export2xMintegral = async (options: TChannelPkgOptions) => {
  await exportZipFromPkg({
    ...options,
    channel: 'Mintegral',
  })
}