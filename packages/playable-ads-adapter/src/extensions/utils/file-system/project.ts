import { SETTINGS_PROJECT_PATH } from "@/extensions/constants"
import { readToPath } from "./base"

export const getExcludedModules = (): string[] => {
  // 获取未使用的模块
  const projectRootPath = Editor.Project.path
  const projectJsonPath = `${projectRootPath}${SETTINGS_PROJECT_PATH}`
  const projectJson = JSON.parse(readToPath(projectJsonPath))
  return projectJson['excluded-modules'] || ['3D Physics/Builtin']
}
