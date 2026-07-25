import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { BUILT_IN_CATEGORIES } from '../data/categories';
import { createId, loadData, pruneTombstones, saveData } from '../lib/storage';
import {
  bankTombstoneKey,
  cashbackTombstoneKey,
  categoryTombstoneKey,
} from '../lib/types';
import type { AppData, Cashback, Category, Period, Tombstone } from '../lib/types';

interface StoreValue {
  data: AppData;
  /** id банков пользователя в порядке показа — то, что нужно экранам */
  myBankIds: string[];
  /** Встроенные категории плюс добавленные пользователем */
  categories: Category[];
  getCategory: (id: string) => Category | undefined;
  /** Кешбэки конкретного месяца */
  cashbacksOf: (period: Period) => Cashback[];

  addBank: (bankId: string) => void;
  removeBank: (bankId: string) => void;
  moveBank: (bankId: string, direction: -1 | 1) => void;

  /** Создаёт кешбэк или обновляет процент, если такой уже есть */
  setCashback: (period: Period, bankId: string, categoryId: string, percent: number) => void;
  removeCashback: (id: string) => void;

  addCustomCategory: (name: string, emoji: string) => Category;
  removeCustomCategory: (id: string) => void;

  /** Переносит все кешбэки из одного месяца в другой */
  copyPeriod: (from: Period, to: Period) => void;
  /** Удаляет все кешбэки месяца */
  clearPeriod: (period: Period) => void;
  /** Заменяет все данные целиком — импорт файла и синхронизация */
  replaceAll: (data: AppData) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

/** Ставит надгробие, заменяя старое по тому же ключу. */
function withTombstone(deleted: Tombstone[], key: string, at: number): Tombstone[] {
  return [...deleted.filter((tombstone) => tombstone.key !== key), { key, at }];
}

/** Убирает надгробия по ключам — вызываем, когда объект создают заново. */
function withoutTombstones(deleted: Tombstone[], keys: string[]): Tombstone[] {
  const remove = new Set(keys);
  return deleted.filter((tombstone) => !remove.has(tombstone.key));
}

export function StoreProvider({ children }: { children: ReactNode }) {
  // Читаем сохранённые данные один раз при запуске.
  // Функция в useState нужна, чтобы localStorage не читался на каждой отрисовке.
  const [data, setData] = useState<AppData>(() => loadData());

  // Любое изменение данных сразу пишем на диск — отдельной кнопки «Сохранить» нет.
  useEffect(() => {
    saveData(data);
  }, [data]);

  const myBankIds = useMemo(() => data.myBanks.map((bank) => bank.id), [data.myBanks]);

  const categories = useMemo(
    () => [...BUILT_IN_CATEGORIES, ...data.customCategories],
    [data.customCategories],
  );

  // Map вместо поиска перебором: категорий может быть под сотню,
  // а искать их приходится для каждой строки на экране.
  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const getCategory = useCallback((id: string) => categoriesById.get(id), [categoriesById]);

  const cashbacksOf = useCallback(
    (period: Period) => data.cashbacks.filter((cashback) => cashback.period === period),
    [data.cashbacks],
  );

  const addBank = useCallback((bankId: string) => {
    setData((previous) => {
      if (previous.myBanks.some((bank) => bank.id === bankId)) return previous;
      return {
        ...previous,
        myBanks: [...previous.myBanks, { id: bankId, addedAt: Date.now() }],
        // Если банк когда-то удаляли, надгробие надо снять,
        // иначе синхронизация решит, что банка быть не должно
        deleted: withoutTombstones(previous.deleted, [bankTombstoneKey(bankId)]),
      };
    });
  }, []);

  const removeBank = useCallback((bankId: string) => {
    setData((previous) => {
      const now = Date.now();
      const removedCashbacks = previous.cashbacks.filter((cashback) => cashback.bankId === bankId);

      // Вместе с банком убираем и его кешбэки, иначе они останутся
      // «висеть» в данных и продолжат появляться в поиске.
      let deleted = withTombstone(previous.deleted, bankTombstoneKey(bankId), now);
      for (const cashback of removedCashbacks) {
        deleted = withTombstone(deleted, cashbackTombstoneKey(cashback), now);
      }

      return {
        ...previous,
        myBanks: previous.myBanks.filter((bank) => bank.id !== bankId),
        cashbacks: previous.cashbacks.filter((cashback) => cashback.bankId !== bankId),
        deleted: pruneTombstones(deleted, now),
      };
    });
  }, []);

  const moveBank = useCallback((bankId: string, direction: -1 | 1) => {
    setData((previous) => {
      const from = previous.myBanks.findIndex((bank) => bank.id === bankId);
      const to = from + direction;
      if (from === -1 || to < 0 || to >= previous.myBanks.length) return previous;
      const myBanks = [...previous.myBanks];
      // Меняем два элемента местами
      [myBanks[from], myBanks[to]] = [myBanks[to], myBanks[from]];
      return { ...previous, myBanks };
    });
  }, []);

  const setCashback = useCallback(
    (period: Period, bankId: string, categoryId: string, percent: number) => {
      setData((previous) => {
        const now = Date.now();
        const existing = previous.cashbacks.find(
          (cashback) =>
            cashback.period === period &&
            cashback.bankId === bankId &&
            cashback.categoryId === categoryId,
        );

        const deleted = withoutTombstones(previous.deleted, [
          cashbackTombstoneKey({ period, bankId, categoryId }),
        ]);

        if (existing) {
          return {
            ...previous,
            cashbacks: previous.cashbacks.map((cashback) =>
              cashback.id === existing.id ? { ...cashback, percent, updatedAt: now } : cashback,
            ),
            deleted,
          };
        }

        const created: Cashback = {
          id: createId(),
          period,
          bankId,
          categoryId,
          percent,
          updatedAt: now,
        };
        return { ...previous, cashbacks: [...previous.cashbacks, created], deleted };
      });
    },
    [],
  );

  const removeCashback = useCallback((id: string) => {
    setData((previous) => {
      const target = previous.cashbacks.find((cashback) => cashback.id === id);
      if (!target) return previous;
      const now = Date.now();
      return {
        ...previous,
        cashbacks: previous.cashbacks.filter((cashback) => cashback.id !== id),
        deleted: pruneTombstones(
          withTombstone(previous.deleted, cashbackTombstoneKey(target), now),
          now,
        ),
      };
    });
  }, []);

  const addCustomCategory = useCallback((name: string, emoji: string): Category => {
    const created: Category = {
      id: `custom-${createId()}`,
      name: name.trim(),
      emoji,
      custom: true,
      createdAt: Date.now(),
    };
    setData((previous) => ({
      ...previous,
      customCategories: [...previous.customCategories, created],
      deleted: withoutTombstones(previous.deleted, [categoryTombstoneKey(created.id)]),
    }));
    return created;
  }, []);

  const removeCustomCategory = useCallback((id: string) => {
    setData((previous) => {
      const now = Date.now();
      const removedCashbacks = previous.cashbacks.filter((cashback) => cashback.categoryId === id);

      let deleted = withTombstone(previous.deleted, categoryTombstoneKey(id), now);
      for (const cashback of removedCashbacks) {
        deleted = withTombstone(deleted, cashbackTombstoneKey(cashback), now);
      }

      return {
        ...previous,
        customCategories: previous.customCategories.filter((category) => category.id !== id),
        cashbacks: previous.cashbacks.filter((cashback) => cashback.categoryId !== id),
        deleted: pruneTombstones(deleted, now),
      };
    });
  }, []);

  const copyPeriod = useCallback((from: Period, to: Period) => {
    setData((previous) => {
      const now = Date.now();

      // Что уже заполнено в целевом месяце — не трогаем, чтобы не перезатереть
      const alreadyThere = new Set(
        previous.cashbacks
          .filter((cashback) => cashback.period === to)
          .map((cashback) => `${cashback.bankId}|${cashback.categoryId}`),
      );

      const copied = previous.cashbacks
        .filter(
          (cashback) =>
            cashback.period === from &&
            !alreadyThere.has(`${cashback.bankId}|${cashback.categoryId}`),
        )
        .map((cashback) => ({ ...cashback, id: createId(), period: to, updatedAt: now }));

      return {
        ...previous,
        cashbacks: [...previous.cashbacks, ...copied],
        deleted: withoutTombstones(
          previous.deleted,
          copied.map((cashback) => cashbackTombstoneKey(cashback)),
        ),
      };
    });
  }, []);

  const clearPeriod = useCallback((period: Period) => {
    setData((previous) => {
      const now = Date.now();
      const removed = previous.cashbacks.filter((cashback) => cashback.period === period);

      let deleted = previous.deleted;
      for (const cashback of removed) {
        deleted = withTombstone(deleted, cashbackTombstoneKey(cashback), now);
      }

      return {
        ...previous,
        cashbacks: previous.cashbacks.filter((cashback) => cashback.period !== period),
        deleted: pruneTombstones(deleted, now),
      };
    });
  }, []);

  const replaceAll = useCallback((next: AppData) => setData(next), []);

  const value = useMemo<StoreValue>(
    () => ({
      data,
      myBankIds,
      categories,
      getCategory,
      cashbacksOf,
      addBank,
      removeBank,
      moveBank,
      setCashback,
      removeCashback,
      addCustomCategory,
      removeCustomCategory,
      copyPeriod,
      clearPeriod,
      replaceAll,
    }),
    [
      data,
      myBankIds,
      categories,
      getCategory,
      cashbacksOf,
      addBank,
      removeBank,
      moveBank,
      setCashback,
      removeCashback,
      addCustomCategory,
      removeCustomCategory,
      copyPeriod,
      clearPeriod,
      replaceAll,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore можно вызывать только внутри <StoreProvider>');
  return store;
}
