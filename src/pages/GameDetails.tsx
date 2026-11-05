import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CalendarDays, ChevronRight, Flame, Loader2,
  Sparkles, Star, Target as TargetIcon, Trophy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActivityRankings, useGamSettings } from "@/modules/gamification/hooks";
import { TrophyStage } from "@/components/gamification/TrophyStage";
import {
  computeProgress, daysLeft, deadlineLabel, progressStatus,
  type ActivityProgress, type ActivityTier,
} from "@/modules/gamification/activityProgress";
import { parseOverview, type OverviewContent } from "@/modules/gamification/overviewContent";
import { GameOverview } from "@/modules/gamification/GameOverview";

interface AwardRow {
  id: string;
  points: number;
  earned_at: string;
  reference_type: string | null;
  reference_id: string | null;
  retailer_id: string | null;
  metadata: any;
}

interface ActionRow {
  id: string;
  action_name: string;
  description: string | null;
  action_type: string;
  trigger_type: string | null;
  points: number;
  is_tiered: boolean;
  cap_scope: string | null;
  cap_value: number | null;
  base_daily_target: number | null;
  overview: unknown;
  gamification_games: {
    id: string; name: string; start_date: string | null; end_date: string | null;
    is_active: boolean;
  } | null;
}

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Consecutive days ending today or yesterday, and the longest run ever. */
function streaks(days: string[]): { current: number; best: number } {
  if (!days.length) return { current: 0, best: 0 };
  const uniq = [...new Set(days)].sort();
  const asDate = (s: string) => new Date(`${s}T00:00:00`).getTime();
  let best = 1, run = 1;
  for (let i = 1; i < uniq.length; i++) {
    const gap = Math.round((asDate(uniq[i]) - asDate(uniq[i - 1])) / 86_400_000);
    run = gap === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  const today = new Date();
  const yest = new Date(today.getTime() - 86_400_000);
  const last = uniq[uniq.length - 1];
  // a streak only counts as "current" if it reaches today or yesterday
  const current = last === dayKey(today) || last === dayKey(yest) ? run : 0;
  return { current, best };
}

/** The most this activity can pay in its own window, where a ceiling exists. */
function maxReward(a: ActionRow, tiers: ActivityTier[]): { value: number; note: string } | null {
  if (a.is_tiered && tiers.length) {
    return { value: tiers.reduce((s, t) => s + t.points, 0), note: "all tiers cleared" };
  }
  if (a.cap_value && a.cap_scope && a.cap_scope !== "none") {
    return {
      value: a.cap_value * Number(a.points || 0),
      note: a.cap_scope === "user_day" ? "at the daily cap" : "at the monthly cap",
    };
  }
  return null;
}

export default function GameDetails() {
  const { actionId } = useParams<{ actionId: string }>();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { data: settings } = useGamSettings();

  const [action, setAction] = useState<ActionRow | null>(null);
  const [tiers, setTiers] = useState<ActivityTier[]>([]);
  const [awards, setAwards] = useState<AwardRow[]>([]);
  const [retailerNames, setRetailerNames] = useState<Map<string, string>>(new Map());
  const [productiveToday, setProductiveToday] = useState(0);
  const [target, setTarget] = useState<{ target_value: number | null; actual_value: number | null; achievement_percent: number | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [coach, setCoach] = useState<string | null>(null);
  const [coaching, setCoaching] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);

  const monthStart = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  }, []);
  const { data: rankingRows = [] } = useActivityRankings(monthStart, new Date());
  // Controlled so the Overview's "next step" can hand the rep straight to
  // Your Progress instead of telling them to go and find the tab.
  const [tab, setTab] = useState("overview");

  // The rate is global config. gamification_games has no per-game conversion
  // column — selecting one made PostgREST reject the whole query, so every game
  // fell through to "This game is not available".
  const conversionRate = Number(settings?.point_conversion) || 1;

  // Everything below keys off THIS action and THIS user, so switching games
  // cannot leave another game's rows on screen.
  useEffect(() => {
    let cancelled = false;
    if (!actionId || !userProfile?.id) return;
    setLoading(true);
    setAction(null);
    setAwards([]);

    (async () => {
      const now = new Date();
      const [{ data: act }, { data: tierRows }, { data: pts }, { count: visits }, { data: tgt }] =
        await Promise.all([
          supabase
            .from("gamification_actions")
            .select("id, action_name, description, action_type, trigger_type, points, is_tiered, cap_scope, cap_value, base_daily_target, overview, gamification_games(id, name, start_date, end_date, is_active)")
            .eq("id", actionId)
            .maybeSingle(),
          supabase.from("activity_tiers").select("threshold_pct, points").eq("action_id", actionId),
          supabase
            .from("gamification_points")
            .select("id, points, earned_at, reference_type, reference_id, retailer_id, metadata")
            .eq("action_id", actionId)
            .eq("user_id", userProfile.id)
            .order("earned_at", { ascending: false }),
          supabase
            .from("visits")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userProfile.id)
            .eq("planned_date", dayKey(now))
            .eq("status", "productive"),
          supabase
            .from("user_period_targets")
            .select("target_value, actual_value, achievement_percent")
            .eq("user_id", userProfile.id)
            .gte("period_start", dayKey(monthStart))
            .lte("period_start", dayKey(now))
            .maybeSingle(),
        ]);
      if (cancelled) return;

      setAction((act as any) ?? null);
      setTiers((tierRows ?? []).map((t: any) => ({ threshold_pct: Number(t.threshold_pct), points: Number(t.points) })));
      setAwards((pts ?? []) as AwardRow[]);
      setProductiveToday(visits ?? 0);
      setTarget((tgt as any) ?? null);

      // names for whatever the awards point at, so the activity list reads as
      // "Sharma Stores", not a uuid
      const ids = [...new Set((pts ?? [])
        .map((p: any) => p.retailer_id ?? p.metadata?.context?.retailer_id ?? p.metadata?.retailer_id)
        .filter(Boolean))] as string[];
      if (ids.length) {
        const { data: rets } = await supabase.from("retailers").select("id, name").in("id", ids);
        if (!cancelled) setRetailerNames(new Map((rets ?? []).map((r: any) => [r.id, r.name as string])));
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [actionId, userProfile?.id, monthStart]);

  const fullBoard = useMemo(
    () => rankingRows.filter((r) => r.action_id === actionId),
    [rankingRows, actionId]
  );
  const board = useMemo(
    () => fullBoard.map((r) => ({ user_id: r.user_id, name: r.full_name, count: r.awards })),
    [fullBoard]
  );

  const counts = useMemo(() => {
    const todayKey = dayKey(new Date());
    const monthMs = monthStart.getTime();
    let today = 0, month = 0;
    awards.forEach((a) => {
      const at = new Date(a.earned_at);
      if (dayKey(at) === todayKey) today += 1;
      if (at.getTime() >= monthMs) month += 1;
    });
    return { today, month, period: month };
  }, [awards, monthStart]);

  const progress: ActivityProgress | null = useMemo(() => {
    if (!action) return null;
    return computeProgress({
      actionType: String(action.trigger_type || action.action_type || ""),
      tiers,
      capScope: action.cap_scope,
      capValue: action.cap_value,
      baseDailyTarget: action.base_daily_target,
      countToday: counts.today,
      countMonth: counts.month,
      countPeriod: counts.period,
      board,
      myUserId: userProfile?.id,
      productiveToday,
      pointsPerEvent: Number(action.points || 0),
      targetValue: target?.target_value != null ? Number(target.target_value) : null,
      actualValue: target?.actual_value != null ? Number(target.actual_value) : null,
      achievementPct: target?.achievement_percent != null ? Number(target.achievement_percent) : null,
    });
  }, [action, tiers, counts, board, userProfile?.id, productiveToday, target]);

  const overview: OverviewContent = useMemo(() => parseOverview(action?.overview), [action?.overview]);

  const monthPoints = useMemo(
    () => awards.filter((a) => new Date(a.earned_at).getTime() >= monthStart.getTime())
                .reduce((s, a) => s + Number(a.points || 0), 0),
    [awards, monthStart]
  );
  const totalPoints = useMemo(() => awards.reduce((s, a) => s + Number(a.points || 0), 0), [awards]);
  const streak = useMemo(() => streaks(awards.map((a) => a.earned_at.slice(0, 10))), [awards]);

  const myRankIdx = fullBoard.findIndex((r) => r.user_id === userProfile?.id);
  const askCoach = async () => {
    if (!action || !progress) return;
    setCoaching(true); setCoachError(null);
    try {
      const { data, error } = await supabase.functions.invoke("gamification-activity-coach", {
        body: {
          activityName: action.action_name,
          gameName: action.gamification_games?.name ?? "",
          actionType: action.action_type,
          pointsPerEvent: action.points,
          tiered: action.is_tiered,
          progress: {
            kind: progress.kind, current: progress.current, goal: progress.goal,
            unit: progress.unit, pct: progress.pct, window: progress.window,
            remaining: progress.remainingLabel, nextTier: progress.nextTierLabel ?? null,
          },
          myPointsThisPeriod: monthPoints,
          myRupees: Math.round(monthPoints * conversionRate),
          periodLabel: "this month",
          myRank: progress.myRank ?? (myRankIdx >= 0 ? myRankIdx + 1 : null),
          fieldSize: progress.fieldSize ?? fullBoard.length,
          bestName: fullBoard[0]?.full_name ?? null,
          bestPoints: fullBoard[0]?.points ?? null,
          rivalName: progress.rivalName ?? null,
          overtake: progress.overtakeLabel ?? null,
        },
      });
      if (error) throw error;
      const text = (data as any)?.advice;
      if (!text) throw new Error("The coach came back empty.");
      setCoach(text);
    } catch (e: any) {
      setCoachError(e?.message ?? "Could not reach the coach just now.");
    } finally { setCoaching(false); }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (!action || !progress) {
    return (
      <Layout>
        <div className="p-6 max-w-lg mx-auto text-center">
          <Trophy className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="mt-3 font-semibold">This game is not available</p>
          <p className="text-[13px] text-muted-foreground mt-1">
            It may have been switched off, or you may not be eligible for it.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/leaderboard")}>
            Back to leaderboard
          </Button>
        </div>
      </Layout>
    );
  }

  const game = action.gamification_games;
  const st = progressStatus(progress);
  const left = daysLeft(progress, game?.end_date ?? null);
  const cap = maxReward(action, tiers);
  const shownAwards = showAllActivity ? awards.slice(0, 50) : awards.slice(0, 6);

  /** What one award was FOR, phrased by what the engine recorded against it. */
  const awardLine = (a: AwardRow) => {
    const rid = a.retailer_id ?? a.metadata?.context?.retailer_id ?? a.metadata?.retailer_id;
    const who = rid ? retailerNames.get(rid) : undefined;
    const ctx = a.metadata?.context ?? {};
    if (a.reference_type === "target_tier") {
      return { who: "Monthly target", what: `${a.metadata?.tier_threshold ?? "?"}% tier reached` };
    }
    if (a.reference_type === "visit_tier") {
      return {
        who: "Daily visits",
        what: `${a.metadata?.productive_visits ?? "?"} productive of ${a.metadata?.daily_visit_target ?? "?"}`,
      };
    }
    if (a.reference_type === "order") {
      const value = ctx.order_value ? ` · ${money(Number(ctx.order_value))}` : "";
      return { who: who ?? "Order", what: `${ctx.is_first_order ? "First order" : "Order"}${value}` };
    }
    if (a.reference_type === "retailer") return { who: who ?? "New retailer", what: "Retailer created" };
    return { who: who ?? "Activity", what: a.reference_type ?? "Qualifying activity" };
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-3 sm:p-5 space-y-4">
        {/* ===== HEADER ===== */}
        <div className="relative overflow-hidden rounded-[20px] px-4 sm:px-7 py-4 sm:py-5 bg-gradient-primary text-primary-foreground">
          <div className="relative flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary-foreground/70">
                  {game?.name ?? "Game"}
                </span>
                <Badge
                  className={`text-[10px] ${
                    st.tone === "done" ? "bg-emerald-400 text-[#1c2440] hover:bg-emerald-400"
                    : st.tone === "going" ? "bg-amber-400 text-[#1c2440] hover:bg-amber-400"
                    : "bg-red-100 text-red-700 hover:bg-red-100"
                  }`}
                >
                  {st.label}
                </Badge>
              </div>
              <h1 className="text-[19px] sm:text-[23px] font-extrabold leading-tight mt-1">
                {action.action_name}
              </h1>
              {action.description && (
                <p className="text-[12px] text-primary-foreground/75 mt-1 max-w-[60ch]">{action.description}</p>
              )}
              <p className="text-[11px] text-primary-foreground/65 mt-2 inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                {game?.start_date ?? "—"} → {game?.end_date ?? "—"} · {deadlineLabel(progress, game?.end_date ?? null)}
              </p>
            </div>

            <TrophyStage className="hidden xs:block shrink-0 w-[74px] sm:w-[110px] self-center" />
          </div>
        </div>

        {/* ===== REWARD SUMMARY ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <Card className="border"><CardContent className="p-3.5">
            <div className="flex items-center gap-1.5 text-muted-foreground"><Star className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">Reward</span></div>
            <p className="text-[17px] font-extrabold mt-1 tabular-nums">
              {action.is_tiered ? "By tier" : `+${action.points} pts`}
            </p>
            <p className="text-[10.5px] text-muted-foreground">
              {action.is_tiered ? `${tiers.length} tiers` : `per ${progress.unit.replace(/s$/, "")}`}
            </p>
          </CardContent></Card>

          <Card className="border"><CardContent className="p-3.5">
            <div className="flex items-center gap-1.5 text-muted-foreground"><TargetIcon className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">Target</span></div>
            <p className="text-[17px] font-extrabold mt-1 tabular-nums">
              {progress.kind === "none" ? "—" : `${progress.goal.toLocaleString()}`}
            </p>
            <p className="text-[10.5px] text-muted-foreground">
              {progress.kind === "none" ? "no target set" : `${progress.unit} · ${progress.window === "today" ? "today" : progress.window === "month" ? "this month" : "to lead"}`}
            </p>
          </CardContent></Card>

          <Card className="border"><CardContent className="p-3.5">
            <div className="flex items-center gap-1.5 text-muted-foreground"><Trophy className="h-3.5 w-3.5 text-violet-500" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">Max reward</span></div>
            <p className="text-[17px] font-extrabold mt-1 tabular-nums">
              {cap ? money(cap.value * conversionRate) : "No ceiling"}
            </p>
            <p className="text-[10.5px] text-muted-foreground">
              {cap ? `${cap.value.toLocaleString()} pts ${cap.note}` : "pays every time"}
            </p>
          </CardContent></Card>

          <Card className="border"><CardContent className="p-3.5">
            <div className="flex items-center gap-1.5 text-muted-foreground"><CalendarDays className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">Time left</span></div>
            <p className="text-[17px] font-extrabold mt-1 tabular-nums">{left}</p>
            <p className="text-[10.5px] text-muted-foreground">{left === 1 ? "day" : "days"} remaining</p>
          </CardContent></Card>
        </div>

        {/* ===== TABS ===== */}
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 h-auto p-1.5 rounded-[16px]">
            <TabsTrigger value="overview" className="rounded-[12px] py-2 text-[12.5px] font-semibold">Overview</TabsTrigger>
            <TabsTrigger value="progress" className="rounded-[12px] py-2 text-[12.5px] font-semibold">Your Progress</TabsTrigger>
          </TabsList>

          {/* ---------- OVERVIEW: entirely from the saved configuration ---------- */}
          <TabsContent value="overview">
            <GameOverview
              overview={overview}
              points={action.points}
              isTiered={action.is_tiered}
              tiers={tiers}
              conversionRate={conversionRate}
              progress={progress}
              onOpenProgress={() => setTab("progress")}
            />
          </TabsContent>

          {/* ---------- YOUR PROGRESS: this user's own records only ---------- */}
          <TabsContent value="progress" className="space-y-3">
            <Card className="border"><CardContent className="p-4 sm:p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[13.5px] font-bold">
                  {progress.window === "today" ? "Today's progress" : progress.window === "month" ? "This month's progress" : "Your progress"}
                </h2>
                <span className="text-[11px] text-muted-foreground">{new Date().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>
              </div>

              {progress.kind === "none" ? (
                <p className="text-[13px] text-muted-foreground mt-2">{progress.remainingLabel}</p>
              ) : (
                <>
                  <div className="flex items-end justify-between gap-3 mt-3">
                    <p className="tabular-nums">
                      <span className="text-3xl font-extrabold">{progress.current.toLocaleString()}</span>
                      <span className="text-muted-foreground text-[15px]"> / {progress.goal.toLocaleString()}</span>
                      <span className="block text-[11px] text-muted-foreground mt-0.5">{progress.unit}</span>
                    </p>
                    <p className="text-right">
                      <span className="text-2xl font-extrabold tabular-nums">{progress.pct}%</span>
                      <span className="block text-[11px] text-muted-foreground">of target</span>
                    </p>
                  </div>
                  <div className="mt-2.5 h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${st.tone === "done" ? "bg-emerald-500" : st.tone === "going" ? "bg-amber-500" : "bg-muted-foreground/30"}`}
                      style={{ width: `${progress.pct}%` }}
                    />
                  </div>
                </>
              )}

              <div className="mt-3 flex items-start gap-2 rounded-[10px] bg-primary/5 px-3 py-2.5">
                <Trophy className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[12.5px] leading-snug">
                  {progress.overtakeLabel ?? progress.remainingLabel}
                </p>
              </div>
            </CardContent></Card>

            <div className="grid grid-cols-3 gap-2.5">
              <Card className="border"><CardContent className="p-3.5 text-center">
                <Star className="h-4 w-4 mx-auto text-amber-500" />
                <p className="text-xl font-extrabold tabular-nums mt-1">{monthPoints.toLocaleString()}</p>
                <p className="text-[10.5px] text-muted-foreground">points this month</p>
              </CardContent></Card>
              <Card className="border"><CardContent className="p-3.5 text-center">
                <Flame className="h-4 w-4 mx-auto text-orange-500" />
                <p className="text-xl font-extrabold tabular-nums mt-1">{streak.current}</p>
                <p className="text-[10.5px] text-muted-foreground">{streak.current === 1 ? "day" : "days"} current streak</p>
              </CardContent></Card>
              <Card className="border"><CardContent className="p-3.5 text-center">
                <Trophy className="h-4 w-4 mx-auto text-violet-500" />
                <p className="text-xl font-extrabold tabular-nums mt-1">{streak.best}</p>
                <p className="text-[10.5px] text-muted-foreground">best streak</p>
              </CardContent></Card>
            </div>

            <Card className="border"><CardContent className="p-4 sm:p-5">
              <div className="flex items-baseline justify-between gap-3 mb-2.5">
                <h2 className="text-[13.5px] font-bold">Recent qualifying activity</h2>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {totalPoints.toLocaleString()} pts all time
                </span>
              </div>

              {!awards.length ? (
                <p className="text-[13px] text-muted-foreground py-4 text-center">
                  Nothing has paid out on this game yet.
                </p>
              ) : (
                <>
                  <ul className="divide-y">
                    {shownAwards.map((a) => {
                      const line = awardLine(a);
                      return (
                        <li key={a.id} className="flex items-center gap-3 py-2.5">
                          <span className="h-8 w-8 shrink-0 rounded-[9px] bg-muted grid place-items-center">
                            <TargetIcon className="h-4 w-4 text-muted-foreground" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold truncate">{line.who}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {line.what} · {new Date(a.earned_at).toLocaleString(undefined, {
                                day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <span className="text-[12.5px] font-bold tabular-nums shrink-0 text-emerald-600">
                            +{Number(a.points).toLocaleString()} pts
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {awards.length > 6 && (
                    <button
                      onClick={() => setShowAllActivity((v) => !v)}
                      className="w-full mt-2 rounded-[10px] border border-dashed py-2 text-[12px] font-semibold text-muted-foreground hover:bg-muted transition-colors inline-flex items-center justify-center gap-1"
                    >
                      {showAllActivity ? "Show recent only" : `View all ${awards.length}`}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </>
              )}
            </CardContent></Card>

            {/* WHO IS GOOD AT THIS ONE — the board for this activity alone */}
            <Card className="border"><CardContent className="p-4 sm:p-5">
              <h2 className="text-[13.5px] font-bold mb-2.5">Who is best at this, this month</h2>
              {!fullBoard.length ? (
                <p className="text-[13px] text-muted-foreground">Nobody has scored on this game this month. Be the first.</p>
              ) : (
                <ul className="divide-y">
                  {fullBoard.slice(0, 5).map((r, i) => (
                    <li key={r.user_id} className={`flex items-center gap-3 py-2 px-2 rounded-[8px] ${r.user_id === userProfile?.id ? "bg-primary/10" : ""}`}>
                      <span className="w-6 text-[12px] font-bold tabular-nums shrink-0 text-muted-foreground">{i + 1}</span>
                      {i === 0 && <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                      <span className="text-[12.5px] truncate flex-1">
                        {r.full_name}
                        {r.user_id === userProfile?.id ? " (you)" : i === myRankIdx - 1 ? " — next to pass" : ""}
                      </span>
                      <span className="text-[11px] text-muted-foreground shrink-0">{r.awards}×</span>
                      <span className="text-[12.5px] font-bold tabular-nums shrink-0 w-14 text-right">{r.points.toLocaleString()}</span>
                    </li>
                  ))}
                  {myRankIdx >= 5 && (
                    <li className="flex items-center gap-3 py-2 px-2 rounded-[8px] bg-primary/10">
                      <span className="w-6 text-[12px] font-bold tabular-nums shrink-0 text-muted-foreground">{myRankIdx + 1}</span>
                      <span className="text-[12.5px] truncate flex-1">{fullBoard[myRankIdx].full_name} (you)</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">{fullBoard[myRankIdx].awards}×</span>
                      <span className="text-[12.5px] font-bold tabular-nums shrink-0 w-14 text-right">{fullBoard[myRankIdx].points.toLocaleString()}</span>
                    </li>
                  )}
                </ul>
              )}
            </CardContent></Card>

            {/* COACH — one model call, only when asked */}
            <Card className="border"><CardContent className="p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  <h2 className="text-[13.5px] font-bold">How do I finish this?</h2>
                </div>
                <Button size="sm" variant="secondary" className="text-xs" onClick={askCoach} disabled={coaching}>
                  {coaching ? (<><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Thinking</>) : coach ? "Ask again" : "Get a plan"}
                </Button>
              </div>
              {coachError && <p className="text-[12px] text-destructive mt-2">{coachError}</p>}
              {coach && <p className="text-[12.5px] text-muted-foreground mt-2 whitespace-pre-line leading-relaxed">{coach}</p>}
              {!coach && !coachError && !coaching && (
                <p className="text-[12px] text-muted-foreground mt-2">
                  Uses only the figures on this page — where you are, what is left, and how the rep above you is doing.
                </p>
              )}
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
