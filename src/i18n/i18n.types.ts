export type LanguageCode = "en" | "am";

export type TranslationKey = keyof typeof import("./translations").en;

export type I18nContextValue = {
  language: LanguageCode;
  locale: string;
  setLanguage: (language: LanguageCode) => Promise<void>;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  tx: (text: string, params?: Record<string, string | number>) => string;
};