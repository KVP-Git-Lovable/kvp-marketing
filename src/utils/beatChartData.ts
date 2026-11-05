import { format } from 'date-fns';

export interface BeatChartRetailer {
  id: string;
  name: string;
  created_at?: string | null;
  address?: string | null;
  phone?: string | null;
  category?: string | null;
  priority?: string | null;
  user_id?: string | null;
}

export interface BeatChartSource {
  orders: Array<{ id?: string; total_amount?: number | null; created_at: string; retailer_id?: string | null }>;
  orderItems: Array<{ order_id?: string | null; total?: number | null; product_name?: string | null }>;
  retailers: BeatChartRetailer[];
}

export interface BeatChartData {
  ordersByMonth: { month: string; orders: number; revenue: number }[];
  salesBySKU: { name: string; value: number }[];
  topRetailers: { name: string; revenue: number }[];
  /** Each bucket carries the retailers added inside it so the chart can drill down. */
  retailersByMonth: {
    month: string;
    count: number;
    rangeStart: string;
    rangeEnd: string;
    retailers: BeatChartRetailer[];
  }[];
}

const EMPTY: BeatChartData = {
  ordersByMonth: [],
  salesBySKU: [],
  topRetailers: [],
  retailersByMonth: [],
};

interface Bucket {
  label: string;
  start: Date;
  end: Date;
}

/** Build time buckets across the range: daily when short, monthly otherwise. */
function buildBuckets(start: Date, end: Date): Bucket[] {
  const buckets: Bucket[] = [];
  const spanDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));

  if (spanDays <= 62) {
    const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    while (cur <= end) {
      const s = new Date(cur);
      const e = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), 23, 59, 59, 999);
      buckets.push({ label: format(s, spanDays <= 8 ? 'EEE d' : 'd MMM'), start: s, end: e });
      cur.setDate(cur.getDate() + 1);
    }
    return buckets;
  }

  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end) {
    const s = new Date(cur.getFullYear(), cur.getMonth(), 1);
    const e = new Date(cur.getFullYear(), cur.getMonth() + 1, 0, 23, 59, 59, 999);
    buckets.push({
      label: format(s, spanDays > 400 ? 'MMM yy' : 'MMM'),
      start: s,
      end: e,
    });
    cur.setMonth(cur.getMonth() + 1);
  }
  return buckets;
}

/**
 * Derive all four beat chart datasets for a date range.
 * Calculations mirror the previous inline logic; only the window changed.
 */
export function buildBeatChartData(
  source: BeatChartSource | null,
  start: Date,
  end: Date,
): BeatChartData {
  if (!source) return EMPTY;

  const inRange = (value?: string | null) => {
    if (!value) return false;
    const d = new Date(value);
    return d >= start && d <= end;
  };

  const orders = source.orders.filter((o) => inRange(o.created_at));
  const buckets = buildBuckets(start, end);

  const ordersByMonth = buckets.map((b) => {
    const bucketOrders = orders.filter((o) => {
      const d = new Date(o.created_at);
      return d >= b.start && d <= b.end;
    });
    return {
      month: b.label,
      orders: bucketOrders.length,
      revenue: bucketOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
    };
  });

  // Sales by SKU — only items belonging to in-range orders
  const orderIds = new Set(orders.map((o) => o.id).filter(Boolean) as string[]);
  const skuMap = new Map<string, number>();
  source.orderItems.forEach((item) => {
    if (item.order_id && !orderIds.has(item.order_id)) return;
    if (!item.order_id) return;
    const name = item.product_name || 'Unknown';
    skuMap.set(name, (skuMap.get(name) || 0) + (item.total || 0));
  });
  const salesBySKU = Array.from(skuMap.entries())
    .map(([name, value]) => ({ name: name.substring(0, 15), value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  // Top 20 retailers by revenue
  const retailerRevenueMap = new Map<string, number>();
  orders.forEach((order) => {
    const retailer = source.retailers.find((r) => r.id === order.retailer_id);
    if (retailer) {
      retailerRevenueMap.set(
        retailer.name,
        (retailerRevenueMap.get(retailer.name) || 0) + (order.total_amount || 0),
      );
    }
  });
  const topRetailers = Array.from(retailerRevenueMap.entries())
    .map(([name, revenue]) => ({ name: name.substring(0, 12), revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20);

  const retailersByMonth = buckets.map((b) => {
    const added = source.retailers.filter((r) => {
      if (!r.created_at) return false;
      const d = new Date(r.created_at);
      return d >= b.start && d <= b.end;
    });
    return {
      month: b.label,
      count: added.length,
      rangeStart: b.start.toISOString(),
      rangeEnd: b.end.toISOString(),
      retailers: added,
    };
  });

  return { ordersByMonth, salesBySKU, topRetailers, retailersByMonth };
}
