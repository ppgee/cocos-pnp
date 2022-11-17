import { exportZipFromPkg } from "@/core/builder-2x"

export const export2xMintegral = async (options: TChannelPkgOptions) => {
  await exportZipFromPkg({
    ...options,
    channel: 'Mintegral',
  })
}