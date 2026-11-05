import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NearbyStoresPanel } from "./NearbyStoresPanel";

interface Retailer {
  id: string;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
}

interface NearbyStore {
  name: string;
  rating?: number;
  distance: number;
  address?: string;
  placeId: string;
}

interface DakshinaKannadaMapProps {
  retailers?: Retailer[];
  height?: string;
}

// Dakshina Kannada district center coordinates
const DAKSHINA_KANNADA_CENTER = { lat: 12.8698, lng: 74.8426 };
const DEFAULT_ZOOM = 10;

// Calculate distance between two coordinates in meters
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function DakshinaKannadaMap({ retailers = [], height = "350px" }: DakshinaKannadaMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRetailer, setSelectedRetailer] = useState<Retailer | null>(null);
  const [nearbyStores, setNearbyStores] = useState<NearbyStore[]>([]);
  const [isLoadingNearby, setIsLoadingNearby] = useState(false);
  
  const retailersWithCoords = retailers.filter(r => r.latitude && r.longitude);

  const searchNearbyStores = useCallback(async (retailer: Retailer) => {
    if (!retailer.latitude || !retailer.longitude) return;
    
    setSelectedRetailer(retailer);
    setIsLoadingNearby(true);
    setNearbyStores([]);

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    try {
      // Use Places API (New) Nearby Search
      const response = await fetch(
        `https://places.googleapis.com/v1/places:searchNearby`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'places.displayName,places.rating,places.formattedAddress,places.location,places.id'
          },
          body: JSON.stringify({
            includedTypes: ['supermarket', 'grocery_store'],
            maxResultCount: 5,
            locationRestriction: {
              circle: {
                center: {
                  latitude: retailer.latitude,
                  longitude: retailer.longitude
                },
                radius: 1000.0 // 1km radius
              }
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch nearby stores');
      }

      const data = await response.json();
      
      if (data.places && data.places.length > 0) {
        const stores: NearbyStore[] = data.places.map((place: any) => ({
          name: place.displayName?.text || 'Unknown Store',
          rating: place.rating,
          address: place.formattedAddress,
          placeId: place.id,
          distance: calculateDistance(
            retailer.latitude!,
            retailer.longitude!,
            place.location?.latitude || 0,
            place.location?.longitude || 0
          )
        }));

        // Sort by distance
        stores.sort((a, b) => a.distance - b.distance);
        setNearbyStores(stores);
      } else {
        setNearbyStores([]);
      }
    } catch (err) {
      console.error('Error fetching nearby stores:', err);
      setNearbyStores([]);
    } finally {
      setIsLoadingNearby(false);
    }
  }, []);

  const initializeMap = useCallback(() => {
    if (!mapRef.current || !window.google?.maps) return;

    try {
      // Create map
      const map = new google.maps.Map(mapRef.current, {
        center: DAKSHINA_KANNADA_CENTER,
        zoom: DEFAULT_ZOOM,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
      });

      mapInstanceRef.current = map;

      // Clear existing markers
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];

      // Add markers for retailers with coordinates
      const bounds = new google.maps.LatLngBounds();
      let hasMarkers = false;

      retailersWithCoords.forEach((retailer) => {
        if (retailer.latitude && retailer.longitude) {
          const position = { lat: retailer.latitude, lng: retailer.longitude };
          
          const marker = new google.maps.Marker({
            position,
            map,
            title: retailer.name,
          });

          // Add info window with retailer name and GPS coordinates
          const infoWindow = new google.maps.InfoWindow({
            content: `
              <div style="padding: 8px; max-width: 220px;">
                <h3 style="margin: 0 0 4px 0; font-weight: 600; font-size: 14px;">${retailer.name}</h3>
                <p style="margin: 0; font-size: 12px; color: #666;">
                  ${retailer.latitude?.toFixed(6)}, ${retailer.longitude?.toFixed(6)}
                </p>
              </div>
            `,
          });

          marker.addListener('click', () => {
            infoWindow.open(map, marker);
          });

          markersRef.current.push(marker);
          bounds.extend(position);
          hasMarkers = true;
        }
      });

      // Fit bounds if we have markers
      if (hasMarkers && retailersWithCoords.length > 1) {
        map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
      } else if (hasMarkers && retailersWithCoords.length === 1) {
        const center = bounds.getCenter() as unknown as { lat: () => number; lng: () => number };
        (map as unknown as { setCenter: (c: { lat: number; lng: number }) => void }).setCenter({ lat: center.lat(), lng: center.lng() });
        (map as unknown as { setZoom: (z: number) => void }).setZoom(14);
      }

      setIsLoading(false);
      setError(null);
    } catch (err) {
      console.error('Error initializing map:', err);
      setError('Failed to initialize map');
      setIsLoading(false);
    }
  }, [retailersWithCoords, searchNearbyStores]);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      setError('Google Maps API key not configured');
      setIsLoading(false);
      return;
    }

    // Check if Google Maps is already loaded
    if (window.google?.maps) {
      initializeMap();
      return;
    }

    // Load Google Maps script
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      existingScript.addEventListener('load', initializeMap);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      initializeMap();
    };
    
    script.onerror = () => {
      setError('Failed to load Google Maps');
      setIsLoading(false);
    };

    document.head.appendChild(script);

    return () => {
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];
    };
  }, [initializeMap]);

  // Update markers when retailers change
  useEffect(() => {
    if (mapInstanceRef.current && window.google?.maps) {
      initializeMap();
    }
  }, [retailers, initializeMap]);

  const openInGoogleMaps = () => {
    const url = `https://www.google.com/maps/@${DAKSHINA_KANNADA_CENTER.lat},${DAKSHINA_KANNADA_CENTER.lng},${DEFAULT_ZOOM}z`;
    window.open(url, '_blank');
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Retailer Map
          </CardTitle>
          <div className="flex items-center gap-2">
            {retailersWithCoords.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {retailersWithCoords.length} retailers
              </span>
            )}
            <Button variant="outline" size="sm" onClick={openInGoogleMaps}>
              <ExternalLink className="h-3 w-3 mr-1" />
              Open
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div 
          className="rounded-lg overflow-hidden border bg-muted relative"
          style={{ height }}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted z-10">
              <MapPin className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          )}
          <div ref={mapRef} className="w-full h-full" />
        </div>
        
        {/* Nearby Stores Panel */}
        {(selectedRetailer || isLoadingNearby) && (
          <NearbyStoresPanel
            stores={nearbyStores}
            retailerName={selectedRetailer?.name || ''}
            isLoading={isLoadingNearby}
          />
        )}
      </CardContent>
    </Card>
  );
}
