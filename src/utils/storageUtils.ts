import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const STORAGE_URL_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/`;

// Cache signed URLs to avoid repeated API calls
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Extract bucket name and file path from a full Supabase storage public URL.
 */
export function parseStorageUrl(urlOrPath: string): { bucket: string; path: string } | null {
  if (!urlOrPath?.startsWith(STORAGE_URL_PREFIX)) return null;
  
  const rest = urlOrPath.slice(STORAGE_URL_PREFIX.length);
  const slashIndex = rest.indexOf('/');
  if (slashIndex === -1) return null;
  
  return {
    bucket: rest.slice(0, slashIndex),
    path: rest.slice(slashIndex + 1),
  };
}

/**
 * Check if a URL is a Supabase storage public URL that needs signing.
 */
export function isStorageUrl(url: string | null | undefined): boolean {
  return !!url?.startsWith(STORAGE_URL_PREFIX);
}

/**
 * Get a signed URL for a file in Supabase storage.
 * Handles both full public URLs (parses bucket/path) and explicit bucket+path.
 * Results are cached for efficiency.
 */
export async function getSignedStorageUrl(
  urlOrPath: string,
  bucket?: string,
  expiresIn: number = 3600
): Promise<string> {
  if (!urlOrPath) return urlOrPath;

  let resolvedBucket: string;
  let resolvedPath: string;

  const parsed = parseStorageUrl(urlOrPath);
  if (parsed) {
    resolvedBucket = parsed.bucket;
    resolvedPath = parsed.path;
  } else if (bucket) {
    resolvedBucket = bucket;
    resolvedPath = urlOrPath;
  } else {
    // Not a storage URL and no bucket provided — return as-is
    return urlOrPath;
  }

  const cacheKey = `${resolvedBucket}/${resolvedPath}`;
  const cached = signedUrlCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  const { data, error } = await supabase.storage
    .from(resolvedBucket)
    .createSignedUrl(resolvedPath, expiresIn);

  if (error || !data?.signedUrl) {
    console.error('Failed to create signed URL:', error);
    return urlOrPath; // Fallback to original URL
  }

  signedUrlCache.set(cacheKey, {
    url: data.signedUrl,
    expiresAt: Date.now() + (expiresIn - 60) * 1000, // Expire cache 1 min early
  });

  return data.signedUrl;
}

/**
 * Batch-resolve multiple URLs to signed URLs.
 * Useful when displaying lists of profiles with pictures.
 */
export async function getSignedStorageUrls(
  urls: (string | null | undefined)[],
  bucket?: string,
  expiresIn: number = 3600
): Promise<(string | null)[]> {
  return Promise.all(
    urls.map(async (url) => {
      if (!url) return null;
      return getSignedStorageUrl(url, bucket, expiresIn);
    })
  );
}
