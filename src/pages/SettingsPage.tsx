import { useState, useEffect } from 'react'
import {
    User,
    Lock,
    Activity,
    Save,
    Eye,
    EyeOff,
    ShoppingBag,
    Users,
    Ticket,
    FolderOpen,
    Image,
    Truck,
    Calendar,
    Clock,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useAuth } from '../context/AuthContext'
import {
    updateAdminProfile,
    updateAdminPassword,
    getAdminActivity,
    AdminActivity,
} from '../lib/api'

type TabType = 'profile' | 'password' | 'activity'

export function SettingsPage() {
    const { admin } = useAuth()
    const [activeTab, setActiveTab] = useState<TabType>('profile')

    // Profile state
    const [name, setName] = useState(admin?.name || '')
    const [email, setEmail] = useState(admin?.email || '')
    const [avatar, setAvatar] = useState(admin?.avatar || '')
    const [profileLoading, setProfileLoading] = useState(false)
    const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // Password state
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showCurrentPassword, setShowCurrentPassword] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [passwordLoading, setPasswordLoading] = useState(false)
    const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    // Activity state
    const [activity, setActivity] = useState<AdminActivity | null>(null)
    const [activityLoading, setActivityLoading] = useState(false)

    useEffect(() => {
        if (admin) {
            setName(admin.name)
            setEmail(admin.email)
            setAvatar(admin.avatar || '')
        }
    }, [admin])

    useEffect(() => {
        if (activeTab === 'activity') {
            fetchActivity()
        }
    }, [activeTab])

    const fetchActivity = async () => {
        setActivityLoading(true)
        try {
            const response = await getAdminActivity()
            if (response.success) {
                setActivity(response.response)
            }
        } catch (error) {
            console.error('Failed to fetch activity:', error)
        } finally {
            setActivityLoading(false)
        }
    }

    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        setProfileLoading(true)
        setProfileMessage(null)

        try {
            const response = await updateAdminProfile({ name, email, avatar })
            if (response.success) {
                setProfileMessage({ type: 'success', text: 'Profile updated successfully!' })
                // Update localStorage
                localStorage.setItem('admin_user', JSON.stringify(response.response))
            } else {
                setProfileMessage({ type: 'error', text: response.message || 'Failed to update profile' })
            }
        } catch (error: any) {
            setProfileMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update profile' })
        } finally {
            setProfileLoading(false)
        }
    }

    const handlePasswordUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        setPasswordLoading(true)
        setPasswordMessage(null)

        if (newPassword !== confirmPassword) {
            setPasswordMessage({ type: 'error', text: 'Passwords do not match' })
            setPasswordLoading(false)
            return
        }

        if (newPassword.length < 6) {
            setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters' })
            setPasswordLoading(false)
            return
        }

        try {
            const response = await updateAdminPassword(currentPassword, newPassword)
            if (response.success) {
                setPasswordMessage({ type: 'success', text: 'Password updated successfully!' })
                setCurrentPassword('')
                setNewPassword('')
                setConfirmPassword('')
            } else {
                setPasswordMessage({ type: 'error', text: response.message || 'Failed to update password' })
            }
        } catch (error: any) {
            setPasswordMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update password' })
        } finally {
            setPasswordLoading(false)
        }
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    const tabs = [
        { id: 'profile' as TabType, label: 'Profile', icon: User },
        { id: 'password' as TabType, label: 'Password', icon: Lock },
        { id: 'activity' as TabType, label: 'Activity', icon: Activity },
    ]

    const activityStats = [
        { label: 'Total Orders', value: activity?.activity.stats.totalOrders || 0, icon: ShoppingBag, color: 'text-blue-500' },
        { label: 'Total Users', value: activity?.activity.stats.totalUsers || 0, icon: Users, color: 'text-green-500' },
        { label: 'Total Coupons', value: activity?.activity.stats.totalCoupons || 0, icon: Ticket, color: 'text-purple-500' },
        { label: 'Categories', value: activity?.activity.stats.totalCategories || 0, icon: FolderOpen, color: 'text-orange-500' },
        { label: 'Banners', value: activity?.activity.stats.totalBanners || 0, icon: Image, color: 'text-pink-500' },
        { label: 'Delivery Partners', value: activity?.activity.stats.totalDeliveryPartners || 0, icon: Truck, color: 'text-cyan-500' },
    ]

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-foreground">Settings</h1>
                <p className="text-sm sm:text-base text-muted-foreground">Manage your account settings and preferences</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 sm:gap-2 border-b border-border pb-2 overflow-x-auto">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            'flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-t-lg transition-colors text-sm sm:text-base whitespace-nowrap',
                            activeTab === tab.id
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        )}
                    >
                        <tab.icon className="w-4 h-4" />
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Profile Tab */}
            {activeTab === 'profile' && (
                <div className="bg-card border border-border rounded-xl p-4 sm:p-6 max-w-2xl">
                    <h2 className="text-base sm:text-lg font-semibold text-foreground mb-4 sm:mb-6">Profile Information</h2>

                    <form onSubmit={handleProfileUpdate} className="space-y-4">
                        {/* Avatar Preview */}
                        <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border">
                                {avatar ? (
                                    <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <User className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground" />
                                )}
                            </div>
                            <div>
                                <p className="font-medium text-foreground text-sm sm:text-base">{admin?.name}</p>
                                <p className="text-xs sm:text-sm text-muted-foreground">{admin?.role}</p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs sm:text-sm font-medium text-foreground mb-1.5 sm:mb-2">Full Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm sm:text-base"
                                placeholder="Enter your name"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs sm:text-sm font-medium text-foreground mb-1.5 sm:mb-2">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm sm:text-base"
                                placeholder="Enter your email"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs sm:text-sm font-medium text-foreground mb-1.5 sm:mb-2">Avatar URL</label>
                            <input
                                type="url"
                                value={avatar}
                                onChange={(e) => setAvatar(e.target.value)}
                                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm sm:text-base"
                                placeholder="https://example.com/avatar.jpg"
                            />
                        </div>

                        {profileMessage && (
                            <div
                                className={cn(
                                    'p-3 rounded-lg text-sm',
                                    profileMessage.type === 'success'
                                        ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                                        : 'bg-red-500/10 text-red-600 border border-red-500/20'
                                )}
                            >
                                {profileMessage.text}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={profileLoading}
                            className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 text-sm sm:text-base"
                        >
                            <Save className="w-4 h-4" />
                            {profileLoading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </form>
                </div>
            )}

            {/* Password Tab */}
            {activeTab === 'password' && (
                <div className="bg-card border border-border rounded-xl p-4 sm:p-6 max-w-2xl">
                    <h2 className="text-base sm:text-lg font-semibold text-foreground mb-4 sm:mb-6">Change Password</h2>

                    <form onSubmit={handlePasswordUpdate} className="space-y-4">
                        <div>
                            <label className="block text-xs sm:text-sm font-medium text-foreground mb-1.5 sm:mb-2">Current Password</label>
                            <div className="relative">
                                <input
                                    type={showCurrentPassword ? 'text' : 'password'}
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 pr-12 rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm sm:text-base"
                                    placeholder="Enter current password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showCurrentPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs sm:text-sm font-medium text-foreground mb-1.5 sm:mb-2">New Password</label>
                            <div className="relative">
                                <input
                                    type={showNewPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 pr-12 rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm sm:text-base"
                                    placeholder="Enter new password"
                                    required
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showNewPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                                </button>
                            </div>
                            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">Minimum 6 characters</p>
                        </div>

                        <div>
                            <label className="block text-xs sm:text-sm font-medium text-foreground mb-1.5 sm:mb-2">Confirm New Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm sm:text-base"
                                placeholder="Confirm new password"
                                required
                            />
                        </div>

                        {passwordMessage && (
                            <div
                                className={cn(
                                    'p-3 rounded-lg text-sm',
                                    passwordMessage.type === 'success'
                                        ? 'bg-green-500/10 text-green-600 border border-green-500/20'
                                        : 'bg-red-500/10 text-red-600 border border-red-500/20'
                                )}
                            >
                                {passwordMessage.text}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={passwordLoading}
                            className="flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 text-sm sm:text-base"
                        >
                            <Lock className="w-4 h-4" />
                            {passwordLoading ? 'Updating...' : 'Update Password'}
                        </button>
                    </form>
                </div>
            )}

            {/* Activity Tab */}
            {activeTab === 'activity' && (
                <div className="space-y-4 sm:space-y-6">
                    {activityLoading ? (
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="bg-card border border-border rounded-xl p-4 sm:p-6 animate-pulse">
                                    <div className="h-3 sm:h-4 bg-muted rounded w-1/2 mb-2 sm:mb-3" />
                                    <div className="h-6 sm:h-8 bg-muted rounded w-1/3" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <>
                            {/* Account Info */}
                            <div className="bg-card border border-border rounded-xl p-4 sm:p-6">
                                <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">Account Information</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                    <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-muted/50 rounded-lg">
                                        <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-xs sm:text-sm text-muted-foreground">Account Created</p>
                                            <p className="font-medium text-foreground text-xs sm:text-base truncate">
                                                {activity?.activity.accountCreated
                                                    ? formatDate(activity.activity.accountCreated)
                                                    : '-'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-muted/50 rounded-lg">
                                        <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-xs sm:text-sm text-muted-foreground">Last Activity</p>
                                            <p className="font-medium text-foreground text-xs sm:text-base truncate">
                                                {activity?.activity.lastLogin
                                                    ? formatDate(activity.activity.lastLogin)
                                                    : '-'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div>
                                <h2 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">Platform Overview</h2>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
                                    {activityStats.map((stat) => (
                                        <div
                                            key={stat.label}
                                            className="bg-card border border-border rounded-xl p-3 sm:p-6 flex items-center gap-2 sm:gap-4"
                                        >
                                            <div className={cn('p-2 sm:p-3 rounded-lg bg-muted flex-shrink-0', stat.color)}>
                                                <stat.icon className="w-4 h-4 sm:w-6 sm:h-6" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[10px] sm:text-sm text-muted-foreground truncate">{stat.label}</p>
                                                <p className="text-lg sm:text-2xl font-bold text-foreground">{stat.value.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
