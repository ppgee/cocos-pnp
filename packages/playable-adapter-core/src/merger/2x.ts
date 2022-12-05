import { genSingleFile as baseGenSingleFile } from './base'
import {
  get2xSingleFilePath,
} from '@/utils'
import {
  injects2xCode,
} from '@/helpers/injects'

export const genSingleFile = async () => {
  const resp = await baseGenSingleFile({
    injectsCode: injects2xCode,
    singleFilePath: get2xSingleFilePath()
  })

  return resp
}