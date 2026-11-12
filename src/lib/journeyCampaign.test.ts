import { describe, it, expect } from "vitest";
import { expectedRoiPct, isBlankOrInRange } from "./journeyCampaign";

describe("expectedRoiPct", () => {
  it("computes ROI from revenue and budget", () => expect(expectedRoiPct(25000, 5000)).toBe(400));
  it("returns null when budget or revenue is missing or budget is zero", () => {
    expect(expectedRoiPct(25000, null)).toBeNull();
    expect(expectedRoiPct("", 5000)).toBeNull();
    expect(expectedRoiPct(100, 0)).toBeNull();
  });
  it("can be negative", () => expect(expectedRoiPct(2500, 5000)).toBe(-50));
});
describe("isBlankOrInRange", () => {
  it("accepts blank and in-range values", () => {
    expect(isBlankOrInRange("", 0, 100)).toBe(true);
    expect(isBlankOrInRange("45.5", 0, 100)).toBe(true);
  });
  it("rejects out of range or non-numeric", () => {
    expect(isBlankOrInRange("101", 0, 100)).toBe(false);
    expect(isBlankOrInRange("-1", 0)).toBe(false);
    expect(isBlankOrInRange("abc", 0)).toBe(false);
  });
});
