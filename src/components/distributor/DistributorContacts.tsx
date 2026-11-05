import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Users, Phone, Mail, Edit, Trash2, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Contact {
  id: string;
  contact_name: string;
  designation: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  role: string | null;
  reports_to: string | null;
  is_primary: boolean;
  years_of_experience: number | null;
  years_with_distributor: number | null;
  birth_date: string | null;
}

interface Props {
  distributorId: string;
}

export function DistributorContacts({ distributorId }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState({
    contact_name: "",
    designation: "",
    phone: "",
    email: "",
    address: "",
    role: "",
    reports_to: "",
    is_primary: false,
    years_of_experience: "",
    years_with_distributor: "",
    birth_date: "",
  });

  useEffect(() => {
    loadContacts();
  }, [distributorId]);

  const loadContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('distributor_contacts')
        .select('*')
        .eq('distributor_id', distributorId)
        .order('is_primary', { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (error: any) {
      toast.error("Failed to load contacts: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      contact_name: "",
      designation: "",
      phone: "",
      email: "",
      address: "",
      role: "",
      reports_to: "",
      is_primary: false,
      years_of_experience: "",
      years_with_distributor: "",
      birth_date: "",
    });
    setEditingContact(null);
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      contact_name: contact.contact_name,
      designation: contact.designation || "",
      phone: contact.phone || "",
      email: contact.email || "",
      address: contact.address || "",
      role: contact.role || "",
      reports_to: contact.reports_to || "",
      is_primary: contact.is_primary,
      years_of_experience: contact.years_of_experience?.toString() || "",
      years_with_distributor: contact.years_with_distributor?.toString() || "",
      birth_date: contact.birth_date || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.contact_name.trim()) {
      toast.error("Contact name is required");
      return;
    }

    try {
      const contactData = {
        distributor_id: distributorId,
        contact_name: formData.contact_name.trim(),
        designation: formData.designation.trim() || null,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        address: formData.address.trim() || null,
        role: formData.role || null,
        reports_to: formData.reports_to || null,
        is_primary: formData.is_primary,
        years_of_experience: formData.years_of_experience ? parseInt(formData.years_of_experience) : null,
        years_with_distributor: formData.years_with_distributor ? parseInt(formData.years_with_distributor) : null,
        birth_date: formData.birth_date || null,
      };

      if (editingContact) {
        const { error } = await supabase
          .from('distributor_contacts')
          .update(contactData)
          .eq('id', editingContact.id);
        if (error) throw error;
        toast.success("Contact updated");
      } else {
        const { error } = await supabase
          .from('distributor_contacts')
          .insert(contactData);
        if (error) throw error;
        toast.success("Contact added");
      }

      setDialogOpen(false);
      resetForm();
      loadContacts();
    } catch (error: any) {
      toast.error("Failed to save contact: " + error.message);
    }
  };

  const handleDelete = async (contactId: string) => {
    if (!confirm("Delete this contact?")) return;
    
    try {
      const { error } = await supabase
        .from('distributor_contacts')
        .delete()
        .eq('id', contactId);
      if (error) throw error;
      toast.success("Contact deleted");
      loadContacts();
    } catch (error: any) {
      toast.error("Failed to delete: " + error.message);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Contacts ({contacts.length})
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1">
                <Plus className="h-3 w-3" />
                Add
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingContact ? "Edit Contact" : "Add Contact"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="contact_name">Name *</Label>
                  <Input
                    id="contact_name"
                    value={formData.contact_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="designation">Designation</Label>
                    <Input
                      id="designation"
                      value={formData.designation}
                      onChange={(e) => setFormData(prev => ({ ...prev, designation: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <Select value={formData.role} onValueChange={(v) => setFormData(prev => ({ ...prev, role: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="sales">Sales</SelectItem>
                        <SelectItem value="operations">Operations</SelectItem>
                        <SelectItem value="finance">Finance</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  />
                </div>

                <div>
                  <Label>Reports To</Label>
                  <Select value={formData.reports_to} onValueChange={(v) => setFormData(prev => ({ ...prev, reports_to: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select manager" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {contacts.filter(c => c.id !== editingContact?.id).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.contact_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="years_of_experience">Experience (Years)</Label>
                    <Input
                      id="years_of_experience"
                      type="number"
                      value={formData.years_of_experience}
                      onChange={(e) => setFormData(prev => ({ ...prev, years_of_experience: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="years_with_distributor">With Distributor (Years)</Label>
                    <Input
                      id="years_with_distributor"
                      type="number"
                      value={formData.years_with_distributor}
                      onChange={(e) => setFormData(prev => ({ ...prev, years_with_distributor: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="birth_date">Birth Date</Label>
                  <Input
                    id="birth_date"
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, birth_date: e.target.value }))}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_primary"
                    checked={formData.is_primary}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_primary: e.target.checked }))}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="is_primary">Primary Contact</Label>
                </div>

                <Button type="submit" className="w-full">
                  {editingContact ? "Update" : "Add"} Contact
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map(i => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No contacts added yet</p>
        ) : (
          <div className="space-y-3">
            {contacts.map(contact => (
              <div key={contact.id} className="border rounded-lg p-3 relative">
                {contact.is_primary && (
                  <span className="absolute top-2 right-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                    Primary
                  </span>
                )}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{contact.contact_name}</p>
                    {contact.designation && (
                      <p className="text-sm text-muted-foreground">{contact.designation}</p>
                    )}
                    {contact.role && (
                      <span className="text-xs bg-muted px-2 py-0.5 rounded capitalize">{contact.role}</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(contact)}>
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(contact.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                  {contact.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {contact.phone}
                    </span>
                  )}
                  {contact.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {contact.email}
                    </span>
                  )}
                  {contact.birth_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(contact.birth_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
