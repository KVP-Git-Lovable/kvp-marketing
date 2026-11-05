import { useMemo } from "react";
import { useEligibleOrderSchemes } from "./useEligibleOrderSchemes";
import { schemeAppliesToItem as engineMatches, type ProductScheme } from "@/utils/schemeEngine";

/**
 * Active, retailer-applicable schemes per exact pitch item, mirroring the
 * eligibility rules used by ai-pitch-suggestions (active + date window +
 * global or matching scheme_applicability). Failures resolve to "none" so
 * the badge simply hides.
 */
export type PitchScheme = ProductScheme;
export type SchemeMatchItem = { productId: string; variantId?: string | null };
export const schemeItemKey = (i: SchemeMatchItem) => `${i.productId}:${i.variantId ?? "base"}`;

export function schemeAppliesToItem(s: any, item: SchemeMatchItem): boolean {
  return engineMatches(s, { id: schemeItemKey(item), product_id: item.productId, variant_id: item.variantId || undefined, rate: 0, quantity: 0 });
}

export function usePitchApplicableSchemes(retailerId: string, items: SchemeMatchItem[]) {
  const { schemes } = useEligibleOrderSchemes(retailerId);
  const sig = items.map(schemeItemKey).sort().join(",");
  return useMemo(() => Object.fromEntries(items.map(item => [schemeItemKey(item), schemes.filter(s => schemeAppliesToItem(s, item))])), [schemes, sig]);
}
