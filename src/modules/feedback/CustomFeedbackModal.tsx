import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  useFeedbackConfig, computeScore, answerPoints, questionMax, scoreBand,
} from "./useFeedbackConfig";
import { DynamicFeedbackFields, keyOf, missingRequired, type AnswerMap } from "./DynamicFeedbackFields";

/**
 * Any feedback type an admin creates, rendered from its configuration.
 *
 * The built-in types (retailer feedback, branding, joint sales) each own a
 * table and a bespoke screen. A custom type has neither, so its answers go
 * to feedback_responses, one row per question, each carrying the points it
 * earned AT THE TIME — later config edits then cannot move a past score.
 */

const SUBJECT = "feedback_submission";

export function CustomFeedbackModal({
  open, onClose, module, moduleLabel, retailerId, retailerName, visitId, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  module: string;
  moduleLabel: string;
  retailerId?: string | null;
  retailerName?: string;
  visitId?: string | null;
  onSaved?: () => void;
}) {
  const { data, isLoading } = useFeedbackConfig(module);
  const questions = data?.questions ?? [];
  const cfg = data?.config;

  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);

  // Reopening the same retailer on the same day edits that submission rather
  // than stacking a second one.
  useEffect(() => {
    if (!open || !module) return;
    let cancelled = false;

    (async () => {
      setLoadingExisting(true);
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) { setLoadingExisting(false); return; }

      const since = new Date(); since.setHours(0, 0, 0, 0);
      let q = (supabase as any)
        .from("feedback_responses")
        .select("subject_id, question_id, value_number, value_text, value_option")
        .eq("module", module)
        .eq("user_id", uid)
        .gte("answered_at", since.toISOString());
      q = retailerId ? q.eq("retailer_id", retailerId) : q.is("retailer_id", null);

      const { data: rows } = await q;
      if (cancelled) return;

      if (rows?.length) {
        const sid = rows[0].subject_id as string;
        const byQ = new Map(questions.map((x) => [x.id, x]));
        const next: AnswerMap = {};
        for (const r of rows) {
          const qq = byQ.get(r.question_id);
          if (!qq) continue;
          next[keyOf(qq)] = r.value_number ?? r.value_option ?? r.value_text ?? "";
        }
        setSubmissionId(sid);
        setAnswers(next);
      } else {
        setSubmissionId(crypto.randomUUID());
        setAnswers({});
      }
      setLoadingExisting(false);
    })();

    return () => { cancelled = true; };
    // questions are needed to map ids back to keys, so re-run once they land
  }, [open, module, retailerId, questions.length]);

  const score = useMemo(() => computeScore(questions, cfg, answers), [questions, cfg, answers]);
  const band = scoreBand(score, cfg);
  const maxTotal = useMemo(
    () => questions.reduce((s, q) => s + questionMax(q), 0),
    [questions],
  );

  const set = (k: string, v: unknown) => setAnswers((a) => ({ ...a, [k]: v }));

  const handleSave = async () => {
    const missing = missingRequired(questions, answers);
    if (missing.length) {
      toast({
        title: "Some answers are missing",
        description: missing.map((m) => m.question_text).join(", "),
        variant: "destructive",
      });
      return;
    }
    const answered = questions.filter((q) => {
      const v = answers[keyOf(q)];
      return v !== undefined && v !== null && v !== "";
    });
    if (!answered.length) {
      toast({ title: "Nothing to save", description: "Answer at least one question.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) throw new Error("Not signed in");
      const sid = submissionId ?? crypto.randomUUID();

      const rows = answered.map((q) => {
        const v = answers[keyOf(q)];
        const isNum = q.question_type === "rating" || q.question_type === "number";
        const isChoice = q.question_type === "multi_choice" || q.question_type === "yes_no";
        return {
          module,
          question_id: q.id,
          subject_table: SUBJECT,
          subject_id: sid,
          user_id: uid,
          retailer_id: retailerId ?? null,
          visit_id: visitId && visitId.length > 10 ? visitId : null,
          value_number: isNum ? Number(v) : null,
          value_option: isChoice ? String(v) : null,
          value_text: !isNum && !isChoice ? String(v) : null,
          points: answerPoints(q, v),
          max_points: questionMax(q),
          answered_at: new Date().toISOString(),
        };
      });

      // One row per question per submission — re-saving replaces, never stacks.
      const { error } = await (supabase as any)
        .from("feedback_responses")
        .upsert(rows, { onConflict: "subject_table,subject_id,question_id" });
      if (error) throw error;

      setSubmissionId(sid);
      toast({
        title: "Saved",
        description: cfg?.scored ? `${moduleLabel} saved with score ${score}/${cfg.display_scale}` : `${moduleLabel} saved`,
      });
      onSaved?.();
      onClose();
    } catch (e: any) {
      toast({ title: "Could not save", description: e?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const busy = isLoading || loadingExisting;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span>{moduleLabel}</span>
            {cfg?.scored && !busy && questions.length > 0 && (
              <Badge
                variant="secondary"
                className="tabular-nums"
                title={`${maxTotal} points available`}
              >
                {score}/{cfg.display_scale}
                {band ? ` · ${band.label}` : ""}
              </Badge>
            )}
          </DialogTitle>
          {retailerName && (
            <p className="text-sm text-muted-foreground">{retailerName}</p>
          )}
        </DialogHeader>

        {busy ? (
          <p className="py-10 text-center text-muted-foreground">Loading…</p>
        ) : (
          <DynamicFeedbackFields
            questions={questions}
            answers={answers}
            onChange={set}
            disabled={saving}
          />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || busy || !questions.length}>
            {saving ? "Saving…" : "Save Feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
