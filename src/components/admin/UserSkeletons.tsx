import { cn } from "../../lib/utils"
export function UserSkeleton() {
  return (<tr className="border-b border-border"><td className="p-4"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-full skeleton" /><div className="space-y-2"><div className="h-4 w-32 skeleton rounded" /><div className="h-3 w-24 skeleton rounded" /></div></div></td><td className="p-4"><div className="h-4 w-40 skeleton rounded" /></td><td className="p-4"><div className="h-4 w-28 skeleton rounded" /></td><td className="p-4"><div className="h-4 w-20 skeleton rounded" /></td><td className="p-4"><div className="h-7 w-20 skeleton rounded-full" /></td><td className="p-4"><div className="h-4 w-24 skeleton rounded" /></td><td className="p-4"><div className="flex gap-2"><div className="h-10 w-10 skeleton rounded-lg" /><div className="h-10 w-10 skeleton rounded-lg" /><div className="h-10 w-10 skeleton rounded-lg" /></div></td></tr>)
}
export function MobileUserSkeleton() {
  return (<div className="bg-card border border-border rounded-lg p-4"><div className="flex items-center gap-3 mb-3"><div className="w-12 h-12 rounded-full skeleton" /><div className="flex-1"><div className="h-4 w-24 skeleton rounded mb-2" /><div className="h-3 w-32 skeleton rounded" /></div></div><div className="grid grid-cols-2 gap-2"><div className="h-8 skeleton rounded" /><div className="h-8 skeleton rounded" /></div></div>)
}
export function ExportMenuItem({ icon, label, hint, onClick }: { icon: React.ReactNode; label: string; hint?: string; onClick: () => void }) {
  return (<button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted transition-colors"><span className="flex-shrink-0">{icon}</span><span className="flex-1"><span className="block text-sm font-medium text-foreground">{label}</span>{hint && <span className="block text-xs text-muted-foreground">{hint}</span>}</span></button>)
}
export function StatChip({ label, value, tone }: { label: string; value: string | number; tone: 'primary' | 'success' | 'muted' }) {
  const toneClass = tone==='primary'?'bg-primary/10 text-primary': tone==='success'?'bg-success/10 text-success':'bg-muted text-foreground'
  return (<div className="bg-card border rounded-lg p-3"><p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{label}</p><span className={cn('inline-block px-2 py-0.5 rounded-md text-sm font-semibold capitalize', toneClass)}>{value}</span></div>)
}
