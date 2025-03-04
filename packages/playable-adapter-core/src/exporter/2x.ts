import { TBuilderOptions, TZipFromSingleFileOptions } from "@/typings";
import { get2xSingleFilePath } from "@/utils";
import {
  exportZipFromSingleFile as baseExportDirZipFromSingleFile,
  exportSingleFile as baseExportSingleFile,
  exportZipFromPkg as baseExportZipFromPkg
} from './base';

export const exportSingleFile = async (options: TBuilderOptions) => {
  await baseExportSingleFile(get2xSingleFilePath(), options)
}

export const exportZipFromPkg = async (options: TBuilderOptions) => {
  await baseExportZipFromPkg(options)
}

export const exportDirZipFromSingleFile = async (options: TZipFromSingleFileOptions) => {
  await baseExportDirZipFromSingleFile(get2xSingleFilePath(), options)
}