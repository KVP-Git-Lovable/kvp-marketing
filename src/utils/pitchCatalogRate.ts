import { normalizeSchemeUnit } from "./pitchSchemeSelection";

export interface PitchCatalogProduct {
  id: string; name: string; rate: number; unit: string; base_unit?: string;
  category_id?: string | null;
  variants?: { id: string; variant_name: string; price: number }[];
}

/** Same guaranteed KG-priced gram conversion as order-entry pricing; other conversions are never guessed. */
export function pitchCatalogRate(products: PitchCatalogProduct[], productId: string, variantId?: string | null, unit?: string): number | undefined {
  const product = products.find(p => p.id === productId);
  if (!product) return undefined;
  const variant = variantId ? product.variants?.find(v => v.id === variantId) : undefined;
  if (variantId && !variant) return undefined;
  const rate = Number(variant ? variant.price : product.rate);
  const source = normalizeSchemeUnit(product.base_unit || product.unit);
  const target = normalizeSchemeUnit(unit || product.unit);
  if (["kg", "g"].includes(source) && target === "g") return rate / 1000;
  if (["kg", "g"].includes(source) && target === "kg") return rate;
  if (source !== target && normalizeSchemeUnit(product.unit) !== target) return undefined;
  return Number.isFinite(rate) && rate > 0 ? rate : undefined;
}