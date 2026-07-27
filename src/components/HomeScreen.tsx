import { useMemo, useState } from 'react';
import { currentPeriod, editablePeriods } from '../lib/period';
import { matchesQuery } from '../lib/text';
import { compareCashbacks } from '../lib/types';
import type { Cashback, Category, Period } from '../lib/types';
import { useStore } from '../store/store';
import { CategoryResultSheet } from './CategoryResultSheet';
import { CategoryTiles } from './CategoryTiles';
import { PeriodSwitcher } from './PeriodSwitcher';
import { SearchInput } from './SearchInput';
import { SearchIcon } from './icons';

export function HomeScreen({ onGoToBanks }: { onGoToBanks: () => void }) {
  const { data, myBankIds, categories, cashbacksOf, setCategoryOrder, resetCategoryOrder } =
    useStore();

  const now = useMemo(() => new Date(), []);
  const thisPeriod = currentPeriod(now);
  const [period, setPeriod] = useState<Period>(thisPeriod);
  const [query, setQuery] = useState('');
  const [openedCategory, setOpenedCategory] = useState<Category | null>(null);
  const [reordering, setReordering] = useState(false);

  const cashbacks = cashbacksOf(period);

  /**
   * Лучший кешбэк по каждой категории — плитка берёт из него и процент,
   * и логотип банка. При равных процентах побеждает основной банк:
   * иначе выбор был бы случайным и менялся бы от месяца к месяцу.
   */
  const bestByCategory = useMemo(() => {
    const best = new Map<string, Cashback>();
    for (const cashback of cashbacks) {
      const current = best.get(cashback.categoryId);
      if (current === undefined || compareCashbacks(cashback, current, data.primaryBankId) < 0) {
        best.set(cashback.categoryId, cashback);
      }
    }
    return best;
  }, [cashbacks, data.primaryBankId]);

  const visible = useMemo(
    () => categories.filter((category) => matchesQuery(category.name, query)),
    [categories, query],
  );

  const withCashback = useMemo(
    () =>
      sortForDisplay(
        visible.filter((category) => bestByCategory.has(category.id)),
        bestByCategory,
        data.categoryOrder,
      ),
    [visible, bestByCategory, data.categoryOrder],
  );

  const withoutCashback = visible.filter((category) => !bestByCategory.has(category.id));

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
  const hasCustomOrder = data.categoryOrder.length > 0;

  if (myBankIds.length === 0) {
    return (
      <div className="screen">
        <div className="empty-state">
          <span className="empty-mark">
            <SearchIcon width={26} height={26} />
          </span>
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

  // В режиме перестановки убираем всё лишнее: поиск изменил бы состав
  // плиток прямо во время перетаскивания и перепутал бы порядок.
  if (reordering) {
    return (
      <div className="screen">
        <p className="banner">Перетащи плитки, чтобы задать свой порядок</p>

        <CategoryTiles
          categories={withCashback}
          bestByCategory={bestByCategory}
          reordering
          onOpen={() => {}}
          onReorder={setCategoryOrder}
        />

        <div className="button-row">
          {hasCustomOrder && (
            <button
              type="button"
              className="button button--ghost"
              onClick={() => {
                resetCategoryOrder();
                setReordering(false);
              }}
            >
              Вернуть по проценту
            </button>
          )}
          <button
            type="button"
            className="button button--primary"
            onClick={() => setReordering(false)}
          >
            Готово
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      {/* На телефоне это две строки подряд, на ПК — одна: месяц слева,
          поиск справа. Иначе верх монитора занимали бы два почти пустых
          ряда. */}
      <div className="screen-toolbar">
        <PeriodSwitcher
          period={period}
          onChange={setPeriod}
          minPeriod={earliestPeriod}
          maxPeriod={allowedPeriods[allowedPeriods.length - 1]}
          hint={period === thisPeriod ? 'текущий месяц' : undefined}
        />

        <SearchInput value={query} onChange={setQuery} placeholder="Найти категорию" />
      </div>

      {cashbacks.length === 0 && (
        <button type="button" className="banner banner--action" onClick={onGoToBanks}>
          За этот месяц кешбэки не заполнены — заполнить
        </button>
      )}

      {withCashback.length > 0 && (
        <>
          {/* Заголовка у раздела нет: плитки говорят сами за себя.
              Переставлять во время поиска нельзя — на экране лишь часть
              плиток, и сохранился бы порядок этой части. */}
          {query.trim() === '' && withCashback.length > 1 && (
            <div className="section-header section-header--end">
              <button type="button" className="link-button" onClick={() => setReordering(true)}>
                Изменить порядок
              </button>
            </div>
          )}

          <CategoryTiles
            categories={withCashback}
            bestByCategory={bestByCategory}
            reordering={false}
            onOpen={setOpenedCategory}
            onReorder={setCategoryOrder}
          />
        </>
      )}

      {/* Категории без кешбэка — компактными чипами, а не плитками:
          их три десятка, и плитками они забивали весь экран. */}
      {withoutCashback.length > 0 && (
        <>
          <h3 className="list-heading">Без кешбэка в этом месяце</h3>
          <div className="category-chips">
            {withoutCashback.map((category) => (
              <button
                key={category.id}
                type="button"
                className="category-chip"
                onClick={() => setOpenedCategory(category)}
              >
                <span className="category-chip-emoji">{category.emoji}</span>
                {category.name}
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

/**
 * Порядок плиток: сначала заданный вручную, затем всё остальное
 * по убыванию процента.
 *
 * Категории, которых не было на экране в момент перестановки (например,
 * кешбэк по ним появился только в этом месяце), встают после
 * расставленных вручную — так новая категория не потеряется в середине.
 */
function sortForDisplay(
  categories: Category[],
  bestByCategory: Map<string, Cashback>,
  order: string[],
): Category[] {
  const byPercent = (a: Category, b: Category) =>
    (bestByCategory.get(b.id)?.percent ?? 0) - (bestByCategory.get(a.id)?.percent ?? 0);

  if (order.length === 0) return [...categories].sort(byPercent);

  const position = new Map(order.map((id, index) => [id, index]));

  return [...categories].sort((a, b) => {
    const positionA = position.get(a.id);
    const positionB = position.get(b.id);
    if (positionA !== undefined && positionB !== undefined) return positionA - positionB;
    if (positionA !== undefined) return -1;
    if (positionB !== undefined) return 1;
    return byPercent(a, b);
  });
}
