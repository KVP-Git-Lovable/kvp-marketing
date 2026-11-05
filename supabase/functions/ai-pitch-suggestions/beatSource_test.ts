import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { selectBeatPeerSource } from "./beatSource.ts";

Deno.test("beat with 3+ ordering stores is used", () => {
  const agg = { orderingStores: 5 };
  assertEquals(selectBeatPeerSource("b1", agg, 3), agg);
});
Deno.test("thin beat gives no source (no fallback)", () => {
  assertEquals(selectBeatPeerSource("b1", { orderingStores: 2 }, 3), null);
});
Deno.test("missing beat gives no source", () => {
  assertEquals(selectBeatPeerSource("", { orderingStores: 10 }, 3), null);
  assertEquals(selectBeatPeerSource(null, { orderingStores: 10 }, 3), null);
});
