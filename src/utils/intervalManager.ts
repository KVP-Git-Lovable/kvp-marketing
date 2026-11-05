/**
 * Centralized Interval Manager with Visibility API Support
 * Prevents duplicate intervals and pauses when app is in background
 * Significantly reduces CPU usage and improves battery life
 */

type IntervalCallback = () => void;
type IntervalId = string;

interface ManagedInterval {
  id: IntervalId;
  callback: IntervalCallback;
  intervalMs: number;
  timerId: ReturnType<typeof setTimeout> | null;
  lastRun: number;
  pausedAt: number | null;
  runWhenHidden: boolean;
}

class IntervalManager {
  private intervals: Map<IntervalId, ManagedInterval> = new Map();
  private isVisible: boolean = true;
  private isOnline: boolean = navigator.onLine;
  private listeners: Set<() => void> = new Set();

  constructor() {
    // Listen to visibility changes
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  private handleVisibilityChange = () => {
    const wasVisible = this.isVisible;
    this.isVisible = document.visibilityState === 'visible';
    
    if (this.isVisible && !wasVisible) {
      console.log('📱 [IntervalManager] App became visible, resuming intervals');
      this.resumeAllIntervals();
    } else if (!this.isVisible && wasVisible) {
      console.log('📱 [IntervalManager] App hidden, pausing non-essential intervals');
      this.pauseBackgroundIntervals();
    }
    
    this.notifyListeners();
  };

  private handleOnline = () => {
    this.isOnline = true;
    console.log('📶 [IntervalManager] Back online');
    this.notifyListeners();
  };

  private handleOffline = () => {
    this.isOnline = false;
    console.log('📶 [IntervalManager] Went offline');
    this.notifyListeners();
  };

  private notifyListeners() {
    this.listeners.forEach(listener => listener());
  }

  /**
   * Register a managed interval
   * @param id Unique identifier for this interval (prevents duplicates)
   * @param callback Function to call on each interval
   * @param intervalMs Interval duration in milliseconds
   * @param options Additional options
   */
  register(
    id: IntervalId,
    callback: IntervalCallback,
    intervalMs: number,
    options: { runWhenHidden?: boolean; immediate?: boolean } = {}
  ): () => void {
    // Clear existing interval with same ID (prevents duplicates)
    if (this.intervals.has(id)) {
      this.unregister(id);
    }

    const interval: ManagedInterval = {
      id,
      callback,
      intervalMs,
      timerId: null,
      lastRun: 0,
      pausedAt: null,
      runWhenHidden: options.runWhenHidden ?? false,
    };

    this.intervals.set(id, interval);

    // Run immediately if requested
    if (options.immediate) {
      this.runInterval(interval);
    }

    // Start the interval
    this.startInterval(interval);

    // Return cleanup function
    return () => this.unregister(id);
  }

  private startInterval(interval: ManagedInterval) {
    if (interval.timerId) {
      clearTimeout(interval.timerId);
    }

    const shouldRun = this.isVisible || interval.runWhenHidden;
    
    if (!shouldRun) {
      interval.pausedAt = Date.now();
      return;
    }

    interval.timerId = setTimeout(() => {
      this.runInterval(interval);
      this.startInterval(interval); // Reschedule
    }, interval.intervalMs);
  }

  private runInterval(interval: ManagedInterval) {
    // Skip if offline and callback needs network
    if (!this.isVisible && !interval.runWhenHidden) {
      return;
    }

    interval.lastRun = Date.now();
    interval.pausedAt = null;

    try {
      interval.callback();
    } catch (error) {
      console.error(`[IntervalManager] Error in interval "${interval.id}":`, error);
    }
  }

  private pauseBackgroundIntervals() {
    this.intervals.forEach(interval => {
      if (!interval.runWhenHidden && interval.timerId) {
        clearTimeout(interval.timerId);
        interval.timerId = null;
        interval.pausedAt = Date.now();
      }
    });
  }

  private resumeAllIntervals() {
    this.intervals.forEach(interval => {
      if (interval.pausedAt !== null) {
        const timeSincePause = Date.now() - interval.pausedAt;
        const timeSinceLastRun = Date.now() - interval.lastRun;
        
        // If enough time has passed, run immediately
        if (timeSinceLastRun >= interval.intervalMs) {
          this.runInterval(interval);
        }
        
        this.startInterval(interval);
      }
    });
  }

  /**
   * Unregister an interval by ID
   */
  unregister(id: IntervalId) {
    const interval = this.intervals.get(id);
    if (interval) {
      if (interval.timerId) {
        clearTimeout(interval.timerId);
      }
      this.intervals.delete(id);
    }
  }

  /**
   * Check if app is currently visible
   */
  getIsVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Check if device is online
   */
  getIsOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Get count of active intervals (for debugging)
   */
  getActiveCount(): number {
    return this.intervals.size;
  }

  /**
   * Subscribe to visibility/online state changes
   */
  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Cleanup all intervals
   */
  cleanup() {
    this.intervals.forEach(interval => {
      if (interval.timerId) {
        clearTimeout(interval.timerId);
      }
    });
    this.intervals.clear();
  }
}

// Singleton instance
export const intervalManager = new IntervalManager();

/**
 * React hook for using managed intervals
 */
export function useVisibility() {
  const [isVisible, setIsVisible] = useState(intervalManager.getIsVisible());
  const [isOnline, setIsOnline] = useState(intervalManager.getIsOnline());

  useEffect(() => {
    const unsubscribe = intervalManager.subscribe(() => {
      setIsVisible(intervalManager.getIsVisible());
      setIsOnline(intervalManager.getIsOnline());
    });

    return unsubscribe;
  }, []);

  return { isVisible, isOnline };
}

// Need to import useState/useEffect for the hook
import { useState, useEffect } from 'react';

/**
 * React hook for creating managed intervals
 * Automatically handles cleanup, visibility, and prevents duplicates
 */
export function useManagedInterval(
  id: string,
  callback: () => void,
  intervalMs: number,
  options: { 
    enabled?: boolean; 
    runWhenHidden?: boolean;
    immediate?: boolean;
  } = {}
) {
  const { enabled = true, runWhenHidden = false, immediate = false } = options;

  useEffect(() => {
    if (!enabled) return;

    const unregister = intervalManager.register(id, callback, intervalMs, {
      runWhenHidden,
      immediate,
    });

    return unregister;
  }, [id, callback, intervalMs, enabled, runWhenHidden, immediate]);
}

/**
 * Utility to debounce function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * Utility to throttle function calls
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}
