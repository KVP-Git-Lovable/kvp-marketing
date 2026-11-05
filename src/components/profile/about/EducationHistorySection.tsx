import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, GraduationCap, School, Loader2 } from "lucide-react";
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

interface EducationHistory {
  id: string;
  institution_name: string;
  degree: string | null;
  field_of_study: string | null;
  from_date: string | null;
  to_date: string | null;
  grade: string | null;
  activities: string | null;
}

export function EducationHistorySection() {
  const { user } = useAuth();
  const [educations, setEducations] = useState<EducationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    institution_name: "",
    degree: "",
    field_of_study: "",
    from_date: "",
    to_date: "",
    grade: "",
    activities: "",
  });

  useEffect(() => {
    if (user) fetchEducations();
  }, [user]);

  const fetchEducations = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("education_history")
      .select("*")
      .eq("user_id", user.id)
      .order("from_date", { ascending: false });

    if (!error && data) {
      setEducations(data);
    }
    setLoading(false);
  };

  const openAddDialog = () => {
    setEditingId(null);
    setFormData({
      institution_name: "",
      degree: "",
      field_of_study: "",
      from_date: "",
      to_date: "",
      grade: "",
      activities: "",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (edu: EducationHistory) => {
    setEditingId(edu.id);
    setFormData({
      institution_name: edu.institution_name,
      degree: edu.degree || "",
      field_of_study: edu.field_of_study || "",
      from_date: edu.from_date || "",
      to_date: edu.to_date || "",
      grade: edu.grade || "",
      activities: edu.activities || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !formData.institution_name.trim()) {
      toast.error("Institution name is required");
      return;
    }

    setSaving(true);
    const payload = {
      user_id: user.id,
      institution_name: formData.institution_name,
      degree: formData.degree || null,
      field_of_study: formData.field_of_study || null,
      from_date: formData.from_date || null,
      to_date: formData.to_date || null,
      grade: formData.grade || null,
      activities: formData.activities || null,
    };

    if (editingId) {
      const { error } = await supabase
        .from("education_history")
        .update(payload)
        .eq("id", editingId);
      if (error) toast.error("Failed to update");
      else toast.success("Education updated");
    } else {
      const { error } = await supabase.from("education_history").insert(payload);
      if (error) toast.error("Failed to add");
      else toast.success("Education added");
    }

    setSaving(false);
    setDialogOpen(false);
    fetchEducations();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("education_history").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else {
      toast.success("Education deleted");
      fetchEducations();
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Education
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
        ) : educations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No education history added yet. Click "Add" to add your education.
          </p>
        ) : (
          <div className="space-y-4">
            {educations.map((edu) => (
              <div key={edu.id} className="border rounded-lg p-4 relative group">
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEditDialog(edu)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(edu.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <School className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">{edu.institution_name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {edu.degree}{edu.field_of_study && ` in ${edu.field_of_study}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {edu.from_date ? format(new Date(edu.from_date), "yyyy") : ""} -{" "}
                      {edu.to_date ? format(new Date(edu.to_date), "yyyy") : "Present"}
                      {edu.grade && ` · Grade: ${edu.grade}`}
                    </p>
                    {edu.activities && (
                      <p className="text-sm mt-2 text-muted-foreground">{edu.activities}</p>
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
            <DialogTitle>{editingId ? "Edit Education" : "Add Education"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Institution Name *</Label>
              <Input
                value={formData.institution_name}
                onChange={(e) => setFormData({ ...formData, institution_name: e.target.value })}
                placeholder="School/College/University"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Degree</Label>
                <Input
                  value={formData.degree}
                  onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
                  placeholder="B.Tech, MBA, etc."
                />
              </div>
              <div className="space-y-2">
                <Label>Field of Study</Label>
                <Input
                  value={formData.field_of_study}
                  onChange={(e) => setFormData({ ...formData, field_of_study: e.target.value })}
                  placeholder="Computer Science, etc."
                />
              </div>
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
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Grade/CGPA</Label>
              <Input
                value={formData.grade}
                onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                placeholder="8.5 CGPA, First Class, etc."
              />
            </div>
            <div className="space-y-2">
              <Label>Activities & Achievements</Label>
              <Textarea
                value={formData.activities}
                onChange={(e) => setFormData({ ...formData, activities: e.target.value })}
                placeholder="Sports, clubs, achievements..."
                rows={2}
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
