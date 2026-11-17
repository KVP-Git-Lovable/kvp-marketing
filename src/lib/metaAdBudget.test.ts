import { describe, it, expect } from "vitest";
import { adBudgetModeOf, resolveAdBudget, totalSharePct } from "./metaAdBudget";

const end = "2026-12-31T10:00:00.000Z";

describe("adBudgetModeOf", () => {
  it("treats missing or unknown as none", () => {
    expect(adBudgetModeOf({})).toBe("none");
    expect(adBudgetModeOf({ budget_mode: "x" })).toBe("none");
    expect(adBudgetModeOf(null)).toBe("none");
  });
});

describe("resolveAdBudget", () => {
  it("does nothing in none mode", () => {
    expect(resolveAdBudget({}, 10000, end).apply).toBe(false);
  });
  it("share: lifetime budget as a percentage of the cap", () => {
    const r = resolveAdBudget({ budget_mode: "share", budget_share_pct: 50 }, 10000, end);
    expect(r).toMatchObject({ apply: true, type: "lifetime", amount: 5000, errors: [] });
  });
  it("share: rounds to two decimals", () => {
    expect(resolveAdBudget({ budget_mode: "share", budget_share_pct: 33.333 }, 1000, end).amount).toBe(333.33);
  });
  it("share: needs a cap, a valid percentage and an end date", () => {
    expect(resolveAdBudget({ budget_mode: "share", budget_share_pct: 50 }, null, end).errors[0]).toMatch(/Budget Cap/);
    expect(resolveAdBudget({ budget_mode: "share", budget_share_pct: 0 }, 1000, end).errors[0]).toMatch(/between 1 and 100/);
    expect(resolveAdBudget({ budget_mode: "share", budget_share_pct: 120 }, 1000, end).errors[0]).toMatch(/between 1 and 100/);
    expect(resolveAdBudget({ budget_mode: "share", budget_share_pct: 50 }, 1000, null).errors[0]).toMatch(/end date/);
  });
  it("custom: daily by default, lifetime needs an end date", () => {
    expect(resolveAdBudget({ budget_mode: "custom", budget_custom_amount: 500 }, null, null)).toMatchObject({ type: "daily", amount: 500, errors: [] });
    expect(resolveAdBudget({ budget_mode: "custom", budget_custom_amount: 500, budget_custom_type: "lifetime" }, null, null).errors[0]).toMatch(/end date/);
    expect(resolveAdBudget({ budget_mode: "custom", budget_custom_amount: 0 }, null, end).errors[0]).toMatch(/greater than zero/);
  });
  it("custom: warns when a lifetime amount exceeds the journey cap", () => {
    const r = resolveAdBudget({ budget_mode: "custom", budget_custom_amount: 20000, budget_custom_type: "lifetime" }, 10000, end);
    expect(r.errors).toEqual([]);
    expect(r.warnings.length).toBe(1);
  });
});

describe("totalSharePct", () => {
  it("sums only Meta Ad nodes in share mode", () => {
    expect(totalSharePct([
      { type: "meta_ad", data: { budget_mode: "share", budget_share_pct: 60 } },
      { type: "meta_ad", data: { budget_mode: "share", budget_share_pct: "30" } },
      { type: "meta_ad", data: { budget_mode: "custom", budget_custom_amount: 100 } },
      { type: "message", data: {} },
    ])).toBe(90);
  });
});
