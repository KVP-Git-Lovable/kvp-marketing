 import React, { useState, useEffect } from 'react';
 import { Input } from '@/components/ui/input';
 import { Label } from '@/components/ui/label';
 import { Button } from '@/components/ui/button';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Badge } from '@/components/ui/badge';
 import { Switch } from '@/components/ui/switch';
 import { Separator } from '@/components/ui/separator';
 import { AlertCircle, CheckCircle2, Equal, PenLine } from 'lucide-react';
 import { cn } from '@/lib/utils';
 
 interface MonthlyTarget {
   monthNumber: number;
   monthName: string;
   quantityTarget: number;
   revenueTarget: number;
   visitsTarget: number;
 }
 
 interface AnnualMonthlyBreakdownProps {
   totalQuantity: number;
   totalRevenue: number;
   totalVisits: number;
   enableQuantity: boolean;
   enableRevenue: boolean;
   enableVisits: boolean;
   quantityUnit: string;
   monthlyTargets: MonthlyTarget[];
   onMonthlyTargetsChange: (targets: MonthlyTarget[]) => void;
   showBreakdown: boolean;
   onToggleBreakdown: (show: boolean) => void;
 }
 
 const MONTH_NAMES = [
   'April', 'May', 'June', 'July', 'August', 'September',
   'October', 'November', 'December', 'January', 'February', 'March'
 ];
 
 const QUARTER_MAPPING: Record<number, { name: string; months: number[] }> = {
   1: { name: 'Q1', months: [1, 2, 3] },
   2: { name: 'Q2', months: [4, 5, 6] },
   3: { name: 'Q3', months: [7, 8, 9] },
   4: { name: 'Q4', months: [10, 11, 12] },
 };
 
 export function AnnualMonthlyBreakdown({
   totalQuantity,
   totalRevenue,
   totalVisits,
   enableQuantity,
   enableRevenue,
   enableVisits,
   quantityUnit,
   monthlyTargets,
   onMonthlyTargetsChange,
   showBreakdown,
   onToggleBreakdown,
 }: AnnualMonthlyBreakdownProps) {
   const [isManualMode, setIsManualMode] = useState(false);
  const [localInputs, setLocalInputs] = useState<Record<string, string>>({});
 
   const formatNumber = (num: number) => {
     return num > 0 ? new Intl.NumberFormat('en-IN').format(Math.round(num * 100) / 100) : '';
   };
 
   const parseNumber = (value: string) => {
    if (!value || value === '') return 0;
    // Remove thousand separators (commas) but keep decimal point
    const cleaned = value.replace(/,/g, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
   };
 
  // Handle input change - store raw value for typing
  const handleInputChange = (monthNumber: number, field: string, value: string) => {
    const key = `${monthNumber}-${field}`;
    setLocalInputs(prev => ({ ...prev, [key]: value }));
  };

  // Handle blur - parse and update actual value
  const handleInputBlur = (monthNumber: number, field: 'quantityTarget' | 'revenueTarget' | 'visitsTarget', value: string) => {
    const key = `${monthNumber}-${field}`;
    const parsedValue = field === 'visitsTarget' ? Math.round(parseNumber(value)) : parseNumber(value);
    handleMonthChange(monthNumber, field, parsedValue);
    // Clear local input after blur
    setLocalInputs(prev => {
      const newInputs = { ...prev };
      delete newInputs[key];
      return newInputs;
    });
  };

  // Get display value - show local input if typing, otherwise formatted value
  const getDisplayValue = (monthNumber: number, field: string, actualValue: number) => {
    const key = `${monthNumber}-${field}`;
    if (localInputs[key] !== undefined) {
      return localInputs[key];
    }
    return formatNumber(actualValue);
  };

   // Initialize or update monthly targets when toggling breakdown ON or when totals change
   useEffect(() => {
     if (showBreakdown && !isManualMode) {
       distributeEqually();
     }
   }, [showBreakdown, totalQuantity, totalRevenue, totalVisits, isManualMode]);
 
   const distributeEqually = () => {
     const newTargets = MONTH_NAMES.map((name, idx) => ({
       monthNumber: idx + 1,
       monthName: name,
       quantityTarget: totalQuantity / 12,
       revenueTarget: totalRevenue / 12,
       visitsTarget: Math.round(totalVisits / 12),
     }));
     onMonthlyTargetsChange(newTargets);
   };
 
   const handleMonthChange = (monthNumber: number, field: 'quantityTarget' | 'revenueTarget' | 'visitsTarget', value: number) => {
     const updated = monthlyTargets.map(m =>
       m.monthNumber === monthNumber ? { ...m, [field]: value } : m
     );
     onMonthlyTargetsChange(updated);
   };
 
   // Calculate totals from monthly breakdown
   const allocatedQuantity = monthlyTargets.reduce((sum, m) => sum + (m.quantityTarget || 0), 0);
   const allocatedRevenue = monthlyTargets.reduce((sum, m) => sum + (m.revenueTarget || 0), 0);
   const allocatedVisits = monthlyTargets.reduce((sum, m) => sum + (m.visitsTarget || 0), 0);
 
   // Calculate remaining/exceeded
   const remainingQuantity = totalQuantity - allocatedQuantity;
   const remainingRevenue = totalRevenue - allocatedRevenue;
   const remainingVisits = totalVisits - allocatedVisits;
 
   const hasAnyTarget = totalQuantity > 0 || totalRevenue > 0 || totalVisits > 0;
 
   // Validation status
   const getValidationStatus = (remaining: number, total: number) => {
     if (total === 0) return 'neutral';
     if (Math.abs(remaining) < 0.01) return 'balanced';
     if (remaining > 0) return 'remaining';
     return 'exceeded';
   };
 
   const quantityStatus = getValidationStatus(remainingQuantity, totalQuantity);
   const revenueStatus = getValidationStatus(remainingRevenue, totalRevenue);
   const visitsStatus = getValidationStatus(remainingVisits, totalVisits);
 
   const getStatusColor = (status: string) => {
     switch (status) {
       case 'balanced': return 'text-green-600 bg-green-50 border-green-200';
       case 'remaining': return 'text-amber-600 bg-amber-50 border-amber-200';
       case 'exceeded': return 'text-red-600 bg-red-50 border-red-200';
       default: return 'text-muted-foreground bg-muted';
     }
   };
 
   const getStatusIcon = (status: string) => {
     switch (status) {
       case 'balanced': return <CheckCircle2 className="h-4 w-4" />;
       case 'remaining': 
       case 'exceeded': return <AlertCircle className="h-4 w-4" />;
       default: return null;
     }
   };
 
   const getQuarterTotal = (quarterNum: number, field: 'quantityTarget' | 'revenueTarget' | 'visitsTarget') => {
     const monthNums = QUARTER_MAPPING[quarterNum].months;
     return monthlyTargets
       .filter(m => monthNums.includes(m.monthNumber))
       .reduce((sum, m) => sum + (m[field] || 0), 0);
   };
 
   const enabledColumnsCount = [enableQuantity, enableRevenue, enableVisits].filter(Boolean).length;
 
   if (!hasAnyTarget) {
     return null;
   }
 
   return (
     <div className="space-y-4">
       <div className="flex items-center justify-between">
         <div className="flex items-center gap-2">
           <Switch
             id="monthly-split"
             checked={showBreakdown}
             onCheckedChange={onToggleBreakdown}
           />
           <Label htmlFor="monthly-split" className="text-sm font-medium cursor-pointer">
             Show Monthly Split
           </Label>
         </div>
         
         {showBreakdown && (
           <div className="flex items-center gap-2">
             <Button
               type="button"
               variant={!isManualMode ? 'default' : 'outline'}
               size="sm"
               onClick={() => {
                 setIsManualMode(false);
                 distributeEqually();
               }}
               className="gap-1"
             >
               <Equal className="h-3 w-3" />
               Equal Split
             </Button>
             <Button
               type="button"
               variant={isManualMode ? 'default' : 'outline'}
               size="sm"
               onClick={() => setIsManualMode(true)}
               className="gap-1"
             >
               <PenLine className="h-3 w-3" />
               Manual Edit
             </Button>
           </div>
         )}
       </div>
 
       {showBreakdown && (
         <Card>
           <CardHeader className="pb-3">
             <CardTitle className="text-sm flex items-center justify-between">
               <span>Monthly Target Breakdown</span>
               {isManualMode && (
                 <Badge variant="secondary" className="text-xs">Manual Mode</Badge>
               )}
             </CardTitle>
           </CardHeader>
           <CardContent className="space-y-4">
             {/* Validation Summary - Real-time feedback */}
             <div className={cn(
               "grid gap-3 p-3 rounded-lg border",
               enabledColumnsCount === 1 ? "grid-cols-1" : enabledColumnsCount === 2 ? "grid-cols-2" : "grid-cols-3"
             )}>
               {enableQuantity && (
                 <div className={cn("p-2 rounded-md border", getStatusColor(quantityStatus))}>
                   <div className="flex items-center gap-1 text-xs font-medium mb-1">
                     {getStatusIcon(quantityStatus)}
                     <span>Quantity ({quantityUnit})</span>
                   </div>
                   <div className="text-sm">
                     {quantityStatus === 'balanced' && 'Fully allocated ✓'}
                     {quantityStatus === 'remaining' && `Remaining: ${formatNumber(remainingQuantity)} ${quantityUnit}`}
                     {quantityStatus === 'exceeded' && `Exceeded by: ${formatNumber(Math.abs(remainingQuantity))} ${quantityUnit}`}
                     {quantityStatus === 'neutral' && 'No target set'}
                   </div>
                   <div className="text-xs mt-1 opacity-75">
                     Allocated: {formatNumber(allocatedQuantity)} / {formatNumber(totalQuantity)}
                   </div>
                 </div>
               )}
               {enableRevenue && (
                 <div className={cn("p-2 rounded-md border", getStatusColor(revenueStatus))}>
                   <div className="flex items-center gap-1 text-xs font-medium mb-1">
                     {getStatusIcon(revenueStatus)}
                     <span>Revenue (₹)</span>
                   </div>
                   <div className="text-sm">
                     {revenueStatus === 'balanced' && 'Fully allocated ✓'}
                     {revenueStatus === 'remaining' && `Remaining: ₹${formatNumber(remainingRevenue)}`}
                     {revenueStatus === 'exceeded' && `Exceeded by: ₹${formatNumber(Math.abs(remainingRevenue))}`}
                     {revenueStatus === 'neutral' && 'No target set'}
                   </div>
                   <div className="text-xs mt-1 opacity-75">
                     Allocated: ₹{formatNumber(allocatedRevenue)} / ₹{formatNumber(totalRevenue)}
                   </div>
                 </div>
               )}
               {enableVisits && (
                 <div className={cn("p-2 rounded-md border", getStatusColor(visitsStatus))}>
                   <div className="flex items-center gap-1 text-xs font-medium mb-1">
                     {getStatusIcon(visitsStatus)}
                     <span>Visits</span>
                   </div>
                   <div className="text-sm">
                     {visitsStatus === 'balanced' && 'Fully allocated ✓'}
                     {visitsStatus === 'remaining' && `Remaining: ${formatNumber(remainingVisits)}`}
                     {visitsStatus === 'exceeded' && `Exceeded by: ${formatNumber(Math.abs(remainingVisits))}`}
                     {visitsStatus === 'neutral' && 'No target set'}
                   </div>
                   <div className="text-xs mt-1 opacity-75">
                     Allocated: {formatNumber(allocatedVisits)} / {formatNumber(totalVisits)}
                   </div>
                 </div>
               )}
             </div>
 
             {/* Header Row */}
             <div 
               className="grid gap-3 px-3 py-2 bg-muted rounded-md font-medium text-sm"
               style={{ gridTemplateColumns: `140px repeat(${enabledColumnsCount}, 1fr)` }}
             >
               <div>Month</div>
               {enableQuantity && <div>Qty ({quantityUnit})</div>}
               {enableRevenue && <div>Revenue (₹)</div>}
               {enableVisits && <div>Visits</div>}
             </div>
 
             {/* Monthly Rows grouped by Quarter */}
             {[1, 2, 3, 4].map((qNum) => {
               const quarter = QUARTER_MAPPING[qNum];
               return (
                 <div key={qNum} className="space-y-2">
                   <Badge variant="outline" className="text-xs">
                     {quarter.name} ({quarter.months.map(m => MONTH_NAMES[m - 1].slice(0, 3)).join(', ')})
                   </Badge>
                   {quarter.months.map((monthNum) => {
                     const monthData = monthlyTargets.find(m => m.monthNumber === monthNum);
                     return (
                       <div
                         key={monthNum}
                         className="grid gap-3 px-3 items-center"
                         style={{ gridTemplateColumns: `140px repeat(${enabledColumnsCount}, 1fr)` }}
                       >
                         <Label className="text-sm font-medium">{MONTH_NAMES[monthNum - 1]}</Label>
                         {enableQuantity && (
                           <Input
                             type="text"
                            value={getDisplayValue(monthNum, 'quantityTarget', monthData?.quantityTarget || 0)}
                            onChange={(e) => handleInputChange(monthNum, 'quantityTarget', e.target.value)}
                            onBlur={(e) => handleInputBlur(monthNum, 'quantityTarget', e.target.value)}
                             disabled={!isManualMode}
                             className={cn(!isManualMode && "bg-muted")}
                           />
                         )}
                         {enableRevenue && (
                           <Input
                             type="text"
                            value={getDisplayValue(monthNum, 'revenueTarget', monthData?.revenueTarget || 0)}
                            onChange={(e) => handleInputChange(monthNum, 'revenueTarget', e.target.value)}
                            onBlur={(e) => handleInputBlur(monthNum, 'revenueTarget', e.target.value)}
                             disabled={!isManualMode}
                             className={cn(!isManualMode && "bg-muted")}
                           />
                         )}
                         {enableVisits && (
                           <Input
                             type="text"
                            value={getDisplayValue(monthNum, 'visitsTarget', monthData?.visitsTarget || 0)}
                            onChange={(e) => handleInputChange(monthNum, 'visitsTarget', e.target.value)}
                            onBlur={(e) => handleInputBlur(monthNum, 'visitsTarget', e.target.value)}
                             disabled={!isManualMode}
                             className={cn(!isManualMode && "bg-muted")}
                           />
                         )}
                       </div>
                     );
                   })}
                   {/* Quarter Subtotal */}
                   <div 
                     className="grid gap-3 px-3 py-1.5 bg-muted/50 rounded text-sm"
                     style={{ gridTemplateColumns: `140px repeat(${enabledColumnsCount}, 1fr)` }}
                   >
                     <div className="font-medium">{quarter.name} Total</div>
                     {enableQuantity && (
                       <div className="font-medium text-primary">
                         {formatNumber(getQuarterTotal(qNum, 'quantityTarget'))} {quantityUnit}
                       </div>
                     )}
                     {enableRevenue && (
                       <div className="font-medium text-primary">
                         ₹{formatNumber(getQuarterTotal(qNum, 'revenueTarget'))}
                       </div>
                     )}
                     {enableVisits && (
                       <div className="font-medium text-primary">
                         {formatNumber(getQuarterTotal(qNum, 'visitsTarget'))}
                       </div>
                     )}
                   </div>
                   {qNum < 4 && <Separator className="my-2" />}
                 </div>
               );
             })}
 
             {/* Grand Total */}
             <div 
               className="grid gap-3 px-3 py-2 bg-primary/10 rounded-md font-semibold text-sm"
               style={{ gridTemplateColumns: `140px repeat(${enabledColumnsCount}, 1fr)` }}
             >
               <div>FY Total (Allocated)</div>
               {enableQuantity && (
                 <div className={cn(
                   quantityStatus === 'exceeded' && 'text-red-600',
                   quantityStatus === 'remaining' && 'text-amber-600',
                   quantityStatus === 'balanced' && 'text-green-600'
                 )}>
                   {formatNumber(allocatedQuantity)} {quantityUnit}
                 </div>
               )}
               {enableRevenue && (
                 <div className={cn(
                   revenueStatus === 'exceeded' && 'text-red-600',
                   revenueStatus === 'remaining' && 'text-amber-600',
                   revenueStatus === 'balanced' && 'text-green-600'
                 )}>
                   ₹{formatNumber(allocatedRevenue)}
                 </div>
               )}
               {enableVisits && (
                 <div className={cn(
                   visitsStatus === 'exceeded' && 'text-red-600',
                   visitsStatus === 'remaining' && 'text-amber-600',
                   visitsStatus === 'balanced' && 'text-green-600'
                 )}>
                   {formatNumber(allocatedVisits)}
                 </div>
               )}
             </div>
           </CardContent>
         </Card>
       )}
     </div>
   );
 }
 
 // Helper to generate initial monthly targets
 export function generateInitialMonthlyTargets(): MonthlyTarget[] {
   return MONTH_NAMES.map((name, idx) => ({
     monthNumber: idx + 1,
     monthName: name,
     quantityTarget: 0,
     revenueTarget: 0,
     visitsTarget: 0,
   }));
 }