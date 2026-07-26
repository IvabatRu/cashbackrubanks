import { useCallback, useEffect, useState } from 'react';

/**
 * Установка приложения на устройство.
 *
 * Обычно кнопка установки живёт в интерфейсе браузера — в адресной строке
 * или в меню, — и найти её там непросто. Браузеры на движке Chromium
 * позволяют перехватить этот момент и показать свою кнопку прямо
 * в приложении: событие beforeinstallprompt даёт объект, у которого
 * можно вызвать prompt() в ответ на нажатие.
 *
 * Работает в Chrome, Edge и Samsung Internet. В Firefox и в Safari такого
 * события нет: там установка возможна только вручную через меню браузера
 * («Поделиться» → «На экран Домой» на iPhone).
 */

/** Событие браузера, которого нет в стандартных типах. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Приложение уже открыто как установленное, а не во вкладке браузера. */
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const asApp = window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  // Safari на iPhone до сих пор сообщает об этом своим нестандартным полем
  const iosApp = (window.navigator as { standalone?: boolean }).standalone === true;
  return asApp || iosApp;
}

export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    function handleBeforeInstall(event: Event) {
      // Без этого браузер покажет собственную плашку, и наша кнопка
      // окажется второй такой же
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    }

    function handleInstalled() {
      setInstalled(true);
      setPromptEvent(null);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    // Событие одноразовое: второй раз prompt() у него вызвать нельзя
    setPromptEvent(null);
  }, [promptEvent]);

  return { canInstall: promptEvent !== null, installed, install };
}
