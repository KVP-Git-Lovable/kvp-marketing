import { describe, it, expect } from "vitest";
import { goalsForObjective, resolveAdSetPromotion } from "../../supabase/functions/_shared/metaAdSetGoals";

describe("meta ad set goals", () => {
  it("offers Lead generation for a Leads campaign and promotes the Page on the ad", () => {
    expect(goalsForObjective("OUTCOME_LEADS")).toContain("LEAD_GENERATION");
    expect(resolveAdSetPromotion({ objective: "OUTCOME_LEADS", goal: "LEAD_GENERATION", pageId: "55" })).toEqual({
      ok: true, promoted_object: { page_id: "55" }, destination_type: "ON_AD",
    });
  });

  it("refuses a lead-form ad set with no Page", () => {
    expect(resolveAdSetPromotion({ objective: "OUTCOME_LEADS", goal: "LEAD_GENERATION", pixelId: "1" }).ok).toBe(false);
  });

  it("refuses Lead generation outside a Leads campaign", () => {
    expect(resolveAdSetPromotion({ objective: "OUTCOME_TRAFFIC", goal: "LEAD_GENERATION", pageId: "55" }).ok).toBe(false);
  });

  it("refuses a Leads ad set with no pixel", () => {
    expect(resolveAdSetPromotion({ objective: "OUTCOME_LEADS", goal: "OFFSITE_CONVERSIONS" }).ok).toBe(false);
  });

  it("sends pixel + LEAD event for a Leads ad set", () => {
    expect(resolveAdSetPromotion({ objective: "OUTCOME_LEADS", goal: "OFFSITE_CONVERSIONS", pixelId: "123" })).toEqual({
      ok: true, promoted_object: { pixel_id: "123", custom_event_type: "LEAD" }, destination_type: "WEBSITE",
    });
  });

  it("sends PURCHASE by default for a Sales ad set", () => {
    const r = resolveAdSetPromotion({ objective: "OUTCOME_SALES", goal: "OFFSITE_CONVERSIONS", pixelId: "9" });
    expect(r.ok && r.promoted_object?.custom_event_type).toBe("PURCHASE");
  });

  it("leaves Traffic ad sets without a promoted object", () => {
    expect(resolveAdSetPromotion({ objective: "OUTCOME_TRAFFIC", goal: "LINK_CLICKS" })).toEqual({ ok: true });
  });

  it("rejects a goal that doesn't fit the objective", () => {
    expect(resolveAdSetPromotion({ objective: "OUTCOME_TRAFFIC", goal: "OFFSITE_CONVERSIONS", pixelId: "1" }).ok).toBe(false);
  });
});
