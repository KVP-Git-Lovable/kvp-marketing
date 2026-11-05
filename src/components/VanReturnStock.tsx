import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { toast } from 'sonner';
import { Loader2, RotateCcw, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';

interface Van {
  id: string;
  registration_number: string;
}

interface Retailer {
  id: string;
  name: string;
  address: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  variants?: Array<{
    id: string;
    variant_name: string;
  }>;
}

interface ReturnItem {
  productId: string;
  variantId?: string;
  returnQuantity: number;
  returnReason: string;
  productName?: string;
  variantName?: string;
}

interface VanReturnStockProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  visitId?: string;
  retailerId?: string;
}

export function VanReturnStock({ open, onOpenChange, selectedDate, visitId, retailerId }: VanReturnStockProps) {
  const [loading, setLoading] = useState(false);
  const [vans, setVans] = useState<Van[]>([]);
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedVan, setSelectedVan] = useState('');
  const [selectedRetailer, setSelectedRetailer] = useState(retailerId || '');
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [notes, setNotes] = useState('');
  const [showVerification, setShowVerification] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verifierName, setVerifierName] = useState('');

  useEffect(() => {
    if (open) {
      loadVans();
      loadRetailers();
      loadProducts();
    }
  }, [open]);

  useEffect(() => {
    if (retailerId) {
      setSelectedRetailer(retailerId);
    }
  }, [retailerId]);

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
  };

  const loadRetailers = async () => {
    const { data, error } = await supabase
      .from('retailers')
      .select('id, name, address')
      .order('name');

    if (error) {
      console.error('Error loading retailers:', error);
      return;
    }
    setRetailers(data || []);
  };

  const loadProducts = async () => {
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('id, name, sku')
      .order('name');

    if (productsError) {
      console.error('Error loading products:', productsError);
      return;
    }

    const { data: variantsData } = await supabase
      .from('product_variants')
      .select('id, product_id, variant_name')
      .order('variant_name');

    const productsWithVariants = (productsData || []).map(product => ({
      ...product,
      variants: (variantsData || []).filter(v => v.product_id === product.id)
    }));

    setProducts(productsWithVariants);
  };

  const handleAddReturnItem = () => {
    setReturnItems([...returnItems, {
      productId: '',
      variantId: undefined,
      returnQuantity: 0,
      returnReason: ''
    }]);
  };

  const handleRemoveReturnItem = (index: number) => {
    setReturnItems(returnItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof ReturnItem, value: any) => {
    const updated = [...returnItems];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'productId') {
      const product = products.find(p => p.id === value);
      updated[index].productName = product?.name;
      updated[index].variantId = undefined;
      updated[index].variantName = undefined;
    } else if (field === 'variantId') {
      const product = products.find(p => p.id === updated[index].productId);
      const variant = product?.variants?.find(v => v.id === value);
      updated[index].variantName = variant?.variant_name;
    }
    
    setReturnItems(updated);
  };

  const handleSaveReturn = async () => {
    if (!selectedVan) {
      toast.error('Please select a van');
      return;
    }

    if (!selectedRetailer) {
      toast.error('Please select a retailer');
      return;
    }

    if (returnItems.length === 0 || returnItems.some(item => !item.productId || item.returnQuantity <= 0)) {
      toast.error('Please add at least one valid return item');
      return;
    }

    if (showVerification && isVerified && !verifierName) {
      toast.error('Please enter verifier name');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const dateStr = selectedDate.toISOString().split('T')[0];
      const returnGrnNumber = `RTN-${selectedVan.substring(0, 8)}-${dateStr}-${Date.now()}`;

      // Create Return GRN
      const { data: returnGrnData, error: returnGrnError } = await supabase
        .from('van_return_grn')
        .insert({
          van_id: selectedVan,
          user_id: user.id,
          retailer_id: selectedRetailer,
          visit_id: visitId || null,
          return_date: dateStr,
          return_grn_number: returnGrnNumber,
          is_verified: isVerified,
          verified_by: isVerified ? user.id : null,
          verified_by_name: isVerified ? verifierName : null,
          verified_at: isVerified ? new Date().toISOString() : null,
          notes: notes || null
        })
        .select()
        .single();

      if (returnGrnError) throw returnGrnError;

      // Insert return items
      const returnGrnItems = returnItems.map(item => ({
        return_grn_id: returnGrnData.id,
        product_id: item.productId,
        variant_id: item.variantId || null,
        return_quantity: item.returnQuantity,
        return_reason: item.returnReason || null
      }));

      const { error: itemsError } = await supabase
        .from('van_return_grn_items')
        .insert(returnGrnItems);

      if (itemsError) throw itemsError;

      // Update van live inventory (increase stock)
      for (const item of returnItems) {
        const { data: currentInventory } = await supabase
          .from('van_live_inventory')
          .select('*')
          .eq('van_id', selectedVan)
          .eq('product_id', item.productId)
          .eq('date', dateStr)
          .maybeSingle();

        if (currentInventory) {
          await supabase
            .from('van_live_inventory')
            .update({
              returned_quantity: currentInventory.returned_quantity + item.returnQuantity,
              current_stock: currentInventory.current_stock + item.returnQuantity,
              last_updated_at: new Date().toISOString()
            })
            .eq('id', currentInventory.id);
        }
      }

      toast.success(`Return GRN saved! ${returnGrnNumber}`);
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error saving return GRN:', error);
      toast.error(error.message || 'Failed to save return');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedVan('');
    setSelectedRetailer(retailerId || '');
    setReturnItems([]);
    setNotes('');
    setShowVerification(false);
    setIsVerified(false);
    setVerifierName('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Return Stock from Retailer
          </DialogTitle>
          <DialogDescription>
            Enter products returned from retailer. Van inventory will be updated automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Van & Retailer Selection */}
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
              <Label>Select Retailer *</Label>
              <Select value={selectedRetailer} onValueChange={setSelectedRetailer} disabled={!!retailerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose retailer" />
                </SelectTrigger>
                <SelectContent>
                  {retailers.map(retailer => (
                    <SelectItem key={retailer.id} value={retailer.id}>
                      {retailer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Return Items */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Return Items</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddReturnItem}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {returnItems.map((item, index) => {
                const selectedProduct = products.find(p => p.id === item.productId);
                return (
                  <div key={index} className="p-4 border rounded-lg space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="text-sm font-medium">Return Item #{index + 1}</div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveReturnItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Product *</Label>
                        <Select
                          value={item.productId}
                          onValueChange={(value) => handleItemChange(index, 'productId', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map(product => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedProduct && selectedProduct.variants && selectedProduct.variants.length > 0 && (
                        <div className="space-y-2">
                          <Label>Variant</Label>
                          <Select
                            value={item.variantId || ''}
                            onValueChange={(value) => handleItemChange(index, 'variantId', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select variant" />
                            </SelectTrigger>
                            <SelectContent>
                              {selectedProduct.variants.map(variant => (
                                <SelectItem key={variant.id} value={variant.id}>
                                  {variant.variant_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Return Quantity *</Label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="Qty"
                          value={item.returnQuantity || ''}
                          onChange={(e) => handleItemChange(index, 'returnQuantity', parseInt(e.target.value) || 0)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Return Reason</Label>
                        <Input
                          placeholder="e.g. Damaged, Expired"
                          value={item.returnReason}
                          onChange={(e) => handleItemChange(index, 'returnReason', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {returnItems.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No return items added yet
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Additional notes about this return..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Verification */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Return Verification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={showVerification}
                  onCheckedChange={(checked) => {
                    setShowVerification(checked as boolean);
                    if (!checked) {
                      setIsVerified(false);
                      setVerifierName('');
                    }
                  }}
                />
                <Label>Mark as verified</Label>
              </div>

              {showVerification && (
                <>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      checked={isVerified}
                      onCheckedChange={(checked) => setIsVerified(checked as boolean)}
                    />
                    <Label>I have verified sold qty, returned qty, and leftover qty</Label>
                  </div>

                  {isVerified && (
                    <div className="space-y-2">
                      <Label>Verified By (Name) *</Label>
                      <Input
                        placeholder="Enter your name"
                        value={verifierName}
                        onChange={(e) => setVerifierName(e.target.value)}
                      />
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSaveReturn} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Return GRN
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}