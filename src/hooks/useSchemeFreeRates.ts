import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { pitchCatalogRate, type PitchCatalogProduct } from "@/utils/pitchCatalogRate";
import type { ProductScheme } from "@/utils/schemeEngine";
import { useCallback } from "react";

export function useSchemeFreeRates(schemes: ProductScheme[]) {
  const ids = [...new Set(schemes.map(s => s.free_product_id).filter((id): id is string => Boolean(id)))].sort();
  const variants = [...new Set(schemes.map(s => s.free_variant_id).filter((id): id is string => Boolean(id)))].sort();
  const signature = `${ids.join(",")}:${variants.join(",")}`;
  const query = useQuery({
    queryKey: ["scheme-free-catalog-rates", signature],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getSession();
      const key = `scheme_free_rates:${auth.session?.user.id || "signed-out"}:${signature}`;
      if (!navigator.onLine) {
        const cache = localStorage.getItem(key);
        if (cache) return JSON.parse(cache) as PitchCatalogProduct[];
        return [];
      }
      const products: PitchCatalogProduct[] = [];
      const packs: { id: string; product_id: string; variant_name: string; price: number }[] = [];
      for (let index = 0; index < ids.length; index += 100) {
        const { data, error } = await supabase.from("products").select("id, name, rate, unit, base_unit").in("id", ids.slice(index, index + 100));
        if (error) throw error;
        products.push(...(data || []));
      }
      for (let index = 0; index < variants.length; index += 100) {
        const { data, error } = await supabase.from("product_variants").select("id, product_id, variant_name, price").in("id", variants.slice(index, index + 100));
        if (error) throw error;
        packs.push(...(data || []));
      }
      const result = products.map(product => ({ ...product, variants: packs.filter(v => v.product_id === product.id) }));
      localStorage.setItem(key, JSON.stringify(result));
      return result;
    },
  });
  return useCallback((productId: string, variantId: string | undefined, unit: string | undefined) => pitchCatalogRate(query.data || [], productId, variantId, unit), [query.data]);
}