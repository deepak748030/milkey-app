// Language store with AsyncStorage persistence
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LanguageCode } from './translations';

const LANGUAGE_KEY = 'app_language';
let currentLanguage: LanguageCode = 'en';
let listeners: Array<(lang: LanguageCode) => void> = [];

export const getLanguage = () => currentLanguage;

export const setLanguage = async (lang: LanguageCode) => {
    currentLanguage = lang;
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
    listeners.forEach(listener => listener(lang));
};

export const loadLanguage = async (): Promise<LanguageCode> => {
    try {
        const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
        if (saved && ['en', 'hi', 'mr'].includes(saved)) {
            currentLanguage = saved as LanguageCode;
        }
    } catch (e) {
        // fallback to 'en'
    }
    return currentLanguage;
};

export const subscribeToLanguage = (listener: (lang: LanguageCode) => void) => {
    listeners.push(listener);
    return () => {
        listeners = listeners.filter(l => l !== listener);
    };
};
