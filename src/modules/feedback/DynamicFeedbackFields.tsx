import { Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { bySection, type FeedbackQuestion } from "./useFeedbackConfig";

/**
 * Renders whatever the admin configured for a module. There is no question
 * text, option list, star count or point value in this file — all of it
 * arrives as data.
 */

export type AnswerMap = Record<string, unknown>;

/** Answers are keyed by the legacy column where one exists, else the question id. */
export const keyOf = (q: FeedbackQuestion) => q.field_key ?? q.id;

const StarRow = ({
  value,
  max,
  onChange,
  disabled,
}: {
  value: number;
  max: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) => (
  <div className="flex items-center gap-1">
    {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
      <button
        key={n}
        type="button"
        disabled={disabled}
        onClick={() => onChange(n === value ? 0 : n)}
        aria-label={`${n} of ${max}`}
        className="p-0.5 disabled:opacity-50"
      >
        <Star
          className={`h-6 w-6 transition-colors ${
            n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
          }`}
        />
      </button>
    ))}
    {value > 0 && (
      <span className="ml-2 text-xs text-muted-foreground tabular-nums">
        {value}/{max}
      </span>
    )}
  </div>
);

export function DynamicFeedbackFields({
  questions,
  answers,
  onChange,
  disabled,
}: {
  questions: FeedbackQuestion[];
  answers: AnswerMap;
  onChange: (key: string, value: unknown) => void;
  disabled?: boolean;
}) {
  if (!questions.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No questions have been configured for this form yet.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {bySection(questions).map((group, gi) => (
        <div key={`${group.section ?? "none"}-${gi}`} className="space-y-4">
          {group.section && (
            <div className="text-sm font-semibold text-foreground/80">{group.section}</div>
          )}

          <div className="grid gap-4 p-4 bg-muted/30 rounded-xl border border-border/50">
            {group.questions.map((q) => {
              const k = keyOf(q);
              const v = answers[k];

              return (
                <div key={q.id} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <Label className="font-medium">
                      {q.question_text}
                      {q.is_required && <span className="text-destructive ml-0.5">*</span>}
                    </Label>
                  </div>
                  {q.help_text && (
                    <p className="text-[11.5px] text-muted-foreground">{q.help_text}</p>
                  )}

                  {q.question_type === "rating" && (
                    <StarRow
                      value={Number(v) || 0}
                      max={q.scale_max ?? 5}
                      disabled={disabled}
                      onChange={(n) => onChange(k, n)}
                    />
                  )}

                  {(q.question_type === "multi_choice" || q.question_type === "yes_no") && (
                    <Select
                      value={(v as string) ?? ""}
                      onValueChange={(val) => onChange(k, val)}
                      disabled={disabled}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an option" />
                      </SelectTrigger>
                      <SelectContent>
                        {q.options.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {q.question_type === "number" && (
                    <Input
                      type="number"
                      value={(v as number | string) ?? ""}
                      disabled={disabled}
                      onChange={(e) =>
                        onChange(k, e.target.value === "" ? null : Number(e.target.value))
                      }
                    />
                  )}

                  {q.question_type === "text" && (
                    <Textarea
                      value={(v as string) ?? ""}
                      disabled={disabled}
                      rows={3}
                      onChange={(e) => onChange(k, e.target.value)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Which required questions are still blank — for save-time validation. */
export const missingRequired = (questions: FeedbackQuestion[], answers: AnswerMap) =>
  questions.filter((q) => {
    if (!q.is_required) return false;
    const v = answers[keyOf(q)];
    return v === null || v === undefined || v === "" || (q.question_type === "rating" && !Number(v));
  });
