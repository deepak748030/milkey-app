import { useState, useEffect } from 'react'
import {
    Users, UserCheck, UserX, Filter, RefreshCw,
    Milk, Package, Image, IndianRupee, CreditCard, UserPlus,
    BarChart3, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import { getDashboardAnalytics } from '../lib/api'
import { cn } from '../lib/utils'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend, PieChart, Pie, Cell, BarChart, Bar, Line, ComposedChart
} from 'recharts'

type FilterType = 'today' | 'weekly' | 'monthly' | 'yearly'

interface StatCardProps {
    title: string
    value: number | string
    icon: React.ElementType
    color: string
    isLoading: boolean
    prefix?: string
    suffix?: string
    trend?: number
    subValue?: string
}

function StatCardSkeleton() {
    return (
        <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-start justify-between">
                <div className="space-y-3 flex-1">
                    <div className="h-3 w-20 skeleton rounded" />
                    <div className="h-7 w-16 skeleton rounded" />
                </div>
                <div className="h-10 w-10 skeleton rounded-lg" />
            </div>
        </div>
    )
}

function StatCard({ title, value, icon: Icon, color, isLoading, prefix = '', suffix = '', trend, subValue }: StatCardProps) {
    if (isLoading) return <StatCardSkeleton />

    const displayValue = typeof value === 'number' ? value.toLocaleString('en-IN') : value

    return (
        <div className="bg-card border border-border rounded-xl p-5 transition-all hover:shadow-lg hover:border-primary/30">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">
                        {prefix}{displayValue}{suffix}
                    </p>
                    {subValue && (
                        <p className="text-xs text-muted-foreground mt-1">{subValue}</p>
                    )}
                    {trend !== undefined && (
                        <div className={cn(
                            'flex items-center gap-1 mt-2 text-xs font-medium',
                            trend >= 0 ? 'text-green-500' : 'text-red-500'
                        )}>
                            {trend >= 0 ? (
                                <ArrowUpRight className="w-3 h-3" />
                            ) : (
                                <ArrowDownRight className="w-3 h-3" />
                            )}
                            {Math.abs(trend)}% from last period
                        </div>
                    )}
                </div>
                <div className={cn('p-2.5 rounded-lg', color)}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
        </div>
    )
}

function ChartSkeleton({ height = 300 }: { height?: number }) {
    return (
        <div className="bg-card border border-border rounded-xl p-5">
            <div className="h-4 w-32 skeleton rounded mb-4" />
            <div className="skeleton rounded" style={{ height: `${height}px` }} />
        </div>
    )
}

function PieChartCard({ title, data, isLoading }: { title: string; data: any[]; isLoading: boolean }) {
    if (isLoading) return <ChartSkeleton height={250} />

    const hasData = data.some(d => d.value > 0)

    return (
        <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-base font-semibold text-foreground mb-4">{title}</h3>
            {hasData ? (
                <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={2}
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip
                            content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <div className="bg-card border border-border rounded-lg p-2 shadow-lg">
                                            <p className="text-sm font-medium" style={{ color: payload[0].payload.color }}>
                                                {payload[0].name}: {payload[0].value}
                                            </p>
                                        </div>
                                    )
                                }
                                return null
                            }}
                        />
                        <Legend
                            layout="horizontal"
                            verticalAlign="bottom"
                            align="center"
                            wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-[220px] flex items-center justify-center text-muted-foreground">
                    No data available
                </div>
            )}
        </div>
    )
}

const CHART_COLORS = {
    primary: '#8b5cf6',
    secondary: '#3b82f6',
    success: '#22c55e',
    warning: '#f59e0b',
    destructive: '#ef4444',
    accent: '#ec4899',
}

export function DashboardPage() {
    const [analytics, setAnalytics] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState('')
    const [filter, setFilter] = useState<FilterType>('monthly')

    useEffect(() => {
        fetchAnalytics()
    }, [filter])

    const fetchAnalytics = async () => {
        setIsLoading(true)
        setError('')
        try {
            const response = await getDashboardAnalytics(filter)
            if (response.success) {
                setAnalytics(response.response)
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to fetch analytics')
        } finally {
            setIsLoading(false)
        }
    }

    const filterOptions: { value: FilterType; label: string }[] = [
        { value: 'today', label: 'Today' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' },
        { value: 'yearly', label: 'Yearly' }
    ]

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                    <p className="text-sm text-muted-foreground mb-1">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
                            {entry.name}: {entry.name.includes('Amount') ? `₹${entry.value.toLocaleString('en-IN')}` : entry.value.toLocaleString()}
                        </p>
                    ))}
                </div>
            )
        }
        return null
    }

    const formatCurrency = (value: number) => `₹${value.toLocaleString('en-IN')}`

    // Stats sections
    const userStats = [
        { title: 'Total Users', value: analytics?.overview.totalUsers || 0, icon: Users, color: 'bg-primary/10 text-primary' },
        { title: 'Active Users', value: analytics?.overview.activeUsers || 0, icon: UserCheck, color: 'bg-green-500/10 text-green-500' },
        { title: 'Blocked Users', value: analytics?.overview.blockedUsers || 0, icon: UserX, color: 'bg-red-500/10 text-red-500' },
        { title: `New Users (${filter})`, value: analytics?.periodStats.newUsers || 0, icon: UserPlus, color: 'bg-blue-500/10 text-blue-500', trend: analytics?.periodStats.userGrowthPercent },
    ]

    const sellingStats = [
        { title: 'Total Selling Amount', value: formatCurrency(analytics?.selling?.totalAmount || 0), icon: IndianRupee, color: 'bg-emerald-500/10 text-emerald-500' },
        { title: 'Total Quantity (L)', value: `${(analytics?.selling?.totalQuantity || 0).toFixed(1)} L`, icon: Milk, color: 'bg-blue-500/10 text-blue-500' },
    ]

    const purchaseStats = [
        { title: 'Total Purchase Amount', value: formatCurrency(analytics?.purchase?.totalAmount || 0), icon: IndianRupee, color: 'bg-violet-500/10 text-violet-500' },
        { title: 'Total Quantity (L)', value: `${(analytics?.purchase?.totalQuantity || 0).toFixed(1)} L`, icon: Milk, color: 'bg-cyan-500/10 text-cyan-500' },
    ]

    const managementStats = [
        { title: 'Total Farmers', value: analytics?.overview.totalFarmers || 0, icon: Users, color: 'bg-orange-500/10 text-orange-500', subValue: `${analytics?.overview.activeFarmers || 0} active` },
        { title: 'Total Members', value: analytics?.overview.totalMembers || 0, icon: UserCheck, color: 'bg-indigo-500/10 text-indigo-500', subValue: `${analytics?.overview.activeMembers || 0} active` },
        { title: 'Subscriptions', value: analytics?.overview.totalSubscriptions || 0, icon: CreditCard, color: 'bg-pink-500/10 text-pink-500', subValue: `${analytics?.overview.activeSubscriptions || 0} active` },
        { title: 'Products', value: analytics?.overview.totalProducts || 0, icon: Package, color: 'bg-teal-500/10 text-teal-500', subValue: `${analytics?.overview.activeProducts || 0} active` },
    ]

    const contentStats = [
        { title: 'Total Selling Entries', value: analytics?.overview.totalSellingEntries || 0, icon: BarChart3, color: 'bg-blue-500/10 text-blue-500' },
        { title: 'Total Milk Collections', value: analytics?.overview.totalMilkCollections || 0, icon: Milk, color: 'bg-purple-500/10 text-purple-500' },
        { title: 'Active Banners', value: analytics?.overview.activeBanners || 0, icon: Image, color: 'bg-rose-500/10 text-rose-500', subValue: `of ${analytics?.overview.totalBanners || 0} total` },
    ]

    return (
        <div className="animate-fade-in space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Welcome to Milkey Admin Panel
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
                        <Filter className="w-4 h-4 text-muted-foreground ml-2" />
                        {filterOptions.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => setFilter(option.value)}
                                className={cn(
                                    'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                                    filter === option.value
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                )}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={fetchAnalytics}
                        disabled={isLoading}
                        className="p-2 bg-card border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                        <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                    {error}
                </div>
            )}

            {/* Users Section */}
            <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Users Overview</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {userStats.map((stat) => (
                        <StatCard key={stat.title} {...stat} isLoading={isLoading} />
                    ))}
                </div>
            </div>

            {/* Selling Section */}
            <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Selling Overview</h2>
                <div className="grid grid-cols-2 gap-3">
                    {sellingStats.map((stat) => (
                        <StatCard key={stat.title} {...stat} isLoading={isLoading} />
                    ))}
                </div>
            </div>

            {/* Purchase Section */}
            <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Purchase Overview</h2>
                <div className="grid grid-cols-2 gap-3">
                    {purchaseStats.map((stat) => (
                        <StatCard key={stat.title} {...stat} isLoading={isLoading} />
                    ))}
                </div>
            </div>

            {/* Management Stats */}
            <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Management Overview</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {managementStats.map((stat) => (
                        <StatCard key={stat.title} {...stat} isLoading={isLoading} />
                    ))}
                </div>
            </div>

            {/* Content Stats */}
            <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Activity Overview</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {contentStats.map((stat) => (
                        <StatCard key={stat.title} {...stat} isLoading={isLoading} />
                    ))}
                </div>
            </div>

            {/* Charts Row 1 - Growth Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Monthly User Growth Chart */}
                {isLoading ? (
                    <ChartSkeleton />
                ) : (
                    <div className="bg-card border border-border rounded-xl p-5">
                        <h3 className="text-base font-semibold text-foreground mb-4">Monthly User Growth</h3>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={analytics?.charts.monthlyGrowth || []}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                                <Bar dataKey="users" name="New Users" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Selling & Purchase Amount Trend */}
                {isLoading ? (
                    <ChartSkeleton />
                ) : (
                    <div className="bg-card border border-border rounded-xl p-5">
                        <h3 className="text-base font-semibold text-foreground mb-4">Revenue Trend (₹)</h3>
                        <ResponsiveContainer width="100%" height={280}>
                            <ComposedChart data={analytics?.charts.monthlyGrowth || []}>
                                <defs>
                                    <linearGradient id="colorSelling" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={CHART_COLORS.success} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={CHART_COLORS.success} stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorPurchase" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                                <Area type="monotone" dataKey="sellingAmount" name="Selling Amount" stroke={CHART_COLORS.success} strokeWidth={2} fillOpacity={1} fill="url(#colorSelling)" />
                                <Line type="monotone" dataKey="purchaseAmount" name="Purchase Amount" stroke={CHART_COLORS.primary} strokeWidth={2} dot={{ r: 3 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Charts Row 2 - Quantity Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Quantity Trend */}
                {isLoading ? (
                    <ChartSkeleton />
                ) : (
                    <div className="bg-card border border-border rounded-xl p-5">
                        <h3 className="text-base font-semibold text-foreground mb-4">Quantity Trend (Liters)</h3>
                        <ResponsiveContainer width="100%" height={280}>
                            <AreaChart data={analytics?.charts.monthlyGrowth || []}>
                                <defs>
                                    <linearGradient id="colorSellingQty" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={CHART_COLORS.secondary} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={CHART_COLORS.secondary} stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorPurchaseQty" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={CHART_COLORS.accent} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={CHART_COLORS.accent} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                                <Area type="monotone" dataKey="sellingQty" name="Selling Qty" stroke={CHART_COLORS.secondary} strokeWidth={2} fillOpacity={1} fill="url(#colorSellingQty)" />
                                <Area type="monotone" dataKey="purchaseQty" name="Purchase Qty" stroke={CHART_COLORS.accent} strokeWidth={2} fillOpacity={1} fill="url(#colorPurchaseQty)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* User Status Distribution */}
                <PieChartCard
                    title="User Status Distribution"
                    data={analytics?.charts.userStatusDistribution || []}
                    isLoading={isLoading}
                />
            </div>

            {/* Charts Row 3 - Pie Charts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PieChartCard
                    title="Selling Payment Status"
                    data={analytics?.charts.sellingPaymentDistribution || []}
                    isLoading={isLoading}
                />
                <PieChartCard
                    title="Subscription by Tab"
                    data={analytics?.charts.subscriptionDistribution || []}
                    isLoading={isLoading}
                />
            </div>
        </div>
    )
}