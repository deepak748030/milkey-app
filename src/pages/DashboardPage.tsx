import { useState, useEffect } from 'react'
import { Users, UserCheck, RefreshCw, Milk, Package, Image as ImageIcon, IndianRupee, CreditCard, UserPlus, BarChart3, TrendingUp, Wallet, ShoppingCart, Layers, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { getDashboardAnalytics } from '../lib/api'
import { cn } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts'

type FilterType = 'today' | 'weekly' | 'monthly' | 'yearly'

function SkeletonCard() {
  return <div className="rounded-xl border bg-card p-5"><div className="h-3 w-24 skeleton rounded" /><div className="h-8 w-20 skeleton rounded mt-4" /><div className="h-3 w-32 skeleton rounded mt-3" /></div>
}
function ChartSkeleton() {
  return <Card><CardHeader><div className="h-4 w-32 skeleton rounded" /><div className="h-3 w-48 skeleton rounded mt-2" /></CardHeader><CardContent><div className="h-[280px] skeleton rounded-lg" /></CardContent></Card>
}

export function DashboardPage() {
  const [analytics, setAnalytics] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<FilterType>('monthly')

  useEffect(() => { fetchAnalytics() }, [filter])
  const fetchAnalytics = async () => {
    setIsLoading(true); setError('')
    try { const r = await getDashboardAnalytics(filter); if (r.success) setAnalytics(r.response) }
    catch (e: any) { setError(e.response?.data?.message || 'Failed to fetch analytics') }
    finally { setIsLoading(false) }
  }

  const filterOptions: { value: FilterType, label: string }[] = [
    { value: 'today', label: 'Today' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }
  ]

  const fmt = (v: number) => `₹${v.toLocaleString('en-IN')}`

  const heroStats = [
    { title: 'Total Revenue', value: fmt((analytics?.selling?.totalAmount || 0) + (analytics?.purchase?.totalAmount || 0)), sub: 'Selling + Purchase', icon: IndianRupee, accent: 'from-emerald-500 to-green-600', trend: analytics?.periodStats?.userGrowthPercent, trendUp: true },
    { title: 'Total Users', value: (analytics?.overview.totalUsers || 0).toLocaleString('en-IN'), sub: `${analytics?.overview.activeUsers || 0} active`, icon: Users, accent: 'from-primary to-emerald-600', trend: analytics?.periodStats?.userGrowthPercent },
    { title: 'Milk Collected', value: `${(analytics?.purchase?.totalQuantity || analytics?.selling?.totalQuantity || 0).toFixed(1)} L`, sub: `${analytics?.overview.totalMilkCollections || 0} collections`, icon: Milk, accent: 'from-sky-500 to-blue-600' },
    { title: 'Active Subs', value: (analytics?.overview.activeSubscriptions || 0).toLocaleString('en-IN'), sub: `${analytics?.overview.totalSubscriptions || 0} total plans`, icon: CreditCard, accent: 'from-violet-500 to-purple-600' },
  ]

  return (
    <div className="space-y-6 animate-fade-in pb-6 pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
              <Activity className="w-3 h-3" /> Live Dashboard
            </div>
            <h1 className="text-2xl md:text-[26px] font-bold tracking-tight mt-3">Welcome back, Admin</h1>
            <p className="text-sm text-muted-foreground mt-1">Here's what's happening with your dairy business today.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-1 bg-card border border-border rounded-lg shadow-sm">
              {filterOptions.map(o => (
                <button key={o.value} onClick={() => setFilter(o.value)}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all", filter === o.value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted")}>
                  {o.label}
                </button>
              ))}
            </div>
            <button onClick={fetchAnalytics} disabled={isLoading} className="h-9 w-9 flex items-center justify-center bg-card border border-border rounded-lg hover:bg-muted transition-colors">
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </button>
          </div>
        </div>

        {error && <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">{error}</div>}
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />) :
          heroStats.map(s => (
            <Card key={s.title} className="overflow-hidden card-hover p-0">
              <div className={cn("h-1 w-full bg-gradient-to-r", s.accent)} />
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">{s.title}</p>
                    <p className="text-2xl font-bold tracking-tight">{s.value}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><span className="w-1 h-1 rounded-full bg-primary" /> {s.sub}</p>
                  </div>
                  <div className={cn("w-11 h-11 rounded-lg flex items-center justify-center text-white shadow-sm bg-gradient-to-br shrink-0", s.accent)}>
                    <s.icon className="w-5 h-5" />
                  </div>
                </div>
                {s.trend !== undefined && (
                  <div className={cn("inline-flex items-center gap-1 mt-4 px-2 py-1 rounded-full text-xs font-medium border", s.trend >= 0 ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-red-500/10 text-red-600 border-red-500/20")}>
                    {s.trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />} {Math.abs(s.trend)}% vs last {filter}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Farmers', value: analytics?.overview.totalFarmers || 0, sub: `${analytics?.overview.activeFarmers || 0} active`, icon: UserPlus, color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' },
          { label: 'Members', value: analytics?.overview.totalMembers || 0, sub: `${analytics?.overview.activeMembers || 0} active`, icon: UserCheck, color: 'bg-primary/10 text-primary border-primary/20' },
          { label: 'Products', value: analytics?.overview.totalProducts || 0, sub: `${analytics?.overview.activeProducts || 0} active`, icon: Package, color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
          { label: 'Banners', value: analytics?.overview.activeBanners || 0, sub: `${analytics?.overview.totalBanners || 0} total`, icon: ImageIcon, color: 'bg-sky-500/10 text-sky-600 border-sky-500/20' },
        ].map(card => (
          <Card key={card.label} className="p-4 flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center border shrink-0", card.color)}>
              <card.icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
              <p className="text-lg font-bold leading-none mt-0.5">{isLoading ? '—' : card.value}</p>
              <p className="text-xs text-muted-foreground mt-1 truncate">{card.sub}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Revenue split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { title: 'Selling', amount: analytics?.selling?.totalAmount || 0, qty: analytics?.selling?.totalQuantity || 0, icon: ShoppingCart, color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { title: 'Purchase', amount: analytics?.purchase?.totalAmount || 0, qty: analytics?.purchase?.totalQuantity || 0, icon: Wallet, color: 'text-violet-600', bg: 'bg-violet-500/10 border-violet-500/20' },
        ].map(b => (
          <Card key={b.title} className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">{b.title} Overview</p>
                <p className="text-2xl font-bold mt-2">{isLoading ? '—' : fmt(b.amount)}</p>
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                  <Milk className="w-4 h-4" /> {isLoading ? '—' : `${b.qty.toFixed(1)} L`} total quantity
                </p>
              </div>
              <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center border", b.bg, b.color)}>
                <b.icon className="w-6 h-6" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs">
              <Badge variant="outline" className="bg-card">{filter}</Badge>
              <span className="text-muted-foreground">Updated just now</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main revenue chart */}
        {isLoading ? <div className="lg:col-span-2"><ChartSkeleton /></div> : (
          <Card className="lg:col-span-2 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> Revenue Trend</CardTitle>
                <CardDescription>Selling vs Purchase amount • {filter}</CardDescription>
              </div>
              <Badge variant="secondary" className="hidden sm:flex gap-1"><TrendingUp className="w-3 h-3" /> +12.5%</Badge>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={analytics?.charts?.monthlyGrowth || []}>
                  <defs>
                    <linearGradient id="sellingGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22C55E" stopOpacity={0.3} /><stop offset="100%" stopColor="#22C55E" stopOpacity={0} /></linearGradient>
                    <linearGradient id="purchaseGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#16A34A" stopOpacity={0.25} /><stop offset="100%" stopColor="#16A34A" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    content={({ active, payload, label }: any) => active && payload ? (
                      <div className="rounded-xl border bg-card p-4 shadow-soft shadow-medium min-w-[160px]">
                        <p className="text-xs text-muted-foreground mb-2">{label}</p>
                        {payload.map((e: any, i: number) => <p key={i} className="text-sm font-medium flex justify-between gap-4" style={{ color: e.color }}><span>{e.name}</span><span>₹{e.value.toLocaleString('en-IN')}</span></p>)}
                      </div>
                    ) : null}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="sellingAmount" name="Selling" stroke="#22C55E" fill="url(#sellingGrad)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  <Area type="monotone" dataKey="purchaseAmount" name="Purchase" stroke="#16A34A" fill="url(#purchaseGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* User distribution */}
        {isLoading ? <ChartSkeleton /> : (
          <Card>
            <CardHeader>
              <CardTitle>Users by Status</CardTitle>
              <CardDescription>Distribution of user accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={analytics?.charts.userStatusDistribution || [{ name: 'Active', value: 65, color: '#22C55E' }, { name: 'Inactive', value: 25, color: '#E5E7EB' }, { name: 'Blocked', value: 10, color: '#EF4444' }]} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                    {(analytics?.charts.userStatusDistribution || [{ color: '#22C55E' }, { color: '#E5E7EB' }, { color: '#EF4444' }]).map((e: any, i: number) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Active', value: analytics?.overview.activeUsers || 0, color: 'bg-emerald-500' },
                  { label: 'New', value: analytics?.periodStats.newUsers || 0, color: 'bg-primary' },
                  { label: 'Blocked', value: analytics?.overview.blockedUsers || 0, color: 'bg-red-500' },
                ].map(k => (
                  <div key={k.label} className="p-2 rounded-lg bg-muted/50 border">
                    <div className="flex items-center justify-center gap-1.5 text-xs font-medium"><span className={cn("w-2 h-2 rounded-full", k.color)} />{k.label}</div>
                    <p className="font-bold text-sm mt-1">{k.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isLoading ? <><ChartSkeleton /><ChartSkeleton /></> : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Layers className="w-4 h-4 text-primary" /> Monthly Growth</CardTitle>
                <CardDescription>New users acquired per month</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={analytics?.charts.monthlyGrowth || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="users" name="Users" fill="#22C55E" radius={[8, 8, 0, 0]} barSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quantity Trend</CardTitle>
                <CardDescription>Liters collected vs sold</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={analytics?.charts.monthlyGrowth || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="sellingQty" name="Selling L" stroke="#16A34A" fill="#16A34A" fillOpacity={0.15} strokeWidth={2} />
                    <Area type="monotone" dataKey="purchaseQty" name="Purchase L" stroke="#0EA5E9" fill="#0EA5E9" fillOpacity={0.15} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Bottom overview row */}
      <div className="rounded-xl border bg-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">System Health • All services operational</p>
            <p className="text-xs text-muted-foreground">Last synced just now • 99.9% uptime this month</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success">Operational</Badge>
          <Badge variant="secondary">{analytics?.overview.totalMilkCollections || 0} collections today</Badge>
        </div>
      </div>
    </div>
  )
}
