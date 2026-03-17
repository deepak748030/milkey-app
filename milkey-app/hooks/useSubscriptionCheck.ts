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

    // Track if modal was already dismissed this session for this tab
    const [modalDismissed, setModalDismissed] = useState(false);

    const checkSubscription = useCallback(async (forceRefresh = false) => {
        setLoading(true);
        setAccessChecked(false);
        try {
            if (forceRefresh) {
                useSubscriptionStore.getState().clearCache();
            }

            // Fetch tab data (will use cache if available)
            const data = await fetchTabData(tab);

            // Only show modal if no access AND not already dismissed
            if (data && !data.hasValidSubscription && !modalDismissed) {
                setShowSubscriptionModal(true);
            } else if (!data) {
                const statusData = await fetchStatus();
                if (statusData) {
                    const tabAccess =
                        tab === 'purchase' ? statusData.hasPurchase :
                            tab === 'selling' ? statusData.hasSelling :
                                statusData.hasRegister;

                    if (!tabAccess && !modalDismissed) {
                        setShowSubscriptionModal(true);
                    }
                } else if (!modalDismissed) {
                    setShowSubscriptionModal(true);
                }
            }
        } catch (error) {
            console.error('Error checking subscription:', error);
            if (!modalDismissed) {
                setShowSubscriptionModal(true);
            }
        } finally {
            setLoading(false);
            setAccessChecked(true);
        }
    }, [tab, fetchTabData, fetchStatus, modalDismissed]);

    // Check subscription on mount only (not on every re-render)
    useEffect(() => {
        checkSubscription();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

    // Handle modal close - redirect to home since user has no access
    const handleModalClose = useCallback(() => {
        setModalDismissed(true);
        setShowSubscriptionModal(false);
        if (!hasAccess) {
            router.replace('/(tabs)');
        }
    }, [hasAccess]);

    // Handle successful subscription purchase
    const handleSubscriptionSuccess = useCallback(async () => {
        setModalDismissed(true);
        setShowSubscriptionModal(false);

        // Force refresh after purchase
        await checkSubscription(true);
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
