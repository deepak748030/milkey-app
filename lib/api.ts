import AsyncStorage from '@react-native-async-storage/async-storage';

// API Base URL - Change this to your server URL
// const API_BASE_URL = 'http://localhost:5000/api';
// const API_BASE_URL = 'https://planify-app-server.vercel.app/api';
const API_BASE_URL = 'https://milkey-app-server.vercel.app/api';

// Server Base URL (without /api) for constructing image URLs
export const SERVER_BASE_URL = API_BASE_URL.replace('/api', '');

// Helper function to get full image URL from path
export const getImageUrl = (imagePath: string | undefined | null): string => {
    if (!imagePath) return '';

    // If already a full URL, return as is
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        return imagePath;
    }

    // If it's a path, construct full URL
    if (imagePath.startsWith('/')) {
        return `${SERVER_BASE_URL}${imagePath}`;
    }

    // Otherwise add leading slash and construct URL
    return `${SERVER_BASE_URL}/${imagePath}`;
};

// Token storage keys
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

// Types
export interface ApiResponse<T> {
    success: boolean;
    message?: string;
    request?: any;
    response?: T;
}

export interface AuthUser {
    id: string;
    name: string;
    email: string;
    phone: string;
    avatar: string;
    isBlocked: boolean;
    memberSince: string;
}

export interface LoginResponse {
    token: string;
    user: AuthUser;
}

// Get stored token
export const getToken = async (): Promise<string | null> => {
    try {
        return await AsyncStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
};

// Store token
export const setToken = async (token: string): Promise<void> => {
    try {
        await AsyncStorage.setItem(TOKEN_KEY, token);
    } catch (error) {
        console.error('Error storing token:', error);
    }
};

// Remove token
export const removeToken = async (): Promise<void> => {
    try {
        await AsyncStorage.removeItem(TOKEN_KEY);
    } catch (error) {
        console.error('Error removing token:', error);
    }
};

// Get stored user
export const getStoredUser = async (): Promise<AuthUser | null> => {
    try {
        const user = await AsyncStorage.getItem(USER_KEY);
        return user ? JSON.parse(user) : null;
    } catch {
        return null;
    }
};

// Store user
export const setStoredUser = async (user: AuthUser): Promise<void> => {
    try {
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (error) {
        console.error('Error storing user:', error);
    }
};

// Remove user
export const removeStoredUser = async (): Promise<void> => {
    try {
        await AsyncStorage.removeItem(USER_KEY);
    } catch (error) {
        console.error('Error removing user:', error);
    }
};

// API Request helper
const apiRequest = async <T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<ApiResponse<T>> => {
    try {
        const token = await getToken();

        // Debug logging
        console.log(`API Request: ${options.method || 'GET'} ${endpoint}`);
        console.log(`Token present: ${token ? 'Yes' : 'No'}`);

        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (token) {
            (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
            console.log('Authorization header added');
        } else {
            console.log('No token - Authorization header NOT added');
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
        });

        const data = await response.json();
        console.log(`API Response: ${response.status} - ${data.success ? 'Success' : data.message}`);

        if (!response.ok) {
            return {
                success: false,
                message: data.message || 'Something went wrong',
                request: data.request,
                response: null as any,
            };
        }

        return data;
    } catch (error) {
        console.error('API Request error:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Network error. Please check your connection.',
            response: null as any,
        };
    }
};

// Auth API calls
export const authApi = {
    // Register new user
    register: async (data: { name: string; email: string; phone: string; avatar?: string }) => {
        return apiRequest<{ phone: string; isNewUser: boolean }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    // Login existing user
    login: async (phone: string) => {
        return apiRequest<{ phone: string; isNewUser: boolean; isBlocked: boolean }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ phone }),
        });
    },

    // Verify OTP
    verifyOtp: async (phone: string, otp: string, expoPushToken?: string) => {
        const result = await apiRequest<LoginResponse>('/auth/verify-otp', {
            method: 'POST',
            body: JSON.stringify({ phone, otp, expoPushToken }),
        });

        // Store token and user on successful verification
        if (result.success && result.response) {
            await setToken(result.response.token);
            await setStoredUser(result.response.user);
        }

        return result;
    },

    // Resend OTP
    resendOtp: async (phone: string) => {
        return apiRequest<{ phone: string; otpSent: boolean }>('/auth/resend-otp', {
            method: 'POST',
            body: JSON.stringify({ phone }),
        });
    },

    // Get current user profile
    getMe: async () => {
        return apiRequest<AuthUser>('/auth/me', {
            method: 'GET',
        });
    },

    // Update profile
    updateProfile: async (data: { name?: string; email?: string; avatar?: string }) => {
        const result = await apiRequest<AuthUser>('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify(data),
        });

        // Update stored user on success
        if (result.success && result.response) {
            await setStoredUser(result.response);
        }

        return result;
    },

    // Update push token
    updatePushToken: async (expoPushToken: string) => {
        return apiRequest<{ tokenUpdated: boolean; isBlocked: boolean }>('/auth/push-token', {
            method: 'PUT',
            body: JSON.stringify({ expoPushToken }),
        });
    },

    // Logout
    logout: async () => {
        const result = await apiRequest<{ loggedOut: boolean }>('/auth/logout', {
            method: 'POST',
        });

        // Clear stored data
        await removeToken();
        await removeStoredUser();

        return result;
    },
};



// Category type
export interface Category {
    _id: string;
    name: string;
    slug: string;
    description: string;
    isActive: boolean;
    order: number;
}

// Event Vendor type (for API responses)
export interface EventVendor {
    _id: string;
    name: string;
    avatar: string;
    rating: number;
    phone?: string;
    email?: string;
    businessName?: string;
    experience?: string;
    experienceYears?: number;
}

// Minimal event type for listings (home/search screens)
export interface MinimalServerEvent {
    _id: string;
    title: string;
    image: string;
    location: string;
    price: number;
    mrp?: number;
    rating: number;
    reviews: number;
    badge?: string;
}

// Full Event type (from server)
export interface ServerEvent {
    _id: string;
    title: string;
    description: string;
    category: string;
    image: string;
    images: string[];
    date: string;
    time: string;
    location: string;
    fullLocation: string;
    price: number;
    mrp: number;
    badge?: string;
    services: string[];
    rating: number;
    reviews: number;
    isFeatured: boolean;
    isActive: boolean;
    vendor: EventVendor;
    createdAt: string;
    updatedAt: string;
}

// Pagination type
export interface Pagination {
    page: number;
    limit: number;
    total: number;
    pages: number;
}

// Events API calls
export const eventsApi = {
    // Get all events with minimal fields for listings (home/search screens)
    getAll: async (params?: {
        category?: string;
        city?: string;
        minPrice?: number;
        maxPrice?: number;
        search?: string;
        featured?: boolean;
        minRating?: number;
        sortBy?: 'price_asc' | 'price_desc' | 'rating_desc' | 'newest';
        page?: number;
        limit?: number;
        fields?: 'minimal' | 'full';
    }) => {
        const queryParams = new URLSearchParams();
        if (params?.category) queryParams.append('category', params.category);
        if (params?.city) queryParams.append('city', params.city);
        if (params?.minPrice) queryParams.append('minPrice', params.minPrice.toString());
        if (params?.maxPrice) queryParams.append('maxPrice', params.maxPrice.toString());
        if (params?.search) queryParams.append('search', params.search);
        if (params?.featured) queryParams.append('featured', 'true');
        if (params?.minRating) queryParams.append('minRating', params.minRating.toString());
        if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
        if (params?.page) queryParams.append('page', params.page.toString());
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        if (params?.fields) queryParams.append('fields', params.fields);

        const queryString = queryParams.toString();
        return apiRequest<{ data: MinimalServerEvent[]; pagination: Pagination }>(`/events${queryString ? `?${queryString}` : ''}`, {
            method: 'GET',
        });
    },

    // Get single event with full details
    getById: async (id: string) => {
        return apiRequest<ServerEvent>(`/events/${id}`, {
            method: 'GET',
        });
    },

    // Get featured events
    getFeatured: async () => {
        return apiRequest<ServerEvent[]>('/events/featured', {
            method: 'GET',
        });
    },

    // Get events by category
    getByCategory: async (category: string, page?: number, limit?: number) => {
        const queryParams = new URLSearchParams();
        if (page) queryParams.append('page', page.toString());
        if (limit) queryParams.append('limit', limit.toString());

        const queryString = queryParams.toString();
        return apiRequest<{ data: ServerEvent[]; pagination: Pagination }>(`/events/category/${encodeURIComponent(category)}${queryString ? `?${queryString}` : ''}`, {
            method: 'GET',
        });
    },

    // Search events
    search: async (query: string, page?: number, limit?: number) => {
        const queryParams = new URLSearchParams();
        queryParams.append('q', query);
        if (page) queryParams.append('page', page.toString());
        if (limit) queryParams.append('limit', limit.toString());

        return apiRequest<{ data: ServerEvent[]; query: string; pagination: Pagination }>(`/events/search?${queryParams.toString()}`, {
            method: 'GET',
        });
    },
};

// Categories API calls
export const categoriesApi = {
    // Get all categories
    getAll: async () => {
        return apiRequest<Category[]>('/categories', {
            method: 'GET',
        });
    },

    // Get category by slug
    getBySlug: async (slug: string) => {
        return apiRequest<Category>(`/categories/${slug}`, {
            method: 'GET',
        });
    },

    // Seed default categories (call once)
    seed: async () => {
        return apiRequest<Category[]>('/categories/seed', {
            method: 'POST',
        });
    },
};

// Banner types
export interface ServerBanner {
    _id: string;
    title: string;
    image: string;
    badge: string;
    type: 'event' | 'category';
    eventId?: string;
    categorySlug?: string;
    order: number;
}

// Banners API calls
export const bannersApi = {
    // Get all active banners
    getAll: async () => {
        return apiRequest<ServerBanner[]>('/banners', {
            method: 'GET',
        });
    },

    // Seed default banners
    seed: async () => {
        return apiRequest<{ count: number; data: ServerBanner[] }>('/banners/seed', {
            method: 'POST',
        });
    },
};



// Booking types
export interface ServerBooking {
    _id: string;
    user: {
        _id: string;
        name: string;
        email: string;
        phone: string;
    };
    event: {
        _id: string;
        title: string;
        images: string[];
        date: string;
        time: string;
        location: string;
        fullLocation?: string;
        price: number;
        services?: string[];
        vendor?: EventVendor;
    };
    bookingDate: string;
    eventDate: string;
    guests: number;
    totalAmount: number;
    status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
    paymentStatus: 'pending' | 'paid' | 'refunded' | 'failed';
    paymentId?: string;
    notes?: string;
    cancellationReason?: string;
    createdAt: string;
    updatedAt: string;
}

// Bookings API calls
export const bookingsApi = {
    // Create a new booking
    create: async (data: {
        eventId: string;
        eventDate: string;
        guests?: number;
        notes?: string;
        paymentMethod?: string;
    }) => {
        return apiRequest<ServerBooking>('/bookings', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    // Get user's bookings
    getMyBookings: async (params?: {
        status?: string;
        page?: number;
        limit?: number;
    }) => {
        const queryParams = new URLSearchParams();
        if (params?.status) queryParams.append('status', params.status);
        if (params?.page) queryParams.append('page', params.page.toString());
        if (params?.limit) queryParams.append('limit', params.limit.toString());

        const queryString = queryParams.toString();
        return apiRequest<{ data: ServerBooking[]; pagination: Pagination }>(`/bookings${queryString ? `?${queryString}` : ''}`, {
            method: 'GET',
        });
    },

    // Get single booking
    getById: async (id: string) => {
        return apiRequest<ServerBooking>(`/bookings/${id}`, {
            method: 'GET',
        });
    },

    // Cancel booking
    cancel: async (id: string, reason?: string) => {
        return apiRequest<ServerBooking>(`/bookings/${id}/cancel`, {
            method: 'PUT',
            body: JSON.stringify({ reason }),
        });
    },

    // Update payment status
    updatePayment: async (id: string, data: { paymentStatus: string; paymentId?: string }) => {
        return apiRequest<ServerBooking>(`/bookings/${id}/payment`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    // Get booked dates for an event
    getBookedDates: async (eventId: string) => {
        return apiRequest<string[]>(`/bookings/event/${eventId}/booked-dates`, {
            method: 'GET',
        });
    },
};

// Transaction types
export interface ServerTransaction {
    _id: string;
    type: 'debit' | 'refund';
    amount: number;
    paymentMethod: 'upi' | 'card' | 'wallet' | 'netbanking' | 'cash';
    status: 'pending' | 'completed' | 'failed';
    createdAt: string;
    bookingId: string;
    event: {
        _id: string;
        title: string;
        image: string | null;
    } | null;
}

// Transactions API calls
export const transactionsApi = {
    // Get user's transactions
    getMyTransactions: async (params?: {
        type?: 'debit' | 'refund';
        page?: number;
        limit?: number;
    }) => {
        const queryParams = new URLSearchParams();
        if (params?.type) queryParams.append('type', params.type);
        if (params?.page) queryParams.append('page', params.page.toString());
        if (params?.limit) queryParams.append('limit', params.limit.toString());

        const queryString = queryParams.toString();
        return apiRequest<{ data: ServerTransaction[]; pagination: Pagination }>(`/transactions${queryString ? `?${queryString}` : ''}`, {
            method: 'GET',
        });
    },

    // Get single transaction
    getById: async (id: string) => {
        return apiRequest<ServerTransaction>(`/transactions/${id}`, {
            method: 'GET',
        });
    },
};

// Notification types
export interface ServerNotification {
    id: string;
    title: string;
    message: string;
    type: 'booking' | 'payment' | 'reminder' | 'promotion' | 'chat' | 'system';
    timestamp: string;
    read: boolean;
    data?: {
        bookingId?: string;
        eventId?: string;
        [key: string]: any;
    } | null;
}

// Notifications API calls
export const notificationsApi = {
    // Get user's notifications
    getNotifications: async (params?: { page?: number; limit?: number }) => {
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.append('page', params.page.toString());
        if (params?.limit) queryParams.append('limit', params.limit.toString());

        const queryString = queryParams.toString();
        return apiRequest<{ data: ServerNotification[]; unreadCount: number; pagination: Pagination }>(
            `/notifications${queryString ? `?${queryString}` : ''}`,
            { method: 'GET' }
        );
    },

    // Mark notification as read
    markAsRead: async (id: string) => {
        return apiRequest<{ message: string }>(`/notifications/${id}/read`, {
            method: 'PUT',
        });
    },

    // Mark all as read
    markAllAsRead: async () => {
        return apiRequest<{ message: string }>('/notifications/read-all', {
            method: 'PUT',
        });
    },

    // Delete notification
    deleteNotification: async (id: string) => {
        return apiRequest<{ message: string }>(`/notifications/${id}`, {
            method: 'DELETE',
        });
    },

    // Clear all notifications
    clearAll: async () => {
        return apiRequest<{ message: string }>('/notifications/clear-all', {
            method: 'DELETE',
        });
    },
};

// Review types
export interface ServerReview {
    _id: string;
    user: {
        _id: string;
        name: string;
        avatar: string;
    };
    event: string;
    rating: number;
    comment: string;
    createdAt: string;
    updatedAt: string;
}

export interface ReviewStats {
    avgRating: number;
    totalReviews: number;
}

// Reviews API calls
export const reviewsApi = {
    // Get reviews for an event
    getEventReviews: async (eventId: string, params?: { page?: number; limit?: number }) => {
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.append('page', params.page.toString());
        if (params?.limit) queryParams.append('limit', params.limit.toString());

        const queryString = queryParams.toString();
        return apiRequest<{ data: ServerReview[]; stats: ReviewStats; pagination: Pagination }>(
            `/reviews/event/${eventId}${queryString ? `?${queryString}` : ''}`,
            { method: 'GET' }
        );
    },

    // Create a review
    create: async (data: { eventId: string; bookingId?: string; rating: number; comment: string }) => {
        return apiRequest<ServerReview>('/reviews', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    // Check if user can review
    canReview: async (eventId: string) => {
        return apiRequest<{ canReview: boolean; reason?: string; existingReview?: { _id: string; rating: number; comment: string } }>(
            `/reviews/can-review/${eventId}`,
            { method: 'GET' }
        );
    },

    // Update a review
    update: async (id: string, data: { rating?: number; comment?: string }) => {
        return apiRequest<ServerReview>(`/reviews/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    // Delete a review
    delete: async (id: string) => {
        return apiRequest<{ message: string }>(`/reviews/${id}`, {
            method: 'DELETE',
        });
    },
};

// Chat types - Optimized response from server
export interface ChatMessage {
    _id: string;
    message: string;
    messageType: 'text' | 'image' | 'file';
    senderModel: 'User' | 'Vendor';
    isRead: boolean;
    createdAt: string;
    // Optional fields - only present in socket messages
    conversationId?: string;
    sender?: {
        _id: string;
        name?: string;
    };
}

export interface ChatConversation {
    conversationId: string;
    partner: {
        id: string;
        name: string;
        avatar?: string;
    };
    lastMessage: string;
    lastMessageTime: string;
    unreadCount: number;
}

// Chat API calls
export const chatApi = {
    // Send a message
    sendMessage: async (data: { receiverId: string; message: string; messageType?: 'text' | 'image' | 'file' }) => {
        return apiRequest<ChatMessage>('/chat/send', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    // Get all conversations
    getConversations: async () => {
        return apiRequest<{ data: ChatConversation[] }>('/chat/conversations', {
            method: 'GET',
        });
    },

    // Get conversation messages
    getConversation: async (partnerId: string, params?: { page?: number; limit?: number }) => {
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.append('page', params.page.toString());
        if (params?.limit) queryParams.append('limit', params.limit.toString());

        const queryString = queryParams.toString();
        return apiRequest<{ data: ChatMessage[] }>(
            `/chat/conversation/${partnerId}${queryString ? `?${queryString}` : ''}`,
            { method: 'GET' }
        );
    },

    // Mark messages as read
    markAsRead: async (conversationId: string) => {
        return apiRequest<{ message: string }>(`/chat/read/${conversationId}`, {
            method: 'PUT',
        });
    },

    // Delete a single message (soft delete for user)
    deleteMessage: async (messageId: string) => {
        return apiRequest<{ message: string }>(`/chat/message/${messageId}`, {
            method: 'DELETE',
        });
    },

    // Delete entire conversation (soft delete for user)
    deleteConversation: async (partnerId: string) => {
        return apiRequest<{ message: string }>(`/chat/conversation/${partnerId}`, {
            method: 'DELETE',
        });
    },

    // Get online status for a user/vendor
    getOnlineStatus: async (userId: string) => {
        return apiRequest<{ userId: string; isOnline: boolean }>(`/chat/online/${userId}`, {
            method: 'GET',
        });
    },
};

// App Rating API
export const appRatingApi = {
    // Check if user has rated
    checkRating: async () => {
        return apiRequest<{ hasRated: boolean; rating: number | null }>('/app-rating/check', {
            method: 'GET',
        });
    },

    // Submit rating
    submitRating: async (data: {
        rating: number;
        feedback?: string;
        platform?: string;
        appVersion?: string;
        deviceInfo?: string;
    }) => {
        return apiRequest<any>('/app-rating', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    // Skip rating
    skipRating: async () => {
        return apiRequest<{ message: string }>('/app-rating/skip', {
            method: 'POST',
        });
    },
};

// Health check
export const healthCheck = async (): Promise<boolean> => {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const data = await response.json();
        return data.success === true;
    } catch {
        return false;
    }
};

// Socket URL for real-time chat
export const getSocketUrl = () => {
    return API_BASE_URL.replace('/api', '');
};
