import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const SESSION_KEY = 'activity_session_id';
const HEARTBEAT_KEY = 'activity_heartbeat';
const HEARTBEAT_INTERVAL_MS = 30_000; // 30s heartbeat
const STALE_THRESHOLD_MS = 90_000; // 90s = stale (3 missed heartbeats)

export const useActivityTracker = () => {
  const { user } = useAuth();
  const location = useLocation();
  const sessionIdRef = useRef<string | null>(null);
  const lastPathRef = useRef<string | null>(null);
  const lastVisitTimeRef = useRef<number>(Date.now());
  const bytesRef = useRef({ uploaded: 0, downloaded: 0 });
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const creatingRef = useRef(false);

  const getModuleName = (path: string): string => {
    const segment = path.split('/').filter(Boolean)[0];
    return segment || 'home';
  };

  // Write a heartbeat timestamp to localStorage
  const writeHeartbeat = useCallback(() => {
    localStorage.setItem(HEARTBEAT_KEY, Date.now().toString());
  }, []);

  // Create session on login — with guards against duplicates
  const createSession = useCallback(async () => {
    if (!user) return;
    if (creatingRef.current) return;
    if (sessionIdRef.current) return;

    // Check localStorage for an existing session
    const existingId = localStorage.getItem(SESSION_KEY);
    if (existingId) {
      // Check if the previous heartbeat is stale (app was killed without cleanup)
      const lastHeartbeat = parseInt(localStorage.getItem(HEARTBEAT_KEY) || '0', 10);
      const isStale = lastHeartbeat > 0 && (Date.now() - lastHeartbeat) > STALE_THRESHOLD_MS;

      if (isStale) {
        // Close the stale session with the last heartbeat time as logout
        console.log('[ActivityTracker] Closing stale session:', existingId);
        await supabase
          .from('user_sessions')
          .update({ logout_at: new Date(lastHeartbeat).toISOString(), is_active: false })
          .eq('id', existingId);
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(HEARTBEAT_KEY);
      } else {
        const { data: existing } = await supabase
          .from('user_sessions')
          .select('id')
          .eq('id', existingId)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        if (existing) {
          sessionIdRef.current = existing.id;
          writeHeartbeat();
          return; // Reuse existing session
        }
        localStorage.removeItem(SESSION_KEY);
      }
    }

    creatingRef.current = true;
    try {
      // Close any prior orphaned sessions for this user before creating a new one
      await supabase
        .from('user_sessions')
        .update({ logout_at: new Date().toISOString(), is_active: false })
        .eq('user_id', user.id)
        .eq('is_active', true);

      const { data, error } = await supabase
        .from('user_sessions')
        .insert({ user_id: user.id })
        .select('id')
        .single();
      if (!error && data) {
        sessionIdRef.current = data.id;
        localStorage.setItem(SESSION_KEY, data.id);
        writeHeartbeat();
      }
    } catch (e) {
      console.error('Failed to create activity session:', e);
    } finally {
      creatingRef.current = false;
    }
  }, [user, writeHeartbeat]);

  // End session — called on beforeunload, logout, or visibility hidden
  const endSession = useCallback(async () => {
    const sid = sessionIdRef.current || localStorage.getItem(SESSION_KEY);
    if (!sid) return;
    sessionIdRef.current = null;
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(HEARTBEAT_KEY);
    try {
      await supabase
        .from('user_sessions')
        .update({ logout_at: new Date().toISOString(), is_active: false })
        .eq('id', sid);
    } catch (e) {
      console.error('Failed to end activity session:', e);
    }
  }, []);

  // Log page view
  const logPageView = useCallback(async (path: string) => {
    if (!user || !sessionIdRef.current) return;
    if (lastPathRef.current && lastPathRef.current !== path) {
      const duration = Math.round((Date.now() - lastVisitTimeRef.current) / 1000);
      supabase
        .from('user_page_views')
        .update({ duration_seconds: duration } as any)
        .eq('session_id', sessionIdRef.current)
        .eq('page', lastPathRef.current)
        .is('duration_seconds', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .then(() => {});
    }

    lastPathRef.current = path;
    lastVisitTimeRef.current = Date.now();

    try {
      await supabase.from('user_page_views').insert({
        user_id: user.id,
        session_id: sessionIdRef.current,
        page: path,
        module_name: getModuleName(path),
      } as any);
    } catch (e) {
      console.error('Failed to log page view:', e);
    }
  }, [user]);

  // Flush data usage
  const flushDataUsage = useCallback(async () => {
    const { uploaded, downloaded } = bytesRef.current;
    if ((uploaded === 0 && downloaded === 0) || !user || !sessionIdRef.current) return;
    bytesRef.current = { uploaded: 0, downloaded: 0 };
    try {
      await supabase.from('user_data_usage').insert({
        user_id: user.id,
        session_id: sessionIdRef.current,
        bytes_uploaded: uploaded,
        bytes_downloaded: downloaded,
        data_used_mb: (uploaded + downloaded) / (1024 * 1024),
      } as any);
    } catch (e) {
      console.error('Failed to flush data usage:', e);
    }
  }, [user]);

  // Session lifecycle
  useEffect(() => {
    if (!user) return;
    createSession();

    const handleBeforeUnload = () => {
      flushDataUsage();
      endSession();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Visibility change: end session when app goes to background, resume when foregrounded
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // App went to background — close the session
        flushDataUsage();
        endSession();
      } else if (document.visibilityState === 'visible') {
        // App came back to foreground — create a new session
        createSession();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Heartbeat: periodically write timestamp so stale sessions can be detected
    heartbeatTimerRef.current = setInterval(writeHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    };
  }, [user, createSession, endSession, flushDataUsage, writeHeartbeat]);

  // End session on auth sign-out
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        flushDataUsage();
        endSession();
      }
    });
    return () => subscription.unsubscribe();
  }, [endSession, flushDataUsage]);

  // Track route changes
  useEffect(() => {
    if (user && sessionIdRef.current) {
      logPageView(location.pathname);
    }
  }, [location.pathname, user, logPageView]);

  // PerformanceObserver for data usage estimation
  useEffect(() => {
    if (!user) return;
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const res = entry as PerformanceResourceTiming;
          bytesRef.current.downloaded += res.transferSize || 0;
          if (res.initiatorType === 'fetch' || res.initiatorType === 'xmlhttprequest') {
            bytesRef.current.uploaded += res.encodedBodySize || 0;
          }
        }
      });
      observer.observe({ type: 'resource', buffered: false });

      flushTimerRef.current = setInterval(flushDataUsage, 60_000);

      return () => {
        observer.disconnect();
        if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      };
    } catch {
      // PerformanceObserver not supported
    }
  }, [user, flushDataUsage]);
};