// Budget for a Meta Ad node. On Meta the budget belongs to the linked Ad Set. Nodes without a mode
// (created before this feature) are treated as "none", so nothing changes for them.

export type AdBudgetMode = "none" | "share" | "custom";
export type AdBudgetType = "lifetime" | "daily";

export const AD_BUDGET_MODES: ReadonlyArray<{ value: AdBudgetMode; label: string; hint: string }> = [
  { value: "none", label: "Don't change the ad set", hint: "Leave the ad set's budget on Meta as it is." },
  { value: "share", label: "Share of journey budget", hint: "Takes a percentage of the Budget Cap set on this journey, as a lifetime budget over the ad's end date." },
  { value: "custom", label: "Custom amount", hint: "Set a daily or lifetime amount just for this ad." },
];

interface NodeBudget {
  budget_mode?: unknown;
  budget_share_pct?: number | string | null;
  budget_custom_amount?: number | string | null;
  budget_custom_type?: unknown;
}

export const adBudgetModeOf = (data: { budget_mode?: unknown } | null | undefined): AdBudgetMode => {
  const m = data?.budget_mode;
  return m === "share" || m === "custom" || m === "none" ? m : "none";
};

export interface ResolvedAdBudget {
  apply: boolean;
  type: AdBudgetType | null;
  /** Amount in rupees (major units), rounded to 2 decimals. */
  amount: number | null;
  errors: string[];
  warnings: string[];
}

const num = (v: unknown): number => (v === null || v === undefined || v === "" ? NaN : Number(v));
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * @param journeyBudgetCap the journey's Budget Cap (₹), or null when unset
 * @param endIso the ad's end date (from its schedule, or the ad set's current end on Meta); needed for lifetime budgets
 */
export function resolveAdBudget(node: NodeBudget, journeyBudgetCap: number | string | null | undefined, endIso: string | null): ResolvedAdBudget {
  const mode = adBudgetModeOf(node);
  const out: ResolvedAdBudget = { apply: mode !== "none", type: null, amount: null, errors: [], warnings: [] };
  if (mode === "none") return out;

  if (mode === "share") {
    const cap = num(journeyBudgetCap);
    const pct = num(node.budget_share_pct);
    if (!Number.isFinite(cap) || cap <= 0) out.errors.push("Set a Budget Cap on the journey first.");
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) out.errors.push("Share must be between 1 and 100%.");
    if (!endIso) out.errors.push("A share of the journey budget needs an end date (journey or custom dates), or use a Custom daily amount.");
    if (out.errors.length === 0) {
      out.type = "lifetime";
      out.amount = round2((cap * pct) / 100);
    }
    return out;
  }

  const amount = num(node.budget_custom_amount);
  const type: AdBudgetType = node.budget_custom_type === "lifetime" ? "lifetime" : "daily";
  if (!Number.isFinite(amount) || amount <= 0) out.errors.push("Enter an amount greater than zero.");
  if (type === "lifetime" && !endIso) out.errors.push("A lifetime budget needs an end date.");
  if (out.errors.length === 0) {
    out.type = type;
    out.amount = round2(amount);
    const cap = num(journeyBudgetCap);
    if (type === "lifetime" && Number.isFinite(cap) && cap > 0 && amount > cap) out.warnings.push("This amount is more than the journey's Budget Cap.");
  }
  return out;
}

/** Sum of "share" percentages across a journey's Meta Ad nodes (to warn when it exceeds 100%). */
export function totalSharePct(nodes: Array<{ type?: string; data?: NodeBudget | null }>): number {
  return nodes
    .filter((n) => n.type === "meta_ad" && adBudgetModeOf(n.data) === "share")
    .reduce((sum, n) => sum + (Number.isFinite(num(n.data?.budget_share_pct)) ? num(n.data?.budget_share_pct) : 0), 0);
}
