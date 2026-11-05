import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { routeKm, scoreStop, sequenceStops, validCoord, type OptStop } from "./visitOptimiser.ts";

const s = (id: string, lat: number | null, lng: number | null, extra: Partial<OptStop> = {}): OptStop => ({
  retailerId: id, beat: "B1", score: 50, typicalOrderHour: null, lat, lng, ...extra,
});

// Old algorithm (score-sorted NN with pool.shift fallback) for comparison.
function oldRoute(all: OptStop[]) {
  const pool = [...all].sort((a, b) => b.score - a.score);
  const out: OptStop[] = [];
  let cur = pool.shift();
  while (cur) {
    out.push(cur);
    if (!pool.length) break;
    if (cur.lat != null) {
      let bi = 0, bk = Infinity;
      pool.forEach((p, i) => {
        if (p.lat == null) return;
        const d = routeKm([cur!, p]);
        if (d < bk) { bk = d; bi = i; }
      });
      cur = pool.splice(bi, 1)[0];
    } else cur = pool.shift();
  }
  return out;
}

const grid: OptStop[] = Array.from({ length: 12 }, (_, i) =>
  s(`r${i}`, 12.85 + ((i * 7) % 12) * 0.01, 74.83 + ((i * 5) % 12) * 0.01, { score: 100 - i }));

Deno.test("valid GPS: new route never longer than old", () => {
  const n = sequenceStops(grid);
  const o = oldRoute(grid);
  console.log(`old ${routeKm(o).toFixed(2)} km → new ${routeKm(n).toFixed(2)} km`);
  assert(routeKm(n) <= routeKm(o) + 1e-9);
  assertEquals(n.length, grid.length);
});

Deno.test("invalid coords detected", () => {
  assertEquals(validCoord(0, 0), null);
  assertEquals(validCoord(null, 74), null);
  assertEquals(validCoord("abc", 74), null);
  assertEquals(validCoord(95, 74), null);
  assert(validCoord(12.9, 74.8));
});

Deno.test("missing coords: all included, unique, deterministic, grouped by beat", () => {
  const mix = [...grid.slice(0, 5), s("x1", null, null, { beat: "B1", score: 99 }), s("x2", null, null, { beat: "Z", score: 10 })];
  const a = sequenceStops(mix).map((x) => x.retailerId);
  const b = sequenceStops([...mix].reverse()).map((x) => x.retailerId);
  assertEquals(new Set(a).size, mix.length);
  assertEquals(a, b);
  assertEquals(a[a.length - 1], "x2");
  assertEquals(a[a.length - 2], "x1"); // after last B1 GPS stop
});

Deno.test("nearby cluster stays together", () => {
  const st = [s("a", 12.0, 74.0), s("far", 12.5, 74.5), s("b", 12.001, 74.001), s("c", 12.002, 74.0)];
  const ids = sequenceStops(st).map((x) => x.retailerId);
  const pos = ["a", "b", "c"].map((id) => ids.indexOf(id)).sort();
  assertEquals(pos[2] - pos[0], 2);
});

Deno.test("earliest ordering store starts", () => {
  const st = [s("late", 12, 74, { typicalOrderHour: 17, score: 90 }), s("early", 12.01, 74.01, { typicalOrderHour: 9, score: 80 })];
  assertEquals(sequenceStops(st)[0].retailerId, "early");
});

Deno.test("recency and conversion raise score", () => {
  assert(scoreStop(40, 0.5, 1000) > scoreStop(2, 0.5, 1000));
  assert(scoreStop(5, 0.9, 1000) > scoreStop(5, 0.1, 1000));
  assert(scoreStop(5, 0.5, 40000) > scoreStop(5, 0.5, 0));
});
