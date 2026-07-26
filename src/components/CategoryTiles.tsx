import { useEffect, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { formatPercent } from '../lib/text';
import type { Category } from '../lib/types';

interface CategoryTilesProps {
  /** Категории в том порядке, в котором их надо показать */
  categories: Category[];
  /** Лучший процент по каждой категории */
  bestPercentById: Map<string, number>;
  /** Включён ли режим перестановки */
  reordering: boolean;
  onOpen: (category: Category) => void;
  /** Вызывается, когда перетаскивание закончено */
  onReorder: (categoryIds: string[]) => void;
}

/**
 * Сетка плиток. В режиме перестановки плитки таскаются пальцем или мышью.
 *
 * Сделано на Pointer Events, а не на встроенном в HTML drag-and-drop:
 * тот на тач-экранах не работает вообще, а нам нужно именно на телефоне.
 * Плитки меняются местами прямо во время перетаскивания, поэтому видно,
 * куда встанет плитка, ещё до того как отпустишь.
 */
export function CategoryTiles({
  categories,
  bestPercentById,
  reordering,
  onOpen,
  onReorder,
}: CategoryTilesProps) {
  // Черновик порядка: во время перетаскивания меняем его, а в хранилище
  // пишем один раз в конце — иначе на каждое движение пальца шёл бы
  // пересчёт всего приложения и отправка на сервер.
  const [draft, setDraft] = useState(categories);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Пока тащим, внешние изменения не подхватываем: иначе плитка
  // выпрыгнет из-под пальца.
  useEffect(() => {
    if (draggingId === null) setDraft(categories);
  }, [categories, draggingId]);

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>, id: string) {
    if (!reordering) return;
    // Захватываем указатель: события продолжат приходить этой плитке,
    // даже когда палец уедет за её пределы.
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingId(id);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (draggingId === null) return;

    // Какая плитка сейчас под пальцем. Захват указателя меняет адресата
    // событий, но не мешает узнать, что лежит в этой точке экрана.
    const under = document.elementFromPoint(event.clientX, event.clientY);
    const overId = under?.closest<HTMLElement>('[data-category-id]')?.dataset.categoryId;
    if (!overId || overId === draggingId) return;

    setDraft((previous) => moveItem(previous, draggingId, overId));
  }

  function handlePointerUp() {
    if (draggingId === null) return;
    setDraggingId(null);
    onReorder(draft.map((category) => category.id));
  }

  return (
    <div className="category-grid">
      {draft.map((category) => {
        const percent = bestPercentById.get(category.id);
        return (
          <button
            key={category.id}
            type="button"
            data-category-id={category.id}
            className={[
              'category-tile',
              reordering ? 'category-tile--reordering' : '',
              draggingId === category.id ? 'is-dragging' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            // Полное название — в подсказке: на плитке оно обрезается двумя строками
            title={category.name}
            onClick={() => {
              if (!reordering) onOpen(category);
            }}
            onPointerDown={(event) => handlePointerDown(event, category.id)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <span className="category-emoji">{category.emoji}</span>
            <span className="category-percent">
              {percent === undefined ? '—' : `${formatPercent(percent)}%`}
            </span>
            <span className="category-name">{category.name}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Переставляет элемент так, чтобы он оказался на месте другого. */
function moveItem<T extends { id: string }>(list: T[], fromId: string, toId: string): T[] {
  const from = list.findIndex((item) => item.id === fromId);
  const to = list.findIndex((item) => item.id === toId);
  if (from === -1 || to === -1) return list;

  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
