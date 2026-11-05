import { useState, useEffect, useRef } from 'react';
import { fullNameProps } from "@/lib/displayName";
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseLoose';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Building2, 
  Save, 
  Phone, 
  Mail, 
  MapPin,
  Calendar,
  Users,
  Truck,
  Store,
  FileText,
  Edit2,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import DistributorCompanyProfile from '@/components/distributor/DistributorCompanyProfile';

interface Distributor {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string | null;
  address: string | null;
  gst_number: string | null;
  logo_url: string | null;
  billing_address: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_pincode: string | null;
  delivery_same_as_billing: boolean | null;
  delivery_address: string | null;
  delivery_city: string | null;
  delivery_state: string | null;
  delivery_pincode: string | null;
  delivery_contact_person: string | null;
  delivery_contact_phone: string | null;
  status: string;
  distribution_level: string | null;
  partnership_status: string | null;
  established_year: number | null;
  distribution_experience_years: number | null;
  sales_team_size: number | null;
  assets_vans: number | null;
  assets_trucks: number | null;
  network_retailers_count: number | null;
  region_coverage: string | null;
  onboarding_date: string | null;
  years_of_relationship: number | null;
  products_distributed: string[] | null;
  other_products: string[] | null;
  competition_products: string[] | null;
  strength: string | null;
  weakness: string | null;
  opportunities: string | null;
  threats: string | null;
  about_business: string | null;
  coverage_area: string | null;
}

const levelLabels: Record<string, string> = {
  'super_stockist': 'Super Stockist',
  'distributor': 'Distributor',
  'sub_distributor': 'Sub-Distributor',
  'agent': 'Agent',
};

const partnershipColors: Record<string, string> = {
  'platinum': 'bg-gradient-to-r from-slate-400 to-slate-600 text-white',
  'gold': 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white',
  'silver': 'bg-gradient-to-r from-gray-300 to-gray-500 text-white',
  'registered': 'bg-muted text-muted-foreground',
};

const DistributorProfile = () => {
  const navigate = useNavigate();
  const [distributor, setDistributor] = useState<Distributor | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  /** The logo prints on every invoice this distributor issues, so changing it
   *  is an owner/manager decision. The database enforces it; this only keeps
   *  the button from promising something that would be refused. */
  const [canManageBranding] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem('distributor_user') || '{}');
      return u?.role === 'owner' || u?.role === 'manager';
    } catch { return false; }
  });
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Distributor>>({});

  useEffect(() => {
    const storedUser = localStorage.getItem('distributor_user');
    if (!storedUser) {
      navigate('/distributor-portal/login');
      return;
    }
    const user = JSON.parse(storedUser);
    loadDistributor(user.distributor_id);
  }, [navigate]);

  const loadDistributor = async (distributorId: string) => {
    try {
      const { data, error } = await supabase
        .from('distributors')
        .select('*')
        .eq('id', distributorId)
        .single();

      if (error) throw error;
      setDistributor(data);
      setFormData(data);
    } catch (error: any) {
      toast.error('Failed to load profile: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  /** The logo the portal header and their invoices use. Same bucket and
   *  column as the admin side writes, so the two cannot drift. */
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !distributor) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be under 2MB');
      return;
    }
    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop();
      // The distributor id has to be a folder, not part of the filename: the
      // storage policy that admits a portal upload matches on the folder.
      const path = `distributor-logos/${distributor.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('company-assets').upload(path, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('company-assets').getPublicUrl(path);
      const { error: updErr } = await supabase
        .from('distributors')
        .update({ logo_url: publicUrl })
        .eq('id', distributor.id);
      if (updErr) throw updErr;

      setDistributor({ ...distributor, logo_url: publicUrl });
      setFormData((prev: any) => ({ ...prev, logo_url: publicUrl }));

      // The portal header reads the logo off the cached session, so refresh it
      // here or the new logo only appears after the next sign-in.
      try {
        const cached = localStorage.getItem('distributor_user');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.distributors) {
            parsed.distributors.logo_url = publicUrl;
            localStorage.setItem('distributor_user', JSON.stringify(parsed));
          }
        }
      } catch { /* a stale cache is not worth failing the upload over */ }

      toast.success('Logo updated');
    } catch (err: any) {
      toast.error('Logo upload failed: ' + err.message);
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!distributor) return;
    setSaving(true);

    try {
      const { error } = await supabase
        .from('distributors')
        .update({
          contact_person: formData.contact_person,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
          gst_number: formData.gst_number,
          // Invoice details the distributor owns: the address their bills are
          // raised to, and where a lorry should actually go.
          billing_address: formData.billing_address,
          billing_city: formData.billing_city,
          billing_state: formData.billing_state,
          billing_pincode: formData.billing_pincode,
          delivery_same_as_billing: formData.delivery_same_as_billing !== false,
          delivery_address: formData.delivery_same_as_billing !== false ? null : formData.delivery_address,
          delivery_city: formData.delivery_same_as_billing !== false ? null : formData.delivery_city,
          delivery_state: formData.delivery_same_as_billing !== false ? null : formData.delivery_state,
          delivery_pincode: formData.delivery_same_as_billing !== false ? null : formData.delivery_pincode,
          delivery_contact_person: formData.delivery_same_as_billing !== false ? null : formData.delivery_contact_person,
          delivery_contact_phone: formData.delivery_same_as_billing !== false ? null : formData.delivery_contact_phone,
          established_year: formData.established_year,
          sales_team_size: formData.sales_team_size,
          assets_vans: formData.assets_vans,
          assets_trucks: formData.assets_trucks,
          network_retailers_count: formData.network_retailers_count,
          region_coverage: formData.region_coverage,
          coverage_area: formData.coverage_area,
          about_business: formData.about_business,
          strength: formData.strength,
          weakness: formData.weakness,
          opportunities: formData.opportunities,
          threats: formData.threats,
          updated_at: new Date().toISOString(),
        })
        .eq('id', distributor.id);

      if (error) throw error;

      toast.success('Profile updated successfully');
      setDistributor({ ...distributor, ...formData });
      setIsEditing(false);
    } catch (error: any) {
      toast.error('Failed to update: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!distributor) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-muted-foreground">Profile not found</p>
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
              <h1 className="font-semibold text-foreground">Company Profile</h1>
              <p className="text-xs text-muted-foreground truncate" {...fullNameProps(distributor.name)} />
            </div>
          </div>
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => {
                setFormData(distributor);
                setIsEditing(false);
              }}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Company Header Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground truncate" {...fullNameProps(distributor.name)} />
                  <div className="flex items-center gap-2 mt-1">
                    {distributor.distribution_level && (
                      <Badge variant="outline">
                        {levelLabels[distributor.distribution_level] || distributor.distribution_level}
                      </Badge>
                    )}
                    {distributor.partnership_status && (
                      <Badge className={partnershipColors[distributor.partnership_status] || 'bg-muted'}>
                        {distributor.partnership_status.charAt(0).toUpperCase() + distributor.partnership_status.slice(1)}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="details" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="business">Business Info</TabsTrigger>
            <TabsTrigger value="swot">SWOT</TabsTrigger>
            <TabsTrigger value="invoice-settings">Invoice Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Their own logo: it heads the portal and goes on their
                    invoices once invoices read the distributor identity. */}
                <div className="flex items-center gap-4 pb-4 border-b">
                  {distributor.logo_url ? (
                    <img
                      src={distributor.logo_url}
                      alt="Logo"
                      className="h-16 w-16 rounded-xl object-contain border bg-background"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-xl border border-dashed flex items-center justify-center text-[10px] text-muted-foreground text-center px-1">
                      No logo
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Company logo</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      Shown at the top of this portal. PNG or JPG, under 2MB.
                    </p>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                    {canManageBranding ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={uploadingLogo}
                        onClick={() => logoInputRef.current?.click()}
                      >
                        {uploadingLogo ? 'Uploading...' : distributor.logo_url ? 'Replace logo' : 'Upload logo'}
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Only an owner or manager can change the logo.
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Contact Person</Label>
                    {isEditing ? (
                      <Input
                        value={formData.contact_person || ''}
                        onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                      />
                    ) : (
                      <div className="flex items-center gap-2 mt-1 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        {distributor.contact_person}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>Phone</Label>
                    {isEditing ? (
                      <Input
                        value={formData.phone || ''}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    ) : (
                      <div className="flex items-center gap-2 mt-1 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {distributor.phone}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>Email</Label>
                    {isEditing ? (
                      <Input
                        type="email"
                        value={formData.email || ''}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    ) : (
                      <div className="flex items-center gap-2 mt-1 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        {distributor.email || '-'}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>GST Number</Label>
                    {isEditing ? (
                      <Input
                        value={formData.gst_number || ''}
                        onChange={(e) => setFormData({ ...formData, gst_number: e.target.value })}
                      />
                    ) : (
                      <div className="flex items-center gap-2 mt-1 text-sm">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {distributor.gst_number || '-'}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Address</Label>
                  {isEditing ? (
                    <Textarea
                      value={formData.address || ''}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      rows={2}
                    />
                  ) : (
                    <div className="flex items-start gap-2 mt-1 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      {distributor.address || '-'}
                    </div>
                  )}
                </div>

                {/* Invoice details. These are what your bills are raised to and
                    where goods are sent -- yours to keep right. */}
                <div className="rounded-lg border p-3 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Billing address — printed on your invoices
                  </p>
                  {isEditing ? (
                    <>
                      <Textarea
                        rows={2}
                        placeholder="Leave blank to use the address above"
                        value={formData.billing_address || ''}
                        onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <Input placeholder="City" value={formData.billing_city || ''}
                          onChange={(e) => setFormData({ ...formData, billing_city: e.target.value })} />
                        <Input placeholder="State" value={formData.billing_state || ''}
                          onChange={(e) => setFormData({ ...formData, billing_state: e.target.value })} />
                        <Input placeholder="Pincode" value={formData.billing_pincode || ''}
                          onChange={(e) => setFormData({ ...formData, billing_pincode: e.target.value })} />
                      </div>
                    </>
                  ) : (
                    <p className="text-sm">
                      {distributor.billing_address
                        || <span className="text-muted-foreground">Using the address above</span>}
                      {[distributor.billing_city, distributor.billing_state, distributor.billing_pincode]
                        .filter(Boolean).length > 0 && (
                        <span className="block text-muted-foreground">
                          {[distributor.billing_city, distributor.billing_state, distributor.billing_pincode]
                            .filter(Boolean).join(', ')}
                        </span>
                      )}
                    </p>
                  )}
                </div>

                <div className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Goods delivery address
                    </p>
                    {isEditing && (
                      <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-primary"
                          checked={formData.delivery_same_as_billing !== false}
                          onChange={(e) => setFormData({ ...formData, delivery_same_as_billing: e.target.checked })}
                        />
                        Same as billing
                      </label>
                    )}
                  </div>
                  {formData.delivery_same_as_billing !== false ? (
                    <p className="text-sm text-muted-foreground">Goods come to the billing address.</p>
                  ) : isEditing ? (
                    <>
                      <Textarea
                        rows={2}
                        placeholder="Godown or warehouse address"
                        value={formData.delivery_address || ''}
                        onChange={(e) => setFormData({ ...formData, delivery_address: e.target.value })}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <Input placeholder="City" value={formData.delivery_city || ''}
                          onChange={(e) => setFormData({ ...formData, delivery_city: e.target.value })} />
                        <Input placeholder="State" value={formData.delivery_state || ''}
                          onChange={(e) => setFormData({ ...formData, delivery_state: e.target.value })} />
                        <Input placeholder="Pincode" value={formData.delivery_pincode || ''}
                          onChange={(e) => setFormData({ ...formData, delivery_pincode: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Input placeholder="Person at the godown" value={formData.delivery_contact_person || ''}
                          onChange={(e) => setFormData({ ...formData, delivery_contact_person: e.target.value })} />
                        <Input placeholder="Their phone" value={formData.delivery_contact_phone || ''}
                          onChange={(e) => setFormData({ ...formData, delivery_contact_phone: e.target.value })} />
                      </div>
                    </>
                  ) : (
                    <p className="text-sm">
                      {distributor.delivery_address || <span className="text-muted-foreground">Not set</span>}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="business" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Business Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Established Year</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={formData.established_year || ''}
                        onChange={(e) => setFormData({ ...formData, established_year: parseInt(e.target.value) || null })}
                      />
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{distributor.established_year || '-'}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>Sales Team Size</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={formData.sales_team_size || ''}
                        onChange={(e) => setFormData({ ...formData, sales_team_size: parseInt(e.target.value) || null })}
                      />
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{distributor.sales_team_size || 0}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>Vans</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={formData.assets_vans || ''}
                        onChange={(e) => setFormData({ ...formData, assets_vans: parseInt(e.target.value) || null })}
                      />
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{distributor.assets_vans || 0}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>Trucks</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={formData.assets_trucks || ''}
                        onChange={(e) => setFormData({ ...formData, assets_trucks: parseInt(e.target.value) || null })}
                      />
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{distributor.assets_trucks || 0}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Network Retailers Count</Label>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={formData.network_retailers_count || ''}
                        onChange={(e) => setFormData({ ...formData, network_retailers_count: parseInt(e.target.value) || null })}
                      />
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <Store className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{distributor.network_retailers_count || 0}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label>Region Coverage</Label>
                    {isEditing ? (
                      <Input
                        value={formData.region_coverage || ''}
                        onChange={(e) => setFormData({ ...formData, region_coverage: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm mt-1">{distributor.region_coverage || '-'}</p>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Coverage Area</Label>
                  {isEditing ? (
                    <Textarea
                      value={formData.coverage_area || ''}
                      onChange={(e) => setFormData({ ...formData, coverage_area: e.target.value })}
                      rows={2}
                    />
                  ) : (
                    <p className="text-sm mt-1">{distributor.coverage_area || '-'}</p>
                  )}
                </div>
                <div>
                  <Label>About Business</Label>
                  {isEditing ? (
                    <Textarea
                      value={formData.about_business || ''}
                      onChange={(e) => setFormData({ ...formData, about_business: e.target.value })}
                      rows={3}
                    />
                  ) : (
                    <p className="text-sm mt-1">{distributor.about_business || '-'}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="swot" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">SWOT Analysis</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
                  <Label className="text-green-700 dark:text-green-300 font-medium">Strengths</Label>
                  {isEditing ? (
                    <Textarea
                      value={formData.strength || ''}
                      onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                      className="mt-2 bg-white dark:bg-background"
                      rows={3}
                    />
                  ) : (
                    <p className="text-sm mt-2">{distributor.strength || '-'}</p>
                  )}
                </div>
                <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg">
                  <Label className="text-red-700 dark:text-red-300 font-medium">Weaknesses</Label>
                  {isEditing ? (
                    <Textarea
                      value={formData.weakness || ''}
                      onChange={(e) => setFormData({ ...formData, weakness: e.target.value })}
                      className="mt-2 bg-white dark:bg-background"
                      rows={3}
                    />
                  ) : (
                    <p className="text-sm mt-2">{distributor.weakness || '-'}</p>
                  )}
                </div>
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                  <Label className="text-blue-700 dark:text-blue-300 font-medium">Opportunities</Label>
                  {isEditing ? (
                    <Textarea
                      value={formData.opportunities || ''}
                      onChange={(e) => setFormData({ ...formData, opportunities: e.target.value })}
                      className="mt-2 bg-white dark:bg-background"
                      rows={3}
                    />
                  ) : (
                    <p className="text-sm mt-2">{distributor.opportunities || '-'}</p>
                  )}
                </div>
                <div className="bg-orange-50 dark:bg-orange-950 p-4 rounded-lg">
                  <Label className="text-orange-700 dark:text-orange-300 font-medium">Threats</Label>
                  {isEditing ? (
                    <Textarea
                      value={formData.threats || ''}
                      onChange={(e) => setFormData({ ...formData, threats: e.target.value })}
                      className="mt-2 bg-white dark:bg-background"
                      rows={3}
                    />
                  ) : (
                    <p className="text-sm mt-2">{distributor.threats || '-'}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoice-settings" className="space-y-4">
            <DistributorCompanyProfile distributorId={distributor.id} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default DistributorProfile;
