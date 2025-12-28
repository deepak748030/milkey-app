// File: src/components/TableSkeleton.tsx
import { cn } from '../lib/utils'

interface TableSkeletonProps {
    rows?: number
    columns?: number
    className?: string
}

export function TableSkeleton({ rows = 5, columns = 5, className }: TableSkeletonProps) {
    return (
        <div className={cn('overflow-hidden rounded-xl border border-border', className)}>
            <table className="w-full">
                <thead className="bg-muted/50">
                    <tr>
                        {Array.from({ length: columns }).map((_, i) => (
                            <th key={i} className="px-4 py-3 text-left">
                                <div className="h-4 w-20 skeleton rounded" />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {Array.from({ length: rows }).map((_, rowIdx) => (
                        <tr key={rowIdx} className="bg-card">
                            {Array.from({ length: columns }).map((_, colIdx) => (
                                <td key={colIdx} className="px-4 py-3">
                                    <div
                                        className="h-4 skeleton rounded"
                                        style={{ width: `${60 + Math.random() * 40}%` }}
                                    />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}