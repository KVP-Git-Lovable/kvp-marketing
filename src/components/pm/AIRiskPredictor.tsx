import { useState } from "react";
import { usePMAI } from "@/hooks/usePMAI";
import { useCreateRisk } from "@/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Sparkles, Check, X, Loader2, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
}

interface PredictedRisk {
  title: string;
  description: string;
  probability: string;
  impact: string;
  mitigation_plan: string;
  category: string;
  accepted?: boolean;
}

const categoryLabels: Record<string, string> = {
  schedule_overrun: "Schedule",
  effort_overrun: "Effort",
  resource_bottleneck: "Resource",
  scope_creep: "Scope",
  milestone_at_risk: "Milestone",
  dependency_risk: "Dependency",
  quality_risk: "Quality",
};

export function AIRiskPredictor({ projectId }: Props) {
  const { invoke, loading } = usePMAI();
  const createRisk = useCreateRisk();
  const [predictions, setPredictions] = useState<PredictedRisk[]>([]);
  const [saving, setSaving] = useState(false);

  const predict = async () => {
    const result = await invoke("predict_risks", projectId);
    if (result?.risks) setPredictions(result.risks.map((r: PredictedRisk) => ({ ...r, accepted: false })));
  };

  const acceptRisk = async (idx: number) => {
    const risk = predictions[idx];
    setSaving(true);
    try {
      await createRisk.mutateAsync({
        project_id: projectId,
        title: risk.title,
        description: risk.description,
        probability: risk.probability,
        impact: risk.impact,
        mitigation_plan: risk.mitigation_plan,
        status: "open",
        ai_generated: true,
      } as any);
      setPredictions(prev => prev.map((p, i) => i === idx ? { ...p, accepted: true } : p));
      toast.success("Risk added to register");
    } catch {
      toast.error("Failed to add risk");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button size="sm" onClick={predict} disabled={loading} className="gap-1.5">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-amber-500" />}
        {loading ? "Scanning..." : "AI: Scan for Risks"}
      </Button>

      {predictions.length > 0 && (
        <div className="border border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-green-700 dark:text-green-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> AI Predicted Risks ({predictions.length})
            </span>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setPredictions([])}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          {predictions.map((risk, i) => (
            <div key={i} className={cn(
              "p-3 rounded-md border bg-background space-y-2",
              risk.accepted && "opacity-50"
            )}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-sm font-medium text-foreground">{risk.title}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">{risk.description}</p>
                </div>
                <Badge variant="outline" className="text-[10px] flex-shrink-0">
                  {categoryLabels[risk.category] || risk.category}
                </Badge>
              </div>
              <div className="flex gap-2 text-[10px] text-muted-foreground">
                <span>Prob: <strong className="text-foreground capitalize">{risk.probability}</strong></span>
                <span>Impact: <strong className="text-foreground capitalize">{risk.impact}</strong></span>
              </div>
              {risk.mitigation_plan && (
                <p className="text-xs text-muted-foreground"><strong>Mitigation:</strong> {risk.mitigation_plan}</p>
              )}
              {!risk.accepted ? (
                <Button size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={() => acceptRisk(i)} disabled={saving}>
                  <Check className="w-3 h-3" /> Accept & Add
                </Button>
              ) : (
                <span className="text-xs text-green-600 flex items-center gap-1"><Check className="w-3 h-3" /> Added</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
