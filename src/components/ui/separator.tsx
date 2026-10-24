export function Separator({ className="", orientation="horizontal" }: { className?: string; orientation?: "horizontal"|"vertical"}) {
  return <div className={`${orientation==="horizontal"?"h-px w-full":"w-px h-full"} bg-border ${className}`} />
}
