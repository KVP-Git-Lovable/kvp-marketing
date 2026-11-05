import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Upload, Star, Plus, Edit2, Trash2, ChevronDown, ChevronUp, FileText, Paintbrush } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { awardPointsForBrandingRequest } from "@/utils/gamificationPointsAwarder";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";

interface BrandingRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  defaultVisitId?: string | null;
  defaultRetailerId?: string | null;
  defaultPincode?: string | null;
  onCreated?: (id: string) => void;
  editId?: string | null;
  editData?: any;
}

interface RetailerOption { id: string; name: string; address?: string | null }

interface AssetLineItem {
  id: string;
  // Request fields
  assetType: string;
  dueDate: string;
  size: string;
  quantity: string;
  photoUrls: string[];
  impactToBusiness: string;
  contractDocUrls: string[];
  // Status fields
  status: string;
  budget: string;
  vendorName: string;
  implementationTargetDate: string;
  vendorCommittedDate: string;
  inputToVendor: string;
  vendorWorkRating: number;
  // Implementation fields
  implementationPhotoUrls: string[];
  retailerFeedbackRating: number;
  fieldSalesTeamRating: number;
  impactRating: number;
}

const emptyAsset: AssetLineItem = {
  id: '',
  assetType: '',
  dueDate: '',
  size: '',
  quantity: '',
  photoUrls: [],
  impactToBusiness: '',
  contractDocUrls: [],
  status: 'Request received',
  budget: '',
  vendorName: '',
  implementationTargetDate: '',
  vendorCommittedDate: '',
  inputToVendor: '',
  vendorWorkRating: 0,
  implementationPhotoUrls: [],
  retailerFeedbackRating: 0,
  fieldSalesTeamRating: 0,
  impactRating: 0,
};

export const BrandingRequestModal = ({ isOpen, onClose, onBack, defaultVisitId, defaultRetailerId, defaultPincode, onCreated, editId, editData }: BrandingRequestModalProps) => {
  const [loading, setLoading] = useState(false);
  const [retailerId, setRetailerId] = useState<string | undefined>(defaultRetailerId || undefined);
  const [visitId, setVisitId] = useState<string | undefined>(defaultVisitId || undefined);
  const [retailers, setRetailers] = useState<RetailerOption[]>([]);
  
  // Asset Line Items
  const [assetLineItems, setAssetLineItems] = useState<AssetLineItem[]>([]);
  const [showAddAssetForm, setShowAddAssetForm] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [currentAsset, setCurrentAsset] = useState<AssetLineItem>({ ...emptyAsset });
  const [itemsCollapsed, setItemsCollapsed] = useState<Record<string, boolean>>({});
  const [uploadingAssetId, setUploadingAssetId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setAssetLineItems([]);
    setShowAddAssetForm(true);
    setCurrentAsset({ ...emptyAsset });
  }, [isOpen]);

  useEffect(() => {
    const loadRetailers = async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) return;
      const { data, error } = await supabase
        .from('retailers')
        .select('id, name, address')
        .eq('user_id', uid)
        .order('name');
      if (!error && data) setRetailers(data as any);
    };
    loadRetailers();
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, assetId: string | null, type: 'request' | 'implementation' | 'contract') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingAssetId(assetId || 'current');
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('Not authenticated');

      const uploadedUrls: string[] = [];
      const bucket = type === 'contract' ? 'branding-documents' : 'branding-photos';

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}-${i}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from(bucket)
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      }

      if (assetId) {
        // Updating existing asset
        setAssetLineItems(prev => prev.map(item => {
          if (item.id === assetId) {
            if (type === 'request') {
              return { ...item, photoUrls: [...item.photoUrls, ...uploadedUrls] };
            } else if (type === 'contract') {
              return { ...item, contractDocUrls: [...item.contractDocUrls, ...uploadedUrls] };
            } else {
              return { ...item, implementationPhotoUrls: [...item.implementationPhotoUrls, ...uploadedUrls] };
            }
          }
          return item;
        }));
      } else {
        // Updating current form asset
        if (type === 'request') {
          setCurrentAsset(prev => ({ ...prev, photoUrls: [...prev.photoUrls, ...uploadedUrls] }));
        } else if (type === 'contract') {
          setCurrentAsset(prev => ({ ...prev, contractDocUrls: [...prev.contractDocUrls, ...uploadedUrls] }));
        }
      }
      
      toast({ title: type === 'contract' ? "Documents uploaded" : "Photos uploaded", description: `${uploadedUrls.length} file(s) added` });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploadingAssetId(null);
    }
  };

  const handleAddAsset = () => {
    if (!currentAsset.assetType) {
      toast({ title: 'Asset type required', variant: 'destructive' });
      return;
    }
    
    // Validate due date is greater than today
    if (currentAsset.dueDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(currentAsset.dueDate);
      if (dueDate <= today) {
        toast({ title: 'Due date must be greater than today', variant: 'destructive' });
        return;
      }
    }
    
    if (editingAssetId) {
      setAssetLineItems(assetLineItems.map(item => 
        item.id === editingAssetId ? currentAsset : item
      ));
      toast({ title: 'Asset updated' });
    } else {
      const newItem = { ...currentAsset, id: crypto.randomUUID() };
      setAssetLineItems([...assetLineItems, newItem]);
      toast({ title: 'Asset added' });
    }
    
    setShowAddAssetForm(false);
    setEditingAssetId(null);
    setCurrentAsset({ ...emptyAsset });
  };

  const handleEditAsset = (item: AssetLineItem) => {
    setCurrentAsset(item);
    setEditingAssetId(item.id);
    setShowAddAssetForm(true);
  };

  const handleDeleteAsset = (id: string) => {
    setAssetLineItems(assetLineItems.filter(item => item.id !== id));
    toast({ title: 'Asset removed' });
  };

  const updateAssetField = (assetId: string, field: keyof AssetLineItem, value: any) => {
    setAssetLineItems(prev => prev.map(item => 
      item.id === assetId ? { ...item, [field]: value } : item
    ));
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error('Not authenticated');
      if (!retailerId) throw new Error('Please select a retailer');
      if (assetLineItems.length === 0) throw new Error('Please add at least one asset');

      // If no visitId provided, we need to find or create one
      let finalVisitId = visitId;
      if (!finalVisitId) {
        const today = new Date().toISOString().split('T')[0];
        // Try to find existing visit for this retailer today
        const { data: existingVisit } = await supabase
          .from('visits')
          .select('id')
          .eq('user_id', uid)
          .eq('retailer_id', retailerId)
          .eq('planned_date', today)
          .maybeSingle();
        
        if (existingVisit) {
          finalVisitId = existingVisit.id;
        } else {
          // Create a new visit
          const { data: newVisit, error: visitError } = await supabase
            .from('visits')
            .insert({
              user_id: uid,
              retailer_id: retailerId,
              planned_date: today,
              status: 'planned'
            })
            .select('id')
            .single();
          
          if (visitError) throw visitError;
          finalVisitId = newVisit.id;
        }
      }

      const payload: any = {
        user_id: uid,
        retailer_id: retailerId,
        visit_id: finalVisitId,
        title: 'Branding Request',
      };

      const { data, error } = await supabase.from('branding_requests').insert(payload).select('id').single();
      if (error) throw error;

      // Insert line items with all the new fields
      const itemsPayload = assetLineItems.map(item => ({
        branding_request_id: data.id,
        asset_type: item.assetType,
        due_date: item.dueDate || null,
      }));

      const { error: itemsError } = await supabase.from('branding_request_items').insert(itemsPayload);
      if (itemsError) throw itemsError;

      // Award gamification points for branding request
      await awardPointsForBrandingRequest(uid, retailerId);

      toast({ title: 'Branding request submitted', description: 'Your request has been created.' });
      onCreated?.(data!.id);
      onClose();
    } catch (err: any) {
      toast({ title: 'Submit failed', description: err.message || 'Try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const assetOptions = [
    "Name board",
    "Paint side walls",
    "Instore marketing board",
    "Free samples",
    "Shelf branding",
    "Window graphics",
    "Floor graphics",
    "Banner stands",
    "Posters",
    "Other"
  ];

  const impactOptions = [
    "High",
    "Medium",
    "Low",
    "Not Sure"
  ];

  const statusOptions = [
    "Request received",
    "Approved",
    "In progress",
    "Delayed",
    "Work completed",
    "Implemented",
    "Rejected"
  ];

  const showTargetDateStatuses = ["Approved", "In progress", "Delayed", "Work completed", "Implemented"];

  const getTodayString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const StarRating = ({ value, onChange, disabled = false }: { value: number; onChange: (val: number) => void; disabled?: boolean }) => (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <Button
          key={star}
          type="button"
          variant={value >= star ? "default" : "outline"}
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => !disabled && onChange(star)}
          disabled={disabled}
        >
          <Star className={`h-4 w-4 ${value >= star ? 'fill-current' : ''}`} />
        </Button>
      ))}
      {value > 0 && !disabled && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(0)}>
          Clear
        </Button>
      )}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header with gradient */}
        <div className="bg-gradient-to-br from-orange-500/10 via-amber-400/5 to-background p-6 pb-4 sticky top-0 z-10">
          <DialogHeader>
            <div className="flex items-center gap-3">
              {onBack && (
                <Button variant="ghost" size="sm" onClick={onBack} className="p-1 h-8 w-8">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                <Paintbrush className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">Branding Request</DialogTitle>
                {retailers.find(r => r.id === retailerId) && (
                  <p className="text-sm text-muted-foreground mt-0.5">{retailers.find(r => r.id === retailerId)?.name}</p>
                )}
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6">
          <Tabs defaultValue="request" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-muted/50">
              <TabsTrigger value="request" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-700 dark:data-[state=active]:text-orange-300">Request</TabsTrigger>
              <TabsTrigger value="status" className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300">Status</TabsTrigger>
              <TabsTrigger value="implementation" className="data-[state=active]:bg-green-500/20 data-[state=active]:text-green-700 dark:data-[state=active]:text-green-300">Implementation</TabsTrigger>
            </TabsList>

            {/* REQUEST TAB */}
            <TabsContent value="request" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Retailer *</Label>
                  <Select value={retailerId} onValueChange={setRetailerId} disabled={!!defaultRetailerId}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select retailer" />
                    </SelectTrigger>
                    <SelectContent>
                      {retailers.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Asset Line Items */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Assets</Label>

                {showAddAssetForm && (
                  <Card className="border-primary/50 shadow-sm">
                    <CardContent className="pt-5 space-y-5">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Asset Type Requested *</Label>
                        <Select value={currentAsset.assetType} onValueChange={(val) => setCurrentAsset({...currentAsset, assetType: val})}>
                          <SelectTrigger className="h-10">
                            <SelectValue placeholder="Select asset type" />
                          </SelectTrigger>
                          <SelectContent>
                            {assetOptions.map(option => (
                              <SelectItem key={option} value={option}>{option}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Due Date Requested</Label>
                          <Input 
                            type="date" 
                            value={currentAsset.dueDate} 
                            onChange={(e) => setCurrentAsset({...currentAsset, dueDate: e.target.value})} 
                            min={getTodayString()}
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Size</Label>
                          <Input value={currentAsset.size} onChange={(e) => setCurrentAsset({...currentAsset, size: e.target.value})} placeholder="e.g., 4x6 ft" className="h-10" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Quantity</Label>
                          <Input type="number" value={currentAsset.quantity} onChange={(e) => setCurrentAsset({...currentAsset, quantity: e.target.value})} placeholder="1" min="1" className="h-10" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Impact to Business</Label>
                          <Select value={currentAsset.impactToBusiness} onValueChange={(val) => setCurrentAsset({...currentAsset, impactToBusiness: val})}>
                            <SelectTrigger className="h-10">
                              <SelectValue placeholder="Select impact" />
                            </SelectTrigger>
                            <SelectContent>
                              {impactOptions.map(option => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Add Photos</Label>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => document.getElementById('asset-photos-new')?.click()}
                            disabled={uploadingAssetId === 'current'}
                            className="flex-1 h-10"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {uploadingAssetId === 'current' ? 'Uploading...' : 'Upload Photos'}
                          </Button>
                          <input
                            id="asset-photos-new"
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => handlePhotoUpload(e, null, 'request')}
                            className="hidden"
                          />
                          {currentAsset.photoUrls.length > 0 && (
                            <Badge variant="secondary">{currentAsset.photoUrls.length} photo(s)</Badge>
                          )}
                        </div>
                        {currentAsset.photoUrls.length > 0 && (
                          <div className="grid grid-cols-4 gap-2 mt-2">
                            {currentAsset.photoUrls.map((url, idx) => (
                              <img key={idx} src={url} alt={`Photo ${idx + 1}`} className="w-full h-16 object-cover rounded-md border" />
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Branding Contract Document</Label>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => document.getElementById('asset-contract-new')?.click()}
                            disabled={uploadingAssetId === 'current'}
                            className="flex-1 h-10"
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Upload Documents
                          </Button>
                          <input
                            id="asset-contract-new"
                            type="file"
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                            multiple
                            onChange={(e) => handlePhotoUpload(e, null, 'contract')}
                            className="hidden"
                          />
                          {currentAsset.contractDocUrls.length > 0 && (
                            <Badge variant="secondary">{currentAsset.contractDocUrls.length} doc(s)</Badge>
                          )}
                        </div>
                        {currentAsset.contractDocUrls.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {currentAsset.contractDocUrls.map((url, idx) => (
                              <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1 bg-muted px-2 py-1 rounded">
                                <FileText className="h-3 w-3" />
                                Document {idx + 1}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 justify-end pt-2">
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setShowAddAssetForm(false);
                            setEditingAssetId(null);
                            setCurrentAsset({ ...emptyAsset });
                          }}
                        >
                          Cancel
                        </Button>
                        <Button type="button" size="sm" onClick={handleAddAsset}>
                          {editingAssetId ? 'Update' : 'Add'} Asset
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {assetLineItems.length > 0 && (
                  <div className="space-y-2">
                    {assetLineItems.map((item) => (
                      <Card key={item.id}>
                        <Collapsible open={!itemsCollapsed[item.id]} onOpenChange={(open) => setItemsCollapsed({...itemsCollapsed, [item.id]: !open})}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    {itemsCollapsed[item.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                                  </Button>
                                </CollapsibleTrigger>
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{item.assetType}</p>
                                  {item.impactToBusiness && (
                                    <Badge variant="secondary" className="text-xs mt-1">
                                      {item.impactToBusiness} Impact
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEditAsset(item)}>
                                  <Edit2 className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => handleDeleteAsset(item.id)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>

                            <CollapsibleContent className="mt-3 space-y-2 text-sm">
                              {item.dueDate && <div className="flex justify-between"><span className="text-muted-foreground">Due Date:</span><span>{new Date(item.dueDate).toLocaleDateString()}</span></div>}
                              {item.size && <div className="flex justify-between"><span className="text-muted-foreground">Size:</span><span>{item.size}</span></div>}
                              {item.quantity && <div className="flex justify-between"><span className="text-muted-foreground">Quantity:</span><span>{item.quantity}</span></div>}
                              {item.photoUrls.length > 0 && (
                                <div className="grid grid-cols-4 gap-2 mt-2">
                                  {item.photoUrls.map((url, idx) => (
                                    <img key={idx} src={url} alt={`Photo ${idx + 1}`} className="w-full h-16 object-cover rounded" />
                                  ))}
                                </div>
                              )}
                            </CollapsibleContent>
                          </CardContent>
                        </Collapsible>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Add Asset button below assets */}
                {!showAddAssetForm && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddAssetForm(true)}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Asset
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>

          {/* STATUS TAB */}
          <TabsContent value="status" className="space-y-4 mt-4">
            <div className="space-y-4">
              {assetLineItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No assets added yet. Add assets in the Request tab.</p>
                </div>
              ) : (
                assetLineItems.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="p-4 space-y-4">
                      {/* Read-only Request info */}
                      <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                        <h4 className="font-semibold">{item.assetType}</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {item.dueDate && <div><span className="text-muted-foreground">Due:</span> {new Date(item.dueDate).toLocaleDateString()}</div>}
                          {item.size && <div><span className="text-muted-foreground">Size:</span> {item.size}</div>}
                          {item.quantity && <div><span className="text-muted-foreground">Qty:</span> {item.quantity}</div>}
                          {item.impactToBusiness && <div><span className="text-muted-foreground">Impact:</span> {item.impactToBusiness}</div>}
                        </div>
                        {item.photoUrls.length > 0 && (
                          <div className="grid grid-cols-6 gap-1 mt-2">
                            {item.photoUrls.map((url, idx) => (
                              <img key={idx} src={url} alt={`Photo ${idx + 1}`} className="w-full h-12 object-cover rounded" />
                            ))}
                          </div>
                        )}
                      </div>

                      <Separator />

                      {/* Editable Status Fields */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-sm">Status</Label>
                          <Select value={item.status} onValueChange={(val) => updateAssetField(item.id, 'status', val)}>
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {statusOptions.map(option => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-sm">Budget (₹)</Label>
                          <Input
                            type="number"
                            value={item.budget}
                            onChange={(e) => updateAssetField(item.id, 'budget', e.target.value)}
                            placeholder="Enter budget"
                            className="h-9"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-sm">Vendor Name</Label>
                          <Input
                            value={item.vendorName}
                            onChange={(e) => updateAssetField(item.id, 'vendorName', e.target.value)}
                            placeholder="Enter vendor name"
                            className="h-9"
                          />
                        </div>

                        {showTargetDateStatuses.includes(item.status) && (
                          <div className="space-y-1">
                            <Label className="text-sm">Implementation Target Date</Label>
                            <Input
                              type="date"
                              value={item.implementationTargetDate}
                              onChange={(e) => updateAssetField(item.id, 'implementationTargetDate', e.target.value)}
                              min={getTodayString()}
                              className="h-9"
                            />
                          </div>
                        )}

                        <div className="space-y-1">
                          <Label className="text-sm">Vendor Committed Date</Label>
                          <Input
                            type="date"
                            value={item.vendorCommittedDate}
                            onChange={(e) => updateAssetField(item.id, 'vendorCommittedDate', e.target.value)}
                            min={getTodayString()}
                            className="h-9"
                          />
                        </div>

                        <div className="space-y-1 md:col-span-2">
                          <Label className="text-sm">Input to Vendor</Label>
                          <Textarea
                            value={item.inputToVendor}
                            onChange={(e) => updateAssetField(item.id, 'inputToVendor', e.target.value)}
                            placeholder="Instructions or notes for the vendor"
                            className="min-h-[60px]"
                            rows={2}
                          />
                        </div>

                        <div className="space-y-1 md:col-span-2">
                          <Label className="text-sm">Feedback on Vendor's Work</Label>
                          <StarRating 
                            value={item.vendorWorkRating} 
                            onChange={(val) => updateAssetField(item.id, 'vendorWorkRating', val)} 
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* IMPLEMENTATION TAB */}
          <TabsContent value="implementation" className="space-y-4 mt-4">
            <div className="space-y-4">
              {assetLineItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No assets added yet. Add assets in the Request tab.</p>
                </div>
              ) : (
                assetLineItems.map((item) => (
                  <Card key={item.id}>
                    <CardContent className="p-4 space-y-4">
                      {/* Read-only Status info */}
                      <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold">{item.assetType}</h4>
                          <Badge variant={item.status === 'Rejected' ? 'destructive' : 'secondary'}>
                            {item.status}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {item.dueDate && <div><span className="text-muted-foreground">Due:</span> {new Date(item.dueDate).toLocaleDateString()}</div>}
                          {item.size && <div><span className="text-muted-foreground">Size:</span> {item.size}</div>}
                          {item.quantity && <div><span className="text-muted-foreground">Qty:</span> {item.quantity}</div>}
                          {item.budget && <div><span className="text-muted-foreground">Budget:</span> ₹{Number(item.budget).toLocaleString()}</div>}
                          {item.vendorName && <div><span className="text-muted-foreground">Vendor:</span> {item.vendorName}</div>}
                          {item.implementationTargetDate && <div><span className="text-muted-foreground">Target:</span> {new Date(item.implementationTargetDate).toLocaleDateString()}</div>}
                        </div>
                        {item.vendorWorkRating > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">Vendor Rating:</span>
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map(star => (
                                <Star key={star} className={`h-3 w-3 ${item.vendorWorkRating >= star ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <Separator />

                      {/* Implementation Fields */}
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <Label className="text-sm">Implementation Photos</Label>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => document.getElementById(`impl-photos-${item.id}`)?.click()}
                              disabled={uploadingAssetId === item.id}
                              className="flex-1"
                            >
                              <Upload className="h-4 w-4 mr-2" />
                              {uploadingAssetId === item.id ? 'Uploading...' : 'Upload Photos'}
                            </Button>
                            <input
                              id={`impl-photos-${item.id}`}
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(e) => handlePhotoUpload(e, item.id, 'implementation')}
                              className="hidden"
                            />
                            {item.implementationPhotoUrls.length > 0 && (
                              <Badge>{item.implementationPhotoUrls.length} photo(s)</Badge>
                            )}
                          </div>
                          {item.implementationPhotoUrls.length > 0 && (
                            <div className="grid grid-cols-4 gap-2 mt-2">
                              {item.implementationPhotoUrls.map((url, idx) => (
                                <img key={idx} src={url} alt={`Implementation ${idx + 1}`} className="w-full h-20 object-cover rounded" />
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm">Feedback on Asset by Retailer</Label>
                          <StarRating 
                            value={item.retailerFeedbackRating} 
                            onChange={(val) => updateAssetField(item.id, 'retailerFeedbackRating', val)} 
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm">Field Sales Team Feedback</Label>
                          <StarRating 
                            value={item.fieldSalesTeamRating} 
                            onChange={(val) => updateAssetField(item.id, 'fieldSalesTeamRating', val)} 
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-sm">Impact to Business by this Asset</Label>
                          <StarRating 
                            value={item.impactRating} 
                            onChange={(val) => updateAssetField(item.id, 'impactRating', val)} 
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={onClose} className="h-10">Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading} className="h-10 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600">{loading ? 'Submitting...' : 'Submit Request'}</Button>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BrandingRequestModal;
