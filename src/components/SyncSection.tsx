import { useState } from 'react';
import { formatSyncCode, SYNC_CODE_LENGTH } from '../lib/syncCode';
import { useSync } from '../store/sync';
import type { SyncStatus } from '../store/sync';
import { CheckIcon, CopyIcon, DownloadIcon, EyeIcon, EyeOffIcon, UploadIcon } from './icons';

const STATUS_TEXT: Record<SyncStatus, string> = {
  off: 'выключена',
  idle: 'готово',
  syncing: 'синхронизирую…',
  synced: 'синхронизировано',
  error: 'ошибка',
};

export function SyncSection() {
  const sync = useSync();
  const [entering, setEntering] = useState(false);
  const [input, setInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Сервер не настроен — объясняем, что делать, вместо неработающих кнопок
  if (!sync.configured) {
    return (
      <section className="card">
        <h2 className="card-title card-title--alone">Синхронизация</h2>
        <p className="card-note">
          Не настроена. Нужен бесплатный проект Supabase и файл <code>.env.local</code> с адресом
          и ключом — пошагово это описано в <code>SYNC-SETUP.md</code> в папке проекта. Занимает
          около пяти минут, платить ничего не нужно.
        </p>
        <p className="card-note">
          Пока синхронизации нет, перенести данные можно через выгрузку в файл — кнопки выше.
        </p>
      </section>
    );
  }

  // Шифрование доступно только по https или на localhost
  if (!sync.available) {
    return (
      <section className="card">
        <h2 className="card-title card-title--alone">Синхронизация</h2>
        <p className="card-note">
          Недоступна по этому адресу. Браузер разрешает шифрование только на <code>localhost</code>{' '}
          или по <code>https</code>. Открой приложение по защищённому адресу — и синхронизация
          включится.
        </p>
      </section>
    );
  }

  async function handleCopy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function handleConnect() {
    if (sync.connect(input)) {
      setInput('');
      setInputError('');
      setEntering(false);
    } else {
      setInputError(`Код должен содержать ровно ${SYNC_CODE_LENGTH} знаков без пробелов.`);
    }
  }

  // Синхронизация ещё не включена
  if (!sync.code) {
    return (
      <section className="card">
        <h2 className="card-title card-title--alone">Синхронизация</h2>
        <p className="card-note">
          Работает по коду, без регистрации и без почты. Данные шифруются прямо в браузере — на
          сервер уезжает только зашифрованный блок, и прочитать его можно лишь этим кодом.
        </p>

        {entering ? (
          <div className="form">
            <label className="field">
              <span className="field-label">Код с другого устройства</span>
              <input
                className="text-input sync-input"
                value={input}
                placeholder="16 знаков"
                autoFocus
                spellCheck={false}
                autoCapitalize="none"
                onChange={(event) => {
                  setInput(event.target.value);
                  setInputError('');
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleConnect();
                }}
              />
            </label>
            {inputError && <p className="error-note">{inputError}</p>}
            <p className="card-note">
              Данные обоих устройств объединятся — ничего из введённого не потеряется.
            </p>
            <div className="form-actions">
              <button
                type="button"
                className="button button--ghost"
                onClick={() => {
                  setEntering(false);
                  setInputError('');
                }}
              >
                Отмена
              </button>
              <button type="button" className="button button--primary" onClick={handleConnect}>
                Подключить
              </button>
            </div>
          </div>
        ) : (
          <div className="button-row">
            <button
              type="button"
              className="button button--primary"
              onClick={() => {
                sync.createCode();
                setRevealed(true);
              }}
            >
              Создать код
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setEntering(true)}
            >
              Ввести существующий
            </button>
          </div>
        )}
      </section>
    );
  }

  // Синхронизация включена
  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Синхронизация</h2>
        <span className={`sync-status sync-status--${sync.status}`}>
          <span className="sync-dot" />
          {STATUS_TEXT[sync.status]}
        </span>
      </div>

      <div className="field">
        <span className="field-label">Код синхронизации</span>
        <div className="sync-code-row">
          <code className="sync-code">
            {revealed ? formatSyncCode(sync.code) : '•••• •••• •••• ••••'}
          </code>
          <button
            type="button"
            className="icon-button"
            onClick={() => setRevealed((value) => !value)}
            aria-label={revealed ? 'Скрыть код' : 'Показать код'}
          >
            {revealed ? <EyeOffIcon width={18} height={18} /> : <EyeIcon width={18} height={18} />}
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => void handleCopy(sync.code as string)}
            aria-label="Скопировать код"
          >
            {copied ? <CheckIcon width={18} height={18} /> : <CopyIcon width={18} height={18} />}
          </button>
        </div>
      </div>

      <p className="card-note">
        Введи этот код на другом устройстве — данные объединятся. Кто знает код, тот видит твои
        кешбэки, так что не публикуй его. Восстановить код невозможно: если потеряешь, доступ к
        серверной копии пропадёт, но локальные данные останутся.
      </p>

      {sync.message && <p className="error-note">{sync.message}</p>}

      {sync.lastSyncedAt !== null && (
        <p className="card-note">Последняя синхронизация: {formatLastSynced(sync.lastSyncedAt)}</p>
      )}

      <button
        type="button"
        className="button button--primary button--full"
        onClick={() => void sync.syncNow()}
        disabled={sync.status === 'syncing'}
      >
        Синхронизировать сейчас
      </button>

      <button
        type="button"
        className="link-button"
        onClick={() => setShowAdvanced((value) => !value)}
      >
        {showAdvanced ? 'Скрыть' : 'Если что-то пошло не так'}
      </button>

      {showAdvanced && (
        <>
          <p className="card-note">
            Обычно данные объединяются сами. Эти кнопки нужны, только если надо принудительно
            сделать одну из копий главной — вторая при этом потеряется.
          </p>
          <div className="button-row">
            <button
              type="button"
              className="button button--ghost"
              onClick={() => {
                if (window.confirm('Заменить данные на сервере данными этого устройства?')) {
                  void sync.forcePush();
                }
              }}
            >
              <UploadIcon width={18} height={18} />
              Мои данные — главные
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => {
                if (window.confirm('Заменить данные этого устройства серверными?')) {
                  void sync.forcePull();
                }
              }}
            >
              <DownloadIcon width={18} height={18} />
              Серверные — главные
            </button>
          </div>
          <button
            type="button"
            className="button button--danger button--full"
            onClick={() => {
              if (window.confirm('Отключить синхронизацию? Локальные данные останутся на месте.')) {
                sync.disconnect();
                setRevealed(false);
              }
            }}
          >
            Отключить синхронизацию
          </button>
        </>
      )}
    </section>
  );
}

/** «только что», «12 минут назад», «сегодня в 14:05» или полная дата. */
function formatLastSynced(timestamp: number): string {
  const minutesAgo = Math.floor((Date.now() - timestamp) / 60_000);
  if (minutesAgo < 1) return 'только что';
  if (minutesAgo < 60) return `${minutesAgo} ${pluralMinutes(minutesAgo)} назад`;

  const date = new Date(timestamp);
  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const isToday = new Date().toDateString() === date.toDateString();
  if (isToday) return `сегодня в ${time}`;

  return `${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} в ${time}`;
}

function pluralMinutes(n: number): string {
  const lastTwo = n % 100;
  const last = n % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return 'минут';
  if (last === 1) return 'минуту';
  if (last >= 2 && last <= 4) return 'минуты';
  return 'минут';
}
