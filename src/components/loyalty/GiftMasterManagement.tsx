import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Gift, Edit, Trash2, Star, Package, Eye, Award, IndianRupee } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const GIFT_TYPES = [
  { value: "physical", label: "Physical Gift", icon: "🎁", description: "Tangible items like electronics, appliances" },
  { value: "voucher", label: "Voucher/Coupon", icon: "🎟️", description: "Shopping vouchers, discount coupons" },
  { value: "experience", label: "Experience", icon: "✨", description: "Travel, events, dining experiences" },
  { value: "cash", label: "Cash/Credit", icon: "💵", description: "Cash reward or credit note" },
  { value: "product", label: "Company Product", icon: "📦", description: "Free products from catalog" },
];

interface LoyaltyGift {
  id: string;
  plan_id: string | null;
  gift_name: string;
  description: string | null;
  gift_type: string;
  points_required: number;
  cash_equivalent: number | null;
  image_url: string | null;
  stock_quantity: number;
  is_limited_stock: boolean;
  target_description: string | null;
  target_duration_months: number | null;
  minimum_monthly_orders: number | null;
  minimum_order_value: number | null;
  is_active: boolean;
  sort_order: number;
}

export function GiftMasterManagement() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [editingGift, setEditingGift] = useState<LoyaltyGift | null>(null);
  const [viewingGift, setViewingGift] = useState<LoyaltyGift | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: gifts, isLoading } = useQuery({
    queryKey: ["retailer-loyalty-gifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retailer_loyalty_gifts")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as LoyaltyGift[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (gift: Partial<LoyaltyGift>) => {
      const { error } = await supabase.from("retailer_loyalty_gifts").insert([gift] as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-loyalty-gifts"] });
      toast.success("Gift created successfully");
      setIsCreateOpen(false);
    },
    onError: () => toast.error("Failed to create gift"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<LoyaltyGift> }) => {
      const { error } = await supabase
        .from("retailer_loyalty_gifts")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-loyalty-gifts"] });
      toast.success("Gift updated successfully");
      setIsEditOpen(false);
      setEditingGift(null);
    },
    onError: () => toast.error("Failed to update gift"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("retailer_loyalty_gifts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-loyalty-gifts"] });
      toast.success("Gift deleted successfully");
      setDeleteId(null);
    },
    onError: () => toast.error("Failed to delete gift"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("retailer_loyalty_gifts")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-loyalty-gifts"] });
      toast.success("Gift status updated");
    },
  });

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const gift: Partial<LoyaltyGift> = {
      gift_name: formData.get("gift_name") as string,
      description: formData.get("description") as string,
      gift_type: formData.get("gift_type") as string,
      points_required: Number(formData.get("points_required")),
      cash_equivalent: formData.get("cash_equivalent") ? Number(formData.get("cash_equivalent")) : null,
      image_url: formData.get("image_url") as string || null,
      stock_quantity: Number(formData.get("stock_quantity") || 0),
      is_limited_stock: formData.get("is_limited_stock") === "on",
      target_description: formData.get("target_description") as string || null,
      target_duration_months: formData.get("target_duration_months") ? Number(formData.get("target_duration_months")) : null,
      minimum_monthly_orders: formData.get("minimum_monthly_orders") ? Number(formData.get("minimum_monthly_orders")) : null,
      minimum_order_value: formData.get("minimum_order_value") ? Number(formData.get("minimum_order_value")) : null,
      is_active: true,
      sort_order: gifts?.length || 0,
    };

    createMutation.mutate(gift);
  };

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingGift) return;
    const formData = new FormData(e.currentTarget);
    
    const updates: Partial<LoyaltyGift> = {
      gift_name: formData.get("gift_name") as string,
      description: formData.get("description") as string,
      gift_type: formData.get("gift_type") as string,
      points_required: Number(formData.get("points_required")),
      cash_equivalent: formData.get("cash_equivalent") ? Number(formData.get("cash_equivalent")) : null,
      image_url: formData.get("image_url") as string || null,
      stock_quantity: Number(formData.get("stock_quantity") || 0),
      is_limited_stock: formData.get("is_limited_stock") === "on",
      target_description: formData.get("target_description") as string || null,
      target_duration_months: formData.get("target_duration_months") ? Number(formData.get("target_duration_months")) : null,
      minimum_monthly_orders: formData.get("minimum_monthly_orders") ? Number(formData.get("minimum_monthly_orders")) : null,
      minimum_order_value: formData.get("minimum_order_value") ? Number(formData.get("minimum_order_value")) : null,
    };

    updateMutation.mutate({ id: editingGift.id, updates });
  };

  const getGiftTypeInfo = (type: string) => GIFT_TYPES.find((t) => t.value === type);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold">Gift Catalog</h2>
          <p className="text-sm text-muted-foreground">
            Manage rewards that retailers can redeem with their points
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Gift
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Gift</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="gift_name">Gift Name</Label>
                    <Input
                      id="gift_name"
                      name="gift_name"
                      placeholder="e.g., Samsung Galaxy S24"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="gift_type">Gift Type</Label>
                    <Select name="gift_type" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {GIFT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <span className="flex items-center gap-2">
                              <span>{type.icon}</span>
                              <span>{type.label}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Describe the gift and its benefits"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="points_required">Points Required</Label>
                    <Input
                      type="number"
                      id="points_required"
                      name="points_required"
                      placeholder="e.g., 10000"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="cash_equivalent">Cash Value (₹)</Label>
                    <Input
                      type="number"
                      id="cash_equivalent"
                      name="cash_equivalent"
                      placeholder="e.g., 5000"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="image_url">Image URL</Label>
                  <Input
                    id="image_url"
                    name="image_url"
                    placeholder="https://..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="stock_quantity">Stock Quantity</Label>
                    <Input
                      type="number"
                      id="stock_quantity"
                      name="stock_quantity"
                      defaultValue="0"
                    />
                  </div>
                  <div className="flex items-center space-x-2 pt-6">
                    <Switch id="is_limited_stock" name="is_limited_stock" />
                    <Label htmlFor="is_limited_stock">Limited Stock</Label>
                  </div>
                </div>

                <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium">Eligibility Criteria (Optional)</h4>
                  <div>
                    <Label htmlFor="target_description">Target Description</Label>
                    <Input
                      id="target_description"
                      name="target_description"
                      placeholder="e.g., Achieve 50,000 points in 6 months"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="target_duration_months">Duration (Months)</Label>
                      <Input
                        type="number"
                        id="target_duration_months"
                        name="target_duration_months"
                        placeholder="e.g., 6"
                      />
                    </div>
                    <div>
                      <Label htmlFor="minimum_monthly_orders">Min Orders/Month</Label>
                      <Input
                        type="number"
                        id="minimum_monthly_orders"
                        name="minimum_monthly_orders"
                        placeholder="e.g., 4"
                      />
                    </div>
                    <div>
                      <Label htmlFor="minimum_order_value">Min Order Value (₹)</Label>
                      <Input
                        type="number"
                        id="minimum_order_value"
                        name="minimum_order_value"
                        placeholder="e.g., 5000"
                      />
                    </div>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Gift"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-8">Loading gifts...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {gifts?.map((gift) => {
            const typeInfo = getGiftTypeInfo(gift.gift_type);
            return (
              <Card key={gift.id} className={gift.is_active ? "" : "opacity-60"}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{typeInfo?.icon}</span>
                      <div>
                        <CardTitle className="text-base">{gift.gift_name}</CardTitle>
                        <CardDescription className="text-xs">{typeInfo?.label}</CardDescription>
                      </div>
                    </div>
                    <Switch
                      checked={gift.is_active}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: gift.id, is_active: checked })
                      }
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {gift.description || "No description"}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-primary font-semibold">
                      <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                      <span>{gift.points_required.toLocaleString()} pts</span>
                    </div>
                    {gift.cash_equivalent && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <IndianRupee className="h-3 w-3" />
                        <span>{gift.cash_equivalent.toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {gift.is_limited_stock && (
                      <Badge variant="outline" className="text-xs">
                        <Package className="h-3 w-3 mr-1" />
                        {gift.stock_quantity} left
                      </Badge>
                    )}
                    {gift.target_duration_months && (
                      <Badge variant="secondary" className="text-xs">
                        {gift.target_duration_months} month goal
                      </Badge>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setViewingGift(gift);
                        setIsViewOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setEditingGift(gift);
                        setIsEditOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteId(gift.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {(!gifts || gifts.length === 0) && (
        <Card>
          <CardContent className="py-12 text-center">
            <Gift className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No gifts yet. Add your first reward!</p>
          </CardContent>
        </Card>
      )}

      {/* View Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gift Details</DialogTitle>
          </DialogHeader>
          {viewingGift && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{getGiftTypeInfo(viewingGift.gift_type)?.icon}</span>
                <div>
                  <h3 className="text-xl font-semibold">{viewingGift.gift_name}</h3>
                  <p className="text-muted-foreground">{getGiftTypeInfo(viewingGift.gift_type)?.label}</p>
                </div>
              </div>

              <p>{viewingGift.description || "No description"}</p>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted rounded-lg">
                  <Label className="text-muted-foreground">Points Required</Label>
                  <p className="text-2xl font-bold text-primary">{viewingGift.points_required.toLocaleString()}</p>
                </div>
                {viewingGift.cash_equivalent && (
                  <div className="p-3 bg-muted rounded-lg">
                    <Label className="text-muted-foreground">Cash Value</Label>
                    <p className="text-2xl font-bold">₹{viewingGift.cash_equivalent.toLocaleString()}</p>
                  </div>
                )}
              </div>

              {viewingGift.is_limited_stock && (
                <div>
                  <Label className="text-muted-foreground">Stock</Label>
                  <p>{viewingGift.stock_quantity} units available</p>
                </div>
              )}

              {viewingGift.target_description && (
                <div className="p-4 bg-primary/5 rounded-lg">
                  <Label className="text-muted-foreground">Goal to Achieve</Label>
                  <p className="font-medium">{viewingGift.target_description}</p>
                  <div className="flex gap-4 mt-2 text-sm">
                    {viewingGift.target_duration_months && (
                      <span>Duration: {viewingGift.target_duration_months} months</span>
                    )}
                    {viewingGift.minimum_monthly_orders && (
                      <span>Min Orders/Month: {viewingGift.minimum_monthly_orders}</span>
                    )}
                    {viewingGift.minimum_order_value && (
                      <span>Min Order: ₹{viewingGift.minimum_order_value}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Gift</DialogTitle>
          </DialogHeader>
          {editingGift && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="edit_gift_name">Gift Name</Label>
                  <Input
                    id="edit_gift_name"
                    name="gift_name"
                    defaultValue={editingGift.gift_name}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit_gift_type">Gift Type</Label>
                  <Select name="gift_type" defaultValue={editingGift.gift_type} required>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GIFT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <span className="flex items-center gap-2">
                            <span>{type.icon}</span>
                            <span>{type.label}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="edit_description">Description</Label>
                <Textarea
                  id="edit_description"
                  name="description"
                  defaultValue={editingGift.description || ""}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit_points_required">Points Required</Label>
                  <Input
                    type="number"
                    id="edit_points_required"
                    name="points_required"
                    defaultValue={editingGift.points_required}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit_cash_equivalent">Cash Value (₹)</Label>
                  <Input
                    type="number"
                    id="edit_cash_equivalent"
                    name="cash_equivalent"
                    defaultValue={editingGift.cash_equivalent || ""}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit_image_url">Image URL</Label>
                <Input
                  id="edit_image_url"
                  name="image_url"
                  defaultValue={editingGift.image_url || ""}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit_stock_quantity">Stock Quantity</Label>
                  <Input
                    type="number"
                    id="edit_stock_quantity"
                    name="stock_quantity"
                    defaultValue={editingGift.stock_quantity}
                  />
                </div>
                <div className="flex items-center space-x-2 pt-6">
                  <Switch 
                    id="edit_is_limited_stock" 
                    name="is_limited_stock" 
                    defaultChecked={editingGift.is_limited_stock}
                  />
                  <Label htmlFor="edit_is_limited_stock">Limited Stock</Label>
                </div>
              </div>

              <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium">Eligibility Criteria</h4>
                <div>
                  <Label htmlFor="edit_target_description">Target Description</Label>
                  <Input
                    id="edit_target_description"
                    name="target_description"
                    defaultValue={editingGift.target_description || ""}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="edit_target_duration_months">Duration (Months)</Label>
                    <Input
                      type="number"
                      id="edit_target_duration_months"
                      name="target_duration_months"
                      defaultValue={editingGift.target_duration_months || ""}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_minimum_monthly_orders">Min Orders/Month</Label>
                    <Input
                      type="number"
                      id="edit_minimum_monthly_orders"
                      name="minimum_monthly_orders"
                      defaultValue={editingGift.minimum_monthly_orders || ""}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_minimum_order_value">Min Order Value (₹)</Label>
                    <Input
                      type="number"
                      id="edit_minimum_order_value"
                      name="minimum_order_value"
                      defaultValue={editingGift.minimum_order_value || ""}
                    />
                  </div>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Updating..." : "Update Gift"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Gift?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this gift from the catalog. Any pending redemptions for this gift will need to be handled manually.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
