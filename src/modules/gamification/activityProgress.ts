/**
 * What "progress" means for one gamification activity.
 *
 * Only some activities carry a goal the engine itself enforces, and the rest
 * pay per event forever. Rather than invent a denominator for the open-ended
 * ones — which would make the percentage fiction — those race the period's top
 * performer, which is a real number a rep can actually chase.
 *
 * The rules below mirror the award functions, not the UI's wishes:
 *   target_achievement  gam_award_tiers_for_target   — achievement % vs tiers
 *   total_visits        gam_award_daily_visit_tiers  — productive today / base_daily_target
 *   capped actions      gam_consume_cap              — cap_value counts AWARDS, not points
 */

export type ProgressKind = "target" | "daily" | "cap" | "leader" | "none";

/** Which stretch of time the numerator counts over. */
export type ProgressWindow = "today" | "month" | "period";

export interface ActivityTier {
  threshold_pct: number;
  points: number;
}

export interface ActivityProgress {
  kind: ProgressKind;
  /** Where the rep is, in `unit`. */
  current: number;
  /** What they are heading for. 0 when there is nothing to head for. */
  goal: number;
  unit: string;
  /** 0-100, clamped. */
  pct: number;
  window: ProgressWindow;
  /** Already-phrased "what's left", e.g. "7 to catch up". */
  remainingLabel: string;
  /** The same thing split for the stat tile: a big value and its caption.
   *  Kept structured because splitting the phrase on its first word turned
   *  "Top tier reached" into "Top" / "tier reached". */
  remainingValue: string;
  remainingCaption: string;
  /** The rep directly above you — the one actually worth chasing. */
  rivalName?: string;
  /** Your place on this activity's board, and how many are on it. */
  myRank?: number;
  fieldSize?: number;
  /** The whole thing as one plain sentence: what to do, and what it pays.
   *  Always set — the card and the detail view both read only this. */
  overtakeLabel?: string;
  /** The rung being chased, when the activity is tiered. */
  nextTierLabel?: string;
}

/**
 * A cap this large is an anti-abuse ceiling, not a goal — "2 / 550" tells a rep
 * nothing. Above the line we fall back to racing the leader.
 */
const CAP_IS_A_GOAL_UPTO = 30;

/** Plural-aware unit for the thing this activity counts. */
export function unitFor(actionType: string): string {
  switch (actionType) {
    case "total_visits": return "visits";
    case "retailer_created":
    case "first_order_new_retailer": return "retailers";
    case "order_placed": return "orders";
    case "branding_request": return "requests";
    case "focused_product_sales": return "orders";
    case "target_achievement": return "kg";
    default: return "times";
  }
}

const plural = (n: number, unit: string) =>
  n === 1 && unit.endsWith("s") ? unit.slice(0, -1) : unit;

const clampPct = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** The lowest tier the rep has not yet cleared. */
export function nextTier(tiers: ActivityTier[], pct: number): ActivityTier | null {
  return [...tiers].sort((a, b) => a.threshold_pct - b.threshold_pct)
    .find((t) => t.threshold_pct > pct) ?? null;
}

export interface ProgressInput {
  actionType: string;
  /** activity_tiers rows for this action, if it is tiered. */
  tiers: ActivityTier[];
  capScope: string | null;
  capValue: number | null;
  baseDailyTarget: number | null;
  /** Awards this rep has taken, per window. */
  countToday: number;
  countMonth: number;
  countPeriod: number;
  /** This activity's whole board for the period, best first. */
  board: { user_id: string; name: string; count: number }[];
  myUserId?: string;
  /** Productive visits logged today — only meaningful for total_visits. */
  productiveToday: number;
  /** What one event of this activity pays, for the plain-English sentence. */
  pointsPerEvent: number;
  /** user_period_targets for the current month, when one exists. */
  targetValue?: number | null;
  actualValue?: number | null;
  achievementPct?: number | null;
}

export function computeProgress(i: ProgressInput): ActivityProgress {
  const unit = unitFor(i.actionType);

  // ---- monthly quantity target: the engine's own achievement %, against tiers
  if (i.actionType === "target_achievement") {
    if (!i.targetValue) {
      return {
        kind: "none", current: 0, goal: 0, unit, pct: 0, window: "month",
        remainingLabel: "No target set for you this month",
        remainingValue: "—", remainingCaption: "no target set",
      };
    }
    const pct = Number(i.achievementPct ?? 0);
    const nt = nextTier(i.tiers, pct);
    const needKg = nt ? Math.max(0, (nt.threshold_pct / 100) * i.targetValue - Number(i.actualValue ?? 0)) : 0;
    return {
      kind: "target",
      current: Math.round(Number(i.actualValue ?? 0)),
      goal: Math.round(i.targetValue),
      unit, pct: clampPct(pct), window: "month",
      remainingLabel: nt
        ? `${Math.round(needKg).toLocaleString()} kg to ${nt.threshold_pct}%`
        : "Top tier reached",
      remainingValue: nt ? Math.round(needKg).toLocaleString() : "Top",
      remainingCaption: nt ? `kg to ${nt.threshold_pct}%` : "tier reached",
      nextTierLabel: nt ? `Next tier ${nt.threshold_pct}% · ${nt.points} pts` : undefined,
      overtakeLabel: nt
        ? `Sell ${Math.round(needKg).toLocaleString()} kg more this month to reach ${nt.threshold_pct}% — that pays ${nt.points.toLocaleString()} pts.`
        : "You have cleared every tier on this target.",
    };
  }

  // ---- daily visit tiers: productive visits today over the configured target
  if (i.actionType === "total_visits" && (i.baseDailyTarget ?? 0) > 0) {
    const goal = Number(i.baseDailyTarget);
    const pct = (i.productiveToday / goal) * 100;
    const nt = nextTier(i.tiers, pct);
    const needVisits = nt ? Math.max(0, Math.ceil((nt.threshold_pct / 100) * goal) - i.productiveToday) : 0;
    return {
      kind: "daily",
      current: i.productiveToday, goal, unit, pct: clampPct(pct), window: "today",
      remainingLabel: nt
        ? `${needVisits} more ${plural(needVisits, unit)} to ${nt.threshold_pct}%`
        : "Top tier reached today",
      remainingValue: nt ? String(needVisits) : "Top",
      remainingCaption: nt ? `more ${plural(needVisits, unit)} to ${nt.threshold_pct}%` : "tier reached today",
      nextTierLabel: nt ? `Next tier ${nt.threshold_pct}% · ${nt.points} pts` : undefined,
      overtakeLabel: nt
        ? `${needVisits} more productive ${plural(needVisits, unit)} today reaches ${nt.threshold_pct}% and pays ${nt.points.toLocaleString()} pts.`
        : "You have cleared every tier today.",
    };
  }

  // ---- a small cap is a real daily/monthly goal; a huge one is just a ceiling
  const cap = Number(i.capValue ?? 0);
  if (cap > 0 && cap <= CAP_IS_A_GOAL_UPTO && (i.capScope === "user_day" || i.capScope === "user_month")) {
    const daily = i.capScope === "user_day";
    const current = daily ? i.countToday : i.countMonth;
    const left = Math.max(0, cap - current);
    return {
      kind: "cap",
      current, goal: cap, unit,
      pct: clampPct((current / cap) * 100),
      window: daily ? "today" : "month",
      remainingLabel: left === 0
        ? (daily ? "Done for today" : "Done for this month")
        : `${left} more ${plural(left, unit)} ${daily ? "today" : "this month"}`,
      remainingValue: left === 0 ? "Done" : String(left),
      remainingCaption: left === 0
        ? (daily ? "for today" : "for this month")
        : `more ${plural(left, unit)} ${daily ? "today" : "this month"}`,
      overtakeLabel: left === 0
        ? `You have taken all ${cap} ${plural(cap, unit)} ${daily ? "today" : "this month"} — it resets ${daily ? "tomorrow" : "next month"}.`
        : `${left} more ${plural(left, unit)} ${daily ? "today" : "this month"}, worth ${(left * i.pointsPerEvent).toLocaleString()} pts.`,
    };
  }

  // ---- open-ended: chase the rep one rung above, not the rep at the top.
  // Racing the leader from the bottom of the board reads as hopeless; racing
  // the person immediately ahead is a gap you can close this week.
  const board = i.board;
  const meIdx = i.myUserId ? board.findIndex((b) => b.user_id === i.myUserId) : -1;
  const mine = i.countPeriod;
  const thing = (n: number) => plural(n, unit);

  if (!board.length) {
    return {
      kind: "none", current: 0, goal: 0, unit, pct: 0, window: "period",
      remainingLabel: "Nobody has scored here yet — go first",
      remainingValue: "0", remainingCaption: "be the first",
    };
  }

  // Unranked: the easiest rung is the bottom of the board, not the top.
  const rival = meIdx === -1 ? board[board.length - 1]
    : meIdx === 0 ? board[1]          // leading — defend against the runner-up
    : board[meIdx - 1];
  const leading = meIdx === 0;
  const myRank = meIdx === -1 ? board.length + 1 : meIdx + 1;
  const fieldSize = meIdx === -1 ? board.length + 1 : board.length;

  if (leading) {
    const lead = rival ? mine - rival.count : mine;
    return {
      kind: "leader",
      current: mine, goal: Math.max(mine, 1), unit, pct: 100, window: "period",
      remainingLabel: rival
        ? `${lead} ${thing(lead)} clear of ${rival.name}`
        : "You are the only one scoring here",
      remainingValue: rival ? String(lead) : "Only",
      remainingCaption: rival ? `clear of ${rival.name}` : "one scoring",
      rivalName: rival?.name, myRank, fieldSize,
      overtakeLabel: rival
        ? `${rival.name} is ${lead} behind — stay ahead and the top spot is yours.`
        : "Nobody else has scored here yet.",
    };
  }

  // one past the rival is what actually changes the standings
  const need = Math.max(1, rival.count - mine + 1);
  return {
    kind: "leader",
    current: mine,
    goal: rival.count + 1,
    unit,
    pct: clampPct((mine / (rival.count + 1)) * 100),
    window: "period",
    remainingLabel: `${need} more to pass ${rival.name}`,
    remainingValue: String(need),
    remainingCaption: `to pass ${rival.name}`,
    rivalName: rival.name, myRank, fieldSize,
    overtakeLabel: `${need} more ${thing(need)} — worth ${(need * i.pointsPerEvent).toLocaleString()} pts — puts you past ${rival.name} into #${myRank - 1}.`,
  };
}

/** Complete / In progress / Not started, from the progress itself. */
export function progressStatus(p: ActivityProgress): { label: string; tone: "done" | "going" | "idle" } {
  if (p.kind === "leader" && p.current > 0 && p.current >= p.goal) return { label: "Leading", tone: "done" };
  if (p.pct >= 100) return { label: "Complete", tone: "done" };
  if (p.current > 0) return { label: "In progress", tone: "going" };
  return { label: "Not started", tone: "idle" };
}

/**
 * "resets tonight" / "8 days left this month" / "105 days left, ends 31 Dec".
 * A bare "106 days left" never said left until WHAT.
 */
export function deadlineLabel(p: ActivityProgress, gameEnd: string | null, now = new Date()): string {
  const n = daysLeft(p, gameEnd, now);
  if (p.window === "today") return "resets tonight";
  if (p.window === "month") return `${n} ${n === 1 ? "day" : "days"} left this month`;
  if (!gameEnd) return `${n} ${n === 1 ? "day" : "days"} left`;
  const ends = new Date(gameEnd).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `${n} ${n === 1 ? "day" : "days"} left, ends ${ends}`;
}

/**
 * Days left in the window the progress is measured over — end of today, end of
 * the month, or the game's own end date. A yearly game's "105 days left" is
 * useless next to a target that resets on the 30th.
 */
export function daysLeft(p: ActivityProgress, gameEnd: string | null, now = new Date()): number {
  const endOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
  let end: Date;
  if (p.window === "today") end = endOf(now);
  else if (p.window === "month") end = endOf(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  else if (gameEnd) end = endOf(new Date(gameEnd));
  else return 0;
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000));
}
