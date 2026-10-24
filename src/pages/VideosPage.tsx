import { useEffect, useState } from 'react'
import { Search, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, X, Loader2, Video, ExternalLink } from 'lucide-react'
import { cn } from '../lib/utils'
import { PageHeader, FilterCard, TableCard } from '../components/admin/PremiumShell'
import { getVideosAdmin, createVideo, updateVideo, deleteVideo, AdminVideo } from '../lib/api'

export function VideosPage() {
  const [videos, setVideos] = useState<AdminVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<AdminVideo | null>(null)
  const [form, setForm] = useState({ title: '', description: '', youtubeUrl: '', thumbnail: '', category: 'general', order: 0 })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [toggleId, setToggleId] = useState<string | null>(null)

  const fetch = async () => {
    setLoading(true)
    try {
      const res = await getVideosAdmin()
      setVideos(res.response || res.data || [])
    } catch {} finally { setLoading(false) }
  }
  useEffect(() => { fetch() }, [])

  const filtered = videos.filter(v => !search || v.title.toLowerCase().includes(search.toLowerCase()) || v.youtubeUrl.toLowerCase().includes(search.toLowerCase()))

  const openCreate = () => { setEditing(null); setForm({ title: '', description: '', youtubeUrl: '', thumbnail: '', category: 'general', order: videos.length }); setShowModal(true) }
  const openEdit = (v: AdminVideo) => { setEditing(v); setForm({ title: v.title, description: v.description||'', youtubeUrl: v.youtubeUrl, thumbnail: v.thumbnail||'', category: v.category||'general', order: v.order||0 }); setShowModal(true) }
  const close = () => { setShowModal(false); setEditing(null) }

  const getThumb = (url: string) => {
    try {
      const m = url.match(/(?:v=|\.be\/|embed\/)([a-zA-Z0-9_-]{11})/)
      return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : ''
    } catch { return '' }
  }
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.youtubeUrl.trim()) { alert('Title and YouTube URL required'); return }
    let payload: any = { ...form }
    if (!payload.thumbnail?.trim()) {
      const auto = getThumb(payload.youtubeUrl)
      if (auto) payload.thumbnail = auto
    }
    setSaving(true)
    try {
      if (editing) await updateVideo(editing._id, payload)
      else await createVideo(payload)
      close(); fetch()
    } catch (err: any) {
      console.error('Video save error', err)
      const msg = err?.response?.data?.message || err?.message || 'Save failed'
      alert(msg)
    } finally { setSaving(false) }
  }
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this video?')) return
    setDeleteId(id)
    try { await deleteVideo(id); fetch() } finally { setDeleteId(null) }
  }
  const handleToggle = async (v: AdminVideo) => {
    setToggleId(v._id)
    try { await updateVideo(v._id, { isActive: !v.isActive } as any); fetch() } finally { setToggleId(null) }
  }

  return (
    <div className="space-y-5 animate-fade-in pb-6">
      <PageHeader overline="Content" title="Video Tutorials" description="Manage home screen videos — shown to all users with YouTube links" icon={Video}
        actions={<button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg shadow-sm text-sm font-semibold hover:bg-primary/90"><Plus className="w-4 h-4" />Add Video</button>} />

      <FilterCard>
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><input placeholder="Search videos..." value={search} onChange={e=>setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-input border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring" /></div>
      </FilterCard>

      {loading ? <div className="rounded-xl border bg-card p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      : filtered.length===0 ? <div className="rounded-xl border bg-card p-8 text-center shadow-soft"><Video className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" /><p className="text-sm text-muted-foreground">No videos found</p><p className="text-xs text-muted-foreground mt-1">Old users will see default videos until you add custom ones.</p></div>
      : (
        <>
          <div className="md:hidden space-y-3">
            {filtered.map(v=>(
              <div key={v._id} className="bg-card border rounded-lg overflow-hidden">
                {v.thumbnail ? <img src={v.thumbnail} alt={v.title} className="w-full h-32 object-cover"/> : <div className="w-full h-32 bg-muted flex items-center justify-center"><Video className="w-8 h-8 text-muted-foreground"/></div>}
                <div className="p-4">
                  <p className="text-sm font-semibold line-clamp-2">{v.title}</p>
                  {v.youtubeUrl && <a href={v.youtubeUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-xs text-primary mt-1">YouTube <ExternalLink className="w-3 h-3"/></a>}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <span className={cn('px-2 py-0.5 text-xs rounded-full', v.isActive!==false?'bg-success/20 text-success':'bg-muted')}>{v.isActive!==false?'Active':'Hidden'}</span>
                    <div className="flex gap-1">
                      <button onClick={()=>handleToggle(v)} disabled={toggleId===v._id} className="p-2 rounded-lg hover:bg-muted">{toggleId===v._id ? <Loader2 className="w-4 h-4 animate-spin"/> : v.isActive!==false ? <ToggleRight className="w-4 h-4 text-success"/> : <ToggleLeft className="w-4 h-4"/>}</button>
                      <button onClick={()=>openEdit(v)} className="p-2 rounded-lg hover:bg-muted"><Edit2 className="w-4 h-4 text-primary"/></button>
                      <button onClick={()=>handleDelete(v._id)} disabled={deleteId===v._id} className="p-1.5 rounded-lg hover:bg-destructive/20">{deleteId===v._id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4 text-destructive"/>}</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <TableCard>
            <div className="hidden md:block overflow-x-auto"><table className="w-full">
              <thead className="bg-muted/50"><tr className="border-b border-border"><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Preview</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Title</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">YouTube</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th></tr></thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map(v=>(
                  <tr key={v._id} className="hover:bg-muted/30">
                    <td className="px-4 py-3"><div className="w-20 h-12 rounded-lg overflow-hidden bg-muted">{v.thumbnail ? <img src={v.thumbnail} alt={v.title} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center"><Video className="w-5 h-5"/></div>}</div></td>
                    <td className="px-4 py-3 text-sm font-medium max-w-[260px] truncate">{v.title}</td>
                    <td className="px-4 py-3"><a href={v.youtubeUrl} target="_blank" rel="noopener" className="text-xs text-primary flex items-center gap-1 truncate max-w-[200px]">YouTube <ExternalLink className="w-3 h-3"/></a></td>
                    <td className="px-4 py-3"><span className={cn('px-2 py-1 text-xs rounded-full', v.isActive!==false?'bg-success/20 text-success':'bg-muted')}>{v.isActive!==false?'Active':'Hidden'}</span></td>
                    <td className="px-4 py-3"><div className="flex gap-1"><button onClick={()=>handleToggle(v)} disabled={toggleId===v._id} className="p-2 rounded-lg hover:bg-muted">{toggleId===v._id ? <Loader2 className="w-4 h-4 animate-spin"/> : v.isActive!==false ? <ToggleRight className="w-4 h-4 text-success"/> : <ToggleLeft className="w-4 h-4"/>}</button><button onClick={()=>openEdit(v)} className="p-2 rounded-lg hover:bg-muted"><Edit2 className="w-4 h-4 text-primary"/></button><button onClick={()=>handleDelete(v._id)} disabled={deleteId===v._id} className="p-1.5 rounded-lg hover:bg-destructive/20">{deleteId===v._id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4 text-destructive"/>}</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </TableCard>
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl shadow-large w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border"><h2 className="text-lg font-semibold">{editing?'Edit Video':'Add Video'}</h2><button onClick={close} className="p-2 rounded-lg hover:bg-muted"><X className="w-5 h-5"/></button></div>
            <form onSubmit={handleSave} className="p-4 space-y-4">
              <div><label className="text-sm font-medium">Title *</label><input value={form.title} onChange={e=>setForm({...form, title:e.target.value})} placeholder="Video title" className="mt-1 w-full px-3 py-2.5 bg-input border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring" required/></div>
              <div><label className="text-sm font-medium">YouTube URL *</label><input value={form.youtubeUrl} onChange={e=>setForm({...form, youtubeUrl:e.target.value})} placeholder="https://youtube.com/watch?v=..." className="mt-1 w-full px-3 py-2.5 bg-input border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring" required/></div>
              <div><label className="text-sm font-medium">Thumbnail URL (auto from YouTube if empty)</label><input value={form.thumbnail} onChange={e=>setForm({...form, thumbnail:e.target.value})} placeholder="https://img.youtube.com/vi/.../mqdefault.jpg" className="mt-1 w-full px-3 py-2.5 bg-input border border-input rounded-lg text-sm" /></div>
              <div><label className="text-sm font-medium">Description</label><textarea value={form.description} onChange={e=>setForm({...form, description:e.target.value})} rows={3} className="mt-1 w-full px-3 py-2.5 bg-input border border-input rounded-lg text-sm" placeholder="Optional description"/></div>
              <div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-medium">Category</label><input value={form.category} onChange={e=>setForm({...form, category:e.target.value})} className="mt-1 w-full px-3 py-2.5 bg-input border border-input rounded-lg text-sm" placeholder="general"/></div><div><label className="text-sm font-medium">Order</label><input type="number" value={form.order} onChange={e=>setForm({...form, order: parseInt(e.target.value)||0})} className="mt-1 w-full px-3 py-2.5 bg-input border border-input rounded-lg text-sm"/></div></div>
              <div className="flex gap-3 pt-2"><button type="button" onClick={close} className="flex-1 px-4 py-2 bg-muted rounded-lg text-sm font-medium">Cancel</button><button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">{saving ? <><Loader2 className="w-4 h-4 animate-spin"/>Saving...</> : editing?'Update':'Create'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
