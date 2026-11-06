// @ts-nocheck
// Resolves "my team" to a list of user IDs for team-scoped copilot answers.
//
// Prefers the get_all_subordinates RPC (full recursive hierarchy over
// employees.manager_id — see migration
// 20251224092257_9b382ad6-9bf0-420b-a01f-4f30ba4d0f9e.sql). That RPC already
// includes the caller at level 0, so no manual self-union is needed on the
// happy path. Falls back to direct reports only (employees.manager_id =
// userId) if the RPC errors, so a single DB hiccup degrades the team scope
// rather than failing the whole request.
import { createClient } from "npm:@supabase/supabase-js@2";

// Matches the local type alias in index.ts (`ReturnType<typeof createClient>`)
// rather than the package's own generic `SupabaseClient` export, so callers
// can pass index.ts's client straight through without a type mismatch.
type SupabaseClient = ReturnType<typeof createClient>;

export interface TeamMember {
  userId: string;
  fullName: string;
}

export interface TeamScope {
  /** Always includes the caller's own userId. */
  scopeUserIds: string[];
  /** Excludes the caller — just the people "under" them. */
  members: TeamMember[];
  hasTeam: boolean;
  usedFallback: boolean;
}

export async function resolveTeamScope(
  supabase: SupabaseClient,
  userId: string,
): Promise<TeamScope> {
  const { data, error } = await supabase.rpc("get_all_subordinates", {
    manager_user_id: userId,
  });

  if (!error && data) {
    const rows = data as Array<
      { subordinate_user_id: string; level: number; full_name: string }
    >;
    const scopeUserIds = rows.map((r) => r.subordinate_user_id);
    const members = rows
      .filter((r) => r.level > 0)
      .map((r) => ({ userId: r.subordinate_user_id, fullName: r.full_name }));
    return {
      scopeUserIds: scopeUserIds.length ? scopeUserIds : [userId],
      members,
      hasTeam: members.length > 0,
      usedFallback: false,
    };
  }

  console.error(
    "[copilot-agent] get_all_subordinates RPC failed, falling back to direct reports:",
    error,
  );
  const { data: reports, error: reportsError } = await supabase
    .from("employees")
    .select("user_id")
    .eq("manager_id", userId);
  if (reportsError) {
    console.error("[copilot-agent] direct-report fallback also failed:", reportsError);
    return { scopeUserIds: [userId], members: [], hasTeam: false, usedFallback: true };
  }

  const directIds = (reports ?? [])
    .map((r: any) => String(r.user_id))
    .filter((id: string) => id !== userId);

  let members: TeamMember[] = directIds.map((id) => ({ userId: id, fullName: "" }));
  if (directIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", directIds);
    const nameById = new Map((profs ?? []).map((p: any) => [p.id, p.full_name ?? ""]));
    members = directIds.map((id) => ({ userId: id, fullName: nameById.get(id) ?? "" }));
  }

  return {
    scopeUserIds: [userId, ...directIds],
    members,
    hasTeam: directIds.length > 0,
    usedFallback: true,
  };
}
