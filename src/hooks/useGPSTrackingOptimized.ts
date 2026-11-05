import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface GPSPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: Date;
  speed?: number;
  heading?: number;
}

// In-flight request cache to prevent duplicate simultaneous requests
const inFlightRequests = new Map<string, Promise<GPSPosition[]>>();

// Parse GPS data from database format
const parseGPSData = (data: any[]): GPSPosition[] => {
  return data.map((d) => ({
    latitude: parseFloat(d.latitude as unknown as string),
    longitude: parseFloat(d.longitude as unknown as string),
    accuracy: d.accuracy ? parseFloat(d.accuracy as unknown as string) : 0,
    timestamp: new Date(d.timestamp),
    speed: d.speed ? parseFloat(d.speed as unknown as string) : undefined,
    heading: d.heading ? parseFloat(d.heading as unknown as string) : undefined,
  }));
};

// Fetch GPS positions with deduplication
const fetchGPSPositions = async (userId: string, dateStr: string): Promise<GPSPosition[]> => {
  const cacheKey = `${userId}-${dateStr}`;
  
  // Return existing in-flight request if one exists
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey)!;
  }
  
  const fetchPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('gps_tracking')
        .select('latitude, longitude, accuracy, timestamp, speed, heading')
        .eq('user_id', userId)
        .eq('date', dateStr)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('Error loading GPS data:', error);
        return [];
      }

      return parseGPSData(data || []);
    } finally {
      // Clean up in-flight request after completion
      setTimeout(() => inFlightRequests.delete(cacheKey), 100);
    }
  })();
  
  inFlightRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
};

export const useGPSTrackingOptimized = (userId: string | undefined, date: Date) => {
  const [isTracking, setIsTracking] = useState(false);
  const [localPositions, setLocalPositions] = useState<GPSPosition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const autoCheckIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();
  
  const dateStr = useMemo(() => date.toISOString().split('T')[0], [date]);

  // Use React Query for cached data fetching with deduplication
  const { data: savedPositions = [], isLoading, refetch } = useQuery({
    queryKey: ['gps-tracking', userId, dateStr],
    queryFn: () => fetchGPSPositions(userId!, dateStr),
    enabled: !!userId,
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Don't refetch on every mount - use cached data
  });

  // Combine saved positions with locally tracked positions
  const positions = useMemo(() => {
    const combined = [...savedPositions, ...localPositions];
    // Deduplicate by timestamp
    const seen = new Set<number>();
    return combined.filter(p => {
      const key = p.timestamp.getTime();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [savedPositions, localPositions]);

  // Check if current time is within working hours (9 AM - 7 PM IST)
  const isWithinWorkingHours = useCallback(() => {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    const hours = istTime.getUTCHours();
    return hours >= 9 && hours < 19;
  }, []);

  const startTracking = useCallback((isAutoStart = false) => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      toast.error('GPS not supported');
      return;
    }

    setIsTracking(true);
    setError(null);

    if (isAutoStart) {
      toast.success('🟢 GPS tracking started automatically (9 AM)', { duration: 5000 });
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const gpsData: GPSPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date(),
          speed: position.coords.speed || undefined,
          heading: position.coords.heading || undefined,
        };

        setLocalPositions((prev) => [...prev, gpsData]);

        // Save to database
        if (userId) {
          const { error: dbError } = await supabase.from('gps_tracking').insert({
            user_id: userId,
            latitude: gpsData.latitude,
            longitude: gpsData.longitude,
            accuracy: gpsData.accuracy,
            speed: gpsData.speed,
            heading: gpsData.heading,
            date: dateStr,
          });

          if (dbError) {
            console.error('Error saving GPS data:', dbError);
          }
        }
      },
      (err) => {
        console.error('GPS error:', err);
        setError(err.message);
        toast.error('GPS tracking error: ' + err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }, [userId, dateStr]);

  const stopTracking = useCallback((isAutoStop = false) => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
    
    if (isAutoStop) {
      toast.success('🔴 GPS tracking stopped automatically (7 PM)', { duration: 5000 });
    } else {
      toast.success('GPS tracking stopped');
    }
  }, []);

  // Auto-stop tracking after working hours
  useEffect(() => {
    const checkAndStopTracking = () => {
      if (!isWithinWorkingHours() && isTracking) {
        stopTracking(true);
      }
    };

    autoCheckIntervalRef.current = setInterval(checkAndStopTracking, 60000);

    return () => {
      if (autoCheckIntervalRef.current) {
        clearInterval(autoCheckIntervalRef.current);
      }
    };
  }, [isTracking, isWithinWorkingHours, stopTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (autoCheckIntervalRef.current) {
        clearInterval(autoCheckIntervalRef.current);
      }
    };
  }, []);

  // Function to load GPS positions for a specific date (with caching)
  const loadPositionsForDate = useCallback(async (targetDate: string): Promise<GPSPosition[]> => {
    if (!userId) return [];
    
    // Check if we already have cached data
    const cached = queryClient.getQueryData<GPSPosition[]>(['gps-tracking', userId, targetDate]);
    if (cached) return cached;
    
    // Fetch and cache
    const data = await fetchGPSPositions(userId, targetDate);
    queryClient.setQueryData(['gps-tracking', userId, targetDate], data);
    return data;
  }, [userId, queryClient]);

  return {
    isTracking,
    positions,
    error,
    isLoading,
    startTracking,
    stopTracking,
    loadSavedTracking: refetch,
    loadPositionsForDate,
    isWithinWorkingHours,
  };
};
