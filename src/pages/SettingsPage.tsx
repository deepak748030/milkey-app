import { useState, useEffect } from 'react'
import {
    User,
    Lock,
    Save,
    Eye,
    EyeOff,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useAuth } from '../context/AuthContext'
import {
    updateAdminProfile,
    updateAdminPassword,
} from '../lib/api'

type TabType = 'profile' | 'password'

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


    useEffect(() => {
        if (admin) {
            setName(admin.name)
            setEmail(admin.email)
            setAvatar(admin.avatar || '')
        }
    }, [admin])

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


    const tabs = [
        { id: 'profile' as TabType, label: 'Profile', icon: User },
        { id: 'password' as TabType, label: 'Password', icon: Lock },
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
        </div>
    )
}
