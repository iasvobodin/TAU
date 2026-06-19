<script setup lang="ts">
import { ref } from 'vue'
import { printPassport } from '@/assets/docxProcessor'
import { PDFDocument } from 'pdf-lib'
import { filesystem } from '@neutralinojs/lib'
import { openSecondWindow } from '@/assets/utils/openSecondWindow'
const partNumber = ref('')
const serialsText = ref('')
const loading = ref(false)

import { appConfig } from '@/assets/utils/AppConfig'

const CONFIG = {
  scriptName: 'convert.ps1',
  convertPath: './convertFolder',
  resourcesPath: '/frontend/dist/',
  passportDir: appConfig.paths.passports,
  searchKey: 'плата 2'
}

function parseSerials(text: string): string[] {
  return text
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

function reorderPagesForPrint(indices: number[]): number[] {
  // ожидаем 4 страницы
  if (indices.length !== 4) return indices

  return [indices[3], indices[0], indices[1], indices[2]]
}

async function processPdf(filePath: string): Promise<Uint8Array> {
  const bytes = await filesystem.readBinaryFile(filePath)
  const pdf = await PDFDocument.load(bytes)

  const newPdf = await PDFDocument.create()

  const pageIndices = pdf.getPageIndices()
  const reordered = reorderPagesForPrint(pageIndices)

  const pages = await newPdf.copyPages(pdf, reordered)
  pages.forEach((p) => newPdf.addPage(p))

  return await newPdf.save()
}

async function mergeAndReorderPdfs(inputFiles: string[], outputFile: string) {
  const finalPdf = await PDFDocument.create()

  for (const file of inputFiles) {
    const processedBytes = await processPdf(file)
    const pdf = await PDFDocument.load(processedBytes)

    const pages = await finalPdf.copyPages(pdf, pdf.getPageIndices())
    pages.forEach((p) => finalPdf.addPage(p))
  }

  const result = await finalPdf.save()
  await filesystem.writeBinaryFile(outputFile, result.buffer as ArrayBuffer)
}

async function cleanupDocx(partNumber: string, serials: string[]) {
  for (const sn of serials) {
    const path = `${CONFIG.convertPath}/${partNumber}__${sn}.docx`
    try {
      await filesystem.getStats(path).then(() => filesystem.remove(path))
    } catch (e) {
      console.warn(`Не удалось удалить ${path}`, e)
    }
  }
}

async function handlePrint() {
  if (!partNumber.value) {
    alert('Введите артикул')
    return
  }

  const serials = parseSerials(serialsText.value)

  if (serials.length === 0) {
    alert('Введите хотя бы один серийник')
    return
  }

  try {
    loading.value = true

    await printPassport(partNumber.value, serials)

    const pdfFiles = serials.map((sn) => `${CONFIG.convertPath}/${partNumber.value}__${sn}.pdf`)

    const output = `${CONFIG.convertPath}/${partNumber.value}__PRINT.pdf`

    await mergeAndReorderPdfs(pdfFiles, output)

    // 🧹 чистим docx
    await cleanupDocx(partNumber.value, serials)
    await openSecondWindow('./convertFolder', `${partNumber.value}__PRINT.pdf`, '/convertFolder')
  } catch (e) {
    console.error(e)
    alert('Ошибка при печати')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <v-container>
    <v-card class="pa-4" max-width="600">
      <v-card-title class="text-h6"> Печать паспортов </v-card-title>

      <v-card-text>
        <v-text-field v-model="partNumber" label="Артикул" variant="outlined" class="mb-4" />

        <v-textarea
          v-model="serialsText"
          label="Серийные номера (каждый с новой строки)"
          variant="outlined"
          rows="6"
          auto-grow
        />
      </v-card-text>

      <v-card-actions>
        <v-spacer />

        <v-btn color="primary" :loading="loading" @click="handlePrint"> Печать паспортов </v-btn>
      </v-card-actions>
    </v-card>
  </v-container>
</template>
