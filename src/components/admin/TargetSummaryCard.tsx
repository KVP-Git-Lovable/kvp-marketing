import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package, IndianRupee, Users, CheckCircle2, FileText, Archive } from 'lucide-react';
import { type PlanStatus } from '@/hooks/useFYTargetPlans';

interface TargetConfig {
  target_plan_name?: string;
  enable_quantity: boolean;
  enable_revenue: boolean;
  enable_visits: boolean;
  quantity_unit: string;
  total_quantity_target: number;
  total_revenue_target: number;
  total_visits_target: number;
  is_locked?: boolean;
  plan_status?: PlanStatus;
}

interface TargetSummaryCardProps {
  config: TargetConfig;
  fyYear: number;
  selectedUserName?: string;
  allocatedQuantity?: number;
  allocatedRevenue?: number;
  allocatedVisits?: number;
}

const STATUS_BADGE: Record<string, { label: string; icon: React.ElementType; variant: 'default' | 'secondary' | 'outline' }> = {
  draft: { label: 'Draft', icon: FileText, variant: 'secondary' },
  active: { label: 'Active', icon: CheckCircle2, variant: 'default' },
  closed: { label: 'Closed', icon: Archive, variant: 'outline' },
};

export function TargetSummaryCard({
  config,
  fyYear,
  selectedUserName,
  allocatedQuantity = 0,
  allocatedRevenue = 0,
  allocatedVisits = 0,
}: TargetSummaryCardProps) {
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-IN').format(num);
  };

  const formatCurrency = (num: number) => {
    if (num >= 10000000) {
      return `₹${(num / 10000000).toFixed(2)} Cr`;
    } else if (num >= 100000) {
      return `₹${(num / 100000).toFixed(2)} L`;
    }
    return `₹${formatNumber(num)}`;
  };

  const effectiveStatus = config.plan_status || (config.is_locked ? 'active' : 'draft');
  const statusBadge = STATUS_BADGE[effectiveStatus] || STATUS_BADGE.draft;
  const BadgeIcon = statusBadge.icon;

  return (
    <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
      <CardContent className="py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-lg">
              Target: <span className="text-primary">{config.target_plan_name || 'FY Sales Plan'}</span>
            </h3>
            <Badge variant={statusBadge.variant} className="gap-1">
              <BadgeIcon className="h-3 w-3" />
              {statusBadge.label}
            </Badge>
          </div>
          <div className="text-sm font-medium text-muted-foreground bg-background/60 px-3 py-1 rounded-full">
            FY {fyYear - 1}-{String(fyYear).slice(-2)}
          </div>
        </div>

        <div className="mb-3">
          <span className="text-sm font-medium text-muted-foreground border-b-2 border-primary/30 pb-0.5">
            Total Target
          </span>
        </div>

        {selectedUserName && (
          <p className="text-sm text-muted-foreground mb-3">
            Allocating for: <span className="font-medium text-foreground">{selectedUserName}</span>
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {config.enable_quantity && (
            <div className="flex items-center gap-3 bg-background/70 rounded-lg p-3 border border-border/50">
              <div className="p-2 bg-primary/10 rounded-full">
                <Package className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Quantity</p>
                <p className="font-bold text-lg">
                  {formatNumber(config.total_quantity_target)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {config.quantity_unit}
                </p>
                {allocatedQuantity > 0 && (
                  <p className="text-xs text-primary mt-1">
                    Allocated: {formatNumber(allocatedQuantity)}
                  </p>
                )}
              </div>
            </div>
          )}

          {config.enable_visits && (
            <div className="flex items-center gap-3 bg-background/70 rounded-lg p-3 border border-border/50">
              <div className="p-2 bg-secondary/50 rounded-full">
                <Users className="h-4 w-4 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Productive Visits</p>
                <p className="font-bold text-lg">
                  {formatNumber(config.total_visits_target)}
                </p>
                <p className="text-xs text-muted-foreground">
                  visits
                </p>
                {allocatedVisits > 0 && (
                  <p className="text-xs text-primary mt-1">
                    Allocated: {formatNumber(allocatedVisits)}
                  </p>
                )}
              </div>
            </div>
          )}

          {config.enable_revenue && (
            <div className="flex items-center gap-3 bg-background/70 rounded-lg p-3 border border-border/50">
              <div className="p-2 bg-accent rounded-full">
                <IndianRupee className="h-4 w-4 text-accent-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Revenue</p>
                <p className="font-bold text-lg">
                  {formatCurrency(config.total_revenue_target)}
                </p>
                {allocatedRevenue > 0 && (
                  <p className="text-xs text-primary mt-1">
                    Allocated: {formatCurrency(allocatedRevenue)}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
