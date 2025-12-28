import { useState, useEffect, useCallback } from 'react'
import {
    Search,
    ChevronLeft,
    ChevronRight,
    Eye,
    X,
    Loader2,
    RefreshCw,
    Wallet,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    User,
    Truck,
    Phone,
    CreditCard,
} from 'lucide-react'
import { cn } from '../lib/utils'
import {
    getWithdrawalsAdmin,
    getWithdrawalStats,
    updateWithdrawalStatus,
    WithdrawalRequest,
    WithdrawalStats,
    Pagination,
} from '../lib/api'

const statusColors: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
    pending: { bg: 'bg-warning/10', text: 'text-warning', icon: Clock },
    processing: { bg: 'bg-primary/10', text: 'text-primary', icon: AlertCircle },
    completed: { bg: 'bg-success/10', text: 'text-success', icon: CheckCircle },
    rejected: { bg: 'bg-destructive/10', text: 'text-destructive', icon: XCircle },
}

const paymentMethodLabels: Record<string, string> = {
    upi: 'UPI',
    bank_transfer: 'Bank Transfer',
    paytm: 'Paytm',
    phonepe: 'PhonePe',
    googlepay: 'Google Pay',
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

function WithdrawalSkeleton() {
    return (
        <tr className="border-b border-border">
            <td className="p-4"><div className="h-4 w-28 skeleton rounded" /></td>
            <td className="p-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full skeleton" />
                    <div className="space-y-1">
                        <div className="h-4 w-24 skeleton rounded" />
                        <div className="h-3 w-16 skeleton rounded" />
                    </div>
                </div>
            </td>
            <td className="p-4"><div className="h-4 w-20 skeleton rounded" /></td>
            <td className="p-4"><div className="h-4 w-16 skeleton rounded" /></td>
            <td className="p-4"><div className="h-6 w-20 skeleton rounded-full" /></td>
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

interface WithdrawalDetailModalProps {
    withdrawal: WithdrawalRequest | null
    onClose: () => void
    onStatusUpdate: (id: string, status: string, adminNotes: string, transactionReference?: string, rejectionReason?: string) => void
    isUpdating: boolean
}

function WithdrawalDetailModal({ withdrawal, onClose, onStatusUpdate, isUpdating }: WithdrawalDetailModalProps) {
    const [adminNotes, setAdminNotes] = useState('')
    const [transactionReference, setTransactionReference] = useState('')
    const [rejectionReason, setRejectionReason] = useState('')
    const [selectedAction, setSelectedAction] = useState<'processing' | 'completed' | 'rejected' | null>(null)

    if (!withdrawal) return null

    const StatusIcon = statusColors[withdrawal.status]?.icon || Clock
    const isVendor = withdrawal.requesterType === 'vendor'

    const handleAction = (action: 'processing' | 'completed' | 'rejected') => {
        if (action === 'completed' && !transactionReference) {
            alert('Transaction reference is required for completion')
            return
        }
        if (action === 'rejected' && !rejectionReason) {
            alert('Rejection reason is required')
            return
        }
        onStatusUpdate(
            withdrawal._id,
            action,
            adminNotes,
            action === 'completed' ? transactionReference : undefined,
            action === 'rejected' ? rejectionReason : undefined
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
            <div
                className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
                    <div>
                        <h2 className="text-lg font-bold text-foreground">{withdrawal.requestId}</h2>
                        <p className="text-sm text-muted-foreground">
                            {new Date(withdrawal.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 space-y-6">
                    {/* Status & Type */}
                    <div className="flex flex-wrap gap-3">
                        <div className={cn('flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium', statusColors[withdrawal.status]?.bg, statusColors[withdrawal.status]?.text)}>
                            <StatusIcon className="w-4 h-4" />
                            {withdrawal.status.toUpperCase()}
                        </div>
                        <div className={cn('flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium', isVendor ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500')}>
                            {isVendor ? <User className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
                            {isVendor ? 'Vendor' : 'Delivery Partner'}
                        </div>
                    </div>

                    {/* Amount */}
                    <div className="bg-muted/50 rounded-xl p-4 text-center">
                        <p className="text-sm text-muted-foreground mb-1">Withdrawal Amount</p>
                        <p className="text-3xl font-bold text-foreground">{formatCurrency(withdrawal.amount)}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                            Balance Before: {formatCurrency(withdrawal.balanceBefore)}
                        </p>
                    </div>

                    {/* Requester Info */}
                    <div className="bg-muted/50 rounded-xl p-4">
                        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                            {isVendor ? <User className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
                            {isVendor ? 'Vendor Details' : 'Delivery Partner Details'}
                        </h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Name</span>
                                <span className="font-medium text-foreground">
                                    {withdrawal.user?.name || withdrawal.deliveryPartner?.name || 'N/A'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Phone</span>
                                <span className="font-medium text-foreground flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {withdrawal.user?.phone || withdrawal.deliveryPartner?.phone || 'N/A'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Payment Details */}
                    <div className="bg-muted/50 rounded-xl p-4">
                        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                            <CreditCard className="w-4 h-4" />
                            Payment Details ({paymentMethodLabels[withdrawal.paymentMethod] || withdrawal.paymentMethod})
                        </h3>
                        <div className="space-y-2 text-sm">
                            {withdrawal.paymentMethod === 'upi' && withdrawal.paymentDetails?.upiId && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">UPI ID</span>
                                    <span className="font-medium text-foreground font-mono">{withdrawal.paymentDetails.upiId}</span>
                                </div>
                            )}
                            {withdrawal.paymentMethod === 'bank_transfer' && (
                                <>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Account Holder</span>
                                        <span className="font-medium text-foreground">{withdrawal.paymentDetails?.accountHolderName}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Account Number</span>
                                        <span className="font-medium text-foreground font-mono">{withdrawal.paymentDetails?.accountNumber}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">IFSC Code</span>
                                        <span className="font-medium text-foreground font-mono">{withdrawal.paymentDetails?.ifscCode}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Bank Name</span>
                                        <span className="font-medium text-foreground">{withdrawal.paymentDetails?.bankName}</span>
                                    </div>
                                </>
                            )}
                            {['paytm', 'phonepe', 'googlepay'].includes(withdrawal.paymentMethod) && withdrawal.paymentDetails?.mobileNumber && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Mobile Number</span>
                                    <span className="font-medium text-foreground font-mono">{withdrawal.paymentDetails.mobileNumber}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Transaction Reference (if completed) */}
                    {withdrawal.transactionReference && (
                        <div className="bg-success/10 rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-success mb-2">Transaction Reference</h3>
                            <p className="font-mono text-foreground">{withdrawal.transactionReference}</p>
                        </div>
                    )}

                    {/* Rejection Reason (if rejected) */}
                    {withdrawal.rejectionReason && (
                        <div className="bg-destructive/10 rounded-xl p-4">
                            <h3 className="text-sm font-semibold text-destructive mb-2">Rejection Reason</h3>
                            <p className="text-foreground">{withdrawal.rejectionReason}</p>
                        </div>
                    )}

                    {/* Actions */}
                    {(withdrawal.status === 'pending' || withdrawal.status === 'processing') && (
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-foreground">Update Status</h3>

                            <div className="space-y-3">
                                <textarea
                                    value={adminNotes}
                                    onChange={(e) => setAdminNotes(e.target.value)}
                                    placeholder="Admin notes (optional)"
                                    className="w-full p-3 bg-muted border border-border rounded-lg text-sm resize-none"
                                    rows={2}
                                />

                                {selectedAction === 'completed' && (
                                    <input
                                        type="text"
                                        value={transactionReference}
                                        onChange={(e) => setTransactionReference(e.target.value)}
                                        placeholder="Transaction Reference ID *"
                                        className="w-full p-3 bg-muted border border-border rounded-lg text-sm"
                                    />
                                )}

                                {selectedAction === 'rejected' && (
                                    <textarea
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        placeholder="Rejection reason *"
                                        className="w-full p-3 bg-muted border border-border rounded-lg text-sm resize-none"
                                        rows={2}
                                    />
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {withdrawal.status === 'pending' && (
                                    <button
                                        onClick={() => {
                                            setSelectedAction('processing')
                                            handleAction('processing')
                                        }}
                                        disabled={isUpdating}
                                        className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                                    >
                                        {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Mark Processing'}
                                    </button>
                                )}
                                <button
                                    onClick={() => setSelectedAction('completed')}
                                    className={cn(
                                        'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                                        selectedAction === 'completed' ? 'bg-success text-white' : 'bg-success/10 text-success hover:bg-success/20'
                                    )}
                                >
                                    Complete
                                </button>
                                <button
                                    onClick={() => setSelectedAction('rejected')}
                                    className={cn(
                                        'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                                        selectedAction === 'rejected' ? 'bg-destructive text-white' : 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                                    )}
                                >
                                    Reject
                                </button>

                                {(selectedAction === 'completed' || selectedAction === 'rejected') && (
                                    <button
                                        onClick={() => handleAction(selectedAction)}
                                        disabled={isUpdating}
                                        className="px-4 py-2 rounded-lg text-sm font-medium bg-foreground text-background hover:opacity-90 transition-colors disabled:opacity-50"
                                    >
                                        {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export function WithdrawalsPage() {
    const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([])
    const [stats, setStats] = useState<WithdrawalStats | null>(null)
    const [pagination, setPagination] = useState<Pagination | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [statsLoading, setStatsLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [typeFilter, setTypeFilter] = useState('all')
    const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalRequest | null>(null)
    const [statusUpdating, setStatusUpdating] = useState(false)

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 400)
        return () => clearTimeout(timer)
    }, [search])

    const fetchStats = useCallback(async () => {
        setStatsLoading(true)
        try {
            const response = await getWithdrawalStats()
            if (response.success) {
                setStats(response.response)
            }
        } catch (err) {
            console.error('Failed to fetch stats:', err)
        } finally {
            setStatsLoading(false)
        }
    }, [])

    const fetchWithdrawals = useCallback(async (page = 1) => {
        setIsLoading(true)
        try {
            const response = await getWithdrawalsAdmin({
                page,
                limit: 10,
                search: debouncedSearch,
                status: statusFilter !== 'all' ? statusFilter : undefined,
                requesterType: typeFilter !== 'all' ? typeFilter : undefined,
            })
            if (response.success) {
                setWithdrawals(response.response.withdrawals)
                setPagination(response.response.pagination)
            }
        } catch (err) {
            console.error('Failed to fetch withdrawals:', err)
        } finally {
            setIsLoading(false)
        }
    }, [debouncedSearch, statusFilter, typeFilter])

    useEffect(() => {
        fetchStats()
    }, [fetchStats])

    useEffect(() => {
        fetchWithdrawals(1)
    }, [fetchWithdrawals])

    const handleStatusUpdate = async (id: string, status: string, adminNotes: string, transactionReference?: string, rejectionReason?: string) => {
        setStatusUpdating(true)
        try {
            const response = await updateWithdrawalStatus(id, status, adminNotes, transactionReference, rejectionReason)
            if (response.success) {
                setSelectedWithdrawal(null)
                fetchWithdrawals(pagination?.page || 1)
                fetchStats()
            } else {
                alert(response.message || 'Failed to update status')
            }
        } catch (err) {
            console.error('Failed to update status:', err)
            alert('Failed to update status')
        } finally {
            setStatusUpdating(false)
        }
    }

    const handlePageChange = (page: number) => {
        fetchWithdrawals(page)
    }

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground">Withdrawals</h1>
                    <p className="text-xs sm:text-sm text-muted-foreground">Manage withdrawal requests from vendors and delivery partners</p>
                </div>
                <button
                    onClick={() => { fetchWithdrawals(1); fetchStats() }}
                    className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors text-sm"
                >
                    <RefreshCw className="w-4 h-4" />
                    <span className="hidden sm:inline">Refresh</span>
                </button>
            </div>

            {/* Stats */}
            {statsLoading ? (
                <StatsSkeleton />
            ) : stats && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                    <StatCard
                        title="Pending"
                        value={stats.pending}
                        icon={Clock}
                        color="bg-warning/10 text-warning"
                        subValue={`₹${stats.pendingAmount?.toLocaleString() || 0}`}
                    />
                    <StatCard
                        title="Processing"
                        value={stats.processing}
                        icon={AlertCircle}
                        color="bg-primary/10 text-primary"
                        subValue={`₹${stats.processingAmount?.toLocaleString() || 0}`}
                    />
                    <StatCard
                        title="Completed"
                        value={stats.completed}
                        icon={CheckCircle}
                        color="bg-success/10 text-success"
                        subValue={`₹${stats.completedAmount?.toLocaleString() || 0}`}
                    />
                    <StatCard
                        title="Rejected"
                        value={stats.rejected}
                        icon={XCircle}
                        color="bg-destructive/10 text-destructive"
                        subValue={`₹${stats.rejectedAmount?.toLocaleString() || 0}`}
                    />
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search by ID, name, phone..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2.5 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="completed">Completed</option>
                    <option value="rejected">Rejected</option>
                </select>
                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="px-4 py-2.5 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                >
                    <option value="all">All Types</option>
                    <option value="vendor">Vendors</option>
                    <option value="delivery_partner">Delivery Partners</option>
                </select>
            </div>

            {/* Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                        <thead>
                            <tr className="border-b border-border bg-muted/50">
                                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Request ID</th>
                                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Requester</th>
                                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Amount</th>
                                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Method</th>
                                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                                <th className="text-left p-4 text-sm font-medium text-muted-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => <WithdrawalSkeleton key={i} />)
                            ) : withdrawals.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                                        <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                        <p>No withdrawal requests found</p>
                                    </td>
                                </tr>
                            ) : (
                                withdrawals.map((withdrawal) => {
                                    const StatusIcon = statusColors[withdrawal.status]?.icon || Clock
                                    const isVendor = withdrawal.requesterType === 'vendor'
                                    const requesterName = withdrawal.user?.name || withdrawal.deliveryPartner?.name || 'N/A'
                                    const requesterPhone = withdrawal.user?.phone || withdrawal.deliveryPartner?.phone || 'N/A'

                                    return (
                                        <tr key={withdrawal._id} className="border-b border-border hover:bg-muted/30 transition-colors">
                                            <td className="p-4">
                                                <span className="font-medium text-foreground font-mono text-sm">{withdrawal.requestId}</span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                                                        isVendor ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'
                                                    )}>
                                                        {isVendor ? <User className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-foreground truncate">{requesterName}</p>
                                                        <p className="text-xs text-muted-foreground">{requesterPhone}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="font-bold text-foreground">{formatCurrency(withdrawal.amount)}</span>
                                            </td>
                                            <td className="p-4">
                                                <span className="text-sm text-muted-foreground">
                                                    {paymentMethodLabels[withdrawal.paymentMethod] || withdrawal.paymentMethod}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className={cn(
                                                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
                                                    statusColors[withdrawal.status]?.bg,
                                                    statusColors[withdrawal.status]?.text
                                                )}>
                                                    <StatusIcon className="w-3.5 h-3.5" />
                                                    {withdrawal.status}
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm text-muted-foreground">
                                                {new Date(withdrawal.createdAt).toLocaleDateString('en-US', {
                                                    month: 'short', day: 'numeric', year: 'numeric'
                                                })}
                                            </td>
                                            <td className="p-4">
                                                <button
                                                    onClick={() => setSelectedWithdrawal(withdrawal)}
                                                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                                                >
                                                    <Eye className="w-5 h-5" />
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
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border">
                        <p className="text-sm text-muted-foreground">
                            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} requests
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handlePageChange(pagination.page - 1)}
                                disabled={pagination.page === 1}
                                className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                                    let page: number
                                    if (pagination.pages <= 5) {
                                        page = i + 1
                                    } else if (pagination.page <= 3) {
                                        page = i + 1
                                    } else if (pagination.page >= pagination.pages - 2) {
                                        page = pagination.pages - 4 + i
                                    } else {
                                        page = pagination.page - 2 + i
                                    }
                                    return (
                                        <button
                                            key={page}
                                            onClick={() => handlePageChange(page)}
                                            className={cn(
                                                'w-10 h-10 rounded-lg text-sm font-medium transition-colors',
                                                pagination.page === page
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'hover:bg-muted'
                                            )}
                                        >
                                            {page}
                                        </button>
                                    )
                                })}
                            </div>
                            <button
                                onClick={() => handlePageChange(pagination.page + 1)}
                                disabled={pagination.page === pagination.pages}
                                className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            <WithdrawalDetailModal
                withdrawal={selectedWithdrawal}
                onClose={() => setSelectedWithdrawal(null)}
                onStatusUpdate={handleStatusUpdate}
                isUpdating={statusUpdating}
            />
        </div>
    )
}
