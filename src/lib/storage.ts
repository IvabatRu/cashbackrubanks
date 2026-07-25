import type { AppData, Cashback, Category, MyBank, Tombstone } from './types';

const STORAGE_KEY = 'cashback-app';

/** Версия формата данных. 1 — без отметок времени, 2 — с ними и с надгробиями. */
export const SCHEMA_VERSION = 2;

/** Надгробия старше этого срока удаляем — иначе список растёт бесконечно. */
const TOMBSTONE_LIFETIME_MS = 180 * 24 * 60 * 60 * 1000;

export const EMPTY_DATA: AppData = {
  schemaVersion: SCHEMA_VERSION,
  myBanks: [],
  cashbacks: [],
  customCategories: [],
  deleted: [],
};

/**
 * Генератор id. Специально не используем crypto.randomUUID():
 * он работает только в «защищённом контексте» (https или localhost),
 * а приложение может открываться с телефона по http://192.168.x.x при отладке.
 */
export function createId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/** Читает данные из localStorage. Если их нет или они битые — отдаёт пустые. */
export function loadData(): AppData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return EMPTY_DATA;
    return normalizeData(JSON.parse(saved));
  } catch (error) {
    console.error('Не удалось прочитать сохранённые данные:', error);
    return EMPTY_DATA;
  }
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    // Сюда попадём, если у браузера закончилось место под localStorage
    console.error('Не удалось сохранить данные:', error);
  }
}

/**
 * Приводит любой объект к валидному AppData, отбрасывая мусор и поднимая
 * старую схему до текущей. Нужно и при чтении localStorage, и при импорте
 * файла, и при получении данных с сервера: нельзя доверять тому, что пришло.
 */
export function normalizeData(input: unknown): AppData {
  if (typeof input !== 'object' || input === null) return EMPTY_DATA;
  const raw = input as Record<string, unknown>;

  const myBanks = readMyBanks(raw);

  const cashbacks = Array.isArray(raw.cashbacks)
    ? raw.cashbacks.filter(isValidCashback).map((cashback) => ({
        ...cashback,
        // В схеме 1 отметок времени не было — считаем такие записи самыми старыми
        updatedAt: typeof cashback.updatedAt === 'number' ? cashback.updatedAt : 0,
      }))
    : [];

  const customCategories = Array.isArray(raw.customCategories)
    ? raw.customCategories.filter(isValidCategory).map((category) => ({
        id: category.id,
        name: category.name,
        emoji: category.emoji,
        custom: true,
        createdAt: typeof category.createdAt === 'number' ? category.createdAt : 0,
      }))
    : [];

  const deleted = Array.isArray(raw.deleted) ? raw.deleted.filter(isValidTombstone) : [];

  return {
    schemaVersion: SCHEMA_VERSION,
    myBanks,
    cashbacks,
    customCategories,
    deleted: pruneTombstones(deleted),
  };
}

/**
 * Читает список банков. В схеме 1 это был массив строк myBankIds,
 * в схеме 2 — массив объектов с временем добавления.
 */
function readMyBanks(raw: Record<string, unknown>): MyBank[] {
  if (Array.isArray(raw.myBanks)) {
    return raw.myBanks
      .filter(
        (value): value is MyBank =>
          typeof value === 'object' &&
          value !== null &&
          typeof (value as MyBank).id === 'string',
      )
      .map((bank) => ({ id: bank.id, addedAt: typeof bank.addedAt === 'number' ? bank.addedAt : 0 }));
  }

  if (Array.isArray(raw.myBankIds)) {
    return raw.myBankIds
      .filter((id): id is string => typeof id === 'string')
      .map((id) => ({ id, addedAt: 0 }));
  }

  return [];
}

/** Выбрасывает надгробия, которым больше полугода. */
export function pruneTombstones(tombstones: Tombstone[], now: number = Date.now()): Tombstone[] {
  return tombstones.filter((tombstone) => now - tombstone.at < TOMBSTONE_LIFETIME_MS);
}

function isValidCashback(value: unknown): value is Cashback {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.id === 'string' &&
    typeof c.bankId === 'string' &&
    typeof c.categoryId === 'string' &&
    // Период должен быть строго "YYYY-MM"
    typeof c.period === 'string' &&
    /^\d{4}-\d{2}$/.test(c.period) &&
    typeof c.percent === 'number' &&
    Number.isFinite(c.percent)
  );
}

function isValidCategory(value: unknown): value is Category {
  if (typeof value !== 'object' || value === null) return false;
  const c = value as Record<string, unknown>;
  return typeof c.id === 'string' && typeof c.name === 'string' && typeof c.emoji === 'string';
}

function isValidTombstone(value: unknown): value is Tombstone {
  if (typeof value !== 'object' || value === null) return false;
  const t = value as Record<string, unknown>;
  return typeof t.key === 'string' && typeof t.at === 'number' && Number.isFinite(t.at);
}

/** Скачивает все данные одним JSON-файлом — резервная копия и перенос на другое устройство. */
export function downloadBackup(data: AppData): void {
  const fileName = `cashback-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Освобождаем память — без этого объект висит до перезагрузки страницы
  URL.revokeObjectURL(url);
}
