// File: src/pages/SellingEntriesPage.tsx
import { useState, useEffect, useCallback } from 'react'
import { Edit2, Trash2, Sun, Moon, X, User } from 'lucide-react'
import {
    getSellingEntries,
    getSellingMembersList,
    getAdminUsersList,
    updateSellingEntry,
    deleteSellingEntry,
    SellingEntry,
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

export function SellingEntriesPage() {
    const [entries, setEntries] = useState<SellingEntry[]>([])
    const [members, setMembers] = useState<SellingMember[]>([])
    const [users, setUsers] = useState<UserOption[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [total, setTotal] = useState(0)
    const [totals, setTotals] = useState({ morningQuantity: 0, eveningQuantity: 0, totalQuantity: 0, amount: 0 })

    // Filters
    const [memberId, setMemberId] = useState('')
    const [userId, setUserId] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [isPaid, setIsPaid] = useState('')

    // Edit modal
    const [editModalOpen, setEditModalOpen] = useState(false)
    const [editingEntry, setEditingEntry] = useState<SellingEntry | null>(null)
    const [editFormData, setEditFormData] = useState({
        morningQuantity: 0,
        eveningQuantity: 0,
        rate: 0,
        notes: '',
        isPaid: false
    })
    const [submitting, setSubmitting] = useState(false)

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

    const fetchEntries = useCallback(async () => {
        try {
            setLoading(true)
            const res = await getSellingEntries({
                page,
                limit: 20,
                memberId: memberId || undefined,
                userId: userId || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                isPaid: isPaid || undefined
            })
            if (res.success) {
                setEntries(res.response.data || [])
                setTotalPages(res.response.pagination?.pages || 1)
                setTotal(res.response.pagination?.total || 0)
                setTotals(res.response.totals || { morningQuantity: 0, eveningQuantity: 0, totalQuantity: 0, amount: 0 })
            }
        } catch (err) {
            console.error('Failed to fetch entries:', err)
        } finally {
            setLoading(false)
        }
    }, [page, memberId, userId, startDate, endDate, isPaid])

    useEffect(() => {
        fetchEntries()
    }, [fetchEntries])

    const openEditModal = (entry: SellingEntry) => {
        setEditingEntry(entry)
        setEditFormData({
            morningQuantity: entry.morningQuantity,
            eveningQuantity: entry.eveningQuantity,
            rate: entry.rate,
            notes: entry.notes || '',
            isPaid: entry.isPaid
        })
        setEditModalOpen(true)
    }

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingEntry) return

        try {
            setSubmitting(true)
            await updateSellingEntry(editingEntry._id, editFormData)
            setEditModalOpen(false)
            fetchEntries()
        } catch (err) {
            console.error('Failed to update entry:', err)
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this entry?')) return
        try {
            await deleteSellingEntry(id)
            fetchEntries()
        } catch (err) {
            console.error('Failed to delete entry:', err)
        }
    }

    const clearFilters = () => {
        setMemberId('')
        setUserId('')
        setStartDate('')
        setEndDate('')
        setIsPaid('')
        setPage(1)
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        })
    }

    const formatCurrency = (val: number) => `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

    const hasFilters = memberId || userId || startDate || endDate || isPaid

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Selling Entries</h1>
                    <p className="text-muted-foreground">View all milk selling entries</p>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span>Total: <span className="font-medium text-foreground">{total}</span> entries</span>
                    <span>Qty: <span className="font-medium text-foreground">{totals.totalQuantity.toFixed(2)} L</span></span>
                    <span>Amount: <span className="font-medium text-foreground">{formatCurrency(totals.amount)}</span></span>
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
                    <div className="min-w-[120px]">
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Status</label>
                        <select
                            value={isPaid}
                            onChange={e => { setIsPaid(e.target.value); setPage(1) }}
                            className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <option value="">All</option>
                            <option value="true">Paid</option>
                            <option value="false">Pending</option>
                        </select>
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
                <TableSkeleton rows={10} columns={10} />
            ) : entries.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-12 text-center">
                    <p className="text-muted-foreground">No entries found</p>
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
                                    <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">
                                        <div className="flex items-center justify-center gap-1">
                                            <Sun className="w-3.5 h-3.5 text-warning" />
                                            Morning
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">
                                        <div className="flex items-center justify-center gap-1">
                                            <Moon className="w-3.5 h-3.5 text-primary" />
                                            Evening
                                        </div>
                                    </th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Total Qty</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Rate</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Amount</th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Status</th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {entries.map(entry => {
                                    const totalQty = entry.morningQuantity + entry.eveningQuantity
                                    return (
                                        <tr key={entry._id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3 text-foreground">
                                                {formatDate(entry.date)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="font-medium text-foreground">
                                                    {entry.member?.name || 'Unknown'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                                    <User className="w-3.5 h-3.5" />
                                                    <span className="truncate max-w-[100px]">
                                                        {(entry as any).owner?.name || 'Unknown'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center text-muted-foreground">
                                                {entry.morningQuantity > 0 ? `${entry.morningQuantity} L` : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-center text-muted-foreground">
                                                {entry.eveningQuantity > 0 ? `${entry.eveningQuantity} L` : '—'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-foreground">
                                                {totalQty.toFixed(2)} L
                                            </td>
                                            <td className="px-4 py-3 text-right text-muted-foreground">
                                                ₹{entry.rate}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-foreground">
                                                {formatCurrency(entry.amount)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={cn(
                                                    'inline-flex px-2 py-0.5 text-xs font-medium rounded-full',
                                                    entry.isPaid
                                                        ? 'bg-success/20 text-success'
                                                        : 'bg-warning/20 text-warning'
                                                )}>
                                                    {entry.isPaid ? 'Paid' : 'Pending'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => openEditModal(entry)}
                                                        className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                                                        title="Edit"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(entry._id)}
                                                        className="p-2 hover:bg-destructive/10 rounded-lg transition-colors text-muted-foreground hover:text-destructive"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
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

            {/* Edit Modal */}
            {editModalOpen && editingEntry && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
                    <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 animate-fade-in">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-foreground">Edit Entry</h2>
                            <button
                                onClick={() => setEditModalOpen(false)}
                                className="p-2 hover:bg-muted rounded-lg transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <form onSubmit={handleEdit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                                        <Sun className="w-3.5 h-3.5 inline mr-1 text-warning" />
                                        Morning (L)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editFormData.morningQuantity}
                                        onChange={e => setEditFormData(f => ({ ...f, morningQuantity: parseFloat(e.target.value) || 0 }))}
                                        className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                                        <Moon className="w-3.5 h-3.5 inline mr-1 text-primary" />
                                        Evening (L)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={editFormData.eveningQuantity}
                                        onChange={e => setEditFormData(f => ({ ...f, eveningQuantity: parseFloat(e.target.value) || 0 }))}
                                        className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Rate (₹/L)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={editFormData.rate}
                                    onChange={e => setEditFormData(f => ({ ...f, rate: parseFloat(e.target.value) || 0 }))}
                                    className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Notes</label>
                                <input
                                    type="text"
                                    value={editFormData.notes}
                                    onChange={e => setEditFormData(f => ({ ...f, notes: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isPaid"
                                    checked={editFormData.isPaid}
                                    onChange={e => setEditFormData(f => ({ ...f, isPaid: e.target.checked }))}
                                    className="w-4 h-4 rounded border-border"
                                />
                                <label htmlFor="isPaid" className="text-sm font-medium text-muted-foreground">
                                    Mark as Paid
                                </label>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setEditModalOpen(false)}
                                    className="flex-1 px-4 py-2.5 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50"
                                >
                                    {submitting ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
} 