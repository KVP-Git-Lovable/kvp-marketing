import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { toast } from 'sonner';
import { Loader2, ClipboardList, ExternalLink } from 'lucide-react';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

interface Van {
  id: string;
  registration_number: string;
}

interface ClosingStockSummary {
  totalInward: number;
  totalSold: number;
  totalReturned: number;
  closingInventory: number;
}

interface ClosingStockItem {
  productId: string;
  productName: string;
  variantName?: string;
  morningQty: number;
  soldQty: number;
  returnedQty: number;
  closingQty: number;
}

interface VanClosingStockProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
}

export function VanClosingStock({ open, onOpenChange, selectedDate }: VanClosingStockProps) {
  const [loading, setLoading] = useState(false);
  const [vans, setVans] = useState<Van[]>([]);
  const [selectedVan, setSelectedVan] = useState('');
  const [summary, setSummary] = useState<ClosingStockSummary | null>(null);
  const [items, setItems] = useState<ClosingStockItem[]>([]);
  const [detailView, setDetailView] = useState<'inward' | 'sold' | 'returned' | 'closing' | null>(null);

  useEffect(() => {
    if (open) {
      loadVans();
    }
  }, [open]);

  useEffect(() => {
    if (selectedVan) {
      loadClosingStock();
    }
  }, [selectedVan, selectedDate]);

  const loadVans = async () => {
    const { data, error } = await supabase
      .from('vans')
      .select('id, registration_number')
      .eq('is_active', true)
      .order('registration_number');

    if (error) {
      console.error('Error loading vans:', error);
      return;
    }
    
    setVans(data || []);
    if (data && data.length > 0 && !selectedVan) {
      setSelectedVan(data[0].id);
    }
  };

  const loadClosingStock = async () => {
    if (!selectedVan) return;

    setLoading(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];

      // Get live inventory for the selected van and date
      const { data: inventoryData, error: inventoryError } = await supabase
        .from('van_live_inventory')
        .select(`
          *,
          products(name),
          product_variants(variant_name)
        `)
        .eq('van_id', selectedVan)
        .eq('date', dateStr);

      if (inventoryError) throw inventoryError;

      if (!inventoryData || inventoryData.length === 0) {
        toast.info('No inventory data found for this date');
        setSummary(null);
        setItems([]);
        setLoading(false);
        return;
      }

      // Calculate summary
      const totalInward = inventoryData.reduce((sum, item) => sum + (item.morning_stock || 0), 0);
      const totalSold = inventoryData.reduce((sum, item) => sum + (item.sold_quantity || 0), 0);
      const totalReturned = inventoryData.reduce((sum, item) => sum + (item.returned_quantity || 0), 0);
      const closingInventory = inventoryData.reduce((sum, item) => sum + (item.current_stock || 0), 0);

      setSummary({
        totalInward,
        totalSold,
        totalReturned,
        closingInventory
      });

      // Map items
      const itemsList: ClosingStockItem[] = inventoryData.map(item => ({
        productId: item.product_id,
        productName: (item.products as any)?.name || 'Unknown Product',
        variantName: (item.product_variants as any)?.variant_name,
        morningQty: item.morning_stock || 0,
        soldQty: item.sold_quantity || 0,
        returnedQty: item.returned_quantity || 0,
        closingQty: item.current_stock || 0
      }));

      setItems(itemsList);

      // Save/update closing stock record
      await saveClosingStockRecord(dateStr, {
        totalInward,
        totalSold,
        totalReturned,
        closingInventory
      }, itemsList);

    } catch (error: any) {
      console.error('Error loading closing stock:', error);
      toast.error(error.message || 'Failed to load closing stock');
    } finally {
      setLoading(false);
    }
  };

  const saveClosingStockRecord = async (
    dateStr: string,
    summaryData: ClosingStockSummary,
    itemsData: ClosingStockItem[]
  ) => {
    try {
      // Upsert closing stock summary
      const { data: closingData, error: closingError } = await supabase
        .from('van_closing_stock')
        .upsert({
          van_id: selectedVan,
          closing_date: dateStr,
          total_inward_qty: summaryData.totalInward,
          total_sold_qty: summaryData.totalSold,
          total_returned_qty: summaryData.totalReturned,
          closing_inventory_qty: summaryData.closingInventory,
          computed_at: new Date().toISOString()
        }, {
          onConflict: 'van_id,closing_date'
        })
        .select()
        .single();

      if (closingError) throw closingError;

      // Delete existing items for this closing stock
      await supabase
        .from('van_closing_stock_items')
        .delete()
        .eq('closing_stock_id', closingData.id);

      // Insert new items
      const closingItems = itemsData.map(item => ({
        closing_stock_id: closingData.id,
        product_id: item.productId,
        variant_id: null, // Would need variant_id from inventoryData if needed
        morning_qty: item.morningQty,
        sold_qty: item.soldQty,
        returned_qty: item.returnedQty,
        closing_qty: item.closingQty
      }));

      if (closingItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('van_closing_stock_items')
          .insert(closingItems);

        if (itemsError) throw itemsError;
      }
    } catch (error) {
      console.error('Error saving closing stock record:', error);
    }
  };

  const getFilteredItems = () => {
    if (!detailView) return [];
    
    switch (detailView) {
      case 'inward':
        return items.filter(item => item.morningQty > 0);
      case 'sold':
        return items.filter(item => item.soldQty > 0);
      case 'returned':
        return items.filter(item => item.returnedQty > 0);
      case 'closing':
        return items.filter(item => item.closingQty > 0);
      default:
        return items;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Van Closing Stock - {selectedDate.toLocaleDateString()}
          </DialogTitle>
          <DialogDescription>
            Automatically computed end-of-day van inventory
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Van Selection */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Select Van:</label>
            <div className="flex gap-2">
              {vans.map(van => (
                <Button
                  key={van.id}
                  variant={selectedVan === van.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedVan(van.id)}
                >
                  {van.registration_number}
                </Button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : summary ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailView('inward')}>
                  <CardHeader className="pb-2">
                    <CardDescription>Total Inward GRN</CardDescription>
                    <CardTitle className="text-3xl font-bold text-blue-600">
                      {summary.totalInward}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button variant="ghost" size="sm" className="w-full">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailView('sold')}>
                  <CardHeader className="pb-2">
                    <CardDescription>Sold Products</CardDescription>
                    <CardTitle className="text-3xl font-bold text-red-600">
                      {summary.totalSold}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button variant="ghost" size="sm" className="w-full">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Orders
                    </Button>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailView('returned')}>
                  <CardHeader className="pb-2">
                    <CardDescription>Returned GRN</CardDescription>
                    <CardTitle className="text-3xl font-bold text-amber-600">
                      {summary.totalReturned}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button variant="ghost" size="sm" className="w-full">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Returns
                    </Button>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDetailView('closing')}>
                  <CardHeader className="pb-2">
                    <CardDescription>Closing Inventory</CardDescription>
                    <CardTitle className="text-3xl font-bold text-green-600">
                      {summary.closingInventory}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button variant="ghost" size="sm" className="w-full">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Stock
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Detail View */}
              {detailView && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>
                        {detailView === 'inward' && 'Inward GRN Details'}
                        {detailView === 'sold' && 'Sold Products Details'}
                        {detailView === 'returned' && 'Return GRN Details'}
                        {detailView === 'closing' && 'Closing Inventory Details'}
                      </CardTitle>
                      <Button variant="outline" size="sm" onClick={() => setDetailView(null)}>
                        Close Details
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Variant</TableHead>
                          <TableHead className="text-right">Morning</TableHead>
                          <TableHead className="text-right">Sold</TableHead>
                          <TableHead className="text-right">Returned</TableHead>
                          <TableHead className="text-right">Closing</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getFilteredItems().map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.productName}</TableCell>
                            <TableCell>{item.variantName || '-'}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="outline">{item.morningQty}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="destructive">{item.soldQty}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge variant="secondary">{item.returnedQty}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge>{item.closingQty}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* All Items Summary */}
              {!detailView && (
                <Card>
                  <CardHeader>
                    <CardTitle>All Products Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead>Variant</TableHead>
                          <TableHead className="text-right">Morning</TableHead>
                          <TableHead className="text-right">Sold</TableHead>
                          <TableHead className="text-right">Returned</TableHead>
                          <TableHead className="text-right">Closing</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.productName}</TableCell>
                            <TableCell>{item.variantName || '-'}</TableCell>
                            <TableCell className="text-right">{item.morningQty}</TableCell>
                            <TableCell className="text-right">{item.soldQty}</TableCell>
                            <TableCell className="text-right">{item.returnedQty}</TableCell>
                            <TableCell className="text-right font-bold">{item.closingQty}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No closing stock data available for this date
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={loadClosingStock} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Refresh Data
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}