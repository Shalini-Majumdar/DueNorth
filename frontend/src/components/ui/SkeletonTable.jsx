export default function SkeletonTable({ rows = 5, cols = 6 }) {
  return (
    <div className="overflow-hidden rounded-xl border border-sage-200 bg-white">
      <div className="flex gap-4 border-b border-sage-200 bg-mint-50 p-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-3 flex-1 rounded bg-sage-200" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex animate-pulse gap-4 border-b border-sage-100 p-4">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-4 flex-1 rounded bg-sage-100" />
          ))}
        </div>
      ))}
    </div>
  );
}
