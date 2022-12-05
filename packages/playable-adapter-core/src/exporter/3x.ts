import { TBuilderOptions, TZipFromSingleFileOptions } from "@/typings"
import { get3xSingleFilePath } from "@/utils"
import {
  exportSingleFile as baseExportSingleFile,
  exportZipFromPkg as baseExportZipFromPkg,
  exportDirZipFromSingleFile as baseExportDirZipFromSingleFile
} from './base'

export const exportSingleFile = async (options: TBuilderOptions) => {
  await baseExportSingleFile(get3xSingleFilePath(), options)
}

export const exportZipFromPkg = async (options: TBuilderOptions) => {
  await baseExportZipFromPkg(options)
}

export const exportDirZipFromSingleFile = async (options: TZipFromSingleFileOptions) => {
  await baseExportDirZipFromSingleFile(get3xSingleFilePath(), options)
}