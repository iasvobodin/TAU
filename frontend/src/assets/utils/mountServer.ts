import { filesystem, os, server, events, resources, window as neuWindow } from '@neutralinojs/lib'

export const mountServer = async (mountPath: string, serverMountPoint: string = '') => {
  if (serverMountPoint === '') {
    // Удалим ведущую точку (.) для serverMountPoint, чтобы получилось '/tmp' из './tmp'
    serverMountPoint = '/' + mountPath.replace(/^\.\/?/, '')
  }

  // const serverMountPoint = '/' + mountPath.replace(/^\.\/?/, '')

  try {
    await filesystem.getStats(mountPath)
  } catch {
    await filesystem.createDirectory(mountPath)
    console.log(`📁 Директория "${mountPath}" была создана`)
  }

  try {
    const mounts = (await server.getMounts()) as unknown as Record<string, string>

    if (mounts[serverMountPoint] === mountPath) {
      console.log(`ℹ️ Сервер уже смонтирован: ${serverMountPoint} → ${mountPath}`)
    } else {
      await server.mount(serverMountPoint, mountPath)
      console.log(`✅ Сервер смонтирован: ${serverMountPoint} → ${mountPath}`)
    }
  } catch (error) {
    console.error('❌ Ошибка при монтировании сервера:', error)
  }
}
