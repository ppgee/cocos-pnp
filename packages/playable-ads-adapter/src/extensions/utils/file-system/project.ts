import { SETTINGS_PROJECT_PATH } from "@/extensions/constants"
import { getProjectRootPath, readToPath } from "@/core/utils"
import { ADAPTER_RC_PATH } from '@/extensions/constants'
import { existsSync } from "fs"

export const getExcludedModules = (): string[] => {
  // 获取未使用的模块
  const projectRootPath = getProjectRootPath()
  const projectJsonPath = `${projectRootPath}${SETTINGS_PROJECT_PATH}`
  const projectJson = JSON.parse(readToPath(projectJsonPath))
  return projectJson['excluded-modules'] || ['3D Physics/Builtin']
}

export const readAdapterRCFile = (): TAdapterRC | null => {
  const projectRootPath = getProjectRootPath()
  const adapterRCJsonPath = `${projectRootPath}${ADAPTER_RC_PATH}`
  if (existsSync(adapterRCJsonPath)) {
    return <TAdapterRC>JSON.parse(readToPath(adapterRCJsonPath))
  }

  return null
}
