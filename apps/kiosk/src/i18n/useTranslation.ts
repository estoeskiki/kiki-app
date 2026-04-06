import { useCallback } from 'react';
import { useLocaleStore } from '@/store/useLocaleStore';
import { translations, type TranslationKey, type Language } from './translations';
import type { TranslatableText } from '@/data/types';

export function getLocalizedText(
  text: TranslatableText | string | undefined | null,
  lang: Language
): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  return text[lang] || text.es || text.en || '';
}

export function useTranslation() {
  const language = useLocaleStore((s) => s.language);
  const setLanguage = useLocaleStore((s) => s.setLanguage);
  const toggleLanguage = useLocaleStore((s) => s.toggleLanguage);

  const t = useCallback(
    (key: TranslationKey): string => {
      // Fallback to English if the key is somehow missing in the current language
      return translations[language][key] || translations['en'][key] || key;
    },
    [language]
  );
  
  const localize = useCallback(
    (text: TranslatableText | string | undefined | null) => getLocalizedText(text, language),
    [language]
  );

  return {
    t,
    localize,
    language,
    setLanguage,
    toggleLanguage,
  };
}
