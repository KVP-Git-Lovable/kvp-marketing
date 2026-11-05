import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export const DashboardSkeleton = () => {
  return (
    <div className="space-y-4 p-4">
      {/* Check-in Banner Skeleton */}
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>

      {/* Beat Card Skeleton */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-10 w-full mt-2" />
        </CardContent>
      </Card>

      {/* Performance Stats Skeleton */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="p-3">
            <Skeleton className="h-8 w-full mb-2" />
            <Skeleton className="h-3 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <Skeleton className="h-8 w-full mb-2" />
            <Skeleton className="h-3 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <Skeleton className="h-8 w-full mb-2" />
            <Skeleton className="h-3 w-full" />
          </CardContent>
        </Card>
      </div>

      {/* Urgent Alerts Skeleton */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    </div>
  );
};
