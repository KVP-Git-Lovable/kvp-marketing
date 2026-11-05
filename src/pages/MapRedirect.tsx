import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function MapRedirect() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const placeId = params.get('placeId');
    if (placeId) {
      const mapUrl = `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${placeId}`;
      window.location.replace(mapUrl);
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background standalone-page">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Redirecting to Google Maps...</p>
      </div>
    </div>
  );
}
