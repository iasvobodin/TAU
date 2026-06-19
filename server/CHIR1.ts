import { PrismaClient } from "../shared/src";

const prisma = new PrismaClient();

const targetProductSNs = [
  "TAU13266000959",
  "TAU13266000960",
  "TAU13266000961",
  "TAU13266000962",
  "TAU13266000966",
  "TAU13266000967",
  "TAU13266000968",
  "TAU13266000969",
  "TAU13266000971",
  "TAU16266001041",
  "TAU16266001042",
  "TAU16266001045",
  "TAU21266001354",
  "TAU21266001355",
  "TAU22266001380",
  "TAU22266001381",
  "TAU22266001382",
  "TAU22266001383",
  "TAU22266001384",
  "TAU22266001385",
  "TAU22266001386",
];

// const moduleType = {
//   Controller: 1,
//   PowerSupply: 2,
//   Modules: 3,
//   PAZ: 4,
//   TerminalBlocks: 5,
//   SupportPanels: 6,
//   Defective: 7
// }

async function runPreciseMigration() {
  console.log(
    `Запуск точечной миграции для ${targetProductSNs.length} продуктов...`,
  );

  try {
    // Вытаскиваем только продукты из нашего массива
    const products = await prisma.product.findMany({
      where: {
        snProduct: {
          in: targetProductSNs,
        },
      },
      include: {
        specification: true,
        components: true,
      },
    });

    console.log(`Из базы успешно загружено продуктов: ${products.length}`);

    let updatedCount = 0;

    for (const product of products) {
      if (!product.components || product.components.length === 0) {
        console.warn(
          `[Пропуск] Продукт ${product.snProduct} не имеет привязанных компонентов.`,
        );
        continue;
      }

      // Определяем нужный компонент (плату)
      // Скрипт ищет компонент, pnComponentId которого совпадает с основной платой (electronicBoard1 или electronicBoard2)
      // Если такого нет — берет первую деталь из списка компонентов продукта
      const targetComponent =
        product.components.find(
          (c) =>
            c.pnComponentId === product.specification?.electronicBoard1 ||
            c.pnComponentId === product.specification?.electronicBoard2,
        ) || product.components[0];

      // if (!targetComponent || !targetComponent.snComponent) {
      //   console.warn(
      //     `[Пропуск] Для ${product.snProduct} не найден snComponent.`,
      //   );
      //   continue;
      // }

      const rawComponentSN = targetComponent.snComponent; // Например: "262000358-02"

      // Отсекаем "-02", "-01" и т.д.
      const cleanComponentSN = rawComponentSN.split("-")[0]; // Получится "262000358"

      //формируем новый инвентарник
      function modifySerialNumber(serial: string): string {
        // 1. Забираем первые 3 символа (префикс)
        const prefix = serial.substring(0, 3);

        // 2. Достаем год (6-й и 7-й символы -> индексы 5 и 6)
        const year = serial.substring(5, 7);

        // 3. Достаем неделю (8-й и 9-й символы -> индексы 7 и 8)
        const week = serial.substring(7, 9);

        // 4. Забираем порядковый номер (все что идет после 9-го символа)
        const orderNumber = serial.substring(9);

        // 5. Константа типа модуля
        const moduleType = "6";

        // 6. Собираем цифровую часть, которая должна быть длиной ровно 11 символов
        // В данном случае: Неделя(2) + Год(2) + Тип(1) = 5 символов.
        // Значит на порядковый номер останется 6 символов (он дополнится нулями слева)
        const numericPart = `${week}${year}${moduleType}${orderNumber.padStart(6, "0")}`;

        // Возвращаем итоговый результат
        return `${prefix}${numericPart}`;
      }

      // Формируем комментарий
      let updatedComment = cleanComponentSN;
      if (product.comment && product.comment.startsWith("TAU")) {
        // проверка на уникальность присвоенных номеров в комментах
        // const existingRecord = await prisma.product.findUnique({
        //   where: { snProduct: product.comment },
        // });

        // if (!existingRecord) {
        //   console.warn(`Запись с COMMENT уникальна`);
        //   continue;
        // }

        // const outputSerial = modifySerialNumber(product.comment);
        // Если там уже записан этот номер, пропускаем, чтобы не дублировать
        // if (product.comment.includes(cleanComponentSN)) {
        //   continue;
        // }
        // Если там было что-то другое, приписываем в конец
        // updatedComment = outputSerial; // `TAU00${cleanComponentSN}`;
        // console.log(updatedComment);

        // Обновляем продукт в БД
        await prisma.product.update({
          where: { id: product.id },
          data: { snProduct: product.comment },
          // where: { id: product.id },
          // data: { comment: updatedComment },
        });
        // }

        updatedCount++;
      }
    }
    console.log(
      `Миграция успешно завершена! Обновлено записей: ${updatedCount}`,
    );
  } catch (error) {
    console.error("Ошибка во время выполнения скрипта:", error);
  } finally {
    await prisma.$disconnect();
  }
}

runPreciseMigration();
