import { useState, useRef } from 'react'
import { Search, Filter, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, X, ChevronLeft, ChevronRight, Loader2, Image as ImageIcon, GripVertical } from 'lucide-react'
import { cn } from '../lib/utils'
import { PageHeader, FilterCard, TableCard } from '../components/admin/PremiumShell'
import { getBannersAdmin, createBanner, updateBanner, deleteBanner, toggleBannerStatus, Banner } from '../lib/api'
import { useBanners } from '../hooks/useBanners'
import { BannerFormFields } from '../components/admin/BannerFormFields'

export interface BannerFormData { title: string; subtitle: string; image: string; badge: string; gradient: string[]; linkType: 'category'|'product'|'url'|'none'; linkValue: string; order: number }

export function BannersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all'|'active'|'inactive'>('all')
  const { banners, pagination, loading, fetchBanners } = useBanners(page, search, statusFilter)
  const [showModal, setShowModal] = useState(false)
  const [editingBanner, setEditingBanner] = useState<Banner|null>(null)
  const [formData, setFormData] = useState<BannerFormData>({ title:'', subtitle:'', image:'', badge:'', gradient:['#22C55E','#16A34A'], linkType:'none', linkValue:'', order:0 })
  const [formLoading, setFormLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState<string|null>(null)
  const [toggleLoading, setToggleLoading] = useState<string|null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [uploadLoading, setUploadLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const openModal = (b?: Banner) => {
    if (b) { setEditingBanner(b); setFormData({ title:b.title, subtitle:b.subtitle||'', image:b.image, badge:b.badge||'', gradient:b.gradient||['#22C55E','#16A34A'], linkType:(b.linkType as any)||'none', linkValue:b.linkValue||'', order:b.order||0 }); setImagePreview(b.image); }
    else { setEditingBanner(null); const max = banners.length? Math.max(...banners.map(x=>x.order||0)):-1; setFormData({ title:'', subtitle:'', image:'', badge:'', gradient:['#22C55E','#16A34A'], linkType:'none', linkValue:'', order:max+1 }); setImagePreview(''); }
    setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setEditingBanner(null); setFormData({ title:'', subtitle:'', image:'', badge:'', gradient:['#22C55E','#16A34A'], linkType:'none', linkValue:'', order:0 }); setImagePreview(''); }
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title.trim()) formData.title = `Banner ${Date.now()}`
    if (!formData.image) { alert('Image required'); return }
    setFormLoading(true)
    try { if (editingBanner) await updateBanner(editingBanner._id, formData as any); else await createBanner(formData as any); closeModal(); fetchBanners(); } catch { alert('save failed') } finally { setFormLoading(false) }
  }
  const handleDelete = async (id: string) => {
    if (!confirm('delete banner?')) return
    setDeleteLoading(id); try { await deleteBanner(id); fetchBanners(); } finally { setDeleteLoading(null) }
  }
  const handleToggle = async (id: string) => { setToggleLoading(id); try { await toggleBannerStatus(id); fetchBanners(); } finally { setToggleLoading(null) } }

  const SkeletonRow = () => (<tr className="border-b border-border/50"><td className="px-4 py-3"><div className="skeleton h-16 w-28 rounded-lg" /></td><td className="px-4 py-3"><div className="skeleton h-4 w-32 rounded" /></td><td className="px-4 py-3"><div className="skeleton h-6 w-16 rounded-full" /></td><td className="px-4 py-3"><div className="skeleton h-4 w-20 rounded" /></td><td className="px-4 py-3"><div className="skeleton h-6 w-16 rounded-full" /></td><td className="px-4 py-3"><div className="skeleton h-4 w-8 rounded" /></td><td className="px-4 py-3"><div className="skeleton h-8 w-24 rounded" /></td></tr>)

  return (
    <div className="space-y-5 animate-fade-in pb-6">
      <PageHeader overline="Marketing" title="Banners" description="Manage promotional banners (image-only, no text overlay)" icon={ImageIcon}
        actions={<button onClick={()=>openModal()} className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg shadow-sm text-sm font-semibold hover:bg-primary/90"><Plus className="w-4 h-4" />Add Banner</button>} />

      <FilterCard>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><input type="text" placeholder="Search banners..." value={search} onChange={e=>setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-input border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring" /></div>
          <div className="relative"><Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value as any)} className="pl-9 pr-8 py-2.5 bg-input border border-input rounded-lg text-sm min-w-[150px]"><option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
        </div>
      </FilterCard>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {loading ? Array.from({length:3}).map((_,i)=>(<div key={i} className="bg-card border rounded-lg p-4"><div className="flex gap-3"><div className="skeleton w-20 h-14 rounded-lg" /><div className="flex-1 space-y-2"><div className="skeleton h-4 w-32 rounded" /></div></div></div>))
        : banners.length===0 ? <div className="rounded-xl border bg-card p-8 text-center shadow-soft"><ImageIcon className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" /><p className="text-sm text-muted-foreground">No banners found</p></div>
        : banners.map(b=>(
          <div key={b._id} className="bg-card border rounded-lg p-4">
            <div className="flex gap-3">
              <div className="w-20 h-14 rounded-lg overflow-hidden flex-shrink-0" style={{ background: b.gradient ? `linear-gradient(135deg, ${b.gradient[0]}, ${b.gradient[1]})` : '#22C55E' }}>{b.image && <img src={b.image} alt={b.title} className="w-full h-full object-cover" />}</div>
              <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{b.title}</p><div className="flex items-center gap-2 mt-1.5"><span className={cn('px-2 py-0.5 text-xs rounded-full', b.isActive ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground')}>{b.isActive?'Active':'Inactive'}</span><span className="px-2 py-0.5 text-xs rounded-full bg-muted">Pos: {b.order+1}</span></div></div>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><GripVertical className="w-3.5 h-3.5" /><span>Order: {b.order}</span></div>
              <div className="flex gap-1">
                <button onClick={()=>handleToggle(b._id)} disabled={toggleLoading===b._id} className="p-2 rounded-lg hover:bg-muted border border-transparent hover:border-border hover:shadow-sm">{toggleLoading===b._id ? <Loader2 className="w-4 h-4 animate-spin" /> : b.isActive ? <ToggleRight className="w-4 h-4 text-success" /> : <ToggleLeft className="w-4 h-4" />}</button>
                <button onClick={()=>openModal(b)} className="p-2 rounded-lg hover:bg-muted border border-transparent hover:border-border hover:shadow-sm"><Edit2 className="w-4 h-4 text-primary" /></button>
                <button onClick={()=>handleDelete(b._id)} disabled={deleteLoading===b._id} className="p-1.5 rounded-lg hover:bg-destructive/20">{deleteLoading===b._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-destructive" />}</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table */}
      <TableCard>
        <div className="hidden md:block overflow-x-auto"><table className="w-full">
          <thead className="bg-muted/50"><tr className="border-b border-border"><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Preview</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Details</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Link</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Pos</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th></tr></thead>
          <tbody className="divide-y divide-border/50">
            {loading ? <><SkeletonRow /><SkeletonRow /><SkeletonRow /></> : banners.length===0 ? <tr><td colSpan={6} className="px-4 py-12 text-center"><ImageIcon className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" /><p className="text-sm text-muted-foreground">No banners found</p></td></tr>
            : banners.map(b=>(
              <tr key={b._id} className="hover:bg-muted/30">
                <td className="px-4 py-3"><div className="w-28 h-16 rounded-lg overflow-hidden" style={{ background: b.gradient ? `linear-gradient(135deg, ${b.gradient[0]}, ${b.gradient[1]})` : '#22C55E' }}>{b.image && <img src={b.image} alt={b.title} className="w-full h-full object-cover" />}</div></td>
                <td className="px-4 py-3"><span className="text-sm font-medium block">{b.title}</span><span className="text-xs text-muted-foreground">Pos {b.order+1}</span></td>
                <td className="px-4 py-3"><span className="text-sm capitalize">{b.linkType||'None'}</span></td>
                <td className="px-4 py-3"><span className={cn('px-2 py-1 text-xs rounded-full', b.isActive ? 'bg-success/20 text-success' : 'bg-muted')}>{b.isActive?'Active':'Inactive'}</span></td>
                <td className="px-4 py-3"><span className="w-8 h-8 flex items-center justify-center bg-primary/10 text-primary rounded-lg text-sm font-bold">{b.order+1}</span></td>
                <td className="px-4 py-3"><div className="flex gap-1"><button onClick={()=>handleToggle(b._id)} disabled={toggleLoading===b._id} className="p-2 rounded-lg hover:bg-muted border border-transparent hover:border-border hover:shadow-sm">{toggleLoading===b._id ? <Loader2 className="w-4 h-4 animate-spin" /> : b.isActive ? <ToggleRight className="w-4 h-4 text-success" /> : <ToggleLeft className="w-4 h-4" />}</button><button onClick={()=>openModal(b)} className="p-2 rounded-lg hover:bg-muted border border-transparent hover:border-border hover:shadow-sm"><Edit2 className="w-4 h-4 text-primary" /></button><button onClick={()=>handleDelete(b._id)} disabled={deleteLoading===b._id} className="p-1.5 rounded-lg hover:bg-destructive/20">{deleteLoading===b._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-destructive" />}</button></div></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </TableCard>

      {pagination && pagination.pages>1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1">
          <p className="text-xs text-muted-foreground">Showing {((page-1)*pagination.limit)+1} to {Math.min(page*pagination.limit, pagination.total)} of {pagination.total}</p>
          <div className="flex gap-1">
            <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="p-2 rounded-lg hover:bg-muted border border-transparent hover:border-border hover:shadow-sm disabled:opacity-50"><ChevronLeft className="w-4 h-4" /></button>
            {Array.from({length: Math.min(5, pagination.pages)}, (_,i)=>{ let n:number; if(pagination.pages<=5) n=i+1; else if(page<=3) n=i+1; else if(page>=pagination.pages-2) n=pagination.pages-4+i; else n=page-2+i; return <button key={n} onClick={()=>setPage(n)} className={cn('w-8 h-8 rounded-lg text-sm font-medium', page===n?'bg-primary text-primary-foreground':'hover:bg-muted')}>{n}</button>})}
            <button onClick={()=>setPage(p=>Math.min(pagination.pages,p+1))} disabled={page===pagination.pages} className="p-2 rounded-lg hover:bg-muted border border-transparent hover:border-border hover:shadow-sm disabled:opacity-50"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl shadow-large w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border"><h2 className="text-lg font-semibold tracking-tight">{editingBanner?'Edit Banner':'Add Banner'}</h2><button onClick={closeModal} className="p-2 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button></div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <BannerFormFields formData={formData} setFormData={setFormData} imagePreview={imagePreview} setImagePreview={setImagePreview} uploadLoading={uploadLoading} setUploadLoading={setUploadLoading} fileInputRef={fileInputRef} />
              <div className="flex gap-3 pt-2"><button type="button" onClick={closeModal} className="flex-1 px-4 py-2 bg-muted rounded-lg text-sm font-medium">Cancel</button><button type="submit" disabled={formLoading||uploadLoading} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg shadow-sm text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">{formLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : editingBanner ? 'Update Banner' : 'Create Banner'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
