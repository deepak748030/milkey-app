import { useEffect, useState } from 'react'
import { Search, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, X, Loader2, HelpCircle } from 'lucide-react'
import { cn } from '../lib/utils'
import { PageHeader, FilterCard, TableCard } from '../components/admin/PremiumShell'
import { getFaqsAdmin, createFaq, updateFaq, deleteFaq, AdminFaq } from '../lib/api'

export function FaqsPage() {
  const [faqs, setFaqs] = useState<AdminFaq[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<AdminFaq | null>(null)
  const [form, setForm] = useState({ question: '', answer: '', category: 'general', order: 0 })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [toggleId, setToggleId] = useState<string | null>(null)

  const fetch = async () => {
    setLoading(true)
    try {
      const res = await getFaqsAdmin()
      setFaqs(res.response || res.data || [])
    } catch {} finally { setLoading(false) }
  }
  useEffect(() => { fetch() }, [])

  const filtered = faqs.filter(f => !search || f.question.toLowerCase().includes(search.toLowerCase()) || f.answer.toLowerCase().includes(search.toLowerCase()))

  const openCreate = () => { setEditing(null); setForm({ question: '', answer: '', category: 'general', order: faqs.length }); setShowModal(true) }
  const openEdit = (f: AdminFaq) => { setEditing(f); setForm({ question: f.question, answer: f.answer, category: f.category || 'general', order: f.order || 0 }); setShowModal(true) }
  const close = () => { setShowModal(false); setEditing(null) }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.question.trim() || !form.answer.trim()) { alert('Question and answer required'); return }
    setSaving(true)
    try {
      if (editing) await updateFaq(editing._id, form as any)
      else await createFaq(form as any)
      close(); fetch()
    } catch (err: any) {
      console.error('FAQ save error', err)
      const msg = err?.response?.data?.message || err?.message || 'Save failed'
      alert(msg)
    } finally { setSaving(false) }
  }
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this FAQ?')) return
    setDeleteId(id)
    try { await deleteFaq(id); fetch() } finally { setDeleteId(null) }
  }
  const handleToggle = async (f: AdminFaq) => {
    setToggleId(f._id)
    try { await updateFaq(f._id, { isActive: !f.isActive } as any); fetch() } finally { setToggleId(null) }
  }

  return (
    <div className="space-y-5 animate-fade-in pb-6">
      <PageHeader overline="Content" title="FAQs" description="Manage home screen FAQs — visible to all users (old & new)" icon={HelpCircle}
        actions={<button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg shadow-sm text-sm font-semibold hover:bg-primary/90"><Plus className="w-4 h-4" />Add FAQ</button>} />

      <FilterCard>
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><input placeholder="Search FAQs..." value={search} onChange={e=>setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-input border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring" /></div>
      </FilterCard>

      {loading ? <div className="rounded-xl border bg-card p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      : filtered.length===0 ? <div className="rounded-xl border bg-card p-8 text-center shadow-soft"><HelpCircle className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" /><p className="text-sm text-muted-foreground">No FAQs found</p><p className="text-xs text-muted-foreground mt-1">Old users will see default FAQs until you add custom ones.</p></div>
      : (
        <>
          <div className="md:hidden space-y-3">
            {filtered.map(f=>(
              <div key={f._id} className="bg-card border rounded-lg p-4">
                <p className="text-sm font-semibold">{f.question}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{f.answer}</p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <span className={cn('px-2 py-0.5 text-xs rounded-full', f.isActive!==false?'bg-success/20 text-success':'bg-muted')}>{f.isActive!==false?'Active':'Hidden'}</span>
                  <div className="flex gap-1">
                    <button onClick={()=>handleToggle(f)} disabled={toggleId===f._id} className="p-2 rounded-lg hover:bg-muted">{toggleId===f._id ? <Loader2 className="w-4 h-4 animate-spin"/> : f.isActive!==false ? <ToggleRight className="w-4 h-4 text-success"/> : <ToggleLeft className="w-4 h-4"/>}</button>
                    <button onClick={()=>openEdit(f)} className="p-2 rounded-lg hover:bg-muted"><Edit2 className="w-4 h-4 text-primary"/></button>
                    <button onClick={()=>handleDelete(f._id)} disabled={deleteId===f._id} className="p-1.5 rounded-lg hover:bg-destructive/20">{deleteId===f._id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4 text-destructive"/>}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <TableCard>
            <div className="hidden md:block overflow-x-auto"><table className="w-full">
              <thead className="bg-muted/50"><tr className="border-b border-border"><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Question</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Answer</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th></tr></thead>
              <tbody className="divide-y divide-border/50">
                {filtered.map(f=>(
                  <tr key={f._id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium max-w-[280px] truncate">{f.question}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[320px] truncate">{f.answer}</td>
                    <td className="px-4 py-3"><span className={cn('px-2 py-1 text-xs rounded-full', f.isActive!==false?'bg-success/20 text-success':'bg-muted')}>{f.isActive!==false?'Active':'Hidden'}</span></td>
                    <td className="px-4 py-3"><div className="flex gap-1"><button onClick={()=>handleToggle(f)} disabled={toggleId===f._id} className="p-2 rounded-lg hover:bg-muted">{toggleId===f._id ? <Loader2 className="w-4 h-4 animate-spin"/> : f.isActive!==false ? <ToggleRight className="w-4 h-4 text-success"/> : <ToggleLeft className="w-4 h-4"/>}</button><button onClick={()=>openEdit(f)} className="p-2 rounded-lg hover:bg-muted"><Edit2 className="w-4 h-4 text-primary"/></button><button onClick={()=>handleDelete(f._id)} disabled={deleteId===f._id} className="p-1.5 rounded-lg hover:bg-destructive/20">{deleteId===f._id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Trash2 className="w-4 h-4 text-destructive"/>}</button></div></td>
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
            <div className="flex items-center justify-between p-4 border-b border-border"><h2 className="text-lg font-semibold">{editing?'Edit FAQ':'Add FAQ'}</h2><button onClick={close} className="p-2 rounded-lg hover:bg-muted"><X className="w-5 h-5"/></button></div>
            <form onSubmit={handleSave} className="p-4 space-y-4">
              <div><label className="text-sm font-medium">Question *</label><input value={form.question} onChange={e=>setForm({...form, question:e.target.value})} placeholder="e.g. How to add milk?" className="mt-1 w-full px-3 py-2.5 bg-input border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring" required/></div>
              <div><label className="text-sm font-medium">Answer *</label><textarea value={form.answer} onChange={e=>setForm({...form, answer:e.target.value})} placeholder="Answer..." rows={4} className="mt-1 w-full px-3 py-2.5 bg-input border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring" required/></div>
              <div className="grid grid-cols-2 gap-3"><div><label className="text-sm font-medium">Category</label><input value={form.category} onChange={e=>setForm({...form, category:e.target.value})} className="mt-1 w-full px-3 py-2.5 bg-input border border-input rounded-lg text-sm" placeholder="general"/></div><div><label className="text-sm font-medium">Order</label><input type="number" value={form.order} onChange={e=>setForm({...form, order: parseInt(e.target.value)||0})} className="mt-1 w-full px-3 py-2.5 bg-input border border-input rounded-lg text-sm"/></div></div>
              <div className="flex gap-3 pt-2"><button type="button" onClick={close} className="flex-1 px-4 py-2 bg-muted rounded-lg text-sm font-medium">Cancel</button><button type="submit" disabled={saving} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">{saving ? <><Loader2 className="w-4 h-4 animate-spin"/>Saving...</> : editing?'Update':'Create'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
