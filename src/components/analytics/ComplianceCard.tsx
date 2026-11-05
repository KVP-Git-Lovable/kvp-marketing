import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, MapPinOff, UserX, Navigation, Smartphone } from "lucide-react";

interface ComplianceCardProps {
  appNotInstalled: number;
  gpsDisabled: number;
  notLoggedIn: number;
  locationSpoofing: number;
  appNotUpdated: number;
}

export const ComplianceCard = ({
  appNotInstalled,
  gpsDisabled,
  notLoggedIn,
  locationSpoofing,
  appNotUpdated
}: ComplianceCardProps) => {
  const items = [
    { label: 'App Not Installed', value: appNotInstalled, icon: Smartphone, color: 'text-orange-500' },
    { label: 'GPS Disabled', value: gpsDisabled, icon: MapPinOff, color: 'text-red-500' },
    { label: 'Not Logged in', value: notLoggedIn, icon: UserX, color: 'text-yellow-600' },
    { label: 'Location Spoofing Activated', value: locationSpoofing, icon: Navigation, color: 'text-red-600' },
    { label: 'App not updated', value: appNotUpdated, icon: AlertCircle, color: 'text-blue-500' },
  ];

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Compliance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className={`font-bold min-w-[24px] ${item.color}`}>{item.value}</span>
                <span className="text-muted-foreground">{item.label}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
