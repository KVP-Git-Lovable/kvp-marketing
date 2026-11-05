import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Star, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useFeedbackConfig, computeScore, answerPoints, questionMax } from "@/modules/feedback/useFeedbackConfig";
import { DynamicFeedbackFields, keyOf, missingRequired, type AnswerMap } from "@/modules/feedback/DynamicFeedbackFields";

interface RetailerFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  visitId?: string;
  retailerId: string;
  retailerName: string;
  editId?: string | null;
  editData?: any;
}

const MODULE = "retailer_feedback";

/**
 * Retailer feedback, rendered from its admin configuration.
 *
 * The five original ratings still live in their own columns on
 * retailer_feedback — every existing report reads those, so they keep being
 * written, matched up by each question's field_key. A question an admin adds
 * later has no column to go to, so it lands in feedback_responses instead.
 * That way the form is fully configurable without orphaning the history.
 */

/** Kept for callers that score a row they already hold (analytics, list views). */
export const calculateRetailerFeedbackScore = (feedback: {
  product_packaging: number;
  product_sku_range: number;
  product_quality: number;
  product_placement: number;
  consumer_satisfaction: number;
}): number => {
  const total =
    (feedback.product_packaging || 0) + (feedback.product_sku_range || 0) +
    (feedback.product_quality || 0) + (feedback.product_placement || 0) +
    (feedback.consumer_satisfaction || 0);
  if (total === 0) return 0;
  return Math.round((total / 25) * 100) / 10;
};

export const RetailerFeedbackModal = ({
  isOpen, onClose, onBack, visitId, retailerId, retailerName, editId, editData,
}: RetailerFeedbackModalProps) => {
  const { data: config, isLoading: loadingConfig } = useFeedbackConfig(MODULE);
  const questions = config?.questions ?? [];
  const cfg = config?.config;

  const [answers, setAnswers] = useState<AnswerMap>({});
  const [rowId, setRowId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);

  const currentScore = useMemo(
    () => computeScore(questions, cfg, answers),
    [questions, cfg, answers],
  );

  /** Questions backed by a real column vs ones an admin added later. */
  const legacy = useMemo(() => questions.filter((q) => q.field_key), [questions]);
  const extra = useMemo(() => questions.filter((q) => !q.field_key), [questions]);

  useEffect(() => {
    if (!isOpen || !retailerId || !questions.length) return;
    let cancelled = false;

    const hydrate = (row: any) => {
      const next: AnswerMap = {};
      for (const q of legacy) {
        const v = row?.[q.field_key as string];
        if (v !== null && v !== undefined) next[keyOf(q)] = v;
      }
      return next;
    };

    (async () => {
      setLoadingExisting(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        let row: any = editData ?? null;

        if (!row && editId) {
          const { data } = await supabase
            .from("retailer_feedback").select("*").eq("id", editId).maybeSingle();
          row = data;
        }
        if (!row && !editId) {
          const today = new Date().toISOString().split("T")[0];
          const { data } = await supabase
            .from("retailer_feedback").select("*")
            .eq("retailer_id", retailerId)
            .eq("feedback_date", today)
            .eq("user_id", user.id)
            .maybeSingle();
          row = data;
        }
        if (cancelled) return;

        const next = row ? hydrate(row) : {};
        const id = row?.id ?? null;
        setRowId(id);

        // answers that never had a column
        if (id && extra.length) {
          const { data: rs } = await (supabase as any)
            .from("feedback_responses")
            .select("question_id,value_number,value_text,value_option")
            .eq("subject_table", "retailer_feedback")
            .eq("subject_id", id);
          for (const r of rs ?? []) {
            const q = extra.find((x) => x.id === r.question_id);
            if (q) next[keyOf(q)] = r.value_number ?? r.value_option ?? r.value_text ?? "";
          }
        }
        if (!cancelled) setAnswers(next);
      } finally {
        if (!cancelled) setLoadingExisting(false);
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen, retailerId, editId, editData, questions.length]);

  const set = (k: string, v: unknown) => setAnswers((a) => ({ ...a, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const missing = missingRequired(questions, answers);
    if (missing.length) {
      toast({
        title: "Some answers are missing",
        description: missing.map((m) => m.question_text).join(", "),
        variant: "destructive",
      });
      return;
    }
    const answeredSomething = questions.some((q) => {
      const v = answers[keyOf(q)];
      return v !== undefined && v !== null && v !== "" && v !== 0;
    });
    if (!answeredSomething) {
      toast({ title: "Nothing to save", description: "Please answer at least one question.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // the columns every existing report already reads
      const columns: Record<string, any> = {};
      for (const q of legacy) {
        const v = answers[keyOf(q)];
        columns[q.field_key as string] =
          q.question_type === "rating" || q.question_type === "number"
            ? Number(v) || 0
            : (v ?? null) || null;
      }

      const feedbackData: any = {
        ...columns,
        user_id: user.id,
        retailer_id: retailerId,
        visit_id: visitId && visitId.length > 10 ? visitId : null,
        feedback_type: "product_feedback",
        feedback_date: new Date().toISOString().split("T")[0],
        score: currentScore,
        updated_at: new Date().toISOString(),
      };

      let isNewFeedback = false;
      let savedId = editId ?? rowId ?? null;

      if (savedId) {
        const { error } = await supabase
          .from("retailer_feedback").update(feedbackData).eq("id", savedId);
        if (error) throw error;
      } else {
        const { data: existing } = await supabase
          .from("retailer_feedback").select("id")
          .eq("retailer_id", retailerId)
          .eq("feedback_date", feedbackData.feedback_date)
          .eq("user_id", user.id)
          .maybeSingle();

        if (existing) {
          savedId = existing.id;
          const { error } = await supabase
            .from("retailer_feedback").update(feedbackData).eq("id", existing.id);
          if (error) throw error;
        } else {
          isNewFeedback = true;
          const { data, error } = await supabase
            .from("retailer_feedback").insert(feedbackData).select("id").single();
          if (error) throw error;
          savedId = data?.id ?? null;
        }
      }

      // admin-added questions have no column, so they live in feedback_responses
      if (savedId && extra.length) {
        const rows = extra
          .filter((q) => {
            const v = answers[keyOf(q)];
            return v !== undefined && v !== null && v !== "";
          })
          .map((q) => {
            const v = answers[keyOf(q)];
            const isNum = q.question_type === "rating" || q.question_type === "number";
            const isChoice = q.question_type === "multi_choice" || q.question_type === "yes_no";
            return {
              module: MODULE,
              question_id: q.id,
              subject_table: "retailer_feedback",
              subject_id: savedId,
              user_id: user.id,
              retailer_id: retailerId,
              visit_id: visitId && visitId.length > 10 ? visitId : null,
              value_number: isNum ? Number(v) : null,
              value_option: isChoice ? String(v) : null,
              value_text: !isNum && !isChoice ? String(v) : null,
              points: answerPoints(q, v),
              max_points: questionMax(q),
              answered_at: new Date().toISOString(),
            };
          });
        if (rows.length) {
          const { error } = await (supabase as any)
            .from("feedback_responses")
            .upsert(rows, { onConflict: "subject_table,subject_id,question_id" });
          // an extra answer failing must not lose the feedback itself
          if (error) console.error("feedback_responses upsert failed", error);
        }
      }

      if (isNewFeedback) {
        try {
          const { awardPointsForRetailerFeedback } = await import("@/utils/gamificationPointsAwarder");
          await awardPointsForRetailerFeedback(user.id, retailerId);
        } catch (err) {
          console.error("Error awarding feedback points:", err);
        }
      }

      toast({
        title: "Feedback Recorded",
        description: `Retailer feedback for ${retailerName} saved with score: ${currentScore}/${cfg?.display_scale ?? 10}`,
      });

      setAnswers({});
      setRowId(null);
      onClose();
    } catch (error: any) {
      console.error("Error submitting feedback:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to record feedback",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600 bg-green-100";
    if (score >= 6) return "text-yellow-600 bg-yellow-100";
    if (score >= 4) return "text-orange-600 bg-orange-100";
    return "text-red-600 bg-red-100";
  };

  const busy = loadingConfig || loadingExisting;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0">
        <div className="bg-gradient-to-br from-orange-500/10 via-orange-400/5 to-background p-6 pb-4">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {onBack && (
                  <Button variant="ghost" size="sm" onClick={onBack} className="p-1 h-8 w-8">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                <DialogTitle className="flex items-center gap-2 text-lg">
                  <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
                    <Star className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  Retailer Feedback
                </DialogTitle>
              </div>
              {currentScore > 0 && (
                <Badge className={`text-sm px-3 py-1.5 font-semibold ${getScoreColor(currentScore)}`}>
                  Score: {currentScore}/{cfg?.display_scale ?? 10}
                </Badge>
              )}
            </div>
            <div className="mt-3 pl-10">
              <p className="text-base font-semibold text-foreground">{retailerName}</p>
            </div>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="p-6 pt-4 space-y-6">
          {busy ? (
            <p className="py-8 text-center text-muted-foreground">Loading…</p>
          ) : (
            <DynamicFeedbackFields
              questions={questions}
              answers={answers}
              onChange={set}
              disabled={isSubmitting}
            />
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button" variant="outline" onClick={onClose}
              className="flex-1 h-11" disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 h-11 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700"
              disabled={isSubmitting || busy || !questions.length}
            >
              {isSubmitting ? "Saving..." : "Submit Feedback"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
