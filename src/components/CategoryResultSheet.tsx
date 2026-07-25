import { getBankOrPlaceholder } from '../data/banks';
import { formatPeriod } from '../lib/period';
import { formatPercent } from '../lib/text';
import type { Cashback, Category, Period } from '../lib/types';
import { BankLogo } from './BankLogo';
import { Sheet } from './Sheet';
import { TrophyIcon } from './icons';

interface CategoryResultSheetProps {
  open: boolean;
  onClose: () => void;
  category: Category | null;
  /** Кешбэки этой категории за выбранный месяц */
  cashbacks: Cashback[];
  period: Period;
}

/**
 * Ответ на главный вопрос приложения: нажал «Аптека» — увидел,
 * в каком банке какой процент. Банки отсортированы по убыванию процента,
 * лучший помечен кубком.
 */
export function CategoryResultSheet({
  open,
  onClose,
  category,
  cashbacks,
  period,
}: CategoryResultSheetProps) {
  const sorted = [...cashbacks].sort((a, b) => b.percent - a.percent);
  const bestPercent = sorted.length > 0 ? sorted[0].percent : 0;

  return (
    <Sheet
      open={open}
      title={category ? `${category.emoji} ${category.name}` : ''}
      onClose={onClose}
    >
      <p className="sheet-subtitle">{formatPeriod(period)}</p>

      {sorted.length === 0 ? (
        <p className="empty-note">
          В этом месяце кешбэка по этой категории нет. Проверь, все ли банки заполнены на вкладке
          «Мои банки».
        </p>
      ) : (
        <ul className="result-list">
          {sorted.map((cashback) => {
            const bank = getBankOrPlaceholder(cashback.bankId);
            // Кубок получают все банки с максимальным процентом — их может быть несколько
            const isBest = cashback.percent === bestPercent;
            return (
              <li key={cashback.id} className={`result-row ${isBest ? 'is-best' : ''}`}>
                <BankLogo bank={bank} size={44} />
                <div className="result-bank">
                  <span className="result-bank-name">{bank.name}</span>
                  {isBest && (
                    <span className="result-best-label">
                      <TrophyIcon width={14} height={14} />
                      лучший
                    </span>
                  )}
                </div>
                <span className={`percent-badge ${isBest ? 'percent-badge--best' : ''}`}>
                  {formatPercent(cashback.percent)}%
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
