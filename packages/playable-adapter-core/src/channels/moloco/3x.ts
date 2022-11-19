import { exportSingleFile } from '@/exporter/3x'
import { TChannel, TChannelPkgOptions } from "@/channels/base"

export const export3xMoloco = async (options: TChannelPkgOptions) => {
  const channel: TChannel = 'Moloco'

  await exportSingleFile({
    ...options,
    channel
  })
}