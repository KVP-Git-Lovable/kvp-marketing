import { supabase } from "@/integrations/supabase/client";

/**
 * Get battery info using Capacitor Device plugin or web fallback
 */
async function getBatteryInfo(): Promise<{ batteryLevel: number; isCharging: boolean } | null> {
  try {
    // Try Capacitor Device plugin first
    const { Device } = await import('@capacitor/device');
    const info = await Device.getBatteryInfo();
    if (info.batteryLevel != null) {
      return {
        batteryLevel: Math.round(info.batteryLevel * 100),
        isCharging: info.isCharging ?? false,
      };
    }
  } catch {
    // Capacitor not available, try web Battery API
    try {
      const nav = navigator as any;
      if (typeof nav.getBattery === 'function') {
        const battery = await nav.getBattery();
        return {
          batteryLevel: Math.round(battery.level * 100),
          isCharging: battery.charging ?? false,
        };
      }
    } catch {
      // Web Battery API not available either
    }
  }
  return null;
}

/**
 * Read battery status and insert into device_battery_logs
 */
export async function logBatteryStatus(userId: string): Promise<void> {
  const info = await getBatteryInfo();
  if (!info) {
    console.log('🔋 Battery API not available, skipping log');
    return;
  }

  // Delete rows older than 30 minutes for this user
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  await supabase
    .from('device_battery_logs' as any)
    .delete()
    .eq('user_id', userId)
    .lt('recorded_at', thirtyMinAgo);

  const { error } = await supabase.from('device_battery_logs' as any).insert({
    user_id: userId,
    battery_level: info.batteryLevel,
    is_charging: info.isCharging,
    recorded_at: new Date().toISOString(),
  });

  if (error) {
    console.warn('🔋 Failed to log battery status:', error.message);
  } else {
    console.log(`🔋 Battery logged: ${info.batteryLevel}% (charging: ${info.isCharging})`);
  }
}
