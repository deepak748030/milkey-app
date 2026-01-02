import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthToken } from './authStore';

// API Base URL - Vercel deployed server
const API_BASE_URL = 'https://milkey-app-server.vercel.app/api';
// const API_BASE_URL = 'http://localhost:5000/api'

export const SERVER_BASE_URL = API_BASE_URL.replace('/api', '');

// Types
export interface ApiResponse<T> {
    success: boolean;
    message?: string;
    response?: T;
    code?: string; // Error code like 'SUBSCRIPTION_REQUIRED'
    requiredTab?: string; // Tab that requires subscription
    isQueued?: boolean; // For subscription purchases - if queued after existing one
    startsAt?: string; // When queued subscription will start
}

export interface Farmer {
    _id: string;
    code: string;
    name: string;
    mobile: string;
    address: string;
    rate?: number;
    type: 'farmer' | 'member';
    totalPurchase: number;
    totalLiters: number;
    pendingAmount: number;
    isActive: boolean;
}

export interface Member {
    _id: string;
    name: string;
    mobile: string;
    address: string;
    ratePerLiter: number;
    totalLiters: number;
    totalAmount: number;
    pendingAmount: number;
    sellingPaymentBalance: number;
    isActive: boolean;
}

export interface SellingEntry {
    _id: string;
    member: { _id: string; name: string; mobile: string; ratePerLiter: number };
    date: string;
    morningQuantity: number;
    eveningQuantity: number;
    rate: number;
    amount: number;
    isPaid: boolean;
    notes: string;
}

export interface PurchaseFarmer {
    _id: string;
    code: string;
    name: string;
    mobile: string;
    address: string;
    totalQuantity: number;
    totalAmount: number;
    lastPurchaseDate?: string;
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
    image?: string;
    description: string;
    stock: number;
    isActive: boolean;
    subscriptionOnly?: boolean;
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
    purchaseFarmer: { _id: string; code: string; name: string; mobile: string } | null;
    farmerCode?: string;
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

export interface AdvanceItem {
    _id: string;
    amount: number;
    settledAmount: number;
    remaining: number;
    date: string;
    note: string;
    status: 'pending' | 'settled' | 'partial';
}

export interface FarmerPaymentSummary {
    farmer: { id: string; code: string; name: string; mobile: string; currentBalance?: number };
    milk: { totalQuantity: number; totalAmount: number; collections: number; periodStart: string; periodEnd: string };
    advances: { totalPending: number; count: number; items?: AdvanceItem[] };
    netPayable: number;
    closingBalance: number;
    advanceBalance?: number;
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
    closingBalance?: number;
    previousBalance?: number;
    periodStart?: string;
    periodEnd?: string;
    createdAt?: string;
}

export interface RateChart {
    _id: string;
    name: string;
    milkType: 'cow' | 'buffalo' | 'mixed';
    calculationType: 'fat_only' | 'fat_snf' | 'fixed';
    fixedRate: number;
    fatRate: number;
    snfRate: number;
    baseFat: number;
    baseSnf: number;
    baseRate: number;
    isActive: boolean;
}

export interface ReportSummary {
    totalQuantity: number;
    totalAmount: number;
    avgRate: number;
    avgFat: number;
    avgSnf: number;
    morningQty: number;
    eveningQty: number;
    farmersCount: number;
    collectionsCount: number;
}

export interface MilkReport {
    period: { startDate: string; endDate: string };
    summary: ReportSummary;
    groupedData: any[];
    details: any[];
}

export interface PaymentReport {
    period: { startDate: string; endDate: string };
    summary: {
        totalPayments: number;
        totalAmount: number;
        totalMilkAmount: number;
        totalAdvanceDeduction: number;
        farmersCount: number;
        byMethod: { cash: number; upi: number; bank: number; cheque: number };
    };
    groupedByFarmer: any[];
    details: any[];
}

export interface FarmerStatement {
    farmer: { _id: string; code: string; name: string; mobile: string };
    period: { startDate: string; endDate: string };
    summary: {
        totalMilk: number;
        totalMilkAmount: number;
        totalPayments: number;
        closingBalance: number;
        collectionsCount: number;
        paymentsCount: number;
    };
    statement: Array<{
        date: string;
        type: 'collection' | 'payment';
        description: string;
        credit: number;
        debit: number;
        balance: number;
    }>;
}

export interface Feedback {
    _id: string;
    type: 'feedback' | 'complaint' | 'suggestion' | 'query' | 'bug_report';
    subject: string;
    message: string;
    priority: 'low' | 'medium' | 'high';
    status: 'pending' | 'in_review' | 'resolved' | 'closed';
    adminResponse?: string;
    respondedAt?: string;
    createdAt: string;
}

export interface DashboardStats {
    today: { quantity: number; amount: number; count: number };
    thisMonth: { quantity: number; amount: number; count: number };
    weekPayments: { amount: number; count: number };
    totalFarmers: number;
    totalMembers: number;
}

export interface HomeStats {
    today: { quantity: number; amount: number; count: number };
    todaySell: { quantity: number; amount: number; count: number };
    totalFarmers: number;
    totalMembers: number;
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

        // Some errors return non-JSON, so guard parsing
        let data: any = null;
        try {
            data = await response.json();
        } catch {
            data = null;
        }

        if (!response.ok) {
            const serverMessage = data?.message || data?.error || 'Something went wrong';
            const message = `${serverMessage} (HTTP ${response.status})`;

            // Helpful auth hint
            if (response.status === 401) {
                return {
                    success: false,
                    message: `Session expired. Please login again. (HTTP 401)`,
                };
            }

            // Handle subscription required error
            if (response.status === 403 && data?.code === 'SUBSCRIPTION_REQUIRED') {
                return {
                    success: false,
                    message: data?.message || 'Subscription required',
                    code: 'SUBSCRIPTION_REQUIRED',
                    requiredTab: data?.requiredTab,
                };
            }

            return {
                success: false,
                message,
            };
        }

        return (data ?? { success: true, response: null }) as ApiResponse<T>;
    } catch (error) {
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Network error',
        };
    }
};

// Farmers API
export const farmersApi = {
    getAll: async (params?: { type?: 'farmer' | 'member' }) => {
        const queryParams = new URLSearchParams();
        if (params?.type) queryParams.append('type', params.type);
        const query = queryParams.toString();
        return apiRequest<{ data: Farmer[]; count: number }>(`/farmers${query ? `?${query}` : ''}`);
    },

    getByCode: async (code: string) => {
        return apiRequest<Farmer>(`/farmers/code/${code}`);
    },

    create: async (data: { code: string; name: string; mobile: string; address?: string; type?: 'farmer' | 'member' }) => {
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

// Purchase Farmers API (for Purchase tab only)
export const purchaseFarmersApi = {
    getAll: async (params?: { search?: string }) => {
        const queryParams = new URLSearchParams();
        if (params?.search) queryParams.append('search', params.search);
        const query = queryParams.toString();
        return apiRequest<{ data: PurchaseFarmer[]; count: number }>(`/purchase-farmers${query ? `?${query}` : ''}`);
    },

    getByCode: async (code: string) => {
        return apiRequest<PurchaseFarmer>(`/purchase-farmers/code/${code}`);
    },

    create: async (data: { code: string; name: string; mobile: string; address?: string }) => {
        return apiRequest<PurchaseFarmer>('/purchase-farmers', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    update: async (id: string, data: { name?: string; mobile?: string; address?: string }) => {
        return apiRequest<PurchaseFarmer>(`/purchase-farmers/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    updateStats: async (id: string, data: { quantity: number; amount: number }) => {
        return apiRequest<PurchaseFarmer>(`/purchase-farmers/${id}/stats`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    delete: async (id: string) => {
        return apiRequest<void>(`/purchase-farmers/${id}`, {
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
    getAll: async (params?: { subscribed?: boolean }) => {
        const queryParams = new URLSearchParams();
        if (params?.subscribed) queryParams.append('subscribed', 'true');
        const query = queryParams.toString();
        return apiRequest<{ data: Product[]; count: number }>(`/products${query ? `?${query}` : ''}`);
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
        purchaseFarmerId?: string;
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
    getAll: async (params?: { farmerId?: string; startDate?: string; endDate?: string; limit?: number; page?: number }) => {
        const queryParams = new URLSearchParams();
        if (params?.farmerId) queryParams.append('farmerId', params.farmerId);
        if (params?.startDate) queryParams.append('startDate', params.startDate);
        if (params?.endDate) queryParams.append('endDate', params.endDate);
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        if (params?.page) queryParams.append('page', params.page.toString());
        const query = queryParams.toString();

        return apiRequest<{ data: Payment[] }>(`/payments${query ? `?${query}` : ''}`);
    },

    getFarmerSummary: async (farmerCode: string, startDate?: string, endDate?: string) => {
        const queryParams = new URLSearchParams();
        if (startDate) queryParams.append('startDate', startDate);
        if (endDate) queryParams.append('endDate', endDate);
        const query = queryParams.toString();
        return apiRequest<FarmerPaymentSummary>(`/payments/farmer-summary/${farmerCode}${query ? `?${query}` : ''}`);
    },

    create: async (data: {
        farmerCode: string;
        amount: number;
        paymentMethod?: string;
        reference?: string;
        notes?: string;
        totalMilkAmount?: number;
        periodStart?: string;
        periodEnd?: string;
    }) => {
        return apiRequest<Payment>('/payments', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    getById: async (id: string) => {
        return apiRequest<Payment>(`/payments/${id}`);
    },

    update: async (id: string, data: {
        amount?: number;
        paymentMethod?: string;
        reference?: string;
        notes?: string;
        totalMilkAmount?: number;
        periodStart?: string;
        periodEnd?: string;
    }) => {
        return apiRequest<Payment>(`/payments/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },
};

// Rate Charts API
export const rateChartsApi = {
    getAll: async () => {
        return apiRequest<{ data: RateChart[] }>('/rate-charts');
    },

    getActive: async () => {
        return apiRequest<RateChart>('/rate-charts/active');
    },

    calculate: async (fat: number, snf: number) => {
        return apiRequest<{ rate: number; fat: number; snf: number; chartName: string }>('/rate-charts/calculate', {
            method: 'POST',
            body: JSON.stringify({ fat, snf }),
        });
    },

    create: async (data: Partial<RateChart>) => {
        return apiRequest<RateChart>('/rate-charts', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    update: async (id: string, data: Partial<RateChart>) => {
        return apiRequest<RateChart>(`/rate-charts/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    getTable: async (params?: { fatMin?: number; fatMax?: number; snfMin?: number; snfMax?: number; step?: number }) => {
        const queryParams = new URLSearchParams();
        if (params?.fatMin) queryParams.append('fatMin', params.fatMin.toString());
        if (params?.fatMax) queryParams.append('fatMax', params.fatMax.toString());
        if (params?.snfMin) queryParams.append('snfMin', params.snfMin.toString());
        if (params?.snfMax) queryParams.append('snfMax', params.snfMax.toString());
        if (params?.step) queryParams.append('step', params.step.toString());
        const query = queryParams.toString();

        return apiRequest<{ chart: RateChart; table: Array<{ fat: number; rates: Array<{ snf: number; rate: number }> }> }>(
            `/rate-charts/table${query ? `?${query}` : ''}`
        );
    },
};

// Reports API
export const reportsApi = {
    getMilkCollections: async (params: {
        startDate: string;
        endDate: string;
        farmerCode?: string;
        shift?: string;
        groupBy?: 'date' | 'farmer';
    }) => {
        const queryParams = new URLSearchParams();
        queryParams.append('startDate', params.startDate);
        queryParams.append('endDate', params.endDate);
        if (params.farmerCode) queryParams.append('farmerCode', params.farmerCode);
        if (params.shift) queryParams.append('shift', params.shift);
        if (params.groupBy) queryParams.append('groupBy', params.groupBy);

        return apiRequest<MilkReport>(`/reports/milk-collections?${queryParams.toString()}`);
    },

    getPayments: async (params: {
        startDate: string;
        endDate: string;
        farmerCode?: string;
        paymentMethod?: string;
    }) => {
        const queryParams = new URLSearchParams();
        queryParams.append('startDate', params.startDate);
        queryParams.append('endDate', params.endDate);
        if (params.farmerCode) queryParams.append('farmerCode', params.farmerCode);
        if (params.paymentMethod) queryParams.append('paymentMethod', params.paymentMethod);

        return apiRequest<PaymentReport>(`/reports/payments?${queryParams.toString()}`);
    },

    getFarmerStatement: async (farmerCode: string, startDate?: string, endDate?: string) => {
        const queryParams = new URLSearchParams();
        if (startDate) queryParams.append('startDate', startDate);
        if (endDate) queryParams.append('endDate', endDate);
        const query = queryParams.toString();

        return apiRequest<FarmerStatement>(`/reports/farmer-statement/${farmerCode}${query ? `?${query}` : ''}`);
    },

    getDashboard: async (params?: { farmerType?: 'farmer' | 'member' }) => {
        const queryParams = new URLSearchParams();
        if (params?.farmerType) queryParams.append('farmerType', params.farmerType);
        const query = queryParams.toString();
        return apiRequest<DashboardStats>(`/reports/dashboard${query ? `?${query}` : ''}`);
    },

    getHomeStats: async () => {
        return apiRequest<HomeStats>('/reports/home-stats');
    },

    getAnalytics: async (params?: { period?: string; days?: number }) => {
        const queryParams = new URLSearchParams();
        if (params?.period) queryParams.append('period', params.period);
        if (params?.days) queryParams.append('days', params.days.toString());
        const query = queryParams.toString();

        return apiRequest<{
            period: { startDate: string; endDate: string };
            chartData: Array<{
                date: string;
                label: string;
                quantity: number;
                amount: number;
                morningQty: number;
                eveningQty: number;
                payments: number;
            }>;
            totals: {
                totalQuantity: number;
                totalAmount: number;
                totalPayments: number;
                avgDailyQty: number;
                maxQty: number;
                minQty: number;
            };
        }>(`/reports/analytics${query ? `?${query}` : ''}`);
    },

    getTopFarmers: async (params?: { days?: number; limit?: number }) => {
        const queryParams = new URLSearchParams();
        if (params?.days) queryParams.append('days', params.days.toString());
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        const query = queryParams.toString();

        return apiRequest<Array<{
            farmer: { _id: string; code: string; name: string };
            totalQuantity: number;
            totalAmount: number;
            collections: number;
            avgRate: number;
        }>>(`/reports/top-farmers${query ? `?${query}` : ''}`);
    },
};

// Feedback API
export const feedbackApi = {
    getMyFeedbacks: async () => {
        return apiRequest<{ data: Feedback[] }>('/feedback/my');
    },

    submit: async (data: {
        type: string;
        subject: string;
        message: string;
        priority?: string
    }) => {
        return apiRequest<Feedback>('/feedback', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    getById: async (id: string) => {
        return apiRequest<Feedback>(`/feedback/${id}`);
    },

    // Admin endpoints
    getAll: async (params?: { status?: string; type?: string; page?: number; limit?: number }) => {
        const queryParams = new URLSearchParams();
        if (params?.status) queryParams.append('status', params.status);
        if (params?.type) queryParams.append('type', params.type);
        if (params?.page) queryParams.append('page', params.page.toString());
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        const query = queryParams.toString();

        return apiRequest<{ data: Feedback[]; total: number; page: number; pages: number }>(
            `/feedback${query ? `?${query}` : ''}`
        );
    },

    getStats: async () => {
        return apiRequest<{ total: number; pending: number; inReview: number; resolved: number; byType: any }>(
            '/feedback/stats'
        );
    },

    updateStatus: async (id: string, status: string, adminResponse?: string) => {
        return apiRequest<Feedback>(`/feedback/${id}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status, adminResponse }),
        });
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

    register: async (data: { name: string; email: string; phone: string; password: string; address?: string; referralCode?: string }) => {
        return apiRequest<{ token: string; user: any }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    sendOtp: async (email: string) => {
        return apiRequest<{ message: string }>('/auth/send-otp', {
            method: 'POST',
            body: JSON.stringify({ email }),
        });
    },

    verifyOtp: async (email: string, otp: string) => {
        return apiRequest<{ verified: boolean }>('/auth/verify-otp', {
            method: 'POST',
            body: JSON.stringify({ email, otp }),
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

    forgotPassword: async (email: string) => {
        return apiRequest<{ message: string }>('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email }),
        });
    },

    verifyForgotPasswordOtp: async (email: string, otp: string) => {
        return apiRequest<{ verified: boolean; resetToken: string }>('/auth/verify-forgot-otp', {
            method: 'POST',
            body: JSON.stringify({ email, otp }),
        });
    },

    resetPassword: async (email: string, resetToken: string, newPassword: string) => {
        return apiRequest<{ message: string }>('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ email, resetToken, newPassword }),
        });
    },

    updatePushToken: async (expoPushToken: string) => {
        return apiRequest<{ message: string }>('/auth/push-token', {
            method: 'PUT',
            body: JSON.stringify({ expoPushToken }),
        });
    },

    updateProfile: async (data: { name?: string; avatar?: string; address?: string }) => {
        return apiRequest<any>('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },
};

// Custom Forms API
export interface CustomForm {
    _id: string;
    formName: string;
    fields: { label: string; value: string }[];
    status: 'pending' | 'reviewed' | 'approved' | 'rejected';
    adminNotes?: string;
    createdAt: string;
    user?: { _id: string; name: string; email: string; phone: string };
}

export const customFormsApi = {
    getAll: async (params?: { page?: number; limit?: number }) => {
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.append('page', params.page.toString());
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        const query = queryParams.toString();
        return apiRequest<{ data: CustomForm[]; count: number; hasMore: boolean }>(
            `/custom-forms${query ? `?${query}` : ''}`
        );
    },

    getAdminForms: async (params?: { page?: number; limit?: number; status?: string }) => {
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.append('page', params.page.toString());
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        if (params?.status) queryParams.append('status', params.status);
        const query = queryParams.toString();
        return apiRequest<{ data: CustomForm[]; count: number; hasMore: boolean }>(
            `/custom-forms/admin${query ? `?${query}` : ''}`
        );
    },

    create: async (data: { formName: string; fields: { label: string; value: string }[] }) => {
        return apiRequest<CustomForm>('/custom-forms', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    updateStatus: async (id: string, data: { status: string; adminNotes?: string }) => {
        return apiRequest<CustomForm>(`/custom-forms/${id}/status`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    delete: async (id: string) => {
        return apiRequest<void>(`/custom-forms/${id}`, {
            method: 'DELETE',
        });
    },
};

// Balance Report types
export interface MemberBalanceReport {
    _id: string;
    name: string;
    mobile: string;
    ratePerLiter: number;
    currentBalance: number;
    unpaidAmount: number;
    totalBalance: number;
    unpaidEntriesCount: number;
    unpaidQuantity: number;
    date: string;
    lastPaymentDate: string | null;
    lastPeriodEnd: string | null;
}

export interface BalanceReportSummary {
    totalMembers: number;
    totalReceivable: number;
    totalPayable: number;
    netBalance: number;
    totalUnpaidAmount: number;
    totalUnpaidQuantity: number;
}

// Members API (for Selling tab)
export const membersApi = {
    getAll: async (params?: { search?: string }) => {
        const queryParams = new URLSearchParams();
        if (params?.search) queryParams.append('search', params.search);
        const query = queryParams.toString();
        return apiRequest<{ data: Member[]; count: number }>(`/members${query ? `?${query}` : ''}`);
    },

    getById: async (id: string) => {
        return apiRequest<Member>(`/members/${id}`);
    },

    getBalanceReport: async () => {
        return apiRequest<{ data: MemberBalanceReport[]; summary: BalanceReportSummary }>('/members/balance-report');
    },

    create: async (data: { name: string; mobile: string; address?: string; ratePerLiter: number }) => {
        return apiRequest<Member>('/members', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    update: async (id: string, data: { name?: string; mobile?: string; address?: string; ratePerLiter?: number }) => {
        return apiRequest<Member>(`/members/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    delete: async (id: string) => {
        return apiRequest<void>(`/members/${id}`, {
            method: 'DELETE',
        });
    },
};

// Selling Entries API (for Selling tab)
export const sellingEntriesApi = {
    getAll: async (params?: { memberId?: string; startDate?: string; endDate?: string; limit?: number; page?: number }) => {
        const queryParams = new URLSearchParams();
        if (params?.memberId) queryParams.append('memberId', params.memberId);
        if (params?.startDate) queryParams.append('startDate', params.startDate);
        if (params?.endDate) queryParams.append('endDate', params.endDate);
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        if (params?.page) queryParams.append('page', params.page.toString());
        const query = queryParams.toString();

        return apiRequest<{ data: SellingEntry[]; count: number; total: number; page: number; pages: number }>(
            `/selling-entries${query ? `?${query}` : ''}`
        );
    },

    create: async (data: {
        memberId: string;
        rate: number;
        date?: string;
        notes?: string;
        morningQuantity?: number;
        eveningQuantity?: number;
    }) => {
        return apiRequest<SellingEntry>('/selling-entries', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    delete: async (id: string) => {
        return apiRequest<void>(`/selling-entries/${id}`, {
            method: 'DELETE',
        });
    },
};

// Member Payment Summary interface
export interface MemberPaymentSummary {
    member: { id: string; name: string; mobile: string; currentBalance: number };
    selling: { totalLiters: number; totalAmount: number; unpaidAmount?: number };
    netPayable: number;
    closingBalance: number;
}

// Member Payment interface
export interface MemberPayment {
    _id: string;
    member: { _id: string; name: string; mobile: string };
    amount: number;
    date: string;
    paymentMethod: string;
    reference: string;
    totalSellAmount: number;
    totalQuantity?: number;
    milkRate?: number;
    netPayable: number;
    closingBalance?: number;
    previousBalance?: number;
    periodStart?: string;
    periodEnd?: string;
    createdAt?: string;
}

// Member Payments API (for Selling tab)
export const memberPaymentsApi = {
    getAll: async (params?: { memberId?: string; startDate?: string; endDate?: string; limit?: number; page?: number }) => {
        const queryParams = new URLSearchParams();
        if (params?.memberId) queryParams.append('memberId', params.memberId);
        if (params?.startDate) queryParams.append('startDate', params.startDate);
        if (params?.endDate) queryParams.append('endDate', params.endDate);
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        if (params?.page) queryParams.append('page', params.page.toString());
        const query = queryParams.toString();

        return apiRequest<{ data: MemberPayment[] }>(`/member-payments${query ? `?${query}` : ''}`);
    },

    getMemberSummary: async (memberId: string, params?: { startDate?: string; endDate?: string }) => {
        const queryParams = new URLSearchParams();
        if (params?.startDate) queryParams.append('startDate', params.startDate);
        if (params?.endDate) queryParams.append('endDate', params.endDate);
        const query = queryParams.toString();
        return apiRequest<MemberPaymentSummary>(`/member-payments/member-summary/${memberId}${query ? `?${query}` : ''}`);
    },

    create: async (data: {
        memberId: string;
        amount: number;
        milkAmount?: number;
        paymentMethod?: string;
        reference?: string;
        notes?: string;
        periodStart?: string;
        periodEnd?: string;
        totalQuantity?: number;
        milkRate?: number;
    }) => {
        return apiRequest<MemberPayment>('/member-payments', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    getById: async (id: string) => {
        return apiRequest<MemberPayment>(`/member-payments/${id}`);
    },
};

export const healthCheck = async (): Promise<boolean> => {
    try {
        const response = await fetch(`${API_BASE_URL.replace('/api', '')}/health`);
        const data = await response.json();
        return data.success === true;
    } catch {
        return false;
    }
};

// Subscription types
export interface Subscription {
    _id: string;
    name: string;
    amount: number;
    durationMonths: number;
    durationDays?: number;
    durationType?: 'days' | 'months' | 'years';
    durationValue?: number;
    applicableTabs: ('purchase' | 'selling' | 'register')[];
    subscriptionType: 'single' | 'combined' | 'free';
    isFree: boolean;
    forNewUsers: boolean;
    description: string;
    isActive: boolean;
    isPurchased?: boolean;
}

// Helper function to format subscription duration
export const formatSubscriptionDuration = (sub: Subscription): string => {
    // Use stored durationType and durationValue if available
    if (sub.durationType && sub.durationValue) {
        const value = sub.durationValue;
        switch (sub.durationType) {
            case 'days':
                return value === 1 ? '1 Day' : `${value} Days`;
            case 'months':
                return value === 1 ? '1 Month' : `${value} Months`;
            case 'years':
                return value === 1 ? '1 Year' : `${value} Years`;
        }
    }

    // Fallback to calculating from durationDays
    const days = sub.durationDays || (sub.durationMonths ? sub.durationMonths * 30 : 30);
    if (days >= 365 && days % 365 === 0) {
        const years = days / 365;
        return years === 1 ? '1 Year' : `${years} Years`;
    }
    if (days >= 30 && days % 30 === 0) {
        const months = days / 30;
        return months === 1 ? '1 Month' : `${months} Months`;
    }
    return days === 1 ? '1 Day' : `${days} Days`;
};

export interface UserSubscription {
    _id: string;
    user: string;
    subscription: Subscription;
    applicableTabs: ('purchase' | 'selling' | 'register')[];
    startDate: string;
    endDate: string;
    amount: number;
    isFree: boolean;
    paymentStatus: 'pending' | 'completed' | 'failed';
    paymentMethod: string;
    isActive: boolean;
}

export interface SubscriptionStatus {
    hasAnySubscription: boolean;
    activeCount: number;
    coveredTabs: string[];
    hasPurchase: boolean;
    hasSelling: boolean;
    hasRegister: boolean;
    subscriptions: UserSubscription[];
}

export interface TabSubscriptionCheck {
    hasValidSubscription: boolean;
    subscription: UserSubscription | null;
    availableSubscriptions: Subscription[];
    expiresAt: string | null;
}

// User Subscriptions API
export const userSubscriptionsApi = {
    getAvailable: async () => {
        return apiRequest<{
            subscriptions: Subscription[];
            isNewUser: boolean;
            hasActiveSubscription: boolean;
        }>('/user-subscriptions/available');
    },

    getMy: async () => {
        return apiRequest<{
            active: UserSubscription[];
            expired: UserSubscription[];
            all: UserSubscription[];
        }>('/user-subscriptions/my');
    },

    checkTab: async (tab: 'purchase' | 'selling' | 'register') => {
        return apiRequest<TabSubscriptionCheck>(`/user-subscriptions/check/${tab}`);
    },

    purchase: async (data: {
        subscriptionId: string;
        paymentMethod?: string;
        transactionId?: string;
        referralCode?: string;
    }) => {
        return apiRequest<UserSubscription>('/user-subscriptions/purchase', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    getStatus: async () => {
        return apiRequest<SubscriptionStatus>('/user-subscriptions/status');
    },
};

// Banner types
export interface Banner {
    _id: string;
    title: string;
    image: string;
    badge?: string;
    type?: 'event' | 'category';
    order?: number;
    isActive?: boolean;
}

// Banners API
export const bannersApi = {
    getAll: async () => {
        const res = await apiRequest<any>('/products/banners');

        if (!res.success) {
            return res as ApiResponse<Banner[]>;
        }

        const raw = (res as any).response;
        const banners: Banner[] = Array.isArray(raw)
            ? raw
            : Array.isArray(raw?.data)
                ? raw.data
                : [];

        return { ...res, response: banners } as ApiResponse<Banner[]>;
    },
};

// Notification type
export interface Notification {
    _id: string;
    id?: string;
    title: string;
    message: string;
    type: string;
    read: boolean;
    data?: any;
    createdAt: string;
    timestamp?: string;
}

// Notifications API
export const notificationsApiNew = {
    getAll: async (params?: { page?: number; limit?: number }) => {
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.append('page', params.page.toString());
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        const query = queryParams.toString();
        return apiRequest<{ data: Notification[]; unreadCount: number; pagination: { page: number; limit: number; total: number; pages: number } }>(
            `/notifications${query ? `?${query}` : ''}`
        );
    },

    getUnreadCount: async () => {
        return apiRequest<{ count: number }>('/notifications/unread-count');
    },

    markAsRead: async (id: string) => {
        return apiRequest<{ message: string }>(`/notifications/${id}/read`, {
            method: 'PUT',
        });
    },

    markAllAsRead: async () => {
        return apiRequest<{ message: string }>('/notifications/read-all', {
            method: 'PUT',
        });
    },

    delete: async (id: string) => {
        return apiRequest<void>(`/notifications/${id}`, {
            method: 'DELETE',
        });
    },

    clearAll: async () => {
        return apiRequest<void>('/notifications/clear-all', {
            method: 'DELETE',
        });
    },
};

// Withdrawal types
export interface Withdrawal {
    _id: string;
    user: string;
    amount: number;
    paymentMethod: 'upi' | 'bank';
    upiId?: string;
    bankDetails?: {
        accountNumber: string;
        ifscCode: string;
        accountHolderName: string;
        bankName?: string;
    };
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    adminNote?: string;
    processedAt?: string;
    createdAt: string;
}

export interface WithdrawalData {
    balance: number;
    totalWithdrawn: number;
    pendingWithdrawals: number;
    withdrawals: Withdrawal[];
}

// Withdrawals API
export const withdrawalsApi = {
    getData: async () => {
        return apiRequest<WithdrawalData>('/withdrawals');
    },

    create: async (data: {
        amount: number;
        paymentMethod: 'upi' | 'bank';
        upiId?: string;
        bankDetails?: {
            accountNumber: string;
            ifscCode: string;
            accountHolderName: string;
            bankName?: string;
        };
    }) => {
        return apiRequest<Withdrawal>('/withdrawals', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
};
