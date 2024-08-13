import { SVG, Svg } from '@svgdotjs/svg.js'

// Основная функция для создания SVG
export function createSvg(
  width: number,
  height: number,
  margin: number,
  image1: ArrayBuffer,
  image2: ArrayBuffer,
  partNumber: string,
  serialNumber: string,
  description: string,
  bottomText: string
): string {
  // Создаем SVG контейнер
  const draw: Svg = SVG().size(width, height)

  // Конвертируем ArrayBuffer в base64 для использования в SVG
  const img1Base64 = arrayBufferToBase64(image1)
  const img2Base64 = arrayBufferToBase64(image2)

  // Высота изображений
  const imageHeight = 10 // 10 мм (можно задать в пикселях в зависимости от DPI)

  // Рендер изображений
  draw.image(`data:image/png;base64,${img1Base64}`).size('auto', imageHeight).move(margin, margin)
  draw
    .image(`data:image/png;base64,${img2Base64}`)
    .size('auto', imageHeight)
    .move(width - margin - imageHeight, margin)

  // Позиции для текста
  const textStartY = margin + imageHeight + margin
  const textIndent = margin
  const lineSpacing = 1.2 // Коэффициент между строками

  // Рендер текста
  draw.text(partNumber).move(textIndent, textStartY).font({ size: 12 })
  draw
    .text(serialNumber)
    .move(textIndent, textStartY + 20)
    .font({ size: 12 })

  // Обрезка и рендер длинного текста
  const wrappedDescription = wrapText(description, width - 2 * margin)
  draw
    .text(wrappedDescription)
    .move(textIndent, textStartY + 40)
    .font({ size: 12 })

  // Текст в нижнем правом углу
  const bottomTextY = height - margin - 40
  draw
    .text(bottomText)
    .move(width - margin - 100, bottomTextY)
    .font({ size: 12 })

  // Генерация SVG
  const svgString = draw.svg()

  // Конвертация SVG в ArrayBuffer
  const encoder = new TextEncoder()
  const svgBuffer = encoder.encode(svgString)

  //   return svgBuffer.buffer

  // Конвертация SVG в Base64
  const svgBase64 = svgToBase64(svgString)

  return svgBase64
}

// Вспомогательная функция для обрезки длинного текста
function wrapText(text: string, maxWidth: number): string {
  // Здесь можно добавить логику для переноса строк, например, используя canvas.measureText
  // Пока что просто вернем текст без переноса
  return text
}

// Функция для конвертации ArrayBuffer в Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// Функция для конвертации SVG строки в Base64
function svgToBase64(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(encodeURIComponent(svg))}`
}
