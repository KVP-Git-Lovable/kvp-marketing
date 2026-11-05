import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

// Map routes to module names and categories
const MODULE_MAP: Record<string, { name: string; category: 'core' | 'performance' }> = {
  '/dashboard': { name: 'Dashboard', category: 'core' },
  '/attendance': { name: 'Attendance', category: 'core' },
  '/attendance-management': { name: 'Attendance', category: 'core' },
  '/my-visits': { name: 'Visit', category: 'core' },
  '/visit': { name: 'Visit', category: 'core' },
  '/visit-planner': { name: 'Visit', category: 'core' },
  '/packing-list': { name: 'Packing List', category: 'core' },
  '/delivery': { name: 'Delivery', category: 'core' },
  '/delivery-management': { name: 'Delivery', category: 'core' },
  '/my-beats': { name: 'My Beat', category: 'core' },
  '/create-beat': { name: 'My Beat', category: 'core' },
  '/beat': { name: 'My Beat', category: 'core' },
  '/add-beat': { name: 'My Beat', category: 'core' },
  '/my-retailers': { name: 'My Retailer', category: 'core' },
  '/add-retailer': { name: 'My Retailer', category: 'core' },
  '/retailer': { name: 'My Retailer', category: 'core' },
  '/order-entry': { name: 'Orders', category: 'core' },
  '/cart': { name: 'Orders', category: 'core' },
  '/orders': { name: 'Orders', category: 'core' },
  '/feedback': { name: 'Feedback', category: 'performance' },
  '/feedback-management': { name: 'Feedback', category: 'performance' },
  '/analytics': { name: 'Analytics', category: 'performance' },
  '/beat-analytics': { name: 'Analytics', category: 'performance' },
  '/schemes': { name: 'Schemes', category: 'performance' },
  '/my-targets': { name: 'Targets', category: 'performance' },
  '/team-targets': { name: 'Targets', category: 'performance' },
  '/target-advisor': { name: 'AI Features', category: 'performance' },
  '/ai-chat': { name: 'AI Features', category: 'performance' },
  '/coach': { name: 'AI Features', category: 'performance' },
  '/competency': { name: 'AI Features', category: 'performance' },
  '/branding-requests': { name: 'Branding', category: 'performance' },
  '/gps-track': { name: 'GPS Track', category: 'performance' },
  '/credit-management': { name: 'Credit Management', category: 'performance' },
  '/profile': { name: 'Profile', category: 'core' },
};

function resolveModule(pathname: string): { name: string; category: 'core' | 'performance' } | null {
  // Direct match first
  if (MODULE_MAP[pathname]) return MODULE_MAP[pathname];

  // Prefix match for dynamic routes like /visit/:id, /beat/:id
  for (const [route, mod] of Object.entries(MODULE_MAP)) {
    if (pathname.startsWith(route + '/') || pathname.startsWith(route)) {
      return mod;
    }
  }

  // Skip admin/website routes from tracking
  if (pathname.startsWith('/admin') || pathname.startsWith('/auth') || pathname === '/' || 
      pathname.startsWith('/solutions') || pathname.startsWith('/insights') ||
      pathname.startsWith('/usage-report')) {
    return null;
  }

  return null;
}

export const useModuleUsageTracker = () => {
  const { user } = useAuth();
  const location = useLocation();
  const currentLogIdRef = useRef<string | null>(null);
  const currentModuleRef = useRef<string | null>(null);
  const startTimeRef = useRef<number>(0);

  const endCurrentLog = useCallback(async () => {
    if (!currentLogIdRef.current || !startTimeRef.current) return;

    const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
    if (duration < 2) {
      // Skip very short visits (likely route transitions)
      currentLogIdRef.current = null;
      currentModuleRef.current = null;
      startTimeRef.current = 0;
      return;
    }

    try {
      await supabase
        .from('module_usage_logs' as any)
        .update({ 
          ended_at: new Date().toISOString(), 
          duration_seconds: duration 
        })
        .eq('id', currentLogIdRef.current);
    } catch (e) {
      console.error('[ModuleTracker] Error ending log:', e);
    }
    
    currentLogIdRef.current = null;
    currentModuleRef.current = null;
    startTimeRef.current = 0;
  }, []);

  const startNewLog = useCallback(async (pathname: string) => {
    if (!user) return;
    
    const mod = resolveModule(pathname);
    if (!mod) return;

    // Same module - don't re-log
    if (mod.name === currentModuleRef.current) return;

    // End previous log
    await endCurrentLog();

    currentModuleRef.current = mod.name;
    startTimeRef.current = Date.now();

    try {
      const { data } = await supabase
        .from('module_usage_logs' as any)
        .insert({
          user_id: user.id,
          module_name: mod.name,
          module_category: mod.category,
          route_path: pathname,
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (data) {
        currentLogIdRef.current = (data as any).id;
      }
    } catch (e) {
      console.error('[ModuleTracker] Error creating log:', e);
    }
  }, [user, endCurrentLog]);

  // Track route changes
  useEffect(() => {
    startNewLog(location.pathname);
  }, [location.pathname, startNewLog]);

  // Cleanup on unmount / page close
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentLogIdRef.current && startTimeRef.current) {
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        navigator.sendBeacon?.(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/module_usage_logs?id=eq.${currentLogIdRef.current}`,
          JSON.stringify({ ended_at: new Date().toISOString(), duration_seconds: duration })
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      endCurrentLog();
    };
  }, [endCurrentLog]);
};
