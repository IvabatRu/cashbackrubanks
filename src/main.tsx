import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StoreProvider } from './store/store';
import { SyncProvider } from './store/sync';
import './styles.css';

/**
 * Убирает service worker, оставшийся от собранной версии.
 *
 * Зачем: `npm run dev` и `npm run preview` работают на одном порту (так задумано —
 * localStorage привязан к порту, и на разных портах данные выглядели бы пропавшими).
 * Но у preview есть service worker, который кеширует всю сборку. После переключения
 * на dev он никуда не девается и продолжает отдавать старую сборку вместо свежего кода:
 * выглядит это так, будто правки не применяются.
 *
 * Обновиться сам он тоже не может — dev-сервер на /sw.js отдаёт index.html.
 * Поэтому в режиме разработки удаляем его вручную и один раз перезагружаем страницу.
 * В собранной версии эта функция не вызывается, там service worker нужен.
 */
async function dropStaleServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  // Ничего не зарегистрировано — значит и перезагружать нечего.
  // Эта проверка защищает от бесконечного цикла перезагрузок.
  if (registrations.length === 0) return;

  await Promise.all(registrations.map((registration) => registration.unregister()));

  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }

  location.reload();
}

if (import.meta.env.DEV) {
  void dropStaleServiceWorker();
}

const container = document.getElementById('root');
if (!container) throw new Error('Не найден элемент #root в index.html');

createRoot(container).render(
  <StrictMode>
    {/* SyncProvider внутри StoreProvider: синхронизация работает с данными хранилища */}
    <StoreProvider>
      <SyncProvider>
        <App />
      </SyncProvider>
    </StoreProvider>
  </StrictMode>,
);
