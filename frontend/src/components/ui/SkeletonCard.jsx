export default function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl bg-white p-6 shadow-sm border-t-[3px] border-sage-200">
      <div className="h-3 w-24 rounded bg-sage-100" />
      <div className="mt-4 h-8 w-32 rounded bg-sage-200" />
      <div className="mt-3 h-3 w-20 rounded bg-sage-100" />
    </div>
  );
}
