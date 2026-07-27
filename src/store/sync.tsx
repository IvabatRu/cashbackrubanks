import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { mergeAppData } from '../lib/merge';
import { normalizeData } from '../lib/storage';
import {
  decryptJson,
  deriveSyncKeys,
  encryptJson,
  generateSyncCode,
  isCryptoAvailable,
  isValidSyncCode,
  normalizeSyncCode,
  SYNC_CODE_LENGTH,
} from '../lib/syncCode';
import { describeSyncError, getSyncConfig, pullBucket, pushBucket } from '../lib/sync';
import type { AppData } from '../lib/types';
import { useStore } from './store';

const CODE_KEY = 'cashback-app/sync-code';
const LAST_SYNCED_KEY = 'cashback-app/sync-at';

/** Через сколько после правки отправлять данные — чтобы не дёргать сервер на каждую букву. */
const PUSH_DEBOUNCE_MS = 2500;

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'synced' | 'error';

/** Результат попытки подключиться к чужому коду. */
export type ConnectResult = { ok: true } | { ok: false; message: string };

interface SyncValue {
  /** Заданы ли адрес сервера и ключ в переменных окружения */
  configured: boolean;
  /** Доступно ли шифрование (нужен https или localhost) */
  available: boolean;
  code: string | null;
  status: SyncStatus;
  message: string;
  lastSyncedAt: number | null;

  /** Создаёт новый код и включает синхронизацию на этом устройстве */
  createCode: () => string;
  /** Подключается к чужому коду, предварительно проверив его на сервере */
  connect: (input: string) => Promise<ConnectResult>;
  /** Отключает синхронизацию. Локальные данные остаются на месте */
  disconnect: () => void;

  syncNow: () => Promise<void>;
  /** Затереть серверные данные локальными */
  forcePush: () => Promise<void>;
  /** Затереть локальные данные серверными */
  forcePull: () => Promise<void>;
}

const SyncContext = createContext<SyncValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const { data, replaceAll } = useStore();

  const config = useMemo(() => getSyncConfig(), []);
  const available = useMemo(() => isCryptoAvailable(), []);

  const [code, setCode] = useState<string | null>(() => {
    const saved = localStorage.getItem(CODE_KEY);
    return saved && isValidSyncCode(saved) ? saved : null;
  });
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [message, setMessage] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(() => {
    const saved = Number(localStorage.getItem(LAST_SYNCED_KEY));
    return Number.isFinite(saved) && saved > 0 ? saved : null;
  });

  // Свежие данные для асинхронных операций: внутри async-функции обычное
  // замыкание держало бы устаревший снимок состояния.
  const dataRef = useRef(data);
  dataRef.current = data;

  // Пока идёт одна синхронизация, вторую не начинаем
  const runningRef = useRef(false);
  // Первый прогон эффекта — это монтирование, отправлять там нечего
  const firstRunRef = useRef(true);

  const enabled = config !== null && available && code !== null;

  const finishOk = useCallback(() => {
    const now = Date.now();
    localStorage.setItem(LAST_SYNCED_KEY, String(now));
    setLastSyncedAt(now);
    setStatus('synced');
    setMessage('');
  }, []);

  const finishError = useCallback((error: unknown) => {
    setStatus('error');
    setMessage(describeSyncError(error));
    console.error('Синхронизация не удалась:', error);
  }, []);

  /**
   * Полный цикл: забрать серверное, слить со своим, вернуть результат обратно.
   * Слияние, а не перезапись — так ничего введённого не теряется,
   * даже если оба устройства правили данные без связи.
   */
  const syncNow = useCallback(async () => {
    if (!config || !available || !code || runningRef.current) return;
    runningRef.current = true;
    setStatus('syncing');

    try {
      const keys = await deriveSyncKeys(code);
      const remote = await pullBucket(config, keys.bucketId);

      let merged: AppData = dataRef.current;
      if (remote) {
        const remoteData = normalizeData(await decryptJson(keys.key, remote.payload));
        merged = mergeAppData(dataRef.current, remoteData);
      }

      // Записываем локально только при реальных изменениях,
      // иначе вызовем лишнюю перерисовку и новую отправку
      if (JSON.stringify(merged) !== JSON.stringify(dataRef.current)) {
        dataRef.current = merged;
        replaceAll(merged);
      }

      await pushBucket(config, keys.bucketId, await encryptJson(keys.key, merged));
      finishOk();
    } catch (error) {
      finishError(error);
    } finally {
      runningRef.current = false;
    }
  }, [config, available, code, replaceAll, finishOk, finishError]);

  /** Только отправка — для автосохранения после правок. */
  const pushOnly = useCallback(async () => {
    if (!config || !available || !code || runningRef.current) return;
    runningRef.current = true;
    setStatus('syncing');

    try {
      const keys = await deriveSyncKeys(code);
      await pushBucket(config, keys.bucketId, await encryptJson(keys.key, dataRef.current));
      finishOk();
    } catch (error) {
      finishError(error);
    } finally {
      runningRef.current = false;
    }
  }, [config, available, code, finishOk, finishError]);

  const forcePush = useCallback(async () => {
    if (!config || !available || !code) return;
    runningRef.current = true;
    setStatus('syncing');
    try {
      const keys = await deriveSyncKeys(code);
      await pushBucket(config, keys.bucketId, await encryptJson(keys.key, dataRef.current));
      finishOk();
    } catch (error) {
      finishError(error);
    } finally {
      runningRef.current = false;
    }
  }, [config, available, code, finishOk, finishError]);

  const forcePull = useCallback(async () => {
    if (!config || !available || !code) return;
    runningRef.current = true;
    setStatus('syncing');
    try {
      const keys = await deriveSyncKeys(code);
      const remote = await pullBucket(config, keys.bucketId);
      if (!remote) {
        setStatus('error');
        setMessage('На сервере по этому коду пока ничего нет.');
        return;
      }
      const remoteData = normalizeData(await decryptJson(keys.key, remote.payload));
      dataRef.current = remoteData;
      replaceAll(remoteData);
      finishOk();
    } catch (error) {
      finishError(error);
    } finally {
      runningRef.current = false;
    }
  }, [config, available, code, replaceAll, finishOk, finishError]);

  const createCode = useCallback((): string => {
    const created = generateSyncCode();
    localStorage.setItem(CODE_KEY, created);
    setCode(created);
    setStatus('idle');
    setMessage('');
    return created;
  }, []);

  /**
   * Подключение к коду с другого устройства.
   *
   * Проверяем на сервере, есть ли по этому коду данные, и только потом
   * сохраняем его. Причина в том, что своей формы у кода нет: любые 16 знаков
   * из нашего алфавита выглядят одинаково правильно. Без проверки опечатка
   * в одном знаке молча создавала бы новый пустой «карман» — человек видел бы
   * успешное подключение, но данные с первого устройства не приезжали бы
   * никогда, и причину он бы не понял.
   *
   * Заодно это отвечает на попытку придумать код самому: сочинённый код
   * просто не найдётся.
   */
  const connect = useCallback(
    async (input: string): Promise<ConnectResult> => {
      const normalized = normalizeSyncCode(input);
      if (!isValidSyncCode(normalized)) {
        return {
          ok: false,
          message: `Код состоит ровно из ${SYNC_CODE_LENGTH} знаков. Проверь, всё ли скопировалось.`,
        };
      }
      if (!config || !available) {
        return { ok: false, message: 'Синхронизация сейчас недоступна.' };
      }

      setStatus('syncing');
      try {
        const keys = await deriveSyncKeys(normalized);
        const remote = await pullBucket(config, keys.bucketId);

        if (!remote) {
          setStatus('idle');
          return {
            ok: false,
            message:
              'Такой код не найден. Проверь, верно ли он введён и прошла ли синхронизация на первом устройстве.',
          };
        }

        // Данные по коду нашлись — убеждаемся, что они и правда читаются,
        // прежде чем объявить подключение удачным
        await decryptJson(keys.key, remote.payload);

        localStorage.setItem(CODE_KEY, normalized);
        setCode(normalized);
        setStatus('idle');
        setMessage('');
        return { ok: true };
      } catch (error) {
        setStatus('idle');
        return { ok: false, message: describeSyncError(error) };
      }
    },
    [config, available],
  );

  const disconnect = useCallback(() => {
    localStorage.removeItem(CODE_KEY);
    localStorage.removeItem(LAST_SYNCED_KEY);
    setCode(null);
    setLastSyncedAt(null);
    setStatus('idle');
    setMessage('');
  }, []);

  // При открытии приложения (и сразу после подключения кода) — полная синхронизация
  useEffect(() => {
    if (enabled) void syncNow();
  }, [enabled, syncNow]);

  // После правок отправляем изменения с небольшой задержкой
  useEffect(() => {
    if (!enabled) return;
    if (firstRunRef.current) {
      firstRunRef.current = false;
      return;
    }
    const timer = setTimeout(() => void pushOnly(), PUSH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [data, enabled, pushOnly]);

  const value = useMemo<SyncValue>(
    () => ({
      configured: config !== null,
      available,
      code,
      status: code === null ? 'off' : status,
      message,
      lastSyncedAt,
      createCode,
      connect,
      disconnect,
      syncNow,
      forcePush,
      forcePull,
    }),
    [
      config,
      available,
      code,
      status,
      message,
      lastSyncedAt,
      createCode,
      connect,
      disconnect,
      syncNow,
      forcePush,
      forcePull,
    ],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncValue {
  const sync = useContext(SyncContext);
  if (!sync) throw new Error('useSync можно вызывать только внутри <SyncProvider>');
  return sync;
}
