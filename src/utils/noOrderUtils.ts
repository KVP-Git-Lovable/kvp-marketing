import { offlineStorage, STORES } from '@/lib/offlineStorage';
import { visitStatusCache } from '@/lib/visitStatusCache';
import { updateVisitStatusInSnapshot } from '@/lib/myVisitsSnapshot';
import { supabase } from '@/integrations/supabase/client';
import { markVisitDataChanged } from '@/lib/visitChangeMarker';
import { awardPointsForTotalVisits } from '@/utils/gamificationPointsAwarder';

const SYNC_TIMEOUT_MS = 5000; // 5 second timeout for all sync operations

/**
 * Submit No Order with LOCAL-FIRST pattern
 * Updates local state immediately, syncs to server in background
 * This ensures instant UI feedback even on slow connections
 * 5-second timeout auto-queues to offline sync if network is slow
 */
export async function submitNoOrderLocalFirst(params: {
  visitId: string | undefined;
  retailerId: string;
  userId: string;
  reason: string;
  today: string;
}): Promise<{ success: boolean; visitId: string }> {
  const { visitId, retailerId, userId, reason, today } = params;

  // Generate a visit ID if we don't have one
  const effectiveVisitId = visitId?.startsWith('offline_') || visitId?.startsWith('temp_') || !visitId
    ? `offline_noorder_${retailerId}_${Date.now()}`
    : visitId;

  // STEP 1: Update local UI state IMMEDIATELY (most critical for instant feedback)
  const visitData = {
    id: effectiveVisitId,
    retailer_id: retailerId,
    user_id: userId,
    planned_date: today,
    status: 'unproductive',
    no_order_reason: reason,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // FIRE-AND-FORGET: Update all local caches (don't await - makes response instant)
  Promise.allSettled([
    offlineStorage.save(STORES.VISITS, visitData),
    visitStatusCache.set(
      effectiveVisitId,
      retailerId,
      userId,
      today,
      'unproductive',
      undefined,
      reason
    ),
    updateVisitStatusInSnapshot(userId, today, retailerId, 'unproductive', reason)
  ]);

  // STEP 2: Dispatch events for instant UI update
  window.dispatchEvent(new CustomEvent('visitStatusChanged', {
    detail: {
      visitId: effectiveVisitId,
      status: 'unproductive',
      retailerId,
      noOrderReason: reason
    }
  }));
  window.dispatchEvent(new CustomEvent('visitDataChanged', { detail: { date: today } }));
  
  // STEP 2.5: Mark data changed for cross-page state sync
  markVisitDataChanged(today);

  // STEP 3: Background sync with 5-second timeout - ALWAYS non-blocking
  setTimeout(async () => {
    if (!navigator.onLine) {
      // Queue for later sync when offline
      offlineStorage.addToSyncQueue('UPDATE_VISIT_NO_ORDER', {
        visitId: effectiveVisitId,
        retailerId,
        userId,
        noOrderReason: reason,
        plannedDate: today,
        timestamp: new Date().toISOString()
      });
      return;
    }

    try {
      const syncPromise = syncNoOrderToServer({
        visitId: effectiveVisitId,
        retailerId,
        userId,
        reason,
        today
      });
      
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('5s timeout')), SYNC_TIMEOUT_MS)
      );

      await Promise.race([syncPromise, timeoutPromise]);
      
      // STEP 4: Check for total visits points after successful sync
      try {
        await awardPointsForTotalVisits(userId, today);
      } catch (err) {
        console.error('[noOrderUtils] Error checking total visits points:', err);
      }
    } catch {
      // Auto-queue to offline sync on any error or timeout
      offlineStorage.addToSyncQueue('UPDATE_VISIT_NO_ORDER', {
        visitId: effectiveVisitId,
        retailerId,
        userId,
        noOrderReason: reason,
        plannedDate: today,
        timestamp: new Date().toISOString()
      });
    }
  }, 0);

  return { success: true, visitId: effectiveVisitId };
}

/**
 * Background sync to server - called non-blocking with internal timeout
 */
async function syncNoOrderToServer(params: {
  visitId: string;
  retailerId: string;
  userId: string;
  reason: string;
  today: string;
}): Promise<void> {
  const { visitId, retailerId, userId, reason, today } = params;
  const isOfflineId = visitId.startsWith('offline_') || visitId.startsWith('temp_');

  let serverVisitId = visitId;

  if (isOfflineId) {
    // Need to find or create a real visit
    const { data: existingVisit } = await supabase
      .from('visits')
      .select('id')
      .eq('retailer_id', retailerId)
      .eq('user_id', userId)
      .eq('planned_date', today)
      .maybeSingle();

    if (existingVisit) {
      serverVisitId = existingVisit.id;
      await supabase
        .from('visits')
        .update({
          status: 'unproductive',
          no_order_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', serverVisitId);
    } else {
      const { data: newVisit, error: createError } = await supabase
        .from('visits')
        .insert({
          retailer_id: retailerId,
          user_id: userId,
          planned_date: today,
          status: 'unproductive',
          no_order_reason: reason,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) throw createError;
      serverVisitId = newVisit.id;
    }
  } else {
    const { error } = await supabase
      .from('visits')
      .update({
        status: 'unproductive',
        no_order_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', serverVisitId);

    if (error) throw error;
  }

  // Update local cache with server visit ID if it changed
  if (serverVisitId !== visitId) {
    const localVisit = await offlineStorage.getById(STORES.VISITS, visitId);
    if (localVisit) {
      offlineStorage.delete(STORES.VISITS, visitId);
      offlineStorage.save(STORES.VISITS, {
        ...(localVisit as any),
        id: serverVisitId
      });
    }
  }
}
