import { cn } from "../../lib/utils"

export function PageHeader({ overline, title, description, icon: Icon, actions }: { overline?: string; title: string; description?: string; icon?: any; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {overline && <div className="text-xs font-semibold tracking-widest uppercase text-primary">{overline}</div>}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2.5 mt-1">
          {Icon && <span className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0"><Icon className="w-4 h-4" /></span>}
          <span className="truncate">{title}</span>
        </h1>
        {description && <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>}
    </div>
  )
}

export function FilterCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border bg-card p-3 sm:p-4 shadow-soft", className)}>{children}</div>
}

export function TableCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border bg-card overflow-hidden shadow-soft", className)}>{children}</div>
}

export function MobileCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border bg-card p-4 shadow-soft", className)}>{children}</div>
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{children}</div>
}
