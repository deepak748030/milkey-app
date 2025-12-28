import { useState, useEffect, useCallback } from 'react'
import {
    Search,
    Filter,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Truck,
    Phone,
    Mail,
    Star,
    Wallet,
    Shield,
    ShieldCheck,
    ShieldX,
    ShieldAlert,
    Ban,
    CheckCircle,
    XCircle,
    Eye,
    X,
    Bike,
    Car,
    ToggleLeft,
    ToggleRight,
    Circle,
    IndianRupee,
    Package,
    Clock,
} from 'lucide-react'
import { cn } from '../lib/utils'
import {
    getDeliveryPartnersAdmin,
    getDeliveryPartnerByIdAdmin,
    getDeliveryPartnerStats,
    toggleDeliveryPartnerBlock,
    updateDeliveryPartnerKYC,
    toggleDeliveryPartnerActive,
    updateDeliveryPartnerEarnings,
    DeliveryPartner,
    DeliveryPartnerStats,
    Pagination,
} from '../lib/api'

const kycStatusConfig = {
    pending: { label: 'Pending', icon: ShieldAlert, color: 'bg-muted text-muted-foreground' },
    submitted: { label: 'Submitted', icon: Shield, color: 'bg-warning/20 text-warning' },
    approved: { label: 'Approved', icon: ShieldCheck, color: 'bg-success/20 text-success' },
    rejected: { label: 'Rejected', icon: ShieldX, color: 'bg-destructive/20 text-destructive' },
}

const vehicleIcons = {
    bike: Bike,
    scooter: Bike,
    car: Car,
    bicycle: Bike,
}

export function DeliveryPartnersPage() {
    const [partners, setPartners] = useState<DeliveryPartner[]>([])
    const [stats, setStats] = useState<DeliveryPartnerStats | null>(null)
    const [pagination, setPagination] = useState<Pagination | null>(null)
    const [loading, setLoading] = useState(true)
    const [statsLoading, setStatsLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [kycFilter, setKycFilter] = useState<string>('all')
    const [onlineFilter, setOnlineFilter] = useState<string>('all')
    const [page, setPage] = useState(1)

    // Modal states
    const [showDetailModal, setShowDetailModal] = useState(false)
    const [showKycModal, setShowKycModal] = useState(false)
    const [showEarningsModal, setShowEarningsModal] = useState(false)
    const [selectedPartner, setSelectedPartner] = useState<DeliveryPartner | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    // KYC form
    const [kycStatus, setKycStatus] = useState<string>('approved')
    const [rejectionReason, setRejectionReason] = useState('')

    // Earnings form
    const [earningsAmount, setEarningsAmount] = useState<number>(0)
    const [earningsType, setEarningsType] = useState<'add' | 'deduct' | 'set'>('add')

    const fetchStats = useCallback(async () => {
        try {
            setStatsLoading(true)
            const response = await getDeliveryPartnerStats()
            if (response.success) {
                setStats(response.response)
            }
        } catch (error) {
            console.error('Error fetching stats:', error)
        } finally {
            setStatsLoading(false)
        }
    }, [])

    const fetchPartners = useCallback(async () => {
        try {
            setLoading(true)
            const response = await getDeliveryPartnersAdmin({
                page,
                limit: 10,
                search,
                status: statusFilter,
                kycStatus: kycFilter,
                isOnline: onlineFilter !== 'all' ? onlineFilter : undefined,
            })
            if (response.success) {
                setPartners(response.response.partners)
                setPagination(response.response.pagination)
            }
        } catch (error) {
            console.error('Error fetching partners:', error)
        } finally {
            setLoading(false)
        }
    }, [page, search, statusFilter, kycFilter, onlineFilter])

    useEffect(() => {
        fetchStats()
    }, [fetchStats])

    useEffect(() => {
        fetchPartners()

        // Auto-refresh every 10 seconds to sync online status
        const refreshInterval = setInterval(() => {
            fetchPartners()
            fetchStats()
        }, 10000)

        return () => clearInterval(refreshInterval)
    }, [fetchPartners, fetchStats])

    useEffect(() => {
        setPage(1)
    }, [search, statusFilter, kycFilter, onlineFilter])

    const handleViewDetails = async (partner: DeliveryPartner) => {
        try {
            setDetailLoading(true)
            setShowDetailModal(true)
            const response = await getDeliveryPartnerByIdAdmin(partner._id)
            if (response.success) {
                setSelectedPartner(response.response.partner)
            }
        } catch (error) {
            console.error('Error fetching partner details:', error)
        } finally {
            setDetailLoading(false)
        }
    }

    const handleToggleBlock = async (id: string) => {
        try {
            setActionLoading(id)
            await toggleDeliveryPartnerBlock(id)
            fetchPartners()
            fetchStats()
        } catch (error) {
            console.error('Error toggling block:', error)
        } finally {
            setActionLoading(null)
        }
    }

    const handleToggleActive = async (id: string) => {
        try {
            setActionLoading(id)
            await toggleDeliveryPartnerActive(id)
            fetchPartners()
            fetchStats()
        } catch (error) {
            console.error('Error toggling active:', error)
        } finally {
            setActionLoading(null)
        }
    }

    const openKycModal = (partner: DeliveryPartner) => {
        setSelectedPartner(partner)
        setKycStatus(partner.kycStatus === 'approved' ? 'rejected' : 'approved')
        setRejectionReason('')
        setShowKycModal(true)
    }

    const handleUpdateKYC = async () => {
        if (!selectedPartner) return
        try {
            setActionLoading('kyc')
            await updateDeliveryPartnerKYC(selectedPartner._id, kycStatus, rejectionReason)
            setShowKycModal(false)
            fetchPartners()
            fetchStats()
        } catch (error) {
            console.error('Error updating KYC:', error)
        } finally {
            setActionLoading(null)
        }
    }

    const openEarningsModal = (partner: DeliveryPartner) => {
        setSelectedPartner(partner)
        setEarningsAmount(0)
        setEarningsType('add')
        setShowEarningsModal(true)
    }

    const handleUpdateEarnings = async () => {
        if (!selectedPartner || earningsAmount <= 0) return
        try {
            setActionLoading('earnings')
            await updateDeliveryPartnerEarnings(selectedPartner._id, earningsAmount, earningsType)
            setShowEarningsModal(false)
            fetchPartners()
        } catch (error) {
            console.error('Error updating earnings:', error)
        } finally {
            setActionLoading(null)
        }
    }

    const StatCard = ({ label, value, icon: Icon, color, loading: isLoading }: { label: string; value: number | string; icon: React.ElementType; color: string; loading?: boolean }) => (
        <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
                <div className={cn('p-2.5 rounded-lg', color)}>
                    <Icon className="w-5 h-5" />
                </div>
                <div>
                    {isLoading ? (
                        <div className="skeleton h-6 w-12 rounded mb-1" />
                    ) : (
                        <p className="text-xl font-bold text-foreground">{value}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{label}</p>
                </div>
            </div>
        </div>
    )

    const SkeletonRow = () => (
        <tr className="border-b border-border/50">
            <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                    <div className="skeleton h-10 w-10 rounded-full" />
                    <div className="space-y-1">
                        <div className="skeleton h-4 w-28 rounded" />
                        <div className="skeleton h-3 w-20 rounded" />
                    </div>
                </div>
            </td>
            <td className="px-4 py-3"><div className="skeleton h-4 w-24 rounded" /></td>
            <td className="px-4 py-3"><div className="skeleton h-6 w-20 rounded-full" /></td>
            <td className="px-4 py-3"><div className="skeleton h-4 w-16 rounded" /></td>
            <td className="px-4 py-3"><div className="skeleton h-4 w-16 rounded" /></td>
            <td className="px-4 py-3"><div className="skeleton h-6 w-16 rounded-full" /></td>
            <td className="px-4 py-3"><div className="skeleton h-8 w-24 rounded" /></td>
        </tr>
    )

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Header */}
            <div>
                <h1 className="text-xl lg:text-2xl font-bold text-foreground">Delivery Partners</h1>
                <p className="text-sm text-muted-foreground">
                    Manage delivery partners, KYC & earnings
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <StatCard label="Total" value={stats?.total || 0} icon={Truck} color="bg-primary/20 text-primary" loading={statsLoading} />
                <StatCard label="Online" value={stats?.online || 0} icon={Circle} color="bg-success/20 text-success" loading={statsLoading} />
                <StatCard label="Active" value={stats?.active || 0} icon={CheckCircle} color="bg-info/20 text-info" loading={statsLoading} />
                <StatCard label="Blocked" value={stats?.blocked || 0} icon={Ban} color="bg-destructive/20 text-destructive" loading={statsLoading} />
                <StatCard label="Pending KYC" value={stats?.submittedKyc || 0} icon={ShieldAlert} color="bg-warning/20 text-warning" loading={statsLoading} />
                <StatCard label="Total Deliveries" value={stats?.totalDeliveries || 0} icon={Package} color="bg-accent/20 text-accent-foreground" loading={statsLoading} />
            </div>

            {/* Filters */}
            <div className="bg-card border border-border rounded-xl p-3">
                <div className="flex flex-col lg:flex-row gap-3">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by name, phone, vehicle..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    </div>

                    {/* Status Filter */}
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="pl-9 pr-8 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer min-w-[130px]"
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="blocked">Blocked</option>
                        </select>
                    </div>

                    {/* KYC Filter */}
                    <div className="relative">
                        <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <select
                            value={kycFilter}
                            onChange={(e) => setKycFilter(e.target.value)}
                            className="pl-9 pr-8 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer min-w-[130px]"
                        >
                            <option value="all">All KYC</option>
                            <option value="pending">Pending</option>
                            <option value="submitted">Submitted</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>

                    {/* Online Filter */}
                    <div className="relative">
                        <Circle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <select
                            value={onlineFilter}
                            onChange={(e) => setOnlineFilter(e.target.value)}
                            className="pl-9 pr-8 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer min-w-[120px]"
                        >
                            <option value="all">All</option>
                            <option value="true">Online</option>
                            <option value="false">Offline</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted/50">
                            <tr className="border-b border-border">
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Partner</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Vehicle</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">KYC</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Deliveries</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Balance</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {loading ? (
                                <>
                                    <SkeletonRow />
                                    <SkeletonRow />
                                    <SkeletonRow />
                                    <SkeletonRow />
                                    <SkeletonRow />
                                </>
                            ) : partners.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center">
                                        <Truck className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                                        <p className="text-sm text-muted-foreground">No delivery partners found</p>
                                    </td>
                                </tr>
                            ) : (
                                partners.map((partner) => {
                                    const KycIcon = kycStatusConfig[partner.kycStatus]?.icon || Shield
                                    const VehicleIcon = vehicleIcons[partner.vehicle?.type] || Bike
                                    return (
                                        <tr key={partner._id} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative">
                                                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                                                            {partner.avatar ? (
                                                                <img src={partner.avatar} alt={partner.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <Truck className="w-5 h-5 text-muted-foreground" />
                                                            )}
                                                        </div>
                                                        {partner.isOnline && (
                                                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-success rounded-full border-2 border-card" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-foreground">{partner.name || 'Unnamed'}</p>
                                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <Phone className="w-3 h-3" />
                                                            {partner.phone}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <VehicleIcon className="w-4 h-4 text-muted-foreground" />
                                                    <div>
                                                        <p className="text-sm text-foreground capitalize">{partner.vehicle?.type || '—'}</p>
                                                        <p className="text-xs text-muted-foreground">{partner.vehicle?.number || 'No number'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => openKycModal(partner)}
                                                    className={cn(
                                                        'px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 hover:opacity-80 transition-opacity',
                                                        kycStatusConfig[partner.kycStatus]?.color
                                                    )}
                                                >
                                                    <KycIcon className="w-3 h-3" />
                                                    {kycStatusConfig[partner.kycStatus]?.label}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1">
                                                    <Package className="w-3.5 h-3.5 text-muted-foreground" />
                                                    <span className="text-sm text-foreground">{partner.stats?.totalDeliveries || 0}</span>
                                                </div>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <Star className="w-3 h-3 text-warning fill-warning" />
                                                    <span className="text-xs text-muted-foreground">{partner.stats?.rating?.toFixed(1) || '5.0'}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => openEarningsModal(partner)}
                                                    className="flex items-center gap-1 hover:text-primary transition-colors"
                                                >
                                                    <IndianRupee className="w-3.5 h-3.5" />
                                                    <span className="text-sm font-medium text-foreground">{partner.earnings?.total?.toLocaleString() || 0}</span>
                                                </button>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-1">
                                                    {partner.isBlocked ? (
                                                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-destructive/20 text-destructive">
                                                            Blocked
                                                        </span>
                                                    ) : partner.isActive ? (
                                                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-success/20 text-success">
                                                            Active
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-muted text-muted-foreground">
                                                            Inactive
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleViewDetails(partner)}
                                                        className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-4 h-4 text-primary" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleActive(partner._id)}
                                                        disabled={actionLoading === partner._id}
                                                        className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                                                        title={partner.isActive ? 'Deactivate' : 'Activate'}
                                                    >
                                                        {actionLoading === partner._id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : partner.isActive ? (
                                                            <ToggleRight className="w-4 h-4 text-success" />
                                                        ) : (
                                                            <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleBlock(partner._id)}
                                                        disabled={actionLoading === partner._id}
                                                        className={cn(
                                                            'p-1.5 rounded-lg transition-colors disabled:opacity-50',
                                                            partner.isBlocked ? 'hover:bg-success/20' : 'hover:bg-destructive/20'
                                                        )}
                                                        title={partner.isBlocked ? 'Unblock' : 'Block'}
                                                    >
                                                        {partner.isBlocked ? (
                                                            <CheckCircle className="w-4 h-4 text-success" />
                                                        ) : (
                                                            <Ban className="w-4 h-4 text-destructive" />
                                                        )}
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

                {/* Pagination */}
                {pagination && pagination.pages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                        <p className="text-xs text-muted-foreground">
                            Showing {((page - 1) * pagination.limit) + 1} to {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
                        </p>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                                let pageNum: number
                                if (pagination.pages <= 5) {
                                    pageNum = i + 1
                                } else if (page <= 3) {
                                    pageNum = i + 1
                                } else if (page >= pagination.pages - 2) {
                                    pageNum = pagination.pages - 4 + i
                                } else {
                                    pageNum = page - 2 + i
                                }
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setPage(pageNum)}
                                        className={cn(
                                            'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                                            page === pageNum
                                                ? 'bg-primary text-primary-foreground'
                                                : 'hover:bg-muted'
                                        )}
                                    >
                                        {pageNum}
                                    </button>
                                )
                            })}
                            <button
                                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                                disabled={page === pagination.pages}
                                className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {showDetailModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-in">
                        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
                            <h2 className="text-lg font-semibold text-foreground">Partner Details</h2>
                            <button
                                onClick={() => { setShowDetailModal(false); setSelectedPartner(null) }}
                                className="p-2 rounded-lg hover:bg-muted transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        {detailLoading ? (
                            <div className="p-8 flex items-center justify-center">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        ) : selectedPartner ? (
                            <div className="p-4 space-y-4">
                                {/* Profile Header */}
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                                            {selectedPartner.avatar ? (
                                                <img src={selectedPartner.avatar} alt={selectedPartner.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <Truck className="w-8 h-8 text-muted-foreground" />
                                            )}
                                        </div>
                                        {selectedPartner.isOnline && (
                                            <span className="absolute bottom-0 right-0 w-4 h-4 bg-success rounded-full border-2 border-card" />
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold text-foreground">{selectedPartner.name || 'Unnamed'}</h3>
                                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Phone className="w-3.5 h-3.5" />
                                                {selectedPartner.phone}
                                            </span>
                                            {selectedPartner.email && (
                                                <span className="flex items-center gap-1">
                                                    <Mail className="w-3.5 h-3.5" />
                                                    {selectedPartner.email}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                                        <Package className="w-5 h-5 mx-auto text-primary mb-1" />
                                        <p className="text-lg font-bold text-foreground">{selectedPartner.stats?.totalDeliveries || 0}</p>
                                        <p className="text-xs text-muted-foreground">Deliveries</p>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                                        <Star className="w-5 h-5 mx-auto text-warning mb-1" />
                                        <p className="text-lg font-bold text-foreground">{selectedPartner.stats?.rating?.toFixed(1) || '5.0'}</p>
                                        <p className="text-xs text-muted-foreground">Rating</p>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                                        <Wallet className="w-5 h-5 mx-auto text-success mb-1" />
                                        <p className="text-lg font-bold text-foreground">₹{selectedPartner.earnings?.total?.toLocaleString() || 0}</p>
                                        <p className="text-xs text-muted-foreground">Total Earned</p>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-3 text-center">
                                        <Clock className="w-5 h-5 mx-auto text-info mb-1" />
                                        <p className="text-lg font-bold text-foreground">
                                            {new Date(selectedPartner.memberSince).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                                        </p>
                                        <p className="text-xs text-muted-foreground">Member Since</p>
                                    </div>
                                </div>

                                {/* Vehicle Info */}
                                <div className="bg-muted/30 rounded-lg p-4">
                                    <h4 className="text-sm font-medium text-foreground mb-2">Vehicle Details</h4>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <p className="text-muted-foreground">Type</p>
                                            <p className="text-foreground capitalize">{selectedPartner.vehicle?.type || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Number</p>
                                            <p className="text-foreground">{selectedPartner.vehicle?.number || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Model</p>
                                            <p className="text-foreground">{selectedPartner.vehicle?.model || '—'}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Color</p>
                                            <p className="text-foreground">{selectedPartner.vehicle?.color || '—'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* KYC Documents */}
                                <div className="bg-muted/30 rounded-lg p-4">
                                    <h4 className="text-sm font-medium text-foreground mb-2">KYC Documents</h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {['aadhaar', 'pan', 'license', 'selfie'].map((doc) => (
                                            <div
                                                key={doc}
                                                className={cn(
                                                    'aspect-square rounded-lg border-2 border-dashed flex items-center justify-center',
                                                    selectedPartner.documents?.[doc as keyof typeof selectedPartner.documents]
                                                        ? 'border-success bg-success/10'
                                                        : 'border-border bg-muted/50'
                                                )}
                                            >
                                                {selectedPartner.documents?.[doc as keyof typeof selectedPartner.documents] ? (
                                                    <img
                                                        src={selectedPartner.documents[doc as keyof typeof selectedPartner.documents]}
                                                        alt={doc}
                                                        className="w-full h-full object-cover rounded-lg"
                                                    />
                                                ) : (
                                                    <div className="text-center">
                                                        <XCircle className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
                                                        <p className="text-xs text-muted-foreground capitalize">{doc}</p>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {selectedPartner.kycRejectionReason && (
                                        <p className="mt-3 text-sm text-destructive">
                                            Rejection Reason: {selectedPartner.kycRejectionReason}
                                        </p>
                                    )}
                                </div>

                                {/* Earnings Breakdown */}
                                <div className="bg-muted/30 rounded-lg p-4">
                                    <h4 className="text-sm font-medium text-foreground mb-2">Earnings Breakdown</h4>
                                    <div className="grid grid-cols-4 gap-3 text-sm text-center">
                                        <div>
                                            <p className="text-muted-foreground">Today</p>
                                            <p className="text-foreground font-medium">₹{selectedPartner.earnings?.today || 0}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">This Week</p>
                                            <p className="text-foreground font-medium">₹{selectedPartner.earnings?.week || 0}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">This Month</p>
                                            <p className="text-foreground font-medium">₹{selectedPartner.earnings?.month || 0}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground">Total</p>
                                            <p className="text-foreground font-medium">₹{selectedPartner.earnings?.total || 0}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            )}

            {/* KYC Modal */}
            {showKycModal && selectedPartner && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-card border border-border rounded-xl w-full max-w-md animate-scale-in">
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h2 className="text-lg font-semibold text-foreground">Update KYC Status</h2>
                            <button
                                onClick={() => setShowKycModal(false)}
                                className="p-2 rounded-lg hover:bg-muted transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Updating KYC for <span className="font-medium text-foreground">{selectedPartner.name || selectedPartner.phone}</span>
                            </p>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">KYC Status</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {['approved', 'rejected', 'pending', 'submitted'].map((status) => (
                                        <button
                                            key={status}
                                            type="button"
                                            onClick={() => setKycStatus(status)}
                                            className={cn(
                                                'px-3 py-2 rounded-lg border text-sm font-medium transition-colors capitalize',
                                                kycStatus === status
                                                    ? 'border-primary bg-primary/10 text-primary'
                                                    : 'border-border hover:bg-muted'
                                            )}
                                        >
                                            {status}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {kycStatus === 'rejected' && (
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Rejection Reason</label>
                                    <textarea
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        placeholder="Enter reason for rejection..."
                                        rows={3}
                                        className="w-full px-4 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                                    />
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowKycModal(false)}
                                    className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUpdateKYC}
                                    disabled={actionLoading === 'kyc' || (kycStatus === 'rejected' && !rejectionReason)}
                                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {actionLoading === 'kyc' ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Updating...
                                        </>
                                    ) : (
                                        'Update KYC'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Earnings Modal */}
            {showEarningsModal && selectedPartner && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-card border border-border rounded-xl w-full max-w-md animate-scale-in">
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h2 className="text-lg font-semibold text-foreground">Adjust Earnings</h2>
                            <button
                                onClick={() => setShowEarningsModal(false)}
                                className="p-2 rounded-lg hover:bg-muted transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="bg-muted/50 rounded-lg p-3 text-center">
                                <p className="text-sm text-muted-foreground">Current Balance</p>
                                <p className="text-2xl font-bold text-foreground">₹{selectedPartner.earnings?.total?.toLocaleString() || 0}</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Action Type</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { value: 'add', label: 'Add', color: 'text-success' },
                                        { value: 'deduct', label: 'Deduct', color: 'text-destructive' },
                                        { value: 'set', label: 'Set', color: 'text-primary' },
                                    ].map((type) => (
                                        <button
                                            key={type.value}
                                            type="button"
                                            onClick={() => setEarningsType(type.value as typeof earningsType)}
                                            className={cn(
                                                'px-3 py-2 rounded-lg border text-sm font-medium transition-colors',
                                                earningsType === type.value
                                                    ? 'border-primary bg-primary/10 text-primary'
                                                    : 'border-border hover:bg-muted'
                                            )}
                                        >
                                            {type.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Amount (₹)</label>
                                <input
                                    type="number"
                                    value={earningsAmount}
                                    onChange={(e) => setEarningsAmount(Math.max(0, parseInt(e.target.value) || 0))}
                                    min={0}
                                    className="w-full px-4 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowEarningsModal(false)}
                                    className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUpdateEarnings}
                                    disabled={actionLoading === 'earnings' || earningsAmount <= 0}
                                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {actionLoading === 'earnings' ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Updating...
                                        </>
                                    ) : (
                                        'Update'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
