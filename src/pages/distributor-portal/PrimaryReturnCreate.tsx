import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  prefetchAllProductUnits,
  getCachedProductUnits,
  type ProductUnit,
} from '@/lib/uomEngine';
import { firstUnresolvable } from '@/lib/entryUnits';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Trash2, RotateCcw, Send } from 'lucide-react';
import { toast } from 'sonner';

interface ReturnItem {
  id: string;
  product_id: string;
  product_name: string;
  variant_id?: string;
  variant_name?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  return_reason: string;
  batch_number: string;
  condition: string;
}

const CONDITIONS = ['damaged', 'expired', 'wrong_product', 'excess', 'quality_issue', 'other'];

const PrimaryReturnCreate = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<ReturnItem[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState('');
  const distributorId = localStorage.getItem('distributor_id');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    // Load from distributor inventory for valid return items
    const { data } = await supabase
      .from('distributor_inventory')
      .select('*')
      .eq('distributor_id', distributorId!)
      .gt('quantity', 0);
    setProducts(data || []);
  };

  const addItem = () => {
    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    setItems(prev => [...prev, {
      id: crypto.randomUUID(),
      product_id: product.product_id,
      product_name: product.product_name,
      variant_id: product.variant_id,
      variant_name: product.variant_name,
      quantity: 1,
      unit: product.unit || 'pcs',
      unit_price: product.unit_cost || 0,
      return_reason: 'damaged',
      batch_number: product.batch_number || '',
      condition: 'damaged',
    }]);
    setSelectedProduct('');
  };

  const updateItem = (id: string, field: string, value: any) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const [productUnits, setProductUnits] = useState<Record<string, ProductUnit[]>>({});

  useEffect(() => {
    if (items.length === 0) return;
    let cancelled = false;
    void (async () => {
      await prefetchAllProductUnits();
      if (cancelled) return;
      const map: Record<string, ProductUnit[]> = {};
      for (const it of items) {
        const units = getCachedProductUnits(it.product_id);
        if (units && units.length > 0) map[it.product_id] = units;
      }
      setProductUnits(map);
    })();
    return () => { cancelled = true; };
  }, [items]);

  const handleSubmit = async () => {
    if (items.length === 0) { toast.error('Add at least one item'); return; }

    // This screen records the return document; the stock movement happens when
    // it is processed. The unit is still checked here, because a line written
    // in a unit the product does not have cannot be converted later either,
    // and the error is far cheaper to see now than at posting time.
    const blocked = firstUnresolvable(
      items.map(i => ({
        product_id: i.product_id,
        product_name: i.product_name,
        entryUnit: i.unit,
      })),
      productUnits,
    );
    if (blocked) {
      toast.error(blocked.message, { duration: 10000 });
      return;
    }

    setSaving(true);

    try {
      const { data: retNumData } = await supabase.rpc('generate_return_number');
      const returnNumber = retNumData || `RET-${Date.now()}`;
      const totalValue = items.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0);

      const { data: returnNote, error } = await supabase.from('primary_return_notes').insert({
        return_number: returnNumber,
        distributor_id: distributorId!,
        status: 'submitted',
        total_return_value: totalValue,
        notes,
      }).select('id').single();

      if (error) throw error;

      await supabase.from('primary_return_items').insert(
        items.map(i => ({
          return_note_id: returnNote.id,
          product_id: i.product_id,
          variant_id: i.variant_id || null,
          product_name: i.product_name,
          variant_name: i.variant_name || null,
          quantity: i.quantity,
          unit: i.unit,
          unit_price: i.unit_price,
          return_reason: i.return_reason,
          batch_number: i.batch_number || null,
          condition: i.condition,
        }))
      );

      toast.success(`Return ${returnNumber} submitted successfully!`);
      navigate('/distributor-portal/company-returns');
    } catch (error) {
      console.error('Error creating return:', error);
      toast.error('Failed to create return note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/distributor-portal/company-returns')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <RotateCcw className="w-6 h-6 text-primary" />
            Create Return Note
          </h1>
          <p className="text-sm text-muted-foreground">Return goods to company</p>
        </div>
      </div>

      {/* Add Product */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <Select value={selectedProduct} onValueChange={setSelectedProduct}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select product to return..." />
              </SelectTrigger>
              <SelectContent>
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.product_name} {p.variant_name ? `- ${p.variant_name}` : ''} (Stock: {p.quantity})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addItem} disabled={!selectedProduct}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      {items.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Return Items ({items.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map(item => (
              <div key={item.id} className="p-3 rounded-lg bg-muted/50 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{item.product_name}</p>
                    {item.variant_name && <p className="text-xs text-muted-foreground">{item.variant_name}</p>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Qty</label>
                    <Input type="number" min={1} value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 1)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Batch</label>
                    <Input value={item.batch_number}
                      onChange={(e) => updateItem(item.id, 'batch_number', e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Reason</label>
                    <Select value={item.return_reason} onValueChange={(v) => updateItem(item.id, 'return_reason', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONDITIONS.map(c => <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Condition</label>
                    <Select value={item.condition} onValueChange={(v) => updateItem(item.id, 'condition', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONDITIONS.map(c => <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Notes + Submit */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium block mb-2">Notes</label>
            <Textarea placeholder="Reason for return..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => navigate('/distributor-portal/company-returns')}>Cancel</Button>
            <Button className="flex-1" onClick={handleSubmit} disabled={saving || items.length === 0}>
              {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Submit Return
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PrimaryReturnCreate;
