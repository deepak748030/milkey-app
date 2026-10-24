// File: src/components/Pagination.tsx — Premium BTN pagination (white/green)
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { cn } from '../lib/utils'

interface PaginationProps {
  page: number
  totalPages: number
  total?: number
  limit?: number
  onPageChange: (page: number) => void
  className?: string
}

export function Pagination({ page, totalPages, total, limit, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null
  const pages: (number | string)[] = []
  if (totalPages <= 5) for (let i = 1; i <= totalPages; i++) pages.push(i)
  else if (page <= 3) pages.push(1, 2, 3, 4, '...', totalPages)
  else if (page >= totalPages - 2) pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
  else pages.push(1, '...', page - 1, page, page + 1, '...', totalPages)

  const showInfo = total !== undefined && limit !== undefined

  return (
    <div className={cn('flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border bg-card px-3 py-2 shadow-sm', className)}>
      {showInfo ? (
        <p className="text-xs font-medium text-muted-foreground">
          {total === 0 ? 'No results' : `Showing ${(page - 1) * limit! + 1}–${Math.min(page * limit!, total!)} of ${total}`}
        </p>
      ) : <span />}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="First"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {pages.map((p, idx) =>
          typeof p === 'number' ? (
            <button
              key={idx}
              onClick={() => onPageChange(p)}
              className={cn(
                'min-w-8 h-8 px-2.5 rounded-lg text-xs font-bold border transition-all',
                page === p
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-card hover:bg-muted border-transparent hover:border-border text-foreground'
              )}
            >
              {p}
            </button>
          ) : (
            <span key={idx} className="px-1 text-xs font-bold text-muted-foreground">…</span>
          )
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Next"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Last"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
