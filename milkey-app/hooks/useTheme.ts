import { useState, useEffect } from 'react';
import { getColors, getTheme, subscribeToTheme, toggleTheme, setTheme } from '@/lib/themeStore';
import { lightColors, darkColors } from '@/lib/colors';

export const useTheme = () => {
    const [theme, setThemeState] = useState(getTheme());
    const [colors, setColors] = useState(getColors());

    useEffect(() => {
        const unsubscribe = subscribeToTheme((newTheme) => {
            setThemeState(newTheme);
            setColors(newTheme === 'light' ? lightColors : darkColors);
        });
        return unsubscribe;
    }, []);

    return {
        theme,
        colors,
        isDark: theme === 'dark',
        toggleTheme,
        setTheme,
    };
};
