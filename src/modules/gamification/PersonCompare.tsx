import { useMemo, useState } from "react";
import {
  BarChart3, ChevronDown, ChevronRight, Info, MapPin, ShoppingCart, Star, Store, Target,
} from "lucide-react";
import { categoryMeta } from "./constants";
import type { PersonActivity, PersonProfile } from "./hooks";

/**
 * You against the person whose board you opened.
 *
 * A leaderboard says who is ahead. This says what they are doing differently,
 * which is the only part a rep can act on — and it has to land in a glance, on
 * a phone, for someone who does not read dashboards. So it leads with a verdict
 * in words, then paired bars, then ONE card. The analysis that used to be four
 * sentences is behind "More detail".
 *
 * Two rules the numbers have to keep. The points decomposition sums exactly to
 * the gap, so awards and days earning live in their own strip rather than
 * inside it — they are not points. And a game where the two of you are level is
 * labelled "Same" rather than drawn as a zero, because "nothing to fix here" is
 * the most useful thing this screen can tell anyone.
 */

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const num = (n: number) => Math.round(n).toLocaleString("en-IN");

interface Props {
  theirName: string;
  mine?: PersonProfile;
  theirs?: PersonProfile;
  mineByActivity: PersonActivity[];
  theirsByActivity: PersonActivity[];
  /** Opens the drill-down on this program. Omitted when there is nowhere to go. */
  onExplore?: (program: string) => void;
}

/** A program's icon, by what the game is about rather than by its name. */
function programIcon(program: string, category: string) {
  const s = `${program} ${category}`.toLowerCase();
  if (/target|quota|goal/.test(s)) return Target;
  if (/retailer|growth|store|outlet/.test(s)) return Store;
  if (/visit|beat|route/.test(s)) return MapPin;
  if (/focus|product|sku/.test(s)) return ShoppingCart;
  if (/rank|leader/.test(s)) return BarChart3;
  return Star;
}

interface Row {
  program: string;
  category: string;
  activity: string;
  mine: number;
  theirs: number;
  mineAwards: number;
  theirAwards: number;
}

function buildRows(a: PersonActivity[], b: PersonActivity[]): Row[] {
  const roll = (rows: PersonActivity[]) => {
    const m = new Map<string, { points: number; awards: number; category: string; activity: string }>();
    rows.forEach((r) => {
      const cur = m.get(r.program);
      m.set(r.program, {
        points: (cur?.points ?? 0) + r.points,
        awards: (cur?.awards ?? 0) + r.awards,
        category: r.category,
        // The biggest activity in the program names it in the explanation.
        activity: !cur || r.points > (cur.points ?? 0) ? r.activity : cur.activity,
      });
    });
    return m;
  };
  const mineMap = roll(a);
  const theirsMap = roll(b);
  return [...new Set([...mineMap.keys(), ...theirsMap.keys()])]
    .map((program) => {
      const m = mineMap.get(program);
      const t = theirsMap.get(program);
      return {
        program,
        category: m?.category ?? t?.category ?? "",
        activity: (m && m.points >= (t?.points ?? 0) ? m.activity : t?.activity) ?? "awards",
        mine: m?.points ?? 0,
        theirs: t?.points ?? 0,
        mineAwards: m?.awards ?? 0,
        theirAwards: t?.awards ?? 0,
      };
    })
    // Biggest divergence first: what to look at, before what merely exists.
    .sort((x, y) => Math.abs(y.mine - y.theirs) - Math.abs(x.mine - x.theirs));
}

export function PersonCompare({
  theirName, mine, theirs, mineByActivity, theirsByActivity, onExplore,
}: Props) {
  const [more, setMore] = useState(false);
  const rows = useMemo(
    () => buildRows(mineByActivity, theirsByActivity),
    [mineByActivity, theirsByActivity],
  );

  if (!mine || !theirs) return null;

  const short = theirName.split(" ")[0];
  const gap = mine.points - theirs.points;
  const ahead = gap > 0;
  const level = gap === 0;
  const max = Math.max(...rows.map((r) => Math.max(r.mine, r.theirs)), 1);

  const diffs = rows.filter((r) => r.mine !== r.theirs);
  const same = rows.filter((r) => r.mine === r.theirs && r.mine > 0);
  const top = diffs[0];

  // The one sentence. "Level on X" first when it is true, because a game you
  // are matched on is a game not worth working on.
  const verdict = !top
    ? "You have earned the same points in every game."
    : `${same.length ? `Level on ${same[0].program}. ` : ""}${
        top.mine > top.theirs ? "Your" : "Their"
      } ${num(Math.abs(gap))} comes from ${top.program.toLowerCase()}.`;

  const heading = level ? "Where you are alike" : ahead ? "What puts you ahead" : "Where they are ahead";

  return (
    <div className="space-y-3">
      {/* ---------- verdict ---------- */}
      <div className="rounded-[12px] border p-3.5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">You</p>
            <p className="text-[26px] font-extrabold tabular-nums leading-none mt-0.5">{num(mine.points)}</p>
          </div>
          <p className="text-[11px] text-muted-foreground pb-1.5">vs</p>
          <div className="min-w-0 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground truncate">{short}</p>
            <p className="text-[26px] font-extrabold tabular-nums leading-none mt-0.5">{num(theirs.points)}</p>
          </div>
        </div>

        {/* the race, on one shared scale */}
        <div className="flex gap-1 h-2 mt-2.5">
          <span
            className="block rounded-full bg-primary"
            style={{ width: `${(mine.points / Math.max(mine.points, theirs.points, 1)) * 50}%` }}
          />
          <span
            className="block rounded-full bg-muted-foreground/40"
            style={{ width: `${(theirs.points / Math.max(mine.points, theirs.points, 1)) * 50}%` }}
          />
        </div>

        <div className="mt-3 pt-3 border-t">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              level ? "bg-muted text-muted-foreground"
              : ahead ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-red-500/10 text-red-500 dark:text-red-400"
            }`}
          >
            {level ? "Level on points" : ahead ? `You are ahead by ${num(gap)}` : `${short} is ahead by ${num(-gap)}`}
          </span>
          <p className="text-[15px] font-bold leading-snug mt-2">{verdict}</p>
        </div>
      </div>

      {/* ---------- paired bars ---------- */}
      <div className="rounded-[12px] border p-3.5">
        <div className="flex items-center gap-2 mb-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{heading}</p>
          <span className="ml-auto text-[11px] text-muted-foreground">
            {rows.length} {rows.length === 1 ? "game" : "games"}
          </span>
        </div>

        <div className="space-y-3.5">
          {rows.map((r) => {
            const d = r.mine - r.theirs;
            const Icon = programIcon(r.program, r.category);
            return (
              <div key={r.program}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: categoryMeta(r.category).ac }} />
                  <span className="text-[12.5px] font-semibold truncate">{r.program}</span>
                  <span
                    className={`ml-auto text-[11.5px] font-semibold whitespace-nowrap ${
                      d === 0 ? "text-muted-foreground"
                      : d > 0 ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-500 dark:text-red-400"
                    }`}
                  >
                    {d === 0 ? "Same" : d > 0 ? `You +${num(d)}` : `Them +${num(-d)}`}
                  </span>
                </div>
                <div className="space-y-1">
                  {([["You", r.mine, true], ["Them", r.theirs, false]] as const).map(([k, v, isMine]) => (
                    <div key={k} className="grid grid-cols-[30px_1fr_auto] items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">{k}</span>
                      <span className="h-2 rounded-full bg-muted overflow-hidden">
                        <span
                          className={`block h-full rounded-full ${isMine ? "bg-primary" : "bg-muted-foreground/40"}`}
                          style={{ width: `${(v / max) * 100}%` }}
                        />
                      </span>
                      <span className={`text-[11.5px] font-semibold tabular-nums w-11 text-right ${isMine ? "" : "text-muted-foreground"}`}>
                        {num(v)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-baseline gap-2 mt-3.5 pt-3 border-t border-dashed">
          <span className="text-[11.5px] text-muted-foreground">
            {level ? "Nothing between you" : "Adds up to"}
          </span>
          <span
            className={`ml-auto text-[16px] font-extrabold tabular-nums ${
              level ? "text-muted-foreground"
              : ahead ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-500 dark:text-red-400"
            }`}
          >
            {ahead ? "+" : ""}{num(gap)} pts
          </span>
        </div>
      </div>

      {/* ---------- the one card ---------- */}
      {top && (
        <div className="rounded-[12px] border p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">
            {top.mine > top.theirs ? "Your biggest edge" : "Biggest gap to close"}
          </p>
          {(() => {
            const d = top.mine - top.theirs;
            const good = d > 0;
            const Icon = programIcon(top.program, top.category);
            return (
              <>
                <div className="flex items-start gap-3">
                  <span
                    className={`h-10 w-10 shrink-0 rounded-[12px] grid place-items-center ${
                      good ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-500 dark:text-red-400"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className={`text-[24px] font-extrabold tabular-nums leading-none ${
                      good ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
                    }`}>
                      {good ? "+" : ""}{num(d)}
                    </p>
                    <p className="text-[12.5px] font-semibold mt-0.5">{top.program}</p>
                    <p className="text-[12.5px] text-muted-foreground leading-snug mt-1.5">
                      {/* The program names itself right above, so the sentence
                          carries the counts instead of repeating it. */}
                      {good
                        ? `You earned ${num(d)} more points here — ${top.mineAwards} ${top.mineAwards === 1 ? "award" : "awards"} to their ${top.theirAwards}.`
                        : `${short} earned ${num(-d)} more points here — ${top.theirAwards} ${top.theirAwards === 1 ? "award" : "awards"} to your ${top.mineAwards}.`}
                    </p>
                  </div>
                </div>

                {diffs.length > 1 && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t">
                    {diffs.slice(1).map((r) => {
                      const rd = r.mine - r.theirs;
                      return (
                        <span key={r.program} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11.5px]">
                          {r.program}
                          <b className={`font-semibold tabular-nums ${rd > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                            {rd > 0 ? "+" : ""}{num(rd)}
                          </b>
                        </span>
                      );
                    })}
                  </div>
                )}

                {onExplore && (
                  <button
                    type="button"
                    onClick={() => onExplore(top.program)}
                    className="w-full flex items-center gap-2 mt-3 min-h-[44px] rounded-[10px] border bg-muted/50 px-3 py-2.5 text-[12.5px] font-semibold text-left"
                  >
                    See what made up {top.program.toLowerCase()}
                    <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
                  </button>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* ---------- effort, kept out of the points ---------- */}
      <div className="rounded-[12px] border overflow-hidden">
        <div className="flex items-center gap-2 px-3.5 py-2.5 border-b">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Effort</p>
          <span className="ml-auto text-[11px] text-muted-foreground">not points</span>
        </div>
        <div className="grid grid-cols-2 divide-x">
          {([
            ["Awards", mine.awards, theirs.awards, "you vs " + short],
            ["Days earning", mine.days, theirs.days,
              mine.days === theirs.days ? "the same"
                : mine.days > theirs.days ? "you spread it wider"
                : `${short} spread it wider`],
          ] as const).map(([label, a, b, sub]) => (
            <div key={label} className="px-3.5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
              <p className="flex items-baseline gap-1.5 mt-1">
                <span className="text-[19px] font-extrabold tabular-nums">{num(a)}</span>
                <span className="text-[12px] text-muted-foreground">vs</span>
                <span className="text-[15px] font-bold tabular-nums text-muted-foreground">{num(b)}</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- everything analytical, folded away ---------- */}
      <div className="rounded-[12px] border">
        <button
          type="button"
          onClick={() => setMore((v) => !v)}
          aria-expanded={more}
          className="w-full flex items-center gap-2 px-3.5 min-h-[44px] py-2.5 text-[12px] font-semibold text-muted-foreground"
        >
          <Info className="h-3.5 w-3.5" />
          More detail
          <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${more ? "rotate-180" : ""}`} />
        </button>
        {more && (
          <div className="px-3.5 pb-3.5 space-y-2">
            {(() => {
              const out: string[] = [];
              const theirTop = [...rows].sort((a, b) => b.theirs - a.theirs)[0];
              if (theirTop && theirs.points) {
                const t = Math.round((theirTop.theirs / theirs.points) * 100);
                const m = mine.points ? Math.round((theirTop.mine / mine.points) * 100) : 0;
                out.push(`${t}% of ${short}'s points come from ${theirTop.program.toLowerCase()}. Yours is ${m}% from the same game.`);
              }
              if (mine.order_count && theirs.order_count) {
                out.push(
                  `Their orders average ${inr(theirs.order_value / theirs.order_count)} against your ` +
                  `${inr(mine.order_value / mine.order_count)}. Points are paid per order, not per rupee — ` +
                  `so this is the scheme's shape, not effort.`,
                );
              }
              return out.map((t) => (
                <p key={t} className="text-[12.5px] leading-snug text-muted-foreground">{t}</p>
              ));
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
