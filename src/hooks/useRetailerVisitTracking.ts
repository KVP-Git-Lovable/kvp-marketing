import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { offlineStorage, STORES } from '@/lib/offlineStorage';
import { getLocalTodayDate } from '@/utils/dateUtils';
import { Preferences } from '@capacitor/preferences';

interface VisitLog {
  id: string;
  retailer_id: string;
  user_id?: string;
  start_time: string;
  end_time: string | null;
  time_spent_seconds: number | null;
  distance_meters: number | null;
  location_status: 'at_store' | 'within_range' | 'not_at_store' | 'location_unavailable';
  action_type: string;
  is_phone_order?: boolean;
  visit_date?: string;
}

interface UseRetailerVisitTrackingProps {
  retailerId: string;
  retailerLat?: number;
  retailerLng?: number;
  visitId?: string;
  userId: string;
  selectedDate?: string;
}

// Haversine formula to calculate distance between two coordinates in meters
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getLocationStatus = (distance: number | null): 'at_store' | 'within_range' | 'not_at_store' | 'location_unavailable' => {
  if (distance === null) return 'location_unavailable';
  if (distance <= 15) return 'at_store';
  if (distance <= 50) return 'within_range';
  return 'not_at_store';
};

// Get GPS with timeout (non-blocking, max 5s)
const getGPSWithTimeout = async (timeoutMs: number = 5000): Promise<{ lat: number; lng: number; distance: number | null; status: 'at_store' | 'within_range' | 'not_at_store' | 'location_unavailable' } | null> => {
  if (!navigator.geolocation) return null;
  
  try {
    const position = await Promise.race([
      new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: timeoutMs,
          maximumAge: 60000 // Allow cached position up to 1 minute
        });
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('GPS timeout')), timeoutMs)
      )
    ]);
    
    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      distance: null,
      status: 'location_unavailable'
    };
  } catch (error) {
    console.log('📍 GPS timeout or error:', error);
    return null;
  }
};

// Global in-memory cache for last activity time per retailer
const lastActivityTimeByRetailer: Map<string, string> = new Map();

// Persistence key prefix for last activity times
const LAST_ACTIVITY_KEY_PREFIX = 'lastActivity_';

// Save last activity time to both memory and persistent storage
const saveLastActivityTime = async (retailerId: string, date: string, time: string): Promise<void> => {
  const key = `${LAST_ACTIVITY_KEY_PREFIX}${retailerId}_${date}`;
  lastActivityTimeByRetailer.set(`${retailerId}_${date}`, time);
  try {
    await Preferences.set({ key, value: time });
  } catch (e) {
    // Non-critical, continue
  }
};

// Load last activity time from persistent storage (on demand)
const loadLastActivityTime = async (retailerId: string, date: string): Promise<string | null> => {
  // Check memory first
  const memoryKey = `${retailerId}_${date}`;
  const memoryValue = lastActivityTimeByRetailer.get(memoryKey);
  if (memoryValue) return memoryValue;
  
  // Check persistent storage
  try {
    const { value } = await Preferences.get({ key: `${LAST_ACTIVITY_KEY_PREFIX}${retailerId}_${date}` });
    if (value) {
      lastActivityTimeByRetailer.set(memoryKey, value);
      return value;
    }
  } catch (e) {
    // Non-critical
  }
  return null;
};

export const useRetailerVisitTracking = ({
  retailerId,
  retailerLat,
  retailerLng,
  visitId,
  userId,
  selectedDate
}: UseRetailerVisitTrackingProps) => {
  const [currentLog, setCurrentLog] = useState<VisitLog | null>(null);
  const [locationStatus, setLocationStatus] = useState<'at_store' | 'within_range' | 'not_at_store' | 'location_unavailable'>('location_unavailable');
  const [timeSpent, setTimeSpent] = useState<number>(0); // in seconds
  const [distance, setDistance] = useState<number | null>(null);
  const currentLogIdRef = useRef<string | null>(null);
  const lastCheckedCoordsRef = useRef<string>('');

  // Calculate location status when retailer has coordinates
  useEffect(() => {
    const checkLocationOnMount = async () => {
      // Skip if no retailer coordinates
      if (!retailerLat || !retailerLng) {
        console.log('📍 No retailer coordinates available:', { retailerLat, retailerLng });
        setLocationStatus('location_unavailable');
        return;
      }
      
      // Create a key to track if we've already checked these exact coordinates
      const coordsKey = `${retailerLat}-${retailerLng}`;
      if (lastCheckedCoordsRef.current === coordsKey && distance !== null) {
        console.log('📍 Already checked these coordinates successfully, skipping');
        return;
      }
      
      console.log('📍 Starting location check for retailer:', { retailerLat, retailerLng, coordsKey });
      
      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 60000 // Allow cached position up to 1 minute
            });
          });

          const userLat = position.coords.latitude;
          const userLng = position.coords.longitude;
          const calculatedDistance = calculateDistance(userLat, userLng, retailerLat, retailerLng);
          const status = getLocationStatus(calculatedDistance);
          
          console.log('📍 Location check complete:', { 
            userLat, 
            userLng, 
            retailerLat, 
            retailerLng, 
            calculatedDistance: Math.round(calculatedDistance), 
            status 
          });
          
          setDistance(calculatedDistance);
          setLocationStatus(status);
          lastCheckedCoordsRef.current = coordsKey;
        } catch (error: any) {
          console.error('📍 GPS error on mount:', error.message || error);
          setLocationStatus('location_unavailable');
          // Don't set lastCheckedCoordsRef on error - allow retry when coordinates change
        }
      } else {
        console.error('📍 Geolocation not supported');
        setLocationStatus('location_unavailable');
      }
    };

    checkLocationOnMount();
  }, [retailerLat, retailerLng, distance]);

  // Format time spent for display
  const formatTimeSpent = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }, []);

  // Helper to check if ID is locally-generated
  const isLocalId = (id: string): boolean => {
    return id.startsWith('offline_') || id.startsWith('local_') || id.startsWith('temp_');
  };

  // Helper to restore state from a log
  const restoreStateFromLog = (log: VisitLog) => {
    setCurrentLog(log);
    currentLogIdRef.current = log.id;
    
    // Restore distance and location status
    if (log.distance_meters !== null) {
      setDistance(log.distance_meters);
    }
    if (log.location_status) {
      setLocationStatus(log.location_status as 'at_store' | 'within_range' | 'not_at_store' | 'location_unavailable');
    } else {
      setLocationStatus('location_unavailable');
    }

    // Use stored time_spent_seconds directly (static, not live calculation)
    // Time spent = end_time - start_time, only updated when actions occur
    setTimeSpent(log.time_spent_seconds || 0);
  };

  // Load existing log for today - OFFLINE FIRST
  useEffect(() => {
    const loadTodayLog = async () => {
      const targetDate = selectedDate || getLocalTodayDate();
      
      // 1. INSTANT: Try offline storage first
      try {
        const allLocalLogs = await offlineStorage.getAll<VisitLog>(STORES.RETAILER_VISIT_LOGS);
        const localLog = allLocalLogs
          .filter(log => 
            log.retailer_id === retailerId && 
            log.user_id === userId && 
            log.visit_date === targetDate
          )
          .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())[0];
        
        if (localLog) {
          console.log('📍 Loaded visit log from local storage:', localLog.id);
          restoreStateFromLog(localLog);
        }
      } catch (err) {
        console.log('📍 Local log load failed (non-critical):', err);
      }
      
      // 2. BACKGROUND: Sync from network (don't block UI)
      if (navigator.onLine) {
        try {
          const { data, error } = await supabase
            .from('retailer_visit_logs')
            .select('*')
            .eq('user_id', userId)
            .eq('retailer_id', retailerId)
            .eq('visit_date', targetDate)
            .order('start_time', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (!error && data) {
            const networkLog = data as VisitLog;
            
            // Save to local storage for offline access
            await offlineStorage.save(STORES.RETAILER_VISIT_LOGS, networkLog);
            
            // Update state if network log is newer or local log is missing
            const currentLogTime = currentLogIdRef.current ? 
              (await offlineStorage.getById<VisitLog>(STORES.RETAILER_VISIT_LOGS, currentLogIdRef.current))?.start_time : null;
            
            if (!currentLogTime || new Date(networkLog.start_time) >= new Date(currentLogTime)) {
              restoreStateFromLog(networkLog);
              console.log('📍 Updated from network log:', networkLog.id);
            }
          }
        } catch (networkErr) {
          console.log('📍 Network log fetch failed (non-critical):', networkErr);
        }
      }
    };

    if (userId && retailerId) {
      loadTodayLog();
    }
  }, [userId, retailerId, selectedDate]);

  // Time spent is calculated ONLY when actions occur (not a live timer)
  // The timeSpent state is updated directly in recordAction() and restoreStateFromLog()
  // No interval timer needed - time spent = static difference between start_time and end_time

  // Update last activity time for current retailer (call this on any user interaction)
  const updateLastActivity = useCallback(() => {
    if (retailerId) {
      const now = new Date().toISOString();
      lastActivityTimeByRetailer.set(retailerId, now);
      console.log('📍 Updated last activity time for retailer:', retailerId, now);
    }
  }, [retailerId]);

  // Start tracking when action is performed
  const startTracking = useCallback(async (
    actionType: 'order' | 'feedback' | 'ai' | 'phone_order',
    isPhoneOrder: boolean = false
  ) => {
    const targetDate = selectedDate || new Date().toISOString().split('T')[0];
    const isOffline = !navigator.onLine;
    const currentTime = new Date().toISOString();

    // Update last activity time for this retailer immediately (both memory and persistent)
    saveLastActivityTime(retailerId, targetDate, currentTime);

    // Get current GPS location (works offline)
    let userLat: number | undefined;
    let userLng: number | undefined;
    let calculatedDistance: number | null = null;
    let status: 'at_store' | 'within_range' | 'not_at_store' | 'location_unavailable' = 'location_unavailable';

    if (navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          });
        });

        userLat = position.coords.latitude;
        userLng = position.coords.longitude;

        console.log('📍 User location captured:', { userLat, userLng, isOffline });
        console.log('📍 Retailer location:', { retailerLat, retailerLng });

        // AUTO-CAPTURE: If retailer doesn't have GPS, save user's current location as retailer's location
        if ((!retailerLat || !retailerLng) && userLat && userLng && !isOffline) {
          console.log('📍 Auto-capturing retailer GPS on first visit...');
          try {
            const { error: updateError } = await supabase
              .from('retailers')
              .update({
                latitude: userLat,
                longitude: userLng,
                updated_at: new Date().toISOString()
              })
              .eq('id', retailerId);
            
            if (!updateError) {
              console.log('📍 ✅ Retailer GPS auto-captured successfully:', { userLat, userLng });
              // Status is now "at_store" since we just set the location
              status = 'at_store';
              calculatedDistance = 0;
              setDistance(0);
              setLocationStatus('at_store');
            } else {
              console.error('📍 ❌ Failed to auto-capture retailer GPS:', updateError);
            }
          } catch (autoSaveError) {
            console.error('📍 ❌ Error auto-capturing retailer GPS:', autoSaveError);
          }
        }
        // Calculate distance if retailer coordinates are available
        else if (retailerLat !== undefined && retailerLng !== undefined && retailerLat !== null && retailerLng !== null) {
          calculatedDistance = calculateDistance(userLat, userLng, retailerLat, retailerLng);
          status = getLocationStatus(calculatedDistance);
          setDistance(calculatedDistance);
          setLocationStatus(status);
          console.log('📍 Location tracking:', { calculatedDistance, status });
        } else {
          console.warn('📍 Retailer coordinates not available and offline - cannot auto-capture');
          status = 'location_unavailable';
        }
      } catch (error) {
        console.error('📍 GPS error:', error);
        status = 'location_unavailable';
      }
    }

    const startTime = currentTime;
    const logId = `offline_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const logData = {
      id: logId,
      user_id: userId,
      retailer_id: retailerId,
      visit_id: visitId || null,
      start_time: startTime,
      end_time: startTime, // Set end_time same as start_time initially (updated on each activity)
      start_latitude: userLat || null,
      start_longitude: userLng || null,
      distance_meters: calculatedDistance,
      location_status: status,
      action_type: actionType,
      is_phone_order: isPhoneOrder,
      visit_date: targetDate,
      time_spent_seconds: 0
    };

    if (isOffline) {
      // Store in IndexedDB when offline
      console.log('📍 Storing visit log offline:', logData);
      try {
        await offlineStorage.save(STORES.RETAILER_VISIT_LOGS, logData);
        
        // Add to sync queue for later syncing
        await offlineStorage.addToSyncQueue('CREATE_VISIT_LOG', logData);
        
        setCurrentLog(logData as VisitLog);
        currentLogIdRef.current = logId;
        setTimeSpent(0);
        
        console.log('✅ Visit log stored offline successfully');
      } catch (error) {
        console.error('❌ Failed to store visit log offline:', error);
      }
    } else {
      // Store in Supabase when online
      try {
        // First, end any previous active log for different retailer using their LAST activity time
        const { data: previousActiveLogs } = await supabase
          .from('retailer_visit_logs')
          .select('*')
          .eq('user_id', userId)
          .eq('visit_date', targetDate)
          .is('end_time', null)
          .neq('retailer_id', retailerId);

        if (previousActiveLogs && previousActiveLogs.length > 0) {
          for (const log of previousActiveLogs) {
            // Use stored last activity time for this retailer (check persistent storage), or current time as fallback
            const lastActivityTime = await loadLastActivityTime(log.retailer_id, targetDate) || 
                                     lastActivityTimeByRetailer.get(log.retailer_id) || 
                                     currentTime;
            const startTimeMs = new Date(log.start_time).getTime();
            const endTimeMs = new Date(lastActivityTime).getTime();
            const timeSpentSeconds = Math.max(0, Math.floor((endTimeMs - startTimeMs) / 1000));

            console.log('📍 Ending previous retailer log:', {
              retailerId: log.retailer_id,
              startTime: log.start_time,
              endTime: lastActivityTime,
              timeSpentSeconds
            });

            await supabase
              .from('retailer_visit_logs')
              .update({
                end_time: lastActivityTime,
                time_spent_seconds: timeSpentSeconds
              })
              .eq('id', log.id);
            
            // Clear the stored activity time for that retailer (both memory and persistent)
            lastActivityTimeByRetailer.delete(log.retailer_id);
            try {
              await Preferences.remove({ key: `${LAST_ACTIVITY_KEY_PREFIX}${log.retailer_id}_${targetDate}` });
            } catch (e) {
              // Non-critical
            }
          }
        }

        // If already tracking for this retailer today, just update last activity time
        if (currentLogIdRef.current && !isLocalId(currentLogIdRef.current)) {
          // Update the end_time to current time (latest activity)
          const { data: existingLog } = await supabase
            .from('retailer_visit_logs')
            .select('start_time')
            .eq('id', currentLogIdRef.current)
            .single();

          if (existingLog) {
            const startTimeMs = new Date(existingLog.start_time).getTime();
            const endTimeMs = new Date(currentTime).getTime();
            const timeSpentSeconds = Math.floor((endTimeMs - startTimeMs) / 1000);

            await supabase
              .from('retailer_visit_logs')
              .update({
                end_time: currentTime,
                time_spent_seconds: timeSpentSeconds
              })
              .eq('id', currentLogIdRef.current);

            setTimeSpent(timeSpentSeconds);
            console.log('📍 Updated existing log with latest activity:', { currentTime, timeSpentSeconds });
          }
          return;
        }

        // Create new log in Supabase
        const { data, error } = await supabase
          .from('retailer_visit_logs')
          .insert({
            user_id: userId,
            retailer_id: retailerId,
            visit_id: visitId || null,
            start_time: startTime,
            end_time: startTime, // Set initial end_time same as start_time
            start_latitude: userLat || null,
            start_longitude: userLng || null,
            distance_meters: calculatedDistance,
            location_status: status,
            action_type: actionType,
            is_phone_order: isPhoneOrder,
            visit_date: targetDate,
            time_spent_seconds: 0
          })
          .select()
          .single();

        if (!error && data) {
          setCurrentLog(data as VisitLog);
          currentLogIdRef.current = data.id;
          setTimeSpent(0);
          console.log('📍 Created new visit log:', data.id);
        }
      } catch (error) {
        console.error('Failed to save visit log online:', error);
      }
    }
  }, [userId, retailerId, visitId, retailerLat, retailerLng, selectedDate]);

  // Record activity (updates end_time to current timestamp)
  const recordActivity = useCallback(async () => {
    if (!currentLogIdRef.current || !userId) return;

    const targetDate = selectedDate || getLocalTodayDate();
    const currentTime = new Date().toISOString();
    
    // Update last activity time with date-based key (consistent with saveLastActivityTime)
    saveLastActivityTime(retailerId, targetDate, currentTime);

    const isOffline = !navigator.onLine;

    if (isOffline) {
      // Update in IndexedDB
      try {
        const existingLog = await offlineStorage.getById<any>(STORES.RETAILER_VISIT_LOGS, currentLogIdRef.current);
        if (existingLog) {
          const startTimeMs = new Date(existingLog.start_time).getTime();
          const endTimeMs = new Date(currentTime).getTime();
          const timeSpentSeconds = Math.floor((endTimeMs - startTimeMs) / 1000);

          await offlineStorage.save(STORES.RETAILER_VISIT_LOGS, {
            ...existingLog,
            end_time: currentTime,
            time_spent_seconds: timeSpentSeconds
          });
          setTimeSpent(timeSpentSeconds);
        }
      } catch (error) {
        console.error('Failed to update activity offline:', error);
      }
    } else if (!isLocalId(currentLogIdRef.current)) {
      // Update in Supabase
      try {
        const { data: existingLog } = await supabase
          .from('retailer_visit_logs')
          .select('start_time')
          .eq('id', currentLogIdRef.current)
          .single();

        if (existingLog) {
          const startTimeMs = new Date(existingLog.start_time).getTime();
          const endTimeMs = new Date(currentTime).getTime();
          const timeSpentSeconds = Math.floor((endTimeMs - startTimeMs) / 1000);

          await supabase
            .from('retailer_visit_logs')
            .update({
              end_time: currentTime,
              time_spent_seconds: timeSpentSeconds
            })
            .eq('id', currentLogIdRef.current);

          setTimeSpent(timeSpentSeconds);
        }
      } catch (error) {
        console.error('Failed to update activity online:', error);
      }
    }
  }, [userId, retailerId, selectedDate]);

  // End tracking and calculate time spent
  // IMPORTANT: Never sets end_time to "now" unless we have a real activity time
  const endTracking = useCallback(async () => {
    if (!currentLogIdRef.current) return;

    const targetDate = selectedDate || getLocalTodayDate();
    
    // Priority 1: Check persisted last activity time (date-based key)
    const persistedTime = await loadLastActivityTime(retailerId, targetDate);
    
    // Priority 2: Check local log's existing end_time
    let localLogEndTime: string | null = null;
    try {
      const localLog = await offlineStorage.getById<VisitLog>(STORES.RETAILER_VISIT_LOGS, currentLogIdRef.current);
      if (localLog?.end_time && localLog.end_time !== localLog.start_time) {
        localLogEndTime = localLog.end_time;
      }
    } catch (e) {
      // Non-critical
    }
    
    // Use persisted time first, then local log time - NEVER fall back to "now"
    const endTime = persistedTime || localLogEndTime;
    
    // If no real activity time exists, do nothing - don't invent a time
    if (!endTime) {
      console.log('📍 endTracking: No real activity time found, skipping update');
      return;
    }

    const { data: logData } = await supabase
      .from('retailer_visit_logs')
      .select('start_time')
      .eq('id', currentLogIdRef.current)
      .single();

    if (logData) {
      const startTime = new Date(logData.start_time).getTime();
      const endTimeMs = new Date(endTime).getTime();
      const timeSpentSeconds = Math.floor((endTimeMs - startTime) / 1000);

      await supabase
        .from('retailer_visit_logs')
        .update({
          end_time: endTime,
          time_spent_seconds: timeSpentSeconds
        })
        .eq('id', currentLogIdRef.current);

      setTimeSpent(timeSpentSeconds);
    }

    // Don't reset currentLogIdRef so we don't create duplicate logs
  }, [retailerId, selectedDate]);

  // End all active logs on logout
  const endAllActiveLogs = useCallback(async () => {
    const targetDate = selectedDate || new Date().toISOString().split('T')[0];
    
    const { data: activeLogs } = await supabase
      .from('retailer_visit_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('visit_date', targetDate)
      .is('end_time', null);

    if (activeLogs && activeLogs.length > 0) {
      for (const log of activeLogs) {
        // Use stored last activity time with date-based key, or try loading from persistence
        const persistedTime = await loadLastActivityTime(log.retailer_id, targetDate);
        const memoryTime = lastActivityTimeByRetailer.get(`${log.retailer_id}_${targetDate}`);
        const endTime = persistedTime || memoryTime || new Date().toISOString();
        
        const startTime = new Date(log.start_time).getTime();
        const endTimeMs = new Date(endTime).getTime();
        const timeSpentSeconds = Math.floor((endTimeMs - startTime) / 1000);

        await supabase
          .from('retailer_visit_logs')
          .update({
            end_time: endTime,
            time_spent_seconds: timeSpentSeconds
          })
          .eq('id', log.id);
      }
    }
  }, [userId, selectedDate]);

  // Function to manually re-check location
  const recheckLocation = useCallback(async () => {
    if (!retailerLat || !retailerLng) {
      console.log('📍 Cannot recheck - no retailer coordinates');
      return;
    }
    
    console.log('📍 Manual location recheck triggered');
    lastCheckedCoordsRef.current = ''; // Reset to force re-check
    
    if (navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
          });
        });

        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        const calculatedDistance = calculateDistance(userLat, userLng, retailerLat, retailerLng);
        const status = getLocationStatus(calculatedDistance);
        
        console.log('📍 Manual recheck complete:', { 
          userLat, 
          userLng, 
          retailerLat, 
          retailerLng, 
          calculatedDistance: Math.round(calculatedDistance), 
          status 
        });
        
        setDistance(calculatedDistance);
        setLocationStatus(status);
        lastCheckedCoordsRef.current = `${retailerLat}-${retailerLng}`;
      } catch (error: any) {
        console.error('📍 GPS error on recheck:', error.message || error);
        setLocationStatus('location_unavailable');
      }
    }
  }, [retailerLat, retailerLng]);

  // NEW: Unified action recording - captures check-in on first action, check-out on subsequent
  const recordAction = useCallback(async (actionType: string): Promise<void> => {
    const targetDate = selectedDate || getLocalTodayDate();
    const currentTime = new Date().toISOString(); // Device time only - no network
    
    // Update last activity time immediately (both memory and persistent storage)
    saveLastActivityTime(retailerId, targetDate, currentTime);
    
    if (!currentLogIdRef.current) {
      // FIRST ACTION = CHECK-IN
      console.log('📍 First action - capturing check-in time:', currentTime);
      
      const logId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      
      // Get GPS in background (non-blocking, 5s timeout)
      let gpsData: { lat: number; lng: number; distance: number | null; status: 'at_store' | 'within_range' | 'not_at_store' | 'location_unavailable' } | null = null;
      let calculatedDistance: number | null = null;
      let status: 'at_store' | 'within_range' | 'not_at_store' | 'location_unavailable' = 'location_unavailable';
      
      try {
        gpsData = await getGPSWithTimeout(5000);
        if (gpsData && retailerLat && retailerLng) {
          calculatedDistance = calculateDistance(gpsData.lat, gpsData.lng, retailerLat, retailerLng);
          status = getLocationStatus(calculatedDistance);
          setDistance(calculatedDistance);
          setLocationStatus(status);
        }
      } catch (e) {
        console.log('📍 GPS capture failed, continuing with location_unavailable');
      }
      
      const logData: VisitLog = {
        id: logId,
        user_id: userId,
        retailer_id: retailerId,
        start_time: currentTime,
        end_time: currentTime, // Same as start initially
        distance_meters: calculatedDistance,
        location_status: status,
        action_type: actionType,
        is_phone_order: actionType === 'phone_order',
        visit_date: targetDate,
        time_spent_seconds: 0
      };
      
      // INSTANT: Save to offline storage first (no network)
      await offlineStorage.save(STORES.RETAILER_VISIT_LOGS, logData);
      
      // Update state immediately
      setCurrentLog(logData);
      currentLogIdRef.current = logId;
      setTimeSpent(0);
      
      // BACKGROUND: Queue for sync (non-blocking)
      offlineStorage.addToSyncQueue('CREATE_VISIT_LOG', {
        ...logData,
        start_latitude: gpsData?.lat || null,
        start_longitude: gpsData?.lng || null
      }).catch(err => console.log('Queue error (non-fatal):', err));
      
      console.log('✅ Check-in recorded locally:', { logId, actionType, time: currentTime });
    } else {
      // SUBSEQUENT ACTION = UPDATE CHECK-OUT
      console.log('📍 Subsequent action - updating check-out time:', currentTime);
      
      try {
        const existingLog = await offlineStorage.getById<VisitLog>(STORES.RETAILER_VISIT_LOGS, currentLogIdRef.current);
        if (existingLog) {
          const startTimeMs = new Date(existingLog.start_time).getTime();
          const endTimeMs = new Date(currentTime).getTime();
          const timeSpentSeconds = Math.max(0, Math.floor((endTimeMs - startTimeMs) / 1000));
          
          const updatedLog: VisitLog = {
            ...existingLog,
            end_time: currentTime,
            time_spent_seconds: timeSpentSeconds
          };
          
          // Save updated log locally
          await offlineStorage.save(STORES.RETAILER_VISIT_LOGS, updatedLog);
          setCurrentLog(updatedLog);
          setTimeSpent(timeSpentSeconds);
          
          // DEDUPE: Check if there's already a pending UPDATE_VISIT_LOG for this retailer/date
          // If so, update it in place instead of adding a new queue item
          try {
            const syncQueue = await offlineStorage.getSyncQueue();
            const existingQueueItem = syncQueue.find(
              (item: any) => item.action === 'UPDATE_VISIT_LOG' && 
                        item.data?.retailer_id === retailerId && 
                        item.data?.visit_date === targetDate &&
                        item.status === 'pending'
            );
            
            if (existingQueueItem) {
              // Update the existing queue item with new end_time
              existingQueueItem.data.end_time = currentTime;
              existingQueueItem.data.time_spent_seconds = timeSpentSeconds;
              await offlineStorage.save(STORES.SYNC_QUEUE, existingQueueItem);
              console.log('✅ Updated existing queue item with latest check-out time:', currentTime);
            } else {
              // No existing queue item, create new one
              await offlineStorage.addToSyncQueue('UPDATE_VISIT_LOG', {
                id: currentLogIdRef.current,
                user_id: userId,
                retailer_id: retailerId,
                visit_date: targetDate,
                end_time: currentTime,
                time_spent_seconds: timeSpentSeconds
              });
              console.log('✅ Check-out queued for sync:', { timeSpentSeconds, time: currentTime });
            }
          } catch (queueErr) {
            console.log('Queue error (non-fatal):', queueErr);
          }
          
          console.log('✅ Check-out updated locally:', { timeSpentSeconds, time: currentTime });
        }
      } catch (error) {
        console.log('Failed to update check-out (non-fatal):', error);
      }
    }
  }, [userId, retailerId, retailerLat, retailerLng, selectedDate]);

  return {
    currentLog,
    locationStatus,
    distance,
    timeSpent,
    formattedTimeSpent: formatTimeSpent(timeSpent),
    startTracking,
    endTracking,
    endAllActiveLogs,
    recordActivity,
    recordAction, // NEW: Unified action recording
    updateLastActivity,
    recheckLocation
  };
};
