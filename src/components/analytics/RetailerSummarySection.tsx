 import { useState, useEffect, useCallback } from 'react';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
 import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
 import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
 import { ScrollArea } from '@/components/ui/scroll-area';
 import { RefreshCw, Store, AlertTriangle, TrendingUp, ChevronRight } from 'lucide-react';
 import { supabase } from '@/integrations/supabase/client';
 import { format } from 'date-fns';
 import { cn } from '@/lib/utils';
 import { useIsMobile } from '@/hooks/use-mobile';
 import { useHindiToEnglish } from '@/hooks/useHindiToEnglish';
 
 interface RetailerOrderSummary {
   id: string;
   name: string;
   beat_name: string;
   user_id: string | null;
   user_name: string;
   orders_count: number;
   revenue: number;
 }
 
 interface RetailerSummarySectionProps {
   selectedUsers: string[];
   dateRange: { from: Date; to: Date };
   allUsers?: { id: string; full_name: string | null }[];
 }
 
// Batch size for pagination
const BATCH_SIZE = 500;

// Helper function to fetch all rows with pagination
async function fetchAllRows<T>(
  queryBuilder: any,
  selectColumns: string
): Promise<T[]> {
  const allRows: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await queryBuilder
      .select(selectColumns)
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error('Error fetching batch:', error);
      break;
    }

    if (data && data.length > 0) {
      allRows.push(...data);
      offset += BATCH_SIZE;
      hasMore = data.length === BATCH_SIZE;
    } else {
      hasMore = false;
    }
  }

  return allRows;
}

 export const RetailerSummarySection = ({ selectedUsers, dateRange, allUsers = [] }: RetailerSummarySectionProps) => {
   const isMobile = useIsMobile();
   const [loading, setLoading] = useState(false);
   const [retailersNoOrders, setRetailersNoOrders] = useState<RetailerOrderSummary[]>([]);
   const [retailersMostOrders, setRetailersMostOrders] = useState<RetailerOrderSummary[]>([]);
   const [showNoOrdersDialog, setShowNoOrdersDialog] = useState(false);
   const [showMostOrdersDialog, setShowMostOrdersDialog] = useState(false);
   
   const { translateTexts, getTranslated } = useHindiToEnglish();
 
   // Derive user IDs from user names
   const effectiveUserIds = selectedUsers.length === 0
     ? allUsers.map(u => u.id)
     : allUsers.filter(u => u.full_name && selectedUsers.includes(u.full_name)).map(u => u.id);
 
   const fetchRetailerSummary = useCallback(async () => {
     if (effectiveUserIds.length === 0 && allUsers.length === 0) return;
     
     setLoading(true);
     try {
       const fromDate = format(dateRange.from, 'yyyy-MM-dd');
       const toDate = format(dateRange.to, 'yyyy-MM-dd');
       const userIds = effectiveUserIds.length > 0 ? effectiveUserIds : allUsers.map(u => u.id);
 
       // Fetch all retailers with batch pagination
       const retailers: { id: string; name: string; beat_name: string; user_id: string | null }[] = [];
       let retailerOffset = 0;
       let hasMoreRetailers = true;

       while (hasMoreRetailers) {
         let query = supabase
           .from('retailers')
           .select('id, name, beat_name, user_id');
         
         if (userIds.length > 0) {
           query = query.in('user_id', userIds);
         }

         const { data, error } = await query.range(retailerOffset, retailerOffset + BATCH_SIZE - 1);

         if (error) {
           console.error('Error fetching retailers batch:', error);
           break;
         }

         if (data && data.length > 0) {
           retailers.push(...data);
           retailerOffset += BATCH_SIZE;
           hasMoreRetailers = data.length === BATCH_SIZE;
         } else {
           hasMoreRetailers = false;
         }
       }
 
       // Fetch ALL confirmed orders with batch pagination (to identify retailers with NO orders ever)
       const allOrders: { id: string; retailer_id: string | null }[] = [];
       let allOrdersOffset = 0;
       let hasMoreAllOrders = true;
 
       while (hasMoreAllOrders) {
         let query = supabase
           .from('orders')
           .select('id, retailer_id')
           .eq('status', 'confirmed');

         if (userIds.length > 0) {
           query = query.in('user_id', userIds);
         }

         const { data, error } = await query.range(allOrdersOffset, allOrdersOffset + BATCH_SIZE - 1);

         if (error) {
           console.error('Error fetching all orders batch:', error);
           break;
         }
 
         if (data && data.length > 0) {
           allOrders.push(...data);
           allOrdersOffset += BATCH_SIZE;
           hasMoreAllOrders = data.length === BATCH_SIZE;
         } else {
           hasMoreAllOrders = false;
         }
       }
 
       // Fetch orders within date range for "Most Orders" calculation with batch pagination
       const periodOrders: { id: string; retailer_id: string | null; total_amount: number | null; user_id: string | null }[] = [];
       let periodOrdersOffset = 0;
       let hasMorePeriodOrders = true;

       while (hasMorePeriodOrders) {
         let query = supabase
           .from('orders')
           .select('id, retailer_id, total_amount, user_id')
           .eq('status', 'confirmed')
           .gte('order_date', fromDate)
           .lte('order_date', toDate);

         if (userIds.length > 0) {
           query = query.in('user_id', userIds);
         }

         const { data, error } = await query.range(periodOrdersOffset, periodOrdersOffset + BATCH_SIZE - 1);

         if (error) {
           console.error('Error fetching period orders batch:', error);
           break;
         }

         if (data && data.length > 0) {
           periodOrders.push(...data);
           periodOrdersOffset += BATCH_SIZE;
           hasMorePeriodOrders = data.length === BATCH_SIZE;
         } else {
           hasMorePeriodOrders = false;
         }
       }
 
       // Create a map of user IDs to names
       const userNameMap: Record<string, string> = {};
       allUsers.forEach(u => {
         if (u.full_name) userNameMap[u.id] = u.full_name;
       });
 
       // Build set of retailers who have EVER placed a confirmed order
       const retailersWithAnyOrder = new Set<string>();
       allOrders.forEach(order => {
         if (order.retailer_id) {
           retailersWithAnyOrder.add(order.retailer_id);
         }
       });

       // Build retailer order counts for the selected period
       const retailerPeriodOrderMap = new Map<string, { count: number; revenue: number }>();
       periodOrders.forEach(order => {
         if (!order.retailer_id) return;
         const existing = retailerPeriodOrderMap.get(order.retailer_id) || { count: 0, revenue: 0 };
         existing.count += 1;
         existing.revenue += Number(order.total_amount || 0);
         retailerPeriodOrderMap.set(order.retailer_id, existing);
       });
 
       // Classify retailers
       const noOrders: RetailerOrderSummary[] = [];
       const withOrders: RetailerOrderSummary[] = [];
 
       retailers.forEach(retailer => {
         const hasAnyOrderEver = retailersWithAnyOrder.has(retailer.id);
         const periodOrderData = retailerPeriodOrderMap.get(retailer.id);
         
         const summary: RetailerOrderSummary = {
           id: retailer.id,
           name: retailer.name || 'Unknown',
           beat_name: retailer.beat_name || '-',
           user_id: retailer.user_id,
           user_name: retailer.user_id ? (userNameMap[retailer.user_id] || 'Unknown') : '-',
           orders_count: periodOrderData?.count || 0,
           revenue: periodOrderData?.revenue || 0
         };
 
         // "No Orders" = retailers who have NEVER placed any confirmed order
         if (!hasAnyOrderEver) {
           noOrders.push(summary);
         }
         
         // "Most Orders" = retailers with orders in the selected period
         if (periodOrderData && periodOrderData.count > 0) {
           withOrders.push(summary);
         }
       });
 
       // Sort by orders descending for most orders
       withOrders.sort((a, b) => b.orders_count - a.orders_count);
 
       setRetailersNoOrders(noOrders);
       setRetailersMostOrders(withOrders);
 
       // Translate names
       const textsToTranslate = [
         ...noOrders.map(r => r.name),
         ...noOrders.map(r => r.beat_name).filter(b => b !== '-'),
         ...withOrders.map(r => r.name),
         ...withOrders.map(r => r.beat_name).filter(b => b !== '-')
       ];
       if (textsToTranslate.length > 0) {
         translateTexts(textsToTranslate);
       }
     } catch (error) {
       console.error('Error fetching retailer summary:', error);
     } finally {
       setLoading(false);
     }
   }, [effectiveUserIds.join(','), dateRange.from, dateRange.to, allUsers.length]);
 
   useEffect(() => {
     fetchRetailerSummary();
   }, [fetchRetailerSummary]);
 
   return (
     <>
       <Card className="shadow-lg">
         <CardHeader>
           <div className="flex items-center gap-2">
             <Store className="h-5 w-5 text-primary" />
             <div>
               <CardTitle className="text-base sm:text-lg md:text-xl">Retailer Summary</CardTitle>
               <p className="text-sm text-muted-foreground">
                 Order activity by retailer • {format(dateRange.from, 'MMM dd')} - {format(dateRange.to, 'MMM dd, yyyy')}
               </p>
             </div>
           </div>
         </CardHeader>
         <CardContent>
           {loading ? (
             <div className="text-center py-8">
               <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
               <p className="text-muted-foreground">Loading retailer data...</p>
             </div>
           ) : (
             <div className="grid grid-cols-2 gap-3 sm:gap-4">
               {/* Retailers with No Orders */}
               <div 
                 className="p-4 rounded-lg border bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200/50 dark:border-amber-800/50 cursor-pointer hover:shadow-md transition-shadow"
                 onClick={() => setShowNoOrdersDialog(true)}
               >
                 <div className="flex items-center gap-2 mb-2">
                   <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50">
                     <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                   </div>
                   <span className="text-sm font-medium text-amber-700 dark:text-amber-300">No Orders</span>
                   <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
                 </div>
                 <p className={cn("font-bold text-amber-600 dark:text-amber-400", isMobile ? "text-xl" : "text-2xl")}>
                   {retailersNoOrders.length}
                 </p>
                 <p className="text-xs text-muted-foreground mt-1">Retailers without orders</p>
               </div>
 
               {/* Retailers with Most Orders */}
               <div 
                 className="p-4 rounded-lg border bg-gradient-to-br from-emerald-50/50 to-green-50/50 dark:from-emerald-950/20 dark:to-green-950/20 border-emerald-200/50 dark:border-emerald-800/50 cursor-pointer hover:shadow-md transition-shadow"
                 onClick={() => setShowMostOrdersDialog(true)}
               >
                 <div className="flex items-center gap-2 mb-2">
                   <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                     <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                   </div>
                   <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Active</span>
                   <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
                 </div>
                 <p className={cn("font-bold text-emerald-600 dark:text-emerald-400", isMobile ? "text-xl" : "text-2xl")}>
                   {retailersMostOrders.length}
                 </p>
                 <p className="text-xs text-muted-foreground mt-1">Retailers with orders</p>
               </div>
             </div>
           )}
         </CardContent>
       </Card>
 
       {/* No Orders Dialog */}
       <Dialog open={showNoOrdersDialog} onOpenChange={setShowNoOrdersDialog}>
         <DialogContent className="max-w-3xl max-h-[80vh]">
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2">
               <AlertTriangle className="h-5 w-5 text-amber-500" />
               Retailers with No Orders
             </DialogTitle>
             <p className="text-sm text-muted-foreground">
               {format(dateRange.from, 'MMM dd')} - {format(dateRange.to, 'MMM dd, yyyy')} • {retailersNoOrders.length} retailers
             </p>
           </DialogHeader>
           <ScrollArea className="max-h-[60vh]">
             <Table>
               <TableHeader className="sticky top-0 bg-muted z-10">
                 <TableRow>
                   <TableHead>Retailer Name</TableHead>
                   <TableHead>Beat</TableHead>
                   <TableHead>Assigned User</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {retailersNoOrders.length === 0 ? (
                   <TableRow>
                     <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                       All retailers have placed orders in this period
                     </TableCell>
                   </TableRow>
                 ) : (
                   retailersNoOrders.map((retailer) => (
                     <TableRow key={retailer.id}>
                       <TableCell className="font-medium">{getTranslated(retailer.name)}</TableCell>
                       <TableCell className="text-muted-foreground">{retailer.beat_name !== '-' ? getTranslated(retailer.beat_name) : '-'}</TableCell>
                       <TableCell>{retailer.user_name}</TableCell>
                     </TableRow>
                   ))
                 )}
               </TableBody>
             </Table>
           </ScrollArea>
         </DialogContent>
       </Dialog>
 
       {/* Most Orders Dialog */}
       <Dialog open={showMostOrdersDialog} onOpenChange={setShowMostOrdersDialog}>
         <DialogContent className="max-w-4xl max-h-[80vh]">
           <DialogHeader>
             <DialogTitle className="flex items-center gap-2">
               <TrendingUp className="h-5 w-5 text-emerald-500" />
               Retailers with Most Orders
             </DialogTitle>
             <p className="text-sm text-muted-foreground">
               {format(dateRange.from, 'MMM dd')} - {format(dateRange.to, 'MMM dd, yyyy')} • Sorted by order count
             </p>
           </DialogHeader>
           <ScrollArea className="max-h-[60vh]">
             <Table>
               <TableHeader className="sticky top-0 bg-muted z-10">
                 <TableRow>
                   <TableHead>Retailer Name</TableHead>
                   <TableHead>Beat</TableHead>
                   <TableHead>Assigned User</TableHead>
                   <TableHead className="text-right">Orders</TableHead>
                   <TableHead className="text-right">Revenue</TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {retailersMostOrders.length === 0 ? (
                   <TableRow>
                     <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                       No orders in this period
                     </TableCell>
                   </TableRow>
                 ) : (
                   retailersMostOrders.map((retailer) => (
                     <TableRow key={retailer.id}>
                       <TableCell className="font-medium">{getTranslated(retailer.name)}</TableCell>
                       <TableCell className="text-muted-foreground">{retailer.beat_name !== '-' ? getTranslated(retailer.beat_name) : '-'}</TableCell>
                       <TableCell>{retailer.user_name}</TableCell>
                       <TableCell className="text-right font-semibold">{retailer.orders_count}</TableCell>
                       <TableCell className="text-right font-semibold">₹{retailer.revenue.toLocaleString()}</TableCell>
                     </TableRow>
                   ))
                 )}
               </TableBody>
             </Table>
           </ScrollArea>
         </DialogContent>
       </Dialog>
     </>
   );
 };