import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import { useRetailerInsights } from '@/hooks/useRetailerInsights';
import { RetailerInsightLine } from '@/components/RetailerInsightLine';
import {
  useBeatRetailerIntelligence,
  type BeatRetailerInput,
  type RetailerIntel,
  type RetailerState,
} from '@/hooks/useBeatRetailerIntelligence';

interface Props {
  retailers: BeatRetailerInput[];
  beatName: string;
  ownerName?: string | null;
  onOpenRetailer: (retailer: BeatRetailerInput) => void;
}

const STATES: Record<RetailerState, { label: string; text: string; bg: string; dot: string }> = {
  growing: { label: 'Growing', text: 'text-success', bg: 'bg-success/10', dot: 'bg-success' },
  steady: { label: 'Steady', text: 'text-success', bg: 'bg-success/10', dot: 'bg-success/70' },
  new: { label: 'New', text: 'text-primary', bg: 'bg-primary/10', dot: 'bg-primary' },
  slipping: { label: 'Slipping', text: 'text-warning', bg: 'bg-warning/10', dot: 'bg-warning' },
  at_risk: { label: 'At risk', text: 'text-destructive', bg: 'bg-destructive/10', dot: 'bg-destructive' },
  never_started: { label: 'Never started', text: 'text-destructive', bg: 'bg-destructive/10', dot: 'bg-destructive/70' },
  dormant: { label: 'Dormant', text: 'text-muted-foreground', bg: 'bg-muted', dot: 'bg-muted-foreground' },
  prospect: { label: 'Prospect', text: 'text-primary', bg: 'bg-primary/10', dot: 'bg-primary/60' },
};

const ORDER: RetailerState[] = ['growing', 'steady', 'new', 'slipping', 'at_risk', 'never_started', 'dormant', 'prospect'];

const inr = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(2)}L` : n >= 1000 ? `₹${(n / 1000).toFixed(1)}k` : `₹${Math.round(n)}`;

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';

function verdict(r: RetailerIntel): string {
  const stake = r.risk ? `${inr(r.risk)} at stake.` : '';
  const objection = r.lastObjection ? ` Last logged reason: "${r.lastObjection}".` : '';
  switch (r.state) {
    case 'growing':
      return `Growing — momentum is ${r.momentum! > 0 ? '+' : ''}${r.momentum}%${r.rhythmDays ? ` on a ${r.rhythmDays}-day ordering rhythm` : ''}. Protect the rhythm and work on a bigger basket.`;
    case 'steady':
      return `Steady — ordering ${r.rhythmDays ? `about every ${r.rhythmDays} days` : 'on schedule'}${r.aov ? ` at ${inr(r.aov)} a time` : ''}. No intervention needed right now.`;
    case 'new':
      return `New — first order ${r.daysSinceOrder ?? '—'} days ago${r.value90 ? ` worth ${inr(r.value90)}` : ''}. The second order is what matters; prioritise a repeat.`;
    case 'slipping':
      return `Slipping — sales are down ${Math.abs(r.momentum ?? 0)}%${r.overdue ? ` and it is ${r.overdue}× past its usual ${r.rhythmDays}-day cycle` : ''}.${objection} Still recoverable.`;
    case 'at_risk':
      return `At risk — ${r.overdue ? `${r.overdue}× overdue` : 'well past its cycle'}, silent for ${r.daysSinceOrder} days. ${stake}${objection}`;
    case 'never_started':
      return `Never started — one order of ${inr(r.value90 || r.valueFY)} ${r.daysSinceOrder} days ago and no repeat. Onboarded but not activated.`;
    case 'dormant':
      return `Dormant — no order in ${r.daysSinceOrder} days after ${r.ordersTotalRecent} orders. Treat as a fresh pitch, not a rescue.`;
    case 'prospect':
    default:
      return `Prospect — ${r.visits} visit${r.visits === 1 ? '' : 's'}, no order yet.${objection} ${r.visits >= 5 ? 'Convert this month or review the route.' : 'Keep working on conversion.'}`;
  }
}

const Momentum = ({ r }: { r: RetailerIntel }) => {
  if (r.momentum === null) return <span className="text-muted-foreground">—</span>;
  const cls =
    r.momentum >= 15 ? 'text-success' : r.momentum <= -25 ? 'text-destructive' : r.momentum < 0 ? 'text-warning' : 'text-muted-foreground';
  return <span className={cls}>{r.momentum > 0 ? '+' : ''}{r.momentum}%</span>;
};

const Overdue = ({ r }: { r: RetailerIntel }) => {
  if (!r.ordersTotalRecent) return <span className="text-muted-foreground">never</span>;
  if (!r.overdue) return <span className="text-muted-foreground">{r.daysSinceOrder}d</span>;
  const cls = r.overdue >= 2 ? 'text-destructive' : r.overdue >= 1.5 ? 'text-warning' : 'text-success';
  return (
    <div>
      <span className={cls}>{r.overdue}×</span>
      <div className="text-[11px] text-muted-foreground">{r.daysSinceOrder}d ago</div>
    </div>
  );
};

const PremiumBar = ({ r }: { r: RetailerIntel }) => {
  if (r.premiumMix === null) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block h-1.5 w-14 overflow-hidden rounded-full bg-muted">
        <span
          className={cn('block h-full', r.premiumMix >= 70 ? 'bg-success' : 'bg-warning')}
          style={{ width: `${r.premiumMix}%` }}
        />
      </span>
      <span className="text-[11px] text-muted-foreground">{r.premiumMix}%</span>
    </div>
  );
};

export const BeatRetailerIntelligence = ({ retailers, beatName, ownerName, onOpenRetailer }: Props) => {
  const { rows, counts, summary, loading } = useBeatRetailerIntelligence(retailers);
  const retailerInsights = useRetailerInsights(retailers);
  const [active, setActive] = useState<'all' | RetailerState>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = useMemo(
    () =>
      rows
        .filter(r => active === 'all' || r.state === active)
        .sort((a, b) => b.risk - a.risk || (b.value90 || b.valueFY) - (a.value90 || a.valueFY)),
    [rows, active]
  );

  const selected = rows.find(r => r.id === selectedId) || null;
  const visibleStates = ORDER.filter(s => counts[s] > 0);

  if (loading && !rows.length) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Loading retailer intelligence...</p>;
  }
  if (!rows.length) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No retailers assigned to this beat</p>;
  }

  return (
    <div className="space-y-4">
      {/* Beat health header */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{beatName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {ownerName ? `${ownerName} · ` : ''}{summary.total} retailers · as at {fmtDate(new Date().toISOString())}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xl font-semibold leading-none">{inr(summary.value90)}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              last 90 days · FY {inr(summary.valueFY)}
            </div>
          </div>
        </div>

        <div className="space-y-3 px-4 py-3">
          {/* distribution strip */}
          <div className="flex h-2 overflow-hidden rounded-full">
            {visibleStates.map(s => (
              <span
                key={s}
                className={STATES[s].dot}
                style={{ width: `${(counts[s] / summary.total) * 100}%` }}
                title={`${STATES[s].label}: ${counts[s]}`}
              />
            ))}
          </div>

          {/* summary numbers */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4 lg:grid-cols-7">
            {[
              ['Total', String(summary.total)],
              ['Active', String(summary.active)],
              ['At risk', String(summary.atRisk)],
              ['New', String(summary.newCount)],
              ['Dormant', String(summary.dormant)],
              ['Avg order', summary.aov ? inr(summary.aov) : '—'],
              ['Last visit / order', `${fmtDate(summary.lastVisit)} · ${fmtDate(summary.lastOrder)}`],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0">
                <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{k}</p>
                <p className="truncate font-medium">{v}</p>
              </div>
            ))}
          </div>

          {/* filter chips */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => { setActive('all'); setSelectedId(null); }}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                active === 'all' ? 'border-foreground bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              <span className="font-medium text-foreground">{summary.total}</span> All
            </button>
            {visibleStates.map(s => (
              <button
                key={s}
                onClick={() => { setActive(s); setSelectedId(null); }}
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                  active === s ? 'border-foreground bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted'
                )}
              >
                <span className={cn('h-2 w-2 rounded-full', STATES[s].dot)} />
                <span className="font-medium text-foreground">{counts[s]}</span> {STATES[s].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Retailer table */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-medium">{active === 'all' ? 'All retailers' : STATES[active].label}</p>
          <p className="text-xs text-muted-foreground">
            {active === 'all'
              ? 'Sorted by value at stake — the ones to act on first'
              : `${list.length} retailer${list.length === 1 ? '' : 's'} in this state`}
          </p>
        </div>

        {list.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">No retailers in this state.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 pb-2 pt-3 text-left font-normal">Retailer</th>
                  <th className="px-3 pb-2 pt-3 text-left font-normal">State</th>
                  <th className="px-3 pb-2 pt-3 text-right font-normal">Value</th>
                  <th className="hidden px-3 pb-2 pt-3 text-right font-normal md:table-cell">Momentum</th>
                  <th className="px-3 pb-2 pt-3 text-right font-normal">Overdue</th>
                  <th className="hidden px-3 pb-2 pt-3 text-left font-normal lg:table-cell">Premium</th>
                </tr>
              </thead>
              <tbody>
                {list.map(r => {
                  const s = STATES[r.state];
                  const isSel = selectedId === r.id;
                  return (
                    <tr
                      key={r.id}
                      tabIndex={0}
                      onClick={() => setSelectedId(isSel ? null : r.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedId(isSel ? null : r.id);
                        }
                      }}
                      className={cn(
                        'cursor-pointer border-t align-top outline-none transition-colors hover:bg-muted/50',
                        isSel && 'bg-muted/60'
                      )}
                    >
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{r.name}</div>
                        <RetailerInsightLine
                          line={retailerInsights.get(r.id)}
                          className="mt-1 max-w-sm"
                        />
                        <div className="text-[11px] text-muted-foreground">
                          Category {r.categoryGrade} · behaves {r.grade}
                        </div>
                        {r.flags.map(f => (
                          <span
                            key={f}
                            className="mr-1 mt-1 inline-block rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive"
                          >
                            {f}
                          </span>
                        ))}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={cn('inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px]', s.bg, s.text)}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {r.value90 || r.valueFY ? inr(r.value90 || r.valueFY) : '—'}
                        {r.risk > 0 && (
                          <div className="text-[11px] text-destructive">{inr(r.risk)} at risk</div>
                        )}
                      </td>
                      <td className="hidden px-3 py-2.5 text-right md:table-cell"><Momentum r={r} /></td>
                      <td className="px-3 py-2.5 text-right"><Overdue r={r} /></td>
                      <td className="hidden px-3 py-2.5 lg:table-cell"><PremiumBar r={r} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Retailer detail panel */}
      {selected && (
        <div className="rounded-lg border bg-card">
          <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{selected.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Category {selected.categoryGrade} · behaves like {selected.grade} · {selected.visits} visits, {selected.ordersTotalRecent} orders
              </p>
            </div>
            <span
              className={cn(
                'shrink-0 rounded-full px-2 py-0.5 text-[11px]',
                STATES[selected.state].bg,
                STATES[selected.state].text
              )}
            >
              {STATES[selected.state].label}
            </span>
          </div>
          <div className="space-y-3 px-4 py-3">
            <p
              className={cn(
                'rounded-md px-3 py-2 text-[13px] leading-relaxed',
                STATES[selected.state].bg,
                STATES[selected.state].text
              )}
            >
              {verdict(selected)}
            </p>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {([
                ['Value', selected.value90 ? inr(selected.value90) : '—', '90 days'],
                ['Momentum', selected.momentum !== null ? `${selected.momentum > 0 ? '+' : ''}${selected.momentum}%` : '—', 'vs own average'],
                ['Rhythm', selected.rhythmDays ? `${selected.rhythmDays} days` : '—', selected.rhythmDays ? 'median gap' : 'no pattern yet'],
                ['Overdue', selected.overdue ? `${selected.overdue}×` : '—', selected.daysSinceOrder !== null ? `${selected.daysSinceOrder} days since` : 'never ordered'],
                ['Avg order', selected.aov ? inr(selected.aov) : '—', `${selected.orders90} orders (90d)`],
                ['Conversion', `${selected.ordersTotalRecent}/${selected.visits || '—'}`, selected.lastObjection ? `last: "${selected.lastObjection}"` : 'no reasons logged'],
                ['Premium mix', selected.premiumMix !== null ? `${selected.premiumMix}%` : '—', 'of value'],
                ['Grade', `${selected.categoryGrade} → ${selected.grade}`, selected.flags.includes('grade gap') ? 'underperforming' : 'as expected'],
              ] as [string, string, string][]).map(([k, v, n]) => (
                <div key={k} className="rounded-md bg-muted/50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</p>
                  <p className="mt-0.5 text-base font-medium">{v}</p>
                  <p className="text-[11px] text-muted-foreground">{n}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">FY value {selected.valueFY ? inr(selected.valueFY) : '—'}</Badge>
                <Badge variant="outline">Last visit {fmtDate(selected.last_visit_date)}</Badge>
                <Badge variant="outline">Last order {fmtDate(selected.lastOrderDate)}</Badge>
              </div>
              <Button variant="outline" size="sm" onClick={() => onOpenRetailer(selected)}>
                Open retailer <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BeatRetailerIntelligence;
