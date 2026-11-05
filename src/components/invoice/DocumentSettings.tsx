import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, FileText, Truck, ClipboardList, BarChart3, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getDocumentSettings, updateDocumentSettings, DocumentType } from "@/utils/documentHeaderSource";

type HeaderSource = 'company' | 'distributor';

interface DocumentSettingsState {
  invoices: HeaderSource;
  delivery_challans: HeaderSource;
  summaries: HeaderSource;
  reports: HeaderSource;
}

export default function DocumentSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [distributorEnabled, setDistributorEnabled] = useState(false);
  const [settings, setSettings] = useState<DocumentSettingsState>({
    invoices: 'company',
    delivery_challans: 'company',
    summaries: 'company',
    reports: 'company',
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { headerSource, distributorEnabled: enabled } = await getDocumentSettings();
      setSettings(headerSource);
      setDistributorEnabled(enabled);
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const success = await updateDocumentSettings(settings, distributorEnabled);
      if (success) {
        toast.success('Document settings saved successfully');
      } else {
        toast.error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSourceChange = (docType: DocumentType, value: HeaderSource) => {
    setSettings(prev => ({ ...prev, [docType]: value }));
  };

  const documentTypes: { key: DocumentType; label: string; icon: React.ReactNode; description: string }[] = [
    { 
      key: 'invoices', 
      label: 'Invoices', 
      icon: <FileText className="h-4 w-4" />,
      description: 'Tax invoices and bills'
    },
    { 
      key: 'delivery_challans', 
      label: 'Delivery Challans', 
      icon: <Truck className="h-4 w-4" />,
      description: 'Delivery and dispatch documents'
    },
    { 
      key: 'summaries', 
      label: 'Summaries', 
      icon: <ClipboardList className="h-4 w-4" />,
      description: 'Order and visit summaries'
    },
    { 
      key: 'reports', 
      label: 'Reports', 
      icon: <BarChart3 className="h-4 w-4" />,
      description: 'Analytics and reports'
    },
  ];

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Document Header Settings</CardTitle>
        <CardDescription>
          Configure whether documents display company or distributor details in the header.
          When distributor is selected, the system uses the retailer's mapped distributor details.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Master Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
          <div className="space-y-0.5">
            <Label htmlFor="distributor-toggle" className="text-base font-medium">
              Enable Distributor Details
            </Label>
            <p className="text-sm text-muted-foreground">
              When enabled, documents can show distributor details instead of company details
            </p>
          </div>
          <Switch
            id="distributor-toggle"
            checked={distributorEnabled}
            onCheckedChange={setDistributorEnabled}
          />
        </div>

        {/* Document Type Settings */}
        <div className="space-y-4">
          <Label className="text-sm font-medium text-muted-foreground">
            Header Source for Each Document Type
          </Label>
          
          <div className="grid gap-4">
            {documentTypes.map(({ key, label, icon, description }) => (
              <div 
                key={key} 
                className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                  !distributorEnabled ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-primary/10 text-primary">
                    {icon}
                  </div>
                  <div>
                    <p className="font-medium">{label}</p>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </div>
                </div>
                <Select
                  value={settings[key]}
                  onValueChange={(value: HeaderSource) => handleSourceChange(key, value)}
                  disabled={!distributorEnabled}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company">Company</SelectItem>
                    <SelectItem value="distributor">Distributor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>

        {/* Info Box */}
        <div className="p-4 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Note:</strong> If a retailer doesn't have a distributor mapped, 
            documents will automatically use company details as a fallback.
          </p>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
