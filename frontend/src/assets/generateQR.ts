import type { SerialNumberData } from '@/assets/interfaces'
import QRCodeStyling from 'qr-code-styling'
import tau from './././../../public/ТАУ.svg'
import { getCurrentMonthYear } from './utils/getCurrentMonthYear'

export const generateQr = async (item: SerialNumberData): Promise<string> => {
  // const baseUrl = 'https://yandex-o-auth.vercel.app/'
  const baseUrl = 'https://d5d0jbobvpnectuin15p.wnq2w1o5.apigw.yandexcloud.net/'
  const url = `${baseUrl}?folder=${encodeURIComponent(getCurrentMonthYear())}&subfolder=${encodeURIComponent(item.name)}`
  console.log(url, 'url')

  const qrCode = new QRCodeStyling({
    width: 400,
    height: 400,
    type: 'canvas',
    data: url,
    margin: 10,
    image: tau,
    imageOptions: { saveAsBlob: true, hideBackgroundDots: true, imageSize: 0.5, margin: 10 },
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
