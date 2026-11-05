import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Building2, 
  User, 
  FileText, 
  Table, 
  Calculator, 
  CreditCard, 
  FileSignature,
  Save,
  RotateCcw
} from 'lucide-react';
import { useInvoiceDisplaySettings, SETTING_CATEGORIES } from '@/hooks/useInvoiceDisplaySettings';
import { toast } from 'sonner';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  header: <Building2 className="h-4 w-4" />,
  billto: <User className="h-4 w-4" />,
  details: <FileText className="h-4 w-4" />,
  table: <Table className="h-4 w-4" />,
  totals: <Calculator className="h-4 w-4" />,
  payment: <CreditCard className="h-4 w-4" />,
  footer: <FileSignature className="h-4 w-4" />,
};

export default function InvoiceDisplaySettings() {
  const { 
    settings, 
    isLoading, 
    isSaving,
    updateSetting,
    getSettingsByCategory 
  } = useInvoiceDisplaySettings();
  
  const [pendingChanges, setPendingChanges] = useState<Record<string, boolean>>({});

  const handleToggle = async (settingKey: string, currentEnabled: boolean) => {
    await updateSetting(settingKey, !currentEnabled);
  };

  const handleResetAll = async () => {
    // Reset all settings to enabled
    const allSettings = settings.map(s => ({ setting_key: s.setting_key, enabled: true }));
    for (const setting of allSettings) {
      await updateSetting(setting.setting_key, true);
    }
    toast.success('All settings reset to defaults');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoice Display Settings
          </CardTitle>
          <CardDescription>
            Control which information appears on all invoices. Changes are saved automatically.
          </CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleResetAll}
          disabled={isSaving}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset All
        </Button>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" defaultValue={Object.keys(SETTING_CATEGORIES)} className="space-y-2">
          {Object.entries(SETTING_CATEGORIES).map(([category, label]) => {
            const categorySettings = getSettingsByCategory(category);
            const enabledCount = categorySettings.filter(s => s.enabled).length;
            
            return (
              <AccordionItem 
                key={category} 
                value={category}
                className="border rounded-lg px-4"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    {CATEGORY_ICONS[category]}
                    <span className="font-medium">{label}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {enabledCount}/{categorySettings.length} active
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-2 pb-4">
                    {categorySettings.map(setting => (
                      <div 
                        key={setting.id} 
                        className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-colors"
                      >
                        <Label 
                          htmlFor={setting.setting_key} 
                          className="cursor-pointer flex-1"
                        >
                          {setting.display_label}
                        </Label>
                        <Switch
                          id={setting.setting_key}
                          checked={setting.enabled}
                          onCheckedChange={() => handleToggle(setting.setting_key, setting.enabled)}
                          disabled={isSaving}
                        />
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium text-sm mb-2">How it works</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Toggle settings on/off to control what appears on invoices</li>
            <li>• Changes apply to all future invoices automatically</li>
            <li>• Use "Reset All" to enable all fields again</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
