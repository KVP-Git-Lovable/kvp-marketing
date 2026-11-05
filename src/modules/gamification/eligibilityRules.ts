/**
 * Composable eligibility for one activity.
 *
 * `include` says who can earn it; leaving it empty means everyone. `exclude`
 * then takes people back out, and an exclusion always wins — that is the only
 * reading an admin ever expects from "all reps except these two".
 *
 * Stored on gamification_actions.eligibility_rules and evaluated server-side by
 * gam_is_eligible(); the old eligibility_mode/eligibility_ids pair still works
 * and is used whenever this is empty, so existing activities are untouched
 * until someone edits them.
 */
export type CriterionType = "all" | "role" | "manager" | "territory" | "users";

export interface Criterion {
  type: CriterionType;
  /** Ignored for "all". */
  ids: string[];
}

export interface EligibilityRules {
  include?: Criterion[];
  exclude?: Criterion[];
}

export const CRITERION_META: Record<
  CriterionType,
  { label: string; picker: "none" | "users" | "territories" | "roles"; blurb: string }
> = {
  all:       { label: "Everyone",   picker: "none",        blurb: "Every active user." },
  role:      { label: "Role",       picker: "roles",       blurb: "Anyone holding these roles." },
  manager:   { label: "Team under", picker: "users",       blurb: "These managers and everyone reporting to them." },
  territory: { label: "Territory",  picker: "territories", blurb: "Anyone covering these territories." },
  users:     { label: "People",     picker: "users",       blurb: "Exactly these people." },
};

/** Include offers "Everyone"; excluding everyone would just disable the game. */
export const INCLUDE_TYPES: CriterionType[] = ["all", "role", "manager", "territory", "users"];
export const EXCLUDE_TYPES: CriterionType[] = ["users", "role", "manager", "territory"];

const cleanList = (v: unknown): Criterion[] =>
  Array.isArray(v)
    ? v
        .map((c: any) => ({
          type: String(c?.type ?? "") as CriterionType,
          ids: Array.isArray(c?.ids) ? c.ids.map(String).filter(Boolean) : [],
        }))
        .filter((c) => c.type in CRITERION_META)
        // a criterion naming nobody matches nobody server-side, so dropping it
        // here keeps the saved rules honest rather than silently blocking all
        .filter((c) => c.type === "all" || c.ids.length > 0)
    : [];

export function parseRules(raw: unknown): EligibilityRules {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const include = cleanList(o.include);
  const exclude = cleanList(o.exclude);
  const out: EligibilityRules = {};
  if (include.length) out.include = include;
  if (exclude.length) out.exclude = exclude;
  return out;
}

export const serialiseRules = parseRules;

export function rulesAreSet(r: EligibilityRules): boolean {
  return Boolean(r.include?.length || r.exclude?.length);
}

/** Carry a legacy mode/ids pair into the new shape so editing never loses it. */
export function fromLegacy(mode: string, ids: string[]): EligibilityRules {
  if (!mode || mode === "all") return {};
  const type = (["users", "manager", "territory"] as const).find((t) => t === mode);
  if (!type || !ids.length) return {};
  return { include: [{ type, ids: [...ids] }] };
}

/**
 * One sentence an admin can check at a glance. The point of the builder is
 * that nobody has to reverse-engineer who is in a game from a list of chips.
 */
export function describeRules(
  r: EligibilityRules,
  name: (type: CriterionType, id: string) => string,
): string {
  const phrase = (c: Criterion) => {
    const names = c.ids.map((id) => name(c.type, id)).filter(Boolean);
    const list =
      names.length <= 2
        ? names.join(" and ")
        : `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
    switch (c.type) {
      case "all": return "everyone";
      case "role": return `anyone in ${list}`;
      case "manager": return `${list}'s team${c.ids.length > 1 ? "s" : ""}`;
      case "territory": return `anyone covering ${list}`;
      case "users": return list;
    }
  };

  const inc = r.include?.length ? r.include.map(phrase).join(", or ") : "everyone";
  if (!r.exclude?.length) return `This game applies to ${inc}.`;
  return `This game applies to ${inc}, except ${r.exclude.map(phrase).join(" and ")}.`;
}
