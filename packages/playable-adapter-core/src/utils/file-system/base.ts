import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmdirSync, statSync, unlinkSync, writeFileSync } from "fs";
import path from "path";

// Query file size
export const getFileSize = (filePath: string) => {
  return statSync(filePath).size
}

// Get all files in all directories
export const getAllFilesFormDir = (dirPath: string): string[] => {
  let files: string[] = []
  let dirList = readdirSync(dirPath); // Read all files and directories in the directory (synchronous operation)
  dirList.forEach((fileName) => { // Traverse to check the files in the directory
    let filePath = path.join(dirPath, fileName);
    let file = statSync(filePath); // Get the properties of a file
    if (file.isDirectory()) { // If it is a directory, continue searching
      files = files.concat(getAllFilesFormDir(filePath))
    } else {
      files.push(filePath)
    }
  });

  return files
}

export const rmSync = (dest: string) => {
  let files = [];
  /**
   * Check if the given path exists
   */
  if (existsSync(dest)) {
    /**
     * Return an array of files and subdirectories
     */
    files = readdirSync(dest);
    files.forEach(function (file, index) {
      const curPath = path.join(dest, file);
      /**
       * statSync synchronously reads folder files, if it is a folder, trigger the function again
       */
      if (statSync(curPath).isDirectory()) { // recurse
        rmSync(curPath);
      } else {
        unlinkSync(curPath);
      }
    });
    /**
     * Clear the directory
     */
    rmdirSync(dest);
  } else {
    console.warn("The given path does not exist, please provide the correct path");
  }
}

/**
 * Directory copy
 * @param {string} source Source directory
 * @param {string} destination Target directory
 */
export const cpSync = (source: string, destination: string) => {
  // If the folder exists, recursively delete it first
  if (existsSync(destination)) rmSync(destination)
  // Create a new folder recursively
  mkdirSync(destination, { recursive: true });
  // Read the source folder
  let rd = readdirSync(source)
  for (const fd of rd) {
    // Loop to concatenate the full name of source folder/file
    let sourceFullName = path.join(source, fd);
    // Loop to concatenate the full name of target folder/file
    let destFullName = path.join(destination, fd);
    // Read file information
    let lstatRes = lstatSync(sourceFullName)
    // If it is a file
    if (lstatRes.isFile()) copyFileSync(sourceFullName, destFullName);
    // If it is a directory
    if (lstatRes.isDirectory()) cpSync(sourceFullName, destFullName);
  }
}

export const readToPath = (filepath: string, encoding?: BufferEncoding) => {
  const fileBuffer = readFileSync(filepath)
  return fileBuffer.toString(encoding)
}

export const writeToPath = (filepath: string, data: string | NodeJS.ArrayBufferView) => {
  writeFileSync(filepath, data)
}

export const copyDirToPath = (src: string, dest: string) => {
  cpSync(src, dest)
}
