import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthToken } from './authStore';

// API Base URL - Update this to your server URL
const API_BASE_URL = 'http://localhost:5000/api';

export const SERVER_BASE_URL = API_BASE_URL.replace('/api', '');

// Types
export interface ApiResponse<T> {
    success: boolean;
    message?: string;
    response?: T;
}

export interface Farmer {
    _id: string;
    code: string;
    name: string;
    mobile: string;
    address: string;
    totalPurchase: number;
    totalLiters: number;
    pendingAmount: number;
    isActive: boolean;
}

export interface Advance {
    _id: string;
    farmer: { _id: string; code: string; name: string };
    amount: number;
    date: string;
    note: string;
    status: 'pending' | 'settled' | 'partial';
    settledAmount: number;
}

export interface Product {
    _id: string;
    name: string;
    price: number;
    unit: string;
    icon: string;
    description: string;
    stock: number;
    isActive: boolean;
}

export interface Order {
    _id: string;
    orderNumber: string;
    items: Array<{
        product: string;
        name: string;
        price: number;
        quantity: number;
        total: number;
    }>;
    totalAmount: number;
    status: string;
    paymentStatus: string;
    createdAt: string;
}

export interface UserStats {
    farmers: number;
    totalSales: number;
    pendingAdvances: number;
}

export interface MilkCollection {
    _id: string;
    farmer: { _id: string; code: string; name: string };
    date: string;
    shift: 'morning' | 'evening';
    quantity: number;
    fat: number;
    snf: number;
    rate: number;
    amount: number;
    isPaid: boolean;
    notes: string;
}

export interface TodaySummary {
    morning: { quantity: number; amount: number; farmers: number };
    evening: { quantity: number; amount: number; farmers: number };
    total: { quantity: number; amount: number; farmers: number };
}

export interface FarmerPaymentSummary {
    farmer: { id: string; code: string; name: string; mobile: string };
    milk: { totalQuantity: number; totalAmount: number; collections: number; periodStart: string; periodEnd: string };
    advances: { totalPending: number; count: number };
    netPayable: number;
    advanceBalance: number;
}

export interface Payment {
    _id: string;
    farmer: { _id: string; code: string; name: string };
    amount: number;
    date: string;
    paymentMethod: string;
    reference: string;
    totalMilkAmount: number;
    totalAdvanceDeduction: number;
    netPayable: number;
}

export interface ReferralData {
    code: string;
    stats: {
        totalReferrals: number;
        activeUsers: number;
        totalEarnings: number;
        pendingEarnings: number;
        commissionRate: number;
    };
    referrals: Array<{
        id: string;
        name: string;
        date: string;
        earnings: number;
        status: string;
    }>;
}

// API Request helper with auth
const apiRequest = async <T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<ApiResponse<T>> => {
    try {
        const token = await getAuthToken();

        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (token) {
            (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                success: false,
                message: data.message || 'Something went wrong',
            };
        }

        return data;
    } catch (error) {
        console.error('API Request error:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Network error',
        };
    }
};

// Farmers API
export const farmersApi = {
    getAll: async () => {
        return apiRequest<{ data: Farmer[]; count: number }>('/farmers');
    },

    getByCode: async (code: string) => {
        return apiRequest<Farmer>(`/farmers/code/${code}`);
    },

    create: async (data: { code: string; name: string; mobile: string; address?: string }) => {
        return apiRequest<Farmer>('/farmers', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    update: async (id: string, data: { name?: string; mobile?: string; address?: string }) => {
        return apiRequest<Farmer>(`/farmers/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    delete: async (id: string) => {
        return apiRequest<void>(`/farmers/${id}`, {
            method: 'DELETE',
        });
    },
};

// Advances API
export const advancesApi = {
    getAll: async (params?: { farmerId?: string; status?: string }) => {
        const queryParams = new URLSearchParams();
        if (params?.farmerId) queryParams.append('farmerId', params.farmerId);
        if (params?.status) queryParams.append('status', params.status);
        const query = queryParams.toString();

        return apiRequest<{ data: Advance[] }>(`/advances${query ? `?${query}` : ''}`);
    },

    create: async (data: { farmerCode: string; amount: number; date?: string; note?: string }) => {
        return apiRequest<Advance>('/advances', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    settle: async (id: string, settledAmount?: number) => {
        return apiRequest<Advance>(`/advances/${id}/settle`, {
            method: 'PUT',
            body: JSON.stringify({ settledAmount }),
        });
    },

    delete: async (id: string) => {
        return apiRequest<void>(`/advances/${id}`, {
            method: 'DELETE',
        });
    },
};

// Products API
export const productsApi = {
    getAll: async () => {
        return apiRequest<{ data: Product[]; count: number }>('/products');
    },

    getDefault: async () => {
        return apiRequest<{ data: Array<{ id: string; name: string; price: number; icon: string; unit: string }> }>('/products/default');
    },

    create: async (data: { name: string; price: number; unit?: string; icon?: string }) => {
        return apiRequest<Product>('/products', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    update: async (id: string, data: Partial<Product>) => {
        return apiRequest<Product>(`/products/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    delete: async (id: string) => {
        return apiRequest<void>(`/products/${id}`, {
            method: 'DELETE',
        });
    },

    seed: async () => {
        return apiRequest<{ data: Product[] }>('/products/seed', {
            method: 'POST',
        });
    },
};

// Orders API
export const ordersApi = {
    getAll: async (params?: { status?: string; page?: number; limit?: number }) => {
        const queryParams = new URLSearchParams();
        if (params?.status) queryParams.append('status', params.status);
        if (params?.page) queryParams.append('page', params.page.toString());
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        const query = queryParams.toString();

        return apiRequest<{ data: Order[] }>(`/orders${query ? `?${query}` : ''}`);
    },

    create: async (data: {
        items: Array<{ id: string; name: string; price: number; quantity: number }>;
        deliveryAddress?: string;
        notes?: string;
        paymentMethod?: string;
    }) => {
        return apiRequest<Order>('/orders', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    updateStatus: async (id: string, status: string) => {
        return apiRequest<Order>(`/orders/${id}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status }),
        });
    },

    cancel: async (id: string) => {
        return apiRequest<void>(`/orders/${id}`, {
            method: 'DELETE',
        });
    },
};

// Users API
export const usersApi = {
    getStats: async () => {
        return apiRequest<UserStats>('/users/stats');
    },

    getProfile: async () => {
        return apiRequest<any>('/users/profile');
    },

    updateProfile: async (data: { name?: string; avatar?: string }) => {
        return apiRequest<any>('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },
};

// Referrals API
export const referralsApi = {
    getData: async () => {
        return apiRequest<ReferralData>('/referrals');
    },

    validate: async (code: string) => {
        return apiRequest<{ valid: boolean; referrerName: string }>('/referrals/validate', {
            method: 'POST',
            body: JSON.stringify({ code }),
        });
    },
};

// Milk Collections API
export const milkCollectionsApi = {
    getAll: async (params?: {
        farmerCode?: string;
        date?: string;
        startDate?: string;
        endDate?: string;
        shift?: string;
        isPaid?: boolean;
        limit?: number;
        page?: number;
    }) => {
        const queryParams = new URLSearchParams();
        if (params?.farmerCode) queryParams.append('farmerCode', params.farmerCode);
        if (params?.date) queryParams.append('date', params.date);
        if (params?.startDate) queryParams.append('startDate', params.startDate);
        if (params?.endDate) queryParams.append('endDate', params.endDate);
        if (params?.shift) queryParams.append('shift', params.shift);
        if (params?.isPaid !== undefined) queryParams.append('isPaid', String(params.isPaid));
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        if (params?.page) queryParams.append('page', params.page.toString());
        const query = queryParams.toString();

        return apiRequest<{ data: MilkCollection[]; count: number; totals: { quantity: number; amount: number } }>(
            `/milk-collections${query ? `?${query}` : ''}`
        );
    },

    getTodaySummary: async () => {
        return apiRequest<TodaySummary>('/milk-collections/today');
    },

    create: async (data: {
        farmerCode: string;
        quantity: number;
        rate: number;
        date?: string;
        shift?: 'morning' | 'evening';
        fat?: number;
        snf?: number;
        notes?: string;
    }) => {
        return apiRequest<MilkCollection>('/milk-collections', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    update: async (id: string, data: Partial<{ quantity: number; rate: number; fat: number; snf: number; notes: string }>) => {
        return apiRequest<MilkCollection>(`/milk-collections/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    delete: async (id: string) => {
        return apiRequest<void>(`/milk-collections/${id}`, {
            method: 'DELETE',
        });
    },
};

// Payments API
export const paymentsApi = {
    getAll: async (params?: { farmerId?: string; startDate?: string; endDate?: string }) => {
        const queryParams = new URLSearchParams();
        if (params?.farmerId) queryParams.append('farmerId', params.farmerId);
        if (params?.startDate) queryParams.append('startDate', params.startDate);
        if (params?.endDate) queryParams.append('endDate', params.endDate);
        const query = queryParams.toString();

        return apiRequest<{ data: Payment[] }>(`/payments${query ? `?${query}` : ''}`);
    },

    getFarmerSummary: async (farmerCode: string) => {
        return apiRequest<FarmerPaymentSummary>(`/payments/farmer-summary/${farmerCode}`);
    },

    create: async (data: {
        farmerCode: string;
        amount: number;
        paymentMethod?: string;
        reference?: string;
        notes?: string;
    }) => {
        return apiRequest<Payment>('/payments', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    getById: async (id: string) => {
        return apiRequest<Payment>(`/payments/${id}`);
    },
};

// Auth API
export const authApiNew = {
    login: async (email: string, password: string) => {
        return apiRequest<{ token: string; user: any }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
    },

    register: async (data: { name: string; email: string; phone: string; password: string; referralCode?: string }) => {
        return apiRequest<{ token: string; user: any }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    logout: async () => {
        return apiRequest<void>('/auth/logout', {
            method: 'POST',
        });
    },

    getMe: async () => {
        return apiRequest<any>('/auth/me');
    },
};

// Health check
export const healthCheck = async (): Promise<boolean> => {
    try {
        const response = await fetch(`${API_BASE_URL.replace('/api', '')}/health`);
        const data = await response.json();
        return data.success === true;
    } catch {
        return false;
    }
};
