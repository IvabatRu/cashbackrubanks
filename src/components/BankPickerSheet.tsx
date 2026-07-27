import { useMemo, useState } from 'react';
import { ALL_BANKS, POPULAR_BANKS, getBankOrPlaceholder } from '../data/banks';
import type { Bank } from '../data/banks';
import { matchesQuery } from '../lib/text';
import { BankLogo } from './BankLogo';
import { SearchInput } from './SearchInput';
import { Sheet } from './Sheet';
import { CheckIcon } from './icons';

interface BankPickerSheetProps {
  open: boolean;
  onClose: () => void;
  /** Заголовок панели. По умолчанию — добавление банка */
  title?: string;
  /**
   * Если задано, выбирать можно только среди этих банков — например,
   * основным банком может быть лишь тот, что уже есть у пользователя.
   * Тогда список показывается плоским, без деления на популярные и все.
   */
  bankIds?: string[];
  /** Банки, которые уже выбраны — их помечаем и не даём нажать */
  selectedIds: string[];
  /** Подпись у выбранного банка */
  selectedLabel?: string;
  onPick: (bankId: string) => void;
}

/**
 * Выбор банка. Пока поле поиска пустое, сверху идут популярные банки,
 * а под ними — весь реестр СБП. Как только пользователь начал печатать,
 * показываем один плоский список результатов.
 */
export function BankPickerSheet({
  open,
  onClose,
  title = 'Добавить банк',
  bankIds,
  selectedIds,
  selectedLabel = 'добавлен',
  onPick,
}: BankPickerSheetProps) {
  const [query, setQuery] = useState('');

  // Ограниченный список сохраняет порядок, заданный пользователем
  // на вкладке «Мои банки», — там он расставлял их сам
  const source = useMemo(
    () => (bankIds ? bankIds.map(getBankOrPlaceholder) : ALL_BANKS),
    [bankIds],
  );

  const found = useMemo(() => {
    if (!query.trim()) return null;
    return source.filter((bank) => matchesQuery(bank.name, query));
  }, [query, source]);

  function handlePick(bank: Bank) {
    onPick(bank.id);
    setQuery('');
    onClose();
  }

  const list = found ?? source;

  return (
    <Sheet open={open} title={title} onClose={onClose}>
      {/* Поиск не нужен, когда выбирать не из чего */}
      {source.length > 7 && (
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder={bankIds ? 'Найти банк' : 'Найти банк среди 196'}
          autoFocus
        />
      )}

      {found && found.length === 0 ? (
        <p className="empty-note">Ничего не нашлось. Попробуй другое написание.</p>
      ) : bankIds || found ? (
        <BankList
          banks={list}
          selectedIds={selectedIds}
          selectedLabel={selectedLabel}
          onPick={handlePick}
        />
      ) : (
        <>
          <h3 className="list-heading">Популярные</h3>
          <BankList
            banks={POPULAR_BANKS}
            selectedIds={selectedIds}
            selectedLabel={selectedLabel}
            onPick={handlePick}
          />
          <h3 className="list-heading">Все банки СБП</h3>
          <BankList
            banks={ALL_BANKS}
            selectedIds={selectedIds}
            selectedLabel={selectedLabel}
            onPick={handlePick}
          />
        </>
      )}
    </Sheet>
  );
}

function BankList({
  banks,
  selectedIds,
  selectedLabel,
  onPick,
}: {
  banks: Bank[];
  selectedIds: string[];
  selectedLabel: string;
  onPick: (bank: Bank) => void;
}) {
  return (
    <ul className="row-list">
      {banks.map((bank) => {
        const selected = selectedIds.includes(bank.id);
        return (
          <li key={bank.id}>
            <button type="button" className="row" onClick={() => onPick(bank)} disabled={selected}>
              <BankLogo bank={bank} size={36} />
              <span className="row-title">{bank.name}</span>
              {selected && (
                <span className="row-added">
                  <CheckIcon width={16} height={16} /> {selectedLabel}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
