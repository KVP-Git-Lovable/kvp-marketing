import type { ApprovalMode, ApprovalPolicy, GamSettings } from "./hooks";

/**
 * The Policy tab's edit buffer.
 *
 * One draft for the whole tab — global configuration, redemption rules, period
 * close and the approval route — because it is one Edit button and one Save.
 * It lives in its own module so the sections can share the type without
 * importing each other.
 *
 * Only fields this page owns are listed. Everything else on either row is left
 * exactly as it is, so saving here can never clobber a column some other screen
 * is responsible for.
 */
export type PolicyDraft = {
  // Global configuration
  engine_enabled: boolean;
  currency_name: string;
  point_conversion: number;
  default_award_mode: string;
  notifications_enabled: boolean;
  approval_fallback: string;
  timezone: string;
  tab_games_enabled: boolean;
  tab_badges_enabled: boolean;
  leaderboard_enabled: boolean;
  tab_redemptions_enabled: boolean;

  // Redemption rules
  redeem_min_points: number;
  redeem_multiple_of: number | null;
  redeem_max_per_request: number | null;
  redeem_cooldown_days: number;
  redeem_requires_approval: boolean;

  // Period close
  reset_cadence: GamSettings["reset_cadence"];
  reset_mode: GamSettings["reset_mode"];
  reset_grace_days: number;
  reset_lifetime_visible: boolean;

  // Approval route
  approval_modes: ApprovalMode[];
  approver_user_ids: string[];
  approver_role_ids: string[];
  specific_approver_id: string | null;
  max_levels: number;
};

/** The four tabs on the rep-facing Leaderboard, and the column behind each.
 *  Rankings reuses the long-dormant `leaderboard_enabled` rather than a
 *  duplicate of its own — see the migration for why. */
export const LEADERBOARD_TABS: { field: keyof GamSettings; label: string }[] = [
  { field: "tab_games_enabled", label: "My Games" },
  { field: "tab_badges_enabled", label: "Badges" },
  { field: "leaderboard_enabled", label: "Rankings" },
  { field: "tab_redemptions_enabled", label: "Redemptions" },
];

export const policyDraftFrom = (
  s: GamSettings,
  a: ApprovalPolicy | null | undefined,
): PolicyDraft => ({
  engine_enabled: s.engine_enabled ?? true,
  currency_name: s.currency_name ?? "Points",
  point_conversion: s.point_conversion ?? 1,
  default_award_mode: s.default_award_mode ?? "auto",
  notifications_enabled: s.notifications_enabled ?? false,
  approval_fallback: s.approval_fallback ?? "manager",
  timezone: s.timezone ?? "Asia/Kolkata",
  tab_games_enabled: s.tab_games_enabled !== false,
  tab_badges_enabled: s.tab_badges_enabled !== false,
  leaderboard_enabled: s.leaderboard_enabled !== false,
  tab_redemptions_enabled: s.tab_redemptions_enabled !== false,

  redeem_min_points: s.redeem_min_points ?? 0,
  redeem_multiple_of: s.redeem_multiple_of ?? null,
  redeem_max_per_request: s.redeem_max_per_request ?? null,
  redeem_cooldown_days: s.redeem_cooldown_days ?? 0,
  redeem_requires_approval: s.redeem_requires_approval ?? true,

  reset_cadence: s.reset_cadence ?? "never",
  reset_mode: s.reset_mode ?? "expire",
  reset_grace_days: s.reset_grace_days ?? 0,
  reset_lifetime_visible: s.reset_lifetime_visible ?? true,

  // The plural column routes; the singular one stands in for rows saved before
  // it existed, so an older config still shows what it actually does.
  approval_modes: a?.approval_modes?.length
    ? a.approval_modes
    : a?.approval_mode ? [a.approval_mode] : [],
  approver_user_ids: a?.approver_user_ids ?? [],
  approver_role_ids: a?.approver_role_ids ?? [],
  specific_approver_id: a?.specific_approver_id ?? null,
  max_levels: a?.max_levels ?? 1,
});

/**
 * Why this configuration cannot be saved, or null.
 *
 * Everything here describes a setting that would quietly stop something
 * working rather than fail loudly — a rep who can never redeem, a tab strip
 * with nothing in it, a request with no approver — which is exactly the class
 * of mistake a Save button exists to catch.
 */
export const policyProblem = (
  d: PolicyDraft,
  hasApprovalRow: boolean,
): string | null => {
  if (!d.currency_name.trim()) return "Point currency name cannot be empty.";
  if (!(d.point_conversion > 0)) return "Point → rupee must be greater than zero.";
  if (!d.timezone.trim()) return "Default timezone cannot be empty.";
  if (!LEADERBOARD_TABS.some((t) => d[t.field as keyof PolicyDraft] === true))
    return "At least one leaderboard tab has to stay on.";

  if (d.redeem_min_points < 0) return "Minimum balance cannot be negative.";
  if (d.redeem_multiple_of != null && d.redeem_multiple_of < 1)
    return "Redeem in multiples of must be 1 or more, or blank.";
  if (d.redeem_max_per_request != null && d.redeem_max_per_request < 1)
    return "Most per request must be 1 or more, or blank.";
  if (d.redeem_max_per_request != null && d.redeem_max_per_request < d.redeem_min_points)
    return "Most per request is below the minimum balance, so nothing could ever be redeemed.";
  if (d.redeem_cooldown_days < 0) return "Wait between requests cannot be negative.";
  if (d.reset_grace_days < 0) return "Grace period cannot be negative.";

  if (hasApprovalRow) {
    if (d.approval_modes.length === 0) return "Pick at least one approval process.";
    if (d.approval_modes.includes("users") && d.approver_user_ids.length === 0)
      return "Specific user is selected, so choose at least one user.";
    if (d.approval_modes.includes("roles") && d.approver_role_ids.length === 0)
      return "Role is selected, so choose at least one role.";
    if (d.approval_modes.includes("specific") && !d.specific_approver_id)
      return "One named person is selected, so choose that person.";
    if (d.approval_modes.includes("manager") && (d.max_levels < 1 || d.max_levels > 10))
      return "How many levels must be between 1 and 10.";
  }
  return null;
};
