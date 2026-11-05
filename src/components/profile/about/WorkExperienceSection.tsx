import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Briefcase, Building2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface WorkExperience {
  id: string;
  company_name: string;
  designation: string | null;
  from_date: string | null;
  to_date: string | null;
  is_current: boolean;
  description: string | null;
  location: string | null;
}

export function WorkExperienceSection() {
  const { user } = useAuth();
  const [experiences, setExperiences] = useState<WorkExperience[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    company_name: "",
    designation: "",
    from_date: "",
    to_date: "",
    is_current: false,
    description: "",
    location: "",
  });

  useEffect(() => {
    if (user) fetchExperiences();
  }, [user]);

  const fetchExperiences = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("work_experiences")
      .select("*")
      .eq("user_id", user.id)
      .order("from_date", { ascending: false });

    if (!error && data) {
      setExperiences(data);
    }
    setLoading(false);
  };

  const openAddDialog = () => {
    setEditingId(null);
    setFormData({
      company_name: "",
      designation: "",
      from_date: "",
      to_date: "",
      is_current: false,
      description: "",
      location: "",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (exp: WorkExperience) => {
    setEditingId(exp.id);
    setFormData({
      company_name: exp.company_name,
      designation: exp.designation || "",
      from_date: exp.from_date || "",
      to_date: exp.to_date || "",
      is_current: exp.is_current,
      description: exp.description || "",
      location: exp.location || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !formData.company_name.trim()) {
      toast.error("Company name is required");
      return;
    }

    setSaving(true);
    const payload = {
      user_id: user.id,
      company_name: formData.company_name,
      designation: formData.designation || null,
      from_date: formData.from_date || null,
      to_date: formData.is_current ? null : formData.to_date || null,
      is_current: formData.is_current,
      description: formData.description || null,
      location: formData.location || null,
    };

    if (editingId) {
      const { error } = await supabase
        .from("work_experiences")
        .update(payload)
        .eq("id", editingId);
      if (error) toast.error("Failed to update");
      else toast.success("Experience updated");
    } else {
      const { error } = await supabase.from("work_experiences").insert(payload);
      if (error) toast.error("Failed to add");
      else toast.success("Experience added");
    }

    setSaving(false);
    setDialogOpen(false);
    fetchExperiences();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("work_experiences").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else {
      toast.success("Experience deleted");
      fetchExperiences();
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            Work Experience
          </CardTitle>
          <Button size="sm" variant="outline" onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : experiences.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No work experience added yet. Click "Add" to add your work history.
          </p>
        ) : (
          <div className="space-y-4">
            {experiences.map((exp) => (
              <div key={exp.id} className="border rounded-lg p-4 relative group">
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEditDialog(exp)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(exp.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">{exp.designation || "Position"}</h4>
                    <p className="text-sm text-muted-foreground">{exp.company_name}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {exp.from_date ? format(new Date(exp.from_date), "MMM yyyy") : "Start"} -{" "}
                      {exp.is_current ? "Present" : exp.to_date ? format(new Date(exp.to_date), "MMM yyyy") : "End"}
                      {exp.location && ` · ${exp.location}`}
                    </p>
                    {exp.description && (
                      <p className="text-sm mt-2 text-muted-foreground">{exp.description}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Experience" : "Add Experience"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Company Name *</Label>
              <Input
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="Company name"
              />
            </div>
            <div className="space-y-2">
              <Label>Designation</Label>
              <Input
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                placeholder="Your role/title"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From</Label>
                <Input
                  type="date"
                  value={formData.from_date}
                  onChange={(e) => setFormData({ ...formData, from_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>To</Label>
                <Input
                  type="date"
                  value={formData.to_date}
                  onChange={(e) => setFormData({ ...formData, to_date: e.target.value })}
                  disabled={formData.is_current}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="is_current"
                checked={formData.is_current}
                onCheckedChange={(checked) => setFormData({ ...formData, is_current: !!checked })}
              />
              <Label htmlFor="is_current" className="text-sm">I currently work here</Label>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="City, State"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief about your work..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
