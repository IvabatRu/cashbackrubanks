/**
 * Период — это календарный месяц в виде строки "YYYY-MM", например "2026-07".
 * Строкой удобнее, чем датой: её можно сравнивать, сортировать и использовать
 * как ключ, и она не зависит от часового пояса.
 */
export type Period = string;

/**
 * Один кешбэк: в таком-то месяце такой-то банк даёт столько-то % за категорию.
 *
 * updatedAt нужен для синхронизации: когда два устройства правили одну и ту же
 * запись, побеждает та, что изменена позже.
 */
export interface Cashback {
  id: string;
  period: Period;
  /** id банка из справочника СБП, например "bank100000000004" (Т-Банк) */
  bankId: string;
  /** id категории — либо встроенной, либо своей */
  categoryId: string;
  percent: number;
  /** Время последнего изменения, миллисекунды epoch */
  updatedAt: number;
}

/** Банк, карта которого есть у пользователя. Порядок в массиве = порядок на экране. */
export interface MyBank {
  id: string;
  addedAt: number;
}

/** Категория кешбэка. Встроенные лежат в src/data/categories.ts, свои — в хранилище. */
export interface Category {
  id: string;
  name: string;
  emoji: string;
  /** true — категорию добавил сам пользователь, её можно удалить */
  custom?: boolean;
  createdAt?: number;
}

/**
 * «Надгробие» — запись о том, что объект удалён и когда.
 *
 * Без них синхронизация воскрешала бы удалённое: второе устройство,
 * ещё не знающее об удалении, прислало бы свою копию обратно.
 *
 * Формат key:
 *   cashback:<period>|<bankId>|<categoryId>
 *   bank:<bankId>
 *   category:<categoryId>
 */
export interface Tombstone {
  key: string;
  at: number;
}

/** Всё, что приложение хранит на устройстве. */
export interface AppData {
  /**
   * Версия схемы. 1 — без отметок времени, 2 — с ними и с надгробиями,
   * 3 — со своим порядком плиток, 4 — с основным банком.
   */
  schemaVersion: number;
  myBanks: MyBank[];
  cashbacks: Cashback[];
  customCategories: Category[];
  deleted: Tombstone[];
  /**
   * Порядок плиток на главном экране, заданный вручную.
   * Пустой массив — порядок автоматический, по убыванию процента.
   */
  categoryOrder: string[];
  /**
   * Когда порядок меняли последний раз. Нужно при синхронизации:
   * порядок — это единое целое, сливать его поэлементно бессмысленно,
   * поэтому побеждает тот, что задан позже.
   */
  categoryOrderUpdatedAt: number;
  /**
   * Основной банк. Когда проценты равны, он идёт первым, и именно его
   * логотип показывается на плитке. null — основной банк не выбран.
   */
  primaryBankId: string | null;
  /** Когда основной банк меняли последний раз — нужно при синхронизации */
  primaryBankUpdatedAt: number;
}

/**
 * Сравнение кешбэков для показа: сначала больший процент, при равенстве —
 * основной банк. Используется и на плитках, и в панели результата,
 * чтобы порядок нигде не расходился.
 */
export function compareCashbacks(
  a: Cashback,
  b: Cashback,
  primaryBankId: string | null,
): number {
  if (b.percent !== a.percent) return b.percent - a.percent;
  if (primaryBankId === null) return 0;
  if (a.bankId === primaryBankId) return -1;
  if (b.bankId === primaryBankId) return 1;
  return 0;
}

/** Ключ, по которому кешбэк узнаётся при слиянии двух устройств. */
export function cashbackKey(cashback: Pick<Cashback, 'period' | 'bankId' | 'categoryId'>): string {
  return `${cashback.period}|${cashback.bankId}|${cashback.categoryId}`;
}

export function cashbackTombstoneKey(
  cashback: Pick<Cashback, 'period' | 'bankId' | 'categoryId'>,
): string {
  return `cashback:${cashbackKey(cashback)}`;
}

export function bankTombstoneKey(bankId: string): string {
  return `bank:${bankId}`;
}

export function categoryTombstoneKey(categoryId: string): string {
  return `category:${categoryId}`;
}
