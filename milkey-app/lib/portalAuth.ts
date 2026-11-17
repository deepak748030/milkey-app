import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@/lib/apiConfig';

export type PortalModule = 'collection' | 'selling';

export interface PortalModuleProfile {
    name: string;
    phone: string;
    code: string;
    address: string;
    dairyName: string;
    dairyNames: string[];
    status: string;
}

export interface PortalUser extends PortalModuleProfile {
    id: string;
    role: 'farmer_customer';
    availableModules: PortalModule[];
    moduleProfiles?: Partial<Record<PortalModule, PortalModuleProfile | null>>;
    memberSince: string | null;
}

export interface PortalSession {
    token: string;
    user: PortalUser;
}

export interface PortalApiResponse<T> {
    success: boolean;
    message?: string;
    code?: string;
    response?: T;
    status?: number;
}

export interface PortalRowBase {
    id: string;
    date: string;
    amount: number;
    status?: string;
    remark?: string;
    dairyName?: string;
}

export interface PortalEntryRow extends PortalRowBase {
    quantity: number;
    fat?: number | null;
    snf?: number | null;
    rate: number;
    bonusAmount?: number;
    bonusType?: 'perLitre' | 'percent' | '';
    bonusRate?: number;
    customerName?: string;
    farmerName?: string;
}

export interface PortalPaymentRow extends PortalRowBase {
    mode: string;
    periodStart?: string;
    periodEnd?: string;
    totalMilkAmount?: number;
    totalAdvanceDeduction?: number;
    netPayable?: number;
    closingBalance?: number;
    createdAt?: string;
}

export interface PortalAdvanceRow extends PortalRowBase {
    type: 'Given' | 'Adjusted' | 'Settled' | string;
    direction: 'up' | 'down' | string;
    remaining: number;
}

export interface PortalDashboard {
    module: PortalModule;
    availableModules: PortalModule[];
    profile: PortalUser;
    summary: {
        todayMilkQuantity: number;
        todayMilkAmount: number;
        totalMilkQuantity: number;
        totalMilkAmount: number;
        advancePending: number;
        currentBalance: number;
        status: string;
    };
    entries: PortalEntryRow[];
    payments: PortalPaymentRow[];
    advances: PortalAdvanceRow[];
    generatedAt: string;
}

const TOKEN_KEY = 'portal_token';
const USER_KEY = 'portal_user';

export const getPortalToken = async (): Promise<string | null> => {
    try {
        return await AsyncStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
};

export const getPortalSession = async (): Promise<PortalSession | null> => {
    try {
        const [token, userJson] = await Promise.all([
            AsyncStorage.getItem(TOKEN_KEY),
            AsyncStorage.getItem(USER_KEY),
        ]);
        if (!token || !userJson) return null;
        const user = JSON.parse(userJson) as PortalUser;
        if (!user?.phone || !Array.isArray(user.availableModules)) return null;
        return { token, user };
    } catch {
        return null;
    }
};

export const setPortalSession = async (token: string, user: PortalUser): Promise<void> => {
    await Promise.all([
        AsyncStorage.setItem(TOKEN_KEY, token),
        AsyncStorage.setItem(USER_KEY, JSON.stringify(user)),
    ]);
};

export const clearPortalSession = async (): Promise<void> => {
    await Promise.all([
        AsyncStorage.removeItem(TOKEN_KEY),
        AsyncStorage.removeItem(USER_KEY),
    ]);
};

const request = async <T>(
    endpoint: string,
    options: RequestInit = {},
): Promise<PortalApiResponse<T>> => {
    try {
        const token = await getPortalToken();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options.headers as Record<string, string> | undefined),
        };
        if (token) headers.Authorization = `Bearer ${token}`;

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
        });

        let data: PortalApiResponse<T> | null = null;
        try {
            data = await response.json();
        } catch {
            data = null;
        }

        if (!response.ok) {
            return {
                success: false,
                status: response.status,
                message: data?.message || 'Request failed. Please try again.',
                code: data?.code,
                response: data?.response,
            };
        }
        return data ?? { success: true, status: response.status };
    } catch (error) {
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Network error. Please check your connection.',
        };
    }
};

export const portalApi = {
    sendOtp: async (phone: string) => {
        return request<{
            delivery: 'sms' | 'test' | string;
            devOtp?: string;
            availableModules: PortalModule[];
        }>('/portal/auth/send-otp', {
            method: 'POST',
            body: JSON.stringify({ phone }),
        });
    },

    verifyOtp: async (phone: string, otp: string) => {
        return request<{ token: string; user: PortalUser }>('/portal/auth/verify-otp', {
            method: 'POST',
            body: JSON.stringify({ phone, otp }),
        });
    },

    getSession: async () => {
        return request<{ user: PortalUser }>('/portal/auth/session');
    },

    getDashboard: async (module: PortalModule) => {
        // Server expects minutes AHEAD of UTC (IST = 330).
        const tzOffsetMinutes = -new Date().getTimezoneOffset();
        const params = new URLSearchParams({
            module,
            tzOffsetMinutes: String(tzOffsetMinutes),
        });
        return request<PortalDashboard>(`/portal/dashboard?${params.toString()}`);
    },

    logout: async () => {
        const result = await request<{ loggedOut: boolean }>('/portal/auth/logout', {
            method: 'POST',
        });
        await clearPortalSession();
        return result;
    },
};

export const firstAvailablePortalModule = (user?: PortalUser | null): PortalModule => {
    if (!user?.availableModules?.length) return 'collection';
    return user.availableModules.includes('collection') ? 'collection' : user.availableModules[0];
};
