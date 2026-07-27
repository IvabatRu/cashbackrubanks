import { useState } from 'react';
import { getBankOrPlaceholder } from '../data/banks';
import type { Bank } from '../data/banks';
import { canOpenBankApp, openBankApp } from '../lib/deepLink';
import { formatPeriod } from '../lib/period';
import { formatPercent } from '../lib/text';
import type { Cashback, Category, Period } from '../lib/types';
import { BankLogo } from './BankLogo';
import { Sheet } from './Sheet';
import { QrIcon } from './icons';

interface CategoryResultSheetProps {
  open: boolean;
  onClose: () => void;
  category: Category | null;
  /** Кешбэки этой категории за выбранный месяц */
  cashbacks: Cashback[];
  period: Period;
}

/**
 * Ответ на главный вопрос приложения: нажал «Аптеки» — увидел, где выгоднее.
 *
 * Подпись «Лучший кешбэк» появляется только когда есть из чего выбирать.
 * Если банк один или все дают поровну, слово «лучший» ничего не значит —
 * и мы его не пишем.
 */
export function CategoryResultSheet({
  open,
  onClose,
  category,
  cashbacks,
  period,
}: CategoryResultSheetProps) {
  const sorted = [...cashbacks].sort((a, b) => b.percent - a.percent);
  const distinctPercents = new Set(sorted.map((cashback) => cashback.percent));
  const allEqual = distinctPercents.size <= 1;

  const top = sorted[0];
  const rest = allEqual ? sorted : sorted.slice(1);
  const [openError, setOpenError] = useState('');

  async function handleOpenBank(bank: Bank) {
    setOpenError((await openBankApp(bank)) ?? '');
  }

  return (
    <Sheet
      open={open}
      title={category ? `${category.emoji} ${category.name}` : ''}
      onClose={onClose}
    >
      {top === undefined ? (
        <p className="empty-note">
          В этом месяце кешбэка по этой категории нет. Проверь, все ли банки заполнены на вкладке
          «Мои банки».
        </p>
      ) : (
        <>
          <div className="result-hero">
            <span className="result-hero-caption">
              {allEqual ? formatPeriod(period) : `Лучший кешбэк · ${formatPeriod(period)}`}
            </span>

            {/* Банк справа от процента, а не под ним: так короче путь
                взгляда от «сколько» к «где». */}
            <div className="result-hero-row">
              <span className="result-hero-value">{formatPercent(top.percent)}%</span>
              {/* Когда банков несколько и все дают поровну, ставить рядом
                  с числом один из них было бы неверно — они равнозначны. */}
              {!(allEqual && sorted.length > 1) && (
                <span className="result-hero-bank">
                  <BankLogo bank={getBankOrPlaceholder(top.bankId)} size={24} />
                  {getBankOrPlaceholder(top.bankId).name}
                </span>
              )}
            </div>

            {allEqual && sorted.length > 1 && (
              <span className="result-hero-note">Столько дают {sorted.length} банка из твоих</span>
            )}
          </div>

          {!(allEqual && sorted.length > 1) &&
            canOpenBankApp(getBankOrPlaceholder(top.bankId)) && (
              <button
                type="button"
                className="button button--primary button--full"
                onClick={() => void handleOpenBank(getBankOrPlaceholder(top.bankId))}
              >
                <QrIcon width={18} height={18} />
                Открыть {getBankOrPlaceholder(top.bankId).name}
              </button>
            )}

          {openError && <p className="error-note">{openError}</p>}

          {rest.length > 0 && (
            <ul className="result-list">
              {rest.map((cashback) => {
                const bank = getBankOrPlaceholder(cashback.bankId);
                return (
                  <li key={cashback.id}>
                    <div className="result-row">
                      <BankLogo bank={bank} size={32} />
                      <span className="result-bank-name">{bank.name}</span>
                      {!allEqual && (
                        <span className="percent-badge">{formatPercent(cashback.percent)}%</span>
                      )}
                      {canOpenBankApp(bank) && (
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => void handleOpenBank(bank)}
                          aria-label={`Открыть приложение ${bank.name}`}
                        >
                          <QrIcon width={18} height={18} />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

        </>
      )}
    </Sheet>
  );
}
