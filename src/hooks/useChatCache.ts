import { useState, useCallback } from 'react';

interface CacheEntry {
  response: string;
  timestamp: number;
}

interface CacheStore {
  [key: string]: CacheEntry;
}

const CACHE_KEY = 'ai_chat_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Common queries that should be cached
const CACHEABLE_QUERIES = [
  'my visits',
  'today visits',
  'sales summary',
  'top retailers',
  'stock levels',
  'pending payments',
  'attendance'
];

export const useChatCache = () => {
  const [isCached, setIsCached] = useState(false);

  const normalizeQuery = (query: string): string => {
    return query.toLowerCase().trim().replace(/[?!.,]/g, '');
  };

  const isCacheableQuery = (query: string): boolean => {
    const normalized = normalizeQuery(query);
    return CACHEABLE_QUERIES.some(q => normalized.includes(q));
  };

  const getCache = useCallback((): CacheStore => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  }, []);

  const setCache = useCallback((store: CacheStore) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(store));
    } catch (e) {
      console.warn('Failed to cache response:', e);
    }
  }, []);

  const getCachedResponse = useCallback((query: string): string | null => {
    if (!isCacheableQuery(query)) return null;

    const store = getCache();
    const key = normalizeQuery(query);
    const entry = store[key];

    if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
      setIsCached(true);
      return entry.response;
    }

    setIsCached(false);
    return null;
  }, [getCache]);

  const cacheResponse = useCallback((query: string, response: string) => {
    if (!isCacheableQuery(query) || !response) return;

    const store = getCache();
    const key = normalizeQuery(query);
    
    store[key] = {
      response,
      timestamp: Date.now()
    };

    // Clean up old entries
    const now = Date.now();
    Object.keys(store).forEach(k => {
      if (now - store[k].timestamp > CACHE_TTL) {
        delete store[k];
      }
    });

    setCache(store);
  }, [getCache, setCache]);

  const clearCache = useCallback(() => {
    localStorage.removeItem(CACHE_KEY);
  }, []);

  return {
    getCachedResponse,
    cacheResponse,
    clearCache,
    isCached,
    isCacheableQuery
  };
};
