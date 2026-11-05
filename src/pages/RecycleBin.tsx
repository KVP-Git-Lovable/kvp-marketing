import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Trash2, 
  RotateCcw, 
  Search, 
  ArrowLeft, 
  Loader2,
  Calendar,
  User,
  Database,
  AlertTriangle,
  Eye,
  Trash
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { restoreFromRecycleBin, permanentlyDelete, clearRecycleBin } from "@/utils/recycleBinUtils";
import { isUserArchive } from "@/utils/userArchiveUtils";
interface RecycleBinItem {
  id: string;
  original_table: string;
  original_id: string;
  record_data: any;
  deleted_by: string;
  deleted_at: string;
  module_name: string;
  record_name: string | null;
  created_at: string;
  deleted_by_name?: string;
}

const RecycleBin = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<RecycleBinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [viewItem, setViewItem] = useState<RecycleBinItem | null>(null);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchRecycleBinItems();
  }, []);

  const fetchRecycleBinItems = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('recycle_bin')
        .select('*')
        .order('deleted_at', { ascending: false });

      if (error) throw error;

      // Fetch user names for deleted_by
      const userIds = [...new Set((data || []).map(item => item.deleted_by))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .in('id', userIds);

      const profileMap = new Map(
        (profiles || []).map(p => [p.id, p.full_name || p.username || 'Unknown'])
      );

      const itemsWithNames = (data || []).map(item => ({
        ...item,
        deleted_by_name: profileMap.get(item.deleted_by) || 'Unknown'
      }));

      setItems(itemsWithNames);
    } catch (error) {
      console.error('Error fetching recycle bin items:', error);
      toast.error('Failed to load recycle bin');
    } finally {
      setLoading(false);
    }
  };

  const modules = [...new Set(items.map(item => item.module_name))];

  const filteredItems = items.filter(item => {
    const matchesSearch = 
      (item.record_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
      item.module_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.original_table.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesModule = moduleFilter === "all" || item.module_name === moduleFilter;
    
    return matchesSearch && matchesModule;
  });

  const handleRestore = async (item: RecycleBinItem) => {
    setProcessing(true);
    try {
      const success = await restoreFromRecycleBin(
        item.id,
        item.original_table,
        item.record_data,
        item.original_id
      );

      if (success) {
        toast.success(`${item.record_name || 'Item'} restored successfully`);
        fetchRecycleBinItems();
      } else {
        toast.error('Failed to restore item');
      }
    } catch (error) {
      toast.error('Failed to restore item');
    } finally {
      setProcessing(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!itemToDelete) return;
    
    setProcessing(true);
    try {
      const success = await permanentlyDelete(itemToDelete);
      if (success) {
        toast.success('Item permanently deleted');
        fetchRecycleBinItems();
      } else {
        toast.error('Failed to delete item');
      }
    } catch (error) {
      toast.error('Failed to delete item');
    } finally {
      setProcessing(false);
      setShowDeleteDialog(false);
      setItemToDelete(null);
    }
  };

  const handleClearBin = async () => {
    setProcessing(true);
    try {
      const idsToDelete = selectedItems.length > 0 ? selectedItems : undefined;
      const success = await clearRecycleBin(idsToDelete);
      
      if (success) {
        toast.success(selectedItems.length > 0 
          ? `${selectedItems.length} items permanently deleted` 
          : 'Recycle bin cleared'
        );
        setSelectedItems([]);
        fetchRecycleBinItems();
      } else {
        toast.error('Failed to clear recycle bin');
      }
    } catch (error) {
      toast.error('Failed to clear recycle bin');
    } finally {
      setProcessing(false);
      setShowClearDialog(false);
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === filteredItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(filteredItems.map(item => item.id));
    }
  };

  const getModuleColor = (module: string) => {
    const colors: Record<string, string> = {
      'Retailers': 'bg-blue-100 text-blue-700',
      'Distributors': 'bg-green-100 text-green-700',
      'Beats': 'bg-purple-100 text-purple-700',
      'Orders': 'bg-orange-100 text-orange-700',
      'Visits': 'bg-cyan-100 text-cyan-700',
      'default': 'bg-gray-100 text-gray-700'
    };
    return colors[module] || colors['default'];
  };

  return (
    <Layout>
      <div className="p-4 space-y-4 pb-20">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Recycle Bin
            </h1>
            <p className="text-sm text-muted-foreground">
              {items.length} deleted items
            </p>
          </div>
          {items.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowClearDialog(true)}
              disabled={processing}
            >
              <Trash className="h-4 w-4 mr-1" />
              {selectedItems.length > 0 ? `Delete (${selectedItems.length})` : 'Clear All'}
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search deleted items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Module" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Modules</SelectItem>
              {modules.map(module => (
                <SelectItem key={module} value={module}>{module}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Select All */}
        {filteredItems.length > 0 && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedItems.length === filteredItems.length}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm text-muted-foreground">
              Select all ({filteredItems.length} items)
            </span>
          </div>
        )}

        {/* Items List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredItems.length === 0 ? (
          <Card className="p-8 text-center">
            <Trash2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <h3 className="font-medium text-lg">Recycle Bin is Empty</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Deleted items will appear here
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <Card 
                key={item.id} 
                className={`${selectedItems.includes(item.id) ? 'ring-2 ring-primary' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item.id)}
                      onChange={() => toggleSelectItem(item.id)}
                      className="h-4 w-4 mt-1 rounded border-gray-300"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium truncate">
                          {item.record_name || 'Unknown Item'}
                        </h3>
                        <Badge className={getModuleColor(item.module_name)} variant="secondary">
                          {item.module_name}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Database className="h-3 w-3" />
                          {item.original_table}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {item.deleted_by_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(item.deleted_at), 'MMM d, yyyy h:mm a')}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setViewItem(item)}
                        className="h-8 w-8"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRestore(item)}
                        disabled={processing}
                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setItemToDelete(item.id);
                          setShowDeleteDialog(true);
                        }}
                        disabled={processing}
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* View Item Dialog */}
        <Dialog open={!!viewItem} onOpenChange={() => setViewItem(null)}>
          <DialogContent className="max-w-lg max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                {viewItem?.record_name || 'Item Details'}
              </DialogTitle>
              <DialogDescription>
                Deleted from {viewItem?.module_name} on {viewItem && format(new Date(viewItem.deleted_at), 'PPpp')}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[50vh]">
              <div className="space-y-3">
                {/* Show archive summary for combined user archives */}
                {viewItem && isUserArchive(viewItem.record_data) && viewItem.record_data._meta && (
                  <div className="bg-muted/50 p-3 rounded-lg mb-4">
                    <p className="text-sm font-medium mb-2">Combined User Archive</p>
                    <p className="text-xs text-muted-foreground">
                      Total Records: {viewItem.record_data._meta.total_records}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Tables with data: {viewItem.record_data._meta.tables_with_data?.join(', ') || 'None'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Archived: {format(new Date(viewItem.record_data._meta.archived_at), 'PPpp')}
                    </p>
                  </div>
                )}
                {viewItem && Object.entries(viewItem.record_data)
                  .filter(([key]) => key !== '_meta') // Hide meta from main display
                  .map(([key, value]) => (
                  <div key={key} className="border-b pb-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase">
                      {key.replace(/_/g, ' ')}
                    </p>
                    <p className="text-sm mt-0.5 break-words">
                      {Array.isArray(value) 
                        ? `${value.length} records` 
                        : typeof value === 'object' && value !== null
                          ? JSON.stringify(value, null, 2).substring(0, 200) + '...'
                          : String(value ?? '-')}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewItem(null)}>
                Close
              </Button>
              {viewItem && (
                <Button onClick={() => {
                  handleRestore(viewItem);
                  setViewItem(null);
                }}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Restore
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Permanent Delete Confirmation */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Permanently Delete?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. The item will be permanently deleted
                and cannot be recovered. A log entry will be created for audit purposes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handlePermanentDelete}
                disabled={processing}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                Delete Permanently
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Clear Bin Confirmation */}
        <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                {selectedItems.length > 0 
                  ? `Delete ${selectedItems.length} Items Permanently?`
                  : 'Clear Entire Recycle Bin?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. {selectedItems.length > 0 
                  ? `${selectedItems.length} selected items`
                  : 'All items in the recycle bin'} will be permanently deleted.
                A log entry will be created for each item for audit purposes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleClearBin}
                disabled={processing}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                {selectedItems.length > 0 ? 'Delete Selected' : 'Clear All'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
};

export default RecycleBin;
