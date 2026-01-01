import { useState, useEffect, useCallback, useRef } from 'react'
import {
    Search,
    Filter,
    Plus,
    Edit,
    Trash2,
    ChevronLeft,
    ChevronRight,
    Package,
    RefreshCw,
    X,
    Upload,
    Eye,
    Power
} from 'lucide-react'
import {
    getAdminProducts,
    createAdminProduct,
    updateAdminProduct,
    deleteAdminProduct,
    toggleAdminProductStatus,
    uploadImage,
    type AdminProduct
} from '@/lib/api'

function SkeletonRow() {
    return (
        <tr className="animate-pulse">
            <td className="px-4 py-3"><div className="h-10 w-10 bg-muted rounded"></div></td>
            <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-32"></div></td>
            <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-16"></div></td>
            <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-12"></div></td>
            <td className="px-4 py-3"><div className="h-4 bg-muted rounded w-16"></div></td>
            <td className="px-4 py-3"><div className="h-6 bg-muted rounded w-16"></div></td>
            <td className="px-4 py-3"><div className="h-8 bg-muted rounded w-20"></div></td>
        </tr>
    )
}

interface ProductFormData {
    name: string
    price: string
    unit: string
    icon: string
    description: string
    stock: string
    image: string
}

const defaultFormData: ProductFormData = {
    name: '',
    price: '',
    unit: 'liter',
    icon: '🥛',
    description: '',
    stock: '0',
    image: ''
}

export function ProductManagementPage() {
    const [products, setProducts] = useState<AdminProduct[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [status, setStatus] = useState('all')
    const [unit, setUnit] = useState('all')

    const [page, setPage] = useState(1)
    const [pagination, setPagination] = useState({ total: 0, pages: 1, limit: 10 })

    const [showModal, setShowModal] = useState(false)
    const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null)
    const [formData, setFormData] = useState<ProductFormData>(defaultFormData)
    const [submitting, setSubmitting] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [selectedProduct, setSelectedProduct] = useState<AdminProduct | null>(null)
    const [showDetailModal, setShowDetailModal] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const fetchProducts = useCallback(async () => {
        setLoading(true)
        try {
            const response = await getAdminProducts({
                page,
                limit: 10,
                search,
                status: status !== 'all' ? status : undefined,
                unit: unit !== 'all' ? unit : undefined
            })
            if (response.success) {
                setProducts(response.response.products)
                setPagination(response.response.pagination)
            }
        } catch (error) {
            console.error('Failed to fetch products:', error)
        } finally {
            setLoading(false)
        }
    }, [page, search, status, unit])

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchProducts()
        }, 300)
        return () => clearTimeout(timer)
    }, [fetchProducts])

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file')
            return
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Image size should be less than 5MB')
            return
        }

        setUploading(true)
        try {
            // Convert to base64
            const reader = new FileReader()
            reader.onloadend = async () => {
                const base64 = reader.result as string

                // Upload to server (which uses Cloudinary)
                const response = await uploadImage(base64, 'products')

                if (response.success && response.response?.url) {
                    setFormData(prev => ({ ...prev, image: response.response!.url }))
                } else {
                    alert(response.message || 'Failed to upload image')
                }
                setUploading(false)
            }
            reader.onerror = () => {
                alert('Failed to read image file')
                setUploading(false)
            }
            reader.readAsDataURL(file)
        } catch (error) {
            console.error('Upload failed:', error)
            alert('Image upload failed. Please try again.')
            setUploading(false)
        }
    }

    const handleOpenCreateModal = () => {
        setEditingProduct(null)
        setFormData(defaultFormData)
        setShowModal(true)
    }

    const handleOpenEditModal = (product: AdminProduct) => {
        setEditingProduct(product)
        setFormData({
            name: product.name,
            price: product.price.toString(),
            unit: product.unit,
            icon: product.icon,
            description: product.description || '',
            stock: product.stock.toString(),
            image: product.image || ''
        })
        setShowModal(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name || !formData.price) {
            alert('Name and price are required')
            return
        }

        setSubmitting(true)
        try {
            const productData = {
                name: formData.name,
                price: parseFloat(formData.price),
                unit: formData.unit,
                icon: formData.icon,
                description: formData.description,
                stock: parseInt(formData.stock),
                image: formData.image
            }

            if (editingProduct) {
                const response = await updateAdminProduct(editingProduct._id, productData)
                if (response.success) {
                    fetchProducts()
                    setShowModal(false)
                }
            } else {
                const response = await createAdminProduct(productData)
                if (response.success) {
                    fetchProducts()
                    setShowModal(false)
                }
            }
        } catch (error) {
            console.error('Failed to save product:', error)
            alert('Failed to save product')
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this product?')) return

        try {
            const response = await deleteAdminProduct(id)
            if (response.success) {
                fetchProducts()
            }
        } catch (error) {
            console.error('Failed to delete product:', error)
        }
    }

    const handleToggleStatus = async (id: string) => {
        try {
            const response = await toggleAdminProductStatus(id)
            if (response.success) {
                fetchProducts()
            }
        } catch (error) {
            console.error('Failed to toggle status:', error)
        }
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        })
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Product Management</h1>
                    <p className="text-muted-foreground">Manage all products</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchProducts}
                        className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                    <button
                        onClick={handleOpenCreateModal}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Add Product
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-card rounded-xl border border-border p-4 space-y-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Filter className="w-4 h-4" />
                    <span className="font-medium">Filters</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search products..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        />
                    </div>
                    <select
                        value={status}
                        onChange={(e) => { setStatus(e.target.value); setPage(1) }}
                        className="px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary"
                    >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                    <select
                        value={unit}
                        onChange={(e) => { setUnit(e.target.value); setPage(1) }}
                        className="px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary"
                    >
                        <option value="all">All Units</option>
                        <option value="liter">Liter</option>
                        <option value="kg">Kg</option>
                        <option value="piece">Piece</option>
                    </select>
                </div>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
                            <div className="flex gap-3 mb-3">
                                <div className="w-12 h-12 bg-muted rounded" />
                                <div className="flex-1">
                                    <div className="h-5 bg-muted rounded w-28 mb-2" />
                                    <div className="h-4 bg-muted rounded w-16" />
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="h-8 bg-muted rounded" />
                                <div className="h-8 bg-muted rounded" />
                                <div className="h-8 bg-muted rounded" />
                            </div>
                        </div>
                    ))
                ) : products.length === 0 ? (
                    <div className="bg-card border border-border rounded-xl p-8 text-center">
                        <Package className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                        <p className="text-sm text-muted-foreground">No products found</p>
                    </div>
                ) : (
                    products.map((product) => (
                        <div key={product._id} className="bg-card border border-border rounded-xl p-4">
                            <div className="flex gap-3 mb-3">
                                {product.image ? (
                                    <img src={product.image} alt={product.name} className="w-12 h-12 rounded object-cover" />
                                ) : (
                                    <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-xl">
                                        {product.icon}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-foreground truncate">{product.name}</p>
                                    <p className="text-lg font-semibold text-foreground">₹{product.price}</p>
                                </div>
                                <span className={`h-fit px-2 py-0.5 rounded-full text-xs font-medium ${product.isActive
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                    }`}>
                                    {product.isActive ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                                <div className="bg-muted/50 rounded-lg p-2 text-center">
                                    <p className="text-[10px] text-muted-foreground uppercase">Unit</p>
                                    <p className="font-medium text-foreground capitalize">{product.unit}</p>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-2 text-center">
                                    <p className="text-[10px] text-muted-foreground uppercase">Stock</p>
                                    <p className="font-medium text-foreground">{product.stock}</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-1 pt-2 border-t border-border">
                                <button
                                    onClick={() => { setSelectedProduct(product); setShowDetailModal(true) }}
                                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                                >
                                    <Eye className="w-4 h-4 text-muted-foreground" />
                                </button>
                                <button
                                    onClick={() => handleToggleStatus(product._id)}
                                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                                >
                                    <Power className={`w-4 h-4 ${product.isActive ? 'text-green-500' : 'text-muted-foreground'}`} />
                                </button>
                                <button onClick={() => handleOpenEditModal(product)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                                    <Edit className="w-4 h-4 text-primary" />
                                </button>
                                <button onClick={() => handleDelete(product._id)} className="p-2 hover:bg-destructive/10 rounded-lg transition-colors">
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-card rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Image</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Name</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Price</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Unit</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Stock</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Status</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Created</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                            ) : products.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                                        <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                        No products found
                                    </td>
                                </tr>
                            ) : (
                                products.map((product) => (
                                    <tr key={product._id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3">
                                            {product.image ? (
                                                <img
                                                    src={product.image}
                                                    alt={product.name}
                                                    className="w-10 h-10 rounded object-cover"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-xl">
                                                    {product.icon}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium">{product.name}</div>
                                            {product.description && (
                                                <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                    {product.description}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 font-semibold">₹{product.price}</td>
                                        <td className="px-4 py-3 capitalize">{product.unit}</td>
                                        <td className="px-4 py-3">{product.stock}</td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${product.isActive
                                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                                }`}>
                                                {product.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-muted-foreground">
                                            {formatDate(product.createdAt)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => { setSelectedProduct(product); setShowDetailModal(true) }}
                                                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                                                    title="View Details"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleOpenEditModal(product)}
                                                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleToggleStatus(product._id)}
                                                    className={`p-2 rounded-lg transition-colors ${product.isActive
                                                        ? 'hover:bg-orange-100 text-orange-600'
                                                        : 'hover:bg-green-100 text-green-600'
                                                        }`}
                                                    title={product.isActive ? 'Deactivate' : 'Activate'}
                                                >
                                                    <Power className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(product._id)}
                                                    className="p-2 hover:bg-destructive/10 text-destructive rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
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
                {pagination.pages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                        <p className="text-sm text-muted-foreground">
                            Showing {((page - 1) * pagination.limit) + 1} - {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 hover:bg-muted rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm">Page {page} of {pagination.pages}</span>
                            <button
                                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                                disabled={page === pagination.pages}
                                className="p-2 hover:bg-muted rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-border flex items-center justify-between">
                            <h2 className="text-xl font-bold">
                                {editingProduct ? 'Edit Product' : 'Create Product'}
                            </h2>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-muted rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Name *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Price *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.price}
                                        onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Unit</label>
                                    <select
                                        value={formData.unit}
                                        onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary"
                                    >
                                        <option value="liter">Liter</option>
                                        <option value="kg">Kg</option>
                                        <option value="piece">Piece</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Stock</label>
                                <input
                                    type="number"
                                    value={formData.stock}
                                    onChange={(e) => setFormData(prev => ({ ...prev, stock: e.target.value }))}
                                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    rows={3}
                                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Product Image</label>
                                <div className="flex items-center gap-4">
                                    {formData.image ? (
                                        <img src={formData.image} alt="Product" className="w-16 h-16 rounded object-cover" />
                                    ) : (
                                        <div className="w-16 h-16 rounded bg-muted flex items-center justify-center">
                                            <Package className="w-6 h-6 text-muted-foreground" />
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleImageUpload}
                                        accept="image/*"
                                        className="hidden"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                        className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors disabled:opacity-50"
                                    >
                                        <Upload className="w-4 h-4" />
                                        {uploading ? 'Uploading...' : 'Upload Image'}
                                    </button>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                                >
                                    {submitting ? 'Saving...' : (editingProduct ? 'Update' : 'Create')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {showDetailModal && selectedProduct && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-card rounded-xl w-full max-w-lg">
                        <div className="p-6 border-b border-border flex items-center justify-between">
                            <h2 className="text-xl font-bold">Product Details</h2>
                            <button onClick={() => setShowDetailModal(false)} className="p-2 hover:bg-muted rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="flex items-center gap-4">
                                {selectedProduct.image ? (
                                    <img
                                        src={selectedProduct.image}
                                        alt={selectedProduct.name}
                                        className="w-20 h-20 rounded object-cover"
                                    />
                                ) : (
                                    <div className="w-20 h-20 rounded bg-muted flex items-center justify-center text-3xl">
                                        {selectedProduct.icon}
                                    </div>
                                )}
                                <div>
                                    <h3 className="text-lg font-bold">{selectedProduct.name}</h3>
                                    <p className="text-2xl font-bold text-primary">₹{selectedProduct.price}/{selectedProduct.unit}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-muted-foreground">Stock</label>
                                    <p className="font-medium">{selectedProduct.stock}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-muted-foreground">Status</label>
                                    <p className={`font-medium ${selectedProduct.isActive ? 'text-green-600' : 'text-red-600'}`}>
                                        {selectedProduct.isActive ? 'Active' : 'Inactive'}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-sm text-muted-foreground">Owner</label>
                                    <p className="font-medium">{typeof selectedProduct.owner === 'object' ? selectedProduct.owner.name : '-'}</p>
                                </div>
                                <div>
                                    <label className="text-sm text-muted-foreground">Created</label>
                                    <p className="font-medium">{formatDate(selectedProduct.createdAt)}</p>
                                </div>
                            </div>

                            {selectedProduct.description && (
                                <div>
                                    <label className="text-sm text-muted-foreground">Description</label>
                                    <p>{selectedProduct.description}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}