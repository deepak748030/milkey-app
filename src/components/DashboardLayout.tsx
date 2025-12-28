// File: src/components/DashboardLayout.tsx - Milkey Admin
import { useState } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    Users,
    Image,
    Menu,
    X,
    LogOut,
    ChevronLeft,
    ChevronRight,
    ShoppingBag,
    Settings,
    Package,
    Milk,
    ClipboardList,
    ShoppingCart,
    UserCheck,
    FileText,
    CreditCard,
    BarChart3,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useAuth } from '../context/AuthContext'

const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/orders', icon: ShoppingBag, label: 'Orders' },
    { to: '/admin-orders', icon: ClipboardList, label: 'Admin Orders' },
    { to: '/purchase', icon: ShoppingCart, label: 'Purchase Data' },
    { to: '/selling-members', icon: UserCheck, label: 'Selling Members' },
    { to: '/selling-entries', icon: FileText, label: 'Selling Entries' },
    { to: '/selling-payments', icon: CreditCard, label: 'Selling Payments' },
    { to: '/selling-report', icon: BarChart3, label: 'Selling Report' },
    { to: '/products', icon: Package, label: 'Products' },
    { to: '/users', icon: Users, label: 'Users' },
    { to: '/banners', icon: Image, label: 'Banners' },
    { to: '/settings', icon: Settings, label: 'Settings' },
]

export function DashboardLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const { admin, logout } = useAuth()
    const location = useLocation()

    return (
        <div className="min-h-screen flex bg-background">
            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-40 lg:hidden"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-50 bg-sidebar text-sidebar-foreground transition-all duration-200 ease-out lg:relative',
                    sidebarOpen ? 'w-64' : 'w-20',
                    mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
                )}
            >
                {/* Logo Area */}
                <div className={cn(
                    'h-16 flex items-center border-b border-border/30 px-4',
                    sidebarOpen ? 'justify-between' : 'justify-center'
                )}>
                    {sidebarOpen ? (
                        <div className="flex items-center gap-2">
                            <Milk className="w-7 h-7 text-primary" />
                            <div>
                                <h1 className="text-xl font-bold text-foreground leading-tight">Milkey</h1>
                                <p className="text-xs text-muted-foreground">Admin Dashboard</p>
                            </div>
                        </div>
                    ) : (
                        <Milk className="w-6 h-6 text-primary" />
                    )}
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="p-2 rounded-lg hover:bg-sidebar-hover transition-colors hidden lg:flex"
                    >
                        {sidebarOpen ? (
                            <ChevronLeft className="w-5 h-5" />
                        ) : (
                            <ChevronRight className="w-5 h-5" />
                        )}
                    </button>
                    <button
                        onClick={() => setMobileMenuOpen(false)}
                        className="p-2 rounded-lg hover:bg-sidebar-hover transition-colors lg:hidden"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="p-3 space-y-1">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.to
                        return (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                onClick={() => setMobileMenuOpen(false)}
                                className={cn(
                                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-150',
                                    isActive
                                        ? 'bg-sidebar-active text-foreground'
                                        : 'text-sidebar-foreground/70 hover:bg-sidebar-hover hover:text-foreground'
                                )}
                            >
                                <item.icon className="w-5 h-5 flex-shrink-0" />
                                {sidebarOpen && (
                                    <span className="text-base font-medium">{item.label}</span>
                                )}
                            </NavLink>
                        )
                    })}
                </nav>

                {/* User Section */}
                <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-border/30">
                    {sidebarOpen ? (
                        <div className="flex items-center gap-3 px-3 py-2">
                            <div className="w-10 h-10 rounded-full bg-sidebar-hover flex items-center justify-center overflow-hidden">
                                {admin?.avatar ? (
                                    <img
                                        src={admin.avatar}
                                        alt={admin.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <span className="text-sm font-medium">
                                        {admin?.name?.charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                    {admin?.name}
                                </p>
                                <p className="text-xs text-sidebar-foreground/60 truncate">
                                    {admin?.role}
                                </p>
                            </div>
                            <button
                                onClick={logout}
                                className="p-2 rounded-lg hover:bg-sidebar-hover transition-colors"
                                title="Logout"
                            >
                                <LogOut className="w-5 h-5" />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={logout}
                            className="w-full flex justify-center p-2 rounded-lg hover:bg-sidebar-hover transition-colors"
                            title="Logout"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-screen">
                {/* Top Bar */}
                <header className="h-16 bg-card border-b border-border flex items-center px-4 lg:px-6 sticky top-0 z-30">
                    <button
                        onClick={() => setMobileMenuOpen(true)}
                        className="p-2 rounded-lg hover:bg-muted transition-colors lg:hidden"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <div className="flex-1" />
                </header>

                {/* Page Content */}
                <main className="flex-1 p-4 lg:p-6 overflow-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
