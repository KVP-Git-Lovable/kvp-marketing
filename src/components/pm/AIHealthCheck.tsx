import { usePMAI } from "@/hooks/usePMAI";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sparkles, Loader2, AlertTriangle, Clock, TrendingUp, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface Props {
  projectId: string;
}

export function AIHealthCheck({ projectId }: Props) {
  const { invoke, loading, data } = usePMAI();
  const [open, setOpen] = useState(true);

  const healthColors = {
    healthy: "text-green-600 bg-green-50 border-green-200",
    at_risk: "text-amber-600 bg-amber-50 border-amber-200",
    critical: "text-red-600 bg-red-50 border-red-200",
  };

  return (
    <Card className={cn("border", data ? healthColors[data.overall_health as keyof typeof healthColors] || "" : "")}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" /> AI Health Check
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => invoke("health_check", projectId)} disabled={loading} className="gap-1 text-xs h-7">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3" />}
            {loading ? "Analyzing..." : data ? "Refresh" : "Run Check"}
          </Button>
        </div>
      </CardHeader>
      {data && (
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant={data.overall_health === "healthy" ? "default" : "destructive"} className="capitalize">
              {data.overall_health?.replace("_", " ")}
            </Badge>
            <p className="text-sm text-foreground">{data.summary}</p>
          </div>

          {(data.schedule_overruns?.length > 0 || data.effort_overruns?.length > 0) && (
            <Collapsible open={open} onOpenChange={setOpen}>
              <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                <ChevronDown className={cn("w-3 h-3 transition-transform", open && "rotate-180")} />
                {(data.schedule_overruns?.length || 0) + (data.effort_overruns?.length || 0)} alerts
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 space-y-2">
                {data.schedule_overruns?.map((a: any, i: number) => (
                  <div key={`s${i}`} className="flex items-start gap-2 text-xs p-2 rounded bg-muted/50">
                    <Clock className={cn("w-3.5 h-3.5 mt-0.5 flex-shrink-0", a.severity === "critical" ? "text-red-500" : "text-amber-500")} />
                    <div>
                      <span className="font-medium text-foreground">{a.task_title}</span>
                      <p className="text-muted-foreground">{a.reason}</p>
                    </div>
                  </div>
                ))}
                {data.effort_overruns?.map((a: any, i: number) => (
                  <div key={`e${i}`} className="flex items-start gap-2 text-xs p-2 rounded bg-muted/50">
                    <AlertTriangle className={cn("w-3.5 h-3.5 mt-0.5 flex-shrink-0", a.severity === "critical" ? "text-red-500" : "text-amber-500")} />
                    <div>
                      <span className="font-medium text-foreground">{a.task_title}</span>
                      <p className="text-muted-foreground">Est: {a.estimated}h → Logged: {a.logged}h</p>
                    </div>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          {data.recommendations?.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Recommendations</span>
              <ul className="text-xs text-foreground space-y-0.5">
                {data.recommendations.map((r: string, i: number) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-primary">•</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
