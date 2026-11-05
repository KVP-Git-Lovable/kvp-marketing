import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Navigation, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getCurrentLocation } from "@/utils/gpsRouteOptimizer";

interface RetailerWithCoords {
  id: string;
  retailerName: string;
  retailerLat?: number;
  retailerLng?: number;
}

interface StartBeatButtonProps {
  retailers: RetailerWithCoords[];
  className?: string;
}

export function StartBeatButton({ retailers, className }: StartBeatButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleStartBeat = async () => {
    // Filter retailers with valid coordinates
    const retailersWithCoords = retailers.filter(
      r => r.retailerLat != null && r.retailerLng != null
    );

    if (retailersWithCoords.length === 0) {
      toast.error("No retailers with GPS coordinates found");
      return;
    }

    setIsLoading(true);

    try {
      // Get current GPS location as origin
      const currentLocation = await getCurrentLocation();
      
      if (!currentLocation.latitude || !currentLocation.longitude) {
        toast.error("Could not get your current location");
        setIsLoading(false);
        return;
      }

      // Take first 5 retailers (or fewer if less available)
      const selectedRetailers = retailersWithCoords.slice(0, 5);
      
      // Build origin
      const origin = `${currentLocation.latitude},${currentLocation.longitude}`;
      
      // If only 1 retailer, use as destination with no waypoints
      if (selectedRetailers.length === 1) {
        const destination = `${selectedRetailers[0].retailerLat},${selectedRetailers[0].retailerLng}`;
        const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving&dir_action=navigate`;
        
        window.open(mapsUrl, '_blank', 'noreferrer,noopener');
        setIsLoading(false);
        return;
      }

      // For 2+ retailers: last one is destination, rest are waypoints
      const waypointRetailers = selectedRetailers.slice(0, -1);
      const destinationRetailer = selectedRetailers[selectedRetailers.length - 1];
      
      // Build waypoints string (pipe-separated)
      const waypoints = waypointRetailers
        .map(r => `${r.retailerLat},${r.retailerLng}`)
        .join('|');
      
      // Build destination
      const destination = `${destinationRetailer.retailerLat},${destinationRetailer.retailerLng}`;
      
      // Build Google Maps URL
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&waypoints=${encodeURIComponent(waypoints)}&travelmode=driving&dir_action=navigate`;
      
      // Open in new tab using clean break method
      const newWindow = window.open(mapsUrl, '_blank', 'noreferrer,noopener');
      if (newWindow) {
        newWindow.opener = null;
      }
      
      toast.success(`Routing to ${selectedRetailers.length} retailers`);
    } catch (error) {
      console.error("Error getting location:", error);
      toast.error("Could not get your location. Please enable GPS.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      className={className}
      onClick={handleStartBeat}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 size={14} className="mr-1.5 animate-spin" />
      ) : (
        <Navigation size={14} className="mr-1.5" />
      )}
      Start Beat
    </Button>
  );
}
