import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Gift, Edit, Trash2, Eye, Star, Plane, Banknote, Ticket, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const REWARD_TYPES = [
  { value: "gift", label: "Gift Item", icon: Gift, description: "Physical product like mobile, TV" },
  { value: "holiday", label: "Holiday/Trip", icon: Plane, description: "Travel package or vacation" },
  { value: "cash_conversion", label: "Cash Conversion", icon: Banknote, description: "Convert points to money" },
  { value: "voucher", label: "Voucher/Coupon", icon: Ticket, description: "Shopping vouchers" },
];

interface Reward {
  id: string;
  program_id: string;
  reward_type: string;
  reward_name: string;
  description: string | null;
  points_required: number;
  cash_value: number | null;
  image_url: string | null;
  stock_quantity: number;
  is_active: boolean;
  created_at: string;
}

export function RewardsManagement() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<string>("");
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [viewingReward, setViewingReward] = useState<Reward | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedRewardType, setSelectedRewardType] = useState<string>("");
  const queryClient = useQueryClient();

  const { data: programs } = useQuery({
    queryKey: ["retailer-loyalty-programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retailer_loyalty_programs")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: rewards, isLoading } = useQuery({
    queryKey: ["retailer-loyalty-rewards", selectedProgram],
    queryFn: async () => {
      if (!selectedProgram) return [];
      const { data, error } = await supabase
        .from("retailer_loyalty_rewards")
        .select("*")
        .eq("program_id", selectedProgram)
        .order("points_required", { ascending: true });
      if (error) throw error;
      return data as Reward[];
    },
    enabled: !!selectedProgram,
  });

  const { data: retailerPoints } = useQuery({
    queryKey: ["retailer-points-summary", selectedProgram],
    queryFn: async () => {
      if (!selectedProgram) return [];
      const { data, error } = await supabase
        .from("retailer_loyalty_points")
        .select(`
          retailer_id,
          points,
          retailers!inner(name)
        `)
        .eq("program_id", selectedProgram);
      if (error) throw error;
      
      // Aggregate points per retailer
      const aggregated = data?.reduce((acc: Record<string, { name: string; total: number }>, row: any) => {
        const retailerId = row.retailer_id;
        if (!acc[retailerId]) {
          acc[retailerId] = { name: row.retailers?.name || 'Unknown', total: 0 };
        }
        acc[retailerId].total += row.points || 0;
        return acc;
      }, {});
      
      return Object.entries(aggregated || {}).map(([id, data]) => ({
        retailer_id: id,
        retailer_name: data.name,
        total_points: data.total,
      })).sort((a, b) => b.total_points - a.total_points);
    },
    enabled: !!selectedProgram,
  });

  const createMutation = useMutation({
    mutationFn: async (reward: Omit<Reward, 'id' | 'created_at'>) => {
      const { error } = await supabase.from("retailer_loyalty_rewards").insert([reward]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-loyalty-rewards"] });
      toast.success("Reward created successfully");
      setIsCreateOpen(false);
      setSelectedRewardType("");
    },
    onError: () => toast.error("Failed to create reward"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Reward> }) => {
      const { error } = await supabase
        .from("retailer_loyalty_rewards")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-loyalty-rewards"] });
      toast.success("Reward updated successfully");
      setIsEditOpen(false);
      setEditingReward(null);
    },
    onError: () => toast.error("Failed to update reward"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("retailer_loyalty_rewards")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-loyalty-rewards"] });
      toast.success("Reward deleted successfully");
      setDeleteId(null);
    },
    onError: () => toast.error("Failed to delete reward"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("retailer_loyalty_rewards")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-loyalty-rewards"] });
      toast.success("Reward updated");
    },
  });

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const reward = {
      program_id: selectedProgram,
      reward_type: formData.get("reward_type") as string,
      reward_name: formData.get("reward_name") as string,
      description: formData.get("description") as string,
      points_required: Number(formData.get("points_required")),
      cash_value: formData.get("cash_value") ? Number(formData.get("cash_value")) : null,
      stock_quantity: Number(formData.get("stock_quantity") || 0),
      image_url: formData.get("image_url") as string || null,
      is_active: true,
    };
    createMutation.mutate(reward);
  };

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingReward) return;
    const formData = new FormData(e.currentTarget);
    const updates = {
      reward_type: formData.get("reward_type") as string,
      reward_name: formData.get("reward_name") as string,
      description: formData.get("description") as string,
      points_required: Number(formData.get("points_required")),
      cash_value: formData.get("cash_value") ? Number(formData.get("cash_value")) : null,
      stock_quantity: Number(formData.get("stock_quantity") || 0),
      image_url: formData.get("image_url") as string || null,
    };
    updateMutation.mutate({ id: editingReward.id, updates });
  };

  const getRewardTypeIcon = (type: string) => {
    const rewardType = REWARD_TYPES.find(t => t.value === type);
    const IconComponent = rewardType?.icon || Gift;
    return <IconComponent className="h-5 w-5" />;
  };

  const selectedProgramData = programs?.find(p => p.id === selectedProgram);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold">Rewards & Goodies</h2>
          <p className="text-sm text-muted-foreground">
            Configure rewards that retailers can redeem with their points
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Select value={selectedProgram} onValueChange={setSelectedProgram}>
            <SelectTrigger className="w-full sm:w-[250px]">
              <SelectValue placeholder="Select a program" />
            </SelectTrigger>
            <SelectContent>
              {programs?.map((program) => (
                <SelectItem key={program.id} value={program.id}>
                  {program.program_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button disabled={!selectedProgram}>
                <Plus className="h-4 w-4 mr-2" />
                Add Reward
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Reward</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="reward_type">Reward Type</Label>
                  <Select 
                    name="reward_type" 
                    required 
                    value={selectedRewardType}
                    onValueChange={setSelectedRewardType}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select reward type" />
                    </SelectTrigger>
                    <SelectContent>
                      {REWARD_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <type.icon className="h-4 w-4" />
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedRewardType && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {REWARD_TYPES.find(t => t.value === selectedRewardType)?.description}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="reward_name">Reward Name</Label>
                  <Input
                    id="reward_name"
                    name="reward_name"
                    placeholder="e.g., Samsung Galaxy S24, Goa Trip"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Describe the reward..."
                    rows={2}
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
                      min="1"
                      required
                    />
                  </div>
                  {selectedRewardType === "cash_conversion" && (
                    <div>
                      <Label htmlFor="cash_value">Cash Value (₹)</Label>
                      <Input
                        type="number"
                        id="cash_value"
                        name="cash_value"
                        placeholder="e.g., 1000"
                        min="1"
                      />
                    </div>
                  )}
                  {(selectedRewardType === "gift" || selectedRewardType === "voucher") && (
                    <div>
                      <Label htmlFor="stock_quantity">Stock Quantity</Label>
                      <Input
                        type="number"
                        id="stock_quantity"
                        name="stock_quantity"
                        placeholder="e.g., 10"
                        min="0"
                        defaultValue="0"
                      />
                    </div>
                  )}
                </div>
                <div>
                  <Label htmlFor="image_url">Image URL (optional)</Label>
                  <Input
                    id="image_url"
                    name="image_url"
                    placeholder="https://..."
                  />
                </div>
                <Button type="submit" className="w-full">
                  Create Reward
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!selectedProgram ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Gift className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Select a program to view rewards</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div>Loading rewards...</div>
      ) : (
        <>
          {/* Rewards Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rewards?.map((reward) => (
              <Card key={reward.id} className="relative">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      {getRewardTypeIcon(reward.reward_type)}
                      <span className="truncate">{reward.reward_name}</span>
                    </CardTitle>
                    <Switch
                      checked={reward.is_active}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: reward.id, is_active: checked })
                      }
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {reward.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{reward.description}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    <span className="font-semibold">{reward.points_required.toLocaleString()} Points</span>
                  </div>
                  {reward.cash_value && (
                    <div className="flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-green-600" />
                      <span>₹{reward.cash_value.toLocaleString()}</span>
                    </div>
                  )}
                  {(reward.reward_type === 'gift' || reward.reward_type === 'voucher') && (
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Stock: {reward.stock_quantity}</span>
                    </div>
                  )}
                  <Badge variant="secondary">
                    {REWARD_TYPES.find(t => t.value === reward.reward_type)?.label}
                  </Badge>
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setViewingReward(reward);
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
                        setEditingReward(reward);
                        setIsEditOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteId(reward.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {rewards?.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No rewards yet. Add your first one!</p>
              </CardContent>
            </Card>
          )}

          {/* Retailer Points Summary */}
          {retailerPoints && retailerPoints.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  Retailer Points Accumulated
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {retailerPoints.slice(0, 10).map((rp: any, idx: number) => {
                    const maxPoints = Math.max(...(rewards?.map(r => r.points_required) || [1]));
                    const progress = Math.min((rp.total_points / maxPoints) * 100, 100);
                    return (
                      <div key={rp.retailer_id} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">
                            {idx + 1}. {rp.retailer_name}
                          </span>
                          <span className="text-muted-foreground">
                            {rp.total_points.toLocaleString()} pts
                          </span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    );
                  })}
                </div>
                {retailerPoints.length > 10 && (
                  <p className="text-sm text-muted-foreground mt-3 text-center">
                    +{retailerPoints.length - 10} more retailers
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Reward</DialogTitle>
          </DialogHeader>
          {editingReward && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <Label htmlFor="edit_reward_type">Reward Type</Label>
                <Select name="reward_type" defaultValue={editingReward.reward_type} required>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REWARD_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit_reward_name">Reward Name</Label>
                <Input
                  id="edit_reward_name"
                  name="reward_name"
                  defaultValue={editingReward.reward_name}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit_description">Description</Label>
                <Textarea
                  id="edit_description"
                  name="description"
                  defaultValue={editingReward.description || ""}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit_points_required">Points Required</Label>
                  <Input
                    type="number"
                    id="edit_points_required"
                    name="points_required"
                    defaultValue={editingReward.points_required}
                    min="1"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit_cash_value">Cash Value (₹)</Label>
                  <Input
                    type="number"
                    id="edit_cash_value"
                    name="cash_value"
                    defaultValue={editingReward.cash_value || ""}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit_stock_quantity">Stock Quantity</Label>
                <Input
                  type="number"
                  id="edit_stock_quantity"
                  name="stock_quantity"
                  defaultValue={editingReward.stock_quantity}
                  min="0"
                />
              </div>
              <div>
                <Label htmlFor="edit_image_url">Image URL</Label>
                <Input
                  id="edit_image_url"
                  name="image_url"
                  defaultValue={editingReward.image_url || ""}
                />
              </div>
              <Button type="submit" className="w-full">
                Update Reward
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reward Details</DialogTitle>
          </DialogHeader>
          {viewingReward && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {getRewardTypeIcon(viewingReward.reward_type)}
                <div>
                  <h3 className="font-semibold">{viewingReward.reward_name}</h3>
                  <Badge variant="secondary">
                    {REWARD_TYPES.find(t => t.value === viewingReward.reward_type)?.label}
                  </Badge>
                </div>
              </div>
              {viewingReward.description && (
                <div>
                  <Label>Description</Label>
                  <p className="text-sm mt-1">{viewingReward.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Points Required</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    <span className="font-semibold">{viewingReward.points_required.toLocaleString()}</span>
                  </div>
                </div>
                {viewingReward.cash_value && (
                  <div>
                    <Label>Cash Value</Label>
                    <p className="text-sm mt-1 font-semibold">₹{viewingReward.cash_value.toLocaleString()}</p>
                  </div>
                )}
              </div>
              {(viewingReward.reward_type === 'gift' || viewingReward.reward_type === 'voucher') && (
                <div>
                  <Label>Stock Quantity</Label>
                  <p className="text-sm mt-1">{viewingReward.stock_quantity} units</p>
                </div>
              )}
              <div>
                <Label>Status</Label>
                <Badge variant={viewingReward.is_active ? "default" : "secondary"} className="mt-1">
                  {viewingReward.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this reward. Existing redemptions will remain but the reward
              will no longer be available for new claims. This action cannot be undone.
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
