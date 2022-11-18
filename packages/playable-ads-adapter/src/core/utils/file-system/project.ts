import path from "path"
import { getGlobalProjectBuildPath, getGlobalProjectRootPath } from "@/core/global"
import { getRealPath } from "./resource"

export const getProjectRootPath = () => {
  return getRealPath(getGlobalProjectRootPath())
}

export const getProjectBuildPath = () => {
  return path.join(getProjectRootPath(), getGlobalProjectBuildPath())
}

export const get2xSingleFilePath = () => {
  return path.join(getProjectBuildPath(), '/single-file-2x.html')
}

export const get3xSingleFilePath = () => {
  return path.join(getProjectBuildPath(), '/single-file-3x.html')
}
