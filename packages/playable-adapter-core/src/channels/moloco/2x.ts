import { TChannel, TChannelPkgOptions } from "@/typings"
import { exportSingleFile } from '@/exporter/2x'

export const export2xMoloco = async (options: TChannelPkgOptions) => {
  const channel: TChannel = 'Moloco'

  await exportSingleFile({
    ...options,
    channel
  })
}