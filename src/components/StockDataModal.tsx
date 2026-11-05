import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface StockDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  retailerId: string;
  retailerName: string;
}

interface StockRecord {
  id: string;
  product_id: string;
  product_name: string;
  stock_quantity: number;
  created_at: string;
}

export const StockDataModal = ({ isOpen, onClose, retailerId, retailerName }: StockDataModalProps) => {
  const [loading, setLoading] = useState(false);
  const [stockRecords, setStockRecords] = useState<StockRecord[]>([]);

  useEffect(() => {
    if (isOpen && retailerId) {
      loadStockData();
    }
  }, [isOpen, retailerId]);

  const loadStockData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get today's date range
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch stock records for today for this retailer
      const { data, error } = await supabase
        .from('stock')
        .select('id, product_id, product_name, stock_quantity, created_at')
        .eq('user_id', user.id)
        .eq('retailer_id', retailerId)
        .gte('created_at', `${today}T00:00:00.000Z`)
        .lte('created_at', `${today}T23:59:59.999Z`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setStockRecords(data || []);
    } catch (error) {
      console.error('Error loading stock data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95%] max-w-2xl mx-auto max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package size={20} />
            Stock Data - {retailerName}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">Today's stock records</p>
        </DialogHeader>
        
        <div className="mt-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">Loading stock data...</p>
            </div>
          ) : stockRecords.length === 0 ? (
            <div className="text-center py-8">
              <Package size={48} className="mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No stock records found for today</p>
              <p className="text-sm text-muted-foreground mt-2">Stock data will appear here once you add stock quantities in order entry</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead className="text-right">Stock Quantity</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">{record.product_name}</TableCell>
                      <TableCell className="text-right">{record.stock_quantity}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {new Date(record.created_at).toLocaleTimeString('en-IN', { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-4">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
