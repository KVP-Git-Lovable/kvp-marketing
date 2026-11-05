import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Haversine formula to calculate distance between two GPS points in kilometers
 */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate total GPS distance from an array of ordered GPS points
 */
export function calculateTotalDistance(
  points: { latitude: number; longitude: number }[]
): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dist = haversineDistance(
      points[i - 1].latitude, points[i - 1].longitude,
      points[i].latitude, points[i].longitude
    );
    // Filter out GPS jumps (> 10km between consecutive points is likely noise)
    if (dist < 10) {
      total += dist;
    }
  }
  return Math.round(total * 100) / 100; // Round to 2 decimal places
}

/**
 * Fetch GPS points for a user+date and calculate distance.
 * Caches the result in daily_gps_distance table.
 */
async function fetchAndCacheGPSDistance(userId: string, dateStr: string): Promise<{ totalKm: number; pointCount: number }> {
  // First check if we have a cached value
  const { data: cached } = await (supabase as any)
    .from('daily_gps_distance')
    .select('total_km, point_count, updated_at')
    .eq('user_id', userId)
    .eq('date', dateStr)
    .maybeSingle();

  // Fetch current GPS point count to see if cache is stale
  const { data: gpsPoints, error } = await supabase
    .from('gps_tracking')
    .select('latitude, longitude')
    .eq('user_id', userId)
    .eq('date', dateStr)
    .order('timestamp', { ascending: true });

  if (error || !gpsPoints?.length) {
    return { totalKm: cached?.total_km || 0, pointCount: cached?.point_count || 0 };
  }

  const currentPointCount = gpsPoints.length;

  // If cache exists and point count matches, return cached
  if (cached && cached.point_count === currentPointCount) {
    return { totalKm: Number(cached.total_km), pointCount: cached.point_count };
  }

  // Calculate distance from GPS points
  const points = gpsPoints.map((p: any) => ({
    latitude: parseFloat(p.latitude as unknown as string),
    longitude: parseFloat(p.longitude as unknown as string),
  }));

  const totalKm = calculateTotalDistance(points);

  // Upsert into cache
  await (supabase as any)
    .from('daily_gps_distance')
    .upsert(
      {
        user_id: userId,
        date: dateStr,
        total_km: totalKm,
        point_count: currentPointCount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,date' }
    );

  return { totalKm, pointCount: currentPointCount };
}

/**
 * Hook to get GPS distance for a specific user and date
 */
export const useGPSDistance = (userId: string | undefined, dateStr: string) => {
  return useQuery({
    queryKey: ['gps-distance', userId, dateStr],
    queryFn: () => fetchAndCacheGPSDistance(userId!, dateStr),
    enabled: !!userId && !!dateStr,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
  });
};

/**
 * Fetch GPS distances for a user for an entire month (batch)
 */
export async function fetchMonthlyGPSDistances(
  userId: string,
  startDate: string,
  endDate: string
): Promise<Map<string, number>> {
  // Get cached distances
  const { data: cached } = await (supabase as any)
    .from('daily_gps_distance')
    .select('date, total_km, point_count')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate);

  const distanceMap = new Map<string, number>();

  // Get GPS tracking data for the month
  const { data: gpsData } = await supabase
    .from('gps_tracking')
    .select('latitude, longitude, date')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('timestamp', { ascending: true });

  if (!gpsData?.length) {
    // Return cached values if no GPS data
    cached?.forEach((c: any) => distanceMap.set(c.date, Number(c.total_km)));
    return distanceMap;
  }

  // Group GPS points by date
  const pointsByDate = new Map<string, { latitude: number; longitude: number }[]>();
  gpsData.forEach((p: any) => {
    const date = p.date;
    if (!pointsByDate.has(date)) pointsByDate.set(date, []);
    pointsByDate.get(date)!.push({
      latitude: parseFloat(p.latitude as unknown as string),
      longitude: parseFloat(p.longitude as unknown as string),
    });
  });

  // Build cache map for quick lookup
  const cacheMap = new Map<string, { total_km: number; point_count: number }>();
  cached?.forEach((c: any) => cacheMap.set(c.date, { total_km: Number(c.total_km), point_count: c.point_count }));

  // Calculate distances and update cache where needed
  const upsertRows: any[] = [];

  for (const [date, points] of pointsByDate) {
    const cachedEntry = cacheMap.get(date);
    if (cachedEntry && cachedEntry.point_count === points.length) {
      distanceMap.set(date, cachedEntry.total_km);
    } else {
      const km = calculateTotalDistance(points);
      distanceMap.set(date, km);
      upsertRows.push({
        user_id: userId,
        date,
        total_km: km,
        point_count: points.length,
        updated_at: new Date().toISOString(),
      });
    }
  }

  // Also include cached dates that have no new GPS data
  cached?.forEach((c: any) => {
    if (!distanceMap.has(c.date)) {
      distanceMap.set(c.date, Number(c.total_km));
    }
  });

  // Batch upsert stale cache entries
  if (upsertRows.length > 0) {
    await (supabase as any)
      .from('daily_gps_distance')
      .upsert(upsertRows, { onConflict: 'user_id,date' });
  }

  return distanceMap;
}
