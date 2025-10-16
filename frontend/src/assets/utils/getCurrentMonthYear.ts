export function getCurrentMonthYear(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0') // Месяцы от 0 до 11, добавляем 1
  const year = now.getFullYear()
  return `${month}.${year}`
}
