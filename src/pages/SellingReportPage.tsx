// File: src/pages/SellingReportPage.tsx
import { useState, useEffect } from 'react'
import { Users, IndianRupee, Droplet } from 'lucide-react'
import {
    getBalanceReport,
    getAdminUsersList,
    BalanceReportItem,
    BalanceReportSummary
} from '../lib/api'
import { TableSkeleton } from '../components/TableSkeleton'
import { cn } from '../lib/utils'

interface UserOption {
    _id: string
    name: string
    email: string
    phone: string
}

interface StatCardProps {
    title: string
    value: string | number
    icon: React.ReactNode
    className?: string
}

function StatCard({ title, value, icon, className }: StatCardProps) {
    return (
        <div className={cn('bg-card border border-border rounded-xl p-4', className)}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-muted-foreground">{title}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
                </div>
                <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                    {icon}
                </div>
            </div>
        </div>
    )
}

export function SellingReportPage() {
    const [data, setData] = useState<BalanceReportItem[]>([])
    const [users, setUsers] = useState<UserOption[]>([])
    const [summary, setSummary] = useState<BalanceReportSummary | null>(null)
    const [loading, setLoading] = useState(true)
    const [userId, setUserId] = useState('')

    // Load users for filter dropdown
    useEffect(() => {
        getAdminUsersList().then(res => {
            if (res.success) setUsers(res.response || [])
        }).catch(console.error)
    }, [])

    useEffect(() => {
        const fetchReport = async () => {
            try {
                setLoading(true)
                const res = await getBalanceReport({ userId: userId || undefined })
                if (res.success) {
                    setData(res.response.data || [])
                    setSummary(res.response.summary || null)
                }
            } catch (err) {
                console.error('Failed to fetch balance report:', err)
            } finally {
                setLoading(false)
            }
        }
        fetchReport()
    }, [userId])

    // Format balance with proper sign
    const formatBalance = (val: number) => {
        if (val === 0) return '₹0'
        const absVal = Math.abs(val)
        const formatted = `₹${absVal.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
        return val > 0 ? `+${formatted}` : `-${formatted}`
    }

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—'
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        })
    }

    // Get balance color - positive (we owe) = success, negative (member owes) = destructive
    const getBalanceColor = (val: number) => {
        if (val > 0) return 'text-success'
        if (val < 0) return 'text-destructive'
        return 'text-muted-foreground'
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Selling Report</h1>
                    <p className="text-muted-foreground">Member balance summary</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="min-w-[200px]">
                        <label className="block text-sm font-medium text-muted-foreground mb-1.5">Owner</label>
                        <select
                            value={userId}
                            onChange={e => setUserId(e.target.value)}
                            className="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                            <option value="">All Owners</option>
                            {users.map(u => (
                                <option key={u._id} value={u._id}>{u.name}</option>
                            ))}
                        </select>
                    </div>
                    {userId && (
                        <button
                            onClick={() => setUserId('')}
                            className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Summary Cards - 3 cards matching app */}
            {summary && (
                <div className="grid grid-cols-3 gap-4">
                    <StatCard
                        title="Total Members"
                        value={summary.totalMembers}
                        icon={<Users className="w-5 h-5" />}
                    />
                    <StatCard
                        title="Unpaid Quantity"
                        value={`${summary.totalUnpaidQuantity.toFixed(1)} L`}
                        icon={<Droplet className="w-5 h-5" />}
                    />
                    <StatCard
                        title="Net Balance"
                        value={formatBalance(summary.netBalance)}
                        icon={<IndianRupee className="w-5 h-5" />}
                    />
                </div>
            )}

            {/* Table */}
            {loading ? (
                <TableSkeleton rows={10} columns={5} />
            ) : data.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-12 text-center">
                    <p className="text-muted-foreground">No data found</p>
                </div>
            ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/50 border-b border-border">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground w-16">Sr No.</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Name</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Date Created</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Till</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">User Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {data.map((item, index) => (
                                    <tr key={item._id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {index + 1}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="font-medium text-foreground">{item.name}</span>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {formatDate((item as any).createdAt)}
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {formatDate((item as any).tillDate)}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={cn('font-semibold', getBalanceColor(item.totalBalance))}>
                                                {formatBalance(item.totalBalance)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer with totals */}
                    <div className="bg-muted/30 border-t border-border px-4 py-3">
                        <div className="flex flex-wrap gap-6 text-sm">
                            <div>
                                <span className="text-muted-foreground">Total Members:</span>
                                <span className="ml-2 font-semibold text-foreground">{data.length}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Unpaid Quantity:</span>
                                <span className="ml-2 font-semibold text-foreground">
                                    {data.reduce((sum, m) => sum + m.unpaidQuantity, 0).toFixed(1)} L
                                </span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Net Balance:</span>
                                <span className={cn('ml-2 font-semibold', getBalanceColor(data.reduce((sum, m) => sum + m.totalBalance, 0)))}>
                                    {formatBalance(data.reduce((sum, m) => sum + m.totalBalance, 0))}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
