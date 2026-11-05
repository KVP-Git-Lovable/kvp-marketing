import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

export interface SkuDatum {
  name: string;
  value: number;
}

const PALETTE = [
  'hsl(var(--primary))',
  'hsl(200 70% 45%)',
  'hsl(45 85% 50%)',
  'hsl(340 70% 55%)',
  'hsl(160 60% 40%)',
  'hsl(265 60% 55%)',
  'hsl(25 80% 52%)',
  'hsl(190 55% 38%)',
];
const OTHER_COLOR = 'hsl(var(--muted-foreground))';

/** Compact Indian-format money, e.g. ₹1.2L, ₹12.5L, ₹3.4Cr */
export function formatShortINR(amount: number): string {
  const n = Number(amount) || 0;
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a >= 10000000) return `${sign}₹${(a / 10000000).toFixed(1)}Cr`;
  if (a >= 100000) return `${sign}₹${(a / 100000).toFixed(1)}L`;
  if (a >= 1000) return `${sign}₹${(a / 1000).toFixed(1)}K`;
  return `${sign}₹${a.toFixed(0)}`;
}

interface Props {
  data: SkuDatum[];
  /** Max slices shown individually before grouping into "Other SKUs" */
  maxSlices?: number;
  /** Period shown in the title, e.g. "This Month" */
  periodLabel?: string;
}

export function BeatSkuPieCard({ data, maxSlices = 7, periodLabel = 'Last 6M' }: Props) {

  const { slices, total } = useMemo(() => {
    const clean = (data || [])
      .map((d) => ({ name: d.name || 'Unnamed SKU', value: Number(d.value) || 0 }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);

    const sum = clean.reduce((s, d) => s + d.value, 0);
    if (clean.length <= maxSlices) return { slices: clean, total: sum };

    const head = clean.slice(0, maxSlices);
    const restValue = clean.slice(maxSlices).reduce((s, d) => s + d.value, 0);
    return {
      slices: [...head, { name: `Other SKUs (${clean.length - maxSlices})`, value: restValue }],
      total: sum,
    };
  }, [data, maxSlices]);

  const colorFor = (i: number) =>
    slices[i]?.name.startsWith('Other SKUs') ? OTHER_COLOR : PALETTE[i % PALETTE.length];

  return (
    <Card className="shadow-card h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Package size={20} className="text-primary" />
          Sales by Product SKU ({periodLabel})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {slices.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            No product sales data available
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,220px)_minmax(0,1fr)] gap-4 items-center">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={82}
                    paddingAngle={1}
                    dataKey="value"
                    nameKey="name"
                    isAnimationActive={false}
                  >
                    {slices.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={colorFor(index)} stroke="hsl(var(--background))" />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value: number, name: string) => [
                      `${formatShortINR(value)}${total ? ` · ${((value / total) * 100).toFixed(1)}%` : ''}`,
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend with values — sorted highest to lowest */}
            <ul className="space-y-1.5 max-h-64 overflow-auto pr-1">
              {slices.map((s, i) => (
                <li key={s.name} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: colorFor(i) }}
                  />
                  <span className="truncate flex-1 min-w-0" title={s.name}>
                    {s.name}
                  </span>
                  <span className="font-semibold tabular-nums">{formatShortINR(s.value)}</span>
                  <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
                    {total ? `${((s.value / total) * 100).toFixed(1)}%` : '—'}
                  </span>
                </li>
              ))}
              <li className="flex items-center gap-2 text-sm border-t pt-1.5 mt-1.5">
                <span className="flex-1 text-muted-foreground">Total</span>
                <span className="font-bold tabular-nums">{formatShortINR(total)}</span>
                <span className="w-12" />
              </li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
