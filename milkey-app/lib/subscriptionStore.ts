import AsyncStorage from '@react-native-async-storage/async-storage';

const SUBSCRIPTION_MODAL_SHOWN_KEY = '@milkey_subscription_modal_shown';
const SUBSCRIPTION_MODAL_SESSION_KEY = '@milkey_subscription_session';

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

        const lastShownDate = new Date(lastShown);
        const now = new Date();

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

// Store subscription status for quick access
export const getStoredSubscriptionStatus = async (): Promise<{
    hasPurchase: boolean;
    hasSelling: boolean;
    hasRegister: boolean;
} | null> => {
    try {
        const data = await AsyncStorage.getItem('@milkey_subscription_status');
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
        await AsyncStorage.setItem('@milkey_subscription_status', JSON.stringify(status));
    } catch (error) {
        console.error('Failed to store subscription status:', error);
    }
};
