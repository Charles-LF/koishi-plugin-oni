import fs from "fs";

/**
 * 检查文件是否存在
 * @param filePath 文件路径
 * @returns true:存在 false:不存在
 */
export function checkFileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * 获取文件修改时间是否大于2天
 * @param filePath 文件路径
 * @returns true:大于2天 false:小于2天
 */
export function getFileModifyTime(filePath: string): boolean {
  const stats = fs.statSync(filePath);
  const fileModifiedTime = stats.mtime.getTime();
  const oneDay = 2 * 24 * 60 * 60 * 1000; // 48小时的毫秒数
  const now = Date.now();
  return now - fileModifiedTime > oneDay;
}
