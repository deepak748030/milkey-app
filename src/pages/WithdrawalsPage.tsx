import { useState, useEffect, useMemo } from 'react'
import {
    getAllReferralWithdrawals,
    updateReferralWithdrawalStatus,
    AdminReferralWithdrawal,
    ReferralWithdrawalStats,
} from '../lib/api'
import { TableSkeleton } from '../components/TableSkeleton'
import { Pagination } from '../components/Pagination'
import {
    Search,
    RefreshCw,
    Wallet,
    Clock,
    CheckCircle,
    XCircle,
    CreditCard,
    Building2,
    Eye,
    X,
    Check,
    AlertCircle,
} from 'lucide-react'

export function WithdrawalsPage() {
    const [withdrawals, setWithdrawals] = useState<AdminReferralWithdrawal[]>([])
    const [stats, setStats] = useState<ReferralWithdrawalStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [selectedWithdrawal, setSelectedWithdrawal] = useState<AdminReferralWithdrawal | null>(null)
    const [adminNote, setAdminNote] = useState('')
    const [updating, setUpdating] = useState(false)

    const itemsPerPage = 15

    const fetchData = async () => {
        setLoading(true)
        try {
            const res = await getAllReferralWithdrawals({
                status: statusFilter,
                page: currentPage,
                limit: itemsPerPage,
            })
            const data = res.response || res
            if (data) {
                setWithdrawals(data.withdrawals || [])
                setTotalPages(data.totalPages || 1)
                setStats(data.stats || null)
            }
        } catch (error) {
            console.error('Error fetching withdrawals:', error)
            setWithdrawals([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [statusFilter, currentPage])

    const filteredWithdrawals = useMemo(() => {
        if (!search.trim()) return withdrawals
        const q = search.toLowerCase()
        return withdrawals.filter(
            (w) =>
                w.user?.name?.toLowerCase().includes(q) ||
                w.user?.email?.toLowerCase().includes(q) ||
                w.user?.phone?.includes(q)
        )
    }, [withdrawals, search])

    const handleUpdateStatus = async (status: 'approved' | 'rejected') => {
        if (!selectedWithdrawal) return
        setUpdating(true)
        try {
            const res = await updateReferralWithdrawalStatus(selectedWithdrawal._id, {
                status,
                adminNote,
            })
            if (res.success || res.response) {
                setSelectedWithdrawal(null)
                setAdminNote('')
                fetchData()
            }
        } catch (error) {
            console.error('Error updating withdrawal:', error)
        } finally {
            setUpdating(false)
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-success/10 text-success">
                        <CheckCircle className="w-3 h-3" />
                        Approved
                    </span>
                )
            case 'rejected':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
                        <XCircle className="w-3 h-3" />
                        Rejected
                    </span>
                )
            case 'cancelled':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                        <XCircle className="w-3 h-3" />
                        Cancelled
                    </span>
                )
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning">
                        <Clock className="w-3 h-3" />
                        Pending
                    </span>
                )
        }
    }

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    return (
        <div className="space-y-6">
            {/* Detail Modal */}
            {selectedWithdrawal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h3 className="text-lg font-semibold text-foreground">Withdrawal Details</h3>
                            <button
                                onClick={() => {
                                    setSelectedWithdrawal(null)
                                    setAdminNote('')
                                }}
                                className="p-1 hover:bg-muted rounded"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            {/* User Info */}
                            <div className="bg-muted/50 rounded-lg p-3">
                                <p className="text-sm text-muted-foreground mb-1">User</p>
                                <p className="font-medium text-foreground">{selectedWithdrawal.user?.name}</p>
                                <p className="text-sm text-muted-foreground">{selectedWithdrawal.user?.phone}</p>
                                <p className="text-sm text-muted-foreground">{selectedWithdrawal.user?.email}</p>
                            </div>

                            {/* Amount */}
                            <div className="bg-success/10 rounded-lg p-3 text-center">
                                <p className="text-sm text-muted-foreground mb-1">Amount</p>
                                <p className="text-2xl font-bold text-success">₹{selectedWithdrawal.amount.toLocaleString()}</p>
                            </div>

                            {/* Payment Details */}
                            <div className="bg-muted/50 rounded-lg p-3">
                                <p className="text-sm text-muted-foreground mb-2">Payment Method</p>
                                {selectedWithdrawal.paymentMethod === 'upi' ? (
                                    <div className="flex items-center gap-2">
                                        <CreditCard className="w-4 h-4 text-primary" />
                                        <span className="font-medium">UPI: {selectedWithdrawal.upiId}</span>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Building2 className="w-4 h-4 text-primary" />
                                            <span className="font-medium">Bank Transfer</span>
                                        </div>
                                        <p className="text-sm">
                                            <span className="text-muted-foreground">Name:</span>{' '}
                                            {selectedWithdrawal.bankDetails?.accountHolderName}
                                        </p>
                                        <p className="text-sm">
                                            <span className="text-muted-foreground">A/C:</span>{' '}
                                            {selectedWithdrawal.bankDetails?.accountNumber}
                                        </p>
                                        <p className="text-sm">
                                            <span className="text-muted-foreground">IFSC:</span>{' '}
                                            {selectedWithdrawal.bankDetails?.ifscCode}
                                        </p>
                                        {selectedWithdrawal.bankDetails?.bankName && (
                                            <p className="text-sm">
                                                <span className="text-muted-foreground">Bank:</span>{' '}
                                                {selectedWithdrawal.bankDetails.bankName}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Status */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-muted-foreground">Status</span>
                                {getStatusBadge(selectedWithdrawal.status)}
                            </div>

                            {/* Date */}
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Requested</span>
                                <span className="text-foreground">{formatDate(selectedWithdrawal.createdAt)}</span>
                            </div>

                            {selectedWithdrawal.processedAt && (
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Processed</span>
                                    <span className="text-foreground">{formatDate(selectedWithdrawal.processedAt)}</span>
                                </div>
                            )}

                            {selectedWithdrawal.adminNote && (
                                <div className="bg-muted/50 rounded-lg p-3">
                                    <p className="text-sm text-muted-foreground mb-1">Admin Note</p>
                                    <p className="text-sm text-foreground">{selectedWithdrawal.adminNote}</p>
                                </div>
                            )}

                            {/* Actions for pending */}
                            {selectedWithdrawal.status === 'pending' && (
                                <div className="space-y-3 pt-2 border-t border-border">
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">Admin Note (Optional)</label>
                                        <textarea
                                            value={adminNote}
                                            onChange={(e) => setAdminNote(e.target.value)}
                                            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm resize-none"
                                            rows={2}
                                            placeholder="Add a note..."
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleUpdateStatus('approved')}
                                            disabled={updating}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-success text-white rounded-lg hover:bg-success/90 disabled:opacity-50"
                                        >
                                            <Check className="w-4 h-4" />
                                            Approve
                                        </button>
                                        <button
                                            onClick={() => handleUpdateStatus('rejected')}
                                            disabled={updating}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-destructive text-white rounded-lg hover:bg-destructive/90 disabled:opacity-50"
                                        >
                                            <X className="w-4 h-4" />
                                            Reject
                                        </button>
                                    </div>
                                    <div className="flex items-start gap-2 p-2 bg-warning/10 rounded-lg">
                                        <AlertCircle className="w-4 h-4 text-warning mt-0.5" />
                                        <p className="text-xs text-warning">
                                            Rejecting will refund the amount to user's balance
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Withdrawals</h1>
                    <p className="text-muted-foreground text-sm">Manage user withdrawal requests</p>
                </div>
                <button
                    onClick={fetchData}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                            <Clock className="w-5 h-5 text-warning" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Pending</p>
                            <p className="text-xl font-bold text-foreground">{stats?.pending?.count || 0}</p>
                            <p className="text-xs text-warning">₹{(stats?.pending?.total || 0).toLocaleString()}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-success" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Approved</p>
                            <p className="text-xl font-bold text-foreground">{stats?.approved?.count || 0}</p>
                            <p className="text-xs text-success">₹{(stats?.approved?.total || 0).toLocaleString()}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                            <XCircle className="w-5 h-5 text-destructive" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Rejected</p>
                            <p className="text-xl font-bold text-foreground">{stats?.rejected?.count || 0}</p>
                            <p className="text-xs text-destructive">₹{(stats?.rejected?.total || 0).toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search by name, email, phone..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => {
                        setStatusFilter(e.target.value)
                        setCurrentPage(1)
                    }}
                    className="px-4 py-2 bg-card border border-border rounded-lg text-foreground"
                >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                </select>
            </div>

            {/* Table */}
            {loading ? (
                <TableSkeleton rows={8} columns={6} />
            ) : filteredWithdrawals.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-12 text-center">
                    <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No withdrawal requests found</p>
                </div>
            ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">User</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Amount</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Method</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
                                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Date</th>
                                    <th className="text-right px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredWithdrawals.map((w) => (
                                    <tr key={w._id} className="hover:bg-muted/30">
                                        <td className="px-4 py-3">
                                            <div>
                                                <p className="font-medium text-foreground">{w.user?.name || 'N/A'}</p>
                                                <p className="text-xs text-muted-foreground">{w.user?.phone}</p>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="font-semibold text-foreground">₹{w.amount.toLocaleString()}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                {w.paymentMethod === 'upi' ? (
                                                    <>
                                                        <CreditCard className="w-4 h-4 text-primary" />
                                                        <span className="text-sm">UPI</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Building2 className="w-4 h-4 text-primary" />
                                                        <span className="text-sm">Bank</span>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">{getStatusBadge(w.status)}</td>
                                        <td className="px-4 py-3 text-sm text-muted-foreground">
                                            {formatDate(w.createdAt)}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => setSelectedWithdrawal(w)}
                                                className="p-2 hover:bg-muted rounded-lg text-primary"
                                                title="View Details"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <Pagination
                    page={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            )}
        </div>
    )
}