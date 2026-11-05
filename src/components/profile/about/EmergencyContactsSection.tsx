import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Phone, User, Loader2, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EmergencyContact {
  id: string;
  contact_name: string;
  relationship: string | null;
  phone: string | null;
  alternate_phone: string | null;
  address: string | null;
  is_primary: boolean;
}

const RELATIONSHIP_OPTIONS = [
  "Parent", "Spouse", "Sibling", "Child", "Friend", "Relative", "Other"
];

export function EmergencyContactsSection() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    contact_name: "",
    relationship: "",
    phone: "",
    alternate_phone: "",
    address: "",
    is_primary: false,
  });

  useEffect(() => {
    if (user) fetchContacts();
  }, [user]);

  const fetchContacts = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("emergency_contacts")
      .select("*")
      .eq("user_id", user.id)
      .order("is_primary", { ascending: false });

    if (!error && data) {
      setContacts(data);
    }
    setLoading(false);
  };

  const openAddDialog = () => {
    setEditingId(null);
    setFormData({
      contact_name: "",
      relationship: "",
      phone: "",
      alternate_phone: "",
      address: "",
      is_primary: contacts.length === 0,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (contact: EmergencyContact) => {
    setEditingId(contact.id);
    setFormData({
      contact_name: contact.contact_name,
      relationship: contact.relationship || "",
      phone: contact.phone || "",
      alternate_phone: contact.alternate_phone || "",
      address: contact.address || "",
      is_primary: contact.is_primary,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !formData.contact_name.trim()) {
      toast.error("Contact name is required");
      return;
    }

    setSaving(true);

    // If setting as primary, unset other primaries first
    if (formData.is_primary) {
      await supabase
        .from("emergency_contacts")
        .update({ is_primary: false })
        .eq("user_id", user.id);
    }

    const payload = {
      user_id: user.id,
      contact_name: formData.contact_name,
      relationship: formData.relationship || null,
      phone: formData.phone || null,
      alternate_phone: formData.alternate_phone || null,
      address: formData.address || null,
      is_primary: formData.is_primary,
    };

    if (editingId) {
      const { error } = await supabase
        .from("emergency_contacts")
        .update(payload)
        .eq("id", editingId);
      if (error) toast.error("Failed to update");
      else toast.success("Contact updated");
    } else {
      const { error } = await supabase.from("emergency_contacts").insert(payload);
      if (error) toast.error("Failed to add");
      else toast.success("Contact added");
    }

    setSaving(false);
    setDialogOpen(false);
    fetchContacts();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("emergency_contacts").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else {
      toast.success("Contact deleted");
      fetchContacts();
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Emergency Contacts
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
        ) : contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No emergency contacts added yet. Click "Add" to add contacts.
          </p>
        ) : (
          <div className="space-y-3">
            {contacts.map((contact) => (
              <div key={contact.id} className="border rounded-lg p-4 relative group">
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEditDialog(contact)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(contact.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{contact.contact_name}</h4>
                      {contact.is_primary && (
                        <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{contact.relationship}</p>
                    {contact.phone && (
                      <p className="text-sm mt-1">
                        <Phone className="h-3 w-3 inline mr-1" />
                        {contact.phone}
                      </p>
                    )}
                    {contact.address && (
                      <p className="text-xs text-muted-foreground mt-1">{contact.address}</p>
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
            <DialogTitle>{editingId ? "Edit Contact" : "Add Emergency Contact"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Contact Name *</Label>
              <Input
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-2">
              <Label>Relationship</Label>
              <Select
                value={formData.relationship}
                onValueChange={(value) => setFormData({ ...formData, relationship: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select relationship" />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_OPTIONS.map((rel) => (
                    <SelectItem key={rel} value={rel}>{rel}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 XXXXX XXXXX"
                />
              </div>
              <div className="space-y-2">
                <Label>Alternate Phone</Label>
                <Input
                  value={formData.alternate_phone}
                  onChange={(e) => setFormData({ ...formData, alternate_phone: e.target.value })}
                  placeholder="+91 XXXXX XXXXX"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Full address"
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="is_primary"
                checked={formData.is_primary}
                onCheckedChange={(checked) => setFormData({ ...formData, is_primary: !!checked })}
              />
              <Label htmlFor="is_primary" className="text-sm">Primary emergency contact</Label>
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
