import { useI18n } from '../../../../i18n/I18nProvider';
import { Button } from '../../../../components/ui/button';
import { trainingAmharic } from './trainingAmharic';
import { legacyTrainingAmharic } from './legacyTrainingAmharic';

export function useTrainingLanguage() {
  const { language, setLanguage } = useI18n();
  const tr = (text: string | null | undefined, params?: Record<string, string | number>) => {
    let value = text ?? '';
    if (language === 'am') value = trainingAmharic[value] ?? legacyTrainingAmharic[value] ?? value;
    for (const [key, replacement] of Object.entries(params ?? {})) value = value.split(`{${key}}`).join(String(replacement));
    return value;
  };
  return { language, setLanguage, tr };
}

export function TrainingLanguageBar() {
  const { language, setLanguage, tr } = useTrainingLanguage();
  return <nav className="training-actions training-no-print" aria-label={tr('Training language')}>
    <Button variant="outline" lang="am" aria-pressed={language === 'am'} onClick={() => void setLanguage('am')}>አማርኛ</Button>
    <Button variant="outline" lang="en" aria-pressed={language === 'en'} onClick={() => void setLanguage('en')}>English</Button>
  </nav>;
}
