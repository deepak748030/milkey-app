// File: src/pages/ActiveSubscriptionsPage.tsx - Show users with active subscriptions and manage referral commission
import { useState, useEffect } from 'react'
import { Search, RefreshCw, Users, DollarSign, Percent, Edit2, X, Check, AlertCircle, Settings } from 'lucide-react'
import { cn } from '../lib/utils'
import { getAllActiveSubscriptions, getAllReferrals, updateReferralCommission, updateDefaultCommission, getDefaultCommission } from '../lib/api'
import { TableSkeleton } from '../components/TableSkeleton'
import { Pagination } from '../components/Pagination'

interface UserSubscription {
    _id: string
    user: {
        _id: string
        name: string
        email: string
        phone: string
        referralCode: string
        referredBy?: {
            _id: string
            name: string
            email: string
        }
    }
    subscription: {
        _id: string
        name: string
        amount: number
        durationMonths: number
    }
    applicableTabs: string[]
    startDate: string
    endDate: string
    amount: number
    isFree: boolean
    paymentStatus: string
}

interface ReferralCommission {
    _id: string
    referrer: {
        _id: string
        name: string
        email: string
    }
    referred: {
        _id: string
        name: string
    }
    totalEarnings: number
    commissionRate: number
    status: string
}

export function ActiveSubscriptionsPage() {
    const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([])
    const [referrals, setReferrals] = useState<ReferralCommission[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [activeTab, setActiveTab] = useState<'subscriptions' | 'referrals'>('subscriptions')
    const [currentPage, setCurrentPage] = useState(1)
    const [editingReferral, setEditingReferral] = useState<string | null>(null)
    const [newCommissionRate, setNewCommissionRate] = useState<number>(5)
    const [defaultCommission, setDefaultCommission] = useState<number>(5)
    const [showDefaultModal, setShowDefaultModal] = useState(false)
    const [savingDefault, setSavingDefault] = useState(false)
    const [stats, setStats] = useState({
        totalActiveUsers: 0,
        totalRevenue: 0,
        totalCommissionPaid: 0
    })
    const itemsPerPage = 10

    const fetchData = async () => {
        setLoading(true)
        try {
            const [subsRes, referralsRes, commissionRes] = await Promise.all([
                getAllActiveSubscriptions(),
                getAllReferrals(),
                getDefaultCommission()
            ])

            if (subsRes.success) {
                setSubscriptions(subsRes.response.subscriptions || [])
                setStats(subsRes.response.stats || stats)
            }

            if (referralsRes.success) {
                setReferrals(referralsRes.response || [])
            }

            if (commissionRes.success) {
                setDefaultCommission(commissionRes.response.commissionRate ?? 5)
            }
        } catch (error) {
            console.error('Failed to fetch data:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const filteredSubscriptions = subscriptions.filter(sub =>
        sub.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
        sub.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
        sub.user?.phone?.includes(search)
    )

    const filteredReferrals = referrals.filter(ref =>
        ref.referrer?.name?.toLowerCase().includes(search.toLowerCase()) ||
        ref.referrer?.email?.toLowerCase().includes(search.toLowerCase()) ||
        ref.referred?.name?.toLowerCase().includes(search.toLowerCase())
    )

    const paginatedSubscriptions = filteredSubscriptions.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )

    const paginatedReferrals = filteredReferrals.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )

    const handleUpdateCommission = async (referralId: string) => {
        try {
            const res = await updateReferralCommission(referralId, newCommissionRate)

            if (res.success) {
                setReferrals(prev => prev.map(ref =>
                    ref._id === referralId
                        ? { ...ref, commissionRate: newCommissionRate }
                        : ref
                ))
                setEditingReferral(null)
            }
        } catch (error) {
            console.error('Failed to update commission:', error)
        }
    }

    const handleUpdateDefaultCommission = async () => {
        setSavingDefault(true)
        try {
            const res = await updateDefaultCommission(defaultCommission)

            if (res.success) {
                // Update all referrals in state with new commission rate
                setReferrals(prev => prev.map(ref => ({
                    ...ref,
                    commissionRate: defaultCommission
                })))
                setShowDefaultModal(false)
                alert(`Default commission updated to ${defaultCommission}% for all users`)
            }
        } catch (error) {
            console.error('Failed to update default commission:', error)
            alert('Failed to update default commission')
        } finally {
            setSavingDefault(false)
        }
    }

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        })
    }

    const getDaysRemaining = (endDate: string) => {
        const end = new Date(endDate)
        const now = new Date()
        const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        return diff
    }

    return (
        <div className="space-y-6">
            {/* Default Commission Modal */}
            {showDefaultModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-foreground">Set Default Commission</h3>
                            <button
                                onClick={() => setShowDefaultModal(false)}
                                className="p-1 hover:bg-muted rounded"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                            This will update the commission rate for all existing referrals at once.
                        </p>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-foreground mb-2">
                                Commission Rate (%)
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    value={defaultCommission}
                                    onChange={(e) => setDefaultCommission(Number(e.target.value))}
                                    className="flex-1 px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary"
                                    min="0"
                                    max="100"
                                    step="0.5"
                                />
                                <span className="text-lg font-medium">%</span>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDefaultModal(false)}
                                className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateDefaultCommission}
                                disabled={savingDefault}
                                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                            >
                                {savingDefault ? 'Saving...' : 'Apply to All'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Active Subscriptions</h1>
                    <p className="text-muted-foreground">Manage user subscriptions and referral commissions</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowDefaultModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                    >
                        <Settings className="w-4 h-4" />
                        Default Commission
                    </button>
                    <button
                        onClick={fetchData}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Active Users</p>
                            <p className="text-2xl font-bold text-foreground">{stats.totalActiveUsers}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total Revenue</p>
                            <p className="text-2xl font-bold text-foreground">₹{stats.totalRevenue.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                            <Percent className="w-5 h-5 text-orange-500" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Commission Paid</p>
                            <p className="text-2xl font-bold text-foreground">₹{stats.totalCommissionPaid.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-border">
                <button
                    onClick={() => { setActiveTab('subscriptions'); setCurrentPage(1); }}
                    className={cn(
                        'px-4 py-2 font-medium transition-colors border-b-2 -mb-px',
                        activeTab === 'subscriptions'
                            ? 'text-primary border-primary'
                            : 'text-muted-foreground border-transparent hover:text-foreground'
                    )}
                >
                    Active Subscriptions ({filteredSubscriptions.length})
                </button>
                <button
                    onClick={() => { setActiveTab('referrals'); setCurrentPage(1); }}
                    className={cn(
                        'px-4 py-2 font-medium transition-colors border-b-2 -mb-px',
                        activeTab === 'referrals'
                            ? 'text-primary border-primary'
                            : 'text-muted-foreground border-transparent hover:text-foreground'
                    )}
                >
                    Referral Commissions ({filteredReferrals.length})
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="Search by name, email, or phone..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                    className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
            </div>

            {loading ? (
                <TableSkeleton rows={5} columns={6} />
            ) : activeTab === 'subscriptions' ? (
                <>
                    {/* Subscriptions Table */}
                    <div className="bg-card border border-border rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-muted/50 border-b border-border">
                                    <tr>
                                        <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">User</th>
                                        <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Subscription</th>
                                        <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Tabs</th>
                                        <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Amount</th>
                                        <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Expires</th>
                                        <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Referred By</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {paginatedSubscriptions.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-8 text-muted-foreground">
                                                No active subscriptions found
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedSubscriptions.map((sub) => {
                                            const daysLeft = getDaysRemaining(sub.endDate)
                                            return (
                                                <tr key={sub._id} className="hover:bg-muted/30">
                                                    <td className="px-4 py-3">
                                                        <div>
                                                            <p className="font-medium text-foreground">{sub.user?.name}</p>
                                                            <p className="text-xs text-muted-foreground">{sub.user?.email}</p>
                                                            <p className="text-xs text-muted-foreground">{sub.user?.phone}</p>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="font-medium text-foreground">{sub.subscription?.name}</span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-wrap gap-1">
                                                            {sub.applicableTabs?.map(tab => (
                                                                <span key={tab} className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full capitalize">
                                                                    {tab}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={cn(
                                                            'font-medium',
                                                            sub.isFree ? 'text-green-500' : 'text-foreground'
                                                        )}>
                                                            {sub.isFree ? 'Free' : `₹${sub.amount}`}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div>
                                                            <p className="text-sm text-foreground">{formatDate(sub.endDate)}</p>
                                                            <p className={cn(
                                                                'text-xs',
                                                                daysLeft <= 7 ? 'text-red-500' : daysLeft <= 30 ? 'text-orange-500' : 'text-green-500'
                                                            )}>
                                                                {daysLeft > 0 ? `${daysLeft} days left` : 'Expired'}
                                                            </p>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {sub.user?.referredBy ? (
                                                            <div>
                                                                <p className="text-sm text-foreground">{sub.user.referredBy.name}</p>
                                                                <p className="text-xs text-muted-foreground">{sub.user.referredBy.email}</p>
                                                            </div>
                                                        ) : (
                                                            <span className="text-muted-foreground">-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <Pagination
                        page={currentPage}
                        totalPages={Math.ceil(filteredSubscriptions.length / itemsPerPage)}
                        onPageChange={setCurrentPage}
                    />
                </>
            ) : (
                <>
                    {/* Referrals Table */}
                    <div className="bg-card border border-border rounded-xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-muted/50 border-b border-border">
                                    <tr>
                                        <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Referrer</th>
                                        <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Referred User</th>
                                        <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Commission Rate</th>
                                        <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Total Earnings</th>
                                        <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
                                        <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {paginatedReferrals.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-8 text-muted-foreground">
                                                No referrals found
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedReferrals.map((ref) => (
                                            <tr key={ref._id} className="hover:bg-muted/30">
                                                <td className="px-4 py-3">
                                                    <div>
                                                        <p className="font-medium text-foreground">{ref.referrer?.name}</p>
                                                        <p className="text-xs text-muted-foreground">{ref.referrer?.email}</p>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-foreground">{ref.referred?.name}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {editingReferral === ref._id ? (
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="number"
                                                                value={newCommissionRate}
                                                                onChange={(e) => setNewCommissionRate(Number(e.target.value))}
                                                                className="w-16 px-2 py-1 bg-background border border-border rounded text-sm"
                                                                min="0"
                                                                max="100"
                                                            />
                                                            <span className="text-sm">%</span>
                                                        </div>
                                                    ) : (
                                                        <span className="font-medium text-primary">{ref.commissionRate}%</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="font-medium text-green-500">₹{ref.totalEarnings}</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={cn(
                                                        'px-2 py-1 text-xs rounded-full',
                                                        ref.status === 'active' ? 'bg-green-500/10 text-green-500' :
                                                            ref.status === 'pending' ? 'bg-orange-500/10 text-orange-500' :
                                                                'bg-muted text-muted-foreground'
                                                    )}>
                                                        {ref.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {editingReferral === ref._id ? (
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => handleUpdateCommission(ref._id)}
                                                                className="p-1 text-green-500 hover:bg-green-500/10 rounded"
                                                            >
                                                                <Check className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingReferral(null)}
                                                                className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => {
                                                                setEditingReferral(ref._id)
                                                                setNewCommissionRate(ref.commissionRate)
                                                            }}
                                                            className="p-1 text-primary hover:bg-primary/10 rounded"
                                                            title="Edit Commission Rate"
                                                        >
                                                            <Edit2 className="w-4 h-4" />
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

                    {/* Info about commission */}
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-foreground">How Commission Works</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                When a referred user purchases a subscription, the referrer receives a commission based on their rate.
                                You can edit individual commission rates by clicking the edit button.
                            </p>
                        </div>
                    </div>

                    <Pagination
                        page={currentPage}
                        totalPages={Math.ceil(filteredReferrals.length / itemsPerPage)}
                        onPageChange={setCurrentPage}
                    />
                </>
            )}
        </div>
    )
}
