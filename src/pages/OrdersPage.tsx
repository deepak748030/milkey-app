import { useState, useEffect, useCallback } from 'react'
import {
    Search,
    ChevronLeft,
    ChevronRight,
    Eye,
    X,
    Loader2,
    RefreshCw,
    ShoppingBag,
    Package,
    Truck,
    CheckCircle,
    XCircle,
    Clock,
    CreditCard,
    Wallet,
    Smartphone,
    Banknote,
    TrendingUp,
    MapPin,
    Phone,
    User,
} from 'lucide-react'
import {
    getOrdersAdmin,
    getOrderStats,
    getOrderById,
    updateOrderStatus,
    Order,
    OrderStats,
    Pagination,
} from '../lib/api'
import { cn } from '../lib/utils'

const statusColors: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
    pending: { bg: 'bg-warning/10', text: 'text-warning', icon: Clock },
    confirmed: { bg: 'bg-primary/10', text: 'text-primary', icon: CheckCircle },
    processing: { bg: 'bg-info/10', text: 'text-info', icon: Package },
    shipped: { bg: 'bg-purple-500/10', text: 'text-purple-500', icon: Truck },
    out_for_delivery: { bg: 'bg-orange-500/10', text: 'text-orange-500', icon: Truck },
    delivered: { bg: 'bg-success/10', text: 'text-success', icon: CheckCircle },
    cancelled: { bg: 'bg-destructive/10', text: 'text-destructive', icon: XCircle },
}

const paymentIcons: Record<string, React.ElementType> = {
    upi: Smartphone,
    card: CreditCard,
    wallet: Wallet,
    cod: Banknote,
}

function formatCurrency(amount: number): string {
    return `₹${amount.toLocaleString()}`
}

function StatCard({ title, value, icon: Icon, color, subValue }: {
    title: string
    value: string | number
    icon: React.ElementType
    color: string
    subValue?: string
}) {
    return (
        <div className="bg-card border border-border rounded-xl p-3 sm:p-4">
            <div className="flex items-center justify-between mb-1 sm:mb-2">
                <span className="text-xs sm:text-sm text-muted-foreground truncate">{title}</span>
                <div className={cn('p-1.5 sm:p-2 rounded-lg flex-shrink-0', color)}>
                    <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
                </div>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-foreground truncate">{value}</p>
            {subValue && <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 truncate">{subValue}</p>}
        </div>
    )
}

function OrderSkeleton() {
    return (
        <tr className="border-b border-border">
            <td className="p-4"><div className="h-4 w-28 skeleton rounded" /></td>
            <td className="p-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full skeleton" />
                    <div className="space-y-1">
                        <div className="h-4 w-24 skeleton rounded" />
                        <div className="h-3 w-20 skeleton rounded" />
                    </div>
                </div>
            </td>
            <td className="p-4"><div className="h-4 w-16 skeleton rounded" /></td>
            <td className="p-4"><div className="h-4 w-20 skeleton rounded" /></td>
            <td className="p-4"><div className="h-6 w-24 skeleton rounded-full" /></td>
            <td className="p-4"><div className="h-4 w-16 skeleton rounded" /></td>
            <td className="p-4"><div className="h-4 w-24 skeleton rounded" /></td>
            <td className="p-4"><div className="h-10 w-10 skeleton rounded-lg" /></td>
        </tr>
    )
}

function StatsSkeleton() {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-1 sm:mb-2">
                        <div className="h-3 sm:h-4 w-16 sm:w-20 skeleton rounded" />
                        <div className="w-6 h-6 sm:w-8 sm:h-8 skeleton rounded-lg" />
                    </div>
                    <div className="h-6 sm:h-8 w-20 sm:w-24 skeleton rounded" />
                </div>
            ))}
        </div>
    )
}

interface OrderDetailModalProps {
    order: Order | null
    onClose: () => void
    onStatusUpdate: (orderId: string, status: string) => void
    isUpdating: boolean
}

function OrderDetailModal({ order, onClose, onStatusUpdate, isUpdating }: OrderDetailModalProps) {
    if (!order) return null

    const StatusIcon = statusColors[order.status]?.icon || Clock
    const PaymentIcon = paymentIcons[order.paymentMethod] || CreditCard

    const statusFlow = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered']
    const canUpdateTo = (status: string) => {
        if (order.status === 'cancelled' || order.status === 'delivered') return false
        const currentIndex = statusFlow.indexOf(order.status)
        const targetIndex = statusFlow.indexOf(status)
        return targetIndex === currentIndex + 1 || status === 'cancelled'
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
            <div
                className="bg-card border border-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
                    <div>
                        <h2 className="text-lg font-bold text-foreground">{order.orderNumber}</h2>
                        <p className="text-sm text-muted-foreground">
                            {new Date(order.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 space-y-6">
                    {/* Status & Payment */}
                    <div className="flex flex-wrap gap-3">
                        <div className={cn('flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium', statusColors[order.status]?.bg, statusColors[order.status]?.text)}>
                            <StatusIcon className="w-4 h-4" />
                            {order.status.replace('_', ' ').toUpperCase()}
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-sm font-medium">
                            <PaymentIcon className="w-4 h-4" />
                            {order.paymentMethod.toUpperCase()}
                        </div>
                    </div>

                    {/* Customer Info */}
                    <div className="bg-muted/50 rounded-xl p-4">
                        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Customer Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                                    {order.user?.avatar ? (
                                        <img src={order.user.avatar} alt={order.user.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-sm font-medium">{order.user?.name?.charAt(0) || 'U'}</span>
                                    )}
                                </div>
                                <div>
                                    <p className="font-medium text-foreground">{order.user?.name || 'N/A'}</p>
                                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                                        <Phone className="w-3 h-3" />
                                        {order.user?.phone || 'N/A'}
                                    </p>
                                </div>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground flex items-start gap-1">
                                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <span>
                                        {order.shippingAddress?.address}, {order.shippingAddress?.city}, {order.shippingAddress?.state} - {order.shippingAddress?.pincode}
                                    </span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Order Items */}
                    <div>
                        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                            <Package className="w-4 h-4" />
                            Order Items ({order.items?.length || 0})
                        </h3>
                        <div className="space-y-2">
                            {order.items?.map((item, index) => (
                                <div key={index} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                                    <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                                        {item.image ? (
                                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Package className="w-5 h-5 text-muted-foreground" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-foreground truncate">{item.name}</p>
                                        <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                                    </div>
                                    <p className="font-semibold text-foreground">{formatCurrency(item.price * item.quantity)}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Order Summary */}
                    <div className="bg-muted/50 rounded-xl p-4">
                        <h3 className="text-sm font-semibold text-foreground mb-3">Order Summary</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Subtotal</span>
                                <span className="text-foreground">{formatCurrency(order.subtotal)}</span>
                            </div>
                            {order.discount > 0 && (
                                <div className="flex justify-between text-success">
                                    <span>Discount</span>
                                    <span>-{formatCurrency(order.discount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Shipping</span>
                                <span className="text-foreground">{formatCurrency(order.shipping)}</span>
                            </div>
                            {order.tax > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Tax</span>
                                    <span className="text-foreground">{formatCurrency(order.tax)}</span>
                                </div>
                            )}
                            <div className="flex justify-between pt-2 border-t border-border font-semibold text-base">
                                <span>Total</span>
                                <span className="text-primary">{formatCurrency(order.total)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Status Update */}
                    {order.status !== 'delivered' && order.status !== 'cancelled' && (
                        <div>
                            <h3 className="text-sm font-semibold text-foreground mb-3">Update Status</h3>
                            <div className="flex flex-wrap gap-2">
                                {statusFlow.map((status) => (
                                    <button
                                        key={status}
                                        onClick={() => onStatusUpdate(order._id, status)}
                                        disabled={!canUpdateTo(status) || isUpdating}
                                        className={cn(
                                            'px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                                            canUpdateTo(status)
                                                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                                                : 'bg-muted text-muted-foreground'
                                        )}
                                    >
                                        {status.replace('_', ' ')}
                                    </button>
                                ))}
                                <button
                                    onClick={() => onStatusUpdate(order._id, 'cancelled')}
                                    disabled={!canUpdateTo('cancelled') || isUpdating}
                                    className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Cancel Order
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Timeline */}
                    {order.timeline && order.timeline.length > 0 && (
                        <div>
                            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                Order Timeline
                            </h3>
                            <div className="space-y-3">
                                {order.timeline.map((item, index) => (
                                    <div key={index} className="flex items-start gap-3">
                                        <div className={cn(
                                            'w-3 h-3 rounded-full mt-1.5',
                                            item.completed ? 'bg-success' : 'bg-muted'
                                        )} />
                                        <div>
                                            <p className="font-medium text-foreground capitalize">{item.status.replace('_', ' ')}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {new Date(item.date).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export function OrdersPage() {
    const [orders, setOrders] = useState<Order[]>([])
    const [stats, setStats] = useState<OrderStats | null>(null)
    const [pagination, setPagination] = useState<Pagination | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [statsLoading, setStatsLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [paymentFilter, setPaymentFilter] = useState('all')
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [statusUpdating, setStatusUpdating] = useState(false)

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 400)
        return () => clearTimeout(timer)
    }, [search])

    const fetchStats = useCallback(async () => {
        setStatsLoading(true)
        try {
            const response = await getOrderStats()
            if (response.success) {
                setStats(response.response)
            }
        } catch (err) {
            console.error('Failed to fetch stats:', err)
        } finally {
            setStatsLoading(false)
        }
    }, [])

    const fetchOrders = useCallback(async (page = 1) => {
        setIsLoading(true)
        try {
            const response = await getOrdersAdmin({
                page,
                limit: 10,
                search: debouncedSearch,
                status: statusFilter,
                paymentMethod: paymentFilter,
            })
            if (response.success) {
                setOrders(response.response.orders)
                setPagination(response.response.pagination)
            }
        } catch (err) {
            console.error('Failed to fetch orders:', err)
        } finally {
            setIsLoading(false)
        }
    }, [debouncedSearch, statusFilter, paymentFilter])

    useEffect(() => {
        fetchStats()
    }, [fetchStats])

    useEffect(() => {
        fetchOrders(1)
    }, [fetchOrders])

    const handleViewOrder = async (orderId: string) => {
        setDetailLoading(true)
        try {
            const response = await getOrderById(orderId)
            if (response.success) {
                setSelectedOrder(response.response.order)
            }
        } catch (err) {
            console.error('Failed to fetch order details:', err)
        } finally {
            setDetailLoading(false)
        }
    }

    const handleStatusUpdate = async (orderId: string, status: string) => {
        setStatusUpdating(true)
        try {
            const response = await updateOrderStatus(orderId, status)
            if (response.success) {
                setSelectedOrder(response.response.order)
                fetchOrders(pagination?.page || 1)
                fetchStats()
            }
        } catch (err) {
            console.error('Failed to update status:', err)
        } finally {
            setStatusUpdating(false)
        }
    }

    return (
        <div className="animate-fade-in space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="p-2 sm:p-3 bg-primary/10 rounded-xl">
                        <ShoppingBag className="w-5 h-5 sm:w-7 sm:h-7 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Orders</h1>
                        <p className="text-xs sm:text-base text-muted-foreground mt-0.5">Manage all customer orders</p>
                    </div>
                </div>
                <button
                    onClick={() => { fetchOrders(pagination?.page || 1); fetchStats(); }}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-card border border-border rounded-xl hover:bg-muted transition-colors"
                >
                    <RefreshCw className={cn('w-4 h-4 sm:w-5 sm:h-5', isLoading && 'animate-spin')} />
                    <span className="font-medium text-sm sm:text-base">Refresh</span>
                </button>
            </div>

            {/* Stats */}
            {statsLoading ? (
                <StatsSkeleton />
            ) : stats && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                    <StatCard
                        title="Total Orders"
                        value={stats.totalOrders}
                        icon={ShoppingBag}
                        color="bg-primary/10 text-primary"
                        subValue={`${stats.todayOrders} today`}
                    />
                    <StatCard
                        title="Total Revenue"
                        value={formatCurrency(stats.totalRevenue)}
                        icon={TrendingUp}
                        color="bg-success/10 text-success"
                        subValue={`${formatCurrency(stats.todayRevenue)} today`}
                    />
                    <StatCard
                        title="Avg Order Value"
                        value={formatCurrency(stats.avgOrderValue)}
                        icon={Wallet}
                        color="bg-info/10 text-info"
                    />
                    <StatCard
                        title="Pending Orders"
                        value={stats.pending}
                        icon={Clock}
                        color="bg-warning/10 text-warning"
                        subValue={`${stats.processing} processing`}
                    />
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 bg-card border border-input rounded-xl text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                    />
                </div>

                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 sm:px-4 py-2.5 sm:py-3 bg-card border border-input rounded-xl text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="processing">Processing</option>
                    <option value="shipped">Shipped</option>
                    <option value="out_for_delivery">Out for Delivery</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                </select>

                <select
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value)}
                    className="px-3 sm:px-4 py-2.5 sm:py-3 bg-card border border-input rounded-xl text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                >
                    <option value="all">All Payments</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                    <option value="wallet">Wallet</option>
                    <option value="cod">COD</option>
                </select>
            </div>

            {/* Table - Desktop */}
            <div className="bg-card border border-border rounded-xl overflow-hidden hidden lg:block">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted/50 border-b border-border">
                            <tr>
                                <th className="text-left p-4 font-semibold text-muted-foreground">Order ID</th>
                                <th className="text-left p-4 font-semibold text-muted-foreground">Customer</th>
                                <th className="text-left p-4 font-semibold text-muted-foreground">Items</th>
                                <th className="text-left p-4 font-semibold text-muted-foreground">Total</th>
                                <th className="text-left p-4 font-semibold text-muted-foreground">Status</th>
                                <th className="text-left p-4 font-semibold text-muted-foreground">Payment</th>
                                <th className="text-left p-4 font-semibold text-muted-foreground">Date</th>
                                <th className="text-left p-4 font-semibold text-muted-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => <OrderSkeleton key={i} />)
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center text-muted-foreground">
                                        <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                        <p className="text-lg">No orders found</p>
                                    </td>
                                </tr>
                            ) : (
                                orders.map((order) => {
                                    const StatusIcon = statusColors[order.status]?.icon || Clock
                                    const PaymentIcon = paymentIcons[order.paymentMethod] || CreditCard
                                    return (
                                        <tr key={order._id} className="border-b border-border hover:bg-muted/30 transition-colors">
                                            <td className="p-4">
                                                <span className="font-mono text-sm font-medium text-primary">{order.orderNumber}</span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-muted overflow-hidden flex-shrink-0">
                                                        {order.user?.avatar ? (
                                                            <img src={order.user.avatar} alt={order.user.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-sm font-medium text-muted-foreground">
                                                                {order.user?.name?.charAt(0) || 'U'}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-foreground">{order.user?.name || 'N/A'}</p>
                                                        <p className="text-xs text-muted-foreground">{order.user?.phone}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="text-sm text-muted-foreground">{order.items?.length || 0} items</span>
                                            </td>
                                            <td className="p-4">
                                                <span className="font-semibold text-foreground">{formatCurrency(order.total)}</span>
                                            </td>
                                            <td className="p-4">
                                                <span className={cn(
                                                    'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full',
                                                    statusColors[order.status]?.bg,
                                                    statusColors[order.status]?.text
                                                )}>
                                                    <StatusIcon className="w-3.5 h-3.5" />
                                                    {order.status.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                                                    <PaymentIcon className="w-4 h-4" />
                                                    {order.paymentMethod.toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="p-4 text-muted-foreground text-sm">
                                                {new Date(order.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="p-4">
                                                <button
                                                    onClick={() => handleViewOrder(order._id)}
                                                    disabled={detailLoading}
                                                    className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                                                    title="View Details"
                                                >
                                                    {detailLoading ? (
                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                    ) : (
                                                        <Eye className="w-5 h-5" />
                                                    )}
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pagination && pagination.pages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-border">
                        <p className="text-muted-foreground text-sm">
                            Showing {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => fetchOrders(pagination.page - 1)}
                                disabled={pagination.page === 1 || isLoading}
                                className="p-2.5 hover:bg-muted rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="px-4 py-2 bg-muted rounded-lg font-medium">
                                {pagination.page} / {pagination.pages}
                            </span>
                            <button
                                onClick={() => fetchOrders(pagination.page + 1)}
                                disabled={pagination.page === pagination.pages || isLoading}
                                className="p-2.5 hover:bg-muted rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-3">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
                            <div className="flex items-center justify-between mb-3">
                                <div className="h-4 w-24 skeleton rounded" />
                                <div className="h-6 w-20 skeleton rounded-full" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="h-8 skeleton rounded" />
                                <div className="h-8 skeleton rounded" />
                            </div>
                        </div>
                    ))
                ) : orders.length === 0 ? (
                    <div className="bg-card border border-border rounded-xl p-8 text-center">
                        <ShoppingBag className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground">No orders found</p>
                    </div>
                ) : (
                    orders.map((order) => {
                        const StatusIcon = statusColors[order.status]?.icon || Clock
                        const PaymentIcon = paymentIcons[order.paymentMethod] || CreditCard
                        return (
                            <div key={order._id} className="bg-card border border-border rounded-xl p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="font-mono text-sm font-medium text-primary">{order.orderNumber}</span>
                                    <span className={cn(
                                        'inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-full',
                                        statusColors[order.status]?.bg,
                                        statusColors[order.status]?.text
                                    )}>
                                        <StatusIcon className="w-3 h-3" />
                                        {order.status.replace('_', ' ')}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-8 h-8 rounded-full bg-muted overflow-hidden flex-shrink-0">
                                        {order.user?.avatar ? (
                                            <img src={order.user.avatar} alt={order.user.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-xs font-medium text-muted-foreground">
                                                {order.user?.name?.charAt(0) || 'U'}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-foreground text-sm truncate">{order.user?.name || 'N/A'}</p>
                                        <p className="text-xs text-muted-foreground">{order.user?.phone}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-foreground">{formatCurrency(order.total)}</p>
                                        <p className="text-xs text-muted-foreground">{order.items?.length || 0} items</p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                                    <span className="flex items-center gap-1">
                                        <PaymentIcon className="w-3 h-3" />
                                        {order.paymentMethod.toUpperCase()}
                                    </span>
                                    <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                                </div>

                                <button
                                    onClick={() => handleViewOrder(order._id)}
                                    disabled={detailLoading}
                                    className="w-full flex items-center justify-center gap-2 py-2 text-sm bg-muted hover:bg-muted/80 rounded-lg transition-colors"
                                >
                                    {detailLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Eye className="w-4 h-4" />
                                            View Details
                                        </>
                                    )}
                                </button>
                            </div>
                        )
                    })
                )}

                {/* Mobile Pagination */}
                {pagination && pagination.pages > 1 && (
                    <div className="flex items-center justify-between bg-card border border-border rounded-xl p-3">
                        <p className="text-xs text-muted-foreground">
                            {pagination.page} / {pagination.pages}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => fetchOrders(pagination.page - 1)}
                                disabled={pagination.page === 1 || isLoading}
                                className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => fetchOrders(pagination.page + 1)}
                                disabled={pagination.page === pagination.pages || isLoading}
                                className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            <OrderDetailModal
                order={selectedOrder}
                onClose={() => setSelectedOrder(null)}
                onStatusUpdate={handleStatusUpdate}
                isUpdating={statusUpdating}
            />
        </div>
    )
}
