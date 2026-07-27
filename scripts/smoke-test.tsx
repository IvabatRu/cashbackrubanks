/**
 * Smoke-тест: проверяет справочники, миграцию данных, слияние двух устройств,
 * шифрование и отрисовку всех экранов. Запуск: npm run smoke
 *
 * Это не полноценные тесты, а быстрая проверка «ничего не сломалось»:
 * она ловит ошибки в компонентах, опечатки в импортах, пропавшие данные
 * и поломанную логику синхронизации. Полезно прогонять после каждой правки в src/.
 */

// Только типы — на исполнение не влияет, поэтому заглушки ниже успевают сработать
import type { ReactElement, ReactNode } from 'react';
import type { AppData, Cashback, Tombstone } from '../src/lib/types';

// --- Заглушка localStorage -------------------------------------------------
// В Node его нет, а хранилище и тема читают его при первой отрисовке.
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

const CURRENT_PERIOD = (() => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
})();

const TBANK = 'bank100000000004';
const ALFA = 'bank100000000008';
const SBER = 'bank100000000111';

/**
 * Данные в формате схемы 1 — без отметок времени, со старым полем myBankIds.
 * Так проверяем, что данные, введённые до появления синхронизации, не пропадут.
 */
const LEGACY_DATA = {
  schemaVersion: 1,
  myBankIds: [TBANK, ALFA, SBER],
  customCategories: [{ id: 'custom-test', name: 'Строительные', emoji: '🔨', custom: true }],
  cashbacks: [
    { id: '1', period: CURRENT_PERIOD, bankId: TBANK, categoryId: 'pharmacy', percent: 5 },
    { id: '2', period: CURRENT_PERIOD, bankId: ALFA, categoryId: 'pharmacy', percent: 3 },
    { id: '3', period: CURRENT_PERIOD, bankId: SBER, categoryId: 'supermarkets', percent: 5 },
    { id: '4', period: CURRENT_PERIOD, bankId: TBANK, categoryId: 'fuel', percent: 10 },
    { id: '5', period: CURRENT_PERIOD, bankId: ALFA, categoryId: 'custom-test', percent: 1.5 },
  ],
};

memory.set('cashback-app', JSON.stringify(LEGACY_DATA));

// --- Импорты приложения ----------------------------------------------------
// Только после заглушки: модули читают localStorage при первой отрисовке.
const { renderToString } = await import('react-dom/server');
const { StoreProvider } = await import('../src/store/store');
const { SyncProvider } = await import('../src/store/sync');
const { App } = await import('../src/App');
const { HomeScreen } = await import('../src/components/HomeScreen');
const { BanksScreen } = await import('../src/components/BanksScreen');
const { SettingsScreen } = await import('../src/components/SettingsScreen');
const { BankPickerSheet } = await import('../src/components/BankPickerSheet');
const { CategoryPickerSheet } = await import('../src/components/CategoryPickerSheet');
const { PercentSheet } = await import('../src/components/PercentSheet');
const { CategoryResultSheet } = await import('../src/components/CategoryResultSheet');
const { ALL_BANKS, POPULAR_BANKS } = await import('../src/data/banks');
const { BUILT_IN_CATEGORIES } = await import('../src/data/categories');
const { normalizeData, EMPTY_DATA } = await import('../src/lib/storage');
const { mergeAppData } = await import('../src/lib/merge');
const syncCode = await import('../src/lib/syncCode');

// --- Мини-фреймворк проверок ----------------------------------------------
let failures = 0;

function report(ok: boolean, label: string, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
}

function expectEqual(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  report(a === e, label, a === e ? '' : `получено ${a}, ожидалось ${e}`);
}

/** Отрисовывает элемент и проверяет, что в разметке есть все нужные подписи. */
function renderAndExpect(label: string, element: ReactElement, expected: string[]) {
  let html: string;
  try {
    // React вставляет служебные <!-- --> между соседними текстовыми узлами,
    // из-за чего «5%» в разметке выглядит как «5<!-- -->%». Убираем их,
    // чтобы проверять текст так, как его видит пользователь.
    html = renderToString(element).replace(/<!-- -->/g, '');
  } catch (error) {
    report(false, label, `упало с ошибкой: ${(error as Error).message}`);
    return;
  }

  const missing = expected.filter((text) => !html.includes(text));
  report(
    missing.length === 0,
    label,
    missing.length > 0 ? `не найдено в разметке: ${missing.join(', ')}` : '',
  );
}

function wrap(children: ReactNode) {
  return (
    <StoreProvider>
      <SyncProvider>{children}</SyncProvider>
    </StoreProvider>
  );
}

function section(title: string) {
  console.log(`\n--- ${title} ---`);
}

// --- Справочники -----------------------------------------------------------
section('Справочники');
expectEqual('банков в справочнике', ALL_BANKS.length, 196);
expectEqual('популярных банков', POPULAR_BANKS.length, 12);
expectEqual('встроенных категорий', BUILT_IN_CATEGORIES.length, 40);
expectEqual('популярные по алфавиту', POPULAR_BANKS[0].name, 'Альфа-Банк');
report(
  ALL_BANKS.every((bank) => bank.logo.endsWith(`${bank.id}.png`)),
  'у каждого банка свой путь к логотипу',
);
report(
  new Set(ALL_BANKS.map((bank) => bank.id)).size === ALL_BANKS.length,
  'id банков не повторяются',
);
report(
  new Set(BUILT_IN_CATEGORIES.map((c) => c.id)).size === BUILT_IN_CATEGORIES.length,
  'id категорий не повторяются',
);

// --- Миграция схемы 1 → 2 --------------------------------------------------
section('Миграция старых данных');
const migrated = normalizeData(LEGACY_DATA);
expectEqual('версия схемы поднялась', migrated.schemaVersion, 4);
expectEqual('основной банк по умолчанию не выбран', migrated.primaryBankId, null);
expectEqual('порядок плиток по умолчанию пуст', migrated.categoryOrder, []);
expectEqual(
  'myBankIds превратились в myBanks',
  migrated.myBanks.map((bank) => bank.id),
  [TBANK, ALFA, SBER],
);
expectEqual('кешбэки сохранились', migrated.cashbacks.length, 5);
report(
  migrated.cashbacks.every((cashback) => cashback.updatedAt === 0),
  'старым записям проставлено updatedAt = 0 (считаются самыми старыми)',
);
expectEqual('надгробий пока нет', migrated.deleted, []);
expectEqual('мусор на входе не ломает загрузку', normalizeData('не объект'), EMPTY_DATA);
expectEqual('битые кешбэки отбрасываются', normalizeData({
  cashbacks: [
    { id: 'x', period: 'не период', bankId: TBANK, categoryId: 'fuel', percent: 5 },
    { id: 'y', period: '2026-07', bankId: TBANK, categoryId: 'fuel', percent: 'много' },
  ],
}).cashbacks.length, 0);

// --- Слияние двух устройств ------------------------------------------------
section('Слияние двух устройств');

function makeData(options: {
  banks?: { id: string; addedAt: number }[];
  cashbacks?: Cashback[];
  deleted?: Tombstone[];
  categoryOrder?: string[];
  categoryOrderUpdatedAt?: number;
  primaryBankId?: string | null;
  primaryBankUpdatedAt?: number;
}): AppData {
  return {
    schemaVersion: 4,
    myBanks: options.banks ?? [],
    cashbacks: options.cashbacks ?? [],
    customCategories: [],
    deleted: options.deleted ?? [],
    categoryOrder: options.categoryOrder ?? [],
    categoryOrderUpdatedAt: options.categoryOrderUpdatedAt ?? 0,
    primaryBankId: options.primaryBankId ?? null,
    primaryBankUpdatedAt: options.primaryBankUpdatedAt ?? 0,
  };
}

function cb(bankId: string, categoryId: string, percent: number, updatedAt: number): Cashback {
  return { id: `${bankId}-${categoryId}`, period: '2026-07', bankId, categoryId, percent, updatedAt };
}

/**
 * Отметки времени обязательно должны быть настоящими: надгробия старше полугода
 * при слиянии намеренно отбрасываются, и на условных значениях вроде 3000
 * (это 1970 год) проверки давали бы неверный результат.
 */
const NOW = Date.now();
const ago = (seconds: number) => NOW - seconds * 1000;
const DAY = 24 * 60 * 60;

const EARLIER = ago(600);
const LATER = ago(10);

// 1. Разные банки на двух устройствах — должны объединиться
const mergedBanks = mergeAppData(
  makeData({ banks: [{ id: TBANK, addedAt: EARLIER }] }),
  makeData({ banks: [{ id: ALFA, addedAt: LATER }] }),
  NOW,
);
expectEqual(
  'банки с двух устройств объединяются',
  mergedBanks.myBanks.map((bank) => bank.id),
  [TBANK, ALFA],
);

// 2. Одну запись правили на двух устройствах — побеждает более свежая
const mergedConflict = mergeAppData(
  makeData({ banks: [{ id: TBANK, addedAt: EARLIER }], cashbacks: [cb(TBANK, 'fuel', 5, EARLIER)] }),
  makeData({ banks: [{ id: TBANK, addedAt: EARLIER }], cashbacks: [cb(TBANK, 'fuel', 10, LATER)] }),
  NOW,
);
expectEqual('при конфликте побеждает свежая правка', mergedConflict.cashbacks[0].percent, 10);
expectEqual('дубликата не появилось', mergedConflict.cashbacks.length, 1);

// 3. Удалённое не воскресает со второго устройства
const mergedDeleted = mergeAppData(
  makeData({
    banks: [{ id: TBANK, addedAt: EARLIER }],
    deleted: [{ key: `cashback:2026-07|${TBANK}|fuel`, at: LATER }],
  }),
  makeData({ banks: [{ id: TBANK, addedAt: EARLIER }], cashbacks: [cb(TBANK, 'fuel', 5, EARLIER)] }),
  NOW,
);
expectEqual('удалённый кешбэк не воскресает', mergedDeleted.cashbacks.length, 0);

// 4. Заново созданное после удаления — выживает
const mergedRecreated = mergeAppData(
  makeData({
    banks: [{ id: TBANK, addedAt: EARLIER }],
    cashbacks: [cb(TBANK, 'fuel', 7, LATER)],
    deleted: [{ key: `cashback:2026-07|${TBANK}|fuel`, at: ago(300) }],
  }),
  makeData({ banks: [{ id: TBANK, addedAt: EARLIER }] }),
  NOW,
);
expectEqual('созданное заново после удаления остаётся', mergedRecreated.cashbacks.length, 1);
expectEqual('и с новым процентом', mergedRecreated.cashbacks[0].percent, 7);

// 5. Удалённый банк уносит свои кешбэки
const mergedBankDeleted = mergeAppData(
  makeData({ deleted: [{ key: `bank:${ALFA}`, at: LATER }] }),
  makeData({ banks: [{ id: ALFA, addedAt: EARLIER }], cashbacks: [cb(ALFA, 'fuel', 5, EARLIER)] }),
  NOW,
);
expectEqual('удалённый банк не возвращается', mergedBankDeleted.myBanks.length, 0);
expectEqual('и его кешбэки тоже', mergedBankDeleted.cashbacks.length, 0);

// 6. Надгробия не живут вечно — иначе список рос бы без конца.
// Плата за это: если устройство не выходило на связь больше полугода,
// его старая копия может вернуть удалённое. Осознанный компромисс.
const mergedAncient = mergeAppData(
  makeData({
    banks: [{ id: TBANK, addedAt: EARLIER }],
    deleted: [{ key: `cashback:2026-07|${TBANK}|fuel`, at: ago(400 * DAY) }],
  }),
  makeData({ banks: [{ id: TBANK, addedAt: EARLIER }], cashbacks: [cb(TBANK, 'fuel', 5, EARLIER)] }),
  NOW,
);
expectEqual('надгробие старше полугода уже не действует', mergedAncient.cashbacks.length, 1);
expectEqual('и само оно выброшено из данных', mergedAncient.deleted.length, 0);

// 7. Слияние ничего не теряет в обычном случае
const deviceA = makeData({
  banks: [{ id: TBANK, addedAt: EARLIER }],
  cashbacks: [cb(TBANK, 'fuel', 10, EARLIER), cb(TBANK, 'pharmacy', 5, EARLIER)],
});
const deviceB = makeData({
  banks: [
    { id: TBANK, addedAt: EARLIER },
    { id: SBER, addedAt: LATER },
  ],
  cashbacks: [cb(TBANK, 'fuel', 10, EARLIER), cb(SBER, 'supermarkets', 3, LATER)],
});
expectEqual(
  'в объединении три уникальных кешбэка',
  mergeAppData(deviceA, deviceB, NOW).cashbacks.length,
  3,
);
expectEqual(
  'слияние в обратную сторону даёт столько же',
  mergeAppData(deviceB, deviceA, NOW).cashbacks.length,
  3,
);

// 8. Порядок плиток — единое целое: побеждает заданный позже,
// а не смесь двух расстановок
const orderNewerOnRemote = mergeAppData(
  makeData({ categoryOrder: ['fuel', 'pharmacy'], categoryOrderUpdatedAt: EARLIER }),
  makeData({ categoryOrder: ['pharmacy', 'fuel'], categoryOrderUpdatedAt: LATER }),
  NOW,
);
expectEqual('берётся порядок, заданный позже', orderNewerOnRemote.categoryOrder, [
  'pharmacy',
  'fuel',
]);

const orderNewerOnLocal = mergeAppData(
  makeData({ categoryOrder: ['fuel', 'pharmacy'], categoryOrderUpdatedAt: LATER }),
  makeData({ categoryOrder: ['pharmacy', 'fuel'], categoryOrderUpdatedAt: EARLIER }),
  NOW,
);
expectEqual('и в обратную сторону тоже', orderNewerOnLocal.categoryOrder, ['fuel', 'pharmacy']);
report(
  orderNewerOnRemote.categoryOrder.length === 2,
  'порядок не превратился в смесь двух расстановок',
);

// --- Код синхронизации и шифрование ---------------------------------------
section('Код синхронизации и шифрование');

const code = syncCode.generateSyncCode();
expectEqual('длина кода', code.length, 16);
report(syncCode.isValidSyncCode(code), `сгенерированный код проходит проверку: ${code}`);
report(
  syncCode.generateSyncCode() !== syncCode.generateSyncCode(),
  'два вызова дают разные коды',
);
report(!syncCode.isValidSyncCode('коротко'), 'короткий код отвергается');
report(!syncCode.isValidSyncCode('AAAAAAAAAAAAAAA0'), 'запрещённый знак 0 отвергается');
expectEqual('код нормализуется', syncCode.normalizeSyncCode(' ab cd\nef '), 'abcdef');
expectEqual('код разбит по 4 знака', syncCode.formatSyncCode('ABCDEFGHJKLMNPQR').split(' ').length, 4);

// В коде должны реально встречаться разные виды знаков — проверяем на большой выборке
const sample = Array.from({ length: 60 }, () => syncCode.generateSyncCode()).join('');
report(/[A-Z]/.test(sample), 'в коде встречаются заглавные буквы');
report(/[a-z]/.test(sample), 'в коде встречаются строчные буквы');
report(/[2-9]/.test(sample), 'в коде встречаются цифры');
report(/[!#$%*+\-=?@^_]/.test(sample), 'в коде встречаются специальные знаки');
report(!/[IOl0o1]/.test(sample), 'похожие друг на друга знаки исключены');

report(syncCode.isCryptoAvailable(), 'шифрование доступно');

const keys = await syncCode.deriveSyncKeys(code);
expectEqual('идентификатор строки — 64 шестнадцатеричных знака', keys.bucketId.length, 64);
report(/^[0-9a-f]{64}$/.test(keys.bucketId), 'идентификатор в правильном формате');

const sameKeys = await syncCode.deriveSyncKeys(code);
expectEqual('один код всегда даёт один идентификатор', sameKeys.bucketId, keys.bucketId);

const otherKeys = await syncCode.deriveSyncKeys(syncCode.generateSyncCode());
report(otherKeys.bucketId !== keys.bucketId, 'разные коды дают разные идентификаторы');

// Полный круг: зашифровали, расшифровали, данные не изменились
const secret = { банк: 'Т-Банк', категория: 'Аптеки', процент: 5.5, эмодзи: '💊' };
const encrypted = await syncCode.encryptJson(keys.key, secret);
expectEqual('расшифровка возвращает исходные данные', await syncCode.decryptJson(keys.key, encrypted), secret);

report(!encrypted.includes('Аптеки'), 'открытого текста в зашифрованном блоке нет');
report(!encrypted.includes('Т-Банк'), 'названия банка в зашифрованном блоке нет');
report(
  (await syncCode.encryptJson(keys.key, secret)) !== encrypted,
  'два шифрования одних данных дают разный результат (вектор новый каждый раз)',
);

// Чужим кодом расшифровать нельзя
let decryptFailed = false;
try {
  await syncCode.decryptJson(otherKeys.key, encrypted);
} catch {
  decryptFailed = true;
}
report(decryptFailed, 'чужим кодом данные не расшифровываются');

// --- Экраны ---------------------------------------------------------------
section('Экраны');
renderAndExpect('экран «Кешбэк»', wrap(<HomeScreen onGoToBanks={() => {}} />), [
  'Аптеки',
  'АЗС',
  'Строительные', // своя категория попала в список
  '10%', // лучший процент по АЗС — крупным числом на плитке
  '5%', // лучший процент по аптекам
  'Без кешбэка в этом месяце',
  `logos/${TBANK}.png`, // логотип банка прямо на плитке
]);

renderAndExpect('экран «Мои банки»', wrap(<BanksScreen />), [
  'Т-Банк',
  'Альфа-Банк',
  'Сбербанк',
  'Добавить банк',
  'Добавить категорию',
  '10%',
  '1,5%', // дробный процент с запятой
]);

renderAndExpect(
  'экран «Настройки»',
  wrap(<SettingsScreen themeMode="auto" onThemeChange={() => {}} />),
  ['Оформление', 'Синхронизация', 'Резервная копия', 'Мои категории', 'Строительные', '196', '40'],
);

// Заголовков экранов больше нет — остались только названия вкладок
renderAndExpect('приложение целиком', wrap(<App />), ['Кешбэк', 'Мои банки', 'Ещё']);

// --- Панели ---------------------------------------------------------------
section('Панели');
renderAndExpect(
  'панель выбора банка',
  wrap(<BankPickerSheet open onClose={() => {}} selectedIds={[TBANK]} onPick={() => {}} />),
  [
    'Найти банк среди 196',
    'Популярные',
    'Все банки СБП',
    'Т-Банк',
    'добавлен', // уже добавленный банк помечен
    'Озон Банк (Ozon)',
    'ВБ Банк (Wildberries)',
    'Яндекс Банк',
    'Хакасский муниципальный банк', // банк из «длинного хвоста» списка
  ],
);

renderAndExpect(
  'панель выбора категории',
  wrap(
    <CategoryPickerSheet
      open
      onClose={() => {}}
      bankName="Т-Банк"
      usedCategoryIds={['pharmacy']}
      onPick={() => {}}
    />,
  ),
  ['Своя категория', 'Супермаркеты', 'Строительные', 'своя'],
);

renderAndExpect(
  'панель ввода процента',
  wrap(
    <PercentSheet
      open
      onClose={() => {}}
      bankName="Т-Банк"
      category={BUILT_IN_CATEGORIES.find((c) => c.id === 'pharmacy')}
      initialPercent={5}
      onSubmit={() => {}}
      onDelete={() => {}}
    />,
  ),
  ['Аптеки', 'Т-Банк', 'Сохранить', 'Удалить', '30%'],
);

renderAndExpect(
  'панель результата по категории',
  wrap(
    <CategoryResultSheet
      open
      onClose={() => {}}
      category={BUILT_IN_CATEGORIES.find((c) => c.id === 'pharmacy') ?? null}
      period={CURRENT_PERIOD}
      cashbacks={[
        cb(TBANK, 'pharmacy', 5, 1),
        cb(ALFA, 'pharmacy', 3, 1),
      ].map((cashback) => ({ ...cashback, period: CURRENT_PERIOD }))}
    />,
  ),
  ['Т-Банк', 'Альфа-Банк', '5%', '3%', 'Лучший кешбэк'],
);

// --- Свой порядок плиток на экране ----------------------------------------
section('Свой порядок плиток');

// Аптеки дают 5%, АЗС — 10%. По умолчанию АЗС были бы выше,
// но ручной порядок должен это перекрыть.
memory.set(
  'cashback-app',
  JSON.stringify({
    ...LEGACY_DATA,
    categoryOrder: ['pharmacy', 'fuel'],
    categoryOrderUpdatedAt: Date.now(),
  }),
);

{
  const html = renderToString(wrap(<HomeScreen onGoToBanks={() => {}} />)).replace(/<!-- -->/g, '');
  const pharmacyAt = html.indexOf('Аптеки');
  const fuelAt = html.indexOf('АЗС');
  report(
    pharmacyAt !== -1 && fuelAt !== -1 && pharmacyAt < fuelAt,
    'ручной порядок перекрывает сортировку по проценту (Аптеки 5% встали выше АЗС 10%)',
  );
  report(html.includes('Изменить порядок'), 'есть кнопка входа в режим перестановки');
  report(!html.includes('Мой порядок'), 'заголовка раздела больше нет');
}

// Без ручного порядка — снова по убыванию процента
memory.set('cashback-app', JSON.stringify(LEGACY_DATA));
{
  const html = renderToString(wrap(<HomeScreen onGoToBanks={() => {}} />)).replace(/<!-- -->/g, '');
  report(html.indexOf('АЗС') < html.indexOf('Аптеки'), 'по умолчанию выше идёт больший процент');
}

// --- Основной банк ---------------------------------------------------------
section('Основной банк');

// Аптеки: Т-Банк даёт 5%, Альфа — 3%. А супермаркеты у Сбера — 5%,
// столько же даёт Т-Банк по аптекам. Проверяем поведение при равенстве.
memory.set(
  'cashback-app',
  JSON.stringify({
    ...LEGACY_DATA,
    cashbacks: [
      { id: '1', period: CURRENT_PERIOD, bankId: TBANK, categoryId: 'pharmacy', percent: 5 },
      { id: '2', period: CURRENT_PERIOD, bankId: ALFA, categoryId: 'pharmacy', percent: 5 },
    ],
    primaryBankId: ALFA,
    primaryBankUpdatedAt: Date.now(),
  }),
);

{
  const html = renderToString(wrap(<HomeScreen onGoToBanks={() => {}} />)).replace(/<!-- -->/g, '');
  report(
    html.includes(`logos/${ALFA}.png`),
    'при равных процентах на плитке логотип основного банка',
  );
  report(
    !html.includes(`logos/${TBANK}.png`),
    'а не какого-то другого из тех, что дают столько же',
  );
}

memory.set('cashback-app', JSON.stringify(LEGACY_DATA));

// Слияние: основной банк — настройка целиком, побеждает заданная позже
const primaryNewer = mergeAppData(
  makeData({
    banks: [{ id: TBANK, addedAt: EARLIER }, { id: ALFA, addedAt: EARLIER }],
    primaryBankId: TBANK,
    primaryBankUpdatedAt: EARLIER,
  }),
  makeData({
    banks: [{ id: TBANK, addedAt: EARLIER }, { id: ALFA, addedAt: EARLIER }],
    primaryBankId: ALFA,
    primaryBankUpdatedAt: LATER,
  }),
  NOW,
);
expectEqual('берётся основной банк, заданный позже', primaryNewer.primaryBankId, ALFA);

// Если основной банк успели удалить из своих, настройка сбрасывается —
// иначе указывала бы на банк, которого нет
const primaryGone = mergeAppData(
  makeData({ deleted: [{ key: `bank:${ALFA}`, at: LATER }], primaryBankId: ALFA, primaryBankUpdatedAt: LATER }),
  makeData({ banks: [{ id: ALFA, addedAt: EARLIER }] }),
  NOW,
);
expectEqual('удалённый банк перестаёт быть основным', primaryGone.primaryBankId, null);

// --- Пустые состояния -----------------------------------------------------
section('Пустые состояния');
memory.set('cashback-app', JSON.stringify(EMPTY_DATA));
renderAndExpect('пустой экран «Кешбэк»', wrap(<HomeScreen onGoToBanks={() => {}} />), [
  'Здесь будет поиск по категориям',
  'Заполнить кешбэки',
]);
renderAndExpect('пустой экран «Мои банки»', wrap(<BanksScreen />), [
  'Пока нет ни одного банка',
  'Добавить банк',
]);

console.log(failures === 0 ? '\nВСЕ ПРОВЕРКИ ПРОЙДЕНЫ' : `\nПРОВАЛЕНО ПРОВЕРОК: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
