import { storage, window as neuWindow } from '@neutralinojs/lib'

export const openSecondWindow = async (
  serverPath: string,
  pdfName: string,
  serverPoint: string = ''
): Promise<void> => {
  const isDev = import.meta.env.MODE === 'development'
  const baseUrl = isDev ? 'http://localhost:5173/print-pdf' : '/print-pdf'

  if (serverPoint !== '') {
    await storage.setData('serverPoint', serverPoint)
  }
  await storage.setData('serverPath', serverPath)
  await storage.setData('pdfName', pdfName)

  try {
    const a = await neuWindow.create(baseUrl, {
      x: 0,
      y: 0,
      title: pdfName,
      width: 700,
      height: 950,
      maximizable: false,
      exitProcessOnClose: true
      // enableInspector: true,
      // processArgs: '--window-name=myWindow'
    })
    console.log(a)
  } catch (error) {
    console.log(error)
  }
}
