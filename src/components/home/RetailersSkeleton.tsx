import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const RetailersSkeleton = () => {
  return (
    <div className="space-y-4 p-4 animate-fade-in">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>
        
        {/* Search and Filters Skeleton */}
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-10" />
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Skeleton className="h-9 w-24 shrink-0" />
          <Skeleton className="h-9 w-24 shrink-0" />
          <Skeleton className="h-9 w-24 shrink-0" />
          <Skeleton className="h-9 w-24 shrink-0" />
        </div>
      </div>

      {/* Retailer Cards Skeleton - Mobile */}
      <div className="md:hidden space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <Skeleton className="h-5 w-5 rounded shrink-0 mt-1" />
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-6 w-6 rounded" />
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-8 w-8" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Retailer Table Skeleton - Desktop */}
      <div className="hidden md:block">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-32" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="border rounded-lg overflow-hidden">
              {/* Table Header */}
              <div className="bg-muted/50 px-4 py-3 flex items-center gap-4">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48 flex-1" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
              
              {/* Table Rows */}
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="px-4 py-3 flex items-center gap-4 border-t">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-48 flex-1" />
                  <Skeleton className="h-4 w-24" />
                  <div className="flex gap-2">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pagination Skeleton */}
      <div className="flex justify-center gap-2 pt-2">
        <Skeleton className="h-9 w-9 rounded" />
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-9 rounded" />
      </div>
    </div>
  );
};
