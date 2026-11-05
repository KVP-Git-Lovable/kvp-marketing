import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ClipboardCheck, Check, CircleDashed, CircleDot, CircleSlash,
  AlertTriangle, ChevronDown, ChevronUp, Lock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  SETUP_STAGES, SETUP_STEPS, SETUP_STATUSES,
  isSettled, statusFromMeasure, measureSummary, contextSummary,
  type Measure, type SetupStage, type SetupStep, type SetupStatus,
} from "./priceBookSetupSteps";

/**
 * Price Book & Units setup, as a checklist that mostly fills itself in.
 *
 * Built to read like the distributor onboarding checklist, with one
 * difference that matters: a step carrying a `measure` is answered by the
 * data, not by someone remembering to tick it. "0 of 146 products have an
 * MRP" is a fact; "MRP done ✓" next to an empty column is how a checklist
 * stops being worth reading.
 */

interface TaskRow {
  task_key: string;
  status: string;
  notes: string | null;
}

const STATUS_UI: Record<string, { icon: typeof Check; dot: string; text: string }> = {
  completed: {
    icon: Check,
    dot: "bg-emerald-500 text-white border-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  in_progress: {
    icon: CircleDot,
    dot: "bg-sky-500 text-white border-sky-500",
    text: "text-sky-700 dark:text-sky-400",
  },
  blocked: {
    icon: AlertTriangle,
    dot: "bg-red-500 text-white border-red-500",
    text: "text-red-700 dark:text-red-400",
  },
  not_applicable: {
    icon: CircleSlash,
    dot: "bg-muted text-muted-foreground border-border",
    text: "text-muted-foreground",
  },
  pending: {
    icon: CircleDashed,
    dot: "bg-background text-muted-foreground border-border",
    text: "text-foreground",
  },
};

const statusUi = (s: string) => STATUS_UI[s] ?? STATUS_UI.pending;

export function PriceBookSetupChecklist() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [openStep, setOpenStep] = useState<string | null>(null);

  const { data: measures, isLoading: loadingMeasures, error: measureError } = useQuery<Measure[]>({
    queryKey: ["price-book-setup-status"],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("price_book_setup_status");
      if (error) throw error;
      return (data || []).map((m: any) => ({
        measure_key: m.measure_key,
        done: Number(m.done),
        total: Number(m.total),
        detail: m.detail,
      }));
    },
  });

  const { data: tasks } = useQuery<TaskRow[]>({
    queryKey: ["price-book-setup-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_book_setup_tasks")
        .select("task_key, status, notes");
      if (error) throw error;
      return (data as TaskRow[]) || [];
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ key, status }: { key: string; status: SetupStatus }) => {
      const { error } = await supabase
        .from("price_book_setup_tasks")
        .update({ status })
        .eq("task_key", key);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["price-book-setup-tasks"] });
    },
    onError: () => {
      // The update is gated on admin_price_book / can_edit, and RLS filters a
      // forbidden row out rather than refusing loudly.
      toast.error("Could not save that. Your profile may not have permission to change price book setup.");
    },
  });

  const measureFor = (step: SetupStep) =>
    measures?.find((m) => m.measure_key === (step.measure ?? step.contextMeasure));

  const statusFor = (step: SetupStep): SetupStatus => {
    if (step.measure) return statusFromMeasure(measureFor(step));
    return (tasks?.find((t) => t.task_key === step.key)?.status as SetupStatus) ?? "pending";
  };

  const byStage = (stage: SetupStage) => SETUP_STEPS.filter((s) => s.stage === stage);

  const doneCount = SETUP_STEPS.filter((s) => isSettled(statusFor(s))).length;
  const totalCount = SETUP_STEPS.length;
  const percent = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;
  const allDone = doneCount === totalCount;

  if (measureError) {
    return (
      <Card className="mb-6 border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
        <CardContent className="py-3 text-sm text-amber-900 dark:text-amber-200">
          Setup progress could not be loaded. Your profile may not have permission to view it.
        </CardContent>
      </Card>
    );
  }

  const renderRow = (step: SetupStep) => {
    const status = statusFor(step);
    const ui = statusUi(status);
    const Icon = ui.icon;
    const m = measureFor(step);
    const isOpen = openStep === step.key;
    const measured = !!step.measure;

    return (
      <div key={step.key} className="border-b last:border-b-0">
        <button
          type="button"
          onClick={() => setOpenStep(isOpen ? null : step.key)}
          className="w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
        >
          <span
            className={cn(
              "mt-0.5 h-5 w-5 rounded-full border flex items-center justify-center shrink-0",
              ui.dot,
            )}
          >
            <Icon className="h-3 w-3" />
          </span>

          <span className="min-w-0 flex-1">
            <span className={cn("block text-sm", ui.text)}>{step.label}</span>
            {isOpen && (
              <>
                <span className="block text-xs text-muted-foreground mt-1">{step.help}</span>
                {step.where && (
                  <span className="block text-[11px] text-muted-foreground mt-1">
                    Where: {step.where}
                  </span>
                )}
                {m?.detail && (
                  <span className="block text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                    {m.detail}
                  </span>
                )}
                {measured ? (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground mt-2">
                    <Lock className="h-3 w-3" />
                    Counted from your data — it ticks itself once the data is right.
                  </span>
                ) : (
                  <span
                    className="flex items-center gap-2 mt-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Select
                      value={status}
                      onValueChange={(v) =>
                        setStatus.mutate({ key: step.key, status: v as SetupStatus })
                      }
                    >
                      <SelectTrigger className="h-7 w-40 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SETUP_STATUSES.map((o) => (
                          <SelectItem key={o.value} value={o.value} className="text-xs">
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </span>
                )}
              </>
            )}
          </span>

          {m && (
            <span
              className={cn(
                "text-[11px] tabular-nums shrink-0 mt-0.5",
                status === "completed" ? "text-emerald-600 dark:text-emerald-400"
                  : m.done === 0 ? "text-amber-700 dark:text-amber-400"
                  : "text-muted-foreground",
              )}
            >
              {measured ? measureSummary(m, step.unit) : contextSummary(m, step.unit)}
            </span>
          )}
        </button>
      </div>
    );
  };

  return (
    <Card className="mb-6 overflow-hidden">
      <CardHeader className="pb-3">
        <div
          className="flex items-start justify-between gap-3 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="min-w-0">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
              Price Book setup
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {loadingMeasures
                ? "Reading your data…"
                : allDone
                  ? "Every step is settled — pricing is fully configured."
                  : `${totalCount - doneCount} step${totalCount - doneCount === 1 ? "" : "s"} left. Most tick themselves as you fix the data.`}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div
                className={cn(
                  "text-lg font-semibold leading-none tabular-nums",
                  allDone && "text-emerald-600 dark:text-emerald-400",
                )}
              >
                {doneCount}
                <span className="text-muted-foreground font-normal">/{totalCount}</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">{percent}% done</div>
            </div>
            {expanded
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mt-3">
          <div
            className={cn("h-full transition-all duration-500", allDone ? "bg-emerald-500" : "bg-primary")}
            style={{ width: `${percent}%` }}
          />
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-5">
          <div className="grid gap-5 xl:grid-cols-2">
            {SETUP_STAGES.map((stage) => {
              const rows = byStage(stage.key);
              if (rows.length === 0) return null;
              const stageDone = rows.filter((s) => isSettled(statusFor(s))).length;
              return (
                <div key={stage.key}>
                  <div className="flex items-baseline justify-between gap-2 px-3 pb-1 border-b mb-1">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <h4 className="text-xs font-semibold uppercase tracking-wide">{stage.title}</h4>
                      <span className="text-xs text-muted-foreground truncate">{stage.blurb}</span>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {stageDone}/{rows.length}
                    </span>
                  </div>
                  {rows.map(renderRow)}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 px-3">
            <p className="text-[11px] text-muted-foreground">
              Tap a step to see what “done” means. Steps counted from your data cannot be
              ticked by hand — fix the data and they settle themselves.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => qc.invalidateQueries({ queryKey: ["price-book-setup-status"] })}
            >
              Re-check
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default PriceBookSetupChecklist;
