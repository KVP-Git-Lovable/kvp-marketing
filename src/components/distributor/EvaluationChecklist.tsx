import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  distributorId: string;
  checklist: Record<string, boolean>;
  onUpdate: () => void;
}

const CHECKLIST_ITEMS = [
  { key: "business_registration", label: "Business Registration Verified" },
  { key: "gst_certificate", label: "GST Certificate Collected" },
  { key: "bank_details", label: "Bank Details Verified" },
  { key: "address_verified", label: "Business Address Verified" },
  { key: "warehouse_visit", label: "Warehouse/Godown Visit Completed" },
  { key: "infrastructure_check", label: "Infrastructure Assessment Done" },
  { key: "fleet_verification", label: "Fleet/Vehicle Verification" },
  { key: "team_verification", label: "Sales Team Verification" },
  { key: "reference_check", label: "Reference Check Completed" },
  { key: "credit_check", label: "Credit/Financial Check Done" },
  { key: "contract_signed", label: "Distribution Agreement Signed" },
  { key: "training_completed", label: "Product Training Completed" },
  { key: "system_access", label: "System Access Provided" },
  { key: "first_order", label: "First Order Placed" },
];

export function EvaluationChecklist({ distributorId, checklist, onUpdate }: Props) {
  const [items, setItems] = useState<Record<string, boolean>>(checklist || {});
  const [saving, setSaving] = useState(false);

  const handleToggle = (key: string, checked: boolean) => {
    setItems(prev => ({ ...prev, [key]: checked }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('distributors')
        .update({ evaluation_checklist: items })
        .eq('id', distributorId);

      if (error) throw error;
      toast.success("Checklist saved");
      onUpdate();
    } catch (error: any) {
      toast.error("Failed to save: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const completedCount = Object.values(items).filter(Boolean).length;
  const totalCount = CHECKLIST_ITEMS.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Onboarding Evaluation
          </CardTitle>
          <span className="text-sm text-muted-foreground">
            {completedCount}/{totalCount} ({progressPercent}%)
          </span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden mt-2">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {CHECKLIST_ITEMS.map(item => (
          <div key={item.key} className="flex items-center gap-3">
            <Checkbox
              id={item.key}
              checked={items[item.key] || false}
              onCheckedChange={(checked) => handleToggle(item.key, !!checked)}
            />
            <Label
              htmlFor={item.key}
              className={`text-sm cursor-pointer ${items[item.key] ? 'text-muted-foreground line-through' : ''}`}
            >
              {item.label}
            </Label>
          </div>
        ))}

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full mt-4 gap-2"
          variant="outline"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Checklist"}
        </Button>
      </CardContent>
    </Card>
  );
}
