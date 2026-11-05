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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Star, Trophy, Edit, Trash2, Eye, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ActionTargetConfig, getTargetConfigDescription } from "./ActionTargetConfig";

const ACTION_TYPES = [
  { value: "first_order", label: "First Order Bonus", icon: "🎉" },
  { value: "order_frequency", label: "Order Frequency Reward", icon: "⚡" },
  { value: "order_value_tiers", label: "Order Value Tiers", icon: "💰" },
  { value: "consecutive_orders", label: "Consecutive Order Streak", icon: "🔥" },
  { value: "new_product_trial", label: "New Product Trial", icon: "🆕" },
  { value: "bulk_order", label: "Bulk Order Bonus", icon: "📦" },
  { value: "timely_payment", label: "Timely Payment", icon: "✅" },
  { value: "monthly_volume", label: "Monthly Volume Achievement", icon: "📊" },
];

export function ActionsManagement() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<string>("");
  const [editingAction, setEditingAction] = useState<any>(null);
  const [viewingAction, setViewingAction] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [createActionType, setCreateActionType] = useState<string>("");
  const [createTargetConfig, setCreateTargetConfig] = useState<Record<string, any>>({});
  const [editTargetConfig, setEditTargetConfig] = useState<Record<string, any>>({});
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

  const { data: actions, isLoading } = useQuery({
    queryKey: ["retailer-loyalty-actions", selectedProgram],
    queryFn: async () => {
      if (!selectedProgram) return [];
      const { data, error } = await supabase
        .from("retailer_loyalty_actions")
        .select("*")
        .eq("program_id", selectedProgram)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedProgram,
  });

  const createMutation = useMutation({
    mutationFn: async (action: any) => {
      const { error } = await supabase.from("retailer_loyalty_actions").insert(action);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-loyalty-actions"] });
      toast.success("Action created successfully");
      setIsCreateOpen(false);
    },
    onError: () => toast.error("Failed to create action"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase
        .from("retailer_loyalty_actions")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-loyalty-actions"] });
      toast.success("Action updated successfully");
      setIsEditOpen(false);
      setEditingAction(null);
    },
    onError: () => toast.error("Failed to update action"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("retailer_loyalty_actions")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-loyalty-actions"] });
      toast.success("Action deleted successfully");
      setDeleteId(null);
    },
    onError: () => toast.error("Failed to delete action"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("retailer_loyalty_actions")
        .update({ is_enabled: enabled })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-loyalty-actions"] });
      toast.success("Action updated");
    },
  });

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const action = {
      program_id: selectedProgram,
      action_type: formData.get("action_type"),
      action_name: formData.get("action_name"),
      points: Number(formData.get("points")),
      is_enabled: true,
      metadata: {},
      target_config: createTargetConfig,
    };
    createMutation.mutate(action);
    setCreateActionType("");
    setCreateTargetConfig({});
  };

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const updates = {
      action_type: formData.get("action_type"),
      action_name: formData.get("action_name"),
      points: Number(formData.get("points")),
      target_config: editTargetConfig,
    };
    updateMutation.mutate({ id: editingAction.id, updates });
    setEditTargetConfig({});
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold">Loyalty Actions</h2>
          <p className="text-sm text-muted-foreground">
            Configure point-earning actions for programs
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
                Add Action
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Loyalty Action</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="action_type">Action Type</Label>
                  <Select 
                    name="action_type" 
                    required
                    value={createActionType}
                    onValueChange={(val) => {
                      setCreateActionType(val);
                      setCreateTargetConfig({});
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select action type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.icon} {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="action_name">Action Name</Label>
                  <Input
                    id="action_name"
                    name="action_name"
                    placeholder="e.g., First Order Welcome Bonus"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="points">Points</Label>
                  <Input
                    type="number"
                    id="points"
                    name="points"
                    placeholder="e.g., 50"
                    required
                  />
                </div>
                {createActionType && (
                  <ActionTargetConfig
                    actionType={createActionType}
                    value={createTargetConfig}
                    onChange={setCreateTargetConfig}
                  />
                )}
                <Button type="submit" className="w-full">
                  Create Action
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!selectedProgram ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Select a program to view actions</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div>Loading actions...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {actions?.map((action) => {
            const actionType = ACTION_TYPES.find((t) => t.value === action.action_type);
            return (
              <Card key={action.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span>{actionType?.icon}</span>
                      <span>{action.action_name}</span>
                    </CardTitle>
                    <Switch
                      checked={action.is_enabled}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: action.id, enabled: checked })
                      }
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    <span className="font-semibold">{action.points} Points</span>
                  </div>
                  <Badge variant="secondary">{actionType?.label}</Badge>
                  {action.target_config && typeof action.target_config === 'object' && !Array.isArray(action.target_config) && Object.keys(action.target_config).length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Settings className="h-3 w-3" />
                      <span>{getTargetConfigDescription(action.action_type, action.target_config as Record<string, any>)}</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setViewingAction(action);
                        setIsViewOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setEditingAction(action);
                        setEditTargetConfig(
                          action.target_config && typeof action.target_config === 'object' && !Array.isArray(action.target_config)
                            ? action.target_config as Record<string, any>
                            : {}
                        );
                        setIsEditOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteId(action.id)}
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

      {actions?.length === 0 && selectedProgram && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No actions yet. Add your first one!</p>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Loyalty Action</DialogTitle>
          </DialogHeader>
          {editingAction && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <Label htmlFor="edit_action_type">Action Type</Label>
                <Select 
                  name="action_type" 
                  defaultValue={editingAction.action_type} 
                  onValueChange={(val) => {
                    if (val !== editingAction.action_type) {
                      setEditTargetConfig({});
                    }
                  }}
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit_action_name">Action Name</Label>
                <Input
                  id="edit_action_name"
                  name="action_name"
                  defaultValue={editingAction.action_name}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit_points">Points</Label>
                <Input
                  type="number"
                  id="edit_points"
                  name="points"
                  defaultValue={editingAction.points}
                  required
                />
              </div>
              <ActionTargetConfig
                actionType={editingAction.action_type}
                value={editTargetConfig}
                onChange={setEditTargetConfig}
                prefix="edit_"
              />
              <Button type="submit" className="w-full">
                Update Action
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Action Details</DialogTitle>
          </DialogHeader>
          {viewingAction && (
            <div className="space-y-4">
              <div>
                <Label>Action Name</Label>
                <p className="text-sm mt-1">{viewingAction.action_name}</p>
              </div>
              <div>
                <Label>Action Type</Label>
                <p className="text-sm mt-1">
                  {ACTION_TYPES.find((t) => t.value === viewingAction.action_type)?.icon}{" "}
                  {ACTION_TYPES.find((t) => t.value === viewingAction.action_type)?.label}
                </p>
              </div>
              <div>
                <Label>Points Awarded</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  <span className="font-semibold">{viewingAction.points} Points</span>
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <Badge variant={viewingAction.is_enabled ? "default" : "secondary"} className="mt-1">
                  {viewingAction.is_enabled ? "Enabled" : "Disabled"}
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
              This will permanently delete this loyalty action. All points already awarded
              through this action will remain. This action cannot be undone.
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
