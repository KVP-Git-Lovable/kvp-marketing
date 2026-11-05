import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, X, ChevronUp, ChevronDown, Star, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import FeedbackTypeManager from "./FeedbackTypeManager";

/**
 * Questions for the selected feedback type.
 *
 * Each row previews the control a rep will actually meet — the star row at its
 * configured scale, the option chips with their points — because the job of
 * this screen is to predict the form, not just list its settings.
 *
 * Points ride on the individual option, never on its wording, so renaming an
 * option keeps its score.
 */

interface QuestionOption { value: string; label: string; points: number }

interface FeedbackQuestion {
  id: string;
  module: string;
  question_text: string;
  question_type: string;
  options: any;
  is_required: boolean;
  applies_to: string;
  retailer_ids: string[] | null;
  sort_order: number;
  is_active: boolean;
  field_key: string | null;
  section: string | null;
  help_text: string | null;
  scored: boolean;
  scale_max: number | null;
  weight: number;
}

interface ModuleConfig {
  module: string; label: string; scored: boolean; display_scale: number; is_active: boolean;
}

const QUESTION_TYPES = [
  { value: "rating", label: "Rating (stars)" },
  { value: "multi_choice", label: "Multiple choice" },
  { value: "yes_no", label: "Yes / No" },
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
];

const TYPE_LABEL: Record<string, string> = {
  rating: "Rating", multi_choice: "Choice", yes_no: "Yes / No", text: "Text", number: "Number",
};

const SCORABLE = new Set(["rating", "multi_choice", "yes_no"]);
const CHOICE = new Set(["multi_choice", "yes_no"]);

const parseOptions = (raw: any): QuestionOption[] => {
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

const questionMax = (q: {
  question_type: string; scored: boolean; scale_max: number | null; weight: number; options: any;
}): number => {
  if (!q.scored || !SCORABLE.has(q.question_type)) return 0;
  const w = q.weight ?? 1;
  if (q.question_type === "rating") return (q.scale_max ?? 5) * w;
  const opts = parseOptions(q.options);
  return (opts.length ? Math.max(...opts.map((o) => o.points)) : 0) * w;
};

const defaultForm = {
  module: "", question_text: "", question_type: "rating", is_required: false,
  applies_to: "all", retailer_ids: null as string[] | null, sort_order: 0, is_active: true,
  section: "", help_text: "", scored: true, scale_max: 5, weight: 1, field_key: "",
};

/** The control as the rep meets it, drawn small. */
const ControlPreview = ({ q }: { q: FeedbackQuestion }) => {
  if (q.question_type === "rating") {
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: q.scale_max ?? 5 }).map((_, i) => (
          <Star key={i} className="h-[15px] w-[15px] text-muted-foreground/35" />
        ))}
      </div>
    );
  }
  if (CHOICE.has(q.question_type)) {
    return (
      <div className="flex flex-wrap gap-1">
        {parseOptions(q.options).map((o) => (
          <span
            key={o.value}
            className="inline-flex items-center gap-1.5 rounded-md bg-muted/70 px-2 py-[3px] text-[11.5px] text-foreground/80"
          >
            {o.label}
            {q.scored && (
              <span className="tabular-nums text-[10px] font-medium text-muted-foreground">
                {o.points}
              </span>
            )}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="rounded-md border border-dashed px-2 py-1 text-[11.5px] text-muted-foreground inline-block">
      {q.question_type === "number" ? "Number entry" : "Free text"}
    </div>
  );
};

export default function FeedbackQuestionConfig() {
  const [questions, setQuestions] = useState<FeedbackQuestion[]>([]);
  const [modules, setModules] = useState<ModuleConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [options, setOptions] = useState<QuestionOption[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: qs, error }, { data: mods }] = await Promise.all([
      (supabase as any).from("feedback_questions").select("*").order("sort_order"),
      (supabase as any).from("feedback_module_config").select("*").order("sort_order"),
    ]);
    if (error) toast({ title: "Error", description: "Failed to load questions", variant: "destructive" });
    setQuestions(qs || []);
    setModules(mods || []);
    setSelected((s) => s || (mods ?? []).find((m: ModuleConfig) => m.is_active)?.module || "");
    setLoading(false);
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const q of questions) if (q.is_active) c[q.module] = (c[q.module] ?? 0) + 1;
    return c;
  }, [questions]);

  const cfg = modules.find((m) => m.module === selected);
  const mine = useMemo(
    () => questions.filter((q) => q.module === selected).sort((a, b) => a.sort_order - b.sort_order),
    [questions, selected],
  );

  const sections = useMemo(() => {
    const out: { name: string | null; items: FeedbackQuestion[] }[] = [];
    for (const q of mine) {
      const last = out[out.length - 1];
      if (last && last.name === (q.section ?? null)) last.items.push(q);
      else out.push({ name: q.section ?? null, items: [q] });
    }
    return out;
  }, [mine]);

  const totals = useMemo(() => {
    const active = mine.filter((q) => q.is_active && q.scored);
    return {
      count: active.filter((q) => questionMax(q) > 0).length,
      max: active.reduce((s, q) => s + questionMax(q), 0),
    };
  }, [mine]);

  const openAdd = () => {
    setEditingId(null);
    setForm({
      ...defaultForm, module: selected,
      sort_order: (mine[mine.length - 1]?.sort_order ?? 0) + 10,
      scored: !!cfg?.scored, section: mine[mine.length - 1]?.section ?? "",
    });
    setOptions([]);
    setDialogOpen(true);
  };

  const openEdit = (q: FeedbackQuestion) => {
    setEditingId(q.id);
    setForm({
      module: q.module, question_text: q.question_text, question_type: q.question_type,
      is_required: q.is_required, applies_to: q.applies_to, retailer_ids: q.retailer_ids,
      sort_order: q.sort_order, is_active: q.is_active, section: q.section ?? "",
      help_text: q.help_text ?? "", scored: q.scored, scale_max: q.scale_max ?? 5,
      weight: Number(q.weight ?? 1), field_key: q.field_key ?? "",
    });
    setOptions(parseOptions(q.options));
    setDialogOpen(true);
  };

  const move = async (id: string, direction: "up" | "down") => {
    setBusy(id);
    const { error } = await (supabase as any).rpc("feedback_move_question", { p_id: id, p_direction: direction });
    setBusy(null);
    if (error) { toast({ title: "Could not reorder", description: error.message, variant: "destructive" }); return; }
    fetchAll();
  };

  const handleSave = async () => {
    if (!form.question_text.trim()) {
      toast({ title: "Question text is required", variant: "destructive" }); return;
    }
    const isChoice = CHOICE.has(form.question_type);
    const cleaned = options
      .map((o) => ({ label: o.label.trim(), value: (o.value || o.label).trim(), points: Number(o.points) || 0 }))
      .filter((o) => o.label);
    if (isChoice && cleaned.length < 2) {
      toast({ title: "Add at least two options", variant: "destructive" }); return;
    }

    const payload: any = {
      module: form.module || selected,
      question_text: form.question_text.trim(),
      question_type: form.question_type,
      is_required: form.is_required,
      applies_to: form.applies_to,
      retailer_ids: form.retailer_ids,
      sort_order: form.sort_order,
      is_active: form.is_active,
      section: form.section.trim() || null,
      help_text: form.help_text.trim() || null,
      scored: SCORABLE.has(form.question_type) ? form.scored : false,
      scale_max: form.question_type === "rating" ? form.scale_max : null,
      weight: form.weight || 1,
      field_key: form.field_key.trim() || null,
      options: isChoice ? cleaned : null,
    };

    if (editingId) {
      payload.updated_at = new Date().toISOString();
      const { error } = await (supabase as any).from("feedback_questions").update(payload).eq("id", editingId);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Updated" });
    } else {
      const { data: { session } } = await supabase.auth.getSession();
      payload.created_by = session?.user?.id;
      const { error } = await (supabase as any).from("feedback_questions").insert(payload);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Created" });
    }
    setDialogOpen(false);
    fetchAll();
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase as any).from("feedback_questions").delete().eq("id", id);
    if (error) {
      toast({
        title: "Cannot delete",
        description: "This question already has answers. Switch it off instead.",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Deleted" });
    fetchAll();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await (supabase as any).from("feedback_questions")
      .update({ is_active: !current, updated_at: new Date().toISOString() }).eq("id", id);
    fetchAll();
  };

  const isChoice = CHOICE.has(form.question_type);
  const canScore = SCORABLE.has(form.question_type);
  const formMax = questionMax({ ...form, options: isChoice ? options : null });

  if (loading) {
    return <p className="py-16 text-center text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <FeedbackTypeManager
        selected={selected}
        onSelect={setSelected}
        counts={counts}
        onChanged={fetchAll}
      />

      {/* ---------------- questions for the selected type ---------------- */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">
              {cfg?.label ?? "Questions"}
            </h2>
            <p className="text-[12.5px] text-muted-foreground mt-0.5">
              {cfg?.scored ? (
                <>
                  {totals.count} scored {totals.count === 1 ? "question" : "questions"} ·{" "}
                  <span className="tabular-nums">{totals.max} points</span> · shown out of{" "}
                  <span className="tabular-nums">{cfg.display_scale}</span>
                </>
              ) : (
                "Not scored — these entries set the options the form offers."
              )}
            </p>
          </div>
          <Button size="sm" onClick={openAdd} disabled={!selected} className="shrink-0">
            <Plus className="h-4 w-4 mr-1.5" /> Add question
          </Button>
        </div>

        {mine.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/10 py-14 text-center">
            <p className="text-sm text-muted-foreground">
              No questions in {cfg?.label ?? "this type"} yet.
            </p>
            <Button size="sm" variant="outline" className="mt-3" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1.5" /> Add the first question
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {sections.map((sec, si) => (
              <div key={`${sec.name ?? "none"}-${si}`} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {sec.name ?? "Ungrouped"}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>

                <div className="divide-y overflow-hidden rounded-lg border bg-background shadow-sm">
                  {sec.items.map((q) => {
                    const idx = mine.findIndex((x) => x.id === q.id);
                    const qm = questionMax(q);
                    return (
                      <div
                        key={q.id}
                         className={`group flex items-start gap-3 p-4 transition-colors hover:bg-muted/40 ${
                          q.is_active ? "" : "opacity-55"
                        }`}
                      >
                        <div className="flex flex-col items-center pt-0.5 -my-1">
                          <Button
                            variant="ghost" size="icon" className="h-5 w-5"
                            disabled={idx === 0 || busy === q.id}
                            onClick={() => move(q.id, "up")}
                            aria-label="Move up"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </Button>
                          <GripVertical className="h-3 w-3 text-muted-foreground/30" />
                          <Button
                            variant="ghost" size="icon" className="h-5 w-5"
                            disabled={idx === mine.length - 1 || busy === q.id}
                            onClick={() => move(q.id, "down")}
                            aria-label="Move down"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-[13.5px]">{q.question_text}</span>
                            <span className="text-[10.5px] text-muted-foreground rounded border px-1.5 py-[1px]">
                              {TYPE_LABEL[q.question_type] ?? q.question_type}
                            </span>
                            {q.is_required && (
                              <span className="text-[10.5px] text-amber-700 dark:text-amber-400 rounded border border-amber-300/60 px-1.5 py-[1px]">
                                Required
                              </span>
                            )}
                            {q.scored && qm > 0 && (
                              <span className="text-[10.5px] text-muted-foreground tabular-nums">
                                max {qm} pts
                              </span>
                            )}
                          </div>
                          {q.help_text && (
                            <p className="text-[11.5px] text-muted-foreground">{q.help_text}</p>
                          )}
                          <ControlPreview q={q} />
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0">
                          <Switch
                            checked={q.is_active}
                            onCheckedChange={() => toggleActive(q.id, q.is_active)}
                            className="scale-[0.8] mr-1"
                            aria-label="Active"
                          />
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8 opacity-60 group-hover:opacity-100"
                            onClick={() => openEdit(q)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8 opacity-60 group-hover:opacity-100"
                            onClick={() => handleDelete(q.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ----------------------------- editor ----------------------------- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit question" : `Add question to ${cfg?.label ?? ""}`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Question</Label>
              <Textarea
                value={form.question_text}
                onChange={(e) => setForm((f) => ({ ...f, question_text: e.target.value }))}
                placeholder="e.g. Product Placement"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.question_type}
                        onValueChange={(v) => setForm((f) => ({ ...f, question_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {QUESTION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Section</Label>
                <Input
                  list="feedback-sections"
                  value={form.section}
                  onChange={(e) => setForm((f) => ({ ...f, section: e.target.value }))}
                  placeholder="e.g. Performance Ratings"
                />
                <datalist id="feedback-sections">
                  {[...new Set(mine.map((q) => q.section).filter(Boolean))].map((s) => (
                    <option key={s as string} value={s as string} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Helper text</Label>
              <Input
                value={form.help_text}
                onChange={(e) => setForm((f) => ({ ...f, help_text: e.target.value }))}
                placeholder="Shown under the question on the rep's screen"
              />
            </div>

            {canScore && cfg?.scored && (
              <div className="rounded-lg border p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="font-normal">Counts towards the score</Label>
                  <div className="flex items-center gap-2">
                    {form.scored && (
                      <Badge variant="secondary" className="tabular-nums">max {formMax}</Badge>
                    )}
                    <Switch checked={form.scored}
                            onCheckedChange={(v) => setForm((f) => ({ ...f, scored: v }))} />
                  </div>
                </div>
                {form.scored && (
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    {form.question_type === "rating" && (
                      <div className="space-y-1.5">
                        <Label className="text-[12px]">Stars</Label>
                        <Input type="number" min={2} max={10} value={form.scale_max}
                               onChange={(e) =>
                                 setForm((f) => ({ ...f, scale_max: parseInt(e.target.value) || 5 }))} />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label className="text-[12px]">Weight</Label>
                      <Input type="number" step="0.5" min={0} value={form.weight}
                             onChange={(e) =>
                               setForm((f) => ({ ...f, weight: parseFloat(e.target.value) || 1 }))} />
                      <p className="text-[11px] text-muted-foreground">
                        Leave at 1 unless this should count more.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {isChoice && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Options</Label>
                  <Button type="button" variant="outline" size="sm"
                          onClick={() => setOptions((o) => [...o, { value: "", label: "", points: 0 }])}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add option
                  </Button>
                </div>
                {options.length === 0 && (
                  <p className="text-[12px] text-muted-foreground">No options yet — add at least two.</p>
                )}
                <div className="space-y-1.5">
                  {options.map((o, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        className="flex-1" value={o.label} placeholder={`Option ${i + 1}`}
                        onChange={(e) =>
                          setOptions((arr) => arr.map((x, j) =>
                            j === i ? { ...x, label: e.target.value, value: e.target.value } : x))}
                      />
                      {form.scored && cfg?.scored && (
                        <Input
                          className="w-20 text-center" type="number" min={0} value={o.points} placeholder="pts"
                          onChange={(e) =>
                            setOptions((arr) => arr.map((x, j) =>
                              j === i ? { ...x, points: parseFloat(e.target.value) || 0 } : x))}
                        />
                      )}
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9"
                              onClick={() => setOptions((arr) => arr.filter((_, j) => j !== i))}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                {form.scored && cfg?.scored && (
                  <p className="text-[11px] text-muted-foreground">
                    Points belong to the option, so renaming one keeps its score.
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center gap-6 pt-1">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_required}
                        onCheckedChange={(v) => setForm((f) => ({ ...f, is_required: v }))} />
                <Label className="font-normal">Required</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active}
                        onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
                <Label className="font-normal">Active</Label>
              </div>
            </div>

            {form.field_key && (
              <p className="text-[11px] text-muted-foreground">
                Stored in the existing <code className="font-mono">{form.field_key}</code> column,
                so historical answers keep working.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingId ? "Save changes" : "Create question"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
