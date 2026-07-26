import { useRef, useState } from 'react';
import { ALL_BANKS } from '../data/banks';
import { BUILT_IN_CATEGORIES } from '../data/categories';
import { useInstallPrompt } from '../lib/install';
import { describeData } from '../lib/merge';
import { currentPeriod, formatPeriod } from '../lib/period';
import { downloadBackup, normalizeData } from '../lib/storage';
import type { ThemeMode } from '../lib/theme';
import { useStore } from '../store/store';
import { SyncSection } from './SyncSection';
import { CheckIcon, DownloadIcon, MoonIcon, SunIcon, TrashIcon, UploadIcon } from './icons';

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'auto', label: 'Как в системе' },
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
];

interface SettingsScreenProps {
  themeMode: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
}

export function SettingsScreen({ themeMode, onThemeChange }: SettingsScreenProps) {
  const { data, replaceAll, removeCustomCategory, clearPeriod } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMessage, setImportMessage] = useState('');
  const { canInstall, installed, install } = useInstallPrompt();

  const thisPeriod = currentPeriod();

  async function handleImportFile(file: File) {
    try {
      const text = await file.text();
      const imported = normalizeData(JSON.parse(text));
      const confirmed = window.confirm(
        `В файле: ${describeData(imported)}.\n\nТекущие данные будут полностью заменены. Продолжить?`,
      );
      if (!confirmed) return;
      replaceAll(imported);
      setImportMessage('Данные загружены.');
    } catch {
      setImportMessage('Не получилось прочитать файл — это точно резервная копия приложения?');
    }
  }

  return (
    <div className="screen">
      {/* Показываем, только когда браузер действительно готов установить:
          не установлено ещё, движок это умеет и условия соблюдены. */}
      {canInstall && (
        <section className="card">
          <h2 className="card-title card-title--alone">Установить приложение</h2>
          <p className="card-note">
            Появится своя иконка, приложение будет открываться в отдельном окне без адресной
            строки и работать без интернета.
          </p>
          <button
            type="button"
            className="button button--primary button--full"
            onClick={() => void install()}
          >
            <DownloadIcon width={18} height={18} />
            Установить
          </button>
        </section>
      )}

      {installed && (
        <p className="installed-note">
          <CheckIcon width={16} height={16} />
          Приложение установлено на это устройство
        </p>
      )}

      <section className="card">
        <h2 className="card-title card-title--alone">Оформление</h2>
        <div className="segmented">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`segmented-item ${themeMode === option.value ? 'is-selected' : ''}`}
              onClick={() => onThemeChange(option.value)}
            >
              {option.value === 'light' && <SunIcon width={16} height={16} />}
              {option.value === 'dark' && <MoonIcon width={16} height={16} />}
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <SyncSection />

      <section className="card">
        <h2 className="card-title card-title--alone">Резервная копия</h2>
        <p className="card-note">
          Копия всех данных одним файлом — на случай, если очистишь данные браузера или захочешь
          перенести их вручную, без синхронизации.
        </p>
        <div className="button-row">
          <button
            type="button"
            className="button button--ghost"
            onClick={() => downloadBackup(data)}
          >
            <DownloadIcon width={18} height={18} />
            Выгрузить в файл
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadIcon width={18} height={18} />
            Загрузить из файла
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleImportFile(file);
            // Сбрасываем значение, иначе повторный выбор того же файла не сработает
            event.target.value = '';
          }}
        />
        {importMessage && <p className="card-note">{importMessage}</p>}
      </section>

      {data.customCategories.length > 0 && (
        <section className="card">
          <h2 className="card-title card-title--alone">Мои категории</h2>
          <ul className="row-list">
            {data.customCategories.map((category) => (
              <li key={category.id} className="row row--static">
                <span className="row-emoji">{category.emoji}</span>
                <span className="row-title">{category.name}</span>
                <button
                  type="button"
                  className="icon-button icon-button--danger"
                  aria-label={`Удалить категорию ${category.name}`}
                  onClick={() => {
                    const confirmed = window.confirm(
                      `Удалить категорию «${category.name}»? Все кешбэки по ней тоже исчезнут.`,
                    );
                    if (confirmed) removeCustomCategory(category.id);
                  }}
                >
                  <TrashIcon width={18} height={18} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2 className="card-title card-title--alone">Очистить</h2>
        <p className="card-note">
          Удалить все кешбэки за {formatPeriod(thisPeriod)}. Банки и другие месяцы останутся.
        </p>
        <button
          type="button"
          className="button button--danger"
          onClick={() => {
            const confirmed = window.confirm(
              `Удалить все кешбэки за ${formatPeriod(thisPeriod)}?`,
            );
            if (confirmed) clearPeriod(thisPeriod);
          }}
        >
          <TrashIcon width={18} height={18} />
          Очистить {formatPeriod(thisPeriod)}
        </button>
      </section>

      <section className="card">
        <h2 className="card-title card-title--alone">О приложении</h2>
        <dl className="info-list">
          <div>
            <dt>Банков в справочнике</dt>
            <dd>{ALL_BANKS.length}</dd>
          </div>
          <div>
            <dt>Встроенных категорий</dt>
            <dd>{BUILT_IN_CATEGORIES.length}</dd>
          </div>
          <div>
            <dt>Заполнено кешбэков</dt>
            <dd>{data.cashbacks.length}</dd>
          </div>
        </dl>
        <p className="card-note">
          Список банков — участники СБП (реестр НСПК). Проценты кешбэка заполняются вручную: банки
          не отдают их автоматически.
        </p>
      </section>
    </div>
  );
}
