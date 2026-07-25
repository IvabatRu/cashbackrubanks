import { useMemo, useState } from 'react';
import { getBankOrPlaceholder } from '../data/banks';
import {
  currentPeriod,
  daysUntilNextPeriodOpens,
  editablePeriods,
  formatMonth,
  isNextPeriodOpen,
  nextPeriodOpensOnText,
  pluralDays,
  shiftPeriod,
} from '../lib/period';
import { formatPercent } from '../lib/text';
import type { Period } from '../lib/types';
import { useStore } from '../store/store';
import { BankLogo } from './BankLogo';
import { BankPickerSheet } from './BankPickerSheet';
import { CategoryPickerSheet } from './CategoryPickerSheet';
import { PercentSheet } from './PercentSheet';
import { PeriodSwitcher } from './PeriodSwitcher';
import { ArrowDownIcon, ArrowUpIcon, CopyIcon, PlusIcon, TrashIcon } from './icons';

/** Что именно сейчас редактируем в панели ввода процента. */
interface PercentTarget {
  bankId: string;
  categoryId: string;
  /** id существующего кешбэка — если правим уже введённый процент */
  cashbackId?: string;
  percent?: number;
}

export function BanksScreen() {
  const store = useStore();
  const { myBankIds, cashbacksOf, getCategory } = store;

  // Дату берём один раз за отрисовку экрана, чтобы все проверки были согласованы
  const now = useMemo(() => new Date(), []);
  const allowedPeriods = useMemo(() => editablePeriods(now), [now]);
  const [period, setPeriod] = useState<Period>(() => currentPeriod(now));

  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  const [categoryPickerBankId, setCategoryPickerBankId] = useState<string | null>(null);
  const [percentTarget, setPercentTarget] = useState<PercentTarget | null>(null);

  const cashbacks = cashbacksOf(period);
  const previousPeriod = shiftPeriod(period, -1);
  const previousCount = cashbacksOf(previousPeriod).length;
  const canCopyFromPrevious = cashbacks.length === 0 && previousCount > 0;

  const nextMonthName = formatMonth(shiftPeriod(currentPeriod(now), 1));
  const daysLeft = daysUntilNextPeriodOpens(now);

  function handleAddCategory(categoryId: string) {
    if (!categoryPickerBankId) return;
    // Категорию выбрали — сразу спрашиваем процент
    setPercentTarget({ bankId: categoryPickerBankId, categoryId });
    setCategoryPickerBankId(null);
  }

  function handleRemoveBank(bankId: string, bankName: string) {
    const confirmed = window.confirm(
      `Убрать ${bankName}? Все кешбэки этого банка за все месяцы будут удалены.`,
    );
    if (confirmed) store.removeBank(bankId);
  }

  const percentTargetBankName = percentTarget
    ? getBankOrPlaceholder(percentTarget.bankId).name
    : '';
  const categoryPickerBankName = categoryPickerBankId
    ? getBankOrPlaceholder(categoryPickerBankId).name
    : '';

  return (
    <div className="screen">
      <PeriodSwitcher
        period={period}
        onChange={setPeriod}
        minPeriod={allowedPeriods[0]}
        maxPeriod={allowedPeriods[allowedPeriods.length - 1]}
        hint={period === currentPeriod(now) ? 'текущий месяц' : 'заполняем заранее'}
      />

      {/* Подсказка про правило 27-го числа */}
      {isNextPeriodOpen(now) ? (
        period === currentPeriod(now) && (
          <button
            type="button"
            className="banner banner--action"
            onClick={() => setPeriod(shiftPeriod(currentPeriod(now), 1))}
          >
            <strong>{nextMonthName}</strong> уже открыт для заполнения — перейти
          </button>
        )
      ) : (
        <p className="banner">
          <strong>{nextMonthName}</strong> откроется {nextPeriodOpensOnText(now)} — через {daysLeft}{' '}
          {pluralDays(daysLeft)}
        </p>
      )}

      {canCopyFromPrevious && (
        <button
          type="button"
          className="banner banner--action"
          onClick={() => store.copyPeriod(previousPeriod, period)}
        >
          <CopyIcon width={18} height={18} />
          Скопировать {previousCount} кешбэк(ов) из {formatMonth(previousPeriod)}
        </button>
      )}

      {myBankIds.length === 0 ? (
        <div className="empty-state">
          <span className="empty-emoji">💳</span>
          <h2>Пока нет ни одного банка</h2>
          <p>Добавь банки, карты которых у тебя есть, — потом заполнишь их кешбэки.</p>
          <button
            type="button"
            className="button button--primary"
            onClick={() => setBankPickerOpen(true)}
          >
            <PlusIcon width={18} height={18} />
            Добавить банк
          </button>
        </div>
      ) : (
        <>
          {myBankIds.map((bankId, index) => {
            const bank = getBankOrPlaceholder(bankId);
            const bankCashbacks = cashbacks
              .filter((cashback) => cashback.bankId === bankId)
              .sort((a, b) => b.percent - a.percent);

            return (
              <section className="card" key={bankId}>
                <header className="card-header">
                  <BankLogo bank={bank} size={40} />
                  <h2 className="card-title">{bank.name}</h2>
                  <div className="card-actions">
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => store.moveBank(bankId, -1)}
                      disabled={index === 0}
                      aria-label="Выше"
                    >
                      <ArrowUpIcon width={18} height={18} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => store.moveBank(bankId, 1)}
                      disabled={index === myBankIds.length - 1}
                      aria-label="Ниже"
                    >
                      <ArrowDownIcon width={18} height={18} />
                    </button>
                    <button
                      type="button"
                      className="icon-button icon-button--danger"
                      onClick={() => handleRemoveBank(bankId, bank.name)}
                      aria-label={`Убрать ${bank.name}`}
                    >
                      <TrashIcon width={18} height={18} />
                    </button>
                  </div>
                </header>

                {bankCashbacks.length === 0 ? (
                  <p className="card-empty">Кешбэки на {formatMonth(period)} не заполнены</p>
                ) : (
                  <ul className="cashback-list">
                    {bankCashbacks.map((cashback) => {
                      const category = getCategory(cashback.categoryId);
                      return (
                        <li key={cashback.id}>
                          <button
                            type="button"
                            className="cashback-row"
                            onClick={() =>
                              setPercentTarget({
                                bankId,
                                categoryId: cashback.categoryId,
                                cashbackId: cashback.id,
                                percent: cashback.percent,
                              })
                            }
                          >
                            <span className="row-emoji">{category?.emoji ?? '❓'}</span>
                            <span className="row-title">
                              {category?.name ?? 'Удалённая категория'}
                            </span>
                            <span className="percent-badge">{formatPercent(cashback.percent)}%</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <button
                  type="button"
                  className="button button--ghost button--full"
                  onClick={() => setCategoryPickerBankId(bankId)}
                >
                  <PlusIcon width={18} height={18} />
                  Добавить категорию
                </button>
              </section>
            );
          })}

          <button
            type="button"
            className="button button--primary button--full"
            onClick={() => setBankPickerOpen(true)}
          >
            <PlusIcon width={18} height={18} />
            Добавить банк
          </button>
        </>
      )}

      <BankPickerSheet
        open={bankPickerOpen}
        onClose={() => setBankPickerOpen(false)}
        selectedIds={myBankIds}
        onPick={store.addBank}
      />

      <CategoryPickerSheet
        open={categoryPickerBankId !== null}
        onClose={() => setCategoryPickerBankId(null)}
        bankName={categoryPickerBankName}
        usedCategoryIds={cashbacks
          .filter((cashback) => cashback.bankId === categoryPickerBankId)
          .map((cashback) => cashback.categoryId)}
        onPick={handleAddCategory}
      />

      <PercentSheet
        open={percentTarget !== null}
        onClose={() => setPercentTarget(null)}
        bankName={percentTargetBankName}
        category={percentTarget ? getCategory(percentTarget.categoryId) : undefined}
        initialPercent={percentTarget?.percent}
        onSubmit={(percent) => {
          if (!percentTarget) return;
          store.setCashback(period, percentTarget.bankId, percentTarget.categoryId, percent);
        }}
        onDelete={
          percentTarget?.cashbackId
            ? () => store.removeCashback(percentTarget.cashbackId as string)
            : undefined
        }
      />
    </div>
  );
}
