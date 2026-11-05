import { useState, useRef, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Upload, Info, Plus, Trash2, Search, ScanBarcode, ChevronDown, ChevronRight, Warehouse, Sparkles, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useWarehouses } from '@/hooks/useWarehouses';
import LineItemUomSelect from '@/components/uom/LineItemUomSelect';
import {
  prefetchAllProductUnits,
  getCachedProductUnits,
  type ProductUnit,
} from '@/lib/uomEngine';
import { resolveEntryUnit, firstUnresolvable, partitionByUnit } from '@/lib/entryUnits';

interface Product {
  id: string;
  name: string;
  unit?: string;
}

interface OpeningStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  distributorId: string;
  products: Product[];
  onSuccess: () => void;
  /** Opened from a product's batch panel: start on that product, selected and
   *  expanded, rather than in a list of everything. */
  initialProductId?: string | null;
}

interface BatchEntry {
  supplier_batch_code: string;
  mfg_date: string;
  expiry_date: string;
  quantity: number;
}

// The units offered now come from each product's own configuration
// (Admin Control -> UOM Master), via LineItemUomSelect.

interface ProductEntry {
  product_id: string;
  product_name: string;
  batches: BatchEntry[];
  expanded: boolean;
  existingBatchCount: number;
  entryUnit: string;
  selected: boolean;
}

const newBatch = (): BatchEntry => ({ supplier_batch_code: '', mfg_date: '', expiry_date: '', quantity: 0 });

/** Sentinel for "no bulk unit": Select will not take an empty string value. */
const OWN_UNIT = '__own__';

const OpeningStockDialog = ({ open, onOpenChange, distributorId, products, onSuccess, initialProductId }: OpeningStockDialogProps) => {
  const [date, setDate] = useState<Date>(new Date());
  const [entries, setEntries] = useState<ProductEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [bulkMfg, setBulkMfg] = useState('');
  const [bulkExpiry, setBulkExpiry] = useState('');
  const [bulkQty, setBulkQty] = useState<string>('');
  /** Empty means leave every product on its own entry unit. */
  const [bulkUnit, setBulkUnit] = useState<string>('');
  const [bulkExpanded, setBulkExpanded] = useState(true);
  const { warehouses, defaultWarehouse, loading: whLoading, reload: reloadWarehouses } = useWarehouses(distributorId);
  const fileRef = useRef<HTMLInputElement>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (defaultWarehouse && !selectedWarehouseId) {
      setSelectedWarehouseId(defaultWarehouse.id);
    }
  }, [defaultWarehouse, selectedWarehouseId]);

  // Reload warehouses every time the dialog opens so newly-created
  // warehouses appear without needing a page refresh.
  useEffect(() => {
    if (open && distributorId) {
      reloadWarehouses();
    }
  }, [open, distributorId, reloadWarehouses]);

  useEffect(() => {
    if (open && products.length > 0) {
      const initial: ProductEntry[] = products.map(p => ({
        product_id: p.id,
        product_name: p.name,
        batches: [newBatch()],
        expanded: p.id === initialProductId,
        existingBatchCount: 0,
        entryUnit: '',
        selected: p.id === initialProductId,
      }));
      setEntries(initial);
      loadExistingBatchCounts(initial, selectedWarehouseId);
    }
  }, [products, open, initialProductId]);

  useEffect(() => {
    if (open && selectedWarehouseId && entries.length > 0) {
      loadExistingBatchCounts(entries, selectedWarehouseId);
    }
  }, [selectedWarehouseId]);

  const loadExistingBatchCounts = async (productEntries: ProductEntry[], warehouseId?: string) => {
    if (!warehouseId) return;
    try {
      const productIds = productEntries.map(e => e.product_id);
      const { data, error } = await supabase
        .from('inventory_batches')
        .select('product_id')
        .eq('distributor_id', distributorId)
        .eq('warehouse_id', warehouseId)
        .in('product_id', productIds);
      if (error) return;
      const counts = new Map<string, number>();
      (data || []).forEach((row: any) => {
        counts.set(row.product_id, (counts.get(row.product_id) || 0) + 1);
      });
      setEntries(prev => prev.map(e => ({ ...e, existingBatchCount: counts.get(e.product_id) || 0 })));
    } catch {
      // non-blocking
    }
  };

  const toggleExpand = (productId: string) => {
    setEntries(prev => prev.map(e => e.product_id === productId ? { ...e, expanded: !e.expanded } : e));
  };

  const addBatch = (productId: string) => {
    setEntries(prev => prev.map(e =>
      e.product_id === productId ? { ...e, batches: [...e.batches, newBatch()] } : e
    ));
  };

  const removeBatch = (productId: string, batchIndex: number) => {
    setEntries(prev => prev.map(e =>
      e.product_id === productId
        ? { ...e, batches: e.batches.filter((_, i) => i !== batchIndex) }
        : e
    ));
  };

  const updateBatch = (productId: string, batchIndex: number, field: keyof BatchEntry, value: string | number) => {
    setEntries(prev => prev.map(e =>
      e.product_id === productId
        ? { ...e, batches: e.batches.map((b, i) => i === batchIndex ? { ...b, [field]: value } : b) }
        : e
    ));
  };

  const handleScanInput = () => {
    if (!scanInput.trim()) return;
    const search = scanInput.trim().toLowerCase();
    const match = products.find(p => p.name.toLowerCase().includes(search));
    if (match) {
      setEntries(prev => prev.map(e =>
        e.product_id === match.id
          ? {
            ...e,
            expanded: true,
            batches: e.batches[0]?.quantity === 0 && e.batches.length === 1
              ? [{ ...e.batches[0], quantity: e.batches[0].quantity + 1 }]
              : e.batches,
          }
          : e
      ));
      toast.success(`Found: ${match.name}`);
    } else {
      toast.error('Product not found. Check the name/SKU.');
    }
    setScanInput('');
    scanRef.current?.focus();
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').slice(1);
      const updated = [...entries];
      lines.forEach(line => {
        const parts = line.split(',').map(s => s.trim());
        if (parts.length >= 2) {
          const name = parts[0];
          const qty = parseInt(parts[1], 10);
          const supplierBatch = parts[2] || '';
          const expiryDate = parts[3] || '';
          if (!isNaN(qty)) {
            const match = updated.find(e => e.product_name.toLowerCase() === name.toLowerCase());
            if (match) {
              match.batches = [{ supplier_batch_code: supplierBatch, mfg_date: '', expiry_date: expiryDate, quantity: qty }];
              match.expanded = true;
            }
          }
        }
      });
      setEntries(updated);
      toast.success('CSV data loaded');
    };
    reader.readAsText(file);
  };

  const getTotalQty = (entry: ProductEntry) => entry.batches.reduce((sum, b) => sum + (b.quantity || 0), 0);

  const toggleSelect = (productId: string) => {
    setEntries(prev => prev.map(e => e.product_id === productId ? { ...e, selected: !e.selected } : e));
  };

  const selectedCount = entries.filter(e => e.selected).length;

  const applyBulk = (scope: 'selected' | 'all') => {
    const qtyNum = bulkQty === '' ? null : parseFloat(bulkQty);
    if (!bulkMfg && !bulkExpiry && (qtyNum === null || isNaN(qtyNum))) {
      toast.error('Enter at least one of Mfg Date, Expiry Date or Quantity');
      return;
    }
    if (scope === 'selected' && selectedCount === 0) {
      toast.error('Select at least one product');
      return;
    }

    const targets = entries.filter(e => (scope === 'all' ? true : e.selected));

    // Worked out from `entries` rather than inside the updater: React may
    // invoke a state updater twice, and a tally kept in there would double.
    const { takes, keepsOwn } = bulkUnit
      ? partitionByUnit(targets, bulkUnit, productUnits)
      : { takes: [], keepsOwn: [] };
    const takesBulkUnit = new Set(takes.map(e => e.product_id));
    const skipped = keepsOwn;

    setEntries(prev => prev.map(e => {
      const target = scope === 'all' ? true : e.selected;
      if (!target) return e;
      const first = e.batches[0] ?? newBatch();
      const updatedFirst: BatchEntry = {
        ...first,
        mfg_date: bulkMfg || first.mfg_date,
        expiry_date: bulkExpiry || first.expiry_date,
        quantity: qtyNum !== null && !isNaN(qtyNum) ? qtyNum : first.quantity,
      };
      // A product only takes the bulk unit when it is configured for it. KG
      // means nothing to a product counted in pieces, and forcing it would
      // either refuse on save or convert by a factor that does not exist.
      const entryUnit = takesBulkUnit.has(e.product_id) ? bulkUnit : e.entryUnit;
      return {
        ...e,
        expanded: true,
        entryUnit,
        batches: [updatedFirst, ...e.batches.slice(1)],
      };
    }));

    const affected = targets.length;
    toast.success(`Applied to ${affected} product${affected === 1 ? '' : 's'}`);

    if (skipped.length > 0) {
      const names = skipped.slice(0, 3).map(e => e.product_name).join(', ');
      const rest = skipped.length > 3 ? ` and ${skipped.length - 3} more` : '';
      toast.warning(
        `${skipped.length} product${skipped.length === 1 ? ' is' : 's are'} not set up for ${bulkUnit}: ` +
        `${names}${rest}. ${skipped.length === 1 ? 'It keeps its' : 'They keep their'} own entry unit.`,
        { duration: 8000 },
      );
    }
  };

  const clearBulk = () => {
    setBulkMfg('');
    setBulkExpiry('');
    setBulkQty('');
    setBulkUnit('');
    setEntries(prev => prev.map(e => ({ ...e, selected: false })));
  };


  /** Each product's configured units, from the engine's own cache. */
  const [productUnits, setProductUnits] = useState<Record<string, ProductUnit[]>>({});

  useEffect(() => {
    if (!open || products.length === 0) return;
    let cancelled = false;
    void (async () => {
      await prefetchAllProductUnits();
      if (cancelled) return;
      const map: Record<string, ProductUnit[]> = {};
      for (const pr of products) {
        const units = getCachedProductUnits(pr.id);
        if (units && units.length > 0) map[pr.id] = units;
      }
      setProductUnits(map);
    })();
    return () => { cancelled = true; };
  }, [open, products]);

  /**
   * Every unit any listed product is configured for.
   *
   * A union rather than an intersection: the list is usually mixed -- weight
   * products alongside ones counted in pieces -- and an intersection would
   * usually be empty, leaving the picker useless exactly when it is most
   * needed. Picking a unit a given product does not have leaves that product
   * on its own, and applying says which ones those were.
   */
  const bulkUnitOptions = useMemo(() => {
    const codes = new Set<string>();
    for (const e of entries) {
      for (const u of productUnits[e.product_id] || []) codes.add(u.code);
    }
    return [...codes].sort();
  }, [entries, productUnits]);


  const handleConfirm = async () => {
    if (!selectedWarehouseId) {
      toast.error('Please select a warehouse');
      return;
    }
    const toSubmit = entries.filter(e => getTotalQty(e) > 0);
    if (toSubmit.length === 0) {
      toast.error('Please enter at least one product quantity');
      return;
    }

    // Checked up front, because the loop below writes one batch at a time:
    // refusing partway would leave some stock posted and the rest not.
    const blocked = firstUnresolvable(toSubmit, productUnits);
    if (blocked) {
      toast.error(blocked.message, { duration: 10000 });
      return;
    }

    setSubmitting(true);
    try {
      let errors = 0;
      let successCount = 0;
      const errorMessages: string[] = [];
      for (const entry of toSubmit) {
        for (const batch of entry.batches) {
          if (batch.quantity <= 0) continue;
          const resolved = resolveEntryUnit(entry, productUnits);
          if (!resolved.ok) {
            // The pre-check above should have caught this; if the configuration
            // changed underneath us, stop rather than store the entered number
            // as though it were already the base unit.
            errors++;
            errorMessages.push(resolved.message);
            toast.error(resolved.message);
            continue;
          }
          const baseQty = batch.quantity * resolved.factor;
          const { data, error } = await supabase.rpc('execute_stock_action', {
            p_distributor_id: distributorId,
            p_product_id: entry.product_id,
            p_action: 'OPENING_STOCK',
            p_quantity: Math.round(baseQty),
            p_notes: entry.product_name,
            p_created_by: null,
            p_batch_no: null, // auto-generate system batch code
            p_expiry_date: batch.expiry_date || null,
            p_reference_id: null,
            p_reference_number: null,
            p_warehouse_id: selectedWarehouseId || null,
            p_supplier_batch_code: batch.supplier_batch_code?.trim() || null,
            p_mfg_date: batch.mfg_date || null,
          } as any);
          if (error) {
            console.error('Opening stock RPC error:', entry.product_name, error);
            errors++;
            const msg = error.message || 'Unknown database error';
            errorMessages.push(`${entry.product_name}: ${msg}`);
            toast.error(`${entry.product_name}: ${msg}`);
            continue;
          }
          const result = typeof data === 'string' ? JSON.parse(data) : data;
          if (!result?.success) {
            errors++;
            const msg = result?.error || 'Unknown error';
            errorMessages.push(`${entry.product_name}: ${msg}`);
            toast.error(`${entry.product_name}: ${msg}`);
          } else {
            successCount++;
          }
        }
      }
      if (errors > 0 && successCount > 0) {
        toast.warning(`${successCount} batch(es) added, ${errors} failed`);
      } else if (errors > 0) {
        const detail = errorMessages[0] ? ` — ${errorMessages[0]}` : '';
        toast.error(`Failed to add opening stock${detail}`);
      } else {
        toast.success(`Opening stock added: ${successCount} batch(es) across ${toSubmit.length} product(s)`);
      }
      onSuccess();
      if (errors === 0) onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add opening stock');
    } finally {
      setSubmitting(false);
    }
  };

  const productsWithQty = entries.filter(e => getTotalQty(e) > 0).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Opening Stock Management</DialogTitle>
          <DialogDescription>
            <div className="flex items-start gap-2 mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700">
                Each batch gets an auto-generated <strong>System Batch Code</strong> (e.g. <code className="font-mono">WH-05-260421-RICE-001</code>).
                Optionally enter a <strong>Supplier Batch Number</strong> for traceability. Add as many batches per product as needed.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Scan Input */}
          <div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  ref={scanRef}
                  placeholder="Scan barcode or type product name..."
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleScanInput()}
                  className="pl-9 h-10"
                />
              </div>
              <Button variant="outline" size="sm" onClick={handleScanInput}>
                <Search className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1 ml-1">
              Type a product name or scan a barcode to quickly find a product below.
            </p>
          </div>

          {/* Warehouse + Date + CSV row */}
          <div className="flex items-end gap-4 flex-wrap">
            <div>
              <Label className="text-xs flex items-center gap-1"><Warehouse className="w-3 h-3" /> Warehouse</Label>
              <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                <SelectTrigger className="w-[220px] h-9 text-sm">
                  <SelectValue placeholder={whLoading ? 'Loading...' : 'Select warehouse'} />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map(w => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} {w.is_default ? '(Default)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Opening Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal h-9 text-sm", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {format(date, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && setDate(d)} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex-1" />
            <div>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="w-4 h-4 mr-1" /> Upload CSV
              </Button>
            </div>
          </div>

          {/* Bulk Apply Panel */}
          <Collapsible open={bulkExpanded} onOpenChange={setBulkExpanded}>
            <div className="border border-primary/30 bg-primary/5 rounded-lg overflow-hidden">
              <CollapsibleTrigger asChild>
                <div className="flex items-start justify-between p-3 cursor-pointer hover:bg-primary/10">
                  <div className="flex items-start gap-2">
                    <Layers className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-primary">Bulk Apply to Products</h4>
                      <p className="text-xs text-muted-foreground">Apply the details below to selected products or all products.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Selected: {selectedCount} product{selectedCount === 1 ? '' : 's'}</span>
                    {bulkExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-3 pt-0 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs">Mfg Date</Label>
                      <Input type="date" value={bulkMfg} onChange={(e) => setBulkMfg(e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Expiry Date</Label>
                      <Input type="date" value={bulkExpiry} onChange={(e) => setBulkExpiry(e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Quantity</Label>
                      <Input type="number" min={0} placeholder="e.g. 50" value={bulkQty} onChange={(e) => setBulkQty(e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Unit</Label>
                      <Select
                        value={bulkUnit || OWN_UNIT}
                        onValueChange={(v) => setBulkUnit(v === OWN_UNIT ? '' : v)}
                        disabled={bulkUnitOptions.length === 0}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Each product's own" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={OWN_UNIT}>Each product&apos;s own</SelectItem>
                          {bulkUnitOptions.map(code => (
                            <SelectItem key={code} value={code}>{code}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {/* One number across products counted differently means
                      different amounts of stock. Saying which, here, is cheaper
                      than finding out after it is written. */}
                  <p className="text-[11px] text-muted-foreground">
                    {bulkUnit
                      ? `Quantity is read as ${bulkUnit} for every product set up for it. Any that are not keep their own unit, and applying will say which.`
                      : 'Each product takes this quantity in its own entry unit, shown beside its name. Pick a unit above to use one for all of them.'}
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={clearBulk}>Clear</Button>
                    <Button size="sm" onClick={() => applyBulk('selected')} disabled={selectedCount === 0}>
                      Apply to Selected
                    </Button>
                    <Button size="sm" onClick={() => applyBulk('all')}>
                      Apply to All Products
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Product entries */}
          <div className="space-y-1 border rounded-lg overflow-hidden">
            {entries.map((entry) => {
              const totalQty = getTotalQty(entry);

              return (
                <Collapsible
                  key={entry.product_id}
                  open={entry.expanded}
                  onOpenChange={() => toggleExpand(entry.product_id)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 border-b">
                      <div className="flex items-center gap-2">
                        <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                          <Checkbox checked={entry.selected} onCheckedChange={() => toggleSelect(entry.product_id)} />
                        </div>
                        {entry.expanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className="text-sm font-medium">{entry.product_name}</span>
                        {(() => {
                          // The unit this row's quantity will actually be read
                          // in -- the one the Entry Unit selector sets, falling
                          // back to the configured base before it has emitted.
                          //
                          // Explicitly NOT products.unit, the pre-UOM text column
                          // that still reads "piece" for 21 products configured in
                          // GRAM. A collapsed row labelled "piece" above a gram
                          // product is how 50 kg of opening stock was entered and
                          // stored as 50 g.
                          const units = productUnits[entry.product_id];
                          const unitLabel = entry.entryUnit || units?.find(u => u.isBase)?.code || '';
                          if (!unitLabel) return null;
                          return (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 font-normal text-muted-foreground"
                              title={`Quantities for ${entry.product_name} are entered in ${unitLabel}. Expand the row to change it.`}
                            >
                              {unitLabel}
                            </Badge>
                          );
                        })()}
                        {entry.existingBatchCount > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                            {entry.existingBatchCount} existing batch{entry.existingBatchCount > 1 ? 'es' : ''}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {totalQty > 0 && (
                          <Badge className="bg-primary/10 text-primary text-xs">
                            Total: {totalQty} {entry.entryUnit}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {entry.batches.length} new batch(es)
                        </span>
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="p-3 bg-muted/20 space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Label className="text-xs text-muted-foreground">Entry Unit:</Label>
                        {/* Offers only what this product is configured for, and
                            emits its default once the units load. Opening stock
                            is stock arriving, so the purchase default applies.
                            hideWhenSingle is off: a product with one unit still
                            shows it, and one with none says so plainly. */}
                        <LineItemUomSelect
                          productId={entry.product_id}
                          value={entry.entryUnit}
                          context="purchase"
                          hideWhenSingle={false}
                          hideHelperLine
                          className="w-[140px] h-7 text-xs"
                          onChange={(sel) => setEntries(prev => prev.map(e =>
                            e.product_id === entry.product_id ? { ...e, entryUnit: sel.uomCode } : e
                          ))}
                        />
                      </div>

                      {entry.batches.map((batch, bIdx) => (
                        <div key={bIdx} className="border rounded-md p-2 bg-background space-y-2">
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Sparkles className="w-3 h-3 text-primary" />
                            <span>System Batch Code: <span className="font-mono italic">auto-generated on save</span></span>
                          </div>
                          <div className="flex items-end gap-2 flex-wrap">
                            <div className="flex-1 min-w-[140px]">
                              <Label className="text-xs">Supplier Batch No (optional)</Label>
                              <Input
                                placeholder="e.g. SUP-A123"
                                value={batch.supplier_batch_code}
                                onChange={(e) => updateBatch(entry.product_id, bIdx, 'supplier_batch_code', e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="w-[140px]">
                              <Label className="text-xs">Mfg Date (optional)</Label>
                              <Input
                                type="date"
                                value={batch.mfg_date}
                                onChange={(e) => updateBatch(entry.product_id, bIdx, 'mfg_date', e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="w-[140px]">
                              <Label className="text-xs">Expiry Date</Label>
                              <Input
                                type="date"
                                value={batch.expiry_date}
                                onChange={(e) => updateBatch(entry.product_id, bIdx, 'expiry_date', e.target.value)}
                                className="h-8 text-sm"
                              />
                              {(() => {
                                if (!batch.expiry_date) return null;
                                const today = new Date(); today.setHours(0,0,0,0);
                                const exp = new Date(batch.expiry_date + 'T00:00:00');
                                const days = Math.floor((exp.getTime() - today.getTime()) / 86400000);
                                if (days < 0) {
                                  return <p className="text-[10px] text-destructive mt-0.5">⚠ Already expired — won't allocate</p>;
                                }
                                if (days <= 7) {
                                  return <p className="text-[10px] text-amber-600 mt-0.5">⚠ Near-expiry ({days}d) — may not allocate</p>;
                                }
                                return null;
                              })()}
                            </div>
                            <div className="w-28">
                              <Label className="text-xs">Quantity ({entry.entryUnit})</Label>
                              <Input
                                type="number"
                                min={0}
                                value={batch.quantity || ''}
                                onChange={(e) => updateBatch(entry.product_id, bIdx, 'quantity', parseFloat(e.target.value) || 0)}
                                className="h-8 text-sm"
                              />
                            </div>
                            {entry.batches.length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => removeBatch(entry.product_id, bIdx)}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => addBatch(entry.product_id)}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add Batch
                      </Button>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={submitting || !selectedWarehouseId}>
            {submitting ? 'Processing...' : `Confirm Opening Stock (${productsWithQty} product${productsWithQty === 1 ? '' : 's'})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OpeningStockDialog;
