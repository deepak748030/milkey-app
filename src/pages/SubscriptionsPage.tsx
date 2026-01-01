import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, X, CreditCard } from 'lucide-react'
import {
    getSubscriptions,
    createSubscription,
    updateSubscription,
    deleteSubscription,
    toggleSubscriptionStatus,
    Subscription
} from '../lib/api'
import { TableSkeleton } from '../components/TableSkeleton'
import { Pagination } from '../components/Pagination'
import { cn } from '../lib/utils'

const TAB_OPTIONS = [
    { value: 'purchase', label: 'Purchase' },
    { value: 'selling', label: 'Selling' },
    { value: 'register', label: 'Register' }
]

export function SubscriptionsPage() {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [tabFilter, setTabFilter] = useState('all')

    // Modal state
    const [showModal, setShowModal] = useState(false)
    const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null)
    const [formData, setFormData] = useState({
        name: '',
        amount: '',
        durationMonths: '',
        applicableTabs: [] as string[],
        description: '',
        isFree: false,
        forNewUsers: false
    })
    const [submitting, setSubmitting] = useState(false)

    const fetchSubscriptions = async () => {
        try {
            setLoading(true)
            const res = await getSubscriptions({
                page,
                limit: 10,
                search,
                status: statusFilter,
                tab: tabFilter
            })
            if (res.success) {
                setSubscriptions(res.response.subscriptions || [])
                setTotalPages(res.response.pagination?.pages || 1)
            }
        } catch (err) {
            console.error('Failed to fetch subscriptions:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchSubscriptions()
    }, [page, search, statusFilter, tabFilter])

    const openCreateModal = () => {
        setEditingSubscription(null)
        setFormData({
            name: '',
            amount: '',
            durationMonths: '',
            applicableTabs: [],
            description: '',
            isFree: false,
            forNewUsers: false
        })
        setShowModal(true)
    }

    const openEditModal = (subscription: Subscription) => {
        setEditingSubscription(subscription)
        setFormData({
            name: subscription.name,
            amount: String(subscription.amount),
            durationMonths: String(subscription.durationMonths),
            applicableTabs: subscription.applicableTabs || [],
            description: subscription.description || '',
            isFree: subscription.isFree || false,
            forNewUsers: subscription.forNewUsers || false
        })
        setShowModal(true)
    }

    const handleTabToggle = (tab: string) => {
        setFormData(prev => ({
            ...prev,
            applicableTabs: prev.applicableTabs.includes(tab)
                ? prev.applicableTabs.filter(t => t !== tab)
                : [...prev.applicableTabs, tab]
        }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name.trim() || formData.applicableTabs.length === 0) {
            alert('Please fill all required fields')
            return
        }

        // Amount is required only if not free
        if (!formData.isFree && !formData.amount) {
            alert('Please enter an amount or mark as free')
            return
        }

        if (!formData.durationMonths) {
            alert('Please enter duration')
            return
        }

        try {
            setSubmitting(true)
            const payload = {
                name: formData.name.trim(),
                amount: formData.isFree ? 0 : Number(formData.amount),
                durationMonths: Number(formData.durationMonths),
                applicableTabs: formData.applicableTabs,
                description: formData.description.trim(),
                isFree: formData.isFree,
                forNewUsers: formData.forNewUsers
            }

            if (editingSubscription) {
                await updateSubscription(editingSubscription._id, payload)
            } else {
                await createSubscription(payload)
            }

            setShowModal(false)
            fetchSubscriptions()
        } catch (err) {
            console.error('Failed to save subscription:', err)
            alert('Failed to save subscription')
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this subscription?')) return
        try {
            await deleteSubscription(id)
            fetchSubscriptions()
        } catch (err) {
            console.error('Failed to delete subscription:', err)
            alert('Failed to delete subscription')
        }
    }

    const handleToggleStatus = async (id: string) => {
        try {
            await toggleSubscriptionStatus(id)
            fetchSubscriptions()
        } catch (err) {
            console.error('Failed to toggle status:', err)
        }
    }

    const formatAmount = (amount: number, isFree?: boolean) => {
        if (isFree || amount === 0) return 'FREE'
        return `₹${amount.toLocaleString('en-IN')}`
    }

    const formatDuration = (months: number) => {
        if (months === 1) return '1 Month'
        if (months === 12) return '1 Year'
        if (months > 12 && months % 12 === 0) return `${months / 12} Years`
        return `${months} Months`
    }

    const getTabBadge = (tab: string) => {
        const colors: Record<string, string> = {
            purchase: 'bg-blue-500/20 text-blue-700 dark:text-blue-300',
            selling: 'bg-green-500/20 text-green-700 dark:text-green-300',
            register: 'bg-purple-500/20 text-purple-700 dark:text-purple-300'
        }
        return colors[tab] || 'bg-muted text-muted-foreground'
    }

    const getTypeBadge = (sub: Subscription) => {
        if (sub.isFree) return 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
        if (sub.applicableTabs?.length > 1) return 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300'
        return 'bg-muted text-muted-foreground'
    }

    const getTypeLabel = (sub: Subscription) => {
        if (sub.isFree) return 'Free'
        if (sub.applicableTabs?.length > 1) return 'Combined'
        return 'Single'
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Subscriptions</h1>
                    <p className="text-muted-foreground">Manage subscription plans</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Add Subscription
                </button>
            </div>

            {/* Filters */}
            <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Search</label>
                        <input
                            type="text"
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1) }}
                            placeholder="Search subscriptions..."
                            className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    </div>
                    <div className="min-w-[150px]">
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Status</label>
                        <select
                            value={statusFilter}
                            onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
                            className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                    <div className="min-w-[150px]">
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Tab</label>
                        <select
                            value={tabFilter}
                            onChange={e => { setTabFilter(e.target.value); setPage(1) }}
                            className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <option value="all">All Tabs</option>
                            <option value="purchase">Purchase</option>
                            <option value="selling">Selling</option>
                            <option value="register">Register</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
                            <div className="h-5 bg-muted rounded w-32 mb-2" />
                            <div className="h-4 bg-muted rounded w-20 mb-3" />
                            <div className="flex gap-2">
                                <div className="h-6 bg-muted rounded-full w-16" />
                                <div className="h-6 bg-muted rounded-full w-16" />
                            </div>
                        </div>
                    ))
                ) : subscriptions.length === 0 ? (
                    <div className="bg-card border border-border rounded-xl p-8 text-center">
                        <CreditCard className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                        <p className="text-sm text-muted-foreground">No subscriptions found</p>
                    </div>
                ) : (
                    subscriptions.map(sub => (
                        <div key={sub._id} className="bg-card border border-border rounded-xl p-4">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <p className="font-medium text-foreground">{sub.name}</p>
                                    {sub.description && (
                                        <p className="text-xs text-muted-foreground line-clamp-1">{sub.description}</p>
                                    )}
                                </div>
                                <span className={cn(
                                    'px-2 py-0.5 rounded-full text-xs font-medium',
                                    sub.isActive ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
                                )}>
                                    {sub.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                                <div className="bg-muted/50 rounded-lg p-2">
                                    <p className="text-[10px] text-muted-foreground uppercase">Amount</p>
                                    <p className={cn("text-sm font-semibold", sub.isFree ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>{formatAmount(sub.amount, sub.isFree)}</p>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-2">
                                    <p className="text-[10px] text-muted-foreground uppercase">Duration</p>
                                    <p className="text-sm font-medium text-foreground">{formatDuration(sub.durationMonths)}</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-1 mb-2">
                                <span className={cn('px-2 py-0.5 rounded text-xs font-medium', getTypeBadge(sub))}>
                                    {getTypeLabel(sub)}
                                </span>
                                {sub.forNewUsers && (
                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-pink-500/20 text-pink-700 dark:text-pink-300">
                                        New Users
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-1 mb-3">
                                {sub.applicableTabs?.map(tab => (
                                    <span key={tab} className={cn('px-2 py-0.5 rounded text-xs font-medium capitalize', getTabBadge(tab))}>
                                        {tab}
                                    </span>
                                ))}
                            </div>
                            <div className="flex items-center justify-end gap-1 pt-2 border-t border-border">
                                <button
                                    onClick={() => handleToggleStatus(sub._id)}
                                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                                >
                                    {sub.isActive ? (
                                        <ToggleRight className="w-5 h-5 text-success" />
                                    ) : (
                                        <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                                    )}
                                </button>
                                <button onClick={() => openEditModal(sub)} className="p-2 rounded-lg hover:bg-muted transition-colors">
                                    <Edit2 className="w-5 h-5 text-muted-foreground" />
                                </button>
                                <button onClick={() => handleDelete(sub._id)} className="p-2 rounded-lg hover:bg-destructive/10 transition-colors">
                                    <Trash2 className="w-5 h-5 text-destructive" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Desktop Table */}
            {loading ? (
                <div className="hidden md:block"><TableSkeleton rows={5} columns={6} /></div>
            ) : subscriptions.length === 0 ? (
                <div className="hidden md:block bg-card border border-border rounded-xl p-12 text-center">
                    <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No subscriptions found</p>
                </div>
            ) : (
                <div className="hidden md:block bg-card border border-border rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/50 border-b border-border">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Name</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Type</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Amount</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Duration</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Tabs</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {subscriptions.map(sub => (
                                    <tr key={sub._id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3">
                                            <div>
                                                <span className="font-medium text-foreground">{sub.name}</span>
                                                {sub.description && (
                                                    <p className="text-sm text-muted-foreground truncate max-w-[200px]">{sub.description}</p>
                                                )}
                                                {sub.forNewUsers && (
                                                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium bg-pink-500/20 text-pink-700 dark:text-pink-300">
                                                        For New Users
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={cn('px-2 py-1 rounded text-xs font-medium', getTypeBadge(sub))}>
                                                {getTypeLabel(sub)}
                                            </span>
                                        </td>
                                        <td className={cn("px-4 py-3 font-semibold", sub.isFree ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>
                                            {formatAmount(sub.amount, sub.isFree)}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {formatDuration(sub.durationMonths)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-1">
                                                {sub.applicableTabs?.map(tab => (
                                                    <span key={tab} className={cn('px-2 py-0.5 rounded text-xs font-medium capitalize', getTabBadge(tab))}>
                                                        {tab}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={cn(
                                                'px-2 py-1 rounded-full text-xs font-medium',
                                                sub.isActive ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
                                            )}>
                                                {sub.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleToggleStatus(sub._id)}
                                                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                                                    title={sub.isActive ? 'Deactivate' : 'Activate'}
                                                >
                                                    {sub.isActive ? (
                                                        <ToggleRight className="w-5 h-5 text-success" />
                                                    ) : (
                                                        <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(sub)}
                                                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-5 h-5 text-muted-foreground" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(sub._id)}
                                                    className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-5 h-5 text-destructive" />
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
            {totalPages > 1 && (
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-card border border-border rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h2 className="text-lg font-semibold text-foreground">
                                {editingSubscription ? 'Edit Subscription' : 'Add Subscription'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-muted rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Name *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="e.g., Monthly Premium"
                                    className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                    required
                                />
                            </div>

                            {/* Free subscription toggle */}
                            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                <div>
                                    <p className="text-sm font-medium text-foreground">Free Subscription</p>
                                    <p className="text-xs text-muted-foreground">No payment required</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, isFree: !prev.isFree, amount: prev.isFree ? prev.amount : '0' }))}
                                    className={cn(
                                        'w-12 h-6 rounded-full transition-colors relative',
                                        formData.isFree ? 'bg-primary' : 'bg-muted'
                                    )}
                                >
                                    <span className={cn(
                                        'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                                        formData.isFree ? 'translate-x-7' : 'translate-x-1'
                                    )} />
                                </button>
                            </div>

                            {/* For new users toggle */}
                            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                                <div>
                                    <p className="text-sm font-medium text-foreground">For New Users</p>
                                    <p className="text-xs text-muted-foreground">Available to new signups</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, forNewUsers: !prev.forNewUsers }))}
                                    className={cn(
                                        'w-12 h-6 rounded-full transition-colors relative',
                                        formData.forNewUsers ? 'bg-primary' : 'bg-muted'
                                    )}
                                >
                                    <span className={cn(
                                        'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                                        formData.forNewUsers ? 'translate-x-7' : 'translate-x-1'
                                    )} />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Amount (₹) {!formData.isFree && '*'}</label>
                                    <input
                                        type="number"
                                        value={formData.isFree ? '0' : formData.amount}
                                        onChange={e => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                                        placeholder="0"
                                        min="0"
                                        disabled={formData.isFree}
                                        className={cn(
                                            "w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring",
                                            formData.isFree && "opacity-50 cursor-not-allowed"
                                        )}
                                        required={!formData.isFree}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Duration (Months) *</label>
                                    <input
                                        type="number"
                                        value={formData.durationMonths}
                                        onChange={e => setFormData(prev => ({ ...prev, durationMonths: e.target.value }))}
                                        placeholder="1"
                                        min="1"
                                        className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Applicable Tabs * <span className="text-xs text-primary">(Select multiple for combined subscription)</span></label>
                                <div className="flex flex-wrap gap-2">
                                    {TAB_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => handleTabToggle(opt.value)}
                                            className={cn(
                                                'px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
                                                formData.applicableTabs.includes(opt.value)
                                                    ? 'bg-primary text-primary-foreground border-primary'
                                                    : 'bg-input border-border text-muted-foreground hover:bg-muted'
                                            )}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                {formData.applicableTabs.length === 0 && (
                                    <p className="text-xs text-destructive mt-1">Select at least one tab</p>
                                )}
                                {formData.applicableTabs.length > 1 && (
                                    <p className="text-xs text-primary mt-1">This will be a combined subscription</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Optional description..."
                                    rows={3}
                                    className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2.5 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting || formData.applicableTabs.length === 0}
                                    className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                                >
                                    {submitting ? 'Saving...' : editingSubscription ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
