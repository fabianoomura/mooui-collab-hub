import { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dim' | 'dark';
type ThemePref = Theme | 'auto';

interface ThemeContextValue {
  theme: Theme;
  preference: ThemePref;
  setTheme: (t: ThemePref) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'mooui-theme';
const THEMES: Theme[] = ['light', 'dim', 'dark'];

function resolveSystem(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function resolve(pref: ThemePref): Theme {
  return pref === 'auto' ? resolveSystem() : pref;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<ThemePref>(() => {
    if (typeof window === 'undefined') return 'dark';
    const stored = localStorage.getItem(STORAGE_KEY) as ThemePref | null;
    if (stored === 'light' || stored === 'dim' || stored === 'dark' || stored === 'auto') return stored;
    return 'dark';
  });
  const [theme, setThemeResolved] = useState<Theme>(() => resolve(preference));

  useEffect(() => {
    setThemeResolved(resolve(preference));
    localStorage.setItem(STORAGE_KEY, preference);
    if (preference !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => setThemeResolved(resolveSystem());
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [preference]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dim', 'dark');
    root.classList.add(theme);
  }, [theme]);

  const setTheme = (t: ThemePref) => setPreference(t);
  const toggleTheme = () => {
    setPreference((p) => {
      const current = resolve(p);
      const idx = THEMES.indexOf(current);
      return THEMES[(idx + 1) % THEMES.length];
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, preference, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
