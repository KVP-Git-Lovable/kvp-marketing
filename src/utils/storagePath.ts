/**
 * Derive the path *inside a storage bucket* from a Supabase public URL.
 *
 * `storage.remove()` needs `products/KPY-100G.webp`, but what we persist is a
 * public URL like:
 *
 *   https://<ref>.supabase.co/storage/v1/object/public/product-images/products/KPY-100G.webp?v=1758364800000
 *
 * Two things make naive parsing wrong here: `productImageBatchUpload.ts`
 * appends a `?v=` cache-buster to every URL it writes, and paths come in two
 * shapes — flat (`barcode_1758364800000.png`) from the Edit Product dialog and
 * foldered (`products/<SKU>.<ext>`) from the bulk uploader. Anchoring on the
 * `/object/public/<bucket>/` marker handles both; counting path segments does
 * not.
 *
 * Returns null when the URL isn't a public URL for `bucket` — an externally
 * hosted image, say — so callers unlink it rather than guessing at a path and
 * deleting something else.
 */
export const storagePathFromPublicUrl = (
  url: string | null | undefined,
  bucket: string,
): string | null => {
  if (!url) return null;
  try {
    // `pathname` drops the ?v= cache-buster for us.
    const { pathname } = new URL(url);
    const marker = `/object/public/${bucket}/`;
    const i = pathname.indexOf(marker);
    if (i === -1) return null;
    const path = decodeURIComponent(pathname.slice(i + marker.length));
    return path || null;
  } catch {
    return null;
  }
};
