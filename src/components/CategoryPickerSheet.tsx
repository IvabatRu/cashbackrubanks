import { useMemo, useState } from 'react';
import { EMOJI_CHOICES } from '../data/categories';
import { matchesQuery } from '../lib/text';
import type { Category } from '../lib/types';
import { useStore } from '../store/store';
import { SearchInput } from './SearchInput';
import { Sheet } from './Sheet';
import { PlusIcon } from './icons';

interface CategoryPickerSheetProps {
  open: boolean;
  onClose: () => void;
  /** Название банка — чтобы в заголовке было видно, куда добавляем */
  bankName: string;
  /** Категории, уже заполненные у этого банка в этом месяце: их не показываем */
  usedCategoryIds: string[];
  onPick: (categoryId: string) => void;
}

export function CategoryPickerSheet({
  open,
  onClose,
  bankName,
  usedCategoryIds,
  onPick,
}: CategoryPickerSheetProps) {
  const { categories, addCustomCategory } = useStore();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState(EMOJI_CHOICES[0]);

  const available = useMemo(
    () =>
      categories
        .filter((category) => !usedCategoryIds.includes(category.id))
        .filter((category) => matchesQuery(category.name, query)),
    [categories, usedCategoryIds, query],
  );

  function reset() {
    setQuery('');
    setCreating(false);
    setNewName('');
    setNewEmoji(EMOJI_CHOICES[0]);
  }

  function handlePick(category: Category) {
    onPick(category.id);
    reset();
  }

  function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    const created = addCustomCategory(name, newEmoji);
    onPick(created.id);
    reset();
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Sheet open={open} title={`Категория · ${bankName}`} onClose={handleClose}>
      {creating ? (
        <div className="form">
          <label className="field">
            <span className="field-label">Название категории</span>
            <input
              className="text-input"
              value={newName}
              placeholder="Например, Строительные магазины"
              maxLength={40}
              autoFocus
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleCreate();
              }}
            />
          </label>

          <span className="field-label">Значок</span>
          <div className="emoji-grid">
            {EMOJI_CHOICES.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={`emoji-option ${emoji === newEmoji ? 'is-selected' : ''}`}
                onClick={() => setNewEmoji(emoji)}
                aria-label={`Значок ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>

          <div className="form-actions">
            <button type="button" className="button button--ghost" onClick={() => setCreating(false)}>
              Назад
            </button>
            <button
              type="button"
              className="button button--primary"
              onClick={handleCreate}
              disabled={!newName.trim()}
            >
              Создать
            </button>
          </div>
        </div>
      ) : (
        <>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Найти категорию"
            autoFocus
          />

          <button type="button" className="row row--action" onClick={() => setCreating(true)}>
            <span className="row-emoji">
              <PlusIcon />
            </span>
            <span className="row-title">Своя категория</span>
          </button>

          {available.length > 0 ? (
            <ul className="row-list">
              {available.map((category) => (
                <li key={category.id}>
                  <button type="button" className="row" onClick={() => handlePick(category)}>
                    <span className="row-emoji">{category.emoji}</span>
                    <span className="row-title">{category.name}</span>
                    {category.custom && <span className="row-badge">своя</span>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-note">
              {query
                ? 'Такой категории нет — создай свою.'
                : 'Все категории у этого банка уже заполнены.'}
            </p>
          )}
        </>
      )}
    </Sheet>
  );
}
