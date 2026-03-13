// Hook to get translations based on current language
import { useState, useEffect } from 'react';
import { getTranslations, TranslationKeys, LanguageCode } from '@/lib/translations';
import { getLanguage, subscribeToLanguage, loadLanguage, setLanguage } from '@/lib/languageStore';

export function useTranslation() {
    const [language, setLang] = useState<LanguageCode>(getLanguage());
    const [t, setT] = useState<TranslationKeys>(getTranslations(getLanguage()));

    useEffect(() => {
        // Load saved language on mount
        loadLanguage().then((saved) => {
            setLang(saved);
            setT(getTranslations(saved));
        });

        // Subscribe to language changes
        const unsubscribe = subscribeToLanguage((newLang) => {
            setLang(newLang);
            setT(getTranslations(newLang));
        });

        return unsubscribe;
    }, []);

    const changeLanguage = async (lang: LanguageCode) => {
        await setLanguage(lang);
    };

    return { t, language, changeLanguage };
}
