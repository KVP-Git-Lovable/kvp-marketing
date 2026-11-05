 import React, { useMemo } from 'react';
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
 import { Badge } from '@/components/ui/badge';
 import { Progress } from '@/components/ui/progress';
 import { cn } from '@/lib/utils';
 import { ProductMonthProgress, TargetBasis } from '@/hooks/useTeamTargetProgress';
 
 // FY months April to March
 const FY_MONTHS = [
   { number: 1, name: 'Apr', fullName: 'April' },
   { number: 2, name: 'May', fullName: 'May' },
   { number: 3, name: 'Jun', fullName: 'June' },
   { number: 4, name: 'Jul', fullName: 'July' },
   { number: 5, name: 'Aug', fullName: 'August' },
   { number: 6, name: 'Sep', fullName: 'September' },
   { number: 7, name: 'Oct', fullName: 'October' },
   { number: 8, name: 'Nov', fullName: 'November' },
   { number: 9, name: 'Dec', fullName: 'December' },
   { number: 10, name: 'Jan', fullName: 'January' },
   { number: 11, name: 'Feb', fullName: 'February' },
   { number: 12, name: 'Mar', fullName: 'March' },
 ];
 
 interface ProductMonthBreakdownTableProps {
   data: ProductMonthProgress[];
   basis: TargetBasis;
   selectedMonthNumber?: number; // If provided, only show that month
 }
 
 export function ProductMonthBreakdownTable({ data, basis, selectedMonthNumber }: ProductMonthBreakdownTableProps) {
   // Group data by product
   const productGroups = useMemo(() => {
     const grouped: Record<string, {
       productId: string;
       productName: string;
       months: Record<number, ProductMonthProgress>;
       totals: { target: number; actual: number };
     }> = {};
 
     data.forEach(item => {
       if (!grouped[item.productId]) {
         grouped[item.productId] = {
           productId: item.productId,
           productName: item.productName,
           months: {},
           totals: { target: 0, actual: 0 },
         };
       }
       grouped[item.productId].months[item.monthNumber] = item;
       grouped[item.productId].totals.target += item.target;
       grouped[item.productId].totals.actual += item.actual;
     });
 
     return Object.values(grouped);
   }, [data]);
 
   // Filter months if a specific one is selected
   const visibleMonths = selectedMonthNumber 
     ? FY_MONTHS.filter(m => m.number === selectedMonthNumber)
     : FY_MONTHS;
 
   const formatValue = (value: number): string => {
     if (basis === 'revenue') {
       if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
       if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
       return `₹${value.toFixed(0)}`;
     } else {
       if (value >= 1000) return `${value.toFixed(0)}`;
       if (value >= 100) return `${value.toFixed(1)}`;
       return `${value.toFixed(2)}`;
     }
   };
 
   const getAchievementColor = (percentage: number): string => {
     if (percentage >= 100) return 'text-green-600';
     if (percentage >= 50) return 'text-yellow-600';
     return 'text-red-600';
   };
 
   const getAchievementBgColor = (percentage: number): string => {
     if (percentage >= 100) return 'bg-green-50';
     if (percentage >= 50) return 'bg-yellow-50';
     return 'bg-red-50';
   };
 
   if (productGroups.length === 0) {
     return (
       <div className="text-center py-4 text-muted-foreground text-sm">
         No product-month target data available
       </div>
     );
   }
 
   return (
     <div className="overflow-x-auto rounded-lg border">
       <Table>
         <TableHeader>
           <TableRow className="bg-muted/50">
             <TableHead className="font-semibold sticky left-0 bg-muted/50 z-10">Product</TableHead>
             {visibleMonths.map(month => (
               <TableHead key={month.number} className="text-center min-w-[90px]">
                 {month.name}
               </TableHead>
             ))}
             {!selectedMonthNumber && (
               <TableHead className="text-center min-w-[100px] font-semibold">Total</TableHead>
             )}
           </TableRow>
         </TableHeader>
         <TableBody>
           {productGroups.map((product) => {
             const totalPercentage = product.totals.target > 0 
               ? (product.totals.actual / product.totals.target) * 100 
               : 0;
             
             return (
               <TableRow key={product.productId} className="hover:bg-muted/30">
                 <TableCell className="font-medium sticky left-0 bg-background z-10 border-r">
                   {product.productName}
                 </TableCell>
                 {visibleMonths.map(month => {
                   const monthData = product.months[month.number];
                   if (!monthData) {
                     return (
                       <TableCell key={month.number} className="text-center text-muted-foreground">
                         -
                       </TableCell>
                     );
                   }
                   
                   return (
                     <TableCell 
                       key={month.number} 
                       className={cn(
                         "text-center text-xs p-2",
                         getAchievementBgColor(monthData.achievementPercentage)
                       )}
                     >
                       <div className="flex flex-col gap-0.5">
                         <span className={cn("font-medium", getAchievementColor(monthData.achievementPercentage))}>
                           {formatValue(monthData.actual)}/{formatValue(monthData.target)}
                         </span>
                         <span className="text-[10px] text-muted-foreground">
                           {monthData.achievementPercentage.toFixed(0)}%
                         </span>
                       </div>
                     </TableCell>
                   );
                 })}
                 {!selectedMonthNumber && (
                   <TableCell 
                     className={cn(
                       "text-center font-medium border-l",
                       getAchievementBgColor(totalPercentage)
                     )}
                   >
                     <div className="flex flex-col gap-0.5">
                       <span className={getAchievementColor(totalPercentage)}>
                         {formatValue(product.totals.actual)}/{formatValue(product.totals.target)}
                       </span>
                       <span className="text-xs text-muted-foreground">
                         {totalPercentage.toFixed(0)}%
                       </span>
                     </div>
                   </TableCell>
                 )}
               </TableRow>
             );
           })}
         </TableBody>
       </Table>
     </div>
   );
 }