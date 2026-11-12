import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { expectedRoiPct } from "@/lib/journeyCampaign";

export interface PlanningValues {
  ownerId: string; // "" = current user (set by the server on create)
  expectedRevenue: string;
  expectedResponsePct: string;
}

interface FieldsProps {
  open: boolean;
  values: PlanningValues;
  onChange: (next: PlanningValues) => void;
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

/** Campaign Owner, Expected Revenue and Expected Response % (all optional, informational only). */
export function CampaignPlanningFields({ open, values, onChange }: FieldsProps) {
  const { data: owners = [] } = useQuery({
    queryKey: ["journey-owner-options"],
    enabled: open,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name").not("full_name", "is", null).order("full_name").limit(500);
      if (error) throw error;
      return (data || []) as Array<{ id: string; full_name: string | null }>;
    },
  });

  return (
    <>
      <div>
        <Label className="text-xs text-muted-foreground">Campaign Owner</Label>
        <Select value={values.ownerId || "__me__"} onValueChange={(v) => onChange({ ...values, ownerId: v === "__me__" ? "" : v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__me__">Me (default)</SelectItem>
            {owners.map((o) => <SelectItem key={o.id} value={o.id}>{o.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Expected Revenue (₹)</Label>
          <Input type="number" min="0" step="any" value={values.expectedRevenue}
            onChange={(e) => onChange({ ...values, expectedRevenue: e.target.value })} placeholder="Optional" />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Expected Response (%)</Label>
          <Input type="number" min="0" max="100" step="any" value={values.expectedResponsePct}
            onChange={(e) => onChange({ ...values, expectedResponsePct: e.target.value })} placeholder="Optional" />
        </div>
      </div>
    </>
  );
}

interface SummaryProps {
  contacts: number | null;
  budget: string;
  expectedRevenue: string;
  expectedResponsePct: string;
  /** Render without its own card/title (used inside the Planning card). */
  bare?: boolean;
}

/** Salesforce-style "Planning" read-out computed from what is entered; nothing is stored. */
export function CampaignPlanningSummary({ contacts, budget, expectedRevenue, expectedResponsePct, bare }: SummaryProps) {
  const roi = expectedRoiPct(expectedRevenue, budget);
  const resp = expectedResponsePct.trim() !== "" && contacts != null ? Math.round((Number(expectedResponsePct) / 100) * contacts) : null;
  const rows: Array<[string, string]> = [
    ["Contacts in Campaign", contacts == null ? "—" : contacts.toLocaleString("en-IN")],
    ["Budgeted Cost", budget.trim() === "" ? "No cap" : inr(Number(budget))],
    ["Expected Revenue", expectedRevenue.trim() === "" ? "—" : inr(Number(expectedRevenue))],
    ["Expected Responses", resp == null ? "—" : resp.toLocaleString("en-IN")],
    ["Expected ROI", roi == null ? "—" : `${roi.toFixed(0)}%`],
  ];
  const grid = (
    <div className="grid grid-cols-2 gap-2">
      {rows.map(([k, v]) => (
        <div key={k} className="rounded-md bg-muted/50 px-2.5 py-1.5">
          <p className="text-[11px] text-muted-foreground">{k}</p>
          <p className={`text-sm font-semibold ${k === "Expected ROI" && roi != null ? (roi >= 0 ? "text-green-700" : "text-red-600") : ""}`}>{v}</p>
        </div>
      ))}
    </div>
  );
  if (bare) return grid;
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <Label className="text-sm font-medium">Planning</Label>
      {grid}
    </div>
  );
}
