import { useEffect, useState } from 'react';

export type ThemeMode = 'auto' | 'light' | 'dark';

const THEME_KEY = 'cashback-app/theme';

function readSavedTheme(): ThemeMode {
  const saved = localStorage.getItem(THEME_KEY);
  return saved === 'light' || saved === 'dark' ? saved : 'auto';
}

/**
 * Тема оформления. В режиме «авто» приложение следует настройке системы —
 * этим занимается CSS через prefers-color-scheme, а здесь мы просто
 * убираем атрибут data-theme, чтобы не мешать ему.
 */
export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(readSavedTheme);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, mode);
    if (mode === 'auto') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', mode);
    }
  }, [mode]);

  return { mode, setMode };
}
