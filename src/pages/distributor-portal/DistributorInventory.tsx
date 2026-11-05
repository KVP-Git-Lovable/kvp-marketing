import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  prefetchAllProductUnits,
  getCachedProductUnits,
  defaultSalesUnitIn,
  fromBaseIn,
  type ProductUnit,
} from '@/lib/uomEngine';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Warehouse, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useWarehouses } from '@/hooks/useWarehouses';
import InventorySummaryCards from '@/components/distributor-portal/inventory/InventorySummaryCards';
import StockOverviewTable from '@/components/distributor-portal/inventory/StockOverviewTable';
import StockActionsPanel from '@/components/distributor-portal/inventory/StockActionsPanel';
import RecentTransactionsPanel from '@/components/distributor-portal/inventory/RecentTransactionsPanel';
import TransactionsLedgerPanel from '@/components/distributor-portal/inventory/TransactionsLedgerPanel';
import OpeningStockDialog from '@/components/distributor-portal/inventory/OpeningStockDialog';
import WarehouseManagement from '@/components/distributor-portal/inventory/WarehouseManagement';

interface InventoryRow {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  available_quantity: number;
  reserved_quantity: number;
  damaged_quantity: number;
  expired_quantity: number;
  /** Issued to a van and not yet sold, returned or written off. Still owned,
   *  but not sellable from the warehouse, so it is kept out of available. */
  on_van_quantity: number;
  updated_at: string;
  warehouse_id: string | null;
}

/** Unit codes as a person writes them, matching the stock table below. */
const UNIT_LABEL = (code: string) => code.replace(/^KG$/i, 'kg').replace(/^GRAM$/i, 'g');

const DistributorInventory = () => {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txnError, setTxnError] = useState<string | null>(null);
  const [allProducts, setAllProducts] = useState<{ id: string; name: string; unit?: string }[]>([]);
  /** Configured units per product, for the summary cards. */
  const [productUoms, setProductUoms] = useState<Record<string, ProductUnit[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [productFilter, setProductFilter] = useState('all');
  const [openingStockOpen, setOpeningStockOpen] = useState(false);
  /** Batches carrying no expiry date. They cannot be ordered by FEFO and will
   *  never raise an expiry warning, so they are counted where someone will see
   *  them rather than discovered when the stock is already old. */
  const [undatedBatches, setUndatedBatches] = useState(0);
  /** Set when Add Batch is pressed on a product row, so the dialog opens on
   *  that product rather than on a list of everything. */
  const [addBatchProductId, setAddBatchProductId] = useState<string | null>(null);
  const [warehouseFilter, setWarehouseFilter] = useState('all');

  const distributorId = localStorage.getItem('distributor_id');
  const { warehouses, defaultWarehouse, loading: whLoading, reload: reloadWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } = useWarehouses(distributorId);
  const distributorUser = (() => {
    try { return JSON.parse(localStorage.getItem('distributor_user') || '{}'); } catch { return {}; }
  })();
  const entityType = distributorUser?.distributor_type || 'Distributor';
  const entityName = distributorUser?.distributors?.name || distributorUser?.distributor_name || 'Inventory';

  const hasWarehouses = warehouses.length > 0;

  const loadData = useCallback(async () => {
    if (!distributorId) return;
    setLoadError(null);
    try {
      // Verify auth session is still valid
      const { data: { session } } = await supabase.auth.getSession();
      const isImpersonated = distributorUser?.is_impersonated;
      
      if (!session && !isImpersonated) {
        setLoadError('Session expired. Please log in again.');
        setLoading(false);
        return;
      }

      const invResult = await supabase
        .from('distributor_inventory')
        .select('id, product_id, product_name, quantity, reserved_quantity, damaged_quantity, expired_quantity, on_van_quantity, updated_at, warehouse_id')
        .eq('distributor_id', distributorId)
        .not('product_id', 'is', null)
        .order('product_name');

      if (invResult.error) throw invResult.error;
      // quantity and on_van_quantity are disjoint: dms_settle_van_day moves
      // stock OUT of quantity when it is issued to a van, so available needs
      // no further adjustment for it.
      const rows = (invResult.data || []).map(row => ({
        ...row,
        on_van_quantity: (row as any).on_van_quantity || 0,
        available_quantity: (row.quantity || 0) - (row.reserved_quantity || 0) - (row.damaged_quantity || 0) - (row.expired_quantity || 0),
      }));
      setInventory(rows as InventoryRow[]);

      const { count: undated } = await supabase
        .from('inventory_batches')
        .select('id', { count: 'exact', head: true })
        .eq('distributor_id', distributorId)
        .is('expiry_date', null);
      setUndatedBatches(undated || 0);

      // Load transactions separately. The column is balance_qty; the panels
      // render it as `quantity`, so map it here the way the ledger does.
      const txnResult = await supabase
        .from('distributor_inventory_transactions')
        .select('id, reference_type, transaction_type, balance_qty, unit, notes, created_at, product_name, product_id, batch_number')
        .eq('distributor_id', distributorId)
        .order('created_at', { ascending: false })
        .limit(10);
      // Deliberately not thrown: a failure here should not blank the whole
      // inventory screen. It is surfaced on the panel instead, because the
      // silent `data || []` this replaces showed an empty state for four
      // months while the query was in fact being rejected.
      if (txnResult.error) {
        console.error('Error loading recent transactions:', txnResult.error);
        setTxnError(txnResult.error.message || 'Could not load recent transactions');
        setTransactions([]);
      } else {
        setTxnError(null);
        setTransactions((txnResult.data || []).map(t => ({ ...t, quantity: (t as any).balance_qty })));
      }

      const prodResult = await supabase
        .from('products')
        .select('id, name, unit')
        .eq('is_active', true)
        .order('name');
      // Not thrown, for the same reason as the transactions query above: this
      // feeds the product filter and the opening-stock picker, and losing
      // those should not cost the whole screen. But an empty picker with no
      // explanation is indistinguishable from a distributor who stocks
      // nothing, so the failure is said out loud.
      if (prodResult.error) {
        console.error('Error loading products:', prodResult.error);
        toast.error('Could not load the product list. Filters and pickers may be incomplete.');
      }
      const loadedProducts = (prodResult.data || []).map(p => ({ id: p.id, name: p.name, unit: p.unit || undefined }));
      setAllProducts(loadedProducts);
    } catch (error: any) {
      console.error('Error loading inventory:', error);
      setLoadError(error?.message || 'Failed to load inventory');
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [distributorId]);

  useEffect(() => {
    if (!distributorId) {
      navigate('/distributor-portal/login');
      return;
    }
    loadData();
  }, [distributorId, navigate, loadData]);

  // Keyed on the ids themselves rather than the array, which is rebuilt on
  // every load; depending on the array would refetch the whole configuration
  // each time a quantity moved.
  const inventoryProductIdKey = [...new Set(inventory.map(i => i.product_id))].sort().join(',');

  useEffect(() => {
    if (!inventoryProductIdKey) return;
    let cancelled = false;
    void (async () => {
      // One shared in-memory cache for the app; this fills it and then takes a
      // snapshot for the products on screen.
      await prefetchAllProductUnits();
      if (cancelled) return;
      const map: Record<string, ProductUnit[]> = {};
      for (const id of inventoryProductIdKey.split(',')) {
        const units = getCachedProductUnits(id);
        if (units && units.length > 0) map[id] = units;
      }
      setProductUoms(map);
    })();
    return () => { cancelled = true; };
  }, [inventoryProductIdKey]);

  useEffect(() => {
    if (!distributorId) return;
    const invChannel = supabase
      .channel('inv-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'distributor_inventory', filter: `distributor_id=eq.${distributorId}` }, () => loadData())
      .subscribe();
    const txnChannel = supabase
      .channel('txn-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'distributor_inventory_transactions', filter: `distributor_id=eq.${distributorId}` }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(invChannel); supabase.removeChannel(txnChannel); };
  }, [distributorId, loadData]);

  let filteredInventory = inventory;
  if (warehouseFilter !== 'all') {
    filteredInventory = filteredInventory.filter(i => i.warehouse_id === warehouseFilter);
  }
  if (productFilter !== 'all') {
    filteredInventory = filteredInventory.filter(i => i.product_id === productFilter);
  }

  const productUnitMap = Object.fromEntries(allProducts.map(p => [p.id, p.unit || '']));
  const products = inventory.map(i => ({ id: i.product_id, name: i.product_name, unit: productUnitMap[i.product_id] }));
  const uniqueProducts = products.filter((p, idx, arr) => arr.findIndex(x => x.id === p.id) === idx);

  // The cards read the same configured units the table below them does.
  //
  // They used to convert with products.unit, the legacy text column, which for
  // these products reads 'piece' while the configured base is GRAM. There is no
  // gram-to-kilo rule for 'piece', so nothing converted and the raw base figure
  // came through: a card reading 1 directly above a column reading 0.001 kg,
  // both meaning one gram. The conversion was written correctly and fed the
  // wrong unit.
  const summaryDisplayData = (() => {
    let available = 0, reserved = 0, damaged = 0, expired = 0, onVan = 0;
    const unitsSeen = new Set<string>();

    filteredInventory.forEach(i => {
      const uoms = productUoms[i.product_id];
      const target = defaultSalesUnitIn(uoms)?.code;

      // Without a configured unit the base figure is the honest one; the card
      // then reports mixed units rather than a converted number, which is the
      // same thing the row does.
      const conv = (q: number) => {
        if (!uoms || !target) return q || 0;
        const v = fromBaseIn(uoms, q || 0, target);
        return typeof v === 'number' && Number.isFinite(v) ? v : (q || 0);
      };

      unitsSeen.add(target ? UNIT_LABEL(target) : '');
      available += conv(i.available_quantity);
      reserved  += conv(i.reserved_quantity);
      damaged   += conv(i.damaged_quantity);
      expired   += conv(i.expired_quantity);
      onVan     += conv(i.on_van_quantity || 0);
    });

    // Summing kilos and pieces into one figure would be arithmetic without a
    // meaning, so the unit is only shown when every product agrees on one. The
    // numbers are still totalled either way, because that is what the card has
    // always done and hiding them would be a bigger change than this is.
    const unit = unitsSeen.size === 1 ? [...unitsSeen][0] : undefined;
    return { available, reserved, damaged, expired, onVan, unit };
  })();

  if (loading || whLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
        <div className="rounded-full bg-destructive/10 p-4">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Failed to Load Inventory</h2>
        <p className="text-sm text-muted-foreground max-w-md">{loadError}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setLoading(true); loadData(); }}>
            Retry
          </Button>
          <Button variant="default" onClick={() => navigate('/distributor-portal/login')}>
            Re-Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="bg-slate-800 text-white rounded-lg px-5 py-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Inventory Management</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-300">Entity: <span className="text-white font-medium">{entityType}</span></span>
          {hasWarehouses && (
            <>
              <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
                <SelectTrigger className="w-[160px] h-8 text-xs bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="All Warehouses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Warehouses</SelectItem>
                  {warehouses.map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger className="w-[150px] h-8 text-xs bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="All Products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {uniqueProducts.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => setOpeningStockOpen(true)}
                className="bg-teal-100 text-teal-800 hover:bg-teal-200 border border-teal-200 text-sm h-8"
              >
                <Plus className="w-4 h-4 mr-1" /> Add Opening Stock
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Subtitle */}
      <p className="text-sm font-medium text-foreground">
        {entityType}: <span className="font-semibold">{entityName}</span> <span className="text-muted-foreground">▾</span>
      </p>

      {/* Warehouse Management (always visible) */}
      <WarehouseManagement
        warehouses={warehouses}
        loading={whLoading}
        onCreateWarehouse={createWarehouse}
        onUpdateWarehouse={updateWarehouse}
        onDeleteWarehouse={deleteWarehouse}
        defaultOpen={!hasWarehouses}
      />

      {/* Blocking gate if no warehouses */}
      {!hasWarehouses ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <div className="rounded-full bg-amber-100 p-4">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">No Warehouses Found</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Please create at least one warehouse before managing inventory.
            Use the "Add Warehouse" button above to get started.
          </p>
        </div>
      ) : (
        <>
          {/* Summary Pills */}
          <InventorySummaryCards
            data={{ ...summaryDisplayData, undatedBatches }}
            loading={loading}
          />

          {/* Stock Overview Table */}
          <StockOverviewTable
            inventory={filteredInventory as any}
            productFilter={productFilter}
            onProductFilterChange={setProductFilter}
            products={uniqueProducts}
            distributorId={distributorId!}
            onAddBatch={(productId) => {
              setAddBatchProductId(productId);
              setOpeningStockOpen(true);
            }}
          />

          {/* Stock Actions */}
          <StockActionsPanel
            distributorId={distributorId!}
            products={uniqueProducts}
            onActionComplete={loadData}
          />

          {/* Recent Transactions */}
          <RecentTransactionsPanel
            transactions={transactions.map(txn => ({
              ...txn,
              product_name: txn.product_name || (txn.product_id ? (allProducts.find(p => p.id === txn.product_id)?.name || inventory.find(i => i.product_id === txn.product_id)?.product_name) : null),
            }))}
            loading={loading}
            error={txnError}
          />

          {/* Full Transactions Ledger */}
          <TransactionsLedgerPanel
            distributorId={distributorId!}
            products={uniqueProducts}
            warehouses={warehouses.map(w => ({ id: w.id, name: w.name }))}
          />

          {/* Opening Stock Dialog */}
          <OpeningStockDialog
            open={openingStockOpen}
            initialProductId={addBatchProductId}
            onOpenChange={(v) => {
              setOpeningStockOpen(v);
              if (!v) setAddBatchProductId(null);
            }}
            distributorId={distributorId!}
            products={allProducts.length > 0 ? allProducts : uniqueProducts}
            onSuccess={loadData}
          />
        </>
      )}
    </div>
  );
};

export default DistributorInventory;
