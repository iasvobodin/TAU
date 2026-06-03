import { PrismaClient } from "../shared/src";
import fs from "fs/promises";

const prisma = new PrismaClient();

async function backupDatabase() {
  try {
    // Получаем данные из всех таблиц (моделей) по схеме
    const [
      users,
      components,
      partNumberComponents,
      productionOperations,
      products,
      specifications,
      operations,
      templates,
      tests,
      checkLists,
      defectHistories,
    ] = await Promise.all([
      prisma.user.findMany(),
      prisma.component.findMany(),
      prisma.partNumberComponent.findMany(),
      prisma.productionOperation.findMany(),
      prisma.product.findMany(),
      prisma.specification.findMany(),
      prisma.operation.findMany(),
      prisma.template.findMany(),
      prisma.test.findMany(),
      prisma.checkList.findMany(),
      prisma.defectHistory.findMany(),
    ]);

    const data = {
      users,
      components,
      partNumberComponents,
      productionOperations,
      products,
      specifications,
      operations,
      templates,
      tests,
      checkLists,
      defectHistories,
    };

    // Записываем в файл с форматированием
    await fs.writeFile(
      "prisma-backup 02.06.2026.json",
      JSON.stringify(data, null, 2),
    );

    console.log("✅ Бэкап сохранён в prisma-backup.json");
  } catch (error) {
    console.error("❌ Ошибка при бэкапе:", error);
  } finally {
    await prisma.$disconnect();
  }
}

backupDatabase();
