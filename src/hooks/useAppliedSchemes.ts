import { useState, useEffect, useCallback, useRef } from 'react';
import { SchemePolicies } from './useSchemePolicies';
import type { ManualSchemeSelection } from '@/utils/schemeEngine';

const STORAGE_KEY_PREFIX = 'applied_schemes:';
const MANUAL_KEY_PREFIX = 'applied_schemes_manual:';

export interface ProductSchemeBasic {
  id: string;
  scheme_type: string;
}

/**
 * Hook to manage applied schemes for an order
 * Persists to localStorage for offline support
 * Each retailer/visit combination has independent scheme state
 */
export function useAppliedSchemes(visitId: string, retailerId: string) {
  const storageKey = `${STORAGE_KEY_PREFIX}${visitId || 'temp'}:${retailerId || 'unknown'}`;
  const manualKey = `${MANUAL_KEY_PREFIX}${visitId || 'temp'}:${retailerId || 'unknown'}`;
  
  const [appliedSchemeIds, setAppliedSchemeIds] = useState<string[]>([]);
  const [manualSelections, setManualSelectionsState] = useState<Record<string, ManualSchemeSelection>>({});
  const isInitialSync = useRef(true);
  const isManualInitialSync = useRef(true);
  const previousStorageKey = useRef<string | null>(null);

  // Re-sync state when storage key changes (different retailer/visit)
  useEffect(() => {
    // Only sync if the key actually changed
    if (previousStorageKey.current === storageKey) return;
    previousStorageKey.current = storageKey;
    isInitialSync.current = true;
    isManualInitialSync.current = true;
    
    try {
      const stored = localStorage.getItem(storageKey);
      const parsed = stored ? JSON.parse(stored) : [];
      setAppliedSchemeIds(parsed);
      console.log('[useAppliedSchemes] Synced for key:', storageKey, 'Schemes:', parsed.length);
    } catch {
      setAppliedSchemeIds([]);
    }

    try {
      const storedManual = localStorage.getItem(manualKey);
      const parsedManual = storedManual ? JSON.parse(storedManual) : {};
      setManualSelectionsState(parsedManual && typeof parsedManual === 'object' ? parsedManual : {});
    } catch {
      setManualSelectionsState({});
    }
  }, [storageKey, manualKey]);

  useEffect(() => {
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<{ key: string; ids: string[] }>).detail;
      if (detail?.key !== storageKey) return;
      setAppliedSchemeIds(prev => prev.join(",") === detail.ids.join(",") ? prev : detail.ids);
    };
    window.addEventListener("applied-schemes-updated", refresh);
    return () => window.removeEventListener("applied-schemes-updated", refresh);
  }, [storageKey]);

  // Persist to localStorage whenever appliedSchemeIds changes
  useEffect(() => {
    // Skip first save after sync to prevent overwriting
    if (isInitialSync.current) {
      isInitialSync.current = false;
      return;
    }
    
    try {
      if (appliedSchemeIds.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(appliedSchemeIds));
      } else {
        localStorage.removeItem(storageKey);
      }
      window.dispatchEvent(new CustomEvent("applied-schemes-updated", { detail: { key: storageKey, ids: appliedSchemeIds } }));
    } catch (error) {
      console.error('[useAppliedSchemes] Error saving to localStorage:', error);
    }
  }, [appliedSchemeIds, storageKey]);

  // Persist manual selections
  useEffect(() => {
    if (isManualInitialSync.current) {
      isManualInitialSync.current = false;
      return;
    }
    try {
      if (Object.keys(manualSelections).length > 0) {
        localStorage.setItem(manualKey, JSON.stringify(manualSelections));
      } else {
        localStorage.removeItem(manualKey);
      }
    } catch (error) {
      console.error('[useAppliedSchemes] Error saving manual selections:', error);
    }
  }, [manualSelections, manualKey]);

  /**
   * Apply a scheme with optional policy enforcement
   */
  const applyScheme = useCallback((
    schemeId: string,
    scheme?: ProductSchemeBasic,
    policies?: SchemePolicies,
    allSchemes?: ProductSchemeBasic[]
  ) => {
    setAppliedSchemeIds(prev => {
      if (prev.includes(schemeId)) return prev;
      
      // Enforce max schemes per order
      if (policies && prev.length >= policies.maxSchemesPerOrder) {
        console.log('[useAppliedSchemes] Max schemes reached:', policies.maxSchemesPerOrder);
        return prev;
      }
      
      // Enforce stacking rules - if stacking not allowed and already have schemes
      if (policies && !policies.allowSchemeStacking && prev.length > 0) {
        console.log('[useAppliedSchemes] Stacking not allowed, already have:', prev.length);
        return prev;
      }
      
      // Enforce same-type stacking
      if (policies && scheme && allSchemes && !policies.sameTypeStacking && policies.allowSchemeStacking) {
        const appliedTypes = prev.map(id => 
          allSchemes.find(s => s.id === id)?.scheme_type
        ).filter(Boolean);
        
        if (appliedTypes.includes(scheme.scheme_type)) {
          console.log('[useAppliedSchemes] Same-type stacking not allowed for:', scheme.scheme_type);
          return prev;
        }
      }
      
      const updated = [...prev, schemeId];
      console.log('[useAppliedSchemes] Applied scheme:', schemeId, 'Total:', updated.length);
      return updated;
    });
  }, []);

  const removeScheme = useCallback((schemeId: string) => {
    setAppliedSchemeIds(prev => {
      const updated = prev.filter(id => id !== schemeId);
      console.log('[useAppliedSchemes] Removed scheme:', schemeId, 'Remaining:', updated.length);
      return updated;
    });
    // Also clear any manual selection tied to this scheme
    setManualSelectionsState(prev => {
      if (!prev[schemeId]) return prev;
      const next = { ...prev };
      delete next[schemeId];
      return next;
    });
  }, []);

  const clearSchemes = useCallback(() => {
    setAppliedSchemeIds([]);
    setManualSelectionsState({});
    try {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(manualKey);
    } catch {
      // Ignore
    }
    console.log('[useAppliedSchemes] Cleared all schemes');
  }, [storageKey, manualKey]);

  const isSchemeApplied = useCallback((schemeId: string) => {
    return appliedSchemeIds.includes(schemeId);
  }, [appliedSchemeIds]);

  /**
   * Replace all applied schemes with a single best scheme
   * Used when stacking is not allowed
   */
  const setOnlyScheme = useCallback((schemeId: string) => {
    setAppliedSchemeIds([schemeId]);
    console.log('[useAppliedSchemes] Set only scheme:', schemeId);
  }, []);

  const replaceSchemes = useCallback((ids: string[]) => {
    const unique = [...new Set(ids)];
    setAppliedSchemeIds(previous => previous.join(",") === unique.join(",") ? previous : unique);
  }, []);

  /**
   * Save the manual per-unit selection for a scheme. Pass null to clear.
   */
  const setManualSelection = useCallback((schemeId: string, selection: ManualSchemeSelection | null) => {
    setManualSelectionsState(prev => {
      const next = { ...prev };
      if (selection === null) {
        delete next[schemeId];
      } else {
        next[schemeId] = selection;
      }
      return next;
    });
  }, []);

  return {
    appliedSchemeIds,
    manualSelections,
    applyScheme,
    removeScheme,
    clearSchemes,
    isSchemeApplied,
    setOnlyScheme,
    replaceSchemes,
    setManualSelection,
  };
}
