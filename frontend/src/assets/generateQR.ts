// // generateQr.ts
// import bwipjs from 'bwip-js'
// import type { SerialNumberData } from '@/assets/interfaces'
// import QRCodeStyling from 'qr-code-styling'

// export const generateQr = async (item: SerialNumberData): Promise<string> => {
//   const canvas = document.createElement('canvas')

//   // Формируем URL с параметрами folder и subfolder
//   const baseUrl = 'https://iasvobodin.github.io/tau-yandex-oauth-test/'
//   const url = `${baseUrl}?folder=${encodeURIComponent(item.invoice!)}&subfolder=${encodeURIComponent(item.name)}`

//   try {
//     bwipjs.toCanvas(canvas, {
//       bcid: 'qrcode',
//       text: url,
//       scale: 3,
//       includetext: false
//     })
//     return canvas.toDataURL('image/png')
//   } catch (error) {
//     throw new Error(`Failed to generate QR code: ${error}`)
//   }
// }

import type { SerialNumberData } from '@/assets/interfaces'
import QRCodeStyling from 'qr-code-styling'
import tau from './././../../public/ТАУ.svg'
export const generateQr = async (item: SerialNumberData): Promise<string> => {
  const baseUrl = 'https://iasvobodin.github.io/tau-yandex-oauth-test/'
  const url = `${baseUrl}?folder=${encodeURIComponent(item.invoice!)}&subfolder=${encodeURIComponent(item.name)}`

  const qrCode = new QRCodeStyling({
    width: 400,
    height: 400,
    type: 'canvas',
    data: url,
    margin: 1,
    image: tau,
    imageOptions: { saveAsBlob: true, hideBackgroundDots: true, imageSize: 0.7, margin: 10 },
    dotsOptions: { type: 'classy-rounded', color: '#000000' },
    backgroundOptions: { color: '#ffffff' },
    cornersSquareOptions: { type: 'extra-rounded', color: '#000000' },
    cornersDotOptions: { type: 'dot', color: '#000000' }
  })

  const rawData = await qrCode.getRawData('png')
  if (!rawData) {
    throw new Error('Failed to generate QR data')
  }

  // В браузере будет Blob → работаем с ним
  if (rawData instanceof Blob) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(rawData)
    })
  }

  // Если вдруг Buffer (Node.js), кидаем исключение
  throw new Error('QR code generated as Buffer — use only in browser environment')
}
