import { PrismaClient } from "../shared/src";

const prisma = new PrismaClient();

// ТРИГГЕР РЕЖИМА: true — симуляция, false — запись в базу
const RUN_AS_DRY_OUT = true;

// const mappingTable = [
//   { snProduct: "TAU21263000399", targetBaseSN: "26012362" },
//   { snProduct: "TAU21263000400", targetBaseSN: "26012365" },
//   { snProduct: "TAU21263000401", targetBaseSN: "26012366" },
// ];

// const mappingTable = [
//   { snProduct: "TAU12263000001", targetBaseSN: "25080360" },
//   { snProduct: "TAU12263000002", targetBaseSN: "25080373" },
//   { snProduct: "TAU12263000003", targetBaseSN: "25080351" },
//   { snProduct: "TAU12263000004", targetBaseSN: "25080355" },
//   { snProduct: "TAU12263000005", targetBaseSN: "26011935" },
//   { snProduct: "TAU12263000006", targetBaseSN: "25080372" },
//   { snProduct: "TAU12263000007", targetBaseSN: "25080350" },
//   { snProduct: "TAU12263000008", targetBaseSN: "25080356" },
//   { snProduct: "TAU12263000009", targetBaseSN: "25080367" },
//   { snProduct: "TAU12263000010", targetBaseSN: "25080348" },
//   { snProduct: "TAU12263000011", targetBaseSN: "25080359" },
//   { snProduct: "TAU12263000012", targetBaseSN: "25080358" },
//   { snProduct: "TAU12263000013", targetBaseSN: "25080354" },
//   { snProduct: "TAU12263000014", targetBaseSN: "25080346" },
//   { snProduct: "TAU12263000015", targetBaseSN: "25080370" },
//   { snProduct: "TAU12263000016", targetBaseSN: "25080349" },
//   { snProduct: "TAU12263000017", targetBaseSN: "25080363" },
//   { snProduct: "TAU12263000018", targetBaseSN: "25080357" },
//   { snProduct: "TAU12263000019", targetBaseSN: "26011934" },
//   { snProduct: "TAU12263000020", targetBaseSN: "25080345" },
//   { snProduct: "TAU12263000021", targetBaseSN: "26011937" },
//   { snProduct: "TAU12263000022", targetBaseSN: "24064905" },
//   { snProduct: "TAU12263000023", targetBaseSN: "24064785" },
//   { snProduct: "TAU12263000024", targetBaseSN: "25070108" },
//   { snProduct: "TAU12263000025", targetBaseSN: "25070149" },
//   { snProduct: "TAU12263000026", targetBaseSN: "24064775" },
//   { snProduct: "TAU12263000027", targetBaseSN: "25070147" },
//   { snProduct: "TAU12263000028", targetBaseSN: "25070140" },
//   { snProduct: "TAU12263000029", targetBaseSN: "26012012" },
//   { snProduct: "TAU12263000030", targetBaseSN: "25070145" },
//   { snProduct: "TAU12263000031", targetBaseSN: "24064788" },
//   { snProduct: "TAU12263000032", targetBaseSN: "25070148" },
//   { snProduct: "TAU12263000033", targetBaseSN: "24064778" },
//   { snProduct: "TAU12263000034", targetBaseSN: "25070136" },
//   { snProduct: "TAU12263000035", targetBaseSN: "26012011" },
//   { snProduct: "TAU12263000036", targetBaseSN: "24064789" },
//   { snProduct: "TAU12263000037", targetBaseSN: "26012014" },
//   { snProduct: "TAU12263000038", targetBaseSN: "24064782" },
//   { snProduct: "TAU12263000039", targetBaseSN: "25070135" },
//   { snProduct: "TAU12263000040", targetBaseSN: "26012015" },
//   { snProduct: "TAU12263000041", targetBaseSN: "26011983" },
//   { snProduct: "TAU12263000042", targetBaseSN: "26011984" },
//   { snProduct: "TAU12263000043", targetBaseSN: "25070123" },
//   { snProduct: "TAU12263000044", targetBaseSN: "25070127" },
//   { snProduct: "TAU12263000045", targetBaseSN: "26011985" },
//   { snProduct: "TAU12263000046", targetBaseSN: "26011986" },
//   { snProduct: "TAU12263000047", targetBaseSN: "26011987" },
//   { snProduct: "TAU12263000048", targetBaseSN: "26011988" },
//   { snProduct: "TAU12263000049", targetBaseSN: "26012013" },
//   { snProduct: "TAU12263000050", targetBaseSN: "25111062" },
//   { snProduct: "TAU12263000051", targetBaseSN: "25111061" },
//   { snProduct: "TAU12263000052", targetBaseSN: "26012358" },
//   { snProduct: "TAU12263000053", targetBaseSN: "25111046" },
//   { snProduct: "TAU12263000054", targetBaseSN: "26012369" },
//   { snProduct: "TAU12263000055", targetBaseSN: "25111059" },
//   { snProduct: "TAU12263000056", targetBaseSN: "26012364" },
//   { snProduct: "TAU12263000057", targetBaseSN: "26012368" },
//   { snProduct: "TAU12263000058", targetBaseSN: "25111055" },
//   { snProduct: "TAU12263000059", targetBaseSN: "26012363" },
//   { snProduct: "TAU12263000060", targetBaseSN: "25080450" },
//   { snProduct: "TAU12263000061", targetBaseSN: "26111060" },
//   { snProduct: "TAU12263000062", targetBaseSN: "26012357" },
//   { snProduct: "TAU12263000063", targetBaseSN: "26012361" },
//   { snProduct: "TAU12263000064", targetBaseSN: "25111056" },
//   { snProduct: "TAU12263000065", targetBaseSN: "25111057" },
//   { snProduct: "TAU12263000066", targetBaseSN: "25111064" },
//   { snProduct: "TAU12263000067", targetBaseSN: "25111058" },
//   { snProduct: "TAU12263000068", targetBaseSN: "25111049" },
//   { snProduct: "TAU12263000069", targetBaseSN: "25111063" },
//   { snProduct: "TAU12263000070", targetBaseSN: "26012371" },
//   { snProduct: "TAU12263000071", targetBaseSN: "25080284" },
//   { snProduct: "TAU12263000072", targetBaseSN: "25080285" },
//   { snProduct: "TAU12263000073", targetBaseSN: "25080282" },
//   { snProduct: "TAU12263000074", targetBaseSN: "25080287" },
//   { snProduct: "TAU16263000157", targetBaseSN: "25059932" },
//   { snProduct: "TAU16263000158", targetBaseSN: "25111071" },
//   { snProduct: "TAU16263000159", targetBaseSN: "25111072" },
//   { snProduct: "TAU20263000237", targetBaseSN: "25059934" },
//   { snProduct: "TAU20263000245", targetBaseSN: "25111204" },
//   { snProduct: "TAU20263000246", targetBaseSN: "26012407" },
//   { snProduct: "TAU20263000247", targetBaseSN: "26012408" },
//   { snProduct: "TAU20263000248", targetBaseSN: "26012912" },
//   { snProduct: "TAU20263000249", targetBaseSN: "26012913" },
//   { snProduct: "TAU20263000250", targetBaseSN: "26012915" },
//   { snProduct: "TAU20263000251", targetBaseSN: "26012917" },
//   { snProduct: "TAU20263000252", targetBaseSN: "26012918" },
//   { snProduct: "TAU20263000253", targetBaseSN: "26012921" },
//   { snProduct: "TAU20263000254", targetBaseSN: "26012923" },
//   { snProduct: "TAU20263000255", targetBaseSN: "26012925" },
//   { snProduct: "TAU20263000256", targetBaseSN: "26012927" },
//   { snProduct: "TAU20263000257", targetBaseSN: "26012931" },
//   { snProduct: "TAU20263000258", targetBaseSN: "26012932" },
//   { snProduct: "TAU20263000259", targetBaseSN: "26012933" },
//   { snProduct: "TAU20263000260", targetBaseSN: "26012934" },
//   { snProduct: "TAU20263000261", targetBaseSN: "26013335" },
//   { snProduct: "TAU20263000262", targetBaseSN: "26013337" },
//   { snProduct: "TAU20263000263", targetBaseSN: "26013342" },
//   { snProduct: "TAU20263000264", targetBaseSN: "26013343" },
//   { snProduct: "TAU20263000265", targetBaseSN: "26013344" },
//   { snProduct: "TAU20263000266", targetBaseSN: "26013346" },
//   { snProduct: "TAU20263000267", targetBaseSN: "26013350" },
//   { snProduct: "TAU20263000268", targetBaseSN: "26013352" },
//   { snProduct: "TAU20263000269", targetBaseSN: "26013353" },
//   { snProduct: "TAU20263000270", targetBaseSN: "26013354" },
//   { snProduct: "TAU20263000271", targetBaseSN: "26013355" },
//   { snProduct: "TAU20263000272", targetBaseSN: "25111162" },
//   { snProduct: "TAU20263000273", targetBaseSN: "25111164" },
//   { snProduct: "TAU20263000274", targetBaseSN: "25111167" },
//   { snProduct: "TAU20263000275", targetBaseSN: "25111168" },
//   { snProduct: "TAU20263000276", targetBaseSN: "25111169" },
//   { snProduct: "TAU20263000277", targetBaseSN: "25111173" },
//   { snProduct: "TAU20263000278", targetBaseSN: "25111174" },
//   { snProduct: "TAU20263000279", targetBaseSN: "25111177" },
//   { snProduct: "TAU20263000280", targetBaseSN: "25111178" },
//   { snProduct: "TAU20263000281", targetBaseSN: "25111179" },
//   { snProduct: "TAU20263000282", targetBaseSN: "25111067" },
//   { snProduct: "TAU20263000283", targetBaseSN: "25111068" },
//   { snProduct: "TAU20263000284", targetBaseSN: "25111069" },
//   { snProduct: "TAU20263000285", targetBaseSN: "25111076" },
//   { snProduct: "TAU20263000346", targetBaseSN: "26011989" },
//   { snProduct: "TAU20263000347", targetBaseSN: "26011990" },
//   { snProduct: "TAU20263000348", targetBaseSN: "26011991" },
//   { snProduct: "TAU20263000349", targetBaseSN: "26011992" },
//   { snProduct: "TAU20263000350", targetBaseSN: "26011993" },
//   { snProduct: "TAU20263000351", targetBaseSN: "26011994" },
//   { snProduct: "TAU20263000352", targetBaseSN: "26011995" },
//   { snProduct: "TAU20263000353", targetBaseSN: "26011996" },
//   { snProduct: "TAU20263000354", targetBaseSN: "26011997" },
//   { snProduct: "TAU20263000355", targetBaseSN: "26011998" },
//   { snProduct: "TAU20263000356", targetBaseSN: "26011999" },
//   { snProduct: "TAU20263000357", targetBaseSN: "26012000" },
//   { snProduct: "TAU20263000358", targetBaseSN: "26012001" },
//   { snProduct: "TAU20263000359", targetBaseSN: "26012002" },
//   { snProduct: "TAU20263000360", targetBaseSN: "26012003" },
//   { snProduct: "TAU20263000361", targetBaseSN: "26012004" },
//   { snProduct: "TAU20263000362", targetBaseSN: "26012006" },
//   { snProduct: "TAU20263000363", targetBaseSN: "26012007" },
//   { snProduct: "TAU20263000364", targetBaseSN: "26012008" },
//   { snProduct: "TAU21263000365", targetBaseSN: "26012009" },
//   { snProduct: "TAU21263000366", targetBaseSN: "26012010" },
//   { snProduct: "TAU21263000367", targetBaseSN: "24064885" },
//   { snProduct: "TAU21263000368", targetBaseSN: "25080377" },
//   { snProduct: "TAU21263000369", targetBaseSN: "24064907" },
//   { snProduct: "TAU21263000370", targetBaseSN: "24064909" },
//   { snProduct: "TAU21263000371", targetBaseSN: "24064910" },
//   { snProduct: "TAU21263000372", targetBaseSN: "25026575" },
//   { snProduct: "TAU21263000373", targetBaseSN: "25026578" },
//   { snProduct: "TAU21263000374", targetBaseSN: "25080294" },
//   { snProduct: "TAU21263000375", targetBaseSN: "25080317" },
//   { snProduct: "TAU21263000376", targetBaseSN: "25080319" },
//   { snProduct: "TAU21263000377", targetBaseSN: "25080320" },
//   { snProduct: "TAU21263000378", targetBaseSN: "25080322" },
//   { snProduct: "TAU21263000379", targetBaseSN: "25080326" },
//   { snProduct: "TAU21263000380", targetBaseSN: "25080328" },
//   { snProduct: "TAU21263000381", targetBaseSN: "25080329" },
//   { snProduct: "TAU21263000382", targetBaseSN: "25080331" },
//   { snProduct: "TAU21263000383", targetBaseSN: "25080333" },
//   { snProduct: "TAU21263000384", targetBaseSN: "25080335" },
//   { snProduct: "TAU21263000385", targetBaseSN: "25080336" },
//   { snProduct: "TAU21263000386", targetBaseSN: "25080337" },
//   { snProduct: "TAU21263000387", targetBaseSN: "25080338" },
//   { snProduct: "TAU21263000388", targetBaseSN: "25080339" },
//   { snProduct: "TAU21263000389", targetBaseSN: "25080340" },
//   { snProduct: "TAU21263000390", targetBaseSN: "25080342" },
//   { snProduct: "TAU21263000391", targetBaseSN: "25080343" },
//   { snProduct: "TAU21263000392", targetBaseSN: "25080344" },
//   { snProduct: "TAU21263000393", targetBaseSN: "25111051" },
//   { snProduct: "TAU21263000394", targetBaseSN: "26012354" },
//   { snProduct: "TAU21263000395", targetBaseSN: "26012355" },
//   { snProduct: "TAU21263000396", targetBaseSN: "26012356" },
//   { snProduct: "TAU21263000397", targetBaseSN: "26012359" },
//   { snProduct: "TAU21263000398", targetBaseSN: "26012360" },
//   { snProduct: "TAU21263000402", targetBaseSN: "26012367" },
//   { snProduct: "TAU21263000403", targetBaseSN: "26012370" },
//   { snProduct: "TAU21263000404", targetBaseSN: "26012372" },
//   { snProduct: "TAU21263000405", targetBaseSN: "26012373" },
//   { snProduct: "TAU21263000406", targetBaseSN: "24126431" },
//   { snProduct: "TAU21263000407", targetBaseSN: "25059774" },
//   { snProduct: "TAU21263000409", targetBaseSN: "25059779" },
//   { snProduct: "TAU21263000410", targetBaseSN: "25059783" },
//   { snProduct: "TAU21263000411", targetBaseSN: "25059787" },
//   { snProduct: "TAU21263000412", targetBaseSN: "25059788" },
//   { snProduct: "TAU21263000413", targetBaseSN: "25059792" },
//   { snProduct: "TAU21263000414", targetBaseSN: "25059795" },
//   { snProduct: "TAU21263000415", targetBaseSN: "25059810" },
//   { snProduct: "TAU21263000416", targetBaseSN: "25059812" },
//   { snProduct: "TAU21263000417", targetBaseSN: "25059818" },
//   { snProduct: "TAU21263000418", targetBaseSN: "26013334" },
//   { snProduct: "TAU21263000419", targetBaseSN: "26013340" },
//   { snProduct: "TAU21263000420", targetBaseSN: "26013341" },
//   { snProduct: "TAU21263000421", targetBaseSN: "26013351" },
// ];

// const mappingTable = [
//   { snProduct: "TAU12263000061", targetBaseSN: "25111060" },
//   { snProduct: "TAU12263000070", targetBaseSN: "26012371" },
// ];

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
  { snProduct: "TAU20265000240", targetBaseSN: "2034042137" },
  { snProduct: "TAU20265000241", targetBaseSN: "2035787829" },
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
/**
 * Функция перепривязки плат (-01, -02) без изменения остальных компонентов
 */
async function remapOnlyBoards(dryRun: boolean = false) {
  console.log("--------------------------------------------------");
  if (dryRun) {
    console.log("⚠️  РЕЖИМ DRY RUN (Сухой прогон). Изменений в БД НЕ БУДЕТ.");
  } else {
    console.log("🚀 РЕЖИМ ПРОДАКШН! Данные записываются в базу.");
  }
  console.log("--------------------------------------------------");

  try {
    for (const item of mappingTable) {
      console.log(`\n🔎 Обработка продукта: ${item.snProduct}`);

      const product = await prisma.product.findUnique({
        where: { snProduct: item.snProduct },
        include: { components: true },
      });

      if (!product) {
        console.error(`❌ Продукт ${item.snProduct} не найден. Пропуск.`);
        continue;
      }

      // Целевые платы, которые ДОЛЖНЫ быть у продукта для модуля
      // const requiredComponentSNs = [
      //   `${item.targetBaseSN}-01`,
      //   `${item.targetBaseSN}-02`,
      // ];

      // Целевые платы, которые ДОЛЖНЫ быть у продукта для клеммника
      const requiredComponentSNs = [
        `${item.targetBaseSN}`,
        // `${item.targetBaseSN}-02`,
      ];

      // Проверяем наличие целевых плат в системе
      const existingComponentsInDb = await prisma.component.findMany({
        where: { snComponent: { in: requiredComponentSNs } },
      });

      if (existingComponentsInDb.length !== requiredComponentSNs.length) {
        const foundSns = existingComponentsInDb.map((c) => c.snComponent);
        const missingSns = requiredComponentSNs.filter(
          (sn) => !foundSns.includes(sn),
        );
        console.error(
          `❌ В БД нет нужных плат: ${missingSns.join(", ")}. Пропуск.`,
        );
        continue;
      }

      // Фильтруем текущие компоненты продукта: выбираем ТОЛЬКО платы (-01 и -02)
      const currentBoards = product.components.filter(
        (c) => c.snComponent.endsWith("-01") || c.snComponent.endsWith("-02"),
      );

      const currentBoardSNs = currentBoards.map((c) => c.snComponent);
      const allComponentSNs = product.components.map((c) => c.snComponent);

      // Проверяем, может платы уже установлены правильно?
      const isAlreadyCorrect =
        requiredComponentSNs.every((sn) => currentBoardSNs.includes(sn)) &&
        currentBoardSNs.length === requiredComponentSNs.length;

      if (isAlreadyCorrect) {
        console.log(
          `✅ У продукта ${item.snProduct} уже стоят правильные платы. Корпус/крепеж не тронуты.`,
        );
        continue;
      }

      // Формируем payload: отвязываем ТОЛЬКО старые платы
      const disconnectPayload = currentBoards.map((c) => ({ id: c.id }));
      // Подвязываем новые платы
      const connectPayload = requiredComponentSNs.map((sn) => ({
        snComponent: sn,
      }));

      console.log(`[Состав изделия сейчас]: ${allComponentSNs.join(", ")}`);
      console.log(
        `[План] Отвязать только платы: ${currentBoardSNs.join(", ") || "нет плат в системе"}`,
      );
      console.log(
        `[План] Привязать новые платы: ${requiredComponentSNs.join(", ")}`,
      );

      if (!dryRun) {
        await prisma.product.update({
          where: { id: product.id },
          data: {
            components: {
              disconnect: disconnectPayload, // убирает связь только с отфильтрованными платами
              connect: connectPayload, // добавляет новые платы в массив компонентов
            },
          },
        });
        console.log(`🎉 Продукт ${item.snProduct}: платы успешно заменены!`);
      } else {
        console.log(
          `ℹ️ [Имитация] Успешная проверка замены плат для ${item.snProduct}`,
        );
      }
    }
  } catch (error) {
    console.error("❌ Ошибка:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Запуск
remapOnlyBoards(RUN_AS_DRY_OUT);
