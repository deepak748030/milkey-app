import AsyncStorage from '@react-native-async-storage/async-storage';

// Auth Store for managing authentication state across the app
export interface AuthUser {
    id: string;
    name: string;
    email: string;
    phone: string;
    avatar: string;
    address: string;
    role: string;
    referralCode: string;
    memberSince: string;
}

type AuthListener = (user: AuthUser | null, isLoading: boolean) => void;

let currentUser: AuthUser | null = null;
let isLoading = true;
let listeners: AuthListener[] = [];

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

// Notify all listeners of state change
const notifyListeners = () => {
    listeners.forEach(listener => listener(currentUser, isLoading));
};

// Initialize auth state from storage
export const initializeAuth = async (): Promise<AuthUser | null> => {
    try {
        const [token, userStr] = await Promise.all([
            AsyncStorage.getItem(TOKEN_KEY),
            AsyncStorage.getItem(USER_KEY)
        ]);

        if (token && userStr) {
            currentUser = JSON.parse(userStr);
        } else {
            currentUser = null;
        }
    } catch (error) {
        console.error('Error initializing auth:', error);
        currentUser = null;
    }

    isLoading = false;
    notifyListeners();
    return currentUser;
};

// Get current user
export const getCurrentUser = (): AuthUser | null => currentUser;

// Check if user is authenticated
export const isAuthenticated = (): boolean => !!currentUser;

// Check if auth is still loading
export const isAuthLoading = (): boolean => isLoading;

// Set user after login/register
export const setAuthUser = async (token: string, user: AuthUser): Promise<void> => {
    try {
        await Promise.all([
            AsyncStorage.setItem(TOKEN_KEY, token),
            AsyncStorage.setItem(USER_KEY, JSON.stringify(user))
        ]);
        // Register the freshly authenticated device before screens issue data requests.
        // A logged-out device is otherwise rejected by the server until reactivated.
        const { registerCurrentDevice, renewDeviceIdAfterLogin } = await import('./device');
        let device = await registerCurrentDevice();
        // Older servers cannot reactivate an inactive device, even after a valid
        // OTP/Google login. Start a new device session only in that case.
        if (!device.success && device.code === 'DEVICE_LOGGED_OUT') {
            await renewDeviceIdAfterLogin();
            device = await registerCurrentDevice();
        }
        if (!device.success && device.status !== 404) {
            await Promise.all([AsyncStorage.removeItem(TOKEN_KEY), AsyncStorage.removeItem(USER_KEY)]);
            throw new Error(device.message || 'Device registration failed. Please try again.');
        }
        currentUser = user;
        isLoading = false;
        notifyListeners();
    } catch (error) {
        console.error('Error setting auth user:', error);
        throw error;
    }
};

// Update user profile
export const updateAuthUser = async (updates: Partial<AuthUser>): Promise<void> => {
    if (!currentUser) return;

    try {
        currentUser = { ...currentUser, ...updates };
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(currentUser));
        notifyListeners();
    } catch (error) {
        console.error('Error updating auth user:', error);
    }
};

// Clear auth state (logout)
export const clearAuth = async (): Promise<void> => {
    try {
        await Promise.all([
            AsyncStorage.removeItem(TOKEN_KEY),
            AsyncStorage.removeItem(USER_KEY)
        ]);
        currentUser = null;
        notifyListeners();
    } catch (error) {
        console.error('Error clearing auth:', error);
    }
};

// Get token
export const getAuthToken = async (): Promise<string | null> => {
    try {
        return await AsyncStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
};

// Subscribe to auth changes
export const subscribeToAuth = (listener: AuthListener): (() => void) => {
    listeners.push(listener);
    // Immediately call with current state
    listener(currentUser, isLoading);

    return () => {
        listeners = listeners.filter(l => l !== listener);
    };
};
