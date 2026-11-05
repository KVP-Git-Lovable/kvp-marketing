import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface BusinessSummary {
  totalBeats: number;
  totalRetailers: number;
  totalOrders: number;
  totalKg: number;
  totalPieces: number;
  totalRevenue: number;
  pendingPayments: number;
  /** Retailers first created inside the selected window — onboarding, not billing. */
  newRetailers: number;
  quantityByUnit: { [unit: string]: number }; // Track quantities by actual unit
  /** Visits planned vs productive in the window — field quality. */
  visitsPlanned: number;
  visitsProductive: number;
  /** Reps who logged any visit in the window, against the active roster. */
  repsActive: number;
  repsTotal: number;
  /** Cash actually collected in the window (can exceed billed when old dues clear). */
  collectedInPeriod: number;
  /** Same-length window immediately before this one, for direction. */
  prevPeriodRevenue: number;
  /** Open credit balances bucketed by age of the order. */
  ageing: { d0_30: number; d31_60: number; d60plus: number };
}

interface BeatDetail {
  beat_name: string;
  visits_count: number;
  orders_count: number;
  revenue: number;
}

interface RetailerDetail {
  id: string;
  name: string;
  beat_name: string;
  orders_count: number;
  revenue: number;
  pending_amount: number;
}

interface OrderDetail {
  id: string;
  order_date: string;
  retailer_name: string;
  total_amount: number;
  status: string;
}

interface ProductDetail {
  product_name: string;
  unit: string;
  quantity: number;
  revenue: number;
}

export interface NewRetailerDetail {
  id: string;
  name: string;
  beat_name: string;
  added_by: string;
  created_at: string;
  verified: boolean;
  orders_count: number;
  revenue: number;
}

interface PendingPaymentDetail {
  retailer_name: string;
  order_date: string;
  order_id: string;
  pending_amount: number;
  user_id?: string;
  user_name?: string;
}

/**
 * Weight of one order line expressed in KG.
 *
 * Returns 0 for non-weight units (PIECE etc.) — they belong to a different UOM
 * category and cannot be added to kilograms. The old version summed every unit
 * as-is, so 5 PIECE + 79 KG was reported as "84 KG"; a gram line would have been
 * 1000x out. Non-weight quantities are surfaced separately via quantityByUnit.
 */
const getKgQuantity = (quantity: unknown, unit?: unknown) => {
  const qty = Number(quantity || 0);
  if (!Number.isFinite(qty)) return 0;
  const u = String(unit ?? '').trim().toLowerCase();
  if (u === 'kg' || u === 'kgs' || u === 'kilogram' || u === 'kilograms') return qty;
  if (u === 'g' || u === 'gm' || u === 'gram' || u === 'grams') return qty / 1000;
  if (u === 'l' || u === 'litre' || u === 'liter') return qty;
  if (u === 'ml') return qty / 1000;
  return 0;
};

const getDisplayQuantity = (quantity: unknown, _unit?: unknown) => {
  const qty = Number(quantity || 0);
  return { quantity: Number.isFinite(qty) ? qty : 0, unit: 'PCs' };
};

export const useBusinessMetrics = () => {
  const [summary, setSummary] = useState<BusinessSummary>({
    totalBeats: 0,
    totalRetailers: 0,
    totalOrders: 0,
    totalKg: 0,
    totalPieces: 0,
    totalRevenue: 0,
    pendingPayments: 0,
    newRetailers: 0,
    quantityByUnit: {},
    visitsPlanned: 0,
    visitsProductive: 0,
    repsActive: 0,
    repsTotal: 0,
    collectedInPeriod: 0,
    prevPeriodRevenue: 0,
    ageing: { d0_30: 0, d31_60: 0, d60plus: 0 }
  });
  const [isLoading, setIsLoading] = useState(false);
  
  // Ref to prevent duplicate fetches
  const lastFetchKeyRef = useRef<string>('');
  const isFetchingRef = useRef(false);

  // Detail data states
  const [beatDetails, setBeatDetails] = useState<BeatDetail[]>([]);
  const [retailerDetails, setRetailerDetails] = useState<RetailerDetail[]>([]);
  const [orderDetails, setOrderDetails] = useState<OrderDetail[]>([]);
  const [productDetails, setProductDetails] = useState<ProductDetail[]>([]);
  const [pendingPaymentDetails, setPendingPaymentDetails] = useState<PendingPaymentDetail[]>([]);
  // One generic drilldown feeds the management cards, so each new metric needs
  // a query rather than its own state, dialog and export path.
  const [metricRows, setMetricRows] = useState<Record<string, any>[]>([]);
  const [metricMeta, setMetricMeta] = useState<{ title: string; columns: { key: string; label: string }[] }>(
    { title: '', columns: [] },
  );
  const [newRetailerDetails, setNewRetailerDetails] = useState<NewRetailerDetail[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const fetchSummary = useCallback(async (userIds: string[], dateRange: { from: Date; to: Date }, userNames?: string[]) => {
    // Create a fetch key to prevent duplicate requests
    const fetchKey = `${userIds.slice().sort().join(',')}-${dateRange.from.getTime()}-${dateRange.to.getTime()}`;
    
    // Skip if already fetching with the same parameters
    if (isFetchingRef.current && fetchKey === lastFetchKeyRef.current) {
      return;
    }
    
    // Skip if this exact fetch was already completed
    if (fetchKey === lastFetchKeyRef.current && !isLoading) {
      return;
    }
    
    lastFetchKeyRef.current = fetchKey;
    isFetchingRef.current = true;
    setIsLoading(true);
    
    try {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      // Fetch confirmed orders first, then map line items separately. Embedding order_items
      // here is fragile when PostgREST relationship metadata is stale, and caused 0 totals.
      const BATCH_SIZE = 1000;
      let allOrders: any[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        let ordersQuery = supabase
          .from('orders')
          .select(`
            id,
            total_amount,
            credit_pending_amount,
            retailer_id,
            user_id,
            beat_id,
            beat_name_snapshot
          `)
          .eq('status', 'confirmed')
          .gte('order_date', fromDate)
          .lte('order_date', toDate)
          .range(offset, offset + BATCH_SIZE - 1);

        if (userIds.length > 0) {
          ordersQuery = ordersQuery.in('user_id', userIds);
        }

        const { data: batch, error: ordersError } = await ordersQuery;
        if (ordersError) throw ordersError;

        if (batch && batch.length > 0) {
          allOrders = allOrders.concat(batch);
          offset += BATCH_SIZE;
          hasMore = batch.length === BATCH_SIZE;
        } else {
          hasMore = false;
        }
      }

      const orders = allOrders;
      const orderIds = orders.map(o => o.id).filter(Boolean);
      const retailerIds = [...new Set(orders.map(o => o.retailer_id).filter(Boolean))];
      const orderBeatKeys = new Set<string>();
      orders.forEach((order: any) => {
        const beatKey = order.beat_id || order.beat_name_snapshot;
        if (beatKey) orderBeatKeys.add(String(beatKey));
      });

      let orderItems: any[] = [];
      for (let i = 0; i < orderIds.length; i += 200) {
        const { data: items, error: itemsError } = await supabase
          .from('order_items')
          .select('order_id, quantity, unit')
          .in('order_id', orderIds.slice(i, i + 200));
        if (itemsError) throw itemsError;
        orderItems = orderItems.concat(items || []);
      }

      let linkedRetailers: any[] = [];
      for (let i = 0; i < retailerIds.length; i += 200) {
        const { data: retailerBatch } = await supabase
          .from('retailers')
          .select('id, beat_id, beat_name')
          .in('id', retailerIds.slice(i, i + 200));
        linkedRetailers = linkedRetailers.concat(retailerBatch || []);
      }
      linkedRetailers.forEach((retailer: any) => {
        const beatKey = retailer.beat_id || retailer.beat_name;
        if (beatKey) orderBeatKeys.add(String(beatKey));
      });

      const totalBeatsCount = orderBeatKeys.size;
      const totalRetailersCount = retailerIds.length;
      const totalOrders = orders?.length || 0;
      const totalRevenue = orders?.reduce((sum, o) => sum + Number(o.total_amount || 0), 0) || 0;
      const pendingPayments = orders?.reduce((sum, o) => sum + Number(o.credit_pending_amount || 0), 0) || 0;
      
      // Calculate total KG and Revenue directly from order_items so analytics matches DB units.
      let totalKg = 0;
      let totalPieces = 0;
      const quantityByUnit: { [unit: string]: number } = {};

      orderItems.forEach((item: any) => {
        const unit = (item.unit || 'Unknown').trim().toUpperCase();
        const qty = Number(item.quantity || 0);
        quantityByUnit[unit] = (quantityByUnit[unit] || 0) + qty;
        const kg = getKgQuantity(qty, unit);
        totalKg += kg;
        // A line that converts to 0 kg is not weightless — it is a different UOM
        // category (PIECE, BOX...). Keep it separate rather than folding it in.
        if (kg === 0 && qty > 0) totalPieces += qty;
      });
      totalKg = Math.round(totalKg * 1000) / 1000;
      totalPieces = Math.round(totalPieces * 1000) / 1000;

      // Newly onboarded retailers. Deliberately independent of the order query:
      // "Total Retailers" counts who was BILLED in the window, this counts who was
      // ADDED in it, so a retailer onboarded but not yet sold to still shows up.
      // created_by is the rep who added them; older rows only carry user_id.
      let newRetailersQuery = supabase
        .from('retailers')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', `${fromDate}T00:00:00`)
        .lte('created_at', `${toDate}T23:59:59.999`);
      if (userIds.length > 0) {
        const list = userIds.join(',');
        newRetailersQuery = newRetailersQuery.or(`created_by.in.(${list}),user_id.in.(${list})`);
      }
      const { count: newRetailersCount } = await newRetailersQuery;

      // ---- Management metrics -------------------------------------------
      // Field quality: how many planned visits actually produced an order.
      let visitsQuery = supabase
        .from('visits')
        .select('user_id, status')
        .gte('planned_date', fromDate)
        .lte('planned_date', toDate);
      if (userIds.length > 0) visitsQuery = visitsQuery.in('user_id', userIds);
      const { data: visitRows } = await visitsQuery;
      const visitsPlanned = visitRows?.length || 0;
      const visitsProductive = (visitRows || []).filter((v: any) => v.status === 'productive').length;
      const repsActive = new Set((visitRows || []).map((v: any) => v.user_id).filter(Boolean)).size;

      // Roster size: the scope being viewed, or every active profile.
      let repsTotal = userIds.length;
      if (repsTotal === 0) {
        const { count } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true);
        repsTotal = count || 0;
      }

      // Cash in. Above 100% of billed means older invoices are being cleared.
      let collectionsQuery = supabase
        .from('retailer_payment_collections')
        .select('amount, collected_by_user_id')
        .gte('collected_at', `${fromDate}T00:00:00`)
        .lte('collected_at', `${toDate}T23:59:59.999`);
      if (userIds.length > 0) collectionsQuery = collectionsQuery.in('collected_by_user_id', userIds);
      const { data: collectionRows } = await collectionsQuery;
      const collectedInPeriod = (collectionRows || [])
        .reduce((sum: number, c: any) => sum + Number(c.amount || 0), 0);

      // Direction: the same number of days immediately before this window.
      const spanDays = Math.max(
        1,
        Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / 86400000) + 1,
      );
      const prevTo = new Date(dateRange.from); prevTo.setDate(prevTo.getDate() - 1);
      const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - (spanDays - 1));
      let prevQuery = supabase
        .from('orders')
        .select('total_amount')
        .eq('status', 'confirmed')
        .gte('order_date', format(prevFrom, 'yyyy-MM-dd'))
        .lte('order_date', format(prevTo, 'yyyy-MM-dd'));
      if (userIds.length > 0) prevQuery = prevQuery.in('user_id', userIds);
      const { data: prevRows } = await prevQuery;
      const prevPeriodRevenue = (prevRows || [])
        .reduce((sum: number, r: any) => sum + Number(r.total_amount || 0), 0);

      // Ageing deliberately ignores the date filter: what is owed is owed
      // regardless of the window being viewed, and only its age matters.
      let ageingQuery = supabase
        .from('orders')
        .select('order_date, credit_pending_amount')
        .eq('is_credit_order', true)
        .gt('credit_pending_amount', 0)
        .not('status', 'in', '(cancelled,replaced)');
      if (userIds.length > 0) ageingQuery = ageingQuery.in('user_id', userIds);
      const { data: ageingRows } = await ageingQuery;
      const ageing = { d0_30: 0, d31_60: 0, d60plus: 0 };
      const today = new Date();
      (ageingRows || []).forEach((r: any) => {
        const amt = Number(r.credit_pending_amount || 0);
        if (amt <= 0) return;
        const days = Math.floor((today.getTime() - new Date(r.order_date).getTime()) / 86400000);
        if (days <= 30) ageing.d0_30 += amt;
        else if (days <= 60) ageing.d31_60 += amt;
        else ageing.d60plus += amt;
      });

      setSummary({
        totalBeats: totalBeatsCount,
        totalRetailers: totalRetailersCount,
        totalOrders,
        totalKg,
        totalPieces,
        totalRevenue,
        pendingPayments,
        newRetailers: newRetailersCount || 0,
        quantityByUnit,
        visitsPlanned,
        visitsProductive,
        repsActive,
        repsTotal,
        collectedInPeriod,
        prevPeriodRevenue,
        ageing
      });
    } catch (error) {
      console.error('Error fetching business summary:', error);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  const fetchBeatDetails = useCallback(async (userIds: string[], dateRange: { from: Date; to: Date }) => {
    setDetailsLoading(true);
    try {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      // Get orders with retailer and order beat data - paginated
      const BATCH_SIZE = 1000;
      let allOrders: any[] = [];
      let ordersOffset = 0;
      let ordersHasMore = true;
      while (ordersHasMore) {
        let ordersQuery = supabase
          .from('orders')
          .select('id, total_amount, user_id, order_date, retailer_id, beat_id, beat_name_snapshot, retailers(id, name, beat_name, beat_id)')
          .eq('status', 'confirmed')
          .gte('order_date', fromDate)
          .lte('order_date', toDate)
          .range(ordersOffset, ordersOffset + BATCH_SIZE - 1);
        if (userIds.length > 0) {
          ordersQuery = ordersQuery.in('user_id', userIds);
        }
        const { data: batch } = await ordersQuery;
        if (batch && batch.length > 0) {
          allOrders = allOrders.concat(batch);
          ordersOffset += BATCH_SIZE;
          ordersHasMore = batch.length === BATCH_SIZE;
        } else {
          ordersHasMore = false;
        }
      }
      const orders = allOrders;

      // Get visits for the date range to count visits per beat
      let visitsQuery = supabase
        .from('visits')
        .select('id, user_id, planned_date, retailer_id, retailers!inner(id, name, beat_name)')
        .gte('planned_date', fromDate)
        .lte('planned_date', toDate);

      if (userIds.length > 0) {
        visitsQuery = visitsQuery.in('user_id', userIds);
      }

      const { data: visits } = await visitsQuery;

      const orderBeatIds = [...new Set((orders || []).map((order: any) => order.beat_id).filter(Boolean))];
      const { data: orderBeats } = orderBeatIds.length > 0
        ? await supabase.from('beats').select('beat_id, beat_name').in('beat_id', orderBeatIds)
        : { data: [] as any[] };
      const orderBeatNameMap = new Map((orderBeats || []).map((beat: any) => [beat.beat_id, beat.beat_name]));

      // Group by beat using order snapshot first, then order beat_id/current retailer references.
      const beatMap = new Map<string, BeatDetail>();

      // Process visits to count visits per beat
      visits?.forEach(visit => {
        const beatName = (visit.retailers as any)?.beat_name || 'Unknown';
        if (!beatMap.has(beatName)) {
          beatMap.set(beatName, {
            beat_name: beatName,
            visits_count: 0,
            orders_count: 0,
            revenue: 0
          });
        }
        const beat = beatMap.get(beatName)!;
        beat.visits_count += 1;
      });

      // Process orders to count orders and revenue per beat
      orders?.forEach(order => {
        const beatName = order.beat_name_snapshot || orderBeatNameMap.get(order.beat_id) || (order.retailers as any)?.beat_name || 'Unassigned';
        if (!beatMap.has(beatName)) {
          beatMap.set(beatName, {
            beat_name: beatName,
            visits_count: 0,
            orders_count: 0,
            revenue: 0
          });
        }
        const beat = beatMap.get(beatName)!;
        beat.orders_count += 1;
        beat.revenue += Number(order.total_amount || 0);
      });

      setBeatDetails(Array.from(beatMap.values()).sort((a, b) => b.revenue - a.revenue));
    } catch (error) {
      console.error('Error fetching beat details:', error);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const fetchRetailerDetails = useCallback(async (userIds: string[], dateRange: { from: Date; to: Date }) => {
    setDetailsLoading(true);
    try {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      const BATCH_SIZE = 1000;
      let allOrders: any[] = [];
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        let ordersQuery = supabase
          .from('orders')
          .select(`
            id,
            retailer_id,
            total_amount,
            credit_pending_amount,
            beat_name_snapshot,
            retailers(id, name, beat_name)
          `)
          .eq('status', 'confirmed')
          .gte('order_date', fromDate)
          .lte('order_date', toDate)
          .range(offset, offset + BATCH_SIZE - 1);
        if (userIds.length > 0) {
          ordersQuery = ordersQuery.in('user_id', userIds);
        }
        const { data: batch } = await ordersQuery;
        if (batch && batch.length > 0) {
          allOrders = allOrders.concat(batch);
          offset += BATCH_SIZE;
          hasMore = batch.length === BATCH_SIZE;
        } else {
          hasMore = false;
        }
      }
      const orders = allOrders;

      // Group by retailer
      const retailerMap = new Map<string, RetailerDetail>();
      
      orders?.forEach(order => {
        const retailer = order.retailers as any;
        if (!retailer?.id) return;
        
        if (!retailerMap.has(retailer.id)) {
          retailerMap.set(retailer.id, {
            id: retailer.id,
            name: retailer.name || 'Unknown',
            beat_name: order.beat_name_snapshot || retailer.beat_name || '-',
            orders_count: 0,
            revenue: 0,
            pending_amount: 0
          });
        }
        const r = retailerMap.get(retailer.id)!;
        r.orders_count++;
        r.revenue += Number(order.total_amount || 0);
        r.pending_amount += Number(order.credit_pending_amount || 0);
      });

      setRetailerDetails(Array.from(retailerMap.values()).sort((a, b) => b.revenue - a.revenue));
    } catch (error) {
      console.error('Error fetching retailer details:', error);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const fetchOrderDetails = useCallback(async (userIds: string[], dateRange: { from: Date; to: Date }) => {
    setDetailsLoading(true);
    try {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      const BATCH_SIZE = 1000;
      let allOrders: any[] = [];
      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        let query = supabase
          .from('orders')
          .select(`
            id,
            order_date,
            total_amount,
            status,
            user_id,
            retailers(name)
          `)
          .gte('order_date', fromDate)
          .lte('order_date', toDate)
          .order('order_date', { ascending: false })
          .range(offset, offset + BATCH_SIZE - 1);
        if (userIds.length > 0) {
          query = query.in('user_id', userIds);
        }
        const { data: batch } = await query;
        if (batch && batch.length > 0) {
          allOrders = allOrders.concat(batch);
          offset += BATCH_SIZE;
          hasMore = batch.length === BATCH_SIZE;
        } else {
          hasMore = false;
        }
      }
      const data = allOrders;

      // Fetch user names for all unique user_ids
      const uniqueUserIds = [...new Set((data || []).map(o => o.user_id).filter(Boolean))];
      let userNameMap = new Map<string, string>();
      if (uniqueUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', uniqueUserIds);
        profiles?.forEach(p => userNameMap.set(p.id, p.full_name || 'Unknown'));
      }

      setOrderDetails(
        (data || []).map(order => ({
          id: order.id,
          order_date: order.order_date,
          retailer_name: (order.retailers as any)?.name || 'Unknown',
          total_amount: Number(order.total_amount || 0),
          status: order.status || 'pending',
          user_id: order.user_id || '',
          user_name: userNameMap.get(order.user_id) || 'Unknown'
        }))
      );
    } catch (error) {
      console.error('Error fetching order details:', error);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const fetchProductDetails = useCallback(async (userIds: string[], dateRange: { from: Date; to: Date }) => {
    setDetailsLoading(true);
    try {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      let ordersQuery = supabase
        .from('orders')
        .select('id, user_id')
        .gte('order_date', fromDate)
        .lte('order_date', toDate);

      if (userIds.length > 0) {
        ordersQuery = ordersQuery.in('user_id', userIds);
      }

      const { data: orders } = await ordersQuery;
      const orderIds = orders?.map(o => o.id) || [];

      if (orderIds.length === 0) {
        setProductDetails([]);
        setDetailsLoading(false);
        return;
      }

      const { data: items } = await supabase
        .from('order_items')
        .select('product_name, unit, quantity, total')
        .in('order_id', orderIds);

      // Group by product and display weight quantities as KG, not PC/ML.
      const productMap = new Map<string, ProductDetail>();
      
      items?.forEach(item => {
        const displayQty = getDisplayQuantity(item.quantity, item.unit);
        const key = `${item.product_name}-${displayQty.unit}`;
        if (!productMap.has(key)) {
          productMap.set(key, {
            product_name: item.product_name || 'Unknown',
            unit: displayQty.unit,
            quantity: 0,
            revenue: 0
          });
        }
        const p = productMap.get(key)!;
        p.quantity += displayQty.quantity;
        p.revenue += Number(item.total || 0);
      });

      setProductDetails(Array.from(productMap.values()).sort((a, b) => b.quantity - a.quantity));
    } catch (error) {
      console.error('Error fetching product details:', error);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const fetchMetricDrilldown = useCallback(async (
    kind: 'strike' | 'reps' | 'collected' | 'overdue',
    userIds: string[],
    dateRange: { from: Date; to: Date },
  ) => {
    setDetailsLoading(true);
    try {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      // profiles are resolved separately throughout this hook: there is no FK
      // from orders.user_id / visits.user_id to profiles for PostgREST to embed.
      const namesFor = async (ids: string[]) => {
        const clean = [...new Set(ids.filter(Boolean))];
        if (!clean.length) return {} as Record<string, string>;
        const { data } = await supabase.from('profiles').select('id, full_name').in('id', clean);
        return (data || []).reduce((a: Record<string, string>, p: any) => {
          a[p.id] = p.full_name || 'Unknown'; return a;
        }, {});
      };
      const retailersFor = async (ids: string[]) => {
        const clean = [...new Set(ids.filter(Boolean))];
        if (!clean.length) return {} as Record<string, string>;
        const { data } = await supabase.from('retailers').select('id, name').in('id', clean);
        return (data || []).reduce((a: Record<string, string>, r: any) => {
          a[r.id] = r.name || 'Unknown'; return a;
        }, {});
      };

      if (kind === 'strike') {
        let q = supabase.from('visits')
          .select('user_id, retailer_id, planned_date, status')
          .gte('planned_date', fromDate).lte('planned_date', toDate)
          .order('planned_date', { ascending: false });
        if (userIds.length > 0) q = q.in('user_id', userIds);
        const { data } = await q;
        const names = await namesFor((data || []).map((v: any) => v.user_id));
        const rets = await retailersFor((data || []).map((v: any) => v.retailer_id));
        setMetricRows((data || []).map((v: any) => ({
          date: v.planned_date,
          rep: names[v.user_id] || 'Unknown',
          retailer: rets[v.retailer_id] || (v.retailer_id ? 'Unknown' : '(activity)'),
          status: v.status || 'planned',
        })));
        setMetricMeta({ title: 'Visits — planned vs productive', columns: [
          { key: 'date', label: 'Date' }, { key: 'rep', label: 'Rep' },
          { key: 'retailer', label: 'Retailer' }, { key: 'status', label: 'Outcome' }] });

      } else if (kind === 'reps') {
        let vq = supabase.from('visits').select('user_id, status, planned_date')
          .gte('planned_date', fromDate).lte('planned_date', toDate);
        if (userIds.length > 0) vq = vq.in('user_id', userIds);
        const { data: vis } = await vq;
        let ids = userIds;
        if (!ids.length) {
          const { data: all } = await supabase.from('profiles').select('id').eq('is_active', true);
          ids = (all || []).map((p: any) => p.id);
        }
        const names = await namesFor(ids);
        setMetricRows(ids.map((id) => {
          const mine = (vis || []).filter((v: any) => v.user_id === id);
          const last = mine.map((v: any) => v.planned_date).sort().pop();
          return {
            rep: names[id] || 'Unknown',
            visits: mine.length,
            productive: mine.filter((v: any) => v.status === 'productive').length,
            last_activity: last || '— none —',
          };
        }).sort((a, b) => Number(a.visits) - Number(b.visits)));
        setMetricMeta({ title: 'Rep activity in this period', columns: [
          { key: 'rep', label: 'Rep' }, { key: 'visits', label: 'Visits' },
          { key: 'productive', label: 'Productive' }, { key: 'last_activity', label: 'Last visit' }] });

      } else if (kind === 'collected') {
        let q = supabase.from('retailer_payment_collections')
          .select('collected_at, amount, payment_method, retailer_id, collected_by_user_id')
          .gte('collected_at', `${fromDate}T00:00:00`).lte('collected_at', `${toDate}T23:59:59.999`)
          .order('collected_at', { ascending: false });
        if (userIds.length > 0) q = q.in('collected_by_user_id', userIds);
        const { data } = await q;
        const names = await namesFor((data || []).map((c: any) => c.collected_by_user_id));
        const rets = await retailersFor((data || []).map((c: any) => c.retailer_id));
        setMetricRows((data || []).map((c: any) => ({
          date: format(new Date(c.collected_at), 'dd MMM yyyy'),
          retailer: rets[c.retailer_id] || 'Unknown',
          amount: Number(c.amount || 0),
          method: c.payment_method || '—',
          collected_by: names[c.collected_by_user_id] || 'Unknown',
        })));
        setMetricMeta({ title: 'Payments collected in this period', columns: [
          { key: 'date', label: 'Date' }, { key: 'retailer', label: 'Retailer' },
          { key: 'amount', label: 'Amount' }, { key: 'method', label: 'Method' },
          { key: 'collected_by', label: 'Collected by' }] });

      } else {
        // Overdue ignores the window on purpose — age is what matters.
        let q = supabase.from('orders')
          .select('invoice_number, order_date, credit_pending_amount, retailer_id, user_id')
          .eq('is_credit_order', true).gt('credit_pending_amount', 0)
          .not('status', 'in', '(cancelled,replaced)')
          .order('order_date', { ascending: true });
        if (userIds.length > 0) q = q.in('user_id', userIds);
        const { data } = await q;
        const today = new Date();
        const aged = (data || []).map((r: any) => ({
          ...r,
          days: Math.floor((today.getTime() - new Date(r.order_date).getTime()) / 86400000),
        })).filter((r: any) => r.days > 60);
        const names = await namesFor(aged.map((r: any) => r.user_id));
        const rets = await retailersFor(aged.map((r: any) => r.retailer_id));
        setMetricRows(aged.map((r: any) => ({
          invoice: r.invoice_number || '—',
          retailer: rets[r.retailer_id] || 'Unknown',
          order_date: r.order_date,
          days: r.days,
          pending: Number(r.credit_pending_amount || 0),
          rep: names[r.user_id] || 'Unknown',
        })));
        setMetricMeta({ title: 'Balances over 60 days old', columns: [
          { key: 'invoice', label: 'Invoice' }, { key: 'retailer', label: 'Retailer' },
          { key: 'order_date', label: 'Order date' }, { key: 'days', label: 'Days old' },
          { key: 'pending', label: 'Outstanding' }, { key: 'rep', label: 'Rep' }] });
      }
    } catch (e) {
      console.error('Error fetching metric drilldown:', e);
      setMetricRows([]);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const fetchPendingPaymentDetails = useCallback(async (userIds: string[], dateRange: { from: Date; to: Date }) => {
    setDetailsLoading(true);
    try {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      let query = supabase
        .from('orders')
        .select(`
          id,
          order_date,
          credit_pending_amount,
          user_id,
          retailers(name)
        `)
        .gte('order_date', fromDate)
        .lte('order_date', toDate)
        .gt('credit_pending_amount', 0)
        .order('credit_pending_amount', { ascending: false });

      if (userIds.length > 0) {
        query = query.in('user_id', userIds);
      }

      const { data } = await query;

      // Fetch profile names separately since there's no FK from orders.user_id to profiles
      const orderUserIds = [...new Set((data || []).map(o => o.user_id).filter(Boolean))];
      let profilesMap: Record<string, string> = {};
      
      if (orderUserIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', orderUserIds);
        
        profilesMap = (profilesData || []).reduce((acc, p) => {
          acc[p.id] = p.full_name || 'Unknown User';
          return acc;
        }, {} as Record<string, string>);
      }

      setPendingPaymentDetails(
        (data || []).map(order => ({
          retailer_name: (order.retailers as any)?.name || 'Unknown',
          order_date: order.order_date,
          order_id: order.id,
          pending_amount: Number(order.credit_pending_amount || 0),
          user_id: order.user_id || '',
          user_name: profilesMap[order.user_id || ''] || 'Unknown User'
        }))
      );
    } catch (error) {
      console.error('Error fetching pending payment details:', error);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  /**
   * The retailers behind the "New Retailers" card, with whoever added them and
   * whether they have actually started ordering yet — an onboarded retailer with
   * zero orders is the number worth chasing.
   */
  const fetchNewRetailerDetails = useCallback(async (userIds: string[], dateRange: { from: Date; to: Date }) => {
    setDetailsLoading(true);
    try {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      let query = supabase
        .from('retailers')
        .select('id, name, beat_name, created_at, created_by, user_id, verified')
        .gte('created_at', `${fromDate}T00:00:00`)
        .lte('created_at', `${toDate}T23:59:59.999`)
        .order('created_at', { ascending: false });
      if (userIds.length > 0) {
        const list = userIds.join(',');
        query = query.or(`created_by.in.(${list}),user_id.in.(${list})`);
      }
      const { data: retailers, error } = await query;
      if (error) throw error;

      const rows = retailers || [];
      const ids = rows.map(r => r.id);

      // Name the adder, and count lifetime orders so "added but never ordered" is visible.
      const adderIds = [...new Set(rows.map(r => r.created_by || r.user_id).filter(Boolean))] as string[];
      const nameById = new Map<string, string>();
      if (adderIds.length > 0) {
        const { data: people } = await supabase
          .from('profiles').select('id, full_name, username').in('id', adderIds);
        (people || []).forEach((p: any) => nameById.set(p.id, p.full_name || p.username || 'Unknown'));
      }

      const stats = new Map<string, { orders: number; revenue: number }>();
      for (let i = 0; i < ids.length; i += 200) {
        const { data: ord } = await supabase
          .from('orders')
          .select('retailer_id, total_amount')
          .eq('status', 'confirmed')
          .in('retailer_id', ids.slice(i, i + 200));
        (ord || []).forEach((o: any) => {
          const s = stats.get(o.retailer_id) || { orders: 0, revenue: 0 };
          s.orders += 1;
          s.revenue += Number(o.total_amount || 0);
          stats.set(o.retailer_id, s);
        });
      }

      setNewRetailerDetails(rows.map((r: any) => {
        const s = stats.get(r.id) || { orders: 0, revenue: 0 };
        return {
          id: r.id,
          name: r.name || 'Unnamed',
          beat_name: r.beat_name || '',
          added_by: nameById.get(r.created_by || r.user_id) || 'Unknown',
          created_at: r.created_at,
          verified: !!r.verified,
          orders_count: s.orders,
          revenue: s.revenue,
        };
      }));
    } catch (error) {
      console.error('Error fetching new retailer details:', error);
      setNewRetailerDetails([]);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  return {
    summary,
    isLoading,
    fetchSummary,
    newRetailerDetails,
    fetchNewRetailerDetails,
    beatDetails,
    retailerDetails,
    orderDetails,
    productDetails,
    pendingPaymentDetails,
    detailsLoading,
    fetchBeatDetails,
    fetchRetailerDetails,
    fetchOrderDetails,
    fetchProductDetails,
    fetchPendingPaymentDetails,
    metricRows,
    metricMeta,
    fetchMetricDrilldown
  };
};
