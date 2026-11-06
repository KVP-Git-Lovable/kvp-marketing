// @ts-nocheck
// Central scope resolution for every team/all-capable copilot intent —
// replaces each handler doing its own ad-hoc `if (scope === "team")
// resolveTeamScope(...)` block with one shared call, and is the single
// place the "all" scope's System Administrator gate is enforced.
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveTeamScope } from "./teamScope.ts";

type SupabaseClient = ReturnType<typeof createClient>;

export type RequestedScope = "self" | "team" | "all";

export interface ResolvedScope {
  effectiveScope: "self" | "team" | "all";
  /** null ONLY for a confirmed-admin "all" scope — means "no user_id filter at all". */
  userIds: string[] | null;
  /** Pre-populated for self/team. Empty for "all" — see backfillNames(). */
  nameById: Map<string, string>;
  /** "" or an explanatory prefix line (no-subordinates / all-denied-fallback). */
  note: string;
}

/**
 * "all" requires the caller to hold the System Administrator security
 * profile (security_profiles.is_system = true — confirmed against live data
 * to correspond to exactly and only that one profile). Checked via the
 * existing is_system_admin() Postgres function (SECURITY DEFINER, EXECUTE
 * already open to `authenticated`) rather than a manual join, since it's
 * the same check the rest of the app relies on. A denied "all" request
 * falls back to the caller's own team (not a bare refusal), with a note
 * explaining why — this is a deliberate product decision, not a silent
 * downgrade.
 */
export async function resolveScope(
  supabase: SupabaseClient,
  userId: string,
  requestedScope: RequestedScope,
): Promise<ResolvedScope> {
  if (requestedScope === "self") {
    return {
      effectiveScope: "self",
      userIds: [userId],
      nameById: new Map([[userId, "You"]]),
      note: "",
    };
  }

  if (requestedScope === "all") {
    const { data: isAdmin } = await supabase.rpc("is_system_admin", { _user_id: userId });
    if (isAdmin === true) {
      return { effectiveScope: "all", userIds: null, nameById: new Map(), note: "" };
    }
    const team = await resolveTeamScope(supabase, userId);
    const nameById = new Map<string, string>([[userId, "You"]]);
    team.members.forEach((m) => nameById.set(m.userId, m.fullName || m.userId));
    return {
      effectiveScope: "team",
      userIds: team.scopeUserIds,
      nameById,
      note:
        "You asked for data across all users, but that requires System Administrator access — showing your own team's figures instead.\n\n",
    };
  }

  // "team"
  const team = await resolveTeamScope(supabase, userId);
  const nameById = new Map<string, string>([[userId, "You"]]);
  team.members.forEach((m) => nameById.set(m.userId, m.fullName || m.userId));
  return {
    effectiveScope: "team",
    userIds: team.scopeUserIds,
    nameById,
    note: team.hasTeam
      ? ""
      : "Note: you have no subordinates in the system right now, so these are your own figures only.\n\n",
  };
}

/**
 * Fills in display names for user_ids that appeared in a result set but
 * aren't already in nameById — only relevant for "all" scope, where names
 * aren't known upfront. Only fetches the distinct ids actually present in
 * the data (never every profile in the system), avoiding the large
 * `.in()`-list pitfall a naive "fetch everyone's name first" approach
 * would hit.
 */
export async function backfillNames(
  supabase: SupabaseClient,
  nameById: Map<string, string>,
  ids: Iterable<string>,
): Promise<void> {
  const missing = [...new Set(ids)].filter((id) => !nameById.has(id));
  if (!missing.length) return;
  const { data } = await supabase.from("profiles").select("id, full_name").in("id", missing);
  (data ?? []).forEach((p: any) => nameById.set(p.id, p.full_name || p.id));
}
