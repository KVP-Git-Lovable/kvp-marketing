import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { toast } from 'sonner';
import { Loader2, Package, Camera, CheckCircle } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

interface Van {
  id: string;
  registration_number: string;
  is_active: boolean;
}

interface Beat {
  id: string;
  beat_name: string;
  beat_id: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  variants?: Array<{
    id: string;
    variant_name: string;
    sku: string;
  }>;
}

interface StockItem {
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  sku: string;
  quantity: number;
}

interface VanMorningInventoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
}

export function VanMorningInventory({ open, onOpenChange, selectedDate }: VanMorningInventoryProps) {
  const [loading, setLoading] = useState(false);
  const [vans, setVans] = useState<Van[]>([]);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedVan, setSelectedVan] = useState('');
  const [selectedBeat, setSelectedBeat] = useState('');
  const [vanDistance, setVanDistance] = useState('');
  const [documentsVerified, setDocumentsVerified] = useState(false);
  const [verifierName, setVerifierName] = useState('');
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (open) {
      loadVans();
      loadProducts();
      loadBeatForDate();
    }
  }, [open, selectedDate]);

  const loadVans = async () => {
    const { data, error } = await supabase
      .from('vans')
      .select('id, registration_number, is_active')
      .eq('is_active', true)
      .order('registration_number');

    if (error) {
      console.error('Error loading vans:', error);
      toast.error('Failed to load vans');
      return;
    }
    setVans(data || []);
  };

  const loadBeatForDate = async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user) return;

    const formattedDate = selectedDate.toISOString().split('T')[0];
    
    const { data, error } = await supabase
      .from('beat_plans')
      .select('beat_id, beat_name')
      .eq('user_id', session.session.user.id)
      .eq('plan_date', formattedDate)
      .single();

    if (error) {
      console.error('Error loading beat plan:', error);
      toast.error('No beat plan found for this date');
      return;
    }
    
    if (data) {
      setBeats([{ id: data.beat_id, beat_name: data.beat_name, beat_id: data.beat_id }]);
      setSelectedBeat(data.beat_id);
    }
  };

  const loadProducts = async () => {
    try {
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, sku')
        .order('name');

      if (productsError) {
        console.error('Error loading products:', productsError);
        toast.error('Failed to load products: ' + productsError.message);
        return;
      }

      console.log('Loaded products:', productsData?.length || 0);

      const { data: variantsData, error: variantsError } = await supabase
        .from('product_variants')
        .select('id, product_id, variant_name, sku')
        .order('variant_name');

      if (variantsError) {
        console.error('Error loading variants:', variantsError);
      }

      console.log('Loaded variants:', variantsData?.length || 0);

      const productsWithVariants = (productsData || []).map(product => ({
        ...product,
        variants: (variantsData || []).filter(v => v.product_id === product.id)
      }));

      setProducts(productsWithVariants);

      // Build stock items list - one row per product/variant combination
      const items: StockItem[] = [];
      productsData?.forEach(product => {
        const variants = variantsData?.filter(v => v.product_id === product.id) || [];
        
        if (variants.length > 0) {
          variants.forEach(variant => {
            items.push({
              productId: product.id,
              productName: product.name,
              variantId: variant.id,
              variantName: variant.variant_name,
              sku: variant.sku,
              quantity: 0
            });
          });
        } else {
          items.push({
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            quantity: 0
          });
        }
      });

      console.log('Built stock items:', items.length);
      setStockItems(items);
    } catch (error: any) {
      console.error('Unexpected error loading products:', error);
      toast.error('Failed to load products');
    }
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    const updated = [...stockItems];
    updated[index].quantity = quantity;
    setStockItems(updated);
  };

  const filteredStockItems = stockItems.filter(item => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.productName.toLowerCase().includes(query) ||
      item.sku.toLowerCase().includes(query) ||
      item.variantName?.toLowerCase().includes(query)
    );
  });

  const handleSaveInwardGRN = async () => {
    if (!selectedVan) {
      toast.error('Please select a van');
      return;
    }

    if (!selectedBeat) {
      toast.error('Please select a beat');
      return;
    }

    const itemsToSave = stockItems.filter(item => item.quantity > 0);
    
    if (itemsToSave.length === 0) {
      toast.error('Please enter quantity for at least one product');
      return;
    }

    if (documentsVerified && !verifierName) {
      toast.error('Please enter verifier name');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const dateStr = selectedDate.toISOString().split('T')[0];
      const grnNumber = `GRN-${selectedVan.substring(0, 8)}-${dateStr}-${Date.now()}`;

      // Create Inward GRN
      const { data: grnData, error: grnError } = await supabase
        .from('van_inward_grn')
        .insert({
          van_id: selectedVan,
          beat_id: selectedBeat,
          user_id: user.id,
          grn_date: dateStr,
          grn_number: grnNumber,
          van_distance_km: parseFloat(vanDistance) || 0,
          documents_verified: documentsVerified,
          verified_by: documentsVerified ? user.id : null,
          verified_by_name: documentsVerified ? verifierName : null,
          verified_at: documentsVerified ? new Date().toISOString() : null
        })
        .select()
        .single();

      if (grnError) throw grnError;

      // Insert GRN items
      const grnItems = itemsToSave.map(item => ({
        grn_id: grnData.id,
        product_id: item.productId,
        variant_id: item.variantId || null,
        quantity: item.quantity,
        ai_scanned: false,
        ai_confidence_percent: null
      }));

      const { error: itemsError } = await supabase
        .from('van_inward_grn_items')
        .insert(grnItems);

      if (itemsError) throw itemsError;

      // Update/Create van live inventory
      for (const item of itemsToSave) {
        await supabase
          .from('van_live_inventory')
          .upsert({
            van_id: selectedVan,
            product_id: item.productId,
            variant_id: item.variantId || null,
            date: dateStr,
            morning_stock: item.quantity,
            current_stock: item.quantity,
            sold_quantity: 0,
            returned_quantity: 0,
            pending_quantity: 0,
            last_updated_at: new Date().toISOString()
          }, {
            onConflict: 'van_id,product_id,variant_id,date'
          });
      }

      toast.success(`Morning Inventory saved! GRN: ${grnNumber}`);
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error saving inward GRN:', error);
      toast.error(error.message || 'Failed to save morning inventory');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedVan('');
    setSelectedBeat('');
    setVanDistance('');
    setDocumentsVerified(false);
    setVerifierName('');
    setSearchQuery('');
    loadProducts(); // Reload to reset quantities
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Morning Inventory (Inward GRN)
          </DialogTitle>
          <DialogDescription>
            Load and verify all products put into the van at the start of the day
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Van & Beat Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Select Van *</Label>
              <Select value={selectedVan} onValueChange={setSelectedVan}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose van" />
                </SelectTrigger>
                <SelectContent>
                  {vans.map(van => (
                    <SelectItem key={van.id} value={van.id}>
                      {van.registration_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Beat (Auto-selected from plan) *</Label>
              <Select value={selectedBeat} disabled>
                <SelectTrigger>
                  <SelectValue placeholder="Beat will be auto-selected based on date" />
                </SelectTrigger>
                <SelectContent>
                  {beats.map(beat => (
                    <SelectItem key={beat.id} value={beat.id}>
                      {beat.beat_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Van Distance */}
          <div className="space-y-2">
            <Label>Van Distance (km)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="Enter distance"
              value={vanDistance}
              onChange={(e) => setVanDistance(e.target.value)}
            />
          </div>

          {/* Document Verification */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Document Verification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={documentsVerified}
                  onCheckedChange={(checked) => setDocumentsVerified(checked as boolean)}
                />
                <Label>Van documents verified</Label>
              </div>
              {documentsVerified && (
                <div className="space-y-2">
                  <Label>Verified By *</Label>
                  <Input
                    placeholder="Enter verifier name"
                    value={verifierName}
                    onChange={(e) => setVerifierName(e.target.value)}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stock Items Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Stock Items</CardTitle>
                  <CardDescription className="mt-1">
                    Enter quantities for products to load in the van
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchQuery('')}
                  disabled={!searchQuery}
                >
                  Clear Filter
                </Button>
              </div>
              <div className="mt-4">
                <Input
                  placeholder="Search products, SKU, variant..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[45%]">Product Name</TableHead>
                      <TableHead className="w-[25%]">Variant</TableHead>
                      <TableHead className="w-[20%]">SKU</TableHead>
                      <TableHead className="w-[10%]">Quantity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStockItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          {searchQuery ? 'No products found matching your search' : 'No products available'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredStockItems.map((item, index) => (
                        <TableRow key={`${item.productId}-${item.variantId || 'base'}`}>
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {item.variantName || '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.sku}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              placeholder="0"
                              className="w-20"
                              value={item.quantity || ''}
                              onChange={(e) => {
                                const actualIndex = stockItems.findIndex(si => 
                                  si.productId === item.productId && 
                                  si.variantId === item.variantId
                                );
                                handleQuantityChange(actualIndex, parseInt(e.target.value) || 0);
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 text-sm text-muted-foreground">
                Total products with quantity: {stockItems.filter(i => i.quantity > 0).length} / {stockItems.length}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSaveInwardGRN} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Inward GRN
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}