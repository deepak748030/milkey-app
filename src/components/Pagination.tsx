// File: src/components/Pagination.tsx
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../lib/utils'

interface PaginationProps {
    page: number
    totalPages: number
    onPageChange: (page: number) => void
    className?: string
}

export function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
    if (totalPages <= 1) return null

    const pages: (number | string)[] = []
    const showPages = 5

    if (totalPages <= showPages) {
        for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
        if (page <= 3) {
            pages.push(1, 2, 3, 4, '...', totalPages)
        } else if (page >= totalPages - 2) {
            pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages)
        } else {
            pages.push(1, '...', page - 1, page, page + 1, '...', totalPages)
        }
    }

    return (
        <div className={cn('flex items-center justify-center gap-1', className)}>
            <button
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                <ChevronLeft className="w-4 h-4" />
            </button>

            {pages.map((p, idx) => (
                typeof p === 'number' ? (
                    <button
                        key={idx}
                        onClick={() => onPageChange(p)}
                        className={cn(
                            'min-w-[36px] h-9 px-3 rounded-lg text-sm font-medium transition-colors',
                            page === p
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted text-muted-foreground'
                        )}
                    >
                        {p}
                    </button>
                ) : (
                    <span key={idx} className="px-2 text-muted-foreground">...</span>
                )
            ))}

            <button
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                className="p-2 rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    )
}