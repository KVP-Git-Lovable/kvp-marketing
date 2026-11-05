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
import { Plus, Star, Edit, Trash2, Settings, Zap, Trophy, TrendingUp, Package, Clock, CreditCard, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Parameter types with icons and descriptions
const PARAMETER_TYPES = [
  { value: "order_value", label: "Order Value", icon: "💰", description: "Points based on order amount" },
  { value: "order_frequency", label: "Order Frequency", icon: "⚡", description: "Reward for regular ordering" },
  { value: "focused_product", label: "Focused Product Sales", icon: "🎯", description: "Points for specific products" },
  { value: "monthly_growth", label: "Monthly Growth", icon: "📈", description: "Month-on-month growth bonus" },
  { value: "annual_volume", label: "Annual Volume", icon: "📊", description: "Yearly order milestones" },
  { value: "bulk_order", label: "Bulk Order Bonus", icon: "📦", description: "Large quantity rewards" },
  { value: "first_order", label: "First Order", icon: "🎉", description: "Welcome bonus for new retailers" },
  { value: "consecutive_orders", label: "Consecutive Orders", icon: "🔥", description: "Streak-based rewards" },
  { value: "timely_payment", label: "Timely Payment", icon: "✅", description: "Early/on-time payment bonus" },
  { value: "category_champion", label: "Category Champion", icon: "🏆", description: "Multi-category ordering" },
  { value: "new_product_trial", label: "New Product Trial", icon: "🆕", description: "Try new products reward" },
  { value: "referral_bonus", label: "Referral Bonus", icon: "🤝", description: "Refer other retailers" },
];

// Configuration fields for each parameter type
const PARAMETER_CONFIGS: Record<string, { key: string; label: string; type: string; placeholder: string }[]> = {
  order_value: [
    { key: "min_value", label: "Minimum Order Value (₹)", type: "number", placeholder: "e.g., 5000" },
    { key: "max_value", label: "Maximum Order Value (₹)", type: "number", placeholder: "Optional cap" },
  ],
  order_frequency: [
    { key: "frequency_days", label: "Days Between Orders", type: "number", placeholder: "e.g., 7 for weekly" },
    { key: "max_awards_per_period", label: "Max Awards per Month", type: "number", placeholder: "e.g., 4" },
  ],
  focused_product: [
    { key: "min_value", label: "Minimum Product Value (₹)", type: "number", placeholder: "e.g., 1000" },
  ],
  monthly_growth: [
    { key: "growth_percentage", label: "Minimum Growth (%)", type: "number", placeholder: "e.g., 10" },
  ],
  annual_volume: [
    { key: "target_value", label: "Annual Target Value (₹)", type: "number", placeholder: "e.g., 500000" },
  ],
  bulk_order: [
    { key: "min_value", label: "Minimum Order Value (₹)", type: "number", placeholder: "e.g., 25000" },
    { key: "consecutive_required", label: "Minimum Quantity", type: "number", placeholder: "e.g., 100" },
  ],
  first_order: [],
  consecutive_orders: [
    { key: "consecutive_required", label: "Required Consecutive Orders", type: "number", placeholder: "e.g., 4" },
    { key: "frequency_days", label: "Max Days Between Orders", type: "number", placeholder: "e.g., 10" },
  ],
  timely_payment: [
    { key: "frequency_days", label: "Days Before Due Date", type: "number", placeholder: "e.g., 0 for on-time" },
  ],
  category_champion: [
    { key: "consecutive_required", label: "Minimum Categories", type: "number", placeholder: "e.g., 3" },
  ],
  new_product_trial: [
    { key: "consecutive_required", label: "New Products Required", type: "number", placeholder: "e.g., 2" },
  ],
  referral_bonus: [
    { key: "min_value", label: "Referee's First Order Min (₹)", type: "number", placeholder: "e.g., 5000" },
  ],
};

const AWARD_PERIODS = [
  { value: "once", label: "Once only" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "per_order", label: "Per Order" },
];

interface LoyaltyParameter {
  id: string;
  plan_id: string;
  parameter_type: string;
  parameter_name: string;
  description: string | null;
  points: number;
  is_enabled: boolean;
  min_value: number | null;
  max_value: number | null;
  frequency_days: number | null;
  consecutive_required: number | null;
  growth_percentage: number | null;
  target_value: number | null;
  award_period: string | null;
  max_awards_per_period: number | null;
  qualifying_criteria: string | null;
}

export function LoyaltyParameterConfig() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("");
  const [editingParam, setEditingParam] = useState<LoyaltyParameter | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: parameters, isLoading } = useQuery({
    queryKey: ["retailer-loyalty-parameters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retailer_loyalty_parameters")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as LoyaltyParameter[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (param: Partial<LoyaltyParameter>) => {
      const { error } = await supabase.from("retailer_loyalty_parameters").insert([param] as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-loyalty-parameters"] });
      toast.success("Parameter created successfully");
      setIsCreateOpen(false);
      setSelectedType("");
    },
    onError: () => toast.error("Failed to create parameter"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<LoyaltyParameter> }) => {
      const { error } = await supabase
        .from("retailer_loyalty_parameters")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-loyalty-parameters"] });
      toast.success("Parameter updated successfully");
      setIsEditOpen(false);
      setEditingParam(null);
    },
    onError: () => toast.error("Failed to update parameter"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("retailer_loyalty_parameters")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-loyalty-parameters"] });
      toast.success("Parameter deleted successfully");
      setDeleteId(null);
    },
    onError: () => toast.error("Failed to delete parameter"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("retailer_loyalty_parameters")
        .update({ is_enabled: enabled })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-loyalty-parameters"] });
      toast.success("Parameter updated");
    },
  });

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const configFields = PARAMETER_CONFIGS[selectedType] || [];
    
    const param: Partial<LoyaltyParameter> = {
      parameter_type: selectedType,
      parameter_name: formData.get("parameter_name") as string,
      description: formData.get("description") as string,
      points: Number(formData.get("points")),
      award_period: formData.get("award_period") as string,
      qualifying_criteria: formData.get("qualifying_criteria") as string,
      is_enabled: true,
    };

    // Add dynamic config fields
    configFields.forEach((field) => {
      const value = formData.get(field.key);
      if (value) {
        (param as any)[field.key] = field.type === "number" ? Number(value) : value;
      }
    });

    createMutation.mutate(param);
  };

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingParam) return;
    const formData = new FormData(e.currentTarget);
    const configFields = PARAMETER_CONFIGS[editingParam.parameter_type] || [];
    
    const updates: Partial<LoyaltyParameter> = {
      parameter_name: formData.get("parameter_name") as string,
      description: formData.get("description") as string,
      points: Number(formData.get("points")),
      award_period: formData.get("award_period") as string,
      qualifying_criteria: formData.get("qualifying_criteria") as string,
    };

    configFields.forEach((field) => {
      const value = formData.get(field.key);
      (updates as any)[field.key] = value ? (field.type === "number" ? Number(value) : value) : null;
    });

    updateMutation.mutate({ id: editingParam.id, updates });
  };

  const getParamTypeInfo = (type: string) => PARAMETER_TYPES.find((t) => t.value === type);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold">Earning Parameters</h2>
          <p className="text-sm text-muted-foreground">
            Configure how retailers earn loyalty points
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Dialog open={isCreateOpen} onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) setSelectedType("");
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Parameter
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Earning Parameter</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <Label>Parameter Type</Label>
                  <Select value={selectedType} onValueChange={setSelectedType} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select parameter type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PARAMETER_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <span className="flex items-center gap-2">
                            <span>{type.icon}</span>
                            <span>{type.label}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedType && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {getParamTypeInfo(selectedType)?.description}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="parameter_name">Parameter Name</Label>
                  <Input
                    id="parameter_name"
                    name="parameter_name"
                    placeholder="e.g., Order Value Bonus"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Explain how this works to retailers"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="points">Points Awarded</Label>
                    <Input
                      type="number"
                      id="points"
                      name="points"
                      placeholder="e.g., 50"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="award_period">Award Frequency</Label>
                    <Select name="award_period" defaultValue="per_order">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {AWARD_PERIODS.map((period) => (
                          <SelectItem key={period.value} value={period.value}>
                            {period.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Dynamic config fields based on selected type */}
                {selectedType && PARAMETER_CONFIGS[selectedType]?.length > 0 && (
                  <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Configuration
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      {PARAMETER_CONFIGS[selectedType].map((field) => (
                        <div key={field.key}>
                          <Label htmlFor={field.key}>{field.label}</Label>
                          <Input
                            type={field.type}
                            id={field.key}
                            name={field.key}
                            placeholder={field.placeholder}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="qualifying_criteria">Qualifying Criteria (for retailers)</Label>
                  <Textarea
                    id="qualifying_criteria"
                    name="qualifying_criteria"
                    placeholder="e.g., Place orders worth ₹5,000 or more to earn bonus points"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Parameter"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-8">Loading parameters...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {parameters?.map((param) => {
            const typeInfo = getParamTypeInfo(param.parameter_type);
            return (
              <Card key={param.id} className={param.is_enabled ? "" : "opacity-60"}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{typeInfo?.icon}</span>
                      <CardTitle className="text-base">{param.parameter_name}</CardTitle>
                    </div>
                    <Switch
                      checked={param.is_enabled}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: param.id, enabled: checked })
                      }
                    />
                  </div>
                  <CardDescription className="line-clamp-2">
                    {param.description || typeInfo?.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                    <span className="font-semibold">{param.points} Points</span>
                    {param.award_period && (
                      <Badge variant="outline" className="text-xs">
                        {AWARD_PERIODS.find(p => p.value === param.award_period)?.label}
                      </Badge>
                    )}
                  </div>
                  
                  <Badge variant="secondary">{typeInfo?.label}</Badge>

                  {param.qualifying_criteria && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {param.qualifying_criteria}
                    </p>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setEditingParam(param);
                        setIsEditOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteId(param.id)}
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

      {parameters?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No parameters yet. Add your first earning rule!</p>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Parameter</DialogTitle>
          </DialogHeader>
          {editingParam && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="flex items-center gap-2 p-2 bg-muted rounded">
                <span className="text-xl">{getParamTypeInfo(editingParam.parameter_type)?.icon}</span>
                <span className="font-medium">{getParamTypeInfo(editingParam.parameter_type)?.label}</span>
              </div>

              <div>
                <Label htmlFor="edit_parameter_name">Parameter Name</Label>
                <Input
                  id="edit_parameter_name"
                  name="parameter_name"
                  defaultValue={editingParam.parameter_name}
                  required
                />
              </div>

              <div>
                <Label htmlFor="edit_description">Description</Label>
                <Textarea
                  id="edit_description"
                  name="description"
                  defaultValue={editingParam.description || ""}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit_points">Points Awarded</Label>
                  <Input
                    type="number"
                    id="edit_points"
                    name="points"
                    defaultValue={editingParam.points}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit_award_period">Award Frequency</Label>
                  <Select name="award_period" defaultValue={editingParam.award_period || "per_order"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AWARD_PERIODS.map((period) => (
                        <SelectItem key={period.value} value={period.value}>
                          {period.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {PARAMETER_CONFIGS[editingParam.parameter_type]?.length > 0 && (
                <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Configuration
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    {PARAMETER_CONFIGS[editingParam.parameter_type].map((field) => (
                      <div key={field.key}>
                        <Label htmlFor={`edit_${field.key}`}>{field.label}</Label>
                        <Input
                          type={field.type}
                          id={`edit_${field.key}`}
                          name={field.key}
                          defaultValue={(editingParam as any)[field.key] || ""}
                          placeholder={field.placeholder}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="edit_qualifying_criteria">Qualifying Criteria</Label>
                <Textarea
                  id="edit_qualifying_criteria"
                  name="qualifying_criteria"
                  defaultValue={editingParam.qualifying_criteria || ""}
                />
              </div>

              <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Updating..." : "Update Parameter"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Parameter?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this earning parameter. Points already earned with this parameter will remain.
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
