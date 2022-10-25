import { exportSingleFile } from '../../builder-3x'

export const export3xMoloco = async (options: TChannelPkgOptions) => {
  await exportSingleFile({
    ...options,
    channel: 'Moloco'
  })
}