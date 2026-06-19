import { PrismaClient } from "../shared/src";

const prisma = new PrismaClient();

const targetProductSNs = [
  "TAU13265000984",
  "TAU13265000985",
  "TAU13265000986",
  "TAU13265000987",
  "TAU13265000988",
  "TAU13265000989",
  "TAU16265001024",
  "TAU16265001025",
  "TAU16265001026",
  "TAU16265001027",
  "TAU16265001028",
  "TAU20265001163",
  "TAU20265001164",
  "TAU20265001165",
  "TAU20265001166",
  "TAU20265001189",
  "TAU20265001190",
  "TAU20265001191",
  "TAU20265001192",
  "TAU20265001193",
  "TAU20265001194",
  "TAU20265001195",
  "TAU20265001196",
  "TAU20265001197",
  "TAU20265001198",
  "TAU20265001199",
  "TAU20265001200",
  "TAU20265001201",
  "TAU20265001202",
  "TAU20265001203",
  "TAU20265001204",
  "TAU20265001205",
  "TAU20265001206",
  "TAU20265001207",
  "TAU20265001208",
  "TAU20265001209",
  "TAU20265001210",
  "TAU20265001211",
  "TAU20265001212",
  "TAU20265001213",
  "TAU20265001214",
  "TAU20265001175",
  "TAU20265001176",
  "TAU20265001177",
  "TAU20265001178",
  "TAU20265001179",
  "TAU20265001180",
  "TAU20265001181",
  "TAU20265001182",
  "TAU20265001183",
  "TAU20265001184",
  "TAU20265001185",
  "TAU20265001186",
  "TAU20265001187",
  "TAU20265001188",
  "TAU21265001358",
  "TAU21265001359",
  "TAU21265001360",
  "TAU21265001361",
  "TAU21265001357",
  "TAU21265001356",
  "TAU21265001371",
  "TAU21265001372",
  "TAU21265001373",
  "TAU21265001374",
  "TAU21265001375",
  "TAU21265001377",
  "TAU21265001379",
  "TAU21265001378",
];

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

      if (!targetComponent || !targetComponent.snComponent) {
        console.warn(
          `[Пропуск] Для ${product.snProduct} не найден snComponent.`,
        );
        continue;
      }

      const rawComponentSN = targetComponent.snComponent; // Например: "262000358-02"

      // Отсекаем "-02", "-01" и т.д.
      const cleanComponentSN = rawComponentSN.split("-")[0]; // Получится "262000358"

      // Формируем комментарий
      let updatedComment = cleanComponentSN;
      if (product.comment) {
        // Если там уже записан этот номер, пропускаем, чтобы не дублировать
        // if (product.comment.includes(cleanComponentSN)) {
        //   continue;
        // }
        // Если там было что-то другое, приписываем в конец
        updatedComment = `TAU00${cleanComponentSN}`;
      }

      // Обновляем продукт в БД
      await prisma.product.update({
        where: { id: product.id },
        data: { comment: updatedComment },
      });

      updatedCount++;
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
