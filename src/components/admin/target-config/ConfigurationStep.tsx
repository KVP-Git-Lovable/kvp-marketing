import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowRight, Settings } from 'lucide-react';

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

interface ConfigurationStepProps {
  config: TargetConfig;
  fyYear: number;
  onConfigChange: (config: TargetConfig) => void;
  onNext: () => void;
  isSaving: boolean;
}

const QUANTITY_UNITS = ['Kg', 'Units', 'Liters', 'Pcs', 'Boxes', 'Tonnes', 'Cartons'];

export function ConfigurationStep({ config, fyYear, onConfigChange, onNext, isSaving }: ConfigurationStepProps) {
  const handleBasisChange = (field: 'enable_quantity' | 'enable_revenue' | 'enable_visits', checked: boolean) => {
    onConfigChange({ ...config, [field]: checked });
  };

  const handleParameterChange = (param: keyof TargetConfig['enabled_parameters'], checked: boolean) => {
    onConfigChange({
      ...config,
      enabled_parameters: {
        ...config.enabled_parameters,
        [param]: checked,
      },
    });
  };

  const hasAtLeastOneBasis = config.enable_quantity || config.enable_revenue || config.enable_visits;
  const hasAtLeastOneParameter = Object.values(config.enabled_parameters).some(v => v);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Step 1: Configure Target Parameters for FY {fyYear - 1}-{String(fyYear).slice(-2)}
        </CardTitle>
        <CardDescription>
          Define what metrics and parameters to track for targets this financial year
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Target Basis */}
        <div className="space-y-4">
          <Label className="text-base font-semibold">Target Basis</Label>
          <p className="text-sm text-muted-foreground">Select which metrics to track for targets</p>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="enable_quantity"
                checked={config.enable_quantity}
                onCheckedChange={(checked) => handleBasisChange('enable_quantity', !!checked)}
              />
              <Label htmlFor="enable_quantity" className="font-normal cursor-pointer">
                Quantity
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="enable_revenue"
                checked={config.enable_revenue}
                onCheckedChange={(checked) => handleBasisChange('enable_revenue', !!checked)}
              />
              <Label htmlFor="enable_revenue" className="font-normal cursor-pointer">
                Revenue (₹)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="enable_visits"
                checked={config.enable_visits}
                onCheckedChange={(checked) => handleBasisChange('enable_visits', !!checked)}
              />
              <Label htmlFor="enable_visits" className="font-normal cursor-pointer">
                Productive Visits
              </Label>
            </div>
          </div>
        </div>

        {/* Parameters */}
        <div className="space-y-4">
          <Label className="text-base font-semibold">Target Parameters</Label>
          <p className="text-sm text-muted-foreground">Select which breakdowns are available for targets</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {Object.entries({
              product: 'Product-wise',
              retailer: 'Retailer-wise',
              new_retailer: 'New Retailer Target',
              beat: 'Beat-wise',
              distributor: 'Distributor-wise',
              territory: 'Territory-wise',
              monthly: 'Month-wise',
            }).map(([key, label]) => (
              <div key={key} className="flex items-center space-x-2">
                <Checkbox
                  id={`param_${key}`}
                  checked={config.enabled_parameters[key as keyof typeof config.enabled_parameters]}
                  onCheckedChange={(checked) => handleParameterChange(key as keyof typeof config.enabled_parameters, !!checked)}
                />
                <Label htmlFor={`param_${key}`} className="font-normal cursor-pointer">
                  {label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Quantity Unit */}
        {config.enable_quantity && (
          <div className="space-y-2">
            <Label className="text-base font-semibold">Quantity Unit</Label>
            <p className="text-sm text-muted-foreground">Default unit for quantity targets</p>
            <Select 
              value={config.quantity_unit} 
              onValueChange={(v) => onConfigChange({ ...config, quantity_unit: v })}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUANTITY_UNITS.map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Next Button */}
        <div className="pt-4 flex justify-end">
          <Button 
            onClick={onNext} 
            disabled={!hasAtLeastOneBasis || !hasAtLeastOneParameter || isSaving}
          >
            Save & Continue
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
