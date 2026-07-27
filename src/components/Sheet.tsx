import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { CloseIcon } from './icons';

/** Ширина, с которой раскладка становится «настольной». Держать в согласии со styles.css. */
const DESKTOP_QUERY = '(min-width: 1000px)';

interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  /**
   * Где панель показывается на большом экране.
   *
   * `modal` — окно по центру: задача, которую нужно довести до конца
   * (выбрать банк, ввести процент). Всё остальное на это время не нужно.
   *
   * `side` — панель у правого края, страница под ней остаётся живой:
   * просмотр, при котором сетка категорий никуда не девается и можно
   * щёлкать плитки подряд, ничего не закрывая.
   *
   * На телефоне разницы нет — обе выезжают снизу, там места на другое нет.
   */
  placement?: 'modal' | 'side';
  children: ReactNode;
}

/**
 * Всплывающая панель. Где именно она окажется, решает CSS, а не JS —
 * здесь только выбор поведения, которое стилями не задать.
 */
export function Sheet({ open, title, onClose, placement = 'modal', children }: SheetProps) {
  // Закрытие по Escape и блокировка прокрутки страницы под панелью.
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);

    // Боковая панель страницу не перекрывает, поэтому прокрутку не трогаем:
    // иначе сетка категорий под ней замерла бы без видимой причины.
    const asideOnDesktop = placement === 'side' && window.matchMedia(DESKTOP_QUERY).matches;
    const previousOverflow = document.body.style.overflow;
    if (!asideOnDesktop) document.body.style.overflow = 'hidden';

    // Возвращаем как было в любом случае: окно могли растянуть,
    // пока панель была открыта, и тогда ветка выше уже не та
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose, placement]);

  if (!open) return null;

  return (
    <div className={`sheet-backdrop sheet-backdrop--${placement}`} onClick={onClose}>
      {/* stopPropagation — чтобы клик внутри панели не закрывал её */}
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-header">
          <h2 className="sheet-title">{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть">
            <CloseIcon />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
