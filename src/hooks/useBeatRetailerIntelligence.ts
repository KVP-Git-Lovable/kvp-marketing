import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type RetailerState =
  | 'growing'
  | 'steady'
  | 'new'
  | 'slipping'
  | 'at_risk'
  | 'never_started'
  | 'dormant'
  | 'prospect';

export interface BeatRetailerInput {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  category?: string;
  priority?: string;
  last_visit_date?: string;
  order_value?: number;
  fyOrderValue?: number;
}

export interface RetailerIntel extends BeatRetailerInput {
  value90: number;            // confirmed order value, last 90 days
  valueFY: number;            // confirmed order value, current FY
  orders90: number;
  ordersTotalRecent: number;
  lastOrderDate: string | null;
  daysSinceOrder: number | null;
  rhythmDays: number | null;  // median gap between orders
  overdue: number | null;     // multiple of rhythm
  momentum: number | null;    // % recent half vs own average
  aov: number | null;
  visits: number;
  lastObjection: string | null;
  premiumMix: number | null;  // % of value from above-average-rate items
  grade: string;              // behavioural grade from value
  categoryGrade: string;      // assigned category/grade
  flags: string[];
  state: RetailerState;
  risk: number;               // value at stake
}

export interface BeatIntelSummary {
  total: number;
  active: number;
  atRisk: number;
  newCount: number;
  dormant: number;
  value90: number;
  valueFY: number;
  aov: number | null;
  lastVisit: string | null;
  lastOrder: string | null;
}

const DAY = 864e5;
const daysBetween = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / DAY);

const median = (nums: number[]): number | null => {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

const gradeRank: Record<string, number> = { A: 3, B: 2, C: 1, '—': 0 };

const normaliseCategory = (c?: string): string => {
  if (!c) return '—';
  const t = c.trim().toUpperCase();
  if (t === 'A' || t === 'B' || t === 'C') return t;
  if (t.includes('PLATINUM') || t.includes('GOLD') || t.includes('KEY')) return 'A';
  if (t.includes('SILVER') || t.includes('GENERAL')) return 'B';
  if (t.includes('BRONZE') || t.includes('SMALL')) return 'C';
  return '—';
};

function fyStart(now = new Date()) {
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(y, 3, 1);
}

export function useBeatRetailerIntelligence(retailers: BeatRetailerInput[] | undefined) {
  const [rows, setRows] = useState<RetailerIntel[]>([]);
  const [loading, setLoading] = useState(false);

  const ids = useMemo(() => (retailers || []).map(r => r.id).sort().join(','), [retailers]);

  useEffect(() => {
    const list = retailers || [];
    if (!list.length) {
      setRows([]);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        const retailerIds = list.map(r => r.id);
        const now = new Date();
        const from90 = new Date(now.getTime() - 90 * DAY);
        const from365 = new Date(now.getTime() - 365 * DAY);
        const fy = fyStart(now);
        const historyFrom = new Date(Math.min(from365.getTime(), fy.getTime()));

        const [ordersRes, visitsRes] = await Promise.all([
          supabase
            .from('orders')
            .select('id, retailer_id, total_amount, created_at')
            .in('retailer_id', retailerIds)
            .eq('status', 'confirmed')
            .gte('created_at', historyFrom.toISOString())
            .order('created_at', { ascending: false })
            .limit(5000),
          supabase
            .from('visits')
            .select('retailer_id, status, planned_date, no_order_reason')
            .in('retailer_id', retailerIds)
            .gte('planned_date', from365.toISOString().slice(0, 10))
            .order('planned_date', { ascending: false })
            .limit(5000),
        ]);

        const orders = ordersRes.data || [];
        const visits = visitsRes.data || [];

        // Order items for premium-mix (only for orders in the 90-day window)
        const recentOrderIds = orders
          .filter(o => new Date(o.created_at) >= from90)
          .map(o => o.id);
        let items: { order_id: string; rate: number | null; total: number | null }[] = [];
        if (recentOrderIds.length) {
          const chunk = 250;
          for (let i = 0; i < recentOrderIds.length; i += chunk) {
            const { data } = await supabase
              .from('order_items')
              .select('order_id, rate, total')
              .in('order_id', recentOrderIds.slice(i, i + chunk));
            if (data) items = items.concat(data as any);
          }
        }

        // Beat-wide average unit rate defines "premium"
        const rates = items.map(i => Number(i.rate) || 0).filter(r => r > 0);
        const avgRate = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;

        const orderToRetailer = new Map(orders.map(o => [o.id, o.retailer_id]));
        const premiumByRetailer = new Map<string, { prem: number; all: number }>();
        items.forEach(it => {
          const rid = orderToRetailer.get(it.order_id);
          if (!rid) return;
          const val = Number(it.total) || 0;
          const acc = premiumByRetailer.get(rid) || { prem: 0, all: 0 };
          acc.all += val;
          if (avgRate > 0 && (Number(it.rate) || 0) > avgRate) acc.prem += val;
          premiumByRetailer.set(rid, acc);
        });

        const byRetailer = new Map<string, typeof orders>();
        orders.forEach(o => {
          const arr = byRetailer.get(o.retailer_id) || [];
          arr.push(o);
          byRetailer.set(o.retailer_id, arr);
        });

        const visitsByRetailer = new Map<string, typeof visits>();
        visits.forEach(v => {
          const arr = visitsByRetailer.get(v.retailer_id) || [];
          arr.push(v);
          visitsByRetailer.set(v.retailer_id, arr);
        });

        const enriched: RetailerIntel[] = list.map(r => {
          const ro = (byRetailer.get(r.id) || []).slice().sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          const recent = ro.filter(o => new Date(o.created_at) >= from90);
          const value90 = recent.reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
          const valueFY = ro
            .filter(o => new Date(o.created_at) >= fy)
            .reduce((s, o) => s + (Number(o.total_amount) || 0), 0);

          const lastOrderDate = ro.length ? ro[0].created_at : null;
          const daysSinceOrder = lastOrderDate ? daysBetween(now, new Date(lastOrderDate)) : null;

          // rhythm: median gap across the last up-to-6 orders
          const dates = ro.slice(0, 6).map(o => new Date(o.created_at).getTime());
          const gaps: number[] = [];
          for (let i = 0; i < dates.length - 1; i++) gaps.push(Math.round((dates[i] - dates[i + 1]) / DAY));
          const rhythmDays = median(gaps.filter(g => g > 0));
          const overdue =
            rhythmDays && daysSinceOrder !== null ? Number((daysSinceOrder / rhythmDays).toFixed(1)) : null;

          // momentum: last 45 days vs prior 45 days
          const mid = new Date(now.getTime() - 45 * DAY);
          const lastHalf = recent
            .filter(o => new Date(o.created_at) >= mid)
            .reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
          const priorHalf = recent
            .filter(o => new Date(o.created_at) < mid)
            .reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
          const momentum =
            priorHalf > 0
              ? Math.round(((lastHalf - priorHalf) / priorHalf) * 100)
              : lastHalf > 0
                ? 100
                : ro.length
                  ? -100
                  : null;

          const orders90 = recent.length;
          const aov = orders90 ? Math.round(value90 / orders90) : null;

          const rv = visitsByRetailer.get(r.id) || [];
          const visitCount = rv.length;
          const lastObjection = rv.find(v => v.no_order_reason)?.no_order_reason || null;

          const pm = premiumByRetailer.get(r.id);
          const premiumMix = pm && pm.all > 0 ? Math.round((pm.prem / pm.all) * 100) : null;

          // behavioural grade from 90-day value
          const grade =
            !value90 ? '—' : value90 >= 20000 ? 'A' : value90 >= 8000 ? 'B' : 'C';
          const categoryGrade = normaliseCategory(r.category);

          let state: RetailerState;
          if (!ro.length) state = 'prospect';
          else if (ro.length === 1 && (daysSinceOrder ?? 0) > 60) state = 'never_started';
          else if (ro.length === 1) state = 'new';
          else if ((daysSinceOrder ?? 0) > 75) state = 'dormant';
          else if (overdue !== null && overdue >= 2) state = 'at_risk';
          else if ((overdue !== null && overdue >= 1.5) || (momentum !== null && momentum <= -25)) state = 'slipping';
          else if (momentum !== null && momentum >= 15) state = 'growing';
          else state = 'steady';

          const flags: string[] = [];
          if (gradeRank[categoryGrade] - gradeRank[grade] >= 2) flags.push('grade gap');
          if (!ro.length && visitCount >= 5) flags.push('effort sink');

          const baseValue = value90 || valueFY;
          const risk =
            state === 'prospect'
              ? 0
              : Math.round(baseValue * (overdue ? Math.min(overdue / 3, 1) : ro.length === 1 ? 0.7 : 0.3));

          return {
            ...r,
            value90,
            valueFY,
            orders90,
            ordersTotalRecent: ro.length,
            lastOrderDate,
            daysSinceOrder,
            rhythmDays,
            overdue,
            momentum,
            aov,
            visits: visitCount,
            lastObjection,
            premiumMix,
            grade,
            categoryGrade,
            flags,
            state,
            risk,
          };
        });

        if (!cancelled) setRows(enriched);
      } catch (e) {
        console.error('Beat retailer intelligence failed:', e);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  const counts = useMemo(() => {
    const c: Record<RetailerState, number> = {
      growing: 0, steady: 0, new: 0, slipping: 0, at_risk: 0, never_started: 0, dormant: 0, prospect: 0,
    };
    rows.forEach(r => { c[r.state] += 1; });
    return c;
  }, [rows]);

  const summary = useMemo<BeatIntelSummary>(() => {
    const value90 = rows.reduce((s, r) => s + r.value90, 0);
    const valueFY = rows.reduce((s, r) => s + r.valueFY, 0);
    const totalOrders = rows.reduce((s, r) => s + r.orders90, 0);
    const lastVisitTs = rows
      .map(r => (r.last_visit_date ? new Date(r.last_visit_date).getTime() : 0))
      .reduce((a, b) => Math.max(a, b), 0);
    const lastOrderTs = rows
      .map(r => (r.lastOrderDate ? new Date(r.lastOrderDate).getTime() : 0))
      .reduce((a, b) => Math.max(a, b), 0);

    return {
      total: rows.length,
      active: counts.growing + counts.steady + counts.new,
      atRisk: counts.at_risk + counts.slipping,
      newCount: counts.new,
      dormant: counts.dormant + counts.never_started,
      value90,
      valueFY,
      aov: totalOrders ? Math.round(value90 / totalOrders) : null,
      lastVisit: lastVisitTs ? new Date(lastVisitTs).toISOString() : null,
      lastOrder: lastOrderTs ? new Date(lastOrderTs).toISOString() : null,
    };
  }, [rows, counts]);

  return { rows, counts, summary, loading };
}
