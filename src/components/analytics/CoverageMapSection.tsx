import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Store, Loader2, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface CoverageMapSectionProps {
  selectedUserIds: string[];
}

interface RetailerMapData {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

// India center coordinates
const INDIA_CENTER = { lat: 20.5937, lng: 78.9629 };
const DEFAULT_ZOOM = 5;
const BATCH_SIZE = 500;

// Fetch all retailers with pagination to bypass 1000-row limit
async function fetchAllRetailersWithCoordinates(): Promise<RetailerMapData[]> {
  const allRetailers: RetailerMapData[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('retailers')
      .select('id, name, latitude, longitude')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .range(from, from + BATCH_SIZE - 1);

    if (error) {
      console.error('Error fetching retailers batch:', error);
      break;
    }

    if (data && data.length > 0) {
      allRetailers.push(...(data as RetailerMapData[]));
      from += BATCH_SIZE;
      hasMore = data.length === BATCH_SIZE;
    } else {
      hasMore = false;
    }
  }

  console.log(`Fetched ${allRetailers.length} retailers with coordinates`);
  return allRetailers;
}

export function CoverageMapSection({ selectedUserIds }: CoverageMapSectionProps) {
  const navigate = useNavigate();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ retailers: 0, territories: 0 });

  // Geocode territory names to get coordinates
  const geocodeTerritory = useCallback(async (name: string): Promise<{ lat: number; lng: number } | null> => {
    if (!geocoderRef.current) return null;
    
    const searchQuery = `${name}, Karnataka, India`;
    
    return new Promise((resolve) => {
      geocoderRef.current!.geocode({ address: searchQuery }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const location = results[0].geometry.location;
          resolve({ lat: location.lat(), lng: location.lng() });
        } else {
          resolve(null);
        }
      });
    });
  }, []);

  const initializeMap = useCallback(async () => {
    if (!mapRef.current || !window.google?.maps) return;

    try {
      setIsLoading(true);

      // Fetch current user for authentication check
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('User not authenticated');
        setIsLoading(false);
        return;
      }

      // Fetch ALL retailers with coordinates using batch pagination
      const retailers = await fetchAllRetailersWithCoordinates();

      // Fetch territories (will geocode by name)
      const { data: territories } = await supabase
        .from('territories')
        .select('id, name, region');

      // Create map
      const map = new google.maps.Map(mapRef.current, {
        center: INDIA_CENTER,
        zoom: DEFAULT_ZOOM,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        zoomControl: true,
      });

      mapInstanceRef.current = map;
      geocoderRef.current = new google.maps.Geocoder();

      // Clear existing markers
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];

      const bounds = new google.maps.LatLngBounds();
      let hasMarkers = false;
      let geocodedTerritoriesCount = 0;

      // Add retailer markers (red pins)
      retailers?.forEach(retailer => {
        if (retailer.latitude && retailer.longitude) {
          const position = { lat: Number(retailer.latitude), lng: Number(retailer.longitude) };
          
          const marker = new google.maps.Marker({
            position,
            map,
            title: retailer.name,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 6,
              fillColor: '#ef4444', // Red for retailers
              fillOpacity: 0.8,
              strokeColor: '#b91c1c',
              strokeWeight: 1,
            },
          });

          // Simple info window with just the name
          const infoWindow = new google.maps.InfoWindow({
            content: `<div style="padding: 4px 8px; font-size: 12px;"><strong>${retailer.name}</strong></div>`,
          });

          marker.addListener('click', () => {
            infoWindow.open(map, marker);
          });

          markersRef.current.push(marker);
          bounds.extend(position);
          hasMarkers = true;
        }
      });

      // Add territory markers (blue pins) - geocode by name
      if (territories && territories.length > 0) {
        for (const territory of territories) {
          const position = await geocodeTerritory(territory.name);
          
          if (position) {
            geocodedTerritoriesCount++;
            
            const marker = new google.maps.Marker({
              position,
              map,
              title: territory.name,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: '#3b82f6', // Blue for territories
                fillOpacity: 1,
                strokeColor: '#1d4ed8',
                strokeWeight: 2,
              },
            });

            // Simple info window with just the name
            const infoWindow = new google.maps.InfoWindow({
              content: `<div style="padding: 4px 8px; font-size: 12px;"><strong>${territory.name}</strong><br/><span style="color: #666;">Territory</span></div>`,
            });

            marker.addListener('click', () => {
              infoWindow.open(map, marker);
            });

            markersRef.current.push(marker);
            bounds.extend(position);
            hasMarkers = true;
          }
        }
      }

      // Update stats
      setStats({
        retailers: retailers?.length || 0,
        territories: geocodedTerritoriesCount
      });

      // Fit bounds if we have markers
      if (hasMarkers) {
        map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
        // Don't zoom in too much - use setTimeout as fallback for addListenerOnce
        setTimeout(() => {
          const currentZoom = map.getZoom();
          if (currentZoom && currentZoom > 12) {
            map.setZoom(12);
          }
        }, 500);
      }

      setIsLoading(false);
      setError(null);
    } catch (err) {
      console.error('Error initializing coverage map:', err);
      setError('Failed to load coverage map');
      setIsLoading(false);
    }
  }, [selectedUserIds, geocodeTerritory]);

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

  // Update markers when selected users change
  useEffect(() => {
    if (mapInstanceRef.current && window.google?.maps) {
      initializeMap();
    }
  }, [selectedUserIds, initializeMap]);

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Coverage Map
          </CardTitle>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span className="text-muted-foreground">Retailers ({stats.retailers})</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-muted-foreground">Territories ({stats.territories})</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div 
          className="rounded-lg overflow-hidden border bg-muted relative"
          style={{ height: '400px' }}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Loading coverage data...</p>
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

        {/* Navigation Links */}
        <div className="flex items-center justify-center gap-4 mt-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/my-retailers')}
            className="gap-2"
          >
            <Store size={14} />
            All Retailers
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/territories-and-distributors')}
            className="gap-2"
          >
            <MapPin size={14} />
            Territories
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
