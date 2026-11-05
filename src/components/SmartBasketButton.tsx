import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShoppingBasket, RotateCcw, TrendingUp, ArrowUpCircle, Loader2, Sparkles, Check, AlertCircle } from 'lucide-react';
import { useSmartBasket, RepeatOrderSuggestion, BeatTrendingSuggestion, UpsellSuggestion } from '@/hooks/useSmartBasket';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Use the same interface as VoiceOrder for compatibility
export interface AutoFillResult {
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  unit: string;
  confidence: 'high' | 'medium' | 'low';
  searchTerm: string;
}

interface SmartBasketButtonProps {
  retailerId: string;
  beatId?: string;
  onAutoFillProducts: (results: AutoFillResult[]) => void;
  disabled?: boolean;
  className?: string;
}

interface SelectedItem {
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  unit: string;
  type: 'repeat' | 'trending' | 'upsell';
}

export const SmartBasketButton: React.FC<SmartBasketButtonProps> = ({
  retailerId,
  beatId,
  onAutoFillProducts,
  disabled = false,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Map<string, SelectedItem>>(new Map());
  const [editedQuantities, setEditedQuantities] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState('repeat');

  const { suggestions, loading, error, fetchSuggestions, clearSuggestions } = useSmartBasket(retailerId, beatId);

  // Fetch suggestions when modal opens
  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setSelectedItems(new Map());
    setEditedQuantities({});
    fetchSuggestions();
  }, [fetchSuggestions]);

  // Generate unique key for an item
  const getItemKey = (productId: string, variantId?: string) => 
    variantId ? `${productId}_${variantId}` : productId;

  // Toggle item selection
  const toggleItem = (item: SelectedItem) => {
    const key = getItemKey(item.productId, item.variantId);
    setSelectedItems(prev => {
      const newMap = new Map(prev);
      if (newMap.has(key)) {
        newMap.delete(key);
      } else {
        newMap.set(key, item);
      }
      return newMap;
    });
  };

  // Update quantity for an item
  const updateQuantity = (productId: string, variantId: string | undefined, quantity: number) => {
    const key = getItemKey(productId, variantId);
    setEditedQuantities(prev => ({ ...prev, [key]: quantity }));
    
    // Update in selected items if already selected
    setSelectedItems(prev => {
      if (prev.has(key)) {
        const newMap = new Map(prev);
        const item = newMap.get(key)!;
        newMap.set(key, { ...item, quantity });
        return newMap;
      }
      return prev;
    });
  };

  // Get quantity for display (edited or original)
  const getQuantity = (productId: string, variantId: string | undefined, originalQty: number) => {
    const key = getItemKey(productId, variantId);
    return editedQuantities[key] ?? originalQty;
  };

  // Check if item is selected
  const isSelected = (productId: string, variantId?: string) => {
    return selectedItems.has(getItemKey(productId, variantId));
  };

  // Add selected items to order
  const handleAddSelected = () => {
    const items = Array.from(selectedItems.values());
    
    if (items.length === 0) {
      toast({
        title: 'No items selected',
        description: 'Please select at least one item to add',
        variant: 'destructive'
      });
      return;
    }

    const results: AutoFillResult[] = items.map(item => ({
      productId: item.productId,
      productName: item.productName,
      variantId: item.variantId,
      variantName: item.variantName,
      quantity: item.quantity,
      unit: item.unit,
      confidence: 'high' as const,
      searchTerm: item.productName
    }));

    onAutoFillProducts(results);
    
    toast({
      title: `✓ ${results.length} item${results.length > 1 ? 's' : ''} added`,
      description: results.map(r => `${r.productName}: ${r.quantity} ${r.unit}`).slice(0, 3).join(', ') + 
        (results.length > 3 ? `... +${results.length - 3} more` : ''),
    });

    setIsOpen(false);
    setSelectedItems(new Map());
  };

  // Add all items from current tab
  const handleAddAll = () => {
    if (!suggestions) return;

    const newSelected = new Map(selectedItems);

    if (activeTab === 'repeat') {
      suggestions.repeatOrder.forEach(item => {
        const key = getItemKey(item.productId, item.variantId);
        newSelected.set(key, {
          productId: item.productId,
          productName: item.variantName || item.productName,
          variantId: item.variantId,
          variantName: item.variantName,
          quantity: getQuantity(item.productId, item.variantId, item.quantity),
          unit: item.unit,
          type: 'repeat'
        });
      });
    } else if (activeTab === 'trending') {
      suggestions.beatTrending.forEach(item => {
        const key = getItemKey(item.productId, item.variantId);
        newSelected.set(key, {
          productId: item.productId,
          productName: item.variantName || item.productName,
          variantId: item.variantId,
          variantName: item.variantName,
          quantity: getQuantity(item.productId, item.variantId, item.suggestedQuantity),
          unit: item.unit,
          type: 'trending'
        });
      });
    } else if (activeTab === 'upsell') {
      suggestions.upsell.forEach(item => {
        const key = getItemKey(item.suggestedProductId, item.suggestedVariantId);
        newSelected.set(key, {
          productId: item.suggestedProductId,
          productName: item.suggestedVariantName || item.suggestedProductName,
          variantId: item.suggestedVariantId,
          variantName: item.suggestedVariantName,
          quantity: 1, // Default quantity for upsell
          unit: 'KG',
          type: 'upsell'
        });
      });
    }

    setSelectedItems(newSelected);
  };

  // Calculate total suggestion count
  const totalSuggestions = suggestions 
    ? suggestions.summary.repeatOrderCount + suggestions.summary.potentialCrossSell + suggestions.summary.upsellOpportunities
    : 0;

  // Format days ago
  const formatDaysAgo = (dateString: string) => {
    const days = Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  // Convert confidence to label
  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.7) return { label: 'High', color: 'bg-green-500' };
    if (confidence >= 0.4) return { label: 'Medium', color: 'bg-yellow-500' };
    return { label: 'Low', color: 'bg-gray-400' };
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={handleOpen}
        disabled={disabled || !retailerId}
        className={cn("flex-1 h-7 text-xs relative", className)}
        size="sm"
      >
        <Sparkles size={12} className="mr-0.5" />
        Smart Basket
        {totalSuggestions > 0 && (
          <Badge 
            variant="secondary" 
            className="ml-1 h-4 min-w-4 px-1 text-[10px] bg-primary text-primary-foreground"
          >
            {totalSuggestions}
          </Badge>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md max-h-[85vh] p-0 gap-0">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ShoppingBasket className="h-5 w-5 text-primary" />
              Smart Basket
            </DialogTitle>
            <DialogDescription className="text-sm">
              {suggestions?.summary.retailerOrderHistory 
                ? `Based on ${suggestions.summary.retailerOrderHistory} previous orders`
                : 'AI-powered order suggestions'}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">Analyzing order patterns...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <AlertCircle className="h-8 w-8 text-destructive mb-3" />
              <p className="text-sm text-destructive text-center">{error}</p>
              <Button variant="outline" size="sm" onClick={fetchSuggestions} className="mt-4">
                Try Again
              </Button>
            </div>
          ) : suggestions ? (
            <>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
                <TabsList className="w-full grid grid-cols-3 h-9 mx-4" style={{ width: 'calc(100% - 2rem)' }}>
                  <TabsTrigger value="repeat" className="text-xs gap-1">
                    <RotateCcw size={12} />
                    Repeat
                    {suggestions.repeatOrder.length > 0 && (
                      <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px]">
                        {suggestions.repeatOrder.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="trending" className="text-xs gap-1">
                    <TrendingUp size={12} />
                    Trending
                    {suggestions.beatTrending.length > 0 && (
                      <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px]">
                        {suggestions.beatTrending.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="upsell" className="text-xs gap-1">
                    <ArrowUpCircle size={12} />
                    Upgrade
                    {suggestions.upsell.length > 0 && (
                      <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[10px]">
                        {suggestions.upsell.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <ScrollArea className="h-[350px] px-4">
                  {/* Repeat Orders Tab */}
                  <TabsContent value="repeat" className="mt-2 space-y-2">
                    {suggestions.repeatOrder.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <RotateCcw className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No repeat order patterns found</p>
                        <p className="text-xs">Order history will build over time</p>
                      </div>
                    ) : (
                      suggestions.repeatOrder.map((item) => {
                        const key = getItemKey(item.productId, item.variantId);
                        const conf = getConfidenceLabel(item.confidence);
                        const qty = getQuantity(item.productId, item.variantId, item.quantity);
                        
                        return (
                          <Card 
                            key={key}
                            className={cn(
                              "cursor-pointer transition-all",
                              isSelected(item.productId, item.variantId) && "ring-2 ring-primary bg-primary/5"
                            )}
                            onClick={() => toggleItem({
                              productId: item.productId,
                              productName: item.variantName || item.productName,
                              variantId: item.variantId,
                              variantName: item.variantName,
                              quantity: qty,
                              unit: item.unit,
                              type: 'repeat'
                            })}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start gap-2">
                                <Checkbox 
                                  checked={isSelected(item.productId, item.variantId)}
                                  className="mt-0.5 pointer-events-none"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-sm truncate">
                                      {item.variantName || item.productName}
                                    </span>
                                    <span className={cn("h-1.5 w-1.5 rounded-full", conf.color)} />
                                  </div>
                                  <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                                    <Badge variant="outline" className="text-[10px] h-4">
                                      Ordered {item.orderCount}x
                                    </Badge>
                                    <Badge variant="outline" className="text-[10px] h-4">
                                      {formatDaysAgo(item.lastOrdered)}
                                    </Badge>
                                    {item.rate > 0 && (
                                      <Badge variant="secondary" className="text-[10px] h-4 bg-green-100 text-green-700">
                                        ₹{item.rate.toFixed(2)}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  <Input
                                    type="number"
                                    value={qty}
                                    onChange={(e) => updateQuantity(item.productId, item.variantId, parseInt(e.target.value) || 1)}
                                    className="w-14 h-7 text-xs text-center"
                                    min={1}
                                  />
                                  <span className="text-xs text-muted-foreground w-8">{item.unit}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </TabsContent>

                  {/* Beat Trending Tab */}
                  <TabsContent value="trending" className="mt-2 space-y-2">
                    {suggestions.beatTrending.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No trending products found</p>
                        <p className="text-xs">This retailer may already order popular items</p>
                      </div>
                    ) : (
                      suggestions.beatTrending.map((item) => {
                        const key = getItemKey(item.productId, item.variantId);
                        const qty = getQuantity(item.productId, item.variantId, item.suggestedQuantity);
                        
                        return (
                          <Card 
                            key={key}
                            className={cn(
                              "cursor-pointer transition-all",
                              isSelected(item.productId, item.variantId) && "ring-2 ring-primary bg-primary/5"
                            )}
                            onClick={() => toggleItem({
                              productId: item.productId,
                              productName: item.variantName || item.productName,
                              variantId: item.variantId,
                              variantName: item.variantName,
                              quantity: qty,
                              unit: item.unit,
                              type: 'trending'
                            })}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start gap-2">
                                <Checkbox 
                                  checked={isSelected(item.productId, item.variantId)}
                                  className="mt-0.5 pointer-events-none"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm truncate mb-1">
                                    {item.variantName || item.productName}
                                  </div>
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <Badge className="text-[10px] h-4 bg-blue-500">
                                      {item.beatPenetration}% of beat
                                    </Badge>
                                    <span className="text-[10px] text-muted-foreground">
                                      ({item.retailerCount}/{item.totalBeatRetailers} retailers)
                                    </span>
                                    {item.rate > 0 && (
                                      <Badge variant="secondary" className="text-[10px] h-4 bg-green-100 text-green-700">
                                        ₹{item.rate.toFixed(2)}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  <Input
                                    type="number"
                                    value={qty}
                                    onChange={(e) => updateQuantity(item.productId, item.variantId, parseInt(e.target.value) || 1)}
                                    className="w-14 h-7 text-xs text-center"
                                    min={1}
                                  />
                                  <span className="text-xs text-muted-foreground w-8">{item.unit}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </TabsContent>

                  {/* Upsell Tab */}
                  <TabsContent value="upsell" className="mt-2 space-y-2">
                    {suggestions.upsell.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <ArrowUpCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No upgrade opportunities</p>
                        <p className="text-xs">Retailer may already be ordering optimal pack sizes</p>
                      </div>
                    ) : (
                      suggestions.upsell.map((item, idx) => {
                        const key = getItemKey(item.suggestedProductId, item.suggestedVariantId);
                        
                        return (
                          <Card 
                            key={key + idx}
                            className={cn(
                              "cursor-pointer transition-all",
                              isSelected(item.suggestedProductId, item.suggestedVariantId) && "ring-2 ring-primary bg-primary/5"
                            )}
                            onClick={() => toggleItem({
                              productId: item.suggestedProductId,
                              productName: item.suggestedVariantName || item.suggestedProductName,
                              variantId: item.suggestedVariantId,
                              variantName: item.suggestedVariantName,
                              quantity: 1,
                              unit: 'KG',
                              type: 'upsell'
                            })}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-start gap-2">
                                <Checkbox 
                                  checked={isSelected(item.suggestedProductId, item.suggestedVariantId)}
                                  className="mt-0.5 pointer-events-none"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm mb-1">
                                    {item.suggestedProductName}
                                  </div>
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="text-muted-foreground line-through">
                                      {item.currentSize}
                                    </span>
                                    <span className="text-primary font-medium">
                                      → {item.suggestedSize}
                                    </span>
                                  </div>
                                  <Badge className="text-[10px] h-4 bg-green-500 mt-1">
                                    Save {item.savingsPercent}% per unit
                                  </Badge>
                                </div>
                                <ArrowUpCircle className="h-5 w-5 text-green-500 shrink-0" />
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </TabsContent>
                </ScrollArea>
              </Tabs>

              {/* Action buttons */}
              <div className="flex gap-2 p-4 border-t bg-muted/30">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddAll}
                  className="flex-1 text-xs"
                  disabled={
                    (activeTab === 'repeat' && suggestions.repeatOrder.length === 0) ||
                    (activeTab === 'trending' && suggestions.beatTrending.length === 0) ||
                    (activeTab === 'upsell' && suggestions.upsell.length === 0)
                  }
                >
                  Select All in Tab
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddSelected}
                  className="flex-1 text-xs"
                  disabled={selectedItems.size === 0}
                >
                  <Check size={14} className="mr-1" />
                  Add {selectedItems.size} Item{selectedItems.size !== 1 ? 's' : ''}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
};
