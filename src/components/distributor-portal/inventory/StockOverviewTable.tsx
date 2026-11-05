import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightIcon, Pencil, Loader2, AlertTriangle, Plus, Search, X, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ownedReturns } from '@/lib/returnAttribution';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import BatchEditDialog from './BatchEditDialog';
import { getDisplayValues } from '@/utils/unitDisplayUtils';
import {
  prefetchAllProductUnits,
  getCachedProductUnits,
  defaultSalesUnitIn,
  fromBaseIn,
  type ProductUnit,
} from '@/lib/uomEngine';

interface InventoryRow {
  id: string;
  product_id: string;
  product_name: string;
  available_quantity: number;
  reserved_quantity: number;
  damaged_quantity: number;
  expired_quantity: number;
  /** Issued to a van and not yet accounted for. Owned, not sellable here. */
  on_van_quantity?: number;
  updated_at: string;
  unit?: string | null;
}

interface BatchRow {
  id: string;
  batch_no: string;
  expiry_date: string | null;
  quantity: number;
  available_qty: number;
  reserved_qty: number;
}

/**
 * A return of this product, as the retailer's own account of it.
 *
 * The Damaged and Expired columns say how much stock is unusable; they cannot
 * say whether it broke in the warehouse or came back damaged off a van. These
 * rows are where that question gets answered.
 */
interface ReturnRow {
  id: string;
  quantity: number;
  unit: string | null;
  reason: string | null;
  credit_note_number: string | null;
  credit_note_date: string | null;
  retailer_name: string | null;
  /** Carried only so the row can be attributed; never rendered. */
  retailer_id: string | null;
  original_order_id: string | null;
  distributor_id: string | null;
}

/** The stored reason codes, in the words the rep picked them by. */
const RETURN_REASON_LABEL: Record<string, string> = {
  damaged: 'Damaged',
  expired: 'Expired',
  quality_issue: 'Quality issue',
  unsold_stock: 'Unsold stock',
  other: 'Other',
};

/** Returns are tinted by where the stock ends up, not by how bad it sounds. */
const returnReasonTone = (reason: string | null): string => {
  const r = (reason || '').toLowerCase();
  if (r.includes('expir')) return 'bg-slate-100 text-slate-700 dark:bg-slate-900/50 dark:text-slate-300';
  if (r.includes('damag') || r.includes('quality')) return 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300';
  return 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300';
};

interface StockOverviewTableProps {
  inventory: InventoryRow[];
  productFilter: string;
  onProductFilterChange: (val: string) => void;
  products: { id: string; name: string; unit?: string }[];
  distributorId?: string;
  /** Opens the add-stock dialog on a given product. */
  onAddBatch?: (productId: string) => void;
}

type SortField = 'product_name' | 'available_quantity' | 'on_van_quantity' | 'reserved_quantity' | 'damaged_quantity' | 'expired_quantity' | 'updated_at';

const PAGE_SIZE = 20;

/** Stock is stored in each product's base unit — grams for a weight product,
 *  pieces for one counted by the piece. Nobody wants to read 990,000 grams, so
 *  it is shown in the unit the admin marked as the default for selling, and the
 *  unit is named on every figure. It used to be converted silently and labelled
 *  "units", which is worse than showing grams: the number was right and there
 *  was no way to tell what it meant. */
const UNIT_LABEL = (code: string) => code.replace(/^KG$/i, 'kg').replace(/^GRAM$/i, 'g');

/** Anything inside this many days is worth counting down to. */
const NEAR_EXPIRY_DAYS = 30;

interface BatchIndexEntry {
  batchNos: string[];
  /** At least one batch has no expiry date at all. */
  undated: boolean;
  /** Whole days until the nearest expiry; negative once it has passed. */
  soonestDays: number | null;
}

/** Whole days from today to a date. Compared date-to-date, so a batch expiring
 *  today reads as 0 all day rather than flipping to expired at noon. */
const daysUntil = (iso: string): number => {
  const d = new Date(iso);
  const a = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const now = new Date();
  const b = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / 86400000);
};

/** How the nearest expiry should read, or null when it is far enough away to
 *  be nobody's problem today. */
const expiryNote = (days: number | null): { text: string; tone: string } | null => {
  if (days === null) return null;

  if (days < 0) {
    const ago = Math.abs(days);
    return {
      text: ago === 1 ? 'expired yesterday' : `expired ${ago} days ago`,
      tone: 'text-destructive font-medium',
    };
  }
  if (days === 0) return { text: 'expires today', tone: 'text-destructive font-medium' };
  if (days > NEAR_EXPIRY_DAYS) return null;

  const text = days === 1 ? 'expires tomorrow' : `expires in ${days} days`;
  // Urgency carries the colour, so a week out and a month out do not look alike.
  const tone = days <= 7 ? 'text-destructive font-medium'
    : days <= 14 ? 'text-orange-600 font-medium'
    : 'text-amber-600';
  return { text, tone };
};

const StockOverviewTable = ({ inventory, productFilter, onProductFilterChange, products, distributorId, onAddBatch }: StockOverviewTableProps) => {
  const [sortField, setSortField] = useState<SortField>('product_name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [batchData, setBatchData] = useState<Record<string, BatchRow[]>>({});
  const [batchLoading, setBatchLoading] = useState<Set<string>>(new Set());
  const [returnData, setReturnData] = useState<Record<string, ReturnRow[]>>({});
  const [editingBatch, setEditingBatch] = useState<BatchRow | null>(null);
  const [productUoms, setProductUoms] = useState<Record<string, ProductUnit[]>>({});
  /** Per product, the unit the viewer has chosen to read it in. */
  const [unitChoice, setUnitChoice] = useState<Record<string, string>>({});

  // Keyed on the ids themselves, not the array: the parent rebuilds that on
  // every render, and depending on it would refetch the whole configuration
  // each time anything on the page changed.
  const productIdKey = useMemo(
    () => [...new Set(inventory.map(r => r.product_id))].sort().join(','),
    [inventory],
  );

  useEffect(() => {
    if (!productIdKey) return;
    let cancelled = false;
    void (async () => {
      // The engine keeps one in-memory cache for the whole app; this fills it
      // and then takes a snapshot for the rows on screen, so conversion during
      // render needs no await.
      await prefetchAllProductUnits();
      if (cancelled) return;
      const map: Record<string, ProductUnit[]> = {};
      for (const id of productIdKey.split(',')) {
        const units = getCachedProductUnits(id);
        if (units && units.length > 0) map[id] = units;
      }
      setProductUoms(map);
    })();
    return () => { cancelled = true; };
  }, [productIdKey]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [batchIndex, setBatchIndex] = useState<Record<string, BatchIndexEntry>>({});

  useEffect(() => {
    if (!distributorId) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('inventory_batches')
        .select('product_id, batch_no, expiry_date, quantity')
        .eq('distributor_id', distributorId)
        .gt('quantity', 0);

      if (cancelled || error) {
        if (error) console.error('Error indexing batches:', error);
        return;
      }

      const index: Record<string, BatchIndexEntry> = {};
      (data || []).forEach((b: any) => {
        const entry = index[b.product_id] || { batchNos: [], undated: false, soonestDays: null };
        if (b.batch_no) entry.batchNos.push(String(b.batch_no).toLowerCase());

        if (!b.expiry_date) {
          entry.undated = true;
        } else {
          const days = daysUntil(b.expiry_date);
          // The batch nearest its expiry is the one worth reporting; a product
          // with stock expiring in three days is a three-day problem whatever
          // else sits behind it.
          if (entry.soonestDays === null || days < entry.soonestDays) {
            entry.soonestDays = days;
          }
        }
        index[b.product_id] = entry;
      });
      setBatchIndex(index);
    })();

    return () => { cancelled = true; };
  }, [distributorId, inventory]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const fetchBatches = useCallback(async (productId: string) => {
    if (!distributorId) return;
    setBatchLoading(prev => new Set(prev).add(productId));
    try {
      const { data, error } = await supabase
        .from('inventory_batches')
        .select('id, batch_no, expiry_date, quantity, available_qty, reserved_qty')
        .eq('distributor_id', distributorId)
        .eq('product_id', productId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBatchData(prev => ({ ...prev, [productId]: (data || []) as BatchRow[] }));
    } catch (err) {
      console.error('Error fetching batches:', err);
    } finally {
      setBatchLoading(prev => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }
  }, [distributorId]);

  /**
   * The returns behind this product's Damaged and Expired figures.
   *
   * Read from the credit notes rather than the inventory ledger: the ledger
   * records a van settlement as one net movement per product, so the reasons
   * are already summed away by the time they reach it. The credit note is where
   * the retailer's own account of each return survives, line by line.
   *
   * Filtered on product_id, which on a variant product catches every variant.
   * That matches the row this panel belongs to, which is itself product-level.
   */
  const fetchReturns = useCallback(async (productId: string) => {
    // Nothing below this scopes a credit note to a distributor: there is no
    // distributor_id on credit_notes, and the read policy on both tables is
    // USING (true). Filtering on product alone showed one distributor another
    // distributor's retailers, note numbers and quantities.
    if (!distributorId) {
      setReturnData(prev => ({ ...prev, [productId]: [] }));
      return;
    }

    try {
      const { data, error } = await supabase
        .from('credit_note_items')
        .select('id, quantity, unit, reason, credit_notes(credit_note_number, credit_note_date, retailer_name, retailer_id, original_order_id, distributor_id)')
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(25);
      if (error) throw error;

      const items = (data || []) as any[];
      const retailerIds = [...new Set(items.map(r => r.credit_notes?.retailer_id).filter(Boolean))];
      const orderIds = [...new Set(items.map(r => r.credit_notes?.original_order_id).filter(Boolean))];

      // Which of those belong to us. Asked of the two tables that do carry a
      // distributor, rather than inferred from the credit note.
      const [mineRetailers, mineOrders] = await Promise.all([
        retailerIds.length
          ? supabase.from('retailers').select('id').eq('distributor_id', distributorId).in('id', retailerIds)
          : Promise.resolve({ data: [], error: null } as any),
        orderIds.length
          ? supabase.from('orders').select('id').eq('distributor_id', distributorId).in('id', orderIds)
          : Promise.resolve({ data: [], error: null } as any),
      ]);
      // A failed lookup must close the panel, not open it: treating an error
      // as "owns nothing" is the safe direction here.
      if (mineRetailers.error) throw mineRetailers.error;
      if (mineOrders.error) throw mineOrders.error;

      const ownedRetailerIds = new Set<string>((mineRetailers.data || []).map((r: any) => r.id));
      const ownedOrderIds = new Set<string>((mineOrders.data || []).map((o: any) => o.id));

      const rows: ReturnRow[] = ownedReturns(
        items.map(r => ({
          id: r.id,
          quantity: Number(r.quantity) || 0,
          unit: r.unit ?? null,
          reason: r.reason ?? null,
          credit_note_number: r.credit_notes?.credit_note_number ?? null,
          credit_note_date: r.credit_notes?.credit_note_date ?? null,
          retailer_name: r.credit_notes?.retailer_name ?? null,
          retailer_id: r.credit_notes?.retailer_id ?? null,
          original_order_id: r.credit_notes?.original_order_id ?? null,
          distributor_id: r.credit_notes?.distributor_id ?? null,
        })),
        ownedRetailerIds,
        ownedOrderIds,
        distributorId,
      );
      setReturnData(prev => ({ ...prev, [productId]: rows }));
    } catch (err) {
      console.error('Error fetching returns:', err);
      // Withhold rather than leave whatever was there on screen.
      setReturnData(prev => ({ ...prev, [productId]: [] }));
    }
  }, [distributorId]);

  /** Refetch any open panel when its product's stock changes, so an added or
   *  issued batch shows without anyone collapsing and reopening the row. */
  const inventorySignature = useMemo(
    () => inventory.map(i => `${i.product_id}:${i.available_quantity}:${i.updated_at}`).join('|'),
    [inventory],
  );

  useEffect(() => {
    expandedRows.forEach(productId => {
      fetchBatches(productId);
      // A van day settling is exactly the kind of change that moves this
      // product's damaged or expired figure, and it is the change whose
      // explanation lives in the returns list.
      fetchReturns(productId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventorySignature]);

  const toggleExpand = (productId: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
        // Always refetch. Serving a cached list is how a batch added five
        // minutes ago stays invisible and the screen stops being trusted.
        fetchBatches(productId);
        fetchReturns(productId);
      }
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return inventory.filter(row => {
      if (q) {
        const nameHit = (row.product_name || '').toLowerCase().includes(q);
        // A batch number is often the only thing someone has to go on, so it
        // is searched as readily as the product name.
        const batchHit = (batchIndex[row.product_id]?.batchNos || []).some(n => n.includes(q));
        if (!nameHit && !batchHit) return false;
      }

      if (statusFilter === 'all') return true;

      const available = row.available_quantity || 0;
      const idx = batchIndex[row.product_id];

      switch (statusFilter) {
        case 'in_stock':     return available > 0;
        case 'out_of_stock': return available <= 0;
        case 'on_vans':      return (row.on_van_quantity || 0) > 0;
        case 'expiring':     return idx?.soonestDays != null && idx.soonestDays >= 0 && idx.soonestDays <= NEAR_EXPIRY_DAYS;
        case 'expired':      return idx?.soonestDays != null && idx.soonestDays < 0;
        case 'no_expiry':    return !!idx?.undated;
        default:             return true;
      }
    });
  }, [inventory, search, statusFilter, batchIndex]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal);
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /** Colour belongs to figures that carry information. A zero is not one. */
  const Qty = ({ value, tone }: { value: number; tone: string }) => (
    <span className={cn('tabular-nums', value > 0 ? tone : 'text-muted-foreground/50 font-normal')}>
      {value.toLocaleString('en-IN')}
    </span>
  );

  const SortHeader = ({ field, label, numeric }: { field: SortField; label: string; numeric?: boolean }) => (
    <TableHead
      className="cursor-pointer select-none bg-muted/50 transition-colors hover:bg-muted"
      onClick={() => toggleSort(field)}
    >
      <div className={cn(
        'flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide',
        numeric && 'justify-end',
      )}>
        {label}
        <ChevronDown className={cn(
          'w-3 h-3 transition-transform',
          sortField === field ? 'text-primary' : 'text-muted-foreground/40',
          sortField === field && sortDir === 'desc' && 'rotate-180',
        )} />
      </div>
    </TableHead>
  );

  return (
    <Card>
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold">Current Stock Overview</CardTitle>
          {(search || statusFilter !== 'all') && (
            <span className="text-xs text-muted-foreground">
              {filtered.length} of {inventory.length} products
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search products or batch numbers..."
              className="h-8 pl-8 pr-8 text-xs"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => { setSearch(''); setPage(1); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="in_stock">In stock</SelectItem>
              <SelectItem value="out_of_stock">Out of stock</SelectItem>
              <SelectItem value="on_vans">On vans</SelectItem>
              <SelectItem value="expiring">Expiring in 30 days</SelectItem>
              <SelectItem value="expired">Expired batches</SelectItem>
              <SelectItem value="no_expiry">Missing expiry</SelectItem>
            </SelectContent>
          </Select>

          <Select value={productFilter} onValueChange={(v) => { onProductFilterChange(v); setPage(1); }}>
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="All Products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              {products.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8 bg-muted/50" />
              <SortHeader field="product_name" label="Product" />
              <SortHeader field="available_quantity" label="Available" numeric />
              <SortHeader field="on_van_quantity" label="On Vans" numeric />
              <SortHeader field="reserved_quantity" label="Reserved" numeric />
              <SortHeader field="damaged_quantity" label="Damaged" numeric />
              <SortHeader field="expired_quantity" label="Expired" numeric />
              <SortHeader field="updated_at" label="Last Updated" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {(search || statusFilter !== 'all') ? (
                    <span className="inline-flex items-center gap-2 text-sm">
                      No products match that search or filter.
                      <button
                        type="button"
                        className="text-primary font-medium underline-offset-2 hover:underline"
                        onClick={() => { setSearch(''); setStatusFilter('all'); setPage(1); }}
                      >
                        Clear
                      </button>
                    </span>
                  ) : (
                    <>No inventory items found</>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              paginated.map(row => {
                const isExpanded = expandedRows.has(row.product_id);
                const batches = batchData[row.product_id];
                const isLoading = batchLoading.has(row.product_id);
                const rowUnit = row.unit || '';
                const uoms = productUoms[row.product_id];

                // The unit on screen: whatever the viewer picked, else the one
                // configured as the default for selling, else the legacy guess.
                const chosen = unitChoice[row.product_id]
                  ?? defaultSalesUnitIn(uoms)?.code
                  ?? '';

                const legacy = getDisplayValues(1, 1, 1, rowUnit);
                const displayUnit = chosen ? UNIT_LABEL(chosen) : legacy.displayUnit;

                const convertQty = (q: number) => {
                  if (chosen && uoms) {
                    const converted = fromBaseIn(uoms, q, chosen);
                    if (converted !== null) return converted;
                  }
                  return getDisplayValues(q, 1, 1, rowUnit).displayQty;
                };

                /** Rounded for reading: 2.75 kg stays 2.75, 990 kg stays 990. */
                const showQty = (q: number) => {
                  const v = convertQty(q);
                  return Number.isInteger(v) ? v.toLocaleString('en-IN')
                    : v.toLocaleString('en-IN', { maximumFractionDigits: 3 });
                };

                return (
                  <>
                    <TableRow
                      key={row.id}
                      className={cn(
                        'cursor-pointer transition-colors',
                        isExpanded ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/40',
                      )}
                      onClick={() => toggleExpand(row.product_id)}
                    >
                      <TableCell className="w-8 px-2">
                        <ChevronRightIcon
                          className={cn(
                            'w-4 h-4 text-muted-foreground transition-transform duration-200',
                            isExpanded && 'rotate-90 text-primary',
                          )}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2.5">
                          {/* A tile rather than a photo: only 9 of 146 products
                              carry an image, so real thumbnails would leave most
                              rows with an empty box. */}
                          <span className={cn(
                            'grid h-8 w-8 shrink-0 place-items-center rounded-lg border',
                            (row.available_quantity || 0) > 0
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : 'border-border bg-muted text-muted-foreground',
                          )}>
                            <Package className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <div className="truncate">
                              {row.product_name}
                              {displayUnit && (
                                <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                                  {displayUnit}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] font-normal text-muted-foreground">
                              {batchData[row.product_id] && batchData[row.product_id].length > 0 && (
                                <span>
                                  {batchData[row.product_id].length}
                                  {batchData[row.product_id].length === 1 ? ' batch' : ' batches'}
                                </span>
                              )}
                              {batchIndex[row.product_id]?.undated && (
                                <span className="inline-flex items-center gap-1 text-amber-600">
                                  <AlertTriangle className="h-3 w-3" /> missing expiry
                                </span>
                              )}
                              {(() => {
                                const note = expiryNote(batchIndex[row.product_id]?.soonestDays ?? null);
                                return note ? <span className={note.tone}>{note.text}</span> : null;
                              })()}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        <Qty value={convertQty(row.available_quantity)} tone="text-emerald-600" />
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        <Qty value={convertQty(row.on_van_quantity || 0)} tone="text-blue-600" />
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        <Qty value={convertQty(row.reserved_quantity)} tone="text-amber-600" />
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        <Qty value={convertQty(row.damaged_quantity)} tone="text-red-600" />
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        <Qty value={convertQty(row.expired_quantity)} tone="text-slate-600" />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {row.updated_at ? format(new Date(row.updated_at), 'MM/dd/yyyy') : '-'}
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${row.id}-batches`}>
                        <TableCell colSpan={8} className="p-0 bg-slate-50/80 dark:bg-slate-900/40">
                          {isLoading ? (
                            <div className="flex items-center justify-center py-4 gap-2 text-sm text-muted-foreground">
                              <Loader2 className="w-4 h-4 animate-spin" /> Loading batches…
                            </div>
                          ) : !batches || batches.length === 0 ? (
                            <div className="text-center py-4 text-sm text-muted-foreground">
                              No batches found for this product
                            </div>
                          ) : (
                            <div className="mx-4 my-3 rounded-lg border bg-background p-3 shadow-sm">
                              {(() => {
                                const batchTotal = batches.reduce((s, x) => s + (x.quantity || 0), 0);
                                // Everything the distributor holds for this
                                // product, wherever it sits and whatever state
                                // it is in. available_quantity already has
                                // reserved, damaged and expired subtracted out
                                // of it, so all three have to be added back to
                                // recover the total -- this previously added
                                // back only reserved, so damaged and expired
                                // stock counted in the batches but not in the
                                // comparison, and every row with either of them
                                // reported a discrepancy exactly that size.
                                const aggregate = (row.available_quantity || 0)
                                  + (row.reserved_quantity || 0)
                                  + (row.damaged_quantity || 0)
                                  + (row.expired_quantity || 0)
                                  + (row.on_van_quantity || 0);
                                const agrees = Math.abs(batchTotal - aggregate) < 0.001;
                                const undated = batches.filter(x => !x.expiry_date).length;
                                return (
                                  <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                    <span className="text-sm font-semibold">
                                      Batches ({batches.length})
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      Total available: {showQty(batchTotal)} {displayUnit}
                                      {batches.length > 1 && (
                                        <> = {batches.map(x => showQty(x.quantity || 0)).join(' + ')}</>
                                      )}
                                    </span>
                                    {/* The batches and the product row are two
                                        records of one quantity. Saying nothing
                                        when they disagree is how the gap grows. */}
                                    {!agrees && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10
                                                       px-2 py-0.5 text-[11px] font-medium text-destructive">
                                        <AlertTriangle className="w-3 h-3" />
                                        Batches total {showQty(batchTotal)} {displayUnit},
                                        stock says {showQty(aggregate)} {displayUnit}
                                      </span>
                                    )}
                                    {undated > 0 && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100
                                                       px-2 py-0.5 text-[11px] font-medium text-amber-800
                                                       dark:bg-amber-950/50 dark:text-amber-300">
                                        <AlertTriangle className="w-3 h-3" />
                                        {undated} without expiry
                                      </span>
                                    )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {/* Only where the product has more than
                                          one configured unit: a switch with one
                                          option is furniture. */}
                                      {uoms && uoms.length > 1 && (
                                        <div
                                          className="flex items-center gap-0.5 rounded-md border bg-muted/40 p-0.5"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {uoms.map(u => (
                                            <button
                                              key={u.code}
                                              type="button"
                                              onClick={() => setUnitChoice(prev => ({ ...prev, [row.product_id]: u.code }))}
                                              className={cn(
                                                'rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
                                                chosen === u.code
                                                  ? 'bg-background text-foreground shadow-sm'
                                                  : 'text-muted-foreground hover:text-foreground',
                                              )}
                                            >
                                              {UNIT_LABEL(u.code)}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                      {onAddBatch && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-8 gap-1.5 text-xs border-primary/40 text-primary
                                                     hover:bg-primary/5 hover:text-primary shrink-0"
                                          onClick={(e) => { e.stopPropagation(); onAddBatch(row.product_id); }}
                                        >
                                          <Plus className="w-3.5 h-3.5" /> Add Batch
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()}
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="h-8 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Batch Number</TableHead>
                                    <TableHead className="h-8 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Expiry Date</TableHead>
                                    <TableHead className="h-8 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Quantity{displayUnit && ` (${displayUnit})`}</TableHead>
                                    <TableHead className="h-8 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Available{displayUnit && ` (${displayUnit})`}</TableHead>
                                    <TableHead className="h-8 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Reserved{displayUnit && ` (${displayUnit})`}</TableHead>
                                    <TableHead className="h-8 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-24">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {batches.map(b => (
                                    <TableRow key={b.id} className="text-sm">
                                      <TableCell className="py-2 font-mono text-[12px]">{b.batch_no}</TableCell>
                                      <TableCell className="py-2">
                                        {b.expiry_date ? (
                                          (() => {
                                            const note = expiryNote(daysUntil(b.expiry_date));
                                            return (
                                              <span className="inline-flex items-center gap-2">
                                                <span>{format(new Date(b.expiry_date), 'dd MMM yyyy')}</span>
                                                {note && (
                                                  <span className={cn('text-[11px]', note.tone)}>{note.text}</span>
                                                )}
                                              </span>
                                            );
                                          })()
                                        ) : (
                                          <span className="inline-flex items-center gap-2">
                                            <span className="text-muted-foreground">-</span>
                                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100
                                                             px-2 py-0.5 text-[11px] font-medium text-amber-800
                                                             dark:bg-amber-950/50 dark:text-amber-300">
                                              <AlertTriangle className="w-3 h-3" /> Expiry not recorded
                                            </span>
                                          </span>
                                        )}
                                      </TableCell>
                                      <TableCell className="py-2 text-right tabular-nums">{showQty(b.quantity)}</TableCell>
                                      <TableCell className="py-2 text-right tabular-nums font-medium text-green-700">{showQty(Math.max(0, (b.quantity || 0) - (b.reserved_qty || 0)))}</TableCell>
                                      <TableCell className="py-2 text-right tabular-nums text-amber-600">{showQty(b.reserved_qty)}</TableCell>
                                      <TableCell className="py-2">
                                        <div className="flex items-center justify-end gap-2">
                                          {!b.expiry_date && (
                                            <button
                                              type="button"
                                              className="text-[11px] font-medium text-primary underline-offset-2 hover:underline"
                                              onClick={e => { e.stopPropagation(); setEditingBatch(b); }}
                                            >
                                              Add expiry
                                            </button>
                                          )}
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={e => { e.stopPropagation(); setEditingBatch(b); }}
                                          >
                                            <Pencil className="w-3.5 h-3.5" />
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>

                              {/* Where the Damaged and Expired figures came
                                  from. Those columns say how much stock is
                                  unusable; only this says whether it broke in
                                  the warehouse or came back that way off a van. */}
                              {(() => {
                                const returns = returnData[row.product_id];
                                if (!returns || returns.length === 0) return null;
                                return (
                                  <div className="mt-4 pt-3 border-t">
                                    <div className="flex items-center gap-2.5 flex-wrap mb-2">
                                      <span className="text-sm font-semibold">
                                        Returns ({returns.length})
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        as recorded in Order Entry, newest first
                                      </span>
                                    </div>
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="h-8 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Date</TableHead>
                                          <TableHead className="h-8 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Credit note</TableHead>
                                          <TableHead className="h-8 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Retailer</TableHead>
                                          <TableHead className="h-8 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Reason</TableHead>
                                          <TableHead className="h-8 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Quantity</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {returns.map(r => (
                                          <TableRow key={r.id} className="text-sm">
                                            <TableCell className="py-2">
                                              {r.credit_note_date
                                                ? format(new Date(r.credit_note_date), 'dd MMM yyyy')
                                                : <span className="text-muted-foreground">-</span>}
                                            </TableCell>
                                            <TableCell className="py-2 font-mono text-[12px]">
                                              {r.credit_note_number || '-'}
                                            </TableCell>
                                            <TableCell className="py-2">
                                              {r.retailer_name || <span className="text-muted-foreground">-</span>}
                                            </TableCell>
                                            <TableCell className="py-2">
                                              {/* A null reason is a line written
                                                  before the reason was stored
                                                  per line. Saying so beats
                                                  inventing a category for it. */}
                                              {r.reason ? (
                                                <span className={cn(
                                                  'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
                                                  returnReasonTone(r.reason),
                                                )}>
                                                  {RETURN_REASON_LABEL[r.reason] || r.reason}
                                                </span>
                                              ) : (
                                                <span className="text-[11px] text-muted-foreground">not recorded</span>
                                              )}
                                            </TableCell>
                                            <TableCell className="py-2 text-right tabular-nums">
                                              {r.quantity}{r.unit ? ` ${r.unit}` : ''}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {editingBatch && (
        <BatchEditDialog
          open={!!editingBatch}
          onOpenChange={(open) => { if (!open) setEditingBatch(null); }}
          batch={editingBatch}
          onSuccess={() => {
            const productId = inventory.find(i =>
              batchData[i.product_id]?.some(b => b.id === editingBatch.id)
            )?.product_id;
            if (productId) fetchBatches(productId);
            setEditingBatch(null);
          }}
        />
      )}
    </Card>
  );
};

export default StockOverviewTable;
