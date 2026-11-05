import { useState } from "react";
import { Risk } from "@/hooks/useProjects";
import { useCreateRisk } from "@/hooks/useProjects";
import { AIRiskPredictor } from "./AIRiskPredictor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Plus, Shield, CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props { projectId: string; risks: Risk[]; }

const riskMatrix: Record<string, Record<string, string>> = {
  high: { high: "bg-red-100 text-red-700 border-red-200", medium: "bg-orange-100 text-orange-700 border-orange-200", low: "bg-amber-100 text-amber-700 border-amber-200" },
  medium: { high: "bg-orange-100 text-orange-700 border-orange-200", medium: "bg-yellow-100 text-yellow-700 border-yellow-200", low: "bg-blue-100 text-blue-700 border-blue-200" },
  low: { high: "bg-amber-100 text-amber-700 border-amber-200", medium: "bg-blue-100 text-blue-700 border-blue-200", low: "bg-green-100 text-green-700 border-green-200" },
};

const riskLabel: Record<string, Record<string, string>> = {
  high: { high: "Critical", medium: "High", low: "High" },
  medium: { high: "High", medium: "Medium", low: "Medium" },
  low: { high: "Medium", medium: "Low", low: "Low" },
};

export function RisksPanel({ projectId, risks }: Props) {
  const createRisk = useCreateRisk();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", probability: "medium", impact: "medium", mitigation_plan: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRisk.mutateAsync({ ...form, project_id: projectId, status: "open" });
    setForm({ title: "", description: "", probability: "medium", impact: "medium", mitigation_plan: "" });
    setShowCreate(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" /> Project Risks
        </h2>
        <div className="flex gap-2">
          <AIRiskPredictor projectId={projectId} />
          <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Add Risk
          </Button>
        </div>
      </div>

      {risks.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-xl">
          <Shield className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="font-medium text-foreground">No risks identified</p>
          <p className="text-sm text-muted-foreground">Add risks to track and mitigate project threats.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {risks.map(risk => {
            const riskLevel = riskMatrix[risk.probability]?.[risk.impact] ?? "bg-muted text-muted-foreground";
            const levelLabel = riskLabel[risk.probability]?.[risk.impact] ?? "Unknown";
            return (
              <div
                key={risk.id}
                className={cn("p-4 rounded-xl border relative", risk.status === "open" ? riskLevel : "bg-muted text-muted-foreground border-muted")}
              >
                {(risk as any).ai_generated && (
                  <Badge variant="outline" className="absolute top-2 right-2 text-[9px] gap-0.5 bg-amber-50 text-amber-700 border-amber-200">
                    <Sparkles className="w-2.5 h-2.5" /> AI
                  </Badge>
                )}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-sm">{risk.title}</h3>
                  <div className="flex gap-1 flex-shrink-0">
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-white/50">{levelLabel}</span>
                    <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", risk.status === "open" ? "bg-red-200 text-red-700" : risk.status === "mitigated" ? "bg-green-200 text-green-700" : "bg-muted text-muted-foreground")}>
                      {risk.status}
                    </span>
                  </div>
                </div>
                {risk.description && <p className="text-xs opacity-80 mb-2">{risk.description}</p>}
                <div className="flex gap-3 text-xs opacity-70">
                  <span>Prob: <strong>{risk.probability}</strong></span>
                  <span>Impact: <strong>{risk.impact}</strong></span>
                </div>
                {risk.mitigation_plan && (
                  <div className="mt-2 pt-2 border-t border-current/20">
                    <p className="text-xs opacity-70"><strong>Mitigation:</strong> {risk.mitigation_plan}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Risk</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Risk Title *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Probability</Label>
                <Select value={form.probability} onValueChange={v => setForm(f => ({ ...f, probability: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Impact</Label>
                <Select value={form.impact} onValueChange={v => setForm(f => ({ ...f, impact: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Mitigation Plan</Label><Textarea value={form.mitigation_plan} onChange={e => setForm(f => ({ ...f, mitigation_plan: e.target.value }))} rows={2} placeholder="How will this risk be mitigated?" /></div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" disabled={createRisk.isPending}>Add Risk</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
