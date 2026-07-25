import { useMemo, useState } from 'react';
import { currentPeriod, editablePeriods } from '../lib/period';
import { formatPercent, matchesQuery } from '../lib/text';
import type { Category, Period } from '../lib/types';
import { useStore } from '../store/store';
import { CategoryResultSheet } from './CategoryResultSheet';
import { PeriodSwitcher } from './PeriodSwitcher';
import { SearchInput } from './SearchInput';

export function HomeScreen({ onGoToBanks }: { onGoToBanks: () => void }) {
  const { data, myBankIds, categories, cashbacksOf } = useStore();

  const now = useMemo(() => new Date(), []);
  const thisPeriod = currentPeriod(now);
  const [period, setPeriod] = useState<Period>(thisPeriod);
  const [query, setQuery] = useState('');
  const [openedCategory, setOpenedCategory] = useState<Category | null>(null);

  const cashbacks = cashbacksOf(period);

  /** Лучший процент по каждой категории — его показываем прямо на плитке. */
  const bestPercentByCategory = useMemo(() => {
    const best = new Map<string, number>();
    for (const cashback of cashbacks) {
      const current = best.get(cashback.categoryId);
      if (current === undefined || cashback.percent > current) {
        best.set(cashback.categoryId, cashback.percent);
      }
    }
    return best;
  }, [cashbacks]);

  const visible = useMemo(
    () => categories.filter((category) => matchesQuery(category.name, query)),
    [categories, query],
  );

  // Категории с кешбэком идут первыми и сортируются по убыванию процента:
  // сверху то, что выгоднее всего.
  const withCashback = visible
    .filter((category) => bestPercentByCategory.has(category.id))
    .sort(
      (a, b) => (bestPercentByCategory.get(b.id) ?? 0) - (bestPercentByCategory.get(a.id) ?? 0),
    );
  const withoutCashback = visible.filter((category) => !bestPercentByCategory.has(category.id));

  // Самый ранний месяц, за который есть данные — дальше в прошлое листать нечего
  const earliestPeriod = useMemo(() => {
    if (data.cashbacks.length === 0) return thisPeriod;
    const earliest = data.cashbacks.reduce(
      (min, cashback) => (cashback.period < min ? cashback.period : min),
      data.cashbacks[0].period,
    );
    return earliest < thisPeriod ? earliest : thisPeriod;
  }, [data.cashbacks, thisPeriod]);

  const allowedPeriods = editablePeriods(now);

  if (myBankIds.length === 0) {
    return (
      <div className="screen">
        <div className="empty-state">
          <span className="empty-emoji">🔍</span>
          <h2>Здесь будет поиск по категориям</h2>
          <p>
            Сначала добавь свои банки и их кешбэки — потом одним нажатием увидишь, где сколько
            процентов.
          </p>
          <button type="button" className="button button--primary" onClick={onGoToBanks}>
            Заполнить кешбэки
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <PeriodSwitcher
        period={period}
        onChange={setPeriod}
        minPeriod={earliestPeriod}
        maxPeriod={allowedPeriods[allowedPeriods.length - 1]}
        hint={period === thisPeriod ? 'текущий месяц' : undefined}
      />

      <SearchInput value={query} onChange={setQuery} placeholder="Найти категорию" />

      {cashbacks.length === 0 && (
        <button type="button" className="banner banner--action" onClick={onGoToBanks}>
          За этот месяц кешбэки не заполнены — заполнить
        </button>
      )}

      {withCashback.length > 0 && (
        <>
          <h3 className="list-heading">С кешбэком</h3>
          <div className="category-grid">
            {withCashback.map((category) => (
              <button
                key={category.id}
                type="button"
                className="category-tile"
                onClick={() => setOpenedCategory(category)}
              >
                <span className="category-emoji">{category.emoji}</span>
                <span className="category-name">{category.name}</span>
                <span className="category-percent">
                  до {formatPercent(bestPercentByCategory.get(category.id) ?? 0)}%
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {withoutCashback.length > 0 && (
        <>
          <h3 className="list-heading">Без кешбэка в этом месяце</h3>
          <div className="category-grid">
            {withoutCashback.map((category) => (
              <button
                key={category.id}
                type="button"
                className="category-tile category-tile--muted"
                onClick={() => setOpenedCategory(category)}
              >
                <span className="category-emoji">{category.emoji}</span>
                <span className="category-name">{category.name}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {visible.length === 0 && <p className="empty-note">Такой категории нет.</p>}

      <CategoryResultSheet
        open={openedCategory !== null}
        onClose={() => setOpenedCategory(null)}
        category={openedCategory}
        cashbacks={cashbacks.filter((cashback) => cashback.categoryId === openedCategory?.id)}
        period={period}
      />
    </div>
  );
}
