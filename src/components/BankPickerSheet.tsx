import { useMemo, useState } from 'react';
import { ALL_BANKS, POPULAR_BANKS } from '../data/banks';
import type { Bank } from '../data/banks';
import { matchesQuery } from '../lib/text';
import { BankLogo } from './BankLogo';
import { SearchInput } from './SearchInput';
import { Sheet } from './Sheet';
import { CheckIcon } from './icons';

interface BankPickerSheetProps {
  open: boolean;
  onClose: () => void;
  /** Банки, которые уже добавлены — их помечаем галочкой */
  selectedIds: string[];
  onPick: (bankId: string) => void;
}

/**
 * Выбор банка. Пока поле поиска пустое, сверху идут популярные банки,
 * а под ними — весь реестр СБП. Как только пользователь начал печатать,
 * показываем один плоский список результатов.
 */
export function BankPickerSheet({ open, onClose, selectedIds, onPick }: BankPickerSheetProps) {
  const [query, setQuery] = useState('');

  const found = useMemo(() => {
    if (!query.trim()) return null;
    return ALL_BANKS.filter((bank) => matchesQuery(bank.name, query));
  }, [query]);

  function handlePick(bank: Bank) {
    onPick(bank.id);
    setQuery('');
    onClose();
  }

  return (
    <Sheet open={open} title="Добавить банк" onClose={onClose}>
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Найти банк среди 196"
        autoFocus
      />

      {found ? (
        found.length > 0 ? (
          <BankList banks={found} selectedIds={selectedIds} onPick={handlePick} />
        ) : (
          <p className="empty-note">Ничего не нашлось. Попробуй другое написание.</p>
        )
      ) : (
        <>
          <h3 className="list-heading">Популярные</h3>
          <BankList banks={POPULAR_BANKS} selectedIds={selectedIds} onPick={handlePick} />
          <h3 className="list-heading">Все банки СБП</h3>
          <BankList banks={ALL_BANKS} selectedIds={selectedIds} onPick={handlePick} />
        </>
      )}
    </Sheet>
  );
}

function BankList({
  banks,
  selectedIds,
  onPick,
}: {
  banks: Bank[];
  selectedIds: string[];
  onPick: (bank: Bank) => void;
}) {
  return (
    <ul className="row-list">
      {banks.map((bank) => {
        const added = selectedIds.includes(bank.id);
        return (
          <li key={bank.id}>
            <button
              type="button"
              className="row"
              onClick={() => onPick(bank)}
              disabled={added}
            >
              <BankLogo bank={bank} size={36} />
              <span className="row-title">{bank.name}</span>
              {added && (
                <span className="row-added">
                  <CheckIcon width={16} height={16} /> добавлен
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
