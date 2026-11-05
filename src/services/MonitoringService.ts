import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * Custom Capacitor plugin bridge for Firebase Performance Monitoring.
 */
interface FirebasePerformancePlugin {
  startTrace(options: { traceName: string }): Promise<void>;
  stopTrace(options: { traceName: string }): Promise<void>;
  putAttribute(options: { traceName: string; attribute: string; value: string }): Promise<void>;
}

const FirebasePerformance = registerPlugin<FirebasePerformancePlugin>('FirebasePerformancePlugin');

class MonitoringService {
  private currentUserId: string | null = null;

  /**
   * Identifies the user for performance traces.
   */
  async identifyUser(userId: string) {
    this.currentUserId = userId;
    console.log(`[Performance] User ID ${userId} identified for traces.`);
  }

  /**
   * Measures the duration of an asynchronous action.
   */
  async trace<T>(traceName: string, action: () => Promise<T>): Promise<T> {
    if (!Capacitor.isNativePlatform()) {
      const startTime = performance.now();
      try {
        const result = await action();
        const duration = performance.now() - startTime;
        console.log(`[Performance-Web] Trace ${traceName} completed in ${duration.toFixed(2)}ms`);
        return result;
      } catch (error) {
        console.error(`[Performance-Web] Trace ${traceName} failed:`, error);
        throw error;
      }
    }

    // A. Start the timer on native side
    try {
      await FirebasePerformance.startTrace({ traceName });

      // B. Attach user_id if we have one
      if (this.currentUserId) {
        await FirebasePerformance.putAttribute({
          traceName: traceName,
          attribute: 'user_id',
          value: this.currentUserId,
        });
      }

      // C. Execute the action
      const result = await action();
      return result;
    } catch (error) {
      console.error(`[Performance-Native] Trace ${traceName} error:`, error);
      throw error;
    } finally {
      // D. Always stop the timer
      try {
        await FirebasePerformance.stopTrace({ traceName });
        console.log(`[Performance-Native] Trace ${traceName} completed.`);
      } catch (e) {
        console.warn(`[Performance-Native] Failed to stop trace: ${traceName}`, e);
      }
    }
  }

  /**
   * Clears the user ID on logout.
   */
  logout() {
    this.currentUserId = null;
  }
}

export const monitoring = new MonitoringService();
