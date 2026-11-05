import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { visitStatusCache } from '@/lib/visitStatusCache';
import { retailerStatusRegistry } from '@/lib/retailerStatusRegistry';

interface VisitCardData {
  currentStatus: "planned" | "in-progress" | "productive" | "unproductive" | "store-closed" | "cancelled";
  visitId: string | null;
  hasOrder: boolean;
  orderValue: number;
  noOrderReason: string;
  distributorName: string;
  pendingAmount: number;
  isJointSales: boolean;
  hasJointSalesFeedback: boolean;
  beatPlanId: string | null;
  isLoading: boolean;
}

interface UseVisitCardDataProps {
  retailerId: string;
  visitStatus: string;
  hasOrderProp: boolean;
  orderValueProp: number;
  noOrderReasonProp?: string;
  selectedDate: string;
  userId: string;
}

// Batch data cache - shared across all VisitCards
const batchDataCache = new Map<string, {
  data: Map<string, any>;
  timestamp: number;
}>();

// Batch fetch queue
let batchQueue: string[] = [];
let batchTimeout: ReturnType<typeof setTimeout> | null = null;
let batchPromiseResolvers: Map<string, (data: any) => void> = new Map();

const BATCH_DELAY = 50; // Wait 50ms to collect retailer IDs before batch fetch
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Batch fetch function that fetches data for multiple retailers at once
async function executeBatchFetch(retailerIds: string[], userId: string, selectedDate: string) {
  if (retailerIds.length === 0) return;

  console.log(`🚀 [BatchFetch] Fetching data for ${retailerIds.length} retailers in one query`);
  
  const dateStart = new Date(selectedDate);
  dateStart.setHours(0, 0, 0, 0);
  const dateEnd = new Date(selectedDate);
  dateEnd.setHours(23, 59, 59, 999);

  try {
    // Batch fetch all data in parallel
    const [
      retailersResult,
      visitsResult,
      ordersResult,
      beatPlansResult,
      jointFeedbackResult
    ] = await Promise.all([
      // Retailer data (pending amount)
      supabase
        .from('retailers')
        .select('id, pending_amount, parent_name')
        .in('id', retailerIds),
      
      // Latest visits for today
      supabase
        .from('visits')
        .select('id, retailer_id, status, no_order_reason, created_at')
        .eq('user_id', userId)
        .eq('planned_date', selectedDate)
        .in('retailer_id', retailerIds)
        .order('created_at', { ascending: false }),
      
      // Orders for today
      supabase
        .from('orders')
        .select('id, retailer_id, total_amount')
        .eq('user_id', userId)
        .eq('status', 'confirmed')
        .eq('order_date', selectedDate)
        .in('retailer_id', retailerIds),
      
      // Beat plans for joint sales check
      supabase
        .from('beat_plans')
        .select('id, joint_sales_manager_id')
        .eq('user_id', userId)
        .eq('plan_date', selectedDate)
        .limit(1)
        .maybeSingle(),
      
      // Joint sales feedback
      supabase
        .from('joint_sales_feedback')
        .select('retailer_id')
        .in('retailer_id', retailerIds)
        .eq('manager_id', userId)
    ]);

    // Process results into a map by retailer ID
    const retailerDataMap = new Map<string, any>();
    const retailersData = retailersResult.data || [];
    const visitsData = visitsResult.data || [];
    const ordersData = ordersResult.data || [];
    const beatPlan = beatPlansResult.data;
    const jointFeedbacks = new Set((jointFeedbackResult.data || []).map(f => f.retailer_id));

    // Group visits by retailer (get latest only)
    const latestVisitByRetailer = new Map<string, any>();
    visitsData.forEach(visit => {
      const existing = latestVisitByRetailer.get(visit.retailer_id);
      if (!existing || new Date(visit.created_at) > new Date(existing.created_at)) {
        latestVisitByRetailer.set(visit.retailer_id, visit);
      }
    });

    // Group orders by retailer and sum
    const ordersByRetailer = new Map<string, { total: number; hasOrder: boolean }>();
    ordersData.forEach(order => {
      const existing = ordersByRetailer.get(order.retailer_id) || { total: 0, hasOrder: false };
      existing.total += Number(order.total_amount || 0);
      existing.hasOrder = true;
      ordersByRetailer.set(order.retailer_id, existing);
    });

    // Build data map for each retailer
    retailerIds.forEach(retailerId => {
      const retailer = retailersData.find(r => r.id === retailerId);
      const visit = latestVisitByRetailer.get(retailerId);
      const orders = ordersByRetailer.get(retailerId);
      
      let status: string = 'planned';
      if (orders?.hasOrder) {
        status = 'productive';
      } else if (visit?.status) {
        status = visit.status;
      }

      retailerDataMap.set(retailerId, {
        currentStatus: status,
        visitId: visit?.id || null,
        hasOrder: orders?.hasOrder || false,
        orderValue: orders?.total || 0,
        noOrderReason: visit?.no_order_reason || '',
        distributorName: retailer?.parent_name || '',
        pendingAmount: Number(retailer?.pending_amount || 0),
        isJointSales: !!beatPlan?.joint_sales_manager_id,
        hasJointSalesFeedback: jointFeedbacks.has(retailerId),
        beatPlanId: beatPlan?.id || null,
      });
    });

    // Store in cache
    const cacheKey = `${userId}-${selectedDate}`;
    batchDataCache.set(cacheKey, {
      data: retailerDataMap,
      timestamp: Date.now()
    });

    // Resolve all pending promises
    retailerIds.forEach(retailerId => {
      const resolver = batchPromiseResolvers.get(retailerId);
      if (resolver) {
        resolver(retailerDataMap.get(retailerId));
        batchPromiseResolvers.delete(retailerId);
      }
    });

    console.log(`✅ [BatchFetch] Completed batch fetch for ${retailerIds.length} retailers`);
    
    return retailerDataMap;
  } catch (error) {
    console.error('[BatchFetch] Error:', error);
    // Resolve with null for all pending
    retailerIds.forEach(retailerId => {
      const resolver = batchPromiseResolvers.get(retailerId);
      if (resolver) {
        resolver(null);
        batchPromiseResolvers.delete(retailerId);
      }
    });
    return new Map();
  }
}

// Queue a retailer for batch fetch
function queueBatchFetch(retailerId: string, userId: string, selectedDate: string): Promise<any> {
  return new Promise((resolve) => {
    // Check cache first
    const cacheKey = `${userId}-${selectedDate}`;
    const cached = batchDataCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      const cachedData = cached.data.get(retailerId);
      if (cachedData) {
        resolve(cachedData);
        return;
      }
    }

    // Add to queue
    if (!batchQueue.includes(retailerId)) {
      batchQueue.push(retailerId);
    }
    batchPromiseResolvers.set(retailerId, resolve);

    // Clear existing timeout and set new one
    if (batchTimeout) {
      clearTimeout(batchTimeout);
    }

    batchTimeout = setTimeout(() => {
      const idsToFetch = [...batchQueue];
      batchQueue = [];
      batchTimeout = null;
      executeBatchFetch(idsToFetch, userId, selectedDate);
    }, BATCH_DELAY);
  });
}

export const useVisitCardData = ({
  retailerId,
  visitStatus,
  hasOrderProp,
  orderValueProp,
  noOrderReasonProp,
  selectedDate,
  userId,
}: UseVisitCardDataProps) => {
  // Initialize with prop values for instant display
  const [data, setData] = useState<VisitCardData>({
    currentStatus: (hasOrderProp ? 'productive' : visitStatus) as VisitCardData['currentStatus'],
    visitId: null,
    hasOrder: hasOrderProp,
    orderValue: orderValueProp,
    noOrderReason: noOrderReasonProp || '',
    distributorName: '',
    pendingAmount: 0,
    isJointSales: false,
    hasJointSalesFeedback: false,
    beatPlanId: null,
    isLoading: true,
  });

  const hasFetchedRef = useRef(false);
  const lastDateRef = useRef(selectedDate);

  // Reset fetch flag when date changes
  useEffect(() => {
    if (lastDateRef.current !== selectedDate) {
      hasFetchedRef.current = false;
      lastDateRef.current = selectedDate;
    }
  }, [selectedDate]);

  // Batch fetch data
  useEffect(() => {
    if (!userId || !retailerId || !selectedDate) return;
    if (hasFetchedRef.current) return;

    const fetchData = async () => {
      hasFetchedRef.current = true;
      
      const batchData = await queueBatchFetch(retailerId, userId, selectedDate);
      
      if (batchData) {
        setData(prev => ({
          ...prev,
          ...batchData,
          isLoading: false,
        }));
      } else {
        setData(prev => ({ ...prev, isLoading: false }));
      }
    };

    fetchData();
  }, [retailerId, userId, selectedDate]);

  // Sync with prop changes (when parent has fresh data)
  useEffect(() => {
    if (hasOrderProp && !data.hasOrder) {
      setData(prev => ({
        ...prev,
        currentStatus: 'productive',
        hasOrder: true,
        orderValue: orderValueProp,
      }));
    }
  }, [hasOrderProp, orderValueProp, data.hasOrder]);

  const refreshData = useCallback(() => {
    hasFetchedRef.current = false;
    // Clear cache for this retailer
    const cacheKey = `${userId}-${selectedDate}`;
    const cached = batchDataCache.get(cacheKey);
    if (cached) {
      cached.data.delete(retailerId);
    }
    // Re-trigger fetch
    queueBatchFetch(retailerId, userId, selectedDate).then(batchData => {
      if (batchData) {
        setData(prev => ({
          ...prev,
          ...batchData,
          isLoading: false,
        }));
      }
    });
  }, [retailerId, userId, selectedDate]);

  return { data, refreshData };
};

// Export cache clear function for use after order submission
export const clearVisitCardCache = (userId?: string, selectedDate?: string) => {
  if (userId && selectedDate) {
    const cacheKey = `${userId}-${selectedDate}`;
    batchDataCache.delete(cacheKey);
  } else {
    batchDataCache.clear();
  }
  console.log('🗑️ [VisitCardCache] Cleared');
};
