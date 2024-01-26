import { parentPort, workerData } from 'worker_threads'
import { exec3xAdapter } from 'playable-adapter-core'

// 重写console的log和info方法，使其在主线程中打印
const overrideConsole = () => {
  const { log, info } = console
  console.log = (...args: any[]) => {
    parentPort?.postMessage({
      event: 'adapter:log',
      msg: args.join(' ')
    })
    log(...args)
  }
  console.info = (...args: any[]) => {
    parentPort?.postMessage({
      event: 'adapter:log',
      msg: args.join(' ')
    })
    info(...args)
  }
}

const task = async () => {
  try {
    // 重写console的log和info方法，使其在主线程中打印
    overrideConsole()

    const { buildFolderPath, adapterBuildConfig } = workerData
    await exec3xAdapter({
      buildFolderPath,
      adapterBuildConfig
    }, {
      mode: 'serial'
    })

    parentPort?.postMessage({
      finished: true,
      msg: 'success',
      event: 'adapter:finished'
    })
  } catch (error) {
    parentPort?.postMessage({
      finished: false,
      msg: error,
      event: 'adapter:finished'
    })
  }
}
task()