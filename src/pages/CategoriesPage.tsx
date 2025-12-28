import { useState, useEffect, useCallback, useRef } from 'react'
import {
    Search,
    Filter,
    Plus,
    Edit2,
    Trash2,
    ToggleLeft,
    ToggleRight,
    X,
    ChevronLeft,
    ChevronRight,
    Loader2,
    FolderOpen,
    Upload,
} from 'lucide-react'
import { cn } from '../lib/utils'
import {
    getCategoriesAdmin,
    createCategory,
    updateCategory,
    deleteCategory,
    toggleCategoryStatus,
    Category,
    Pagination,
} from '../lib/api'

interface CategoryFormData {
    name: string
    image: string
    color: string
}

const defaultColors = [
    '#DCFCE7', '#FEF3C7', '#DBEAFE', '#FCE7F3', '#E0E7FF',
    '#F3E8FF', '#CFFAFE', '#FED7AA', '#D1FAE5', '#FEE2E2',
]

export function CategoriesPage() {
    const [categories, setCategories] = useState<Category[]>([])
    const [pagination, setPagination] = useState<Pagination | null>(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
    const [page, setPage] = useState(1)
    const [showModal, setShowModal] = useState(false)
    const [editingCategory, setEditingCategory] = useState<Category | null>(null)
    const [formData, setFormData] = useState<CategoryFormData>({
        name: '',
        image: '',
        color: '#DCFCE7',
    })
    const [formLoading, setFormLoading] = useState(false)
    const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
    const [toggleLoading, setToggleLoading] = useState<string | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Debounce search for better performance
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 400)
        return () => clearTimeout(timer)
    }, [search])

    const fetchCategories = useCallback(async () => {
        try {
            setLoading(true)
            const response = await getCategoriesAdmin({
                page,
                limit: 10,
                search: debouncedSearch,
                status: statusFilter,
            })
            if (response.success) {
                setCategories(response.response.categories)
                setPagination(response.response.pagination)
            }
        } catch (error) {
            console.error('Error fetching categories:', error)
        } finally {
            setLoading(false)
        }
    }, [page, debouncedSearch, statusFilter])

    useEffect(() => {
        fetchCategories()
    }, [fetchCategories])

    useEffect(() => {
        setPage(1)
    }, [debouncedSearch, statusFilter])

    const handleOpenModal = (category?: Category) => {
        if (category) {
            setEditingCategory(category)
            setFormData({
                name: category.name,
                image: category.image || '',
                color: category.color || '#DCFCE7',
            })
            setImagePreview(category.image || null)
        } else {
            setEditingCategory(null)
            setFormData({ name: '', image: '', color: '#DCFCE7' })
            setImagePreview(null)
        }
        setShowModal(true)
    }

    const handleCloseModal = () => {
        setShowModal(false)
        setEditingCategory(null)
        setFormData({ name: '', image: '', color: '#DCFCE7' })
        setImagePreview(null)
    }

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validate file size (max 2MB for categories)
        if (file.size > 2 * 1024 * 1024) {
            alert('Image size should be less than 2MB')
            return
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file')
            return
        }

        const reader = new FileReader()
        reader.onload = () => {
            const base64 = reader.result as string
            setFormData(f => ({ ...f, image: base64 }))
            setImagePreview(base64)
        }
        reader.readAsDataURL(file)
    }

    const handleRemoveImage = () => {
        setFormData(f => ({ ...f, image: '' }))
        setImagePreview(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name.trim()) return

        try {
            setFormLoading(true)
            if (editingCategory) {
                await updateCategory(editingCategory._id, formData)
            } else {
                await createCategory(formData)
            }
            handleCloseModal()
            fetchCategories()
        } catch (error) {
            console.error('Error saving category:', error)
        } finally {
            setFormLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this category?')) return

        try {
            setDeleteLoading(id)
            await deleteCategory(id)
            fetchCategories()
        } catch (error) {
            console.error('Error deleting category:', error)
        } finally {
            setDeleteLoading(null)
        }
    }

    const handleToggleStatus = async (id: string) => {
        try {
            setToggleLoading(id)
            await toggleCategoryStatus(id)
            fetchCategories()
        } catch (error) {
            console.error('Error toggling status:', error)
        } finally {
            setToggleLoading(null)
        }
    }

    const SkeletonRow = () => (
        <tr className="border-b border-border/50">
            <td className="px-4 py-3"><div className="skeleton h-10 w-10 rounded-lg" /></td>
            <td className="px-4 py-3"><div className="skeleton h-4 w-32 rounded" /></td>
            <td className="px-4 py-3"><div className="skeleton h-6 w-6 rounded-full" /></td>
            <td className="px-4 py-3"><div className="skeleton h-4 w-16 rounded" /></td>
            <td className="px-4 py-3"><div className="skeleton h-6 w-16 rounded-full" /></td>
            <td className="px-4 py-3"><div className="skeleton h-4 w-24 rounded" /></td>
            <td className="px-4 py-3"><div className="skeleton h-8 w-24 rounded" /></td>
        </tr>
    )

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl lg:text-2xl font-bold text-foreground">Categories</h1>
                    <p className="text-sm text-muted-foreground">
                        Manage product categories
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                >
                    <Plus className="w-4 h-4" />
                    Add Category
                </button>
            </div>

            {/* Filters */}
            <div className="bg-card border border-border rounded-xl p-3">
                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search categories..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    </div>

                    {/* Status Filter */}
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                            className="pl-9 pr-8 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer min-w-[140px]"
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-card border border-border rounded-xl p-4">
                            <div className="flex items-center gap-3">
                                <div className="skeleton w-12 h-12 rounded-lg" />
                                <div className="flex-1 space-y-2">
                                    <div className="skeleton h-4 w-24 rounded" />
                                    <div className="skeleton h-3 w-16 rounded" />
                                </div>
                            </div>
                        </div>
                    ))
                ) : categories.length === 0 ? (
                    <div className="bg-card border border-border rounded-xl p-8 text-center">
                        <FolderOpen className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                        <p className="text-sm text-muted-foreground">No categories found</p>
                    </div>
                ) : (
                    categories.map((category) => (
                        <div key={category._id} className="bg-card border border-border rounded-xl p-4">
                            <div className="flex items-center gap-3">
                                {category.image ? (
                                    <img src={category.image} alt={category.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                                ) : (
                                    <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: category.color || '#DCFCE7' }}>
                                        <FolderOpen className="w-6 h-6 text-gray-700" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground">{category.name}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', category.isActive ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground')}>
                                            {category.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                        <span className="text-xs text-muted-foreground">{category.itemsCount || 0} items</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleToggleStatus(category._id)}
                                        disabled={toggleLoading === category._id}
                                        className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                                    >
                                        {toggleLoading === category._id ? <Loader2 className="w-4 h-4 animate-spin" /> : category.isActive ? <ToggleRight className="w-4 h-4 text-success" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                                    </button>
                                    <button onClick={() => handleOpenModal(category)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                                        <Edit2 className="w-4 h-4 text-primary" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(category._id)}
                                        disabled={deleteLoading === category._id}
                                        className="p-1.5 rounded-lg hover:bg-destructive/20 transition-colors disabled:opacity-50"
                                    >
                                        {deleteLoading === category._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-destructive" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block bg-card border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted/50">
                            <tr className="border-b border-border">
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Image</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Name</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Color</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Items</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Created</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {loading ? (
                                <>
                                    <SkeletonRow />
                                    <SkeletonRow />
                                    <SkeletonRow />
                                    <SkeletonRow />
                                    <SkeletonRow />
                                </>
                            ) : categories.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center">
                                        <FolderOpen className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                                        <p className="text-sm text-muted-foreground">No categories found</p>
                                    </td>
                                </tr>
                            ) : (
                                categories.map((category) => (
                                    <tr key={category._id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3">
                                            {category.image ? (
                                                <img src={category.image} alt={category.name} className="w-10 h-10 rounded-lg object-cover" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: category.color || '#DCFCE7' }}>
                                                    <FolderOpen className="w-5 h-5 text-gray-700" />
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm font-medium text-foreground">{category.name}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="w-6 h-6 rounded-full border border-border" style={{ backgroundColor: category.color || '#DCFCE7' }} title={category.color} />
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm text-muted-foreground">{category.itemsCount || 0}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={cn('px-2 py-1 text-xs font-medium rounded-full', category.isActive ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground')}>
                                                {category.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm text-muted-foreground">{new Date(category.createdAt).toLocaleDateString()}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleToggleStatus(category._id)}
                                                    disabled={toggleLoading === category._id}
                                                    className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                                                    title={category.isActive ? 'Deactivate' : 'Activate'}
                                                >
                                                    {toggleLoading === category._id ? <Loader2 className="w-4 h-4 animate-spin" /> : category.isActive ? <ToggleRight className="w-4 h-4 text-success" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                                                </button>
                                                <button onClick={() => handleOpenModal(category)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Edit">
                                                    <Edit2 className="w-4 h-4 text-primary" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(category._id)}
                                                    disabled={deleteLoading === category._id}
                                                    className="p-1.5 rounded-lg hover:bg-destructive/20 transition-colors disabled:opacity-50"
                                                    title="Delete"
                                                >
                                                    {deleteLoading === category._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-destructive" />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {pagination && pagination.pages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
                    <p className="text-xs text-muted-foreground">
                        Showing {((page - 1) * pagination.limit) + 1} to {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
                    </p>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                            let pageNum: number
                            if (pagination.pages <= 5) {
                                pageNum = i + 1
                            } else if (page <= 3) {
                                pageNum = i + 1
                            } else if (page >= pagination.pages - 2) {
                                pageNum = pagination.pages - 4 + i
                            } else {
                                pageNum = page - 2 + i
                            }
                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => setPage(pageNum)}
                                    className={cn('w-8 h-8 rounded-lg text-xs font-medium transition-colors', page === pageNum ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
                                >
                                    {pageNum}
                                </button>
                            )
                        })}
                        <button
                            onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                            disabled={page === pagination.pages}
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-card border border-border rounded-xl w-full max-w-md animate-fade-in max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h2 className="text-lg font-semibold">
                                {editingCategory ? 'Edit Category' : 'Add Category'}
                            </h2>
                            <button
                                onClick={handleCloseModal}
                                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">
                                    Category Name
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                                    placeholder="Enter category name"
                                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                    required
                                />
                            </div>

                            {/* Image Upload */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">
                                    Category Image
                                </label>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    className="hidden"
                                />

                                {imagePreview ? (
                                    <div className="relative">
                                        <img
                                            src={imagePreview}
                                            alt="Preview"
                                            className="w-full h-40 object-cover rounded-lg border border-border"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleRemoveImage}
                                            className="absolute top-2 right-2 p-1.5 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full h-40 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-muted/50 transition-colors"
                                    >
                                        <div className="p-3 bg-muted rounded-full">
                                            <Upload className="w-6 h-6 text-muted-foreground" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-medium text-foreground">Click to upload</p>
                                            <p className="text-xs text-muted-foreground">PNG, JPG up to 2MB</p>
                                        </div>
                                    </button>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">
                                    Color
                                </label>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {defaultColors.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setFormData(f => ({ ...f, color }))}
                                            className={cn(
                                                'w-8 h-8 rounded-full border-2 transition-all',
                                                formData.color === color
                                                    ? 'border-primary scale-110'
                                                    : 'border-transparent hover:scale-105'
                                            )}
                                            style={{ backgroundColor: color }}
                                        />
                                    ))}
                                    <input
                                        type="color"
                                        value={formData.color}
                                        onChange={(e) => setFormData(f => ({ ...f, color: e.target.value }))}
                                        className="w-8 h-8 rounded-full border-0 cursor-pointer"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={formLoading || !formData.name.trim()}
                                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {formLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {editingCategory ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
