import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Gift, Tag, Percent, ArrowRight, Clock, Sparkles } from 'lucide-react';
import { format, isAfter } from 'date-fns';

interface Scheme {
  id: string;
  name: string;
  scheme_type: string;
  discount_percentage?: number | null;
  discount_amount?: number | null;
  min_order_value?: number | null;
  buy_quantity?: number | null;
  free_quantity?: number | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean | null;
}

interface SchemesWidgetProps {
  onViewAll?: () => void;
}

export const SchemesWidget = ({ onViewAll }: SchemesWidgetProps) => {
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(true);

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
        .order('end_date', { ascending: true })
        .limit(4);

      setSchemes(data || []);
    } catch (error) {
      console.error('Error loading schemes:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSchemeIcon = (type: string) => {
    switch (type) {
      case 'discount':
        return <Percent className="w-4 h-4" />;
      case 'buy_get':
        return <Gift className="w-4 h-4" />;
      default:
        return <Tag className="w-4 h-4" />;
    }
  };

  const getSchemeColor = (type: string) => {
    switch (type) {
      case 'discount':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-200';
      case 'buy_get':
        return 'bg-purple-500/10 text-purple-600 border-purple-200';
      default:
        return 'bg-blue-500/10 text-blue-600 border-blue-200';
    }
  };

  const getDaysLeft = (endDate: string | null) => {
    if (!endDate) return 999;
    const end = new Date(endDate);
    const today = new Date();
    const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <CardTitle className="text-lg">Active Schemes</CardTitle>
          </div>
          {onViewAll && (
            <Button variant="ghost" size="sm" onClick={onViewAll} className="text-purple-600">
              View All
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {schemes.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Tag className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No active schemes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {schemes.map((scheme) => {
              const daysLeft = getDaysLeft(scheme.end_date);
              const isUrgent = daysLeft <= 3;
              
              return (
                <div 
                  key={scheme.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                >
                  <div className={`p-2.5 rounded-lg ${getSchemeColor(scheme.scheme_type)}`}>
                    {getSchemeIcon(scheme.scheme_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{scheme.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {scheme.scheme_type === 'buy_get' 
                          ? `Buy ${scheme.buy_quantity || 0} Get ${scheme.free_quantity || 0}`
                          : scheme.scheme_type === 'discount'
                            ? `${scheme.discount_percentage || scheme.discount_amount || 0}% Off`
                            : scheme.scheme_type.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    {scheme.end_date && (
                      <div className={`flex items-center gap-1 text-xs ${isUrgent ? 'text-destructive' : 'text-muted-foreground'}`}>
                        <Clock className="w-3 h-3" />
                        <span>{daysLeft}d left</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
