import os from 'os'

export const checkOSPlatform = () => {
  const platform = os.platform()
  if (platform === 'win32') {
    return 'WINDOWS'
  } else if (platform === 'darwin') {
    return 'MAC'
  }

  return platform.toUpperCase()
}