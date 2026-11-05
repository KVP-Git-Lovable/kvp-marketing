import { useMemo } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { ChartKindToggle, useChartKind, type ChartKind } from "./chartKind";

export interface Slice {
  id: string;
  name: string;
  points: number;
  rupees: number;
}

export interface SpendPoint {
  month: string;
  points: number;
  rupees: number;
  awards: number;
  people: number;
}

/** Enough hues for a realistic number of games or people; it cycles after. */
const HUES = [
  "#f59e0b", "#5b4ea8", "#14b8a6", "#3b82f6", "#ef4444",
  "#22c55e", "#e879f9", "#0ea5e9", "#f97316", "#64748b",
];

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const short = (s: string, n = 14) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const monthLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "2-digit" });

/**
 * One distribution — by game or by person — in whichever of the four views the
 * reader picked. Clicking any mark drills exactly like the table row does, so
 * the chart is a way in rather than a picture beside the data.
 */
export function DistributionChart({
  title, hint, rows, storageKey, onPick, valueLabel = "Points",
}: {
  title: string;
  hint: string;
  rows: Slice[];
  storageKey: string;
  onPick?: (id: string) => void;
  valueLabel?: string;
}) {
  const [kind, setKind] = useChartKind(storageKey, "bar");

  // Only rows that scored can be drawn; a zero slice is invisible in a donut
  // and a flat bar in the others, so say how many were left out instead.
  const drawn = useMemo(() => rows.filter((r) => r.points > 0).slice(0, 10), [rows]);
  const hidden = rows.length - drawn.length;

  if (!drawn.length) {
    return (
      <Block title={title} hint={hint} kind={kind} setKind={setKind}>
        <p className="text-[12.5px] text-muted-foreground py-8 text-center">
          Nothing has been earned in this period yet.
        </p>
      </Block>
    );
  }

  const data = drawn.map((r, i) => ({ ...r, label: short(r.name), fill: HUES[i % HUES.length] }));
  const click = (id?: string) => { if (id && onPick) onPick(id); };
  const tip = (v: any, _n: any, p: any) => [
    `${Number(v).toLocaleString()} pts · ${inr(p?.payload?.rupees ?? 0)}`, valueLabel,
  ];
  const height = kind === "hbar" ? Math.max(160, data.length * 30 + 30) : 240;

  return (
    <Block title={title} hint={hint} kind={kind} setKind={setKind} footer={
      hidden > 0 ? `${hidden} more with nothing earned yet` : undefined
    }>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {kind === "donut" ? (
            <PieChart>
              <Pie
                data={data} dataKey="points" nameKey="name"
                innerRadius={52} outerRadius={92} paddingAngle={2}
                onClick={(d: any) => click(d?.payload?.id)}
              >
                {data.map((d) => <Cell key={d.id} fill={d.fill} cursor={onPick ? "pointer" : undefined} />)}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10 }} formatter={tip} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          ) : kind === "line" ? (
            <LineChart data={data} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={48} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={44} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10 }} formatter={tip} />
              <Line type="monotone" dataKey="points" stroke="#5b4ea8" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          ) : kind === "hbar" ? (
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={104} />
              <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ fontSize: 12, borderRadius: 10 }} formatter={tip} />
              <Bar dataKey="points" radius={[0, 5, 5, 0]} onClick={(d: any) => click(d?.id)}>
                {data.map((d) => <Cell key={d.id} fill={d.fill} cursor={onPick ? "pointer" : undefined} />)}
              </Bar>
            </BarChart>
          ) : (
            <BarChart data={data} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={48} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={44} />
              <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ fontSize: 12, borderRadius: 10 }} formatter={tip} />
              <Bar dataKey="points" radius={[5, 5, 0, 0]} onClick={(d: any) => click(d?.id)}>
                {data.map((d) => <Cell key={d.id} fill={d.fill} cursor={onPick ? "pointer" : undefined} />)}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </Block>
  );
}

/**
 * What the scheme costs month on month. Always the full run of months so a
 * quiet month reads as a dip rather than disappearing from the axis.
 */
export function SpendTrendChart({ rows, loading }: { rows: SpendPoint[]; loading?: boolean }) {
  const [kind, setKind] = useChartKind("gam.spendChartKind", "bar");
  const data = useMemo(
    () => rows.map((r) => ({ ...r, label: monthLabel(r.month) })),
    [rows],
  );

  const total = data.reduce((s, d) => s + d.rupees, 0);
  const last = data[data.length - 1];
  const prev = data[data.length - 2];
  const delta = prev && prev.rupees > 0 ? ((last.rupees - prev.rupees) / prev.rupees) * 100 : null;

  return (
    <Block
      title="Cost of the scheme, month on month"
      hint={`${inr(total)} issued across ${data.length} months${
        delta === null ? "" : ` · ${delta >= 0 ? "+" : ""}${Math.round(delta)}% vs last month`
      }`}
      kind={kind}
      setKind={setKind}
      only={["bar", "line", "hbar"]}
    >
      {loading ? (
        <p className="text-[12.5px] text-muted-foreground py-8 text-center">Loading…</p>
      ) : (
        <div style={{ height: kind === "hbar" ? Math.max(160, data.length * 26 + 30) : 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            {kind === "line" ? (
              <LineChart data={data} margin={{ top: 6, right: 10, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={52}
                       tickFormatter={(v) => `₹${Math.round(Number(v) / 1000)}k`} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10 }}
                         formatter={(v: any, _n, p: any) => [`${inr(Number(v))} · ${p?.payload?.awards ?? 0} awards`, "Issued"]} />
                <Line type="monotone" dataKey="rupees" stroke="#178a5a" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            ) : kind === "hbar" ? (
              <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                       tickFormatter={(v) => `₹${Math.round(Number(v) / 1000)}k`} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={64} />
                <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ fontSize: 12, borderRadius: 10 }}
                         formatter={(v: any, _n, p: any) => [`${inr(Number(v))} · ${p?.payload?.awards ?? 0} awards`, "Issued"]} />
                <Bar dataKey="rupees" fill="#178a5a" radius={[0, 5, 5, 0]} />
              </BarChart>
            ) : (
              <BarChart data={data} margin={{ top: 6, right: 10, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted))" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={52}
                       tickFormatter={(v) => `₹${Math.round(Number(v) / 1000)}k`} />
                <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ fontSize: 12, borderRadius: 10 }}
                         formatter={(v: any, _n, p: any) => [`${inr(Number(v))} · ${p?.payload?.awards ?? 0} awards`, "Issued"]} />
                <Bar dataKey="rupees" fill="#178a5a" radius={[5, 5, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </Block>
  );
}

function Block({
  title, hint, kind, setKind, only, footer, children,
}: {
  title: string;
  hint: string;
  kind: ChartKind;
  setKind: (k: ChartKind) => void;
  only?: ChartKind[];
  footer?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-[20px] p-4 sm:p-5" style={{ border: "1px solid #e6e8f0" }}>
      <div className="flex items-start gap-3 mb-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-[13px] font-bold leading-tight">{title}</p>
          <p className="text-[11.5px] text-muted-foreground mt-0.5">{hint}</p>
        </div>
        <div className="ml-auto shrink-0">
          <ChartKindToggle kind={kind} onChange={setKind} only={only} />
        </div>
      </div>
      {children}
      {footer && <p className="text-[11px] text-muted-foreground mt-2">{footer}</p>}
    </div>
  );
}
