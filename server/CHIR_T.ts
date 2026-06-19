import { PrismaClient } from "../shared/src";

const prisma = new PrismaClient();

// ТРИГГЕР РЕЖИМА: true — симуляция, false — запись в базу
const RUN_AS_DRY_OUT = false;

const mappingTable = [
  { snProduct: "TAU13265000100", targetBaseSN: "26012721" },
  { snProduct: "TAU13265000101", targetBaseSN: "26012722" },
  { snProduct: "TAU13265000102", targetBaseSN: "26012723" },
  { snProduct: "TAU13265000103", targetBaseSN: "26012724" },
  { snProduct: "TAU13265000104", targetBaseSN: "26012725" },
  { snProduct: "TAU13265000105", targetBaseSN: "26012726" },
  { snProduct: "TAU16265000112", targetBaseSN: "26013146" },
  { snProduct: "TAU16265000113", targetBaseSN: "26013147" },
  { snProduct: "TAU16265000114", targetBaseSN: "26013148" },
  { snProduct: "TAU16265000115", targetBaseSN: "26013149" },
  { snProduct: "TAU16265000116", targetBaseSN: "26013150" },
  { snProduct: "TAU20265000238", targetBaseSN: "26012868" },
  { snProduct: "TAU20265000239", targetBaseSN: "26012869" },
  { snProduct: "TAU20265000286", targetBaseSN: "26012936" },
  { snProduct: "TAU20265000287", targetBaseSN: "26012937" },
  { snProduct: "TAU20265000288", targetBaseSN: "26012938" },
  { snProduct: "TAU20265000289", targetBaseSN: "26012939" },
  { snProduct: "TAU20265000290", targetBaseSN: "26012940" },
  { snProduct: "TAU20265000291", targetBaseSN: "26012941" },
  { snProduct: "TAU20265000292", targetBaseSN: "26012942" },
  { snProduct: "TAU20265000293", targetBaseSN: "26012943" },
  { snProduct: "TAU20265000294", targetBaseSN: "26012944" },
  { snProduct: "TAU20265000295", targetBaseSN: "26012945" },
  { snProduct: "TAU20265000296", targetBaseSN: "26012946" },
  { snProduct: "TAU20265000297", targetBaseSN: "26012947" },
  { snProduct: "TAU20265000298", targetBaseSN: "26012948" },
  { snProduct: "TAU20265000299", targetBaseSN: "26012949" },
  { snProduct: "TAU20265000300", targetBaseSN: "26012950" },
  { snProduct: "TAU20265000301", targetBaseSN: "26012951" },
  { snProduct: "TAU20265000302", targetBaseSN: "26012952" },
  { snProduct: "TAU20265000303", targetBaseSN: "26012953" },
  { snProduct: "TAU20265000304", targetBaseSN: "26012954" },
  { snProduct: "TAU20265000305", targetBaseSN: "26012955" },
  { snProduct: "TAU20265000306", targetBaseSN: "26012956" },
  { snProduct: "TAU20265000307", targetBaseSN: "26012957" },
  { snProduct: "TAU20265000308", targetBaseSN: "26012958" },
  { snProduct: "TAU20265000309", targetBaseSN: "26012959" },
  { snProduct: "TAU20265000310", targetBaseSN: "26012960" },
  { snProduct: "TAU20265000311", targetBaseSN: "26012961" },
  { snProduct: "TAU20265000312", targetBaseSN: "24106252" },
  { snProduct: "TAU20265000313", targetBaseSN: "24106254" },
  { snProduct: "TAU20265000314", targetBaseSN: "24106255" },
  { snProduct: "TAU20265000315", targetBaseSN: "24116298" },
  { snProduct: "TAU20265000316", targetBaseSN: "24116302" },
  { snProduct: "TAU20265000317", targetBaseSN: "24116303" },
  { snProduct: "TAU20265000318", targetBaseSN: "24116304" },
  { snProduct: "TAU20265000319", targetBaseSN: "24116305" },
  { snProduct: "TAU20265000320", targetBaseSN: "24126343" },
  { snProduct: "TAU20265000321", targetBaseSN: "26012900" },
  { snProduct: "TAU20265000322", targetBaseSN: "26012861" },
  { snProduct: "TAU20265000323", targetBaseSN: "26012862" },
  { snProduct: "TAU20265000324", targetBaseSN: "26012863" },
  { snProduct: "TAU20265000325", targetBaseSN: "26012864" },
  { snProduct: "TAU21265000422", targetBaseSN: "26012462" },
  { snProduct: "TAU21265000423", targetBaseSN: "26012463" },
  { snProduct: "TAU21265000424", targetBaseSN: "26012464" },
  { snProduct: "TAU21265000425", targetBaseSN: "26012465" },
  { snProduct: "TAU21265000426", targetBaseSN: "26013145" },
  { snProduct: "TAU21265000432", targetBaseSN: "26012865" },
  { snProduct: "TAU21265000442", targetBaseSN: "26012727" },
  { snProduct: "TAU21265000443", targetBaseSN: "26012728" },
  { snProduct: "TAU21265000444", targetBaseSN: "26012729" },
  { snProduct: "TAU21265000445", targetBaseSN: "26012730" },
  { snProduct: "TAU21265000446", targetBaseSN: "26012731" },
  { snProduct: "TAU21265000454", targetBaseSN: "26012866" },
  { snProduct: "TAU21265000455", targetBaseSN: "26012867" },
  { snProduct: "TAU21265000456", targetBaseSN: "26012901" },
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
