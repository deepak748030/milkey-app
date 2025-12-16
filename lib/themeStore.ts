import { lightColors, darkColors } from './colors';

type ThemeMode = 'light' | 'dark';

let currentTheme: ThemeMode = 'light';
let listeners: Array<(theme: ThemeMode) => void> = [];

export const getTheme = () => currentTheme;

export const getColors = () => {
    return currentTheme === 'light' ? lightColors : darkColors;
};

export const toggleTheme = () => {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    listeners.forEach(listener => listener(currentTheme));
};

export const setTheme = (theme: ThemeMode) => {
    currentTheme = theme;
    listeners.forEach(listener => listener(currentTheme));
};

export const subscribeToTheme = (listener: (theme: ThemeMode) => void) => {
    listeners.push(listener);
    return () => {
        listeners = listeners.filter(l => l !== listener);
    };
};
