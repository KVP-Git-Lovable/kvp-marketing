import { calculateOrderWithSchemes, isSchemeActive, isSchemeConditionMet, schemeAppliesToItem, type ProductScheme, type SchemeItem, type ManualSchemeSelection, type SchemeCalculationResult } from "./schemeEngine";
import type { SchemePolicies } from "@/hooks/useSchemePolicies";

export type FreeRateResolver = (productId: string, variantId: string | undefined, unit: string | undefined) => number | undefined;
export interface PitchSchemeContext {
  items: SchemeItem[];
  schemes: ProductScheme[];
  policies: SchemePolicies;
  resolveRate: (productId: string, variantId: string | undefined, unit: string | undefined, quantity?: number) => number | undefined;
  categoryId?: (productId: string) => string | null | undefined;
  resolveFreeRate?: FreeRateResolver;
  calculation?: SchemeCalculationResult;
}
export const pitchOrderKey = (productId: string, variantId?: string | null) => `${productId}:${variantId ?? "base"}`;
export const samePitchLine = (a: SchemeItem, b: SchemeItem) => pitchOrderKey(a.product_id || a.id, a.variant_id) === pitchOrderKey(b.product_id || b.id, b.variant_id);

/** Retain manual offers only within the same cap and conflict rules as automatic offers. */
export function retainManualSchemes(ids: string[], manualIds: string[], schemes: ProductScheme[], policies: SchemePolicies): string[] {
  const max = policies.allowSchemeStacking ? Math.max(0, policies.maxSchemesPerOrder) : Math.min(1, Math.max(0, policies.maxSchemesPerOrder));
  const selected: ProductScheme[] = [];
  for (const id of [...new Set([...ids, ...manualIds])]) {
    if (selected.length >= max) break;
    const scheme = schemes.find(s => s.id === id);
    if (!scheme || selected.some(s => (!policies.sameTypeStacking && s.scheme_type === scheme.scheme_type) || (scheme.exclusion_group && s.exclusion_group === scheme.exclusion_group))) continue;
    selected.push(scheme);
  }
  return selected.map(s => s.id);
}

/** Compare real calculated savings, including free goods only when their rate is known. */
export function monetarySchemeBenefit(scheme: ProductScheme, items: SchemeItem[], resolveFreeRate?: FreeRateResolver, manual?: ManualSchemeSelection): number | null {
  const subtotal = items.reduce((sum, item) => sum + item.rate * item.quantity, 0);
  if (!isSchemeActive(scheme) || !isSchemeConditionMet(scheme, items, subtotal)) return 0;
  const result = calculateOrderWithSchemes(items, [scheme], [scheme.id], manual ? { [scheme.id]: manual } : {});
  if (scheme.free_product_selection_mode === "user_choice" && !manual?.chosenFreeProductId) return null;
  let benefit = result.totalDiscount;
  for (const offer of result.appliedSchemes) for (const free of offer.free_items || []) {
    const rate = free.original_rate && free.original_rate > 0 ? free.original_rate : free.product_id ? resolveFreeRate?.(free.product_id, free.variant_id, free.unit) : undefined;
    if (rate == null || !Number.isFinite(rate) || rate <= 0) return null;
    benefit += free.quantity * rate;
  }
  return benefit;
}

/** Selection only: validation, benefits and totals remain in the existing scheme engine. */
export function selectHighestBenefitSchemes(items: SchemeItem[], schemes: ProductScheme[], policies: SchemePolicies, resolveFreeRate?: FreeRateResolver, manual: Record<string, ManualSchemeSelection> = {}): string[] {
  const ranked = schemes.map(scheme => ({ scheme, benefit: monetarySchemeBenefit(scheme, items, resolveFreeRate, manual[scheme.id]) }))
    .filter((row): row is { scheme: ProductScheme; benefit: number } => row.benefit != null && row.benefit > 0)
    .sort((a, b) => b.benefit - a.benefit || a.scheme.id.localeCompare(b.scheme.id));
  const max = policies.allowSchemeStacking ? Math.max(0, policies.maxSchemesPerOrder) : Math.min(1, policies.maxSchemesPerOrder);
  const selected: ProductScheme[] = [];
  for (const { scheme } of ranked) {
    if (selected.length >= max) break;
    if (selected.some(s => (!policies.sameTypeStacking && s.scheme_type === scheme.scheme_type) || (scheme.exclusion_group && s.exclusion_group === scheme.exclusion_group))) continue;
    selected.push(scheme);
  }
  return selected.map(s => s.id);
}

export interface SchemeNearMiss {
  schemeId: string;
  /** How much more quantity (in `unit`) would meet the scheme's threshold. Always > 0. */
  qtyNeeded: number;
  unit: string;
}

/**
 * Nearest scheme a line doesn't yet qualify for, with how much more quantity
 * would unlock it. Never guesses: skips mismatched units, `eq`/`lte`/`max`
 * conditions (bumping up doesn't "unlock" those), and schemes with no clear
 * numeric quantity threshold (bundles, min-order-value-only offers).
 */
export function nearMissScheme(item: SchemeItem, schemes: ProductScheme[]): SchemeNearMiss | undefined {
  let best: SchemeNearMiss | undefined;
  for (const scheme of schemes) {
    if (!schemeAppliesToItem(scheme, item) || !isSchemeActive(scheme)) continue;
    const unit = scheme.condition_unit || scheme.buy_quantity_unit;
    if (unit && item.unit && normalizeSchemeUnit(unit) !== normalizeSchemeUnit(item.unit)) continue;
    if (scheme.scheme_type === "manual_per_unit_discount" || scheme.free_product_selection_mode === "user_choice") continue;
    let requiredQty: number | undefined;
    if (scheme.tier_data?.length) {
      requiredQty = scheme.tier_data.map(t => t.min_qty).filter(q => q > item.quantity).sort((a, b) => a - b)[0];
    } else {
      const type = scheme.quantity_condition_type || "gte";
      if (type === "eq" || type === "lte" || type === "max") continue;
      const threshold = Number(scheme.condition_quantity || scheme.buy_quantity || 0);
      requiredQty = threshold > item.quantity ? threshold : undefined;
    }
    if (requiredQty == null) continue;
    const qtyNeeded = requiredQty - item.quantity;
    if (!(qtyNeeded > 0)) continue;
    if (!best || qtyNeeded < best.qtyNeeded) best = { schemeId: scheme.id, qtyNeeded, unit: item.unit || "" };
  }
  return best;
}

/**
 * Never bumps the recommended quantity to chase a scheme — it stays exactly
 * what was recommended. Returns the best scheme that already applies at that
 * quantity, or (never both) the nearest scheme that doesn't apply yet along
 * with how much more quantity would unlock it.
 */
export function pitchSchemeSuggestion(item: SchemeItem, cart: SchemeItem[], schemes: ProductScheme[], policies: SchemePolicies, resolveFreeRate?: FreeRateResolver, resolveItemRate?: (quantity: number) => number | undefined): { quantity: number; schemeId?: string; benefit?: number; nearMiss?: SchemeNearMiss } {
  const fallback = { quantity: item.quantity };
  // Pitch Add applies its chosen offer explicitly, so the company's background
  // auto-apply toggle must not hide the offer quantity.
  if (!(item.rate > 0) || policies.maxSchemesPerOrder < 1) return fallback;
  const rest = cart.filter(line => !samePitchLine(line, item));
  const rate = resolveItemRate ? resolveItemRate(item.quantity) : item.rate;
  if (!(rate != null && rate > 0)) return fallback;
  const hypothetical = [...rest, { ...item, rate }];
  const applying: { schemeId: string; benefit: number }[] = [];
  for (const scheme of schemes) {
    if (!schemeAppliesToItem(scheme, item) || !isSchemeActive(scheme)) continue;
    const unit = scheme.condition_unit || scheme.buy_quantity_unit;
    if (unit && item.unit && normalizeSchemeUnit(unit) !== normalizeSchemeUnit(item.unit)) continue;
    if (scheme.scheme_type === "manual_per_unit_discount" || scheme.free_product_selection_mode === "user_choice") continue;
    const benefit = monetarySchemeBenefit(scheme, hypothetical, resolveFreeRate);
    if (benefit == null || benefit <= 0) continue;
    // An order-wide restriction can make a different offer the winner.
    if (!selectHighestBenefitSchemes(hypothetical, schemes, policies, resolveFreeRate).includes(scheme.id)) continue;
    applying.push({ schemeId: scheme.id, benefit });
  }
  applying.sort((a, b) => b.benefit - a.benefit || a.schemeId.localeCompare(b.schemeId));
  if (applying.length) return { quantity: item.quantity, schemeId: applying[0].schemeId, benefit: applying[0].benefit };
  const nearMiss = nearMissScheme(item, schemes);
  return nearMiss ? { quantity: item.quantity, nearMiss } : fallback;
}

export function normalizeSchemeUnit(unit: string): string {
  const u = unit.toLowerCase().replace(/\./g, "").trim();
  if (["pc", "pcs", "piece", "pieces"].includes(u)) return "pc";
  if (["g", "gm", "gram", "grams"].includes(u)) return "g";
  if (["kg", "kilogram", "kilograms"].includes(u)) return "kg";
  return u;
}