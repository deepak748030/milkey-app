// File: src/pages/SellingMembersPage.tsx
import { useState, useEffect, useCallback } from 'react'
import { Search, Edit2, Trash2, Phone, MapPin, X, User } from 'lucide-react'
import {
    getSellingMembers,
    updateSellingMember,
    deleteSellingMember,
    getAdminUsersList,
    SellingMember,
    SellingMemberOwner
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

export function SellingMembersPage() {
    const [members, setMembers] = useState<SellingMember[]>([])
    const [users, setUsers] = useState<UserOption[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [total, setTotal] = useState(0)

    // Filters
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [userId, setUserId] = useState('')

    // Modal
    const [modalOpen, setModalOpen] = useState(false)
    const [editingMember, setEditingMember] = useState<SellingMember | null>(null)
    const [formData, setFormData] = useState({
        name: '',
        mobile: '',
        address: '',
        ratePerLiter: 50
    })
    const [submitting, setSubmitting] = useState(false)

    // Load users for filter dropdown
    useEffect(() => {
        getAdminUsersList()
            .then(res => {
                if (res.success) setUsers(res.response || [])
            })
            .catch(err => console.error('Failed to fetch users:', err))
    }, [])

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 300)
        return () => clearTimeout(timer)
    }, [search])

    const fetchMembers = useCallback(async () => {
        try {
            setLoading(true)
            const res = await getSellingMembers({
                search: debouncedSearch || undefined,
                userId: userId || undefined,
                page,
                limit: 20
            })
            if (res.success) {
                setMembers(res.response?.data || [])
                setTotalPages(res.response?.pagination?.pages || 1)
                setTotal(res.response?.pagination?.total || 0)
            }
        } catch (err) {
            console.error('Failed to fetch members:', err)
            setMembers([])
        } finally {
            setLoading(false)
        }
    }, [debouncedSearch, userId, page])

    useEffect(() => {
        fetchMembers()
    }, [fetchMembers])

    const openEditModal = (member: SellingMember) => {
        setEditingMember(member)
        setFormData({
            name: member.name || '',
            mobile: member.mobile || '',
            address: member.address || '',
            ratePerLiter: member.ratePerLiter || 50
        })
        setModalOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!editingMember || !formData.name || !formData.mobile) return

        try {
            setSubmitting(true)
            await updateSellingMember(editingMember._id, formData)
            setModalOpen(false)
            fetchMembers()
        } catch (err) {
            console.error('Failed to save member:', err)
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this member?')) return
        try {
            await deleteSellingMember(id)
            fetchMembers()
        } catch (err) {
            console.error('Failed to delete member:', err)
        }
    }

    const clearFilters = () => {
        setSearch('')
        setUserId('')
        setPage(1)
    }

    const formatCurrency = (val: number) => `₹${(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

    const getOwnerName = (owner: SellingMemberOwner | string | undefined | null): string => {
        if (!owner) return 'Unknown'
        if (typeof owner === 'string') return 'Unknown'
        return owner.name || 'Unknown'
    }

    const hasFilters = search || userId

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Selling Members</h1>
                    <p className="text-muted-foreground">Manage members for milk selling</p>
                </div>
                <div className="text-sm text-muted-foreground">
                    Total: <span className="font-medium text-foreground">{total}</span> members
                </div>
            </div>

            {/* Filters */}
            <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Search</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search by name or mobile..."
                                value={search}
                                onChange={e => { setSearch(e.target.value); setPage(1) }}
                                className="w-full pl-10 pr-4 py-2.5 bg-input border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>
                    </div>
                    <div className="min-w-[200px]">
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Owner</label>
                        <select
                            value={userId}
                            onChange={e => { setUserId(e.target.value); setPage(1) }}
                            className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <option value="">All Owners</option>
                            {users.map(u => (
                                <option key={u._id} value={u._id}>{u.name} - {u.phone}</option>
                            ))}
                        </select>
                    </div>
                    {hasFilters && (
                        <button
                            onClick={clearFilters}
                            className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                            Clear Filters
                        </button>
                    )}
                </div>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
                {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
                            <div className="h-5 bg-muted rounded w-32 mb-2" />
                            <div className="h-4 bg-muted rounded w-28 mb-3" />
                            <div className="grid grid-cols-2 gap-2">
                                <div className="h-12 bg-muted rounded" />
                                <div className="h-12 bg-muted rounded" />
                            </div>
                        </div>
                    ))
                ) : members.length === 0 ? (
                    <div className="bg-card border border-border rounded-xl p-8 text-center">
                        <p className="text-sm text-muted-foreground">No members found</p>
                    </div>
                ) : (
                    members.map(member => (
                        <div key={member._id} className="bg-card border border-border rounded-xl p-4">
                            <div className="flex items-start justify-between mb-2">
                                <p className="font-medium text-foreground">{member.name}</p>
                                <span className={cn(
                                    'font-medium text-sm',
                                    (member.sellingPaymentBalance || 0) > 0 ? 'text-destructive' :
                                        (member.sellingPaymentBalance || 0) < 0 ? 'text-success' : 'text-foreground'
                                )}>
                                    {formatCurrency(member.sellingPaymentBalance || 0)}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
                                <Phone className="w-3.5 h-3.5" />
                                {member.mobile}
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                                <div className="bg-muted/50 rounded-lg p-2">
                                    <p className="text-[10px] text-muted-foreground uppercase">Rate/L</p>
                                    <p className="font-medium text-foreground">₹{member.ratePerLiter || 0}</p>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-2">
                                    <p className="text-[10px] text-muted-foreground uppercase">Total Liters</p>
                                    <p className="font-medium text-foreground">{(member.totalLiters || 0).toFixed(2)} L</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-border">
                                <span className="text-xs text-muted-foreground">{getOwnerName(member.owner)}</span>
                                <div className="flex items-center gap-1">
                                    <button onClick={() => openEditModal(member)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                                        <Edit2 className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                    <button onClick={() => handleDelete(member._id)} className="p-2 hover:bg-destructive/10 rounded-lg transition-colors">
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Desktop Table */}
            {loading ? (
                <div className="hidden md:block"><TableSkeleton rows={10} columns={8} /></div>
            ) : members.length === 0 ? (
                <div className="hidden md:block bg-card border border-border rounded-xl p-12 text-center">
                    <p className="text-muted-foreground">No members found</p>
                </div>
            ) : (
                <div className="hidden md:block bg-card border border-border rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/50 border-b border-border">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Name</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Mobile</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Owner</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Address</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Rate/L</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Total Liters</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Balance</th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {members.map(member => (
                                    <tr key={member._id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3">
                                            <span className="font-medium text-foreground">{member.name}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                                <Phone className="w-3.5 h-3.5" />
                                                {member.mobile}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                                <User className="w-3.5 h-3.5" />
                                                <span className="truncate max-w-[120px]">
                                                    {getOwnerName(member.owner)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {member.address ? (
                                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                                    <MapPin className="w-3.5 h-3.5" />
                                                    <span className="truncate max-w-[150px]">{member.address}</span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground/50">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-foreground">
                                            ₹{member.ratePerLiter || 0}
                                        </td>
                                        <td className="px-4 py-3 text-right text-muted-foreground">
                                            {(member.totalLiters || 0).toFixed(2)} L
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={cn(
                                                'font-medium',
                                                (member.sellingPaymentBalance || 0) > 0 ? 'text-destructive' :
                                                    (member.sellingPaymentBalance || 0) < 0 ? 'text-success' : 'text-foreground'
                                            )}>
                                                {formatCurrency(member.sellingPaymentBalance || 0)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => openEditModal(member)}
                                                    className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(member._id)}
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

            {/* Edit Modal */}
            {modalOpen && editingMember && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
                    <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 animate-fade-in">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold text-foreground">Edit Member</h2>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="p-2 hover:bg-muted rounded-lg transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Name *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Mobile *</label>
                                <input
                                    type="text"
                                    value={formData.mobile}
                                    onChange={e => setFormData(f => ({ ...f, mobile: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Address</label>
                                <input
                                    type="text"
                                    value={formData.address}
                                    onChange={e => setFormData(f => ({ ...f, address: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Rate per Liter (₹)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.ratePerLiter}
                                    onChange={e => setFormData(f => ({ ...f, ratePerLiter: parseFloat(e.target.value) || 0 }))}
                                    className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="flex-1 px-4 py-2.5 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50"
                                >
                                    {submitting ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}