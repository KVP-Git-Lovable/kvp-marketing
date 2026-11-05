import { useCallback, useState } from "react";
import { BarChart3, BarChartHorizontal, LineChart as LineChartIcon, PieChart } from "lucide-react";

/**
 * The bar / horizontal-bar / line / donut switch, shared so every chart in the
 * gamification module offers the same four views and remembers the choice the
 * same way. Extracted from PointsCharts, which had the only copy.
 */
export type ChartKind = "bar" | "hbar" | "line" | "donut";

export const CHART_KINDS: { kind: ChartKind; icon: typeof BarChart3; label: string }[] = [
  { kind: "bar", icon: BarChart3, label: "Bars" },
  { kind: "hbar", icon: BarChartHorizontal, label: "Horizontal bars" },
  { kind: "line", icon: LineChartIcon, label: "Line" },
  { kind: "donut", icon: PieChart, label: "Donut" },
];

export const isChartKind = (v: unknown): v is ChartKind =>
  v === "bar" || v === "hbar" || v === "line" || v === "donut";

/**
 * Remembered per viewer under its own key, so two charts on one page do not
 * fight over a shared setting. Storage can throw (private window, blocked site
 * data), so a failure must never take the chart down with it.
 */
export function useChartKind(storageKey: string, fallback: ChartKind = "bar") {
  const [kind, setKindState] = useState<ChartKind>(() => {
    try {
      const v = localStorage.getItem(storageKey);
      if (isChartKind(v)) return v;
    } catch {
      /* ignore */
    }
    return fallback;
  });

  const setKind = useCallback(
    (k: ChartKind) => {
      setKindState(k);
      try {
        localStorage.setItem(storageKey, k);
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  );

  return [kind, setKind] as const;
}

export function ChartKindToggle({
  kind, onChange, only,
}: {
  kind: ChartKind;
  onChange: (k: ChartKind) => void;
  /** Restrict the options where a view makes no sense for the data. */
  only?: ChartKind[];
}) {
  const kinds = only ? CHART_KINDS.filter((c) => only.includes(c.kind)) : CHART_KINDS;
  return (
    <div className="flex items-center gap-0.5 rounded-[9px] border p-0.5" role="group" aria-label="Chart type">
      {kinds.map((c) => (
        <button
          key={c.kind}
          type="button"
          onClick={() => onChange(c.kind)}
          aria-pressed={kind === c.kind}
          title={c.label}
          className={`flex items-center justify-center h-7 w-8 rounded-[7px] transition-colors ${
            kind === c.kind ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <c.icon className="h-3.5 w-3.5" />
          <span className="sr-only">{c.label}</span>
        </button>
      ))}
    </div>
  );
}
