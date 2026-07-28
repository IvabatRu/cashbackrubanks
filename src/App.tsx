import { useState } from 'react';
import { BanksScreen } from './components/BanksScreen';
import { HomeScreen } from './components/HomeScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { CardsIcon, DotsIcon, TagIcon } from './components/icons';
import { useTheme } from './lib/theme';
import { useSync } from './store/sync';

type Tab = 'home' | 'banks' | 'settings';

const TABS: { id: Tab; label: string; icon: typeof TagIcon }[] = [
  { id: 'home', label: 'Кешбэк', icon: TagIcon },
  { id: 'banks', label: 'Мои банки', icon: CardsIcon },
  { id: 'settings', label: 'Ещё', icon: DotsIcon },
];

export function App() {
  const [tab, setTab] = useState<Tab>('home');
  const { mode, setMode } = useTheme();
  const sync = useSync();

  // Заголовков экранов больше нет: название раздела и так подсвечено
  // в панели вкладок, а содержимое говорит само за себя. Шапка остаётся
  // только ради состояния синхронизации — и появляется, лишь когда есть
  // что сказать, иначе занимала бы полсотни пикселей впустую.
  const syncStatus = sync.status === 'syncing' || sync.status === 'error' ? sync.status : null;

  return (
    <div className="app">
      {syncStatus && (
        <header className="app-header">
          <div className="app-header-inner">
            {syncStatus === 'syncing' ? (
              <span className="sync-status sync-status--syncing">
                <span className="sync-dot" />
                синхронизирую
              </span>
            ) : (
              <span className="sync-status sync-status--error" title={sync.message}>
                <span className="sync-dot" />
                не синхронизировано
              </span>
            )}
          </div>
        </header>
      )}

      <main className="app-main">
        {tab === 'home' && <HomeScreen onGoToBanks={() => setTab('banks')} />}
        {tab === 'banks' && <BanksScreen />}
        {tab === 'settings' && <SettingsScreen themeMode={mode} onThemeChange={setMode} />}
      </main>

      {/* Обёртка отвечает только за место на экране: на телефоне держит
          «облачко» внизу, на ПК — вверху. Сама панель разделов
          в обоих случаях одна и та же. */}
      <div className="topbar">
        <nav className="tabbar" aria-label="Разделы">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`tabbar-item ${tab === id ? 'is-active' : ''}`}
              onClick={() => setTab(id)}
              aria-current={tab === id ? 'page' : undefined}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
