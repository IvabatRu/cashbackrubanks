import banksRaw from './banks.json';

export interface Bank {
  /** id из реестра СБП, например "bank100000000004" */
  id: string;
  /** Название для показа пользователю */
  name: string;
  /** Путь к логотипу в папке public/logos */
  logo: string;
  /**
   * Имя Android-приложения банка из реестра СБП, например "ru.sberbankmobile".
   * Есть у 161 банка из 196 — у остальных приложения в реестре не указано,
   * и кнопку перехода для них не показываем.
   */
  package?: string;
}

/**
 * Популярные банки — их показываем отдельным блоком наверху списка,
 * чтобы не искать среди 196 штук. Значение — короткое понятное название
 * вместо официального («Банк ВТБ» → «ВТБ»).
 */
const POPULAR_BANK_NAMES: Record<string, string> = {
  'bank100000000008': 'Альфа-Банк',
  'bank100000000259': 'ВБ Банк (Wildberries)',
  'bank110000000005': 'ВТБ',
  'bank100000000001': 'Газпромбанк',
  'bank100000000017': 'МТС Банк',
  'bank100000000273': 'Озон Банк (Ozon)',
  'bank100000000010': 'ПСБ',
  'bank100000000007': 'Райффайзен Банк',
  'bank100000000111': 'Сбербанк',
  'bank100000000013': 'Совкомбанк',
  'bank100000000004': 'Т-Банк',
  'bank100000000150': 'Яндекс Банк',
};

/** Сортировка по-русски: «Ё» рядом с «Е», регистр не влияет. */
function compareByName(a: Bank, b: Bank): number {
  return a.name.localeCompare(b.name, 'ru');
}

interface RawBank {
  id: string;
  name: string;
  package?: string;
}

const rawList = banksRaw as RawBank[];

function toBank(raw: RawBank): Bank {
  return {
    id: raw.id,
    // У популярных банков показываем короткое название, у остальных — как в реестре СБП
    name: POPULAR_BANK_NAMES[raw.id] ?? raw.name,
    // BASE_URL учитывает, что приложение может лежать не в корне домена.
    // ?. — чтобы этот же файл можно было запустить в Node (в smoke-тесте),
    // где переменных сборки Vite нет.
    logo: `${import.meta.env?.BASE_URL ?? '/'}logos/${raw.id}.png`,
    package: raw.package,
  };
}

/** Популярные банки в алфавитном порядке. */
export const POPULAR_BANKS: Bank[] = rawList
  .filter((raw) => raw.id in POPULAR_BANK_NAMES)
  .map(toBank)
  .sort(compareByName);

/** Все 196 участников СБП в алфавитном порядке. */
export const ALL_BANKS: Bank[] = rawList.map(toBank).sort(compareByName);

/** Быстрый доступ по id — чтобы не искать перебором на каждой отрисовке. */
const BANKS_BY_ID = new Map(ALL_BANKS.map((bank) => [bank.id, bank]));

export function getBank(id: string): Bank | undefined {
  return BANKS_BY_ID.get(id);
}

/**
 * Банк, которого нет в реестре (например, реестр обновился и банк убрали).
 * Возвращаем заглушку, чтобы старые данные пользователя не пропали с экрана.
 */
export function getBankOrPlaceholder(id: string): Bank {
  return getBank(id) ?? { id, name: 'Неизвестный банк', logo: '' };
}

export function isPopular(id: string): boolean {
  return id in POPULAR_BANK_NAMES;
}
