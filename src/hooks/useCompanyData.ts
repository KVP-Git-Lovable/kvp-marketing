import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CompanyData {
  id: string;
  name: string;
  logo_url: string | null;
  header_name: string | null;
  header_logo_url: string | null;
}

interface HeaderBrandingCache {
  headerName: string | null;
  headerLogo: string | null;
  cachedAt: number;
}

// Custom event name for header branding updates
export const HEADER_BRANDING_UPDATED_EVENT = 'header-branding-updated';

// Cache key for localStorage
const HEADER_BRANDING_CACHE_KEY = 'header_branding_cache';

// Helper to get cached data synchronously
const getCachedBranding = (): HeaderBrandingCache | null => {
  try {
    const cached = localStorage.getItem(HEADER_BRANDING_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.error('Error reading header branding cache:', e);
  }
  return null;
};

// Helper to save cache
const setCachedBranding = (data: HeaderBrandingCache) => {
  try {
    localStorage.setItem(HEADER_BRANDING_CACHE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Error saving header branding cache:', e);
  }
};

export const useCompanyData = () => {
  // Initialize from cache synchronously - no loading flicker
  const initialCache = getCachedBranding();
  
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [headerName, setHeaderName] = useState<string | null>(initialCache?.headerName || null);
  const [headerLogo, setHeaderLogo] = useState<string | null>(initialCache?.headerLogo || null);
  const [isLoading, setIsLoading] = useState(!initialCache); // Only loading if no cache

  const fetchCompany = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, logo_url, header_name, header_logo_url')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching company:', error);
        return;
      }
      
      if (data) {
        setCompany(data);
        
        // Update header branding state
        const newHeaderName = data.header_name || data.name || null;
        const newHeaderLogo = data.header_logo_url || data.logo_url || null;
        
        setHeaderName(newHeaderName);
        setHeaderLogo(newHeaderLogo);
        
        setCachedBranding({
          headerName: newHeaderName,
          headerLogo: newHeaderLogo,
          cachedAt: Date.now()
        });
      }
    } catch (err) {
      console.error('Error fetching company data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Always fetch fresh data in background (cache is used for initial render)
    fetchCompany();

    // Listen for header branding updates (triggered on Save)
    const handleBrandingUpdate = () => {
      fetchCompany(); // Fetch fresh data and update cache
    };

    window.addEventListener(HEADER_BRANDING_UPDATED_EVENT, handleBrandingUpdate);
    return () => {
      window.removeEventListener(HEADER_BRANDING_UPDATED_EVENT, handleBrandingUpdate);
    };
  }, [fetchCompany]);

  return { company, isLoading, headerName, headerLogo, refetch: fetchCompany };
};
