import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Battery, BatteryCharging, BatteryFull, BatteryLow, BatteryMedium, Monitor, Smartphone, Cpu, HardDrive } from "lucide-react";
import { Capacitor } from "@capacitor/core";

interface DeviceDetails {
  model: string;
  osVersion: string;
  operatingSystem: string;
  memUsedMB: number | null;
}

function getBatteryIcon(level: number, charging: boolean) {
  if (charging) return BatteryCharging;
  if (level >= 80) return BatteryFull;
  if (level >= 40) return BatteryMedium;
  if (level >= 15) return BatteryLow;
  return Battery;
}

function getBatteryColor(level: number, charging: boolean) {
  if (charging) return "text-blue-500";
  if (level >= 60) return "text-green-500";
  if (level >= 30) return "text-yellow-500";
  return "text-red-500";
}

async function fetchBattery(): Promise<{ level: number; charging: boolean } | null> {
  try {
    const { Device } = await import("@capacitor/device");
    const info = await Device.getBatteryInfo();
    if (info.batteryLevel != null) {
      return { level: Math.round(info.batteryLevel * 100), charging: info.isCharging ?? false };
    }
  } catch {
    try {
      const nav = navigator as any;
      if (typeof nav.getBattery === "function") {
        const b = await nav.getBattery();
        return { level: Math.round(b.level * 100), charging: b.charging ?? false };
      }
    } catch {}
  }
  return null;
}

async function fetchDeviceDetails(): Promise<DeviceDetails> {
  try {
    const { Device } = await import("@capacitor/device");
    const info = await Device.getInfo();
    return {
      model: info.model || "Unknown",
      osVersion: info.osVersion || "Unknown",
      operatingSystem: info.operatingSystem || "unknown",
      memUsedMB: info.memUsed != null ? Math.round(info.memUsed / 1048576) : null,
    };
  } catch {
    return {
      model: navigator.userAgent.includes("Mobile") ? "Mobile Device" : "Desktop",
      osVersion: "N/A",
      operatingSystem: navigator.platform || "unknown",
      memUsedMB: (performance as any).memory
        ? Math.round((performance as any).memory.usedJSHeapSize / 1048576)
        : null,
    };
  }
}

const REFRESH_INTERVAL = 15 * 60 * 1000; // 15 minutes

export function DeviceInfoCard() {
  const [battery, setBattery] = useState<{ level: number; charging: boolean } | null>(null);
  const [device, setDevice] = useState<DeviceDetails | null>(null);
  const isNative = Capacitor.isNativePlatform();

  const refresh = useCallback(async () => {
    const [battInfo, devInfo] = await Promise.all([fetchBattery(), fetchDeviceDetails()]);
    if (battInfo) setBattery(battInfo);
    setDevice(devInfo);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [refresh]);

  if (!battery && !device) return null;

  const BattIcon = battery ? getBatteryIcon(battery.level, battery.charging) : Battery;
  const battColor = battery ? getBatteryColor(battery.level, battery.charging) : "text-muted-foreground";
  const DeviceIcon = isNative ? Smartphone : Monitor;

  const osLabel = device
    ? `${device.operatingSystem.charAt(0).toUpperCase() + device.operatingSystem.slice(1)} ${device.osVersion}`
    : "";

  return (
    <Card className="border-border/50">
      <CardContent className="p-3">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Phone / PC Details
        </p>
        <div className="grid grid-cols-2 gap-2">
          {/* Device type */}
          <div className="flex items-center gap-1.5">
            <DeviceIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{isNative ? "Mobile" : "Browser"}</span>
          </div>
          {/* Battery */}
          {battery && (
            <div className="flex items-center gap-1.5">
              <BattIcon className={`h-3.5 w-3.5 ${battColor}`} />
              <span className={`text-xs font-semibold ${battColor}`}>{battery.level}%</span>
              {battery.charging && (
                <span className="text-[10px] text-blue-500 font-medium">⚡</span>
              )}
            </div>
          )}
          {/* Model */}
          {device && (
            <div className="flex items-center gap-1.5">
              <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground truncate" title={device.model}>{device.model}</span>
            </div>
          )}
          {/* OS */}
          {device && osLabel && (
            <div className="flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground truncate">{osLabel}</span>
            </div>
          )}
          {/* RAM */}
          {device?.memUsedMB != null && (
            <div className="col-span-2 flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">RAM Usage: ~{device.memUsedMB} MB</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
