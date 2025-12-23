import { useState, useEffect } from 'react';
import {
    getCurrentUser,
    isAuthLoading,
    subscribeToAuth,
    clearAuth,
    AuthUser
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

    return {
        user,
        loading,
        isAuthenticated: !!user,
        logout,
    };
};
