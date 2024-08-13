// Определение типов модулей

const moduleType = {
  Controller: 1,
  PowerSupply: 2,
  Modules: 3,
  PAZ: 4,
  TerminalBlocks: 5,
  SupportPanels: 6
}
type P = keyof typeof moduleType
// Функция для полученя текущей недели и года
function getCurrentWeekAndYear(): { week: string; year: string } {
  const currentDate = new Date()
  const oneJan = new Date(currentDate.getFullYear(), 0, 1)
  const numberOfDays = Math.floor(
    (currentDate.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000)
  )
  const week = Math.ceil((currentDate.getDay() + 1 + numberOfDays) / 7)

  const formattedWeek = week.toString().padStart(2, '0')
  const year = currentDate.getFullYear().toString().slice(-2)

  return { week: formattedWeek, year: year }
}

export function genSN(type: keyof typeof moduleType, quantity: number, uniqueNumber: number) {
  // Переменная для хранения текущего уникального номера
  let currentUniqueNumber = uniqueNumber

  // Функция для формирования серийного номера
  function generateSerialNumber(type: keyof typeof moduleType): string {
    const { week, year } = getCurrentWeekAndYear()
    currentUniqueNumber++
    const formattedUniqueNumber = currentUniqueNumber.toString().padStart(6, '0')

    return `TAU${week}${year}${moduleType[type]}${formattedUniqueNumber}`
  }

  // Функция для генерации определенного количества серийных номеров
  function generateSerialNumbers(
    type: keyof typeof moduleType,
    quantity: number,
    currentUniqueNumber: number
  ): string[] {
    const serialNumbers: string[] = []
    for (let i = 0; i < quantity; i++) {
      serialNumbers.push(generateSerialNumber(type))
    }
    return serialNumbers
  }

  return generateSerialNumbers(type, quantity, currentUniqueNumber)
}
