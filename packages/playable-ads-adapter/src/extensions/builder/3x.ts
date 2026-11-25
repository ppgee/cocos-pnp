import { shell } from 'electron'
import { spawn } from 'child_process'
import { IBuildTaskOption, Platform } from "~types/packages/builder/@types";
import { run } from "node-cmd"
import { BUILDER_NAME } from "@/extensions/constants";
import { checkOSPlatform, getAdapterConfig, getRCSkipBuild, getRealPath } from "@/extensions/utils";
import { exec3xAdapter } from 'playable-adapter-core'
import workPath from '../worker/3x?worker'
import { join } from 'path';

const runV2CliBridge = (params: {
  projectRootPath: string
  originPkgPath: string
  outputDir: string
  extraArgs?: string[]
}): Promise<void> => {
  return new Promise((resolve, reject) => {
    const isWin = process.platform === 'win32'
    const cmd = isWin ? 'npx.cmd' : 'npx'
    const args = [
      '-y',
      '@ppgee/playable-cli',
      'build',
      params.originPkgPath,
      '-o',
      params.outputDir,
      '--target-size',
      'auto',
      '--encoding',
      'auto',
      '--check',
      '--report',
      join(params.outputDir, 'report.html'),
      ...(Array.isArray(params.extraArgs) ? params.extraArgs : [])
    ]
    console.log(`${BUILDER_NAME} 已启用 useV2Cli，调用命令: ${cmd} ${args.join(' ')}`)
    const child = spawn(cmd, args, {
      cwd: params.projectRootPath,
      shell: isWin
    })
    child.stdout?.on('data', (chunk: Buffer) => {
      console.log(chunk.toString('utf-8').trimEnd())
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      console.warn(chunk.toString('utf-8').trimEnd())
    })
    child.on('error', (err) => reject(err))
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`@ppgee/playable-cli exited with code ${code}`))
      }
    })
  })
}

const setupWorker = (params: { buildFolderPath: string; adapterBuildConfig: TAdapterRC}, successCb: Function, failCb: Function) => {
  const { Worker } = require('worker_threads')

  console.log('支持Worker，将开启子线程适配')
  const worker = new Worker(workPath, {
    workerData: params
  })
  worker.on('message', ({ finished, msg, event }: TWorkerMsg) => {
    if (event === 'adapter:finished') {
      finished ? successCb() : failCb(msg)
      return
    }
    // 处理消息 adapter:log 和 adapter:info
    console[event.split(':')[1] as ConsoleMethodName](msg)
  })
}

const runBuilder = (buildPlatform: TPlatform) => {
  return new Promise<void>((resolve, reject) => {
    let cocosBuilderPath = Editor.App.path
    const platform = checkOSPlatform()
    if (platform === 'MAC') {
      cocosBuilderPath = cocosBuilderPath.replace('/Resources/app.asar', '/MacOS/CocosCreator')
    } else if (platform === 'WINDOWS') {
      cocosBuilderPath = getRealPath(cocosBuilderPath).replace('/resources/app.asar', '/CocosCreator.exe')
    } else {
      reject(`不支持${platform}平台构建`)
    }

    const processRef = run(`${cocosBuilderPath} --project ${Editor.Project.path} --build "platform=${buildPlatform}"`, (err, data, stderr) => {
      console.log(err, data, stderr)
      resolve()
    })
    //listen to the python terminal output
    processRef.stdout.on('data', (data: string) => {
      console.log(data);
    });
  })
}

export const initBuildStartEvent = async (options: Partial<IBuildTaskOption>) => {
  console.log(`${BUILDER_NAME} 进行预构建处理`)
  console.log(`${BUILDER_NAME} 跳过预构建处理`)
}

export const initBuildFinishedEvent = (options: Partial<IBuildTaskOption>) => {
  return new Promise(async (resolve, reject) => {
    const {
      projectRootPath,
      projectBuildPath,
      originPkgPath,
      adapterBuildConfig,
    } = getAdapterConfig()

    const buildFolderPath = join(projectRootPath, projectBuildPath)

    console.info(`${BUILDER_NAME} 开始适配，导出平台 ${options.platform}`)

    const start = new Date().getTime();

    const handleExportFinished = () => {
      const end = new Date().getTime();
      console.log(`${BUILDER_NAME} 适配完成，共耗时${((end - start) / 1000).toFixed(0)}秒`)
      resolve(true)
    }
    const handleExportError = (err: string) => {
      console.error('适配失败')
      reject(err)
    }

    if (adapterBuildConfig?.useV2Cli) {
      const inputDir = options.platform
        ? join(buildFolderPath, options.platform)
        : originPkgPath
      const outputDir = join(buildFolderPath, 'playable-v2')
      runV2CliBridge({
        projectRootPath,
        originPkgPath: inputDir,
        outputDir,
        extraArgs: adapterBuildConfig.v2CliArgs
      })
        .then(handleExportFinished)
        .catch((err) => handleExportError(err instanceof Error ? err.message : String(err)))
      return
    }

    const params = {
      buildFolderPath,
      adapterBuildConfig: {
        ...adapterBuildConfig,
        buildPlatform: options.platform!
      },
    }

    try {
      setupWorker(params, handleExportFinished, handleExportError)
    } catch (error) {
      console.log('不支持Worker，将开启主线程适配')

      await exec3xAdapter(params, {
        mode: 'serial'
      })
      handleExportFinished()
    }
  })
}

export const builder3x = async () => {
  try {
    // 初始化 start
    const {
      buildPlatform,
      projectRootPath,
      projectBuildPath,
    } = getAdapterConfig()
    // 初始化 end
    console.log(`开始构建项目，导出${buildPlatform}包`)
    const isSkipBuild = getRCSkipBuild()
    const buildPath = join(projectRootPath, projectBuildPath)

    await initBuildStartEvent({
      platform: buildPlatform
    })
    if (!isSkipBuild) {
      await runBuilder(buildPlatform)
    }
    await initBuildFinishedEvent({
      platform: buildPlatform
    })
    shell.openPath(buildPath)
    console.log('构建完成')
  } catch (error) {
    console.error(error)
  }
}
