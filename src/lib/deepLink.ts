import type { Bank } from '../data/banks';

/**
 * Переход в приложение банка.
 *
 * Здесь две разные среды с разными правилами, и это главное, что нужно
 * помнить при правках:
 *
 * 1) В браузере работает адрес вида "intent:", который понимает Chrome.
 *    Но Chrome принудительно требует, чтобы у открываемого экрана было
 *    разрешение открываться из интернета. Поэтому запустить приложение
 *    по имени пакета нельзя — только по схеме ссылок, которую банк сам
 *    зарегистрировал для веба. У участников СБП такая схема есть,
 *    и совпадает она с их идентификатором в реестре НСПК.
 *
 * 2) В нативном приложении внутри работает системный WebView. Он про
 *    "intent:" не знает вовсе и отвечает ERR_UNKNOWN_URL_SCHEME. Зато
 *    ограничения браузера на нативный код не распространяются: система
 *    открывает схему напрямую. Для этого используется плагин opener.
 */

/** Работаем внутри нативного приложения, а не в браузере. */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * Android ли это. Проверяем по строке браузера — способ грубый,
 * но для «показывать кнопку или нет» его достаточно.
 */
export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
}

/** Умеем ли мы вообще открыть приложение этого банка. */
export function canOpenBankApp(bank: Bank): boolean {
  // Приложение указано в реестре СБП не у всех: у 35 банков из 196 его нет
  return isAndroid() && Boolean(bank.package);
}

/**
 * Схема ссылок СБП банка — её открывает система в нативном приложении.
 * Совпадает с идентификатором банка в реестре: "bank100000000004://".
 */
function bankSchemeUrl(bank: Bank): string {
  return `${bank.id}://qr.nspk.ru/`;
}

/**
 * Адрес для браузера. Части:
 *   intent://qr.nspk.ru/ — что открыть;
 *   scheme    — схема, по которой Android найдёт приложение;
 *   package   — какое именно, если схему обрабатывает несколько;
 *   S.browser_fallback_url — куда отправить, если приложение не установлено.
 */
function bankIntentUrl(bank: Bank): string {
  const fallback = encodeURIComponent(
    `https://play.google.com/store/apps/details?id=${bank.package}`,
  );

  return [
    'intent://qr.nspk.ru/#Intent',
    `scheme=${bank.id}`,
    `package=${bank.package}`,
    `S.browser_fallback_url=${fallback}`,
    'end',
  ].join(';');
}

/**
 * Открывает приложение банка тем способом, который работает в текущей среде.
 * Возвращает текст ошибки при неудаче и null при успехе.
 */
export async function openBankApp(bank: Bank): Promise<string | null> {
  if (!bank.package) return 'Для этого банка приложение не указано в реестре СБП.';

  try {
    if (isTauri()) {
      // Динамический импорт: в сборке для браузера этот код в основной
      // файл не попадёт и загружаться не будет
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(bankSchemeUrl(bank));
      return null;
    }

    window.location.href = bankIntentUrl(bank);
    return null;
  } catch (error) {
    console.error('Не удалось открыть приложение банка:', error);
    // Показываем настоящий текст ошибки: без него причину не отличить —
    // приложение не установлено, схема не та или система отказала.
    const details = error instanceof Error ? error.message : String(error);
    return `Не удалось открыть ${bank.name}. ${details}`;
  }
}
