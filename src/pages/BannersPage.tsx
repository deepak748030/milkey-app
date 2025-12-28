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
    Image as ImageIcon,
    Upload,
    GripVertical,
    ArrowUp,
    ArrowDown,
} from 'lucide-react'
import { cn } from '../lib/utils'
import {
    getBannersAdmin,
    createBanner,
    updateBanner,
    deleteBanner,
    toggleBannerStatus,
    uploadImage,
    Banner,
    Pagination,
} from '../lib/api'

interface BannerFormData {
    title: string
    subtitle: string
    image: string
    badge: string
    gradient: string[]
    linkType: 'category' | 'product' | 'url' | 'none'
    linkValue: string
    order: number
}

const defaultGradients = [
    ['#22C55E', '#16A34A'],
    ['#3B82F6', '#2563EB'],
    ['#F59E0B', '#D97706'],
    ['#EF4444', '#DC2626'],
    ['#8B5CF6', '#7C3AED'],
    ['#EC4899', '#DB2777'],
    ['#06B6D4', '#0891B2'],
    ['#10B981', '#059669'],
]

export function BannersPage() {
    const [banners, setBanners] = useState<Banner[]>([])
    const [pagination, setPagination] = useState<Pagination | null>(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
    const [page, setPage] = useState(1)
    const [showModal, setShowModal] = useState(false)
    const [editingBanner, setEditingBanner] = useState<Banner | null>(null)
    const [formData, setFormData] = useState<BannerFormData>({
        title: '',
        subtitle: '',
        image: '',
        badge: '',
        gradient: ['#22C55E', '#16A34A'],
        linkType: 'none',
        linkValue: '',
        order: 0,
    })
    const [formLoading, setFormLoading] = useState(false)
    const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
    const [toggleLoading, setToggleLoading] = useState<string | null>(null)
    const [imagePreview, setImagePreview] = useState<string>('')
    const [uploadLoading, setUploadLoading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const fetchBanners = useCallback(async () => {
        try {
            setLoading(true)
            const response = await getBannersAdmin({
                page,
                limit: 10,
                search,
                status: statusFilter,
            })
            if (response.success) {
                setBanners(response.response.banners)
                setPagination(response.response.pagination)
            }
        } catch (error) {
            console.error('Error fetching banners:', error)
        } finally {
            setLoading(false)
        }
    }, [page, search, statusFilter])

    useEffect(() => {
        fetchBanners()
    }, [fetchBanners])

    useEffect(() => {
        setPage(1)
    }, [search, statusFilter])

    const handleOpenModal = (banner?: Banner) => {
        if (banner) {
            setEditingBanner(banner)
            setFormData({
                title: banner.title,
                subtitle: banner.subtitle || '',
                image: banner.image,
                badge: banner.badge || '',
                gradient: banner.gradient || ['#22C55E', '#16A34A'],
                linkType: (banner.linkType as 'category' | 'product' | 'url' | 'none') || 'none',
                linkValue: banner.linkValue || '',
                order: banner.order || 0,
            })
            setImagePreview(banner.image)
        } else {
            setEditingBanner(null)
            // Set next order number
            const maxOrder = banners.length > 0 ? Math.max(...banners.map(b => b.order || 0)) : -1
            setFormData({
                title: '',
                subtitle: '',
                image: '',
                badge: '',
                gradient: ['#22C55E', '#16A34A'],
                linkType: 'none',
                linkValue: '',
                order: maxOrder + 1,
            })
            setImagePreview('')
        }
        setShowModal(true)
    }

    const handleCloseModal = () => {
        setShowModal(false)
        setEditingBanner(null)
        setFormData({
            title: '',
            subtitle: '',
            image: '',
            badge: '',
            gradient: ['#22C55E', '#16A34A'],
            linkType: 'none',
            linkValue: '',
            order: 0,
        })
        setImagePreview('')
    }

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

        setUploadLoading(true)

        try {
            // Convert to base64 and show preview
            const reader = new FileReader()
            reader.onloadend = async () => {
                const base64 = reader.result as string
                setImagePreview(base64)

                // Upload to server (which uses Cloudinary)
                const response = await uploadImage(base64, 'banners')

                if (response.success && response.response?.url) {
                    setFormData(prev => ({ ...prev, image: response.response!.url }))
                    setImagePreview(response.response.url)
                } else {
                    alert(response.message || 'Failed to upload image')
                    setImagePreview('')
                }
                setUploadLoading(false)
            }
            reader.onerror = () => {
                alert('Failed to read image file')
                setUploadLoading(false)
            }
            reader.readAsDataURL(file)
        } catch (error) {
            console.error('Error uploading image:', error)
            alert(error instanceof Error ? error.message : 'Failed to upload image')
            setImagePreview('')
            setUploadLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.title.trim()) {
            alert('Title is required')
            return
        }
        if (!formData.image) {
            alert('Image is required')
            return
        }

        try {
            setFormLoading(true)
            if (editingBanner) {
                await updateBanner(editingBanner._id, formData)
            } else {
                await createBanner(formData)
            }
            handleCloseModal()
            fetchBanners()
        } catch (error) {
            console.error('Error saving banner:', error)
            alert('Failed to save banner')
        } finally {
            setFormLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this banner?')) return

        try {
            setDeleteLoading(id)
            await deleteBanner(id)
            fetchBanners()
        } catch (error) {
            console.error('Error deleting banner:', error)
        } finally {
            setDeleteLoading(null)
        }
    }

    const handleToggleStatus = async (id: string) => {
        try {
            setToggleLoading(id)
            await toggleBannerStatus(id)
            fetchBanners()
        } catch (error) {
            console.error('Error toggling status:', error)
        } finally {
            setToggleLoading(null)
        }
    }

    const SkeletonRow = () => (
        <tr className="border-b border-border/50">
            <td className="px-4 py-3"><div className="skeleton h-16 w-28 rounded-lg" /></td>
            <td className="px-4 py-3">
                <div className="space-y-2">
                    <div className="skeleton h-4 w-32 rounded" />
                    <div className="skeleton h-3 w-24 rounded" />
                </div>
            </td>
            <td className="px-4 py-3"><div className="skeleton h-6 w-16 rounded-full" /></td>
            <td className="px-4 py-3"><div className="skeleton h-4 w-20 rounded" /></td>
            <td className="px-4 py-3"><div className="skeleton h-6 w-16 rounded-full" /></td>
            <td className="px-4 py-3"><div className="skeleton h-4 w-8 rounded" /></td>
            <td className="px-4 py-3"><div className="skeleton h-8 w-24 rounded" /></td>
        </tr>
    )

    return (
        <div className="space-y-4 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl lg:text-2xl font-bold text-foreground">Banners</h1>
                    <p className="text-sm text-muted-foreground">
                        Manage promotional banners
                    </p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                >
                    <Plus className="w-4 h-4" />
                    Add Banner
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
                            placeholder="Search banners..."
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
                            <div className="flex gap-3">
                                <div className="skeleton w-20 h-14 rounded-lg" />
                                <div className="flex-1 space-y-2">
                                    <div className="skeleton h-4 w-32 rounded" />
                                    <div className="skeleton h-3 w-24 rounded" />
                                </div>
                            </div>
                        </div>
                    ))
                ) : banners.length === 0 ? (
                    <div className="bg-card border border-border rounded-xl p-8 text-center">
                        <ImageIcon className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                        <p className="text-sm text-muted-foreground">No banners found</p>
                    </div>
                ) : (
                    banners.map((banner) => (
                        <div key={banner._id} className="bg-card border border-border rounded-xl p-4">
                            <div className="flex gap-3">
                                <div
                                    className="w-20 h-14 rounded-lg overflow-hidden flex-shrink-0"
                                    style={{
                                        background: banner.gradient
                                            ? `linear-gradient(135deg, ${banner.gradient[0]}, ${banner.gradient[1]})`
                                            : '#22C55E'
                                    }}
                                >
                                    {banner.image && (
                                        <img src={banner.image} alt={banner.title} className="w-full h-full object-cover" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{banner.title}</p>
                                    {banner.subtitle && (
                                        <p className="text-xs text-muted-foreground truncate">{banner.subtitle}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                        <span className={cn(
                                            'px-2 py-0.5 text-xs font-medium rounded-full',
                                            banner.isActive ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
                                        )}>
                                            {banner.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                        {banner.badge && (
                                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary/20 text-primary">
                                                {banner.badge}
                                            </span>
                                        )}
                                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-muted text-muted-foreground">
                                            Position: {banner.order + 1}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <GripVertical className="w-3.5 h-3.5" />
                                    <span>Order: {banner.order}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handleToggleStatus(banner._id)}
                                        disabled={toggleLoading === banner._id}
                                        className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                                    >
                                        {toggleLoading === banner._id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : banner.isActive ? (
                                            <ToggleRight className="w-4 h-4 text-success" />
                                        ) : (
                                            <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                                        )}
                                    </button>
                                    <button onClick={() => handleOpenModal(banner)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                                        <Edit2 className="w-4 h-4 text-primary" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(banner._id)}
                                        disabled={deleteLoading === banner._id}
                                        className="p-1.5 rounded-lg hover:bg-destructive/20 transition-colors disabled:opacity-50"
                                    >
                                        {deleteLoading === banner._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-destructive" />}
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
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Preview</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Details</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Badge</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Link Type</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Position</th>
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
                            ) : banners.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-4 py-12 text-center">
                                        <ImageIcon className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                                        <p className="text-sm text-muted-foreground">No banners found</p>
                                    </td>
                                </tr>
                            ) : (
                                banners.map((banner) => (
                                    <tr key={banner._id} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3">
                                            <div
                                                className="w-28 h-16 rounded-lg overflow-hidden relative"
                                                style={{
                                                    background: banner.gradient
                                                        ? `linear-gradient(135deg, ${banner.gradient[0]}, ${banner.gradient[1]})`
                                                        : '#22C55E'
                                                }}
                                            >
                                                {banner.image && (
                                                    <img src={banner.image} alt={banner.title} className="w-full h-full object-cover" />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div>
                                                <span className="text-sm font-medium text-foreground block">{banner.title}</span>
                                                {banner.subtitle && <span className="text-xs text-muted-foreground">{banner.subtitle}</span>}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {banner.badge ? (
                                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary/20 text-primary">{banner.badge}</span>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm text-muted-foreground capitalize">{banner.linkType || 'None'}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={cn('px-2 py-1 text-xs font-medium rounded-full', banner.isActive ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground')}>
                                                {banner.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                <span className="w-8 h-8 flex items-center justify-center bg-primary/10 text-primary rounded-lg text-sm font-bold">
                                                    {banner.order + 1}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => handleToggleStatus(banner._id)}
                                                    disabled={toggleLoading === banner._id}
                                                    className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                                                    title={banner.isActive ? 'Deactivate' : 'Activate'}
                                                >
                                                    {toggleLoading === banner._id ? <Loader2 className="w-4 h-4 animate-spin" /> : banner.isActive ? <ToggleRight className="w-4 h-4 text-success" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                                                </button>
                                                <button onClick={() => handleOpenModal(banner)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Edit">
                                                    <Edit2 className="w-4 h-4 text-primary" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(banner._id)}
                                                    disabled={deleteLoading === banner._id}
                                                    className="p-1.5 rounded-lg hover:bg-destructive/20 transition-colors disabled:opacity-50"
                                                    title="Delete"
                                                >
                                                    {deleteLoading === banner._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-destructive" />}
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
                                    className={cn('w-8 h-8 rounded-lg text-sm font-medium transition-colors', page === pageNum ? 'bg-primary text-primary-foreground' : 'hover:bg-muted')}
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
                    <div className="bg-card border border-border rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto animate-scale-in">
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h2 className="text-lg font-semibold text-foreground">
                                {editingBanner ? 'Edit Banner' : 'Add Banner'}
                            </h2>
                            <button
                                onClick={handleCloseModal}
                                className="p-2 rounded-lg hover:bg-muted transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            {/* Image Upload */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Banner Image *
                                </label>
                                <div
                                    onClick={() => !uploadLoading && fileInputRef.current?.click()}
                                    className={cn(
                                        'relative border-2 border-dashed rounded-xl overflow-hidden cursor-pointer transition-colors',
                                        imagePreview ? 'border-primary' : 'border-border hover:border-primary/50',
                                        'h-40',
                                        uploadLoading && 'cursor-not-allowed'
                                    )}
                                    style={{
                                        background: formData.gradient
                                            ? `linear-gradient(135deg, ${formData.gradient[0]}, ${formData.gradient[1]})`
                                            : '#22C55E'
                                    }}
                                >
                                    {uploadLoading ? (
                                        <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                                            <div className="text-center">
                                                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                                                <p className="text-sm text-muted-foreground mt-2">Uploading to Cloudinary...</p>
                                            </div>
                                        </div>
                                    ) : imagePreview ? (
                                        <img
                                            src={imagePreview}
                                            alt="Preview"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80">
                                            <Upload className="w-8 h-8 mb-2" />
                                            <p className="text-sm font-medium">Click to upload image</p>
                                            <p className="text-xs mt-1">PNG, JPG up to 5MB</p>
                                        </div>
                                    )}
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    className="hidden"
                                />
                                {formData.image && !formData.image.startsWith('data:') && (
                                    <p className="text-xs text-success mt-1">✓ Image uploaded to Cloudinary</p>
                                )}
                            </div>

                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Title *
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="Enter banner title"
                                    className="w-full px-4 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                            </div>

                            {/* Subtitle */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Subtitle
                                </label>
                                <input
                                    type="text"
                                    value={formData.subtitle}
                                    onChange={(e) => setFormData(prev => ({ ...prev, subtitle: e.target.value }))}
                                    placeholder="Enter banner subtitle"
                                    className="w-full px-4 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                            </div>

                            {/* Badge */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Badge Text
                                </label>
                                <input
                                    type="text"
                                    value={formData.badge}
                                    onChange={(e) => setFormData(prev => ({ ...prev, badge: e.target.value }))}
                                    placeholder="e.g., NEW, SALE, 50% OFF"
                                    className="w-full px-4 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                            </div>

                            {/* Gradient */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Background Gradient
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {defaultGradients.map((gradient, index) => (
                                        <button
                                            key={index}
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, gradient }))}
                                            className={cn(
                                                'w-10 h-10 rounded-lg border-2 transition-all',
                                                formData.gradient[0] === gradient[0] && formData.gradient[1] === gradient[1]
                                                    ? 'border-foreground scale-110'
                                                    : 'border-transparent hover:scale-105'
                                            )}
                                            style={{
                                                background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Link Type */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Link Type
                                </label>
                                <select
                                    value={formData.linkType}
                                    onChange={(e) => setFormData(prev => ({ ...prev, linkType: e.target.value as typeof formData.linkType, linkValue: '' }))}
                                    className="w-full px-4 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <option value="none">No Link</option>
                                    <option value="category">Category</option>
                                    <option value="product">Product</option>
                                    <option value="url">External URL</option>
                                </select>
                            </div>

                            {/* Link Value */}
                            {formData.linkType !== 'none' && (
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">
                                        {formData.linkType === 'url' ? 'URL' : `${formData.linkType.charAt(0).toUpperCase() + formData.linkType.slice(1)} ID`}
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.linkValue}
                                        onChange={(e) => setFormData(prev => ({ ...prev, linkValue: e.target.value }))}
                                        placeholder={formData.linkType === 'url' ? 'https://example.com' : `Enter ${formData.linkType} ID`}
                                        className="w-full px-4 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                    />
                                </div>
                            )}

                            {/* Display Position */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">
                                    Display Position
                                </label>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1">
                                        <input
                                            type="number"
                                            value={formData.order}
                                            onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                                            min={0}
                                            className="w-full px-4 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                        />
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, order: Math.max(0, prev.order - 1) }))}
                                            className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                                            title="Move up"
                                        >
                                            <ArrowUp className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, order: prev.order + 1 }))}
                                            className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                                            title="Move down"
                                        >
                                            <ArrowDown className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Lower numbers appear first. Position {formData.order} will show as #{formData.order + 1} in carousel.
                                </p>
                            </div>

                            {/* Quick Position Selection */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Quick Position Select
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((pos) => (
                                        <button
                                            key={pos}
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, order: pos }))}
                                            className={cn(
                                                'w-10 h-10 rounded-lg border-2 text-sm font-bold transition-all',
                                                formData.order === pos
                                                    ? 'bg-primary text-primary-foreground border-primary'
                                                    : 'bg-muted border-border hover:border-primary/50'
                                            )}
                                        >
                                            {pos + 1}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={formLoading || uploadLoading}
                                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {formLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        editingBanner ? 'Update Banner' : 'Create Banner'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
