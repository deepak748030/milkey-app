import { useState, useEffect, useCallback } from 'react'
import {
    Search,
    ChevronLeft,
    ChevronRight,
    Plus,
    Edit2,
    Trash2,
    ToggleLeft,
    ToggleRight,
    X,
    Loader2,
    RefreshCw,
    Ticket,
    Percent,
    IndianRupee,
    Calendar,
    TrendingUp,
    Clock,
    CheckCircle,
    XCircle,
    Copy,
} from 'lucide-react'
import {
    getCouponsAdmin,
    getCouponStats,
    createCoupon,
    updateCoupon,
    deleteCoupon,
    toggleCouponStatus,
    Coupon,
    CouponStats,
    CouponFormData,
    Pagination,
} from '../lib/api'
import { cn } from '../lib/utils'

function formatCurrency(amount: number): string {
    return `₹${amount.toLocaleString()}`
}

function formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    })
}

function isExpired(date: string): boolean {
    return new Date(date) < new Date()
}

function StatCard({ title, value, icon: Icon, color, subValue }: {
    title: string
    value: string | number
    icon: React.ElementType
    color: string
    subValue?: string
}) {
    return (
        <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{title}</span>
                <div className={cn('p-2 rounded-lg', color)}>
                    <Icon className="w-4 h-4" />
                </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {subValue && <p className="text-xs text-muted-foreground mt-1">{subValue}</p>}
        </div>
    )
}

function CouponSkeleton() {
    return (
        <tr className="border-b border-border">
            <td className="p-4"><div className="h-6 w-24 skeleton rounded" /></td>
            <td className="p-4"><div className="h-4 w-20 skeleton rounded" /></td>
            <td className="p-4"><div className="h-4 w-16 skeleton rounded" /></td>
            <td className="p-4"><div className="h-4 w-24 skeleton rounded" /></td>
            <td className="p-4"><div className="h-4 w-16 skeleton rounded" /></td>
            <td className="p-4"><div className="h-6 w-20 skeleton rounded-full" /></td>
            <td className="p-4"><div className="h-4 w-24 skeleton rounded" /></td>
            <td className="p-4"><div className="h-8 w-24 skeleton rounded" /></td>
        </tr>
    )
}

function StatsSkeleton() {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="h-4 w-20 skeleton rounded" />
                        <div className="w-8 h-8 skeleton rounded-lg" />
                    </div>
                    <div className="h-8 w-24 skeleton rounded" />
                </div>
            ))}
        </div>
    )
}

interface CouponModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (data: CouponFormData) => Promise<void>
    editingCoupon: Coupon | null
    isLoading: boolean
}

function CouponModal({ isOpen, onClose, onSubmit, editingCoupon, isLoading }: CouponModalProps) {
    const [formData, setFormData] = useState<CouponFormData>({
        code: '',
        discountType: 'percentage',
        discountValue: 0,
        minOrderValue: 0,
        maxDiscount: null,
        usageLimit: null,
        validFrom: new Date().toISOString().split('T')[0],
        validUntil: '',
        description: '',
    })

    useEffect(() => {
        if (editingCoupon) {
            setFormData({
                code: editingCoupon.code,
                discountType: editingCoupon.discountType,
                discountValue: editingCoupon.discountValue,
                minOrderValue: editingCoupon.minOrderValue,
                maxDiscount: editingCoupon.maxDiscount,
                usageLimit: editingCoupon.usageLimit,
                validFrom: editingCoupon.validFrom.split('T')[0],
                validUntil: editingCoupon.validUntil.split('T')[0],
                description: editingCoupon.description,
            })
        } else {
            setFormData({
                code: '',
                discountType: 'percentage',
                discountValue: 0,
                minOrderValue: 0,
                maxDiscount: null,
                usageLimit: null,
                validFrom: new Date().toISOString().split('T')[0],
                validUntil: '',
                description: '',
            })
        }
    }, [editingCoupon, isOpen])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        await onSubmit(formData)
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
            <div
                className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h2 className="text-lg font-bold text-foreground">
                        {editingCoupon ? 'Edit Coupon' : 'Create Coupon'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {/* Coupon Code */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">
                            Coupon Code *
                        </label>
                        <input
                            type="text"
                            value={formData.code}
                            onChange={(e) => setFormData(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                            placeholder="e.g., SAVE20"
                            className="w-full px-4 py-3 bg-muted/50 border border-input rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                            required
                        />
                    </div>

                    {/* Discount Type & Value */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">
                                Discount Type *
                            </label>
                            <select
                                value={formData.discountType}
                                onChange={(e) => setFormData(f => ({ ...f, discountType: e.target.value as 'percentage' | 'fixed' }))}
                                className="w-full px-4 py-3 bg-muted/50 border border-input rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                <option value="percentage">Percentage (%)</option>
                                <option value="fixed">Fixed Amount (₹)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">
                                Discount Value *
                            </label>
                            <input
                                type="number"
                                value={formData.discountValue}
                                onChange={(e) => setFormData(f => ({ ...f, discountValue: Number(e.target.value) }))}
                                min="0"
                                max={formData.discountType === 'percentage' ? 100 : undefined}
                                className="w-full px-4 py-3 bg-muted/50 border border-input rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary"
                                required
                            />
                        </div>
                    </div>

                    {/* Min Order & Max Discount */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">
                                Min Order Value
                            </label>
                            <input
                                type="number"
                                value={formData.minOrderValue}
                                onChange={(e) => setFormData(f => ({ ...f, minOrderValue: Number(e.target.value) }))}
                                min="0"
                                placeholder="0"
                                className="w-full px-4 py-3 bg-muted/50 border border-input rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">
                                Max Discount (₹)
                            </label>
                            <input
                                type="number"
                                value={formData.maxDiscount || ''}
                                onChange={(e) => setFormData(f => ({ ...f, maxDiscount: e.target.value ? Number(e.target.value) : null }))}
                                min="0"
                                placeholder="No limit"
                                className="w-full px-4 py-3 bg-muted/50 border border-input rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                    </div>

                    {/* Usage Limit */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">
                            Usage Limit
                        </label>
                        <input
                            type="number"
                            value={formData.usageLimit || ''}
                            onChange={(e) => setFormData(f => ({ ...f, usageLimit: e.target.value ? Number(e.target.value) : null }))}
                            min="1"
                            placeholder="Unlimited"
                            className="w-full px-4 py-3 bg-muted/50 border border-input rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>

                    {/* Validity Dates */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">
                                Valid From
                            </label>
                            <input
                                type="date"
                                value={formData.validFrom}
                                onChange={(e) => setFormData(f => ({ ...f, validFrom: e.target.value }))}
                                className="w-full px-4 py-3 bg-muted/50 border border-input rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-foreground mb-1.5">
                                Valid Until *
                            </label>
                            <input
                                type="date"
                                value={formData.validUntil}
                                onChange={(e) => setFormData(f => ({ ...f, validUntil: e.target.value }))}
                                min={formData.validFrom}
                                className="w-full px-4 py-3 bg-muted/50 border border-input rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary"
                                required
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1.5">
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                            placeholder="Coupon description..."
                            rows={3}
                            className="w-full px-4 py-3 bg-muted/50 border border-input rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 bg-muted text-foreground rounded-xl font-medium hover:bg-muted/80 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !formData.code || !formData.validUntil}
                            className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {editingCoupon ? 'Update' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export function CouponsPage() {
    const [coupons, setCoupons] = useState<Coupon[]>([])
    const [stats, setStats] = useState<CouponStats | null>(null)
    const [pagination, setPagination] = useState<Pagination | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [statsLoading, setStatsLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [typeFilter, setTypeFilter] = useState('all')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null)
    const [formLoading, setFormLoading] = useState(false)
    const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
    const [toggleLoading, setToggleLoading] = useState<string | null>(null)

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 400)
        return () => clearTimeout(timer)
    }, [search])

    const fetchStats = useCallback(async () => {
        setStatsLoading(true)
        try {
            const response = await getCouponStats()
            if (response.success) {
                setStats(response.response)
            }
        } catch (err) {
            console.error('Failed to fetch stats:', err)
        } finally {
            setStatsLoading(false)
        }
    }, [])

    const fetchCoupons = useCallback(async (page = 1) => {
        setIsLoading(true)
        try {
            const response = await getCouponsAdmin({
                page,
                limit: 10,
                search: debouncedSearch,
                status: statusFilter,
                discountType: typeFilter,
            })
            if (response.success) {
                setCoupons(response.response.coupons)
                setPagination(response.response.pagination)
            }
        } catch (err) {
            console.error('Failed to fetch coupons:', err)
        } finally {
            setIsLoading(false)
        }
    }, [debouncedSearch, statusFilter, typeFilter])

    useEffect(() => {
        fetchStats()
    }, [fetchStats])

    useEffect(() => {
        fetchCoupons(1)
    }, [fetchCoupons])

    const handleOpenModal = (coupon?: Coupon) => {
        setEditingCoupon(coupon || null)
        setIsModalOpen(true)
    }

    const handleCloseModal = () => {
        setIsModalOpen(false)
        setEditingCoupon(null)
    }

    const handleSubmit = async (data: CouponFormData) => {
        setFormLoading(true)
        try {
            if (editingCoupon) {
                await updateCoupon(editingCoupon._id, data)
            } else {
                await createCoupon(data)
            }
            handleCloseModal()
            fetchCoupons(pagination?.page || 1)
            fetchStats()
        } catch (err) {
            console.error('Failed to save coupon:', err)
        } finally {
            setFormLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this coupon?')) return

        setDeleteLoading(id)
        try {
            await deleteCoupon(id)
            fetchCoupons(pagination?.page || 1)
            fetchStats()
        } catch (err) {
            console.error('Failed to delete coupon:', err)
        } finally {
            setDeleteLoading(null)
        }
    }

    const handleToggleStatus = async (id: string) => {
        setToggleLoading(id)
        try {
            await toggleCouponStatus(id)
            fetchCoupons(pagination?.page || 1)
            fetchStats()
        } catch (err) {
            console.error('Failed to toggle status:', err)
        } finally {
            setToggleLoading(null)
        }
    }

    const handleCopyCode = (code: string) => {
        navigator.clipboard.writeText(code)
    }

    return (
        <div className="animate-fade-in space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-xl">
                        <Ticket className="w-7 h-7 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Coupons</h1>
                        <p className="text-muted-foreground mt-0.5">Manage discount coupons and offers</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => { fetchCoupons(pagination?.page || 1); fetchStats(); }}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-xl hover:bg-muted transition-colors"
                    >
                        <RefreshCw className={cn('w-5 h-5', isLoading && 'animate-spin')} />
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-medium"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Add Coupon</span>
                    </button>
                </div>
            </div>

            {/* Stats */}
            {statsLoading ? (
                <StatsSkeleton />
            ) : stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                        title="Total Coupons"
                        value={stats.totalCoupons}
                        icon={Ticket}
                        color="bg-primary/10 text-primary"
                    />
                    <StatCard
                        title="Active Coupons"
                        value={stats.activeCoupons}
                        icon={CheckCircle}
                        color="bg-success/10 text-success"
                    />
                    <StatCard
                        title="Expired Coupons"
                        value={stats.expiredCoupons}
                        icon={XCircle}
                        color="bg-destructive/10 text-destructive"
                    />
                    <StatCard
                        title="Total Usage"
                        value={stats.totalUsage}
                        icon={TrendingUp}
                        color="bg-info/10 text-info"
                        subValue={`${stats.percentageCoupons} percentage, ${stats.fixedCoupons} fixed`}
                    />
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search by code or description..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-card border border-input rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                    />
                </div>

                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-3 bg-card border border-input rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-ring transition-all min-w-[140px]"
                >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="expired">Expired</option>
                </select>

                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="px-4 py-3 bg-card border border-input rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-ring transition-all min-w-[140px]"
                >
                    <option value="all">All Types</option>
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                </select>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-card border border-border rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="skeleton h-6 w-24 rounded" />
                                <div className="skeleton h-6 w-16 rounded-full" />
                            </div>
                            <div className="skeleton h-4 w-32 rounded" />
                        </div>
                    ))
                ) : coupons.length === 0 ? (
                    <div className="bg-card border border-border rounded-xl p-8 text-center">
                        <Ticket className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                        <p className="text-sm text-muted-foreground">No coupons found</p>
                    </div>
                ) : (
                    coupons.map((coupon) => {
                        const expired = isExpired(coupon.validUntil)
                        return (
                            <div key={coupon._id} className="bg-card border border-border rounded-xl p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-mono font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg text-sm">
                                                {coupon.code}
                                            </span>
                                            <button onClick={() => handleCopyCode(coupon.code)} className="p-1 hover:bg-muted rounded transition-colors">
                                                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2 text-sm">
                                            {coupon.discountType === 'percentage' ? (
                                                <span className="font-semibold text-success">{coupon.discountValue}% off</span>
                                            ) : (
                                                <span className="font-semibold text-success">₹{coupon.discountValue} off</span>
                                            )}
                                            {coupon.maxDiscount && <span className="text-xs text-muted-foreground">(max ₹{coupon.maxDiscount})</span>}
                                        </div>
                                    </div>
                                    {expired ? (
                                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-destructive/10 text-destructive flex-shrink-0">Expired</span>
                                    ) : coupon.isActive ? (
                                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-success/10 text-success flex-shrink-0">Active</span>
                                    ) : (
                                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-muted text-muted-foreground flex-shrink-0">Inactive</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground flex-wrap">
                                    <span>Min: {coupon.minOrderValue > 0 ? formatCurrency(coupon.minOrderValue) : 'None'}</span>
                                    <span>•</span>
                                    <span>Until: {formatDate(coupon.validUntil)}</span>
                                    <span>•</span>
                                    <span>Used: {coupon.usedCount}{coupon.usageLimit ? `/${coupon.usageLimit}` : ''}</span>
                                </div>
                                <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-border">
                                    <button
                                        onClick={() => handleToggleStatus(coupon._id)}
                                        disabled={toggleLoading === coupon._id || expired}
                                        className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                                    >
                                        {toggleLoading === coupon._id ? <Loader2 className="w-4 h-4 animate-spin" /> : coupon.isActive ? <ToggleRight className="w-4 h-4 text-success" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                                    </button>
                                    <button onClick={() => handleOpenModal(coupon)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                                        <Edit2 className="w-4 h-4 text-primary" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(coupon._id)}
                                        disabled={deleteLoading === coupon._id}
                                        className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors disabled:opacity-50"
                                    >
                                        {deleteLoading === coupon._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-destructive" />}
                                    </button>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-card border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted/50 border-b border-border">
                            <tr>
                                <th className="text-left p-4 font-semibold text-muted-foreground">Code</th>
                                <th className="text-left p-4 font-semibold text-muted-foreground">Discount</th>
                                <th className="text-left p-4 font-semibold text-muted-foreground">Min Order</th>
                                <th className="text-left p-4 font-semibold text-muted-foreground">Validity</th>
                                <th className="text-left p-4 font-semibold text-muted-foreground">Usage</th>
                                <th className="text-left p-4 font-semibold text-muted-foreground">Status</th>
                                <th className="text-left p-4 font-semibold text-muted-foreground">Created</th>
                                <th className="text-left p-4 font-semibold text-muted-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => <CouponSkeleton key={i} />)
                            ) : coupons.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center text-muted-foreground">
                                        <Ticket className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                        <p className="text-lg">No coupons found</p>
                                    </td>
                                </tr>
                            ) : (
                                coupons.map((coupon) => {
                                    const expired = isExpired(coupon.validUntil)
                                    return (
                                        <tr key={coupon._id} className="border-b border-border hover:bg-muted/30 transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg">{coupon.code}</span>
                                                    <button onClick={() => handleCopyCode(coupon.code)} className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground" title="Copy code">
                                                        <Copy className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-1.5">
                                                    {coupon.discountType === 'percentage' ? (
                                                        <>
                                                            <Percent className="w-4 h-4 text-success" />
                                                            <span className="font-semibold text-foreground">{coupon.discountValue}%</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <IndianRupee className="w-4 h-4 text-success" />
                                                            <span className="font-semibold text-foreground">{coupon.discountValue}</span>
                                                        </>
                                                    )}
                                                    {coupon.maxDiscount && <span className="text-xs text-muted-foreground ml-1">(max ₹{coupon.maxDiscount})</span>}
                                                </div>
                                            </td>
                                            <td className="p-4 text-muted-foreground">{coupon.minOrderValue > 0 ? formatCurrency(coupon.minOrderValue) : 'None'}</td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-1.5 text-sm">
                                                    <Calendar className="w-4 h-4 text-muted-foreground" />
                                                    <span className={cn(expired && 'text-destructive')}>{formatDate(coupon.validUntil)}</span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="text-sm text-muted-foreground">{coupon.usedCount}{coupon.usageLimit ? `/${coupon.usageLimit}` : ''}</span>
                                            </td>
                                            <td className="p-4">
                                                {expired ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-destructive/10 text-destructive">
                                                        <Clock className="w-3.5 h-3.5" />Expired
                                                    </span>
                                                ) : coupon.isActive ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-success/10 text-success">
                                                        <CheckCircle className="w-3.5 h-3.5" />Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-muted text-muted-foreground">
                                                        <XCircle className="w-3.5 h-3.5" />Inactive
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 text-muted-foreground text-sm">{formatDate(coupon.createdAt)}</td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleToggleStatus(coupon._id)}
                                                        disabled={toggleLoading === coupon._id || expired}
                                                        className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                                                        title={coupon.isActive ? 'Deactivate' : 'Activate'}
                                                    >
                                                        {toggleLoading === coupon._id ? <Loader2 className="w-4 h-4 animate-spin" /> : coupon.isActive ? <ToggleRight className="w-4 h-4 text-success" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                                                    </button>
                                                    <button onClick={() => handleOpenModal(coupon)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Edit">
                                                        <Edit2 className="w-4 h-4 text-primary" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(coupon._id)}
                                                        disabled={deleteLoading === coupon._id}
                                                        className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors disabled:opacity-50"
                                                        title="Delete"
                                                    >
                                                        {deleteLoading === coupon._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-destructive" />}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
                    <p className="text-xs text-muted-foreground">
                        Showing {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => fetchCoupons(pagination.page - 1)}
                            disabled={pagination.page === 1 || isLoading}
                            className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="px-3 py-1.5 bg-muted rounded-lg text-sm font-medium">
                            {pagination.page} / {pagination.pages}
                        </span>
                        <button
                            onClick={() => fetchCoupons(pagination.page + 1)}
                            disabled={pagination.page === pagination.pages || isLoading}
                            className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Modal */}
            <CouponModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSubmit={handleSubmit}
                editingCoupon={editingCoupon}
                isLoading={formLoading}
            />
        </div>
    )
}
