import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartType, ReportResult } from "@/lib/reportBuilder/types";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 200 70% 45%))",
  "hsl(var(--chart-3, 45 85% 50%))",
  "hsl(var(--chart-4, 340 70% 55%))",
  "hsl(var(--chart-5, 160 60% 40%))",
];

/** Max slices with a legend entry for pie / donut views. */
const PIE_TOP_N = 10;

const compact = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1e7) return `${(n / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${(n / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)} K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

interface Props {
  result: ReportResult;
  chartType: ChartType;
}

export const ReportChart = ({ result, chartType }: Props) => {
  const labelCol = result.columns.find((c) => c.type !== "number");
  const valueCols = result.columns.filter((c) => c.type === "number").slice(0, 3);
  if (!labelCol || valueCols.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
        Add at least one grouping and one measure to draw a chart.
      </div>
    );
  }

  const isPie = chartType === "pie" || chartType === "donut";

  const data = result.rows.slice(0, 25).map((r) => {
    const row: Record<string, any> = { name: String(r[labelCol.key] ?? "—") };
    valueCols.forEach((c) => (row[c.key] = Number(r[c.key] ?? 0)));
    return row;
  });

  // Pie / donut: keep only the biggest slices so the legend stays readable.
  const key = valueCols[0].key;
  const pieData = isPie
    ? (() => {
        const sorted = [...result.rows]
          .map((r) => ({ name: String(r[labelCol.key] ?? "—"), [key]: Number(r[key] ?? 0) }))
          .sort((a, b) => Number(b[key]) - Number(a[key]));
        const top = sorted.slice(0, PIE_TOP_N);
        const restTotal = sorted.slice(PIE_TOP_N).reduce((s, r) => s + Number(r[key] ?? 0), 0);
        return restTotal > 0 ? [...top, { name: "Other", [key]: restTotal }] : top;
      })()
    : [];
  const pieTotal = pieData.reduce((s, r) => s + Number(r[key] ?? 0), 0);

  return (
    <div className="h-[320px] w-full rounded-lg border bg-background p-2">
      <ResponsiveContainer width="100%" height="100%">
        {isPie ? (
          <PieChart>
            <Pie
              data={pieData}
              dataKey={key}
              nameKey="name"
              cx="38%"
              outerRadius={104}
              innerRadius={chartType === "donut" ? 60 : 0}
              paddingAngle={chartType === "donut" ? 2 : 0}
              labelLine={false}
              label={false}
              isAnimationActive={false}
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: any, name: any) => {
                const v = Number(value ?? 0);
                const pct = pieTotal ? ((v / pieTotal) * 100).toFixed(1) : "0.0";
                return [`${compact(v)} (${pct}%)`, name];
              }}
            />
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              iconSize={8}
              wrapperStyle={{
                fontSize: 10,
                lineHeight: "14px",
                maxWidth: "48%",
                maxHeight: "100%",
                overflowY: "auto",
                paddingLeft: 8,
              }}
              formatter={(value: any, entry: any) => {
                const v = Number(entry?.payload?.[key] ?? 0);
                const pct = pieTotal ? ((v / pieTotal) * 100).toFixed(1) : "0.0";
                const label = String(value ?? "");
                const short = label.length > 26 ? `${label.slice(0, 25)}…` : label;
                return (
                  <span style={{ fontSize: 10 }}>
                    {short} — {compact(v)} ({pct}%)
                  </span>
                );
              }}
            />
          </PieChart>
        ) : chartType === "line" ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {valueCols.map((c, i) => (
              <Line key={c.key} type="monotone" dataKey={c.key} name={c.label} stroke={COLORS[i % COLORS.length]} />
            ))}
          </LineChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {valueCols.map((c, i) => (
              <Bar key={c.key} dataKey={c.key} name={c.label} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};
