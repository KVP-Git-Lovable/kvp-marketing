import { useState, useEffect } from "react";
import { Calendar, Package, TrendingUp, TrendingDown } from "lucide-react";
import { format, subDays } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface StockCycleData {
  id: string;
  visit_date: string;
  product_id: string;
  product_name: string;
  ordered_quantity: number;
  stock_quantity: number;
  visit_id?: string;
}

interface StockCycleTableProps {
  retailerId: string;
  retailerName: string;
  currentVisitId?: string;
}

interface ProductWithStock {
  product_id: string;
  product_name: string;
  visits: Array<{
    visit_date: string;
    ordered_quantity: number;
    stock_quantity: number;
    visit_id?: string;
  }>;
}

interface TertiarySalesData {
  product_id: string;
  product_name: string;
  lastVisitSales: number;
  previousVisitSales1: number;
  previousVisitSales2: number;
  previousVisitSales3: number;
  sales1Change: number;
  sales1ChangePercentage: number;
  sales2Change: number;
  sales2ChangePercentage: number;
  sales3Change: number;
  sales3ChangePercentage: number;
}

export const StockCycleTable = ({ retailerId, retailerName, currentVisitId }: StockCycleTableProps) => {
  const { user } = useAuth();
  const [stockData, setStockData] = useState<StockCycleData[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [activeTab, setActiveTab] = useState("stock-movement");

  useEffect(() => {
    if (user && retailerId) {
      loadAllData();
    }
  }, [user, retailerId, selectedDate]);

  const loadAllData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Load both stock data and all available products
      await Promise.all([
        loadStockData(),
        loadAllProducts()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllProducts = async () => {
    if (!user) return;
    
    try {
      // Get all products that are available for ordering
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, sku')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setAllProducts(products || []);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  };

  const loadStockData = async () => {
    if (!user) return;
    
    try {
      // Get last 6 visits worth of data
      let dateFilter = new Date();
      if (selectedDate) {
        dateFilter = selectedDate;
      }
      
      const endDate = format(dateFilter, 'yyyy-MM-dd');
      const startDate = format(subDays(dateFilter, 180), 'yyyy-MM-dd'); // Get last 6 months for comprehensive data
      
      // First, sync order data with stock cycle data to ensure orders are reflected
      await syncOrderDataWithDatabase(startDate, endDate);
      
      // Then get the updated stock cycle data
      const { data, error } = await supabase
        .from('stock_cycle_data')
        .select('*')
        .eq('user_id', user.id)
        .eq('retailer_id', retailerId)
        .gte('visit_date', startDate)
        .lte('visit_date', endDate)
        .order('visit_date', { ascending: false })
        .order('product_name', { ascending: true });

      if (error) throw error;
      
      setStockData(data || []);
    } catch (error) {
      console.error('Error loading stock data:', error);
      toast({
        title: "Error Loading Data",
        description: "Could not load stock cycle data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const syncOrderDataWithDatabase = async (startDate: string, endDate: string) => {
    if (!user) return;
    
    try {
      // Get all confirmed orders for this retailer and user in the date range
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          created_at,
          retailer_id,
          visit_id,
          order_items (
            product_id,
            product_name,
            quantity
          )
        `)
        .eq('user_id', user.id)
        .eq('retailer_id', retailerId)
        .eq('status', 'confirmed')
        .gte('created_at', startDate + 'T00:00:00.000Z')
        .lte('created_at', endDate + 'T23:59:59.999Z');

      if (orderError || !orderData) {
        console.log('No order data found or error:', orderError);
        return;
      }

      console.log('Found order data:', orderData);

      // Process each order to update stock cycle data
      for (const order of orderData) {
        const orderDate = format(new Date(order.created_at), 'yyyy-MM-dd');
        
        for (const item of order.order_items || []) {
          // Check if stock cycle entry exists for this product and date
          const { data: existing } = await supabase
            .from('stock_cycle_data')
            .select('id, ordered_quantity')
            .eq('user_id', user.id)
            .eq('retailer_id', retailerId)
            .eq('product_id', item.product_id)
            .eq('visit_date', orderDate)
            .maybeSingle();

          if (existing) {
            // Update existing entry - set the ordered quantity (don't add, just set)
            // Since we're getting all orders, we need to calculate total for this date
            const { data: allOrdersForDate } = await supabase
              .from('orders')
              .select(`
                order_items!inner (
                  quantity
                )
              `)
              .eq('user_id', user.id)
              .eq('retailer_id', retailerId)
              .eq('status', 'confirmed')
              .eq('order_items.product_id', item.product_id)
              .gte('created_at', orderDate + 'T00:00:00.000Z')
              .lte('created_at', orderDate + 'T23:59:59.999Z');

            const totalQuantity = allOrdersForDate?.reduce((sum, order) => {
              return sum + (Array.isArray(order.order_items) ? order.order_items.reduce((s, i) => s + i.quantity, 0) : 0);
            }, 0) || item.quantity;

            await supabase
              .from('stock_cycle_data')
              .update({ 
                ordered_quantity: totalQuantity,
                visit_id: order.visit_id 
              })
              .eq('id', existing.id);
          } else {
            // Create new entry with order data
            await supabase
              .from('stock_cycle_data')
              .insert({
                user_id: user.id,
                retailer_id: retailerId,
                product_id: item.product_id,
                product_name: item.product_name,
                ordered_quantity: item.quantity,
                stock_quantity: 0, // Will be updated from stock entries
                visit_date: orderDate,
                visit_id: order.visit_id
              });
          }
        }
      }

      // Also get latest stock data from the stock table for current stock levels
      const { data: stockData } = await supabase
        .from('stock')
        .select('*')
        .eq('user_id', user.id)
        .eq('retailer_id', retailerId)
        .order('created_at', { ascending: false });

      if (stockData && stockData.length > 0) {
        // Update stock cycle data with latest stock quantities
        for (const stockItem of stockData) {
          const stockDate = format(new Date(stockItem.created_at), 'yyyy-MM-dd');
          
          const { data: existing } = await supabase
            .from('stock_cycle_data')
            .select('id')
            .eq('user_id', user.id)
            .eq('retailer_id', retailerId)
            .eq('product_id', stockItem.product_id)
            .eq('visit_date', stockDate)
            .maybeSingle();

          if (existing) {
            await supabase
              .from('stock_cycle_data')
              .update({ 
                stock_quantity: stockItem.stock_quantity,
                visit_id: stockItem.visit_id
              })
              .eq('id', existing.id);
          } else {
            // Create new entry for stock data if no order exists
            await supabase
              .from('stock_cycle_data')
              .insert({
                user_id: user.id,
                retailer_id: retailerId,
                product_id: stockItem.product_id,
                product_name: stockItem.product_name,
                ordered_quantity: 0,
                stock_quantity: stockItem.stock_quantity,
                visit_date: stockDate,
                visit_id: stockItem.visit_id
              });
          }
        }
      }
    } catch (error) {
      console.error('Error syncing order data:', error);
    }
  };

  const calculateBalance = (currentStock: number, previousStock: number, orderedQty: number) => {
    // Balance = Previous Stock + Ordered - Current Stock (consumption)
    return previousStock + orderedQty - currentStock;
  };

  // Calculate tertiary sales data
  const calculateTertiarySalesData = (): TertiarySalesData[] => {
    const productMap = new Map<string, TertiarySalesData>();
    
    // First, add all available products
    allProducts.forEach(product => {
      productMap.set(product.id, {
        product_id: product.id,
        product_name: product.name,
        lastVisitSales: 0,
        previousVisitSales1: 0,
        previousVisitSales2: 0,
        previousVisitSales3: 0,
        sales1Change: 0,
        sales1ChangePercentage: 0,
        sales2Change: 0,
        sales2ChangePercentage: 0,
        sales3Change: 0,
        sales3ChangePercentage: 0
      });
    });
    
    // Calculate sales for each product based on stock movement
    stockData.forEach(item => {
      if (!productMap.has(item.product_id)) {
        productMap.set(item.product_id, {
          product_id: item.product_id,
          product_name: item.product_name,
          lastVisitSales: 0,
          previousVisitSales1: 0,
          previousVisitSales2: 0,
          previousVisitSales3: 0,
          sales1Change: 0,
          sales1ChangePercentage: 0,
          sales2Change: 0,
          sales2ChangePercentage: 0,
          sales3Change: 0,
          sales3ChangePercentage: 0
        });
      }
    });

    // Group visits by product and calculate sales
    const productVisits = new Map<string, Array<{visit_date: string, ordered_quantity: number, stock_quantity: number}>>();
    
    stockData.forEach(item => {
      if (!productVisits.has(item.product_id)) {
        productVisits.set(item.product_id, []);
      }
      productVisits.get(item.product_id)!.push({
        visit_date: item.visit_date,
        ordered_quantity: item.ordered_quantity,
        stock_quantity: item.stock_quantity
      });
    });

    productVisits.forEach((visits, productId) => {
      const product = productMap.get(productId);
      if (!product) return;

      // Sort visits by date (newest first)
      visits.sort((a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime());
      
      if (visits.length >= 2) {
        // Calculate sales as consumption: Previous Stock + Ordered - Current Stock
        const lastVisitSales = visits.length >= 2 
          ? Math.max(0, visits[1].stock_quantity + visits[0].ordered_quantity - visits[0].stock_quantity)
          : 0;
        
        const previousVisitSales1 = visits.length >= 3 
          ? Math.max(0, visits[2].stock_quantity + visits[1].ordered_quantity - visits[1].stock_quantity)
          : 0;
          
        const previousVisitSales2 = visits.length >= 4 
          ? Math.max(0, visits[3].stock_quantity + visits[2].ordered_quantity - visits[2].stock_quantity)
          : 0;
          
        const previousVisitSales3 = visits.length >= 5 
          ? Math.max(0, visits[4].stock_quantity + visits[3].ordered_quantity - visits[3].stock_quantity)
          : 0;
        
        // Calculate changes and percentages compared to last visit
        const sales1Change = lastVisitSales - previousVisitSales1;
        const sales1ChangePercentage = previousVisitSales1 > 0 
          ? ((sales1Change / previousVisitSales1) * 100) 
          : (lastVisitSales > 0 ? 100 : (previousVisitSales1 > 0 ? -100 : 0));
          
        const sales2Change = lastVisitSales - previousVisitSales2;
        const sales2ChangePercentage = previousVisitSales2 > 0 
          ? ((sales2Change / previousVisitSales2) * 100) 
          : (lastVisitSales > 0 ? 100 : (previousVisitSales2 > 0 ? -100 : 0));
          
        const sales3Change = lastVisitSales - previousVisitSales3;
        const sales3ChangePercentage = previousVisitSales3 > 0 
          ? ((sales3Change / previousVisitSales3) * 100) 
          : (lastVisitSales > 0 ? 100 : (previousVisitSales3 > 0 ? -100 : 0));

        product.lastVisitSales = lastVisitSales;
        product.previousVisitSales1 = previousVisitSales1;
        product.previousVisitSales2 = previousVisitSales2;
        product.previousVisitSales3 = previousVisitSales3;
        product.sales1Change = sales1Change;
        product.sales1ChangePercentage = sales1ChangePercentage;
        product.sales2Change = sales2Change;
        product.sales2ChangePercentage = sales2ChangePercentage;
        product.sales3Change = sales3Change;
        product.sales3ChangePercentage = sales3ChangePercentage;
      }
    });
    
    // Return all products, not just those with sales data
    return Array.from(productMap.values());
  };


  // Create comprehensive product data that includes all available products
  const createComprehensiveProductData = () => {
    const productMap = new Map<string, ProductWithStock>();
    
    // First, add all available products from the products table
    allProducts.forEach(product => {
      productMap.set(product.id, {
        product_id: product.id,
        product_name: product.name,
        visits: []
      });
    });
    
    // Then, add products from stock data (in case some aren't in products table)
    stockData.forEach(item => {
      if (!productMap.has(item.product_id)) {
        productMap.set(item.product_id, {
          product_id: item.product_id,
          product_name: item.product_name,
          visits: []
        });
      }
      
      const product = productMap.get(item.product_id)!;
      product.visits.push({
        visit_date: item.visit_date,
        ordered_quantity: item.ordered_quantity,
        stock_quantity: item.stock_quantity,
        visit_id: item.visit_id
      });
    });
    
    // Sort visits by date (newest first) and limit to last 6 visits
    productMap.forEach(product => {
      product.visits.sort((a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime());
      product.visits = product.visits.slice(0, 6);
    });
    
    return Array.from(productMap.values());
  };

  const comprehensiveProductData = createComprehensiveProductData();
  const tertiarySalesData = calculateTertiarySalesData();
  
  // Get unique visit dates for headers (last 6 visits max)
  const uniqueDates = Array.from(new Set(stockData.map(item => item.visit_date)))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    .slice(0, 6);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading stock data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Stock Cycle - {retailerName}</CardTitle>
            <Popover open={showCalendar} onOpenChange={setShowCalendar}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Calendar className="h-4 w-4 mr-2" />
                  {selectedDate ? format(selectedDate, "MMM dd, yyyy") : "Select Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="stock-movement">Stock Movement</TabsTrigger>
              <TabsTrigger value="tertiary-sales">Tertiary Sales</TabsTrigger>
            </TabsList>
            
            <TabsContent value="stock-movement" className="space-y-4">
              {comprehensiveProductData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No products available</p>
                  <p className="text-sm">Add products to start tracking stock cycles</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px] sticky left-0 bg-background">Product Name</TableHead>
                        {uniqueDates.map((date, index) => (
                          <TableHead key={date} className="text-center min-w-[150px]">
                            <div className="space-y-1">
                              <div className="font-semibold">
                                {index === 0 ? "Last Visit" : `Previous Visit ${index}`}
                              </div>
                              <div className="text-xs text-muted-foreground">{format(new Date(date), "MMM dd, yyyy")}</div>
                              <div className="text-xs text-muted-foreground grid grid-cols-3 gap-1">
                                <span>Order</span>
                                <span>Stock</span>
                                <span>Balance</span>
                              </div>
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comprehensiveProductData.map((product) => {
                        return (
                          <TableRow key={product.product_id} className="hover:bg-muted/50">
                            <TableCell className="font-medium sticky left-0 bg-background">
                              {product.product_name}
                            </TableCell>
                            {uniqueDates.map(date => {
                              const visitData = product.visits.find(v => v.visit_date === date);
                              const previousVisitIndex = product.visits.findIndex(v => v.visit_date === date) + 1;
                              const previousVisit = product.visits[previousVisitIndex];
                              
                              if (!visitData) {
                                return (
                                  <TableCell key={date} className="text-center text-muted-foreground">
                                    <div className="text-sm">No visit data</div>
                                  </TableCell>
                                );
                              }

                              const balance = previousVisit 
                                ? previousVisit.stock_quantity + visitData.ordered_quantity - visitData.stock_quantity
                                : visitData.ordered_quantity - visitData.stock_quantity;

                              return (
                                <TableCell key={date} className="text-center">
                                  <div className="space-y-1">
                                    <div className="grid grid-cols-3 gap-1 text-sm">
                                      <Badge variant="outline" className="text-xs px-1">
                                        {visitData.ordered_quantity}
                                      </Badge>
                                      <Badge variant="secondary" className="text-xs px-1">
                                        {visitData.stock_quantity}
                                      </Badge>
                                      <Badge 
                                        variant={balance > 0 ? "default" : balance < 0 ? "destructive" : "secondary"} 
                                        className="text-xs px-1"
                                      >
                                        {balance}
                                      </Badge>
                                    </div>
                                  </div>
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="tertiary-sales" className="space-y-4">
              {tertiarySalesData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No sales data available</p>
                  <p className="text-sm">Sales data will appear after visits with stock movements</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Product Name</TableHead>
                        <TableHead className="text-center">Last Visit Sales</TableHead>
                        <TableHead className="text-center">Previous Visit Sales 1</TableHead>
                        <TableHead className="text-center">Previous Visit Sales 2</TableHead>
                        <TableHead className="text-center">Previous Visit Sales 3</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tertiarySalesData.map((product) => (
                        <TableRow key={product.product_id}>
                          <TableCell className="font-medium">{product.product_name}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-sm">
                              {product.lastVisitSales}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Badge variant="outline" className="text-sm">
                                {product.previousVisitSales1}
                              </Badge>
                              {product.previousVisitSales1 > 0 && (
                                <div className="flex items-center gap-1">
                                  {product.sales1Change > 0 ? (
                                    <TrendingUp className="h-3 w-3 text-green-600" />
                                  ) : product.sales1Change < 0 ? (
                                    <TrendingDown className="h-3 w-3 text-red-600" />
                                  ) : null}
                                  <span className={`text-xs ${
                                    product.sales1Change > 0 ? 'text-green-600' : 
                                    product.sales1Change < 0 ? 'text-red-600' : 'text-muted-foreground'
                                  }`}>
                                    {product.sales1Change > 0 ? "+" : ""}{product.sales1ChangePercentage.toFixed(1)}%
                                  </span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Badge variant="outline" className="text-sm">
                                {product.previousVisitSales2}
                              </Badge>
                              {product.previousVisitSales2 > 0 && (
                                <div className="flex items-center gap-1">
                                  {product.sales2Change > 0 ? (
                                    <TrendingUp className="h-3 w-3 text-green-600" />
                                  ) : product.sales2Change < 0 ? (
                                    <TrendingDown className="h-3 w-3 text-red-600" />
                                  ) : null}
                                  <span className={`text-xs ${
                                    product.sales2Change > 0 ? 'text-green-600' : 
                                    product.sales2Change < 0 ? 'text-red-600' : 'text-muted-foreground'
                                  }`}>
                                    {product.sales2Change > 0 ? "+" : ""}{product.sales2ChangePercentage.toFixed(1)}%
                                  </span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <Badge variant="outline" className="text-sm">
                                {product.previousVisitSales3}
                              </Badge>
                              {product.previousVisitSales3 > 0 && (
                                <div className="flex items-center gap-1">
                                  {product.sales3Change > 0 ? (
                                    <TrendingUp className="h-3 w-3 text-green-600" />
                                  ) : product.sales3Change < 0 ? (
                                    <TrendingDown className="h-3 w-3 text-red-600" />
                                  ) : null}
                                  <span className={`text-xs ${
                                    product.sales3Change > 0 ? 'text-green-600' : 
                                    product.sales3Change < 0 ? 'text-red-600' : 'text-muted-foreground'
                                  }`}>
                                    {product.sales3Change > 0 ? "+" : ""}{product.sales3ChangePercentage.toFixed(1)}%
                                  </span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

    </div>
  );
};