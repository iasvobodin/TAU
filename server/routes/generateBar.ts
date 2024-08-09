// export default function barcodeRoutes(app: FastifyInstance) {}
import { Document, Packer, Paragraph, ImageRun } from 'docx';
import fs from 'fs/promises';
import bwipjs from 'bwip-js';
import type { FastifyInstance } from 'fastify';



// Функция для генерации штрихкода
const generateBarcode = async (text: string): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        bwipjs.toBuffer({
            bcid: 'code128',       // Тип штрихкода
            text: text,            // Текст для штрихкода
            scale: 3,              // Масштабирование
            height: 10,            // Высота штрихкода
            includetext: true,     // Включить текст под штрихкодом
            textxalign: 'center',  // Выравнивание текста по центру
        }, (err, png) => {
            if (err) {
                reject(err);
            } else {
                resolve(png);
            }
        });
    });
};

// Функция для создания .docx файла с штрихкодами
const createDocWithBarcodes = async (barcodes: string[]) => {
    console.log('from createDocWithBarcodes');

    const sections = [];

    for (const barcode of barcodes) {
        try {
            const barcodeBuffer = await generateBarcode(barcode);

            const paragraph = new Paragraph({
                children: [
                    new ImageRun({
                        data: barcodeBuffer,
                        transformation: {
                            width: 200,
                            height: 100,
                        },
                    }),
                ],
            });

            sections.push({
                properties: {},
                children: [paragraph],
            });
        } catch (error) {
            console.log(error);
        }

    }

    const doc = new Document({ sections });
    try {
        const buffer = await Packer.toBuffer(doc);
        await fs.writeFile('barcodes.docx', buffer);
    } catch (error) {
        console.log(error);
    }


    console.log('Document created successfully');
};


export default function barcodeRoutes(app: FastifyInstance) {

    app.post('/generate', async (request, reply) => {

        const barcodes = request.body as string[]
        if (Array.isArray(barcodes)) {
            try {
                await createDocWithBarcodes(barcodes);
                reply.status(200).send('Document created successfully');
            } catch (error) {
                reply.status(500).send('Error creating document');
            }
        } else {
            reply.status(400).send('Invalid request body');
        }
    });
}