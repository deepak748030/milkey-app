import { useState, useEffect, useCallback, useRef } from 'react'
import {
    Search,
    Eye,
    Ban,
    Check,
    X,
    Loader2,
    RefreshCw,
    Users,
    Wallet,
    TrendingUp,
    Edit3,
    Save,
    Gift,
    Bell,
    Send,
    CreditCard,
    Megaphone,
    Camera,
    Download,
    FileText,
    FileSpreadsheet,
    FileJson,
    FileType,
    BadgeCheck,
    AlertCircle,
} from 'lucide-react'
import {
    getUsers,
    getUsersExport,
    toggleUserBlock,
    toggleUserVerify,
    updateUser,
    updateUserCommission,
    User,
    getSubscriptionsList,
    assignSubscriptionToUser,
    sendNotificationToUser,
    sendBulkNotification,
    SubscriptionListItem,
    uploadImage,
} from '../lib/api'
import { exportUsers, ExportFormat } from '../lib/userExport'
import { cn } from '../lib/utils'
import { useAdminTable } from '../hooks/useAdminTable'
import { UserDetailModal } from '../components/admin/UserDetailModal'
import { Pagination } from '../components/Pagination'
import { UserSkeleton, MobileUserSkeleton, ExportMenuItem, StatChip } from '../components/admin/UserSkeletons'

export function UsersPage() {
    const [pageSize, setPageSize] = useState(10)
    const getUsersFetcher = useCallback((opts: { page: number; limit: number; search: string; status: string }) => getUsers({ page: opts.page, limit: opts.limit, search: opts.search, status: opts.status }), [])
    const { data: users, pagination, loading: isLoading, page, setPage, search, setSearch, status: statusFilter, setStatus: setStatusFilter, refresh: fetchUsers, setData: setUsers } = useAdminTable<User>(getUsersFetcher, 'all', pageSize)
    const [selectedUser, setSelectedUser] = useState<User | null>(null)
    const [blockingUserId, setBlockingUserId] = useState<string | null>(null)
    const [verifyingUserId, setVerifyingUserId] = useState<string | null>(null)

    // Broadcast notification state
    const [showBroadcastModal, setShowBroadcastModal] = useState(false)
    const [broadcastTitle, setBroadcastTitle] = useState('')
    const [broadcastMessage, setBroadcastMessage] = useState('')
    const [sendingBroadcast, setSendingBroadcast] = useState(false)

    // Export menu state
    const [showExportMenu, setShowExportMenu] = useState(false)
    const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null)
    const exportMenuRef = useRef<HTMLDivElement | null>(null)

    // Close export menu on outside click
    useEffect(() => {
        if (!showExportMenu) return
        const onClick = (e: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
                setShowExportMenu(false)
            }
        }
        document.addEventListener('mousedown', onClick)
        return () => document.removeEventListener('mousedown', onClick)
    }, [showExportMenu])

    const filterLabel =
        statusFilter === 'new' ? 'new-7d' :
            statusFilter === 'active' ? 'active' :
                statusFilter === 'blocked' ? 'blocked' : 'all'

    const handleExport = async (format: ExportFormat, scope: 'page' | 'all') => {
        setShowExportMenu(false)
        if (scope === 'page') {
            if (!users.length) {
                alert('No users on this page to export')
                return
            }
            exportUsers(users, format, `${filterLabel}-page-${pagination?.page || 1}`)
            return
        }
        // Export ALL users matching current filters (for marketing)
        setExportingFormat(format)
        try {
            const response = await getUsersExport({
                search: search,
                status: statusFilter,
                limit: 50000,
            })
            if (!response.success) {
                alert(response.message || 'Failed to export users')
                return
            }
            const all: User[] = response.response.users || []
            if (!all.length) {
                alert('No users matched the current filters')
                return
            }
            exportUsers(all, format, filterLabel)
        } catch (err: any) {
            console.error('Export failed:', err)
            alert(err?.response?.data?.message || 'Failed to export users')
        } finally {
            setExportingFormat(null)
        }
    }



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

    const handleToggleVerify = async (user: User) => {
        const nextValue = !user.isVerified
        const confirmMsg = nextValue
            ? `Mark "${user.name || 'this user'}" as Verified?\n\nUse this once you've contacted them for marketing.`
            : `Revert "${user.name || 'this user'}" back to New (not yet contacted)?`
        if (!window.confirm(confirmMsg)) return

        setVerifyingUserId(user._id)
        // Optimistic update
        setUsers((prev) =>
            prev.map((u) => (u._id === user._id ? { ...u, isVerified: nextValue } : u))
        )
        try {
            const response = await toggleUserVerify(user._id, nextValue)
            if (!response.success) {
                // Revert on failure
                setUsers((prev) =>
                    prev.map((u) => (u._id === user._id ? { ...u, isVerified: !nextValue } : u))
                )
                alert(response.message || 'Failed to update verification status')
            }
        } catch (err: any) {
            console.error('Failed to toggle verify:', err)
            setUsers((prev) =>
                prev.map((u) => (u._id === user._id ? { ...u, isVerified: !nextValue } : u))
            )
            alert(err?.response?.data?.message || 'Failed to update verification status')
        } finally {
            setVerifyingUserId(null)
        }
    }

    const handleUserUpdate = (updatedUser: User) => {
        setUsers((prev) =>
            prev.map((u) => (u._id === updatedUser._id ? updatedUser : u))
        )
        setSelectedUser(updatedUser)
    }

    const handleBroadcastNotification = async () => {
        if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
            alert('Please enter title and message')
            return
        }

        setSendingBroadcast(true)
        try {
            const response = await sendBulkNotification({
                title: broadcastTitle,
                message: broadcastMessage,
                type: 'admin_broadcast'
            })
            if (response.success) {
                alert(`Notification sent to ${response.response.successful} users! (${response.response.failed} failed)`)
                setShowBroadcastModal(false)
                setBroadcastTitle('')
                setBroadcastMessage('')
            }
        } catch (error: any) {
            console.error('Failed to send broadcast:', error)
            alert(error.response?.data?.message || 'Failed to send notification')
        } finally {
            setSendingBroadcast(false)
        }
    }

    return (
        <div className="animate-fade-in space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4">
                    <div className="p-2 sm:p-3 bg-primary/10 rounded-lg">
                        <Users className="w-5 h-5 sm:w-7 sm:h-7 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Users</h1>
                        <p className="text-xs sm:text-base text-muted-foreground mt-0.5">Manage all registered users</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Export menu */}
                    <div className="relative" ref={exportMenuRef}>
                        <button
                            onClick={() => setShowExportMenu((v) => !v)}
                            disabled={exportingFormat !== null}
                            className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-success text-success-foreground rounded-lg hover:opacity-90 transition-colors disabled:opacity-60"
                            title="Export user data"
                        >
                            {exportingFormat ? (
                                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                            )}
                            <span className="font-medium text-sm sm:text-base hidden sm:inline">
                                {exportingFormat ? 'Exporting…' : 'Export'}
                            </span>
                        </button>
                        {showExportMenu && (
                            <div className="absolute right-0 mt-2 w-72 bg-card border border-border rounded-lg shadow-lg z-30 overflow-hidden">
                                <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase bg-muted/50">
                                    All matching users ({filterLabel})
                                </div>
                                <ExportMenuItem icon={<FileSpreadsheet className="w-4 h-4 text-success" />} label="Excel (.xlsx)" hint="Marketing-friendly" onClick={() => handleExport('xlsx', 'all')} />
                                <ExportMenuItem icon={<FileText className="w-4 h-4 text-primary" />} label="CSV (.csv)" hint="Universal spreadsheet" onClick={() => handleExport('csv', 'all')} />
                                <ExportMenuItem icon={<FileType className="w-4 h-4 text-destructive" />} label="PDF (.pdf)" hint="Printable report" onClick={() => handleExport('pdf', 'all')} />
                                <ExportMenuItem icon={<FileText className="w-4 h-4 text-muted-foreground" />} label="Text (.txt)" hint="Plain readable list" onClick={() => handleExport('txt', 'all')} />
                                <ExportMenuItem icon={<FileJson className="w-4 h-4 text-accent-foreground" />} label="JSON (.json)" hint="Raw data for devs" onClick={() => handleExport('json', 'all')} />
                                <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase bg-muted/50 border-t border-border">
                                    Current page only
                                </div>
                                <ExportMenuItem icon={<FileSpreadsheet className="w-4 h-4 text-success" />} label="Excel (.xlsx)" onClick={() => handleExport('xlsx', 'page')} />
                                <ExportMenuItem icon={<FileText className="w-4 h-4 text-primary" />} label="CSV (.csv)" onClick={() => handleExport('csv', 'page')} />
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => setShowBroadcastModal(true)}
                        className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                        <Megaphone className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="font-medium text-sm sm:text-base hidden sm:inline">Broadcast</span>
                    </button>
                    <button
                        onClick={() => fetchUsers()}
                        disabled={isLoading}
                        className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-card border border-border rounded-lg hover:bg-muted transition-colors"
                    >
                        <RefreshCw className={cn('w-4 h-4 sm:w-5 sm:h-5', isLoading && 'animate-spin')} />
                        <span className="font-medium text-sm sm:text-base">Refresh</span>
                    </button>
                </div>
            </div>

            {/* Stats summary */}
            {pagination && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    <StatChip label="Total (filtered)" value={pagination.total} tone="primary" />
                    <StatChip label="Showing" value={users.length} tone="muted" />
                    <StatChip label="Page" value={`${pagination.page} / ${pagination.pages || 1}`} tone="muted" />
                    <StatChip label="Filter" value={filterLabel} tone="success" />
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search by name, email, phone..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 bg-card border border-input rounded-lg text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                    />
                </div>

                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-3 sm:px-4 py-2.5 sm:py-3 bg-card border border-input rounded-lg text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                    title="Filter users"
                >
                    <option value="all">All Users</option>
                    <option value="new">New (last 7 days)</option>
                    <option value="active">Active</option>
                    <option value="blocked">Blocked</option>
                    <option value="verified">Verified</option>
                    <option value="unverified">Unverified</option>
                </select>

                <select
                    value={pageSize}
                    onChange={(e) => setPageSize(parseInt(e.target.value))}
                    className="px-3 sm:px-4 py-2.5 sm:py-3 bg-card border border-input rounded-lg text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                    title="Rows per page"
                >
                    <option value={10}>10 / page</option>
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                </select>
            </div>


            {/* Table - Desktop */}
            <div className="rounded-xl border bg-card overflow-hidden shadow-soft hidden lg:block">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted/50 border-b border-border">
                            <tr>
                                <th className="text-left p-4 font-semibold text-muted-foreground">User</th>
                                <th className="text-left p-4 font-semibold text-muted-foreground">Email</th>
                                <th className="text-left p-4 font-semibold text-muted-foreground">Phone</th>
                                <th className="text-left p-4 font-semibold text-muted-foreground">Role</th>
                                <th className="text-left p-4 font-semibold text-muted-foreground">Status</th>
                                <th className="text-left p-4 font-semibold text-muted-foreground">Verified</th>
                                <th className="text-left p-4 font-semibold text-muted-foreground">Joined</th>
                                <th className="text-left p-4 font-semibold text-muted-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => <UserSkeleton key={i} />)
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center text-muted-foreground">
                                        <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                        <p className="text-lg">No users found</p>
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr
                                        key={user._id}
                                        className="border-b border-border hover:bg-muted/30 transition-colors"
                                        onContextMenu={(e) => {
                                            e.preventDefault()
                                            handleToggleVerify(user)
                                        }}
                                        title="Right-click to toggle Verified / New"
                                    >
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
                                            <span className="capitalize text-foreground">{user.role || 'owner'}</span>
                                        </td>
                                        <td className="p-4">
                                            <span className={cn(
                                                'px-3 py-1.5 text-sm font-medium rounded-full',
                                                user.isBlocked ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
                                            )}>
                                                {user.isBlocked ? 'Blocked' : 'Active'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleVerify(user)}
                                                disabled={verifyingUserId === user._id}
                                                title={user.isVerified ? 'Click to mark as New (revert)' : 'Click to mark as Verified (contacted)'}
                                                className={cn(
                                                    'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border transition-all disabled:opacity-60',
                                                    user.isVerified
                                                        ? 'bg-success/10 text-success border-success/30 hover:bg-success/20'
                                                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 ring-2 ring-amber-500/20 animate-pulse hover:animate-none hover:bg-amber-500/25'
                                                )}
                                            >
                                                {verifyingUserId === user._id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : user.isVerified ? (
                                                    <BadgeCheck className="w-4 h-4" />
                                                ) : (
                                                    <AlertCircle className="w-4 h-4" />
                                                )}
                                                {user.isVerified ? 'Verified' : 'New'}
                                            </button>
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
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination BTN — premium numbered controls */}
                {pagination && pagination.pages > 1 && (
                    <div className="p-4 border-t border-border">
                        <Pagination page={pagination.page} totalPages={pagination.pages} total={pagination.total} limit={pagination.limit} onPageChange={setPage} />
                    </div>
                )}
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-3">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => <MobileUserSkeleton key={i} />)
                ) : users.length === 0 ? (
                    <div className="bg-card border border-border rounded-lg p-8 text-center">
                        <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground">No users found</p>
                    </div>
                ) : (
                    users.map((user) => (
                        <div key={user._id} className="rounded-xl border bg-card p-4 shadow-soft">
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
                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                    <span className={cn(
                                        'px-2 py-1 text-xs font-medium rounded-full',
                                        user.isBlocked ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
                                    )}>
                                        {user.isBlocked ? 'Blocked' : 'Active'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handleToggleVerify(user)}
                                        disabled={verifyingUserId === user._id}
                                        className={cn(
                                            'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full border transition-all disabled:opacity-60 active:scale-95',
                                            user.isVerified
                                                ? 'bg-success/10 text-success border-success/30 hover:bg-success/20'
                                                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40 animate-pulse hover:animate-none'
                                        )}
                                        title={user.isVerified ? 'Tap to mark as New' : 'Tap to mark as Verified'}
                                    >
                                        {verifyingUserId === user._id ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : user.isVerified ? (
                                            <BadgeCheck className="w-3 h-3" />
                                        ) : (
                                            <AlertCircle className="w-3 h-3" />
                                        )}
                                        {user.isVerified ? 'Verified' : 'New'}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                                <div className="bg-muted/50 rounded-lg p-2">
                                    <p className="text-[10px] text-muted-foreground uppercase">Role</p>
                                    <p className="font-medium text-foreground capitalize">{user.role || 'owner'}</p>
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
                    ))
                )}

                {/* Mobile Pagination BTN */}
                {pagination && pagination.pages > 1 && (
                    <Pagination page={pagination.page} totalPages={pagination.pages} total={pagination.total} limit={pagination.limit} onPageChange={setPage} />
                )}
            </div>

            {/* Detail Modal */}
            <UserDetailModal
                user={selectedUser}
                onClose={() => setSelectedUser(null)}
                onUpdate={handleUserUpdate}
            />

            {/* Broadcast Notification Modal */}
            {showBroadcastModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70" onClick={() => setShowBroadcastModal(false)}>
                    <div
                        className="bg-card border border-border rounded-xl p-4 sm:p-6 w-full max-w-md animate-fade-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4 sm:mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                    <Megaphone className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-foreground">Broadcast Notification</h2>
                                    <p className="text-sm text-muted-foreground">Send to all users</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowBroadcastModal(false)}
                                className="p-2 hover:bg-muted rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-foreground mb-1.5 block">Title</label>
                                <input
                                    type="text"
                                    value={broadcastTitle}
                                    onChange={(e) => setBroadcastTitle(e.target.value)}
                                    placeholder="Notification title..."
                                    className="w-full px-3 py-2.5 bg-muted border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-foreground mb-1.5 block">Message</label>
                                <textarea
                                    value={broadcastMessage}
                                    onChange={(e) => setBroadcastMessage(e.target.value)}
                                    placeholder="Enter your message..."
                                    rows={4}
                                    className="w-full px-3 py-2.5 bg-muted border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                                />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setShowBroadcastModal(false)}
                                    className="flex-1 py-2.5 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/80 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleBroadcastNotification}
                                    disabled={sendingBroadcast || !broadcastTitle.trim() || !broadcastMessage.trim()}
                                    className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg shadow-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                                >
                                    {sendingBroadcast ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Send className="w-4 h-4" />
                                    )}
                                    Send to All
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}