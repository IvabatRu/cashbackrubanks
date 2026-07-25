/**
 * Приводит строку к виду, удобному для поиска: нижний регистр, «ё» → «е»,
 * лишние пробелы убраны. Благодаря этому «альфа» находит «АЛЬФА-БАНК»,
 * а «пойдем» находит «КБ Пойдём!».
 */
export function normalizeForSearch(value: string): string {
  return value.toLowerCase().replace(/ё/g, 'е').trim();
}

/** Содержит ли текст поисковый запрос (без учёта регистра и «ё»). */
export function matchesQuery(text: string, query: string): boolean {
  return normalizeForSearch(text).includes(normalizeForSearch(query));
}

/**
 * Показ процента без лишних нулей: 5 → «5», 1.5 → «1,5».
 * Запятая — потому что в русском языке дробный разделитель именно она.
 */
export function formatPercent(percent: number): string {
  return String(Math.round(percent * 100) / 100).replace('.', ',');
}
