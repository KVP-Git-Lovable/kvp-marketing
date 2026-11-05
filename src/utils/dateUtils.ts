/**
 * Centralized date utility functions
 * Uses device local timezone for all date calculations.
 * Timestamps stay in UTC for storage; business date strings (yyyy-MM-dd) are local.
 */

/**
 * Get today's date as a local YYYY-MM-DD string (device timezone).
 * Use for Supabase plan_date, order_date, visit planned_date, etc.
 */
export const getLocalTodayDate = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Convert a Date object to a local YYYY-MM-DD string (device timezone).
 * Equivalent to date-fns format(d, 'yyyy-MM-dd') but without any TZ edge-case bugs.
 */
export const toLocalISODate = (d: Date): string => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Alias for getLocalTodayDate for backward compatibility / clarity.
 */
export const getLocalDateString = getLocalTodayDate;

/**
 * Parse a YYYY-MM-DD string into a Date at local midnight.
 * Ensures we don't shift dates due to UTC parsing.
 */
export const parseLocalDate = (dateStr: string): Date => {
  // Append T00:00:00 to force local interpretation
  return new Date(dateStr + 'T00:00:00');
};

/**
 * Check if a given date string (YYYY-MM-DD) is today.
 */
export const isToday = (dateStr: string): boolean => {
  return dateStr === getLocalTodayDate();
};

/**
 * Check if a given Date object represents today.
 */
export const isTodayDate = (d: Date): boolean => {
  return toLocalISODate(d) === getLocalTodayDate();
};

/**
 * Get the start of the week (Monday) for a given date as a Date object.
 */
export const getLocalWeekStart = (d: Date, weekStartsOn: 0 | 1 = 1): Date => {
  const day = d.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  const start = new Date(d);
  start.setDate(d.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
};

/**
 * Format a Date to a short weekday string (Mon, Tue, etc.) in device locale.
 */
export const formatWeekdayShort = (d: Date): string => {
  return d.toLocaleDateString('en-US', { weekday: 'short' });
};

/**
 * Get local timestamp (keeps date accurate for things like order timestamps).
 */
export const getLocalTimestamp = (): string => {
  return new Date().toISOString();
};

/**
 * Calendar period helpers — return local Date objects.
 * Use for "This Week", "This Month", "Last Month" filter ranges.
 */
export interface DateRange { start: Date; end: Date; }

/** Current calendar week, Mon 00:00:00 → Sun 23:59:59.999 (local). */
export const getCurrentWeekRange = (weekStartsOn: 0 | 1 = 1): DateRange => {
  const now = new Date();
  const start = getLocalWeekStart(now, weekStartsOn);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

/** Current calendar month, 1st 00:00:00 → last day 23:59:59.999 (local). */
export const getCurrentMonthRange = (): DateRange => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
};

/** Previous calendar month, 1st 00:00:00 → last day 23:59:59.999 (local). */
export const getLastMonthRange = (): DateRange => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  return { start, end };
};
