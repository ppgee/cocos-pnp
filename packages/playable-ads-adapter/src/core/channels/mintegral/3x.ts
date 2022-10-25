import { exportZipFromPkg } from "../../builder-3x"

export const export3xMintegral = async (options: TChannelPkgOptions) => {
  await exportZipFromPkg({
    ...options,
    channel: 'Mintegral',
  })
}