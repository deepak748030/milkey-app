import { useState, useEffect, useRef } from 'react'
import { Loader2, Edit3, Save, Gift, Bell, Send, CreditCard, X, Wallet, TrendingUp, Camera } from 'lucide-react'
import { cn } from '../../lib/utils'
import { updateUser, updateUserCommission, User, getSubscriptionsList, assignSubscriptionToUser, sendNotificationToUser, SubscriptionListItem, uploadImage } from '../../lib/api'

interface Props { user: User | null; onClose: () => void; onUpdate: (u: User) => void }

export function UserDetailModal({ user, onClose, onUpdate }: Props) {

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

    // Avatar upload state (Instagram-style center-square crop, displayed as circle)
    const [uploadingAvatar, setUploadingAvatar] = useState(false)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

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

    // Crop the picked image to a centred square (Instagram-style) and return base64 JPEG
    const cropToSquareBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onerror = () => reject(new Error('Failed to read file'))
            reader.onload = () => {
                const img = new Image()
                img.onerror = () => reject(new Error('Failed to load image'))
                img.onload = () => {
                    const size = Math.min(img.width, img.height)
                    const sx = (img.width - size) / 2
                    const sy = (img.height - size) / 2

                    const target = Math.min(size, 512) // cap output at 512px for upload size
                    const canvas = document.createElement('canvas')
                    canvas.width = target
                    canvas.height = target
                    const ctx = canvas.getContext('2d')
                    if (!ctx) return reject(new Error('Canvas not supported'))
                    ctx.drawImage(img, sx, sy, size, size, 0, 0, target, target)
                    // Strip "data:image/jpeg;base64," prefix — backend expects raw or full URI; uploadToCloudinary accepts both
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
                    resolve(dataUrl)
                }
                img.src = String(reader.result)
            }
            reader.readAsDataURL(file)
        })
    }

    const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        // Reset input so the same file can be picked again later
        if (e.target) e.target.value = ''
        if (!file) return

        if (!file.type.startsWith('image/')) {
            alert('Please select an image file')
            return
        }
        if (file.size > 10 * 1024 * 1024) {
            alert('Image must be smaller than 10MB')
            return
        }

        setUploadingAvatar(true)
        try {
            const base64 = await cropToSquareBase64(file)
            const uploadRes = await uploadImage(base64, 'milkey/avatars')
            if (!uploadRes.success || !uploadRes.response?.url) {
                alert(uploadRes.message || 'Failed to upload image')
                return
            }
            const url = uploadRes.response.url
            const updateRes = await updateUser(user._id, { avatar: url })
            if (updateRes.success) {
                onUpdate(updateRes.response)
            } else {
                alert(updateRes.message || 'Failed to save avatar')
            }
        } catch (err: any) {
            console.error('Avatar upload failed:', err)
            alert(err?.message || 'Failed to upload avatar')
        } finally {
            setUploadingAvatar(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70" onClick={onClose}>
            <div
                className="bg-card border border-border rounded-xl p-4 sm:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in"
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
                    <div className="relative mb-3 sm:mb-4">
                        {/* Instagram-style gradient ring */}
                        <div className="p-[3px] rounded-full bg-gradient-to-tr from-primary via-accent to-primary">
                            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-card overflow-hidden flex items-center justify-center border-2 border-card">
                                {user.avatar ? (
                                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover rounded-full" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xl sm:text-2xl font-bold text-muted-foreground bg-muted">
                                        {user.name?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                )}
                                {uploadingAvatar && (
                                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                                        <Loader2 className="w-6 h-6 animate-spin text-white" />
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* Camera button — opens file picker */}
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingAvatar}
                            className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center border-2 border-card shadow-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
                            title="Change profile picture"
                        >
                            <Camera className="w-4 h-4" />
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleAvatarFileChange}
                        />
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
                    <div className="mb-4 p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
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
                                        {subscriptions.map(sub => {
                                            // Format duration properly based on durationType
                                            const durationText = sub.durationType && sub.durationValue
                                                ? `${sub.durationValue} ${sub.durationType}`
                                                : sub.durationDays
                                                    ? `${sub.durationDays} days`
                                                    : `${sub.durationMonths || 1} months`;
                                            return (
                                                <option key={sub._id} value={sub._id}>
                                                    {sub.name} - {sub.isFree ? 'FREE' : `₹${sub.amount}`} ({durationText})
                                                </option>
                                            );
                                        })}
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
                    <div className="mb-4 p-4 bg-accent/5 border border-accent/20 rounded-lg space-y-3">
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
                        <div className="bg-success/10 border border-success/20 rounded-lg p-3 sm:p-4">
                            <div className="flex items-center gap-2 text-success mb-1">
                                <Wallet className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="text-xs font-medium">Available</span>
                            </div>
                            <p className="text-lg sm:text-xl font-bold text-foreground">₹{referralEarnings.toLocaleString()}</p>
                        </div>
                        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 sm:p-4">
                            <div className="flex items-center gap-2 text-primary mb-1">
                                <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                                <span className="text-xs font-medium">Total Earned</span>
                            </div>
                            <p className="text-lg sm:text-xl font-bold text-foreground">₹{totalReferralEarnings.toLocaleString()}</p>
                        </div>
                    </div>

                    {/* Commission Actions */}
                    {isCommissionAction && (
                        <div className="mt-3 p-3 bg-muted/50 rounded-lg space-y-3">
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
                    <div className="mb-4 p-3 bg-muted/50 rounded-lg">
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
