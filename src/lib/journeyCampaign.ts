// Campaign-style fields on a journey (objective, window, budget, description).
// All optional: a journey without them behaves exactly as before.

export const JOURNEY_OBJECTIVES = [
  { value: "lead_generation", label: "Lead Generation" },
  { value: "engagement", label: "Engagement / Nurture" },
  { value: "awareness", label: "Awareness / Announcement" },
  { value: "conversion", label: "Sales / Conversion" },
  { value: "re_engagement", label: "Re-engagement / Win-back" },
  { value: "event_promotion", label: "Event Promotion" },
] as const;

export const objectiveLabel = (value: string | null | undefined): string | null =>
  JOURNEY_OBJECTIVES.find((o) => o.value === value)?.label ?? null;

/** ISO timestamp -> value for <input type="datetime-local"> in the viewer's timezone. */
export const toDateTimeLocal = (iso: string | null | undefined): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** datetime-local value -> ISO string, or null when blank/invalid. */
export const fromDateTimeLocal = (value: string): string | null => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** True when both dates are set and the end is not after the start. */
export const isInvalidWindow = (start: string, end: string): boolean =>
  !!start && !!end && new Date(end) <= new Date(start);
