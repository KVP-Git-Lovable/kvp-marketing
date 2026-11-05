// Pure, dependency-free helpers for runVisitOptimiser (4-factor model):
// geographic proximity, ordering time, visit recency, conversion & value.

export interface OptStop {
  retailerId: string;
  beat: string | null;
  score: number;
  typicalOrderHour: number | null;
  lat: number | null;
  lng: number | null;
}

export function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const r = (x: number) => (x * Math.PI) / 180;
  const dLat = r(b.lat - a.lat);
  const dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Valid = finite, in range, and not the (0,0) placeholder. */
export function validCoord(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  if (lat == null || lng == null || lat === "" || lng === "") return null;
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  if (Math.abs(la) > 90 || Math.abs(ln) > 180) return null;
  if (la === 0 && ln === 0) return null;
  return { lat: la, lng: ln };
}

/** score = recency (≤40) + strike rate (≤35) + 30d order value (≤25). */
export function scoreStop(daysSince: number | null, strikeRate: number, orderValue30d: number): number {
  const recency = Math.min(40, (daysSince ?? 45) * 0.9);
  const conversion = Math.max(0, Math.min(1, strikeRate)) * 35;
  const value = Math.min(25, Math.max(0, orderValue30d) / 2000);
  return Math.round((recency + conversion + value) * 10) / 10;
}

const has = (s: OptStop) => s.lat != null && s.lng != null;
const km = (a: OptStop, b: OptStop) => haversine({ lat: a.lat!, lng: a.lng! }, { lat: b.lat!, lng: b.lng! });

/** Sum of consecutive legs where both ends have GPS. */
export function routeKm(stops: OptStop[]): number {
  let t = 0;
  for (let i = 1; i < stops.length; i++) {
    if (has(stops[i - 1]) && has(stops[i])) t += km(stops[i - 1], stops[i]);
  }
  return t;
}

const byScore = (a: OptStop, b: OptStop) => b.score - a.score || a.retailerId.localeCompare(b.retailerId);

/** 2-opt on an open path with a fixed first stop. */
export function twoOpt<T extends OptStop>(path: T[], maxPasses = 50): T[] {
  const p = [...path];
  const n = p.length;
  if (n < 4) return p;
  for (let pass = 0; pass < maxPasses; pass++) {
    let improved = false;
    for (let i = 1; i < n - 1; i++) {
      for (let k = i + 1; k < n; k++) {
        const before = km(p[i - 1], p[i]) + (k + 1 < n ? km(p[k], p[k + 1]) : 0);
        const after = km(p[i - 1], p[k]) + (k + 1 < n ? km(p[i], p[k + 1]) : 0);
        if (after + 1e-9 < before) {
          const seg = p.slice(i, k + 1).reverse();
          p.splice(i, seg.length, ...seg);
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return p;
}

/** Full sequence: GPS route (time-biased NN + 2-opt) with no-GPS stops slotted by beat. */
export function sequenceStops<T extends OptStop>(all: T[]): T[] {
  const geo = all.filter(has).sort(byScore);
  const noGeo = all.filter((s) => !has(s)).sort(byScore);

  let route: T[] = [];
  if (geo.length) {
    const pool = [...geo];
    let startIdx = 0;
    let earliest = Infinity;
    pool.slice(0, 5).forEach((s, i) => {
      if (s.typicalOrderHour != null && s.typicalOrderHour < earliest) {
        earliest = s.typicalOrderHour;
        startIdx = i;
      }
    });
    let cur = pool.splice(startIdx, 1)[0];
    route.push(cur);
    while (pool.length) {
      let best = 0;
      let bestCost = Infinity;
      pool.forEach((p, i) => {
        const d = km(cur, p);
        const lateBy = cur.typicalOrderHour != null && p.typicalOrderHour != null
          ? Math.min(4, Math.max(0, p.typicalOrderHour - cur.typicalOrderHour))
          : 0;
        const cost = d * (1 + 0.15 * lateBy);
        if (cost < bestCost - 1e-9 || (Math.abs(cost - bestCost) <= 1e-9 && p.score > pool[best].score)) {
          bestCost = cost;
          best = i;
        }
      });
      cur = pool.splice(best, 1)[0];
      route.push(cur);
    }
    const opt = twoOpt(route);
    if (routeKm(opt) <= routeKm(route)) route = opt;
  }

  // Slot no-GPS stops after the last GPS stop of the same beat.
  const groups = new Map<string, T[]>();
  const orphans: T[] = [];
  for (const s of noGeo) {
    const beat = s.beat ?? "";
    const inRoute = beat && route.some((r) => (r.beat ?? "") === beat);
    if (inRoute) groups.set(beat, [...(groups.get(beat) ?? []), s]);
    else orphans.push(s);
  }
  const out: T[] = [];
  route.forEach((s, i) => {
    out.push(s);
    const beat = s.beat ?? "";
    if (beat && groups.has(beat) && !route.slice(i + 1).some((r) => (r.beat ?? "") === beat)) {
      out.push(...groups.get(beat)!);
      groups.delete(beat);
    }
  });
  return [...out, ...orphans];
}
