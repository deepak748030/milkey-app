// File: src/lib/api.ts
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
})

// Add auth token to requests
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('admin_token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

// Handle auth errors
// IMPORTANT: do NOT force-logout on every 401, because some endpoints can transiently return 401
// (cold start / slow server / race), which was logging you out when navigating.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            const token = localStorage.getItem('admin_token')
            const isProfileCheck = error.config?.url?.includes('/admin/me')

            // If there is no token at all, user is effectively logged out → go to login.
            if (!token && !isProfileCheck) {
                window.location.href = '/login'
            }

            // If token exists, keep session intact and let the UI handle the error.
            // (No localStorage clearing, no hard redirect.)
        }
        return Promise.reject(error)
    }
)

export interface Admin {
    _id: string
    name: string
    email: string
    avatar: string
    role: string
}

export interface UserWallet {
    balance: number
    pendingBalance: number
    totalEarnings: number
    totalWithdrawn: number
}

export interface User {
    _id: string
    name: string
    email: string
    phone: string
    avatar: string
    isBlocked: boolean
    memberSince: string
    createdAt: string
    wallet?: UserWallet
    role?: string
    address?: string
    referralCode?: string
    referralEarnings?: number
    totalReferralEarnings?: number
}

export interface VendorKYC {
    name?: string
    phone?: string
    email?: string
    aadhaarFrontImage?: string
    aadhaarBackImage?: string
    panCardImage?: string
    bankAccountHolderName?: string
    bankAccountNumber?: string
    bankName?: string
    ifscCode?: string
    ownerLivePhoto?: string
    verificationStatus?: 'pending' | 'verified' | 'rejected'
    rejectionReason?: string
    submittedAt?: string
    verifiedAt?: string
}

export interface Vendor {
    _id: string
    name: string
    email: string
    phone: string
    avatar: string
    businessName: string
    category: string
    rating: number
    reviewCount: number
    isVerified: boolean
    isBlocked: boolean
    kycStatus: 'not_submitted' | 'pending' | 'verified' | 'rejected'
    isActive: boolean
    createdAt: string
    description?: string
    experienceYears?: number
    address?: {
        street?: string
        city?: string
        state?: string
        pincode?: string
    }
    kyc?: VendorKYC
    bankDetails?: {
        accountHolderName?: string
        accountNumber?: string
        bankName?: string
        ifscCode?: string
        upiId?: string
    }
}

export interface VendorDetailResponse {
    success: boolean
    response: {
        vendor: Vendor
    }
}

export interface Pagination {
    page: number
    limit: number
    total: number
    pages: number
}

export interface DashboardStats {
    totalUsers: number
    activeUsers: number
    blockedUsers: number
    totalVendors: number
    activeVendors: number
    blockedVendors: number
    pendingKYC: number
    verifiedVendors: number
    recentUsers: number
    recentVendors: number
}

export interface ChartDataPoint {
    name: string
    users?: number
    vendors?: number
    revenue?: number
    bookings?: number
}

export interface PieChartDataPoint {
    name: string
    value: number
    color: string
}

export interface DashboardAnalytics {
    overview: {
        totalUsers: number
        activeUsers: number
        blockedUsers: number
        totalVendors: number
        activeVendors: number
        blockedVendors: number
        pendingKYC: number
        verifiedVendors: number
        totalBookings: number
        pendingBookings: number
        confirmedBookings: number
        completedBookings: number
        cancelledBookings: number
        totalRevenue: number
        totalEvents: number
        activeEvents: number
        featuredEvents: number
        inactiveEvents: number
    }
    periodStats: {
        users: number
        vendors: number
        bookings: number
        events: number
        revenue: number
        filter: string
    }
    charts: {
        userGrowth: ChartDataPoint[]
        bookingStatusDistribution: PieChartDataPoint[]
        vendorKycDistribution: PieChartDataPoint[]
        revenueTrend: ChartDataPoint[]
        bookingsTrend: ChartDataPoint[]
        eventsTrend: ChartDataPoint[]
    }
}

export interface Category {
    _id: string
    name: string
    image?: string
    color?: string
    itemsCount?: number
    isActive: boolean
    createdAt: string
    updatedAt?: string
}

export interface Banner {
    _id: string
    title: string
    subtitle?: string
    image: string
    badge?: string
    gradient?: string[]
    linkType: 'category'
    linkValue?: string
    isActive: boolean
    order: number
    createdAt: string
    updatedAt?: string
}

export interface DeliveryPartner {
    _id: string
    name: string
    phone: string
    email?: string
    avatar?: string
    vehicle: {
        type: 'bike' | 'scooter' | 'car' | 'bicycle'
        number: string
        model: string
        color: string
    }
    documents?: {
        aadhaar?: string
        pan?: string
        license?: string
        selfie?: string
    }
    kycStatus: 'pending' | 'submitted' | 'approved' | 'rejected'
    kycRejectionReason?: string
    isActive: boolean
    isOnline: boolean
    isVerified: boolean
    isBlocked: boolean
    isProfileComplete: boolean
    stats: {
        totalDeliveries: number
        rating: number
        totalRatings: number
    }
    earnings: {
        today: number
        week: number
        month: number
        total: number
    }
    memberSince: string
    createdAt: string
    updatedAt?: string
}

export interface DeliveryPartnerStats {
    total: number
    active: number
    online: number
    blocked: number
    verified: number
    pendingKyc: number
    submittedKyc: number
    approvedKyc: number
    rejectedKyc: number
    totalEarnings: number
    totalDeliveries: number
}

export interface Event {
    _id: string
    title: string
    description?: string
    category?: string
    image?: string
    images?: string[]
    date?: string
    time?: string
    location: string
    fullLocation?: string
    price: number
    mrp?: number
    badge?: string
    services?: string[]
    capacity?: number
    bookedCount?: number
    rating?: number
    reviews?: number
    isFeatured?: boolean
    isActive: boolean
    createdAt?: string
    updatedAt?: string
    vendor?: {
        _id: string
        name: string
        businessName?: string
        avatar?: string
        email?: string
        phone?: string
    }
}

// Auth APIs
export const adminLogin = async (email: string, password: string) => {
    const response = await api.post('/admin/login', { email, password })
    return response.data
}

export const getAdminProfile = async () => {
    const response = await api.get('/admin/me')
    return response.data
}

export const setupAdmin = async () => {
    const response = await api.post('/admin/setup')
    return response.data
}

// User APIs
export const getUsers = async (params: {
    page?: number
    limit?: number
    search?: string
    status?: string
}) => {
    const response = await api.get('/admin/users', { params })
    return response.data
}

export const getUserById = async (id: string) => {
    const response = await api.get(`/admin/users/${id}`)
    return response.data
}

export const updateUser = async (id: string, data: {
    name?: string
    email?: string
    phone?: string
    address?: string
    role?: string
}) => {
    const response = await api.put(`/admin/users/${id}`, data)
    return response.data
}

export const toggleUserBlock = async (id: string, reason?: string) => {
    const response = await api.put(`/admin/users/${id}/block`, { reason })
    return response.data
}

export const updateUserCommission = async (id: string, action: 'withdraw' | 'add' | 'set', amount: number) => {
    const response = await api.put(`/admin/users/${id}/commission`, { action, amount })
    return response.data
}

// Vendor APIs
export const getVendors = async (params: {
    page?: number
    limit?: number
    search?: string
    status?: string
    kycStatus?: string
}) => {
    const response = await api.get('/admin/vendors', { params })
    return response.data
}

export const getVendorById = async (id: string): Promise<VendorDetailResponse> => {
    const response = await api.get(`/admin/vendors/${id}`)
    return response.data
}

export const toggleVendorBlock = async (id: string, reason?: string) => {
    const response = await api.put(`/admin/vendors/${id}/block`, { reason })
    return response.data
}

export const updateVendorKYC = async (id: string, status: 'verified' | 'rejected', rejectionReason?: string) => {
    const response = await api.put(`/admin/vendors/${id}/kyc`, { status, rejectionReason })
    return response.data
}

// Category APIs
export const getCategoriesAdmin = async (params: {
    page?: number
    limit?: number
    search?: string
    status?: string
}) => {
    const response = await api.get('/admin/categories', { params })
    return response.data
}

export const getCategoryByIdAdmin = async (id: string) => {
    const response = await api.get(`/admin/categories/${id}`)
    return response.data
}

export const createCategory = async (data: {
    name: string
    image?: string
    color?: string
}) => {
    const response = await api.post('/admin/categories', data)
    return response.data
}

export const updateCategory = async (id: string, data: {
    name?: string
    image?: string
    color?: string
    isActive?: boolean
}) => {
    const response = await api.put(`/admin/categories/${id}`, data)
    return response.data
}

export const toggleCategoryStatus = async (id: string) => {
    const response = await api.put(`/admin/categories/${id}/toggle`)
    return response.data
}

export const deleteCategory = async (id: string) => {
    const response = await api.delete(`/admin/categories/${id}`)
    return response.data
}

// Banner APIs
export const getBannersAdmin = async (params: {
    page?: number
    limit?: number
    search?: string
    status?: string
    linkType?: string
}) => {
    const response = await api.get('/admin/banners', { params })
    return response.data
}

export const getBannerByIdAdmin = async (id: string) => {
    const response = await api.get(`/admin/banners/${id}`)
    return response.data
}

export const createBanner = async (data: {
    title: string
    subtitle?: string
    image: string
    badge?: string
    gradient?: string[]
    linkType?: string
    linkValue?: string
    order?: number
}) => {
    const response = await api.post('/admin/banners', data)
    return response.data
}

export const updateBanner = async (id: string, data: {
    title?: string
    subtitle?: string
    image?: string
    badge?: string
    gradient?: string[]
    linkType?: string
    linkValue?: string
    order?: number
    isActive?: boolean
}) => {
    const response = await api.put(`/admin/banners/${id}`, data)
    return response.data
}

export const deleteBanner = async (id: string) => {
    const response = await api.delete(`/admin/banners/${id}`)
    return response.data
}

export const toggleBannerStatus = async (id: string) => {
    const response = await api.put(`/admin/banners/${id}/toggle`)
    return response.data
}

export const reorderBanners = async (bannerOrders: { id: string; order: number }[]) => {
    const response = await api.put('/admin/banners/reorder', { bannerOrders })
    return response.data
}

// Events APIs (for banner selection)
export const getEventsAdmin = async (params: {
    page?: number
    limit?: number
    search?: string
    status?: string
    category?: string
    featured?: string
    sortBy?: string
    sortOrder?: string
}) => {
    const response = await api.get('/admin/events', { params })
    return response.data
}

export const getEventByIdAdmin = async (id: string) => {
    const response = await api.get(`/admin/events/${id}`)
    return response.data
}

export const updateEventAdmin = async (id: string, data: Partial<Event>) => {
    const response = await api.put(`/admin/events/${id}`, data)
    return response.data
}

export const toggleEventStatusAdmin = async (id: string) => {
    const response = await api.patch(`/admin/events/${id}/toggle-status`)
    return response.data
}

export const toggleEventFeaturedAdmin = async (id: string) => {
    const response = await api.patch(`/admin/events/${id}/toggle-featured`)
    return response.data
}

export const deleteEventAdmin = async (id: string) => {
    const response = await api.delete(`/admin/events/${id}`)
    return response.data
}

// Stats APIs
export const getDashboardStats = async () => {
    const response = await api.get('/admin/stats')
    return response.data
}

export const getDashboardAnalytics = async (filter: 'today' | 'weekly' | 'monthly' | 'yearly' = 'monthly') => {
    const response = await api.get('/admin/dashboard', { params: { filter } })
    return response.data
}

// Delivery Partner APIs
export const getDeliveryPartnersAdmin = async (params: {
    page?: number
    limit?: number
    search?: string
    status?: string
    kycStatus?: string
    isOnline?: string
}) => {
    const response = await api.get('/admin/delivery-partners', { params })
    return response.data
}

export const getDeliveryPartnerByIdAdmin = async (id: string) => {
    const response = await api.get(`/admin/delivery-partners/${id}`)
    return response.data
}

export const getDeliveryPartnerStats = async () => {
    const response = await api.get('/admin/delivery-partners/stats')
    return response.data
}

export const toggleDeliveryPartnerBlock = async (id: string, reason?: string) => {
    const response = await api.put(`/admin/delivery-partners/${id}/block`, { reason })
    return response.data
}

export const updateDeliveryPartnerKYC = async (id: string, status: string, rejectionReason?: string) => {
    const response = await api.put(`/admin/delivery-partners/${id}/kyc`, { status, rejectionReason })
    return response.data
}

export const toggleDeliveryPartnerActive = async (id: string) => {
    const response = await api.put(`/admin/delivery-partners/${id}/toggle-active`)
    return response.data
}

export const updateDeliveryPartnerEarnings = async (id: string, amount: number, type: 'add' | 'deduct' | 'set', reason?: string) => {
    const response = await api.put(`/admin/delivery-partners/${id}/earnings`, { amount, type, reason })
    return response.data
}

// Order Types
export interface OrderItem {
    product: string
    name: string
    price: number
    quantity: number
    image: string
}

export interface OrderUser {
    _id: string
    name: string
    phone: string
    avatar?: string
}

export interface Order {
    _id: string
    orderNumber: string
    user: OrderUser
    items: OrderItem[]
    shippingAddress: {
        name: string
        phone: string
        address: string
        city: string
        state: string
        pincode: string
    }
    paymentMethod: 'upi' | 'card' | 'wallet' | 'cod'
    subtotal: number
    discount: number
    shipping: number
    tax: number
    total: number
    status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled'
    timeline: Array<{
        status: string
        date: string
        completed: boolean
    }>
    deliveryPartner?: {
        _id: string
        name: string
        phone: string
        avatar?: string
        vehicleType?: string
    }
    deliveredAt?: string
    estimatedDeliveryTime?: string
    createdAt: string
}

export interface OrderStats {
    totalOrders: number
    totalRevenue: number
    avgOrderValue: number
    todayOrders: number
    todayRevenue: number
    pending: number
    confirmed: number
    processing: number
    shipped: number
    out_for_delivery: number
    delivered: number
    cancelled: number
}

// Order API Functions
export const getOrdersAdmin = async (params: {
    page?: number
    limit?: number
    search?: string
    status?: string
    paymentMethod?: string
    dateFrom?: string
    dateTo?: string
}) => {
    const response = await api.get('/admin/orders', { params })
    return response.data
}

export const getOrderStats = async () => {
    const response = await api.get('/admin/orders/stats')
    return response.data
}

export const getOrderById = async (id: string) => {
    const response = await api.get(`/admin/orders/${id}`)
    return response.data
}

export const updateOrderStatus = async (id: string, status: string) => {
    const response = await api.put(`/admin/orders/${id}/status`, { status })
    return response.data
}

export const assignDeliveryPartner = async (id: string, deliveryPartnerId: string) => {
    const response = await api.put(`/admin/orders/${id}/assign`, { deliveryPartnerId })
    return response.data
}

// Coupon Types
export interface Coupon {
    _id: string
    code: string
    discountType: 'percentage' | 'fixed'
    discountValue: number
    minOrderValue: number
    maxDiscount: number | null
    usageLimit: number | null
    usedCount: number
    validFrom: string
    validUntil: string
    isActive: boolean
    description: string
    createdAt: string
}

export interface CouponStats {
    totalCoupons: number
    activeCoupons: number
    expiredCoupons: number
    totalUsage: number
    percentageCoupons: number
    fixedCoupons: number
}

export interface CouponFormData {
    code: string
    discountType: 'percentage' | 'fixed'
    discountValue: number
    minOrderValue: number
    maxDiscount: number | null
    usageLimit: number | null
    validFrom: string
    validUntil: string
    description: string
}

// Coupon API Functions
export const getCouponsAdmin = async (params: {
    page?: number
    limit?: number
    search?: string
    status?: string
    discountType?: string
}) => {
    const response = await api.get('/admin/coupons', { params })
    return response.data
}

export const getCouponStats = async () => {
    const response = await api.get('/admin/coupons/stats')
    return response.data
}

export const getCouponById = async (id: string) => {
    const response = await api.get(`/admin/coupons/${id}`)
    return response.data
}

export const createCoupon = async (data: CouponFormData) => {
    const response = await api.post('/admin/coupons', data)
    return response.data
}

export const updateCoupon = async (id: string, data: Partial<CouponFormData & { isActive: boolean }>) => {
    const response = await api.put(`/admin/coupons/${id}`, data)
    return response.data
}

export const deleteCoupon = async (id: string) => {
    const response = await api.delete(`/admin/coupons/${id}`)
    return response.data
}

export const toggleCouponStatus = async (id: string) => {
    const response = await api.put(`/admin/coupons/${id}/toggle`)
    return response.data
}

// Product Types
export interface Product {
    _id: string
    title: string
    description: string
    price: number
    mrp: number
    category: {
        _id: string
        name: string
        color?: string
    }
    image: string
    images: string[]
    badge: string
    location: string
    fullLocation: string
    rating: number
    reviews: number
    date: string
    time: string
    services: string[]
    isActive: boolean
    isTrending: boolean
    isFashionPick: boolean
    createdAt: string
    updatedAt?: string
}

export interface ProductStats {
    totalProducts: number
    activeProducts: number
    inactiveProducts: number
    trendingProducts: number
    fashionPickProducts: number
}

// Product API Functions
export const getProductsAdmin = async (params: {
    page?: number
    limit?: number
    search?: string
    status?: string
    category?: string
    trending?: string
    fashionPick?: string
    minPrice?: number
    maxPrice?: number
}) => {
    const response = await api.get('/admin/products', { params })
    return response.data
}

export const getProductStats = async () => {
    const response = await api.get('/admin/products/stats')
    return response.data
}

export const getProductByIdAdmin = async (id: string) => {
    const response = await api.get(`/admin/products/${id}`)
    return response.data
}

export const toggleProductTrending = async (id: string) => {
    const response = await api.put(`/admin/products/${id}/trending`)
    return response.data
}

export const toggleProductFashionPick = async (id: string) => {
    const response = await api.put(`/admin/products/${id}/fashion-pick`)
    return response.data
}

export const toggleProductStatus = async (id: string) => {
    const response = await api.put(`/admin/products/${id}/toggle`)
    return response.data
}

export const deleteProductAdmin = async (id: string) => {
    const response = await api.delete(`/admin/products/${id}`)
    return response.data
}

// Admin Settings APIs
export interface AdminActivity {
    admin: Admin
    activity: {
        lastLogin: string
        accountCreated: string
        stats: {
            totalOrders: number
            totalUsers: number
            totalCoupons: number
            totalCategories: number
            totalBanners: number
            totalDeliveryPartners: number
        }
    }
}

export const updateAdminProfile = async (data: { name?: string; email?: string; avatar?: string }) => {
    const response = await api.put('/admin/profile', data)
    return response.data
}

export const updateAdminPassword = async (currentPassword: string, newPassword: string) => {
    const response = await api.put('/admin/password', { currentPassword, newPassword })
    return response.data
}

export const getAdminActivity = async () => {
    const response = await api.get('/admin/activity')
    return response.data
}

// Withdrawal Types
export interface WithdrawalRequest {
    _id: string
    requestId: string
    requesterType: 'vendor' | 'delivery_partner'
    user?: { _id: string; name: string; phone: string; avatar?: string }
    deliveryPartner?: { _id: string; name: string; phone: string; avatar?: string }
    amount: number
    paymentMethod: string
    paymentDetails?: {
        upiId?: string
        accountHolderName?: string
        accountNumber?: string
        ifscCode?: string
        bankName?: string
        mobileNumber?: string
    }
    status: 'pending' | 'processing' | 'completed' | 'rejected'
    adminNotes?: string
    rejectionReason?: string
    transactionReference?: string
    balanceBefore: number
    balanceAfter?: number
    createdAt: string
    updatedAt?: string
}

export interface WithdrawalStats {
    pending: number
    processing: number
    completed: number
    rejected: number
    pendingAmount: number
    processingAmount: number
    completedAmount: number
    rejectedAmount: number
}

// Withdrawal APIs
export const getWithdrawalsAdmin = async (params: {
    page?: number
    limit?: number
    search?: string
    status?: string
    requesterType?: string
}) => {
    const response = await api.get('/admin/withdrawals', { params })
    return response.data
}

export const getWithdrawalStats = async () => {
    const response = await api.get('/admin/withdrawals/stats')
    return response.data
}

export const updateWithdrawalStatus = async (
    id: string,
    status: string,
    adminNotes?: string,
    transactionReference?: string,
    rejectionReason?: string
) => {
    const response = await api.put(`/admin/withdrawals/${id}/status`, {
        status,
        adminNotes,
        transactionReference,
        rejectionReason,
    })
    return response.data
}

// Admin Order Interface (different from customer Order)
export interface AdminOrderItem {
    product: string
    name: string
    price: number
    quantity: number
    total: number
}

export interface AdminOrder {
    _id: string
    orderNumber: string
    user: {
        _id: string
        name: string
        email: string
        phone: string
    }
    items: AdminOrderItem[]
    totalAmount: number
    status: string
    paymentStatus: string
    paymentMethod: string
    deliveryAddress?: string
    notes?: string
    createdAt: string
    updatedAt: string
}

// Milk Collection (Purchase) Interfaces
export interface MilkCollection {
    _id: string
    purchaseFarmer: {
        _id: string
        code: string
        name: string
        mobile: string
    } | null
    farmerCode: string
    owner: {
        _id: string
        name: string
        email: string
    }
    date: string
    shift: 'morning' | 'evening'
    quantity: number
    fat: number
    snf: number
    rate: number
    amount: number
    isPaid: boolean
    notes?: string
    createdAt: string
    updatedAt: string
}

// Orders APIs
export const getAdminOrders = async (params: {
    page?: number
    limit?: number
    search?: string
    status?: string
    paymentStatus?: string
    startDate?: string
    endDate?: string
    userId?: string
}) => {
    const response = await api.get('/admin/orders', { params })
    return response.data
}

export const getAdminOrderById = async (id: string) => {
    const response = await api.get(`/admin/orders/${id}`)
    return response.data
}

export const updateAdminOrder = async (id: string, data: {
    status?: string
    paymentStatus?: string
    notes?: string
}) => {
    const response = await api.put(`/admin/orders/${id}`, data)
    return response.data
}

export const deleteAdminOrder = async (id: string) => {
    const response = await api.delete(`/admin/orders/${id}`)
    return response.data
}

// Milk Collections (Purchase) APIs
export const getAdminMilkCollections = async (params: {
    page?: number
    limit?: number
    search?: string
    shift?: string
    isPaid?: string
    startDate?: string
    endDate?: string
    userId?: string
    farmerId?: string
}) => {
    const response = await api.get('/admin/milk-collections', { params })
    return response.data
}

export const getAdminMilkCollectionById = async (id: string) => {
    const response = await api.get(`/admin/milk-collections/${id}`)
    return response.data
}

export const updateAdminMilkCollection = async (id: string, data: {
    quantity?: number
    fat?: number
    snf?: number
    rate?: number
    isPaid?: boolean
    notes?: string
}) => {
    const response = await api.put(`/admin/milk-collections/${id}`, data)
    return response.data
}

export const deleteAdminMilkCollection = async (id: string) => {
    const response = await api.delete(`/admin/milk-collections/${id}`)
    return response.data
}

// Note: AdminOrder interface is defined above at line 961

export interface AdminMilkCollection {
    _id: string
    purchaseFarmer: {
        _id: string
        code: string
        name: string
        mobile: string
    } | null
    farmerCode: string
    owner: {
        _id: string
        name: string
        email: string
        phone: string
    }
    date: string
    shift: 'morning' | 'evening'
    quantity: number
    fat: number
    snf: number
    rate: number
    amount: number
    isPaid: boolean
    notes?: string
    createdAt: string
    updatedAt: string
}

// Get list of users for dropdowns
export const getAdminUsersList = async () => {
    const response = await api.get('/admin/users/list')
    return response.data
}

// Update admin order status (correct endpoint with /status suffix)
export const updateAdminOrderStatus = async (id: string, data: { status?: string; paymentStatus?: string }) => {
    const response = await api.put(`/admin/orders/${id}/status`, data)
    return response.data
}

// ==================== SELLING MODULE TYPES ====================

export interface SellingMemberOwner {
    _id: string
    name: string
    email: string
    phone: string
}

export interface SellingMember {
    _id: string
    name: string
    mobile: string
    address: string
    ratePerLiter: number
    owner: SellingMemberOwner | string
    totalLiters: number
    totalAmount: number
    pendingAmount: number
    sellingPaymentBalance: number
    isActive: boolean
    createdAt: string
    updatedAt: string
}

export interface SellingEntry {
    _id: string
    member: {
        _id: string
        name: string
        mobile: string
        ratePerLiter: number
    } | null
    owner: string
    date: string
    morningQuantity: number
    eveningQuantity: number
    rate: number
    amount: number
    isPaid: boolean
    entryCount: number
    notes: string
    createdAt: string
    updatedAt: string
}

export interface MemberPayment {
    _id: string
    member: {
        _id: string
        name: string
        mobile: string
    } | null
    owner: string
    amount: number
    date: string
    paymentMethod: 'cash' | 'upi' | 'bank' | 'cheque'
    reference: string
    notes: string
    settledEntries: string[]
    periodStart: string | null
    periodEnd: string | null
    totalSellAmount: number
    totalQuantity: number
    milkRate: number
    netPayable: number
    closingBalance: number
    previousBalance: number
    createdAt: string
    updatedAt: string
}

export interface BalanceReportItem {
    _id: string
    name: string
    mobile: string
    ratePerLiter: number
    currentBalance: number
    unpaidAmount: number
    totalBalance: number
    unpaidEntriesCount: number
    unpaidQuantity: number
    date: string
    lastPaymentDate: string | null
    lastPeriodEnd: string | null
}

export interface BalanceReportSummary {
    totalMembers: number
    totalReceivable: number
    totalPayable: number
    netBalance: number
    totalUnpaidAmount: number
    totalUnpaidQuantity: number
}

// ==================== ADMIN SELLING MEMBER APIs ====================

export const getSellingMembers = async (params: {
    search?: string
    page?: number
    limit?: number
    userId?: string
}) => {
    const response = await api.get('/admin/selling-members', { params })
    return response.data
}

export const getSellingMembersList = async (params?: { userId?: string }) => {
    const response = await api.get('/admin/selling-members/list', { params })
    return response.data
}

export const getSellingMemberById = async (id: string) => {
    const response = await api.get(`/admin/selling-members/${id}`)
    return response.data
}

export const createSellingMember = async (data: {
    name: string
    mobile: string
    address?: string
    ratePerLiter?: number
}) => {
    const response = await api.post('/admin/selling-members', data)
    return response.data
}

export const updateSellingMember = async (id: string, data: {
    name?: string
    mobile?: string
    address?: string
    ratePerLiter?: number
}) => {
    const response = await api.put(`/admin/selling-members/${id}`, data)
    return response.data
}

export const deleteSellingMember = async (id: string) => {
    const response = await api.delete(`/admin/selling-members/${id}`)
    return response.data
}

// ==================== ADMIN SELLING ENTRY APIs ====================

export const getSellingEntries = async (params: {
    page?: number
    limit?: number
    memberId?: string
    userId?: string
    startDate?: string
    endDate?: string
    isPaid?: string
}) => {
    const response = await api.get('/admin/selling-entries', { params })
    return response.data
}

export const getSellingEntryById = async (id: string) => {
    const response = await api.get(`/admin/selling-entries/${id}`)
    return response.data
}

export const updateSellingEntry = async (id: string, data: {
    morningQuantity?: number
    eveningQuantity?: number
    rate?: number
    notes?: string
    isPaid?: boolean
}) => {
    const response = await api.put(`/admin/selling-entries/${id}`, data)
    return response.data
}

export const deleteSellingEntry = async (id: string) => {
    const response = await api.delete(`/admin/selling-entries/${id}`)
    return response.data
}

// ==================== ADMIN MEMBER PAYMENT APIs ====================

export const getMemberPayments = async (params: {
    page?: number
    limit?: number
    memberId?: string
    userId?: string
    startDate?: string
    endDate?: string
}) => {
    const response = await api.get('/admin/member-payments', { params })
    return response.data
}

export const getMemberPaymentById = async (id: string) => {
    const response = await api.get(`/admin/member-payments/${id}`)
    return response.data
}

export const deleteMemberPayment = async (id: string) => {
    const response = await api.delete(`/admin/member-payments/${id}`)
    return response.data
}

// ==================== ADMIN BALANCE REPORT API ====================

export const getBalanceReport = async (params?: { userId?: string }) => {
    const response = await api.get('/admin/selling-report', { params })
    return response.data
}

// ==================== ADMIN REGISTER FARMERS APIs ====================

export interface RegisterFarmerOwner {
    _id: string
    name: string
    email: string
    phone: string
}

export interface RegisterFarmer {
    _id: string
    code: string
    name: string
    mobile: string
    address: string
    owner: RegisterFarmerOwner | string
    type: 'farmer' | 'member'
    totalPurchase: number
    totalLiters: number
    pendingAmount: number
    currentBalance: number
    isActive: boolean
    createdAt: string
    updatedAt: string
}

export const getRegisterFarmers = async (params: {
    search?: string
    page?: number
    limit?: number
    userId?: string
}) => {
    const response = await api.get('/admin/register-farmers', { params })
    return response.data
}

export const getRegisterFarmerById = async (id: string) => {
    const response = await api.get(`/admin/register-farmers/${id}`)
    return response.data
}

export const updateRegisterFarmer = async (id: string, data: {
    name?: string
    mobile?: string
    address?: string
}) => {
    const response = await api.put(`/admin/register-farmers/${id}`, data)
    return response.data
}

export const deleteRegisterFarmer = async (id: string) => {
    const response = await api.delete(`/admin/register-farmers/${id}`)
    return response.data
}

// ==================== ADMIN REGISTER ADVANCES APIs ====================

export interface RegisterAdvance {
    _id: string
    farmer: {
        _id: string
        code: string
        name: string
        mobile: string
    } | null
    owner: {
        _id: string
        name: string
        email: string
        phone: string
    } | string
    amount: number
    date: string
    note: string
    status: 'pending' | 'settled' | 'partial'
    settledAmount: number
    createdAt: string
    updatedAt: string
}

export const getRegisterAdvances = async (params: {
    search?: string
    page?: number
    limit?: number
    userId?: string
    status?: string
    startDate?: string
    endDate?: string
}) => {
    const response = await api.get('/admin/register-advances', { params })
    return response.data
}

// ==================== ADMIN REGISTER PAYMENTS APIs ====================

export interface RegisterPayment {
    _id: string
    farmer: {
        _id: string
        code: string
        name: string
        mobile: string
    } | null
    owner: {
        _id: string
        name: string
        email: string
        phone: string
    } | string
    amount: number
    date: string
    periodStart: string
    periodEnd: string
    totalMilkAmount: number
    totalAdvanceDeduction: number
    netPayable: number
    closingBalance: number
    previousBalance: number
    paymentMethod: string
    reference: string
    notes: string
    createdAt: string
    updatedAt: string
}

export const getRegisterPayments = async (params: {
    search?: string
    page?: number
    limit?: number
    userId?: string
    startDate?: string
    endDate?: string
}) => {
    const response = await api.get('/admin/register-payments', { params })
    return response.data
}

// ==================== ADMIN PRODUCT MANAGEMENT ====================

export interface AdminProduct {
    _id: string
    name: string
    price: number
    unit: string
    icon: string
    description: string
    stock: number
    image?: string
    owner: {
        _id: string
        name: string
        email: string
        phone: string
    } | string
    isActive: boolean
    createdAt: string
    updatedAt: string
}

export const getAdminProducts = async (params: {
    page?: number
    limit?: number
    search?: string
    status?: string
    unit?: string
    userId?: string
}) => {
    const response = await api.get('/admin/products', { params })
    return response.data
}

export const getAdminProductById = async (id: string) => {
    const response = await api.get(`/admin/products/${id}`)
    return response.data
}

export const createAdminProduct = async (data: {
    name: string
    price: number
    unit?: string
    icon?: string
    description?: string
    stock?: number
    image?: string
}) => {
    const response = await api.post('/admin/products', data)
    return response.data
}

export const updateAdminProduct = async (id: string, data: {
    name?: string
    price?: number
    unit?: string
    icon?: string
    description?: string
    stock?: number
    image?: string
    isActive?: boolean
}) => {
    const response = await api.put(`/admin/products/${id}`, data)
    return response.data
}

export const deleteAdminProduct = async (id: string) => {
    const response = await api.delete(`/admin/products/${id}`)
    return response.data
}

export const toggleAdminProductStatus = async (id: string) => {
    const response = await api.put(`/admin/products/${id}/toggle`)
    return response.data
}

// Image Upload API
export const uploadImage = async (imageBase64: string, folder?: string): Promise<{
    success: boolean
    message?: string
    response?: {
        url: string
        public_id: string
    }
}> => {
    const response = await api.post('/admin/upload', { image: imageBase64, folder })
    return response.data
}

// ==================== SUBSCRIPTION APIs ====================

export interface Subscription {
    _id: string
    name: string
    amount: number
    durationMonths: number
    applicableTabs: string[]
    subscriptionType: 'single' | 'combined' | 'free'
    isFree: boolean
    forNewUsers: boolean
    description?: string
    isActive: boolean
    createdAt: string
    updatedAt?: string
}

export const getSubscriptions = async (params: {
    page?: number
    limit?: number
    search?: string
    status?: string
    tab?: string
}) => {
    const response = await api.get('/subscriptions', { params })
    return response.data
}

export const getSubscriptionById = async (id: string) => {
    const response = await api.get(`/subscriptions/${id}`)
    return response.data
}

export const createSubscription = async (data: {
    name: string
    amount: number
    durationMonths: number
    applicableTabs: string[]
    subscriptionType?: 'single' | 'combined' | 'free'
    isFree?: boolean
    forNewUsers?: boolean
    description?: string
}) => {
    const response = await api.post('/subscriptions', data)
    return response.data
}

export const updateSubscription = async (id: string, data: {
    name?: string
    amount?: number
    durationMonths?: number
    applicableTabs?: string[]
    subscriptionType?: 'single' | 'combined' | 'free'
    isFree?: boolean
    forNewUsers?: boolean
    description?: string
    isActive?: boolean
}) => {
    const response = await api.put(`/subscriptions/${id}`, data)
    return response.data
}

export const toggleSubscriptionStatus = async (id: string) => {
    const response = await api.put(`/subscriptions/${id}/toggle`)
    return response.data
}

export const deleteSubscription = async (id: string) => {
    const response = await api.delete(`/subscriptions/${id}`)
    return response.data
}

// Active Subscriptions & Referrals APIs
export const getAllActiveSubscriptions = async () => {
    const response = await api.get('/user-subscriptions/all-active')
    return response.data
}

export const getAllReferrals = async () => {
    const response = await api.get('/referrals/admin/all')
    return response.data
}

export const updateReferralCommission = async (id: string, commissionRate: number) => {
    const response = await api.put(`/referrals/admin/${id}/commission`, { commissionRate })
    return response.data
}

export const updateDefaultCommission = async (commissionRate: number) => {
    const response = await api.put('/referrals/admin/default-commission', { commissionRate })
    return response.data
}

// Admin Withdrawals APIs (for referral withdrawals)
export interface AdminReferralWithdrawal {
    _id: string
    user: {
        _id: string
        name: string
        email: string
        phone: string
        avatar?: string
    }
    amount: number
    paymentMethod: 'upi' | 'bank'
    upiId?: string
    bankDetails?: {
        accountNumber: string
        ifscCode: string
        accountHolderName: string
        bankName?: string
    }
    status: 'pending' | 'approved' | 'rejected' | 'cancelled'
    adminNote?: string
    processedAt?: string
    processedBy?: { name: string }
    createdAt: string
}

export interface ReferralWithdrawalStats {
    pending: { count: number; total: number }
    approved: { count: number; total: number }
    rejected: { count: number; total: number }
}

export const getAllReferralWithdrawals = async (params?: { status?: string; page?: number; limit?: number }) => {
    const response = await api.get('/withdrawals/admin/all', { params })
    return response.data
}

export const updateReferralWithdrawalStatus = async (id: string, data: { status: string; adminNote?: string }) => {
    const response = await api.put(`/withdrawals/admin/${id}`, data)
    return response.data
}

// Admin User Subscription Assignment APIs
export interface SubscriptionListItem {
    _id: string
    name: string
    amount: number
    durationMonths: number
    applicableTabs: string[]
    isFree: boolean
    description?: string
}

export const getSubscriptionsList = async () => {
    const response = await api.get('/admin/subscriptions/list')
    return response.data
}

export const assignSubscriptionToUser = async (userId: string, data: {
    subscriptionId: string
    durationMonths?: number
    paymentMethod?: string
    transactionId?: string
    notes?: string
}) => {
    const response = await api.post(`/admin/users/${userId}/assign-subscription`, data)
    return response.data
}

export const getUserSubscriptions = async (userId: string) => {
    const response = await api.get(`/admin/users/${userId}/subscriptions`)
    return response.data
}

// Admin Notification APIs
export const sendNotificationToUser = async (userId: string, data: {
    title: string
    message: string
    type?: string
}) => {
    const response = await api.post(`/admin/users/${userId}/send-notification`, data)
    return response.data
}

export const sendBulkNotification = async (data: {
    title: string
    message: string
    type?: string
    userIds?: string[]
}) => {
    const response = await api.post('/admin/send-bulk-notification', data)
    return response.data
}

export default api