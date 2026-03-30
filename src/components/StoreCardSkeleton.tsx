const StoreCardSkeleton = () => (
  <div className="rounded-2xl bg-card shadow-sm border border-border overflow-hidden animate-pulse">
    <div className="h-32 bg-muted" />
    <div className="p-3 space-y-2">
      <div className="h-4 bg-muted rounded w-3/4" />
      <div className="h-3 bg-muted rounded w-1/2" />
    </div>
  </div>
);

export default StoreCardSkeleton;
