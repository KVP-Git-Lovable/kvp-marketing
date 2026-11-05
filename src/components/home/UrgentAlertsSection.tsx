import { AlertTriangle, Target, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface UrgentAlertsSectionProps {
  urgentItems: {
    pendingPayments: Array<{
      id: string;
      name: string;
      amount: number;
      phone: string;
    }>;
    priorityRetailers: Array<{
      id: string;
      name: string;
      daysSinceVisit: number;
      priority: string;
    }>;
  };
}

export const UrgentAlertsSection = ({ urgentItems }: UrgentAlertsSectionProps) => {
  const navigate = useNavigate();

  const hasAlerts = urgentItems.pendingPayments.length > 0 || urgentItems.priorityRetailers.length > 0;

  if (!hasAlerts) {
    return null;
  }

  const totalPending = urgentItems.pendingPayments.reduce((sum, item) => sum + item.amount, 0);

  const formatAmount = (amount: number) => {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
    return `₹${amount}`;
  };

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        Urgent Actions
      </h2>

      {urgentItems.pendingPayments.length > 0 && (
        <Card className="border-destructive/30 bg-gradient-to-r from-destructive/10 to-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-destructive">Pending Payments</p>
                <p className="text-xs text-muted-foreground">
                  {urgentItems.pendingPayments.length} retailers owe {formatAmount(totalPending)}
                </p>
              </div>
            </div>
            <div className="space-y-2 mb-3">
              {urgentItems.pendingPayments.slice(0, 3).map(item => (
                <div key={item.id} className="flex items-center justify-between text-xs bg-background/50 rounded p-2">
                  <span className="font-medium truncate flex-1">{item.name}</span>
                  <span className="text-destructive font-bold ml-2">{formatAmount(item.amount)}</span>
                </div>
              ))}
            </div>
            <Button 
              onClick={() => navigate('/my-retailers')}
              variant="outline"
              size="sm"
              className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
            >
              Collect Payments →
            </Button>
          </CardContent>
        </Card>
      )}

      {urgentItems.priorityRetailers.length > 0 && (
        <Card className="border-warning/30 bg-gradient-to-r from-warning/10 to-warning/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center flex-shrink-0">
                <Target className="h-5 w-5 text-warning-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-warning-foreground">Priority Retailers</p>
                <p className="text-xs text-muted-foreground">
                  {urgentItems.priorityRetailers.length} high-priority retailers need attention
                </p>
              </div>
            </div>
            <div className="space-y-2 mb-3">
              {urgentItems.priorityRetailers.slice(0, 3).map(item => (
                <div key={item.id} className="flex items-center justify-between text-xs bg-background/50 rounded p-2">
                  <span className="font-medium truncate flex-1">{item.name}</span>
                  <span className="text-warning-foreground ml-2">{item.daysSinceVisit}d ago</span>
                </div>
              ))}
            </div>
            <Button 
              onClick={() => navigate('/my-retailers')}
              variant="outline"
              size="sm"
              className="w-full border-warning text-warning-foreground hover:bg-warning hover:text-warning-foreground"
            >
              Visit Today →
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
