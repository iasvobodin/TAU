import { PrismaClient } from "../shared/src";

const prisma = new PrismaClient();

const data = [
  {
    products: "MP1501X1-BB1, MP1501X1-BC3",
    type: "Сборка",
    value: "ОК МП-ТАУ-004.1-24",
  },
  {
    products: "MP2003X1-BB1, MP2005X1-BA1",
    type: "Сборка",
    value: "ОК МП-ТАУ-004.1-24",
  },
  {
    products:
      "MP3241X1-BA1, MP3202X1-BA1, MP3221X1-BA1, MP3242X1-BA1, MP3204X1-BA1, MP3203X1-BA1, MP3201X1-BA1, MP3223X1-BA1, MP3222X1-BA1",
    type: "Сборка",
    value: "ОК МП-ТАУ-004.2-24",
  },
  {
    products:
      "MP3241X1-BA1, MP3242X1-FA1, MP3242X1-EA1, MP3241X1-EA1, MP3003X1-EA1, MP4001X1-CJ1, MP3201X1-EA1, MP3221X1-EA1, MP4001X1-CC1, MP3222X1-EA1, MP4001X1-CA1, MP3223X1-EA1, MS2201X1-HA1, MS2201X1-JA1",
    type: "Сборка",
    value: "ОК МП-ТАУ-004.3-24",
  },
  { products: "MP2201X1-BA1", type: "Сборка", value: "ОК МП-ТАУ-004.4-24" },
  {
    products: "MP4001X1-BE1, MP4001X1-BA3",
    type: "Сборка",
    value: "ОК МП-ТАУ-004.5-24",
  },
  {
    products: "MP4001X1-NA1, MP4001X1-NB1, MS4010X1-BN1",
    type: "Сборка",
    value: "ОК МП-ТАУ-004.6-24",
  },
  {
    products: "MP1501X1-BB1",
    type: "ОТК и тестирование",
    value: "ОК МП-ТАУ-005.18-25",
  },
  {
    products: "MP1501X1-BC3",
    type: "ОТК и тестирование",
    value: "ОК МП-ТАУ-005.18-25",
  },
  {
    products: "MP2003X1-BB1",
    type: "ОТК и тестирование",
    value: "ОК МП-ТАУ-005.17-25",
  },
  {
    products: "MP2005X1-BA1",
    type: "ОТК и тестирование",
    value: "ОК МП-ТАУ-005.22-25",
  },
  {
    products: "MP2201X1-BA1",
    type: "ОТК и тестирование",
    value: "ОК МП-ТАУ-005.19-25",
  },
  { products: "MS2201X1-HA1", type: "ОТК и тестирование", value: null },
  { products: "MS2201X1-JA1", type: "ОТК и тестирование", value: null },
  {
    products: "MP3222X1-BA1",
    type: "ОТК и тестирование",
    value: "ОК МП-ТАУ-005.1-25",
  },
  {
    products: "MP4001X1-CA1",
    type: "ОТК и тестирование",
    value: "ОК МП-ТАУ-005.12-25",
  },
  {
    products: "MP4001X1-CC1",
    type: "ОТК и тестирование",
    value: "ОК МП-ТАУ-005.11-25",
  },
  {
    products: "MP3222X1-EA1",
    type: "ОТК и тестирование",
    value: "ОК МП-ТАУ-005.21-25",
  },
  {
    products: "MP3223X1-BA1",
    type: "ОТК и тестирование",
    value: "ОК МП-ТАУ-005.2-25",
  },
  { products: "MP3223X1-EA1", type: "ОТК и тестирование", value: null },
  {
    products: "MP3221X1-BA1",
    type: "ОТК и тестирование",
    value: "ОК МП-ТАУ-005.3-25",
  },
  { products: "MP3221X1-EA1", type: "ОТК и тестирование", value: null },
  {
    products: "MP3201X1-BA1",
    type: "ОТК и тестирование",
    value: "ОК МП-ТАУ-005.10-25",
  },
  { products: "MP3201X1-EA1", type: "ОТК и тестирование", value: null },
  {
    products: "MP3203X1-BA1",
    type: "ОТК и тестирование",
    value: "ОК МП-ТАУ-005.4-25",
  },
  {
    products: "MP4001X1-CJ1",
    type: "ОТК и тестирование",
    value: "ОК МП-ТАУ-005.5-25",
  },
  {
    products: "MP3202X1-BA1",
    type: "ОТК и тестирование",
    value: "ОК МП-ТАУ-005.9-25",
  },
  {
    products: "MP3204X1-BA1",
    type: "ОТК и тестирование",
    value: "ОК МП-ТАУ-005.6-25",
  },
  {
    products: "MP3241X1-BA1",
    type: "ОТК и тестирование",
    value: "ОК МП-ТАУ-005.7-25",
  },
  {
    products: "MP3003X1-EA1",
    type: "ОТК и тестирование",
    value: "ОК МП-ТАУ-005.8-25",
  },
  { products: "MP3241X1-EA1", type: "ОТК и тестирование", value: null },
  { products: "MP3242X1-BA1", type: "ОТК и тестирование", value: null },
  { products: "MP3242X1-EA1", type: "ОТК и тестирование", value: null },
  { products: "MP3242X1-FA1", type: "ОТК и тестирование", value: null },
  {
    products: "MP4001X1-BE1",
    type: "ОТК и тестирование",
    value: "ОК МП-ТАУ-005.16-25",
  },
  {
    products: "MP4001X1-BA3",
    type: "ОТК и тестирование",
    value: "ОК МП-ТАУ-005.20-25",
  },
  {
    products: "MP4010X1-BM1",
    type: "ОТК и тестирование",
    value: "ОК МП-ТАУ-005.14-25",
  },
  {
    products: "MP4010X1-BL1",
    type: "ОТК и тестирование",
    value: "ОК МП-ТАУ-005.14-25",
  },
  {
    products: "MP4001X1-NB1",
    type: "ОТК и тестирование",
    value: "ОК МП-ТАУ-005.15-25",
  },
  {
    products: "MP4001X1-NA1",
    type: "ОТК и тестирование",
    value: "ОК МП-ТАУ-005.15-25",
  },
  {
    products: "MP4002X1-BF2",
    type: "ОТК и тестирование",
    value: "ОК МП-ТАУ-005.15-25",
  },
  {
    products: "MS4010X1-BN1",
    type: "ОТК и тестирование",
    value: "ОК МП-ТАУ-005.13-25",
  },
];

async function populateCheckList(
  data: { products: string; type: string; value: string | null }[]
) {
  // Process the data to create records for each product, skipping entries with null value
  const records: {
    productMP: string;
    doc_AssebbleOK?: string;
    doc_TestOK?: string;
  }[] = [];

  for (const entry of data) {
    if (entry.value === null) continue; // Skip entries with null value
    const products = entry.products.split(",").map((p) => p.trim());
    for (const productMP of products) {
      const record: {
        productMP: string;
        doc_AssebbleOK?: string;
        doc_TestOK?: string;
      } = { productMP };
      if (entry.type === "Сборка") {
        record.doc_AssebbleOK = entry.value; // Value is guaranteed to be string
      } else if (entry.type === "ОТК и тестирование") {
        record.doc_TestOK = entry.value; // Value is guaranteed to be string
      }
      records.push(record);
    }
  }

  // Update existing records in the database
  try {
    for (const record of records) {
      // Check if record exists
      const existingRecord = await prisma.checkList.findUnique({
        where: { productMP: record.productMP },
      });

      if (!existingRecord) {
        console.warn(
          `Запись с productMP ${record.productMP} не найдена, пропускаем`
        );
        continue;
      }

      await prisma.checkList.update({
        where: { productMP: record.productMP },
        data: {
          ...(record.doc_AssebbleOK !== undefined && {
            doc_AssebbleOK: record.doc_AssebbleOK,
          }),
          ...(record.doc_TestOK !== undefined && {
            doc_TestOK: record.doc_TestOK,
          }),
        },
      });
    }
    console.log("База данных успешно обновлена");
  } catch (error) {
    console.error("Ошибка при обновлении базы данных:", error);
  } finally {
    await prisma.$disconnect();
  }
}

populateCheckList(data);
