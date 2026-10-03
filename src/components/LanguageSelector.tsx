import { Languages } from "lucide-react";
import { useI18n, type LanguageCode } from "../i18n";

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, t } = useI18n();

  async function onChange(nextLanguage: LanguageCode) {
    if (nextLanguage === language) return;
    await setLanguage(nextLanguage);
  }

  return (
    <div className={compact ? "hn-language hn-language--compact" : "hn-language"} aria-label={t("common.language")}>
      <Languages size={16} strokeWidth={2} aria-hidden="true" />
      <select
        className="hn-language__select"
        value={language}
        onChange={(event) => onChange(event.target.value as LanguageCode)}
        aria-label={t("common.language")}
      >
        <option value="en">{t("language.english")}</option>
        <option value="am">{t("language.amharic")}</option>
      </select>
    </div>
  );
}
