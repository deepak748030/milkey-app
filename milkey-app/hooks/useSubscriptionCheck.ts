import { useState, useEffect, useCallback } from 'react';
import { userSubscriptionsApi, TabSubscriptionCheck, Subscription } from '@/lib/milkeyApi';
import { getStoredSubscriptionStatus, storeSubscriptionStatus } from '@/lib/subscriptionStore';

export interface UseSubscriptionCheckResult {
    hasAccess: boolean;
    loading: boolean;
    subscription: TabSubscriptionCheck['subscription'] | null;
    availableSubscriptions: Subscription[];
    expiresAt: string | null;
    refresh: () => Promise<void>;
    showSubscriptionModal: boolean;
    setShowSubscriptionModal: (show: boolean) => void;
}

export function useSubscriptionCheck(tab: 'purchase' | 'selling' | 'register'): UseSubscriptionCheckResult {
    const [hasAccess, setHasAccess] = useState(true); // Default to true to avoid flicker
    const [loading, setLoading] = useState(true);
    const [subscription, setSubscription] = useState<TabSubscriptionCheck['subscription'] | null>(null);
    const [availableSubscriptions, setAvailableSubscriptions] = useState<Subscription[]>([]);
    const [expiresAt, setExpiresAt] = useState<string | null>(null);
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

    const checkSubscription = useCallback(async () => {
        setLoading(true);
        try {
            // First check cached status for quick response
            const cached = await getStoredSubscriptionStatus();
            if (cached) {
                const cachedAccess = tab === 'purchase' ? cached.hasPurchase :
                    tab === 'selling' ? cached.hasSelling :
                        cached.hasRegister;
                setHasAccess(cachedAccess);
            }

            // Then fetch from API for accurate data
            const res = await userSubscriptionsApi.checkTab(tab);
            if (res.success && res.response) {
                setHasAccess(res.response.hasValidSubscription);
                setSubscription(res.response.subscription);
                setAvailableSubscriptions(res.response.availableSubscriptions);
                setExpiresAt(res.response.expiresAt);

                // Update cached status
                const statusRes = await userSubscriptionsApi.getStatus();
                if (statusRes.success && statusRes.response) {
                    await storeSubscriptionStatus({
                        hasPurchase: statusRes.response.hasPurchase,
                        hasSelling: statusRes.response.hasSelling,
                        hasRegister: statusRes.response.hasRegister,
                    });
                }

                // Show modal if no access
                if (!res.response.hasValidSubscription) {
                    setShowSubscriptionModal(true);
                }
            }
        } catch (error) {
            console.error('Error checking subscription:', error);
            // On error, default to showing access (graceful degradation)
            setHasAccess(true);
        } finally {
            setLoading(false);
        }
    }, [tab]);

    useEffect(() => {
        checkSubscription();
    }, [checkSubscription]);

    return {
        hasAccess,
        loading,
        subscription,
        availableSubscriptions,
        expiresAt,
        refresh: checkSubscription,
        showSubscriptionModal,
        setShowSubscriptionModal,
    };
}
