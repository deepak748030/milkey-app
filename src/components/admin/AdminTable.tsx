import { cn } from '../../lib/utils'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2, Image as ImageIcon } from 'lucide-react'

export function AdminTableShell({ title, subtitle, action, filters, children }: { title: string; subtitle?: string; action?: React.ReactNode; filters?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h1 className="text-xl font-bold">{title}</h1>{subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}</div>{action}</div>
      {filters && <div className="bg-card border rounded-lg p-3">{filters}</div>}
      {children}
    </div>
  )
}
export function AdminPagination({ pagination, page, setPage }: { pagination: any; page: number; setPage: (n: number) => void }) {
  if (!pagination || pagination.pages <= 1) return null
  const pages: (number | string)[] = []
  const tp = pagination.pages
  if (tp <= 5) for (let i = 1; i <= tp; i++) pages.push(i)
  else if (page <= 3) pages.push(1, 2, 3, 4, '...', tp)
  else if (page >= tp - 2) pages.push(1, '...', tp - 3, tp - 2, tp - 1, tp)
  else pages.push(1, '...', page - 1, page, page + 1, '...', tp)
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">Showing {(page - 1) * pagination.limit + 1} to {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}</p>
      <div className="flex items-center gap-1">
        <button onClick={() => setPage(1)} disabled={page === 1} className="h-8 w-8 inline-flex items-center justify-center rounded-lg border bg-card hover:bg-muted disabled:opacity-40 transition-colors" aria-label="First"><ChevronsLeft className="w-3.5 h-3.5" /></button>
        <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="h-8 w-8 inline-flex items-center justify-center rounded-lg border bg-card hover:bg-muted disabled:opacity-40 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
        {pages.map((n, i) =>
          typeof n === 'number' ? (
            <button key={i} onClick={() => setPage(n)} className={cn('min-w-8 h-8 px-2.5 rounded-lg text-xs font-bold border transition-all', page === n ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-card hover:bg-muted border-transparent hover:border-border')}>{n}</button>
          ) : (
            <span key={i} className="px-1 text-xs font-bold text-muted-foreground">…</span>
          )
        )}
        <button onClick={() => setPage(Math.min(pagination.pages, page + 1))} disabled={page === pagination.pages} className="h-8 w-8 inline-flex items-center justify-center rounded-lg border bg-card hover:bg-muted disabled:opacity-40 transition-colors"><ChevronRight className="w-4 h-4" /></button>
        <button onClick={() => setPage(pagination.pages)} disabled={page === pagination.pages} className="h-8 w-8 inline-flex items-center justify-center rounded-lg border bg-card hover:bg-muted disabled:opacity-40 transition-colors" aria-label="Last"><ChevronsRight className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  )
}
export function EmptyState({ icon: Icon = ImageIcon, text = 'No data found' }: { icon?: any; text?: string }) {
  return <div className="bg-card border rounded-lg p-8 text-center"><Icon className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" /><p className="text-sm text-muted-foreground">{text}</p></div>
}
export function SkeletonRow() {
  return <tr className="border-b border-border/50"><td className="px-4 py-3"><div className="skeleton h-16 w-28 rounded-lg" /></td><td className="px-4 py-3"><div className="skeleton h-4 w-32 rounded" /></td><td className="px-4 py-3"><div className="skeleton h-6 w-16 rounded-full" /></td><td className="px-4 py-3"><div className="skeleton h-4 w-20 rounded" /></td></tr>
}
export function MobileSkeleton() {
  return <div className="bg-card border rounded-lg p-4"><div className="flex gap-3"><div className="skeleton w-20 h-14 rounded-lg" /><div className="flex-1 space-y-2"><div className="skeleton h-4 w-32 rounded" /></div></div></div>
}
