import { describe, it, expect } from "vitest";
import { resolveAdSchedule, adScheduleModeOf } from "./metaAdSchedule";

const now = new Date("2026-11-13T10:00:00Z");
const future = (d: number) => new Date(now.getTime() + d * 86400000).toISOString();
const past = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();

describe("adScheduleModeOf", () => {
  it("treats missing or unknown mode as none", () => {
    expect(adScheduleModeOf({})).toBe("none");
    expect(adScheduleModeOf({ schedule_mode: "weird" })).toBe("none");
    expect(adScheduleModeOf(null)).toBe("none");
  });
});

describe("resolveAdSchedule", () => {
  it("does nothing in none mode", () => {
    expect(resolveAdSchedule({ schedule_mode: "none" }, { start_date: future(1), end_date: future(5) }, now).apply).toBe(false);
    expect(resolveAdSchedule({}, { start_date: future(1) }, now).apply).toBe(false);
  });
  it("follows the journey window", () => {
    const r = resolveAdSchedule({ schedule_mode: "follow_journey" }, { start_date: future(1), end_date: future(8) }, now);
    expect(r).toMatchObject({ apply: true, start: future(1), end: future(8), errors: [] });
  });
  it("leaves a past start alone but still applies the end", () => {
    const r = resolveAdSchedule({ schedule_mode: "follow_journey" }, { start_date: past(2), end_date: future(3) }, now);
    expect(r.start).toBeNull();
    expect(r.end).toBe(future(3));
    expect(r.warnings.length).toBe(1);
  });
  it("skips when the journey has no dates", () => {
    const r = resolveAdSchedule({ schedule_mode: "follow_journey" }, {}, now);
    expect(r.apply).toBe(false);
  });
  it("uses custom dates and validates them", () => {
    const ok = resolveAdSchedule({ schedule_mode: "custom", ad_start_at: future(1), ad_end_at: future(2) }, {}, now);
    expect(ok.errors).toEqual([]);
    expect(ok.start).toBe(future(1));
    const bad = resolveAdSchedule({ schedule_mode: "custom", ad_start_at: future(3), ad_end_at: future(2) }, {}, now);
    expect(bad.errors).toContain("End must be after the start.");
    const pastEnd = resolveAdSchedule({ schedule_mode: "custom", ad_end_at: past(1) }, {}, now);
    expect(pastEnd.errors).toContain("End must be in the future.");
    const empty = resolveAdSchedule({ schedule_mode: "custom" }, {}, now);
    expect(empty.errors).toContain("Set a start, an end, or both.");
  });
  it("warns when custom dates fall outside the journey window", () => {
    const r = resolveAdSchedule(
      { schedule_mode: "custom", ad_start_at: future(1), ad_end_at: future(20) },
      { start_date: future(2), end_date: future(10) }, now,
    );
    expect(r.warnings.length).toBe(2);
    expect(r.errors).toEqual([]);
  });
});
