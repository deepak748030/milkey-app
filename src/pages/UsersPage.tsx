import { useState, useEffect, useCallback } from 'react'
import {
    Search,
    ChevronLeft,
    ChevronRight,
    Eye,
    Ban,
    Check,
    X,
    Loader2,
    RefreshCw,
    Users,
    Wallet,
    TrendingUp,
    Clock,
    ArrowDownCircle,
} from 'lucide-react'
import { getUsers, toggleUserBlock, User, Pagination } from '../lib/api'
import { cn } from '../lib/utils'

function UserSkeleton() {
    return (
        <tr className="border-b border-border">
            <td className="p-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full skeleton" />
                    <div className="space-y-2">
                        <div className="h-4 w-32 skeleton rounded" />
                        <div className="h-3 w-24 skeleton rounded" />
                    </div>
                </div>
            </td>
            <td className="p-4"><div className="h-4 w-40 skeleton rounded" /></td>
            <td className="p-4"><div className="h-4 w-28 skeleton rounded" /></td>
            <td className="p-4">
                <div className="space-y-1">
                    <div className="h-4 w-20 skeleton rounded" />
                    <div className="h-3 w-16 skeleton rounded" />
                </div>
            </td>
            <td className="p-4"><div className="h-7 w-20 skeleton rounded-full" /></td>
            <td className="p-4"><div className="h-4 w-24 skeleton rounded" /></td>
            <td className="p-4">
                <div className="flex gap-2">
                    <div className="h-10 w-10 skeleton rounded-lg" />
                    <div className="h-10 w-10 skeleton rounded-lg" />
                </div>
            </td>
        </tr>
    )
}

interface UserDetailModalProps {
    user: User | null
    onClose: () => void
}

function UserDetailModal({ user, onClose }: UserDetailModalProps) {
    if (!user) return null

    const wallet = user.wallet || { balance: 0, pendingBalance: 0, totalEarnings: 0, totalWithdrawn: 0 }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70" onClick={onClose}>
            <div
                className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between mb-6">
                    <h2 className="text-xl font-bold text-foreground">User Details</h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex flex-col items-center mb-6">
                    <div className="w-20 h-20 rounded-full bg-muted overflow-hidden mb-4">
                        {user.avatar ? (
                            <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-muted-foreground">
                                {user.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                        )}
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">{user.name || 'No Name'}</h3>
                    <span className={cn(
                        'px-3 py-1 text-sm font-medium rounded-full mt-2',
                        user.isBlocked ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
                    )}>
                        {user.isBlocked ? 'Blocked' : 'Active'}
                    </span>
                </div>

                {/* Wallet Section */}
                <div className="mb-6">
                    <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                        <Wallet className="w-4 h-4" />
                        Wallet Balance
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-primary mb-1">
                                <Wallet className="w-4 h-4" />
                                <span className="text-xs font-medium">Available</span>
                            </div>
                            <p className="text-xl font-bold text-foreground">₹{wallet.balance.toLocaleString()}</p>
                        </div>
                        <div className="bg-warning/10 border border-warning/20 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-warning mb-1">
                                <Clock className="w-4 h-4" />
                                <span className="text-xs font-medium">Pending</span>
                            </div>
                            <p className="text-xl font-bold text-foreground">₹{wallet.pendingBalance.toLocaleString()}</p>
                        </div>
                        <div className="bg-success/10 border border-success/20 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-success mb-1">
                                <TrendingUp className="w-4 h-4" />
                                <span className="text-xs font-medium">Total Earnings</span>
                            </div>
                            <p className="text-xl font-bold text-foreground">₹{wallet.totalEarnings.toLocaleString()}</p>
                        </div>
                        <div className="bg-muted border border-border rounded-xl p-4">
                            <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                <ArrowDownCircle className="w-4 h-4" />
                                <span className="text-xs font-medium">Withdrawn</span>
                            </div>
                            <p className="text-xl font-bold text-foreground">₹{wallet.totalWithdrawn.toLocaleString()}</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between py-3 border-b border-border">
                        <span className="text-muted-foreground">ID</span>
                        <span className="text-foreground font-medium text-sm truncate max-w-[250px]">{user._id}</span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-border">
                        <span className="text-muted-foreground">Email</span>
                        <span className="text-foreground font-medium">{user.email || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-border">
                        <span className="text-muted-foreground">Phone</span>
                        <span className="text-foreground font-medium">{user.phone}</span>
                    </div>
                    <div className="flex justify-between py-3 border-b border-border">
                        <span className="text-muted-foreground">Joined</span>
                        <span className="text-foreground font-medium">
                            {new Date(user.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </span>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="w-full mt-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                    Close
                </button>
            </div>
        </div>
    )
}

function formatCurrency(amount: number): string {
    if (amount >= 100000) {
        return `₹${(amount / 100000).toFixed(1)}L`
    } else if (amount >= 1000) {
        return `₹${(amount / 1000).toFixed(1)}K`
    }
    return `₹${amount.toLocaleString()}`
}

export function UsersPage() {
    const [users, setUsers] = useState<User[]>([])
    const [pagination, setPagination] = useState<Pagination | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [selectedUser, setSelectedUser] = useState<User | null>(null)
    const [blockingUserId, setBlockingUserId] = useState<string | null>(null)

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 400)
        return () => clearTimeout(timer)
    }, [search])

    const fetchUsers = useCallback(async (page = 1) => {
        setIsLoading(true)
        try {
            const response = await getUsers({
                page,
                limit: 10,
                search: debouncedSearch,
                status: statusFilter,
            })
            if (response.success) {
                setUsers(response.response.users)
                setPagination(response.response.pagination)
            }
        } catch (err) {
            console.error('Failed to fetch users:', err)
        } finally {
            setIsLoading(false)
        }
    }, [debouncedSearch, statusFilter])

    useEffect(() => {
        fetchUsers(1)
    }, [fetchUsers])

    const handleToggleBlock = async (user: User) => {
        setBlockingUserId(user._id)
        try {
            const response = await toggleUserBlock(user._id)
            if (response.success) {
                setUsers((prev) =>
                    prev.map((u) =>
                        u._id === user._id ? { ...u, isBlocked: response.response.isBlocked } : u
                    )
                )
            }
        } catch (err) {
            console.error('Failed to toggle block:', err)
        } finally {
            setBlockingUserId(null)
        }
    }

    return (
        <div className="animate-fade-in space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="p-2 sm:p-3 bg-primary/10 rounded-xl">
                        <Users className="w-5 h-5 sm:w-7 sm:h-7 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Users</h1>
                        <p className="text-xs sm:text-base text-muted-foreground mt-0.5">Manage all registered users</p>
                    </div>
                </div>
                <button
                    onClick={() => fetchUsers(pagination?.page || 1)}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-card border border-border rounded-xl hover:bg-muted transition-colors"
                >
                    <RefreshCw className={cn('w-4 h-4 sm:w-5 sm:h-5', isLoading && 'animate-spin')} />
                    <span className="font-medium text-sm sm:text-base">Refresh</span>
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 bg-card border border-input rounded-xl text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                    />
                </div>

                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 sm:px-4 py-2.5 sm:py-3 bg-card border border-input rounded-xl text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="blocked">Blocked</option>
                </select>
            </div>

            {/* Table - Desktop */}
            <div className="bg-card border border-border rounded-xl overflow-hidden hidden lg:block">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted/50 border-b border-border">
                            <tr>
                                <th className="text-left p-4 font-semibold text-muted-foreground">User</th>
                                <th className="text-left p-4 font-semibold text-muted-foreground">Email</th>
                                <th className="text-left p-4 font-semibold text-muted-foreground">Phone</th>
                                <th className="text-left p-4 font-semibold text-muted-foreground">Wallet Balance</th>
                                <th className="text-left p-4 font-semibold text-muted-foreground">Status</th>
                                <th className="text-left p-4 font-semibold text-muted-foreground">Joined</th>
                                <th className="text-left p-4 font-semibold text-muted-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => <UserSkeleton key={i} />)
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center text-muted-foreground">
                                        <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                        <p className="text-lg">No users found</p>
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => {
                                    const wallet = user.wallet || { balance: 0, pendingBalance: 0, totalEarnings: 0, totalWithdrawn: 0 }
                                    return (
                                        <tr key={user._id} className="border-b border-border hover:bg-muted/30 transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-full bg-muted overflow-hidden flex-shrink-0">
                                                        {user.avatar ? (
                                                            <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-base font-medium text-muted-foreground">
                                                                {user.name?.charAt(0).toUpperCase() || 'U'}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="font-medium text-foreground">{user.name || 'No Name'}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-muted-foreground">{user.email || 'N/A'}</td>
                                            <td className="p-4 text-muted-foreground">{user.phone}</td>
                                            <td className="p-4">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <Wallet className="w-4 h-4 text-primary" />
                                                        <span className="font-semibold text-foreground">{formatCurrency(wallet.balance)}</span>
                                                    </div>
                                                    {wallet.pendingBalance > 0 && (
                                                        <div className="flex items-center gap-1.5 text-xs">
                                                            <Clock className="w-3 h-3 text-warning" />
                                                            <span className="text-warning">{formatCurrency(wallet.pendingBalance)} pending</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={cn(
                                                    'px-3 py-1.5 text-sm font-medium rounded-full',
                                                    user.isBlocked ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
                                                )}>
                                                    {user.isBlocked ? 'Blocked' : 'Active'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-muted-foreground">
                                                {new Date(user.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => setSelectedUser(user)}
                                                        className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleBlock(user)}
                                                        disabled={blockingUserId === user._id}
                                                        className={cn(
                                                            'p-2.5 rounded-lg transition-colors',
                                                            user.isBlocked
                                                                ? 'text-success hover:bg-success/10'
                                                                : 'text-destructive hover:bg-destructive/10'
                                                        )}
                                                        title={user.isBlocked ? 'Unblock User' : 'Block User'}
                                                    >
                                                        {blockingUserId === user._id ? (
                                                            <Loader2 className="w-5 h-5 animate-spin" />
                                                        ) : user.isBlocked ? (
                                                            <Check className="w-5 h-5" />
                                                        ) : (
                                                            <Ban className="w-5 h-5" />
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
                    <div className="flex items-center justify-between p-4 border-t border-border">
                        <p className="text-muted-foreground text-sm">
                            Showing {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => fetchUsers(pagination.page - 1)}
                                disabled={pagination.page === 1 || isLoading}
                                className="p-2.5 hover:bg-muted rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="px-4 py-2 bg-muted rounded-lg font-medium">
                                {pagination.page} / {pagination.pages}
                            </span>
                            <button
                                onClick={() => fetchUsers(pagination.page + 1)}
                                disabled={pagination.page === pagination.pages || isLoading}
                                className="p-2.5 hover:bg-muted rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-3">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-12 h-12 rounded-full skeleton" />
                                <div className="flex-1">
                                    <div className="h-4 w-24 skeleton rounded mb-2" />
                                    <div className="h-3 w-32 skeleton rounded" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="h-8 skeleton rounded" />
                                <div className="h-8 skeleton rounded" />
                            </div>
                        </div>
                    ))
                ) : users.length === 0 ? (
                    <div className="bg-card border border-border rounded-xl p-8 text-center">
                        <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground">No users found</p>
                    </div>
                ) : (
                    users.map((user) => {
                        const wallet = user.wallet || { balance: 0, pendingBalance: 0, totalEarnings: 0, totalWithdrawn: 0 }
                        return (
                            <div key={user._id} className="bg-card border border-border rounded-xl p-4">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-12 h-12 rounded-full bg-muted overflow-hidden flex-shrink-0">
                                        {user.avatar ? (
                                            <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-base font-medium text-muted-foreground">
                                                {user.name?.charAt(0).toUpperCase() || 'U'}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-foreground truncate">{user.name || 'No Name'}</p>
                                        <p className="text-xs text-muted-foreground truncate">{user.phone}</p>
                                    </div>
                                    <span className={cn(
                                        'px-2 py-1 text-xs font-medium rounded-full flex-shrink-0',
                                        user.isBlocked ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
                                    )}>
                                        {user.isBlocked ? 'Blocked' : 'Active'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                                    <div className="bg-muted/50 rounded-lg p-2">
                                        <p className="text-[10px] text-muted-foreground uppercase">Wallet</p>
                                        <p className="font-semibold text-foreground flex items-center gap-1">
                                            <Wallet className="w-3 h-3 text-primary" />
                                            {formatCurrency(wallet.balance)}
                                        </p>
                                    </div>
                                    <div className="bg-muted/50 rounded-lg p-2">
                                        <p className="text-[10px] text-muted-foreground uppercase">Joined</p>
                                        <p className="font-medium text-foreground text-xs">
                                            {new Date(user.createdAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setSelectedUser(user)}
                                        className="flex-1 flex items-center justify-center gap-2 py-2 text-sm bg-muted hover:bg-muted/80 rounded-lg transition-colors"
                                    >
                                        <Eye className="w-4 h-4" />
                                        View
                                    </button>
                                    <button
                                        onClick={() => handleToggleBlock(user)}
                                        disabled={blockingUserId === user._id}
                                        className={cn(
                                            'flex-1 flex items-center justify-center gap-2 py-2 text-sm rounded-lg transition-colors',
                                            user.isBlocked
                                                ? 'bg-success/10 text-success hover:bg-success/20'
                                                : 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                                        )}
                                    >
                                        {blockingUserId === user._id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : user.isBlocked ? (
                                            <>
                                                <Check className="w-4 h-4" />
                                                Unblock
                                            </>
                                        ) : (
                                            <>
                                                <Ban className="w-4 h-4" />
                                                Block
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )
                    })
                )}

                {/* Mobile Pagination */}
                {pagination && pagination.pages > 1 && (
                    <div className="flex items-center justify-between bg-card border border-border rounded-xl p-3">
                        <p className="text-xs text-muted-foreground">
                            {pagination.page} / {pagination.pages}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => fetchUsers(pagination.page - 1)}
                                disabled={pagination.page === 1 || isLoading}
                                className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => fetchUsers(pagination.page + 1)}
                                disabled={pagination.page === pagination.pages || isLoading}
                                className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            <UserDetailModal user={selectedUser} onClose={() => setSelectedUser(null)} />
        </div>
    )
}
