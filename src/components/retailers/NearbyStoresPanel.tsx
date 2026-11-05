import { Store, MapPin, Star, Navigation } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NearbyStore {
  name: string;
  rating?: number;
  distance: number;
  address?: string;
  placeId: string;
}

interface NearbyStoresPanelProps {
  stores: NearbyStore[];
  retailerName: string;
  isLoading: boolean;
}

export function NearbyStoresPanel({ stores, retailerName, isLoading }: NearbyStoresPanelProps) {
  const formatDistance = (meters: number) => {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    }
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const openInGoogleMaps = (placeId: string) => {
    window.open(`https://www.google.com/maps/place/?q=place_id:${placeId}`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
        <div className="flex items-center gap-2 mb-3">
          <Store className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Finding nearby stores...</span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  if (stores.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 p-4 bg-muted/50 rounded-lg border">
      <div className="flex items-center gap-2 mb-3">
        <Store className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">
          Nearby Supermarkets & Grocery Stores
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Within 1km of <span className="font-medium text-foreground">{retailerName}</span>
      </p>
      
      <ScrollArea className="max-h-[200px]">
        <div className="space-y-2">
          {stores.map((store, index) => (
            <div
              key={store.placeId}
              className="flex items-start justify-between p-3 bg-background rounded-md border hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => openInGoogleMaps(store.placeId)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    #{index + 1}
                  </span>
                  <p className="text-sm font-medium truncate">{store.name}</p>
                </div>
                {store.address && (
                  <p className="text-xs text-muted-foreground truncate mt-1">
                    {store.address}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1.5">
                  {store.rating !== undefined && (
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                      <span className="text-xs">{store.rating.toFixed(1)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Navigation className="h-3 w-3" />
                    <span className="text-xs">{formatDistance(store.distance)}</span>
                  </div>
                </div>
              </div>
              <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
