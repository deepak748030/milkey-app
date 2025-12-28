import { useState, useEffect, useCallback } from 'react'
import {
    Search,
    Filter,
    Eye,
    Trash2,
    ChevronLeft,
    ChevronRight,
    Package,
    Clock,
    CheckCircle,
    XCircle,
    Truck,
    RefreshCw,
    X
} from 'lucide-react'
import { getAdminOrders, updateAdminOrderStatus, deleteAdminOrder, type AdminOrder } from '@/lib/api'

const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    processing: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    delivered: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
}

const paymentStatusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    refunded: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
}

const statusIcons: Record<string, React.ReactNode> = {
    pending: <Clock className="w-4 h-4" />,
    confirmed: <CheckCircle className="w-4 h-4" />,
    processing: <Package className="w-4 h-4" />,
    delivered: <Truck className="w-4 h-4" />,
    cancelled: <XCircle className="w-4 h-4" />
}

function SkeletonRow() {
    return (
        <tr className="animate-pulse">
            <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-24"></div></td>
            <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-32"></div></td>
            <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-16"></div></td>
            <td className="px-4 py-3"><div className="h-6 bg-muted rounded w-20"></div></td>
            <td className="px-4 py-3"><div className="h-6 bg-muted rounded w-16"></div></td>
            <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-24"></div></td>
            <td className="px-4 py-3"><div className="h-8 bg-muted rounded w-20"></div></td>
        </tr>
    )
}

export function AdminOrdersPage() {
    const [orders, setOrders] = useState<AdminOrder[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [status, setStatus] = useState('all')
    const [paymentStatus, setPaymentStatus] = useState('all')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [page, setPage] = useState(1)
    const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 10 })
    const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null)
    const [showDetailModal, setShowDetailModal] = useState(false)
    const [actionLoading, setActionLoading] = useState(false)

    const fetchOrders = useCallback(async () => {
        setLoading(true)
        try {
            const response = await getAdminOrders({
                page,
                limit: 10,
                search,
                status: status !== 'all' ? status : undefined,
                paymentStatus: paymentStatus !== 'all' ? paymentStatus : undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined
            })
            if (response.success) {
                setOrders(response.response.orders)
                setPagination(response.response.pagination)
            }
        } catch (error) {
            console.error('Failed to fetch orders:', error)
        } finally {
            setLoading(false)
        }
    }, [page, search, status, paymentStatus, startDate, endDate])

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchOrders()
        }, 300)
        return () => clearTimeout(timer)
    }, [fetchOrders])

    const handleStatusChange = async (orderId: string, newStatus: string) => {
        setActionLoading(true)
        try {
            const response = await updateAdminOrderStatus(orderId, { status: newStatus })
            if (response.success) {
                fetchOrders()
                if (selectedOrder?._id === orderId) {
                    setSelectedOrder({ ...selectedOrder, status: newStatus })
                }
            }
        } catch (error) {
            console.error('Failed to update status:', error)
        } finally {
            setActionLoading(false)
        }
    }

    const handleDelete = async (orderId: string) => {
        if (!confirm('Are you sure you want to delete this order?')) return
        setActionLoading(true)
        try {
            const response = await deleteAdminOrder(orderId)
            if (response.success) {
                fetchOrders()
                setShowDetailModal(false)
            }
        } catch (error) {
            console.error('Failed to delete order:', error)
        } finally {
            setActionLoading(false)
        }
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Orders</h1>
                    <p className="text-muted-foreground">Manage all customer orders</p>
                </div>
                <button
                    onClick={fetchOrders}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            {/* Filters */}
            <div className="bg-card rounded-xl border border-border p-4 space-y-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Filter className="w-4 h-4" />
                    <span className="font-medium">Filters</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search orders..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                    </div>
                    <select
                        value={status}
                        onChange={(e) => { setStatus(e.target.value); setPage(1) }}
                        className="px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary"
                    >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="processing">Processing</option>
                        <option value="delivered">Delivered</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                    <select
                        value={paymentStatus}
                        onChange={(e) => { setPaymentStatus(e.target.value); setPage(1) }}
                        className="px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary"
                    >
                        <option value="all">All Payment</option>
                        <option value="pending">Pending</option>
                        <option value="paid">Paid</option>
                        <option value="failed">Failed</option>
                        <option value="refunded">Refunded</option>
                    </select>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
                        className="px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary"
                        placeholder="Start Date"
                    />
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
                        className="px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary"
                        placeholder="End Date"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Order #</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Customer</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Amount</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Payment</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                                        <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                        No orders found
                                    </td>
                                </tr>
                            ) : (
                                orders.map((order) => (
                                    <tr key={order._id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3 font-mono text-sm">{order.orderNumber}</td>
                                        <td className="px-4 py-3">
                                            <div className="text-sm font-medium">{order.user?.name || 'N/A'}</div>
                                            <div className="text-xs text-muted-foreground">{order.user?.phone}</div>
                                        </td>
                                        <td className="px-4 py-3 font-semibold">₹{order.totalAmount?.toFixed(2)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
                                                {statusIcons[order.status]}
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${paymentStatusColors[order.paymentStatus]}`}>
                                                {order.paymentStatus}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(order.createdAt)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => { setSelectedOrder(order); setShowDetailModal(true) }}
                                                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                                                    title="View Details"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(order._id)}
                                                    className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
                                                    title="Delete"
                                                    disabled={actionLoading}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pagination.pages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                        <p className="text-sm text-muted-foreground">
                            Showing {((page - 1) * pagination.limit) + 1} - {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 hover:bg-muted rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm">Page {page} of {pagination.pages}</span>
                            <button
                                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                                disabled={page === pagination.pages}
                                className="p-2 hover:bg-muted rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {showDetailModal && selectedOrder && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-border flex items-center justify-between">
                            <h2 className="text-xl font-bold">Order Details</h2>
                            <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-muted rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-muted-foreground">Order Number</label>
                                    <p className="font-mono font-medium">{selectedOrder.orderNumber}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-muted-foreground">Date</label>
                                    <p>{formatDate(selectedOrder.createdAt)}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-muted-foreground">Customer</label>
                                    <p className="font-medium">{selectedOrder.user?.name}</p>
                                    <p className="text-sm text-muted-foreground">{selectedOrder.user?.phone}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-muted-foreground">Total Amount</label>
                                    <p className="text-xl font-bold text-primary">₹{selectedOrder.totalAmount?.toFixed(2)}</p>
                                </div>
                            </div>

                            <div>
                                <label className="text-sm text-muted-foreground">Delivery Address</label>
                                <p>{selectedOrder.deliveryAddress || 'N/A'}</p>
                            </div>

                            <div>
                                <label className="text-sm text-muted-foreground block mb-2">Order Status</label>
                                <select
                                    value={selectedOrder.status}
                                    onChange={(e) => handleStatusChange(selectedOrder._id, e.target.value)}
                                    disabled={actionLoading}
                                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary"
                                >
                                    <option value="pending">Pending</option>
                                    <option value="confirmed">Confirmed</option>
                                    <option value="processing">Processing</option>
                                    <option value="delivered">Delivered</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-sm text-muted-foreground block mb-2">Items</label>
                                <div className="space-y-2">
                                    {selectedOrder.items?.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                                            <div>
                                                <p className="font-medium">{item.name}</p>
                                                <p className="text-sm text-muted-foreground">₹{item.price} x {item.quantity}</p>
                                            </div>
                                            <p className="font-semibold">₹{item.total?.toFixed(2)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
