import { useState, useEffect, useCallback } from 'react';
import { Subscription } from '@/lib/milkeyApi';
import { useSubscriptionStore, storeSubscriptionStatus } from '@/lib/subscriptionStore';
import { router } from 'expo-router';

export interface UseSubscriptionCheckResult {
    hasAccess: boolean;
    loading: boolean;
    subscription: any | null;
    availableSubscriptions: Subscription[];
    expiresAt: string | null;
    refresh: () => Promise<void>;
    showSubscriptionModal: boolean;
    setShowSubscriptionModal: (show: boolean) => void;
    handleModalClose: () => void;
    handleSubscriptionSuccess: () => void;
}

export function useSubscriptionCheck(tab: 'purchase' | 'selling' | 'register'): UseSubscriptionCheckResult {
    const [loading, setLoading] = useState(true);
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
    const [accessChecked, setAccessChecked] = useState(false);

    const {
        tabData,
        status,
        fetchTabData,
        fetchStatus,
        hasTabAccess,
        initializeFromStorage,
    } = useSubscriptionStore();

    const cachedTabData = tabData[tab];
    const hasAccess = hasTabAccess(tab);

    const checkSubscription = useCallback(async () => {
        setLoading(true);
        setAccessChecked(false);
        try {
            // Initialize from storage first for instant UI
            await initializeFromStorage();

            // Always fetch fresh data to ensure accurate subscription status
            const data = await fetchTabData(tab);

            // Show modal if no access
            if (data && !data.hasValidSubscription) {
                setShowSubscriptionModal(true);
            } else if (!data) {
                // Fallback to status check
                const statusData = await fetchStatus();
                if (statusData) {
                    const tabAccess =
                        tab === 'purchase' ? statusData.hasPurchase :
                            tab === 'selling' ? statusData.hasSelling :
                                statusData.hasRegister;

                    if (!tabAccess) {
                        setShowSubscriptionModal(true);
                    }
                } else {
                    // No data available, show modal
                    setShowSubscriptionModal(true);
                }
            }
        } catch (error) {
            console.error('Error checking subscription:', error);
            setShowSubscriptionModal(true);
        } finally {
            setLoading(false);
            setAccessChecked(true);
        }
    }, [tab, fetchTabData, fetchStatus, initializeFromStorage]);

    // Check subscription on mount
    useEffect(() => {
        checkSubscription();
    }, [checkSubscription]);

    // Always show modal if user doesn't have access after check is complete
    useEffect(() => {
        if (accessChecked && !loading && !hasAccess) {
            setShowSubscriptionModal(true);
        }
    }, [accessChecked, loading, hasAccess]);

    // Handle modal close - redirect to home since user has no access
    const handleModalClose = useCallback(() => {
        // Don't allow closing if user doesn't have access - redirect to home
        if (!hasAccess) {
            router.replace('/(tabs)');
        }
        setShowSubscriptionModal(false);
    }, [hasAccess]);

    // Handle successful subscription purchase
    const handleSubscriptionSuccess = useCallback(async () => {
        setShowSubscriptionModal(false);

        // Clear cache and refresh
        useSubscriptionStore.getState().clearCache();
        await checkSubscription();
    }, [checkSubscription]);

    return {
        hasAccess,
        loading,
        subscription: cachedTabData?.subscription || null,
        availableSubscriptions: cachedTabData?.availableSubscriptions || [],
        expiresAt: cachedTabData?.expiresAt || null,
        refresh: checkSubscription,
        showSubscriptionModal,
        setShowSubscriptionModal,
        handleModalClose,
        handleSubscriptionSuccess,
    };
}
