import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Trash2, ArrowLeft, Users, Sparkles, BarChart } from "lucide-react";
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
  sku_count?: number;
  contact_count?: number;
}

interface CompetitorSKU {
  id: string;
  competitor_id: string;
  sku_name: string;
  unit: string;
  is_active: boolean;
  demand?: string;
  observations?: number;
  avgStock?: string;
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

export default function CompetitionMaster() {
  const navigate = useNavigate();
  const { hasPermission: hasCompPerm } = useProfilePermissions();
  const isAdmin = hasCompPerm('admin_competition_master', 'can_edit');
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null);
  const [skus, setSKUs] = useState<CompetitorSKU[]>([]);
  const [contacts, setContacts] = useState<CompetitorContact[]>([]);
  const [competitionData, setCompetitionData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSKUDialogOpen, setIsSKUDialogOpen] = useState(false);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [isSKUDetailOpen, setIsSKUDetailOpen] = useState(false);
  const [selectedSKU, setSelectedSKU] = useState<{ id: string; name: string } | null>(null);

  const [formData, setFormData] = useState({
    competitor_name: "",
    business_background: "",
    key_financial_stats: {},
    focus: "",
    strategy: "",
    website: "",
    sales_team_size: 0,
    supply_chain_info: "",
    head_office: "",
    regional_offices_count: 0
  });

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
    fetchCompetitors();
  }, []);

  const fetchCompetitors = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('competition_master')
        .select('*')
        .order('competitor_name');

      if (error) throw error;
      
      // Get rollup counts for each competitor
      if (data) {
        const competitorsWithCounts = await Promise.all(
          data.map(async (comp) => {
            const [skusRes, contactsRes] = await Promise.all([
              supabase.from('competition_skus').select('id', { count: 'exact', head: true }).eq('competitor_id', comp.id),
              supabase.from('competition_contacts').select('id', { count: 'exact', head: true }).eq('competitor_id', comp.id)
            ]);
            
            return {
              ...comp,
              sku_count: skusRes.count || 0,
              contact_count: contactsRes.count || 0
            };
          })
        );
        setCompetitors(competitorsWithCounts);
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to load competitors",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const analyzeSKUDemand = (skus: any[], competitionData: any[]) => {
    const skuDemandData = skus.map(sku => {
      const skuData = competitionData.filter(d => d.sku_id === sku.id);
      const totalStock = skuData.reduce((sum, d) => sum + (d.stock_quantity || 0), 0);
      const avgStock = skuData.length > 0 ? totalStock / skuData.length : 0;
      const observations = skuData.length;

      let demand = 'Low';
      if (observations >= 5 && avgStock > 50) {
        demand = 'High';
      } else if (observations >= 3 && avgStock > 20) {
        demand = 'Medium';
      }

      return {
        ...sku,
        demand,
        observations,
        avgStock: avgStock.toFixed(1)
      };
    });

    setSKUs(skuDemandData);
  };

  const fetchCompetitorDetails = async (competitorId: string) => {
    try {
      const [skusRes, contactsRes, dataRes] = await Promise.all([
        supabase.from('competition_skus').select('*').eq('competitor_id', competitorId),
        supabase.from('competition_contacts').select('*').eq('competitor_id', competitorId),
        supabase.from('competition_data')
          .select('*')
          .eq('competitor_id', competitorId)
          .order('created_at', { ascending: false })
      ]);

      if (skusRes.error) throw skusRes.error;
      if (contactsRes.error) throw contactsRes.error;
      if (dataRes.error) throw dataRes.error;

      const retailerIds = [...new Set(dataRes.data?.map(d => d.retailer_id).filter(Boolean) || [])];
      const visitIds = [...new Set(dataRes.data?.map(d => d.visit_id).filter(Boolean) || [])];

      const [retailersRes, visitsRes] = await Promise.all([
        retailerIds.length > 0 
          ? supabase.from('retailers').select('id, name, address, location_tag').in('id', retailerIds)
          : Promise.resolve({ data: [], error: null }),
        visitIds.length > 0
          ? supabase.from('visits').select('id, planned_date, user_id').in('id', visitIds)
          : Promise.resolve({ data: [], error: null })
      ]);

      const retailersMap = new Map((retailersRes.data || []).map(r => [r.id, r]));
      const visitsMap = new Map((visitsRes.data || []).map(v => [v.id, v]));

      const enhancedData = dataRes.data?.map(d => ({
        ...d,
        sku_name: skusRes.data?.find(s => s.id === d.sku_id)?.sku_name || 'Unknown',
        retailers: d.retailer_id ? retailersMap.get(d.retailer_id) : null,
        visits: d.visit_id ? visitsMap.get(d.visit_id) : null
      })) || [];

      setContacts(contactsRes.data || []);
      setCompetitionData(enhancedData);
      
      if (skusRes.data && skusRes.data.length > 0) {
        analyzeSKUDemand(skusRes.data, enhancedData);
      } else {
        setSKUs([]);
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to load competitor details",
        variant: "destructive"
      });
    }
  };

  const handleAddCompetitor = async () => {
    try {
      const { error } = await supabase.from('competition_master').insert([formData]);
      if (error) throw error;
      toast({ title: "Success", description: "Competitor added successfully" });
      setIsAddDialogOpen(false);
      setFormData({ 
        competitor_name: "", 
        business_background: "", 
        key_financial_stats: {},
        focus: "",
        strategy: "",
        website: "",
        sales_team_size: 0,
        supply_chain_info: "",
        head_office: "",
        regional_offices_count: 0
      });
      fetchCompetitors();
    } catch (error) {
      toast({ title: "Error", description: "Failed to add competitor", variant: "destructive" });
    }
  };

  const handleUpdateCompetitor = async () => {
    if (!selectedCompetitor) return;
    try {
      const { error } = await supabase.from('competition_master').update(formData).eq('id', selectedCompetitor.id);
      if (error) throw error;
      toast({ title: "Success", description: "Competitor updated successfully" });
      setIsEditDialogOpen(false);
      fetchCompetitors();
    } catch (error) {
      toast({ title: "Error", description: "Failed to update competitor", variant: "destructive" });
    }
  };

  const handleDeleteCompetitor = async (id: string) => {
    if (!isAdmin) {
      toast({ title: "Permission Denied", description: "Only admins can delete competitors", variant: "destructive" });
      return;
    }
    if (!confirm("Are you sure you want to move this competitor to recycle bin?")) return;
    try {
      const competitorData = competitors.find(c => c.id === id);
      if (competitorData) {
        const moved = await moveToRecycleBin({
          tableName: 'competition_master',
          recordId: id,
          recordData: competitorData,
          moduleName: 'Competitors',
          recordName: competitorData.competitor_name
        });
        if (!moved) throw new Error('Failed to move to recycle bin');
      }
      const { error } = await supabase.from('competition_master').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Success", description: "Competitor moved to recycle bin" });
      fetchCompetitors();
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete competitor", variant: "destructive" });
    }
  };

  const handleAddSKU = async () => {
    if (!selectedCompetitor) return;
    try {
      const { error } = await supabase.from('competition_skus').insert([{ competitor_id: selectedCompetitor.id, ...skuForm }]);
      if (error) throw error;
      toast({ title: "Success", description: "SKU added successfully" });
      setIsSKUDialogOpen(false);
      setSKUForm({ sku_name: "", unit: "", is_active: true });
      fetchCompetitorDetails(selectedCompetitor.id);
    } catch (error) {
      toast({ title: "Error", description: "Failed to add SKU", variant: "destructive" });
    }
  };

  const handleAddContact = async () => {
    if (!selectedCompetitor) return;
    try {
      if (isEditingContact && contactForm.id) {
        const { error } = await supabase.from('competition_contacts').update(contactForm).eq('id', contactForm.id);
        if (error) throw error;
        toast({ title: "Success", description: "Contact updated successfully" });
      } else {
        const { error } = await supabase.from('competition_contacts').insert([{ competitor_id: selectedCompetitor.id, ...contactForm }]);
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
      fetchCompetitorDetails(selectedCompetitor.id);
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
        const moved = await moveToRecycleBin({
          tableName: 'competition_contacts',
          recordId: id,
          recordData: contactData,
          moduleName: 'Competition Contacts',
          recordName: contactData.contact_name
        });
        if (!moved) throw new Error('Failed to move to recycle bin');
      }
      const { error } = await supabase.from('competition_contacts').delete().eq('id', id);
      if (error) throw error;
      toast({ title: "Success", description: "Contact moved to recycle bin" });
      if (selectedCompetitor) fetchCompetitorDetails(selectedCompetitor.id);
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete contact", variant: "destructive" });
    }
  };

  if (loading) return <div className="p-4 md:p-8">Loading...</div>;

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        {/* Header Section */}
        <div className="relative overflow-hidden bg-gradient-primary text-primary-foreground">
          <div className="absolute inset-0 bg-gradient-to-r from-black/10 to-transparent"></div>
          <div className="relative p-4 sm:p-6">
            <div className="flex items-center gap-4">
              <Button 
                onClick={() => navigate(-1)} 
                variant="ghost" 
                size="sm"
                className="text-primary-foreground hover:bg-primary-foreground/20 p-2"
              >
                <ArrowLeft size={20} />
              </Button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">Competition Master</h1>
                <p className="text-primary-foreground/80 text-sm sm:text-base mt-1">Manage competitor information</p>
              </div>
            </div>
          </div>
        </div>

      {/* Content */}
      <div className="p-4 max-w-7xl mx-auto space-y-4 md:space-y-6">

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-lg md:text-xl">Competitors</CardTitle>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" />Add Competitor</Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Add New Competitor</DialogTitle></DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-1"><Label>Competitor Name</Label><Input value={formData.competitor_name} onChange={(e) => setFormData({ ...formData, competitor_name: e.target.value })} /></div>
                  <div className="md:col-span-1"><Label>Website</Label><Input value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} placeholder="https://..." /></div>
                  <div className="md:col-span-2"><Label>Business Background</Label><Textarea value={formData.business_background} onChange={(e) => setFormData({ ...formData, business_background: e.target.value })} /></div>
                  <div className="md:col-span-2"><Label>Focus</Label><Textarea value={formData.focus} onChange={(e) => setFormData({ ...formData, focus: e.target.value })} placeholder="Key focus areas" /></div>
                  <div className="md:col-span-2"><Label>Strategy</Label><Textarea value={formData.strategy} onChange={(e) => setFormData({ ...formData, strategy: e.target.value })} placeholder="Business strategy" /></div>
                  <div className="md:col-span-1"><Label># of Sales Team</Label><Input type="number" value={formData.sales_team_size} onChange={(e) => setFormData({ ...formData, sales_team_size: parseInt(e.target.value) || 0 })} /></div>
                  <div className="md:col-span-1"><Label># of Regional Offices</Label><Input type="number" value={formData.regional_offices_count} onChange={(e) => setFormData({ ...formData, regional_offices_count: parseInt(e.target.value) || 0 })} /></div>
                  <div className="md:col-span-1"><Label>Head Office</Label><Input value={formData.head_office} onChange={(e) => setFormData({ ...formData, head_office: e.target.value })} placeholder="Location" /></div>
                  <div className="md:col-span-2"><Label>Supply Chain Information</Label><Textarea value={formData.supply_chain_info} onChange={(e) => setFormData({ ...formData, supply_chain_info: e.target.value })} placeholder="Supply chain details" /></div>
                  <div className="md:col-span-2"><Button onClick={handleAddCompetitor} className="w-full">Add Competitor</Button></div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="p-0 md:p-6">
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competitor Name</TableHead>
                  <TableHead># SKUs</TableHead>
                  <TableHead># Contacts</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {competitors.map((competitor) => (
                  <TableRow key={competitor.id}>
                  <TableCell>
                      <Button
                        variant="link"
                        className="p-0 h-auto font-medium hover:underline"
                        onClick={() => navigate(`/competition-master/${competitor.id}`)}
                      >
                        {competitor.competitor_name}
                      </Button>
                    </TableCell>
                    <TableCell>{competitor.sku_count || 0}</TableCell>
                    <TableCell>{competitor.contact_count || 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => { 
                          setSelectedCompetitor(competitor); 
                          setFormData({ 
                            competitor_name: competitor.competitor_name, 
                            business_background: competitor.business_background, 
                            key_financial_stats: competitor.key_financial_stats,
                            focus: competitor.focus || "",
                            strategy: competitor.strategy || "",
                            website: competitor.website || "",
                            sales_team_size: competitor.sales_team_size || 0,
                            supply_chain_info: competitor.supply_chain_info || "",
                            head_office: competitor.head_office || "",
                            regional_offices_count: competitor.regional_offices_count || 0
                          }); 
                          setIsEditDialogOpen(true); 
                        }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        {isAdmin && <Button variant="outline" size="sm" onClick={() => handleDeleteCompetitor(competitor.id)}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3 p-3">
            {competitors.map((competitor) => (
              <Card key={competitor.id} className="cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/competition-master/${competitor.id}`)}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base truncate">{competitor.competitor_name}</h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">{competitor.sku_count || 0} SKUs</Badge>
                        </span>
                        <span className="flex items-center gap-1">
                          <Badge variant="outline" className="text-xs">{competitor.contact_count || 0} Contacts</Badge>
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={(e) => { 
                          e.stopPropagation();
                          setSelectedCompetitor(competitor); 
                          setFormData({ 
                            competitor_name: competitor.competitor_name, 
                            business_background: competitor.business_background, 
                            key_financial_stats: competitor.key_financial_stats,
                            focus: competitor.focus || "",
                            strategy: competitor.strategy || "",
                            website: competitor.website || "",
                            sales_team_size: competitor.sales_team_size || 0,
                            supply_chain_info: competitor.supply_chain_info || "",
                            head_office: competitor.head_office || "",
                            regional_offices_count: competitor.regional_offices_count || 0
                          }); 
                          setIsEditDialogOpen(true); 
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCompetitor(competitor.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Competitor</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-1"><Label>Competitor Name</Label><Input value={formData.competitor_name} onChange={(e) => setFormData({ ...formData, competitor_name: e.target.value })} /></div>
            <div className="md:col-span-1"><Label>Website</Label><Input value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} placeholder="https://..." /></div>
            <div className="md:col-span-2"><Label>Business Background</Label><Textarea value={formData.business_background} onChange={(e) => setFormData({ ...formData, business_background: e.target.value })} /></div>
            <div className="md:col-span-2"><Label>Focus</Label><Textarea value={formData.focus} onChange={(e) => setFormData({ ...formData, focus: e.target.value })} placeholder="Key focus areas" /></div>
            <div className="md:col-span-2"><Label>Strategy</Label><Textarea value={formData.strategy} onChange={(e) => setFormData({ ...formData, strategy: e.target.value })} placeholder="Business strategy" /></div>
            <div className="md:col-span-1"><Label># of Sales Team</Label><Input type="number" value={formData.sales_team_size} onChange={(e) => setFormData({ ...formData, sales_team_size: parseInt(e.target.value) || 0 })} /></div>
            <div className="md:col-span-1"><Label># of Regional Offices</Label><Input type="number" value={formData.regional_offices_count} onChange={(e) => setFormData({ ...formData, regional_offices_count: parseInt(e.target.value) || 0 })} /></div>
            <div className="md:col-span-1"><Label>Head Office</Label><Input value={formData.head_office} onChange={(e) => setFormData({ ...formData, head_office: e.target.value })} placeholder="Location" /></div>
            <div className="md:col-span-2"><Label>Supply Chain Information</Label><Textarea value={formData.supply_chain_info} onChange={(e) => setFormData({ ...formData, supply_chain_info: e.target.value })} placeholder="Supply chain details" /></div>
            <div className="md:col-span-2"><Button onClick={handleUpdateCompetitor} className="w-full">Update Competitor</Button></div>
          </div>
        </DialogContent>
      </Dialog>

      {selectedSKU && (
        <SKUDetailModal
          open={isSKUDetailOpen}
          onOpenChange={setIsSKUDetailOpen}
          skuId={selectedSKU.id}
          skuName={selectedSKU.name}
          competitorName={selectedCompetitor?.competitor_name || ''}
        />
      )}
      </div>
    </div>
    </Layout>
  );
}
