import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { PeriodType } from './PeriodTypeSelector';

export interface PeriodTarget {
  periodType: 'biannual' | 'quarterly' | 'monthly';
  periodNumber: number;
  periodName: string;
  quantityTarget: number;
  revenueTarget: number;
  visitsTarget: number;
}

interface PeriodBreakdownGridProps {
  periodType: PeriodType;
  periods: PeriodTarget[];
  onPeriodChange: (periodNumber: number, field: 'quantityTarget' | 'revenueTarget' | 'visitsTarget', value: number) => void;
  enableQuantity: boolean;
  enableRevenue: boolean;
  enableVisits: boolean;
  quantityUnit: string;
  disabled?: boolean;
}

// FY month mapping (April = 1, March = 12)
const MONTH_NAMES = [
  'April', 'May', 'June', 'July', 'August', 'September',
  'October', 'November', 'December', 'January', 'February', 'March'
];

const QUARTER_MAPPING = {
  1: { name: 'Q1 (Apr-Jun)', months: [1, 2, 3], half: 1 },
  2: { name: 'Q2 (Jul-Sep)', months: [4, 5, 6], half: 1 },
  3: { name: 'Q3 (Oct-Dec)', months: [7, 8, 9], half: 2 },
  4: { name: 'Q4 (Jan-Mar)', months: [10, 11, 12], half: 2 },
};

const BIANNUAL_MAPPING = {
  1: { name: 'H1 (Apr-Sep)', quarters: [1, 2] },
  2: { name: 'H2 (Oct-Mar)', quarters: [3, 4] },
};

export function PeriodBreakdownGrid({
  periodType,
  periods,
  onPeriodChange,
  enableQuantity,
  enableRevenue,
  enableVisits,
  quantityUnit,
  disabled,
}: PeriodBreakdownGridProps) {
  const formatNumber = (num: number) => {
    return num > 0 ? new Intl.NumberFormat('en-IN').format(num) : '';
  };

  const parseNumber = (value: string) => {
    const cleaned = value.replace(/,/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  // Calculate rollup totals
  const calculateQuarterlyTotal = (quarterNum: number, field: 'quantityTarget' | 'revenueTarget' | 'visitsTarget') => {
    const monthNums = QUARTER_MAPPING[quarterNum as keyof typeof QUARTER_MAPPING].months;
    return periods
      .filter(p => p.periodType === 'monthly' && monthNums.includes(p.periodNumber))
      .reduce((sum, p) => sum + p[field], 0);
  };

  const calculateBiannualTotal = (halfNum: number, field: 'quantityTarget' | 'revenueTarget' | 'visitsTarget') => {
    const quarterNums = BIANNUAL_MAPPING[halfNum as keyof typeof BIANNUAL_MAPPING].quarters;
    if (periodType === 'quarterly') {
      return periods
        .filter(p => p.periodType === 'quarterly' && quarterNums.includes(p.periodNumber))
        .reduce((sum, p) => sum + p[field], 0);
    } else if (periodType === 'monthly') {
      return quarterNums.reduce((sum, q) => sum + calculateQuarterlyTotal(q, field), 0);
    }
    return periods
      .filter(p => p.periodType === 'biannual' && p.periodNumber === halfNum)
      .reduce((sum, p) => sum + p[field], 0);
  };

  const calculateAnnualTotal = (field: 'quantityTarget' | 'revenueTarget' | 'visitsTarget') => {
    return calculateBiannualTotal(1, field) + calculateBiannualTotal(2, field);
  };

  const getPeriod = (type: 'biannual' | 'quarterly' | 'monthly', num: number) => {
    return periods.find(p => p.periodType === type && p.periodNumber === num);
  };

  const renderInput = (
    periodNum: number,
    field: 'quantityTarget' | 'revenueTarget' | 'visitsTarget',
    placeholder: string
  ) => {
    const period = getPeriod(periodType as 'biannual' | 'quarterly' | 'monthly', periodNum);
    const value = period?.[field] ?? 0;

    return (
      <Input
        type="text"
        value={formatNumber(value)}
        onChange={(e) => onPeriodChange(periodNum, field, parseNumber(e.target.value))}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full"
      />
    );
  };

  const renderTotalRow = (label: string, quantityVal: number, revenueVal: number, visitsVal: number, className = '') => (
    <div className={`grid gap-4 py-2 px-3 bg-muted/50 rounded-md ${className}`} style={{ gridTemplateColumns: `180px repeat(${[enableQuantity, enableRevenue, enableVisits].filter(Boolean).length}, 1fr)` }}>
      <div className="font-semibold text-sm flex items-center">
        {label}
      </div>
      {enableQuantity && (
        <div className="text-sm font-medium text-primary">
          {formatNumber(quantityVal) || '0'} {quantityUnit}
        </div>
      )}
      {enableRevenue && (
        <div className="text-sm font-medium text-primary">
          ₹{formatNumber(revenueVal) || '0'}
        </div>
      )}
      {enableVisits && (
        <div className="text-sm font-medium text-primary">
          {formatNumber(visitsVal) || '0'}
        </div>
      )}
    </div>
  );

  const enabledColumnsCount = [enableQuantity, enableRevenue, enableVisits].filter(Boolean).length;

  if (enabledColumnsCount === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Please enable at least one metric (Quantity, Revenue, or Visits) to set period targets.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-4">
        {/* Header */}
        <div 
          className="grid gap-4 px-3 py-2 bg-muted rounded-md font-medium text-sm"
          style={{ gridTemplateColumns: `180px repeat(${enabledColumnsCount}, 1fr)` }}
        >
          <div>Period</div>
          {enableQuantity && <div>Quantity ({quantityUnit})</div>}
          {enableRevenue && <div>Revenue (₹)</div>}
          {enableVisits && <div>Visits</div>}
        </div>

        {/* Bi-Annual View */}
        {periodType === 'biannual' && (
          <div className="space-y-3">
            {[1, 2].map((halfNum) => (
              <div 
                key={halfNum}
                className="grid gap-4 px-3 items-center"
                style={{ gridTemplateColumns: `180px repeat(${enabledColumnsCount}, 1fr)` }}
              >
                <Label className="text-sm font-medium">
                  {BIANNUAL_MAPPING[halfNum as keyof typeof BIANNUAL_MAPPING].name}
                </Label>
                {enableQuantity && renderInput(halfNum, 'quantityTarget', `${quantityUnit}`)}
                {enableRevenue && renderInput(halfNum, 'revenueTarget', '₹')}
                {enableVisits && renderInput(halfNum, 'visitsTarget', 'Visits')}
              </div>
            ))}
            <Separator />
            {renderTotalRow(
              'FY Total',
              calculateAnnualTotal('quantityTarget'),
              calculateAnnualTotal('revenueTarget'),
              calculateAnnualTotal('visitsTarget')
            )}
          </div>
        )}

        {/* Quarterly View */}
        {periodType === 'quarterly' && (
          <div className="space-y-3">
            {/* H1 Section */}
            <div className="space-y-2">
              <Badge variant="outline" className="mb-2">H1 (Apr-Sep)</Badge>
              {[1, 2].map((qNum) => (
                <div 
                  key={qNum}
                  className="grid gap-4 px-3 items-center"
                  style={{ gridTemplateColumns: `180px repeat(${enabledColumnsCount}, 1fr)` }}
                >
                  <Label className="text-sm font-medium">
                    {QUARTER_MAPPING[qNum as keyof typeof QUARTER_MAPPING].name}
                  </Label>
                  {enableQuantity && renderInput(qNum, 'quantityTarget', `${quantityUnit}`)}
                  {enableRevenue && renderInput(qNum, 'revenueTarget', '₹')}
                  {enableVisits && renderInput(qNum, 'visitsTarget', 'Visits')}
                </div>
              ))}
              {renderTotalRow(
                'H1 Total',
                calculateBiannualTotal(1, 'quantityTarget'),
                calculateBiannualTotal(1, 'revenueTarget'),
                calculateBiannualTotal(1, 'visitsTarget')
              )}
            </div>

            <Separator />

            {/* H2 Section */}
            <div className="space-y-2">
              <Badge variant="outline" className="mb-2">H2 (Oct-Mar)</Badge>
              {[3, 4].map((qNum) => (
                <div 
                  key={qNum}
                  className="grid gap-4 px-3 items-center"
                  style={{ gridTemplateColumns: `180px repeat(${enabledColumnsCount}, 1fr)` }}
                >
                  <Label className="text-sm font-medium">
                    {QUARTER_MAPPING[qNum as keyof typeof QUARTER_MAPPING].name}
                  </Label>
                  {enableQuantity && renderInput(qNum, 'quantityTarget', `${quantityUnit}`)}
                  {enableRevenue && renderInput(qNum, 'revenueTarget', '₹')}
                  {enableVisits && renderInput(qNum, 'visitsTarget', 'Visits')}
                </div>
              ))}
              {renderTotalRow(
                'H2 Total',
                calculateBiannualTotal(2, 'quantityTarget'),
                calculateBiannualTotal(2, 'revenueTarget'),
                calculateBiannualTotal(2, 'visitsTarget')
              )}
            </div>

            <Separator />
            {renderTotalRow(
              'FY Total',
              calculateAnnualTotal('quantityTarget'),
              calculateAnnualTotal('revenueTarget'),
              calculateAnnualTotal('visitsTarget'),
              'bg-primary/10'
            )}
          </div>
        )}

        {/* Monthly View */}
        {periodType === 'monthly' && (
          <div className="space-y-3">
            {/* Render each quarter with its months */}
            {[1, 2, 3, 4].map((qNum) => {
              const quarter = QUARTER_MAPPING[qNum as keyof typeof QUARTER_MAPPING];
              const isH2Start = qNum === 3;
              
              return (
                <React.Fragment key={qNum}>
                  {qNum === 1 && <Badge variant="outline" className="mb-2">H1 (Apr-Sep)</Badge>}
                  {isH2Start && (
                    <>
                      <Separator />
                      {renderTotalRow(
                        'H1 Total',
                        calculateBiannualTotal(1, 'quantityTarget'),
                        calculateBiannualTotal(1, 'revenueTarget'),
                        calculateBiannualTotal(1, 'visitsTarget')
                      )}
                      <Separator />
                      <Badge variant="outline" className="mb-2">H2 (Oct-Mar)</Badge>
                    </>
                  )}
                  
                  <div className="space-y-2">
                    {quarter.months.map((monthNum) => (
                      <div 
                        key={monthNum}
                        className="grid gap-4 px-3 items-center"
                        style={{ gridTemplateColumns: `180px repeat(${enabledColumnsCount}, 1fr)` }}
                      >
                        <Label className="text-sm font-medium">
                          {MONTH_NAMES[monthNum - 1]}
                        </Label>
                        {enableQuantity && renderInput(monthNum, 'quantityTarget', `${quantityUnit}`)}
                        {enableRevenue && renderInput(monthNum, 'revenueTarget', '₹')}
                        {enableVisits && renderInput(monthNum, 'visitsTarget', 'Visits')}
                      </div>
                    ))}
                    {renderTotalRow(
                      `${quarter.name.split(' ')[0]} Total`,
                      calculateQuarterlyTotal(qNum, 'quantityTarget'),
                      calculateQuarterlyTotal(qNum, 'revenueTarget'),
                      calculateQuarterlyTotal(qNum, 'visitsTarget')
                    )}
                  </div>
                </React.Fragment>
              );
            })}

            <Separator />
            {renderTotalRow(
              'H2 Total',
              calculateBiannualTotal(2, 'quantityTarget'),
              calculateBiannualTotal(2, 'revenueTarget'),
              calculateBiannualTotal(2, 'visitsTarget')
            )}
            <Separator />
            {renderTotalRow(
              'FY Total',
              calculateAnnualTotal('quantityTarget'),
              calculateAnnualTotal('revenueTarget'),
              calculateAnnualTotal('visitsTarget'),
              'bg-primary/10'
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper to generate initial periods based on type
export function generateInitialPeriods(periodType: PeriodType): PeriodTarget[] {
  if (periodType === 'annual') return [];
  
  if (periodType === 'biannual') {
    return [
      { periodType: 'biannual', periodNumber: 1, periodName: 'H1 (Apr-Sep)', quantityTarget: 0, revenueTarget: 0, visitsTarget: 0 },
      { periodType: 'biannual', periodNumber: 2, periodName: 'H2 (Oct-Mar)', quantityTarget: 0, revenueTarget: 0, visitsTarget: 0 },
    ];
  }
  
  if (periodType === 'quarterly') {
    return [
      { periodType: 'quarterly', periodNumber: 1, periodName: 'Q1 (Apr-Jun)', quantityTarget: 0, revenueTarget: 0, visitsTarget: 0 },
      { periodType: 'quarterly', periodNumber: 2, periodName: 'Q2 (Jul-Sep)', quantityTarget: 0, revenueTarget: 0, visitsTarget: 0 },
      { periodType: 'quarterly', periodNumber: 3, periodName: 'Q3 (Oct-Dec)', quantityTarget: 0, revenueTarget: 0, visitsTarget: 0 },
      { periodType: 'quarterly', periodNumber: 4, periodName: 'Q4 (Jan-Mar)', quantityTarget: 0, revenueTarget: 0, visitsTarget: 0 },
    ];
  }
  
  // Monthly
  return MONTH_NAMES.map((name, idx) => ({
    periodType: 'monthly' as const,
    periodNumber: idx + 1,
    periodName: name,
    quantityTarget: 0,
    revenueTarget: 0,
    visitsTarget: 0,
  }));
}
