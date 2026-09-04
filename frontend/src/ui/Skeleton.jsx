import { cn } from "@/lib/utils";

export function Skeleton({ className }) {
  return <div className={cn("animate-pulse rounded bg-surface-overlay", className)} />;
}

export function SkeletonRows({ rows = 6, className }) {
  return (
    <div className={cn("divide-y divide-surface-line", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="ml-auto h-3.5 w-20" />
          <Skeleton className="h-3.5 w-10" />
          <Skeleton className="h-3.5 w-14" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonPanels({ count = 3, className, height = "h-24" }) {
  return (
    <div className={cn("grid gap-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn("rounded-xl", height)} />
      ))}
    </div>
  );
}
