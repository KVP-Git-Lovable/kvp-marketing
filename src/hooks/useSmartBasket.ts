import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface RepeatOrderSuggestion {
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  unit: string;
  rate: number;
  confidence: number;
  orderCount: number;
  lastOrdered: string;
  avgQuantity: number;
}

export interface BeatTrendingSuggestion {
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  suggestedQuantity: number;
  unit: string;
  rate: number;
  beatPenetration: number;
  retailerCount: number;
  totalBeatRetailers: number;
  reason: string;
}

export interface UpsellSuggestion {
  currentProductId: string;
  currentProductName: string;
  currentVariantId?: string;
  suggestedProductId: string;
  suggestedProductName: string;
  suggestedVariantId?: string;
  suggestedVariantName?: string;
  currentSize: string;
  suggestedSize: string;
  savingsPercent: number;
  reason: string;
}

export interface SmartBasketSuggestions {
  repeatOrder: RepeatOrderSuggestion[];
  beatTrending: BeatTrendingSuggestion[];
  upsell: UpsellSuggestion[];
  summary: {
    repeatOrderCount: number;
    potentialCrossSell: number;
    upsellOpportunities: number;
    retailerOrderHistory: number;
  };
}

interface UseSmartBasketResult {
  suggestions: SmartBasketSuggestions | null;
  loading: boolean;
  error: string | null;
  fetchSuggestions: () => Promise<void>;
  clearSuggestions: () => void;
}

const CACHE_KEY_PREFIX = 'smart_basket_cache_';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export function useSmartBasket(retailerId: string, beatId?: string): UseSmartBasketResult {
  const [suggestions, setSuggestions] = useState<SmartBasketSuggestions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCacheKey = useCallback(() => {
    return `${CACHE_KEY_PREFIX}${retailerId}_${beatId || 'no_beat'}`;
  }, [retailerId, beatId]);

  const getFromCache = useCallback((): SmartBasketSuggestions | null => {
    try {
      const cacheKey = getCacheKey();
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;

      const { data, timestamp } = JSON.parse(cached);
      const now = Date.now();

      // Check if cache is still valid
      if (now - timestamp < CACHE_DURATION_MS) {
        console.log('🧺 Smart Basket: Using cached suggestions');
        return data;
      }

      // Cache expired, remove it
      localStorage.removeItem(cacheKey);
      return null;
    } catch (e) {
      console.error('Error reading cache:', e);
      return null;
    }
  }, [getCacheKey]);

  const saveToCache = useCallback((data: SmartBasketSuggestions) => {
    try {
      const cacheKey = getCacheKey();
      localStorage.setItem(cacheKey, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.error('Error saving to cache:', e);
    }
  }, [getCacheKey]);

  const fetchSuggestions = useCallback(async () => {
    if (!retailerId) {
      setError('Retailer ID is required');
      return;
    }

    // Check cache first
    const cached = getFromCache();
    if (cached) {
      setSuggestions(cached);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🧺 Smart Basket: Fetching suggestions for retailer', retailerId);

      const { data, error: fnError } = await supabase.functions.invoke('get-smart-basket-suggestions', {
        body: { retailerId, beatId }
      });

      if (fnError) {
        console.error('Smart Basket function error:', fnError);
        throw new Error('Failed to fetch suggestions');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      console.log('🧺 Smart Basket: Received suggestions', data?.summary);
      
      const suggestionsData = data as SmartBasketSuggestions;
      setSuggestions(suggestionsData);
      saveToCache(suggestionsData);

    } catch (err: any) {
      console.error('Smart Basket Error:', err);
      setError(err.message || 'Failed to load suggestions');
      
      // Show toast for user feedback
      toast({
        title: 'Smart Basket Error',
        description: 'Could not load suggestions. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [retailerId, beatId, getFromCache, saveToCache]);

  const clearSuggestions = useCallback(() => {
    setSuggestions(null);
    setError(null);
    try {
      localStorage.removeItem(getCacheKey());
    } catch (e) {
      console.error('Error clearing cache:', e);
    }
  }, [getCacheKey]);

  return {
    suggestions,
    loading,
    error,
    fetchSuggestions,
    clearSuggestions
  };
}
