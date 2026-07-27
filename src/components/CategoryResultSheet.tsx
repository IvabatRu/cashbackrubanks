import { useEffect, useState } from 'react';
import { getBankOrPlaceholder } from '../data/banks';
import type { Bank } from '../data/banks';
import { canLaunchApps, canOpenBankApp, openBankApp, openMirPay } from '../lib/deepLink';
import { formatPeriod } from '../lib/period';
import { formatPercent } from '../lib/text';
import { compareCashbacks } from '../lib/types';
import type { Cashback, Category, Period } from '../lib/types';
import { useStore } from '../store/store';
import { BankLogo } from './BankLogo';
import { Sheet } from './Sheet';
import { ContactlessIcon, ExternalIcon } from './icons';

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
  const { data } = useStore();
  // Порядок тот же, что на плитках: больший процент выше, при равенстве
  // впереди основной банк
  const sorted = [...cashbacks].sort((a, b) => compareCashbacks(a, b, data.primaryBankId));
  const distinctPercents = new Set(sorted.map((cashback) => cashback.percent));
  const allEqual = distinctPercents.size <= 1;

  const top = sorted[0];
  const rest = allEqual ? sorted : sorted.slice(1);
  const [openError, setOpenError] = useState('');

  // Сообщение об ошибке живёт до следующего открытия панели. Без этого
  // оно оставалось висеть, когда переходишь к другой категории:
  // компонент не размонтируется, у него лишь меняются свойства.
  useEffect(() => {
    setOpenError('');
  }, [open, category]);

  async function handleOpenBank(bank: Bank) {
    setOpenError((await openBankApp(bank)) ?? '');
  }

  async function handleOpenMirPay() {
    setOpenError((await openMirPay()) ?? '');
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

          {canLaunchApps() && (
            <div className="button-row">
              {!(allEqual && sorted.length > 1) &&
                canOpenBankApp(getBankOrPlaceholder(top.bankId)) && (
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={() => void handleOpenBank(getBankOrPlaceholder(top.bankId))}
                  >
                    <ExternalIcon width={18} height={18} />
                    Открыть {getBankOrPlaceholder(top.bankId).name}
                  </button>
                )}
              <button
                type="button"
                className="button button--ghost"
                onClick={() => void handleOpenMirPay()}
              >
                <ContactlessIcon width={18} height={18} />
                Mir Pay
              </button>
            </div>
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
                          <ExternalIcon width={18} height={18} />
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
