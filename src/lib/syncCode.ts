/**
 * Код синхронизации и шифрование данных.
 *
 * Замысел: код синхронизации — это единственный секрет, и на сервер он никогда
 * не попадает. Из него выводятся две независимые вещи:
 *
 *   1) bucketId — 64 шестнадцатеричных знака, которыми строка опознаётся в базе;
 *   2) ключ AES-256, которым данные шифруются прямо в браузере.
 *
 * Сервер видит только непонятный идентификатор и зашифрованный блок. Ни кода,
 * ни содержимого он не знает, поэтому даже утечка базы ничего не даёт.
 * Персональных данных не собирается вообще — это и есть тот вариант, при котором
 * требования 152-ФЗ к нам не относятся.
 */

/**
 * Алфавит кода: 68 знаков — заглавные, строчные, цифры и специальные.
 * Убраны похожие друг на друга I, O, l, o, 0, 1, чтобы код нельзя было
 * переписать с ошибкой.
 */
const ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZ' + 'abcdefghijkmnpqrstuvwxyz' + '23456789' + '!#$%*+-=?@^_';

export const SYNC_CODE_LENGTH = 16;

/** Соль привязывает вывод ключей к этому приложению и этой версии формата. */
const KDF_SALT = 'cashback-sync-v1';

/** Число итераций PBKDF2 — по рекомендации OWASP для HMAC-SHA256. */
const PBKDF2_ITERATIONS = 210_000;

/** Метка формата в начале зашифрованного блока: пригодится, если формат изменится. */
const PAYLOAD_PREFIX = 'v1:';

export interface SyncKeys {
  /** Чем строка опознаётся на сервере */
  bucketId: string;
  /** Чем шифруются данные */
  key: CryptoKey;
}

/**
 * Доступно ли шифрование. crypto.subtle есть только в «защищённом контексте»:
 * https или localhost. По локальной сети http://192.168.x.x его не будет.
 */
export function isCryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined';
}

/**
 * Создаёт новый случайный код из 16 знаков.
 * 68^16 ≈ 97 бит энтропии — перебором такой код не находится.
 */
export function generateSyncCode(): string {
  const chars: string[] = [];
  // Байты со значением выше limit отбрасываем: 256 не делится на 68 без остатка,
  // и без этого первые знаки алфавита выпадали бы чаще остальных.
  const limit = Math.floor(256 / ALPHABET.length) * ALPHABET.length;
  const buffer = new Uint8Array(32);

  while (chars.length < SYNC_CODE_LENGTH) {
    crypto.getRandomValues(buffer);
    for (const byte of buffer) {
      if (byte >= limit) continue;
      chars.push(ALPHABET[byte % ALPHABET.length]);
      if (chars.length === SYNC_CODE_LENGTH) break;
    }
  }

  return chars.join('');
}

/** Убирает пробелы и переносы — пользователь может вставить код с форматированием. */
export function normalizeSyncCode(input: string): string {
  return input.replace(/\s+/g, '');
}

export function isValidSyncCode(code: string): boolean {
  return code.length === SYNC_CODE_LENGTH && [...code].every((char) => ALPHABET.includes(char));
}

/** Разбивает код на группы по 4 знака — так его проще прочитать и перенести. */
export function formatSyncCode(code: string): string {
  return (code.match(/.{1,4}/g) ?? []).join(' ');
}

// Вывод ключей стоит около секунды, поэтому результат запоминаем на время работы вкладки
const keysCache = new Map<string, Promise<SyncKeys>>();

export function deriveSyncKeys(code: string): Promise<SyncKeys> {
  const cached = keysCache.get(code);
  if (cached) return cached;
  const promise = deriveSyncKeysUncached(code);
  keysCache.set(code, promise);
  return promise;
}

async function deriveSyncKeysUncached(code: string): Promise<SyncKeys> {
  const encoder = new TextEncoder();

  // Шаг 1: медленный PBKDF2 из кода. Именно он делает перебор дорогим.
  const baseKey = await crypto.subtle.importKey('raw', encoder.encode(code), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const masterBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(KDF_SALT),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    256,
  );

  // Шаг 2: быстрый HKDF разводит один секрет на два независимых.
  // Так из bucketId нельзя вычислить ключ шифрования, и наоборот.
  const hkdfKey = await crypto.subtle.importKey('raw', masterBits, 'HKDF', false, ['deriveBits']);

  const bucketBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: encoder.encode('bucket-id') },
    hkdfKey,
    256,
  );
  const keyBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: encoder.encode('payload-key') },
    hkdfKey,
    256,
  );

  const key = await crypto.subtle.importKey('raw', keyBits, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);

  return { bucketId: bytesToHex(bucketBits), key };
}

/** Шифрует любой объект в строку, которую не стыдно положить на чужой сервер. */
export async function encryptJson(key: CryptoKey, value: unknown): Promise<string> {
  // Вектор инициализации должен быть новым при каждом шифровании —
  // повторное использование с AES-GCM ломает всю защиту.
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

  // Складываем вектор и шифртекст вместе: при расшифровке вектор понадобится
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  return PAYLOAD_PREFIX + bytesToBase64(combined);
}

/**
 * Расшифровывает то, что пришло с сервера.
 * Бросает ошибку, если код не тот: AES-GCM сам проверяет целостность.
 */
export async function decryptJson(key: CryptoKey, payload: string): Promise<unknown> {
  if (!payload.startsWith(PAYLOAD_PREFIX)) {
    throw new Error('Неизвестный формат зашифрованных данных');
  }

  const combined = base64ToBytes(payload.slice(PAYLOAD_PREFIX.length));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);

  return JSON.parse(new TextDecoder().decode(plaintext));
}

function bytesToHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
