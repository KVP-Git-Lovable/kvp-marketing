import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Users, Phone, Mail, Edit, Trash2, Calendar, ChevronDown, ChevronUp, MapPin } from "lucide-react";
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
  is_active: boolean;
  seniority: string | null;
  years_of_experience: number | null;
  years_with_distributor: number | null;
  birth_date: string | null;
}

interface Props {
  distributorId: string;
}

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "director", label: "Director" },
  { value: "manager", label: "Manager" },
  { value: "sales", label: "Sales" },
  { value: "operations", label: "Operations" },
  { value: "finance", label: "Finance" },
  { value: "warehouse", label: "Warehouse" },
  { value: "delivery", label: "Delivery" },
  { value: "admin", label: "Admin" },
  { value: "other", label: "Other" },
];

const SENIORITY_OPTIONS = [
  { value: "c_level", label: "C-Level" },
  { value: "executive", label: "Executive" },
  { value: "senior", label: "Senior" },
  { value: "mid", label: "Mid-Level" },
  { value: "entry", label: "Entry" },
];

export function DistributorContactsList({ distributorId }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState({
    contact_name: "",
    designation: "",
    phone: "",
    email: "",
    address: "",
    role: "",
    seniority: "",
    reports_to: "",
    is_primary: false,
    is_active: true,
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
      setContacts((data || []).map(c => ({
        ...c,
        is_active: c.is_active ?? true,
      })));
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
      seniority: "",
      reports_to: "",
      is_primary: false,
      is_active: true,
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
      seniority: contact.seniority || "",
      reports_to: contact.reports_to || "",
      is_primary: contact.is_primary,
      is_active: contact.is_active ?? true,
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
        seniority: formData.seniority || null,
        reports_to: formData.reports_to || null,
        is_primary: formData.is_primary,
        is_active: formData.is_active,
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

  const primaryContact = contacts.find(c => c.is_primary);
  const activeContacts = contacts.filter(c => c.is_active !== false);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer flex-1"
            onClick={() => setExpanded(!expanded)}
          >
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Contacts ({activeContacts.length})
            </CardTitle>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
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
                    <Label htmlFor="designation">Title/Designation</Label>
                    <Input
                      id="designation"
                      value={formData.designation}
                      onChange={(e) => setFormData(prev => ({ ...prev, designation: e.target.value }))}
                      placeholder="e.g., Sales Manager"
                    />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <Select value={formData.role} onValueChange={(v) => setFormData(prev => ({ ...prev, role: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Seniority</Label>
                    <Select value={formData.seniority} onValueChange={(v) => setFormData(prev => ({ ...prev, seniority: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select seniority" />
                      </SelectTrigger>
                      <SelectContent>
                        {SENIORITY_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

                <div className="flex items-center justify-between gap-4 pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="is_primary"
                      checked={formData.is_primary}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_primary: checked }))}
                    />
                    <Label htmlFor="is_primary">Primary Contact</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                    />
                    <Label htmlFor="is_active">Active</Label>
                  </div>
                </div>

                <Button type="submit" className="w-full">
                  {editingContact ? "Update" : "Add"} Contact
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {loading ? (
          <div className="h-12 bg-muted animate-pulse rounded" />
        ) : !expanded ? (
          // Collapsed view - show primary contact summary
          primaryContact ? (
            <div className="flex items-center justify-between text-sm">
              <span>{primaryContact.contact_name}</span>
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                {primaryContact.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {primaryContact.phone}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No one added yet</p>
          )
        ) : (
          // Expanded view - show all contacts
          contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-1">
              No one added yet — the people you actually deal with at this distributor.
            </p>
          ) : (
            <div className="space-y-3">
              {contacts.map(contact => (
                <div key={contact.id} className={`border rounded-lg p-3 relative ${!contact.is_active ? 'opacity-60 bg-muted/30' : ''}`}>
                  <div className="flex gap-2 absolute top-2 right-2">
                    {contact.is_primary && (
                      <Badge className="bg-primary/10 text-primary text-xs">Primary</Badge>
                    )}
                    {!contact.is_active && (
                      <Badge variant="secondary" className="text-xs">Inactive</Badge>
                    )}
                  </div>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-20">
                      <p className="font-medium">{contact.contact_name}</p>
                      {contact.designation && (
                        <p className="text-sm text-muted-foreground">{contact.designation}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {contact.role && (
                          <Badge variant="outline" className="text-xs capitalize">{contact.role}</Badge>
                        )}
                        {contact.seniority && (
                          <Badge variant="secondary" className="text-xs capitalize">
                            {contact.seniority.replace('_', '-')}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 mt-6">
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
                    {contact.address && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {contact.address}
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
          )
        )}
      </CardContent>
    </Card>
  );
}
