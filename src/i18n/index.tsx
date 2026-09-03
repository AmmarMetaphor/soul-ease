import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { UiLocale } from '@/data/types';
import { en } from './locales/en';
import { ur } from './locales/ur';
import type { TranslateFn, TranslationKey, Translations } from './types';

const STORAGE_KEY = 'soulease:locale';

const DICTIONARIES: Record<UiLocale, Translations> = { en, ur };

interface I18nContextValue {
  locale: UiLocale;
  dir: 'ltr' | 'rtl';
  setLocale: (locale: UiLocale) => void;
  t: TranslateFn;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLocale(): UiLocale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'ur' ? 'ur' : 'en';
  } catch {
    return 'en';
  }
}

export function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = vars[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

export function translate(locale: UiLocale, key: TranslationKey, vars?: Record<string, string | number>): string {
  const [group, leaf] = key.split('.') as [keyof Translations, string];
  const dictionary = DICTIONARIES[locale];
  const groupValue = dictionary[group] as Record<string, string> | undefined;
  const value = groupValue?.[leaf] ?? (en[group] as Record<string, string>)[leaf] ?? key;
  return interpolate(value, vars);
}

export function I18nProvider({ children, initialLocale }: { children: ReactNode; initialLocale?: UiLocale }) {
  const [locale, setLocaleState] = useState<UiLocale>(initialLocale ?? readStoredLocale);

  const setLocale = useCallback((next: UiLocale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const dir: 'ltr' | 'rtl' = locale === 'ur' ? 'rtl' : 'ltr';

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = dir;
  }, [locale, dir]);

  const t = useCallback<TranslateFn>((key, vars) => translate(locale, key, vars), [locale]);

  const value = useMemo<I18nContextValue>(() => ({ locale, dir, setLocale, t }), [locale, dir, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

export function useT(): TranslateFn {
  return useI18n().t;
}

export type { TranslationKey };
