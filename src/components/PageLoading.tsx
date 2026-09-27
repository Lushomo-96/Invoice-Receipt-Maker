import {cn} from '../utils/helpers';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({className}: SkeletonProps) {
  return <span aria-hidden="true" className={cn('block animate-pulse rounded-xl bg-slate-200/75', className)} />;
}

export default function PageLoading() {
  return (
    <div className="mx-auto max-w-7xl" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading screen</span>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-52 max-w-[70vw]" />
        <Skeleton className="h-4 w-96 max-w-[88vw]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({length: 4}, (_, index) => (
          <div key={index} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft">
            <div className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 shrink-0" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-6 w-32 max-w-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.7fr)]">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-5 h-52 w-full" />
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-soft">
          <Skeleton className="h-5 w-32" />
          <div className="mt-5 space-y-3">
            {Array.from({length: 4}, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}
          </div>
        </div>
      </div>
    </div>
  );
}
