import { parentPort, workerData } from 'worker_threads'
import { exec2xAdapter } from 'playable-adapter-core'

const task = async () => {
  const { buildFolderPath, adapterBuildConfig } = workerData
  await exec2xAdapter({
    buildFolderPath,
    adapterBuildConfig,
  }, {
    mode: 'serial'
  })

  parentPort?.postMessage(true)
}
task()