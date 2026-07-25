import { useEffect, useState } from 'react';
import { formatPercent } from '../lib/text';
import type { Category } from '../lib/types';
import { Sheet } from './Sheet';
import { TrashIcon } from './icons';

/** Проценты, которые банки дают чаще всего — чтобы не набирать вручную. */
const QUICK_PERCENTS = [1, 2, 3, 5, 7, 10, 15, 20, 25, 30];

interface PercentSheetProps {
  open: boolean;
  onClose: () => void;
  bankName: string;
  category: Category | undefined;
  /** Если передан — редактируем существующий кешбэк, а не создаём новый */
  initialPercent?: number;
  onSubmit: (percent: number) => void;
  onDelete?: () => void;
}

export function PercentSheet({
  open,
  onClose,
  bankName,
  category,
  initialPercent,
  onSubmit,
  onDelete,
}: PercentSheetProps) {
  // Храним введённое как строку: пользователь может писать «1,5», а не «1.5»,
  // и в процессе набора значение бывает незаконченным.
  const [raw, setRaw] = useState('');

  // При каждом открытии подставляем текущее значение (или пустую строку)
  useEffect(() => {
    if (open) setRaw(initialPercent === undefined ? '' : formatPercent(initialPercent));
  }, [open, initialPercent]);

  const percent = parsePercent(raw);
  const isValid = percent !== null;

  function handleSubmit() {
    if (percent === null) return;
    onSubmit(percent);
    onClose();
  }

  return (
    <Sheet open={open} title={category ? `${category.emoji} ${category.name}` : 'Кешбэк'} onClose={onClose}>
      <p className="sheet-subtitle">{bankName}</p>

      <div className="percent-input-wrap">
        <input
          className="percent-input"
          // inputMode="decimal" открывает на телефоне числовую клавиатуру с запятой
          inputMode="decimal"
          value={raw}
          placeholder="0"
          maxLength={5}
          autoFocus
          onChange={(event) => setRaw(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleSubmit();
          }}
          aria-label="Процент кешбэка"
        />
        <span className="percent-sign">%</span>
      </div>

      <div className="quick-percents">
        {QUICK_PERCENTS.map((value) => (
          <button
            key={value}
            type="button"
            className={`chip ${percent === value ? 'is-selected' : ''}`}
            onClick={() => setRaw(String(value))}
          >
            {value}%
          </button>
        ))}
      </div>

      {raw.trim() !== '' && !isValid && (
        <p className="error-note">Введи число от 0,01 до 100.</p>
      )}

      <div className="form-actions">
        {onDelete && (
          <button
            type="button"
            className="button button--danger"
            onClick={() => {
              onDelete();
              onClose();
            }}
          >
            <TrashIcon width={18} height={18} />
            Удалить
          </button>
        )}
        <button
          type="button"
          className="button button--primary"
          onClick={handleSubmit}
          disabled={!isValid}
        >
          Сохранить
        </button>
      </div>
    </Sheet>
  );
}

/**
 * Разбирает введённый процент. Принимает и точку, и запятую.
 * Возвращает null, если это не корректный процент — тогда кнопка «Сохранить» гаснет.
 */
function parsePercent(raw: string): number | null {
  const normalized = raw.replace(',', '.').trim();
  if (normalized === '') return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0 || value > 100) return null;
  // Округляем до двух знаков: 33.333 → 33.33
  return Math.round(value * 100) / 100;
}
