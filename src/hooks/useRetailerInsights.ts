import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/contexts/CurrencyContext";
import { fetchRetailerOverviewMetrics, formatDDMMYYYY } from "@/lib/retailerOverviewMetrics";

/** AI Retailer Insight: one sentence per store built only from Retailer
 * Overview (Avg Order Value/Visit, Last Visit Date) and Payments (Outstanding). */
type Input = { retailerId: string; name: string; avg: string; lastVisit?: string; days?: number; outstanding?: string; pct?: number };

const CACHE_PREFIX = "retailer-insight:v1:";
const today = () => new Date().toISOString().slice(0, 10);

export function fallbackLine(i: Input): string {
  if (i.lastVisit && i.outstanding)
    return `${i.name} averages ${i.avg} per visit but was last visited on ${i.lastVisit} and still owes ${i.outstanding}, so visit soon to collect the dues and take a fresh order.`;
  if (i.lastVisit)
    return `${i.name} averages ${i.avg} per visit but was last visited on ${i.lastVisit}, so plan a visit soon to win back that order.`;
  return `${i.name} averages ${i.avg} per visit but still owes ${i.outstanding}, so collect the dues on your next visit before booking a new order.`;
}

export function useRetailerInsights(retailers: { id: string; name: string }[]) {
  const { format } = useCurrency();
  const [lines, setLines] = useState<Map<string, string>>(new Map());
  const targets = useMemo(() => [...new Map(retailers.map(r => [r.id, r])).values()], [retailers]);
  const key = JSON.stringify(targets);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLines(new Map());
    if (!targets.length || !online) return;
    (async () => {
      const inputs: (Input & { cacheKey: string })[] = [];
      const found = new Map<string, string>();
      const list = targets;
      for (let i = 0; i < list.length; i += 6) {
        if (cancelled) return;
        const chunk = list.slice(i, i + 6);
        const metrics = await Promise.all(chunk.map((r) => fetchRetailerOverviewMetrics(r.id).catch(() => null)));
        metrics.forEach((m, idx) => {
          if (!m) return;
          // Valid average order value is required; skip when missing/zero.
          if (!(m.avgOrderValuePerVisit > 0)) return;
          const stale = m.daysSinceLastVisit != null && m.daysSinceLastVisit > 30;
          // Outstanding counts only when it exceeds 50% of the avg order value.
          const owes = m.outstanding > 0 && m.outstanding > 0.5 * m.avgOrderValuePerVisit;
          // Neither condition met → show nothing.
          if (!stale && !owes) return;
          const inp: Input = {
            retailerId: m.retailerId,
            name: chunk[idx].name,
            avg: format(m.avgOrderValuePerVisit),
            ...(stale && m.lastVisitDate && m.daysSinceLastVisit != null ? { lastVisit: formatDDMMYYYY(m.lastVisitDate), days: m.daysSinceLastVisit } : {}),
            ...(owes ? { outstanding: format(m.outstanding), pct: Math.round(m.outstandingPct) } : {}),
          };
          const cacheKey = CACHE_PREFIX + [today(), inp.retailerId, inp.name, inp.avg, inp.lastVisit ?? "", inp.outstanding ?? ""].join("|");
          let cached: string | null = null;
          try { cached = sessionStorage.getItem(cacheKey); } catch { /* Storage may be unavailable. */ }
          if (cached) found.set(inp.retailerId, cached);
          else {
            inputs.push({ ...inp, cacheKey });
            found.set(inp.retailerId, fallbackLine(inp));
          }
        });
        if (cancelled) return;
        setLines(new Map(found));
      }
      if (found.size && !cancelled) setLines(new Map(found));
      if (!inputs.length) return;

      // Consider every retailer while respecting the function's 60-item request limit.
      for (let i = 0; i < inputs.length; i += 60) {
        if (cancelled) return;
        const batch = inputs.slice(i, i + 60);
        let ai: Record<string, string> = {};
        try {
          const { data } = await supabase.functions.invoke("retailer-visit-insight", {
            body: { items: batch.map(({ cacheKey, ...rest }) => rest) },
          });
          ai = data?.lines ?? {};
        } catch { /* Keep the existing exact-figure fallback. */ }
        if (cancelled) return;
        for (const inp of batch) {
          const line = ai[inp.retailerId] || fallbackLine(inp);
          found.set(inp.retailerId, line);
          if (ai[inp.retailerId]) {
            try { sessionStorage.setItem(inp.cacheKey, line); } catch { /* Optional cache. */ }
          }
        }
        setLines(new Map(found));
      }
      if (!cancelled) setLines(new Map(found));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, format, online]);

  return lines;
}
