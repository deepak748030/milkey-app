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
    Edit3,
    Save,
    Gift,
    Bell,
    Send,
    CreditCard,
    Megaphone,
} from 'lucide-react'
import {
    getUsers,
    toggleUserBlock,
    updateUser,
    updateUserCommission,
    User,
    Pagination,
    getSubscriptionsList,
    assignSubscriptionToUser,
    sendNotificationToUser,
    sendBulkNotification,
    SubscriptionListItem
} from '../lib/api'
import { cn } from '../lib/utils'

// Skeleton component for loading state
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
            <td className="p-4"><div className="h-4 w-20 skeleton rounded" /></td>
            <td className="p-4"><div className="h-7 w-20 skeleton rounded-full" /></td>
            <td className="p-4"><div className="h-4 w-24 skeleton rounded" /></td>
            <td className="p-4">
                <div className="flex gap-2">
                    <div className="h-10 w-10 skeleton rounded-lg" />
                    <div className="h-10 w-10 skeleton rounded-lg" />
                    <div className="h-10 w-10 skeleton rounded-lg" />
                </div>
            </td>
        </tr>
    )
}

// Mobile skeleton
function MobileUserSkeleton() {
    return (
        <div className="bg-card border border-border rounded-xl p-4">
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
    )
}

interface UserDetailModalProps {
    user: User | null
    onClose: () => void
    onUpdate: (user: User) => void
}

function UserDetailModal({ user, onClose, onUpdate }: UserDetailModalProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isCommissionAction, setIsCommissionAction] = useState(false)
    const [commissionAmount, setCommissionAmount] = useState('')
    const [commissionAction, setCommissionAction] = useState<'withdraw' | 'add' | 'set'>('withdraw')
    const [editData, setEditData] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        role: ''
    })

    // Subscription assignment state
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false)
    const [subscriptions, setSubscriptions] = useState<SubscriptionListItem[]>([])
    const [loadingSubscriptions, setLoadingSubscriptions] = useState(false)
    const [selectedSubscription, setSelectedSubscription] = useState('')
    const [assigningSubscription, setAssigningSubscription] = useState(false)
    const [paymentMethod, setPaymentMethod] = useState('cash')

    // Notification state
    const [showNotificationModal, setShowNotificationModal] = useState(false)
    const [notificationTitle, setNotificationTitle] = useState('')
    const [notificationMessage, setNotificationMessage] = useState('')
    const [sendingNotification, setSendingNotification] = useState(false)

    useEffect(() => {
        if (user) {
            setEditData({
                name: user.name || '',
                email: user.email || '',
                phone: user.phone || '',
                address: user.address || '',
                role: user.role || 'owner'
            })
            setIsEditing(false)
            setIsCommissionAction(false)
            setCommissionAmount('')
            setShowSubscriptionModal(false)
            setShowNotificationModal(false)
        }
    }, [user])

    useEffect(() => {
        if (showSubscriptionModal && subscriptions.length === 0) {
            loadSubscriptions()
        }
    }, [showSubscriptionModal])

    const loadSubscriptions = async () => {
        setLoadingSubscriptions(true)
        try {
            const response = await getSubscriptionsList()
            if (response.success) {
                setSubscriptions(response.response)
            }
        } catch (error) {
            console.error('Failed to load subscriptions:', error)
        } finally {
            setLoadingSubscriptions(false)
        }
    }

    if (!user) return null

    const referralEarnings = user.referralEarnings || 0
    const totalReferralEarnings = user.totalReferralEarnings || 0

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const response = await updateUser(user._id, editData)
            if (response.success) {
                onUpdate(response.response)
                setIsEditing(false)
            }
        } catch (error) {
            console.error('Failed to update user:', error)
        } finally {
            setIsSaving(false)
        }
    }

    const handleCommissionAction = async () => {
        const amount = parseFloat(commissionAmount)
        if (isNaN(amount) || amount <= 0) {
            alert('Please enter a valid amount')
            return
        }

        setIsSaving(true)
        try {
            const response = await updateUserCommission(user._id, commissionAction, amount)
            if (response.success) {
                onUpdate({
                    ...user,
                    referralEarnings: response.response.referralEarnings,
                    totalReferralEarnings: response.response.totalReferralEarnings
                })
                setIsCommissionAction(false)
                setCommissionAmount('')
                alert(response.message)
            }
        } catch (error: any) {
            console.error('Failed to update commission:', error)
            alert(error.response?.data?.message || 'Failed to update commission')
        } finally {
            setIsSaving(false)
        }
    }

    const handleAssignSubscription = async () => {
        if (!selectedSubscription) {
            alert('Please select a subscription')
            return
        }

        setAssigningSubscription(true)
        try {
            const response = await assignSubscriptionToUser(user._id, {
                subscriptionId: selectedSubscription,
                paymentMethod
            })
            if (response.success) {
                alert(response.message)
                setShowSubscriptionModal(false)
                setSelectedSubscription('')
            }
        } catch (error: any) {
            console.error('Failed to assign subscription:', error)
            alert(error.response?.data?.message || 'Failed to assign subscription')
        } finally {
            setAssigningSubscription(false)
        }
    }

    const handleSendNotification = async () => {
        if (!notificationTitle.trim() || !notificationMessage.trim()) {
            alert('Please enter title and message')
            return
        }

        setSendingNotification(true)
        try {
            const response = await sendNotificationToUser(user._id, {
                title: notificationTitle,
                message: notificationMessage
            })
            if (response.success) {
                alert(`Notification sent successfully! Push delivered: ${response.response.pushSent ? 'Yes' : 'No (no push token)'}`)
                setShowNotificationModal(false)
                setNotificationTitle('')
                setNotificationMessage('')
            }
        } catch (error: any) {
            console.error('Failed to send notification:', error)
            alert(error.response?.data?.message || 'Failed to send notification')
        } finally {
            setSendingNotification(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70" onClick={onClose}>
            <div
                className="bg-card border border-border rounded-2xl p-4 sm:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between mb-4 sm:mb-6">
                    <h2 className="text-lg sm:text-xl font-bold text-foreground">User Details</h2>
                    <div className="flex items-center gap-2">
                        {!isEditing ? (
                            <button
                                onClick={() => setIsEditing(true)}
                                className="p-2 hover:bg-muted rounded-lg transition-colors text-primary"
                            >
                                <Edit3 className="w-5 h-5" />
                            </button>
                        ) : (
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="p-2 hover:bg-success/10 rounded-lg transition-colors text-success"
                            >
                                {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex flex-col items-center mb-4 sm:mb-6">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-muted overflow-hidden mb-3 sm:mb-4">
                        {user.avatar ? (
                            <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-xl sm:text-2xl font-bold text-muted-foreground">
                                {user.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                        )}
                    </div>
                    {isEditing ? (
                        <input
                            type="text"
                            value={editData.name}
                            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                            className="text-lg font-semibold text-foreground bg-muted px-3 py-1.5 rounded-lg text-center w-full max-w-[200px]"
                        />
                    ) : (
                        <h3 className="text-lg font-semibold text-foreground">{user.name || 'No Name'}</h3>
                    )}
                    <span className={cn(
                        'px-3 py-1 text-sm font-medium rounded-full mt-2',
                        user.isBlocked ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
                    )}>
                        {user.isBlocked ? 'Blocked' : 'Active'}
                    </span>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                    <button
                        onClick={() => setShowSubscriptionModal(true)}
                        className="flex items-center justify-center gap-2 py-2.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors text-sm font-medium"
                    >
                        <Gift className="w-4 h-4" />
                        Assign Subscription
                    </button>
                    <button
                        onClick={() => setShowNotificationModal(true)}
                        className="flex items-center justify-center gap-2 py-2.5 bg-accent/10 text-accent-foreground rounded-lg hover:bg-accent/20 transition-colors text-sm font-medium border border-accent/20"
                    >
                        <Bell className="w-4 h-4" />
                        Send Notification
                    </button>
                </div>

                {/* Subscription Assignment Modal */}
                {showSubscriptionModal && (
                    <div className="mb-4 p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <Gift className="w-4 h-4 text-primary" />
                                Assign Subscription
                            </h4>
                            <button
                                onClick={() => setShowSubscriptionModal(false)}
                                className="p-1 hover:bg-muted rounded"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {loadingSubscriptions ? (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            </div>
                        ) : (
                            <>
                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block">Select Subscription</label>
                                    <select
                                        value={selectedSubscription}
                                        onChange={(e) => setSelectedSubscription(e.target.value)}
                                        className="w-full px-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                    >
                                        <option value="">Choose subscription...</option>
                                        {subscriptions.map(sub => (
                                            <option key={sub._id} value={sub._id}>
                                                {sub.name} - {sub.isFree ? 'FREE' : `₹${sub.amount}`} ({sub.durationMonths} months)
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs text-muted-foreground mb-1 block">Payment Method</label>
                                    <select
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                        className="w-full px-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                    >
                                        <option value="cash">Cash</option>
                                        <option value="upi">UPI</option>
                                        <option value="bank">Bank Transfer</option>
                                        <option value="free">Free (Promo)</option>
                                    </select>
                                </div>

                                <button
                                    onClick={handleAssignSubscription}
                                    disabled={assigningSubscription || !selectedSubscription}
                                    className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                                >
                                    {assigningSubscription ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <CreditCard className="w-4 h-4" />
                                    )}
                                    Assign Subscription
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Notification Modal */}
                {showNotificationModal && (
                    <div className="mb-4 p-4 bg-accent/5 border border-accent/20 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <Bell className="w-4 h-4 text-accent-foreground" />
                                Send Notification
                            </h4>
                            <button
                                onClick={() => setShowNotificationModal(false)}
                                className="p-1 hover:bg-muted rounded"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Title</label>
                            <input
                                type="text"
                                value={notificationTitle}
                                onChange={(e) => setNotificationTitle(e.target.value)}
                                placeholder="Notification title..."
                                className="w-full px-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                        </div>

                        <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Message</label>
                            <textarea
                                value={notificationMessage}
                                onChange={(e) => setNotificationMessage(e.target.value)}
                                placeholder="Notification message..."
                                rows={3}
                                className="w-full px-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                            />
                        </div>

                        <button
                            onClick={handleSendNotification}
                            disabled={sendingNotification || !notificationTitle.trim() || !notificationMessage.trim()}
                            className="w-full py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:bg-foreground/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                        >
                            {sendingNotification ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                            Send Notification & Push
                        </button>
                        <p className="text-xs text-muted-foreground text-center">
                            This will send both in-app notification and push notification (if user has enabled)
                        </p>
                    </div>
                )}

                {/* Commission Section */}
                <div className="mb-4 sm:mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Referral Commission
                        </h4>
                        <button
                            onClick={() => setIsCommissionAction(!isCommissionAction)}
                            className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                        >
                            {isCommissionAction ? 'Cancel' : 'Manage'}
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        <div className="bg-success/10 border border-success/20 rounded-xl p-3 sm:p-4">
                            <div className="flex items-center gap-2 text-success mb-1">
                                <Wallet className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="text-xs font-medium">Available</span>
                            </div>
                            <p className="text-lg sm:text-xl font-bold text-foreground">₹{referralEarnings.toLocaleString()}</p>
                        </div>
                        <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 sm:p-4">
                            <div className="flex items-center gap-2 text-primary mb-1">
                                <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="text-xs font-medium">Total Earned</span>
                            </div>
                            <p className="text-lg sm:text-xl font-bold text-foreground">₹{totalReferralEarnings.toLocaleString()}</p>
                        </div>
                    </div>

                    {/* Commission Actions */}
                    {isCommissionAction && (
                        <div className="mt-3 p-3 bg-muted/50 rounded-xl space-y-3">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setCommissionAction('withdraw')}
                                    className={cn(
                                        'flex-1 py-2 text-xs font-medium rounded-lg transition-colors',
                                        commissionAction === 'withdraw'
                                            ? 'bg-destructive text-destructive-foreground'
                                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                    )}
                                >
                                    Withdraw
                                </button>
                                <button
                                    onClick={() => setCommissionAction('add')}
                                    className={cn(
                                        'flex-1 py-2 text-xs font-medium rounded-lg transition-colors',
                                        commissionAction === 'add'
                                            ? 'bg-success text-success-foreground'
                                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                    )}
                                >
                                    Add
                                </button>
                                <button
                                    onClick={() => setCommissionAction('set')}
                                    className={cn(
                                        'flex-1 py-2 text-xs font-medium rounded-lg transition-colors',
                                        commissionAction === 'set'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                    )}
                                >
                                    Set
                                </button>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={commissionAmount}
                                    onChange={(e) => setCommissionAmount(e.target.value)}
                                    placeholder="Enter amount"
                                    className="flex-1 px-3 py-2 bg-card border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                                <button
                                    onClick={handleCommissionAction}
                                    disabled={isSaving || !commissionAmount}
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                >
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                                </button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {commissionAction === 'withdraw' && 'Withdraw amount from available commission balance'}
                                {commissionAction === 'add' && 'Add amount to commission balance (manual credit)'}
                                {commissionAction === 'set' && 'Set commission balance to specific amount'}
                            </p>
                        </div>
                    )}
                </div>

                {/* Referral Code */}
                {user.referralCode && (
                    <div className="mb-4 p-3 bg-muted/50 rounded-xl">
                        <p className="text-xs text-muted-foreground mb-1">Referral Code</p>
                        <p className="font-mono font-bold text-foreground">{user.referralCode}</p>
                    </div>
                )}


                <div className="space-y-2 sm:space-y-3">
                    <div className="flex justify-between py-2 sm:py-3 border-b border-border">
                        <span className="text-muted-foreground text-sm">ID</span>
                        <span className="text-foreground font-medium text-xs sm:text-sm truncate max-w-[180px] sm:max-w-[250px]">{user._id}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 sm:py-3 border-b border-border">
                        <span className="text-muted-foreground text-sm">Email</span>
                        {isEditing ? (
                            <input
                                type="email"
                                value={editData.email}
                                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                                className="text-foreground font-medium bg-muted px-2 py-1 rounded text-sm w-40 sm:w-48"
                            />
                        ) : (
                            <span className="text-foreground font-medium text-sm">{user.email || 'N/A'}</span>
                        )}
                    </div>
                    <div className="flex justify-between items-center py-2 sm:py-3 border-b border-border">
                        <span className="text-muted-foreground text-sm">Phone</span>
                        {isEditing ? (
                            <input
                                type="tel"
                                value={editData.phone}
                                onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                                className="text-foreground font-medium bg-muted px-2 py-1 rounded text-sm w-32 sm:w-40"
                            />
                        ) : (
                            <span className="text-foreground font-medium text-sm">{user.phone}</span>
                        )}
                    </div>
                    <div className="flex justify-between items-center py-2 sm:py-3 border-b border-border">
                        <span className="text-muted-foreground text-sm">Role</span>
                        {isEditing ? (
                            <select
                                value={editData.role}
                                onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                                className="text-foreground font-medium bg-muted px-2 py-1 rounded text-sm"
                            >
                                <option value="owner">Owner</option>
                                <option value="staff">Staff</option>
                                <option value="farmer">Farmer</option>
                            </select>
                        ) : (
                            <span className="text-foreground font-medium text-sm capitalize">{user.role || 'owner'}</span>
                        )}
                    </div>
                    <div className="flex justify-between items-center py-2 sm:py-3 border-b border-border">
                        <span className="text-muted-foreground text-sm">Address</span>
                        {isEditing ? (
                            <input
                                type="text"
                                value={editData.address}
                                onChange={(e) => setEditData({ ...editData, address: e.target.value })}
                                className="text-foreground font-medium bg-muted px-2 py-1 rounded text-sm w-40 sm:w-48"
                                placeholder="Enter address"
                            />
                        ) : (
                            <span className="text-foreground font-medium text-sm truncate max-w-[150px]">{user.address || 'N/A'}</span>
                        )}
                    </div>
                    <div className="flex justify-between py-2 sm:py-3 border-b border-border">
                        <span className="text-muted-foreground text-sm">Joined</span>
                        <span className="text-foreground font-medium text-sm">
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
                    className="w-full mt-4 sm:mt-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                    Close
                </button>
            </div>
        </div>
    )
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

    // Broadcast notification state
    const [showBroadcastModal, setShowBroadcastModal] = useState(false)
    const [broadcastTitle, setBroadcastTitle] = useState('')
    const [broadcastMessage, setBroadcastMessage] = useState('')
    const [sendingBroadcast, setSendingBroadcast] = useState(false)

    // Debounce search for better performance
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
                    <div className="p-2 sm:p-3 bg-primary/10 rounded-xl">
                        <Users className="w-5 h-5 sm:w-7 sm:h-7 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Users</h1>
                        <p className="text-xs sm:text-base text-muted-foreground mt-0.5">Manage all registered users</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowBroadcastModal(true)}
                        className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
                    >
                        <Megaphone className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="font-medium text-sm sm:text-base hidden sm:inline">Broadcast</span>
                    </button>
                    <button
                        onClick={() => fetchUsers(pagination?.page || 1)}
                        disabled={isLoading}
                        className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-card border border-border rounded-xl hover:bg-muted transition-colors"
                    >
                        <RefreshCw className={cn('w-4 h-4 sm:w-5 sm:h-5', isLoading && 'animate-spin')} />
                        <span className="font-medium text-sm sm:text-base">Refresh</span>
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search by name, email, phone..."
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
                                <th className="text-left p-4 font-semibold text-muted-foreground">Role</th>
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
                                users.map((user) => (
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
                    Array.from({ length: 3 }).map((_, i) => <MobileUserSkeleton key={i} />)
                ) : users.length === 0 ? (
                    <div className="bg-card border border-border rounded-xl p-8 text-center">
                        <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                        <p className="text-muted-foreground">No users found</p>
                    </div>
                ) : (
                    users.map((user) => (
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
            <UserDetailModal
                user={selectedUser}
                onClose={() => setSelectedUser(null)}
                onUpdate={handleUserUpdate}
            />

            {/* Broadcast Notification Modal */}
            {showBroadcastModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70" onClick={() => setShowBroadcastModal(false)}>
                    <div
                        className="bg-card border border-border rounded-2xl p-4 sm:p-6 w-full max-w-md animate-fade-in"
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
                                    className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
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