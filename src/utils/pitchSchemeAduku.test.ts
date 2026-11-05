import { describe, it, expect } from "vitest";
import { pitchSchemeSuggestion } from "./pitchSchemeSelection";
import { pitchCatalogRate } from "./pitchCatalogRate";
import type { ProductScheme } from "./schemeEngine";

// Mirrors the live ADUKU 20G offer: Buy 10 KG, get 700 g of ADUKU 100G free.
const offer = { id: "aduku", name: "Buy 1 Get 1 (700gm)", scheme_type: "buy_x_get_y_free", product_id: "aduku", buy_quantity: 10, buy_quantity_unit: "kg", condition_quantity: 0, quantity_condition_type: "more_than", free_quantity: 700, free_quantity_unit: "grams", free_product_id: "aduku", free_variant_id: "aduku100", free_product_selection_mode: "fixed", is_active: true, min_order_value: 0 } as unknown as ProductScheme;
const catalog = [{ id: "aduku", name: "ADUKU 20G", rate: 361.9, unit: "piece", base_unit: "GRAM", variants: [{ id: "aduku100", variant_name: "ADUKU 100G", price: 400 }] }];
const free = (p: string, v: string | undefined, u: string | undefined) => pitchCatalogRate(catalog, p, v, u);
const item = { id: "x", product_id: "aduku", quantity: 20, rate: 361.9, unit: "KG" };

describe("ADUKU offer quantity", () => {
  it("keeps the recommended 20 KG as-is and applies the offer at that quantity, even when company auto-apply is off", () => {
    const r = pitchSchemeSuggestion(item, [], [offer], { maxSchemesPerOrder: 2, allowSchemeStacking: true, sameTypeStacking: false, autoApplyBestScheme: false, priorityResolution: "highest_discount" }, free, () => 361.9);
    expect(r).toEqual({ quantity: 20, schemeId: "aduku", benefit: 280 });
  });
  it("keeps the normal quantity when offers are disabled for the order", () => {
    const r = pitchSchemeSuggestion(item, [], [offer], { maxSchemesPerOrder: 0, allowSchemeStacking: false, sameTypeStacking: false, autoApplyBestScheme: false, priorityResolution: "highest_discount" }, free, () => 361.9);
    expect(r).toEqual({ quantity: 20 });
  });
});
