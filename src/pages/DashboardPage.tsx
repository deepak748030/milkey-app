import { useState, useEffect } from 'react'
import {
    Users, UserCheck, UserX, TrendingUp, Filter, RefreshCw,
    ShoppingBag, Truck, Ticket, FolderOpen, Image, IndianRupee,
    Clock, CheckCircle, XCircle, Wifi
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

function StatCard({ title, value, icon: Icon, color, isLoading, prefix = '', suffix = '' }: StatCardProps) {
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
                            {entry.name}: {entry.name === 'Revenue' ? `₹${entry.value.toLocaleString('en-IN')}` : entry.value.toLocaleString()}
                        </p>
                    ))}
                </div>
            )
        }
        return null
    }

    // Stats sections
    const userStats = [
        { title: 'Total Users', value: analytics?.overview.totalUsers || 0, icon: Users, color: 'bg-primary/10 text-primary' },
        { title: 'Active Users', value: analytics?.overview.activeUsers || 0, icon: UserCheck, color: 'bg-green-500/10 text-green-500' },
        { title: 'Blocked Users', value: analytics?.overview.blockedUsers || 0, icon: UserX, color: 'bg-red-500/10 text-red-500' },
        { title: `New (${filter})`, value: analytics?.periodStats.users || 0, icon: TrendingUp, color: 'bg-blue-500/10 text-blue-500' },
    ]

    const orderStats = [
        { title: 'Total Orders', value: analytics?.overview.totalOrders || 0, icon: ShoppingBag, color: 'bg-purple-500/10 text-purple-500' },
        { title: 'Pending', value: analytics?.overview.pendingOrders || 0, icon: Clock, color: 'bg-yellow-500/10 text-yellow-500' },
        { title: 'Delivered', value: analytics?.overview.deliveredOrders || 0, icon: CheckCircle, color: 'bg-green-500/10 text-green-500' },
        { title: 'Cancelled', value: analytics?.overview.cancelledOrders || 0, icon: XCircle, color: 'bg-red-500/10 text-red-500' },
    ]

    const revenueStats = [
        { title: 'Total Revenue', value: `₹${(analytics?.overview.totalRevenue || 0).toLocaleString('en-IN')}`, icon: IndianRupee, color: 'bg-emerald-500/10 text-emerald-500' },
        { title: `Revenue (${filter})`, value: `₹${(analytics?.periodStats.revenue || 0).toLocaleString('en-IN')}`, icon: TrendingUp, color: 'bg-teal-500/10 text-teal-500' },
        { title: 'Active Coupons', value: analytics?.overview.activeCoupons || 0, icon: Ticket, color: 'bg-pink-500/10 text-pink-500' },
        { title: 'Active Banners', value: analytics?.overview.activeBanners || 0, icon: Image, color: 'bg-orange-500/10 text-orange-500' },
    ]

    const deliveryStats = [
        { title: 'Total Partners', value: analytics?.overview.totalDeliveryPartners || 0, icon: Truck, color: 'bg-indigo-500/10 text-indigo-500' },
        { title: 'Active', value: analytics?.overview.activeDeliveryPartners || 0, icon: UserCheck, color: 'bg-green-500/10 text-green-500' },
        { title: 'Online Now', value: analytics?.overview.onlineDeliveryPartners || 0, icon: Wifi, color: 'bg-blue-500/10 text-blue-500' },
        { title: 'Pending KYC', value: analytics?.overview.pendingKycPartners || 0, icon: Clock, color: 'bg-yellow-500/10 text-yellow-500' },
    ]

    const otherStats = [
        { title: 'Categories', value: analytics?.overview.totalCategories || 0, icon: FolderOpen, color: 'bg-cyan-500/10 text-cyan-500' },
        { title: 'Active Categories', value: analytics?.overview.activeCategories || 0, icon: CheckCircle, color: 'bg-green-500/10 text-green-500' },
        { title: 'Total Coupons', value: analytics?.overview.totalCoupons || 0, icon: Ticket, color: 'bg-violet-500/10 text-violet-500' },
        { title: 'Total Banners', value: analytics?.overview.totalBanners || 0, icon: Image, color: 'bg-rose-500/10 text-rose-500' },
    ]

    return (
        <div className="animate-fade-in space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Welcome to The Art Of भ ओ जन Admin Panel
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

            {/* Orders Section */}
            <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Orders Overview</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {orderStats.map((stat) => (
                        <StatCard key={stat.title} {...stat} isLoading={isLoading} />
                    ))}
                </div>
            </div>

            {/* Revenue Section */}
            <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Revenue & Promotions</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {revenueStats.map((stat) => (
                        <StatCard key={stat.title} {...stat} isLoading={isLoading} />
                    ))}
                </div>
            </div>

            {/* Delivery Partners Section */}
            <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Delivery Partners</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {deliveryStats.map((stat) => (
                        <StatCard key={stat.title} {...stat} isLoading={isLoading} />
                    ))}
                </div>
            </div>

            {/* Other Stats */}
            <div>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Content Management</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {otherStats.map((stat) => (
                        <StatCard key={stat.title} {...stat} isLoading={isLoading} />
                    ))}
                </div>
            </div>

            {/* Charts Row 1 - Growth & Revenue Trends */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Monthly Growth Chart */}
                {isLoading ? (
                    <ChartSkeleton />
                ) : (
                    <div className="bg-card border border-border rounded-xl p-5">
                        <h3 className="text-base font-semibold text-foreground mb-4">Monthly Growth Trend</h3>
                        <ResponsiveContainer width="100%" height={280}>
                            <ComposedChart data={analytics?.charts.monthlyGrowth || []}>
                                <defs>
                                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={CHART_COLORS.secondary} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={CHART_COLORS.secondary} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} />
                                <Area type="monotone" dataKey="users" name="Users" stroke={CHART_COLORS.primary} strokeWidth={2} fillOpacity={1} fill="url(#colorUsers)" />
                                <Line type="monotone" dataKey="orders" name="Orders" stroke={CHART_COLORS.secondary} strokeWidth={2} dot={{ r: 3 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Revenue Trend */}
                {isLoading ? (
                    <ChartSkeleton />
                ) : (
                    <div className="bg-card border border-border rounded-xl p-5">
                        <h3 className="text-base font-semibold text-foreground mb-4">Revenue Trend (₹)</h3>
                        <ResponsiveContainer width="100%" height={280}>
                            <AreaChart data={analytics?.charts.monthlyGrowth || []}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={CHART_COLORS.success} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={CHART_COLORS.success} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="revenue" name="Revenue" stroke={CHART_COLORS.success} strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Charts Row 2 - Daily Orders Bar Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {isLoading ? (
                    <ChartSkeleton />
                ) : (
                    <div className="bg-card border border-border rounded-xl p-5">
                        <h3 className="text-base font-semibold text-foreground mb-4">Daily Orders (Last 7 Days)</h3>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={analytics?.charts.dailyOrders || []}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="orders" name="Orders" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {isLoading ? (
                    <ChartSkeleton />
                ) : (
                    <div className="bg-card border border-border rounded-xl p-5">
                        <h3 className="text-base font-semibold text-foreground mb-4">Daily Revenue (Last 7 Days)</h3>
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={analytics?.charts.dailyOrders || []}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="revenue" name="Revenue" fill={CHART_COLORS.success} radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Charts Row 3 - Pie Charts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <PieChartCard
                    title="Order Status"
                    data={analytics?.charts.orderStatusDistribution || []}
                    isLoading={isLoading}
                />
                <PieChartCard
                    title="Payment Methods"
                    data={analytics?.charts.paymentMethodDistribution || []}
                    isLoading={isLoading}
                />
                <PieChartCard
                    title="Delivery Partners"
                    data={analytics?.charts.deliveryPartnerStatus || []}
                    isLoading={isLoading}
                />
                <PieChartCard
                    title="Coupon Status"
                    data={analytics?.charts.couponStatus || []}
                    isLoading={isLoading}
                />
            </div>

            {/* Top Categories */}
            {analytics?.charts.topCategories?.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-5">
                    <h3 className="text-base font-semibold text-foreground mb-4">Top Categories by Orders</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={analytics.charts.topCategories} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={100} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="value" name="Orders" radius={[0, 4, 4, 0]}>
                                {analytics.charts.topCategories.map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    )
}
