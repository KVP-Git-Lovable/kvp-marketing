import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from './ui/button';
import { MapPin, Loader2, RefreshCw, Clock, Navigation, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { Card } from './ui/card';
import { Badge } from './ui/badge';

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface JourneyPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: Date;
}

interface CurrentLocationMapProps {
  height?: string;
  userId?: string;
  isViewingOther?: boolean;
  journeyPositions?: JourneyPosition[];
  journeyLoading?: boolean;
  attendanceCompleted?: boolean;
}

export const CurrentLocationMap: React.FC<CurrentLocationMapProps> = ({ 
  height = '500px', 
  userId,
  isViewingOther = false,
  journeyPositions = [],
  journeyLoading = false,
  attendanceCompleted = false,
}) => {
  const { user } = useAuth();
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const journeyLayerRef = useRef<L.LayerGroup | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const intervalTrackingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<number>(0); // timestamp of last saved point
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy?: number; timestamp?: Date } | null>(null);
  const [isAttendanceActive, setIsAttendanceActive] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [locationDeniedReason, setLocationDeniedReason] = useState<string>('');
  const isCurrentUser = userId === user?.id;

  // Check if attendance is active (checked in but not checked out)
  useEffect(() => {
    if (!user?.id || !isCurrentUser || isViewingOther) {
      setIsAttendanceActive(false);
      return;
    }

    const checkAttendanceStatus = async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('attendance')
        .select('check_in_time, check_out_time')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();

      if (!error && data?.check_in_time && !data?.check_out_time) {
        setIsAttendanceActive(true);
      } else {
        setIsAttendanceActive(false);
      }
    };

    checkAttendanceStatus();

    // Subscribe to attendance changes
    const channel = supabase
      .channel('attendance-tracking')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          checkAttendanceStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, isCurrentUser, isViewingOther]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map centered on India
    mapRef.current = L.map(mapContainerRef.current, {
      zoomControl: false
    }).setView([20.5937, 78.9629], 5);

    // Add zoom control to bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(mapRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (intervalTrackingRef.current) {
        clearInterval(intervalTrackingRef.current);
        intervalTrackingRef.current = null;
      }
    };
  }, []);

  // Draw journey route using OSRM for road-snapped path
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove previous journey layer
    if (journeyLayerRef.current) {
      journeyLayerRef.current.clearLayers();
      mapRef.current.removeLayer(journeyLayerRef.current);
      journeyLayerRef.current = null;
    }

    if (journeyPositions.length < 2) return;

    const layerGroup = L.layerGroup().addTo(mapRef.current);
    journeyLayerRef.current = layerGroup;

    // Add start marker (green)
    const startIcon = L.divIcon({
      className: 'journey-start',
      html: `<div style="width:14px;height:14px;background:#22c55e;border:2px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    L.marker([journeyPositions[0].latitude, journeyPositions[0].longitude], { icon: startIcon })
      .bindPopup(`<strong>Day Start</strong><br/>${format(journeyPositions[0].timestamp, 'hh:mm a')}`)
      .addTo(layerGroup);

    // Add end marker (red)
    const last = journeyPositions[journeyPositions.length - 1];
    const endIcon = L.divIcon({
      className: 'journey-end',
      html: `<div style="width:14px;height:14px;background:#ef4444;border:2px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    const endLabel = attendanceCompleted ? 'Day End' : 'Latest Position';
    L.marker([last.latitude, last.longitude], { icon: endIcon })
      .bindPopup(`<strong>${endLabel}</strong><br/>${format(last.timestamp, 'hh:mm a')}`)
      .addTo(layerGroup);

    // Sample waypoints for OSRM (max ~80 per batch to stay within limits)
    const sampleWaypoints = (positions: JourneyPosition[], maxPoints: number): JourneyPosition[] => {
      if (positions.length <= maxPoints) return positions;
      const step = (positions.length - 1) / (maxPoints - 1);
      const sampled: JourneyPosition[] = [];
      for (let i = 0; i < maxPoints - 1; i++) {
        sampled.push(positions[Math.round(i * step)]);
      }
      sampled.push(positions[positions.length - 1]); // always include last
      return sampled;
    };

    // Fetch OSRM road-snapped route
    const fetchRoute = async () => {
      try {
        const waypoints = sampleWaypoints(journeyPositions, 80);
        const coordinates = waypoints.map(p => [p.latitude, p.longitude]);

        const { data, error } = await supabase.functions.invoke('osrm-route', {
          body: { coordinates },
        });

        if (error || !data?.routes?.[0]?.geometry) {
          // Fallback to straight-line polyline if OSRM fails
          console.warn('OSRM route failed, using straight-line fallback:', error);
          const coords: L.LatLngExpression[] = journeyPositions.map(p => [p.latitude, p.longitude]);
          L.polyline(coords, { color: '#3b82f6', weight: 3, opacity: 0.7, dashArray: '8, 6' }).addTo(layerGroup);
        } else {
          // Draw road-snapped route from OSRM GeoJSON
          const routeCoords = data.routes[0].geometry.coordinates.map(
            ([lng, lat]: [number, number]) => [lat, lng] as L.LatLngExpression
          );
          L.polyline(routeCoords, { color: '#3b82f6', weight: 4, opacity: 0.8 }).addTo(layerGroup);
        }

        // Fit map to journey bounds
        const allCoords: L.LatLngExpression[] = journeyPositions.map(p => [p.latitude, p.longitude]);
        const bounds = L.latLngBounds(allCoords as L.LatLngTuple[]);
        if (mapRef.current) {
          mapRef.current.fitBounds(bounds, { padding: [50, 50] });
        }
      } catch (err) {
        console.error('Route fetch error:', err);
        // Fallback to straight-line
        const coords: L.LatLngExpression[] = journeyPositions.map(p => [p.latitude, p.longitude]);
        L.polyline(coords, { color: '#3b82f6', weight: 3, opacity: 0.7, dashArray: '8, 6' }).addTo(layerGroup);
        const bounds = L.latLngBounds(coords as L.LatLngTuple[]);
        if (mapRef.current) mapRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
    };

    fetchRoute();
  }, [journeyPositions, attendanceCompleted]);

  const updateMapMarker = useCallback((latitude: number, longitude: number, accuracy: number, timestamp: Date) => {
    if (!mapRef.current) return;

    if (markerRef.current) {
      markerRef.current.remove();
    }
    if (circleRef.current) {
      circleRef.current.remove();
    }

    // Custom pulsing marker icon
    const pulsingIcon = L.divIcon({
      className: 'custom-marker',
      html: `
        <div style="position: relative; width: 24px; height: 24px;">
          <div style="position: absolute; width: 24px; height: 24px; background: #3b82f6; border-radius: 50%; opacity: 0.3; animation: pulse 2s infinite;"></div>
          <div style="position: absolute; top: 4px; left: 4px; width: 16px; height: 16px; background: #3b82f6; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>
        </div>
        <style>
          @keyframes pulse {
            0% { transform: scale(1); opacity: 0.3; }
            50% { transform: scale(2); opacity: 0; }
            100% { transform: scale(1); opacity: 0.3; }
          }
        </style>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    markerRef.current = L.marker([latitude, longitude], { icon: pulsingIcon })
      .addTo(mapRef.current);

    mapRef.current.setView([latitude, longitude], 16);

    // Only show accuracy circle if accuracy is reasonable
    if (accuracy <= 150) {
      const displayRadius = Math.min(accuracy, 80);
      circleRef.current = L.circle([latitude, longitude], {
        radius: displayRadius,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.1,
        weight: 1,
      }).addTo(mapRef.current);
    }

    setLocation({ lat: latitude, lng: longitude, accuracy, timestamp });
  }, []);

  // Get live location from device (for current user)
  const getLiveLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }

    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const timestamp = new Date();
        updateMapMarker(latitude, longitude, accuracy, timestamp);
        setLoading(false);

        // Save to gps_tracking table
        if (user?.id) {
          const today = new Date().toISOString().split('T')[0];
          supabase.from('gps_tracking').insert([{
            user_id: user.id,
            latitude: latitude,
            longitude: longitude,
            accuracy: accuracy,
            timestamp: timestamp.toISOString(),
            date: today
          }]).then(({ error }) => {
            if (error) console.error('Error saving GPS data:', error);
          });
        }
      },
      (error) => {
        console.error('Error getting location:', error);
        setLoading(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationDenied(true);
            setLocationDeniedReason('Location permission denied. Please enable location access in your device settings.');
            toast.error('Location permission denied. Please enable location access.');
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationDenied(true);
            setLocationDeniedReason('User location is turned off. Please enable GPS/Location services on your device.');
            toast.error('Location information is unavailable.');
            break;
          case error.TIMEOUT:
            toast.error('Location request timed out. Retrying...');
            break;
          default:
            toast.error('An unknown error occurred while getting location.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }, [user?.id, updateMapMarker]);

  // Save a GPS point to database (with dedup by min interval)
  const saveGPSPoint = useCallback((latitude: number, longitude: number, accuracy: number) => {
    const now = Date.now();
    // Only save if at least 15 seconds since last save
    if (now - lastSavedRef.current < 14000) return;
    lastSavedRef.current = now;

    if (user?.id) {
      const today = new Date().toISOString().split('T')[0];
      supabase.from('gps_tracking').insert([{
        user_id: user.id,
        latitude,
        longitude,
        accuracy,
        timestamp: new Date().toISOString(),
        date: today
      }]).then(({ error }) => {
        if (error) console.error('Error saving GPS data:', error);
      });
    }
  }, [user?.id]);

  // Start watching live location + interval-based capture every 15s
  const startWatchingLocation = useCallback(() => {
    if (!navigator.geolocation || !isCurrentUser) return;

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    if (intervalTrackingRef.current) {
      clearInterval(intervalTrackingRef.current);
    }

    // watchPosition for real-time UI updates
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        updateMapMarker(latitude, longitude, accuracy, new Date());
        saveGPSPoint(latitude, longitude, accuracy);
      },
      (error) => {
        console.error('Watch position error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000
      }
    );

    // Interval-based capture every 15 seconds for continuous route data
    intervalTrackingRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          updateMapMarker(latitude, longitude, accuracy, new Date());
          saveGPSPoint(latitude, longitude, accuracy);
        },
        (error) => {
          console.error('Interval GPS error:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000
        }
      );
    }, 15000);
  }, [isCurrentUser, updateMapMarker, saveGPSPoint]);

  // Fetch location from database (for viewing other users)
  // IMPORTANT: Filter by today's date to avoid showing stale data from other cities
  const fetchUserLocation = useCallback(async () => {
    if (!userId) return;

    setLoading(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('gps_tracking')
        .select('*')
        .eq('user_id', userId)
        .eq('date', today)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching location:', error);
        setLoading(false);
        return;
      }

      if (data) {
        const latitude = parseFloat(data.latitude as unknown as string);
        const longitude = parseFloat(data.longitude as unknown as string);
        const accuracy = data.accuracy ? parseFloat(data.accuracy as unknown as string) : 50;
        const timestamp = new Date(data.timestamp);

        setLocationDenied(false);
        updateMapMarker(latitude, longitude, accuracy, timestamp);
      } else {
        // No data for today - user may not have started their day or location is off
        setLocationDenied(true);
        setLocationDeniedReason('No location data available for today. The user may not have started their day or their location is turned off.');
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching location:', error);
      setLoading(false);
    }
  }, [userId, updateMapMarker]);

  // Initial load and mode setup
  useEffect(() => {
    if (!userId || !mapRef.current) return;

    if (isCurrentUser && !isViewingOther) {
      // For current user, get live location from device
      getLiveLocation();
      if (isAttendanceActive) {
        startWatchingLocation();
      }
    } else {
      // For viewing other users, fetch from database
      fetchUserLocation();
    }
  }, [userId, isCurrentUser, isViewingOther, getLiveLocation, fetchUserLocation, isAttendanceActive, startWatchingLocation]);

  // Handle automatic GPS tracking based on attendance status
  useEffect(() => {
    if (!userId) return;

    if (isCurrentUser && !isViewingOther) {
      // For current user, use geolocation watch only when attendance is active
      if (isAttendanceActive) {
        startWatchingLocation();
      } else {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        if (intervalTrackingRef.current) {
          clearInterval(intervalTrackingRef.current);
          intervalTrackingRef.current = null;
        }
      }
    } else {
      // For other users, use polling
      refreshIntervalRef.current = setInterval(() => {
        fetchUserLocation();
      }, 15000);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      if (intervalTrackingRef.current) {
        clearInterval(intervalTrackingRef.current);
        intervalTrackingRef.current = null;
      }
    };
  }, [isAttendanceActive, userId, isCurrentUser, isViewingOther, startWatchingLocation, fetchUserLocation]);

  const handleManualRefresh = () => {
    if (isCurrentUser && !isViewingOther) {
      getLiveLocation();
    } else {
      fetchUserLocation();
    }
  };

  const getTimeDifference = (timestamp: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - timestamp.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  const isLocationFresh = (timestamp: Date) => {
    const now = new Date();
    const diffInMinutes = (now.getTime() - timestamp.getTime()) / (1000 * 60);
    return diffInMinutes < 5;
  };

  return (
    <div className="flex flex-col" style={{ height }}>
      {/* Fixed Location Info Card - Outside map container */}
      {location && (
        <Card className="bg-background border shadow-md mb-3 flex-shrink-0">
          <div className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Navigation className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="font-medium text-sm truncate">
                    {isCurrentUser && !isViewingOther ? 'Your Live Location' : 'Current Location'}
                  </span>
                  <Badge 
                    variant={location.timestamp && isLocationFresh(location.timestamp) ? "default" : "secondary"}
                    className={`text-xs ${location.timestamp && isLocationFresh(location.timestamp) ? 'bg-green-500' : 'bg-yellow-500'}`}
                  >
                    {location.timestamp && isLocationFresh(location.timestamp) ? 'Live' : 'Stale'}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p className="font-mono">{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</p>
                  {location.timestamp && (
                    <p className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {getTimeDifference(location.timestamp)} • {format(location.timestamp, 'hh:mm a')}
                    </p>
                  )}
                  {location.accuracy && (
                    <p className="text-muted-foreground/70">±{Math.round(location.accuracy)}m accuracy</p>
                  )}
                </div>
              </div>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 flex-shrink-0"
                onClick={handleManualRefresh}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Map Container */}
      <div className="relative rounded-lg overflow-hidden border shadow-sm flex-1 min-h-0">
        <div
          ref={mapContainerRef}
          className="absolute inset-0"
        />

        {/* Floating Status - Bottom Left */}
        {isCurrentUser && !isViewingOther && (
          <div className="absolute bottom-3 left-3 z-[1000]">
            <Card className="bg-background border shadow-md">
              <div className="p-2 flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${isAttendanceActive ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/50'}`} />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {isAttendanceActive ? 'Tracking Active' : 'Start day to track'}
                </span>
              </div>
            </Card>
          </div>
        )}

        {/* Location Denied / Turned Off Warning */}
        {locationDenied && !loading && userId && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-[1000]">
            <div className="text-center p-6 max-w-sm">
              <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">Location Unavailable</p>
              <p className="text-xs text-muted-foreground mb-4">
                {locationDeniedReason || 'User location is turned off.'}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleManualRefresh}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {isCurrentUser && !isViewingOther ? 'Retry Location' : 'Try Again'}
              </Button>
            </div>
          </div>
        )}

        {/* No Location State (no data and not denied) */}
        {!location && !loading && !locationDenied && userId && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-[1000]">
            <div className="text-center p-6">
              <MapPin className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No location data available</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={handleManualRefresh}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {isCurrentUser && !isViewingOther ? 'Get My Location' : 'Try Again'}
              </Button>
            </div>
          </div>
        )}

        {/* No User Selected State */}
        {!userId && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-[1000]">
            <div className="text-center p-6">
              <MapPin className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Select a team member to view location</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && !location && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-[1000]">
            <div className="text-center p-6">
              <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {isCurrentUser && !isViewingOther ? 'Getting your location...' : 'Fetching location...'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
