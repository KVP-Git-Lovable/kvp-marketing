import { useState, useMemo, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Filter, Search, Package, Calendar, TrendingUp, Gift, Percent, ShoppingCart, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ProductScheme {
  id: string;
  name: string;
  description: string | null;
  scheme_type: string;
  product_id: string | null;
  variant_id: string | null;
  category_id: string | null;
  discount_percentage: number | null;
  discount_amount: number | null;
  buy_quantity: number | null;
  free_quantity: number | null;
  free_product_id: string | null;
  bundle_product_ids: string[] | null;
  bundle_discount_percentage: number | null;
  bundle_discount_amount: number | null;
  min_order_value: number | null;
  condition_quantity: number | null;
  quantity_condition_type: string | null;
  tier_data: unknown;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean | null;
  is_first_order_only: boolean | null;
  validity_days: number | null;
  created_at: string;
  updated_at: string;
  product_name?: string;
  category_name?: string;
  free_product_name?: string;
}

const getSchemeTypeIcon = (type: string) => {
  switch (type) {
    case 'percentage_discount':
      return <Percent className="w-4 h-4" />;
    case 'flat_discount':
      return <TrendingUp className="w-4 h-4" />;
    case 'buy_x_get_y_free':
      return <Gift className="w-4 h-4" />;
    case 'bundle_combo':
      return <ShoppingCart className="w-4 h-4" />;
    default:
      return <Package className="w-4 h-4" />;
  }
};

const getSchemeTypeLabel = (type: string) => {
  switch (type) {
    case 'percentage_discount':
      return 'Percentage Discount';
    case 'flat_discount':
      return 'Flat Discount';
    case 'buy_x_get_y_free':
      return 'Buy X Get Y Free';
    case 'bundle_combo':
      return 'Bundle Combo';
    case 'tiered_discount':
      return 'Tiered Discount';
    case 'time_based_offer':
      return 'Time Based Offer';
    case 'first_order_discount':
      return 'First Order Discount';
    case 'category_wide_discount':
      return 'Category Discount';
    default:
      return type;
  }
};

const formatDate = (date: string | null) => {
  if (!date) return 'No limit';
  return new Date(date).toLocaleDateString('en-IN', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  });
};

const getConditionText = (scheme: ProductScheme) => {
  switch (scheme.scheme_type) {
    case 'percentage_discount':
    case 'flat_discount':
      if (scheme.condition_quantity && scheme.quantity_condition_type) {
        return `Buy ${scheme.quantity_condition_type === 'more_than' ? '>' : '≥'} ${scheme.condition_quantity} units`;
      }
      if (scheme.min_order_value) {
        return `Min order: ₹${scheme.min_order_value}`;
      }
      return 'No minimum';
    case 'buy_x_get_y_free':
      return `Buy ${scheme.buy_quantity || 0} units`;
    case 'bundle_combo':
      return 'Buy all bundle products';
    default:
      return '';
  }
};

const getBenefitText = (scheme: ProductScheme) => {
  switch (scheme.scheme_type) {
    case 'percentage_discount':
      return `Get ${scheme.discount_percentage}% off`;
    case 'flat_discount':
      return `Get ₹${scheme.discount_amount} off`;
    case 'buy_x_get_y_free':
      return `Get ${scheme.free_quantity || 0} free`;
    case 'bundle_combo':
      if (scheme.bundle_discount_percentage) {
        return `Get ${scheme.bundle_discount_percentage}% off`;
      }
      return `Get ₹${scheme.bundle_discount_amount || 0} off`;
    case 'tiered_discount':
      return 'Tiered discounts apply';
    default:
      return '';
  }
};

const isSchemeActive = (scheme: ProductScheme) => {
  if (!scheme.is_active) return false;
  const now = new Date();
  const startDate = scheme.start_date ? new Date(scheme.start_date) : null;
  const endDate = scheme.end_date ? new Date(scheme.end_date) : null;
  
  if (startDate && now < startDate) return false;
  if (endDate && now > endDate) return false;
  return true;
};

export const Schemes = () => {
  const [schemes, setSchemes] = useState<ProductScheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();

  const fetchSchemes = async () => {
    try {
      // First fetch schemes
      const { data: schemesData, error: schemesError } = await supabase
        .from('product_schemes')
        .select('*')
        .order('created_at', { ascending: false });

      if (schemesError) throw schemesError;

      // Fetch product names for product_id
      const productIds = [...new Set((schemesData || [])
        .map(s => s.product_id)
        .filter(Boolean))] as string[];
      
      const freeProductIds = [...new Set((schemesData || [])
        .map(s => s.free_product_id)
        .filter(Boolean))] as string[];

      const categoryIds = [...new Set((schemesData || [])
        .map(s => s.category_id)
        .filter(Boolean))] as string[];

      let productsMap: Record<string, string> = {};
      let categoriesMap: Record<string, string> = {};

      if (productIds.length > 0 || freeProductIds.length > 0) {
        const allProductIds = [...new Set([...productIds, ...freeProductIds])];
        const { data: productsData } = await supabase
          .from('products')
          .select('id, name')
          .in('id', allProductIds);
        
        productsMap = (productsData || []).reduce((acc, p) => {
          acc[p.id] = p.name;
          return acc;
        }, {} as Record<string, string>);
      }

      if (categoryIds.length > 0) {
        const { data: categoriesData } = await supabase
          .from('product_categories')
          .select('id, name')
          .in('id', categoryIds);
        
        categoriesMap = (categoriesData || []).reduce((acc, c) => {
          acc[c.id] = c.name;
          return acc;
        }, {} as Record<string, string>);
      }

      const formattedSchemes: ProductScheme[] = (schemesData || []).map(scheme => ({
        ...scheme,
        product_name: scheme.product_id ? productsMap[scheme.product_id] || 'Unknown Product' : 'All Products',
        free_product_name: scheme.free_product_id ? productsMap[scheme.free_product_id] || null : null,
        category_name: scheme.category_id ? categoriesMap[scheme.category_id] || null : null,
      }));

      setSchemes(formattedSchemes);
    } catch (error) {
      console.error('Error fetching schemes:', error);
      toast({
        title: "Error",
        description: "Failed to load schemes",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchemes();

    // Set up real-time subscription
    const channel = supabase
      .channel('product_schemes_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'product_schemes'
        },
        () => {
          fetchSchemes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const schemeTypes = useMemo(() => {
    const types = [...new Set(schemes.map(s => s.scheme_type))];
    return types;
  }, [schemes]);

  const filteredSchemes = useMemo(() => {
    return schemes.filter(scheme => {
      const matchesSearch = scheme.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (scheme.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
                           (scheme.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
      const matchesType = selectedType === "all" || scheme.scheme_type === selectedType;
      
      const active = isSchemeActive(scheme);
      const matchesStatus = statusFilter === "all" || 
                           (statusFilter === "active" && active) ||
                           (statusFilter === "inactive" && !active);
      
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [schemes, searchTerm, selectedType, statusFilter]);

  const activeSchemes = filteredSchemes.filter(scheme => isSchemeActive(scheme));
  const inactiveSchemes = filteredSchemes.filter(scheme => !isSchemeActive(scheme));

  const SchemeCard = ({ scheme }: { scheme: ProductScheme }) => {
    const active = isSchemeActive(scheme);
    
    return (
      <Card className="h-full hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base leading-tight">{scheme.name}</CardTitle>
              {scheme.description && (
                <CardDescription className="mt-1 text-sm line-clamp-2">
                  {scheme.description}
                </CardDescription>
              )}
            </div>
            <Badge variant={active ? "default" : "secondary"} className="shrink-0">
              {active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {/* Scheme Type Badge */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              {getSchemeTypeIcon(scheme.scheme_type)}
              {getSchemeTypeLabel(scheme.scheme_type)}
            </Badge>
          </div>

          {/* Product Info */}
          <div className="flex items-center gap-2 text-sm">
            <Package className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="truncate">{scheme.product_name}</span>
          </div>

          {/* Condition & Benefit */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="text-sm">
              <span className="text-muted-foreground">Condition: </span>
              <span className="font-medium">{getConditionText(scheme)}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Benefit: </span>
              <span className="font-medium text-primary">{getBenefitText(scheme)}</span>
            </div>
            {scheme.scheme_type === 'buy_x_get_y_free' && scheme.free_product_name && (
              <div className="text-sm">
                <span className="text-muted-foreground">Free Product: </span>
                <span className="font-medium">{scheme.free_product_name}</span>
              </div>
            )}
          </div>

          {/* Validity */}
          <div className="flex items-center gap-2 text-sm border-t pt-3">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Valid: </span>
            <span>
              {formatDate(scheme.start_date)} - {formatDate(scheme.end_date)}
            </span>
          </div>

          {/* First Order Only Badge */}
          {scheme.is_first_order_only && (
            <Badge variant="secondary" className="text-xs">
              First Order Only
            </Badge>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Layout>
      <div className="p-4 space-y-6">
        {/* Header */}
        <div className="bg-gradient-primary text-primary-foreground p-6 rounded-lg">
          <h1 className="text-2xl font-bold">Schemes & Offers</h1>
          <p className="text-primary-foreground/80 mt-1">
            View all available product schemes and offers
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="w-4 h-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search schemes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue placeholder="Scheme Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {schemeTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {getSchemeTypeLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          /* Schemes Tabs */
          <Tabs defaultValue="active" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="active">
                Active ({activeSchemes.length})
              </TabsTrigger>
              <TabsTrigger value="previous">
                Previous ({inactiveSchemes.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4">
              {activeSchemes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeSchemes.map(scheme => (
                    <SchemeCard key={scheme.id} scheme={scheme} />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No active schemes found</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Schemes can be added from Admin Panel → Scheme Master
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="previous" className="space-y-4">
              {inactiveSchemes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inactiveSchemes.map(scheme => (
                    <SchemeCard key={scheme.id} scheme={scheme} />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="text-center py-8">
                    <Package className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">No previous schemes found</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Layout>
  );
};
