import { Preferences } from '@capacitor/preferences';
import { getLocalTodayDate } from '@/utils/dateUtils';

const CHANGE_KEY = 'visit_data_last_change';

interface ChangeMarker {
  timestamp: number;
  date: string;
}

/**
 * Mark that visit/order data changed on a specific date.
 * Called after order submissions or no-order submissions.
 * This allows useVisitsDataOptimized to detect changes made on other pages.
 */
export const markVisitDataChanged = async (date?: string): Promise<void> => {
  try {
    const effectiveDate = date || getLocalTodayDate();
    const marker: ChangeMarker = {
      timestamp: Date.now(),
      date: effectiveDate
    };
    await Preferences.set({
      key: CHANGE_KEY,
      value: JSON.stringify(marker)
    });
    console.log('[VisitChangeMarker] Marked data change:', marker);
  } catch (e) {
    console.warn('[VisitChangeMarker] Failed to mark change:', e);
  }
};

/**
 * Get the timestamp of the last visit/order data change.
 * Returns null if no change has been recorded.
 */
export const getLastChangeTimestamp = async (): Promise<ChangeMarker | null> => {
  try {
    const { value } = await Preferences.get({ key: CHANGE_KEY });
    if (value) {
      return JSON.parse(value) as ChangeMarker;
    }
  } catch (e) {
    console.warn('[VisitChangeMarker] Failed to get change marker:', e);
  }
  return null;
};

/**
 * Clear the change marker after it has been processed.
 * This prevents repeated cache invalidations.
 */
export const clearChangeMarker = async (): Promise<void> => {
  try {
    await Preferences.remove({ key: CHANGE_KEY });
    console.log('[VisitChangeMarker] Cleared change marker');
  } catch (e) {
    console.warn('[VisitChangeMarker] Failed to clear marker:', e);
  }
};
