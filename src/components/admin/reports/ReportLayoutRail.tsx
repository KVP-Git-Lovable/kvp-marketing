import React from 'react';
import { GripVertical, Eye, EyeOff, Trash2, Plus, BarChart3, Table2, Sparkles, LayoutGrid, Trophy, Scale, LineChart, PieChart, ArrowRightLeft, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type LayoutBlockType = 'kpis' | 'table' | 'ai_summary' | 'chart' | 'leaderboard' | 'highlights';

/** One movable piece of the report body. Mirrors PdfTemplate.blocks in the
 *  edge function's pdf-renderer.ts — keep the two in step. */
export interface LayoutBlock {
  id: string;
  type: LayoutBlockType;
  hidden?: boolean;
  /** kpis: which measures get a card, in the order chosen. */
  keys?: string[] | null;
  chart?: 'bar' | 'line' | 'pie';
  x?: string | null;
  y?: string[] | null;
  orientation?: 'vertical' | 'horizontal';
  limit?: number | null;
  title?: string | null;
  /** Hex for the first series; later series keep the standard palette. */
  color?: string | null;
  /** highlights: how the two sides are headed. */
  high_label?: string | null;
  low_label?: string | null;
  /** ai_summary: which shape of note the model writes. */
  ai_mode?: AiMode;
  /** The older boolean spelling of ai_mode 'sections'. Still read, never written. */
  ai_sections?: boolean;
  /** sections mode: what belongs in each half, in the author's own words. */
  high_prompt?: string | null;
  low_prompt?: string | null;
  /** Any mode: extra instruction appended to whatever the mode asks for. */
  extra_prompt?: string | null;
}

export interface Field { key: string; label: string }

export type AiMode = 'note' | 'sections' | 'actions' | 'exceptions';

/** The four shapes a summary can take, and what each is for. */
const AI_MODES: Array<{ value: AiMode; label: string; hint: string }> = [
  { value: 'note', label: 'Short note',
    hint: 'One judgement, the names and numbers behind it, and a line to follow up.' },
  { value: 'sections', label: 'Highlights & lowlights',
    hint: 'Two halves: what went well, and what to do about the rest.' },
  { value: 'actions', label: 'What to do next',
    hint: 'Three to five things to do, each tied to a person and a number.' },
  { value: 'exceptions', label: 'Only what looks wrong',
    hint: 'Zeros, outliers, gaps. Silent when the period is clean.' },
];

/** Starting text for the two halves. Shown in the boxes so nobody faces a blank
 *  one, and sent as-is when left untouched. Kept in step with the edge function. */
export const DEFAULT_HIGH_PROMPT =
  'Name who beat the plan and the number that proves it — the best coverage, the biggest contribution, the clearest improvement.';
export const DEFAULT_LOW_PROMPT =
  'Name where the plan slipped, who or which beat it was, the number behind it, and what to do about it.';

/** What a report draws when it has never been given an explicit order. The same
 *  three, in the same order, that the renderer falls back to. */
export const DEFAULT_LAYOUT: LayoutBlock[] = [
  { id: 'kpis', type: 'kpis' },
  { id: 'table', type: 'table' },
  { id: 'ai_summary', type: 'ai_summary' },
];

/** Enough separation that two charts on one page never read as the same one. */
const CHART_COLORS: Array<{ hex: string; name: string }> = [
  { hex: '', name: 'Theme accent' },
  { hex: '#2563eb', name: 'Blue' },
  { hex: '#0d9488', name: 'Teal' },
  { hex: '#16a34a', name: 'Green' },
  { hex: '#d97706', name: 'Amber' },
  { hex: '#9333ea', name: 'Purple' },
  { hex: '#dc2626', name: 'Red' },
  { hex: '#475569', name: 'Slate' },
];

const META: Record<LayoutBlockType, { label: string; hint: string; icon: typeof Table2 }> = {
  kpis: { label: 'KPI cards', hint: 'The band of totals across the top', icon: LayoutGrid },
  ai_summary: { label: 'Summary', hint: 'The AI paragraph, when it is switched on', icon: Sparkles },
  table: { label: 'Table', hint: 'The rows themselves', icon: Table2 },
  chart: { label: 'Chart', hint: 'Drawn from the same rows as the table', icon: BarChart3 },
  leaderboard: { label: 'Leaderboard', hint: 'Ranked, with the top three marked', icon: Trophy },
  highlights: { label: 'Highlights', hint: 'Who is ahead, and who needs a word', icon: Scale },
};

/** The block types a report can have more than one of. */
const ADDABLE: Array<{ type: LayoutBlockType; label: string }> = [
  { type: 'chart', label: 'Chart' },
  { type: 'leaderboard', label: 'Leaderboard' },
  { type: 'highlights', label: 'Highlights' },
];

/** A date dimension belongs on a line, so the axis reads as time passing. */
const looksLikeDate = (key: string) => /(^|_)date($|_)|_at$|^day$|^month$/.test(key);

/**
 * Starting points for a chart, instead of an empty one and four dropdowns.
 *
 * Almost every chart anybody builds here is one of four readings, so each is
 * offered as a finished chart that the editor below can then be used to adjust.
 * `fit` returns null when the data cannot support that reading — a trend needs
 * a date to run along, so without one the option is simply not offered rather
 * than drawn as a nonsense chart.
 */
export interface ChartPreset {
  id: string;
  label: string;
  hint: string;
  icon: typeof BarChart3;
  fit: (dims: Field[], measures: Field[]) => Partial<LayoutBlock> | null;
}

const firstNonDate = (dims: Field[]) => dims.find(d => !looksLikeDate(d.key)) ?? dims[0];

export const CHART_PRESETS: ChartPreset[] = [
  {
    id: 'ranking',
    label: 'Ranking',
    hint: 'Who is highest — bars across, top 10',
    icon: ArrowRightLeft,
    fit: (dims, measures) => {
      const d = firstNonDate(dims); const m = measures[0];
      if (!d || !m) return null;
      return { chart: 'bar', orientation: 'horizontal', x: d.key, y: [m.key], limit: 10 };
    },
  },
  {
    id: 'trend',
    label: 'Trend',
    hint: 'How it moved over time',
    icon: LineChart,
    fit: (dims, measures) => {
      const d = dims.find(x => looksLikeDate(x.key)); const m = measures[0];
      if (!d || !m) return null;
      return { chart: 'line', orientation: 'vertical', x: d.key, y: [m.key], limit: 0 };
    },
  },
  {
    id: 'share',
    label: 'Share',
    hint: 'How the total splits up — top 6 as a pie',
    icon: PieChart,
    fit: (dims, measures) => {
      const d = firstNonDate(dims); const m = measures[0];
      if (!d || !m) return null;
      return { chart: 'pie', x: d.key, y: [m.key], limit: 6 };
    },
  },
  {
    id: 'compare',
    label: 'Compare',
    hint: 'Two measures side by side',
    icon: ArrowUpDown,
    fit: (dims, measures) => {
      const d = firstNonDate(dims);
      // Grouped bars need a genuine second measure; one measure is a Ranking.
      if (!d || measures.length < 2) return null;
      return { chart: 'bar', orientation: 'vertical', x: d.key, y: [measures[0].key, measures[1].key], limit: 8 };
    },
  },
];

const uid = () => `b${Math.random().toString(36).slice(2, 9)}`;

/** The block's mode, reading the older boolean when that is all it has. */
export const aiModeOf = (b: LayoutBlock): AiMode =>
  b.ai_mode ?? (b.ai_sections === true ? 'sections' : 'note');

/**
 * The report body, as a list you can reorder.
 *
 * The PDF preview beside this is the REAL file — rendered by the same edge
 * function that mails it — so it cannot carry drag handles of its own. Dragging
 * happens here instead and the page re-renders, which keeps what you see and
 * what lands in the inbox the same document.
 */
export function ReportLayoutRail({
  value, onChange, dims, measures, compact, kpiKeys, setKpiKeys, variant = 'all',
  groupBy, setGroupBy,
}: {
  value?: LayoutBlock[] | null;
  onChange: (blocks: LayoutBlock[]) => void;
  dims: Field[];
  measures: Field[];
  /** Tighter spacing for the popover; the panel beside the preview has room. */
  compact?: boolean;
  /**
   * The chosen KPI cards, in card order.
   *
   * Deliberately the SAME state the KPI cards button edits rather than a copy
   * on the block: two lists of cards that could disagree is how a report ends
   * up showing one set in the builder and another in the PDF.
   */
  kpiKeys?: string[];
  setKpiKeys?: React.Dispatch<React.SetStateAction<string[]>>;
  /** Which column closes each run of rows with a subtotal. '' is no grouping. */
  groupBy?: string | null;
  setGroupBy?: (v: string | null) => void;
  /**
   * 'charts' narrows the rail to the chart blocks alone, for the Chart button
   * that sits beside KPI cards. Reordering still moves them within the whole
   * body, so the two views can never describe different reports.
   */
  variant?: 'all' | 'charts';
}) {
  const blocks = value && value.length ? value : DEFAULT_LAYOUT;
  // The index being dragged is held in a ref, not in state: onDrop reads it in
  // the same gesture that set it, and a state value would still be the previous
  // render's. The state copy below exists only to light up the drop target.
  const dragFrom = React.useRef<number | null>(null);
  const [dragging, setDragging] = React.useState<number | null>(null);
  const [dragOver, setDragOver] = React.useState<number | null>(null);
  // The KPI block opens on sight: its whole point is the cards inside it, and
  // a collapsed row reads as nothing having changed.
  const [openId, setOpenId] = React.useState<string | null>(
    variant === 'all' ? ((value ?? DEFAULT_LAYOUT).find(b => b.type === 'kpis')?.id ?? null) : null,
  );
  const canEditKpis = !!setKpiKeys;
  const chartsOnly = variant === 'charts';
  // Index pairs, so a filtered view still drags against the real array.
  const shown = blocks
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => !chartsOnly || b.type === 'chart');

  const labelOf = (k?: string | null) =>
    [...dims, ...measures].find(f => f.key === k)?.label ?? k ?? '';

  const commit = (next: LayoutBlock[]) => onChange(next);
  const patch = (id: string, p: Partial<LayoutBlock>) =>
    commit(blocks.map(b => (b.id === id ? { ...b, ...p } : b)));

  const move = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= blocks.length || to >= blocks.length) return;
    const next = [...blocks];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    commit(next);
  };

  const addBlock = (type: LayoutBlockType, preset?: ChartPreset) => {
    const x = dims[0]?.key ?? null;
    const y = measures[0] ? [measures[0].key] : [];
    const id = uid();
    const base: LayoutBlock = { id, type, x, y, title: null };
    const block: LayoutBlock =
      type === 'chart'
        ? {
            ...base,
            chart: x && looksLikeDate(x) ? 'line' : 'bar',
            orientation: 'vertical',
            limit: 10,
            // A preset arrives already configured, so the chart is readable in
            // the preview before the editor below is touched at all.
            ...(preset?.fit(dims, measures) ?? {}),
          }
        : type === 'leaderboard' ? { ...base, limit: 10 }
        : { ...base, limit: 3 };
    commit([...blocks, block]);
    setOpenId(id);
  };

  const presets = CHART_PRESETS.filter(p => p.fit(dims, measures));

  return (
    <div className="space-y-2">
      {setGroupBy && dims.length > 0 && (
        <div className="space-y-1 rounded-lg border p-2.5">
          <Label className="text-[10.5px] text-muted-foreground">Group the table by</Label>
          <Select
            value={groupBy || '__none'}
            onValueChange={v => setGroupBy(v === '__none' ? null : v)}
          >
            <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">No grouping</SelectItem>
              {dims.map(d => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-[10px] leading-snug text-muted-foreground">
            {groupBy
              ? 'Each run of rows sharing that value is closed by a shaded subtotal. A run of one is left alone — its subtotal would just repeat the row.'
              : 'Rows are listed as they come. Pick a field to add a shaded subtotal under each group.'}
          </p>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground leading-snug">
        {chartsOnly
          ? 'Charts are drawn from the same rows as the table. Drag to reorder them.'
          : 'Drag to reorder. This is the order the PDF draws in — put the summary on top by dragging it there.'}
      </p>

      {chartsOnly && shown.length === 0 && (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-[11px] text-muted-foreground">
          No charts yet. Add one and it is drawn above the table.
        </p>
      )}

      <div className="space-y-1.5">
        {shown.map(({ b, i }) => {
          const m = META[b.type];
          const Icon = m.icon;
          const open = openId === b.id && b.type === 'chart';
          return (
            <div
              key={b.id}
              draggable
              onDragStart={(e) => {
                dragFrom.current = i;
                setDragging(i);
                e.dataTransfer.effectAllowed = 'move';
                // Firefox refuses to start a drag until something is on the
                // dataTransfer, so give it the index it is already carrying.
                try { e.dataTransfer.setData('text/plain', String(i)); } catch { /* ignore */ }
              }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(i); }}
              onDragLeave={() => setDragOver(v => (v === i ? null : v))}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragFrom.current ?? Number(e.dataTransfer.getData('text/plain'));
                if (Number.isInteger(from)) move(from as number, i);
                dragFrom.current = null; setDragging(null); setDragOver(null);
              }}
              onDragEnd={() => { dragFrom.current = null; setDragging(null); setDragOver(null); }}
              className={cn(
                'rounded-lg border bg-background transition-colors',
                dragOver === i && dragging !== null && dragging !== i && 'border-primary bg-primary/5',
                dragging === i && 'opacity-60 ring-1 ring-primary/40',
                b.hidden && 'opacity-55',
              )}
            >
              <div className={cn('flex items-center gap-2', compact ? 'px-2 py-1.5' : 'px-2.5 py-2')}>
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" />
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    const editable = b.type === 'chart' || b.type === 'leaderboard'
                      || b.type === 'highlights' || b.type === 'ai_summary'
                      || (b.type === 'kpis' && canEditKpis);
                    if (editable) setOpenId(openId === b.id ? null : b.id);
                  }}
                >
                  <div className="truncate text-[12.5px] font-medium">
                    {b.type === 'chart' || b.type === 'leaderboard' || b.type === 'highlights'
                      ? (b.title || `${m.label} — ${(b.y ?? []).map(labelOf).join(', ') || 'pick a measure'}`)
                      : m.label}
                  </div>
                  <div className="truncate text-[10.5px] text-muted-foreground">
                    {b.type === 'chart' ? `${b.chart ?? 'bar'} · tap to edit`
                      : b.type === 'leaderboard' || b.type === 'highlights' ? `by ${labelOf(b.x) || '—'} · tap to edit`
                      : b.type === 'ai_summary' ? `${AI_MODES.find(mm => mm.value === aiModeOf(b))?.label ?? 'Short note'} · tap to edit`
                      : b.type === 'kpis' && canEditKpis
                        ? `${(kpiKeys ?? []).length || 'auto'} ${(kpiKeys ?? []).length === 1 ? 'card' : 'cards'} · tap to arrange`
                        : m.hint}
                  </div>
                </button>
                <Button
                  type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                  aria-label={b.hidden ? 'Show this block' : 'Hide this block'}
                  onClick={() => patch(b.id, { hidden: !b.hidden })}
                >
                  {b.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
                {(b.type === 'chart' || b.type === 'leaderboard' || b.type === 'highlights') && (
                  <Button
                    type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                    aria-label={`Remove this ${m.label.toLowerCase()}`}
                    onClick={() => commit(blocks.filter(x => x.id !== b.id))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {open && (
                <ChartEditor
                  block={b}
                  dims={dims}
                  measures={measures}
                  onPatch={(p) => patch(b.id, p)}
                />
              )}
              {openId === b.id && (b.type === 'leaderboard' || b.type === 'highlights') && (
                <RankEditor block={b} dims={dims} measures={measures} onPatch={(pp) => patch(b.id, pp)} />
              )}
              {openId === b.id && b.type === 'ai_summary' && (
                <AiSummaryEditor block={b} measures={measures} onPatch={(pp) => patch(b.id, pp)} />
              )}
              {openId === b.id && b.type === 'kpis' && canEditKpis && (
                <KpiCardEditor
                  keys={kpiKeys ?? []}
                  setKeys={setKpiKeys!}
                  measures={measures}
                />
              )}
            </div>
          );
        })}
      </div>

      {presets.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-[10.5px] text-muted-foreground">Add a chart</Label>
          <div className="grid grid-cols-2 gap-1.5">
            {presets.map(p => {
              const Icon = p.icon;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addBlock('chart', p)}
                  className="rounded-lg border p-2 text-left transition-colors hover:border-primary hover:bg-primary/5"
                >
                  <span className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11.5px] font-medium">{p.label}</span>
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">{p.hint}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className={cn('grid gap-1.5', chartsOnly ? 'grid-cols-1' : 'grid-cols-3')}>
        {(chartsOnly ? ADDABLE.slice(0, 1) : ADDABLE).map(a => (
          <Button
            key={a.type}
            type="button" variant="outline" size="sm" className="px-1 text-[11px]"
            onClick={() => addBlock(a.type)}
            disabled={dims.length === 0 || measures.length === 0}
          >
            <Plus className="mr-1 h-3 w-3" /> {a.type === 'chart' ? 'Blank chart' : a.label}
          </Button>
        ))}
      </div>
      {(dims.length === 0 || measures.length === 0) && (
        <p className="text-[10.5px] text-muted-foreground">
          These need a dimension to group by and a measure to read.
        </p>
      )}
    </div>
  );
}

/**
 * The leaderboard and the highlights panel.
 *
 * Both rank one dimension by a measure, so they share an editor. A leaderboard
 * can show up to three measures across; the highlights panel shows one, because
 * its job is a single comparison read at a glance.
 */
function RankEditor({
  block, dims, measures, onPatch,
}: {
  block: LayoutBlock;
  dims: Field[];
  measures: Field[];
  onPatch: (p: Partial<LayoutBlock>) => void;
}) {
  const isBoard = block.type === 'leaderboard';
  const maxY = isBoard ? 3 : 1;
  const y = block.y ?? [];

  const toggleY = (k: string) => {
    if (y.includes(k)) {
      onPatch({ y: y.filter(v => v !== k) });
    } else if (y.length < maxY) {
      onPatch({ y: [...y, k] });
    } else {
      // At the cap, picking another replaces the last rather than doing nothing.
      onPatch({ y: [...y.slice(0, maxY - 1), k] });
    }
  };

  return (
    <div className="space-y-2.5 border-t px-2.5 py-2.5">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10.5px] text-muted-foreground">Rank by</Label>
          <Select value={block.x ?? ''} onValueChange={(v) => onPatch({ x: v })}>
            <SelectTrigger className="h-8 text-[12px]"><SelectValue placeholder="Pick a field" /></SelectTrigger>
            <SelectContent>
              {dims.map(d => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10.5px] text-muted-foreground">
            {isBoard ? 'How many places' : 'How many each side'}
          </Label>
          <Input
            type="number" min={1} max={isBoard ? 50 : 5} className="h-8 text-[12px]"
            value={block.limit ?? (isBoard ? 10 : 3)}
            onChange={(e) => onPatch({ limit: Number(e.target.value) || 1 })}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-[10.5px] text-muted-foreground">
          {isBoard ? `Columns (${y.length} of 3) — the first one sets the order` : 'Measure'}
        </Label>
        <div className="flex flex-wrap gap-1">
          {measures.map(ms => {
            const on = y.includes(ms.key);
            return (
              <button
                key={ms.key}
                type="button"
                onClick={() => toggleY(ms.key)}
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[11px] transition-colors',
                  on ? 'border-primary bg-primary/10 font-medium text-primary'
                     : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {on && isBoard ? `${y.indexOf(ms.key) + 1}. ` : ''}{ms.label}
              </button>
            );
          })}
        </div>
      </div>

      {!isBoard && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10.5px] text-muted-foreground">Left heading</Label>
            <Input className="h-8 text-[12px]" placeholder="Highlights"
                   value={block.high_label ?? ''}
                   onChange={(e) => onPatch({ high_label: e.target.value || null })} />
          </div>
          <div className="space-y-1">
            <Label className="text-[10.5px] text-muted-foreground">Right heading</Label>
            <Input className="h-8 text-[12px]" placeholder="Needs attention"
                   value={block.low_label ?? ''}
                   onChange={(e) => onPatch({ low_label: e.target.value || null })} />
          </div>
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-[10.5px] text-muted-foreground">Heading</Label>
        <Input className="h-8 text-[12px]" placeholder="Written for you if left blank"
               value={block.title ?? ''}
               onChange={(e) => onPatch({ title: e.target.value || null })} />
      </div>
    </div>
  );
}

/**
 * What the AI summary should say, and about what.
 *
 * Two sections is what a manager reads for — what went well, and what to do
 * about the rest — so it is a switch rather than something to describe in the
 * prompt box and hope for.
 */
/**
 * The summary's settings, used in two places: the Layout rail's Summary block,
 * and the AI summary panel itself — which is where anyone switching the summary
 * on is already looking, so the shape has to be choosable there too.
 */
export function AiSummaryEditor({
  block, measures, onPatch,
}: {
  block: LayoutBlock;
  measures: Field[];
  onPatch: (p: Partial<LayoutBlock>) => void;
}) {
  const mode = aiModeOf(block);
  const picked = block.keys ?? [];
  const chosen = AI_MODES.find(m => m.value === mode)!;

  return (
    <div className="space-y-2.5 border-t px-2.5 py-2.5">
      <div className="space-y-1">
        <Label className="text-[10.5px] text-muted-foreground">What should the AI write?</Label>
        <Select
          value={mode}
          // ai_sections is cleared on every write, so the older boolean can
          // never contradict the mode that replaced it.
          onValueChange={(v) => onPatch({ ai_mode: v as AiMode, ai_sections: undefined })}
        >
          <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {AI_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-[10.5px] leading-snug text-muted-foreground">{chosen.hint}</p>
      </div>

      {mode === 'sections' && (
        <>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-[10.5px] text-muted-foreground">
                Left half — heading &amp; what goes in it
              </Label>
              {block.high_prompt != null && (
                <button type="button" className="text-[10px] text-muted-foreground hover:text-foreground"
                        onClick={() => onPatch({ high_prompt: null })}>
                  Reset
                </button>
              )}
            </div>
            <Input className="h-8 text-[12px]" placeholder="Highlights"
                   value={block.high_label ?? ''}
                   onChange={(e) => onPatch({ high_label: e.target.value || null })} />
            <Textarea
              className="min-h-[58px] text-[11.5px]"
              value={block.high_prompt ?? DEFAULT_HIGH_PROMPT}
              onChange={(e) => onPatch({ high_prompt: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-[10.5px] text-muted-foreground">
                Right half — heading &amp; what goes in it
              </Label>
              {block.low_prompt != null && (
                <button type="button" className="text-[10px] text-muted-foreground hover:text-foreground"
                        onClick={() => onPatch({ low_prompt: null })}>
                  Reset
                </button>
              )}
            </div>
            <Input className="h-8 text-[12px]" placeholder="Areas for improvement"
                   value={block.low_label ?? ''}
                   onChange={(e) => onPatch({ low_label: e.target.value || null })} />
            <Textarea
              className="min-h-[58px] text-[11.5px]"
              value={block.low_prompt ?? DEFAULT_LOW_PROMPT}
              onChange={(e) => onPatch({ low_prompt: e.target.value })}
            />
          </div>
        </>
      )}

      <div className="space-y-1">
        <Label className="text-[10.5px] text-muted-foreground">
          Weigh these measures {picked.length ? `(${picked.length})` : '— all of them, unless you pick'}
        </Label>
        <div className="flex flex-wrap gap-1">
          {measures.map(ms => {
            const on = picked.includes(ms.key);
            return (
              <button
                key={ms.key}
                type="button"
                onClick={() => onPatch({
                  keys: on ? picked.filter(k => k !== ms.key) : [...picked, ms.key],
                })}
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[11px] transition-colors',
                  on ? 'border-primary bg-primary/10 font-medium text-primary'
                     : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {ms.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-[10.5px] text-muted-foreground">Anything else it should know</Label>
        <Textarea
          className="min-h-[52px] text-[11.5px]"
          placeholder="e.g. Call out any beat that booked nothing after 2pm."
          value={block.extra_prompt ?? ''}
          onChange={(e) => onPatch({ extra_prompt: e.target.value || null })}
        />
        <p className="text-[10.5px] leading-snug text-muted-foreground">
          Steers what it emphasises. It cannot change the shape above, and every
          number still has to come from the report.
        </p>
      </div>
    </div>
  );
}
/**
 * What the summary is set up to do, in a few words.
 *
 * The panel collapses, so this line is all a reader has: it has to name the
 * shape, say which measures are weighed, and admit when there is no brief yet.
 * "Everything is considered" is a real answer and the commonest one — saying it
 * out loud beats leaving the line blank and letting someone assume the opposite.
 */
export function aiSummaryFactors(
  block: LayoutBlock | null | undefined,
  prompt: string,
  measures: Field[],
): string[] {
  const mode = block ? aiModeOf(block) : 'note';
  const out: string[] = [AI_MODES.find(m => m.value === mode)?.label ?? 'Short note'];

  const picked = (block?.keys ?? []).filter(k => measures.some(m => m.key === k));
  out.push(
    picked.length === 0
      ? `weighs all ${measures.length} measures`
      : `weighs ${picked.map(k => measures.find(m => m.key === k)!.label).join(', ')}`,
  );

  if (mode === 'sections') {
    out.push(`${block?.high_label || 'Highlights'} / ${block?.low_label || 'Areas for improvement'}`);
  }
  // A brief is required before the report can be saved, so its absence is the
  // one thing here worth flagging rather than describing.
  if (!prompt.trim()) out.push('no brief yet');
  else if (block?.extra_prompt?.trim()) out.push('brief + extra note');
  else out.push('brief set');

  return out;
}

/**
 * The KPI band, card by card.
 *
 * Ticking used to be the only ordering: the cards came out in the order they
 * were ticked, so moving one meant unticking everything after it. They are
 * dragged here instead, in the same rail that orders the blocks around them.
 */
function KpiCardEditor({
  keys, setKeys, measures,
}: {
  keys: string[];
  setKeys: React.Dispatch<React.SetStateAction<string[]>>;
  measures: Field[];
}) {
  // Same reason as the block list: onDrop reads this in the gesture that set it.
  const from = React.useRef<number | null>(null);
  const [dragging, setDragging] = React.useState<number | null>(null);
  const [over, setOver] = React.useState<number | null>(null);

  const labelOf = (k: string) => measures.find(m => m.key === k)?.label ?? k;
  const chosen = keys.filter(k => measures.some(m => m.key === k));
  const spare = measures.filter(m => !keys.includes(m.key));
  const full = chosen.length >= 6;

  const move = (f: number, t: number) => {
    if (f === t || f < 0 || t < 0 || f >= keys.length || t >= keys.length) return;
    setKeys(prev => {
      const next = [...prev];
      const [m] = next.splice(f, 1);
      next.splice(t, 0, m);
      return next;
    });
  };

  return (
    <div className="space-y-2.5 border-t px-2.5 py-2.5">
      <div className="flex items-center justify-between">
        <Label className="text-[10.5px] text-muted-foreground">
          Cards, left to right — {chosen.length} of 6
        </Label>
        {chosen.length > 0 && (
          <button
            type="button"
            className="text-[10.5px] text-muted-foreground hover:text-foreground"
            onClick={() => setKeys([])}
          >
            Reset to auto
          </button>
        )}
      </div>

      {chosen.length === 0 ? (
        <p className="text-[10.5px] leading-snug text-muted-foreground">
          Nothing chosen, so the band shows every measure this report totals. Add one
          below to take control of which figures lead and in what order.
        </p>
      ) : (
        <div className="space-y-1">
          {chosen.map((k, i) => (
            <div
              key={k}
              draggable
              onDragStart={(e) => {
                from.current = i; setDragging(i);
                e.dataTransfer.effectAllowed = 'move';
                try { e.dataTransfer.setData('text/plain', String(i)); } catch { /* ignore */ }
              }}
              onDragOver={(e) => { e.preventDefault(); setOver(i); }}
              onDragLeave={() => setOver(v => (v === i ? null : v))}
              onDrop={(e) => {
                e.preventDefault();
                const f = from.current ?? Number(e.dataTransfer.getData('text/plain'));
                if (Number.isInteger(f)) move(f as number, i);
                from.current = null; setDragging(null); setOver(null);
              }}
              onDragEnd={() => { from.current = null; setDragging(null); setOver(null); }}
              className={cn(
                'flex items-center gap-1.5 rounded-md border bg-background px-1.5 py-1 transition-colors',
                over === i && dragging !== null && dragging !== i && 'border-primary bg-primary/5',
                dragging === i && 'opacity-60 ring-1 ring-primary/40',
              )}
            >
              <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground" />
              <span className="w-4 shrink-0 text-[10px] text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-[11.5px]">{labelOf(k)}</span>
              <Button
                type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                aria-label={`Remove ${labelOf(k)}`}
                onClick={() => setKeys(prev => prev.filter(x => x !== k))}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {spare.length > 0 && (
        <div className="space-y-1">
          <Label className="text-[10.5px] text-muted-foreground">
            {full ? 'Six is the most the band fits' : 'Add a card'}
          </Label>
          <div className="flex flex-wrap gap-1">
            {spare.map(ms => (
              <button
                key={ms.key}
                type="button"
                disabled={full}
                onClick={() => setKeys(prev => (prev.includes(ms.key) ? prev : [...prev, ms.key]))}
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[11px] transition-colors',
                  full ? 'cursor-not-allowed opacity-40'
                       : 'text-muted-foreground hover:bg-muted',
                )}
              >
                + {ms.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The chart's own settings.
 *
 * The field lists already say which keys are dimensions and which are measures,
 * so the editor leads rather than asks: only dimensions can sit on the category
 * axis, only measures can be plotted, and a chart type the chosen data cannot
 * honestly carry is disabled rather than left to fail in the PDF.
 */
const CHART_TYPES: Array<{ id: 'bar' | 'line' | 'pie'; label: string; icon: typeof BarChart3 }> = [
  { id: 'bar', label: 'Bar', icon: BarChart3 },
  { id: 'line', label: 'Line', icon: LineChart },
  { id: 'pie', label: 'Pie', icon: PieChart },
];

/** The chart in a sentence, so you can tell it is right without rendering it. */
function describeChart(block: LayoutBlock, dims: Field[], measures: Field[]): string {
  const nameOf = (list: Field[], key?: string | null) =>
    list.find(f => f.key === key)?.label ?? null;
  const by = nameOf(dims, block.x);
  const plotted = (block.y ?? []).map(k => nameOf(measures, k)).filter(Boolean) as string[];

  if (!by) return 'Pick a field for the category axis.';
  if (plotted.length === 0) return `Pick at least one measure to plot by ${by}.`;

  const list = plotted.length === 1
    ? plotted[0]
    : `${plotted.slice(0, -1).join(', ')} and ${plotted[plotted.length - 1]}`;

  const shape =
    block.chart === 'pie' ? 'A pie'
      : block.chart === 'line' ? 'A line'
        : block.orientation === 'horizontal' ? 'Bars across the page'
          : 'Bars up the page';

  const cut = block.limit
    ? ` Only the top ${block.limit} are drawn; the rest are added together as "Others".`
    : '';

  return `${shape} showing ${list} by ${by}.${cut}`;
}

function ChartEditor({
  block, dims, measures, onPatch,
}: {
  block: LayoutBlock;
  dims: Field[];
  measures: Field[];
  onPatch: (p: Partial<LayoutBlock>) => void;
}) {
  const y = block.y ?? [];
  // A pie shows parts of ONE whole; two measures in one circle is not a reading
  // anybody can take, so it is closed off rather than silently plotting the first.
  const pieOk = y.length <= 1;

  const toggleY = (k: string) => {
    const next = y.includes(k) ? y.filter(v => v !== k) : [...y, k];
    const p: Partial<LayoutBlock> = { y: next };
    if (next.length > 1 && block.chart === 'pie') p.chart = 'bar';
    onPatch(p);
  };

  return (
    <div className="space-y-2.5 border-t px-2.5 py-2.5">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10.5px] text-muted-foreground">Category axis</Label>
          <Select
            value={block.x ?? ''}
            onValueChange={(v) => onPatch({ x: v, ...(looksLikeDate(v) ? { chart: 'line' } : {}) })}
          >
            <SelectTrigger className="h-8 text-[12px]"><SelectValue placeholder="Pick a field" /></SelectTrigger>
            <SelectContent>
              {dims.map(d => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10.5px] text-muted-foreground">Drawn as</Label>
          {/* Three shapes, shown as the shapes. A dropdown made you open it to
              find out what the options even were. */}
          <div className="grid grid-cols-3 gap-1">
            {CHART_TYPES.map(t => {
              const Icon = t.icon;
              const disabled = t.id === 'pie' && !pieOk;
              const on = (block.chart ?? 'bar') === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={disabled}
                  title={disabled ? 'A pie shows one measure at a time' : t.label}
                  onClick={() => onPatch({ chart: t.id })}
                  className={cn(
                    'flex h-8 flex-col items-center justify-center rounded-md border transition-colors',
                    on ? 'border-primary bg-primary/10 text-primary'
                       : 'text-muted-foreground hover:bg-muted',
                    disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-[9px] leading-none">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* What this chart will actually say, before anyone opens the PDF. */}
      <p className="rounded-md bg-muted/50 px-2 py-1.5 text-[10.5px] leading-snug text-muted-foreground">
        {describeChart(block, dims, measures)}
      </p>

      <div className="space-y-1">
        <Label className="text-[10.5px] text-muted-foreground">
          Plot {y.length > 0 ? `(${y.length})` : ''}
        </Label>
        <div className="flex flex-wrap gap-1">
          {measures.map(ms => {
            const on = y.includes(ms.key);
            return (
              <button
                key={ms.key}
                type="button"
                onClick={() => toggleY(ms.key)}
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[11px] transition-colors',
                  on ? 'border-primary bg-primary/10 font-medium text-primary'
                     : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {ms.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {block.chart !== 'pie' && block.chart !== 'line' && (
          <div className="space-y-1">
            <Label className="text-[10.5px] text-muted-foreground">Bars run</Label>
            <Select
              value={block.orientation ?? 'vertical'}
              onValueChange={(v) => onPatch({ orientation: v as any })}
            >
              <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="vertical">Up the page</SelectItem>
                <SelectItem value="horizontal">Across — fits long names</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-[10.5px] text-muted-foreground">Show how many</Label>
          <div className="flex gap-1">
            {[0, 5, 10, 20].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => onPatch({ limit: n })}
                className={cn(
                  'h-8 flex-1 rounded-md border text-[11px] transition-colors',
                  (block.limit ?? 0) === n ? 'border-primary bg-primary/10 font-medium text-primary'
                                           : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {n === 0 ? 'All' : n}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-[10.5px] text-muted-foreground">Colour</Label>
        <div className="flex flex-wrap gap-1.5">
          {CHART_COLORS.map(c => {
            const on = (block.color ?? '') === c.hex;
            return (
              <button
                key={c.name}
                type="button"
                title={c.name}
                aria-label={c.name}
                onClick={() => onPatch({ color: c.hex || null })}
                className={cn(
                  'h-6 w-6 rounded-full border-2 transition-transform',
                  on ? 'border-foreground scale-110' : 'border-transparent hover:scale-105',
                )}
                style={{
                  background: c.hex || 'linear-gradient(135deg,#111827 50%,#e5e7eb 50%)',
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-[10.5px] text-muted-foreground">Heading</Label>
        <Input
          className="h-8 text-[12px]"
          placeholder="Written for you if left blank"
          value={block.title ?? ''}
          onChange={(e) => onPatch({ title: e.target.value || null })}
        />
      </div>
    </div>
  );
}
