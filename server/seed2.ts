import { PrismaClient } from "../shared/src";

const prisma = new PrismaClient();

async function seedCheckLists() {
  try {
    // Получаем все существующие спецификации
    const specifications = await prisma.specification.findMany({
      select: { productMP: true },
    });

    // await prisma.checkList.createMany({
    //     data: specifications.map(spec => ({
    //       checkListTemplate: '',
    //       productMP: spec.productMP
    //     })),
    //   });

    // Создаем чек-листы для каждой спецификации
    const createdCheckLists = await Promise.all(
      specifications.map((spec) =>
        prisma.checkList.upsert({
          where: { productMP: spec.productMP },
          create: {
            checkListTemplate: "", // Пустая строка
            productMP: spec.productMP,
          },
          update: {}, // Ничего не обновляем, если запись уже существует
        })
      )
    );

    console.log(`Создано ${createdCheckLists.length} чек-листов`);
  } catch (error) {
    console.error("Ошибка при заполнении чек-листов:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedCheckLists();
