import { useState, useEffect, useCallback } from 'react'
import { Search, RefreshCw, UserPlus } from 'lucide-react'
import { Pagination } from '@/components/Pagination'
import { getAdminPurchaseFarmers, getAdminUsersList, type AdminPurchaseFarmer } from '@/lib/api'

export function CollectionFarmersPage() {
    const [farmers, setFarmers] = useState<AdminPurchaseFarmer[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [userId, setUserId] = useState('')
    const [users, setUsers] = useState<{ _id: string; name: string; phone: string }[]>([])
    const [page, setPage] = useState(1)
    const [pagination, setPagination] = useState({ total: 0, pages: 1 })

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
                userId: userId || undefined
            })
            if (res.success) {
                setFarmers(res.response.farmers)
                setPagination(res.response.pagination)
            }
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }, [page, search, userId])

    useEffect(() => { fetchUsers() }, [fetchUsers])
    useEffect(() => {
        const t = setTimeout(fetchFarmers, 300)
        return () => clearTimeout(t)
    }, [fetchFarmers])

    const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'

    return (
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Collection Farmers</h1>
                    <p className="text-muted-foreground">All purchase farmers across users</p>
                </div>
                <button onClick={fetchFarmers} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                    <RefreshCw className="w-4 h-4" /> Refresh
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-card rounded-xl border border-border p-3 sm:p-4">
                    <p className="text-xs sm:text-sm text-muted-foreground">Total Farmers</p>
                    <p className="text-xl sm:text-2xl font-bold">{pagination.total}</p>
                </div>
                <div className="bg-card rounded-xl border border-border p-3 sm:p-4">
                    <p className="text-xs sm:text-sm text-muted-foreground">Total Amount</p>
                    <p className="text-xl sm:text-2xl font-bold text-green-600">₹{farmers.reduce((s, f) => s + (f.totalAmount || 0), 0).toFixed(2)}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-card rounded-xl border border-border p-4">
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
                </div>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
                            <div className="h-5 bg-muted rounded w-32 mb-2" />
                            <div className="h-4 bg-muted rounded w-24 mb-3" />
                            <div className="grid grid-cols-2 gap-2">
                                <div className="h-10 bg-muted rounded" />
                                <div className="h-10 bg-muted rounded" />
                            </div>
                        </div>
                    ))
                ) : farmers.length === 0 ? (
                    <div className="bg-card border border-border rounded-xl p-8 text-center">
                        <UserPlus className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                        <p className="text-sm text-muted-foreground">No farmers found</p>
                    </div>
                ) : (
                    farmers.map((f) => (
                        <div key={f._id} className="bg-card border border-border rounded-xl p-4">
                            <div className="flex justify-between items-start mb-1">
                                <div>
                                    <p className="font-semibold text-foreground">{f.name}</p>
                                    <p className="text-xs text-muted-foreground">Code: {f.code}</p>
                                </div>
                                <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">{f.defaultMilk}</span>
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
            <div className="hidden md:block bg-card rounded-xl border border-border overflow-hidden">
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
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Total Qty</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Total Amount</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Last Purchase</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        {Array.from({ length: 9 }).map((_, j) => (
                                            <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded w-20"></div></td>
                                        ))}
                                    </tr>
                                ))
                            ) : farmers.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                                        <UserPlus className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                        No farmers found
                                    </td>
                                </tr>
                            ) : (
                                farmers.map((f) => (
                                    <tr key={f._id} className="hover:bg-muted/30 transition-colors">
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
                                        <td className="px-4 py-3 text-sm font-medium text-primary">{(f.totalQuantity || 0).toFixed(1)} L</td>
                                        <td className="px-4 py-3 text-sm font-semibold text-green-600">₹{(f.totalAmount || 0).toFixed(2)}</td>
                                        <td className="px-4 py-3 text-sm">{formatDate(f.lastPurchaseDate)}</td>
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
