import { useState, useEffect, useCallback } from 'react'
import {
    Search,
    ChevronLeft,
    ChevronRight,
    Eye,
    X,
    Loader2,
    RefreshCw,
    Package,
    TrendingUp,
    Sparkles,
    Trash2,
    ToggleLeft,
    ToggleRight,
    Star,
    Filter,
    ChevronDown,
} from 'lucide-react'
import {
    getProductsAdmin,
    getProductStats,
    getProductByIdAdmin,
    toggleProductTrending,
    toggleProductFashionPick,
    toggleProductStatus,
    deleteProductAdmin,
    getCategoriesAdmin,
    Product,
    ProductStats,
    Pagination,
    Category,
} from '../lib/api'
import { cn } from '../lib/utils'

function formatCurrency(amount: number): string {
    return `₹${amount.toLocaleString()}`
}

function StatCard({ title, value, icon: Icon, color, subValue }: {
    title: string
    value: string | number
    icon: React.ElementType
    color: string
    subValue?: string
}) {
    return (
        <div className="bg-card border border-border rounded-xl p-3 sm:p-4">
            <div className="flex items-center justify-between mb-1 sm:mb-2">
                <span className="text-xs sm:text-sm text-muted-foreground truncate">{title}</span>
                <div className={cn('p-1.5 sm:p-2 rounded-lg flex-shrink-0', color)}>
                    <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
                </div>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-foreground truncate">{value}</p>
            {subValue && <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 truncate">{subValue}</p>}
        </div>
    )
}

function ProductSkeleton() {
    return (
        <tr className="border-b border-border">
            <td className="p-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg skeleton" />
                    <div className="space-y-1">
                        <div className="h-4 w-32 skeleton rounded" />
                        <div className="h-3 w-20 skeleton rounded" />
                    </div>
                </div>
            </td>
            <td className="p-4"><div className="h-4 w-20 skeleton rounded" /></td>
            <td className="p-4"><div className="h-4 w-16 skeleton rounded" /></td>
            <td className="p-4"><div className="h-6 w-20 skeleton rounded-full" /></td>
            <td className="p-4"><div className="h-6 w-16 skeleton rounded-full" /></td>
            <td className="p-4"><div className="h-6 w-16 skeleton rounded-full" /></td>
            <td className="p-4"><div className="h-10 w-32 skeleton rounded-lg" /></td>
        </tr>
    )
}

function StatsSkeleton() {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-1 sm:mb-2">
                        <div className="h-3 sm:h-4 w-16 sm:w-20 skeleton rounded" />
                        <div className="w-6 h-6 sm:w-8 sm:h-8 skeleton rounded-lg" />
                    </div>
                    <div className="h-6 sm:h-8 w-20 sm:w-24 skeleton rounded" />
                </div>
            ))}
        </div>
    )
}

interface ProductDetailModalProps {
    product: Product | null
    onClose: () => void
}

function ProductDetailModal({ product, onClose }: ProductDetailModalProps) {
    if (!product) return null

    const discount = product.mrp > product.price
        ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
        : 0

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
            <div
                className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card z-10">
                    <h2 className="text-lg font-bold text-foreground">Product Details</h2>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 space-y-6">
                    {/* Product Image */}
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="w-full md:w-48 h-48 rounded-xl bg-muted overflow-hidden flex-shrink-0">
                            {product.image ? (
                                <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Package className="w-12 h-12 text-muted-foreground" />
                                </div>
                            )}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-start gap-2 flex-wrap mb-2">
                                {product.badge && (
                                    <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                                        {product.badge}
                                    </span>
                                )}
                                {product.isTrending && (
                                    <span className="px-2 py-1 rounded-full bg-orange-500/10 text-orange-500 text-xs font-medium flex items-center gap-1">
                                        <TrendingUp className="w-3 h-3" />
                                        Trending
                                    </span>
                                )}
                                {product.isFashionPick && (
                                    <span className="px-2 py-1 rounded-full bg-purple-500/10 text-purple-500 text-xs font-medium flex items-center gap-1">
                                        <Sparkles className="w-3 h-3" />
                                        Fashion Pick
                                    </span>
                                )}
                            </div>
                            <h3 className="text-xl font-bold text-foreground mb-2">{product.title}</h3>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-2xl font-bold text-primary">{formatCurrency(product.price)}</span>
                                {discount > 0 && (
                                    <>
                                        <span className="text-lg text-muted-foreground line-through">{formatCurrency(product.mrp)}</span>
                                        <span className="px-2 py-0.5 rounded bg-success/10 text-success text-sm font-medium">
                                            {discount}% OFF
                                        </span>
                                    </>
                                )}
                            </div>
                            {product.rating > 0 && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                    <span>{product.rating.toFixed(1)}</span>
                                    {product.reviews > 0 && <span>({product.reviews} reviews)</span>}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Description */}
                    {product.description && (
                        <div>
                            <h4 className="text-sm font-semibold text-foreground mb-2">Description</h4>
                            <p className="text-sm text-muted-foreground">{product.description}</p>
                        </div>
                    )}

                    {/* Category */}
                    <div className="bg-muted/50 rounded-xl p-4">
                        <h4 className="text-sm font-semibold text-foreground mb-2">Category</h4>
                        <div className="flex items-center gap-2">
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: product.category?.color || '#888' }}
                            />
                            <span className="text-sm text-foreground">{product.category?.name || 'Uncategorized'}</span>
                        </div>
                    </div>

                    {/* Status */}
                    <div className="flex flex-wrap gap-3">
                        <div className={cn(
                            'px-4 py-2 rounded-full text-sm font-medium',
                            product.isActive ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                        )}>
                            {product.isActive ? 'Active' : 'Inactive'}
                        </div>
                    </div>

                    {/* Metadata */}
                    <div className="text-xs text-muted-foreground">
                        Created: {new Date(product.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric', month: 'short', day: 'numeric'
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}

export function ProductsPage() {
    const [products, setProducts] = useState<Product[]>([])
    const [stats, setStats] = useState<ProductStats | null>(null)
    const [categories, setCategories] = useState<Category[]>([])
    const [pagination, setPagination] = useState<Pagination | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [statsLoading, setStatsLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [categoryFilter, setCategoryFilter] = useState('')
    const [trendingFilter, setTrendingFilter] = useState('')
    const [fashionPickFilter, setFashionPickFilter] = useState('')
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [showFilters, setShowFilters] = useState(false)

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 400)
        return () => clearTimeout(timer)
    }, [search])

    const fetchStats = useCallback(async () => {
        setStatsLoading(true)
        try {
            const response = await getProductStats()
            if (response.success) {
                setStats(response.response)
            }
        } catch (err) {
            console.error('Failed to fetch stats:', err)
        } finally {
            setStatsLoading(false)
        }
    }, [])

    const fetchCategories = useCallback(async () => {
        try {
            const response = await getCategoriesAdmin({ limit: 100, status: 'active' })
            if (response.success) {
                setCategories(response.response.categories || [])
            }
        } catch (err) {
            console.error('Failed to fetch categories:', err)
        }
    }, [])

    const fetchProducts = useCallback(async (page = 1) => {
        setIsLoading(true)
        try {
            const response = await getProductsAdmin({
                page,
                limit: 10,
                search: debouncedSearch,
                status: statusFilter !== 'all' ? statusFilter : undefined,
                category: categoryFilter || undefined,
                trending: trendingFilter || undefined,
                fashionPick: fashionPickFilter || undefined,
            })
            if (response.success) {
                setProducts(response.response.products || [])
                setPagination(response.response.pagination)
            }
        } catch (err) {
            console.error('Failed to fetch products:', err)
        } finally {
            setIsLoading(false)
        }
    }, [debouncedSearch, statusFilter, categoryFilter, trendingFilter, fashionPickFilter])

    useEffect(() => {
        fetchStats()
        fetchCategories()
    }, [fetchStats, fetchCategories])

    useEffect(() => {
        fetchProducts(1)
    }, [fetchProducts])

    const handleViewProduct = async (id: string) => {
        setDetailLoading(true)
        try {
            const response = await getProductByIdAdmin(id)
            if (response.success) {
                setSelectedProduct(response.response.product)
            }
        } catch (err) {
            console.error('Failed to fetch product:', err)
        } finally {
            setDetailLoading(false)
        }
    }

    const handleToggleTrending = async (id: string) => {
        setActionLoading(id)
        try {
            const response = await toggleProductTrending(id)
            if (response.success) {
                setProducts(prev => prev.map(p =>
                    p._id === id ? { ...p, isTrending: response.response.product.isTrending } : p
                ))
                fetchStats()
            }
        } catch (err) {
            console.error('Failed to toggle trending:', err)
        } finally {
            setActionLoading(null)
        }
    }

    const handleToggleFashionPick = async (id: string) => {
        setActionLoading(id)
        try {
            const response = await toggleProductFashionPick(id)
            if (response.success) {
                setProducts(prev => prev.map(p =>
                    p._id === id ? { ...p, isFashionPick: response.response.product.isFashionPick } : p
                ))
                fetchStats()
            }
        } catch (err) {
            console.error('Failed to toggle fashion pick:', err)
        } finally {
            setActionLoading(null)
        }
    }

    const handleToggleStatus = async (id: string) => {
        setActionLoading(id)
        try {
            const response = await toggleProductStatus(id)
            if (response.success) {
                setProducts(prev => prev.map(p =>
                    p._id === id ? { ...p, isActive: response.response.product.isActive } : p
                ))
                fetchStats()
            }
        } catch (err) {
            console.error('Failed to toggle status:', err)
        } finally {
            setActionLoading(null)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this product?')) return
        setActionLoading(id)
        try {
            const response = await deleteProductAdmin(id)
            if (response.success) {
                setProducts(prev => prev.filter(p => p._id !== id))
                fetchStats()
            }
        } catch (err) {
            console.error('Failed to delete product:', err)
        } finally {
            setActionLoading(null)
        }
    }

    const handleRefresh = () => {
        fetchStats()
        fetchProducts(pagination?.page || 1)
    }

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground">Products</h1>
                    <p className="text-sm text-muted-foreground">Manage products and home screen sections</p>
                </div>
                <button
                    onClick={handleRefresh}
                    className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 rounded-lg transition-colors text-sm font-medium self-start sm:self-auto"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            {/* Stats */}
            {statsLoading ? (
                <StatsSkeleton />
            ) : stats && (
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4">
                    <StatCard
                        title="Total Products"
                        value={stats.totalProducts}
                        icon={Package}
                        color="bg-primary/10 text-primary"
                    />
                    <StatCard
                        title="Active"
                        value={stats.activeProducts}
                        icon={ToggleRight}
                        color="bg-success/10 text-success"
                    />
                    <StatCard
                        title="Inactive"
                        value={stats.inactiveProducts}
                        icon={ToggleLeft}
                        color="bg-destructive/10 text-destructive"
                    />
                    <StatCard
                        title="Trending Now"
                        value={stats.trendingProducts}
                        icon={TrendingUp}
                        color="bg-orange-500/10 text-orange-500"
                    />
                    <StatCard
                        title="Fashion Picks"
                        value={stats.fashionPickProducts}
                        icon={Sparkles}
                        color="bg-purple-500/10 text-purple-500"
                    />
                </div>
            )}

            {/* Filters */}
            <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex flex-col gap-4">
                    {/* Search and Filter Toggle */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search products..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={cn(
                                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                                showFilters ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'
                            )}
                        >
                            <Filter className="w-4 h-4" />
                            Filters
                            <ChevronDown className={cn('w-4 h-4 transition-transform', showFilters && 'rotate-180')} />
                        </button>
                    </div>

                    {/* Filter Options */}
                    {showFilters && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-border">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                                <option value="all">All Status</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                                <option value="">All Categories</option>
                                {categories.map(cat => (
                                    <option key={cat._id} value={cat._id}>{cat.name}</option>
                                ))}
                            </select>
                            <select
                                value={trendingFilter}
                                onChange={(e) => setTrendingFilter(e.target.value)}
                                className="px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                                <option value="">All (Trending)</option>
                                <option value="true">Trending Only</option>
                                <option value="false">Not Trending</option>
                            </select>
                            <select
                                value={fashionPickFilter}
                                onChange={(e) => setFashionPickFilter(e.target.value)}
                                className="px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            >
                                <option value="">All (Fashion Picks)</option>
                                <option value="true">Fashion Picks Only</option>
                                <option value="false">Not Fashion Picks</option>
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* Products Table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border bg-muted/50">
                                <th className="text-left p-4 text-sm font-semibold text-foreground">Product</th>
                                <th className="text-left p-4 text-sm font-semibold text-foreground hidden sm:table-cell">Category</th>
                                <th className="text-left p-4 text-sm font-semibold text-foreground">Price</th>
                                <th className="text-left p-4 text-sm font-semibold text-foreground hidden md:table-cell">Status</th>
                                <th className="text-left p-4 text-sm font-semibold text-foreground hidden lg:table-cell">Trending</th>
                                <th className="text-left p-4 text-sm font-semibold text-foreground hidden lg:table-cell">Fashion Pick</th>
                                <th className="text-left p-4 text-sm font-semibold text-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => <ProductSkeleton key={i} />)
                            ) : products.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                                        No products found
                                    </td>
                                </tr>
                            ) : (
                                products.map((product) => {
                                    const discount = product.mrp > product.price
                                        ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
                                        : 0

                                    return (
                                        <tr key={product._id} className="border-b border-border hover:bg-muted/30 transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                                                        {product.image ? (
                                                            <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center">
                                                                <Package className="w-5 h-5 text-muted-foreground" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-foreground truncate max-w-[200px]">{product.title}</p>
                                                        {product.badge && (
                                                            <span className="text-xs text-primary">{product.badge}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 hidden sm:table-cell">
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="w-2 h-2 rounded-full"
                                                        style={{ backgroundColor: product.category?.color || '#888' }}
                                                    />
                                                    <span className="text-sm text-muted-foreground">{product.category?.name || 'N/A'}</span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div>
                                                    <span className="font-semibold text-foreground">{formatCurrency(product.price)}</span>
                                                    {discount > 0 && (
                                                        <div className="text-xs text-success">{discount}% off</div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4 hidden md:table-cell">
                                                <span className={cn(
                                                    'px-2 py-1 rounded-full text-xs font-medium',
                                                    product.isActive ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                                                )}>
                                                    {product.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="p-4 hidden lg:table-cell">
                                                <button
                                                    onClick={() => handleToggleTrending(product._id)}
                                                    disabled={actionLoading === product._id}
                                                    className={cn(
                                                        'px-2 py-1 rounded-full text-xs font-medium transition-colors',
                                                        product.isTrending
                                                            ? 'bg-orange-500/10 text-orange-500 hover:bg-orange-500/20'
                                                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                                    )}
                                                >
                                                    {actionLoading === product._id ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        <span className="flex items-center gap-1">
                                                            <TrendingUp className="w-3 h-3" />
                                                            {product.isTrending ? 'Yes' : 'No'}
                                                        </span>
                                                    )}
                                                </button>
                                            </td>
                                            <td className="p-4 hidden lg:table-cell">
                                                <button
                                                    onClick={() => handleToggleFashionPick(product._id)}
                                                    disabled={actionLoading === product._id}
                                                    className={cn(
                                                        'px-2 py-1 rounded-full text-xs font-medium transition-colors',
                                                        product.isFashionPick
                                                            ? 'bg-purple-500/10 text-purple-500 hover:bg-purple-500/20'
                                                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                                    )}
                                                >
                                                    {actionLoading === product._id ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        <span className="flex items-center gap-1">
                                                            <Sparkles className="w-3 h-3" />
                                                            {product.isFashionPick ? 'Yes' : 'No'}
                                                        </span>
                                                    )}
                                                </button>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleViewProduct(product._id)}
                                                        disabled={detailLoading}
                                                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                                                        title="View details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleStatus(product._id)}
                                                        disabled={actionLoading === product._id}
                                                        className={cn(
                                                            'p-2 rounded-lg transition-colors',
                                                            product.isActive ? 'hover:bg-destructive/10 text-destructive' : 'hover:bg-success/10 text-success'
                                                        )}
                                                        title={product.isActive ? 'Deactivate' : 'Activate'}
                                                    >
                                                        {actionLoading === product._id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : product.isActive ? (
                                                            <ToggleRight className="w-4 h-4" />
                                                        ) : (
                                                            <ToggleLeft className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(product._id)}
                                                        disabled={actionLoading === product._id}
                                                        className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
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
                    <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-border gap-3">
                        <p className="text-sm text-muted-foreground">
                            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} products
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => fetchProducts(pagination.page - 1)}
                                disabled={pagination.page <= 1 || isLoading}
                                className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                                    let pageNum: number
                                    if (pagination.pages <= 5) {
                                        pageNum = i + 1
                                    } else if (pagination.page <= 3) {
                                        pageNum = i + 1
                                    } else if (pagination.page >= pagination.pages - 2) {
                                        pageNum = pagination.pages - 4 + i
                                    } else {
                                        pageNum = pagination.page - 2 + i
                                    }

                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => fetchProducts(pageNum)}
                                            disabled={isLoading}
                                            className={cn(
                                                'w-8 h-8 rounded-lg text-sm font-medium transition-colors',
                                                pagination.page === pageNum
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'hover:bg-muted'
                                            )}
                                        >
                                            {pageNum}
                                        </button>
                                    )
                                })}
                            </div>
                            <button
                                onClick={() => fetchProducts(pagination.page + 1)}
                                disabled={pagination.page >= pagination.pages || isLoading}
                                className="p-2 hover:bg-muted rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Product Detail Modal */}
            <ProductDetailModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
        </div>
    )
}