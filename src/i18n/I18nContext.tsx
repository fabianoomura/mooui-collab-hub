import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { translations, type Locale } from './translations';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (path: string) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function getInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem('locale');
    if (stored && stored in translations) return stored as Locale;
  } catch {
    // localStorage unavailable
  }
  return 'pt-BR';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem('locale', newLocale);
    } catch {
      // localStorage unavailable
    }
  }, []);

  const t = useCallback(
    (path: string): string => {
      const keys = path.split('.');
      let result: unknown = translations[locale];
      for (const key of keys) {
        if (result && typeof result === 'object' && key in result) {
          result = (result as Record<string, unknown>)[key];
        } else {
          return path; // fallback: return the path itself
        }
      }
      return typeof result === 'string' ? result : path;
    },
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider');
  return ctx;
}
