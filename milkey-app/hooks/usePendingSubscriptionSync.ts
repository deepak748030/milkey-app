import { useEffect, useRef } from 'react';
import { userSubscriptionsApi } from '@/lib/milkeyApi';
import { getAuthToken } from '@/lib/authStore';
import { useSubscriptionStore } from '@/lib/subscriptionStore';

/**
 * Hook to sync pending subscriptions on app startup.
 * This handles the case where user paid but closed the app before confirmation.
 * The webhook should have activated the subscription, but this is a fallback
 * to verify with ZapUPI directly if webhook failed.
 */
export function usePendingSubscriptionSync() {
    const syncedRef = useRef(false);

    useEffect(() => {
        const syncPendingSubscriptions = async () => {
            // Only sync once per app session
            if (syncedRef.current) return;

            try {
                const token = await getAuthToken();
                if (!token) return; // Not logged in

                syncedRef.current = true;

                // Check and sync any pending subscriptions
                const result = await userSubscriptionsApi.checkPending();

                if (result.success && result.response) {
                    const { synced } = result.response;

                    // If any subscriptions were activated, refresh the subscription cache
                    const activatedCount = synced.filter(s => s.status === 'activated').length;
                    if (activatedCount > 0) {
                        console.log(`[PendingSync] Auto-activated ${activatedCount} subscription(s)`);
                        // Clear cache to force refresh
                        useSubscriptionStore.getState().clearCache();
                        await useSubscriptionStore.getState().fetchStatus();
                    }
                }
            } catch (error) {
                // Silent fail - this is a background sync
                console.log('[PendingSync] Error syncing pending subscriptions:', error);
            }
        };

        // Run sync after a short delay to not block app startup
        const timeout = setTimeout(syncPendingSubscriptions, 2000);

        return () => clearTimeout(timeout);
    }, []);
}
