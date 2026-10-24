import { useState, useEffect, useCallback } from 'react'
import { Search, RefreshCw, UserPlus, Trash2, RotateCcw, AlertTriangle, TableProperties, ChevronDown } from 'lucide-react'
import { Pagination } from '@/components/Pagination'
import { getAdminPurchaseFarmers, getAdminUsersList, deleteAdminPurchaseFarmer, restoreAdminPurchaseFarmer, permanentDeleteAdminPurchaseFarmer, getAdminRateSettingSettings, type AdminPurchaseFarmer, type AdminRateChartSetting } from '@/lib/api'

const FAT_RATIO = 0.08
const SNF_RATIO = 0.053333333

export function CollectionFarmersPage() {
    const [farmers, setFarmers] = useState<AdminPurchaseFarmer[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [userId, setUserId] = useState('')
    const [status, setStatus] = useState('active')
    const [users, setUsers] = useState<{ _id: string; name: string; phone: string }[]>([])
    const [page, setPage] = useState(1)
    const [pagination, setPagination] = useState({ total: 0, pages: 1 })
    const [actionLoading, setActionLoading] = useState(false)
    const [rateSettings, setRateSettings] = useState<AdminRateChartSetting[]>([])
    const [rateLoading, setRateLoading] = useState(false)
    const [rateOpen, setRateOpen] = useState(true)

    const fetchUsers = useCallback(async () => {
        try {
            const res = await getAdminUsersList()
            if (res.success) setUsers(res.response)
        } catch (e) { console.error(e) }
    }, [])

    const fetchFarmers = useCallback(async () => {
        setLoading(true)
        try {
            const res = await getAdminPurchaseFarmers({
                page, limit: 10,
                search: search || undefined,
                userId: userId || undefined,
                status
            })
            if (res.success) {
                setFarmers(res.response.farmers)
                setPagination(res.response.pagination)
            }
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }, [page, search, userId, status])

    useEffect(() => { fetchUsers() }, [fetchUsers])
    useEffect(() => {
        const t = setTimeout(fetchFarmers, 300)
        return () => clearTimeout(t)
    }, [fetchFarmers])

    const fetchRateSettings = useCallback(async () => {
        setRateLoading(true)
        try {
            const res = await getAdminRateSettingSettings({
                page: 1, limit: 50,
                search: search || undefined,
                userId: userId || undefined,
            })
            if (res.success) setRateSettings(res.response.data)
        } catch (e) { console.error(e) }
        finally { setRateLoading(false) }
    }, [search, userId])

    useEffect(() => {
        if (!rateOpen) return
        const t = setTimeout(fetchRateSettings, 300)
        return () => clearTimeout(t)
    }, [fetchRateSettings, rateOpen])

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this farmer?')) return
        setActionLoading(true)
        try {
            const res = await deleteAdminPurchaseFarmer(id)
            if (res.success) fetchFarmers()
        } catch (e) { console.error(e) }
        finally { setActionLoading(false) }
    }

    const handleRestore = async (id: string) => {
        if (!confirm('Restore this farmer?')) return
        setActionLoading(true)
        try {
            const res = await restoreAdminPurchaseFarmer(id)
            if (res.success) fetchFarmers()
        } catch (e) { console.error(e) }
        finally { setActionLoading(false) }
    }

    const handlePermanentDelete = async (id: string) => {
        if (!confirm('⚠️ PERMANENT DELETE\n\nThis will permanently delete this farmer and ALL related data (milk collections, advances, payments).\n\nThis action CANNOT be undone!\n\nAre you absolutely sure?')) return
        setActionLoading(true)
        try {
            const res = await permanentDeleteAdminPurchaseFarmer(id)
            if (res.success) fetchFarmers()
        } catch (e) { console.error(e) }
        finally { setActionLoading(false) }
    }

    const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

    return (
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Farmers</h1>
                    <p className="text-muted-foreground">All purchase farmers across users</p>
                </div>
                <button onClick={fetchFarmers} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg shadow-sm hover:bg-primary/90 transition-colors">
                    <RefreshCw className="w-4 h-4" /> Refresh
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-card rounded-lg border border-border p-3 sm:p-4">
                    <p className="text-xs sm:text-sm text-muted-foreground">Total Farmers</p>
                    <p className="text-xl sm:text-2xl font-bold">{pagination.total}</p>
                </div>
                <div className="bg-card rounded-lg border border-border p-3 sm:p-4">
                    <p className="text-xs sm:text-sm text-muted-foreground">Total Amount</p>
                    <p className="text-xl sm:text-2xl font-bold text-green-600">₹{farmers.reduce((s, f) => s + (f.totalAmount || 0), 0).toFixed(2)}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-card rounded-lg border border-border p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input type="text" placeholder="Search by code, name, mobile..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary" />
                    </div>
                    <select value={userId} onChange={(e) => { setUserId(e.target.value); setPage(1) }} className="px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary text-sm">
                        <option value="">All Owners</option>
                        {users.map(u => <option key={u._id} value={u._id}>{u.name} - {u.phone}</option>)}
                    </select>
                    <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }} className="px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary text-sm">
                        <option value="active">Active</option>
                        <option value="deleted">Deleted</option>
                        <option value="all">All</option>
                    </select>
                </div>
            </div>

            {/* Rate Setting Settings (embedded) */}
            <div className="bg-card rounded-lg border border-border overflow-hidden">
                <button
                    onClick={() => setRateOpen(o => !o)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <TableProperties className="w-5 h-5 text-primary" />
                        <div className="text-left">
                            <p className="font-semibold text-foreground">Rate Setting Settings</p>
                            <p className="text-xs text-muted-foreground">Per-user quick settings from mobile Collection tab</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground hidden sm:inline">{rateSettings.length} users</span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${rateOpen ? '' : '-rotate-90'}`} />
                    </div>
                </button>
                {rateOpen && (
                    <div className="border-t border-border overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/40">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">User</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Today Rate</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Fat Rate</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Snf Rate</th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground">FAT</th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground">SNF</th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-muted-foreground">Farmers</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Updated</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {rateLoading ? (
                                    Array.from({ length: 3 }).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            {Array.from({ length: 8 }).map((_, j) => (
                                                <td key={j} className="px-4 py-2"><div className="h-3 bg-muted rounded w-16" /></td>
                                            ))}
                                        </tr>
                                    ))
                                ) : rateSettings.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">No rate setting settings</td>
                                    </tr>
                                ) : (
                                    rateSettings.map(r => {
                                        const fatRate = (r.rate || 0) * FAT_RATIO
                                        const snfRate = (r.rate || 0) * SNF_RATIO
                                        return (
                                            <tr key={r._id} className="hover:bg-muted/20">
                                                <td className="px-4 py-2 text-sm">
                                                    <div className="font-medium">{r.owner?.name || '—'}</div>
                                                    <div className="text-xs text-muted-foreground">{r.owner?.phone || ''}</div>
                                                </td>
                                                <td className="px-4 py-2 text-sm text-right font-semibold text-green-600">₹{(r.rate || 0).toFixed(2)}</td>
                                                <td className="px-4 py-2 text-sm text-right">₹{fatRate.toFixed(3)}</td>
                                                <td className="px-4 py-2 text-sm text-right">₹{snfRate.toFixed(3)}</td>
                                                <td className="px-4 py-2 text-xs text-center">{r.fatMin}–{r.fatMax}</td>
                                                <td className="px-4 py-2 text-xs text-center">{r.snfMin}–{r.snfMax}</td>
                                                <td className="px-4 py-2 text-center">
                                                    <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">{r.rateSettingFarmersCount ?? r.rateChartFarmersCount}</span>
                                                </td>
                                                <td className="px-4 py-2 text-xs text-muted-foreground">
                                                    {r.updatedAt ? new Date(r.updatedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="rounded-xl border bg-card p-4 shadow-soft animate-pulse">
                            <div className="h-5 bg-muted rounded w-32 mb-2" />
                            <div className="h-4 bg-muted rounded w-24 mb-3" />
                            <div className="grid grid-cols-2 gap-2">
                                <div className="h-10 bg-muted rounded" />
                                <div className="h-10 bg-muted rounded" />
                            </div>
                        </div>
                    ))
                ) : farmers.length === 0 ? (
                    <div className="bg-card border border-border rounded-lg p-8 text-center">
                        <UserPlus className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                        <p className="text-sm text-muted-foreground">No farmers found</p>
                    </div>
                ) : (
                    farmers.map((f) => (
                        <div key={f._id} className={`bg-card border rounded-lg p-4 ${f.isActive === false ? 'border-destructive/30 opacity-75' : 'border-border'}`}>
                            <div className="flex justify-between items-start mb-1">
                                <div>
                                    <p className="font-semibold text-foreground">{f.name}</p>
                                    <p className="text-xs text-muted-foreground">Code: {f.code}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">{f.defaultMilk}</span>
                                    {(f.showRateSetting ?? f.showRateChart) && (
                                        <span className="px-2 py-0.5 bg-primary/15 text-primary rounded-full text-xs font-medium">Rate Setting</span>
                                    )}
                                    {f.isActive === false && (
                                        <span className="px-2 py-0.5 bg-destructive/10 text-destructive rounded-full text-xs font-medium">Deleted</span>
                                    )}
                                    {f.isActive === false ? (
                                        <>
                                            <button onClick={() => handleRestore(f._id)} disabled={actionLoading} className="p-1.5 hover:bg-green-500/10 rounded-lg transition-colors" title="Restore">
                                                <RotateCcw className="w-4 h-4 text-green-600" />
                                            </button>
                                            <button onClick={() => handlePermanentDelete(f._id)} disabled={actionLoading} className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors" title="Permanent Delete">
                                                <AlertTriangle className="w-4 h-4 text-destructive" />
                                            </button>
                                        </>
                                    ) : (
                                        <button onClick={() => handleDelete(f._id)} disabled={actionLoading} className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors">
                                            <Trash2 className="w-4 h-4 text-destructive" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2">{f.mobile} • Owner: {typeof f.owner === 'object' ? f.owner.name : ''}</p>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="bg-muted/50 rounded-lg p-2 text-center">
                                    <p className="text-[10px] text-muted-foreground uppercase">Quantity</p>
                                    <p className="font-medium">{(f.totalQuantity || 0).toFixed(1)} L</p>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-2 text-center">
                                    <p className="text-[10px] text-muted-foreground uppercase">Amount</p>
                                    <p className="font-semibold text-green-600">₹{(f.totalAmount || 0).toFixed(2)}</p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-card rounded-lg border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Code</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Name</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Mobile</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Owner</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Milk Type</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Rate Basis</th>
                                <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Rate Setting</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Total Qty</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Total Amount</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Last Purchase</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                                <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        {Array.from({ length: 12 }).map((_, j) => (
                                            <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded w-20"></div></td>
                                        ))}
                                    </tr>
                                ))
                            ) : farmers.length === 0 ? (
                                <tr>
                                    <td colSpan={12} className="px-4 py-12 text-center text-muted-foreground">
                                        <UserPlus className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                        No farmers found
                                    </td>
                                </tr>
                            ) : (
                                farmers.map((f) => (
                                    <tr key={f._id} className={`hover:bg-muted/30 transition-colors ${f.isActive === false ? 'opacity-60' : ''}`}>
                                        <td className="px-4 py-3 text-sm font-mono font-medium">{f.code}</td>
                                        <td className="px-4 py-3 text-sm font-medium">{f.name}</td>
                                        <td className="px-4 py-3 text-sm">{f.mobile || '-'}</td>
                                        <td className="px-4 py-3">
                                            <div className="text-sm">{typeof f.owner === 'object' ? f.owner.name : '-'}</div>
                                            <div className="text-xs text-muted-foreground">{typeof f.owner === 'object' ? f.owner.phone : ''}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${f.defaultMilk === 'cow' ? 'bg-orange-500/20 text-orange-700 dark:text-orange-300' : 'bg-blue-500/20 text-blue-700 dark:text-blue-300'}`}>
                                                {f.defaultMilk || 'buffalo'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm capitalize">{f.priceBasis || 'rate'}</td>
                                        <td className="px-4 py-3 text-center">
                                            {(f.showRateSetting ?? f.showRateChart) ? (
                                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary">Yes</span>
                                            ) : (
                                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">No</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-sm font-medium text-primary">{(f.totalQuantity || 0).toFixed(1)} L</td>
                                        <td className="px-4 py-3 text-sm font-semibold text-green-600">₹{(f.totalAmount || 0).toFixed(2)}</td>
                                        <td className="px-4 py-3 text-sm">{formatDate(f.lastPurchaseDate)}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${f.isActive === false ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-700 dark:text-green-300'}`}>
                                                {f.isActive === false ? 'Deleted' : 'Active'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {f.isActive === false ? (
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => handleRestore(f._id)}
                                                        disabled={actionLoading}
                                                        className="p-2 hover:bg-green-500/10 rounded-lg transition-colors"
                                                        title="Restore farmer"
                                                    >
                                                        <RotateCcw className="w-4 h-4 text-green-600" />
                                                    </button>
                                                    <button
                                                        onClick={() => handlePermanentDelete(f._id)}
                                                        disabled={actionLoading}
                                                        className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                                                        title="Permanent Delete"
                                                    >
                                                        <AlertTriangle className="w-4 h-4 text-destructive" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleDelete(f._id)}
                                                    disabled={actionLoading}
                                                    className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                                                    title="Delete farmer"
                                                >
                                                    <Trash2 className="w-4 h-4 text-destructive" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Pagination page={page} totalPages={pagination.pages} onPageChange={setPage} />
        </div>
    )
}
