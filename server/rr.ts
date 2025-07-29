import { PrismaClient } from "../shared/src";
import fs from "fs/promises";

const prisma = new PrismaClient();

async function restoreDatabase() {
  try {
    const fileContent = await fs.readFile("prisma-backup.json", "utf-8");
    const data = JSON.parse(fileContent);

    // Очистка (в обратном порядке связей)
    await prisma.defectHistory.deleteMany();
    await prisma.productionOperation.deleteMany();
    await prisma.component.deleteMany();
    await prisma.product.deleteMany();
    await prisma.checkList.deleteMany();
    await prisma.specification.deleteMany();
    await prisma.test.deleteMany();
    await prisma.template.deleteMany();
    await prisma.operation.deleteMany();
    await prisma.partNumberComponent.deleteMany();
    await prisma.user.deleteMany();

    // Восстановление в порядке, учитывая связи:
    // 1. Восстановим справочные таблицы без зависимостей
    await prisma.user.createMany({ data: data.users });
    await prisma.partNumberComponent.createMany({
      data: data.partNumberComponents,
    });
    await prisma.operation.createMany({ data: data.operations });
    await prisma.template.createMany({ data: data.templates });
    await prisma.test.createMany({ data: data.tests });

    // 2. Затем модели, зависящие от справочных:
    await prisma.specification.createMany({ data: data.specifications });
    await prisma.product.createMany({ data: data.products });
    await prisma.component.createMany({ data: data.components });
    await prisma.checkList.createMany({ data: data.checkLists });

    // 3. Наконец операции и истории дефектов
    await prisma.productionOperation.createMany({
      data: data.productionOperations,
    });
    await prisma.defectHistory.createMany({ data: data.defectHistories });

    console.log("✅ Восстановление базы из prisma-backup.json завершено");
  } catch (error) {
    console.error("❌ Ошибка при восстановлении:", error);
  } finally {
    await prisma.$disconnect();
  }
}

restoreDatabase();
