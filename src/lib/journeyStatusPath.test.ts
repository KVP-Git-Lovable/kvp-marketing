import { describe, it, expect } from "vitest";
import { journeyStatusPath, timeElapsedPct, budgetUsedPct, budgetTone } from "./journeyStatusPath";

const current = (status: string, approval?: string) => journeyStatusPath(status, approval).stages.find((s) => s.state === "current")?.key;

describe("journeyStatusPath", () => {
  it("maps draft journeys by approval", () => {
    expect(current("draft", "draft")).toBe("draft");
    expect(current("draft", "pending")).toBe("pending");
    expect(current("draft", "approved")).toBe("approved");
  });
  it("maps running states", () => {
    expect(current("scheduled", "approved")).toBe("scheduled");
    expect(current("active", "approved")).toBe("active");
    expect(current("completed", "approved")).toBe("completed");
  });
  it("marks earlier stages done and later stages todo", () => {
    const p = journeyStatusPath("active", "approved").stages.map((s) => s.state);
    expect(p).toEqual(["done", "done", "done", "done", "current", "todo"]);
  });
  it("adds chips for paused, rejected and archived", () => {
    expect(journeyStatusPath("paused", "approved").chips).toEqual([{ label: "Paused", tone: "warn" }]);
    expect(journeyStatusPath("draft", "rejected").chips).toEqual([{ label: "Rejected", tone: "bad" }]);
    expect(journeyStatusPath("archived", "approved").chips[0].label).toBe("Archived");
    expect(current("paused", "approved")).toBe("active");
  });
  it("handles unknown input as draft", () => {
    expect(current("whatever", null as unknown as string)).toBe("draft");
  });
});

describe("progress helpers", () => {
  const now = new Date("2026-11-10T00:00:00Z");
  it("computes time elapsed and clamps", () => {
    expect(timeElapsedPct("2026-11-01T00:00:00Z", "2026-11-21T00:00:00Z", now)).toBe(45);
    expect(timeElapsedPct("2026-12-01T00:00:00Z", "2026-12-10T00:00:00Z", now)).toBe(0);
    expect(timeElapsedPct("2026-10-01T00:00:00Z", "2026-10-10T00:00:00Z", now)).toBe(100);
    expect(timeElapsedPct(null, "2026-10-10T00:00:00Z", now)).toBeNull();
    expect(timeElapsedPct("2026-11-10T00:00:00Z", "2026-11-09T00:00:00Z", now)).toBeNull();
  });
  it("computes budget used and tone", () => {
    expect(budgetUsedPct(250, 1000)).toBe(25);
    expect(budgetUsedPct(250, null)).toBeNull();
    expect(budgetUsedPct(250, 0)).toBeNull();
    expect(budgetTone(50)).toBe("ok");
    expect(budgetTone(95)).toBe("warn");
    expect(budgetTone(120)).toBe("bad");
    expect(budgetTone(null)).toBe("ok");
  });
});
