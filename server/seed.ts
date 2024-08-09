import { PrismaClient } from "../extensions/src";

const prisma = new PrismaClient();

const partNumberComponent = [
  {
    partNumber: "AB83624A",
    descriptionEN: "Electronic Board 1 for Controller T01",
    descriptionRU: "Электронная плата 1 для контроллера T01",
  },
  {
    partNumber: "AB83762A",
    descriptionEN: "Electronic Board 2 for Controller T01",
    descriptionRU: "Электронная плата 2 для контроллера T01",
  },
  {
    partNumber: "AB90121A",
    descriptionEN: "Enclosure Size 2 Set for Controller T01",
    descriptionRU:
      "Комплект деталей корпуса, типоразмер 2, материал - пластик, для контроллера T01",
  },
  {
    partNumber: "AB83724A",
    descriptionEN: "Electronic Board 1 for power supply - 12/24VDC ",
    descriptionRU: "Электронная плата 1 для системного модуля питания 12-24В",
  },
  {
    partNumber: "AB90122A",
    descriptionEN: "Enclosure Size 3 Set for power supply - 12/24VDC ",
    descriptionRU:
      "Комплект деталей корпуса, типоразмер 3, материал - пластик, для системного модуля питания 12-24В",
  },
  {
    partNumber: "AB80268A",
    descriptionEN:
      "Electronic Board 1 for Analog Input/Output 4-20mA HART 8 ch - Series 2 ",
    descriptionRU:
      "Электронная плата 1 для модуля 8-канального аналогового ввода/вывода от 4 до 20 мА, с поддержкой HART",
  },
  {
    partNumber: "AB80277A",
    descriptionEN:
      "Electronic Board 2 for Analog Input 4-20mA HART 8 ch - Series 2 ",
    descriptionRU:
      "Электронная плата 2 для модуля 8-канального аналогового ввода от 4 до 20 мА, с поддержкой HART",
  },
  {
    partNumber: "AB80234A",
    descriptionEN:
      "Electronic Board 2 for Analog Output 4-20mA HART 8 ch - Series 2",
    descriptionRU:
      "Электронная плата 2 для модуля 8-канального аналогового вывода от 4 до 20 мА, с поддержкой HART",
  },
  {
    partNumber: "AB80365A",
    descriptionEN:
      "Electronic Board 1 for Discrete input - 24VDC Dry Contact - 8 ch",
    descriptionRU:
      ' Электронная плата 1 для модуля 8-канального дискретного ввода, 24В, "Сухой контакт"',
  },
  {
    partNumber: "AB80307A",
    descriptionEN:
      "Electronic Board 2 for Discrete input - 24VDC Dry Contact - 8 ch",
    descriptionRU:
      ' Электронная плата 2 для модуля 8-канального дискретного ввода, 24В, "Сухой контакт"',
  },
  {
    partNumber: "AB80264A",
    descriptionEN:
      "Electronic Board 1 for Discrete input - 24VDC Dry Contact - 32 ch - Series 1",
    descriptionRU:
      ' Электронная плата 1 для модуля 32-канального дискретного ввода, 24В, "Сухой контакт" - серия 1',
  },
  {
    partNumber: "AB80357A",
    descriptionEN:
      "Electronic Board 2 for Discrete input - 24VDC Dry Contact - 32 ch - Series 1",
    descriptionRU:
      ' Электронная плата 2 для модуля 32-канального дискретного ввода, 24В, "Сухой контакт" - серия 1',
  },
  {
    partNumber: "AB80733A",
    descriptionEN:
      "Electronic Board 1 for Discrete input - 24VDC Dry Contact - 32 ch - Series 2",
    descriptionRU:
      ' Электронная плата 1 для модуля 32-канального дискретного ввода, 24В, "Сухой контакт" - серия 2',
  },
  {
    partNumber: "AB80735A",
    descriptionEN:
      "Electronic Board 2 for Discrete input - 24VDC Dry Contact - 32 ch - Series 2",
    descriptionRU:
      ' Электронная плата 2 для модуля 32-канального дискретного ввода, 24В, "Сухой контакт" - серия 2',
  },
  {
    partNumber: "AB80164A",
    descriptionEN:
      "Electronic Board 1 for Discrete Output - 24VDC High side - 8 ch - Series 2 ",
    descriptionRU:
      "Электронная плата 1 для модуля 8-канального дискретного вывода, 24В, потенциальный контакт",
  },
  {
    partNumber: "AB80465A",
    descriptionEN:
      "Electronic Board 2 for Discrete Output - 24VDC High side - 8 ch - Series 2 ",
    descriptionRU:
      "Электронная плата 2 для модуля 8-канального дискретного вывода, 24В, потенциальный контакт",
  },
  {
    partNumber: "AB80255A",
    descriptionEN:
      "Electronic Board 1 for Discrete Output - 24VDC High side - 32 ch - Series 1 ",
    descriptionRU:
      "Электронная плата 1 для модуля 32-канального дискретного вывода, 24В, потенциальный контакт - серия 1",
  },
  {
    partNumber: "AB80208A",
    descriptionEN:
      "Electronic Board 2 for Discrete Output - 24VDC High side - 32 ch - Series 1 ",
    descriptionRU:
      "Электронная плата 2 для модуля 8-канального дискретного вывода, 24В, потенциальный контакт - серия 1",
  },
  {
    partNumber: "AB80789A",
    descriptionEN:
      "Electronic Board 1 for Discrete Output - 24VDC High side - 32 ch - Series 2 ",
    descriptionRU:
      "Электронная плата 1 для модуля 32-канального дискретного вывода, 24В, потенциальный контакт - серия 2",
  },
  {
    partNumber: "AB80839A",
    descriptionEN:
      "Electronic Board 2 for Discrete Output - 24VDC High side - 32 ch - Series 2 ",
    descriptionRU:
      "Электронная плата 2 для модуля 8-канального дискретного вывода, 24В, потенциальный контакт - серия 2",
  },
  {
    partNumber: "AB80205A",
    descriptionEN: "Electronic Board 1 for Serial Card - 2 Ports, RS232/RS485",
    descriptionRU:
      "Электронная плата 1 для модуля последовательного интерфейса - 2 порта, RS-232/485",
  },
  {
    partNumber: "AB80806A",
    descriptionEN: "Electronic Board 2 for Serial Card - 2 Ports, RS232/RS485",
    descriptionRU:
      "Электронная плата 2 для модуля последовательного интерфейса - 2 порта, RS-232/485",
  },
  {
    partNumber: "AB80583A",
    descriptionEN: "Electronic Board 1 for Fieldbus H1 ",
    descriptionRU: "Электронная плата 1 для модуля интерфейса Fieldbus H1",
  },
  {
    partNumber: "AB80548A",
    descriptionEN: "Electronic Board 2 for Fieldbus H1 ",
    descriptionRU: "Электронная плата 2 для модуля интерфейса Fieldbus H1",
  },
  {
    partNumber: "AB90120A",
    descriptionEN: "Enclosure Size 1 Set for Card",
    descriptionRU:
      "Комплект деталей корпуса, типоразмер 1, материал - пластик, для модулей",
  },
  {
    partNumber: "AB90135A",
    descriptionEN: "Long Mounting Screw",
    descriptionRU: "Длинный крепежный винт, материал - пластик",
  },
  {
    partNumber: "AB86395A",
    descriptionEN: "Electronic Board 1 for 2-wide power/controller carrier",
    descriptionRU:
      "Плата 1 для 2-слотовой несущей панели источников питания и контроллеров",
  },
  {
    partNumber: "AB90123A",
    descriptionEN: "Enclosure Size 4 Set for 2-wide power/controller carrier",
    descriptionRU:
      "Комплект деталей корпуса, типоразмер 4, материал - пластик, для 2-слотовой несущей панели",
  },
  {
    partNumber: "AB86104A",
    descriptionEN:
      "Electronic Board 1 for 8-wide I/O carrier with carrier shield bar",
    descriptionRU:
      "Плата 1 для 8-слотовой несущей панели модулей ввода-вывода, c шиной заземления",
  },
  {
    partNumber: "AB90124A",
    descriptionEN: "Enclosure Size 5 Set for 8-wide I/O ",
    descriptionRU:
      "Комплект деталей корпуса, типоразмер 5, материал - пластик, для 8-слотовой несущей панели",
  },
  {
    partNumber: "AB86359A",
    descriptionEN: "Electronic Board 1 for Dual Left extender",
    descriptionRU: "Плата 1 для панели расширения локальной шины, левая",
  },
  {
    partNumber: "AB86367A",
    descriptionEN: "Electronic Board 1 for Dual right extender",
    descriptionRU: "Плата 1 для панели расширения локальной шины, правая",
  },
  {
    partNumber: "AB90125A",
    descriptionEN: "Enclosure Size 6 Set for extender",
    descriptionRU:
      "Комплект деталей корпуса, типоразмер 6, материал - пластик, для панели расширения локальной шины",
  },
  {
    partNumber: "AB88412A",
    descriptionEN: "Extension Cable",
    descriptionRU: "Удлинительный кабель локальной шины",
  },
  {
    partNumber: "AB86444A",
    descriptionEN: "Electronic Board 1 for SISNet Terminator",
    descriptionRU:
      "Плата 1 для панели расширения локальной шины, правая, с терминатором (резистором) сети SISNet",
  },
  {
    partNumber: "AB88459A",
    descriptionEN: "SISNet Extension Cable - Black",
    descriptionRU: "Коаксиальный кабель сети SisNet, 1,2 метра, черный",
  },
  {
    partNumber: "AB88460A",
    descriptionEN: "SISNet Extension Cable - White",
    descriptionRU: "Коаксиальный кабель сети SisNet, 1,2 метра, белый",
  },
  {
    partNumber: "AB84627A",
    descriptionEN: "Board 1 for Simplex Logic Solver Terminal Block",
    descriptionRU: "Плата 1 для клеммного блока контроллера ПАЗ",
  },
  {
    partNumber: "AB90130A",
    descriptionEN:
      "Enclosure Size 12 Set for Simplex Logic Solver Terminal Block",
    descriptionRU:
      "Комплект деталей корпуса, типоразмер 12, материал - пластик, для клеммного блока контроллера ПАЗ",
  },
  {
    partNumber: "AB84627A",
    descriptionEN: "Board 1 for Redundant Logic Solver Terminal Block",
    descriptionRU:
      "Плата 1 для клеммного блока резервированного контроллера ПАЗ",
  },
  {
    partNumber: "AB90131A",
    descriptionEN:
      "Enclosure Size 13 Set for Redundant Logic Solver Terminal Block",
    descriptionRU:
      "Комплект деталей корпуса, типоразмер 13, материал - пластик, для клеммного блока резервированного контроллера ПАЗ",
  },
  {
    partNumber: "AB87781A",
    descriptionEN: "Electronic Board 1 for Smart Logic Solver ",
    descriptionRU: "Электронная плата 1 для контроллера ПАЗ",
  },
  {
    partNumber: "AB87782A",
    descriptionEN: "Electronic Board 2 for Smart Logic Solver ",
    descriptionRU: "Электронная плата 2 для контроллера ПАЗ",
  },
  {
    partNumber: "AB87783A",
    descriptionEN: "Electronic Board 3 for Smart Logic Solver ",
    descriptionRU: "Электронная плата 3 для контроллера ПАЗ",
  },
  {
    partNumber: "AB87784A",
    descriptionEN: "Electronic Board 4 for Smart Logic Solver ",
    descriptionRU: "Электронная плата 4 для контроллера ПАЗ",
  },
  {
    partNumber: "AB87785A",
    descriptionEN: "Electronic Board 5 for Smart Logic Solver ",
    descriptionRU: "Электронная плата 5 для контроллера ПАЗ",
  },
  {
    partNumber: "AB87786A",
    descriptionEN: "Electronic Board 6 for Smart Logic Solver ",
    descriptionRU: "Электронная плата 6 для контроллера ПАЗ",
  },
  {
    partNumber: "AB90126A",
    descriptionEN: "Enclosure Size 7 Set for Smart Logic Solver ",
    descriptionRU:
      "Комплект деталей корпуса, типоразмер 7, материал - пластик, для контроллера ПАЗ",
  },
  {
    partNumber: "AB84350A",
    descriptionEN: "Board 1 for Redundant Analog input Terminal Block",
    descriptionRU:
      "Плата 1 для клеммного блока резервированных модулей аналогового ввода",
  },
  {
    partNumber: "AB84352A",
    descriptionEN: "Board 1 for Redundant Analog output Terminal Block",
    descriptionRU:
      "Плата 1 для клеммного блока резервированных модулей аналогового вывода",
  },
  {
    partNumber: "AB84348A",
    descriptionEN: "Board 1 for Redundant Discrete Terminal Block",
    descriptionRU:
      "Плата 1 для клеммного блока резервированных модулей дискретного в/в",
  },
  {
    partNumber: "AB84402A",
    descriptionEN: "Board 1 for Redundant Interface terminal Block",
    descriptionRU:
      "Плата 1 для клеммного блока резервированных модулей последовательного интерфейса",
  },
  {
    partNumber: "AB84738A",
    descriptionEN: "Board 1 for Redundant Fieldbus H1 Terminal Block",
    descriptionRU:
      "Плата 1 для клеммного блока резервированных модулей интерфейса H1 Fieldbus",
  },
  {
    partNumber: "AB90128A",
    descriptionEN: "Enclosure Size 9 Set for Redundant Terminal Block",
    descriptionRU:
      "Комплект деталей корпуса, типоразмер 9, материал - пластик, для клеммного блока резервированных модулей",
  },
  {
    partNumber: "AB84200A",
    descriptionEN: "Board 1 for Interface Terminal Block",
    descriptionRU:
      "Плата 1 для клеммного блока модулей последовательного интерфейса",
  },
  {
    partNumber: "AB84394A",
    descriptionEN: "Board 1 for Analog input standard Terminal Block",
    descriptionRU:
      "Плата 1 для стандартного клеммного блока модулей аналогового ввода",
  },
  {
    partNumber: "AB84390A",
    descriptionEN: "Board 1 for Fieldbus H1 Terminal Block",
    descriptionRU: "Плата 1 для клеммного блока модулей интерфейса H1 Fieldbus",
  },
  {
    partNumber: "AB90129A",
    descriptionEN: "Enclosure Size 10 Set for Terminal Block",
    descriptionRU:
      "Комплект деталей корпуса, типоразмер 10, материал - пластик, для клеммного блока модулей",
  },
  {
    partNumber: "AB84589A",
    descriptionEN: "Board 1 for Analog input 2/4 wire Terminal Block",
    descriptionRU:
      "Плата 1 для клеммного блока модулей аналогового ввода, для 4-проводных датчиков",
  },
  {
    partNumber: "AB84343A",
    descriptionEN: "Board 1 for 32 Ch Discrete Input/Output Terminal Block",
    descriptionRU:
      "Плата 1 для клеммного блока 32-канальных модулей дискретного в/в",
  },
  {
    partNumber: "AB90130A",
    descriptionEN: "Enclosure Size 11 Set for Terminal Block",
    descriptionRU:
      "Комплект деталей корпуса, типоразмер 11, материал - пластик, для клеммного блока модулей",
  },
  {
    partNumber: "AB91031A",
    descriptionEN: "Carrier Blank Cap",
    descriptionRU: "Крышка пустого разъема в несущей панели",
  },
  {
    partNumber: "AB90136A",
    descriptionEN: "Short Mounting Screw",
    descriptionRU: "Короткий крепежный винт, материал - пластик",
  },
];

//ПОВТОРКИ
// AB84627A
// AB90130A

// const unic = partNumberComponent.reduce<Set<string>>((acc, e) => {
//     return acc.add(e.partNumber)
// }, new Set())
// console.log(unic, unic.size);

const specification = [
  {
    type: "Controller",
    productName: "Контроллер T01",
    productMM: "MM3006",
    productMP: "MP2003X1-BB1 ",
    electronicBoard1: "AB83624A",
    electronicBoard2: "AB83762A",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "",
    enclosureType: "AB90121A",
    mountingScrew: "AB90135A",
    version: 1,
    packingBox: "AB93220A",
  },
  {
    type: "PowerSupply",
    productName: "Системный модуль питания 12-24В (DC/DC)",
    productMM: "MM5009",
    productMP: "MP1501X1-BC3 ",
    electronicBoard1: "AB83724A",
    electronicBoard2: "",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "",
    enclosureType: "AB90122A",
    mountingScrew: "AB90135A",
    version: 1,
    packingBox: "AB93220A",
  },
  {
    type: "Modules",
    productName:
      "Модуль 8-канального аналогового ввода от 4 до 20 мА, с поддержкой HART",
    productMM: "MP3222X1-BA1 ",
    productMP: "MP3222X1-BA1 ",
    electronicBoard1: "AB80268A",
    electronicBoard2: "AB80277A",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "",
    enclosureType: "AB90120A",
    mountingScrew: "AB90135A",
    version: 1,
    packingBox: "AB93220A",
  },
  {
    type: "Modules",
    productName:
      "Модуль 8-канального аналогового вывода от 4 до 20 мА, с поддержкой HART",
    productMM: "MP3221X1-BA1",
    productMP: "MP3221X1-BA1 ",
    electronicBoard1: "AB80268A",
    electronicBoard2: "AB80234A",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "",
    enclosureType: "AB90120A",
    mountingScrew: "AB90135A",
    version: 1,
    packingBox: "AB93220A",
  },
  {
    type: "Modules",
    productName:
      'Модуль 8-канального дискретного ввода, 24В (DC), ""Сухой контакт""',
    productMM: "MP3201X1-BA1 ",
    productMP: "MP3201X1-BA1 ",
    electronicBoard1: "AB80365A",
    electronicBoard2: "AB80307A",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "",
    enclosureType: "AB90120A",
    mountingScrew: "AB90135A",
    version: 1,
    packingBox: "AB93220A",
  },
  {
    type: "Modules",
    productName:
      'Модуль 32-канального дискретного ввода, 24В (DC), ""Сухой контакт""',
    productMM: "MP3203X1-BA1 ",
    productMP: "MP3203X1-BA1 ",
    electronicBoard1: "AB80733A",
    electronicBoard2: "AB80735A",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "",
    enclosureType: "AB90120A",
    mountingScrew: "AB90135A",
    version: 1,
    packingBox: "AB93220A",
  },
  {
    type: "Modules",
    productName:
      "Модуль 8-канального дискретного вывода, 24В (DC), потенциальный контакт",
    productMM: "MP3202X1-BA1 ",
    productMP: "MP3202X1-BA1 ",
    electronicBoard1: "AB80164A",
    electronicBoard2: "AB80465A",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "",
    enclosureType: "AB90120A",
    mountingScrew: "AB90135A",
    version: 1,
    packingBox: "AB93220A",
  },
  {
    type: "Modules",
    productName:
      "Модуль 32-канального дискретного вывода, 24В (DC), потенциальный контакт",
    productMM: "MP3204X1-BA1",
    productMP: "MP3204X1-BA1",
    electronicBoard1: "AB80789A",
    electronicBoard2: "AB80839A",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "",
    enclosureType: "AB90120A",
    mountingScrew: "AB90135A",
    version: 1,
    packingBox: "AB93220A",
  },
  {
    type: "Modules",
    productName: "Модуль последовательного интерфейса RS-232/485",
    productMM: "MP3241X1-BA1 ",
    productMP: "MP3241X1-BA1 ",
    electronicBoard1: "AB80205A",
    electronicBoard2: "AB80806A",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "",
    enclosureType: "AB90120A",
    mountingScrew: "AB90135A",
    version: 1,
    packingBox: "AB93220A",
  },
  {
    type: "Modules",
    productName: "Модуль интерфейса H1 Fieldbus",
    productMM: "MP3242X1-BA1 ",
    productMP: "MP3242X1-BA1 ",
    electronicBoard1: "AB80583A",
    electronicBoard2: "AB80548A",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "",
    enclosureType: "AB90120A",
    mountingScrew: "AB90135A",
    version: 1,
    packingBox: "AB93220A",
  },
  {
    type: "SupportPanels",
    productName:
      '2-слотовая несущая панель для источников питания и контроллеров, с поддержкой шины для приборной системы безопасности (""ПАЗ"")',
    productMM: "MP4001X1-BA3 ",
    productMP: "MP4001X1-BA3 ",
    electronicBoard1: "AB86395A",
    electronicBoard2: "",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "",
    enclosureType: "AB90123A",
    mountingScrew: "",
    version: 1,
    packingBox: "AB93221A",
  },
  {
    type: "SupportPanels",
    productName:
      "Несущая панель 8-и слотовая для модулей ввода-вывода: с разъемами для установки плат ввода/вывода, разъемами питания и шиной заземления",
    productMM: "MP4001X1-BE1 ",
    productMP: "MP4001X1-BE1 ",
    electronicBoard1: "AB86104A",
    electronicBoard2: "",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "",
    enclosureType: "AB90124A",
    mountingScrew: "",
    version: 1,
    packingBox: "AB93222A",
  },
  {
    type: "SupportPanels",
    productName:
      "Панель расширения (соединитель) локальной шины, для монтажа несущей панели, для несущих панелей с поддержкой резервированного кабеля, левая",
    productMM: "MP4001X1-NB1",
    productMP: "MP4001X1-NB1",
    electronicBoard1: "AB86359A",
    electronicBoard2: "",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "",
    enclosureType: "AB90125A",
    mountingScrew: "",
    version: 1,
    packingBox: "AB93220A",
  },
  {
    type: "SupportPanels",
    productName:
      "Панель расширения (соединитель) локальной шины, для монтажа несущей панели, для несущих панелей с поддержкой резервированного кабеля, правая",
    productMM: "MP4001X1-NA1 ",
    productMP: "MP4001X1-NA1 ",
    electronicBoard1: "AB86367A",
    electronicBoard2: "",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "",
    enclosureType: "AB90125A",
    mountingScrew: "",
    version: 1,
    packingBox: "AB93220A",
  },
  {
    type: "SupportPanels",
    productName: "Удлинительный кабель локальной шины",
    productMM: "MP4002X1-BF2",
    productMP: "MP4002X1-BF2",
    electronicBoard1: "",
    electronicBoard2: "",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "AB88412A",
    enclosureType: "",
    mountingScrew: "",
    version: 1,
    packingBox: "AB93221A",
  },
  {
    type: "SupportPanels",
    productName: "Терминатор несущего панели сети безопасности ПАЗ (SISNet)",
    productMM: "MS6051",
    productMP: "MP4010X1-BN1",
    electronicBoard1: "AB86444A",
    electronicBoard2: "",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "",
    enclosureType: "AB90125A",
    mountingScrew: "",
    version: 1,
    packingBox: "AB93220A",
  },
  {
    type: "SupportPanels",
    productName:
      "Коаксиальный кабель сети безопасности (SisNet) 1,2 метра, черный",
    productMM: "MP4010X1-BL1",
    productMP: "MP4010X1-BL1",
    electronicBoard1: "",
    electronicBoard2: "",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "AB88459A",
    enclosureType: "",
    mountingScrew: "",
    version: 1,
    packingBox: "AB93220A",
  },
  {
    type: "SupportPanels",
    productName:
      "Коаксиальный кабель сети безопасности (SisNet) 1,2 метра, белый",
    productMM: " MP4010X1-BM1",
    productMP: " MP4010X1-BM1",
    electronicBoard1: "AB84626A",
    electronicBoard2: "",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "AB88460A",
    enclosureType: "",
    mountingScrew: "",
    version: 1,
    packingBox: "AB93220A",
  },
  {
    type: "TerminalBlocks",
    productName: "Клеммный блок для симплексного модуля контроллера ПАЗ",
    productMM: "MS2201X1-HA1",
    productMP: "MS2201X1-HA1",
    electronicBoard1: "AB84627A",
    electronicBoard2: "",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "",
    enclosureType: "SAB90130A",
    mountingScrew: "",
    version: 1,
    packingBox: "AB93220A",
  },
  {
    type: "TerminalBlocks",
    productName: "Клеммный блок для резервированного модуля контроллера ПАЗ ",
    productMM: "MS2201X1-JA1",
    productMP: "MS2201X1-JA1",
    electronicBoard1: "AB84627A",
    electronicBoard2: "",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "",
    enclosureType: "AB90131A",
    mountingScrew: "",
    version: 1,
    packingBox: "AB93220A",
  },
  {
    type: "PAZ",
    productName: "Контроллер ПАЗ (16-канальный логический вычислитель)",
    productMM: "MS3201 ",
    productMP: "MS2201X1-BA1",
    electronicBoard1: "AB87781A",
    electronicBoard2: "AB87782A",
    electronicBoard3: "AB87783A",
    electronicBoard4: "AB87784A",
    electronicBoard5: "AB87785A",
    electronicBoard6: "AB87786A",
    otherCirciutry: "",
    enclosureType: "AB90126A",
    mountingScrew: "AB90135A",
    version: 1,
    packingBox: "AB93221A",
  },
  {
    type: "TerminalBlocks",
    productName: "Клеммный блок для резервированных модулей аналогового ввода",
    productMM: "MP3222X1-EA1",
    productMP: "MP3222X1-EA1",
    electronicBoard1: "AB84350A",
    electronicBoard2: "",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "Selector: AB84351A",
    enclosureType: "AB90128A",
    mountingScrew: "",
    version: 1,
    packingBox: "AB93220A",
  },
  {
    type: "TerminalBlocks",
    productName: "Клеммный блок для резервированных модулей аналогового вывода",
    productMM: "MP3221X1-EA1",
    productMP: "MP3221X1-EA1",
    electronicBoard1: "AB84352A",
    electronicBoard2: "",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "",
    enclosureType: "AB90128A",
    mountingScrew: "",
    version: 1,
    packingBox: "AB93220A",
  },
  {
    type: "TerminalBlocks",
    productName: "Клеммный блок для резервированных модулей дискретного в/в",
    productMM: "MP3201X1-EA1 ",
    productMP: "MP3201X1-EA1",
    electronicBoard1: "AB84348A",
    electronicBoard2: "",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "",
    enclosureType: "AB90128A",
    mountingScrew: "",
    version: 1,
    packingBox: "AB93220A",
  },
  {
    type: "TerminalBlocks",
    productName:
      "Клеммный блок для резервированных модулей последовательного интерфейса",
    productMM: "MP3241X1-EA1",
    productMP: "MP3241X1-EA1",
    electronicBoard1: "AB84402A",
    electronicBoard2: "",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "",
    enclosureType: "AB90128A",
    mountingScrew: "",
    version: 1,
    packingBox: "AB93220A",
  },
  {
    type: "TerminalBlocks",
    productName:
      "Клеммный блок для резервированных модулей интерфейса H1 Fieldbus",
    productMM: "MP3242X1-FA1",
    productMP: "MP3242X1-FA1",
    electronicBoard1: "AB84738A",
    electronicBoard2: "",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "",
    enclosureType: "AB90128A",
    mountingScrew: "",
    version: 1,
    packingBox: "AB93220A",
  },
  {
    type: "TerminalBlocks",
    productName: "Клеммный блок для модулей последовательного интерфейса",
    productMM: "MP3003X1-EA1",
    productMP: "MP3003X1-EA1",
    electronicBoard1: "AB84200A",
    electronicBoard2: "",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "",
    enclosureType: "SAB90129A",
    mountingScrew: "",
    version: 1,
    packingBox: "AB93220A",
  },
  {
    type: "TerminalBlocks",
    productName: "Стандартный клеммный блок для 8-канальных модулей в/в",
    productMM: "MP4001X1-CA1",
    productMP: "MP4001X1-CA1",
    electronicBoard1: "AB84394A",
    electronicBoard2: "",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "",
    enclosureType: "SAB90129A",
    mountingScrew: "",
    version: 1,
    packingBox: "AB93220A",
  },
  {
    type: "TerminalBlocks",
    productName: "Клеммный блок для 4-проводных датчиков",
    productMM: "MP4001X1-CC1",
    productMP: "MP4001X1-CC1",
    electronicBoard1: "",
    electronicBoard2: "",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "",
    enclosureType: "SAB90130A",
    mountingScrew: "",
    version: 1,
    packingBox: "AB93220A",
  },
  {
    type: "TerminalBlocks",
    productName: "Клеммный блок для 32-канальных модулей дискретного в/в",
    productMM: "MP4001X1-CJ1 ",
    productMP: "MP4001X1-CJ1",
    electronicBoard1: "AB84343A",
    electronicBoard2: "",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "",
    enclosureType: "SAB90130A",
    mountingScrew: "",
    version: 1,
    packingBox: "AB93220A",
  },
  {
    type: "TerminalBlocks",
    productName: "Клеммный блок для симплексных модулей интерфейса H1 Fieldbus",
    productMM: "MP3242X1-EA1",
    productMP: "MP3242X1-EA1",
    electronicBoard1: "AB84390A",
    electronicBoard2: "",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "",
    enclosureType: "SAB90129A",
    mountingScrew: "",
    version: 1,
    packingBox: "AB93220A",
  },
  {
    type: "TerminalBlocks",
    productName: "Крышка пустого разъема в несущей панели",
    productMM: "MP4001X1-FA1",
    productMP: "MP4001X1-FA1",
    electronicBoard1: "",
    electronicBoard2: "",
    electronicBoard3: "",
    electronicBoard4: "",
    electronicBoard5: "",
    electronicBoard6: "",
    otherCirciutry: "",
    enclosureType: "AB91031A",
    mountingScrew: "AB90136A",
    version: 1,
    packingBox: "AB93220A",
  },
];

const operation = {
  version: 1,
  issue: false,
  preProdaction: false,
  assembly: true,
  marking: true,
  functionalTest: true,
  verification: false,
  package: true,
};

const template = {
  version: 1,
  markingTemplate: "Шаблон ТАУ СПМШ-2007",
  markingEquipment: "Оснастка №893473",
  stendForHiPot: "Стенд 112353",
  stendForTest: "Стенд 238372",
  verificationProtocol: "",
  RE: "",
  PS: "",
  boxLabel: "",
};

const test = {
  version: 1,
  HiPot: "",
};

// for (const component of partNumberComponent) {
//   try {
//     await prisma.partNumberComponent.create({
//       data: component,
//     });
//   } catch (error) {
//     console.log(error);
//   }
// }

// try {
//   await prisma.operation.create({
//     data: operation,
//   });
//   console.log("done");
//   await prisma.template.create({
//     data: template,
//   });
//   console.log("done");
//   await prisma.test.create({
//     data: test,
//   });
//   console.log("done");
// } catch (error) {
//   console.log(error);
// }

// for (const component of specification) {
//   try {
//     await prisma.specification.create({
//       data: component,
//     });
//   } catch (error) {
//     console.log(error);
//   }
// }

// const createPartNumberComponents = async () => {
//   // console.log('grhert464574678');
//   for (const component of partNumberComponent) {
//     try {
//       await prisma.partNumberComponent.create({
//         data: component,
//       });
//     } catch (error) {
//       console.log(error);
//     }
//   }
// };

// const createOthers = async () => {
//   try {
//     await prisma.operation.create({
//       data: operation,
//     });
//     console.log("done");
//     await prisma.template.create({
//       data: template,
//     });
//     console.log("done");
//     await prisma.test.create({
//       data: test,
//     });
//     console.log("done");
//   } catch (error) {
//     console.log(error);
//   }
// };

// const createSpecificatios = async () => {
//   for (const component of specification) {
//     try {
//       await prisma.specification.create({
//         data: component,
//       });
//     } catch (error) {
//       console.log(error);
//     }
//   }
// };

// const createDB = async () => {
//   await createPartNumberComponents();
//   await createOthers();
//   await createSpecificatios();
// };

//   createDB()

// try {
//     await prisma.template.create({
//         data: template,
//     });
//     console.log('done');

// } catch (error) {
//     console.log(error);
// }

// try {
//     await prisma.test.create({
//         data: test,
//     });
//     console.log('done');

// } catch (error) {
//     console.log(error);
// }

// try {
//     await prisma.template.update({
//         where: {id:1},
//         data: template
//     })
//     console.log('done');

// } catch (error) {
//     console.log(error);
// }

// try {
//     await prisma.operation.update({
//         where: {id:1},
//         data: operation
//     })
//     console.log('done');

// } catch (error) {
//     console.log(error);
// }

// for (const component of specification) {
//     try {
//         await prisma.specification.update({
//             where: {
//                 productMP: component.productMP
//             },
//             data: {
//                 type: component.type
//             },
//         });
//     } catch (error) {
//         console.log(error);
//     }
// }

// await prisma.partNumberComponent.deleteMany({})
// for (const component of specification) {
//     await prisma.specification.create({
//         data: component,
//     });
// }

// // count the number of users
// const count = await prisma.partNumberComponent.findMany({
//     orderBy: {
//         id: 'desc',
//     },
//     take: 1,
// })
// await prisma.productionOperation.deleteMany();
// await prisma.component.deleteMany();
// await prisma.product.deleteMany();
await prisma.user.deleteMany();
// console.log(`database seeded.`, await prisma.product.count());
