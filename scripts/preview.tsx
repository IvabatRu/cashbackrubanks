/**
 * Рисует приложение в статический HTML, чтобы можно было посмотреть на него
 * снимком экрана, не открывая браузер вручную. Запуск: npm run preview:html
 *
 * Зачем: правки в раскладке иначе проверяются только на глаз в живом
 * браузере, а на ПК-версию нужно ещё и окно нужной ширины. Здесь получается
 * настоящая разметка приложения с настоящими стилями и заполненными
 * данными — то есть то же, что увидит человек.
 *
 * Это не тест: ничего не проверяется, файл просто складывается на диск.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import type { ReactNode } from 'react';

// --- Заглушка localStorage -------------------------------------------------
// Та же, что в smoke-тесте: хранилище и тема читают его при первой отрисовке.
const memory = new Map<string, string>();

globalThis.localStorage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, String(value)),
  removeItem: (key: string) => void memory.delete(key),
  clear: () => memory.clear(),
  key: (index: number) => [...memory.keys()][index] ?? null,
  get length() {
    return memory.size;
  },
} as Storage;

const PERIOD = (() => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
})();

const TBANK = 'bank100000000004';
const ALFA = 'bank100000000008';
const SBER = 'bank100000000111';
const OZON = 'bank100000000273';

const NOW = Date.now();

/** Заполнено так, чтобы было видно и плитки с процентами, и чипы без них. */
const DATA = {
  schemaVersion: 4,
  myBanks: [TBANK, ALFA, SBER, OZON].map((id) => ({ id, addedAt: NOW, updatedAt: NOW })),
  customCategories: [],
  deleted: [],
  categoryOrder: [],
  categoryOrderUpdatedAt: 0,
  primaryBankId: TBANK,
  primaryBankUpdatedAt: NOW,
  cashbacks: [
    [TBANK, 'pharmacy', 7],
    [ALFA, 'pharmacy', 5],
    [SBER, 'supermarkets', 10],
    [TBANK, 'supermarkets', 4],
    [OZON, 'marketplaces', 12.5],
    [TBANK, 'fuel', 5],
    [ALFA, 'restaurants', 15],
    [SBER, 'transport', 3],
    [OZON, 'clothes', 8],
    [ALFA, 'beauty', 20],
    [TBANK, 'entertainment', 6],
    [SBER, 'home', 5],
  ].map(([bankId, categoryId, percent], index) => ({
    id: `preview-${index}`,
    period: PERIOD,
    bankId: bankId as string,
    categoryId: categoryId as string,
    percent: percent as number,
    updatedAt: NOW,
  })),
};

memory.set('cashback-app', JSON.stringify(DATA));

// --- Импорты приложения: только после заглушки -----------------------------
const { renderToString } = await import('react-dom/server');
const { StoreProvider } = await import('../src/store/store');
const { SyncProvider } = await import('../src/store/sync');
const { App } = await import('../src/App');
const { CategoryResultSheet } = await import('../src/components/CategoryResultSheet');
const { BanksScreen } = await import('../src/components/BanksScreen');
const { SettingsScreen } = await import('../src/components/SettingsScreen');
const { BUILT_IN_CATEGORIES } = await import('../src/data/categories');

function wrap(children: ReactNode) {
  return (
    <StoreProvider>
      <SyncProvider>{children}</SyncProvider>
    </StoreProvider>
  );
}

// Корень берём от рабочей папки, а не от файла: собранный скрипт лежит
// в node_modules/.cache, и путь от него вёл бы не туда
const root = process.cwd();
const css = readFileSync(resolve(root, 'src/styles.css'), 'utf8');

// В Node import.meta.env нет, поэтому пути к картинкам получились от корня
// сайта («/logos/…»). Файл открывается напрямую с диска, где такой путь ведёт
// в корень диска, — переписываем их на настоящую папку public.
const publicUrl = `${pathToFileURL(resolve(root, 'public')).href}/`;

function render(node: ReactNode): string {
  return renderToString(wrap(node))
    .replace(/<!-- -->/g, '')
    .replaceAll('src="/', `src="${publicUrl}`);
}

let body = render(<App />);

/**
 * Со вторым аргументом «sheet» дорисовываем открытую панель результата:
 * состояние живёт внутри App, снаружи его не задать, поэтому разметку
 * панели вставляем в конец .app — там же, где её создаёт React.
 * Нужно, чтобы увидеть боковую панель на ПК, не открывая браузер руками.
 */
/**
 * Другие вкладки. Какая из них открыта — состояние внутри App, снаружи
 * не задать, поэтому подменяем содержимое главной области готовой
 * разметкой нужного экрана. Шапка и панель разделов при этом настоящие.
 */
const OTHER_SCREENS: Record<string, ReactNode> = {
  banks: <BanksScreen />,
  settings: <SettingsScreen themeMode="dark" onThemeChange={() => {}} />,
};

const otherScreen = OTHER_SCREENS[process.argv[3] ?? ''];
if (otherScreen) {
  const inner = render(otherScreen);
  body = body.replace(
    /(<main class="app-main">)[\s\S]*(<\/main>)/,
    (_full, open: string, close: string) => open + inner + close,
  );
}

if (process.argv[3] === 'sheet') {
  const category = BUILT_IN_CATEGORIES.find((item) => item.id === 'pharmacy');
  const sheet = render(
    <CategoryResultSheet
      open
      onClose={() => {}}
      category={category ?? null}
      cashbacks={DATA.cashbacks.filter((cashback) => cashback.categoryId === 'pharmacy')}
      period={PERIOD}
    />,
  );
  const lastClose = body.lastIndexOf('</div>');
  body = body.slice(0, lastClose) + sheet + body.slice(lastClose);
}

const html = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Кешбэк — предпросмотр</title>
    <style>${css}</style>
  </head>
  <body>${body}</body>
</html>
`;

// Путь берём из аргумента: файл временный и в репозитории ему не место
const out = process.argv[2] ?? resolve(root, 'preview.html');
writeFileSync(out, html, 'utf8');
console.log(`Готово: ${out}`);
