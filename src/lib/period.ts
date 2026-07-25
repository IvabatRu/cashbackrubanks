import type { Period } from './types';

/**
 * С какого числа месяца открывается заполнение следующего месяца.
 * Банки объявляют новые категории в конце месяца, поэтому с 27-го числа
 * уже можно вносить данные на следующий месяц.
 */
export const NEXT_MONTH_OPENS_ON_DAY = 27;

/** Названия месяцев в именительном падеже: «Июль 2026» */
const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

/** Названия месяцев в родительном падеже: «27 июля» */
const MONTH_NAMES_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

/** Дата → период. new Date(2026, 6, 25) → "2026-07" */
export function toPeriod(date: Date): Period {
  const year = date.getFullYear();
  // +1, потому что в JavaScript месяцы нумеруются с нуля: январь = 0
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/** Разбирает период на числа. "2026-07" → { year: 2026, month: 7 } */
function parsePeriod(period: Period): { year: number; month: number } {
  const [year, month] = period.split('-').map(Number);
  return { year, month };
}

/**
 * Сдвигает период на N месяцев (отрицательное N — назад).
 * Переход через год считается сам: shiftPeriod("2026-12", 1) → "2027-01".
 */
export function shiftPeriod(period: Period, months: number): Period {
  const { year, month } = parsePeriod(period);
  // Date сам нормализует выход за границы года: месяц 12 при индексации с нуля = январь следующего
  return toPeriod(new Date(year, month - 1 + months, 1));
}

/** Текущий месяц. */
export function currentPeriod(now: Date = new Date()): Period {
  return toPeriod(now);
}

/**
 * Открыт ли следующий месяц для заполнения.
 * Да — если сегодня 27-е число или позже.
 */
export function isNextPeriodOpen(now: Date = new Date()): boolean {
  return now.getDate() >= NEXT_MONTH_OPENS_ON_DAY;
}

/**
 * Месяцы, которые сейчас разрешено редактировать: всегда текущий,
 * и следующий — если уже наступило 27-е число.
 */
export function editablePeriods(now: Date = new Date()): Period[] {
  const current = currentPeriod(now);
  return isNextPeriodOpen(now) ? [current, shiftPeriod(current, 1)] : [current];
}

/** Можно ли редактировать этот месяц. Прошлые месяцы — только для просмотра. */
export function isPeriodEditable(period: Period, now: Date = new Date()): boolean {
  return editablePeriods(now).includes(period);
}

/** Сколько дней осталось до открытия следующего месяца. 0 — уже открыт. */
export function daysUntilNextPeriodOpens(now: Date = new Date()): number {
  if (isNextPeriodOpen(now)) return 0;
  return NEXT_MONTH_OPENS_ON_DAY - now.getDate();
}

/** Дата открытия следующего месяца словами: «27 июля» */
export function nextPeriodOpensOnText(now: Date = new Date()): string {
  return `${NEXT_MONTH_OPENS_ON_DAY} ${MONTH_NAMES_GENITIVE[now.getMonth()]}`;
}

/** "2026-07" → "Июль 2026" */
export function formatPeriod(period: Period): string {
  const { year, month } = parsePeriod(period);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** "2026-07" → "Июль" */
export function formatMonth(period: Period): string {
  const { month } = parsePeriod(period);
  return MONTH_NAMES[month - 1];
}

/**
 * Правильная форма слова «день» для числа: 1 день, 2 дня, 5 дней.
 * Нужна для подсказки «до открытия осталось N дней».
 */
export function pluralDays(n: number): string {
  const lastTwo = n % 100;
  const last = n % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return 'дней';
  if (last === 1) return 'день';
  if (last >= 2 && last <= 4) return 'дня';
  return 'дней';
}
