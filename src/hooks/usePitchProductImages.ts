import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { offlineStorage, STORES } from "@/lib/offlineStorage";
import { getSignedStorageUrl } from "@/utils/storageUtils";

interface ImageItem { productId: string; variantId?: string | null }
interface ImageRow { id: string; sku_image_url?: string | null }
export const pitchImageKey = (item: ImageItem) => item.variantId ? `variant:${item.variantId}` : `product:${item.productId}`;

export function usePitchProductImages(items: ImageItem[]) {
  const [images, setImages] = useState<Record<string, string>>({});
  const identity = JSON.stringify(items.map(item => [item.productId, item.variantId ?? null]));
  useEffect(() => {
    let cancelled = false;
    setImages({});
    const selected: ImageItem[] = JSON.parse(identity).map(([productId, variantId]: [string, string | null]) => ({ productId, variantId }));
    const unique = [...new Map(selected.map(item => [pitchImageKey(item), item])).values()];
    const publish = async (rows: { key: string; url?: string | null }[]) => {
      const entries = await Promise.all(rows.map(async ({ key, url }) => {
        if (!url?.trim()) return [key, ""] as const;
        try {
          const resolved = await getSignedStorageUrl(url.trim());
          const parsed = new URL(resolved);
          return [key, ["https:", "http:"].includes(parsed.protocol) ? resolved : ""] as const;
        } catch { return [key, ""] as const; }
      }));
      if (!cancelled) setImages(previous => ({ ...previous, ...Object.fromEntries(entries) }));
    };
    void (async () => {
      await publish(await Promise.all(unique.map(async item => {
        try {
          const row = await offlineStorage.getById<ImageRow>(item.variantId ? STORES.VARIANTS : STORES.PRODUCTS, item.variantId || item.productId);
          return { key: pitchImageKey(item), url: row?.sku_image_url };
        } catch { return { key: pitchImageKey(item) }; }
      })));
      if (!navigator.onLine || cancelled || !unique.length) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session || cancelled) return;
      await Promise.all((["products", "product_variants"] as const).map(async table => {
        const ids = unique.filter(item => table === "product_variants" ? !!item.variantId : !item.variantId).map(item => item.variantId || item.productId);
        if (!ids.length) return;
        const { data: rows, error } = await supabase.from(table).select("id, sku_image_url").in("id", ids);
        if (!error && rows) await publish(rows.map(row => ({ key: `${table === "products" ? "product" : "variant"}:${row.id}`, url: row.sku_image_url })));
      }));
    })().catch(() => { /* Images are optional; recommendations remain usable. */ });
    return () => { cancelled = true; };
  }, [identity]);
  return images;
}