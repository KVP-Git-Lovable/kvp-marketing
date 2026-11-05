import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Gift, Tag, Percent, Clock, Sparkles, Package } from 'lucide-react';
import { format } from 'date-fns';

interface Scheme {
  id: string;
  name: string;
  description: string | null;
  scheme_type: string;
  discount_percentage: number | null;
  discount_amount: number | null;
  min_order_value: number | null;
  buy_quantity: number | null;
  free_quantity: number | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean | null;
  product_name?: string;
  category_name?: string;
}

const PrimarySchemesView = () => {
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadSchemes();
  }, []);

  const loadSchemes = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('product_schemes')
        .select('*')
        .eq('is_active', true)
        .gte('end_date', today)
        .order('priority', { ascending: true });

      if (data?.length) {
        // Get product names
        const productIds = data.filter(s => s.product_id).map(s => s.product_id!);
        const { data: products } = productIds.length > 0
          ? await supabase.from('products').select('id, name').in('id', productIds)
          : { data: [] };
        const productMap = new Map((products || []).map(p => [p.id, p.name] as [string, string]));

        // Get category names
        const catIds = data.filter(s => s.category_id).map(s => s.category_id!);
        const { data: cats } = catIds.length > 0
          ? await supabase.from('product_categories').select('id, name').in('id', catIds)
          : { data: [] };
        const catMap = new Map((cats || []).map(c => [c.id, c.name] as [string, string]));

        setSchemes(data.map(s => ({
          ...s,
          product_name: s.product_id ? productMap.get(s.product_id) : undefined,
          category_name: s.category_id ? catMap.get(s.category_id) : undefined,
        })));
      }
    } catch (error) {
      console.error('Error loading schemes:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSchemeIcon = (type: string) => {
    switch (type) {
      case 'discount': return <Percent className="w-5 h-5" />;
      case 'buy_get': return <Gift className="w-5 h-5" />;
      default: return <Tag className="w-5 h-5" />;
    }
  };

  const getSchemeColor = (type: string) => {
    switch (type) {
      case 'discount': return 'bg-emerald-500/10 text-emerald-600 border-emerald-200';
      case 'buy_get': return 'bg-purple-500/10 text-purple-600 border-purple-200';
      case 'bundle': return 'bg-blue-500/10 text-blue-600 border-blue-200';
      default: return 'bg-orange-500/10 text-orange-600 border-orange-200';
    }
  };

  const getDaysLeft = (endDate: string | null) => {
    if (!endDate) return 999;
    return Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  const getSchemeDetails = (s: Scheme) => {
    if (s.scheme_type === 'discount') {
      if (s.discount_percentage) return `${s.discount_percentage}% discount`;
      if (s.discount_amount) return `₹${s.discount_amount} off`;
    }
    if (s.scheme_type === 'buy_get') return `Buy ${s.buy_quantity || 0} Get ${s.free_quantity || 0} Free`;
    return s.scheme_type.replace('_', ' ');
  };

  const filtered = schemes.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-purple-600" />
          Active Schemes
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {schemes.length} active schemes available for primary orders
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search schemes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Tag className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-medium mb-1">No Active Schemes</h3>
            <p className="text-sm text-muted-foreground">Check back later for new promotional schemes.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(scheme => {
            const daysLeft = getDaysLeft(scheme.end_date);
            const isUrgent = daysLeft <= 3;

            return (
              <Card key={scheme.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <div className={`p-3 rounded-xl ${getSchemeColor(scheme.scheme_type)} flex-shrink-0`}>
                      {getSchemeIcon(scheme.scheme_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-foreground">{scheme.name}</h3>
                        {scheme.end_date && (
                          <Badge variant={isUrgent ? "destructive" : "outline"} className="text-xs flex-shrink-0">
                            <Clock className="w-3 h-3 mr-1" />
                            {daysLeft}d left
                          </Badge>
                        )}
                      </div>
                      
                      {scheme.description && (
                        <p className="text-sm text-muted-foreground mt-1">{scheme.description}</p>
                      )}

                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge className={getSchemeColor(scheme.scheme_type)}>
                          {getSchemeDetails(scheme)}
                        </Badge>
                        {scheme.min_order_value && (
                          <Badge variant="outline" className="text-xs">
                            Min ₹{scheme.min_order_value.toLocaleString('en-IN')}
                          </Badge>
                        )}
                        {scheme.product_name && (
                          <Badge variant="secondary" className="text-xs">
                            <Package className="w-3 h-3 mr-1" />
                            {scheme.product_name}
                          </Badge>
                        )}
                        {scheme.category_name && (
                          <Badge variant="secondary" className="text-xs">{scheme.category_name}</Badge>
                        )}
                      </div>

                      {scheme.start_date && scheme.end_date && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Valid: {format(new Date(scheme.start_date), 'dd MMM')} — {format(new Date(scheme.end_date), 'dd MMM yyyy')}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PrimarySchemesView;
