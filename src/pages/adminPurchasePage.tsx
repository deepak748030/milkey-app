import { useState, useEffect, useCallback } from 'react'
import {
    Search,
    Filter,
    Edit2,
    Trash2,
    ChevronLeft,
    ChevronRight,
    Milk,
    Sun,
    Moon,
    RefreshCw,
    X,
    Save
} from 'lucide-react'
import {
    getAdminMilkCollections,
    updateAdminMilkCollection,
    deleteAdminMilkCollection,
    getAdminUsersList,
    type AdminMilkCollection
} from '@/lib/api'

function SkeletonRow() {
    return (
        <tr className="animate-pulse">
            <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-24"></div></td>
            <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-32"></div></td>
            <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-16"></div></td>
            <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-12"></div></td>
            <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-12"></div></td>
            <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-14"></div></td>
            <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-14"></div></td>
            <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-20"></div></td>
            <td className="px-4 py-3"><div className="h-8 bg-muted rounded w-20"></div></td>
        </tr>
    )
}

export function AdminPurchasePage() {
    const [collections, setCollections] = useState<AdminMilkCollection[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [shift, setShift] = useState('all')
    const [isPaid, setIsPaid] = useState('all')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [userId, setUserId] = useState('')
    const [users, setUsers] = useState<{ _id: string; name: string; email: string; phone: string }[]>([])
    const [page, setPage] = useState(1)
    const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 10 })
    const [totals, setTotals] = useState({ quantity: 0, amount: 0 })
    const [selectedCollection, setSelectedCollection] = useState<AdminMilkCollection | null>(null)
    const [showEditModal, setShowEditModal] = useState(false)
    const [actionLoading, setActionLoading] = useState(false)
    const [editForm, setEditForm] = useState({
        quantity: '',
        fat: '',
        snf: '',
        rate: '',
        isPaid: false,
        notes: ''
    })

    const fetchUsers = useCallback(async () => {
        try {
            const response = await getAdminUsersList()
            if (response.success) {
                setUsers(response.response)
            }
        } catch (error) {
            console.error('Failed to fetch users:', error)
        }
    }, [])

    const fetchCollections = useCallback(async () => {
        setLoading(true)
        try {
            const response = await getAdminMilkCollections({
                page,
                limit: 10,
                search,
                shift: shift !== 'all' ? shift : undefined,
                isPaid: isPaid !== 'all' ? isPaid : undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                userId: userId || undefined
            })
            if (response.success) {
                setCollections(response.response.collections)
                setPagination(response.response.pagination)
                setTotals(response.response.totals)
            }
        } catch (error) {
            console.error('Failed to fetch collections:', error)
        } finally {
            setLoading(false)
        }
    }, [page, search, shift, isPaid, startDate, endDate, userId])

    useEffect(() => {
        fetchUsers()
    }, [fetchUsers])

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchCollections()
        }, 300)
        return () => clearTimeout(timer)
    }, [fetchCollections])

    const handleEdit = (collection: AdminMilkCollection) => {
        setSelectedCollection(collection)
        setEditForm({
            quantity: String(collection.quantity),
            fat: String(collection.fat || ''),
            snf: String(collection.snf || ''),
            rate: String(collection.rate),
            isPaid: collection.isPaid || false,
            notes: collection.notes || ''
        })
        setShowEditModal(true)
    }

    const handleSave = async () => {
        if (!selectedCollection) return
        setActionLoading(true)
        try {
            const response = await updateAdminMilkCollection(selectedCollection._id, {
                quantity: parseFloat(editForm.quantity),
                fat: editForm.fat ? parseFloat(editForm.fat) : undefined,
                snf: editForm.snf ? parseFloat(editForm.snf) : undefined,
                rate: parseFloat(editForm.rate),
                isPaid: editForm.isPaid,
                notes: editForm.notes
            })
            if (response.success) {
                fetchCollections()
                setShowEditModal(false)
            }
        } catch (error) {
            console.error('Failed to update collection:', error)
        } finally {
            setActionLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this collection?')) return
        setActionLoading(true)
        try {
            const response = await deleteAdminMilkCollection(id)
            if (response.success) {
                fetchCollections()
            }
        } catch (error) {
            console.error('Failed to delete collection:', error)
        } finally {
            setActionLoading(false)
        }
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        })
    }

    const clearFilters = () => {
        setSearch('')
        setShift('all')
        setIsPaid('all')
        setStartDate('')
        setEndDate('')
        setUserId('')
        setPage(1)
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Purchase History</h1>
                    <p className="text-muted-foreground">Milk collection records from all users</p>
                </div>
                <button
                    onClick={fetchCollections}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-card rounded-xl border border-border p-4">
                    <p className="text-sm text-muted-foreground">Total Records</p>
                    <p className="text-2xl font-bold">{pagination.total}</p>
                </div>
                <div className="bg-card rounded-xl border border-border p-4">
                    <p className="text-sm text-muted-foreground">Total Quantity</p>
                    <p className="text-2xl font-bold text-primary">{totals.quantity.toFixed(2)} L</p>
                </div>
                <div className="bg-card rounded-xl border border-border p-4">
                    <p className="text-sm text-muted-foreground">Total Amount</p>
                    <p className="text-2xl font-bold text-green-600">₹{totals.amount.toFixed(2)}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-card rounded-xl border border-border p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Filter className="w-4 h-4" />
                        <span className="font-medium">Filters</span>
                    </div>
                    <button
                        onClick={clearFilters}
                        className="text-sm text-primary hover:underline"
                    >
                        Clear All
                    </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by code..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                    </div>
                    <select
                        value={userId}
                        onChange={(e) => { setUserId(e.target.value); setPage(1) }}
                        className="px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary"
                    >
                        <option value="">All Users</option>
                        {users.map(user => (
                            <option key={user._id} value={user._id}>{user.name} ({user.phone})</option>
                        ))}
                    </select>
                    <select
                        value={shift}
                        onChange={(e) => { setShift(e.target.value); setPage(1) }}
                        className="px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary"
                    >
                        <option value="all">All Shifts</option>
                        <option value="morning">Morning</option>
                        <option value="evening">Evening</option>
                    </select>
                    <select
                        value={isPaid}
                        onChange={(e) => { setIsPaid(e.target.value); setPage(1) }}
                        className="px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary"
                    >
                        <option value="all">All Status</option>
                        <option value="true">Paid</option>
                        <option value="false">Unpaid</option>
                    </select>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
                        className="px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary"
                    />
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
                        className="px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Farmer</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Owner</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Shift</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">FAT</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">SNF</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Qty (L)</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Rate</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Amount</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Paid</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                            ) : collections.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="px-4 py-12 text-center text-muted-foreground">
                                        <Milk className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                        No collections found
                                    </td>
                                </tr>
                            ) : (
                                collections.map((collection) => (
                                    <tr key={collection._id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3 text-sm">{formatDate(collection.date)}</td>
                                        <td className="px-4 py-3">
                                            <div className="text-sm font-medium">{collection.purchaseFarmer?.name || collection.farmerCode}</div>
                                            <div className="text-xs text-muted-foreground">{collection.purchaseFarmer?.mobile}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-sm">{collection.owner?.name}</div>
                                            <div className="text-xs text-muted-foreground">{collection.owner?.phone}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${collection.shift === 'morning' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400'
                                                }`}>
                                                {collection.shift === 'morning' ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
                                                {collection.shift}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm">{collection.fat || '-'}</td>
                                        <td className="px-4 py-3 text-sm">{collection.snf || '-'}</td>
                                        <td className="px-4 py-3 text-sm font-medium">{collection.quantity}</td>
                                        <td className="px-4 py-3 text-sm">₹{collection.rate}</td>
                                        <td className="px-4 py-3 text-sm font-semibold text-green-600">₹{collection.amount?.toFixed(2)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${collection.isPaid
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                                }`}>
                                                {collection.isPaid ? 'Paid' : 'Unpaid'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleEdit(collection)}
                                                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(collection._id)}
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

            {/* Edit Modal */}
            {showEditModal && selectedCollection && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-xl w-full max-w-md">
                        <div className="p-6 border-b border-border flex items-center justify-between">
                            <h2 className="text-xl font-bold">Edit Collection</h2>
                            <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-muted rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Quantity (L)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={editForm.quantity}
                                        onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })}
                                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Rate (₹)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={editForm.rate}
                                        onChange={(e) => setEditForm({ ...editForm, rate: e.target.value })}
                                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">FAT</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={editForm.fat}
                                        onChange={(e) => setEditForm({ ...editForm, fat: e.target.value })}
                                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">SNF</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={editForm.snf}
                                        onChange={(e) => setEditForm({ ...editForm, snf: e.target.value })}
                                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Notes</label>
                                <textarea
                                    value={editForm.notes}
                                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                                    rows={2}
                                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isPaid"
                                    checked={editForm.isPaid}
                                    onChange={(e) => setEditForm({ ...editForm, isPaid: e.target.checked })}
                                    className="w-4 h-4 rounded border-border"
                                />
                                <label htmlFor="isPaid" className="text-sm font-medium">Mark as Paid</label>
                            </div>
                            <div className="bg-muted/30 rounded-lg p-3">
                                <p className="text-sm text-muted-foreground">Calculated Amount</p>
                                <p className="text-xl font-bold text-green-600">
                                    ₹{((parseFloat(editForm.quantity) || 0) * (parseFloat(editForm.rate) || 0)).toFixed(2)}
                                </p>
                            </div>
                        </div>
                        <div className="p-6 border-t border-border flex justify-end gap-3">
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={actionLoading}
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" />
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
