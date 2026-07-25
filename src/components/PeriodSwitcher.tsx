import { formatPeriod, shiftPeriod } from '../lib/period';
import type { Period } from '../lib/types';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

interface PeriodSwitcherProps {
  period: Period;
  onChange: (period: Period) => void;
  /** Раньше этого месяца листать нельзя */
  minPeriod?: Period;
  /** Позже этого месяца листать нельзя */
  maxPeriod?: Period;
  /** Подпись под названием месяца, например «сейчас» или «только просмотр» */
  hint?: string;
}

export function PeriodSwitcher({
  period,
  onChange,
  minPeriod,
  maxPeriod,
  hint,
}: PeriodSwitcherProps) {
  const previous = shiftPeriod(period, -1);
  const next = shiftPeriod(period, 1);

  // Периоды в формате "YYYY-MM" корректно сравниваются как обычные строки
  const canGoBack = !minPeriod || previous >= minPeriod;
  const canGoForward = !maxPeriod || next <= maxPeriod;

  return (
    <div className="period-switcher">
      <button
        type="button"
        className="icon-button"
        onClick={() => onChange(previous)}
        disabled={!canGoBack}
        aria-label="Предыдущий месяц"
      >
        <ChevronLeftIcon />
      </button>

      <div className="period-label">
        <span className="period-name">{formatPeriod(period)}</span>
        {hint && <span className="period-hint">{hint}</span>}
      </div>

      <button
        type="button"
        className="icon-button"
        onClick={() => onChange(next)}
        disabled={!canGoForward}
        aria-label="Следующий месяц"
      >
        <ChevronRightIcon />
      </button>
    </div>
  );
}
