import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, 
  Phone, 
  Mail, 
  User,
  Briefcase,
  Edit2,
  Trash2,
  Star
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Contact {
  id: string;
  contact_name: string;
  designation: string | null;
  phone: string | null;
  email: string | null;
  role: string | null;
  is_primary: boolean;
  birth_date: string | null;
  years_of_experience: number | null;
  years_with_distributor: number | null;
}

const roles = [
  'Owner',
  'Manager',
  'Sales Head',
  'Accounts',
  'Logistics',
  'Warehouse',
  'Other'
];

const DistributorContacts = () => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [distributorId, setDistributorId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    contact_name: '',
    designation: '',
    phone: '',
    email: '',
    role: '',
    is_primary: false,
    birth_date: '',
    years_of_experience: '',
    years_with_distributor: ''
  });

  useEffect(() => {
    const storedUser = localStorage.getItem('distributor_user');
    if (!storedUser) {
      navigate('/distributor-portal/login');
      return;
    }
    const user = JSON.parse(storedUser);
    setDistributorId(user.distributor_id);
    loadContacts(user.distributor_id);
  }, [navigate]);

  const loadContacts = async (distId: string) => {
    try {
      const { data, error } = await supabase
        .from('distributor_contacts')
        .select('*')
        .eq('distributor_id', distId)
        .order('is_primary', { ascending: false })
        .order('contact_name');

      if (error) throw error;
      setContacts(data || []);
    } catch (error: any) {
      toast.error('Failed to load contacts: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      contact_name: '',
      designation: '',
      phone: '',
      email: '',
      role: '',
      is_primary: false,
      birth_date: '',
      years_of_experience: '',
      years_with_distributor: ''
    });
    setEditingContact(null);
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      contact_name: contact.contact_name,
      designation: contact.designation || '',
      phone: contact.phone || '',
      email: contact.email || '',
      role: contact.role || '',
      is_primary: contact.is_primary,
      birth_date: contact.birth_date || '',
      years_of_experience: contact.years_of_experience?.toString() || '',
      years_with_distributor: contact.years_with_distributor?.toString() || ''
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.contact_name || !distributorId) {
      toast.error('Contact name is required');
      return;
    }

    try {
      const payload = {
        distributor_id: distributorId,
        contact_name: formData.contact_name,
        designation: formData.designation || null,
        phone: formData.phone || null,
        email: formData.email || null,
        role: formData.role || null,
        is_primary: formData.is_primary,
        birth_date: formData.birth_date || null,
        years_of_experience: formData.years_of_experience ? parseInt(formData.years_of_experience) : null,
        years_with_distributor: formData.years_with_distributor ? parseInt(formData.years_with_distributor) : null,
      };

      if (editingContact) {
        const { error } = await supabase
          .from('distributor_contacts')
          .update(payload)
          .eq('id', editingContact.id);
        if (error) throw error;
        toast.success('Contact updated');
      } else {
        const { error } = await supabase
          .from('distributor_contacts')
          .insert(payload);
        if (error) throw error;
        toast.success('Contact added');
      }

      setDialogOpen(false);
      resetForm();
      loadContacts(distributorId);
    } catch (error: any) {
      toast.error('Failed to save: ' + error.message);
    }
  };

  const handleDelete = async (contactId: string) => {
    if (!confirm('Delete this contact?')) return;

    try {
      const { error } = await supabase
        .from('distributor_contacts')
        .delete()
        .eq('id', contactId);

      if (error) throw error;
      toast.success('Contact deleted');
      if (distributorId) loadContacts(distributorId);
    } catch (error: any) {
      toast.error('Failed to delete: ' + error.message);
    }
  };

  const handleSetPrimary = async (contactId: string) => {
    if (!distributorId) return;

    try {
      // Reset all to non-primary first
      await supabase
        .from('distributor_contacts')
        .update({ is_primary: false })
        .eq('distributor_id', distributorId);

      // Set the selected one as primary
      const { error } = await supabase
        .from('distributor_contacts')
        .update({ is_primary: true })
        .eq('id', contactId);

      if (error) throw error;
      toast.success('Primary contact updated');
      loadContacts(distributorId);
    } catch (error: any) {
      toast.error('Failed to update: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <header className="sticky-header-safe z-50 bg-card border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="font-semibold text-foreground">Team Contacts</h1>
              <p className="text-xs text-muted-foreground">{contacts.length} contacts</p>
            </div>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingContact ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <Label>Designation</Label>
                  <Input
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    placeholder="e.g. Sales Manager"
                  />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map(role => (
                        <SelectItem key={role} value={role}>{role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="Phone number"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Email"
                    />
                  </div>
                </div>
                <div>
                  <Label>Birth Date</Label>
                  <Input
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Years of Experience</Label>
                    <Input
                      type="number"
                      value={formData.years_of_experience}
                      onChange={(e) => setFormData({ ...formData, years_of_experience: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Years with Company</Label>
                    <Input
                      type="number"
                      value={formData.years_with_distributor}
                      onChange={(e) => setFormData({ ...formData, years_with_distributor: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={handleSubmit} className="w-full">
                  {editingContact ? 'Update Contact' : 'Add Contact'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {contacts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <User className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No contacts added yet</p>
              <Button variant="link" onClick={() => setDialogOpen(true)}>
                Add your first contact
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {contacts.map((contact) => (
              <Card key={contact.id} className={contact.is_primary ? 'border-primary' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-foreground">{contact.contact_name}</h3>
                          {contact.is_primary && (
                            <Badge variant="default" className="text-xs">
                              <Star className="w-3 h-3 mr-1" />
                              Primary
                            </Badge>
                          )}
                        </div>
                        {contact.designation && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <Briefcase className="w-3 h-3" />
                            {contact.designation}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-3 mt-2 text-sm">
                          {contact.phone && (
                            <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-primary">
                              <Phone className="w-3 h-3" />
                              {contact.phone}
                            </a>
                          )}
                          {contact.email && (
                            <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-primary">
                              <Mail className="w-3 h-3" />
                              {contact.email}
                            </a>
                          )}
                        </div>
                        {contact.role && (
                          <Badge variant="outline" className="mt-2 text-xs">{contact.role}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!contact.is_primary && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleSetPrimary(contact.id)}
                          title="Set as primary"
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(contact)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-destructive"
                        onClick={() => handleDelete(contact.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default DistributorContacts;
