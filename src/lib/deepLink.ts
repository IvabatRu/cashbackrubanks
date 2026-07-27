import type { Bank } from '../data/banks';

/**
 * Запуск других приложений с телефона.
 *
 * История вопроса, чтобы не наступить на те же грабли:
 *
 * 1) Запуск по имени пакета из браузера невозможен. Chrome при переходе
 *    из интернета открывает только те экраны, которым разработчик явно
 *    разрешил открываться из веба, а главный экран приложения такого
 *    разрешения не имеет.
 *
 * 2) Открытие схемы системы быстрых платежей ("bank100000000004://")
 *    формально работало, но приложение банка принимало такую ссылку
 *    за платёжный QR-код и ругалось: ВТБ показывал «В этом QR-коде нет
 *    нужных реквизитов для платежа», Альфа-Банк — общую ошибку. Человек
 *    в этот момент решает, что его пытаются обмануть.
 *
 * 3) Работает третий способ: нативный код просит Android запустить
 *    приложение так же, как это делает нажатие на значок на рабочем столе.
 *    Именно он здесь и используется — через команду launch_app.
 *
 * Поэтому кнопки показываются только в нативном приложении. В браузере
 * их нет: там доступен лишь второй способ, а он приводит к ошибке.
 */

/** Приложение бесконтактной оплаты картой «Мир». */
export const MIR_PAY = {
  name: 'Mir Pay',
  package: 'ru.nspk.mirpay',
};

/** Работаем внутри нативного приложения, а не в браузере. */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
}

/** Можем ли мы вообще запускать чужие приложения в текущей среде. */
export function canLaunchApps(): boolean {
  return isTauri() && isAndroid();
}

/** Умеем ли мы открыть приложение конкретного банка. */
export function canOpenBankApp(bank: Bank): boolean {
  // Приложение указано в реестре СБП не у всех: у 35 банков из 196 его нет
  return canLaunchApps() && Boolean(bank.package);
}

/**
 * Запускает приложение по имени пакета.
 * Возвращает текст ошибки при неудаче и null при успехе.
 */
export async function launchApp(packageName: string, appName: string): Promise<string | null> {
  try {
    // Динамический импорт: в сборке для браузера этот код в основной
    // файл не попадёт и загружаться не будет
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('launch_app', { packageName });
    return null;
  } catch (error) {
    console.error(`Не удалось запустить ${appName}:`, error);
    const details = error instanceof Error ? error.message : String(error);
    return `Не удалось открыть ${appName}. ${details}`;
  }
}

export function openBankApp(bank: Bank): Promise<string | null> {
  if (!bank.package) {
    return Promise.resolve('Для этого банка приложение не указано в реестре СБП.');
  }
  return launchApp(bank.package, bank.name);
}

export function openMirPay(): Promise<string | null> {
  return launchApp(MIR_PAY.package, MIR_PAY.name);
}
