import { useState, useEffect, useCallback } from 'react';
import {
    getCurrentUser,
    isAuthLoading,
    subscribeToAuth,
    clearAuth,
    AuthUser,
    initializeAuth
} from '@/lib/authStore';

export const useAuth = () => {
    const [user, setUser] = useState<AuthUser | null>(getCurrentUser());
    const [loading, setLoading] = useState(isAuthLoading());

    useEffect(() => {
        const unsubscribe = subscribeToAuth((newUser, newLoading) => {
            setUser(newUser);
            setLoading(newLoading);
        });

        return unsubscribe;
    }, []);

    const logout = async () => {
        await clearAuth();
    };

    const refreshUser = useCallback(async () => {
        await initializeAuth();
    }, []);

    return {
        user,
        loading,
        isAuthenticated: !!user,
        logout,
        refreshUser,
    };
};
