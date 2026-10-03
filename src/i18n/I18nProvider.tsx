import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authApi } from "../auth/auth.api";
import { useAuth } from "../auth/AuthProvider";
import { translatePhrase } from "./phrases";
import { en, translations } from "./translations";
import type { I18nContextValue, LanguageCode, TranslationKey } from "./i18n.types";
import { applyRuntimeUiLanguage } from "./uiRuntimeTranslations";

const STORAGE_KEY = "hotelnova.language";
const DEFAULT_LANGUAGE: LanguageCode = "en";

const I18nContext = createContext<I18nContextValue | null>(null);

function normalizeLanguage(value: unknown): LanguageCode {
  if (typeof value !== "string") return DEFAULT_LANGUAGE;
  const clean = value.trim().toLowerCase();
  return clean === "am" || clean === "am-et" ? "am" : "en";
}

function readStoredLanguage(): LanguageCode {
  return normalizeLanguage(localStorage.getItem(STORAGE_KEY));
}

function interpolate(value: string, params?: Record<string, string | number>): string {
  if (!params) return value;
  return Object.entries(params).reduce(
    (next, [key, replacement]) => next.split(`{${key}}`).join(String(replacement)),
    value
  );
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const { auth, isAuthenticated, isReady } = useAuth();
  const [language, setLanguageState] = useState<LanguageCode>(readStoredLanguage);

  useEffect(() => {
    if (!isReady) return;

    const authLanguage = normalizeLanguage(
      auth?.user?.preferredLanguage ?? auth?.preferredLanguage ?? auth?.defaultLanguage
    );

    if (isAuthenticated) {
      setLanguageState(authLanguage);
      localStorage.setItem(STORAGE_KEY, authLanguage);
      return;
    }

    setLanguageState(readStoredLanguage());
  }, [auth?.defaultLanguage, auth?.preferredLanguage, auth?.user?.preferredLanguage, isAuthenticated, isReady]);

  useEffect(() => {
    document.documentElement.lang = language === "am" ? "am-ET" : "en";
    document.documentElement.dir = "ltr";
  }, [language]);

  const setLanguage = useCallback(
    async (nextLanguage: LanguageCode) => {
      const normalized = normalizeLanguage(nextLanguage);
      setLanguageState(normalized);
      localStorage.setItem(STORAGE_KEY, normalized);

      if (isAuthenticated) {
        try {
          await authApi.updateLanguagePreference(normalized);
        } catch {
          // Keep local preference immediately; the next successful save will sync the profile.
        }
      }
    },
    [isAuthenticated]
  );

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      const localized = translations[language][key] ?? en[key] ?? key;
      return interpolate(localized, params);
    },
    [language]
  );

  const tx = useCallback(
    (text: string, params?: Record<string, string | number>) => interpolate(translatePhrase(language, text), params),
    [language]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      locale: language === "am" ? "am-ET" : "en-US",
      setLanguage,
      t,
      tx,
    }),
    [language, setLanguage, t, tx]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used within I18nProvider.");
  return context;
}