import { ADAPTER_FETCH, PLAYABLE_DEFAULT_CONFIG } from "../constants"
import { getProjectJson, writeToPath } from './file-system';
import https from 'https'
import { join } from "path";

export * from './file-system'

// 查看cocos引擎主版本
export const checkCocosVersion = (): '2' | '3' => {
  const { version } = getProjectJson()
  return <'2' | '3'>version.split('.').shift()
}

// 过滤XMLHttpRequest
export const removeXMLHttpRequest = (codeStr: string) => {
  return codeStr.replace(/XMLHttpRequest/g, ADAPTER_FETCH)
}

// 远程获取文件
export const getTextFromRemote = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      let data = '';
      // called when a data chunk is received.
      response.on('data', (chunk) => {
        data += chunk;
      });

      // called when the complete response is received.
      response.on('end', () => {
        resolve(data)
      });
    }).on("error", (error) => {
      reject(error)
    });
  })
}

export const getPlayableConfig = (options?: { orientation?: TWebOrientations, languages?: string[] }) => {
  const { orientation, languages } = options || {}

  const OrientationMap: { [key in TWebOrientations]: 0 | 1 | 2 } = {
    auto: 0,
    portrait: 1,
    landscape: 2
  }

  const playableConfig: TPlayableConfig = {
    playable_orientation: orientation ? OrientationMap[orientation] : PLAYABLE_DEFAULT_CONFIG.playable_orientation,
    playable_languages: languages || PLAYABLE_DEFAULT_CONFIG.playable_languages
  }

  return playableConfig
}

export const exportConfigJson = async (options: {
  destPath: string
  orientation?: TWebOrientations;
  languages?: string[];
}) => {
  const { destPath, orientation, languages } = options
  const playableConfig = getPlayableConfig({
    orientation,
    languages
  })
  const configJsonPath = join(destPath, '/config.json')
  writeToPath(configJsonPath, JSON.stringify(playableConfig))
}
