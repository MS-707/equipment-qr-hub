export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded bg-mytra-card-hover animate-shimmer ${className}`}
      style={{ backgroundImage: 'linear-gradient(90deg, transparent 0%, var(--surface) 50%, transparent 100%)', backgroundSize: '200% 100%' }}
    />
  )
}

export function StatCardSkeleton() {
  return (
    <div className="bg-mytra-card border border-mytra-border rounded-lg p-4 shadow-card space-y-2">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-6 w-12" />
      <Skeleton className="h-3 w-16" />
    </div>
  )
}

export function RecordCardSkeleton() {
  return (
    <div className="bg-mytra-card border border-mytra-border rounded-lg px-3 py-3 shadow-card flex items-center gap-3">
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full shrink-0" />
    </div>
  )
}
