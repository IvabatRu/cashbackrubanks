/**
 * Переходы в другие приложения на телефоне.
 *
 * Работает только на Android и только из браузеров на движке Chromium:
 * это особый адрес вида `intent:`, который Android понимает как «запусти
 * приложение с таким именем пакета». Ни на компьютере, ни на iPhone он
 * не сработает, поэтому кнопки показываем только там, где они имеют смысл.
 *
 * ВАЖНО: проверить это можно только на настоящем телефоне. Режим отладки
 * в браузере на компьютере такие переходы не выполняет — он лишь
 * притворяется телефоном по размеру экрана и строке userAgent.
 */

/** Имя пакета приложения Mir Pay — бесконтактная оплата картой «Мир». */
export const MIR_PAY_PACKAGE = 'ru.nspk.mirpay';

/**
 * Android ли это. Проверяем по строке браузера — способ грубый,
 * но для «показывать кнопку или нет» его достаточно, а ошибка
 * ничего не ломает: в худшем случае кнопка просто не сработает.
 */
export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
}

/**
 * Собирает адрес запуска приложения по имени пакета.
 *
 * Разбор частей:
 *   action и category  — «открой главный экран приложения»;
 *   package            — какое именно приложение;
 *   S.browser_fallback_url — куда отправить, если приложение не установлено.
 *                            Без этого Chrome просто ничего не сделает,
 *                            а так откроется страница в Google Play.
 */
export function appLaunchUrl(packageName: string): string {
  const fallback = encodeURIComponent(
    `https://play.google.com/store/apps/details?id=${packageName}`,
  );

  return [
    'intent:#Intent',
    'action=android.intent.action.MAIN',
    'category=android.intent.category.LAUNCHER',
    `package=${packageName}`,
    `S.browser_fallback_url=${fallback}`,
    'end',
  ].join(';');
}

export function mirPayUrl(): string {
  return appLaunchUrl(MIR_PAY_PACKAGE);
}
