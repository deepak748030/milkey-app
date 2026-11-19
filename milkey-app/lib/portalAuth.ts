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
    milkRate?: number | null;
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
    morningQuantity?: number;
    eveningQuantity?: number;
    fat?: number | null;
    snf?: number | null;
    rate: number;
    bonusAmount?: number;
    bonusType?: 'perLitre' | 'percent' | '';
    bonusRate?: number;
    customerName?: string;
    farmerName?: string;
    shift?: string;
}

export interface PortalPaymentRow extends PortalRowBase {
    mode: string;
    customerName?: string;
    farmerName?: string;
    periodStart?: string;
    periodEnd?: string;
    totalMilkAmount?: number;
    entriesAmount?: number | null;
    extraMilkAmount?: number | null;
    totalAdvanceDeduction?: number;
    advanceEffect?: 'add' | 'subtract';
    netPayable?: number;
    closingBalance?: number;
    createdAt?: string;
}

export interface PortalAdvanceRow extends PortalRowBase {
    farmerName?: string;
    customerName?: string;
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
    advancePage?: { total: number; nextCursor: PortalAdvanceCursor | null };
    generatedAt: string;
}

export interface PortalAdvanceCursor {
    date: string;
    id: string;
}

export interface PortalCollectionEntriesResult {
    summary: { count: number; quantity: number; avgRate: number; amount: number; bonus: number };
    entries: PortalEntryRow[];
    nextCursor: PortalAdvanceCursor | null;
    dairyNames: string[];
    multipleProfiles: boolean;
}

export interface PortalCollectionPaymentsResult {
    total: number;
    payments: PortalPaymentRow[];
    nextCursor: PortalAdvanceCursor | null;
    multipleProfiles: boolean;
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

    getSellingPayments: async (cursor?: PortalAdvanceCursor) => {
        const query = cursor ? `?${new URLSearchParams({ date: cursor.date, id: cursor.id }).toString()}` : '';
        return request<PortalCollectionPaymentsResult>(`/portal/selling-payments${query}`);
    },

    getSellingEntries: async (params: { startDate?: string; endDate?: string; cursor?: PortalAdvanceCursor }) => {
        const query = new URLSearchParams();
        if (params.startDate) query.set('startDate', params.startDate);
        if (params.endDate) query.set('endDate', params.endDate);
        if (params.cursor) { query.set('date', params.cursor.date); query.set('id', params.cursor.id); }
        return request<PortalCollectionEntriesResult>(`/portal/selling-entries?${query.toString()}`);
    },

    getCollectionPayments: async (cursor?: PortalAdvanceCursor) => {
        const query = cursor ? `?${new URLSearchParams({ date: cursor.date, id: cursor.id }).toString()}` : '';
        return request<PortalCollectionPaymentsResult>(`/portal/collection-payments${query}`);
    },

    getCollectionEntries: async (params: { startDate?: string; endDate?: string; cursor?: PortalAdvanceCursor }) => {
        const query = new URLSearchParams({ tzOffsetMinutes: String(-new Date().getTimezoneOffset()) });
        if (params.startDate) query.set('startDate', params.startDate);
        if (params.endDate) query.set('endDate', params.endDate);
        if (params.cursor) { query.set('date', params.cursor.date); query.set('id', params.cursor.id); }
        return request<PortalCollectionEntriesResult>(`/portal/collection-entries?${query.toString()}`);
    },

    getAdvances: async (module: PortalModule, cursor: PortalAdvanceCursor) => {
        const params = new URLSearchParams({ module, date: cursor.date, id: cursor.id });
        return request<{ advances: PortalAdvanceRow[]; nextCursor: PortalAdvanceCursor | null }>(`/portal/advances?${params.toString()}`);
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
