export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded bg-mytra-card-hover animate-shimmer ${className}`}
      style={{ backgroundImage: 'linear-gradient(90deg, transparent 0%, var(--surface) 50%, transparent 100%)', backgroundSize: '200% 100%' }}
    />
  )
}

export function SkeletonCard() {
  return (
    <div className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-3 w-2/3" />
    </div>
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

export function EquipmentCardSkeleton() {
  return (
    <div className="bg-mytra-card border border-mytra-border rounded-lg p-4 shadow-card space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>
    </div>
  )
}

export function RecordViewSkeleton() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
      </div>
      <div className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-3 shadow-card">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-5 w-48" />
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      </div>
      <div className="bg-mytra-card border border-mytra-border rounded-lg p-4 space-y-2 shadow-card">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  )
}
