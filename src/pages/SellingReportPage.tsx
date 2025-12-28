// File: src/pages/SellingReportPage.tsx
import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Users, IndianRupee, Droplet, FileText, User } from 'lucide-react'
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
    trend?: 'up' | 'down' | 'neutral'
    className?: string
}

function StatCard({ title, value, icon, trend, className }: StatCardProps) {
    return (
        <div className={cn('bg-card border border-border rounded-xl p-4', className)}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-muted-foreground">{title}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
                </div>
                <div className={cn(
                    'p-2 rounded-lg',
                    trend === 'up' ? 'bg-success/10 text-success' :
                        trend === 'down' ? 'bg-destructive/10 text-destructive' :
                            'bg-muted text-muted-foreground'
                )}>
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

    const formatCurrency = (val: number) => `₹${Math.abs(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '—'
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        })
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Selling Report</h1>
                    <p className="text-muted-foreground">Member balance summary and unpaid amounts</p>
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

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        title="Total Members"
                        value={summary.totalMembers}
                        icon={<Users className="w-5 h-5" />}
                    />
                    <StatCard
                        title="Total Receivable"
                        value={formatCurrency(summary.totalReceivable)}
                        icon={<TrendingUp className="w-5 h-5" />}
                        trend="up"
                    />
                    <StatCard
                        title="Total Payable (Credit)"
                        value={formatCurrency(summary.totalPayable)}
                        icon={<TrendingDown className="w-5 h-5" />}
                        trend="down"
                    />
                    <StatCard
                        title="Net Balance"
                        value={`${summary.netBalance >= 0 ? '' : '-'}${formatCurrency(summary.netBalance)}`}
                        icon={<IndianRupee className="w-5 h-5" />}
                        trend={summary.netBalance >= 0 ? 'up' : 'down'}
                    />
                </div>
            )}

            {/* Additional Stats */}
            {summary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <StatCard
                        title="Unpaid Milk Amount"
                        value={formatCurrency(summary.totalUnpaidAmount)}
                        icon={<FileText className="w-5 h-5" />}
                    />
                    <StatCard
                        title="Unpaid Quantity"
                        value={`${summary.totalUnpaidQuantity.toFixed(2)} L`}
                        icon={<Droplet className="w-5 h-5" />}
                    />
                </div>
            )}

            {/* Table */}
            {loading ? (
                <TableSkeleton rows={10} columns={9} />
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
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Member</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Mobile</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Owner</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Rate/L</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Unpaid Qty</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Unpaid Amount</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Previous Balance</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">Total Balance</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Last Payment</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {data.map(item => (
                                    <tr key={item._id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3">
                                            <span className="font-medium text-foreground">{item.name}</span>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {item.mobile}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                                <User className="w-3.5 h-3.5" />
                                                <span className="truncate max-w-[100px]">
                                                    {(item as any).owner?.name || 'Unknown'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right text-muted-foreground">
                                            ₹{item.ratePerLiter}
                                        </td>
                                        <td className="px-4 py-3 text-right text-muted-foreground">
                                            {item.unpaidQuantity.toFixed(2)} L
                                        </td>
                                        <td className="px-4 py-3 text-right text-muted-foreground">
                                            {formatCurrency(item.unpaidAmount)}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={cn(
                                                item.currentBalance > 0 ? 'text-destructive' :
                                                    item.currentBalance < 0 ? 'text-success' : 'text-muted-foreground'
                                            )}>
                                                {item.currentBalance !== 0 && (item.currentBalance > 0 ? '+' : '')}
                                                {formatCurrency(item.currentBalance)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={cn(
                                                'font-semibold',
                                                item.totalBalance > 0 ? 'text-destructive' :
                                                    item.totalBalance < 0 ? 'text-success' : 'text-foreground'
                                            )}>
                                                {item.totalBalance !== 0 && (item.totalBalance > 0 ? '+' : '-')}
                                                {formatCurrency(item.totalBalance)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            {formatDate(item.lastPaymentDate)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}