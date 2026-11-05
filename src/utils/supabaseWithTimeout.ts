/**
 * Supabase request wrapper with timeout support
 * Prevents requests from hanging indefinitely on slow connections
 */

export interface TimeoutOptions {
  timeoutMs?: number;
  onTimeout?: () => void;
}

const DEFAULT_TIMEOUT = 15000; // 15 seconds for normal requests
const BULK_TIMEOUT = 30000; // 30 seconds for bulk operations

/**
 * Creates an AbortController with automatic timeout
 */
export function createTimeoutController(timeoutMs: number = DEFAULT_TIMEOUT): {
  controller: AbortController;
  timeoutId: ReturnType<typeof setTimeout>;
  clear: () => void;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  return {
    controller,
    timeoutId,
    clear: () => clearTimeout(timeoutId),
  };
}

/**
 * Wraps a promise with a timeout
 * Returns the result or throws on timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  options: TimeoutOptions = {}
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT, onTimeout } = options;

  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      onTimeout?.();
      reject(new Error(`Request timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Wraps a Supabase query with timeout
 * Falls back to cached data on timeout if fallback is provided
 */
export async function supabaseWithTimeout<T>(
  queryFn: (signal?: AbortSignal) => Promise<{ data: T | null; error: any }>,
  options: TimeoutOptions & { fallback?: T } = {}
): Promise<{ data: T | null; error: any; timedOut?: boolean }> {
  const { timeoutMs = DEFAULT_TIMEOUT, onTimeout, fallback } = options;

  const { controller, clear } = createTimeoutController(timeoutMs);

  try {
    const result = await queryFn(controller.signal);
    clear();
    return result;
  } catch (error: any) {
    clear();
    
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      console.warn(`⏱️ Supabase request timed out after ${timeoutMs}ms`);
      onTimeout?.();
      
      if (fallback !== undefined) {
        return { data: fallback, error: null, timedOut: true };
      }
      
      return { 
        data: null, 
        error: { message: 'Request timed out. Please try again.', code: 'TIMEOUT' },
        timedOut: true 
      };
    }
    
    return { data: null, error };
  }
}

/**
 * Fetch with timeout wrapper for standard fetch calls
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT, ...fetchOptions } = options;
  const { controller, clear } = createTimeoutController(timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    clear();
    return response;
  } catch (error) {
    clear();
    throw error;
  }
}

export { DEFAULT_TIMEOUT, BULK_TIMEOUT };
