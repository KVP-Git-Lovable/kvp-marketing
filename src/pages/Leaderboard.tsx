import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LeaderboardTimeFilters } from "@/components/LeaderboardTimeFilters";
import {
  computeProgress, progressStatus, deadlineLabel,
  type ActivityProgress, type ActivityTier,
} from "@/modules/gamification/activityProgress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Award, ChevronRight, Gift, Info, Loader2, Medal, Sparkles, Star, Target, TrendingUp, Trophy, Users,
} from "lucide-react";
import { BadgesDisplay } from "@/components/BadgesDisplay";
import { TrophyMark } from "@/components/gamification/TrophyMark";
import {
  GamSettings, useActivityRankings, useGameRankings, useGamSettings,
  useHasRedemptionQueue, useRankings,
  type RankingRow, type RankScope,
} from "@/modules/gamification/hooks";
import { RedemptionQueue } from "@/modules/gamification/RedemptionQueue";
import { PersonDetailPanel } from "@/modules/gamification/PersonDetailPanel";
import { RedemptionTimeline } from "@/modules/gamification/RedemptionTimeline";
import { RankScopeFilter } from "@/modules/gamification/RankScopeFilter";
import type { LucideIcon } from "lucide-react";
import { TrophyStage } from "@/components/gamification/TrophyStage";
import { CelebrationOverlay } from "@/components/gamification/CelebrationOverlay";

import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface UserPoints {
  user_id: string;
  total_points: number;
  profiles: { full_name: string; profile_picture_url: string | null };
}

interface MyPoints {
  today: number;
  week: number;
  month: number;
  quarter: number;
  year: number;
  total: number;
}

/** The generated supabase types do not yet know these rpcs, and widening every
 *  call site with `any` would hide the shapes as well as the name. */
const rpc = <T,>(fn: string, args?: Record<string, unknown>) =>
  (supabase.rpc as unknown as (
    f: string,
    a?: Record<string, unknown>,
  ) => Promise<{ data: T | null; error: { message: string } | null }>)(fn, args);

/** Shaped by gam_my_redemptions, which carries the approver and payer names so
 *  the timeline can say WHO, not just when. */
interface Redemption {
  id: string;
  points_redeemed: number;
  voucher_amount: number;
  status: string;
  requested_at: string;
  approved_at: string | null;
  approved_by_name: string | null;
  paid_at: string | null;
  paid_by_name: string | null;
  payment_mode: string | null;
  payment_reference: string | null;
  rejection_reason: string | null;
}

interface GameActivity {
  id: string;
  name: string;
  points: number;
  tiered: boolean;
  /** This user's points from THIS activity, in the window and all time. */
  period_points: number;
  total_points: number;
  action_type: string;
  /** Raw award-engine config, so progress can be derived where the
   *  RPC-backed rankings are in scope. */
  cap_scope: string | null;
  cap_value: number | null;
  base_daily_target: number | null;
  tiers: ActivityTier[];
  /** This rep's award COUNT, per window. */
  counts: { today: number; month: number; period: number };
}

interface GameWithPoints {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  /** Every enabled activity of the game — not just the first one. */
  activities: GameActivity[];
  /** This user's points in the selected period, and over all time. */
  period_points: number;
  total_points: number;
  /** Rupees per point for this game (1 pt = ₹N). */
  rupee_rate: number;
}

/** "Points week" reads badly; the selector's keys need words around them. */
const PERIOD_LABEL: Record<string, string> = {
  today: "today",
  yesterday: "yesterday",
  week: "this week",
  month: "this month",
  quarter: "this quarter",
  year: "this year",
  custom: "this period",
};

/** The tab strip, and which Policy & Configuration switch governs each. A tab
 *  whose switch is off is removed from the strip AND its content is not
 *  rendered, so nothing hidden is still reachable. Missing settings (query not
 *  back yet) mean "show", so the page never flickers to empty. */
const LEADERBOARD_TABS: { value: string; flag: keyof GamSettings; long: string; short: string }[] = [
  { value: "games", flag: "tab_games_enabled", long: "My Games", short: "Games" },
  { value: "badges", flag: "tab_badges_enabled", long: "Badges", short: "Badges" },
  { value: "leaderboard", flag: "leaderboard_enabled", long: "Rankings", short: "Rank" },
  { value: "redemptions", flag: "tab_redemptions_enabled", long: "Redemptions", short: "Redeem" },
];

const TAB_ICONS: Record<string, LucideIcon> = {
  games: Award,
  badges: Medal,
  leaderboard: Trophy,
  redemptions: Gift,
};

interface PointsBreakdown {
  activity_name: string;
  points: number;
  count: number;
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [myPoints, setMyPoints] = useState<MyPoints>({ today: 0, week: 0, month: 0, quarter: 0, year: 0, total: 0 });
  const [availableToRedeem, setAvailableToRedeem] = useState(0);
  const [totalRedeemed, setTotalRedeemed] = useState(0);
  /** Actually paid out, as opposed to merely committed. */
  const [totalPaidOut, setTotalPaidOut] = useState(0);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [games, setGames] = useState<GameWithPoints[]>([]);
  const [pointsBreakdown, setPointsBreakdown] = useState<PointsBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<"today" | "yesterday" | "week" | "month" | "quarter" | "year" | "custom">("today");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [showRedeemDialog, setShowRedeemDialog] = useState(false);
  const { data: gamSettings, refetch: refetchGamSettings } = useGamSettings();
  const [tab, setTab] = useState<string>("games");
  const [heroDrill, setHeroDrill] = useState<"rank" | "games" | "points" | null>(null);
  /** Per-game standings for the selected period, built from the same rows the
   *  overall leaderboard uses — so a game's ranking can never contradict it. */
  /** Inputs to progress that are not per-award: today's productive visits and
   *  this month's quantity target. */
  const [progressInputs, setProgressInputs] = useState<{
    productiveToday: number;
    targetValue: number | null;
    actualValue: number | null;
    achievementPct: number | null;
  }>({ productiveToday: 0, targetValue: null, actualValue: null, achievementPct: null });
  const [redeemPoints, setRedeemPoints] = useState("");
  // The points→rupee rate is global config, not a per-game column. The
  // gamification restructure left gamification_games without
  // points_to_rupee_conversion, so every read of it 400s and silently falls
  // back to 1; the rate lives in gamification_settings.point_conversion. It is
  // a Postgres numeric, so it arrives as a string — coerce before arithmetic.
  const conversionRate = Number(gamSettings?.point_conversion) || 1;
  const currencyName = gamSettings?.currency_name || "Points";
  const [celebration, setCelebration] = useState<{ title: string; subtitle?: string } | null>(null);


  // Rankings come from a SECURITY DEFINER RPC, not a table read. RLS on
  // gamification_points only ever returns the caller their own rows, so the old
  // client-side aggregation could never see anybody else — every rep saw a
  // leaderboard of one. gam_rankings returns aggregates only (no retailer or
  // order data), which is what makes it safe to show colleagues at all.
  const { startDate: rangeStart, endDate: rangeEnd } = getDateRange();
  // Whose board this is. Resolved server-side from the signed-in user; the
  // rpc also drops deactivated people, so no scope can surface one.
  const [rankScope, setRankScope] = useState<RankScope>("hierarchy");
  const [rankPeople, setRankPeople] = useState<string[]>([]);
  const { data: rankings = [], isLoading: rankingsLoading } = useRankings(
    rangeStart, rangeEnd, rankScope, rankPeople,
  );
  const [personView, setPersonView] = useState<RankingRow | null>(null);

  // Per-game boards come from the same kind of RPC as the overall one, for the
  // same reason: aggregated client-side they contained only the caller, so
  // "my rank in this game" was always #1 of 1. Kept in the Map shape the game
  // card already consumes.
  const { data: activityRankingRows = [] } = useActivityRankings(rangeStart, rangeEnd);
  /** Per-activity boards, keyed by action. Aggregated server-side — see the hook. */
  const actionRankings = useMemo(() => {
    const m = new Map<string, { user_id: string; name: string; points: number; count: number }[]>();
    activityRankingRows.forEach((r) => {
      const rows = m.get(r.action_id) ?? [];
      rows.push({ user_id: r.user_id, name: r.full_name, points: r.points, count: r.awards });
      m.set(r.action_id, rows);
    });
    m.forEach((rows) => rows.sort((a, b) => b.points - a.points || b.count - a.count));
    return m;
  }, [activityRankingRows]);

  const { data: gameRankingRows = [] } = useGameRankings(rangeStart, rangeEnd);
  const gameRankings = useMemo(() => {
    const m = new Map<string, { user_id: string; name: string; points: number }[]>();
    gameRankingRows.forEach((r) => {
      const rows = m.get(r.game_id) ?? [];
      rows.push({ user_id: r.user_id, name: r.full_name, points: r.points });
      m.set(r.game_id, rows);
    });
    return m;
  }, [gameRankingRows]);

  /** A flat list buries you once the field grows, so the board shows the top
   *  slice and pins your own row above it when you fall outside. */
  const TOP_RANKS = 10;
  const [showAllRanks, setShowAllRanks] = useState(false);
  const shownRankings = useMemo(
    () => (showAllRanks ? rankings : rankings.slice(0, TOP_RANKS)),
    [rankings, showAllRanks]
  );
  const myBoardRow = useMemo(
    () => rankings.find((r) => r.user_id === userProfile?.id),
    [rankings, userProfile?.id]
  );
  const iAmBelowTheFold = !showAllRanks && !!myBoardRow && !shownRankings.includes(myBoardRow);

  const rankRow = (row: RankingRow) => {
    const isMe = row.user_id === userProfile?.id;
    const openRow = personView?.user_id === row.user_id;
    return (
      <div key={row.user_id} className="space-y-1.5">
      <button
        aria-expanded={openRow}
        onClick={() => setPersonView(openRow ? null : row)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-left transition-colors ${
          isMe ? "bg-primary/10 border border-primary/40" : "bg-muted/50 hover:bg-muted"
        }`}
      >
        <span className="w-7 shrink-0 text-center text-[12.5px] font-bold tabular-nums text-muted-foreground">
          {row.rank <= 3 ? getRankIcon(row.rank) : `#${row.rank}`}
        </span>
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="text-[11px] font-semibold">{row.full_name[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold truncate">{row.full_name}</p>
          <p className="text-[11px] text-muted-foreground tabular-nums">
            {row.programs} {row.programs === 1 ? "game" : "games"} · {row.awards}{" "}
            {row.awards === 1 ? "award" : "awards"}
          </p>
        </div>
        {isMe && <Badge className="bg-primary hover:bg-primary text-[10px] shrink-0">You</Badge>}
        <div className="text-right shrink-0">
          <p className="text-[13px] font-bold tabular-nums leading-tight">{row.points.toLocaleString()}</p>
          <p className="text-[10.5px] text-muted-foreground tabular-nums">
            ₹{Math.round(row.points * conversionRate).toLocaleString("en-IN")}
          </p>
        </div>
        <ChevronRight
          className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform ${
            openRow ? "rotate-90" : ""
          }`}
        />
      </button>

      {openRow && (
        <PersonDetailPanel
          open
          userId={row.user_id}
          viewerId={userProfile?.id}
          fullName={row.full_name}
          rank={row.rank}
          points={row.points}
          from={rangeStart}
          to={rangeEnd}
          conversionRate={conversionRate}
          currencyName={currencyName}
          periodLabel={PERIOD_LABEL[timeFilter] ?? "this period"}
        />
      )}
      </div>
    );
  };

  /** Same treatment as the Rankings board: a top slice, your own row pinned
   *  above it when you fall outside, and a control to see everyone. */
  const [showAllStandings, setShowAllStandings] = useState(false);

  /** Kept in the page's existing shape so the hero drill-down still reads it. */
  const leaderboard: UserPoints[] = useMemo(
    () =>
      rankings.map((r) => ({
        user_id: r.user_id,
        total_points: r.points,
        profiles: { full_name: r.full_name, profile_picture_url: r.profile_picture_url },
      })),
    [rankings]
  );

  const standingsShown = useMemo(
    () => (showAllStandings ? leaderboard : leaderboard.slice(0, TOP_RANKS)),
    [leaderboard, showAllStandings]
  );
  const standingsMineIndex = leaderboard.findIndex((l) => l.user_id === userProfile?.id);
  const standingsMine = standingsMineIndex >= 0 ? leaderboard[standingsMineIndex] : undefined;
  const standingsPinned = !showAllStandings && !!standingsMine && standingsMineIndex >= TOP_RANKS;

  const standingsRow = (l: UserPoints, i: number) => (
    <li
      key={l.user_id}
      className={`flex items-center gap-3 py-2 px-2 rounded-[8px] ${
        l.user_id === userProfile?.id ? "bg-primary/10" : ""
      }`}
    >
      <span className="w-8 text-[12.5px] font-bold tabular-nums shrink-0">{getRankIcon(i + 1)}</span>
      <span className="text-[13px] truncate flex-1">
        {l.profiles?.full_name ?? "Unknown"}
        {l.user_id === userProfile?.id && (
          <span className="text-[10.5px] text-primary font-semibold ml-1.5">you</span>
        )}
      </span>
      <span className="text-[13px] font-extrabold tabular-nums shrink-0">
        {l.total_points.toLocaleString()}
      </span>
    </li>
  );


  /** 0 when the user has no points in the window, which reads as "—".
   *  Taken from the RPC's RANK(), so ties share a position. */
  const myRanking = rankings.find((r) => r.user_id === userProfile?.id);
  const myRank = myRanking?.rank ?? 0;

  /**
   * What a rep can actually earn from today. `games` is already restricted to
   * games that are switched on, inside their dates and carrying at least one
   * enabled activity — this counts the ACTIVITIES inside them, because that is
   * the number of distinct ways to score. Staging has 6 games holding 8
   * activities, and 8 is what a rep recognises as "what's running".
   */
  const activeActivities = useMemo(
    () =>
      games
        .flatMap((g) =>
          g.activities.map((a) => {
            const board = actionRankings.get(a.id) ?? [];
            return {
              ...a,
              gameName: g.name,
              game: g,
              progress: computeProgress({
                actionType: a.action_type,
                tiers: a.tiers,
                capScope: a.cap_scope,
                capValue: a.cap_value,
                baseDailyTarget: a.base_daily_target,
                countToday: a.counts.today,
                countMonth: a.counts.month,
                countPeriod: a.counts.period,
                board: board.map((r) => ({ user_id: r.user_id, name: r.name, count: r.count })),
                myUserId: userProfile?.id,
                productiveToday: progressInputs.productiveToday,
                pointsPerEvent: a.points,
                targetValue: progressInputs.targetValue,
                actualValue: progressInputs.actualValue,
                achievementPct: progressInputs.achievementPct,
              }),
            };
          })
        )
        .sort((a, b) => b.period_points - a.period_points || a.name.localeCompare(b.name)),
    [games, actionRankings, progressInputs, userProfile?.id]
  );
  const activeCount = activeActivities.length;

  // Managers approve here, because most of them cannot get anywhere else:
  // /gamification-admin needs an admin permission that six of the eight
  // managers on this org do not have, and it redirects them to the dashboard.
  const { data: hasRedemptionQueue } = useHasRedemptionQueue();

  const visibleTabs = useMemo(
    () =>
      LEADERBOARD_TABS.filter((t) => {
        // Redemptions is DECOUPLED from its own display flag for approvers.
        // tab_redemptions_enabled is about showing reps the rewards tab; left
        // coupled, switching it off would quietly disable approvals company-wide.
        if (t.value === "redemptions" && hasRedemptionQueue) return true;
        return !gamSettings || gamSettings[t.flag] !== false;
      }),
    [gamSettings, hasRedemptionQueue]
  );
  const tabVisible = (value: string) => visibleTabs.some((t) => t.value === value);

  // The selected tab can be switched off by an admin while someone is looking
  // at it, so fall back to the first one still standing.
  useEffect(() => {
    if (visibleTabs.length && !tabVisible(tab)) setTab(visibleTabs[0].value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleTabs, tab]);

  useEffect(() => {
    fetchMyPoints();
    fetchRedemptions();
    fetchGames();
    fetchPointsBreakdown();
  }, [timeFilter, customStartDate, customEndDate]);

  // Function declaration, not a const: called from the hook setup above, which
  // runs before this point in the component body.
  function getDateRange() {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (timeFilter === "custom") {
      if (customStartDate && customEndDate) {
        startDate = new Date(customStartDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(customEndDate);
        endDate.setHours(23, 59, 59, 999);
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      }
    } else {
      switch (timeFilter) {
        case "today":
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
          break;
        case "yesterday":
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
          endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
          break;
        case "week":
          startDate = new Date(now);
          startDate.setDate(now.getDate() - now.getDay());
          startDate.setHours(0, 0, 0, 0);
          break;
        case "month":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
          break;
        case "quarter":
          const currentQuarter = Math.floor(now.getMonth() / 3);
          startDate = new Date(now.getFullYear(), currentQuarter * 3, 1, 0, 0, 0, 0);
          break;
        case "year":
          startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      }
    }

    return { startDate, endDate };
  };


  const fetchMyPoints = async () => {
    // Clears the page-level spinner, which fetchLeaderboardData used to own
    // before rankings moved to the gam_rankings RPC.
    if (!userProfile?.id) { setLoading(false); return; }
    setLoading(true);

    const now = new Date();
    
    // Calculate time ranges
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const startOfQuarter = new Date(now.getFullYear(), currentQuarter * 3, 1, 0, 0, 0, 0);
    const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);

    // Fetch earned points
    const { data } = await supabase
      .from("gamification_points")
      .select("points, earned_at")
      .eq("user_id", userProfile.id)
      .order("earned_at", { ascending: false });

    // What has been committed to requests that have not settled, for display.
    const { data: redemptionsData } = await supabase
      .from("gamification_redemptions")
      .select("points_redeemed, status")
      .eq("user_id", userProfile.id)
      .in("status", ["approved", "pending"]);

    const totalRedeemedPoints = redemptionsData?.reduce((sum, r) => sum + (r.points_redeemed || 0), 0) || 0;
    setTotalRedeemed(totalRedeemedPoints);

    // Points that have actually been paid out, which is a different number from
    // the one above: a request can be approved for weeks before the money goes.
    const { data: paidData } = await supabase
      .from("gamification_redemptions")
      .select("points_redeemed")
      .eq("user_id", userProfile.id)
      .eq("status", "paid");
    setTotalPaidOut(paidData?.reduce((sum, r) => sum + (r.points_redeemed || 0), 0) || 0);

    if (data) {
      const points: MyPoints = { today: 0, week: 0, month: 0, quarter: 0, year: 0, total: 0 };
      data.forEach(item => {
        const earnedDate = new Date(item.earned_at);
        const pointsValue = Number(item.points) || 0;
        
        points.total += pointsValue;
        if (earnedDate >= startOfToday) points.today += pointsValue;
        if (earnedDate >= startOfWeek) points.week += pointsValue;
        if (earnedDate >= startOfMonth) points.month += pointsValue;
        if (earnedDate >= startOfQuarter) points.quarter += pointsValue;
        if (earnedDate >= startOfYear) points.year += pointsValue;
      });
      
      // The server's definition, not a second one computed here.
      //
      // This used to be sum(every points row, any status, any expiry) minus
      // open requests. That agreed with the server only while nothing had ever
      // been burned: once a payment flips rows to 'redeemed' the browser keeps
      // counting them, and the paid request drops out of the subtraction, so
      // the screen would offer points that no longer exist.
      const { data: available } = await rpc<number>("gam_available_to_redeem", {
        p_user: userProfile.id,
      });
      setAvailableToRedeem(Math.max(0, Number(available ?? 0)));
      
      // Keep points.total as lifetime earned (do NOT subtract redemptions)
      setMyPoints(points);
    }
    setLoading(false);
  };

  const fetchRedemptions = async () => {
    if (!userProfile?.id) return;
    // Through the rpc rather than the table: it joins the approver and payer
    // names, which profiles RLS would not hand this rep directly.
    const { data } = await rpc<Redemption[]>("gam_my_redemptions");
    setRedemptions(
      (data ?? []).map((r) => ({
        ...r,
        points_redeemed: Number(r.points_redeemed || 0),
        voucher_amount: Number(r.voucher_amount || 0),
      })),
    );
  };

  /**
   * The rep's active games, with THEIR OWN names and every enabled activity —
   * this used to take only the first activity via .limit(1) and print that
   * activity's name where the game's name belongs, so "Order momentum" showed
   * up as "Every cash order" and its second activity was invisible.
   *
   * Points are counted for the selected period as well as all time, because the
   * page header states a period and the cards previously ignored it — the hero
   * could read "Points (today) 0" beside a card claiming 510 earned.
   *
   * There is no honest completion figure to show: baseline_target is 0 on every
   * game, and the old bar divided by `first activity's points × 100`, a number
   * with no meaning. It is gone rather than dressed up.
   */
  const fetchGames = async () => {
    if (!userProfile?.id) return;

    const { data: gamesData } = await supabase
      .from("gamification_games")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (!gamesData?.length) {
      setGames([]);
      return;
    }

    const gameIds = gamesData.map((g) => g.id);

    const { startDate: winStart, endDate: winEnd } = getDateRange();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    // One round trip for the whole grid rather than a handful per card.
    const [
      { data: actionsData },
      { data: pointsData },
      { data: targetRow },
      { count: productiveToday },
    ] = await Promise.all([
      supabase
        .from("gamification_actions")
        .select("id, game_id, action_name, points, is_tiered, action_type, trigger_type, cap_scope, cap_value, base_daily_target")
        .in("game_id", gameIds)
        .eq("is_enabled", true)
        .order("points", { ascending: false }),
      supabase
        .from("gamification_points")
        .select("game_id, action_id, points, earned_at")
        .eq("user_id", userProfile.id)
        .in("game_id", gameIds),
      supabase
        .from("user_period_targets")
        .select("target_value, actual_value, achievement_percent")
        .eq("user_id", userProfile.id)
        .gte("period_start", dayKey(monthStart))
        .lte("period_start", dayKey(now))
        .maybeSingle(),
      // the visit tiers count productive visits for TODAY, not the filter window
      supabase
        .from("visits")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userProfile.id)
        .eq("planned_date", dayKey(now))
        .eq("status", "productive"),
    ]);

    const actionIds = (actionsData ?? []).map((a: any) => a.id);
    const { data: tierRows } = actionIds.length
      ? await supabase
          .from("activity_tiers")
          .select("action_id, threshold_pct, points")
          .in("action_id", actionIds)
      : { data: [] as any[] };

    const tiersByAction = new Map<string, ActivityTier[]>();
    (tierRows ?? []).forEach((t: any) => {
      const list = tiersByAction.get(t.action_id) ?? [];
      list.push({ threshold_pct: Number(t.threshold_pct), points: Number(t.points) });
      tiersByAction.set(t.action_id, list);
    });


    const fromMs = winStart.getTime();
    const toMs = winEnd.getTime();
    const todayKeyStr = dayKey(now);
    const monthMs = monthStart.getTime();

    /** Awards (rows), not points — the caps and the leader race both count events. */
    const countsByAction = new Map<string, { today: number; month: number; period: number }>();
    const earned = new Map<string, { period: number; total: number }>();
    const earnedByAction = new Map<string, { period: number; total: number }>();
    (pointsData ?? []).forEach((p: any) => {
      const value = Number(p.points || 0);
      const inWindow = (() => {
        const at = new Date(p.earned_at).getTime();
        return at >= fromMs && at <= toMs;
      })();
      const bump = (m: Map<string, { period: number; total: number }>, key: string | null) => {
        if (!key) return;
        const cur = m.get(key) ?? { period: 0, total: 0 };
        cur.total += value;
        if (inWindow) cur.period += value;
        m.set(key, cur);
      };
      bump(earned, p.game_id);
      bump(earnedByAction, p.action_id);

      if (p.action_id) {
        const at = new Date(p.earned_at);
        const c = countsByAction.get(p.action_id) ?? { today: 0, month: 0, period: 0 };
        if (dayKey(at) === todayKeyStr) c.today += 1;
        if (at.getTime() >= monthMs) c.month += 1;
        if (inWindow) c.period += 1;
        countsByAction.set(p.action_id, c);
      }
    });

    setProgressInputs({
      productiveToday: productiveToday ?? 0,
      targetValue: targetRow?.target_value != null ? Number(targetRow.target_value) : null,
      actualValue: targetRow?.actual_value != null ? Number(targetRow.actual_value) : null,
      achievementPct: targetRow?.achievement_percent != null ? Number(targetRow.achievement_percent) : null,
    });

    const byGame = new Map<string, GameActivity[]>();
    (actionsData ?? []).forEach((a: any) => {
      const type = String(a.trigger_type || a.action_type || "");
      const c = countsByAction.get(a.id) ?? { today: 0, month: 0, period: 0 };
      const list = byGame.get(a.game_id) ?? [];
      list.push({
        id: a.id,
        name: a.action_name,
        points: Number(a.points || 0),
        tiered: !!a.is_tiered,
        period_points: 0,
        total_points: 0,
        action_type: type,
        cap_scope: a.cap_scope ?? null,
        cap_value: a.cap_value ?? null,
        base_daily_target: a.base_daily_target ?? null,
        tiers: tiersByAction.get(a.id) ?? [],
        counts: c,
      });
      byGame.set(a.game_id, list);
    });

    // "Active" has to mean "can pay out right now", which is what the award
    // engine itself requires: is_active AND today inside the game's dates AND at
    // least one enabled activity. is_active alone counted games whose window had
    // closed months ago, and games with nothing switched on that could never
    // award anything — both rendered as live cards a rep could not earn from.
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate()
    ).padStart(2, "0")}`;

    setGames(
      gamesData
        .filter(
          (game: any) =>
            (!game.start_date || game.start_date <= todayKey) &&
            (!game.end_date || game.end_date >= todayKey) &&
            (byGame.get(game.id)?.length ?? 0) > 0
        )
        .map((game: any) => ({
          ...game,
          activities: (byGame.get(game.id) ?? []).map((a) => ({
            ...a,
            period_points: earnedByAction.get(a.id)?.period ?? 0,
            total_points: earnedByAction.get(a.id)?.total ?? 0,
          })),
          period_points: earned.get(game.id)?.period ?? 0,
          total_points: earned.get(game.id)?.total ?? 0,
          // Global rate: gamification_games has no per-game conversion column.
          rupee_rate: conversionRate,
        }))
    );
  };

  const fetchPointsBreakdown = async () => {
    if (!userProfile?.id) return;

    const { startDate, endDate } = getDateRange();

    const { data } = await supabase
      .from("gamification_points")
      .select("action_id, points, gamification_actions(action_name)")
      .eq("user_id", userProfile.id)
      .gte("earned_at", startDate.toISOString())
      .lte("earned_at", endDate.toISOString());

    if (data) {
      const breakdown = new Map<string, { points: number; count: number }>();
      
      data.forEach((item: any) => {
        const activityName = item.gamification_actions?.action_name || "Unknown";
        const current = breakdown.get(activityName) || { points: 0, count: 0 };
        breakdown.set(activityName, {
          points: current.points + item.points,
          count: current.count + 1
        });
      });

      const breakdownArray: PointsBreakdown[] = Array.from(breakdown.entries())
        .map(([activity_name, data]) => ({
          activity_name,
          points: data.points,
          count: data.count
        }))
        .sort((a, b) => b.points - a.points);

      setPointsBreakdown(breakdownArray);
    }
  };

  const requestRedemption = async () => {
    if (!userProfile?.id) return;
    const points = parseFloat(redeemPoints);
    if (isNaN(points) || points <= 0) {
      toast.error("Please enter valid points");
      return;
    }

    // A courtesy check only. The amount, the minimum, the multiple, the cap and
    // the cooldown are all enforced inside gam_redeem_request, because this
    // check runs in a browser: the old flow inserted straight into the table,
    // so the balance was never verified anywhere a caller could not edit.
    if (points > availableToRedeem) {
      toast.error("Insufficient points");
      return;
    }

    // Re-read the rate at submit time rather than trusting the cached one:
    // voucher_amount is persisted, so a stale rate writes a wrong liability
    // that nothing downstream recomputes.
    const { data: freshSettings } = await refetchGamSettings();
    const rate = Number(freshSettings?.point_conversion) || conversionRate;

    // gam_redeem_request is the ONLY way points leave a balance. It applies the
    // admin's policy (minimum, multiples, ceiling, cooldown), locks the points
    // against this request so they can't be claimed twice, writes the
    // redemption row and raises the approval request. The old path inserted
    // straight into gamification_redemptions with a minimum hardcoded here,
    // which left the points spendable while the request sat pending.
    const { error } = await supabase.rpc("gam_redeem_request", {
      p_user_id: userProfile.id,
      p_points: points,
      p_note: null,
    });

    if (error) {
      // The database raises the policy message itself, so the rep is told which
      // rule stopped them instead of a generic failure.
      toast.error(error.message || "Failed to submit redemption request");
    } else {
      toast.success("Redemption request submitted successfully");
      setShowRedeemDialog(false);
      setRedeemPoints("");
      setCelebration({
        title: "REWARD UNLOCKED",
        subtitle: `${points.toLocaleString()} pts on their way — ₹${(points * rate).toLocaleString()} voucher requested.`,
      });
      fetchRedemptions();
      fetchMyPoints();
    }

  };

  const getDisplayPoints = () => {
    switch (timeFilter) {
      case "today": return myPoints.today;
      case "week": return myPoints.week;
      case "month": return myPoints.month;
      case "quarter": return myPoints.quarter;
      case "year": return myPoints.year;
      default: return myPoints.total;
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      // Approved is deliberately NOT green: the money has not moved yet, and
      // the chip reading like a completed payment was the whole confusion.
      case "approved":
        return <Badge className="bg-blue-600 hover:bg-blue-600">Approved</Badge>;
      case "paid":
        return <Badge className="bg-green-600 hover:bg-green-600">Sent</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>;
      case "cancelled":
        return <Badge variant="outline">Withdrawn</Badge>;
      default:
        return <Badge variant="secondary">Waiting</Badge>;
    }
  };

  const withdrawRedemption = async (id: string) => {
    const { error } = await rpc<null>("gam_cancel_redemption", { p_id: id });
    if (error) {
      toast.error(error.message || "Could not withdraw the request");
      return;
    }
    toast.success("Request withdrawn — your points are available again");
    fetchRedemptions();
    fetchMyPoints();
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-3 sm:p-5 space-y-3 sm:space-y-4">
        {/* ===== HERO BAND (matches Gamification admin hero) ===== */}
        <div
          className="relative overflow-hidden rounded-[20px] px-4 sm:px-7 py-3.5 sm:py-5 bg-gradient-primary text-primary-foreground"
        >
          <div
            className="pointer-events-none absolute -top-[90px] -left-[60px] w-[240px] h-[240px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(255,255,255,.16) 0%, rgba(255,255,255,0) 70%)" }}
          />
          <div
            className="pointer-events-none absolute -bottom-[120px] right-[26%] w-[300px] h-[300px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(212,160,80,.35) 0%, rgba(212,160,80,0) 70%)" }}
          />
          <Sparkles className="pointer-events-none absolute h-3.5 w-3.5 text-primary-foreground/75 animate-pulse" style={{ left: "48%", top: "16%" }} />
          <Star className="pointer-events-none absolute h-3 w-3 text-amber-300/70 animate-pulse" style={{ left: "60%", top: "72%" }} />

          <div className="relative grid grid-cols-[minmax(0,1fr)_44%] items-start gap-x-2.5 gap-y-2.5 sm:flex sm:flex-col sm:items-stretch sm:justify-center sm:gap-0 sm:min-h-[160px] sm:pr-[200px] xl:min-h-[190px] xl:pr-[240px]">
            <div className="col-start-1 row-start-1 min-w-0">

              <h1
                className="font-pixel text-[17px] sm:text-[21px] xl:text-[24px] leading-none text-primary-foreground"
                style={{ textShadow: "2px 2px 0 rgba(0,0,0,.35)" }}
              >
                LEADERBOARD
              </h1>
              <p className="text-[11px] sm:text-[11.5px] xl:text-[12.5px] mt-1.5 sm:mt-2 max-w-[560px] leading-snug text-primary-foreground/75">
                Track your performance, earn points and redeem rewards.
              </p>
            </div>

            {/* Trophy: spans the title and chip rows. On a phone it STRETCHES to that
                row pair instead of staying square — the slot is far taller than it is
                wide, so a square left ~85px of dead space split above and below the cup.
                Widening the column does not help: the chips narrow, their labels wrap to
                more lines, and the slot grows just as fast. Desktop is unchanged: sm:
                restores the square and positions it absolutely against min-h-[160px]. */}
            <TrophyStage
              fill
              className="col-start-2 row-start-1 row-span-2 self-stretch h-full w-full sm:absolute sm:right-0 sm:top-1/2 sm:-translate-y-1/2 sm:h-auto sm:w-[160px] sm:aspect-square xl:w-[180px]"
            />

            {/* glass stat chips — full-width stacked rows on a phone, so each one
                keeps its icon and its full sentence instead of a single word. */}
            <div className="col-start-1 row-start-2 grid grid-cols-1 gap-1.5 sm:mt-3 sm:flex sm:flex-wrap sm:gap-2 xl:grid xl:grid-cols-3 xl:gap-2.5 xl:max-w-[1040px]">
                {[
                  {
                    key: "rank" as const,
                    icon: TrendingUp,
                    bg: "#14b8a6",
                    value: myRank ? `#${myRank}` : "—",
                    // "of 0 participants" is technically true when nobody has
                    // earned yet, and tells the reader nothing. Say what happened.
                    label: leaderboard.length
                      ? `of ${leaderboard.length} earning ${PERIOD_LABEL[timeFilter] ?? "this period"}`
                      : `nobody earned ${PERIOD_LABEL[timeFilter] ?? "this period"}`,
                  },
                  {
                    key: "games" as const,
                    icon: Target,
                    bg: "#3b82f6",
                    value: activeCount,
                    label: activeCount === 1 ? "Active game" : "Active games",
                  },
                  {
                    key: "points" as const,
                    icon: Star,
                    bg: "#f59e0b",
                    value: getDisplayPoints().toLocaleString(),
                    label: `Points ${PERIOD_LABEL[timeFilter] ?? "this period"}`,
                  },
                ].map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setHeroDrill(s.key)}
                    aria-haspopup="dialog"
                    className="group flex flex-row items-center gap-2 sm:gap-2.5 rounded-[12px] px-2.5 sm:px-3 py-2 min-h-[50px] sm:min-h-0 bg-white/10 backdrop-blur-md min-w-0 w-full sm:w-auto xl:w-full text-left transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                    style={{ border: "1px solid rgba(255,255,255,.16)" }}
                  >
                    <div className="flex w-[26px] h-[26px] sm:w-[22px] sm:h-[22px] rounded-[7px] items-center justify-center text-white shrink-0" style={{ background: s.bg }}>
                      <s.icon className="h-[15px] w-[15px] sm:h-[13px] sm:w-[13px]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[15px] sm:text-[14px] font-extrabold leading-none text-primary-foreground">{s.value}</div>
                      <div className="text-[10px] sm:text-[9px] mt-0.5 sm:mt-1 leading-tight text-primary-foreground/75 line-clamp-2 sm:line-clamp-none sm:truncate">{s.label}</div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 ml-auto shrink-0 text-primary-foreground/45 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
            </div>

            <div className="contents sm:flex sm:items-center sm:gap-2 sm:mt-3">
            {/* Game Config and Badges duplicated what the tabs below already show;
                Policy is the only one that goes somewhere new. */}
            {/* Same anatomy as the stat chips above — icon tile, headline, caption,
                chevron — so the row reads as one family rather than one chip and
                one odd small button. */}
            <button
              onClick={() => navigate("/game-policy")}
              className="group col-start-1 row-start-3 flex flex-row items-center gap-2 sm:gap-2.5 rounded-[12px] px-2.5 sm:px-3 py-2 min-h-[50px] sm:min-h-0 bg-white/10 backdrop-blur-md min-w-0 w-full sm:w-auto text-left transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              style={{ border: "1px solid rgba(255,255,255,.16)" }}
            >
              <div className="flex w-[26px] h-[26px] sm:w-[22px] sm:h-[22px] rounded-[7px] items-center justify-center text-white shrink-0" style={{ background: "#6366f1" }}>
                <Info className="h-[15px] w-[15px] sm:h-[13px] sm:w-[13px]" />
              </div>
              <div className="min-w-0">
                <div className="text-[15px] sm:text-[14px] font-extrabold leading-none text-primary-foreground">Policy</div>
                <div className="text-[10px] sm:text-[9px] mt-0.5 sm:mt-1 leading-tight text-primary-foreground/75 line-clamp-2 sm:line-clamp-none sm:truncate">
                  How you earn points
                </div>
              </div>
              <ChevronRight className="h-3.5 w-3.5 ml-auto shrink-0 text-primary-foreground/45 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" />
            </button>

            {/* Period selector — sits under the trophy on a phone, under Policy
                on a desktop where the trophy is out of flow. Its height and
                radius track the Policy chip beside it, so the two boxes on this
                row are the same box rather than two different ones. */}
            <LeaderboardTimeFilters
              timeFilter={timeFilter}
              onFilterChange={(v: any) => setTimeFilter(v)}
              customStartDate={customStartDate}
              customEndDate={customEndDate}
              onCustomStartDateChange={setCustomStartDate}
              onCustomEndDateChange={setCustomEndDate}
              triggerClassName="h-[50px] sm:h-10 rounded-[12px] bg-white/10 hover:bg-white/20 border-white/[0.16] text-primary-foreground backdrop-blur-md focus:ring-white/70"
              className={`self-start sm:w-auto ${
                timeFilter === "custom"
                  ? "col-start-1 col-span-2 row-start-4"
                  : "col-start-2 row-start-3"
              }`}
            />
            </div>
          </div>


        </div>

        {/* ===== POINTS WALLET — the main highlight ===== */}
        <Card className="overflow-hidden border-0 ring-1 ring-amber-400/50 shadow-[0_22px_50px_-26px_rgba(200,145,45,.6)]">
          <div className="flex flex-col lg:flex-row">
            {/* Available — hero segment */}
            <div className="relative flex-1 p-4 sm:p-6 bg-gradient-to-br from-amber-100 via-amber-50 to-amber-100/70 dark:from-amber-500/15 dark:via-amber-500/10 dark:to-amber-500/20">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">Available points</span>
              </div>
              <div className="mt-1.5 sm:mt-2 flex items-end gap-2 flex-wrap">
                <span className="text-3xl sm:text-5xl font-extrabold leading-none tabular-nums">
                  {availableToRedeem.toLocaleString()}
                </span>
                <span className="text-[11px] pb-0.5 text-muted-foreground">pts</span>
                {/* on a phone the value rides along instead of taking its own line */}
                <span className="sm:hidden text-[11px] pb-0.5 text-muted-foreground">
                  ≈ ₹{(availableToRedeem * conversionRate).toLocaleString()}
                </span>
              </div>
              <p className="hidden sm:block text-[11px] mt-2 text-muted-foreground">
                ≈ ₹{(availableToRedeem * conversionRate).toLocaleString()} redeemable value
              </p>
                </div>
                {tabVisible("redemptions") && (
                  <Button
                    size="sm"
                    className="shrink-0 bg-[#1c2440] text-amber-300 hover:bg-[#2b3a6b] font-bold text-xs shadow-md"
                    onClick={() => setShowRedeemDialog(true)}
                  >
                    <Gift className="h-3.5 w-3.5 mr-1.5" /> Redeem Now
                  </Button>
                )}
              </div>
            </div>

            {/* Earned / Redeemed breakdown */}
            <div className="flex-1 grid grid-cols-2 divide-x bg-card">
              <div className="p-4 sm:p-6">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Earned till date
                  </span>
                </div>
                <p className="text-2xl sm:text-4xl font-extrabold mt-1.5 sm:mt-2 tabular-nums text-foreground">
                  {myPoints.total.toLocaleString()}
                </p>
                <p className="hidden sm:block text-[11px] mt-2 text-muted-foreground">Lifetime points earned</p>
                <div className="hidden sm:block mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-amber-500"
                    style={{ width: `${myPoints.total ? Math.min(100, (availableToRedeem / myPoints.total) * 100) : 0}%` }}
                  />
                </div>
                <p className="text-[10px] mt-1 sm:mt-1.5 text-muted-foreground">
                  {myPoints.total ? Math.round((availableToRedeem / myPoints.total) * 100) : 0}% still available
                </p>
              </div>

              <div className="p-4 sm:p-6">
                <div className="flex items-center gap-2">
                  <Medal className="h-4 w-4 text-violet-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Redeemed points
                  </span>
                </div>
                {/* Points that have actually been sent. It used to count
                    approved and pending requests, which meant "redeemed" could
                    read in the thousands while nothing had been paid at all. */}
                <p className="text-2xl sm:text-4xl font-extrabold mt-1.5 sm:mt-2 tabular-nums text-foreground">
                  {totalPaidOut.toLocaleString()}
                </p>
                <p className="hidden sm:block text-[11px] mt-2 text-muted-foreground">
                  {totalRedeemed > 0
                    ? `${totalRedeemed.toLocaleString()} more awaiting payment`
                    : "Rewards already sent to you"}
                </p>
                <div className="hidden sm:block mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-violet-500"
                    style={{ width: `${myPoints.total ? Math.min(100, (totalPaidOut / myPoints.total) * 100) : 0}%` }}
                  />
                </div>
                <p className="text-[10px] mt-1 sm:mt-1.5 text-muted-foreground">
                  {redemptions.length} redemption{redemptions.length === 1 ? "" : "s"} so far
                </p>
              </div>
            </div>
          </div>
        </Card>

        <div className="relative z-10">


          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
            <TabsList
              className={`grid w-full h-auto p-1.5 rounded-[16px] bg-white shadow-[0_14px_34px_-26px_rgba(28,36,64,.55)] border ${
                visibleTabs.length === 1 ? "grid-cols-1"
                : visibleTabs.length === 2 ? "grid-cols-2"
                : visibleTabs.length === 3 ? "grid-cols-3"
                : "grid-cols-2 sm:grid-cols-4"
              }`}
            >
              {visibleTabs.map((t) => {
                const Icon = TAB_ICONS[t.value];
                return (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className="rounded-[12px] py-2 text-[11.5px] sm:text-[12.5px] font-semibold data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:bg-primary"
                  >
                    <Icon className="mr-1.5 h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{t.long}</span>
                    <span className="sm:hidden">{t.short}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* ================= RANKINGS ================= */}
            {tabVisible("leaderboard") && <TabsContent value="leaderboard" className="space-y-4">
              {!rankingsLoading && !myRanking && (
                <div className="rounded-[14px] border border-dashed px-5 py-4">
                  <p className="text-[13.5px] font-semibold">You are not ranked {PERIOD_LABEL[timeFilter] ?? "this period"}</p>
                  <p className="text-[12.5px] text-muted-foreground mt-0.5">
                    No points in this window, so you do not appear below. Widen the range above to find yourself.
                  </p>
                </div>
              )}

              {/* LEADERBOARD — one list, not a podium plus a remainder */}
              <Card className="border-0 shadow-[0_18px_40px_-28px_rgba(28,36,64,.5)]">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-baseline gap-2 mb-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Leaderboard</p>
                    {rankings.length > 0 && (
                      <span className="text-[11px] text-muted-foreground ml-auto tabular-nums">
                        {rankings.reduce((s, r) => s + r.points, 0).toLocaleString()} issued
                      </span>
                    )}
                  </div>

                  <div className="mb-3.5 pb-3.5 border-b">
                    <RankScopeFilter
                      scope={rankScope}
                      onScopeChange={setRankScope}
                      selected={rankPeople}
                      onSelectedChange={setRankPeople}
                    />
                  </div>

                  {rankingsLoading ? (
                    <div className="py-10 flex justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : rankings.length === 0 ? (
                    <div className="py-10 text-center">
                      <Trophy className="h-7 w-7 mx-auto text-muted-foreground/40" />
                      <p className="text-[14px] font-semibold mt-3">
                        {rankScope === "selected" && rankPeople.length === 0
                          ? "Pick somebody to compare against"
                          : `Nobody earned points ${PERIOD_LABEL[timeFilter] ?? "this period"}`}
                      </p>
                      <p className="text-[12.5px] text-muted-foreground mt-1 max-w-[42ch] mx-auto">
                        {rankScope === "selected" && rankPeople.length === 0
                          ? "Choose people above and their standings appear here."
                          : rankScope === "mine"
                          ? "Nobody reporting to you has earned yet. Try My hierarchy, or a wider range above."
                          : "Rankings appear as soon as points are issued. Try a wider range above."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {iAmBelowTheFold && (
                        <>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            Your position
                          </p>
                          {rankRow(myBoardRow!)}
                          <div className="flex items-center gap-2 pt-1 pb-0.5">
                            <span className="h-px flex-1 bg-border" />
                            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Top {TOP_RANKS}</span>
                            <span className="h-px flex-1 bg-border" />
                          </div>
                        </>
                      )}

                      {shownRankings.map(rankRow)}

                      {rankings.length > TOP_RANKS && (
                        <button
                          onClick={() => setShowAllRanks((v) => !v)}
                          className="w-full mt-1 rounded-[12px] border border-dashed py-2 text-[12px] font-semibold text-muted-foreground hover:bg-muted transition-colors"
                        >
                          {showAllRanks
                            ? `Show top ${TOP_RANKS} only`
                            : `View all ${rankings.length} on this board`}
                        </button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>}

            {/* ================= MY GAMES ================= */}
            {tabVisible("games") && <TabsContent value="games" className="space-y-4">
              {/* A rep scores from an ACTIVITY, not from the container it sits in.
                  Staging's 6 games hold 8 activities, and 8 is what "my games"
                  means to the person reading it — so list those. */}
              {activeActivities.length === 0 ? (
                <Card className="border-0 shadow-[0_18px_40px_-28px_rgba(28,36,64,.5)]">
                  <CardContent className="p-10 text-center">
                    <TrophyMark float className="w-[92px] h-auto mx-auto opacity-80" />
                    <p className="mt-3 font-semibold">Nothing is running right now</p>
                    <p className="text-[12px] text-muted-foreground mt-1">
                      An activity shows up here once its game is switched on, today falls
                      inside the game's dates, and the activity itself is enabled.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {activeActivities.map((a) => {
                    // Several games name their only activity after themselves;
                    // repeating it as an eyebrow would just read as a stutter.
                    const sameName = a.gameName.trim().toLowerCase() === a.name.trim().toLowerCase();
                    const pr = a.progress;
                    const st = progressStatus(pr);
                    const deadline = deadlineLabel(pr, a.game.end_date);
                    return (
                      <Card
                        key={a.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/game/${a.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/game/${a.id}`); }
                        }}
                        className="border-0 overflow-hidden shadow-[0_18px_40px_-28px_rgba(28,36,64,.5)] transition-transform hover:-translate-y-0.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <div
                          className="relative px-5 py-4 border-b"
                          style={{ background: "linear-gradient(120deg,hsl(var(--secondary)) 0%,hsl(var(--card)) 55%,hsl(var(--accent)) 100%)" }}
                        >
                          {/* Amber, not the old violet: the card's own numbers are
                              amber, so a purple wash behind them belonged to no
                              other element on the page. Alpha is nudged .08 -> .12
                              only because this hue is far lighter than the violet
                              was — it lands at the same faintness, not darker. */}
                          <div
                            className="pointer-events-none absolute -top-12 -right-8 w-32 h-32 rounded-full"
                            style={{ background: "radial-gradient(circle, rgba(245,158,11,.12) 0%, transparent 70%)" }}
                          />
                          <div className="relative flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground truncate">
                                {sameName ? "Game" : a.gameName}
                              </p>
                              <p className="font-bold text-[14px] mt-1 truncate">{a.name}</p>
                              {/* the per-event value has its own tile now, so this
                                  line says how the activity works instead */}
                              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                                {pr.kind === "target" ? "Tiers pay as you clear your monthly quantity target."
                                  : pr.kind === "daily" ? `Tiers pay on productive visits — ${pr.goal} a day is full marks.`
                                  : pr.kind === "cap" ? `Up to ${pr.goal} ${pr.unit} ${pr.window === "today" ? "a day" : "a month"}.`
                                  : pr.kind === "leader" ? `${a.points.toLocaleString()} pts every time — no ceiling.`
                                  : `Pays ${a.points.toLocaleString()} ${a.points === 1 ? "point" : "points"} each time.`}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Badge
                                className={`text-[10px] ${
                                  st.tone === "done" ? "bg-emerald-400 text-[#1c2440] hover:bg-emerald-400"
                                  : st.tone === "going" ? "bg-amber-400 text-[#1c2440] hover:bg-amber-400"
                                  : "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-500/15 dark:text-red-300"
                                }`}
                              >
                                {st.label}
                              </Badge>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        </div>

                        <CardContent className="p-5 space-y-3.5">
                          {/* What a rep actually wants first: what they have made. */}
                          <div className="flex items-end justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-3xl font-extrabold tabular-nums leading-none text-amber-600">
                                {a.period_points.toLocaleString()}
                                <span className="text-[13px] font-bold text-muted-foreground"> pts</span>
                              </p>
                              <p className="text-[10.5px] text-muted-foreground mt-1">
                                earned {PERIOD_LABEL[timeFilter] ?? "this period"}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-2xl font-extrabold tabular-nums leading-none">
                                ₹{(a.period_points * a.game.rupee_rate).toLocaleString(undefined, {
                                  minimumFractionDigits: 0, maximumFractionDigits: 0,
                                })}
                              </p>
                              <p className="text-[10.5px] text-muted-foreground mt-1">
                                {a.total_points.toLocaleString()} pts all time
                              </p>
                            </div>
                          </div>

                          {/* Then where they stand, and the one move that changes it. */}
                          {pr.kind !== "none" && (
                            <div>
                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="font-semibold">
                                  {pr.myRank ? `#${pr.myRank} of ${pr.fieldSize}` : `${pr.current.toLocaleString()} / ${pr.goal.toLocaleString()} ${pr.unit}`}
                                </span>
                                <span className="text-muted-foreground tabular-nums">{pr.pct}%</span>
                              </div>
                              <div className="mt-1.5 h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-[width] ${
                                    st.tone === "done" ? "bg-emerald-500"
                                    : st.tone === "going" ? "bg-amber-500"
                                    : "bg-muted-foreground/30"
                                  }`}
                                  style={{ width: `${pr.pct}%` }}
                                />
                              </div>
                            </div>
                          )}

                          <p className="text-[12px] leading-snug rounded-[10px] px-3 py-2 bg-primary/5 text-foreground">
                            {pr.overtakeLabel
                              ?? (pr.kind === "none"
                                ? pr.remainingLabel
                                : `${pr.remainingLabel}${pr.nextTierLabel ? ` — ${pr.nextTierLabel}` : "."}`)}
                          </p>

                          {/* Good to have, not the point of the card. */}
                          <div className="flex items-center justify-between gap-3 pt-0.5 border-t text-[10.5px] text-muted-foreground">
                            <span className="truncate">
                              {/* what one event pays is the thing a rep asks first,
                                  so it carries weight even down here */}
                              <span className="font-bold text-amber-600">
                                {a.tiered ? "Paid by tier" : `${a.points} pts`}
                              </span>
                              {a.tiered ? "" : ` per ${pr.unit.replace(/s$/, "")}`}
                              {" · "}{deadline}
                            </span>
                            <span className="inline-flex items-center gap-1 font-semibold text-foreground shrink-0">
                              View details <ChevronRight className="h-3.5 w-3.5" />
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>}

            {/* ================= BADGES ================= */}
            {tabVisible("badges") && <TabsContent value="badges">
              <Card className="border-0 overflow-hidden shadow-[0_18px_40px_-28px_rgba(28,36,64,.5)]">
                <div
                  className="px-5 py-4 border-b flex items-center justify-between gap-4"
                  style={{ background: "linear-gradient(120deg,hsl(var(--secondary)) 0%,hsl(var(--card)) 55%,hsl(var(--accent)) 100%)" }}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Medal className="h-4 w-4 text-amber-500" />
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">My badges</span>
                    </div>
                    <p className="text-[12px] mt-1 text-muted-foreground">Achievements and milestones you have unlocked</p>
                  </div>
                  <TrophyMark float className="w-[58px] h-auto hidden sm:block" />
                </div>
                <CardContent className="p-4 sm:p-5">
                  <BadgesDisplay />
                </CardContent>
              </Card>
            </TabsContent>}

            {/* ================= REDEMPTIONS ================= */}
            {tabVisible("redemptions") && <TabsContent value="redemptions" className="space-y-4">
              {/* Approving is a job function, not a rewards feature, so it sits
                  above the rep's own requests and does not depend on the tab's
                  display flag. Shown only to people who actually have somebody's
                  request to action — the rpc decides, not a client-side role. */}
              {hasRedemptionQueue && (
                <Card className="border-0 shadow-[0_18px_40px_-28px_rgba(28,36,64,.5)]">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Team requests
                      </span>
                    </div>
                    <RedemptionQueue variant="embedded" />
                  </CardContent>
                </Card>
              )}

              {hasRedemptionQueue && (
                <div className="flex items-center gap-2 pt-1">
                  <Gift className="h-4 w-4 text-primary" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    My requests
                  </span>
                </div>
              )}

              {redemptions.length === 0 ? (
                <Card className="border-0 shadow-[0_18px_40px_-28px_rgba(28,36,64,.5)]">
                  <CardContent className="p-10 text-center">
                    <div className="w-14 h-14 rounded-[16px] mx-auto flex items-center justify-center bg-primary/10">
                      <Gift className="h-7 w-7 text-primary" />
                    </div>
                    <p className="mt-3 font-semibold">No redemption requests yet</p>
                    <p className="text-[12px] text-muted-foreground mt-1">
                      Turn your points into vouchers whenever you are ready.
                    </p>
                    <Button
                      className="mt-4 bg-amber-400 text-[#1c2440] hover:bg-amber-300 font-bold"
                      onClick={() => setShowRedeemDialog(true)}
                    >
                      <Gift className="h-4 w-4 mr-1.5" /> Redeem points now
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {redemptions.map((redemption) => (
                    <Card
                      key={redemption.id}
                      className="border-0 overflow-hidden shadow-[0_18px_40px_-28px_rgba(28,36,64,.5)]"
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-[12px] shrink-0 flex items-center justify-center bg-primary/10">
                              <Gift className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-extrabold text-[15px] tabular-nums">
                                {redemption.points_redeemed.toLocaleString()} pts
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                ₹{redemption.voucher_amount.toLocaleString()} ·{" "}
                                {new Date(redemption.requested_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          {getStatusBadge(redemption.status)}
                        </div>

                        <RedemptionTimeline row={redemption} />

                        {redemption.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-1 h-8 text-[11.5px] text-muted-foreground hover:text-foreground"
                            onClick={() => withdrawRedemption(redemption.id)}
                          >
                            Withdraw request
                          </Button>
                        )}

                        {redemption.status === "paid" && redemption.payment_reference && (
                          <div className="mt-4 rounded-[12px] p-3 bg-emerald-500/10 border border-emerald-500/25">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                              Payment reference
                            </p>
                            <p className="text-[15px] font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1 break-all">
                              {redemption.payment_reference}
                            </p>
                          </div>
                        )}
                        {redemption.status === "rejected" && redemption.rejection_reason && (
                          <div className="mt-4 rounded-[12px] p-3 bg-destructive/10 border border-destructive/25">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-destructive">
                              Rejection reason
                            </p>
                            <p className="text-[12.5px] text-destructive mt-1">{redemption.rejection_reason}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>}
          </Tabs>

        </div>
      </div>

      {/* Redeem Points Dialog */}


      {/* Hero chip drill-downs — every figure here is the same state the chips
          read from, so the summary and the detail cannot disagree. */}
      <Dialog open={heroDrill !== null} onOpenChange={(v) => { if (!v) setHeroDrill(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[15px]">
              {heroDrill === "rank"
                ? `Standings ${PERIOD_LABEL[timeFilter] ?? "this period"}`
                : heroDrill === "games"
                ? `${activeCount} ${activeCount === 1 ? "activity" : "activities"} running`
                : `Points ${PERIOD_LABEL[timeFilter] ?? "this period"}`}
            </DialogTitle>
          </DialogHeader>

          <div className="max-h-[56vh] overflow-y-auto -mx-1 px-1">
            {heroDrill === "rank" && (
              !leaderboard.length ? (
                <p className="py-8 text-center text-[12.5px] text-muted-foreground">
                  Nobody has earned points {PERIOD_LABEL[timeFilter] ?? "this period"} yet, so there is
                  nothing to rank. Pick a wider range above to see where you stand.
                </p>
              ) : (
                <>
                  {standingsPinned && (
                    <>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground px-2 pb-1">
                        Your position
                      </p>
                      <ul className="divide-y">{standingsRow(standingsMine!, standingsMineIndex)}</ul>
                      <div className="flex items-center gap-2 py-2 px-2">
                        <span className="h-px flex-1 bg-border" />
                        <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Top {TOP_RANKS}</span>
                        <span className="h-px flex-1 bg-border" />
                      </div>
                    </>
                  )}
                  <ul className="divide-y">
                    {standingsShown.map((l) => standingsRow(l, leaderboard.indexOf(l)))}
                  </ul>
                  {leaderboard.length > TOP_RANKS && (
                    <button
                      onClick={() => setShowAllStandings((v) => !v)}
                      className="w-full mt-2 rounded-[10px] border border-dashed py-2 text-[12px] font-semibold text-muted-foreground hover:bg-muted transition-colors"
                    >
                      {showAllStandings
                        ? `Show top ${TOP_RANKS} only`
                        : `View all ${leaderboard.length}`}
                    </button>
                  )}
                </>
              )
            )}

            {heroDrill === "games" && (
              !activeActivities.length ? (
                <p className="py-8 text-center text-[12.5px] text-muted-foreground">
                  Nothing is running right now.
                </p>
              ) : (
                <ul className="divide-y">
                  {activeActivities.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 py-2.5 px-1">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold truncate">{a.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {a.gameName} · pays {a.tiered ? "tiered points" : `${a.points} pts`}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[13px] font-extrabold tabular-nums">
                          {a.period_points.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {PERIOD_LABEL[timeFilter] ?? "this period"}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )
            )}

            {heroDrill === "points" && (
              !pointsBreakdown.length ? (
                <p className="py-8 text-center text-[12.5px] text-muted-foreground">
                  You have not earned any points {PERIOD_LABEL[timeFilter] ?? "this period"}.
                </p>
              ) : (
                <ul className="divide-y">
                  {pointsBreakdown.map((b) => (
                    <li key={b.activity_name} className="flex items-baseline gap-3 py-2.5 px-1">
                      <span className="text-[13px] truncate flex-1">{b.activity_name}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {b.count}&times;
                      </span>
                      <span className="text-[13px] font-extrabold tabular-nums shrink-0 w-14 text-right">
                        {b.points.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRedeemDialog} onOpenChange={setShowRedeemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redeem Points</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-600 dark:text-blue-400">
                <strong>Available Points:</strong> {myPoints.total}
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                <strong>Conversion Rate:</strong> 1 point = ₹{conversionRate}
              </p>
              <p className="text-sm text-blue-600 dark:text-blue-400">
                <strong>Minimum:</strong> 100 points
              </p>
            </div>
            <div>
              <Label htmlFor="redeemPoints">Points to Redeem</Label>
              <Input
                id="redeemPoints"
                type="number"
                value={redeemPoints}
                onChange={(e) => setRedeemPoints(e.target.value)}
                placeholder="Enter points"
                min="100"
                max={myPoints.total}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Available: {myPoints.total} points
              </p>
            </div>
            {redeemPoints && parseFloat(redeemPoints) >= 100 && (
              <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-600 dark:text-green-400">
                  You will receive: <strong>₹{(parseFloat(redeemPoints) * conversionRate).toFixed(2)}</strong> voucher
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  (Conversion: 1 point = ₹{conversionRate})
                </p>
              </div>
            )}
            <Button onClick={requestRedemption} className="w-full">Submit Request</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Victory celebration */}
      <CelebrationOverlay
        open={!!celebration}
        title={celebration?.title ?? ""}
        subtitle={celebration?.subtitle}
        onDone={() => setCelebration(null)}
      />
    </Layout>

  );
}
