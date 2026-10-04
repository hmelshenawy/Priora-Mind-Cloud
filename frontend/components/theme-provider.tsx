'use client';

import {createContext, type ReactNode, useContext, useEffect, useMemo, useState} from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'priora.theme';
const preferences: ThemePreference[] = ['light', 'dark', 'system'];

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemePreference(value: string | null): value is ThemePreference {
  return Boolean(value && preferences.includes(value as ThemePreference));
}

function systemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(preference: ThemePreference, resolvedTheme: ResolvedTheme) {
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.style.colorScheme = resolvedTheme;
}

export function ThemeProvider({children}: {children: ReactNode}) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const nextPreference = isThemePreference(stored) ? stored : 'system';
    const nextResolved = nextPreference === 'system' ? systemTheme() : nextPreference;
    setPreferenceState(nextPreference);
    setResolvedTheme(nextResolved);
    applyTheme(nextPreference, nextResolved);
  }, []);

  useEffect(() => {
    if (preference !== 'system') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    function handleChange() {
      const nextResolved = query.matches ? 'dark' : 'light';
      setResolvedTheme(nextResolved);
      applyTheme('system', nextResolved);
    }
    handleChange();
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, [preference]);

  function setPreference(nextPreference: ThemePreference) {
    localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
    const nextResolved = nextPreference === 'system' ? systemTheme() : nextPreference;
    setPreferenceState(nextPreference);
    setResolvedTheme(nextResolved);
    applyTheme(nextPreference, nextResolved);
  }

  const value = useMemo(() => ({preference, resolvedTheme, setPreference}), [preference, resolvedTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}

export {THEME_STORAGE_KEY};
