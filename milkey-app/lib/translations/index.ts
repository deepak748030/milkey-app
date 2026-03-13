// Translation system - Add new languages here
import en, { TranslationKeys } from './en';
import hi from './hi';
import mr from './mr';

export type LanguageCode = 'en' | 'hi' | 'mr';

export interface LanguageOption {
    code: LanguageCode;
    label: string;        // Native name
    englishLabel: string;  // English name
    flag: string;          // Emoji flag or symbol
}

// Add new languages here - just import the file and add to this list
export const AVAILABLE_LANGUAGES: LanguageOption[] = [
    { code: 'en', label: 'English', englishLabel: 'English', flag: '🇬🇧' },
    { code: 'hi', label: 'हिंदी', englishLabel: 'Hindi', flag: '🇮🇳' },
    { code: 'mr', label: 'मराठी', englishLabel: 'Marathi', flag: '🇮🇳' },
];

const translations: Record<LanguageCode, TranslationKeys> = {
    en,
    hi,
    mr,
};

export const getTranslations = (lang: LanguageCode): TranslationKeys => {
    return translations[lang] || translations.en;
};

export type { TranslationKeys };
export default translations;
