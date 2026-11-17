import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@/lib/apiConfig';
import { getAuthToken } from '@/lib/authStore';

export type SellingAdvanceType = 'given' | 'adjusted';
export type SellingAdvanceStatus = 'pending' | 'partial' | 'settled';

export interface SellingAdvanceMember {
    _id: string;
    name: string;
    mobile: string;
    address?: string;
}

export interface SellingAdvance {
    _id: string;
    member: SellingAdvanceMember | string;
    owner: string;
    amount: number;
    date: string;
    note: string;
    type: SellingAdvanceType;
    status: SellingAdvanceStatus;
    settledAmount: number;
    isDeleted?: boolean;
    deletedAt?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface SellingAdvanceSummary {
    totalGiven: number;
    adjusted: number;
    pendingGiven: number;
    advancePending: number;
}

export interface SellingAdvancesResult {
    data: SellingAdvance[];
    total: number;
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
    summary: SellingAdvanceSummary;
}

interface ApiResult<T> {
    success: boolean;
    message?: string;
    code?: string;
    requiredTab?: string;
    response?: T;
    status?: number;
}

const request = async <T>(endpoint: string, options: RequestInit = {}): Promise<ApiResult<T>> => {
    try {
        const [token, deviceId] = await Promise.all([
            getAuthToken(),
            AsyncStorage.getItem('milkey_device_id').catch(() => null),
        ]);
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options.headers as Record<string, string> | undefined),
        };
        if (token) headers.Authorization = `Bearer ${token}`;
        if (deviceId) headers['X-Device-Id'] = deviceId;

        const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
        let data: ApiResult<T> | null = null;
        try {
            data = await response.json();
        } catch {
            data = null;
        }

        if (!response.ok) {
            return {
                success: false,
                status: response.status,
                message: response.status === 401
                    ? 'Session expired. Please login again.'
                    : data?.message || 'Request failed. Please try again.',
                code: data?.code,
                requiredTab: data?.requiredTab,
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

export const sellingAdvancesApi = {
    getAll: async (params?: {
        memberId?: string;
        type?: SellingAdvanceType;
        status?: 'all' | SellingAdvanceStatus;
        limit?: number;
        page?: number;
        search?: string;
        sortBy?: 'amount';
        order?: 'asc' | 'desc';
    }) => {
        const query = new URLSearchParams();
        if (params?.memberId) query.append('memberId', params.memberId);
        if (params?.type) query.append('type', params.type);
        if (params?.status) query.append('status', params.status);
        if (params?.limit) query.append('limit', String(params.limit));
        if (params?.page) query.append('page', String(params.page));
        if (params?.search) query.append('search', params.search);
        if (params?.sortBy) query.append('sortBy', params.sortBy);
        if (params?.order) query.append('order', params.order);
        const suffix = query.toString();
        return request<SellingAdvancesResult>(`/selling-advances${suffix ? `?${suffix}` : ''}`);
    },

    create: async (data: {
        memberId: string;
        amount: number;
        type: SellingAdvanceType;
        date?: string;
        note?: string;
    }) => {
        return request<SellingAdvance>('/selling-advances', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    settle: async (id: string, settledAmount?: number) => {
        return request<SellingAdvance>(`/selling-advances/${id}/settle`, {
            method: 'PUT',
            body: JSON.stringify({ settledAmount }),
        });
    },

    remove: async (id: string) => {
        return request<{ deleted: boolean }>(`/selling-advances/${id}`, {
            method: 'DELETE',
        });
    },
};

export const remainingSellingAdvance = (advance: SellingAdvance): number => {
    if (advance.type === 'adjusted' || advance.status === 'settled') return 0;
    return Math.max(0, Number(advance.amount || 0) - Number(advance.settledAmount || 0));
};
