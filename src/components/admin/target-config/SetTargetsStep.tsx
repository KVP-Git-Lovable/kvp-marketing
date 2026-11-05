import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Target, Package, IndianRupee, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TargetConfig {
  enable_quantity: boolean;
  enable_revenue: boolean;
  enable_visits: boolean;
  quantity_unit: string;
  enabled_parameters: {
    product: boolean;
    retailer: boolean;
    beat: boolean;
    distributor: boolean;
    territory: boolean;
    monthly: boolean;
  };
}

interface FYTargets {
  total_quantity_target: number;
  total_revenue_target: number;
  total_visits_target: number;
}

interface SetTargetsStepProps {
  config: TargetConfig;
  targets: FYTargets;
  fyYear: number;
  onTargetsChange: (targets: FYTargets) => void;
  onBack: () => void;
  onNext: () => void;
  isSaving: boolean;
}

export function SetTargetsStep({ 
  config, 
  targets, 
  fyYear, 
  onTargetsChange, 
  onBack, 
  onNext,
  isSaving 
}: SetTargetsStepProps) {
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-IN').format(num);
  };

  const parseNumber = (value: string) => {
    const cleaned = value.replace(/,/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const enabledBasis = [
    config.enable_quantity && 'Quantity',
    config.enable_revenue && 'Revenue',
    config.enable_visits && 'Visits',
  ].filter(Boolean);

  const enabledParams = Object.entries(config.enabled_parameters)
    .filter(([_, enabled]) => enabled)
    .map(([key]) => key.charAt(0).toUpperCase() + key.slice(1));

  const hasValidTargets = 
    (!config.enable_quantity || targets.total_quantity_target > 0) &&
    (!config.enable_revenue || targets.total_revenue_target > 0) &&
    (!config.enable_visits || targets.total_visits_target > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Step 2: Set FY Targets for FY {fyYear - 1}-{String(fyYear).slice(-2)}
        </CardTitle>
        <CardDescription>
          Define company-wide targets that will be allocated to users
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary of Configuration */}
        <div className="p-4 bg-muted/50 rounded-lg space-y-2">
          <p className="text-sm font-medium">Configuration Summary:</p>
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground">Tracking:</span>
            {enabledBasis.map((basis) => (
              <Badge key={basis} variant="secondary">{basis}</Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground">Parameters:</span>
            {enabledParams.map((param) => (
              <Badge key={param} variant="outline">{param}</Badge>
            ))}
          </div>
        </div>

        {/* Target Inputs */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {config.enable_quantity && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Quantity Target ({config.quantity_unit})
              </Label>
              <Input
                type="text"
                value={targets.total_quantity_target > 0 ? formatNumber(targets.total_quantity_target) : ''}
                onChange={(e) => onTargetsChange({ 
                  ...targets, 
                  total_quantity_target: parseNumber(e.target.value) 
                })}
                placeholder={`Enter quantity in ${config.quantity_unit}`}
              />
              <p className="text-xs text-muted-foreground">
                Total quantity target for the entire organization
              </p>
            </div>
          )}

          {config.enable_revenue && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <IndianRupee className="h-4 w-4" />
                Revenue Target (₹)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                <Input
                  type="text"
                  className="pl-7"
                  value={targets.total_revenue_target > 0 ? formatNumber(targets.total_revenue_target) : ''}
                  onChange={(e) => onTargetsChange({ 
                    ...targets, 
                    total_revenue_target: parseNumber(e.target.value) 
                  })}
                  placeholder="Enter revenue target"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Total revenue target for the entire organization
              </p>
            </div>
          )}

          {config.enable_visits && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Productive Visits Target
              </Label>
              <Input
                type="text"
                value={targets.total_visits_target > 0 ? formatNumber(targets.total_visits_target) : ''}
                onChange={(e) => onTargetsChange({ 
                  ...targets, 
                  total_visits_target: Math.round(parseNumber(e.target.value)) 
                })}
                placeholder="Enter number of visits"
              />
              <p className="text-xs text-muted-foreground">
                Total productive visits target for the organization
              </p>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="pt-4 flex justify-between">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button onClick={onNext} disabled={!hasValidTargets || isSaving}>
            Save & Continue
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
