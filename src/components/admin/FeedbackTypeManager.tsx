import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Lock, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ICON_NAMES, COLOR_NAMES, ICON_MAP, COLOR_MAP } from "@/modules/feedback/CustomFeedbackTiles";

/**
 * The feedback types, as selectable cards.
 *
 * The card row doubles as the navigation for the questions below it — there
 * was a pill strip and a tab strip saying the same thing, so one of them had
 * to go. Built-ins can be renamed and switched off but never deleted, which
 * the database enforces too.
 */

export interface ModuleRow {
  module: string;
  label: string;
  description: string | null;
  icon: string;
  color: string;
  scored: boolean;
  display_scale: number;
  is_active: boolean;
  is_builtin: boolean;
  show_on_visit: boolean;
  sort_order: number;
}

const blank = {
  module: "", label: "", description: "", icon: "MessageSquare", color: "slate",
  scored: true, display_scale: 10, is_active: true, show_on_visit: true, sort_order: 100,
};

/** "Shelf Audit" -> "shelf_audit", matching the key CHECK on the table. */
const toKey = (label: string) =>
  label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);

export default function FeedbackTypeManager({
  selected, onSelect, counts, onChanged,
}: {
  selected: string;
  onSelect: (module: string) => void;
  /** questions per module, shown on each card */
  counts: Record<string, number>;
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ModuleRow | null>(null);
  const [form, setForm] = useState(blank);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const { data } = await (supabase as any)
      .from("feedback_module_config").select("*").order("sort_order").order("label");
    setRows(data ?? []);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ ...blank, sort_order: (rows[rows.length - 1]?.sort_order ?? 100) + 10 });
    setOpen(true);
  };

  const openEdit = (r: ModuleRow) => {
    setEditing(r);
    setForm({
      module: r.module, label: r.label, description: r.description ?? "", icon: r.icon,
      color: r.color, scored: r.scored, display_scale: Number(r.display_scale),
      is_active: r.is_active, show_on_visit: r.show_on_visit, sort_order: r.sort_order,
    });
    setOpen(true);
  };

  const save = async () => {
    const label = form.label.trim();
    if (!label) { toast({ title: "Name is required", variant: "destructive" }); return; }

    const body = {
      label, description: form.description.trim() || null, icon: form.icon, color: form.color,
      scored: form.scored, display_scale: form.display_scale, is_active: form.is_active,
      show_on_visit: form.show_on_visit, sort_order: form.sort_order,
    };

    if (editing) {
      const { error } = await (supabase as any).from("feedback_module_config")
        .update({ ...body, updated_at: new Date().toISOString() }).eq("module", editing.module);
      if (error) { toast({ title: "Could not save", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Saved" });
    } else {
      const key = toKey(label);
      if (!key) { toast({ title: "Use letters or numbers in the name", variant: "destructive" }); return; }
      if (rows.some((r) => r.module === key)) {
        toast({ title: "That name is already taken", variant: "destructive" }); return;
      }
      const { error } = await (supabase as any).from("feedback_module_config")
        .insert({ ...body, module: key, is_builtin: false, bands: [] });
      if (error) { toast({ title: "Could not create", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Created", description: `Now add questions to ${label}.` });
      onSelect(key);
    }
    setOpen(false);
    await load();
    onChanged?.();
  };

  const remove = async (r: ModuleRow) => {
    const { data: usage } = await (supabase as any).rpc("feedback_module_usage", { p_module: r.module });
    const u = Array.isArray(usage) ? usage[0] : usage;
    if (u && (Number(u.questions) > 0 || Number(u.responses) > 0)) {
      toast({
        title: "Cannot delete",
        description: `${r.label} has ${u.questions} question(s) and ${u.responses} answer(s). Switch it off instead.`,
        variant: "destructive",
      });
      return;
    }
    const { error } = await (supabase as any)
      .from("feedback_module_config").delete().eq("module", r.module);
    if (error) { toast({ title: "Cannot delete", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Deleted" });
    await load();
    onChanged?.();
  };

  const toggle = async (r: ModuleRow) => {
    await (supabase as any).from("feedback_module_config")
      .update({ is_active: !r.is_active, updated_at: new Date().toISOString() })
      .eq("module", r.module);
    await load();
    onChanged?.();
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Feedback types</h2>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">
            Each type is a tile on the visit card. Select one to edit its questions.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={openAdd} className="shrink-0">
          <Plus className="h-4 w-4 mr-1.5" /> New type
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rows.map((r) => {
          const Icon = ICON_MAP[r.icon] ?? ICON_MAP.MessageSquare;
          const tone = COLOR_MAP[r.color] ?? COLOR_MAP.slate;
          const isSel = selected === r.module;
          return (
            <button
              key={r.module}
              type="button"
              onClick={() => onSelect(r.module)}
              aria-pressed={isSel}
               className={`group relative text-left rounded-lg border bg-background p-4 transition-all
                 ${isSel ? "border-primary/40 shadow-sm ring-2 ring-primary/10" : "hover:border-primary/25 hover:shadow-sm"}
                ${r.is_active ? "" : "opacity-60"}`}
            >
              <div className="flex items-start gap-3">
                 <div className={`h-10 w-10 shrink-0 rounded-lg grid place-items-center ${tone.bg}`}>
                  <Icon className={`h-[18px] w-[18px] ${tone.fg}`} />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-[13.5px] truncate">{r.label}</span>
                    {r.is_builtin && (
                      <Lock className="h-3 w-3 text-muted-foreground/70 shrink-0" />
                    )}
                     {isSel && <Check className="h-4 w-4 text-primary ml-auto shrink-0" />}
                  </div>

                  <div className="mt-1 flex items-center gap-2 text-[11.5px] text-muted-foreground">
                    <span className="tabular-nums">{counts[r.module] ?? 0} questions</span>
                    {r.scored && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="tabular-nums">out of {r.display_scale}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* controls sit apart from the card's own click target */}
              <div className="mt-3 flex items-center justify-between border-t pt-2.5">
                <div
                  className="flex items-center gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                  role="presentation"
                >
                  <Switch
                    checked={r.is_active}
                    onCheckedChange={() => toggle(r)}
                    aria-label={`${r.label} active`}
                    className="scale-[0.8] origin-left"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    {r.is_active ? "Active" : "Off"}
                  </span>
                </div>
                <div
                  className="flex items-center opacity-60 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                  role="presentation"
                >
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {!r.is_builtin && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(r)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        <button
          type="button"
          onClick={openAdd}
           className="rounded-lg border border-dashed p-4 text-left transition-colors hover:border-primary/30 hover:bg-muted/40 grid place-items-center min-h-[112px]"
        >
          <span className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
            <Plus className="h-4 w-4" /> New type
          </span>
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.label}` : "New feedback type"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Shelf Audit"
              />
              {!editing && form.label.trim() && (
                <p className="text-[11px] text-muted-foreground">
                  Stored as <code className="font-mono">{toKey(form.label)}</code>
                </p>
              )}
              {editing?.is_builtin && (
                <p className="text-[11px] text-muted-foreground">
                  Built-in type — the name reps see can change, the key cannot.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Shown under the name on the tile"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Icon</Label>
                <Select value={form.icon} onValueChange={(v) => setForm((f) => ({ ...f, icon: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ICON_NAMES.map((n) => {
                      const I = ICON_MAP[n];
                      return (
                        <SelectItem key={n} value={n}>
                          <span className="flex items-center gap-2">
                            <I className="h-3.5 w-3.5" /> {n}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Colour</Label>
                <Select value={form.color} onValueChange={(v) => setForm((f) => ({ ...f, color: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COLOR_NAMES.map((n) => (
                      <SelectItem key={n} value={n}>
                        <span className="flex items-center gap-2">
                          <span className={`h-3 w-3 rounded-full ${COLOR_MAP[n].bg}`} /> {n}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Order</Label>
                <Input
                  type="number" value={form.sort_order}
                  onChange={(e) => setForm((f) => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-normal">Produces a score</Label>
                <Switch checked={form.scored}
                        onCheckedChange={(v) => setForm((f) => ({ ...f, scored: v }))} />
              </div>
              {form.scored && (
                <div className="space-y-1.5">
                  <Label className="text-[12px]">Shown out of</Label>
                  <Input
                    type="number" min={1} value={form.display_scale}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, display_scale: parseInt(e.target.value) || 10 }))}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Question points are scaled to this. 10 matches the existing forms.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-normal">Show on the visit card</Label>
                <Switch checked={form.show_on_visit}
                        onCheckedChange={(v) => setForm((f) => ({ ...f, show_on_visit: v }))} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="font-normal">Active</Label>
                <Switch checked={form.is_active}
                        onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
              </div>
            </div>

            {editing?.is_builtin && (
              <p className="text-[11px] text-muted-foreground">
                This type has its own screen, so its tile and layout are fixed. Questions and
                scoring are still configurable.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editing ? "Save changes" : "Create type"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
