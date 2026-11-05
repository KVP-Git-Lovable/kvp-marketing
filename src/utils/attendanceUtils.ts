import { supabase } from '@/integrations/supabase/client';
import { offlineStorage, STORES } from '@/lib/offlineStorage';

/**
 * Marks attendance for today and also checks in to all planned visits
 * This ensures that either "Day Started" or "Visit Check-in" can be used interchangeably
 * Uses high-accuracy GPS for precise location tracking
 * OFFLINE-FIRST: Saves to offline storage immediately for instant access
 */
export const markDayStarted = async (
  userId: string,
  location: { latitude: number; longitude: number },
  photoPath: string
) => {
  const today = new Date().toISOString().split('T')[0];
  const timestamp = new Date().toISOString();

  // Create attendance record
  const attendanceRecord = {
    id: `local_${Date.now()}`, // Local ID for immediate cache
    user_id: userId,
    date: today,
    check_in_time: timestamp,
    check_in_location: location,
    check_in_address: `${location.latitude}, ${location.longitude}`,
    check_in_photo_url: photoPath,
    status: 'present',
    cached_at: timestamp
  };

  // INSTANT: Save to offline storage first (for offline gate check)
  try {
    await offlineStorage.init();
    await offlineStorage.save(STORES.ATTENDANCE, attendanceRecord);
    console.log('📍 Attendance saved to offline storage for instant access');
    
    // Dispatch event so Home dashboard can lock attendance immediately
    window.dispatchEvent(new CustomEvent('attendanceMarked', { 
      detail: attendanceRecord 
    }));
  } catch (err) {
    console.log('Offline attendance save failed (non-critical):', err);
  }

  // Then sync to Supabase
  const { data, error: attendanceError } = await supabase
    .from('attendance')
    .insert({
      user_id: userId,
      date: today,
      check_in_time: timestamp,
      check_in_location: location,
      check_in_address: `${location.latitude}, ${location.longitude}`,
      check_in_photo_url: photoPath,
      status: 'present'
    })
    .select()
    .single();

  if (attendanceError) {
    // If Supabase fails, queue for sync - local cache already has the record
    await offlineStorage.addToSyncQueue('CREATE_ATTENDANCE', {
      user_id: userId,
      date: today,
      check_in_time: timestamp,
      check_in_location: location,
      check_in_address: `${location.latitude}, ${location.longitude}`,
      check_in_photo_url: photoPath,
      status: 'present'
    });
    console.log('📍 Attendance queued for sync');
  } else if (data) {
    // Update offline storage with real database ID
    await offlineStorage.save(STORES.ATTENDANCE, { ...data, cached_at: timestamp });
    console.log('📍 Attendance synced and cache updated with real ID');
  }

  // Then, check in to all planned visits for today automatically
  const { data: plannedVisits } = await supabase
    .from('visits')
    .select('id')
    .eq('user_id', userId)
    .eq('planned_date', today)
    .is('check_in_time', null);

  if (plannedVisits && plannedVisits.length > 0) {
    // Update all planned visits with check-in time
    for (const visit of plannedVisits) {
      await supabase
        .from('visits')
        .update({
          check_in_time: timestamp,
          check_in_location: location,
          check_in_address: `${location.latitude}, ${location.longitude}`,
          check_in_photo_url: photoPath,
          location_match_in: true,
          status: 'in-progress'
        })
        .eq('id', visit.id);
    }
  }

  return { success: true };
};

/**
 * Checks if attendance has been marked for today (ONLINE ONLY - existing function preserved)
 */
export const hasAttendanceToday = async (userId: string): Promise<boolean> => {
  const today = new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('attendance')
    .select('id')
    .eq('user_id', userId)
    .eq('date', today)
    .single();

  return !error && !!data;
};

/**
 * NEW FEATURE: Checks attendance with offline support
 * First tries online (Supabase), falls back to offline cache
 */
export const hasAttendanceTodayOfflineSupport = async (userId: string): Promise<boolean> => {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    // Try online first
    const { data, error } = await supabase
      .from('attendance')
      .select('id')
      .eq('user_id', userId)
      .eq('date', today)
      .single();

    // If successful online, cache the attendance record
    if (!error && data) {
      try {
        await offlineStorage.init();
        await offlineStorage.save(STORES.ATTENDANCE, {
          id: data.id,
          user_id: userId,
          date: today,
          cached_at: new Date().toISOString()
        });
        console.log('[Attendance] ✅ Cached attendance record for offline access');
      } catch (cacheError) {
        console.error('[Attendance] Failed to cache attendance:', cacheError);
      }
      return true;
    }
    
    // If not found online, check cache (offline mode)
    throw new Error('Not found online, checking cache');
  } catch (onlineError) {
    // Fallback to offline cache
    console.log('[Attendance] Checking offline cache for attendance...');
    try {
      await offlineStorage.init();
      const cachedAttendance = await offlineStorage.getAll(STORES.ATTENDANCE);
      const todayAttendance = cachedAttendance.find((att: any) => 
        att.user_id === userId && att.date === today
      );
      
      if (todayAttendance) {
        console.log('[Attendance] ✅ Found attendance in offline cache');
        return true;
      }
      
      console.log('[Attendance] ❌ No attendance found in cache');
      return false;
    } catch (cacheError) {
      console.error('[Attendance] Cache check failed:', cacheError);
      return false;
    }
  }
};

/**
 * Marks attendance when checking in to a visit (if not already marked)
 * Uses high-accuracy GPS for precise location tracking
 */
export const ensureAttendanceOnVisitCheckIn = async (
  userId: string,
  location: { latitude: number; longitude: number },
  photoPath: string
) => {
  const hasAttendance = await hasAttendanceToday(userId);
  
  if (!hasAttendance) {
    const today = new Date().toISOString().split('T')[0];
    const timestamp = new Date().toISOString();

    await supabase
      .from('attendance')
      .insert({
        user_id: userId,
        date: today,
        check_in_time: timestamp,
        check_in_location: location,
        check_in_address: `${location.latitude}, ${location.longitude}`,
        check_in_photo_url: photoPath,
        status: 'present'
      });
  }
};
