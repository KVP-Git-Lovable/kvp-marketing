import { useState, useEffect, useMemo } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Package, Calendar, Truck, Clock, Eye, CheckCircle, XCircle,
  Search, Filter, X, CalendarRange, ArrowUp, ArrowDown, ArrowUpDown,
  ChevronLeft, ChevronRight as ChevronRightIcon, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type SortCol = "date" | "number" | "status" | "value";

/** One template for the header and every row, so columns cannot drift apart. */
const GRID = [
  "grid-cols-[minmax(0,1fr)_auto]",
  "sm:grid-cols-[112px_minmax(0,1fr)_110px_112px]",
  "md:grid-cols-[112px_minmax(0,1fr)_110px_96px_112px]",
].join(" ");

// Local parts, not toISOString: that shifts the boundary a day east of
// Greenwich, the same bug the secondary list had.
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

interface PrimaryOrder {
  id: string;
  order_number: string;
  order_date: string;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  status: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  payment_terms: string | null;
  notes: string | null;
  dispatch_reference: string | null;
  transporter_name: string | null;
  vehicle_number: string | null;
  created_at: string;
}

interface OrderItem {
  id: string;
  product_name: string;
  variant_name: string | null;
  sku: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_percent: number;
  tax_percent: number;
  line_total: number;
}


/**
 * A column heading that sorts on click and, where one is given, carries its
 * own filter behind the funnel. Matches the secondary list so the two tabs
 * are read the same way.
 */
function PrimaryColHead({
  label, col, sortCol, sortDir, onSort, active = false, children, className, align = "left",
}: {
  label: string;
  col: SortCol;
  sortCol: SortCol;
  sortDir: "asc" | "desc";
  onSort: (c: SortCol) => void;
  active?: boolean;
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right";
}) {
  const sorted = sortCol === col;
  return (
    <span className={cn("flex items-center gap-0.5 min-w-0", align === "right" && "justify-end", className)}>
      <button
        type="button"
        onClick={() => onSort(col)}
        title={`Sort by ${label.toLowerCase()}`}
        className={cn(
          "inline-flex items-center gap-1 rounded px-1 py-0.5 -mx-1 truncate",
          "hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          sorted && "text-foreground",
        )}
      >
        {label}
        {sorted
          ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
          : <ArrowUpDown className="h-3 w-3 opacity-30" />}
      </button>
      {children && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              title={`Filter ${label.toLowerCase()}`}
              className={cn(
                "rounded p-0.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                active ? "text-primary" : "opacity-40",
              )}
            >
              <Filter className="h-3 w-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent align={align === "right" ? "end" : "start"} className="w-52 p-3">
            {children}
          </PopoverContent>
        </Popover>
      )}
    </span>
  );
}

interface DistributorPrimaryOrdersProps {
  distributorId: string;
}

export const DistributorPrimaryOrders = ({ distributorId }: DistributorPrimaryOrdersProps) => {
  const { format: fmtMoney } = useCurrency();
  const [orders, setOrders] = useState<PrimaryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<PrimaryOrder | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  /** The list used to pull every order ever placed; it now follows a window,
   *  so the heading counts the period rather than all history. */
  const [period, setPeriod] = useState("12");
  const [customFrom, setCustomFrom] = useState(() => isoDate(new Date(new Date().getFullYear(), 0, 1)));
  const [customTo, setCustomTo] = useState(() => isoDate(new Date()));
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<SortCol>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [colFilter, setColFilter] = useState({ status: "all", minValue: "" });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  const listWindow = useMemo(() => {
    const chosen = LIST_PERIODS.find((x) => x.key === period);
    if (period === "custom") return { from: customFrom, to: customTo };
    if (chosen?.fy !== undefined) {
      return { from: isoDate(new Date(chosen.fy, 3, 1)), to: isoDate(new Date(chosen.fy + 1, 2, 31)) };
    }
    const now = new Date();
    return {
      from: isoDate(new Date(now.getFullYear(), now.getMonth() - (chosen?.months ?? 11), 1)),
      to: isoDate(now),
    };
  }, [period, customFrom, customTo]);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('primary_orders')
        .select('id, order_number, order_date, expected_delivery_date, actual_delivery_date, status, subtotal, discount_amount, tax_amount, total_amount, payment_terms, notes, dispatch_reference, transporter_name, vehicle_number, created_at')
        .eq('distributor_id', distributorId)
        .gte('order_date', listWindow.from)
        .lte('order_date', listWindow.to)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      console.error('Error loading orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const loadOrderItems = async (orderId: string) => {
    setLoadingItems(true);
    try {
      const { data, error } = await supabase
        .from('primary_order_items')
        .select('id, product_name, variant_name, sku, quantity, unit, unit_price, discount_percent, tax_percent, line_total')
        .eq('order_id', orderId);

      if (error) throw error;
      setOrderItems(data || []);
    } catch (error: any) {
      console.error('Error loading order items:', error);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleViewOrder = (order: PrimaryOrder) => {
    setSelectedOrder(order);
    loadOrderItems(order.id);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'bg-muted text-muted-foreground',
      submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      confirmed: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
      processing: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      dispatched: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      in_transit: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
      delivered: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      partially_delivered: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  const getStatusIcon = (status: string) => {
    if (['draft', 'submitted'].includes(status)) return <Clock className="w-4 h-4" />;
    if (['confirmed', 'processing'].includes(status)) return <Package className="w-4 h-4" />;
    if (['dispatched', 'in_transit'].includes(status)) return <Truck className="w-4 h-4" />;
    if (status === 'delivered') return <CheckCircle className="w-4 h-4" />;
    if (status === 'cancelled') return <XCircle className="w-4 h-4" />;
    return <Package className="w-4 h-4" />;
  };

  // Above the loading early-return: a hook after it would never register on
  // the first render, which left the list spinning forever.
  useEffect(() => {
    loadOrders();
  }, [distributorId, listWindow.from, listWindow.to]);

  // Calculate summary stats
  const totalOrders = orders.length;
  const totalValue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const pendingOrders = orders.filter(o => ['submitted', 'confirmed', 'processing'].includes(o.status)).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  // Search, per-column filters, then the chosen sort — the same shape the
  // secondary list uses, so the two read alike.
  const visible = (() => {
    const q = search.trim().toLowerCase();
    let rows = orders.filter((o) => {
      if (q && !(o.order_number?.toLowerCase().includes(q) || o.status?.toLowerCase().includes(q))) return false;
      if (colFilter.status !== "all" && o.status !== colFilter.status) return false;
      if (colFilter.minValue && Number(o.total_amount ?? 0) < Number(colFilter.minValue)) return false;
      return true;
    });
    const cmp: Record<SortCol, (a: PrimaryOrder, b: PrimaryOrder) => number> = {
      date: (a, b) => (a.order_date ?? "").localeCompare(b.order_date ?? ""),
      number: (a, b) => (a.order_number ?? "").localeCompare(b.order_number ?? ""),
      status: (a, b) => (a.status ?? "").localeCompare(b.status ?? ""),
      value: (a, b) => Number(a.total_amount ?? 0) - Number(b.total_amount ?? 0),
    };
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => cmp[sortCol](a, b) * dir);
  })();

  const pageCount = Math.max(1, Math.ceil(visible.length / perPage));
  const safePage = Math.min(page, pageCount);
  const paged = visible.slice((safePage - 1) * perPage, safePage * perPage);
  const statuses = [...new Set(orders.map((o) => o.status).filter(Boolean))] as string[];

  const sortOn = (col: SortCol) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir(col === "number" || col === "status" ? "asc" : "desc"); }
    setPage(1);
  };
  const setF = (patch: Partial<typeof colFilter>) => { setColFilter((c) => ({ ...c, ...patch })); setPage(1); };
  const filtersOn = (colFilter.status !== "all" ? 1 : 0) + (colFilter.minValue ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* The three tiles that stood here repeated the analytics block above,
          which already reports orders, value and what is pending for the
          same distributor. What the list needs is a way to be read. */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Primary Orders ({visible.length})
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={period} onValueChange={(v) => { setPeriod(v); setPage(1); }}>
                <SelectTrigger className="h-8 w-[185px] text-xs">
                  <CalendarRange className="h-3.5 w-3.5 mr-1.5 shrink-0 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIST_PERIODS.map((x) => (
                    <SelectItem key={x.key} value={x.key} className="text-xs">{x.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {period === "custom" && (
                <div className="flex items-center gap-1.5">
                  <Input type="date" value={customFrom} max={customTo} className="h-8 w-[140px] text-xs"
                    onChange={(e) => e.target.value && setCustomFrom(e.target.value)} />
                  <span className="text-xs text-muted-foreground">to</span>
                  <Input type="date" value={customTo} min={customFrom} className="h-8 w-[140px] text-xs"
                    onChange={(e) => e.target.value && setCustomTo(e.target.value)} />
                </div>
              )}
              {filtersOn > 0 && (
                <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5"
                  onClick={() => setF({ status: "all", minValue: "" })}>
                  <X className="h-3.5 w-3.5" /> Clear {filtersOn} filter{filtersOn === 1 ? "" : "s"}
                </Button>
              )}
            </div>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8 h-9" placeholder="Search by order number or status..."
              value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="rounded-lg border">
            {/* Column headings carry their own sort and filter. */}
            <div className={cn(
              "grid items-center gap-x-3 px-2.5 py-1.5 bg-muted/60 border-b rounded-t-lg",
              "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground", GRID,
            )}>
              <PrimaryColHead label="Date" col="date" sortCol={sortCol} sortDir={sortDir} onSort={sortOn} className="hidden sm:flex" />
              <PrimaryColHead label="Order" col="number" sortCol={sortCol} sortDir={sortDir} onSort={sortOn} />
              <PrimaryColHead label="Status" col="status" sortCol={sortCol} sortDir={sortDir} onSort={sortOn}
                active={colFilter.status !== "all"} className="hidden sm:flex">
                <Select value={colFilter.status} onValueChange={(v) => setF({ status: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All statuses</SelectItem>
                    {statuses.map((st) => (
                      <SelectItem key={st} value={st} className="text-xs capitalize">{st}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PrimaryColHead>
              <span className="hidden md:block" />
              <PrimaryColHead label="Value" col="value" sortCol={sortCol} sortDir={sortDir} onSort={sortOn}
                active={!!colFilter.minValue} align="right">
                <label className="block text-[11px] font-medium mb-1">At least</label>
                <Input type="number" min={0} className="h-8 text-xs" placeholder="any"
                  value={colFilter.minValue} onChange={(e) => setF({ minValue: e.target.value })} />
              </PrimaryColHead>
            </div>

            {paged.length === 0 ? (
              <div className="py-10 text-center">
                <Package className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  {orders.length === 0
                    ? "No primary orders in this period"
                    : "Nothing matches those filters"}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {paged.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => { setSelectedOrder(order); loadOrderItems(order.id); }}
                    className={cn(
                      "grid items-center gap-x-3 w-full text-left px-2.5 py-2",
                      "hover:bg-muted/60 transition-colors", GRID,
                    )}
                  >
                    <span className="hidden sm:block text-sm tabular-nums">
                      {order.order_date ? format(new Date(order.order_date), 'd MMM yyyy') : '—'}
                    </span>
                    <span className="text-sm font-medium truncate">{order.order_number}</span>
                    <span className="hidden sm:block">
                      <Badge variant="outline" className={cn("text-[10px] capitalize", getStatusColor(order.status))}>
                        {order.status}
                      </Badge>
                    </span>
                    <span className="hidden md:block text-xs text-muted-foreground tabular-nums">
                      {order.expected_delivery_date
                        ? format(new Date(order.expected_delivery_date), 'd MMM')
                        : ''}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-right">
                      {fmtMoney(order.total_amount)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t px-2.5 py-2">
              <span className="text-xs text-muted-foreground tabular-nums">
                {visible.length === 0 ? "No orders" : (
                  <>Orders {(safePage - 1) * perPage + 1}&ndash;
                  {Math.min(safePage * perPage, visible.length)} of {visible.length}</>
                )}
              </span>
              <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); }}>
                <SelectTrigger className="h-7 w-[112px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map((n) => (
                    <SelectItem key={n} value={String(n)} className="text-xs">{n} / page</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="ml-auto flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 px-2" disabled={safePage <= 1} onClick={() => setPage(1)}>
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" className="h-7 px-2" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs tabular-nums px-1.5">{safePage} / {pageCount}</span>
                <Button variant="outline" size="sm" className="h-7 px-2" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>
                  <ChevronRightIcon className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" className="h-7 px-2" disabled={safePage >= pageCount} onClick={() => setPage(pageCount)}>
                  <ChevronsRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              {selectedOrder?.order_number}
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Order Date</p>
                  <p className="font-medium">{format(new Date(selectedOrder.order_date), 'dd MMM yyyy')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge className={getStatusColor(selectedOrder.status)}>
                    {selectedOrder.status.replace('_', ' ')}
                  </Badge>
                </div>
                {selectedOrder.expected_delivery_date && (
                  <div>
                    <p className="text-xs text-muted-foreground">Expected Delivery</p>
                    <p className="font-medium">{format(new Date(selectedOrder.expected_delivery_date), 'dd MMM yyyy')}</p>
                  </div>
                )}
                {selectedOrder.actual_delivery_date && (
                  <div>
                    <p className="text-xs text-muted-foreground">Delivered On</p>
                    <p className="font-medium">{format(new Date(selectedOrder.actual_delivery_date), 'dd MMM yyyy')}</p>
                  </div>
                )}
              </div>

              {/* Order Items */}
              <div>
                <h4 className="font-medium mb-2 text-sm">Items</h4>
                {loadingItems ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Product</TableHead>
                          <TableHead className="text-xs text-right">Qty</TableHead>
                          <TableHead className="text-xs text-right">Price</TableHead>
                          <TableHead className="text-xs text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {orderItems.map(item => (
                          <TableRow key={item.id}>
                            <TableCell className="text-sm">
                              <div>
                                <p>{item.product_name}</p>
                                {item.variant_name && (
                                  <p className="text-xs text-muted-foreground">{item.variant_name}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-right">
                              {item.quantity} {item.unit}
                            </TableCell>
                            <TableCell className="text-sm text-right">
                              {fmtMoney(item.unit_price)}
                            </TableCell>
                            <TableCell className="text-sm text-right font-medium">
                              {fmtMoney(item.line_total)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-48 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{fmtMoney(selectedOrder.subtotal)}</span>
                  </div>
                  {selectedOrder.discount_amount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-{fmtMoney(selectedOrder.discount_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold pt-1 border-t">
                    <span>Total</span>
                    <span>{fmtMoney(selectedOrder.total_amount)}</span>
                  </div>
                </div>
              </div>

              {/* Dispatch Info */}
              {selectedOrder.dispatch_reference && (
                <div className="p-3 bg-muted/50 rounded-lg text-sm">
                  <p className="font-medium mb-2">Dispatch Details</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Reference</p>
                      <p>{selectedOrder.dispatch_reference}</p>
                    </div>
                    {selectedOrder.transporter_name && (
                      <div>
                        <p className="text-xs text-muted-foreground">Transporter</p>
                        <p>{selectedOrder.transporter_name}</p>
                      </div>
                    )}
                    {selectedOrder.vehicle_number && (
                      <div>
                        <p className="text-xs text-muted-foreground">Vehicle</p>
                        <p>{selectedOrder.vehicle_number}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
