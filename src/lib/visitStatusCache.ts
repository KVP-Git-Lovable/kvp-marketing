import { Preferences } from '@capacitor/preferences';

// Visit Status Cache - stores visit statuses locally for instant display
// Prevents network fetches for already known statuses

interface CachedVisitStatus {
  visitId: string;
  retailerId: string;
  userId: string;
  date: string;
  status: 'planned' | 'in-progress' | 'productive' | 'unproductive' | 'store-closed' | 'cancelled';
  orderValue?: number;
  noOrderReason?: string;
  updatedAt: number;
  isFinal: boolean; // productive/unproductive are final - no need to refresh
}

const CACHE_KEY = 'visit_status_cache';
const CACHE_EXPIRY_DAYS = 7; // Keep cache for 7 days

class VisitStatusCache {
  private memoryCache: Map<string, CachedVisitStatus> = new Map();
  private initialized = false;

  private getCacheKey(retailerId: string, userId: string, date: string): string {
    return `${retailerId}_${userId}_${date}`;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    
    try {
      const { value } = await Preferences.get({ key: CACHE_KEY });
      if (value) {
        const data = JSON.parse(value) as CachedVisitStatus[];
        // Filter out expired entries
        const now = Date.now();
        const expiryMs = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
        
        data.forEach(item => {
          if (now - item.updatedAt < expiryMs) {
            const key = this.getCacheKey(item.retailerId, item.userId, item.date);
            this.memoryCache.set(key, item);
          }
        });
        
        console.log(`[VisitStatusCache] Loaded ${this.memoryCache.size} cached statuses`);
      }
    } catch (error) {
      console.error('[VisitStatusCache] Error loading cache:', error);
    }
    
    this.initialized = true;
  }

  private async persistCache(): Promise<void> {
    try {
      const data = Array.from(this.memoryCache.values());
      await Preferences.set({ key: CACHE_KEY, value: JSON.stringify(data) });
    } catch (error) {
      console.error('[VisitStatusCache] Error persisting cache:', error);
    }
  }

  // SYNCHRONOUS get - returns immediately from memory cache (may return null if not initialized)
  // Use this for initial render to avoid flicker
  getSync(retailerId: string, userId: string, date: string): CachedVisitStatus | null {
    if (!this.initialized) {
      return null; // Cache not ready yet
    }
    
    const key = this.getCacheKey(retailerId, userId, date);
    return this.memoryCache.get(key) || null;
  }

  // Get cached status - returns immediately from memory
  async get(retailerId: string, userId: string, date: string): Promise<CachedVisitStatus | null> {
    if (!this.initialized) await this.init();
    
    const key = this.getCacheKey(retailerId, userId, date);
    const cached = this.memoryCache.get(key);
    
    if (cached) {
      console.log(`[VisitStatusCache] Cache HIT for ${retailerId}:`, cached.status);
      return cached;
    }
    
    console.log(`[VisitStatusCache] Cache MISS for ${retailerId}`);
    return null;
  }
  
  // Check if cache is initialized
  isReady(): boolean {
    return this.initialized;
  }

  // Update cache - call when status changes
  // IMPORTANT: 'productive' always overrides any previous status
  async set(
    visitId: string,
    retailerId: string,
    userId: string,
    date: string,
    status: CachedVisitStatus['status'],
    orderValue?: number,
    noOrderReason?: string
  ): Promise<void> {
    if (!this.initialized) await this.init();
    
    const key = this.getCacheKey(retailerId, userId, date);
    const existing = this.memoryCache.get(key);
    
    // CRITICAL: 'productive' always wins over any other status (including 'unproductive')
    // This handles the case where user marks "No Order" first, then places an order later
    if (existing?.status === 'productive' && status !== 'productive') {
      console.log(`[VisitStatusCache] Ignoring status change to ${status} - already productive (final)`);
      return;
    }
    
    // Only 'productive' is truly final - 'unproductive' can be overridden by orders
    const isFinal = status === 'productive';
    
    const entry: CachedVisitStatus = {
      visitId,
      retailerId,
      userId,
      date,
      status,
      orderValue,
      noOrderReason,
      updatedAt: Date.now(),
      isFinal
    };
    
    this.memoryCache.set(key, entry);
    console.log(`[VisitStatusCache] Cached status for ${retailerId}:`, status, isFinal ? '(FINAL)' : '');
    
    // Persist asynchronously - don't block
    this.persistCache();
  }

  // Check if we need to refresh from network
  // Returns false only if status is 'productive' (truly final) - 'unproductive' can be overridden by orders
  shouldRefreshFromNetwork(retailerId: string, userId: string, date: string): boolean {
    const key = this.getCacheKey(retailerId, userId, date);
    const cached = this.memoryCache.get(key);
    
    if (!cached) {
      // No cache - need to check network
      return true;
    }
    
    // Only 'productive' is truly final - orders placed override everything
    if (cached.status === 'productive') {
      console.log(`[VisitStatusCache] Status is PRODUCTIVE (truly final), skipping network refresh`);
      return false;
    }
    
    // For all other statuses (including 'unproductive'), allow refresh
    // This ensures orders placed after "No Order" will update the status
    return true;
  }

  // Clear cache for a specific retailer (use when manually forcing refresh)
  async invalidate(retailerId: string, userId: string, date: string): Promise<void> {
    const key = this.getCacheKey(retailerId, userId, date);
    this.memoryCache.delete(key);
    await this.persistCache();
  }

  // Clear all cache
  async clearAll(): Promise<void> {
    this.memoryCache.clear();
    await Preferences.remove({ key: CACHE_KEY });
    console.log('[VisitStatusCache] Cache cleared');
  }
}

export const visitStatusCache = new VisitStatusCache();
