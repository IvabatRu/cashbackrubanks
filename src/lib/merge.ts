import { pruneTombstones, SCHEMA_VERSION } from './storage';
import {
  bankTombstoneKey,
  cashbackKey,
  cashbackTombstoneKey,
  categoryTombstoneKey,
} from './types';
import type { AppData, Cashback, Category, MyBank, Tombstone } from './types';

/**
 * Сливает данные двух устройств так, чтобы ничего введённого не потерялось.
 *
 * Правила:
 *  - кешбэк узнаётся по тройке «месяц + банк + категория». Если он есть у обоих,
 *    побеждает запись с более поздним updatedAt;
 *  - если по объекту есть надгробие свежее самого объекта — объект удалён,
 *    и второе устройство не сможет его воскресить;
 *  - порядок банков берём с того устройства, чьи данные передали первыми (local),
 *    новые банки со второго добавляются в конец.
 *
 * Функция симметрична по данным, но не по порядку банков — это осознанно:
 * порядок карточек на экране должен оставаться «своим».
 */
export function mergeAppData(local: AppData, remote: AppData, now: number = Date.now()): AppData {
  const tombstones = mergeTombstones(local.deleted, remote.deleted, now);

  /** Удалён ли объект: есть надгробие не старше самого объекта. */
  const isDeleted = (key: string, objectTime: number): boolean => {
    const deletedAt = tombstones.get(key);
    return deletedAt !== undefined && deletedAt >= objectTime;
  };

  const myBanks = mergeBanks(local.myBanks, remote.myBanks, isDeleted);
  const bankIds = new Set(myBanks.map((bank) => bank.id));

  const customCategories = mergeCategories(
    local.customCategories,
    remote.customCategories,
    isDeleted,
  );

  const cashbacks = mergeCashbacks(local.cashbacks, remote.cashbacks, isDeleted).filter(
    // Осиротевшие кешбэки убираем: банк удалён, а запись почему-то осталась
    (cashback) => bankIds.has(cashback.bankId),
  );

  // Настройки — единое целое: сливать их поэлементно бессмысленно,
  // получилась бы каша из двух расстановок. Берём заданные позже.
  const orderSource =
    local.categoryOrderUpdatedAt >= remote.categoryOrderUpdatedAt ? local : remote;
  const primarySource =
    local.primaryBankUpdatedAt >= remote.primaryBankUpdatedAt ? local : remote;

  return {
    schemaVersion: SCHEMA_VERSION,
    myBanks,
    cashbacks,
    customCategories,
    deleted: [...tombstones].map(([key, at]) => ({ key, at })),
    categoryOrder: orderSource.categoryOrder,
    categoryOrderUpdatedAt: orderSource.categoryOrderUpdatedAt,
    // Если основной банк успели удалить из своих, настройку сбрасываем
    primaryBankId:
      primarySource.primaryBankId !== null && bankIds.has(primarySource.primaryBankId)
        ? primarySource.primaryBankId
        : null,
    primaryBankUpdatedAt: primarySource.primaryBankUpdatedAt,
  };
}

/** По каждому ключу оставляем самое позднее надгробие. */
function mergeTombstones(a: Tombstone[], b: Tombstone[], now: number): Map<string, number> {
  const merged = new Map<string, number>();
  for (const tombstone of pruneTombstones([...a, ...b], now)) {
    const known = merged.get(tombstone.key);
    if (known === undefined || tombstone.at > known) merged.set(tombstone.key, tombstone.at);
  }
  return merged;
}

function mergeBanks(
  local: MyBank[],
  remote: MyBank[],
  isDeleted: (key: string, objectTime: number) => boolean,
): MyBank[] {
  const result: MyBank[] = [];
  const seen = new Set<string>();

  // Сначала свои банки в своём порядке, затем чужие новые
  for (const bank of [...local, ...remote]) {
    if (seen.has(bank.id)) continue;
    seen.add(bank.id);
    if (isDeleted(bankTombstoneKey(bank.id), bank.addedAt)) continue;
    result.push(bank);
  }

  return result;
}

function mergeCategories(
  local: Category[],
  remote: Category[],
  isDeleted: (key: string, objectTime: number) => boolean,
): Category[] {
  const result: Category[] = [];
  const seen = new Set<string>();

  for (const category of [...local, ...remote]) {
    if (seen.has(category.id)) continue;
    seen.add(category.id);
    if (isDeleted(categoryTombstoneKey(category.id), category.createdAt ?? 0)) continue;
    result.push(category);
  }

  return result;
}

function mergeCashbacks(
  local: Cashback[],
  remote: Cashback[],
  isDeleted: (key: string, objectTime: number) => boolean,
): Cashback[] {
  const byKey = new Map<string, Cashback>();

  for (const cashback of [...local, ...remote]) {
    const key = cashbackKey(cashback);
    const known = byKey.get(key);
    // Из двух версий одной записи берём изменённую позже
    if (known === undefined || cashback.updatedAt > known.updatedAt) byKey.set(key, cashback);
  }

  return [...byKey.values()].filter(
    (cashback) => !isDeleted(cashbackTombstoneKey(cashback), cashback.updatedAt),
  );
}

/** Короткая сводка для интерфейса: «3 банка, 12 кешбэков». */
export function describeData(data: AppData): string {
  const banks = data.myBanks.length;
  const cashbacks = data.cashbacks.length;
  return `${banks} ${plural(banks, 'банк', 'банка', 'банков')}, ${cashbacks} ${plural(
    cashbacks,
    'кешбэк',
    'кешбэка',
    'кешбэков',
  )}`;
}

function plural(n: number, one: string, few: string, many: string): string {
  const lastTwo = n % 100;
  const last = n % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}
