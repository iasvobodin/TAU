<template>
  <v-container class="text-center">
    <v-row justify="center">
      <v-col cols="12" md="6" sm="6">
        <v-btn @click="createDocWithBarcodes(props.barcodes)" rounded="lg" size="x-large" block
          >Сохранить .docx</v-btn
        >
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import bwipjs from 'bwip-js'
import {
  Document,
  Packer,
  Paragraph,
  ImageRun,
  Media,
  SectionProperties,
  type ISectionOptions,
  type PositiveUniversalMeasure
} from 'docx'
import { filesystem, os } from '@neutralinojs/lib'

const props = defineProps({
  barcodes: {
    type: Array as () => string[],
    required: true
  }
})

const generateBarcodeDataUrl = (data: string): string => {
  try {
    const canvas = document.createElement('canvas')
    bwipjs.toCanvas(canvas, {
      bcid: 'code128', // Тип штрихкода
      text: data, // Текст для штрихкода
      scale: 5, // Масштаб
      height: 30, // Высота
      includetext: true, // Включить текст под штрихкодом
      textxalign: 'center' // Выравнивание текста
    })
    return canvas.toDataURL('image/png')
  } catch (error) {
    console.error('Error generating barcode:', error)
    throw error
  }
}

const createDocWithBarcodes = async (barcodes: string[]) => {
  // Размеры страницы в twips (1 twip = 1/1440 дюйма)
  const customWidth = '50mm' as PositiveUniversalMeasure // 45 мм в twips
  const customHeight = '30mm' as PositiveUniversalMeasure // 30 мм в twips
  // Настройки для секции с кастомными размерами
  const sectionProperties = {
    page: {
      size: { width: customWidth, height: customHeight },
      margin: { top: 0, right: 0, bottom: 0, left: 0 }
    }
  }

  const sections = []

  for (const barcode of barcodes) {
    try {
      const barcodeDataUrl = generateBarcodeDataUrl(barcode)
      const imageBuffer = await fetch(barcodeDataUrl).then((res) => res.arrayBuffer())

      const paragraph = new Paragraph({
        children: [
          new ImageRun({
            data: imageBuffer,
            type: 'png',
            transformation: {
              width: 200,
              height: 100
            }
          })
        ]
      })

      sections.push({
        properties: sectionProperties,
        children: [paragraph]
      })
    } catch (error) {
      console.error('Error generating barcode:', error)
    }
  }

  const today = new Date()
  const formattedDate = `${today.getDate()}_${today.getMonth() + 1}_${today.getFullYear()}_${today.getMinutes()}`
  const fileName = `barcodes_${formattedDate}.docx`
  const doc = new Document({ sections })

  try {
    const blob = await Packer.toBlob(doc)
    const arrayBuffer = await blob.arrayBuffer()
    let entry = await os.showSaveDialog('Сохранить файл', {
      defaultPath: fileName,
      filters: [{ name: 'Documents', extensions: ['docx'] }]
    })
    await filesystem.writeBinaryFile(entry, arrayBuffer)
    console.log('Document created successfully')
  } catch (error) {
    console.error('Error creating document:', error)
  }
}
</script>
