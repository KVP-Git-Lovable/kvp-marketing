// Salesforce-style status path for a journey: Draft -> Pending approval -> Approved -> Scheduled -> Active -> Completed.

export type PathStageKey = "draft" | "pending" | "approved" | "scheduled" | "active" | "completed";
export type PathStageState = "done" | "current" | "todo";

export const PATH_STAGES: ReadonlyArray<{ key: PathStageKey; label: string }> = [
  { key: "draft", label: "Draft" },
  { key: "pending", label: "Pending approval" },
  { key: "approved", label: "Approved" },
  { key: "scheduled", label: "Scheduled" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
];

export interface JourneyPath {
  stages: Array<{ key: PathStageKey; label: string; state: PathStageState }>;
  chips: Array<{ label: string; tone: "warn" | "bad" | "muted" }>;
}

export function journeyStatusPath(status: string | null | undefined, approval: string | null | undefined): JourneyPath {
  const chips: JourneyPath["chips"] = [];
  let current = 0;
  switch (status) {
    case "completed": current = 5; break;
    case "archived": current = 5; chips.push({ label: "Archived", tone: "muted" }); break;
    case "active": current = 4; break;
    case "paused": current = 4; chips.push({ label: "Paused", tone: "warn" }); break;
    case "scheduled": current = 3; break;
    default:
      if (approval === "approved") current = 2;
      else if (approval === "pending") current = 1;
      else current = 0;
  }
  if (approval === "rejected") chips.push({ label: "Rejected", tone: "bad" });
  return {
    stages: PATH_STAGES.map((s, i) => ({ ...s, state: i < current ? "done" : i === current ? "current" : "todo" })),
    chips,
  };
}

/** Time elapsed between start and end as 0-100, or null when either date is missing/invalid. */
export function timeElapsedPct(start: string | null | undefined, end: string | null | undefined, now: Date = new Date()): number | null {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return null;
  return Math.max(0, Math.min(100, ((now.getTime() - s) / (e - s)) * 100));
}

/** Budget used as a percentage of the cap, or null when there is no cap. */
export function budgetUsedPct(used: number, cap: number | null | undefined): number | null {
  if (cap === null || cap === undefined || !Number.isFinite(Number(cap)) || Number(cap) <= 0) return null;
  return (used / Number(cap)) * 100;
}

/** Colour band for a progress value (amber above 90%, red above 100%). */
export const budgetTone = (pct: number | null): "ok" | "warn" | "bad" => (pct === null ? "ok" : pct > 100 ? "bad" : pct > 90 ? "warn" : "ok");
