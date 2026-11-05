import { useCallback, useRef, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useManagedInterval } from "@/utils/intervalManager";
import { logBatteryStatus } from "@/utils/batteryMonitor";

const BATTERY_CHECK_INTERVAL = 15 * 60 * 1000; // 15 minutes

export function useBatteryMonitor() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const userIdRef = useRef(userId);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  // Stable callback that never changes reference
  const checkBattery = useCallback(() => {
    if (userIdRef.current) {
      logBatteryStatus(userIdRef.current);
    }
  }, []);

  // Battery logging disabled for now
  // useManagedInterval('battery-monitor', checkBattery, BATTERY_CHECK_INTERVAL, {
  //   enabled: !!userId,
  //   runWhenHidden: false,
  //   immediate: true,
  // });
}
