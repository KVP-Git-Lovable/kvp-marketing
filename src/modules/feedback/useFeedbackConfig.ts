import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * The admin-configured question set for one module, plus how that module
 * scores. Nothing about questions, options or points is hardcoded in the
 * rep-facing forms any more — they render whatever is configured here.
 */

export interface FeedbackOption {
  value: string;
  label: string;
  points: number;
}

export interface FeedbackQuestion {
  id: string;
  module: string;
  question_text: string;
  question_type: "rating" | "multi_choice" | "yes_no" | "text" | "number" | string;
  options: FeedbackOption[];
  is_required: boolean;
  sort_order: number;
  section: string | null;
  help_text: string | null;
  scored: boolean;
  scale_max: number | null;
  weight: number;
  /** Legacy column on the module's own table; keeps historical rows readable. */
  field_key: string | null;
}

export interface FeedbackModuleConfig {
  module: string;
  label: string;
  scored: boolean;
  display_scale: number;
  decimals: number;
  bands: { min: number; label: string; color: string }[];
}

const SCORABLE = new Set(["rating", "multi_choice", "yes_no"]);
const CHOICE = new Set(["multi_choice", "yes_no"]);

/** Tolerates the legacy shape, where options were a bare array of strings. */
const parseOptions = (raw: any): FeedbackOption[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((o: any, i: number) =>
    typeof o === "string"
      ? { value: o, label: o, points: 0 }
      : {
          value: String(o?.value ?? o?.label ?? `option_${i + 1}`),
          label: String(o?.label ?? o?.value ?? `Option ${i + 1}`),
          points: Number(o?.points ?? 0),
        },
  );
};

/** The ceiling one question can contribute. */
export const questionMax = (q: FeedbackQuestion): number => {
  if (!q.scored || !SCORABLE.has(q.question_type)) return 0;
  const w = q.weight ?? 1;
  if (q.question_type === "rating") return (q.scale_max ?? 5) * w;
  return (q.options.length ? Math.max(...q.options.map((o) => o.points)) : 0) * w;
};

/** What a single answer earned. */
export const answerPoints = (q: FeedbackQuestion, value: unknown): number => {
  if (!q.scored || value === null || value === undefined || value === "") return 0;
  const w = q.weight ?? 1;
  if (q.question_type === "rating") {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(n, q.scale_max ?? 5) * w;
  }
  if (CHOICE.has(q.question_type)) {
    return (q.options.find((o) => o.value === value)?.points ?? 0) * w;
  }
  return 0;
};

/**
 * The module's score for a set of answers.
 *
 * The denominator is the full max across every scored question, not just the
 * answered ones — leaving a question blank costs you, which is how the
 * original hardcoded calculation behaved. Kept deliberately identical so
 * historical scores do not move.
 */
export const computeScore = (
  questions: FeedbackQuestion[],
  cfg: FeedbackModuleConfig | undefined,
  answers: Record<string, unknown>,
): number => {
  if (!cfg?.scored) return 0;
  let total = 0;
  let max = 0;
  for (const q of questions) {
    const qm = questionMax(q);
    if (qm <= 0) continue;
    max += qm;
    total += answerPoints(q, answers[q.field_key ?? q.id]);
  }
  if (max <= 0 || total <= 0) return 0;
  const raw = (total / max) * cfg.display_scale;
  const f = Math.pow(10, cfg.decimals ?? 1);
  return Math.round(raw * f) / f;
};

/** Colour band for a score, from config rather than a hardcoded ladder. */
export const scoreBand = (score: number, cfg?: FeedbackModuleConfig) => {
  const bands = [...(cfg?.bands ?? [])].sort((a, b) => b.min - a.min);
  return bands.find((b) => score >= b.min);
};

export function useFeedbackConfig(module: string) {
  return useQuery({
    queryKey: ["feedback-config", module],
    enabled: !!module,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [{ data: qs, error: qErr }, { data: cfgs, error: cErr }] = await Promise.all([
        (supabase as any)
          .from("feedback_questions")
          .select("*")
          .eq("module", module)
          .eq("is_active", true)
          .order("sort_order"),
        (supabase as any).from("feedback_module_config").select("*").eq("module", module).maybeSingle(),
      ]);
      if (qErr) throw qErr;
      if (cErr) throw cErr;

      const questions: FeedbackQuestion[] = (qs ?? []).map((q: any) => ({
        ...q,
        options: parseOptions(q.options),
        weight: Number(q.weight ?? 1),
      }));

      const config: FeedbackModuleConfig | undefined = cfgs
        ? { ...cfgs, bands: Array.isArray(cfgs.bands) ? cfgs.bands : [] }
        : undefined;

      return { questions, config };
    },
  });
}

/** Questions grouped into the sections an admin defined, order preserved. */
export const bySection = (questions: FeedbackQuestion[]) => {
  const out: { section: string | null; questions: FeedbackQuestion[] }[] = [];
  for (const q of questions) {
    const key = q.section ?? null;
    const last = out[out.length - 1];
    if (last && last.section === key) last.questions.push(q);
    else out.push({ section: key, questions: [q] });
  }
  return out;
};
