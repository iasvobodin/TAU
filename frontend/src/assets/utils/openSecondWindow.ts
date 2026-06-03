import { storage, window as neuWindow } from '@neutralinojs/lib'

export const openSecondWindow = async (
  serverPath: string,
  pdfName: string,
  serverPoint: string = '',
  customPath?: string,
  componentName?: string
): Promise<void> => {
  const isDev = import.meta.env.MODE === 'development'
  const devHost = 'http://localhost:5173'

  const targetPath = customPath || '/print-pdf'
  const query = `?view=${componentName}` // Передаем имя нужного компонента
  const finalUrl = isDev ? `${devHost}${targetPath}${query}` : `${targetPath}${query}`

  if (serverPoint !== '') {
    await storage.setData('serverPoint', serverPoint)
  }
  await storage.setData('serverPath', serverPath)
  await storage.setData('pdfName', pdfName)

  try {
    const a = await neuWindow.create(finalUrl, {
      x: 0,
      y: 0,
      title: pdfName,
      width: 700,
      height: 950,
      maximizable: false,
      exitProcessOnClose: true,
      enableInspector: false
      // processArgs: '--window-name=myWindow'
    })
    console.log(a)
  } catch (error) {
    console.log(error)
  }
}
