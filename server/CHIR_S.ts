import { PrismaClient } from "../shared/src";

const prisma = new PrismaClient();

// ТРИГГЕР РЕЖИМА: true — симуляция, false — запись в базу
const RUN_AS_DRY_OUT = false;

const mappingTable = [
  { snProduct: "TAU13266000075", targetBaseSN: "26012794-1" },
  { snProduct: "TAU13266000076", targetBaseSN: "26012795-1" },
  { snProduct: "TAU13266000077", targetBaseSN: "26012796-1" },
  { snProduct: "TAU13266000078", targetBaseSN: "26012797-1" },
  { snProduct: "TAU13266000082", targetBaseSN: "26012757" },
  { snProduct: "TAU13266000083", targetBaseSN: "26012758" },
  { snProduct: "TAU13266000084", targetBaseSN: "26012770" },
  { snProduct: "TAU13266000085", targetBaseSN: "26012771" },
  { snProduct: "TAU13266000087", targetBaseSN: "26012772" },
  { snProduct: "TAU16266000129", targetBaseSN: "26012759" },
  { snProduct: "TAU16266000130", targetBaseSN: "26012760" },
  { snProduct: "TAU16266000133", targetBaseSN: "26012773" },
  { snProduct: "TAU21266000429", targetBaseSN: "26012792-1" },
  { snProduct: "TAU21266000430", targetBaseSN: "26012793-1" },
  { snProduct: "TAU21266000447", targetBaseSN: "26012743" },
  { snProduct: "TAU21266000448", targetBaseSN: "26012744" },
  { snProduct: "TAU21266000449", targetBaseSN: "26012745" },
  { snProduct: "TAU21266000450", targetBaseSN: "26012746" },
  { snProduct: "TAU21266000451", targetBaseSN: "26012747" },
  { snProduct: "TAU21266000452", targetBaseSN: "26012748" },
  { snProduct: "TAU21266000453", targetBaseSN: "26043616" },
];

async function remapDynamicTerminalBlocks(dryRun: boolean = false) {
  console.log("--------------------------------------------------");
  console.log(
    dryRun
      ? "⚠️  РЕЖИМ DRY RUN (Сухой прогон)."
      : "🚀 РЕЖИМ ПРОДАКШН! Запись в БД.",
  );
  console.log("--------------------------------------------------");

  // Массив для отслеживания "занятых" крышек внутри текущей сессии сухого прогона,
  // чтобы при dryRun не предлагать одну и ту же крышку для всех клеммников в логах.
  const simulatedUsedCoverIds: number[] = [];

  try {
    for (const item of mappingTable) {
      console.log(`\n🔎 Обработка клеммника: ${item.snProduct}`);

      // 1. Подгружаем продукт вместе с его индивидуальной спецификацией и компонентами
      const product = await prisma.product.findUnique({
        where: { snProduct: item.snProduct },
        include: {
          specification: true, // Вытаскиваем спецификацию, где лежит enclosureType
          components: true,
        },
      });

      if (!product) {
        console.error(`❌ Продукт ${item.snProduct} не найден. Пропуск.`);
        continue;
      }

      // Динамически определяем артикул крышки/корпуса из спецификации продукта
      const dynamicCoverPN = product.specification?.enclosureType;

      if (!dynamicCoverPN) {
        console.error(
          `❌ У продукта ${item.snProduct} в спецификации не заполнен enclosureType (артикул корпуса). Пропуск.`,
        );
        continue;
      }

      console.log(
        `📋 Согласно спецификации [${product.specificationProductMP}], требуется крышка: ${dynamicCoverPN}`,
      );

      // 2. Целевая плата для клеммника (без суффикса)
      const targetBoardSN = item.targetBaseSN;

      const boardInDb = await prisma.component.findUnique({
        where: { snComponent: targetBoardSN },
      });

      if (!boardInDb) {
        console.error(`❌ В БД нет целевой платы: ${targetBoardSN}. Пропуск.`);
        continue;
      }

      // 3. АВТОПОИСК КРЫШКИ ПО ДИНАМИЧЕСКОМУ АРТИКУЛУ
      // Ищем свободный компонент, у которого pnComponentId совпадает с enclosureType из спецификации
      const freeCover = await prisma.component.findFirst({
        where: {
          pnComponentId: dynamicCoverPN,
          snProductId: null, // компонент должен быть свободен
          id: {
            notIn: simulatedUsedCoverIds, // Исключаем те, что уже "забронировали" в рамках симуляции dryRun
          },
        },
        orderBy: {
          createdAt: "desc", // FIFO — берем самую старую деталь на складе
        },
      });

      if (!freeCover) {
        console.error(
          `❌ Ошибка: На складе закончились свободные крышки с артикулом ${dynamicCoverPN}! Пропуск.`,
        );
        continue;
      }

      // Если это сухой прогон, запоминаем ID крышки локально, чтобы не выдать её повторно в следующем цикле логов
      if (dryRun) {
        simulatedUsedCoverIds.push(freeCover.id);
      }

      console.log(
        `🎁 Найдена подходящая свободная крышка: ${freeCover.snComponent} (ID: ${freeCover.id})`,
      );

      // Итоговый целевой состав для клеммника
      const requiredComponentSNs = [targetBoardSN, freeCover.snComponent];

      // 4. Фильтруем старые компоненты, которые подлежат замене
      // Отвязываем старую плату (по номеру или маске) и старый корпус, чей артикул совпадает с dynamicCoverPN
      const currentComponentsToDisconnect = product.components.filter(
        (c) =>
          c.snComponent === targetBoardSN ||
          c.pnComponentId === dynamicCoverPN ||
          c.snComponent.endsWith("-01"),
      );

      const currentComponentSNs = product.components.map((c) => c.snComponent);
      const disconnectedSNs = currentComponentsToDisconnect.map(
        (c) => c.snComponent,
      );

      // Проверка на то, вдруг клеммник уже собран в соответствии с задачей
      const isAlreadyCorrect = requiredComponentSNs.every((sn) =>
        currentComponentSNs.includes(sn),
      );
      if (isAlreadyCorrect) {
        console.log(
          `✅ Клеммник ${item.snProduct} уже укомплектован правильно.`,
        );
        continue;
      }

      const disconnectPayload = currentComponentsToDisconnect.map((c) => ({
        id: c.id,
      }));
      const connectPayload = requiredComponentSNs.map((sn) => ({
        snComponent: sn,
      }));

      console.log(`[Состав сейчас]: ${currentComponentSNs.join(", ")}`);
      console.log(
        `[План] Отвязать старое: ${disconnectedSNs.join(", ") || "ничего"}`,
      );
      console.log(
        `[План] Привязать новое: Плату (${targetBoardSN}) и найденную Крышку (${freeCover.snComponent})`,
      );

      // 5. Применение изменений
      if (!dryRun) {
        await prisma.product.update({
          where: { id: product.id },
          data: {
            components: {
              disconnect: disconnectPayload,
              connect: connectPayload,
            },
          },
        });
        console.log(`🎉 Клеммник ${item.snProduct} успешно перекомплектован!`);
      } else {
        console.log(
          `ℹ️ [Имитация] Успешная симуляция сборки для ${item.snProduct}`,
        );
      }
    }
  } catch (error) {
    console.error("❌ Критическая ошибка во время выполнения:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Запуск процесса
remapDynamicTerminalBlocks(RUN_AS_DRY_OUT);
