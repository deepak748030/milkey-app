import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { userSubscriptionsApi, SubscriptionStatus, TabSubscriptionCheck, Subscription } from './milkeyApi';

const SUBSCRIPTION_MODAL_SHOWN_KEY = '@milkey_subscription_modal_shown';
const SUBSCRIPTION_MODAL_SESSION_KEY = '@milkey_subscription_session';
const SUBSCRIPTION_STATUS_KEY = '@milkey_subscription_status';
const SUBSCRIPTION_CACHE_KEY = '@milkey_subscription_cache';

// Types for the subscription store
interface TabSubscriptionData {
    hasValidSubscription: boolean;
    subscription: TabSubscriptionCheck['subscription'] | null;
    availableSubscriptions: Subscription[];
    expiresAt: string | null;
    lastFetched: number;
}

interface SubscriptionStoreState {
    // Status data
    status: SubscriptionStatus | null;
    statusLoading: boolean;
    statusFetched: boolean;

    // Tab-specific data (cached)
    tabData: {
        purchase: TabSubscriptionData | null;
        selling: TabSubscriptionData | null;
        register: TabSubscriptionData | null;
    };

    // Actions
    fetchStatus: () => Promise<SubscriptionStatus | null>;
    fetchTabData: (tab: 'purchase' | 'selling' | 'register') => Promise<TabSubscriptionData | null>;
    preloadAllTabs: () => Promise<void>;
    hasTabAccess: (tab: 'purchase' | 'selling' | 'register') => boolean;
    clearCache: () => void;
    initializeFromStorage: () => Promise<void>;
}

// Cache expiry time (5 minutes)
const CACHE_EXPIRY_MS = 5 * 60 * 1000;

export const useSubscriptionStore = create<SubscriptionStoreState>((set, get) => ({
    status: null,
    statusLoading: false,
    statusFetched: false,
    tabData: {
        purchase: null,
        selling: null,
        register: null,
    },

    initializeFromStorage: async () => {
        try {
            const cached = await AsyncStorage.getItem(SUBSCRIPTION_CACHE_KEY);
            if (cached) {
                const data = JSON.parse(cached);
                const now = Date.now();

                // Only use cache if not expired
                if (data.lastFetched && now - data.lastFetched < CACHE_EXPIRY_MS) {
                    set({
                        status: data.status || null,
                        tabData: data.tabData || { purchase: null, selling: null, register: null },
                        statusFetched: !!data.status,
                    });
                }
            }
        } catch (error) {
            console.error('Failed to initialize subscription cache:', error);
        }
    },

    fetchStatus: async () => {
        const { statusLoading, status, statusFetched } = get();

        // Return cached if recently fetched
        if (statusFetched && status) {
            return status;
        }

        if (statusLoading) {
            // Wait for existing request
            return new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    const current = get();
                    if (!current.statusLoading) {
                        clearInterval(checkInterval);
                        resolve(current.status);
                    }
                }, 100);
            });
        }

        set({ statusLoading: true });

        try {
            const res = await userSubscriptionsApi.getStatus();
            if (res.success && res.response) {
                set({
                    status: res.response,
                    statusLoading: false,
                    statusFetched: true,
                });

                // Persist to storage
                const cacheData = {
                    status: res.response,
                    tabData: get().tabData,
                    lastFetched: Date.now(),
                };
                await AsyncStorage.setItem(SUBSCRIPTION_CACHE_KEY, JSON.stringify(cacheData));

                // Also update the legacy storage for backward compatibility
                await storeSubscriptionStatus({
                    hasPurchase: res.response.hasPurchase,
                    hasSelling: res.response.hasSelling,
                    hasRegister: res.response.hasRegister,
                });

                return res.response;
            }
        } catch (error) {
            console.error('Failed to fetch subscription status:', error);
        } finally {
            set({ statusLoading: false });
        }

        return null;
    },

    fetchTabData: async (tab: 'purchase' | 'selling' | 'register') => {
        const { tabData } = get();
        const existing = tabData[tab];
        const now = Date.now();

        // Return cached if not expired
        if (existing && existing.lastFetched && now - existing.lastFetched < CACHE_EXPIRY_MS) {
            return existing;
        }

        try {
            const res = await userSubscriptionsApi.checkTab(tab);
            if (res.success && res.response) {
                const newTabData: TabSubscriptionData = {
                    hasValidSubscription: res.response.hasValidSubscription,
                    subscription: res.response.subscription,
                    availableSubscriptions: res.response.availableSubscriptions || [],
                    expiresAt: res.response.expiresAt,
                    lastFetched: now,
                };

                set((state) => ({
                    tabData: {
                        ...state.tabData,
                        [tab]: newTabData,
                    },
                }));

                // Persist to storage
                const cacheData = {
                    status: get().status,
                    tabData: {
                        ...get().tabData,
                        [tab]: newTabData,
                    },
                    lastFetched: now,
                };
                await AsyncStorage.setItem(SUBSCRIPTION_CACHE_KEY, JSON.stringify(cacheData));

                return newTabData;
            }
        } catch (error) {
            console.error(`Failed to fetch tab data for ${tab}:`, error);
        }

        return null;
    },

    preloadAllTabs: async () => {
        const { fetchStatus, fetchTabData } = get();

        // Fetch status first
        await fetchStatus();

        // Fetch all tab data in parallel
        await Promise.all([
            fetchTabData('purchase'),
            fetchTabData('selling'),
            fetchTabData('register'),
        ]);
    },

    hasTabAccess: (tab: 'purchase' | 'selling' | 'register') => {
        const { status, tabData } = get();

        // Check tab-specific data first
        const tabInfo = tabData[tab];
        if (tabInfo) {
            return tabInfo.hasValidSubscription;
        }

        // Fall back to status
        if (status) {
            switch (tab) {
                case 'purchase':
                    return status.hasPurchase;
                case 'selling':
                    return status.hasSelling;
                case 'register':
                    return status.hasRegister;
            }
        }

        return false;
    },

    clearCache: () => {
        set({
            status: null,
            statusLoading: false,
            statusFetched: false,
            tabData: {
                purchase: null,
                selling: null,
                register: null,
            },
        });
        AsyncStorage.removeItem(SUBSCRIPTION_CACHE_KEY);
    },
}));

// ============ Legacy functions for backward compatibility ============

// Check if modal was shown in this app session
export const wasModalShownThisSession = async (): Promise<boolean> => {
    try {
        const sessionId = await AsyncStorage.getItem(SUBSCRIPTION_MODAL_SESSION_KEY);
        const currentSessionId = Date.now().toString().slice(0, -5); // Changes every ~100 seconds

        if (sessionId === currentSessionId) {
            return true;
        }
        return false;
    } catch {
        return false;
    }
};

export const markModalShownThisSession = async (): Promise<void> => {
    try {
        const currentSessionId = Date.now().toString().slice(0, -5);
        await AsyncStorage.setItem(SUBSCRIPTION_MODAL_SESSION_KEY, currentSessionId);
    } catch (error) {
        console.error('Failed to mark modal shown:', error);
    }
};

// Check if modal should be shown (once per day)
export const shouldShowSubscriptionModal = async (): Promise<boolean> => {
    try {
        const lastShown = await AsyncStorage.getItem(SUBSCRIPTION_MODAL_SHOWN_KEY);
        if (!lastShown) return true;

        // Show once per app open session (not per day)
        const wasShown = await wasModalShownThisSession();
        return !wasShown;
    } catch {
        return true;
    }
};

export const markSubscriptionModalShown = async (): Promise<void> => {
    try {
        await AsyncStorage.setItem(SUBSCRIPTION_MODAL_SHOWN_KEY, new Date().toISOString());
        await markModalShownThisSession();
    } catch (error) {
        console.error('Failed to mark subscription modal shown:', error);
    }
};

// Store subscription status for quick access (legacy)
export const getStoredSubscriptionStatus = async (): Promise<{
    hasPurchase: boolean;
    hasSelling: boolean;
    hasRegister: boolean;
} | null> => {
    try {
        const data = await AsyncStorage.getItem(SUBSCRIPTION_STATUS_KEY);
        return data ? JSON.parse(data) : null;
    } catch {
        return null;
    }
};

export const storeSubscriptionStatus = async (status: {
    hasPurchase: boolean;
    hasSelling: boolean;
    hasRegister: boolean;
}): Promise<void> => {
    try {
        await AsyncStorage.setItem(SUBSCRIPTION_STATUS_KEY, JSON.stringify(status));
    } catch (error) {
        console.error('Failed to store subscription status:', error);
    }
};
