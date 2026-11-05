import { Fragment } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight, CheckCircle2, ChevronRight, Info, Sparkles, Star, Target, XCircle,
} from "lucide-react";
import { OverviewGlyph } from "./OverviewGlyph";
import {
  canFlow, OVERVIEW_LISTS, resolveItem, type OverviewContent, type OverviewItem,
  type OverviewListKey,
} from "./overviewContent";
import type { ActivityProgress, ActivityTier } from "./activityProgress";

/**
 * The rep-facing Overview.
 *
 * Every word on this page comes from the Overview saved against the activity in
 * Admin Control - Gamification - Create/Edit Game. Nothing about any particular
 * game is written here: this file only decides how configured text is DRAWN —
 * as a reward hero, a numbered journey, tick and cross cards, information
 * tiles — so a rep can read it at a glance instead of wading through prose.
 *
 * The numbers (reward, cash value, what's left) come from the activity row and
 * the live progress calculation, never from typed-in text.
 */

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/* ------------------------------------------------------------------ *
 * Section shell — one look for every block, so the page reads as a list
 * of equal things rather than a pile of differently-styled cards.
 * ------------------------------------------------------------------ */
function Section({
  icon: Icon, tone, title, aside, children,
}: {
  icon: typeof Info; tone: string; title: string;
  /** Small right-aligned note, e.g. a step count. */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="border"><CardContent className="p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`h-4 w-4 ${tone}`} />
        <h2 className="text-[13.5px] font-bold">{title}</h2>
        {aside && (
          <span className="ml-auto text-[11px] text-muted-foreground whitespace-nowrap">{aside}</span>
        )}
      </div>
      {children}
    </CardContent></Card>
  );
}

/** The best a single qualifying action can pay, straight from configuration. */
function topReward(points: number, isTiered: boolean, tiers: ActivityTier[]) {
  return isTiered ? Math.max(0, ...tiers.map((t) => t.points)) : points;
}

/* ------------------------------------------------------------------ *
 * Reward hero
 * ------------------------------------------------------------------ */

/** What one qualifying action pays, and what that is worth in rupees. */
export function RewardHighlight({
  points, isTiered, tiers, conversionRate, unit,
}: {
  points: number; isTiered: boolean; tiers: ActivityTier[];
  conversionRate: number; unit: string;
}) {
  // Tiered activities have no single per-action value; the headline number is
  // the best rung. Both come from configuration — nothing is assumed here.
  const top = topReward(points, isTiered, tiers);
  const each = unit.replace(/s$/, "");

  return (
    <Card className="border-0 overflow-hidden">
      <CardContent className="p-0">
        <div className="bg-gradient-to-br from-amber-400/20 via-amber-300/10 to-transparent px-4 sm:px-6 py-5">
          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
            <Star className="h-3.5 w-3.5 fill-current" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">
              {isTiered ? "You can earn up to" : "You earn"}
            </span>
          </div>

          <div className="flex items-baseline gap-2 mt-1.5 flex-wrap">
            <span className="text-[40px] leading-none font-extrabold tabular-nums">
              {isTiered ? "" : "+"}{top.toLocaleString()}
            </span>
            <span className="text-[15px] font-bold text-muted-foreground">points</span>
            {conversionRate > 0 && (
              <span className="text-[13px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                = {money(top * conversionRate)}
              </span>
            )}
          </div>

          <p className="text-[12px] text-muted-foreground mt-1.5">
            {isTiered
              ? `across ${tiers.length} ${tiers.length === 1 ? "tier" : "tiers"} — the higher you finish, the more you take home`
              : `every time you complete one ${each}`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Steps — the journey, drawn left to right
 *
 * Whether a given step list can take this shape is decided by flowBlocker in
 * overviewContent, so the admin editor can warn with the same rule.
 * ------------------------------------------------------------------ */
/** One column: numbered tile, label, and the rest of the sentence under it. */
function FlowStep({
  n, headline, sub, icon, image, reward,
}: {
  n: number; headline: string; sub?: string | null;
  icon?: string; image?: string;
  /** The generated last step — the payoff, not something an admin wrote. */
  reward?: boolean;
}) {
  const tile = reward
    ? "bg-amber-400/15 text-amber-600 dark:text-amber-400"
    : "bg-violet-500/10 text-violet-500";
  const badge = reward ? "bg-amber-500" : "bg-violet-500";

  return (
    <div className="shrink-0 basis-[148px] snap-start flex flex-col items-center text-center px-1.5 sm:flex-1 sm:basis-0">
      <div className="relative">
        {/* A picture takes the whole tile and the tint goes with it: an
            uploaded image is already a picture of something, so a coloured
            pad behind it only shrinks it. An icon still needs the pad. */}
        <div
          className={`relative h-[72px] w-[72px] sm:h-[88px] sm:w-[88px] rounded-[24px] overflow-hidden grid place-items-center ${
            image && !reward ? "bg-muted" : tile
          }`}
        >
          {reward ? (
            <Star className="h-8 w-8 sm:h-9 sm:w-9 fill-current" />
          ) : image ? (
            // Positioned, not h-full: Tailwind preflight sets height:auto on img,
            // which won over h-full and let a portrait upload grow past the tile
            // and get clipped — that is what cut "Order" off the third step.
            // object-contain, so the whole picture survives; it fills as much of
            // the tile as its shape allows and the muted pad takes the rest.
            <img src={image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain p-1.5" />
          ) : (
            <OverviewGlyph icon={icon} className="h-8 w-8 sm:h-9 sm:w-9" />
          )}
        </div>
        <span className={`absolute -left-1.5 -top-1.5 h-6 w-6 rounded-full grid place-items-center text-[11px] font-bold tabular-nums text-white shadow ${badge}`}>
          {n}
        </span>
      </div>
      <p className="mt-3 text-[13px] font-bold leading-snug">{headline}</p>
      {sub && <p className="mt-1 text-[12px] text-muted-foreground leading-snug">{sub}</p>}
    </div>
  );
}

function FlowChevron() {
  return (
    <div className="shrink-0 self-start pt-[30px] sm:pt-[38px] text-muted-foreground/40" aria-hidden="true">
      <ChevronRight className="h-4 w-4" />
    </div>
  );
}

function StepFlow({ items, reward }: { items: OverviewItem[]; reward: number }) {
  return (
    // A phone cannot fit four columns, so below sm this is a snap rail the rep
    // swipes; the cut edge of the next card is the only cue that there is more.
    // The scrollbar is hidden here rather than through a global class, because
    // the ones this app already uses (no-scrollbar, scrollbar-hide) are not
    // defined anywhere and adding them would change five other screens.
    <div className="-mx-1.5 flex items-start gap-0.5 overflow-x-auto px-1.5 pb-1 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:overflow-x-visible sm:snap-none">
      {items.map((raw, i) => {
        const item = resolveItem(raw, "steps");
        return (
          <Fragment key={i}>
            {i > 0 && <FlowChevron />}
            <FlowStep
              n={i + 1} headline={item.headline} sub={item.sub}
              icon={item.icon} image={item.image}
            />
          </Fragment>
        );
      })}

      {/* Nobody configures this one. It comes from the activity's own points, so
          every journey ends on what it pays. */}
      <FlowChevron />
      <FlowStep n={items.length + 1} headline={`Earn ${reward.toLocaleString()} points`} reward />
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Steps — the vertical fallback
 * ------------------------------------------------------------------ */
function Steps({ items }: { items: OverviewItem[] }) {
  return (
    <ol className="space-y-2.5">
      {items.map((raw, i) => {
        const item = resolveItem(raw, "steps");
        const last = i === items.length - 1;
        return (
          <li key={i} className="flex gap-3">
            {/* the number, and the rail joining it to the next step */}
            <div className="flex flex-col items-center shrink-0">
              <span className="h-7 w-7 rounded-full bg-violet-500 text-white grid place-items-center text-[12px] font-bold tabular-nums">
                {i + 1}
              </span>
              {!last && <span className="w-px flex-1 min-h-[14px] bg-violet-500/25 mt-1" />}
            </div>

            <div className="min-w-0 flex-1 rounded-[12px] bg-violet-500/[0.06] px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <OverviewGlyph
                  icon={item.icon} image={item.image}
                  className="h-3.5 w-3.5 shrink-0" tone="text-violet-500"
                />
                <p className="text-[13px] font-bold leading-snug">{item.headline}</p>
              </div>
              {item.sub && (
                <p className="text-[12.5px] text-muted-foreground leading-snug mt-0.5">{item.sub}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ *
 * Counts / excludes — tick and cross cards
 * ------------------------------------------------------------------ */
function RuleCards({
  items, listKey, positive,
}: { items: OverviewItem[]; listKey: OverviewListKey; positive: boolean }) {
  const wash = positive ? "bg-emerald-500/[0.07]" : "bg-red-500/[0.06]";
  const tint = positive
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-500 dark:text-red-400";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {items.map((raw, i) => {
        const item = resolveItem(raw, listKey);
        return (
          <div key={i} className={`rounded-[12px] ${wash} px-3 py-2.5 flex gap-2.5`}>
            {/* No tick or cross per line: the section heading and the wash
                already say which list this is, and the badge sat on top of the
                second line of text. */}
            {/* A picture needs more room than a stroke icon to read at all. */}
            <OverviewGlyph
              icon={item.icon} image={item.image}
              className={`shrink-0 mt-0.5 ${item.image ? "h-7 w-7" : "h-5 w-5"}`} tone={tint}
            />
            <div className="min-w-0">
              <p className="text-[12.5px] font-bold leading-snug">{item.headline}</p>
              {item.sub && (
                <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">{item.sub}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Notes — information tiles
 * ------------------------------------------------------------------ */
function NoteTiles({ items }: { items: OverviewItem[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {items.map((raw, i) => {
        const item = resolveItem(raw, "notes");
        return (
          <div key={i} className="rounded-[12px] border bg-muted/30 px-3 py-2.5 flex gap-2.5">
            <OverviewGlyph
              icon={item.icon} image={item.image}
              className={`shrink-0 mt-0.5 ${item.image ? "h-7 w-7" : "h-4 w-4"}`} tone="text-blue-500"
            />
            <div className="min-w-0">
              <p className="text-[12.5px] font-bold leading-snug">{item.headline}</p>
              {item.sub && (
                <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">{item.sub}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Next step — the one thing to do, straight from live progress
 * ------------------------------------------------------------------ */
function NextStep({
  progress, onOpenProgress,
}: { progress: ActivityProgress; onOpenProgress?: () => void }) {
  const line = progress.overtakeLabel ?? progress.remainingLabel;
  if (!line) return null;

  return (
    <button
      type="button"
      onClick={onOpenProgress}
      disabled={!onOpenProgress}
      className="w-full text-left rounded-[14px] bg-gradient-to-r from-primary/10 to-primary/[0.03] border border-primary/20 px-4 py-3.5 flex items-center gap-3 disabled:cursor-default"
    >
      <span className="h-9 w-9 rounded-full bg-primary/15 grid place-items-center shrink-0">
        <ArrowRight className="h-4 w-4 text-primary" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Your next step
        </span>
        <span className="block text-[13px] font-bold leading-snug mt-0.5">{line}</span>
      </span>
      {onOpenProgress && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * The tab
 * ------------------------------------------------------------------ */
export function GameOverview({
  overview, points, isTiered, tiers, conversionRate, progress, onOpenProgress,
}: {
  overview: OverviewContent;
  points: number;
  isTiered: boolean;
  tiers: ActivityTier[];
  conversionRate: number;
  progress: ActivityProgress;
  onOpenProgress?: () => void;
}) {
  const label = (key: OverviewListKey) =>
    OVERVIEW_LISTS.find((l) => l.key === key)?.label ?? key;

  const reward = topReward(points, isTiered, tiers);
  const flow = canFlow(overview.steps ?? []);

  const nothingWritten =
    !overview.about && !overview.why && !overview.steps?.length &&
    !overview.counts?.length && !overview.excludes?.length && !overview.notes?.length;

  return (
    <div className="space-y-3">
      {/* The reward leads, because it answers "why should I care" and it needs
          no configuration at all to render. */}
      <RewardHighlight
        points={points} isTiered={isTiered} tiers={tiers}
        conversionRate={conversionRate} unit={progress.unit}
      />

      <NextStep progress={progress} onOpenProgress={onOpenProgress} />

      {overview.why && (
        <Section icon={Sparkles} tone="text-amber-500" title="Why it matters">
          <p className="text-[13px] leading-relaxed whitespace-pre-line">{overview.why}</p>
        </Section>
      )}

      {overview.about && (
        <Section icon={Info} tone="text-blue-500" title="About this game">
          <p className="text-[13px] text-muted-foreground leading-relaxed whitespace-pre-line">
            {overview.about}
          </p>
        </Section>
      )}

      {overview.steps?.length ? (
        <Section
          icon={Target} tone="text-violet-500" title={label("steps")}
          aside={flow ? `${overview.steps.length + 1} steps` : undefined}
        >
          {flow
            ? <StepFlow items={overview.steps} reward={reward} />
            : <Steps items={overview.steps} />}
        </Section>
      ) : null}

      {overview.counts?.length ? (
        <Section icon={CheckCircle2} tone="text-emerald-500" title={label("counts")}>
          <RuleCards items={overview.counts} listKey="counts" positive />
        </Section>
      ) : null}

      {overview.excludes?.length ? (
        <Section icon={XCircle} tone="text-red-500" title={label("excludes")}>
          <RuleCards items={overview.excludes} listKey="excludes" positive={false} />
        </Section>
      ) : null}

      {overview.notes?.length ? (
        <Section icon={Info} tone="text-blue-500" title={label("notes")}>
          <NoteTiles items={overview.notes} />
        </Section>
      ) : null}

      {/* An activity with no Overview written still gets the reward and the next
          step above; this only explains why the rest of the page is missing. */}
      {nothingWritten && (
        <Card className="border border-dashed"><CardContent className="p-6 text-center">
          <Info className="h-5 w-5 mx-auto text-muted-foreground/40" />
          <p className="mt-2 text-[12.5px] text-muted-foreground max-w-[44ch] mx-auto">
            The full instructions for this game haven't been written yet. What it
            pays, and what to do next, are shown above.
          </p>
        </CardContent></Card>
      )}
    </div>
  );
}
