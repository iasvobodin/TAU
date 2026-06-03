export function getCurrentFormattedDate(dateInput: Date | string): string {
  let date: Date

  if (dateInput instanceof Date) {
    date = dateInput
  } else if (typeof dateInput === 'string') {
    // Попробуем распарсить строку как дату
    date = new Date(dateInput)

    // Если не получилось — проверим формат ДД.ММ.ГГГГ вручную
    if (isNaN(date.getTime()) && /^\d{2}\.\d{2}\.\d{4}$/.test(dateInput)) {
      const [day, month, year] = dateInput.split('.').map(Number)
      date = new Date(year, month - 1, day)
    }
  } else {
    throw new Error('Invalid date input type')
  }

  // Проверим, валидна ли дата после всех манипуляций
  if (isNaN(date.getTime())) {
    console.warn('Invalid date:', dateInput)
    return ''
  }

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()

  return `${day}.${month}.${year}`
}
