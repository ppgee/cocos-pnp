import { exportSingleFile } from '@/core/exporter/3x'

export const export3xMoloco = async (options: TChannelPkgOptions) => {
  await exportSingleFile({
    ...options,
    channel: 'Moloco'
  })
}