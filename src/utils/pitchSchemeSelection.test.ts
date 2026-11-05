import { describe, expect, it } from "vitest";
import { calculateOrderWithSchemes, type ProductScheme, type SchemeItem } from "./schemeEngine";
import { monetarySchemeBenefit, nearMissScheme, pitchSchemeSuggestion, retainManualSchemes, selectHighestBenefitSchemes } from "./pitchSchemeSelection";
import { pitchCatalogRate } from "./pitchCatalogRate";
import type { SchemePolicies } from "@/hooks/useSchemePolicies";
const policies: SchemePolicies = { maxSchemesPerOrder: 1, allowSchemeStacking: false, sameTypeStacking: false, autoApplyBestScheme: true, priorityResolution: "priority" };
const line: SchemeItem = { id: "p_variant_v", product_id: "p", variant_id: "v", quantity: 3, rate: 10, unit: "PC" };
const offer = (id: string, fields: Partial<ProductScheme> = {}): ProductScheme => ({ id, name: id, scheme_type: "percentage_discount", product_id: "p", variant_id: "v", discount_percentage: 10, is_active: true, ...fields });
describe("verified pitch scheme selection", () => {
  it("deduplicates manual offers and enforces shared conflict and zero-cap rules", () => {
    const a = offer("a", { exclusion_group: "g" });
    const b = offer("b", { scheme_type: "flat_discount", exclusion_group: "g" });
    const c = offer("c", { scheme_type: "manual_per_unit_discount" });
    expect(retainManualSchemes(["a"], ["a", "b", "c"], [a, b, c], { ...policies, allowSchemeStacking: true, maxSchemesPerOrder: 2 })).toEqual(["a", "c"]);
    expect(retainManualSchemes([], ["a"], [a], { ...policies, maxSchemesPerOrder: 0 })).toEqual([]);
  });
  it("selects monetary benefit, not percentage or priority", () => {
    expect(selectHighestBenefitSchemes([{ ...line, quantity: 10 }], [offer("percent", { discount_percentage: 20, priority: 1 }), offer("flat", { scheme_type: "flat_discount", discount_amount: 30, priority: 999 })], policies)).toEqual(["flat"]);
  });
  it("values free goods using their actual rate rather than count", () => {
    const free = offer("free", { scheme_type: "buy_x_get_y_free", buy_quantity: 10, free_quantity: 2, free_product_id: "gift", free_quantity_unit: "PC" });
    expect(monetarySchemeBenefit(free, [{ ...line, quantity: 10 }], () => 25)).toBe(50);
    expect(selectHighestBenefitSchemes([{ ...line, quantity: 10 }], [offer("cash", { discount_percentage: 30 }), free], policies, () => 25)).toEqual(["free"]);
    expect(monetarySchemeBenefit(free, [{ ...line, quantity: 10 }])).toBeNull();
  });
  it("never bumps the recommended quantity — reports the gap to the scheme instead", () => {
    expect(pitchSchemeSuggestion(line, [], [offer("s", { condition_quantity: 12 })], policies)).toEqual({ quantity: 3, nearMiss: { schemeId: "s", qtyNeeded: 9, unit: "PC" } });
  });
  it("auto-applies at the recommended quantity once it already meets the threshold", () => {
    expect(pitchSchemeSuggestion({ ...line, quantity: 12 }, [], [offer("s", { condition_quantity: 12 })], policies)).toMatchObject({ quantity: 12, schemeId: "s", benefit: 12 });
  });
  it("reports the gap to the nearest qualifying tier, never bumping the quantity", () => {
    expect(pitchSchemeSuggestion(line, [], [offer("tier", { scheme_type: "tiered_discount", tier_data: [{ min_qty: 5, max_qty: 9, discount_percentage: 10 }, { min_qty: 10, max_qty: 15, discount_percentage: 15 }] })], policies)).toEqual({ quantity: 3, nearMiss: { schemeId: "tier", qtyNeeded: 2, unit: "PC" } });
  });
  it("auto-applies the highest-benefit tier once the recommended quantity already qualifies", () => {
    expect(pitchSchemeSuggestion({ ...line, quantity: 10 }, [], [offer("tier", { scheme_type: "tiered_discount", tier_data: [{ min_qty: 5, max_qty: 9, discount_percentage: 10 }, { min_qty: 10, max_qty: 15, discount_percentage: 15 }] })], policies)).toMatchObject({ quantity: 10, benefit: 15 });
  });
  it("matches the example: 4kg recommended, scheme needs 5kg, reports a 1kg gap", () => {
    const kgLine: SchemeItem = { id: "p_kg", product_id: "p", quantity: 4, rate: 50, unit: "kg" };
    expect(pitchSchemeSuggestion(kgLine, [], [offer("kg-scheme", { product_id: "p", variant_id: undefined, condition_quantity: 5, condition_unit: "kg" })], policies).nearMiss).toEqual({ schemeId: "kg-scheme", qtyNeeded: 1, unit: "kg" });
  });
  it("nearMissScheme ignores eq/lte/max conditions, mismatched units and schemes with no numeric threshold", () => {
    expect(nearMissScheme(line, [offer("eq", { condition_quantity: 12, quantity_condition_type: "eq" })])).toBeUndefined();
    expect(nearMissScheme(line, [offer("max", { condition_quantity: 12, quantity_condition_type: "lte" })])).toBeUndefined();
    expect(nearMissScheme(line, [offer("unit", { condition_quantity: 10, condition_unit: "KG" })])).toBeUndefined();
    expect(nearMissScheme(line, [offer("bundle", { scheme_type: "bundle_combo", bundle_product_ids: ["p"] })])).toBeUndefined();
  });
  it("keeps AI quantities with no scheme or indeterminate bundle/unit requirements", () => {
    expect(pitchSchemeSuggestion(line, [], [], policies)).toEqual({ quantity: 3 });
    expect(pitchSchemeSuggestion(line, [], [offer("bundle", { scheme_type: "bundle_combo", bundle_product_ids: ["p", "missing"], bundle_discount_amount: 30 })], policies)).toEqual({ quantity: 3 });
    expect(pitchSchemeSuggestion(line, [], [offer("unit", { condition_quantity: 10, condition_unit: "KG" })], policies)).toEqual({ quantity: 3 });
  });
  it("does not invent a buyer's free-item choice", () => {
    expect(pitchSchemeSuggestion(line, [], [offer("choice", { scheme_type: "buy_x_get_y_free", buy_quantity: 10, free_quantity: 1, free_product_selection_mode: "user_choice" })], policies)).toEqual({ quantity: 3 });
  });
  it("restricts one scheme across the full order and switches as quantities change", () => {
    const a = offer("a", { discount_percentage: 20 });
    const b = offer("b", { product_id: "q", variant_id: null, discount_percentage: 10 });
    const q = { ...line, id: "q", product_id: "q", variant_id: undefined, quantity: 10 };
    expect(selectHighestBenefitSchemes([line, q], [a, b], policies)).toEqual(["b"]);
    expect(selectHighestBenefitSchemes([{ ...line, quantity: 10 }, q], [a, b], policies)).toEqual(["a"]);
  });
  it("respects maximum, same-type and exclusion-group restrictions atomically", () => {
    expect(selectHighestBenefitSchemes([line], [offer("a", { discount_percentage: 30 }), offer("b", { discount_percentage: 20 }), offer("c", { scheme_type: "flat_discount", discount_amount: 2, exclusion_group: "group" }), offer("d", { scheme_type: "bundle_discount", discount_percentage: 1, exclusion_group: "group" })], { ...policies, allowSchemeStacking: true, maxSchemesPerOrder: 5 })).toEqual(["a", "c"]);
  });
  it("keeps exact variants separate and removes ineligible discounts from totals", () => {
    const s = offer("exact", { condition_quantity: 10 });
    expect(calculateOrderWithSchemes([{ ...line, variant_id: "other", quantity: 10 }], [s], [s.id]).totalDiscount).toBe(0);
    expect(calculateOrderWithSchemes([line], [s], [s.id]).finalTotal).toBe(30);
    expect(calculateOrderWithSchemes([{ ...line, quantity: 10 }], [s], [s.id]).finalTotal).toBe(90);
  });
  it("distributes order-wide benefits without negative line or order totals", () => {
    const result = calculateOrderWithSchemes([line], [offer("wide", { product_id: null, variant_id: null, discount_percentage: 100 })], ["wide"]);
    expect(result.itemDiscounts[line.id]).toBe(30);
    expect(result.finalTotal).toBe(0);
  });
  it("uses price per gram, never per kilogram against gram quantity", () => {
    expect(pitchCatalogRate([{ id: "p", name: "Pack", rate: 200, unit: "KG", base_unit: "GRAM" }], "p", null, "g")).toBe(0.2);
  });
  it("honors exact and maximum conditions for order-wide offers", () => {
    const exact = offer("exact-order", { product_id: null, variant_id: null, condition_quantity: 3, quantity_condition_type: "eq" });
    expect(monetarySchemeBenefit(exact, [line])).toBe(3);
    expect(monetarySchemeBenefit(exact, [{ ...line, quantity: 4 }])).toBe(0);
    const maximum = { ...exact, quantity_condition_type: "lte" };
    expect(monetarySchemeBenefit(maximum, [{ ...line, quantity: 4 }])).toBe(0);
  });
  it("honors category exact quantity and real variant bundle membership", () => {
    const category = offer("category", { product_id: null, variant_id: null, category_id: "cat", condition_quantity: 3, quantity_condition_type: "eq" });
    expect(monetarySchemeBenefit(category, [{ ...line, category_id: "cat", quantity: 4 }])).toBe(0);
    const bundle = offer("bundle", { product_id: null, variant_id: null, scheme_type: "bundle_combo", bundle_product_ids: ["v", "q"], bundle_discount_amount: 5 });
    expect(monetarySchemeBenefit(bundle, [line, { ...line, id: "q", product_id: "q", variant_id: undefined }])).toBe(5);
    expect(monetarySchemeBenefit(bundle, [{ ...line, quantity: 0 }, { ...line, id: "q", product_id: "q", variant_id: undefined }])).toBe(0);
  });
});