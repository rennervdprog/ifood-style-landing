export default function OrderCardSkeleton() {
  return (
    <div className="bg-card rounded-2xl overflow-hidden border border-border animate-pulse">
      <div className="h-8 bg-muted/60" />
      <div className="p-4 space-y-3">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <div className="h-5 bg-muted rounded-lg w-32" />
            <div className="h-3 bg-muted rounded w-24" />
          </div>
          <div className="space-y-2 items-end flex flex-col">
            <div className="h-6 bg-muted rounded-lg w-20" />
            <div className="h-3 bg-muted rounded w-12" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-8 bg-muted rounded-lg w-20" />
          <div className="h-8 bg-muted rounded-lg w-16" />
          <div className="h-8 bg-muted rounded-lg w-24" />
        </div>
        <div className="bg-muted/50 rounded-xl p-3 space-y-2">
          <div className="h-3 bg-muted rounded w-3/4" />
          <div className="h-3 bg-muted rounded w-1/2" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 bg-muted rounded-xl w-10" />
          <div className="h-10 bg-muted rounded-xl flex-1" />
        </div>
      </div>
    </div>
  );
}