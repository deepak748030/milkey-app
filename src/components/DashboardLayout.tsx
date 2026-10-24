// Premium Admin Layout — Milkey unified Farmer+Collection + app logo, best icons
import { useState, useEffect } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, Image as ImageIcon, Menu, X, LogOut, ChevronLeft, ChevronRight, ChevronDown,
  Settings, Milk, Droplets, ClipboardList, UserCheck, FileText, CreditCard, BarChart3, UserPlus, Banknote,
  Wallet, Sun, Moon, Share2, BookOpen, Store, Smartphone, MessageCircle, Bell, Search, Shield, TrendingUp,
  Layers, Gift, Landmark, HandCoins, NotebookText, HelpCircle, Video
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useAuth } from '../context/AuthContext'
import milkeyLogo from '../assets/milkey-logo.png'

const navSections = [
  {
    label: 'Overview',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/dau', icon: TrendingUp, label: 'Analytics' },
      { to: '/mrr', icon: Banknote, label: 'Revenue' },
    ]
  },
  {
    label: 'Business',
    items: [
      { to: '/users', icon: Users, label: 'Users' },
      { to: '/admin-orders', icon: ClipboardList, label: 'Orders' },
      { to: '/product-management', icon: Layers, label: 'Products' },
      { to: '/banners', icon: ImageIcon, label: 'Banners' },
      { to: '/ads', icon: ImageIcon, label: 'Login Ads' },
      { to: '/faqs', icon: HelpCircle as any, label: 'FAQs' },
      { to: '/videos', icon: Video as any, label: 'Videos' },
    ]
  },
]

// ✅ Unified Farmer — single Farmer for Collection + Register
const farmerCollectionItems = [
  { to: '/farmers', icon: Users, label: 'Farmers' },
  { to: '/collection-data', icon: Milk, label: 'Collections' },
  { to: '/collection-report', icon: BarChart3, label: 'Collection Report' },
  { to: '/register-advances', icon: Landmark, label: 'Advances' },
  { to: '/register-payments', icon: HandCoins, label: 'Payments' },
]
const sellingItems = [
  { to: '/selling-members', icon: UserCheck, label: 'Customers' },
  { to: '/selling-entries', icon: NotebookText, label: 'Entries' },
  { to: '/selling-payments', icon: CreditCard, label: 'Payments' },
  { to: '/selling-report', icon: BarChart3, label: 'Report' },
]
const financeItems = [
  { to: '/subscriptions', icon: Gift, label: 'Plans' },
  { to: '/active-subscriptions', icon: UserCheck, label: 'Active Subs' },
  { to: '/withdrawals', icon: Wallet, label: 'Withdrawals' },
]
const systemItems = [
  { to: '/custom-forms', icon: FileText, label: 'Custom Forms' },
  { to: '/social-links', icon: Share2, label: 'Social Links' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
  { to: '/app-version', icon: Smartphone, label: 'App Version' },
  { to: '/payment-settings', icon: CreditCard, label: 'Payment' },
  { to: '/whatsapp-settings', icon: MessageCircle, label: 'WhatsApp' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

function NavItem({ to, icon: Icon, label, collapsed, active, onClick }: any) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative",
        collapsed ? "justify-center px-2" : "",
        active
          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
          : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-foreground"
      )}
      title={collapsed ? label : undefined}
    >
      <Icon className={cn("w-[18px] h-[18px] shrink-0", active ? "text-primary-foreground" : "text-sidebar-muted group-hover:text-foreground")} />
      {!collapsed && <span className="truncate flex-1 text-[13.5px]">{label}</span>}
    </NavLink>
  )
}

function CollapsibleSection({ label, icon: Icon, items, collapsed, pathname, onNavigate }: any) {
  const isActive = items.some((i:any)=> pathname===i.to)
  const [open, setOpen] = useState(isActive)
  useEffect(()=> { if(isActive) setOpen(true)}, [isActive])

  if (collapsed) {
    return (
      <div className="space-y-1 py-2">
        {items.map((it:any)=>(
          <NavItem key={it.to} {...it} collapsed={collapsed} active={pathname===it.to} onClick={onNavigate} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <button
        onClick={()=>setOpen(!open)}
        className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
          isActive ? "text-foreground" : "text-sidebar-muted hover:text-foreground hover:bg-sidebar-hover"
        )}
      >
        <Icon className={cn("w-[18px] h-[18px] shrink-0", isActive && "text-primary")} />
        <span className="flex-1 text-left text-[13.5px]">{label}</span>
        <ChevronDown className={cn("w-4 h-4 text-sidebar-muted transition-transform", open ? "rotate-0" : "-rotate-90")} />
      </button>
      {open && (
        <div className="ml-3 pl-3 border-l border-sidebar-border space-y-1 py-1 animate-fade-in">
          {items.map((it:any)=>(
            <NavLink key={it.to} to={it.to} onClick={onNavigate}
              className={cn("flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors",
                pathname===it.to ? "bg-primary text-primary-foreground font-medium shadow-sm" : "text-sidebar-foreground hover:bg-sidebar-hover hover:text-foreground"
              )}
            >
              <it.icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{it.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

export function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isDark, setIsDark] = useState(()=> localStorage.getItem('theme')==='dark')
  const { admin, logout } = useAuth()
  const location = useLocation()

  useEffect(()=> {
    if (isDark) { document.documentElement.classList.add('dark'); localStorage.setItem('theme','dark') }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme','light') }
  }, [isDark])

  const closeMobile = () => setMobileOpen(false)

  const pathname = location.pathname
  const pageTitle: string = (() => {
    const all: any[] = [...navSections.flatMap(s=>s.items as any), ...farmerCollectionItems, ...sellingItems, ...financeItems, ...systemItems]
    const found = all.find((i:any)=>i.to===pathname)
    if (found) return found.label as string
    if (pathname==='/') return 'Dashboard'
    return pathname.replace('/','').replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase())
  })()

  return (
    <div className="min-h-screen flex bg-background">
      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={closeMobile} />}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:sticky lg:top-0 lg:h-screen lg:shrink-0",
        collapsed ? "w-[72px]" : "w-[280px]",
        mobileOpen ? "translate-x-0 shadow-large" : "-translate-x-full lg:translate-x-0"
      )}>
        {/* Logo — same as app (milkey-logo.png) */}
        <div className={cn("h-[64px] flex items-center gap-3 px-4 border-b border-sidebar-border shrink-0", collapsed ? "justify-center px-2" : "justify-between")}>
          {!collapsed ? (
            <>
              <div className="flex items-center gap-3 min-w-0">
                <img src={milkeyLogo} alt="Milkey" className="w-9 h-9 rounded-xl object-cover shrink-0 shadow-sm ring-1 ring-border" />
                <div className="min-w-0">
                  <h1 className="text-[15px] font-bold leading-none tracking-tight">Milkey</h1>
                  <p className="text-xs text-sidebar-muted font-medium">Admin Panel</p>
                </div>
              </div>
              <button onClick={()=>setCollapsed(true)} className="hidden lg:flex w-8 h-8 items-center justify-center rounded-lg hover:bg-sidebar-hover text-sidebar-muted hover:text-foreground transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={closeMobile} className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-sidebar-hover"><X className="w-5 h-5" /></button>
            </>
          ) : (
            <img src={milkeyLogo} alt="Milkey" className="w-9 h-9 rounded-xl object-cover shadow-sm ring-1 ring-border" />
          )}
        </div>

        {/* Scrollable nav */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar py-3 px-2.5 space-y-5">
          {/* Quick action when expanded */}
          {!collapsed && (
            <div className="mx-1 p-3 rounded-lg bg-gradient-to-br from-primary to-emerald-600 text-white relative overflow-hidden">
              <div className="absolute -right-6 -top-6 w-20 h-20 bg-white/10 rounded-full blur-xl" />
              <div className="relative">
                <p className="text-xs font-medium text-white/80 uppercase tracking-wide">Quick Start</p>
                <p className="text-sm font-semibold mt-1 leading-tight">Manage your dairy<br/>operations efficiently</p>
              </div>
            </div>
          )}

          {navSections.map(section=>(
            <div key={section.label} className="space-y-2">
              {!collapsed && <p className="px-3 text-[11px] font-semibold tracking-widest text-sidebar-muted uppercase">{section.label}</p>}
              <div className="space-y-1">
                {section.items.map(item=>(
                  <NavItem key={item.to} {...item} collapsed={collapsed} active={pathname===item.to} onClick={closeMobile} />
                ))}
              </div>
            </div>
          ))}

          <div className={cn("space-y-4", !collapsed && "border-t border-sidebar-border pt-4")}>
            {!collapsed && <p className="px-3 text-[11px] font-semibold tracking-widest text-sidebar-muted uppercase">Operations</p>}
            {/* ✅ Single unified Farmer + Collection — icons premium */}
            <CollapsibleSection label="Farmers & Collection" icon={Droplets} items={farmerCollectionItems} collapsed={collapsed} pathname={pathname} onNavigate={closeMobile} />
            <CollapsibleSection label="Milk Selling" icon={Store} items={sellingItems} collapsed={collapsed} pathname={pathname} onNavigate={closeMobile} />
            <CollapsibleSection label="Monetization" icon={CreditCard} items={financeItems} collapsed={collapsed} pathname={pathname} onNavigate={closeMobile} />
            {!collapsed && <p className="px-3 text-[11px] font-semibold tracking-widest text-sidebar-muted uppercase pt-2">System</p>}
            <div className={collapsed ? "space-y-1" : "space-y-1"}>
              {systemItems.slice(0,3).map(it=> <NavItem key={it.to} {...it} collapsed={collapsed} active={pathname===it.to} onClick={closeMobile} />)}
              <CollapsibleSection label="System Suite" icon={Settings} items={systemItems.slice(3)} collapsed={collapsed} pathname={pathname} onNavigate={closeMobile} />
            </div>
          </div>

          {!collapsed && (
            <div className="mx-1 p-3 rounded-lg border border-sidebar-border bg-card">
              <div className="flex items-center gap-2 text-xs font-medium">
                <Shield className="w-3.5 h-3.5 text-primary" /> Secure & Compliant
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">All data is encrypted. Audit logs enabled for admin actions.</p>
            </div>
          )}
        </div>

        {/* User */}
        <div className="p-2.5 border-t border-sidebar-border bg-sidebar shrink-0">
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-sm font-semibold">
                {admin?.name?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <button onClick={logout} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-sidebar-hover text-sidebar-muted hover:text-destructive transition-colors" title="Logout">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-sidebar-hover transition-colors">
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-semibold shrink-0">
                {admin?.avatar ? <img src={admin.avatar} alt={admin.name} className="w-full h-full object-cover rounded-full" /> : admin?.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate leading-none">{admin?.name || 'Admin'}</p>
                <p className="text-xs text-sidebar-muted truncate">{admin?.role || 'Super Admin'}</p>
              </div>
              <button onClick={logout} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-card border border-transparent hover:border-sidebar-border text-sidebar-muted hover:text-destructive transition-colors" title="Logout">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Expand button when collapsed (desktop) */}
        {collapsed && (
          <button onClick={()=>setCollapsed(false)} className="hidden lg:flex absolute -right-3 top-20 w-6 h-6 bg-card border border-border rounded-full items-center justify-center shadow-soft hover:shadow-medium transition-shadow">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col lg:h-screen lg:overflow-hidden">
        {/* Header */}
        <header className="h-[64px] sticky top-0 z-30 bg-card/80 backdrop-blur-xl border-b border-border flex items-center gap-3 px-4 lg:px-6 shrink-0">
          <button onClick={()=>setMobileOpen(true)} className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted text-foreground">
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 min-w-0 flex-1">
            <img src={milkeyLogo} alt="Milkey" className="hidden lg:block w-8 h-8 rounded-lg object-cover ring-1 ring-border" />
            <div className="hidden lg:flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Dashboard</span>
              <span className="text-muted-foreground">/</span>
              <span className="font-semibold">{pageTitle}</span>
            </div>
            <div className="lg:hidden font-semibold text-[15px] truncate">{pageTitle}</div>
          </div>

          <div className="hidden md:flex items-center gap-2 flex-1 max-w-md mx-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input placeholder="Search users, orders, farmers..." className="w-full pl-9 pr-3 py-2 bg-muted border border-transparent focus:border-primary focus:bg-card rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none transition-colors" />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-1 text-[10px] font-medium bg-card border border-border px-1.5 py-0.5 rounded-md text-muted-foreground">⌘ K</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <Bell className="w-[18px] h-[18px]" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full ring-2 ring-card" />
            </button>
            <button className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors md:hidden">
              <Search className="w-[18px] h-[18px]" />
            </button>
            <button onClick={()=>setIsDark(!isDark)} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-muted border border-border bg-card transition-colors" title={isDark?'Light mode':'Dark mode'}>
              {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
            </button>
            <div className="hidden sm:flex items-center gap-2 pl-2 ml-1 border-l border-border">
              <div className="text-right hidden lg:block">
                <p className="text-sm font-semibold leading-none">{admin?.name}</p>
                <p className="text-xs text-muted-foreground">{admin?.email || 'admin@milkey.com'}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-sm">
                {admin?.name?.charAt(0)?.toUpperCase() || 'M'}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto bg-muted/30">
          <div className="p-4 lg:p-6 max-w-[1600px] mx-auto w-full">
            <Outlet />
          </div>
        </main>

        {/* Mobile bottom nav for primary actions (optional, hidden on lg) */}
        <div className="lg:hidden fixed bottom-0 inset-x-0 bg-card border-t border-border px-2 py-2 flex items-center justify-around z-30 safe-area-pb">
          {[
            { to: '/', icon: LayoutDashboard, label: 'Home' },
            { to: '/users', icon: Users, label: 'Users' },
            { to: '/collection-data', icon: Droplets, label: 'Farmers' },
            { to: '/banners', icon: ImageIcon, label: 'Banners' },
            { to: '/settings', icon: Settings, label: 'More' },
          ].map(it=> (
            <NavLink key={it.to} to={it.to} className={({isActive})=> cn("flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", isActive ? "text-primary bg-primary/10" : "text-muted-foreground")}>
              <it.icon className="w-5 h-5" />
              <span className="text-[11px]">{it.label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  )
}
