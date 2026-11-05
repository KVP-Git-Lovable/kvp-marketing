import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronRight, Loader2, X } from "lucide-react";
import { ChartKindToggle, useChartKind, type ChartKind } from "./chartKind";
import { categoryMeta } from "./constants";
import { useActivityCatalogue, type PersonAward } from "./hooks";

interface PointsChartsProps {
  awards: PersonAward[];
  loading?: boolean;
  conversionRate: number;
  currencyName: string;
  periodLabel: string;
}

type Dim = "day" | "game" | "activity";
type Filters = Partial<Record<Dim, string>>;

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/**
 * The figure beside a row.
 *
 * It used to print the selected total next to the percentage of the UNfiltered
 * total — "0 · 19%" — two different denominators side by side, which reads as a
 * contradiction. One number with one meaning; the bar and the arc already carry
 * the share.
 */
const valueLabel = (hit: number, full: number) =>
  hit === full ? String(full) : hit === 0 ? `none of ${full}` : `${hit} of ${full}`;
const GHOST = "hsl(var(--muted))";

/** Grouping key as local YYYY-MM-DD. Deliberately NOT a localised string: an
 *  en-US locale renders "Sep 01", so splitting on the space to get the axis
 *  label gave every bar the month name instead of the day. ISO also sorts
 *  chronologically on its own. */
const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** "12 Sep" — for filter chips and tooltips. */
const dayLabel = (key: string) =>
  new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });

/** Axis tick: the day alone, or day/month when the range spans months. */
const dayTick = (key: string, spansMonths: boolean) =>
  spansMonths ? `${Number(key.slice(8, 10))}/${Number(key.slice(5, 7))}` : String(Number(key.slice(8, 10)));

const dimOf = (a: PersonAward, d: Dim) =>
  d === "day" ? dayKey(a.earned_at) : d === "game" ? a.program : a.activity;

/**
 * Cross-filtering charts over the viewer's own awards. Selecting a mark
 * HIGHLIGHTS rather than filters: every bar keeps its full height as a ghost
 * and only the matching part is solid-filled, so the sense of scale survives
 * the drill-down. All of it derives from one array, so totals reconcile at any
 * combination of filters.
 */
export function PointsCharts({
  awards, loading, conversionRate, currencyName, periodLabel,
}: PointsChartsProps) {
  const { data: catalogue = [] } = useActivityCatalogue();
  const [filters, setFilters] = useState<Filters>({});
  const toggle = (d: Dim, v: string) =>
    setFilters((f) => ({ ...f, [d]: f[d] === v ? undefined : v }));

  /** Rows matching every filter EXCEPT one — Power BI's semantics, so a chart
   *  never filters itself out of existence. */
  const matching = useCallback(
    (except?: Dim) =>
      awards.filter((a) =>
        (["day", "game", "activity"] as Dim[]).every(
          (d) => d === except || !filters[d] || dimOf(a, d) === filters[d]
        )
      ),
    [awards, filters]
  );

  const active = useMemo(() => matching(), [matching]);
  const activeFilters = (Object.entries(filters) as [Dim, string][]).filter(([, v]) => v);
  /** The day cuts across the game → activity path rather than sitting in it. */
  const lenses = activeFilters.filter(([d]) => d === "day");
  const [record, setRecord] = useState<PersonAward | null>(null);
  const sum = (rows: PersonAward[]) => rows.reduce((s, a) => s + a.points, 0);

  /** Full vs selected totals per category — the ghost/solid pair. */
  const split = (d: Dim) => {
    const base = matching(d);
    const cur = active;
    const keys = [...new Set(base.map((a) => dimOf(a, d)))];
    return keys
      .map((k) => ({
        key: k,
        cat: base.find((a) => dimOf(a, d) === k)!.category,
        full: sum(base.filter((a) => dimOf(a, d) === k)),
        hit: sum(cur.filter((a) => dimOf(a, d) === k)),
      }))
      .sort((a, b) => b.full - a.full);
  };

  /**
   * Level 2: every activity in the chosen game, not only the ones that paid.
   *
   * split() is built from award rows, so it can only return activities the
   * viewer has already earned from — for most games exactly one, which made
   * the level a restatement of the row just tapped. The rest of the game's
   * activities are where the unclaimed points are, so they come from the
   * catalogue and render as empty rows.
   */
  const activityRows = () => {
    const earned = split("activity");
    if (!filters.game) return earned;
    const seen = new Set(earned.map((r) => r.key));
    const unearned = catalogue
      .filter((c) => c.program === filters.game && !seen.has(c.name))
      .map((c) => ({
        key: c.name,
        cat: c.category,
        full: 0,
        hit: 0,
        unearned: true,
        detail: c.isTiered ? "Nothing yet · pays by tier" : `Nothing yet · ${c.points} pts each`,
      }));
    return [...earned, ...unearned];
  };

  const days = useMemo(() => {
    const base = matching("day");
    // ISO keys sort chronologically as plain strings.
    const keys = [...new Set(base.map((a) => dayKey(a.earned_at)))].sort();
    const games = [...new Set(awards.map((a) => a.program))];
    const spansMonths = new Set(keys.map((k) => k.slice(0, 7))).size > 1;
    return { keys, games, base, spansMonths };
  }, [awards, matching]);

  if (loading) {
    return (
      <Card className="border-0 shadow-[0_18px_40px_-28px_rgba(28,36,64,.5)]">
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!awards.length) {
    return (
      <Card className="border-0 shadow-[0_18px_40px_-28px_rgba(28,36,64,.5)]">
        <CardContent className="py-10 text-center">
          <p className="text-[14px] font-semibold">No awards {periodLabel}</p>
          <p className="text-[12.5px] text-muted-foreground mt-1">
            Your charts appear once you have earned points in this window.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* The path so far. Chips said WHAT was filtered but not how you got
          there, and gave no way back to an earlier step. */}
      {(filters.game || lenses.length > 0) && (
        <div className="flex items-center gap-1.5 flex-wrap rounded-[12px] bg-amber-50 dark:bg-amber-950/30 border border-amber-300/50 px-3 py-2">
          {filters.game && (
            <>
              <button
                onClick={() => setFilters((f) => ({ ...f, game: undefined, activity: undefined }))}
                className="rounded-full bg-card border border-amber-400/60 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300"
              >
                All games
              </button>
              <ChevronRight className="h-3 w-3 text-amber-500/60 shrink-0" />
              <button
                onClick={() => setFilters((f) => ({ ...f, activity: undefined }))}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold max-w-[170px] truncate border ${
                  filters.activity
                    ? "bg-card border-amber-400/60 text-amber-800 dark:text-amber-300"
                    : "bg-amber-500 border-transparent text-white"
                }`}
              >
                {filters.game}
              </button>
            </>
          )}
          {filters.activity && (
            <>
              <ChevronRight className="h-3 w-3 text-amber-500/60 shrink-0" />
              <span className="rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-white max-w-[170px] truncate">
                {filters.activity}
              </span>
            </>
          )}
          {/* the day is a lens across the path, not a step in it */}
          {lenses.map(([d, v]) => (
            <button
              key={d}
              onClick={() => toggle(d, v)}
              className="inline-flex items-center gap-1.5 rounded-full bg-card border border-amber-400/60 pl-2.5 pr-1.5 py-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300 max-w-full"
            >
              <span className="text-[8.5px] uppercase tracking-[0.08em] opacity-60 shrink-0">{d}</span>
              <span className="truncate">{d === "day" ? dayLabel(v) : v}</span>
              <X className="h-3 w-3 shrink-0 opacity-60" />
            </button>
          ))}
          <button
            onClick={() => setFilters({})}
            className="ml-auto text-[10.5px] font-semibold rounded-full border border-amber-400/60 px-2.5 py-1 bg-card text-amber-800 dark:text-amber-300"
          >
            Clear
          </button>
        </div>
      )}

      <DayChart
        days={days}
        active={active}
        selected={filters.day}
        onPick={(d) => toggle("day", d)}
      />

      {/* LEVEL 1 — always open: the question every rep starts with */}
      <Donut step={1} title="Where the points came from"
             rows={split("game")} total={sum(active)} currencyName={currencyName}
             selected={filters.game} onPick={(v) => toggle("game", v)} />

      {/* LEVEL 2 — does not exist until a game is chosen. Rendering all three
          levels at once made the page open tall and mostly irrelevant. */}
      {filters.game ? (
        <BarList step={2} title={`Activities in ${filters.game}`} rows={activityRows()}
                 selected={filters.activity} onPick={(v) => toggle("activity", v)}
                 hint={filters.activity ? undefined : "Tap an activity to see the records behind it."} />
      ) : (
        <Locked step={2} text="Pick a game above to see the activities inside it." />
      )}

      {/* Nothing between level 2 and level 3. A "How it paid" panel used to sit
          here re-sorting the very awards the list below already showed, and a
          calendar strip replaced it; both were space spent restating what the
          records say for themselves. The grouping the panel carried now lives
          on the list, which is where it was useful. */}

      {/* LEVEL 3 — the individual awards. A record is a record, so this one is
          a list rather than a chart. */}
      {filters.game && (filters.activity ? (
        <AwardList step={3} rows={active} conversionRate={conversionRate}
                   activity={filters.activity} onOpen={setRecord} />
      ) : (
        <Locked step={3} text="Pick an activity to see the records that generated those points." />
      ))}


      <RecordDrawer award={record} conversionRate={conversionRate} onClose={() => setRecord(null)} />
    </div>
  );
}

/** The next level, before it exists. Keeps the step discoverable instead of the
 *  page simply ending. */
function Locked({ step, text }: { step: number; text: string }) {
  return (
    <div className="rounded-[12px] border border-dashed bg-muted/40 px-4 py-6 text-center">
      <div className="mx-auto mb-2 flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
        {step}
      </div>
      <p className="text-[13px] text-muted-foreground">{text}</p>
    </div>
  );
}

/* ---------------- stacked day chart ---------------- */
/** Captions are this chart's own; the switch itself is shared. */
const CAPTIONS: Record<ChartKind, string> = {
  bar: "stacked by game",
  hbar: "stacked by game",
  line: "one line per game",
  donut: "share by day",
};

function DayChart({
  days, active, selected, onPick,
}: {
  days: { keys: string[]; games: string[]; base: PersonAward[]; spansMonths: boolean };
  active: PersonAward[];
  selected?: string;
  onPick: (d: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(340);
  const [kind, setKind] = useChartKind("gam.dayChartKind", "bar");

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const { keys, games, base, spansMonths } = days;
  const narrow = w < 460;
  const fs = narrow ? 8.5 : 10;
  const tot = (d: string, g: string, rows: PersonAward[]) =>
    rows.filter((a) => dayKey(a.earned_at) === d && a.program === g).reduce((s, a) => s + a.points, 0);

  /** day x game matrices: everything in range, and what survives the filters. */
  const fullM = keys.map((d) => games.map((g) => tot(d, g, base)));
  const hitM = keys.map((d) => games.map((g) => tot(d, g, active)));
  const rowSum = (r: number[]) => r.reduce((s, v) => s + v, 0);
  const posSum = (r: number[]) => r.reduce((s, v) => s + Math.max(0, v), 0);
  const negSum = (r: number[]) => r.reduce((s, v) => s + Math.min(0, v), 0);
  const gameColor = (g: string) => categoryMeta(base.find((a) => a.program === g)?.category).ac;
  /** Colour a day by whichever game contributed most of it. */
  const dayColor = (i: number) => {
    let bi = 0;
    fullM[i].forEach((v, gi) => { if (v > fullM[i][bi]) bi = gi; });
    return gameColor(games[bi]);
  };
  const caption = CAPTIONS[kind];

  const rowH = narrow ? 22 : 26;
  const H =
    kind === "hbar" ? Math.max(90, keys.length * rowH + 14)
    : kind === "donut" ? (narrow ? 210 : 250)
    : narrow ? 170 : 215;

  return (
    <Card className="border-0 shadow-[0_18px_40px_-28px_rgba(28,36,64,.5)]">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Points by day</p>
          <span className="text-[10px] text-muted-foreground">{caption}</span>
          <div className="ml-auto"><ChartKindToggle kind={kind} onChange={setKind} /></div>
        </div>

        <div ref={ref}>
          <svg viewBox={`0 0 ${w} ${H}`} style={{ height: H }} className="w-full block"
               role="img" aria-label={`Points by day, ${kind} chart`}>

            {kind === "bar" && (() => {
              const L = narrow ? 30 : 40, R = 8, T = 16, B = narrow ? 30 : 36;
              // A cancelled order writes a negative award, so the scale carries a
              // zero line and those days hang below it rather than vanishing.
              const hi = Math.max(...fullM.map(posSum), 0);
              const lo = Math.min(...fullM.map(negSum), 0);
              const span = hi - lo || 1;
              const plotH = H - T - B;
              const yOf = (v: number) => T + (plotH * (hi - v)) / span;
              const zeroY = yOf(0);
              const step = (w - L - R) / Math.max(keys.length, 1);
              const bw = Math.max(7, Math.min(28, step * 0.62));
              const ticks = lo < 0 ? [hi, hi / 2, 0, lo] : [hi, hi / 2, 0];
              return (
                <>
                  {ticks.map((v, i) => (
                    <g key={i}>
                      <line x1={L} y1={yOf(v)} x2={w - R} y2={yOf(v)}
                            stroke="hsl(var(--border))" strokeWidth={1}
                            strokeDasharray={v === 0 ? undefined : "3 4"} opacity={v === 0 ? 1 : 0.6} />
                      <text x={L - 6} y={yOf(v) + 3.5} fill="hsl(var(--muted-foreground))" fontSize={fs} textAnchor="end">
                        {Math.round(v)}
                      </text>
                    </g>
                  ))}
                  {keys.map((d, i) => {
                    const cx = L + step * i + step / 2;
                    const isSel = selected === d, dim = !!selected && !isSel;
                    let up = zeroY, down = zeroY;
                    return (
                      <g key={d} onClick={() => onPick(d)} style={{ cursor: "pointer" }} role="button" tabIndex={0}
                         onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(d); } }}>
                        <rect x={cx - step / 2} y={T} width={step} height={plotH} fill="transparent" />
                        {games.map((g, gi) => {
                          const full = fullM[i][gi];
                          if (!full) return null;
                          const hit = hitM[i][gi];
                          const fh = Math.abs(yOf(full) - zeroY), hh = Math.abs(yOf(hit) - zeroY);
                          const yF = full >= 0 ? (up -= fh) : down;
                          if (full < 0) down += fh;
                          // The filtered part sits against the zero line so it reads
                          // as a share of the whole segment in both directions.
                          const yH = full >= 0 ? yF + fh - hh : yF;
                          return (
                            <g key={g}>
                              <rect x={cx - bw / 2} y={yF} width={bw} height={fh} fill={GHOST} opacity={dim ? 0.55 : 1} />
                              {hh > 0 && <rect x={cx - bw / 2} y={yH} width={bw} height={hh} fill={gameColor(g)} opacity={dim ? 0.3 : 1} />}
                            </g>
                          );
                        })}
                        {(isSel || !narrow) && (() => {
                          const shown = rowSum(hitM[i]);
                          if (!shown) return null;
                          // Always above the positive stack — which is the zero line on a
                          // pure clawback day. Sitting it under a negative bar instead
                          // pushed it straight into the date ticks.
                          return (
                            <text x={cx} y={yOf(Math.max(posSum(fullM[i]), 0)) - 5}
                                  fill={shown < 0 ? "hsl(var(--destructive))"
                                        : isSel ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))"}
                                  fontSize={isSel ? fs + 1 : fs - 0.5} fontWeight={isSel ? 700 : 400} textAnchor="middle">
                              {shown}
                            </text>
                          );
                        })()}
                        {(step >= 24 || i % 2 === 0 || isSel) && (
                          <text x={cx} y={H - B + 13} fontSize={fs} textAnchor="middle" fontWeight={isSel ? 700 : 400}
                                fill={isSel ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))"}>
                            {dayTick(d, spansMonths)}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </>
              );
            })()}

            {kind === "hbar" && (() => {
              const LW = narrow ? 32 : 42, RW = narrow ? 34 : 42, T = 6;
              const barW = Math.max(20, w - LW - RW);
              const max = Math.max(...fullM.map(posSum), 1);
              const xs = (v: number) => (barW * Math.max(0, v)) / max;
              const bh = Math.min(13, rowH - 8);
              return keys.map((d, i) => {
                const y = T + i * rowH, isSel = selected === d, dim = !!selected && !isSel;
                let x = LW;
                const shown = rowSum(hitM[i]);
                return (
                  <g key={d} onClick={() => onPick(d)} style={{ cursor: "pointer" }} role="button" tabIndex={0}
                     onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(d); } }}>
                    <rect x={0} y={y} width={w} height={rowH} fill="transparent" />
                    <text x={LW - 6} y={y + rowH / 2 + 3.5} textAnchor="end" fontSize={fs}
                          fontWeight={isSel ? 700 : 400}
                          fill={isSel ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))"}>
                      {dayTick(d, spansMonths)}
                    </text>
                    <rect x={LW} y={y + (rowH - bh) / 2} width={xs(posSum(fullM[i]))} height={bh} rx={3}
                          fill={GHOST} opacity={dim ? 0.55 : 1} />
                    {games.map((g, gi) => {
                      const v = hitM[i][gi];
                      if (v <= 0) return null;
                      const seg = <rect key={g} x={x} y={y + (rowH - bh) / 2} width={xs(v)} height={bh}
                                        fill={gameColor(g)} opacity={dim ? 0.3 : 1} />;
                      x += xs(v);
                      return seg;
                    })}
                    <text x={w - RW + 6} y={y + rowH / 2 + 3.5} fontSize={fs}
                          fontWeight={isSel ? 700 : 400}
                          fill={shown < 0 ? "hsl(var(--destructive))" : isSel ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))"}>
                      {shown || ""}
                    </text>
                  </g>
                );
              });
            })()}

            {kind === "line" && (() => {
              const L = narrow ? 26 : 36, R = 8, T = 16, B = narrow ? 30 : 36;
              const max = Math.max(...fullM.flat(), 1);
              const hy = (v: number) => Math.max(0, ((H - T - B) * v) / max);
              const step = (w - L - R) / Math.max(keys.length, 1);
              const xAt = (i: number) => L + step * i + step / 2;
              const yAt = (v: number) => H - B - hy(v);
              const path = (m: number[][], gi: number) =>
                m.map((r, i) => `${i ? "L" : "M"}${xAt(i).toFixed(1)} ${yAt(r[gi]).toFixed(1)}`).join(" ");
              return (
                <>
                  <line x1={L} y1={H - B} x2={w - R} y2={H - B} stroke="hsl(var(--border))" strokeWidth={1} />
                  {[0, 0.5, 1].map((f) => {
                    const v = Math.round(max * f), y = yAt(v);
                    return (
                      <g key={f}>
                        {f > 0 && <line x1={L} y1={y} x2={w - R} y2={y} stroke="hsl(var(--border))" strokeWidth={1} strokeDasharray="3 4" opacity={0.6} />}
                        <text x={L - 6} y={y + 3.5} fill="hsl(var(--muted-foreground))" fontSize={fs} textAnchor="end">{v}</text>
                      </g>
                    );
                  })}
                  {games.map((g, gi) => (
                    <g key={g}>
                      <path d={path(fullM, gi)} fill="none" stroke={GHOST} strokeWidth={2} strokeLinejoin="round" opacity={selected ? 0.5 : 1} />
                      <path d={path(hitM, gi)} fill="none" stroke={gameColor(g)} strokeWidth={2} strokeLinejoin="round" opacity={selected ? 0.4 : 1} />
                      {hitM.map((r, i) => r[gi] > 0 && (
                        <circle key={i} cx={xAt(i)} cy={yAt(r[gi])} r={selected === keys[i] ? 3.5 : 2.2}
                                fill={gameColor(g)} opacity={selected && selected !== keys[i] ? 0.4 : 1} />
                      ))}
                    </g>
                  ))}
                  {keys.map((d, i) => {
                    const isSel = selected === d;
                    return (
                      <g key={d} onClick={() => onPick(d)} style={{ cursor: "pointer" }} role="button" tabIndex={0}
                         onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(d); } }}>
                        <rect x={xAt(i) - step / 2} y={T} width={step} height={H - T - B} fill="transparent" />
                        {isSel && <line x1={xAt(i)} y1={T} x2={xAt(i)} y2={H - B} stroke="hsl(var(--foreground))" strokeWidth={1} strokeDasharray="2 3" opacity={0.5} />}
                        {(step >= 24 || i % 2 === 0 || isSel) && (
                          <text x={xAt(i)} y={H - B + 13} fontSize={fs} textAnchor="middle" fontWeight={isSel ? 700 : 400}
                                fill={isSel ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))"}>
                            {dayTick(d, spansMonths)}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </>
              );
            })()}

            {kind === "donut" && (() => {
              const cx = w / 2, cy = H / 2, r = Math.min(w, H) / 2 - 16, ri = r * 0.6;
              const totals = keys.map((_, i) => Math.max(0, rowSum(fullM[i])));
              const T = totals.reduce((s, v) => s + v, 0) || 1;
              const arc = (a0: number, a1: number, R0: number, R1: number) => {
                const p = (a: number, R: number) => [cx + R * Math.cos(a), cy + R * Math.sin(a)];
                const la = a1 - a0 > Math.PI ? 1 : 0;
                const [x1, y1] = p(a0, R1), [x2, y2] = p(a1, R1), [x3, y3] = p(a1, R0), [x4, y4] = p(a0, R0);
                return `M${x1} ${y1}A${R1} ${R1} 0 ${la} 1 ${x2} ${y2}L${x3} ${y3}A${R0} ${R0} 0 ${la} 0 ${x4} ${y4}Z`;
              };
              let a0 = -Math.PI / 2;
              const slices = keys.map((d, i) => {
                const a1 = a0 + 2 * Math.PI * (totals[i] / T);
                const hit = Math.max(0, rowSum(hitM[i]));
                const frac = totals[i] > 0 ? Math.min(1, hit / totals[i]) : 0;
                const ah = a0 + (a1 - a0) * frac;
                const isSel = selected === d, dim = !!selected && !isSel;
                const el = (
                  <g key={d} onClick={() => onPick(d)} style={{ cursor: "pointer" }} role="button" tabIndex={0}
                     onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(d); } }}>
                    <title>{`${dayLabel(d)} · ${rowSum(fullM[i])}`}</title>
                    <path d={arc(a0, a1, ri, r)} fill={GHOST} opacity={dim ? 0.5 : 1}
                          stroke="hsl(var(--background))" strokeWidth={0.75} />
                    {frac > 0 && <path d={arc(a0, ah, ri, isSel ? r + 4 : r)} fill={dayColor(i)} opacity={dim ? 0.3 : 1}
                                       stroke="hsl(var(--background))" strokeWidth={0.75} />}
                  </g>
                );
                a0 = a1;
                return el;
              });
              const shown = active.reduce((s, a) => s + a.points, 0);
              return (
                <>
                  {slices}
                  <text x={cx} y={cy - 1} textAnchor="middle" fill="hsl(var(--foreground))" fontSize={narrow ? 20 : 24} fontWeight={800}>
                    {shown.toLocaleString()}
                  </text>
                  <text x={cx} y={cy + 14} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={8}>
                    {keys.length} {keys.length === 1 ? "DAY" : "DAYS"}
                  </text>
                </>
              );
            })()}
          </svg>
        </div>
        {!selected && (
          <p className="text-[11.5px] text-muted-foreground mt-1">
            Tap {kind === "donut" ? "a slice" : kind === "line" ? "a point" : "a bar"} to see what generated that day.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------- donut ---------------- */
function Donut({
  rows, total, currencyName, selected, onPick, step, title,
}: {
  rows: {
    key: string; cat: string; full: number; hit: number;
    /** Configured but never earned from — no bar, and nothing to drill into. */
    unearned?: boolean; detail?: string;
  }[];
  total: number; currencyName: string; selected?: string; onPick: (v: string) => void;
  step?: number; title?: string;
}) {
  const cx = 75, cy = 75, r = 56, ri = 35;
  const T = rows.reduce((s, x) => s + x.full, 0) || 1;
  const arc = (a0: number, a1: number, R0: number, R1: number) => {
    const p = (a: number, R: number) => [cx + R * Math.cos(a), cy + R * Math.sin(a)];
    const la = a1 - a0 > Math.PI ? 1 : 0;
    const [x1, y1] = p(a0, R1), [x2, y2] = p(a1, R1), [x3, y3] = p(a1, R0), [x4, y4] = p(a0, R0);
    return `M${x1} ${y1}A${R1} ${R1} 0 ${la} 1 ${x2} ${y2}L${x3} ${y3}A${R0} ${R0} 0 ${la} 0 ${x4} ${y4}Z`;
  };
  let a0 = -Math.PI / 2;

  return (
    <Card className="border-0 shadow-[0_18px_40px_-28px_rgba(28,36,64,.5)]">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-2">
          {step != null && <StepBadge n={step} />}
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
            {title ?? "Share by game"}
          </p>
          <span className="ml-auto text-[10px] text-muted-foreground">{rows.length} games</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <svg viewBox="0 0 150 150" className="w-[130px] h-[130px] shrink-0" role="img" aria-label="Share by game">
            {rows.map((x) => {
              const a1 = a0 + 2 * Math.PI * Math.max(0, x.full / T);
              const dim = !!selected && selected !== x.key;
              const meta = categoryMeta(x.cat);
              // Clamped for the same reason as the bars: a game whose net is
              // negative after clawbacks would sweep the arc backwards.
              const frac = x.full > 0 ? Math.min(1, Math.max(0, x.hit / x.full)) : 0;
              const ah = a0 + 2 * Math.PI * Math.max(0, x.full / T) * frac;
              const seg = (
                <g key={x.key} onClick={() => onPick(x.key)} style={{ cursor: "pointer" }}>
                  <path d={arc(a0, a1, ri, r)} fill={GHOST} opacity={dim ? 0.5 : 1} />
                  {x.hit > 0 && <path d={arc(a0, ah, ri, r)} fill={meta.ac} opacity={dim ? 0.3 : 1} />}
                </g>
              );
              a0 = a1;
              return seg;
            })}
            <text x={cx} y={cy - 1} textAnchor="middle" fill="hsl(var(--foreground))" fontSize={22} fontWeight={800}>{total}</text>
            <text x={cx} y={cy + 13} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize={8}>
              {currencyName.toUpperCase()}
            </text>
          </svg>
          <div className="flex-1 min-w-[140px] space-y-0.5">
            {rows.map((x) => {
              const meta = categoryMeta(x.cat);
              const off = !!selected && selected !== x.key;
              return (
                <button key={x.key} onClick={() => onPick(x.key)}
                        className={`w-full flex items-center gap-2 px-2 py-2 rounded-[9px] min-h-[40px] text-left transition-colors ${
                          selected === x.key ? "bg-muted border border-foreground/30" : "hover:bg-muted/60"
                        } ${off ? "opacity-45" : ""}`}>
                  <span className="h-2.5 w-2.5 rounded-[3px] shrink-0" style={{ background: meta.ac }} />
                  <span className="text-[12.5px] font-semibold truncate flex-1">{x.key}</span>
                  <span className="text-[11.5px] text-muted-foreground tabular-nums shrink-0">
                    {valueLabel(x.hit, x.full)}
                  </span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- horizontal bars ---------------- */
function BarList({
  title, rows, selected, onPick, step, hint,
}: {
  title: string;
  rows: {
    key: string; cat: string; full: number; hit: number;
    /** Configured but never earned from — no bar, and nothing to drill into. */
    unearned?: boolean; detail?: string;
  }[];
  selected?: string; onPick: (v: string) => void;
  step?: number; hint?: string;
}) {
  const max = Math.max(...rows.map((r) => r.full), 1);
  return (
    <Card className="border-0 shadow-[0_18px_40px_-28px_rgba(28,36,64,.5)]">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-1">
          {step != null && <StepBadge n={step} />}
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground truncate">{title}</p>
          <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
            {step != null
              ? `${rows.length} ${rows.length === 1 ? "activity" : "activities"}`
              : "by points"}
          </span>
        </div>
        <div className="space-y-0.5">
          {rows.map((x) => {
            const meta = categoryMeta(x.cat);
            const fill = meta.ac;
            const off = !!selected && selected !== x.key;

            // Never earned from: there are no records to open, so this is a
            // statement rather than a control. It is the point of the level —
            // it says where the points you have not claimed are.
            if (x.unearned) {
              return (
                <div key={x.key}
                     className="w-full flex items-center gap-2 px-2 py-2 rounded-[9px] min-h-[44px] border border-dashed border-border/70">
                  <span className="h-2.5 w-2.5 rounded-[3px] shrink-0 opacity-40" style={{ background: meta.ac }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-muted-foreground truncate">{x.key}</span>
                    {x.detail && <span className="block text-[11px] text-muted-foreground/80 truncate">{x.detail}</span>}
                  </span>
                </div>
              );
            }

            return (
              <button key={x.key} onClick={() => onPick(x.key)}
                      className={`w-full grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 items-center px-2 py-2 rounded-[9px] min-h-[44px] text-left transition-colors ${
                        selected === x.key ? "bg-muted border border-foreground/30" : "hover:bg-muted/60"
                      } ${off ? "opacity-45" : ""}`}>
                <span className="flex items-center gap-2 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-[3px] shrink-0" style={{ background: meta.ac }} />
                  <span className="text-[13px] font-semibold truncate">{x.key}</span>
                </span>
                <span className="text-[12.5px] font-bold tabular-nums">{valueLabel(x.hit, x.full)}</span>
                {step != null && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                <span className="col-span-2 relative h-2 rounded-full bg-muted overflow-hidden">
                  <span className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${Math.max(0, (x.full / max) * 100)}%`, background: GHOST }} />
                  <span className="absolute left-0 top-0 h-full rounded-full" style={{ width: `${Math.max(0, (x.hit / max) * 100)}%`, background: fill }} />
                </span>
              </button>
            );
          })}
        </div>
        {hint && <p className="text-[11.5px] text-muted-foreground mt-1 px-2">{hint}</p>}
      </CardContent>
    </Card>
  );
}

/**
 * Why one activity's total is what it is.
 *
 * A game and an activity are almost the same question — "Target rewards" holds
 * one activity that has ever paid — so the drill-down ran out of answers before
 * it said anything. What separates the rows underneath is the tier reached, the
 * day, or the retailer. Offered only where it exists: a dimension the awards do
 * not carry is left out, and one with a single value is shown greyed rather
 * than quietly repeating the level above.
 */
type SubDim = "tier" | "day" | "retailer";

const SUB_LABEL: Record<SubDim, string> = { tier: "Tier", day: "Day", retailer: "Retailer" };

const subKey = (a: PersonAward, d: SubDim) =>
  d === "tier" ? (a.tier_pct == null ? null : `${a.tier_pct}%`)
  : d === "day" ? dayLabel(dayKey(a.earned_at))
  : a.retailer_name;

/** The numbered step marker shared by the three drill-down levels. */
function StepBadge({ n }: { n: number }) {
  return (
    <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-foreground text-[10px] font-semibold text-background">
      {n}
    </span>
  );
}

/* ---------------- award list ---------------- */
/**
 * What a single award should say depends on what fired it. A target settles
 * over a period and has no retailer or document behind it; an order-based
 * award has both. One generic shape printed "No order" against activities that
 * never involve an order, which read as missing data rather than as the answer.
 */
const periodLabelOf = (key: string | null) => {
  if (!key) return null;
  if (/^d{4}-d{2}$/.test(key))
    return new Date(`${key}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  if (/^d{4}-d{2}-d{2}$/.test(key))
    return new Date(`${key}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return key;
};

function awardDetail(a: PersonAward): { title: string; sub: string; facts: string[] } {
  const money = a.order_value != null ? inr(a.order_value) : null;
  const when = new Date(a.earned_at).toLocaleDateString(undefined, { day: "2-digit", month: "short" });
  const retailer = a.retailer_name ?? null;

  // A milestone settles against a threshold over a period — there is no
  // retailer or document to point at, whichever trigger raised it.
  if (retailer == null && a.tier_pct != null) {
    const period = periodLabelOf(a.period_key);
    return {
      title: a.activity,
      sub: [a.program, period && `period ${period}`].filter(Boolean).join(" · "),
      facts: [
        a.achievement_pct != null ? `${a.achievement_pct}% achieved` : null,
        `tier ${a.tier_pct}%`,
        `awarded ${when}`,
      ].filter(Boolean) as string[],
    };
  }

  switch (a.trigger_type) {
    case "target_achievement": {
      const period = periodLabelOf(a.period_key);
      return {
        title: a.activity,
        sub: [a.program, period && `target period ${period}`].filter(Boolean).join(" · "),
        facts: [
          a.achievement_pct != null ? `${a.achievement_pct}% achieved` : null,
          a.tier_pct != null ? `tier ${a.tier_pct}%` : null,
          `awarded ${when}`,
        ].filter(Boolean) as string[],
      };
    }
    case "retailer_created":
      return {
        title: retailer ?? a.activity,
        sub: `New retailer · ${a.program}`,
        facts: [a.beat_name, when].filter(Boolean) as string[],
      };
    case "first_order_new_retailer":
      return {
        title: retailer ?? a.activity,
        sub: `First order · ${a.program}`,
        facts: [money && `first order ${money}`, a.beat_name, when].filter(Boolean) as string[],
      };
    case "total_visits":
    case "productive_visit":
    case "visit_completed":
      return {
        title: retailer ?? a.activity,
        sub: `${a.activity} · ${a.program}`,
        facts: [money && `order ${money}`, a.beat_name, when].filter(Boolean) as string[],
      };
    case "branding_request":
    case "competition_insight":
    case "retailer_feedback":
      return {
        title: retailer ?? a.activity,
        sub: `${a.activity} · ${a.program}`,
        facts: [a.beat_name, when].filter(Boolean) as string[],
      };
    case "order_placed":
    case "order_confirmed":
    case "focused_product_sales":
    case "new_product_introduction":
      return {
        title: retailer ?? a.activity,
        sub: `${a.activity} · ${a.program}`,
        facts: [money && `order ${money}`, a.beat_name, when].filter(Boolean) as string[],
      };
    default:
      return {
        title: retailer ?? a.activity,
        sub: retailer ? `${a.activity} · ${a.program}` : a.program,
        facts: [money && `order ${money}`, a.beat_name, when].filter(Boolean) as string[],
      };
  }
}

/** One award, as a row. Extracted so the flat list and the grouped list cannot
 *  drift apart. */
function AwardRow({
  award, conversionRate, onOpen,
}: {
  award: PersonAward;
  conversionRate: number;
  onOpen?: (a: PersonAward) => void;
}) {
  const meta = categoryMeta(award.category);
  const d = awardDetail(award);
  return (
    <button
      type="button"
      onClick={() => onOpen?.(award)}
      className="w-full text-left rounded-[10px] border p-2.5 transition-colors hover:border-foreground/40"
    >
      <div className="flex items-start gap-2">
        <span className="h-2.5 w-2.5 rounded-[3px] mt-1 shrink-0" style={{ background: meta.ac }} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold truncate">{d.title}</p>
          <p className="text-[11px] text-muted-foreground truncate">{d.sub}</p>
        </div>
        <span className={`text-[13px] font-bold tabular-nums shrink-0 ${
          award.points < 0 ? "text-destructive" : "text-emerald-600"
        }`}>
          {award.points > 0 ? "+" : ""}{award.points}
        </span>
      </div>
      <div className="flex items-center gap-x-2.5 gap-y-1 flex-wrap mt-1.5 pl-[18px]">
        {d.facts.map((f, i) => (
          <span key={i} className="text-[11px] text-muted-foreground">{f}</span>
        ))}
        <span className="text-[11px] text-muted-foreground">{inr(award.points * conversionRate)}</span>
        {award.order_status && award.order_status !== "confirmed" && (
          <span className="text-[9px] uppercase tracking-[0.05em] font-semibold rounded px-1.5 py-0.5 border border-amber-400 text-amber-700 dark:text-amber-400">
            order {award.order_status}
          </span>
        )}
      </div>
    </button>
  );
}

/**
 * The records, grouped.
 *
 * The grouping used to live in a panel above this list, which meant the same
 * awards were drawn twice — once as bars, once as rows — and the panel ranked
 * days by SIZE, so the dates read Aug 21, Aug 10, Jul 30. The chips moved here
 * and the days now run newest first, which is both chronological and the order
 * a rep reads their own activity in.
 *
 * A dimension is only offered when it actually separates the awards: one
 * retailer, or one tier, is not a grouping. When none of them separate
 * anything the list stays flat rather than wrapping everything in a single
 * group that only adds a row to tap.
 */
function AwardList({
  rows, conversionRate, activity, step, onOpen,
}: {
  rows: PersonAward[];
  conversionRate: number;
  activity?: string;
  step?: number;
  onOpen?: (a: PersonAward) => void;
}) {
  const [limit, setLimit] = useState(12);
  const [dim, setDim] = useState<SubDim | null>(null);
  const [opened, setOpened] = useState<Record<string, boolean>>({});

  const countFor = (d: SubDim) =>
    new Set(rows.map((a) => subKey(a, d)).filter((k) => k != null)).size;

  /**
   * A dimension has to do BOTH jobs to be worth offering.
   *
   * Separate — more than one pile, or it is a single header over the whole
   * list. And compress — fewer piles than awards, or every header wraps one
   * row and repeats it. Two awards at two retailers produced exactly that:
   * "Ajay Stores · 1 award · ₹55" sitting on top of "Ajay Stores … ₹55",
   * which is the duplication this whole change set out to remove, reappearing
   * at small N. Below that bar the flat list is the honest answer — the date
   * and the retailer are already on every row.
   */
  const dims = (["day", "retailer", "tier"] as SubDim[]).filter((d) => {
    const n = countFor(d);
    if (n < 2) return false;            // one pile is not a grouping
    // Retailer and Tier have to COMPRESS as well, because an award row is
    // already titled with its retailer: a header per retailer over one row
    // each just says the same name twice. A DATE header never does that — it
    // organises rows that are titled something else — so a day per award is
    // still a useful way to read a list, the way any activity feed is.
    return d === "day" || n < rows.length;
  });

  // Date is the spine of an award list — it is how anyone reads their own
  // activity — so Day leads whenever there is more than one day to show.
  // Otherwise fall back to whichever dimension separates the awards most, the
  // heuristic the old panel used: a tiered target with no retailers opens on
  // Tier rather than on nothing.
  const fallback = dims.reduce<SubDim | null>(
    (best, d) => (best == null || countFor(d) > countFor(best) ? d : best),
    null,
  );
  const active = dim && dims.includes(dim)
    ? dim
    : dims.includes("day") ? "day" : fallback;

  const groups = (() => {
    if (!active) return [];
    const map = new Map<string, { key: string; sort: string; awards: PersonAward[]; points: number }>();
    rows.forEach((a) => {
      const k = subKey(a, active);
      if (k == null) return;
      // Days sort on the raw key so "2 Sep" cannot land after "20 Aug".
      const sort = active === "day" ? dayKey(a.earned_at) : k;
      if (!map.has(k)) map.set(k, { key: k, sort, awards: [], points: 0 });
      const g = map.get(k)!;
      g.awards.push(a);
      g.points += a.points;
    });
    const out = [...map.values()];
    return active === "day"
      ? out.sort((x, y) => y.sort.localeCompare(x.sort))   // newest first
      : out.sort((x, y) => y.points - x.points);
  })();

  // Awards the chosen dimension cannot place — a tier split leaves the
  // untiered ones out, and dropping them silently would lose points.
  const ungrouped = active ? rows.filter((a) => subKey(a, active) == null) : [];
  const maxPts = Math.max(...groups.map((g) => Math.abs(g.points)), 1);

  return (
    <Card className="border-0 shadow-[0_18px_40px_-28px_rgba(28,36,64,.5)]">
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {step != null && <StepBadge n={step} />}
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground truncate">
            {activity ?? "Awards"}
          </p>
          <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
            {rows.length} {rows.length === 1 ? "award" : "awards"}
          </span>
        </div>

        {dims.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {dims.map((d) => {
              const on = d === active;
              return (
                <button
                  key={d}
                  onClick={() => { setDim(d); setOpened({}); }}
                  aria-pressed={on}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 min-h-[32px] text-[11.5px] font-semibold transition-colors ${
                    on ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted"
                  }`}
                >
                  {SUB_LABEL[d]}
                  <span className={`grid place-items-center min-w-[16px] h-4 px-1 rounded-full text-[9.5px] ${
                    on ? "bg-background text-foreground" : "bg-muted"
                  }`}>
                    {countFor(d)}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {rows.length === 0 ? (
          <p className="py-6 text-center text-[12.5px] text-muted-foreground">No awards match this combination.</p>
        ) : !active ? (
          /* Nothing to group by — the flat list, as it always was. */
          <>
            <div className="space-y-1.5">
              {rows.slice(0, limit).map((a) => (
                <AwardRow key={a.id} award={a} conversionRate={conversionRate} onOpen={onOpen} />
              ))}
            </div>
            {rows.length > limit && (
              <button onClick={() => setLimit((l) => l + 25)}
                      className="w-full mt-2 py-2 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground">
                Show {Math.min(25, rows.length - limit)} more
              </button>
            )}
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              {groups.slice(0, limit).map((g, i) => {
                // The newest group is open unless it has been closed by hand,
                // so the screen never opens as a wall of shut accordions.
                const open = opened[g.key] ?? i === 0;
                return (
                  <div key={g.key} className="rounded-[10px] border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpened((o) => ({ ...o, [g.key]: !open }))}
                      aria-expanded={open}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 min-h-[42px] text-left bg-muted/40 hover:bg-muted transition-colors"
                    >
                      <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${
                        open ? "rotate-90" : ""
                      }`} />
                      <span className="min-w-0">
                        <span className="block text-[12.5px] font-bold truncate">{g.key}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {g.awards.length} {g.awards.length === 1 ? "award" : "awards"}
                          {" · "}{inr(g.points * conversionRate)}
                        </span>
                      </span>
                      <span className="ml-auto flex items-center gap-2 shrink-0">
                        <span className="w-[34px] h-1 rounded-full bg-muted overflow-hidden hidden sm:block">
                          <span className="block h-full rounded-full bg-amber-400"
                                style={{ width: `${(Math.abs(g.points) / maxPts) * 100}%` }} />
                        </span>
                        <span className={`text-[12.5px] font-extrabold tabular-nums ${
                          g.points < 0 ? "text-destructive" : ""
                        }`}>
                          {g.points > 0 ? "+" : ""}{g.points}
                        </span>
                      </span>
                    </button>

                    {open && (
                      <div className="border-t p-1.5 space-y-1.5">
                        {g.awards.map((a) => (
                          <AwardRow key={a.id} award={a} conversionRate={conversionRate} onOpen={onOpen} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {groups.length > limit && (
              <button onClick={() => setLimit((l) => l + 25)}
                      className="w-full mt-2 py-2 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground">
                Show {Math.min(25, groups.length - limit)} more {SUB_LABEL[active].toLowerCase()}
                {Math.min(25, groups.length - limit) === 1 ? "" : "s"}
              </button>
            )}

            {ungrouped.length > 0 && (
              <div className="mt-2 pt-2 border-t">
                <p className="text-[11px] text-muted-foreground mb-1.5">
                  {ungrouped.length} without a {SUB_LABEL[active].toLowerCase()}
                </p>
                <div className="space-y-1.5">
                  {ungrouped.map((a) => (
                    <AwardRow key={a.id} award={a} conversionRate={conversionRate} onOpen={onOpen} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The end of the path: one award, with the record that produced it. Ends here
 * rather than linking out — the order and retailer screens are a separate
 * decision, so the CTA is deliberately inert for now.
 */
function RecordDrawer({
  award, conversionRate, onClose,
}: {
  award: PersonAward | null;
  conversionRate: number;
  onClose: () => void;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!award) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [award, onClose]);

  if (!award) return null;
  const d = awardDetail(award);

  /**
   * Where this record actually lives.
   *
   * Decided on the ids, not on order_value: a Productive visit carries an
   * order value in its metadata but is attached to a retailer, so choosing by
   * value offered "View order" on 125 awards that have no order to open. When
   * there is neither — a monthly target tier settles against a period, not a
   * document — there is nothing to link to and no button.
   */
  const dest = award.order_id
    ? {
        label: "View order",
        to: `/order-entry?editOrderId=${encodeURIComponent(award.order_id)}`
          + (award.retailer_id ? `&retailerId=${encodeURIComponent(award.retailer_id)}` : "")
          + (award.retailer_name ? `&retailer=${encodeURIComponent(award.retailer_name)}` : ""),
      }
    : award.retailer_id
      ? { label: "View retailer", to: `/retailer/${award.retailer_id}` }
      : null;
  const rows: [string, string][] = [
    ["Points", `${award.points > 0 ? "+" : ""}${award.points}`],
    ["Value", inr(award.points * conversionRate)],
    ["Game", award.program],
    ["Activity", award.activity],
  ];
  if (award.beat_name) rows.push(["Beat", award.beat_name]);
  if (award.order_value != null) rows.push(["Order value", inr(award.order_value)]);
  if (award.order_status) rows.push(["Order status", award.order_status]);
  if (award.achievement_pct != null) rows.push(["Achieved", `${award.achievement_pct}%`]);
  if (award.tier_pct != null) rows.push(["Tier reached", `${award.tier_pct}%`]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/45" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Award detail"
        className="fixed z-50 inset-x-0 bottom-0 max-h-[86vh] overflow-y-auto rounded-t-[18px] border-t bg-background px-5 pt-2 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[390px] sm:max-h-none sm:rounded-none sm:border-l sm:border-t-0 sm:px-6 sm:pt-6"
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-muted sm:hidden" />
        <div className="flex items-start gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-[18px] font-extrabold tracking-tight truncate">{d.title}</p>
            <p className="text-[11.5px] text-muted-foreground truncate">{d.sub}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto shrink-0 rounded-[8px] border px-2.5 py-1.5 text-[15px] leading-none text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>
        <dl className="border-t">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline gap-3 border-b py-2.5">
              <dt className="w-[104px] shrink-0 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{k}</dt>
              <dd className={`text-[14px] font-semibold tabular-nums break-words ${k === "Points" ? "text-[19px] font-extrabold text-amber-500" : ""}`}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
        {dest && (
          <button
            type="button"
            onClick={() => { onClose(); navigate(dest.to); }}
            className="mt-4 w-full rounded-[10px] bg-foreground py-3 text-[13.5px] font-semibold text-background"
          >
            {dest.label} →
          </button>
        )}
      </div>
    </>
  );
}
