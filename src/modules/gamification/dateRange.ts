/** Local date, not toISOString() — in IST that reports yesterday until 05:30. */
export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Week starts Sunday to match the "This Week" option in Analytics — two screens
 * disagreeing on where a week begins is worse than either choice.
 */
export const DATE_PRESETS: { key: string; label: string; range: () => [string, string] }[] = [
  { key: "today", label: "Today", range: () => { const n = new Date(); return [isoDay(n), isoDay(n)]; } },
  { key: "week", label: "This week", range: () => {
      const n = new Date(); const s = new Date(n); s.setDate(n.getDate() - n.getDay());
      return [isoDay(s), isoDay(n)];
    } },
  { key: "month", label: "This month", range: () => {
      const n = new Date();
      return [isoDay(new Date(n.getFullYear(), n.getMonth(), 1)), isoDay(n)];
    } },
  { key: "quarter", label: "This quarter", range: () => {
      const n = new Date();
      const qStart = new Date(n.getFullYear(), Math.floor(n.getMonth() / 3) * 3, 1);
      return [isoDay(qStart), isoDay(n)];
    } },
  { key: "lastMonth", label: "Last month", range: () => {
      const n = new Date();
      return [
        isoDay(new Date(n.getFullYear(), n.getMonth() - 1, 1)),
        isoDay(new Date(n.getFullYear(), n.getMonth(), 0)),
      ];
    } },
];

/**
 * What the range control starts on. "All time" meant every screen opened on the
 * whole history, which buries the month people are actually working in and makes
 * the first paint scan the entire ledger. Both the Overview and the Points ledger
 * read this, so the two can't drift apart.
 */
export const DEFAULT_RANGE = (): [string, string] =>
  DATE_PRESETS.find((p) => p.key === "month")!.range();

/** Which preset (if any) the bounds correspond to, so a hand-typed range reads
 *  as "Custom" instead of mislabelling itself as the nearest one. */
export const presetKeyFor = (from: string, to: string) => {
  if (!from && !to) return "all";
  return DATE_PRESETS.find((p) => {
    const [f, t] = p.range();
    return f === from && t === to;
  })?.key ?? "";
};
