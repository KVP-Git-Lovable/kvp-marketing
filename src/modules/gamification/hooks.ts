import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface GamSettings {
  id: string;
  engine_enabled: boolean;
  currency_name: string;
  point_conversion: number;
  timezone: string;
  /** Doubles as the "Rankings" tab switch on the rep Leaderboard page. */
  leaderboard_enabled: boolean;
  tab_games_enabled: boolean;
  tab_badges_enabled: boolean;
  tab_redemptions_enabled: boolean;
  notifications_enabled: boolean;
  default_award_mode: string;
  approval_fallback: string;

  /** Redemption policy — enforced in gam_redeem_request(), not just shown here. */
  redeem_min_points: number;
  /** null = any amount; otherwise requests must be a whole multiple of this. */
  redeem_multiple_of: number | null;
  redeem_max_per_request: number | null;
  redeem_cooldown_days: number;
  redeem_requires_approval: boolean;

  /** Period close. 'never' means points never lapse. */
  reset_cadence: "never" | "monthly" | "quarterly" | "half_yearly" | "annual" | "financial_year";
  /** expire = balance lapses at period end · carry_forward = balance survives. */
  reset_mode: "expire" | "carry_forward";
  reset_grace_days: number;
  /** Lifetime earned is always kept in history; this only controls the rep's counter. */
  reset_lifetime_visible: boolean;
  /** Last period the close job archived, e.g. '2026-08'. Read-only. */
  last_reset_period: string | null;
}

export const useGamSettings = () =>
  useQuery({
    queryKey: ["gam-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gamification_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as GamSettings | null;
    },
  });

export const useUpdateGamSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<GamSettings> & { id: string }) => {
      const { id, ...rest } = patch;
      const { error } = await supabase.from("gamification_settings").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gam-settings"] });
      toast.success("Global configuration saved");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not save settings"),
  });
};

export const usePrograms = () =>
  useQuery({
    queryKey: ["gam-programs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gamification_games")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const useProgram = (id?: string) =>
  useQuery({
    queryKey: ["gam-program", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gamification_games")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export interface ProgramUsage {
  game_id: string;
  points_rows: number;
  points_total: number;
  redemptions: number;
  activities: number;
}

/** How much history each program carries, counted by the DB with exactly the rule
 *  the delete guard applies — so the admin panel only offers Delete where the
 *  database would actually allow it, instead of guessing and then failing. */
export const useProgramUsage = () =>
  useQuery({
    queryKey: ["gam-program-usage"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("gamification_program_usage" as any);
      if (error) throw error;
      const byGame = new Map<string, ProgramUsage>();
      ((data ?? []) as any[]).forEach((r) =>
        byGame.set(r.game_id, {
          game_id: r.game_id,
          points_rows: Number(r.points_rows || 0),
          points_total: Number(r.points_total || 0),
          redemptions: Number(r.redemptions || 0),
          activities: Number(r.activities || 0),
        })
      );
      return byGame;
    },
  });

/** Activate / deactivate a program. Deactivating is the safe alternative to
 *  deleting: the award engine only ever matches games with is_active = true, so
 *  the program stops paying out immediately while its history stays readable. */
export const useToggleProgram = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      // .select() so an RLS refusal is visible: a blocked update returns no rows
      // and no error, which would otherwise toast "done" over a no-op.
      const { data, error } = await supabase
        .from("gamification_games")
        .update({ is_active })
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (!data?.length) {
        throw new Error("Your profile does not have permission to change this game.");
      }
      return is_active;
    },
    onSuccess: (is_active) => {
      qc.invalidateQueries({ queryKey: ["gam-programs"] });
      qc.invalidateQueries({ queryKey: ["gam-program"] });
      toast.success(is_active ? "Game activated" : "Game deactivated — no new points will be awarded");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not update the game"),
  });
};

/** Hard-delete a program, for the ones created by mistake. The database refuses
 *  this outright once any points exist; the check below is only so the admin gets
 *  a sentence rather than a constraint error, and it fails CLOSED — a check that
 *  could not run means no delete. */
export const useDeleteProgram = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (program: { id: string; name: string }) => {
      // Re-checked at the moment of deletion, not read off the list's cached
      // counts: a rep can earn the program's first point while the page is open.
      const { data: hasHistory, error: checkError } = await supabase.rpc(
        "gamification_program_has_history" as any,
        { p_game_id: program.id }
      );
      if (checkError) {
        throw new Error(
          "Could not confirm this game has no points history, so nothing was deleted."
        );
      }
      if (hasHistory === true) {
        throw new Error(
          `"${program.name}" has already awarded points. Deactivate it instead — deleting would take that history with it.`
        );
      }

      const { data, error } = await supabase
        .from("gamification_games")
        .delete()
        .eq("id", program.id)
        .select("id");
      if (error) throw error;
      if (!data?.length) {
        throw new Error("Your profile does not have permission to delete this game.");
      }
      return program.name;
    },
    onSuccess: (name) => {
      qc.invalidateQueries({ queryKey: ["gam-programs"] });
      qc.invalidateQueries({ queryKey: ["gam-activities"] });
      qc.invalidateQueries({ queryKey: ["gam-program-usage"] });
      toast.success(`Game "${name}" deleted`);
    },
    onError: (e: any) => toast.error(e.message ?? "Could not delete the game"),
  });
};

export interface PointsRollupRow {
  gameId: string | null;
  userId: string | null;
  points: number;
  awards: number;
  lastEarned: string | null;
}

/** Points aggregated per (program, user) for a window — the single source the
 *  Overview derives every figure from, so its totals, its per-game table and
 *  its per-user table can never disagree with each other. One row per pair
 *  instead of one per award keeps it small no matter how long the ledger gets. */
export const usePointsRollup = (from?: string, to?: string) =>
  useQuery({
    queryKey: ["gam-points-rollup", from ?? "", to ?? ""],
    queryFn: async (): Promise<PointsRollupRow[]> => {
      const { data, error } = await supabase.rpc("gamification_points_rollup" as any, {
        p_from: from || null,
        p_to: to || null,
      });
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({
        gameId: r.game_id ?? null,
        userId: r.user_id ?? null,
        points: Number(r.points || 0),
        awards: Number(r.awards || 0),
        lastEarned: r.last_earned ?? null,
      }));
    },
  });

export const useActivities = (programId?: string) =>
  useQuery({
    queryKey: ["gam-activities", programId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("gamification_actions").select("*").order("created_at", { ascending: true });
      if (programId) q = q.eq("game_id", programId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

export const useToggleActivity = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_enabled }: { id: string; is_enabled: boolean }) => {
      const { error } = await supabase
        .from("gamification_actions")
        .update({ is_enabled })
        .eq("id", id);
      if (error) throw error;
      return is_enabled;
    },
    onSuccess: (is_enabled) => {
      // prefix match — clears both the "all" list and any per-program list
      qc.invalidateQueries({ queryKey: ["gam-activities"] });
      toast.success(is_enabled ? "Activity enabled" : "Activity disabled");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not update the activity"),
  });
};

export const useActivityTiers = (actionId?: string) =>
  useQuery({
    queryKey: ["gam-tiers", actionId],
    enabled: !!actionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_tiers")
        .select("*")
        .eq("action_id", actionId!)
        .order("threshold_pct", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

export const usePointsIssuedYtd = () =>
  useQuery({
    queryKey: ["gam-points-ytd"],
    queryFn: async () => {
      const start = new Date(new Date().getFullYear(), 0, 1).toISOString();
      // Paged rather than a flat .limit() — a fixed cap silently plateaus the
      // tile once the year's ledger outgrows it, with no sign anything is wrong.
      const PAGE_SIZE = 1000;
      const MAX_PAGES = 100;
      let total = 0;
      for (let page = 0; page < MAX_PAGES; page++) {
        const from = page * PAGE_SIZE;
        const { data, error } = await supabase
          .from("gamification_points")
          .select("points")
          .gte("earned_at", start)
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        const rows = data ?? [];
        total = rows.reduce((s: number, r: any) => s + Number(r.points || 0), total);
        if (rows.length < PAGE_SIZE) break;
      }
      return total;
    },
  });

/** id → full_name for the ledger. gamification_points.user_id has no FK to profiles,
 *  so the join has to happen client-side. Includes is_active so the ledger's person
 *  filter can default-hide inactive users while still resolving names for every row
 *  (including historical rows earned by since-deactivated reps). */
export const useGamProfiles = () =>
  useQuery({
    queryKey: ["gam-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, is_active");
      if (error) throw error;
      return data ?? [];
    },
  });

/** Everyone currently on the team, named, newest definition of "active" kept in
 *  the database (profile enabled AND not past an exit date) so this list and the
 *  roll-up above can never disagree about who counts.
 *
 *  The overview lists AGAINST this roster rather than against the awards: a rep
 *  who earned nothing has to appear at zero, because "nobody from this branch
 *  scored" is the finding a manager opens the report for, and an absent row
 *  reads as if everyone took part. */
export const useGamActivePeople = () =>
  useQuery({
    queryKey: ["gam-active-people"],
    queryFn: async (): Promise<{ id: string; full_name: string }[]> => {
      const { data, error } = await supabase.rpc("gam_active_people" as any);
      if (error) throw error;
      return (data ?? []) as { id: string; full_name: string }[];
    },
  });

/** Detail rows for the ledger table, newest first. Paged from the UI via `limit`. */
export const usePointsLedger = (limit = 100, from?: string, to?: string) =>
  useQuery({
    queryKey: ["gam-points-ledger", limit, from ?? "", to ?? ""],
    queryFn: async () => {
      // Bounded server-side, not after fetching: filtering a single page of
      // `limit` rows would silently hide awards that fall in range but sit
      // beyond the page.
      let q = supabase
        .from("gamification_points")
        .select(
          "id, points, earned_at, expires_at, status, reference_type, reference_id, retailer_id, user_id, game_id, action_id, gamification_actions(action_name, is_tiered), gamification_games(name, category)"
        )
        .order("earned_at", { ascending: false })
        .limit(limit);
      if (from) q = q.gte("earned_at", `${from}T00:00:00`);
      if (to) q = q.lte("earned_at", `${to}T23:59:59.999`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

/** Totals and per-user balances over the WHOLE ledger — deliberately separate from
 *  usePointsLedger so the headline figures stay correct no matter how few rows the
 *  table has loaded. Paged for the same reason usePointsIssuedYtd is. */
// dateFrom/dateTo, not from/to: the paging loop below already binds `from`.
export const usePointsSummary = (dateFrom?: string, dateTo?: string) =>
  useQuery({
    queryKey: ["gam-points-summary", dateFrom ?? "", dateTo ?? ""],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      const MAX_PAGES = 100;
      const byUser = new Map<string, { points: number; awards: number; last: string | null }>();
      let total = 0;
      let awards = 0;
      let earliest: string | null = null;

      for (let page = 0; page < MAX_PAGES; page++) {
        const from = page * PAGE_SIZE;
        let sq = supabase
          .from("gamification_points")
          .select("points, user_id, earned_at")
          .order("earned_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (dateFrom) sq = sq.gte("earned_at", `${dateFrom}T00:00:00`);
        if (dateTo) sq = sq.lte("earned_at", `${dateTo}T23:59:59.999`);
        const { data, error } = await sq;
        if (error) throw error;
        const rows = data ?? [];
        rows.forEach((r: any) => {
          const p = Number(r.points || 0);
          total += p;
          awards += 1;
          const key = r.user_id ?? "__none__";
          const cur = byUser.get(key) ?? { points: 0, awards: 0, last: null };
          cur.points += p;
          cur.awards += 1;
          if (!cur.last || r.earned_at > cur.last) cur.last = r.earned_at;
          byUser.set(key, cur);
          if (!earliest || r.earned_at < earliest) earliest = r.earned_at;
        });
        if (rows.length < PAGE_SIZE) break;
      }

      return {
        total,
        awards,
        earliest,
        byUser: Array.from(byUser.entries())
          .map(([userId, v]) => ({ userId, ...v }))
          .sort((a, b) => b.points - a.points),
      };
    },
  });

export const useTargetKpis = () =>
  useQuery({
    queryKey: ["gam-target-kpis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("target_kpi_definitions")
        .select("id, kpi_name, is_active, display_order")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("kpi_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

export const useFocusedProductCount = () =>
  useQuery({
    queryKey: ["gam-focused-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("is_focused", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

export interface PointsYtdBreakdown {
  total: number;
  awards: number;
  byMonth: { key: string; label: string; points: number; awards: number }[];
  byProgram: { gameId: string | null; points: number; awards: number }[];
  topUsers: { userId: string | null; points: number; awards: number }[];
}

const bump = <K,>(m: Map<K, { points: number; awards: number }>, k: K, p: number) => {
  const cur = m.get(k) ?? { points: 0, awards: 0 };
  cur.points += p;
  cur.awards += 1;
  m.set(k, cur);
};

export const usePointsYtdBreakdown = (enabled = true) =>
  useQuery({
    queryKey: ["gam-points-ytd-breakdown"],
    enabled,
    queryFn: async (): Promise<PointsYtdBreakdown> => {
      const now = new Date();
      const year = now.getFullYear();
      const start = new Date(year, 0, 1).toISOString();
      const PAGE_SIZE = 1000;
      const MAX_PAGES = 100;
      const byMonth = new Map<string, { points: number; awards: number }>();
      const byProgram = new Map<string | null, { points: number; awards: number }>();
      const byUser = new Map<string | null, { points: number; awards: number }>();
      let total = 0;
      let awards = 0;

      for (let page = 0; page < MAX_PAGES; page++) {
        const from = page * PAGE_SIZE;
        const { data, error } = await supabase
          .from("gamification_points")
          .select("points, earned_at, user_id, game_id")
          .gte("earned_at", start)
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        const rows = data ?? [];
        for (const r of rows as any[]) {
          const p = Number(r.points || 0);
          total += p;
          awards += 1;
          bump(byMonth, String(r.earned_at ?? "").slice(0, 7), p);
          bump(byProgram, r.game_id ?? null, p);
          bump(byUser, r.user_id ?? null, p);
        }
        if (rows.length < PAGE_SIZE) break;
      }

      const months = Array.from({ length: now.getMonth() + 1 }, (_, i) => {
        const key = `${year}-${String(i + 1).padStart(2, "0")}`;
        const m = byMonth.get(key) ?? { points: 0, awards: 0 };
        return { key, label: new Date(year, i, 1).toLocaleDateString(undefined, { month: "short" }), ...m };
      });
      const desc = (a: { points: number }, b: { points: number }) => b.points - a.points;

      return {
        total,
        awards,
        byMonth: months,
        byProgram: [...byProgram.entries()].map(([gameId, v]) => ({ gameId, ...v })).sort(desc),
        topUsers: [...byUser.entries()].map(([userId, v]) => ({ userId, ...v })).sort(desc).slice(0, 8),
      };
    },
  });
/* ------------------------------------------------------------------ *
 * Rankings
 *
 * RLS on gamification_points only ever exposes a user their own rows, so a
 * leaderboard cannot be built from the client. These read SECURITY DEFINER
 * RPCs instead: aggregates for everyone, per-award detail only where
 * report_can_view_user() passes (yourself, or someone who reports to you).
 * ------------------------------------------------------------------ */

/** The generated Database types don't know these functions yet, so route the
 *  calls through one narrow signature rather than sprinkling casts. Drop this
 *  once src/integrations/supabase/types.ts is regenerated. */
type RpcResult<T> = { data: T[] | null; error: { message: string; code?: string } | null };
const gamRpc = <T,>(fn: string, args: Record<string, unknown>) =>
  (supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<RpcResult<T>>)(fn, args);

/** Postgres numerics arrive as strings over the wire. */
const num = (v: unknown) => Number(v ?? 0) || 0;

export interface RankingRow {
  user_id: string;
  full_name: string;
  profile_picture_url: string | null;
  points: number;
  awards: number;
  programs: number;
  rank: number;
}

export interface PersonProgram {
  game_id: string;
  program: string;
  category: string;
  points: number;
  awards: number;
}

export interface PersonAward {
  id: string;
  earned_at: string;
  points: number;
  program: string;
  category: string;
  activity: string;
  /** What fired the award — drives which detail the UI shows for it. */
  trigger_type: string | null;
  reference_type: string | null;
  retailer_name: string | null;
  beat_name: string | null;
  order_value: number | null;
  order_status: string | null;
  /** The order this award is actually attached to, when there is one.
   *  Null for a Productive visit, whose reference_type says "order" but whose
   *  reference_id is a RETAILER — so this is the only safe thing to link on. */
  order_id: string | null;
  retailer_id: string | null;
  /** Target activities settle over a period rather than against a document. */
  period_key: string | null;
  tier_pct: number | null;
  achievement_pct: number | null;
}

const range = (from?: Date, to?: Date) => ({
  p_from: from?.toISOString(),
  p_to: to?.toISOString(),
});

/** Who the board is drawn for. */
export type RankScope = "hierarchy" | "mine" | "selected";

export const RANK_SCOPES: { value: RankScope; label: string; hint: string }[] = [
  { value: "hierarchy", label: "My hierarchy", hint: "Everyone in my organisation tree" },
  { value: "mine", label: "My scope", hint: "Me and everyone who reports to me" },
  { value: "selected", label: "Selected people", hint: "Pick who to compare against" },
];

/**
 * Aggregate leaderboard for the period, for one scope.
 *
 * The scope is resolved server-side from auth.uid(), and the rank is computed
 * over the filtered set — filtering here instead would leave the board reading
 * 1, 4, 9. Deactivated users are excluded by the rpc, so they cannot appear
 * whichever scope is chosen.
 */
export const useRankings = (
  from?: Date,
  to?: Date,
  scope: RankScope = "hierarchy",
  userIds: string[] = [],
) =>
  useQuery({
    queryKey: ["gam-rankings", from?.toISOString(), to?.toISOString(), scope, [...userIds].sort().join(",")],
    // A selection of nobody has nothing to ask for.
    enabled: !!from && !!to && (scope !== "selected" || userIds.length > 0),
    queryFn: async (): Promise<RankingRow[]> => {
      const { data, error } = await gamRpc<RankingRow>("gam_rankings", {
        ...range(from, to),
        p_scope: scope,
        p_user_ids: scope === "selected" ? userIds : null,
      });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        points: num(r.points),
        awards: num(r.awards),
        programs: num(r.programs),
        rank: num(r.rank),
      }));
    },
  });

/** Per-program split for one person — aggregate, so peers may see it. */
export const usePersonPrograms = (userId?: string, from?: Date, to?: Date) =>
  useQuery({
    queryKey: ["gam-person-programs", userId, from?.toISOString(), to?.toISOString()],
    enabled: !!userId && !!from && !!to,
    queryFn: async (): Promise<PersonProgram[]> => {
      const { data, error } = await gamRpc<PersonProgram>("gam_person_programs", {
        p_user: userId,
        ...range(from, to),
      });
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, points: num(r.points), awards: num(r.awards) }));
    },
  });

export interface SelectableUser {
  user_id: string;
  full_name: string;
  profile_picture_url: string | null;
}

/** Active people the "Selected people" picker may offer. Names only — no
 *  points and no reporting line, so it reveals nothing the board would not. */
export const useSelectableUsers = (enabled = true) =>
  useQuery({
    queryKey: ["gam-selectable-users"],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SelectableUser[]> => {
      const { data, error } = await gamRpc<SelectableUser>("gam_selectable_users", {});
      if (error) throw error;
      return data ?? [];
    },
  });

/** Whether the caller may drill into this person's individual awards. */
export const useCanViewDetail = (userId?: string) =>
  useQuery({
    queryKey: ["gam-can-view-detail", userId],
    enabled: !!userId,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await gamRpc<boolean>("gam_can_view_detail", { p_user: userId });
      if (error) throw error;
      return Boolean(data);
    },
  });

/** Per-award detail. The RPC refuses (42501) rather than returning an empty
 *  list, so "not allowed" stays distinguishable from "earned nothing". */
export const usePersonDetail = (userId?: string, from?: Date, to?: Date, enabled = true) =>
  useQuery({
    queryKey: ["gam-person-detail", userId, from?.toISOString(), to?.toISOString()],
    enabled: enabled && !!userId && !!from && !!to,
    retry: false,
    queryFn: async (): Promise<PersonAward[]> => {
      const { data, error } = await gamRpc<PersonAward>("gam_person_detail", {
        p_user: userId,
        ...range(from, to),
      });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        points: num(r.points),
        order_value: r.order_value == null ? null : num(r.order_value),
        tier_pct: r.tier_pct == null ? null : num(r.tier_pct),
        achievement_pct: r.achievement_pct == null ? null : num(r.achievement_pct),
      }));
    },
  });

/** One award, as the ADMIN console reads it.
 *
 *  Deliberately a different shape from PersonAward: this one carries the person
 *  and the game it belongs to, because the admin drill-down arrives at a record
 *  from either direction and the ledger arrives with no context at all. */
export interface AwardRecord {
  id: string;
  earned_at: string;
  points: number;
  user_id: string | null;
  person: string;
  game_id: string | null;
  program: string | null;
  category: string | null;
  activity: string | null;
  trigger_type: string | null;
  reference_type: string | null;
  status: string | null;
  expires_at: string | null;
  period_key: string | null;
  tier_pct: number | null;
  achievement_pct: number | null;
  /** Null when the caller may see the award but not the customer behind it —
   *  the same line gam_person_detail draws. Absent, not zero. */
  retailer_name: string | null;
  beat_name: string | null;
  order_value: number | null;
  order_status: string | null;
  order_id: string | null;
  retailer_id: string | null;
  /** The customer detail above was WITHHELD, rather than absent. Server-sent,
   *  because from here a hidden order looks exactly like a missing one. */
  redacted: boolean;
}

const asAwardRecord = (r: AwardRecord): AwardRecord => ({
  ...r,
  redacted: r.redacted === true,
  points: num(r.points),
  order_value: r.order_value == null ? null : num(r.order_value),
  tier_pct: r.tier_pct == null ? null : num(r.tier_pct),
  achievement_pct: r.achievement_pct == null ? null : num(r.achievement_pct),
});

/** The individual awards behind ONE cell of the Overview's roll-up.
 *
 *  gameId/userId are passed through as-is, null included: "not linked to a
 *  game" and "not linked to a person" are real cells of that roll-up and drill
 *  like any other. The window is the same YYYY-MM-DD pair the roll-up takes, so
 *  these rows always sum to the total shown above them. */
export const useAwardRecords = (
  gameId: string | null,
  userId: string | null,
  from?: string,
  to?: string,
  enabled = true,
) =>
  useQuery({
    queryKey: ["gam-award-records", gameId, userId, from ?? "", to ?? ""],
    enabled,
    queryFn: async (): Promise<AwardRecord[]> => {
      const { data, error } = await gamRpc<AwardRecord>("gam_admin_award_records", {
        p_game: gameId,
        p_user: userId,
        p_from: from || null,
        p_to: to || null,
      });
      if (error) throw error;
      return (data ?? []).map(asAwardRecord);
    },
  });

/** One award by id — how a ledger row, which has no drill context, opens. */
export const useAwardRecord = (id?: string) =>
  useQuery({
    queryKey: ["gam-award-record", id],
    enabled: !!id,
    queryFn: async (): Promise<AwardRecord | null> => {
      const { data, error } = await gamRpc<AwardRecord>("gam_admin_award_records", { p_id: id });
      if (error) throw error;
      const row = (data ?? [])[0];
      return row ? asAwardRecord(row) : null;
    },
  });

export interface RevenueRow { user_id: string; revenue: number; orders: number }

/** What each rep booked in the window. Server-side because orders is RLS'd to
 *  the caller — an admin dashboard aggregating client-side would show one row. */
export const useRevenueByUser = (from?: Date, to?: Date) =>
  useQuery({
    queryKey: ["gam-revenue-by-user", from?.toISOString(), to?.toISOString()],
    enabled: !!from && !!to,
    queryFn: async (): Promise<RevenueRow[]> => {
      const { data, error } = await gamRpc<RevenueRow>("gam_revenue_by_user", range(from, to));
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, revenue: num(r.revenue), orders: num(r.orders) }));
    },
  });

export interface SpendMonthRow {
  month: string; points: number; rupees: number; awards: number; people: number;
}

/** What the scheme has cost month by month, at each game's own point rate. */
export const useSpendByMonth = (months = 12) =>
  useQuery({
    queryKey: ["gam-spend-by-month", months],
    queryFn: async (): Promise<SpendMonthRow[]> => {
      const { data, error } = await gamRpc<SpendMonthRow>("gam_spend_by_month", { p_months: months });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        points: num(r.points), rupees: num(r.rupees),
        awards: num(r.awards), people: num(r.people),
      }));
    },
  });

export interface ActivityRankingRow {
  action_id: string;
  user_id: string;
  full_name: string;
  points: number;
  awards: number;
  rank: number;
}

/** Per-ACTIVITY leaderboards. Same reason as useGameRankings: gamification_points
 *  is RLS'd to the caller's own rows, so a client-side aggregate ranks every rep
 *  #1 of 1 and has them racing nobody but themselves. Aggregate only. */
export const useActivityRankings = (from?: Date, to?: Date) =>
  useQuery({
    queryKey: ["gam-activity-rankings", from?.toISOString(), to?.toISOString()],
    enabled: !!from && !!to,
    queryFn: async (): Promise<ActivityRankingRow[]> => {
      const { data, error } = await gamRpc<ActivityRankingRow>("gam_activity_rankings", range(from, to));
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r, points: num(r.points), awards: num(r.awards), rank: num(r.rank),
      }));
    },
  });

export interface GameRankingRow {
  game_id: string;
  user_id: string;
  full_name: string;
  points: number;
  rank: number;
}

/** Per-game leaderboards for the whole period in one call. Same reason as
 *  useRankings: built client-side, every rep would see only themselves in
 *  every game. Aggregate only. */
export const useGameRankings = (from?: Date, to?: Date) =>
  useQuery({
    queryKey: ["gam-game-rankings", from?.toISOString(), to?.toISOString()],
    enabled: !!from && !!to,
    queryFn: async (): Promise<GameRankingRow[]> => {
      const { data, error } = await gamRpc<GameRankingRow>("gam_game_rankings", range(from, to));
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, points: num(r.points), rank: num(r.rank) }));
    },
  });

/** One configured activity, whether or not it has ever paid the viewer. */
export interface CatalogueActivity {
  id: string;
  /** action_name — matches PersonAward.activity. */
  name: string;
  /** Game name — matches PersonAward.program. */
  program: string;
  category: string;
  isTiered: boolean;
  /** Per-action award; 0 for tiered activities, which pay by rung. */
  points: number;
}

/**
 * Every activity in every game, for the drill-down.
 *
 * The charts are built from award rows, so an activity the viewer has never
 * earned from has nothing to draw and silently disappears — which is exactly
 * the activity worth telling them about. This supplies the ones that are
 * missing. Both tables are readable by any authenticated user, so it is a
 * plain select rather than one of the SECURITY DEFINER rpcs.
 */
export const useActivityCatalogue = () =>
  useQuery({
    queryKey: ["gam-activity-catalogue"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<CatalogueActivity[]> => {
      const { data, error } = await supabase
        .from("gamification_actions")
        .select("id, action_name, points, is_tiered, gamification_games(name, category)")
        .order("action_name");
      if (error) throw error;
      // PostgREST types the embedded game loosely; narrow it once here rather
      // than threading generated types through the chart.
      type Row = {
        id: string;
        action_name: string;
        points: number | string | null;
        is_tiered: boolean | null;
        gamification_games: { name: string | null; category: string | null } | null;
      };
      return ((data ?? []) as unknown as Row[]).flatMap((r) => {
        const game = r.gamification_games;
        if (!game?.name) return [];
        return [{
          id: r.id,
          name: r.action_name,
          program: game.name,
          category: game.category ?? "",
          isTiered: Boolean(r.is_tiered),
          points: num(r.points),
        }];
      });
    },
  });

/** Scalar facts about one person's period. An aggregate, so anyone on the
 *  board may read it — no row of it identifies a customer. */
export interface PersonProfile {
  points: number;
  awards: number;
  programs: number;
  days: number;
  order_count: number;
  order_value: number;
}

export const usePersonProfile = (userId?: string, from?: Date, to?: Date) =>
  useQuery({
    queryKey: ["gam-person-profile", userId, from?.toISOString(), to?.toISOString()],
    enabled: !!userId && !!from && !!to,
    queryFn: async (): Promise<PersonProfile> => {
      const { data, error } = await gamRpc<PersonProfile>("gam_person_profile", {
        p_user: userId,
        ...range(from, to),
      });
      if (error) throw error;
      const r = (data ?? [])[0];
      return {
        points: num(r?.points), awards: num(r?.awards), programs: num(r?.programs),
        days: num(r?.days), order_count: num(r?.order_count), order_value: num(r?.order_value),
      };
    },
  });

/** The same period split by activity — what the comparison and the observations
 *  are built from. Also an aggregate. */
export interface PersonActivity {
  program: string;
  category: string;
  activity: string;
  points: number;
  awards: number;
  order_count: number;
  order_value: number;
}

export const usePersonActivity = (userId?: string, from?: Date, to?: Date) =>
  useQuery({
    queryKey: ["gam-person-activity", userId, from?.toISOString(), to?.toISOString()],
    enabled: !!userId && !!from && !!to,
    queryFn: async (): Promise<PersonActivity[]> => {
      const { data, error } = await gamRpc<PersonActivity>("gam_person_by_activity", {
        p_user: userId,
        ...range(from, to),
      });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        points: num(r.points), awards: num(r.awards),
        order_count: num(r.order_count), order_value: num(r.order_value),
      }));
    },
  });

/* ------------------------------------------------------------------ */
/* Redemption approval policy                                          */
/*                                                                     */
/* Redemptions ride the SAME approval engine as leave, expenses and    */
/* credit notes — one row in approval_config keyed by entity_type.     */
/* Nothing gamification-specific is duplicated here.                   */
/* ------------------------------------------------------------------ */

export const REDEMPTION_ENTITY = "gamification_redemption";

export interface ApprovalPolicy {
  id: string;
  entity_type: string;
  /**
   * Where a request is sent.
   *   manager   up the rep's reporting line
   *   admin     every system admin
   *   users     the people named in approver_user_ids
   *   roles     everyone holding one of approver_role_ids
   *   specific  one named person — the engine's original mode, still honoured
   *             for other entity types but not offered for redemptions
   */
  approval_mode: ApprovalMode;
  /** Several routes at once — approvers are the union of what each resolves to.
   *  Falls back to approval_mode when empty, which is how the other entity
   *  types (leave, expenses, …) still work untouched. */
  approval_modes: ApprovalMode[] | null;
  use_full_hierarchy: boolean;
  max_levels: number;
  final_approval_role: string | null;
  skip_levels: boolean;
  specific_approver_id: string | null;
  /** approval_mode = 'users'. Any one of them settles the request. */
  approver_user_ids: string[] | null;
  /** approval_mode = 'roles'. Security-role ids, from gam_approver_roles. */
  approver_role_ids: string[] | null;
  /** true = unanimous (every level, in order) · false = first response wins.
   *  Only meaningful for 'manager'; the other modes are a single level. */
  require_all_levels: boolean;
}

export type ApprovalMode = "manager" | "admin" | "users" | "roles" | "specific";

/** What the admin picks from. 'specific' is deliberately absent — it is the
 *  single-person ancestor of 'users', which does the same job for any number. */
export const APPROVAL_MODES: { value: ApprovalMode; label: string; hint: string }[] = [
  { value: "admin",   label: "Admin",         hint: "Every system admin can action it." },
  { value: "manager", label: "Manager",       hint: "Up the rep's own reporting line." },
  { value: "users",   label: "Specific user", hint: "Only the people you name." },
  { value: "roles",   label: "Role",          hint: "Anyone holding one of these roles." },
];

/** The security roles a request can be routed to. */
export const useApproverRoles = () =>
  useQuery({
    queryKey: ["gam-approver-roles"],
    queryFn: async () => {
      const { data, error } = await gamRpc<{ id: string; name: string }>("gam_approver_roles", {});
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

export const useRedemptionApprovalPolicy = () =>
  useQuery({
    queryKey: ["gam-redemption-approval-policy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approval_config")
        .select("*")
        .eq("entity_type", REDEMPTION_ENTITY)
        .maybeSingle();
      if (error) throw error;
      return data as ApprovalPolicy | null;
    },
  });

export const useUpdateRedemptionApprovalPolicy = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<ApprovalPolicy> & { id: string }) => {
      const { id, ...rest } = patch;
      const { error } = await supabase.from("approval_config").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gam-redemption-approval-policy"] });
      toast.success("Approval policy saved");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not save the approval policy"),
  });
};

/** People who can be named as the single approver. */
export const useApproverChoices = () =>
  useQuery({
    queryKey: ["gam-approver-choices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, username")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as { id: string; full_name: string | null; username: string | null }[];
    },
  });

/** What a period close would do, without doing it. */
export const useResetPreview = () =>
  useQuery({
    queryKey: ["gam-reset-preview"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("gam_run_period_reset", { p_dry_run: true });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as { period_key: string | null; users_archived: number;
                      points_expired: number; note: string } | null;
    },
  });
/* ------------------------------------------------------------------ *
 * Redemptions
 *
 * Every mutation below is an RPC, never a table write. The old flow
 * inserted straight into gamification_redemptions from the browser and
 * approved with a plain UPDATE, so the balance was checked only in
 * JavaScript and approving never deducted anything. RLS now grants no
 * INSERT or UPDATE on that table at all, so these are the only doors.
 * ------------------------------------------------------------------ */

export type RedemptionStatus = "pending" | "approved" | "paid" | "rejected" | "cancelled";

export interface RedemptionRow {
  id: string;
  user_id: string;
  person: string;
  points_redeemed: number;
  voucher_amount: number;
  status: RedemptionStatus;
  requested_at: string;
  approved_at: string | null;
  approved_by_name: string | null;
  paid_at: string | null;
  paid_by_name: string | null;
  payment_mode: string | null;
  payment_reference: string | null;
  payment_note: string | null;
  rejection_reason: string | null;
  /** The requester's balance as it stands now — so nobody approves blind. */
  balance: number;
  available: number;
  /** Set once the shared approval engine has raised a request for this row.
   *  Null on rows that predate it, which settle directly instead. */
  approval_request_id: string | null;
  /** False when this caller cannot act right now — either the route went
   *  elsewhere, or a unanimous route has somebody else up next. */
  my_turn: boolean;
  /** Who it is actually waiting on. A manager keeps oversight of their team's
   *  requests even when the configured route sent them somewhere else, so this
   *  is what the screen shows in place of a button they cannot press. */
  routed_to: string | null;
}

export interface MyRedemptionRow {
  id: string;
  points_redeemed: number;
  voucher_amount: number;
  status: RedemptionStatus;
  requested_at: string;
  approved_at: string | null;
  approved_by_name: string | null;
  paid_at: string | null;
  paid_by_name: string | null;
  payment_mode: string | null;
  payment_reference: string | null;
  rejection_reason: string | null;
}

const asRedemption = <T extends { points_redeemed: unknown; voucher_amount: unknown }>(r: T) => ({
  ...r,
  points_redeemed: num(r.points_redeemed),
  voucher_amount: num(r.voucher_amount),
});

/** Does this person have anybody's requests to action? Drives the admin tab. */
export const useHasRedemptionQueue = () =>
  useQuery({
    queryKey: ["gam-has-redemption-queue"],
    queryFn: async () => {
      const { data, error } = await gamRpc<boolean>("gam_has_redemption_queue", {});
      if (error) throw error;
      return (data as unknown) === true;
    },
  });

/** The manager's queue. Server-filtered to requests this caller may action. */
export const useRedemptionQueue = (statuses?: RedemptionStatus[]) =>
  useQuery({
    queryKey: ["gam-redemption-queue", statuses ?? "all"],
    queryFn: async (): Promise<RedemptionRow[]> => {
      const { data, error } = await gamRpc<RedemptionRow>("gam_redemption_queue", {
        p_statuses: statuses ?? null,
      });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...asRedemption(r),
        balance: num(r.balance),
        available: num(r.available),
      })) as RedemptionRow[];
    },
  });

export const useMyRedemptions = () =>
  useQuery({
    queryKey: ["gam-my-redemptions"],
    queryFn: async (): Promise<MyRedemptionRow[]> => {
      const { data, error } = await gamRpc<MyRedemptionRow>("gam_my_redemptions", {});
      if (error) throw error;
      return (data ?? []).map(asRedemption) as MyRedemptionRow[];
    },
  });

/** What this person may actually ask for: balance less anything already committed. */
export const useAvailableToRedeem = (userId?: string) =>
  useQuery({
    queryKey: ["gam-available-to-redeem", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await gamRpc<number>("gam_available_to_redeem", { p_user: userId });
      if (error) throw error;
      return num(data);
    },
  });

/** Everything a redemption touches, refreshed together. */
const useRedemptionInvalidation = () => {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["gam-redemption-queue"] });
    qc.invalidateQueries({ queryKey: ["gam-my-redemptions"] });
    qc.invalidateQueries({ queryKey: ["gam-available-to-redeem"] });
    // Paying burns award rows, so anything counting points is now stale.
    qc.invalidateQueries({ queryKey: ["gam-points-rollup"] });
    qc.invalidateQueries({ queryKey: ["gam-rankings"] });
  };
};

/** Postgres messages here are written for the rep, so show them as they are. */
const rpcMessage = (e: unknown, fallback: string) => {
  const m = (e as { message?: string } | null)?.message;
  return m && m.trim() ? m : fallback;
};

export const useRequestRedemption = () => {
  const refresh = useRedemptionInvalidation();
  return useMutation({
    mutationFn: async (points: number) => {
      const { data, error } = await gamRpc<string>("gam_request_redemption", { p_points: points });
      if (error) throw error;
      return data as unknown as string;
    },
    onSuccess: () => { refresh(); },
    onError: (e) => toast.error(rpcMessage(e, "Could not submit the request")),
  });
};

export const useDecideRedemption = () => {
  const refresh = useRedemptionInvalidation();
  return useMutation({
    mutationFn: async (v: { id: string; approve: boolean; reason?: string }) => {
      const { error } = await gamRpc("gam_decide_redemption", {
        p_id: v.id, p_approve: v.approve, p_reason: v.reason ?? null,
      });
      if (error) throw error;
      return v;
    },
    onSuccess: (v) => {
      refresh();
      toast.success(v.approve ? "Approved — not yet paid" : "Request rejected");
    },
    onError: (e) => toast.error(rpcMessage(e, "Could not action the request")),
  });
};

export const useMarkRedemptionPaid = () => {
  const refresh = useRedemptionInvalidation();
  return useMutation({
    mutationFn: async (v: { id: string; mode: string; reference: string; note?: string }) => {
      const { error } = await gamRpc("gam_mark_redemption_paid", {
        p_id: v.id, p_mode: v.mode, p_reference: v.reference, p_note: v.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success("Marked as sent — points deducted"); },
    onError: (e) => toast.error(rpcMessage(e, "Could not mark this as paid")),
  });
};

export const useCancelRedemption = () => {
  const refresh = useRedemptionInvalidation();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await gamRpc("gam_cancel_redemption", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success("Request withdrawn"); },
    onError: (e) => toast.error(rpcMessage(e, "Could not withdraw the request")),
  });
};

/**
 * Save the whole redemption configuration in one go.
 *
 * The page edits a draft and commits it on Save, so the two tables behind it —
 * gamification_settings and approval_config — have to be written together and
 * reported once. Using the two single-field hooks here would fire their own
 * toasts as well, and an admin who pressed Save once would be told three times.
 *
 * Not a transaction: they are separate PostgREST calls. The settings row goes
 * first and the approval row second, so a failure in between leaves the rules
 * saved and the route not — which the error message says, rather than claiming
 * everything landed.
 */
export const useSaveRedemptionConfig = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      settingsId: string;
      settings: Partial<GamSettings>;
      approvalId?: string;
      approval?: Partial<ApprovalPolicy>;
    }) => {
      const { error: sErr } = await supabase
        .from("gamification_settings").update(v.settings).eq("id", v.settingsId);
      if (sErr) throw sErr;

      if (v.approvalId && v.approval) {
        const { error: aErr } = await supabase
          .from("approval_config").update(v.approval).eq("id", v.approvalId);
        if (aErr) {
          throw new Error(
            `The redemption rules were saved, but the approval route was not: ${aErr.message}`,
          );
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gam-settings"] });
      qc.invalidateQueries({ queryKey: ["gam-redemption-approval-policy"] });
      qc.invalidateQueries({ queryKey: ["gam-reset-preview"] });
      toast.success("Redemption configuration saved successfully.");
    },
    onError: (e: unknown) =>
      toast.error((e as { message?: string })?.message ?? "Could not save the configuration"),
  });
};
