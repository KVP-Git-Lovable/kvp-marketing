// Copy of src/lib/metaAdSchedule.ts for edge functions (keep the two in sync; the unit tests cover the src copy).
// Start/end schedule for a Meta Ad node. On Meta the schedule lives on the linked Ad Set.
// Nodes without a mode (created before this feature) are treated as "none" so nothing changes for them.

export type AdScheduleMode = "follow_journey" | "custom" | "none";

export const AD_SCHEDULE_MODES: ReadonlyArray<{ value: AdScheduleMode; label: string; hint: string }> = [
  { value: "follow_journey", label: "Follow journey dates", hint: "Uses the Start and End set on this journey campaign." },
  { value: "custom", label: "Custom dates", hint: "Set a start and end just for this ad." },
  { value: "none", label: "Don't change the ad set", hint: "Leave the ad set's schedule on Meta as it is." },
];

export const adScheduleModeOf = (data: { schedule_mode?: unknown } | null | undefined): AdScheduleMode => {
  const m = data?.schedule_mode;
  return m === "follow_journey" || m === "custom" || m === "none" ? m : "none";
};

export interface ResolvedAdSchedule {
  /** false when the node should not touch the Ad Set. */
  apply: boolean;
  /** ISO start to send to Meta; null = leave the current start alone. */
  start: string | null;
  /** ISO end to send to Meta; null = no end change. */
  end: string | null;
  errors: string[];
  warnings: string[];
}

interface NodeSchedule { schedule_mode?: unknown; ad_start_at?: string | null; ad_end_at?: string | null }
interface JourneyWindow { start_date?: string | null; end_date?: string | null }

const t = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const n = new Date(iso).getTime();
  return Number.isNaN(n) ? null : n;
};

export function resolveAdSchedule(node: NodeSchedule, journey: JourneyWindow, now: Date = new Date()): ResolvedAdSchedule {
  const mode = adScheduleModeOf(node);
  const out: ResolvedAdSchedule = { apply: mode !== "none", start: null, end: null, errors: [], warnings: [] };
  if (mode === "none") return out;

  const rawStart = mode === "custom" ? node.ad_start_at : journey.start_date;
  const rawEnd = mode === "custom" ? node.ad_end_at : journey.end_date;
  const startMs = t(rawStart);
  const endMs = t(rawEnd);
  const nowMs = now.getTime();

  if (startMs !== null) {
    if (startMs <= nowMs) out.warnings.push("Start is in the past, so the ad set's start will be left as it is.");
    else out.start = new Date(startMs).toISOString();
  }
  if (endMs !== null) {
    if (endMs <= nowMs) out.errors.push("End must be in the future.");
    else if (startMs !== null && endMs <= startMs) out.errors.push("End must be after the start.");
    else out.end = new Date(endMs).toISOString();
  }
  if (mode === "follow_journey" && startMs === null && endMs === null) {
    out.warnings.push("This journey has no start or end date, so there is nothing to apply.");
    out.apply = false;
  }
  if (mode === "custom" && startMs === null && endMs === null) {
    out.errors.push("Set a start, an end, or both.");
  }
  if (mode === "custom") {
    const js = t(journey.start_date), je = t(journey.end_date);
    if (js !== null && startMs !== null && startMs < js) out.warnings.push("Start is before the journey starts.");
    if (je !== null && endMs !== null && endMs > je) out.warnings.push("End is after the journey ends.");
  }
  return out;
}
