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
    Upload,
    Link as LinkIcon,
    ExternalLink,
} from 'lucide-react'
import { cn } from '../lib/utils'
import {
    getSocialLinksAdmin,
    createSocialLink,
    updateSocialLink,
    deleteSocialLink,
    toggleSocialLinkStatus,
    uploadImage,
    SocialLink,
    Pagination,
} from '../lib/api'

interface SocialLinkFormData {
    title: string
    image: string
    link: string
    order: number
}

export function SocialLinksPage() {
    const [links, setLinks] = useState<SocialLink[]>([])
    const [pagination, setPagination] = useState<Pagination | null>(null)
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
    const [page, setPage] = useState(1)
    const [showModal, setShowModal] = useState(false)
    const [editingLink, setEditingLink] = useState<SocialLink | null>(null)
    const [formData, setFormData] = useState<SocialLinkFormData>({
        title: '',
        image: '',
        link: '',
        order: 0,
    })
    const [formLoading, setFormLoading] = useState(false)
    const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
    const [toggleLoading, setToggleLoading] = useState<string | null>(null)
    const [imagePreview, setImagePreview] = useState<string>('')
    const [uploadLoading, setUploadLoading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const fetchLinks = useCallback(async () => {
        try {
            setLoading(true)
            const response = await getSocialLinksAdmin({ page, limit: 10, search, status: statusFilter })
            if (response.success) {
                setLinks(response.response.socialLinks)
                setPagination(response.response.pagination)
            }
        } catch (error) {
            console.error('Error fetching social links:', error)
        } finally {
            setLoading(false)
        }
    }, [page, search, statusFilter])

    useEffect(() => { fetchLinks() }, [fetchLinks])
    useEffect(() => { setPage(1) }, [search, statusFilter])

    const handleOpenModal = (link?: SocialLink) => {
        if (link) {
            setEditingLink(link)
            setFormData({ title: link.title, image: link.image, link: link.link, order: link.order || 0 })
            setImagePreview(link.image)
        } else {
            setEditingLink(null)
            const maxOrder = links.length > 0 ? Math.max(...links.map(l => l.order || 0)) : -1
            setFormData({ title: '', image: '', link: '', order: maxOrder + 1 })
            setImagePreview('')
        }
        setShowModal(true)
    }

    const handleCloseModal = () => {
        setShowModal(false)
        setEditingLink(null)
        setFormData({ title: '', image: '', link: '', order: 0 })
        setImagePreview('')
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith('image/')) { alert('Please select an image file'); return }
        if (file.size > 5 * 1024 * 1024) { alert('Image size should be less than 5MB'); return }

        setUploadLoading(true)
        try {
            const reader = new FileReader()
            reader.onloadend = async () => {
                const base64 = reader.result as string
                setImagePreview(base64)
                const response = await uploadImage(base64, 'social-links')
                if (response.success && response.response?.url) {
                    setFormData(prev => ({ ...prev, image: response.response!.url }))
                    setImagePreview(response.response.url)
                } else {
                    alert(response.message || 'Failed to upload image')
                    setImagePreview('')
                }
                setUploadLoading(false)
            }
            reader.onerror = () => { alert('Failed to read image file'); setUploadLoading(false) }
            reader.readAsDataURL(file)
        } catch (error) {
            alert('Failed to upload image')
            setImagePreview('')
            setUploadLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.title.trim()) { alert('Title is required'); return }
        if (!formData.image) { alert('Image is required'); return }
        if (!formData.link.trim()) { alert('Link is required'); return }

        try {
            setFormLoading(true)
            if (editingLink) {
                await updateSocialLink(editingLink._id, formData)
            } else {
                await createSocialLink(formData)
            }
            handleCloseModal()
            fetchLinks()
        } catch (error) {
            alert('Failed to save social link')
        } finally {
            setFormLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this social link?')) return
        try {
            setDeleteLoading(id)
            await deleteSocialLink(id)
            fetchLinks()
        } catch (error) {
            console.error('Error deleting:', error)
        } finally {
            setDeleteLoading(null)
        }
    }

    const handleToggleStatus = async (id: string) => {
        try {
            setToggleLoading(id)
            await toggleSocialLinkStatus(id)
            fetchLinks()
        } catch (error) {
            console.error('Error toggling:', error)
        } finally {
            setToggleLoading(null)
        }
    }

    const SkeletonRow = () => (
        <tr className="border-b border-border/50">
            <td className="px-4 py-3"><div className="skeleton h-10 w-10 rounded-lg" /></td>
            <td className="px-4 py-3"><div className="skeleton h-4 w-32 rounded" /></td>
            <td className="px-4 py-3"><div className="skeleton h-4 w-48 rounded" /></td>
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
                    <h1 className="text-xl lg:text-2xl font-bold text-foreground">Social Links</h1>
                    <p className="text-sm text-muted-foreground">Manage "Follow Us On" social links shown in the app</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                >
                    <Plus className="w-4 h-4" />
                    Add Social Link
                </button>
            </div>

            {/* Filters */}
            <div className="bg-card border border-border rounded-xl p-3">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search social links..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                    </div>
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
                                <div className="skeleton w-12 h-12 rounded-lg" />
                                <div className="flex-1 space-y-2">
                                    <div className="skeleton h-4 w-32 rounded" />
                                    <div className="skeleton h-3 w-48 rounded" />
                                </div>
                            </div>
                        </div>
                    ))
                ) : links.length === 0 ? (
                    <div className="bg-card border border-border rounded-xl p-8 text-center">
                        <LinkIcon className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                        <p className="text-sm text-muted-foreground">No social links found</p>
                    </div>
                ) : (
                    links.map((link) => (
                        <div key={link._id} className="bg-card border border-border rounded-xl p-4">
                            <div className="flex gap-3">
                                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                                    <img src={link.image} alt={link.title} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{link.title}</p>
                                    <p className="text-xs text-muted-foreground truncate">{link.link}</p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className={cn(
                                            'px-2 py-0.5 text-xs font-medium rounded-full',
                                            link.isActive ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
                                        )}>
                                            {link.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-end mt-3 pt-3 border-t border-border gap-1">
                                <button onClick={() => handleToggleStatus(link._id)} disabled={toggleLoading === link._id} className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50">
                                    {toggleLoading === link._id ? <Loader2 className="w-4 h-4 animate-spin" /> : link.isActive ? <ToggleRight className="w-4 h-4 text-success" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                                </button>
                                <button onClick={() => handleOpenModal(link)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                                    <Edit2 className="w-4 h-4 text-primary" />
                                </button>
                                <button onClick={() => handleDelete(link._id)} disabled={deleteLoading === link._id} className="p-1.5 rounded-lg hover:bg-destructive/20 transition-colors disabled:opacity-50">
                                    {deleteLoading === link._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-destructive" />}
                                </button>
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
                                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Image</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Title</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Link</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Order</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                            ) : links.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center">
                                        <LinkIcon className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                                        <p className="text-sm text-muted-foreground">No social links found</p>
                                    </td>
                                </tr>
                            ) : (
                                links.map((link) => (
                                    <tr key={link._id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted">
                                                <img src={link.image} alt={link.title} className="w-full h-full object-cover" />
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm font-medium text-foreground">{link.title}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <a href={link.link} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1 max-w-[200px] truncate">
                                                {link.link}
                                                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                            </a>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={cn(
                                                'px-2 py-0.5 text-xs font-medium rounded-full',
                                                link.isActive ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground'
                                            )}>
                                                {link.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-muted-foreground">{link.order}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => handleToggleStatus(link._id)} disabled={toggleLoading === link._id} className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-50">
                                                    {toggleLoading === link._id ? <Loader2 className="w-4 h-4 animate-spin" /> : link.isActive ? <ToggleRight className="w-4 h-4 text-success" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                                                </button>
                                                <button onClick={() => handleOpenModal(link)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                                                    <Edit2 className="w-4 h-4 text-primary" />
                                                </button>
                                                <button onClick={() => handleDelete(link._id)} disabled={deleteLoading === link._id} className="p-1.5 rounded-lg hover:bg-destructive/20 transition-colors disabled:opacity-50">
                                                    {deleteLoading === link._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-destructive" />}
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
                <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3">
                    <p className="text-sm text-muted-foreground">
                        Showing {((page - 1) * 10) + 1}-{Math.min(page * 10, pagination.total)} of {pagination.total}
                    </p>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-50">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="px-3 py-1 text-sm font-medium">{page} / {pagination.pages}</span>
                        <button onClick={() => setPage(p => Math.min(pagination!.pages, p + 1))} disabled={page === pagination.pages} className="p-1.5 rounded-lg hover:bg-muted disabled:opacity-50">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={handleCloseModal}>
                    <div className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b border-border">
                            <h2 className="text-lg font-semibold text-foreground">
                                {editingLink ? 'Edit Social Link' : 'Add Social Link'}
                            </h2>
                            <button onClick={handleCloseModal} className="p-1.5 rounded-lg hover:bg-muted">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-4 space-y-4">
                            {/* Image Upload */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Image / Icon</label>
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                                >
                                    {uploadLoading ? (
                                        <div className="flex flex-col items-center gap-2 py-4">
                                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                            <span className="text-sm text-muted-foreground">Uploading...</span>
                                        </div>
                                    ) : imagePreview ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <img src={imagePreview} alt="Preview" className="w-16 h-16 rounded-lg object-cover" />
                                            <span className="text-xs text-muted-foreground">Click to change</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 py-4">
                                            <Upload className="w-8 h-8 text-muted-foreground" />
                                            <span className="text-sm text-muted-foreground">Upload image</span>
                                        </div>
                                    )}
                                </div>
                                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                            </div>

                            {/* Title */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Title</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="e.g. Instagram, YouTube, Facebook"
                                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                            </div>

                            {/* Link */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Link URL</label>
                                <input
                                    type="url"
                                    value={formData.link}
                                    onChange={(e) => setFormData(prev => ({ ...prev, link: e.target.value }))}
                                    placeholder="https://instagram.com/yourpage"
                                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                            </div>

                            {/* Order */}
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1.5">Display Order</label>
                                <input
                                    type="number"
                                    value={formData.order}
                                    onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                                    className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                            </div>

                            {/* Submit */}
                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={handleCloseModal} className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-medium hover:bg-muted/80">
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={formLoading || uploadLoading}
                                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {formLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {editingLink ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
