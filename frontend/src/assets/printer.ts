// // // // printer.ts
// // // import { os, filesystem } from '@neutralinojs/lib'

// // // const sofficePath = '../../../../../../LibreOfficePortable/App/libreoffice/program/soffice.exe'

// // // /**
// // //  * Отправляет DOCX-файл на печать через конвертацию в PDF
// // //  * @param docxPath Путь к .docx файлу (относительно корня приложения)
// // //  */
// // // export async function printDocxFile(docxPath: string): Promise<void> {
// // //   try {
// // //     const pdfDir = docxPath.substring(0, docxPath.lastIndexOf('/'))
// // //     const convertCommand = `"${sofficePath}" --headless --convert-to pdf "${docxPath}" --outdir "${pdfDir}"`

// // //     console.log('tadam', convertCommand)

// // //     const convertResult = await os.execCommand(convertCommand)

// // //     console.log('✅ Конвертация завершена:', convertResult.stdOut)

// // //     const pdfPath = docxPath.replace(/\.docx$/, '.pdf')

// // //     const printCommand = `powershell.exe Start-Process -FilePath "${pdfPath}" -Verb Print`
// // //     const printResult = await os.execCommand(printCommand)
// // //     console.log('🖨️ PDF отправлен на печать:', printResult.stdOut)
// // //   } catch (error) {
// // //     console.error('❌ Ошибка в процессе печати:', error)
// // //     throw error
// // //   }
// // // }

// // // printer.ts
// // import fs from 'fs';
// // import path from 'path';
// // import convert from 'libreoffice-convert';
// // import { os } from '@neutralinojs/lib';

// // /**
// //  * Конвертирует DOCX-файл в PDF и отправляет его на печать.
// //  * @param docxPath Путь к DOCX-файлу (относительно корня проекта)
// //  */
// // export async function printDocxFile(docxPath: string): Promise<void> {
// //     try {
// //         const absDocxPath = path.resolve(docxPath);
// //         const pdfPath = absDocxPath.replace(/\.docx$/, '.pdf');
// // const sofficePath = '../../../../../../LibreOfficePortable/App/libreoffice/program/soffice.exe'
// //         // Устанавливаем путь к soffice.exe (LibreOffice Portable)
// //         process.env.LIBREOFFICE_PATH = path.resolve(
// //             sofficePath
// //         );

// //         console.log(`📝 Конвертируем: ${absDocxPath} → ${pdfPath}`);

// //         const docxBuffer = fs.readFileSync(absDocxPath);
// //         const pdfBuffer = await convert.convertAsync(docxBuffer, '.pdf');

// //         fs.writeFileSync(pdfPath, pdfBuffer);
// //         console.log('✅ PDF успешно создан:', pdfPath);

// //         // Печать PDF через PowerShell
// //         const printCommand = `powershell.exe Start-Process -FilePath "${pdfPath}" -Verb Print`;

// //         const result = await os.execCommand(printCommand);
// //         console.log('🖨️ Отправлено на печать:', result.stdOut);

// //     } catch (error) {
// //         console.error('❌ Ошибка при печати DOCX:', error);
// //         throw error;
// //     }
// // }

// // printer.ts
// import fs from 'fs'
// import path from 'path'
// import convert from 'libreoffice-convert'
// import { os } from '@neutralinojs/lib'

// /**
//  * Обёртка над libreoffice-convert с Promise
//  */
// function convertToPdfAsync(inputBuffer: Buffer, format: string): Promise<Buffer> {
//   return new Promise((resolve, reject) => {
//     convert.convert(inputBuffer, format, undefined, (err, result) => {
//       if (err) reject(err)
//       else resolve(result)
//     })
//   })
// }

// /**
//  * Конвертирует DOCX в PDF и отправляет PDF на печать
//  */
// export async function printDocxFile(docxPath: string): Promise<void> {
//   try {
//     const absDocxPath = path.resolve(docxPath)
//     const pdfPath = absDocxPath.replace(/\.docx$/, '.pdf')

//     // Устанавливаем путь к soffice.exe (если не в PATH)
//     process.env.LIBREOFFICE_PATH = path.resolve(
//       '../../../../../../LibreOfficePortable/App/libreoffice/program/soffice.exe'
//     )

//     console.log(`📄 Конвертируем ${absDocxPath} → ${pdfPath}`)

//     const docxBuffer = fs.readFileSync(absDocxPath)
//     const pdfBuffer = await convertToPdfAsync(docxBuffer, '.pdf')
//     fs.writeFileSync(pdfPath, pdfBuffer)

//     console.log('✅ PDF успешно создан:', pdfPath)

//     const printCommand = `powershell.exe Start-Process -FilePath "${pdfPath}" -Verb Print`

//     const result = await os.execCommand(printCommand)
//     console.log('🖨️ PDF отправлен на печать:', result.stdOut)
//   } catch (error) {
//     console.error('❌ Ошибка при печати DOCX:', error)
//     throw error
//   }
// }
