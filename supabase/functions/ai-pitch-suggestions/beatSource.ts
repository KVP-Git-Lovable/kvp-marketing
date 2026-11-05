/** Beat Favourite peer source: the retailer's exact beat only, never a fallback. */
export function selectBeatPeerSource<T extends { orderingStores: number }>(
  beatId: string | null | undefined,
  beatAgg: T,
  minOrderingStores: number,
): T | null {
  if (!String(beatId ?? "").trim()) return null;
  return beatAgg.orderingStores >= minOrderingStores ? beatAgg : null;
}
