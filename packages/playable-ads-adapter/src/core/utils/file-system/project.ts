import path from "path"
import { getGlobalInjectsPath, getGlobalProjectBuildPath, getGlobalProjectRootPath } from "@/core/global"
import { readToPath } from "./base"
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

export const getGameInitInjectScript = () => {
  return readToPath(path.join(getGlobalInjectsPath(), './init.js'))
}

export const getGameMainInjectScript = () => {
  return readToPath(path.join(getGlobalInjectsPath(), './main.js'))
}

export const getJSZipInjectScript = () => {
  return readToPath(path.join(getGlobalInjectsPath(), './jszip.js'))
}
