import { resolve } from 'node:path'
import which from 'which'

export function extraResolve(filePath) {
  // Vite 打包 preload/main 时 import.meta.env.MODE 恒为 production，
  // 开发模式需用 IS_PACKAGED 区分，否则语言包等资源路径会解析错误。
  const isPackaged = process.env.IS_PACKAGED === 'true'

  const basePath = isPackaged
    ? process.resourcesPath
    : resolve(process.env.CWD || process.cwd(), 'electron/resources')

  return resolve(basePath, 'extra', filePath)
}

export function buildResolve(value) {
  return resolve(`electron/resources/build/${value}`)
}

export function whichResolve(command) {
  return which.sync(command, { nothrow: true, path: process.env.PATH })
}
