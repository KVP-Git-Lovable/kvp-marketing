import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Input } from './ui/input';
import { toast } from 'sonner';
import { Edit, Package, Search, Check, X, Download } from 'lucide-react';
import { VanMorningInventory } from './VanMorningInventory';
// jspdf, jspdf-autotable loaded dynamically in handler
import { downloadPDF } from '@/utils/fileDownloader';

interface VanStockItem {
  id: string;
  grn_id: string;
  product_id: string;
  variant_id?: string;
  quantity: number;
  product_name: string;
  variant_name?: string;
  sku: string;
  grn_number: string;
  grn_date: string;
  van_registration: string;
  available_inventory: number;
  sold_quantity: number;
  returned_quantity: number;
  current_stock: number;
}

interface VanStockViewProps {
  selectedDate: Date;
}

// Helper function to group products with their variants together
const groupProductsWithVariants = (items: VanStockItem[]): VanStockItem[] => {
  // Create a map to group items by product_id
  const productGroups = new Map<string, VanStockItem[]>();
  
  items.forEach(item => {
    const key = item.product_id;
    if (!productGroups.has(key)) {
      productGroups.set(key, []);
    }
    productGroups.get(key)!.push(item);
  });
  
  // Sort each group: base product (no variant) first, then variants sorted by name
  const sortedGroups: VanStockItem[] = [];
  
  // Sort product groups by product name
  const sortedProductIds = Array.from(productGroups.keys()).sort((a, b) => {
    const aItems = productGroups.get(a)!;
    const bItems = productGroups.get(b)!;
    const aName = aItems[0]?.product_name || '';
    const bName = bItems[0]?.product_name || '';
    return aName.localeCompare(bName);
  });
  
  sortedProductIds.forEach(productId => {
    const group = productGroups.get(productId)!;
    
    // Sort within group: base product first, then variants alphabetically
    group.sort((a, b) => {
      // Base product (no variant) comes first
      if (!a.variant_id && b.variant_id) return -1;
      if (a.variant_id && !b.variant_id) return 1;
      // Both are variants - sort by variant name
      const aVarName = a.variant_name || '';
      const bVarName = b.variant_name || '';
      return aVarName.localeCompare(bVarName);
    });
    
    sortedGroups.push(...group);
  });
  
  return sortedGroups;
};

export function VanStockView({ selectedDate }: VanStockViewProps) {
  const [stockItems, setStockItems] = useState<VanStockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);

  useEffect(() => {
    loadVanStock();
  }, [selectedDate]);

  const loadVanStock = async () => {
    setLoading(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];

      // Get all GRN items for the selected date with product details
      const { data: grnData, error: grnError } = await supabase
        .from('van_inward_grn')
        .select(`
          id,
          grn_number,
          grn_date,
          van_id,
          vans (
            registration_number
          )
        `)
        .eq('grn_date', dateStr)
        .order('created_at', { ascending: false });

      if (grnError) throw grnError;

      if (!grnData || grnData.length === 0) {
        setStockItems([]);
        setLoading(false);
        return;
      }

      // Get all items for these GRNs
      const grnIds = grnData.map(g => g.id);
      const { data: itemsData, error: itemsError } = await supabase
        .from('van_inward_grn_items')
        .select(`
          id,
          grn_id,
          product_id,
          variant_id,
          quantity,
          products (
            name,
            sku
          ),
          product_variants (
            variant_name,
            sku
          )
        `)
        .in('grn_id', grnIds);

      if (itemsError) throw itemsError;

      // Get live inventory data for these items
      const vanIds = [...new Set(grnData.map(g => g.van_id))];
      const { data: liveInventory, error: liveError } = await supabase
        .from('van_live_inventory')
        .select('product_id, variant_id, current_stock, sold_quantity, returned_quantity, morning_stock')
        .in('van_id', vanIds)
        .eq('date', dateStr);

      if (liveError) throw liveError;

      // Combine data
      const items: VanStockItem[] = (itemsData || []).map(item => {
        const grn = grnData.find(g => g.id === item.grn_id);
        
        // Find matching live inventory
        const liveStock = (liveInventory || []).find(
          inv => inv.product_id === item.product_id && 
                 (item.variant_id ? inv.variant_id === item.variant_id : !inv.variant_id)
        );

        return {
          id: item.id,
          grn_id: item.grn_id,
          product_id: item.product_id,
          variant_id: item.variant_id || undefined,
          quantity: item.quantity,
          product_name: (item.products as any)?.name || 'Unknown',
          variant_name: (item.product_variants as any)?.variant_name,
          sku: item.variant_id 
            ? ((item.product_variants as any)?.sku || '')
            : ((item.products as any)?.sku || ''),
          grn_number: grn?.grn_number || '',
          grn_date: grn?.grn_date || '',
          van_registration: (grn?.vans as any)?.registration_number || '',
          available_inventory: liveStock?.morning_stock || item.quantity,
          sold_quantity: liveStock?.sold_quantity || 0,
          returned_quantity: liveStock?.returned_quantity || 0,
          current_stock: liveStock?.current_stock || item.quantity
        };
      });

      // Group by product_id, then sort: base product first, then its variants
      const groupedItems = groupProductsWithVariants(items);
      setStockItems(groupedItems);
    } catch (error: any) {
      console.error('Error loading van stock:', error);
      toast.error('Failed to load van stock');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (item: VanStockItem) => {
    setEditingItemId(item.id);
    setEditValue(item.available_inventory);
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditValue(0);
  };

  const handleSaveEdit = async (item: VanStockItem) => {
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];

      // Get van_id from the GRN
      const { data: grnData, error: grnError } = await supabase
        .from('van_inward_grn')
        .select('van_id')
        .eq('id', item.grn_id)
        .single();

      if (grnError) throw grnError;

      // Calculate new current stock (morning_stock - sold_quantity + returned_quantity)
      const newCurrentStock = editValue - item.sold_quantity;

      // Build query based on variant_id
      let query = supabase
        .from('van_live_inventory')
        .update({
          morning_stock: editValue,
          current_stock: newCurrentStock,
          last_updated_at: new Date().toISOString()
        })
        .eq('van_id', grnData.van_id)
        .eq('product_id', item.product_id)
        .eq('date', dateStr);

      // Add variant_id condition
      if (item.variant_id) {
        query = query.eq('variant_id', item.variant_id);
      } else {
        query = query.is('variant_id', null);
      }

      const { error: updateError } = await query;

      if (updateError) throw updateError;

      toast.success('Morning stock updated successfully');
      setEditingItemId(null);
      loadVanStock(); // Reload to show updated values
    } catch (error: any) {
      console.error('Error updating morning stock:', error);
      toast.error('Failed to update morning stock');
    }
  };

  const filteredItems = (() => {
    const filtered = stockItems.filter(item => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        item.product_name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query) ||
        item.variant_name?.toLowerCase().includes(query) ||
        item.van_registration.toLowerCase().includes(query)
      );
    });
    // Re-apply grouping after filter to maintain product-variant ordering
    return groupProductsWithVariants(filtered);
  })();

  const handleDownloadPDF = async () => {
    if (filteredItems.length === 0) {
      toast.error('No data to export');
      return;
    }

    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF();
    const dateStr = selectedDate.toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Van Stock Report', 14, 20);
    
    // Date
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${dateStr}`, 14, 28);

    // Summary
    const totalQuantity = filteredItems.reduce((sum, item) => sum + item.quantity, 0);
    const totalSold = filteredItems.reduce((sum, item) => sum + item.sold_quantity, 0);
    const totalReturned = filteredItems.reduce((sum, item) => sum + item.returned_quantity, 0);
    const totalLeft = filteredItems.reduce((sum, item) => sum + item.current_stock, 0);
    
    doc.text(`Total Items: ${filteredItems.length} | Morning Stock: ${totalQuantity} | Sold: ${totalSold} | Returned: ${totalReturned} | Left: ${totalLeft}`, 14, 36);

    // Table
    const tableData = filteredItems.map(item => [
      item.product_name,
      item.variant_name || '-',
      item.sku,
      item.quantity.toString(),
      item.available_inventory.toString(),
      item.sold_quantity.toString(),
      item.returned_quantity.toString(),
      item.current_stock.toString(),
      item.van_registration,
      item.grn_number
    ]);

    autoTable(doc, {
      startY: 42,
      head: [['Product', 'Variant', 'SKU', 'Morning', 'Available', 'Sold', 'Returned', 'Left', 'Van', 'GRN']],
      body: tableData,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 20 },
        2: { cellWidth: 18 },
        3: { cellWidth: 15, halign: 'right' },
        4: { cellWidth: 15, halign: 'right' },
        5: { cellWidth: 12, halign: 'right' },
        6: { cellWidth: 15, halign: 'right' },
        7: { cellWidth: 12, halign: 'right' },
        8: { cellWidth: 22 },
        9: { cellWidth: 22 }
      }
    });

    const pdfBlob = doc.output('blob');
    await downloadPDF(pdfBlob, `van-stock-${selectedDate.toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Product Stock in Van
              </CardTitle>
              <CardDescription className="mt-1">
                View all saved inventory items for {selectedDate.toLocaleDateString()}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleDownloadPDF} variant="outline" disabled={filteredItems.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
              <Button onClick={() => setEditMode(true)} variant="outline">
                <Edit className="mr-2 h-4 w-4" />
                Edit / Add Stock
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products, SKU, van..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : stockItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No stock items found for this date</p>
              <p className="text-sm mt-1">Add morning inventory to see products here</p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Variant</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Morning Stock</TableHead>
                    <TableHead className="text-right">Available Inventory</TableHead>
                    <TableHead className="text-right">Retail Order Qty</TableHead>
                    <TableHead className="text-right">Returned Qty</TableHead>
                    <TableHead className="text-right">Left in Van</TableHead>
                    <TableHead>Van</TableHead>
                    <TableHead>GRN Number</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.variant_name || '-'}
                      </TableCell>
                      <TableCell className="text-sm">{item.sku}</TableCell>
                      <TableCell className="text-right font-semibold">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        {editingItemId === item.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <Input
                              type="number"
                              value={editValue}
                              onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
                              className="w-20 h-8 text-right"
                              min="0"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => handleSaveEdit(item)}
                            >
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={handleCancelEdit}
                            >
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-semibold text-primary">{item.available_inventory}</span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => handleEditClick(item)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-amber-600 dark:text-amber-400">
                        {item.sold_quantity}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-blue-600 dark:text-blue-400">
                        {item.returned_quantity}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600 dark:text-green-400">
                        {item.current_stock}
                      </TableCell>
                      <TableCell className="text-sm">{item.van_registration}</TableCell>
                      <TableCell className="text-sm font-mono">{item.grn_number}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {filteredItems.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground">
              Total items: {filteredItems.length} | Total quantity: {filteredItems.reduce((sum, item) => sum + item.quantity, 0)}
            </div>
          )}
        </CardContent>
      </Card>

      <VanMorningInventory 
        open={editMode} 
        onOpenChange={(open) => {
          setEditMode(open);
          if (!open) loadVanStock(); // Reload after closing
        }}
        selectedDate={selectedDate} 
      />
    </div>
  );
}
