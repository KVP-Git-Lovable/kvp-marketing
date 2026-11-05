import { useState, useEffect } from 'react';
import { getSignedStorageUrl, isStorageUrl } from '@/utils/storageUtils';

/**
 * React hook that resolves a Supabase storage URL (public or path) to a signed URL.
 * Returns null while loading, the signed URL when resolved, or the original URL if not a storage URL.
 */
export function useSignedUrl(
  url: string | null | undefined,
  bucket?: string
): string | null {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setSignedUrl(null);
      return;
    }

    // If it's not a storage URL and no bucket provided, use directly
    if (!isStorageUrl(url) && !bucket) {
      setSignedUrl(url);
      return;
    }

    let cancelled = false;

    getSignedStorageUrl(url, bucket).then((resolved) => {
      if (!cancelled) setSignedUrl(resolved);
    });

    return () => {
      cancelled = true;
    };
  }, [url, bucket]);

  return signedUrl;
}

/**
 * React hook that resolves multiple Supabase storage URLs to signed URLs.
 * Useful for lists of profiles with pictures.
 */
export function useSignedUrls(
  urls: (string | null | undefined)[],
  bucket?: string
): Map<string, string> {
  const [urlMap, setUrlMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const storageUrls = urls.filter((u): u is string => !!u && (isStorageUrl(u) || !!bucket));
    if (storageUrls.length === 0) return;

    let cancelled = false;

    Promise.all(
      storageUrls.map(async (url) => {
        const signed = await getSignedStorageUrl(url, bucket);
        return [url, signed] as const;
      })
    ).then((results) => {
      if (!cancelled) {
        setUrlMap(new Map(results));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [JSON.stringify(urls), bucket]);

  return urlMap;
}
