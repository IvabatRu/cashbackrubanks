/**
 * Обмен данными с сервером. Специально без библиотеки @supabase/supabase-js:
 * нам нужны ровно два запроса, а SDK добавил бы к сборке больше сотни килобайт.
 *
 * Оба запроса идут не в таблицу напрямую, а в функции sync_pull / sync_push.
 * Это важно для безопасности: прямого доступа к таблице у публичного ключа нет,
 * поэтому выгрузить весь список чужих строк невозможно — можно получить только
 * ту строку, чей длинный идентификатор ты уже знаешь. Как это настроить,
 * описано в SYNC-SETUP.md.
 */

export interface SyncConfig {
  url: string;
  anonKey: string;
}

export interface RemoteBucket {
  /** Зашифрованные данные */
  payload: string;
  /** Когда сервер их принял, ISO-строка */
  updatedAt: string;
}

/** Сколько ждём ответ сервера, прежде чем считать это неудачей. */
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Настройки берём из переменных окружения. Если их нет — синхронизация просто
 * выключена, а приложение работает как обычное локальное.
 */
export function getSyncConfig(): SyncConfig | null {
  const env = import.meta.env as Record<string, string | undefined> | undefined;
  const url = env?.VITE_SUPABASE_URL?.trim();
  const anonKey = env?.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  // Убираем завершающий слэш, иначе в адресе появится двойной
  return { url: url.replace(/\/+$/, ''), anonKey };
}

async function callFunction<T>(
  config: SyncConfig,
  functionName: string,
  body: Record<string, string>,
): Promise<T> {
  const response = await fetch(`${config.url}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Сервер ответил ${response.status}. ${text}`.trim());
  }

  return (await response.json()) as T;
}

/** Забирает данные с сервера. null — этим кодом ещё ничего не сохраняли. */
export async function pullBucket(
  config: SyncConfig,
  bucketId: string,
): Promise<RemoteBucket | null> {
  const rows = await callFunction<{ payload: string; updated_at: string }[]>(config, 'sync_pull', {
    p_bucket_id: bucketId,
  });

  const row = rows?.[0];
  if (!row) return null;
  return { payload: row.payload, updatedAt: row.updated_at };
}

/** Кладёт данные на сервер. Возвращает время, которое проставил сервер. */
export async function pushBucket(
  config: SyncConfig,
  bucketId: string,
  payload: string,
): Promise<string> {
  return await callFunction<string>(config, 'sync_push', {
    p_bucket_id: bucketId,
    p_payload: payload,
  });
}

/**
 * Превращает техническую ошибку в понятную пользователю фразу.
 * Отдельно ловим обрыв сети — это самая частая причина.
 */
export function describeSyncError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return 'Сервер не ответил. Проверь интернет и попробуй ещё раз.';
  }
  if (error instanceof TypeError) {
    return 'Не удалось связаться с сервером. Похоже, нет интернета.';
  }
  if (error instanceof Error) {
    // Ошибка расшифровки означает ровно одно: код не тот
    if (error.name === 'OperationError' || error.message.includes('operation-specific reason')) {
      return 'Код не подходит к данным на сервере. Проверь, что код введён верно.';
    }
    return error.message;
  }
  return 'Неизвестная ошибка синхронизации.';
}
