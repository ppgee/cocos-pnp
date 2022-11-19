import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmdirSync, statSync, unlinkSync, writeFileSync } from "fs";
import jszip from "jszip";
import path from "path";

// 查询文件大小
export const getFileSize = (filePath: string) => {
  return statSync(filePath).size
}

// 获取所有目录下所有文件
export const getAllFilesFormDir = (dirPath: string): string[] => {
  let files: string[] = []
  let dirList = readdirSync(dirPath);//读取目录中的所有文件及文件夹（同步操作）
  dirList.forEach((fileName) => {//遍历检测目录中的文件
    let filePath = path.join(dirPath, fileName);
    let file = statSync(filePath);//获取一个文件的属性
    if (file.isDirectory()) {//如果是目录的话，继续查询
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
   * 判断给定的路径是否存在
   */
  if (existsSync(dest)) {
    /**
     * 返回文件和子目录的数组
     */
    files = readdirSync(dest);
    files.forEach(function (file, index) {
      const curPath = path.join(dest, file);
      /**
       * statSync同步读取文件夹文件，如果是文件夹，在重复触发函数
       */
      if (statSync(curPath).isDirectory()) { // recurse
        rmSync(curPath);
      } else {
        unlinkSync(curPath);
      }
    });
    /**
     * 清除文件夹
     */
    rmdirSync(dest);
  } else {
    console.warn("给定的路径不存在，请给出正确的路径");
  }
}

/**
 * 文件夹复制
 * @param {string} source 源文件夹
 * @param {string} destination 目标文件夹
 */
export const cpSync = (source: string, destination: string) => {
  // 如果存在文件夹 先递归删除该文件夹
  if (existsSync(destination)) rmSync(destination)
  // 新建文件夹 递归新建
  mkdirSync(destination, { recursive: true });
  // 读取源文件夹
  let rd = readdirSync(source)
  for (const fd of rd) {
    // 循环拼接源文件夹/文件全名称
    let sourceFullName = path.join(source, fd);
    // 循环拼接目标文件夹/文件全名称
    let destFullName = path.join(destination, fd);
    // 读取文件信息
    let lstatRes = lstatSync(sourceFullName)
    // 是否是文件
    if (lstatRes.isFile()) copyFileSync(sourceFullName, destFullName);
    // 是否是文件夹
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

export const zipToPath = (filePath: string): Promise<void> => {
  return new Promise((resolve, reject) => {

    const filename = path.basename(filePath)
    const extname = path.extname(filePath)
    const zipPath = filePath.replace(extname, '.zip')

    // 查看是否存在文件
    if (existsSync(zipPath)) {
      unlinkSync(zipPath);
    }

    let zip = new jszip();
    zip.file(filename, readFileSync(filePath))
    zip.generateAsync({//设置压缩格式，开始打包
      type: "nodebuffer",//nodejs用
      compression: "DEFLATE",//压缩算法
      compressionOptions: {//压缩级别
        level: 9
      }
    }).then((content) => {
      writeFileSync(zipPath, content, 'utf-8');//将打包的内容写入 当前目录下的 result.zip中
      resolve()
    }).catch((err) => {
      reject(err)
    });
  })
}

export const zipDirToPath = (destPath: string): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const zipPath = `${destPath}.zip`

    // 查看是否存在文件
    if (existsSync(zipPath)) {
      unlinkSync(zipPath);
    }

    let zip = new jszip();

    //读取目录及文件
    const files = getAllFilesFormDir(destPath)
    files.forEach((filePath: string) => {
      const filename = filePath.replace(destPath, '')
      zip.file(filename, readFileSync(filePath))
    })

    zip.generateAsync({//设置压缩格式，开始打包
      type: "nodebuffer",//nodejs用
      compression: "DEFLATE",//压缩算法
      compressionOptions: {//压缩级别
        level: 9
      }
    }).then((content) => {
      writeFileSync(zipPath, content);//将打包的内容写入 当前目录下的 result.zip中
      resolve(true)
    }).catch((err) => {
      reject(err)
    });
  })
}