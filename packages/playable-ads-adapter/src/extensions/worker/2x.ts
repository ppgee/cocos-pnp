import { parentPort, workerData } from 'worker_threads'
import { exec2xAdapter } from 'playable-adapter-core'

const task = async () => {
  try {
    const { buildFolderPath, adapterBuildConfig } = workerData
    await exec2xAdapter({
      buildFolderPath,
      adapterBuildConfig,
    }, {
      mode: 'serial'
    })

    parentPort?.postMessage({
      finished: true,
      msg: 'success'
    })
  } catch (error) {
    parentPort?.postMessage({
      finished: false,
      msg: error
    })
  }
}
task()