import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Territory {
  id: string;
  name: string;
  region?: string;
  latitude?: number | null;
  longitude?: number | null;
  place_id?: string | null;
}

interface TerritoryMapProps {
  territories?: Territory[];
  height?: string;
}

// Karnataka center (covers Dakshina Kannada, Udupi region)
const KARNATAKA_CENTER = { lat: 13.3409, lng: 74.7421 };
const DEFAULT_ZOOM = 9;

export function TerritoryMap({ territories = [], height = "350px" }: TerritoryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const geocoderRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [geocodedTerritories, setGeocodedTerritories] = useState<Map<string, { lat: number; lng: number }>>(new Map());

  // Geocode territory names to get coordinates
  const geocodeTerritory = useCallback(async (name: string): Promise<{ lat: number; lng: number } | null> => {
    if (!geocoderRef.current) return null;
    
    // Add ", Karnataka, India" for better geocoding accuracy
    const searchQuery = `${name}, Karnataka, India`;
    
    return new Promise((resolve) => {
      geocoderRef.current!.geocode({ address: searchQuery }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const location = results[0].geometry.location;
          resolve({ lat: location.lat(), lng: location.lng() });
        } else {
          console.log(`Geocoding failed for ${name}: ${status}`);
          resolve(null);
        }
      });
    });
  }, []);

  const initializeMap = useCallback(async () => {
    if (!mapRef.current || !window.google?.maps) return;

    try {
      // Create map
      const map = new google.maps.Map(mapRef.current, {
        center: KARNATAKA_CENTER,
        zoom: DEFAULT_ZOOM,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
      });

      mapInstanceRef.current = map;
      geocoderRef.current = new (google.maps as any).Geocoder();

      // Clear existing markers
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];

      // Geocode and add markers for territories
      const bounds = new google.maps.LatLngBounds();
      let hasMarkers = false;
      const newGeocodedTerritories = new Map<string, { lat: number; lng: number }>();

      for (const territory of territories) {
        let position: { lat: number; lng: number } | null = null;

        // Use existing coordinates if available
        if (territory.latitude && territory.longitude) {
          position = { lat: territory.latitude, lng: territory.longitude };
        } else {
          // Geocode the territory name
          position = await geocodeTerritory(territory.name);
        }

        if (position) {
          newGeocodedTerritories.set(territory.id, position);

          // Create marker with custom icon
          const marker = new google.maps.Marker({
            position,
            map,
            title: territory.name,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#3b82f6',
              fillOpacity: 1,
              strokeColor: '#1d4ed8',
              strokeWeight: 2,
            },
          } as google.maps.MarkerOptions);

          // Add a separate label marker for territory name
          const labelMarker = new google.maps.Marker({
            position: { lat: position.lat + 0.01, lng: position.lng },
            map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 0,
            } as google.maps.Symbol,
          } as google.maps.MarkerOptions);

          // Add info window with Google Maps link using place_id if available
          const googleMapsUrl = territory.place_id 
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(territory.name)}&query_place_id=${territory.place_id}`
            : `https://www.google.com/maps/search/?api=1&query=${position.lat},${position.lng}`;
          
          const buttonId = `gmap-btn-${territory.id}`;
          const infoWindow = new google.maps.InfoWindow({
            content: `
              <div style="padding: 8px; max-width: 220px;">
                <h3 style="margin: 0 0 4px 0; font-weight: 600; font-size: 14px;">${territory.name}</h3>
                ${territory.region ? `<p style="margin: 0 0 8px 0; font-size: 12px; color: #666;">Region: ${territory.region}</p>` : ''}
                <button id="${buttonId}"
                   style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; background: #4285f4; color: white; border-radius: 4px; border: none; cursor: pointer; font-size: 12px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                  View in Google Maps
                </button>
              </div>
            `,
          });

          marker.addListener('click', () => {
            infoWindow.open(map, marker);
            
            // Use setTimeout to wait for InfoWindow DOM to be ready
            setTimeout(() => {
              const button = document.getElementById(buttonId);
              if (button) {
                button.onclick = () => {
                  // Clean break method to open Google Maps without referrer
                  const newWindow = window.open(googleMapsUrl, '_blank', 'noreferrer,noopener');
                  if (newWindow) {
                    newWindow.opener = null;
                  }
                };
              }
            }, 100);
          });

          markersRef.current.push(marker);
          markersRef.current.push(labelMarker);
          bounds.extend(position);
          hasMarkers = true;
        }
      }

      setGeocodedTerritories(newGeocodedTerritories);

      // Fit bounds if we have markers
      if (hasMarkers && territories.length > 1) {
        map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
      } else if (hasMarkers && territories.length === 1) {
        const firstTerritory = newGeocodedTerritories.values().next().value;
        if (firstTerritory) {
          map.setCenter(firstTerritory);
          map.setZoom(12);
        }
      }

      setIsLoading(false);
      setError(null);
    } catch (err) {
      console.error('Error initializing map:', err);
      setError('Failed to initialize map');
      setIsLoading(false);
    }
  }, [territories, geocodeTerritory]);

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

  // Update markers when territories change
  useEffect(() => {
    if (mapInstanceRef.current && window.google?.maps) {
      initializeMap();
    }
  }, [territories, initializeMap]);

  const openInGoogleMaps = () => {
    const url = `https://www.google.com/maps/@${KARNATAKA_CENTER.lat},${KARNATAKA_CENTER.lng},${DEFAULT_ZOOM}z`;
    window.open(url, '_blank');
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Territory Map
          </CardTitle>
          <div className="flex items-center gap-2">
            {territories.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {geocodedTerritories.size} of {territories.length} mapped
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
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Loading territories...</p>
              </div>
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
      </CardContent>
    </Card>
  );
}
