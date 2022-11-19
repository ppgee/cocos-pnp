import path from "path"
import { getGlobalProjectBuildPath } from "@/global"

export const get2xSingleFilePath = () => {
  return path.join(getGlobalProjectBuildPath(), '/single-file-2x.html')
}

export const get3xSingleFilePath = () => {
  return path.join(getGlobalProjectBuildPath(), '/single-file-3x.html')
}
