import { useState, useEffect, useMemo } from "react";
import { fullNameProps } from "@/lib/displayName";
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ShoppingCart, Search, Filter, Calendar, ChevronDown, ChevronRight, IndianRupee,
  Store, Package, Users, ArrowUpDown, ArrowUp, ArrowDown, Download, X,
  ChevronLeft, ChevronRight as ChevronRightIcon, ChevronsLeft, ChevronsRight, CalendarRange,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { exportRowsToExcel } from "@/utils/exportRowsToExcel";
import { DistributorSecondaryAnalytics } from "@/components/distributor/DistributorSecondaryAnalytics";

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  rate: number;
  total: number;
  unit: string;
}

interface Order {
  id: string;
  retailer_id: string;
  retailer_name: string;
  total_amount: number;
  status: string;
  order_date: string | null;
  created_at: string;
  invoice_number: string | null;
  is_credit_order: boolean;
  payment_method: string | null;
  user_id: string | null;
  rep_name?: string | null;
  items?: OrderItem[];
}

interface Props {
  distributorId: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  dispatched: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

type SortCol = "date" | "orders" | "shops" | "rep" | "value";

// Local parts, not toISOString: that converts local midnight to UTC and east
// of Greenwich every boundary slides back a day.
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const startOfMonth = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1);
const fyStart = (d: Date) => (d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1);
const FY = fyStart(new Date());
const fyName = (y: number) => `FY ${y}-${String(y + 1).slice(2)}`;

const LIST_PERIODS: { key: string; label: string; months?: number; fy?: number }[] = [
  { key: "1", label: "This month", months: 0 },
  { key: "3", label: "Last 3 months", months: 2 },
  { key: "6", label: "Last 6 months", months: 5 },
  { key: "12", label: "Last 12 months", months: 11 },
  { key: "fy0", label: `${fyName(FY)} (current)`, fy: FY },
  { key: "fy1", label: fyName(FY - 1), fy: FY - 1 },
  { key: "custom", label: "Custom range\u2026" },
];

/** One template for the header and every row, so columns cannot drift apart. */
const GRID = [
  "grid-cols-[14px_minmax(0,1fr)_auto]",
  "sm:grid-cols-[14px_112px_64px_minmax(0,1fr)_112px]",
  "md:grid-cols-[14px_112px_64px_64px_minmax(0,1fr)_112px]",
].join(" ");

interface DateGroup {
  date: string;
  formattedDate: string;
  orders: Order[];
  totalValue: number;
  orderCount: number;
  retailerCount: number;
  repCount: number;
  repLabel: string;
}

interface RetailerGroup {
  retailerId: string;
  retailerName: string;
  reps: string[];
  orders: Order[];
  totalValue: number;
  products: { productName: string; quantity: number; unit: string; total: number }[];
}

interface ProductGroup {
  productName: string;
  unit: string;
  totalQuantity: number;
  totalValue: number;
  retailers: { retailerName: string; quantity: number; total: number }[];
}


/**
 * A column heading that sorts on click and carries its own filter.
 *
 * The filter lives behind the funnel rather than in a row of boxes above the
 * table, so each control sits on the column it acts on and an active one is
 * visible from the heading itself.
 */
function ColHead({
  label, col, sortCol, sortDir, onSort, active, children, className, align = "left",
}: {
  label: string;
  col: SortCol;
  sortCol: SortCol;
  sortDir: "asc" | "desc";
  onSort: (c: SortCol) => void;
  active: boolean;
  children: React.ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  const sorted = sortCol === col;
  return (
    <span className={cn("flex items-center gap-0.5 min-w-0", align === "right" && "justify-end", className)}>
      <button
        type="button"
        onClick={() => onSort(col)}
        className={cn(
          "inline-flex items-center gap-1 rounded px-1 py-0.5 -mx-1 truncate",
          "hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          sorted && "text-foreground",
        )}
        title={`Sort by ${label.toLowerCase()}`}
      >
        {label}
        {sorted
          ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
          : <ArrowUpDown className="h-3 w-3 opacity-30" />}
      </button>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "rounded p-0.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              active ? "text-primary" : "opacity-40",
            )}
            title={`Filter ${label.toLowerCase()}`}
          >
            <Filter className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent align={align === "right" ? "end" : "start"} className="w-52 p-3">
          {children}
        </PopoverContent>
      </Popover>
    </span>
  );
}

export function DistributorSecondaryOrders({ distributorId }: Props) {
  const { format: fmtMoney } = useCurrency();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [repFilter, setRepFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "value" | "orders">("newest");
  /** Column-wise sort. `date desc` is the same view the old "Newest first" gave. */
  const [sortCol, setSortCol] = useState<SortCol>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  /** One filter per column, each empty by default. */
  const [colFilter, setColFilter] = useState({
    dateFrom: "", dateTo: "", minOrders: "", minShops: "", rep: "all", minValue: "",
  });
  /** The list used to pull the 500 most recent orders whatever the question
   *  was. It now loads only the chosen window, so the count in the heading is
   *  the real count for that period rather than wherever the cap landed. */
  const [period, setPeriod] = useState("1");
  const [customFrom, setCustomFrom] = useState(() => isoDate(startOfMonth()));
  const [customTo, setCustomTo] = useState(() => isoDate(new Date()));
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [dateFilter, setDateFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    applyFilters();
  }, [orders, searchTerm, statusFilter, dateFilter, colFilter.rep]);

  const listWindow = useMemo(() => {
    const chosen = LIST_PERIODS.find(x => x.key === period);
    if (period === "custom") return { from: customFrom, to: customTo };
    if (chosen?.fy !== undefined) {
      return { from: isoDate(new Date(chosen.fy, 3, 1)), to: isoDate(new Date(chosen.fy + 1, 2, 31)) };
    }
    const now = new Date();
    return {
      from: isoDate(new Date(now.getFullYear(), now.getMonth() - (chosen?.months ?? 0), 1)),
      to: isoDate(now),
    };
  }, [period, customFrom, customTo]);

  const loadOrders = async () => {
    try {
      // First get distributor details for matching
      const { data: distData } = await supabase
        .from('distributors')
        .select('id, name')
        .eq('id', distributorId)
        .single();

      const distributorName = distData?.name || '';
      
      // Get retailer IDs from multiple sources:
      // 1. distributor_retailer_mappings table
      // 2. retailers.distributor_id field
      // 3. retailers.parent_name matching distributor name
      
      const retailerIdSet = new Set<string>();
      
      // From distributor_retailer_mappings
      const { data: mappedRetailers } = await supabase
        .from('distributor_retailer_mappings')
        .select('retailer_id')
        .eq('distributor_id', distributorId);
      
      mappedRetailers?.forEach(r => retailerIdSet.add(r.retailer_id));
      
      // From retailers table (direct link or parent_name match)
      if (distributorName) {
        const { data: linkedRetailers } = await supabase
          .from('retailers')
          .select('id')
          .or(`distributor_id.eq.${distributorId},parent_name.ilike.${distributorName}`);
        
        linkedRetailers?.forEach(r => retailerIdSet.add(r.id));
      }
      
      const retailerIds = Array.from(retailerIdSet);

      let allOrders: Order[] = [];

      // Orders directly linked to this distributor
      const { data: directOrders, error: directError } = await supabase
        .from('orders')
        .select('id, retailer_id, retailer_name, total_amount, status, order_date, created_at, invoice_number, is_credit_order, payment_method, user_id')
        .eq('distributor_id', distributorId)
        .gte('order_date', listWindow.from)
        .lte('order_date', listWindow.to)
        .order('created_at', { ascending: false })
        .limit(2000);

      if (directError) throw directError;
      if (directOrders) allOrders = [...directOrders];

      // Also get orders from linked retailers (regardless of distributor_id on order)
      if (retailerIds.length > 0) {
        const { data: retailerOrders, error: retailerError } = await supabase
          .from('orders')
          .select('id, retailer_id, retailer_name, total_amount, status, order_date, created_at, invoice_number, is_credit_order, payment_method, user_id')
          .in('retailer_id', retailerIds)
          .gte('order_date', listWindow.from)
          .lte('order_date', listWindow.to)
          .order('created_at', { ascending: false })
          .limit(2000);

        if (retailerError) throw retailerError;
        if (retailerOrders) {
          const existingIds = new Set(allOrders.map(o => o.id));
          retailerOrders.forEach(o => {
            if (!existingIds.has(o.id)) {
              allOrders.push(o);
            }
          });
        }
      }

      // Fetch order items for all orders
      if (allOrders.length > 0) {
        const orderIds = allOrders.map(o => o.id);
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('id, order_id, product_name, quantity, rate, total, unit')
          .in('order_id', orderIds);

        if (orderItems) {
          const itemsByOrder = orderItems.reduce((acc, item) => {
            if (!acc[item.order_id]) acc[item.order_id] = [];
            acc[item.order_id].push(item);
            return acc;
          }, {} as Record<string, OrderItem[]>);

          allOrders = allOrders.map(order => ({
            ...order,
            items: itemsByOrder[order.id] || []
          }));
        }

        // Who sold it. The orders carry only user_id, and the list has to be
        // filterable by person, so the names are resolved once here rather
        // than per row.
        const repIds = [...new Set(allOrders.map(o => o.user_id).filter(Boolean))] as string[];
        if (repIds.length > 0) {
          const { data: profs } = await supabase
            .from('profiles').select('id, full_name').in('id', repIds);
          const nameById = new Map((profs || []).map((x: any) => [x.id, x.full_name]));
          allOrders = allOrders.map(o => ({
            ...o, rep_name: o.user_id ? (nameById.get(o.user_id) ?? null) : null,
          }));
        }
      }

      allOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      setOrders(allOrders);
    } catch (error: any) {
      toast.error("Failed to load orders: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [distributorId, listWindow.from, listWindow.to]);

  const applyFilters = () => {
    let filtered = [...orders];

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(order =>
        order.retailer_name?.toLowerCase().includes(search) ||
        order.invoice_number?.toLowerCase().includes(search) ||
        order.items?.some(item => item.product_name.toLowerCase().includes(search))
      );
    }

    if (statusFilter && statusFilter !== "all") {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    if (colFilter.rep !== "all") {
      filtered = filtered.filter(order =>
        colFilter.rep === "none" ? !order.user_id : order.user_id === colFilter.rep);
    }

    if (dateFilter) {
      filtered = filtered.filter(order => {
        const orderDate = order.order_date || order.created_at.split('T')[0];
        return orderDate === dateFilter;
      });
    }

    setFilteredOrders(filtered);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setDateFilter("");
  };

  // Group orders by date
  const groupedByDate: DateGroup[] = (() => {
    const dateMap = new Map<string, Order[]>();
    
    filteredOrders.forEach(order => {
      const date = order.order_date || order.created_at.split('T')[0];
      if (!dateMap.has(date)) {
        dateMap.set(date, []);
      }
      dateMap.get(date)!.push(order);
    });

    const groups = Array.from(dateMap.entries()).map(([date, orders]) => ({
      date,
      formattedDate: format(new Date(date), 'EEE, d MMM'),
      orders,
      totalValue: orders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
      orderCount: orders.length,
      retailerCount: new Set(orders.map(o => o.retailer_id)).size,
      repCount: new Set(orders.map(o => o.user_id).filter(Boolean)).size,
      repLabel: (() => {
        const names = [...new Set(orders.map(o => o.rep_name).filter(Boolean))] as string[];
        if (names.length === 0) return 'Unassigned';
        if (names.length === 1) return names[0];
        return `${names[0]} +${names.length - 1}`;
      })(),
    }));

    // Per-column filters. Each is skipped while its box is empty, so the
    // unfiltered list costs nothing.
    const f = colFilter;
    const kept = groups.filter(g => {
      if (f.dateFrom && g.date < f.dateFrom) return false;
      if (f.dateTo && g.date > f.dateTo) return false;
      if (f.minOrders && g.orderCount < Number(f.minOrders)) return false;
      if (f.minShops && g.retailerCount < Number(f.minShops)) return false;
      if (f.minValue && g.totalValue < Number(f.minValue)) return false;
      return true;
    });

    const cmp: Record<SortCol, (a: typeof groups[0], b: typeof groups[0]) => number> = {
      date: (a, b) => a.date.localeCompare(b.date),
      orders: (a, b) => a.orderCount - b.orderCount,
      shops: (a, b) => a.retailerCount - b.retailerCount,
      rep: (a, b) => a.repLabel.localeCompare(b.repLabel),
      value: (a, b) => a.totalValue - b.totalValue,
    };
    const dir = sortDir === "asc" ? 1 : -1;
    return kept.sort((a, b) => cmp[sortCol](a, b) * dir);
  })();

  const reps = (() => {
    const m = new Map<string, { id: string; name: string; count: number }>();
    orders.forEach(o => {
      if (!o.user_id) return;
      const hit = m.get(o.user_id);
      if (hit) hit.count += 1;
      else m.set(o.user_id, { id: o.user_id, name: o.rep_name || 'Unknown', count: 1 });
    });
    return [...m.values()].sort((a, b) => b.count - a.count);
  })();
  const hasUnassigned = orders.some(o => !o.user_id);

  const maxDayValue = Math.max(1, ...groupedByDate.map(g => g.totalValue));

  const pageCount = Math.max(1, Math.ceil(groupedByDate.length / perPage));
  const safePage = Math.min(page, pageCount);
  const pagedGroups = groupedByDate.slice((safePage - 1) * perPage, safePage * perPage);

  /** Clicking a heading sorts by it; clicking the one already sorted flips it. */
  const sortOn = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir(col === "rep" ? "asc" : "desc"); }
    setPage(1);
  };
  const setF = (patch: Partial<typeof colFilter>) => {
    setColFilter(c => ({ ...c, ...patch }));
    setPage(1);
  };
  const filtersOn = Object.entries(colFilter)
    .filter(([k, v]) => (k === "rep" ? v !== "all" : v !== "")).length;

  /** Every order on screen, one row each, with its salesman and its items. */
  const exportOrders = () => {
    type Row = Record<string, string | number>;
    const rows: Row[] = filteredOrders.flatMap((o): Row[] => {
      const head = {
        Date: o.order_date || o.created_at.split('T')[0],
        Retailer: o.retailer_name || '',
        Salesman: o.rep_name || 'Unassigned',
        Invoice: o.invoice_number || '',
        Status: o.status,
        Payment: o.is_credit_order ? 'Credit' : (o.payment_method || ''),
        'Order value': o.total_amount || 0,
      };
      if (!o.items?.length) return [{ ...head, Product: '', Quantity: '', Unit: '', 'Line value': '' }];
      return o.items.map(it => ({
        ...head,
        Product: it.product_name,
        Quantity: it.quantity ?? '',
        Unit: it.unit || '',
        'Line value': it.total ?? '',
      }));
    });
    if (!exportRowsToExcel(rows, 'secondary-orders', 'Secondary orders')) {
      toast.error('Nothing to export');
    }
  };

  // Group orders by retailer for a date
  const getRetailerGroups = (orders: Order[]): RetailerGroup[] => {
    const retailerMap = new Map<string, RetailerGroup>();

    orders.forEach(order => {
      const key = order.retailer_id;
      if (!retailerMap.has(key)) {
        retailerMap.set(key, {
          retailerId: order.retailer_id,
          retailerName: order.retailer_name,
          reps: [],
          orders: [],
          totalValue: 0,
          products: []
        });
      }
      const group = retailerMap.get(key)!;
      group.orders.push(order);
      group.totalValue += order.total_amount || 0;
      const rep = order.rep_name || (order.user_id ? 'Unknown' : 'Unassigned');
      if (!group.reps.includes(rep)) group.reps.push(rep);

      // Aggregate products
      order.items?.forEach(item => {
        const existingProduct = group.products.find(p => p.productName === item.product_name);
        if (existingProduct) {
          existingProduct.quantity += item.quantity;
          existingProduct.total += item.total;
        } else {
          group.products.push({
            productName: item.product_name,
            quantity: item.quantity,
            unit: item.unit,
            total: item.total
          });
        }
      });
    });

    return Array.from(retailerMap.values()).sort((a, b) => b.totalValue - a.totalValue);
  };

  // Group orders by product for a date (packing list view)
  const getProductGroups = (orders: Order[]): ProductGroup[] => {
    const productMap = new Map<string, ProductGroup>();

    orders.forEach(order => {
      order.items?.forEach(item => {
        const key = item.product_name;
        if (!productMap.has(key)) {
          productMap.set(key, {
            productName: item.product_name,
            unit: item.unit,
            totalQuantity: 0,
            totalValue: 0,
            retailers: []
          });
        }
        const group = productMap.get(key)!;
        group.totalQuantity += item.quantity;
        group.totalValue += item.total;

        const existingRetailer = group.retailers.find(r => r.retailerName === order.retailer_name);
        if (existingRetailer) {
          existingRetailer.quantity += item.quantity;
          existingRetailer.total += item.total;
        } else {
          group.retailers.push({
            retailerName: order.retailer_name,
            quantity: item.quantity,
            total: item.total
          });
        }
      });
    });

    return Array.from(productMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
  };

  const toggleDate = (date: string) => {
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedDates(newExpanded);
  };


  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* The real numbers, aggregated in the database over every order in the
          period. The tiles that used to sit here counted the 500 rows this
          component had fetched and presented that as the total. */}
      <DistributorSecondaryAnalytics distributorId={distributorId} />

      {/* Search and Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Secondary Orders ({filteredOrders.length})
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-3 w-3" />
              Filters
            </Button>
          </div>

          {/* Search Bar */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by retailer, invoice or product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filters */}
          {/* Export and the live count; sorting and filtering moved onto the
              column headings, where the thing being sorted is named. */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Select value={period} onValueChange={(v) => { setPeriod(v); setPage(1); }}>
              <SelectTrigger className="h-8 w-[185px] text-xs">
                <CalendarRange className="h-3.5 w-3.5 mr-1.5 shrink-0 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIST_PERIODS.map(x => (
                  <SelectItem key={x.key} value={x.key} className="text-xs">{x.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {period === "custom" && (
              <div className="flex items-center gap-1.5">
                <Input type="date" value={customFrom} max={customTo} className="h-8 w-[140px] text-xs"
                  onChange={e => e.target.value && setCustomFrom(e.target.value)} />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="date" value={customTo} min={customFrom} className="h-8 w-[140px] text-xs"
                  onChange={e => e.target.value && setCustomTo(e.target.value)} />
              </div>
            )}
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={exportOrders}>
              <Download className="h-3.5 w-3.5" /> Excel
            </Button>
            {filtersOn > 0 && (
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5"
                onClick={() => setF({ dateFrom: "", dateTo: "", minOrders: "", minShops: "", rep: "all", minValue: "" })}>
                <X className="h-3.5 w-3.5" /> Clear {filtersOn} filter{filtersOn === 1 ? "" : "s"}
              </Button>
            )}
            <span className="text-xs text-muted-foreground ml-auto tabular-nums">
              {filteredOrders.length} order{filteredOrders.length === 1 ? '' : 's'} ·{' '}
              {groupedByDate.length} day{groupedByDate.length === 1 ? '' : 's'}
            </span>
          </div>

          {showFilters && (
            <div className="flex gap-2 mt-3 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="dispatched">Dispatched</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-40"
              />
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {groupedByDate.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No secondary orders found
            </p>
          ) : (
            <div className="rounded-lg border">
            {/* Column headings carry their own sort and filter. */}
            <div className={cn(
              "grid items-center gap-x-3 px-2.5 py-1.5 bg-muted/60 border-b rounded-t-lg",
              "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
              GRID,
            )}>
              <span />
              <ColHead label="Date" col="date" sortCol={sortCol} sortDir={sortDir} onSort={sortOn}
                active={!!(colFilter.dateFrom || colFilter.dateTo)}>
                <div className="space-y-2">
                  <label className="block text-[11px] font-medium">From</label>
                  <Input type="date" className="h-8 text-xs" value={colFilter.dateFrom}
                    onChange={e => setF({ dateFrom: e.target.value })} />
                  <label className="block text-[11px] font-medium">To</label>
                  <Input type="date" className="h-8 text-xs" value={colFilter.dateTo}
                    onChange={e => setF({ dateTo: e.target.value })} />
                </div>
              </ColHead>
              <ColHead label="Orders" col="orders" sortCol={sortCol} sortDir={sortDir} onSort={sortOn}
                active={!!colFilter.minOrders} className="hidden sm:flex">
                <label className="block text-[11px] font-medium mb-1">At least</label>
                <Input type="number" min={0} className="h-8 text-xs" placeholder="any"
                  value={colFilter.minOrders} onChange={e => setF({ minOrders: e.target.value })} />
              </ColHead>
              <ColHead label="Shops" col="shops" sortCol={sortCol} sortDir={sortDir} onSort={sortOn}
                active={!!colFilter.minShops} className="hidden md:flex">
                <label className="block text-[11px] font-medium mb-1">At least</label>
                <Input type="number" min={0} className="h-8 text-xs" placeholder="any"
                  value={colFilter.minShops} onChange={e => setF({ minShops: e.target.value })} />
              </ColHead>
              <ColHead label="Salesman" col="rep" sortCol={sortCol} sortDir={sortDir} onSort={sortOn}
                active={colFilter.rep !== "all"} className="hidden sm:flex">
                <Select value={colFilter.rep} onValueChange={v => setF({ rep: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All salesmen</SelectItem>
                    {reps.map(r => (
                      <SelectItem key={r.id} value={r.id} className="text-xs">{r.name} ({r.count})</SelectItem>
                    ))}
                    {hasUnassigned && <SelectItem value="none" className="text-xs">Unassigned</SelectItem>}
                  </SelectContent>
                </Select>
              </ColHead>
              <ColHead label="Value" col="value" sortCol={sortCol} sortDir={sortDir} onSort={sortOn}
                active={!!colFilter.minValue} align="right">
                <label className="block text-[11px] font-medium mb-1">At least</label>
                <Input type="number" min={0} className="h-8 text-xs" placeholder="any"
                  value={colFilter.minValue} onChange={e => setF({ minValue: e.target.value })} />
              </ColHead>
            </div>

            <div className="divide-y">
              {pagedGroups.map((dateGroup, gi) => {
                // Month headings only make sense while the list is in date
                // order; sorted by value the dates interleave.
                const byDate = sortCol === 'date';
                const month = dateGroup.date.slice(0, 7);
                const newMonth = byDate && month !== pagedGroups[gi - 1]?.date.slice(0, 7);
                // Totals come from the whole filtered set, not just this
                // page, or a month split across pages would under-report.
                const monthTotal = newMonth
                  ? groupedByDate.filter(g => g.date.slice(0, 7) === month)
                  : [];
                return (
                <div key={dateGroup.date}>
                {newMonth && (
                  <div className="flex items-center gap-2 pl-[29px] pr-2.5 py-0.5 bg-muted/60 border-b">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {format(new Date(dateGroup.date), 'MMMM yyyy')}
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums ml-auto">
                      {monthTotal.reduce((n, g) => n + g.orderCount, 0)} orders ·{' '}
                      {fmtMoney(monthTotal.reduce((n, g) => n + g.totalValue, 0))}
                    </span>
                  </div>
                )}
                <Collapsible
                  open={expandedDates.has(dateGroup.date)}
                  onOpenChange={() => toggleDate(dateGroup.date)}
                >
                  <CollapsibleTrigger asChild>
                    {/* A grid, not a flex row: every column starts at the same
                        x on every row, so the dates, counts, names and totals
                        read down the page as columns. */}
                    <div className={cn(
                      "grid items-center gap-x-3 px-2.5 py-1 cursor-pointer",
                      "hover:bg-muted/70 transition-colors border-b last:border-0",
                      GRID,
                    )}>
                      {expandedDates.has(dateGroup.date) ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}

                      <span className="text-sm font-medium tabular-nums truncate">
                        {sortCol === 'date'
                          ? dateGroup.formattedDate
                          : format(new Date(dateGroup.date), 'd MMM yyyy')}
                      </span>

                      {/* Only what this day does not share with every other
                          day. A run of "1 ord · 1 shop · 1 rep" is noise, so
                          singletons stay quiet and the lone salesman is named
                          instead of counted. */}
                      <span className="hidden sm:block text-xs text-muted-foreground tabular-nums text-right">
                        {dateGroup.orderCount}
                      </span>

                      <span className="hidden md:block text-xs text-muted-foreground tabular-nums text-right">
                        {dateGroup.retailerCount}
                      </span>

                      <span className="hidden sm:block text-xs text-muted-foreground truncate"
                        {...fullNameProps(dateGroup.repLabel)} />

                      {/* The total, with how big this day was against the best
                          day on screen drawn behind it. */}
                      <span className="relative text-right">
                        <span
                          className="absolute inset-y-0 right-0 rounded bg-primary/10"
                          style={{ width: `${Math.max(2, (dateGroup.totalValue / maxDayValue) * 100)}%` }}
                          aria-hidden
                        />
                        <span className="relative text-sm font-semibold tabular-nums pr-1">
                          {fmtMoney(dateGroup.totalValue)}
                        </span>
                      </span>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent className="mt-2">
                    <div className="border rounded-lg p-3">
                      <Tabs defaultValue="retailer" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 mb-3">
                          <TabsTrigger value="retailer" className="gap-1 text-xs">
                            <Store className="h-3 w-3" />
                            By Retailer
                          </TabsTrigger>
                          <TabsTrigger value="product" className="gap-1 text-xs">
                            <Package className="h-3 w-3" />
                            By Product
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="retailer" className="space-y-3 mt-0">
                          {getRetailerGroups(dateGroup.orders).map(retailer => (
                            <div key={retailer.retailerId} className="border rounded-lg p-3 bg-background">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Store className="h-4 w-4 text-primary shrink-0" />
                                  <span className="font-medium text-sm truncate" {...fullNameProps(retailer.retailerName)} />
                                  {retailer.reps.length > 0 && (
                                    <Badge variant="outline" className="text-[10px] shrink-0 gap-1">
                                      <Users className="h-3 w-3" />
                                      {retailer.reps.join(', ')}
                                    </Badge>
                                  )}
                                </div>
                                <span className="font-semibold text-sm">
                                  {fmtMoney(retailer.totalValue)}
                                </span>
                              </div>
                              <div className="space-y-1 pl-6">
                                {retailer.products.map((product, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>{product.productName}</span>
                                    <span>
                                      {product.quantity} {product.unit} • {fmtMoney(product.total)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </TabsContent>

                        <TabsContent value="product" className="space-y-3 mt-0">
                          {getProductGroups(dateGroup.orders).map((product, idx) => (
                            <div key={idx} className="border rounded-lg p-3 bg-background">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Package className="h-4 w-4 text-primary" />
                                  <span className="font-medium text-sm">{product.productName}</span>
                                </div>
                                <div className="text-right">
                                  <span className="font-semibold text-sm">
                                    {product.totalQuantity} {product.unit}
                                  </span>
                                  <p className="text-xs text-muted-foreground">
                                    {fmtMoney(product.totalValue)}
                                  </p>
                                </div>
                              </div>
                              <div className="space-y-1 pl-6">
                                {product.retailers.map((retailer, ridx) => (
                                  <div key={ridx} className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>{retailer.retailerName}</span>
                                    <span>
                                      {retailer.quantity} {product.unit} • {fmtMoney(retailer.total)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </TabsContent>
                      </Tabs>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
                </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t px-2.5 py-2">
              <span className="text-xs text-muted-foreground tabular-nums">
                {groupedByDate.length === 0 ? "No days" : (
                  <>Days {(safePage - 1) * perPage + 1}&ndash;
                  {Math.min(safePage * perPage, groupedByDate.length)} of {groupedByDate.length}</>
                )}
              </span>
              <Select value={String(perPage)} onValueChange={v => { setPerPage(Number(v)); setPage(1); }}>
                <SelectTrigger className="h-7 w-[112px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map(n => (
                    <SelectItem key={n} value={String(n)} className="text-xs">{n} / page</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="ml-auto flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 px-2"
                  disabled={safePage <= 1} onClick={() => setPage(1)}>
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" className="h-7 px-2"
                  disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs tabular-nums px-1.5">{safePage} / {pageCount}</span>
                <Button variant="outline" size="sm" className="h-7 px-2"
                  disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>
                  <ChevronRightIcon className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" className="h-7 px-2"
                  disabled={safePage >= pageCount} onClick={() => setPage(pageCount)}>
                  <ChevronsRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
