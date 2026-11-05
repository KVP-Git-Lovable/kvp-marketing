import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowDown, ArrowUp, List, Loader2, Plus, Route, Sparkles, Undo2, WandSparkles, X } from "lucide-react";
import {
  flowBlocker, listOps, OVERVIEW_LISTS, parseOverview, type OverviewContent,
  type OverviewItem, type OverviewListKey,
} from "./overviewContent";
import { OverviewIconPicker } from "./OverviewIconPicker";

interface Props {
  value: OverviewContent;
  onChange: (next: OverviewContent) => void;
  /** The activity as configured so far, so the writer quotes real numbers. */
  config?: Record<string, unknown>;
}

const MARKER: Record<string, (i: number) => string> = {
  number: (i) => String(i + 1),
  tick: () => "✓",
  cross: () => "×",
  bullet: () => "•",
};

/**
 * Which layout these steps will get on the rep's page, and what to change if
 * you wanted the other one.
 *
 * Without this the fallback is invisible: an admin writes a heading two words
 * too long, the journey silently becomes a list, and nothing says why.
 */
function FlowHint({ items }: { items: OverviewItem[] }) {
  const blocker = flowBlocker(items);
  return (
    <div className="flex items-start gap-1.5 rounded-[8px] bg-muted/50 px-2.5 py-2">
      {blocker
        ? <List className="h-3.5 w-3.5 shrink-0 mt-px text-muted-foreground" />
        : <Route className="h-3.5 w-3.5 shrink-0 mt-px text-violet-500" />}
      <p className="text-[11px] leading-snug text-muted-foreground">
        {blocker
          ? <>Reps see these as a <strong className="font-semibold">list</strong>. {blocker}</>
          : <>Reps see these as a <strong className="font-semibold">journey</strong> — numbered tiles across the page, ending on what the game pays.</>}
      </p>
    </div>
  );
}

/**
 * Authoring side of the rep-facing Overview tab. Every section is optional —
 * leave one empty and the rep never sees a card for it, which is why nothing
 * here is pre-filled with example rows.
 */
export function OverviewEditor({ value, onChange, config }: Props) {
  const setList = (key: OverviewListKey, list: OverviewItem[]) => onChange({ ...value, [key]: list });

  const [busy, setBusy] = useState<null | "draft" | "improve">(null);
  /** One step back, so an AI rewrite is never a one-way door. */
  const [undoTo, setUndoTo] = useState<OverviewContent | null>(null);

  const written =
    Boolean(value.about?.trim()) || Boolean(value.why?.trim()) ||
    OVERVIEW_LISTS.some(({ key }) => (value[key] ?? []).some((x) => x.text.trim()));

  const runWriter = async (mode: "draft" | "improve") => {
    setBusy(mode);
    try {
      const { data, error } = await supabase.functions.invoke("gamification-overview-writer", {
        body: { ...config, mode, current: value },
      });
      if (error) throw error;
      const err = (data as any)?.error;
      if (err) throw new Error(err);
      const next = (data as any)?.overview;
      if (!next) throw new Error("The writer came back empty.");
      setUndoTo(value);
      // The writer returns plain strings. Normalise before it reaches state,
      // or every row below would try to read .text off a string.
      onChange(parseOverview(next));
      toast.success(mode === "draft" ? "Draft written — edit anything before saving." : "Tidied up — check it still says what you meant.");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not reach the AI writer.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-[12px] text-muted-foreground">
        This is what a rep reads on the game's Overview tab. Anything you leave blank is hidden
        for them rather than shown as an empty section.
      </p>

      <div className="rounded-[12px] border bg-muted/40 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <p className="text-[12.5px] font-semibold">Write it with AI</p>
        </div>
        <p className="text-[11.5px] text-muted-foreground">
          {written
            ? "Tidy up what you have written — spelling, grammar and simpler wording, keeping your meaning and your bullets."
            : "Draft all five sections from this activity's own setup — its trigger, points, tiers and caps. Nothing is saved until you do."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button" size="sm" variant="secondary" className="text-[11.5px]"
            disabled={busy !== null}
            onClick={() => runWriter("draft")}
          >
            {busy === "draft" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <WandSparkles className="h-3.5 w-3.5 mr-1.5" />}
            {written ? "Rewrite from setup" : "Draft with AI"}
          </Button>
          <Button
            type="button" size="sm" variant="outline" className="text-[11.5px]"
            disabled={busy !== null || !written}
            onClick={() => runWriter("improve")}
          >
            {busy === "improve" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
            Improve my wording
          </Button>
          {undoTo && (
            <Button
              type="button" size="sm" variant="ghost" className="text-[11.5px]"
              disabled={busy !== null}
              onClick={() => { onChange(undoTo); setUndoTo(null); toast.message("Put your own words back."); }}
            >
              <Undo2 className="h-3.5 w-3.5 mr-1.5" /> Undo
            </Button>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Everything it writes lands in the fields below for you to edit. Read it before you save — it uses this
          activity's real numbers, but the words are its own.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[12.5px]">About this game</Label>
        <Textarea
          rows={3}
          value={value.about ?? ""}
          onChange={(e) => onChange({ ...value, about: e.target.value })}
          placeholder="What this game rewards, in a sentence or two."
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[12.5px]">Why it matters</Label>
        <Textarea
          rows={2}
          value={value.why ?? ""}
          onChange={(e) => onChange({ ...value, why: e.target.value })}
          placeholder="One line on what a rep gets out of playing this."
        />
        <p className="text-[11px] text-muted-foreground">
          Shown first on the rep's Overview, above everything else.
        </p>
      </div>

      {OVERVIEW_LISTS.map(({ key, label, addLabel, placeholder, titlePlaceholder, marker }) => {
        const list = value[key] ?? [];
        return (
          <div key={key} className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-[12.5px]">{label}</Label>
              <Button
                type="button" size="sm" variant="outline" className="h-7 text-[11.5px]"
                onClick={() => setList(key, listOps.add(list))}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> {addLabel}
              </Button>
            </div>

            {key === "steps" && list.length > 0 && <FlowHint items={list} />}

            {list.length === 0 ? (
              <p className="text-[11.5px] text-muted-foreground">Not configured — hidden from reps.</p>
            ) : (
              <div className="space-y-1.5">
                {list.map((item, i) => (
                  // Icon and short title are optional: left blank, the rep-facing
                  // page derives both from the sentence, so an Overview written
                  // before this existed still renders.
                  <div key={i} className="flex items-start gap-1.5">
                    <span className="w-6 shrink-0 text-center text-[11.5px] font-bold text-muted-foreground pt-2">
                      {MARKER[marker](i)}
                    </span>
                    <OverviewIconPicker
                      value={item.icon}
                      image={item.image}
                      label={item.title || item.text}
                      onChange={(choice) => setList(key, listOps.set(list, i, choice))}
                    />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <Input
                        value={item.title ?? ""}
                        placeholder={`${titlePlaceholder}  (short heading — optional)`}
                        onChange={(e) => setList(key, listOps.set(list, i, { title: e.target.value }))}
                        className="h-8 text-[12.5px] font-semibold"
                      />
                      <Input
                        value={item.text}
                        placeholder={placeholder}
                        onChange={(e) => setList(key, listOps.set(list, i, { text: e.target.value }))}
                        className="h-8 text-[12.5px]"
                      />
                    </div>
                    <div className="flex flex-col shrink-0">
                      <Button
                        type="button" size="icon" variant="ghost" className="h-8 w-8"
                        disabled={i === 0}
                        aria-label={`Move up: ${item.text || "empty"}`}
                        onClick={() => setList(key, listOps.move(list, i, -1))}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button" size="icon" variant="ghost" className="h-8 w-8"
                        disabled={i === list.length - 1}
                        aria-label={`Move down: ${item.text || "empty"}`}
                        onClick={() => setList(key, listOps.move(list, i, 1))}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Button
                      type="button" size="icon" variant="ghost"
                      className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                      aria-label={`Remove: ${item.text || "empty"}`}
                      onClick={() => setList(key, listOps.remove(list, i))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
