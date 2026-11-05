import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  ArrowLeft, 
  BookOpen,
  ArrowUpCircle,
  ArrowDownCircle,
  RotateCcw,
  Search,
  Filter,
  Download,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';

interface Transaction {
  id: string;
  product_id: string;
  product_name?: string;
  transaction_type: string;
  quantity: number;
  running_balance?: number;
  reference_type?: string;
  reference_number?: string;
  batch_number?: string;
  unit?: string;
  unit_cost?: number;
  notes?: string;
  created_at: string;
}

interface Product {
  id: string;
  name: string;
}

const InventoryLedger = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const distributorId = localStorage.getItem('distributor_id');

  useEffect(() => {
    if (!distributorId) {
      navigate('/distributor-portal/login');
      return;
    }
    loadData();
  }, [distributorId, dateFrom, dateTo]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load transactions
      const { data: txData, error } = await supabase
        .from('distributor_inventory_transactions')
        .select('*')
        .eq('distributor_id', distributorId)
        .gte('created_at', `${dateFrom}T00:00:00`)
        .lte('created_at', `${dateTo}T23:59:59`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get product names
      const productIds = [...new Set(txData?.map(t => t.product_id) || [])];
      let productMap = new Map<string, string>();
      
      if (productIds.length > 0) {
        const { data: productsData } = await supabase
          .from('products')
          .select('id, name')
          .in('id', productIds);
        productsData?.forEach(p => productMap.set(p.id, p.name));
      }

      setTransactions(txData?.map(t => ({
        ...t,
        product_name: productMap.get(t.product_id) || 'Unknown Product',
      })) || []);

      // Load all products for filter
      const { data: allProducts } = await supabase
        .from('products')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      setProducts(allProducts || []);

    } catch (error) {
      console.error('Error loading transactions:', error);
      toast.error('Failed to load transaction history');
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = 
      t.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.reference_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.batch_number?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || t.transaction_type === typeFilter;
    const matchesProduct = productFilter === 'all' || t.product_id === productFilter;
    return matchesSearch && matchesType && matchesProduct;
  });

  const getTypeInfo = (type: string) => {
    const configs: Record<string, { color: string; icon: any; label: string }> = {
      inward: { color: 'bg-green-100 text-green-700', icon: ArrowDownCircle, label: 'Inward' },
      sale: { color: 'bg-blue-100 text-blue-700', icon: ArrowUpCircle, label: 'Sale' },
      return_from_retailer: { color: 'bg-purple-100 text-purple-700', icon: RotateCcw, label: 'Retailer Return' },
      return_to_company: { color: 'bg-orange-100 text-orange-700', icon: RotateCcw, label: 'Company Return' },
      adjustment: { color: 'bg-yellow-100 text-yellow-700', icon: Filter, label: 'Adjustment' },
    };
    return configs[type] || configs.adjustment;
  };

  const handleExport = () => {
    const csvContent = [
      ['Date', 'Product', 'Type', 'Quantity', 'Unit', 'Reference', 'Batch', 'Notes'].join(','),
      ...filteredTransactions.map(t => [
        format(new Date(t.created_at), 'dd/MM/yyyy HH:mm'),
        `"${t.product_name}"`,
        t.transaction_type,
        t.quantity,
        t.unit || '',
        t.reference_number || '',
        t.batch_number || '',
        `"${t.notes || ''}"`,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-ledger-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Ledger exported');
  };

  // Calculate summary stats
  const stats = {
    totalInward: filteredTransactions.filter(t => t.transaction_type === 'inward').reduce((sum, t) => sum + t.quantity, 0),
    totalSales: filteredTransactions.filter(t => t.transaction_type === 'sale').reduce((sum, t) => sum + Math.abs(t.quantity), 0),
    totalReturnsIn: filteredTransactions.filter(t => t.transaction_type === 'return_from_retailer').reduce((sum, t) => sum + t.quantity, 0),
    totalReturnsOut: filteredTransactions.filter(t => t.transaction_type === 'return_to_company').reduce((sum, t) => sum + Math.abs(t.quantity), 0),
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div>
      <header className="sticky-header-safe z-50 bg-card border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/distributor-portal/inventory')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="font-semibold text-foreground flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  Inventory Ledger
                </h1>
                <p className="text-xs text-muted-foreground">{filteredTransactions.length} transactions</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <ArrowDownCircle className="w-4 h-4 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Inward</p>
                  <p className="font-bold text-green-600">+{stats.totalInward}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <ArrowUpCircle className="w-4 h-4 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Total Sales</p>
                  <p className="font-bold text-blue-600">-{stats.totalSales}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-purple-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Returns In</p>
                  <p className="font-bold text-purple-600">+{stats.totalReturnsIn}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-orange-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Returns Out</p>
                  <p className="font-bold text-orange-600">-{stats.totalReturnsOut}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search product, reference, batch..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="inward">Inward</SelectItem>
                  <SelectItem value="sale">Sale</SelectItem>
                  <SelectItem value="return_from_retailer">Retailer Return</SelectItem>
                  <SelectItem value="return_to_company">Company Return</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                </SelectContent>
              </Select>
              <Select value={productFilter} onValueChange={setProductFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Product" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-36"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-36"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transactions Table */}
        <Card>
          <CardContent className="p-0">
            {filteredTransactions.length === 0 ? (
              <div className="py-12 text-center">
                <BookOpen className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-medium mb-2">No transactions found</h3>
                <p className="text-sm text-muted-foreground">
                  Adjust filters or date range to see transactions
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((tx) => {
                      const typeInfo = getTypeInfo(tx.transaction_type);
                      const Icon = typeInfo.icon;
                      const isPositive = tx.quantity > 0;
                      
                      return (
                        <TableRow key={tx.id}>
                          <TableCell className="whitespace-nowrap">
                            <p className="font-medium">{format(new Date(tx.created_at), 'dd MMM yyyy')}</p>
                            <p className="text-xs text-muted-foreground">{format(new Date(tx.created_at), 'HH:mm')}</p>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">{tx.product_name}</p>
                            {tx.unit && <p className="text-xs text-muted-foreground">{tx.unit}</p>}
                          </TableCell>
                          <TableCell>
                            <Badge className={typeInfo.color}>
                              <Icon className="w-3 h-3 mr-1" />
                              {typeInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={`font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                              {isPositive ? '+' : ''}{tx.quantity}
                            </span>
                          </TableCell>
                          <TableCell>
                            {tx.reference_number && (
                              <p className="text-sm">{tx.reference_number}</p>
                            )}
                            {tx.reference_type && (
                              <p className="text-xs text-muted-foreground">{tx.reference_type.replace('_', ' ')}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            {tx.batch_number && (
                              <p className="text-sm">{tx.batch_number}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            {tx.notes && (
                              <p className="text-sm text-muted-foreground max-w-[200px] truncate" title={tx.notes}>
                                {tx.notes}
                              </p>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default InventoryLedger;
