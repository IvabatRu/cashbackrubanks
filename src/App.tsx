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

const TAB_TITLES: Record<Tab, string> = {
  home: 'Где кешбэк?',
  banks: 'Мои банки',
  settings: 'Настройки',
};

export function App() {
  const [tab, setTab] = useState<Tab>('home');
  const { mode, setMode } = useTheme();

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <h1 className="app-title">{TAB_TITLES[tab]}</h1>
          <SyncIndicator />
        </div>
      </header>

      <main className="app-main">
        {tab === 'home' && <HomeScreen onGoToBanks={() => setTab('banks')} />}
        {tab === 'banks' && <BanksScreen />}
        {tab === 'settings' && <SettingsScreen themeMode={mode} onThemeChange={setMode} />}
      </main>

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
  );
}

/**
 * Небольшой значок в шапке: видно, что синхронизация идёт или что она сломалась.
 * Когда всё в порядке и синхронизировать нечего — ничего не показываем,
 * чтобы не засорять шапку.
 */
function SyncIndicator() {
  const sync = useSync();

  if (sync.status === 'syncing') {
    return (
      <span className="sync-status sync-status--syncing">
        <span className="sync-dot" />
        синхронизирую
      </span>
    );
  }

  if (sync.status === 'error') {
    return (
      <span className="sync-status sync-status--error" title={sync.message}>
        <span className="sync-dot" />
        не синхронизировано
      </span>
    );
  }

  return null;
}
