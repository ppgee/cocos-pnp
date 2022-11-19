import { ADAPTER_FETCH, PLAYABLE_DEFAULT_CONFIG, TPlayableConfig } from "@/constants"
import { writeToPath } from './file-system';
import { join } from "path";
import { TWebOrientations } from "@/global";

const getPlayableConfig = (options?: { orientation?: TWebOrientations, languages?: string[] }) => {
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

// 过滤XMLHttpRequest
export const removeXMLHttpRequest = (codeStr: string) => {
  return codeStr.replace(/XMLHttpRequest/g, ADAPTER_FETCH)
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