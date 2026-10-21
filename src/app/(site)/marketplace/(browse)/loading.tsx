import { Skeleton } from '@/components/ui/primitives';

export default function MarketplaceLoading() {
  return (
    <div className="container-page flex flex-col gap-6 pb-20 pt-10" aria-busy="true" aria-label="Loading listings">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-10 w-full max-w-xl" />
      <Skeleton className="h-12 w-full" />
      <div className="grid gap-7 lg:grid-cols-[272px_1fr]">
        <Skeleton className="hidden h-[560px] lg:block" />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-lg border border-line bg-white p-0">
              <Skeleton className="aspect-[4/3] rounded-b-none" />
              <div className="flex flex-col gap-2.5 p-4">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-7 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
