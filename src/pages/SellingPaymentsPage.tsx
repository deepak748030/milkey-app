// File: src/pages/SellingPaymentsPage.tsx
import { useState, useEffect, useCallback } from 'react'
import { Eye, CreditCard, Banknote, Building, FileText, Trash2, User } from 'lucide-react'
import {
    getMemberPayments,
    getSellingMembersList,
    getAdminUsersList,
    deleteMemberPayment,
    MemberPayment,
    SellingMember
} from '../lib/api'
import { TableSkeleton } from '../components/TableSkeleton'
import { Pagination } from '../components/Pagination'
import { cn } from '../lib/utils'

interface UserOption {
    _id: string
    name: string
    email: string
    phone: string
}

const paymentMethodIcons: Record<string, React.ReactNode> = {
    cash: <Banknote className="w-4 h-4" />,
    upi: <CreditCard className="w-4 h-4" />,
    bank: <Building className="w-4 h-4" />,
    cheque: <FileText className="w-4 h-4" />
}

export function SellingPaymentsPage() {
    const [payments, setPayments] = useState<MemberPayment[]>([])
    const [members, setMembers] = useState<SellingMember[]>([])
    const [users, setUsers] = useState<UserOption[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [total, setTotal] = useState(0)
    const [totals, setTotals] = useState({ amount: 0, sellAmount: 0, quantity: 0 })

    // Filters
    const [memberId, setMemberId] = useState('')
    const [userId, setUserId] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    // Detail modal
    const [selectedPayment, setSelectedPayment] = useState<MemberPayment | null>(null)

    // Load users for filter dropdown
    useEffect(() => {
        getAdminUsersList().then(res => {
            if (res.success) setUsers(res.response || [])
        }).catch(console.error)
    }, [])

    // Load members for filter dropdown
    useEffect(() => {
        getSellingMembersList({ userId: userId || undefined }).then(res => {
            if (res.success) setMembers(res.response || [])
        }).catch(console.error)
    }, [userId])

    const fetchPayments = useCallback(async () => {
        try {
            setLoading(true)
            const res = await getMemberPayments({
                page,
                limit: 20,
                memberId: memberId || undefined,
                userId: userId || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined
            })
            if (res.success) {
                setPayments(res.response.data || [])
                setTotalPages(res.response.pagination?.pages || 1)
                setTotal(res.response.pagination?.total || 0)
                setTotals(res.response.totals || { amount: 0, sellAmount: 0, quantity: 0 })
            }
        } catch (err) {
            console.error('Failed to fetch payments:', err)
        } finally {
            setLoading(false)
        }
    }, [page, memberId, userId, startDate, endDate])

    useEffect(() => {
        fetchPayments()
    }, [fetchPayments])

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this payment? This will restore the entries to unpaid.')) return
        try {
            await deleteMemberPayment(id)
            fetchPayments()
        } catch (err) {
            console.error('Failed to delete payment:', err)
        }
    }

    const clearFilters = () => {
        setMemberId('')
        setUserId('')
        setStartDate('')
        setEndDate('')
        setPage(1)
    }

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—'
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        })
    }

    const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

    const hasFilters = memberId || userId || startDate || endDate

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Selling Payments</h1>
                    <p className="text-muted-foreground">View all member payment records</p>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span>Total: <span className="font-medium text-foreground">{total}</span> payments</span>
                    <span>Paid: <span className="font-medium text-success">{formatCurrency(totals.amount)}</span></span>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="min-w-[180px]">
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Owner</label>
                        <select
                            value={userId}
                            onChange={e => { setUserId(e.target.value); setMemberId(''); setPage(1) }}
                            className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <option value="">All Owners</option>
                            {users.map(u => (
                                <option key={u._id} value={u._id}>{u.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="min-w-[180px]">
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Member</label>
                        <select
                            value={memberId}
                            onChange={e => { setMemberId(e.target.value); setPage(1) }}
                            className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <option value="">All Members</option>
                            {members.map(m => (
                                <option key={m._id} value={m._id}>{m.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="min-w-[140px]">
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">From Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => { setStartDate(e.target.value); setPage(1) }}
                            className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    </div>
                    <div className="min-w-[140px]">
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">To Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => { setEndDate(e.target.value); setPage(1) }}
                            className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    </div>
                    {hasFilters && (
                        <button
                            onClick={clearFilters}
                            className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <TableSkeleton rows={10} columns={11} />
            ) : payments.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-12 text-center">
                    <p className="text-muted-foreground">No payments found</p>
                </div>
            ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/50 border-b border-border">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Member</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Owner</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Period</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Quantity</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Rate</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Milk Amount</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Paid</th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Method</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Balance</th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {payments.map(payment => (
                                    <tr key={payment._id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3 text-foreground">
                                            {formatDate(payment.date)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="font-medium text-foreground">
                                                {payment.member?.name || 'Unknown'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                                <User className="w-3.5 h-3.5" />
                                                <span className="truncate max-w-[100px]">
                                                    {(payment as any).owner?.name || 'Unknown'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-muted-foreground">
                                            {payment.periodStart && payment.periodEnd ? (
                                                <span>{formatDate(payment.periodStart)} - {formatDate(payment.periodEnd)}</span>
                                            ) : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right text-muted-foreground">
                                            {payment.totalQuantity?.toFixed(2) || 0} L
                                        </td>
                                        <td className="px-4 py-3 text-right text-muted-foreground">
                                            ₹{payment.milkRate?.toFixed(2) || 0}
                                        </td>
                                        <td className="px-4 py-3 text-right text-muted-foreground">
                                            {formatCurrency(payment.totalSellAmount)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-success">
                                            {formatCurrency(payment.amount)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-1.5 text-muted-foreground capitalize">
                                                {paymentMethodIcons[payment.paymentMethod] || null}
                                                <span className="text-sm">{payment.paymentMethod}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={cn(
                                                'font-medium',
                                                payment.closingBalance > 0 ? 'text-destructive' :
                                                    payment.closingBalance < 0 ? 'text-success' : 'text-foreground'
                                            )}>
                                                {formatCurrency(payment.closingBalance)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => setSelectedPayment(payment)}
                                                    className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                                                    title="View Details"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(payment._id)}
                                                    className="p-2 hover:bg-destructive/10 rounded-lg transition-colors text-muted-foreground hover:text-destructive"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Pagination */}
            <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
            />

            {/* Detail Modal */}
            {selectedPayment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setSelectedPayment(null)}>
                    <div className="bg-card border border-border rounded-xl w-full max-w-lg p-6 animate-fade-in" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-semibold text-foreground mb-4">Payment Details</h2>
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Member</span>
                                <span className="font-medium text-foreground">{selectedPayment.member?.name || 'Unknown'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Owner</span>
                                <span className="text-foreground">{(selectedPayment as any).owner?.name || 'Unknown'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Payment Date</span>
                                <span className="text-foreground">{formatDate(selectedPayment.date)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Period</span>
                                <span className="text-foreground">
                                    {selectedPayment.periodStart && selectedPayment.periodEnd
                                        ? `${formatDate(selectedPayment.periodStart)} - ${formatDate(selectedPayment.periodEnd)}`
                                        : '—'}
                                </span>
                            </div>
                            <hr className="border-border" />
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Total Quantity</span>
                                <span className="text-foreground">{selectedPayment.totalQuantity?.toFixed(2) || 0} L</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Rate / Liter</span>
                                <span className="text-foreground">₹{selectedPayment.milkRate?.toFixed(2) || 0}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Milk Amount</span>
                                <span className="text-foreground">{formatCurrency(selectedPayment.totalSellAmount)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Previous Balance</span>
                                <span className="text-foreground">{formatCurrency(selectedPayment.previousBalance)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Net Payable</span>
                                <span className="text-foreground">{formatCurrency(selectedPayment.netPayable)}</span>
                            </div>
                            <hr className="border-border" />
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Amount Paid</span>
                                <span className="font-semibold text-success">{formatCurrency(selectedPayment.amount)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Payment Method</span>
                                <span className="text-foreground capitalize">{selectedPayment.paymentMethod}</span>
                            </div>
                            {selectedPayment.reference && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Reference</span>
                                    <span className="text-foreground">{selectedPayment.reference}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Closing Balance</span>
                                <span className={cn(
                                    'font-semibold',
                                    selectedPayment.closingBalance > 0 ? 'text-destructive' :
                                        selectedPayment.closingBalance < 0 ? 'text-success' : 'text-foreground'
                                )}>
                                    {formatCurrency(selectedPayment.closingBalance)}
                                </span>
                            </div>
                            {selectedPayment.notes && (
                                <>
                                    <hr className="border-border" />
                                    <div>
                                        <span className="text-muted-foreground text-sm">Notes:</span>
                                        <p className="text-foreground mt-1">{selectedPayment.notes}</p>
                                    </div>
                                </>
                            )}
                        </div>
                        <button
                            onClick={() => setSelectedPayment(null)}
                            className="w-full mt-6 px-4 py-2.5 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors font-medium"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}