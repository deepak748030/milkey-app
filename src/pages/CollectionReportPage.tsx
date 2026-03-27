import { useState, useEffect, useCallback } from 'react'
import { BarChart3, RefreshCw, Filter } from 'lucide-react'
import { getAdminCollectionReport, getAdminUsersList } from '@/lib/api'

export function CollectionReportPage() {
    const [report, setReport] = useState<any[]>([])
    const [totals, setTotals] = useState<any>({})
    const [loading, setLoading] = useState(true)
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [userId, setUserId] = useState('')
    const [groupBy, setGroupBy] = useState('date')
    const [users, setUsers] = useState<{ _id: string; name: string; phone: string }[]>([])

    const fetchUsers = useCallback(async () => {
        try {
            const res = await getAdminUsersList()
            if (res.success) setUsers(res.response)
        } catch (e) { console.error(e) }
    }, [])

    const fetchReport = useCallback(async () => {
        setLoading(true)
        try {
            const res = await getAdminCollectionReport({
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                userId: userId || undefined,
                groupBy
            })
            if (res.success) {
                setReport(res.response.report)
                setTotals(res.response.totals)
            }
        } catch (e) { console.error(e) }
        finally { setLoading(false) }
    }, [startDate, endDate, userId, groupBy])

    useEffect(() => { fetchUsers() }, [fetchUsers])
    useEffect(() => {
        const t = setTimeout(fetchReport, 300)
        return () => clearTimeout(t)
    }, [fetchReport])

    const clearFilters = () => {
        setStartDate('')
        setEndDate('')
        setUserId('')
        setGroupBy('date')
    }

    return (
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Collection Report</h1>
                    <p className="text-muted-foreground">Aggregated milk collection reports</p>
                </div>
                <button onClick={fetchReport} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                    <RefreshCw className="w-4 h-4" /> Refresh
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-card rounded-xl border border-border p-3 sm:p-4">
                    <p className="text-xs sm:text-sm text-muted-foreground">Total Records</p>
                    <p className="text-xl sm:text-2xl font-bold">{totals.count || 0}</p>
                </div>
                <div className="bg-card rounded-xl border border-border p-3 sm:p-4">
                    <p className="text-xs sm:text-sm text-muted-foreground">Total Quantity</p>
                    <p className="text-xl sm:text-2xl font-bold text-primary">{(totals.totalQuantity || 0).toFixed(2)} L</p>
                </div>
                <div className="bg-card rounded-xl border border-border p-3 sm:p-4">
                    <p className="text-xs sm:text-sm text-muted-foreground">Total Amount</p>
                    <p className="text-xl sm:text-2xl font-bold text-green-600">₹{(totals.totalAmount || 0).toFixed(2)}</p>
                </div>
                <div className="bg-card rounded-xl border border-border p-3 sm:p-4">
                    <p className="text-xs sm:text-sm text-muted-foreground">Avg Rate</p>
                    <p className="text-xl sm:text-2xl font-bold">₹{(totals.avgRate || 0).toFixed(2)}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-card rounded-xl border border-border p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Filter className="w-4 h-4" /><span className="font-medium">Filters</span>
                    </div>
                    <button onClick={clearFilters} className="text-sm text-primary hover:underline">Clear All</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <select value={userId} onChange={(e) => setUserId(e.target.value)} className="px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary text-sm">
                        <option value="">All Owners</option>
                        {users.map(u => <option key={u._id} value={u._id}>{u.name} - {u.phone}</option>)}
                    </select>
                    <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} className="px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary text-sm">
                        <option value="date">Group by Date</option>
                        <option value="farmer">Group by Farmer</option>
                        <option value="shift">Group by Shift</option>
                    </select>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary" />
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary" />
                </div>
            </div>

            {/* Table */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                                    {groupBy === 'farmer' ? 'Farmer' : groupBy === 'shift' ? 'Date / Shift' : 'Date'}
                                </th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Records</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Quantity (L)</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Amount (₹)</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Avg Rate</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Avg FAT</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Avg SNF</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        {Array.from({ length: 7 }).map((_, j) => (
                                            <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded w-20"></div></td>
                                        ))}
                                    </tr>
                                ))
                            ) : report.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                                        <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                        No report data found
                                    </td>
                                </tr>
                            ) : (
                                report.map((row, i) => (
                                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3 text-sm font-medium">
                                            {groupBy === 'farmer'
                                                ? (row.farmer ? `${row.farmer.code} - ${row.farmer.name}` : 'Unknown')
                                                : groupBy === 'shift'
                                                    ? `${row._id?.date} (${row._id?.shift})`
                                                    : row._id}
                                        </td>
                                        <td className="px-4 py-3 text-sm">{row.count}</td>
                                        <td className="px-4 py-3 text-sm font-medium text-primary">{row.totalQuantity.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-sm font-semibold text-green-600">₹{row.totalAmount.toFixed(2)}</td>
                                        <td className="px-4 py-3 text-sm">₹{row.avgRate?.toFixed(2) || '-'}</td>
                                        <td className="px-4 py-3 text-sm">{row.avgFat?.toFixed(2) || '-'}</td>
                                        <td className="px-4 py-3 text-sm">{row.avgSnf?.toFixed(2) || '-'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
