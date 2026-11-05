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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Edit, TrendingUp, Calendar, Trash2, Eye, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface LoyaltyPlan {
  id: string;
  plan_name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  points_to_rupee_conversion: number;
  is_all_territories: boolean;
  is_active: boolean;
  created_at: string;
}

export function LoyaltyPlanManagement() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState<LoyaltyPlan | null>(null);
  const [viewingPlan, setViewingPlan] = useState<LoyaltyPlan | null>(null);
  const queryClient = useQueryClient();

  const { data: plans, isLoading } = useQuery({
    queryKey: ["retailer-loyalty-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retailer_loyalty_plans")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LoyaltyPlan[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (plan: Partial<LoyaltyPlan>) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("retailer_loyalty_plans").insert([{
        plan_name: plan.plan_name,
        description: plan.description,
        start_date: plan.start_date,
        end_date: plan.end_date,
        points_to_rupee_conversion: plan.points_to_rupee_conversion,
        is_all_territories: plan.is_all_territories,
        is_active: plan.is_active,
        created_by: userData?.user?.id,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-loyalty-plans"] });
      toast.success("Plan created successfully");
      setIsCreateOpen(false);
    },
    onError: () => toast.error("Failed to create plan"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<LoyaltyPlan> }) => {
      const { error } = await supabase
        .from("retailer_loyalty_plans")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-loyalty-plans"] });
      toast.success("Plan updated successfully");
      setIsEditOpen(false);
      setEditingPlan(null);
    },
    onError: () => toast.error("Failed to update plan"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("retailer_loyalty_plans")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-loyalty-plans"] });
      toast.success("Plan deleted successfully");
      setDeleteId(null);
    },
    onError: () => toast.error("Failed to delete plan"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("retailer_loyalty_plans")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-loyalty-plans"] });
      toast.success("Plan status updated");
    },
  });

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const plan = {
      plan_name: formData.get("plan_name") as string,
      description: formData.get("description") as string,
      start_date: formData.get("start_date") as string,
      end_date: formData.get("end_date") as string,
      points_to_rupee_conversion: Number(formData.get("conversion")),
      is_all_territories: formData.get("all_territories") === "on",
      is_active: formData.get("is_active") === "on",
    };
    createMutation.mutate(plan);
  };

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingPlan) return;
    const formData = new FormData(e.currentTarget);
    const updates = {
      plan_name: formData.get("plan_name") as string,
      description: formData.get("description") as string,
      start_date: formData.get("start_date") as string,
      end_date: formData.get("end_date") as string,
      points_to_rupee_conversion: Number(formData.get("conversion")),
      is_all_territories: formData.get("all_territories") === "on",
      is_active: formData.get("is_active") === "on",
    };
    updateMutation.mutate({ id: editingPlan.id, updates });
  };

  const isPlanActive = (plan: LoyaltyPlan) => {
    const today = new Date();
    const start = new Date(plan.start_date);
    const end = new Date(plan.end_date);
    return plan.is_active && today >= start && today <= end;
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading plans...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Loyalty Plans</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage retailer loyalty plans with earning parameters
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Loyalty Plan</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <Label htmlFor="plan_name">Plan Name</Label>
                <Input
                  id="plan_name"
                  name="plan_name"
                  placeholder="e.g., Annual Rewards 2025"
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Plan description and benefits"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input type="date" id="start_date" name="start_date" required />
                </div>
                <div>
                  <Label htmlFor="end_date">End Date</Label>
                  <Input type="date" id="end_date" name="end_date" required />
                </div>
              </div>
              <div>
                <Label htmlFor="conversion">Points to Rupee Conversion</Label>
                <Input
                  type="number"
                  id="conversion"
                  name="conversion"
                  placeholder="e.g., 10 (10 points = ₹1)"
                  defaultValue="10"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Number of points equal to ₹1 value
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="all_territories" name="all_territories" defaultChecked />
                <Label htmlFor="all_territories">Apply to all territories</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="is_active" name="is_active" defaultChecked />
                <Label htmlFor="is_active">Active</Label>
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Plan"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {plans?.map((plan) => (
          <Card key={plan.id} className={isPlanActive(plan) ? "border-primary/50" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{plan.plan_name}</CardTitle>
                </div>
                <Switch
                  checked={plan.is_active}
                  onCheckedChange={(checked) =>
                    toggleActiveMutation.mutate({ id: plan.id, is_active: checked })
                  }
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground line-clamp-2">
                {plan.description || "No description"}
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {format(new Date(plan.start_date), "dd MMM yyyy")} -{" "}
                    {format(new Date(plan.end_date), "dd MMM yyyy")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span>{plan.points_to_rupee_conversion} points = ₹1</span>
                </div>
              </div>
              <div className="flex gap-2">
                {isPlanActive(plan) ? (
                  <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
                    Active Now
                  </Badge>
                ) : plan.is_active ? (
                  <Badge variant="secondary">Scheduled</Badge>
                ) : (
                  <Badge variant="outline">Inactive</Badge>
                )}
                {plan.is_all_territories && (
                  <Badge variant="outline">All Territories</Badge>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setViewingPlan(plan);
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
                    setEditingPlan(plan);
                    setIsEditOpen(true);
                  }}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteId(plan.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(!plans || plans.length === 0) && (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No plans yet. Create your first loyalty plan!</p>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Loyalty Plan</DialogTitle>
          </DialogHeader>
          {editingPlan && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <Label htmlFor="edit_plan_name">Plan Name</Label>
                <Input
                  id="edit_plan_name"
                  name="plan_name"
                  defaultValue={editingPlan.plan_name}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit_description">Description</Label>
                <Textarea
                  id="edit_description"
                  name="description"
                  defaultValue={editingPlan.description || ""}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit_start_date">Start Date</Label>
                  <Input
                    type="date"
                    id="edit_start_date"
                    name="start_date"
                    defaultValue={editingPlan.start_date}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit_end_date">End Date</Label>
                  <Input
                    type="date"
                    id="edit_end_date"
                    name="end_date"
                    defaultValue={editingPlan.end_date}
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit_conversion">Points to Rupee Conversion</Label>
                <Input
                  type="number"
                  id="edit_conversion"
                  name="conversion"
                  defaultValue={editingPlan.points_to_rupee_conversion}
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit_all_territories"
                  name="all_territories"
                  defaultChecked={editingPlan.is_all_territories}
                />
                <Label htmlFor="edit_all_territories">Apply to all territories</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit_is_active"
                  name="is_active"
                  defaultChecked={editingPlan.is_active}
                />
                <Label htmlFor="edit_is_active">Active</Label>
              </div>
              <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Updating..." : "Update Plan"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Plan Details</DialogTitle>
          </DialogHeader>
          {viewingPlan && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Plan Name</Label>
                <p className="font-medium">{viewingPlan.plan_name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Description</Label>
                <p>{viewingPlan.description || "No description"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Start Date</Label>
                  <p>{format(new Date(viewingPlan.start_date), "dd MMM yyyy")}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">End Date</Label>
                  <p>{format(new Date(viewingPlan.end_date), "dd MMM yyyy")}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Points Conversion</Label>
                <p>{viewingPlan.points_to_rupee_conversion} points = ₹1</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Territory Coverage</Label>
                <p>{viewingPlan.is_all_territories ? "All Territories" : "Specific Territories"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <div className="mt-1">
                  {isPlanActive(viewingPlan) ? (
                    <Badge className="bg-green-500/10 text-green-600">Active Now</Badge>
                  ) : viewingPlan.is_active ? (
                    <Badge variant="secondary">Scheduled</Badge>
                  ) : (
                    <Badge variant="outline">Inactive</Badge>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Loyalty Plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this loyalty plan and all its associated parameters.
              Points already earned will remain but won't be linked to this plan.
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
