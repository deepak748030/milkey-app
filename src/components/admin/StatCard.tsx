import { cn } from '../../lib/utils'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

export function StatCard({ title, value, icon: Icon, color, prefix='', suffix='', trend, subValue, isLoading }: { title: string; value: any; icon: any; color: string; prefix?: string; suffix?: string; trend?: number; subValue?: string; isLoading?: boolean }) {
  if (isLoading) return <div className="bg-card border rounded-lg p-5"><div className="h-3 w-20 skeleton rounded" /><div className="h-7 w-16 skeleton rounded mt-3" /></div>
  const display = typeof value === 'number' ? value.toLocaleString('en-IN') : value
  return (
    <div className="bg-card border rounded-lg p-5 hover:shadow-lg hover:border-primary/30 transition-all">
      <div className="flex items-start justify-between">
        <div><p className="text-xs text-muted-foreground uppercase tracking-wide">{title}</p><p className="text-2xl font-bold mt-1">{prefix}{display}{suffix}</p>{subValue && <p className="text-xs text-muted-foreground mt-1">{subValue}</p>}{trend !== undefined && <div className={cn('flex items-center gap-1 mt-2 text-xs font-medium', trend>=0?'text-green-500':'text-red-500')}>{trend>=0?<ArrowUpRight className="w-3 h-3"/>:<ArrowDownRight className="w-3 h-3"/>}{Math.abs(trend)}% from last</div>}</div>
        <div className={cn('p-2.5 rounded-lg', color)}><Icon className="w-5 h-5" /></div>
      </div>
    </div>
  )
}
