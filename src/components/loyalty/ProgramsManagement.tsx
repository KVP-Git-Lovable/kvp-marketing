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
import { Plus, Edit, TrendingUp, Calendar, Trash2, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function ProgramsManagement() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingProgram, setEditingProgram] = useState<any>(null);
  const [viewingProgram, setViewingProgram] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: programs, isLoading } = useQuery({
    queryKey: ["retailer-loyalty-programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("retailer_loyalty_programs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (program: any) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("retailer_loyalty_programs").insert({
        ...program,
        created_by: userData?.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-loyalty-programs"] });
      toast.success("Program created successfully");
      setIsCreateOpen(false);
    },
    onError: () => toast.error("Failed to create program"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase
        .from("retailer_loyalty_programs")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-loyalty-programs"] });
      toast.success("Program updated successfully");
      setIsEditOpen(false);
      setEditingProgram(null);
    },
    onError: () => toast.error("Failed to update program"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("retailer_loyalty_programs")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-loyalty-programs"] });
      toast.success("Program deleted successfully");
      setDeleteId(null);
    },
    onError: () => toast.error("Failed to delete program"),
  });

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const program = {
      program_name: formData.get("program_name"),
      description: formData.get("description"),
      start_date: formData.get("start_date"),
      end_date: formData.get("end_date"),
      points_to_rupee_conversion: Number(formData.get("conversion")),
      is_all_territories: formData.get("all_territories") === "on",
      is_active: formData.get("is_active") === "on",
    };
    createMutation.mutate(program);
  };

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const updates = {
      program_name: formData.get("program_name"),
      description: formData.get("description"),
      start_date: formData.get("start_date"),
      end_date: formData.get("end_date"),
      points_to_rupee_conversion: Number(formData.get("conversion")),
      is_all_territories: formData.get("all_territories") === "on",
      is_active: formData.get("is_active") === "on",
    };
    updateMutation.mutate({ id: editingProgram.id, updates });
  };

  if (isLoading) {
    return <div>Loading programs...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Loyalty Programs</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage retailer loyalty programs
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Program
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Loyalty Program</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <Label htmlFor="program_name">Program Name</Label>
                <Input
                  id="program_name"
                  name="program_name"
                  placeholder="e.g., Diwali Loyalty 2025"
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Program description"
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
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="all_territories" name="all_territories" defaultChecked />
                <Label htmlFor="all_territories">Apply to all territories</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="is_active" name="is_active" defaultChecked />
                <Label htmlFor="is_active">Active</Label>
              </div>
              <Button type="submit" className="w-full">
                Create Program
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {programs?.map((program) => (
          <Card key={program.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{program.program_name}</CardTitle>
                <Badge variant={program.is_active ? "default" : "secondary"}>
                  {program.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{program.description}</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {new Date(program.start_date).toLocaleDateString()} -{" "}
                    {new Date(program.end_date).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span>{program.points_to_rupee_conversion} points = ₹1</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setViewingProgram(program);
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
                    setEditingProgram(program);
                    setIsEditOpen(true);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteId(program.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {programs?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No programs yet. Create your first one!</p>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Loyalty Program</DialogTitle>
          </DialogHeader>
          {editingProgram && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <Label htmlFor="edit_program_name">Program Name</Label>
                <Input
                  id="edit_program_name"
                  name="program_name"
                  defaultValue={editingProgram.program_name}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit_description">Description</Label>
                <Textarea
                  id="edit_description"
                  name="description"
                  defaultValue={editingProgram.description || ""}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit_start_date">Start Date</Label>
                  <Input
                    type="date"
                    id="edit_start_date"
                    name="start_date"
                    defaultValue={editingProgram.start_date}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit_end_date">End Date</Label>
                  <Input
                    type="date"
                    id="edit_end_date"
                    name="end_date"
                    defaultValue={editingProgram.end_date}
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
                  defaultValue={editingProgram.points_to_rupee_conversion}
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit_all_territories"
                  name="all_territories"
                  defaultChecked={editingProgram.is_all_territories}
                />
                <Label htmlFor="edit_all_territories">Apply to all territories</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="edit_is_active"
                  name="is_active"
                  defaultChecked={editingProgram.is_active}
                />
                <Label htmlFor="edit_is_active">Active</Label>
              </div>
              <Button type="submit" className="w-full">
                Update Program
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Program Details</DialogTitle>
          </DialogHeader>
          {viewingProgram && (
            <div className="space-y-4">
              <div>
                <Label>Program Name</Label>
                <p className="text-sm mt-1">{viewingProgram.program_name}</p>
              </div>
              <div>
                <Label>Description</Label>
                <p className="text-sm mt-1">{viewingProgram.description || "N/A"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date</Label>
                  <p className="text-sm mt-1">
                    {new Date(viewingProgram.start_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <Label>End Date</Label>
                  <p className="text-sm mt-1">
                    {new Date(viewingProgram.end_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div>
                <Label>Points to Rupee Conversion</Label>
                <p className="text-sm mt-1">
                  {viewingProgram.points_to_rupee_conversion} points = ₹1
                </p>
              </div>
              <div>
                <Label>Territory Coverage</Label>
                <p className="text-sm mt-1">
                  {viewingProgram.is_all_territories ? "All Territories" : "Specific Territories"}
                </p>
              </div>
              <div>
                <Label>Status</Label>
                <Badge variant={viewingProgram.is_active ? "default" : "secondary"} className="mt-1">
                  {viewingProgram.is_active ? "Active" : "Inactive"}
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
              This will permanently delete this loyalty program. All associated actions and points history
              will remain but won't be linked to an active program. This action cannot be undone.
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
