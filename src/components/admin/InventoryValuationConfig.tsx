import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Layers } from 'lucide-react';
import { toast } from 'sonner';

export const InventoryValuationConfig = () => {
  const [method, setMethod] = useState('none');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const { data } = await supabase
      .from('inventory_valuation_config')
      .select('*')
      .limit(1)
      .maybeSingle();
    
    if (data) setMethod(data.valuation_method);
    setLoading(false);
  };

  const updateMethod = async (value: string) => {
    setMethod(value);
    const { error } = await supabase
      .from('inventory_valuation_config')
      .update({ valuation_method: value, updated_at: new Date().toISOString() })
      .neq('id', '00000000-0000-0000-0000-000000000000'); // update all rows

    if (error) {
      // If no rows exist, insert
      await supabase.from('inventory_valuation_config').insert({ valuation_method: value });
    }
    toast.success(`Inventory valuation method set to ${value.toUpperCase()}`);
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          Inventory Valuation Method
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <Select value={method} onValueChange={updateMethod}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">None</Badge>
                  No valuation
                </div>
              </SelectItem>
              <SelectItem value="fifo">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-100 text-blue-700 text-xs">FIFO</Badge>
                  First In, First Out
                </div>
              </SelectItem>
              <SelectItem value="lifo">
                <div className="flex items-center gap-2">
                  <Badge className="bg-purple-100 text-purple-700 text-xs">LIFO</Badge>
                  Last In, First Out
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Determines how inventory cost is calculated for stock movements.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
