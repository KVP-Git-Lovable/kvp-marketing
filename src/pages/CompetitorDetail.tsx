import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, ArrowLeft, BarChart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useProfilePermissions } from "@/hooks/useProfilePermissions";
import { moveToRecycleBin } from "@/utils/recycleBinUtils";
import { CompetitionDataList } from "@/components/competition/CompetitionDataList";
import { CompetitionAISummary } from "@/components/competition/CompetitionAISummary";
import { CompetitionRetailerAnalytics } from "@/components/competition/CompetitionRetailerAnalytics";
import { SKUDetailModal } from "@/components/competition/SKUDetailModal";
import { Layout } from "@/components/Layout";

interface Competitor {
  id: string;
  competitor_name: string;
  business_background: string;
  key_financial_stats: any;
  focus: string;
  strategy: string;
  website: string;
  sales_team_size: number;
  supply_chain_info: string;
  head_office: string;
  regional_offices_count: number;
  created_at: string;
}

interface CompetitorSKU {
  id: string;
  competitor_id: string;
  sku_name: string;
  unit: string;
  is_active: boolean;
}

interface CompetitorContact {
  id: string;
  competitor_id: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  designation: string;
  hq: string;
  region_covered: string;
  reporting_to: string;
  level: string;
  skill: string;
  competitor_since: number;
  role: string;
  is_active: boolean;
}

export default function CompetitorDetail() {
  const navigate = useNavigate();
  const { competitorId } = useParams();
  const { hasPermission: hasCompPerm } = useProfilePermissions();
  const isAdmin = hasCompPerm('admin_competition_master', 'can_edit');
  const [competitor, setCompetitor] = useState<Competitor | null>(null);
  const [skus, setSKUs] = useState<CompetitorSKU[]>([]);
  const [contacts, setContacts] = useState<CompetitorContact[]>([]);
  const [competitionData, setCompetitionData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSKUDialogOpen, setIsSKUDialogOpen] = useState(false);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [isSKUDetailOpen, setIsSKUDetailOpen] = useState(false);
  const [selectedSKU, setSelectedSKU] = useState<{ id: string; name: string } | null>(null);

  const [skuForm, setSKUForm] = useState({
    sku_name: "",
    unit: "",
    is_active: true
  });

  const [contactForm, setContactForm] = useState({
    id: "",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    designation: "",
    hq: "",
    region_covered: "",
    reporting_to: "",
    level: "",
    skill: "",
    competitor_since: new Date().getFullYear(),
    role: "",
    is_active: true
  });

  useEffect(() => {
    if (competitorId) {
      fetchCompetitorDetails(competitorId);
    }
  }, [competitorId]);

  const fetchCompetitorDetails = async (id: string) => {
    setLoading(true);
    try {
      const { data: competitorData, error: competitorError } = await supabase
        .from('competition_master')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (competitorError) throw competitorError;
      if (!competitorData) {
        toast({ title: "Error", description: "Competitor not found", variant: "destructive" });
        navigate('/competition-master');
        return;
      }
      setCompetitor(competitorData);

      const [skusRes, contactsRes, dataRes] = await Promise.all([
        supabase.from('competition_skus').select('*').eq('competitor_id', id).order('sku_name'),
        supabase.from('competition_contacts').select('*').eq('competitor_id', id).order('contact_name'),
        supabase.from('competition_data').select('*, competition_skus(sku_name, unit)').eq('competitor_id', id).order('created_at', { ascending: false })
      ]);

      if (skusRes.error) throw skusRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (dataRes.error) throw dataRes.error;

      setSKUs(skusRes.data || []);
      setContacts(contactsRes.data || []);
      setCompetitionData(dataRes.data || []);
    } catch (error) {
      console.error('Error fetching competitor details:', error);
      toast({ title: "Error", description: "Failed to load competitor details", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAddSKU = async () => {
    if (!competitor) return;
    try {
      const { error } = await supabase.from('competition_skus').insert([{ competitor_id: competitor.id, ...skuForm }]);
      if (error) throw error;
      toast({ title: "Success", description: "SKU added successfully" });
      setIsSKUDialogOpen(false);
      setSKUForm({ sku_name: "", unit: "", is_active: true });
      fetchCompetitorDetails(competitor.id);
    } catch (error) {
      toast({ title: "Error", description: "Failed to add SKU", variant: "destructive" });
    }
  };

  const handleAddContact = async () => {
    if (!competitor) return;
    try {
      if (isEditingContact && contactForm.id) {
        const { error } = await supabase.from('competition_contacts').update(contactForm).eq('id', contactForm.id);
        if (error) throw error;
        toast({ title: "Success", description: "Contact updated successfully" });
      } else {
        const { error } = await supabase.from('competition_contacts').insert([{ competitor_id: competitor.id, ...contactForm }]);
        if (error) throw error;
        toast({ title: "Success", description: "Contact added successfully" });
      }
      setIsContactDialogOpen(false);
      setIsEditingContact(false);
      setContactForm({
        id: "",
        contact_name: "",
        contact_phone: "",
        contact_email: "",
        designation: "",
        hq: "",
        region_covered: "",
        reporting_to: "",
        level: "",
        skill: "",
        competitor_since: new Date().getFullYear(),
        role: "",
        is_active: true
      });
      fetchCompetitorDetails(competitor.id);
    } catch (error) {
      toast({ title: "Error", description: isEditingContact ? "Failed to update contact" : "Failed to add contact", variant: "destructive" });
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (!isAdmin) {
      toast({ title: "Permission Denied", description: "Only admins can delete contacts", variant: "destructive" });
      return;
    }
    if (!confirm("Are you sure you want to move this contact to recycle bin?")) return;
    try {
      const contactData = contacts.find(c => c.id === id);
      if (contactData) {
        await moveToRecycleBin({
          tableName: 'competition_contacts',
          recordId: id,
          recordData: contactData,
          moduleName: 'Competition Contacts',
          recordName: contactData.contact_name
        });
      }
      const { error } = await supabase.from('competition_contacts').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Success", description: "Contact moved to recycle bin" });
      if (competitor) fetchCompetitorDetails(competitor.id);
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete contact", variant: "destructive" });
    }
  };

  if (loading) return <div className="p-4 md:p-8">Loading...</div>;
  if (!competitor) return <div className="p-4 md:p-8">Competitor not found</div>;

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        {/* Header Section */}
        <div className="relative overflow-hidden bg-gradient-primary text-primary-foreground">
          <div className="absolute inset-0 bg-gradient-to-r from-black/10 to-transparent"></div>
          <div className="relative p-4 sm:p-6">
            <div className="flex items-center gap-4">
              <Button 
                onClick={() => navigate('/competition-master')} 
                variant="ghost" 
                size="sm"
                className="text-primary-foreground hover:bg-primary-foreground/20 p-2"
              >
                <ArrowLeft size={20} />
              </Button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">{competitor.competitor_name}</h1>
                <p className="text-primary-foreground/80 text-sm sm:text-base mt-1">Competitor details and analytics</p>
              </div>
            </div>
          </div>
        </div>

      {/* Content */}
      <div className="p-4 max-w-7xl mx-auto space-y-6">

      <Tabs defaultValue="skus" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto flex-nowrap">
          <TabsTrigger value="skus">SKUs</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="stocks">Stocks</TabsTrigger>
          <TabsTrigger value="ai-summary">AI Summary</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="skus" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">SKUs</h2>
            <Dialog open={isSKUDialogOpen} onOpenChange={setIsSKUDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add SKU
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New SKU</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>SKU Name *</Label>
                    <Input value={skuForm.sku_name} onChange={(e) => setSKUForm({ ...skuForm, sku_name: e.target.value })} />
                  </div>
                  <div>
                    <Label>Unit</Label>
                    <Input value={skuForm.unit} onChange={(e) => setSKUForm({ ...skuForm, unit: e.target.value })} />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch checked={skuForm.is_active} onCheckedChange={(checked) => setSKUForm({ ...skuForm, is_active: checked })} />
                    <Label>Active</Label>
                  </div>
                  <Button onClick={handleAddSKU} disabled={!skuForm.sku_name}>Add SKU</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU Name</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {skus.map((sku) => (
                  <TableRow key={sku.id}>
                    <TableCell className="font-medium">{sku.sku_name}</TableCell>
                    <TableCell>{sku.unit || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={sku.is_active ? "default" : "secondary"}>
                        {sku.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => { setSelectedSKU({ id: sku.id, name: sku.sku_name }); setIsSKUDetailOpen(true); }}>
                        <BarChart className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden space-y-3">
            {skus.map((sku) => (
              <Card key={sku.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{sku.sku_name}</p>
                      <p className="text-sm text-muted-foreground">Unit: {sku.unit || '-'}</p>
                    </div>
                    <Badge variant={sku.is_active ? "default" : "secondary"}>
                      {sku.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => { setSelectedSKU({ id: sku.id, name: sku.sku_name }); setIsSKUDetailOpen(true); }}>
                    <BarChart className="h-4 w-4 mr-2" />
                    View Analytics
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          {skus.length === 0 && <p className="text-muted-foreground text-center py-8">No SKUs added yet</p>}
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Contacts</h2>
            <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => { setIsEditingContact(false); setContactForm({ id: "", contact_name: "", contact_phone: "", contact_email: "", designation: "", hq: "", region_covered: "", reporting_to: "", level: "", skill: "", competitor_since: new Date().getFullYear(), role: "", is_active: true }); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{isEditingContact ? 'Edit Contact' : 'Add New Contact'}</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Name *</Label>
                    <Input value={contactForm.contact_name} onChange={(e) => setContactForm({ ...contactForm, contact_name: e.target.value })} />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input value={contactForm.contact_phone} onChange={(e) => setContactForm({ ...contactForm, contact_phone: e.target.value })} />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={contactForm.contact_email} onChange={(e) => setContactForm({ ...contactForm, contact_email: e.target.value })} />
                  </div>
                  <div>
                    <Label>Designation</Label>
                    <Input value={contactForm.designation} onChange={(e) => setContactForm({ ...contactForm, designation: e.target.value })} />
                  </div>
                  <div>
                    <Label>HQ</Label>
                    <Input value={contactForm.hq} onChange={(e) => setContactForm({ ...contactForm, hq: e.target.value })} />
                  </div>
                  <div>
                    <Label>Region Covered</Label>
                    <Input value={contactForm.region_covered} onChange={(e) => setContactForm({ ...contactForm, region_covered: e.target.value })} />
                  </div>
                  <div>
                    <Label>Reporting To</Label>
                    <Input value={contactForm.reporting_to} onChange={(e) => setContactForm({ ...contactForm, reporting_to: e.target.value })} />
                  </div>
                  <div>
                    <Label>Level</Label>
                    <Select value={contactForm.level} onValueChange={(value) => setContactForm({ ...contactForm, level: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="senior">Senior</SelectItem>
                        <SelectItem value="mid">Mid</SelectItem>
                        <SelectItem value="junior">Junior</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Skill</Label>
                    <Input value={contactForm.skill} onChange={(e) => setContactForm({ ...contactForm, skill: e.target.value })} />
                  </div>
                  <div>
                    <Label>Competitor Since</Label>
                    <Input type="number" value={contactForm.competitor_since} onChange={(e) => setContactForm({ ...contactForm, competitor_since: parseInt(e.target.value) || new Date().getFullYear() })} />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <Input value={contactForm.role} onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })} />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch checked={contactForm.is_active} onCheckedChange={(checked) => setContactForm({ ...contactForm, is_active: checked })} />
                    <Label>Active</Label>
                  </div>
                </div>
                <Button onClick={handleAddContact} disabled={!contactForm.contact_name} className="w-full mt-4">
                  {isEditingContact ? 'Update Contact' : 'Add Contact'}
                </Button>
              </DialogContent>
            </Dialog>
          </div>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>HQ</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">{contact.contact_name}</TableCell>
                    <TableCell>{contact.designation || '-'}</TableCell>
                    <TableCell>{contact.contact_phone || '-'}</TableCell>
                    <TableCell>{contact.contact_email || '-'}</TableCell>
                    <TableCell>{contact.hq || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={contact.is_active ? "default" : "secondary"}>
                        {contact.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => { setContactForm(contact); setIsEditingContact(true); setIsContactDialogOpen(true); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteContact(contact.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden space-y-3">
            {contacts.map((contact) => (
              <Card key={contact.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{contact.contact_name}</p>
                      <p className="text-sm text-muted-foreground">{contact.designation || 'No designation'}</p>
                    </div>
                    <Badge variant={contact.is_active ? "default" : "secondary"}>
                      {contact.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="text-sm space-y-1">
                    <p><strong>Phone:</strong> {contact.contact_phone || '-'}</p>
                    <p><strong>Email:</strong> {contact.contact_email || '-'}</p>
                    <p><strong>HQ:</strong> {contact.hq || '-'}</p>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => { setContactForm(contact); setIsEditingContact(true); setIsContactDialogOpen(true); }}>
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    {isAdmin && (
                      <Button variant="outline" size="sm" onClick={() => handleDeleteContact(contact.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {contacts.length === 0 && <p className="text-muted-foreground text-center py-8">No contacts added yet</p>}
        </TabsContent>

        <TabsContent value="stocks">
          <CompetitionDataList data={competitionData} skus={skus} />
        </TabsContent>

        <TabsContent value="ai-summary">
          <CompetitionAISummary 
            competitorId={competitor.id}
            competitorName={competitor.competitor_name}
            competitionData={competitionData}
            competitorData={competitor}
          />
        </TabsContent>

        <TabsContent value="analytics">
          <CompetitionRetailerAnalytics 
            competitionData={competitionData}
            skus={skus}
          />
        </TabsContent>
      </Tabs>

      <SKUDetailModal
        open={isSKUDetailOpen}
        onOpenChange={setIsSKUDetailOpen}
        skuId={selectedSKU?.id || ''}
        skuName={selectedSKU?.name || ''}
        competitorName={competitor.competitor_name}
      />
      </div>
    </div>
    </Layout>
  );
}
