import { fetchProductsWithOfflineSupport } from './offlineOrderUtils';

let prefetchPromise: Promise<void> | null = null;
let isPrefetching = false;

/**
 * Prefetch products in the background to warm up the cache
 * This ensures products are ready before user navigates to Order Entry
 */
export async function prefetchProducts() {
  // Don't start multiple prefetches
  if (isPrefetching || prefetchPromise) {
    return prefetchPromise;
  }

  isPrefetching = true;
  console.time('⚡ Background Product Prefetch');

  prefetchPromise = (async () => {
    try {
      await fetchProductsWithOfflineSupport();
      console.timeEnd('⚡ Background Product Prefetch');
      console.log('✅ Products prefetched successfully');
    } catch (error) {
      console.error('Background product prefetch failed:', error);
      // Don't fail - products will be fetched on-demand when needed
    } finally {
      isPrefetching = false;
    }
  })();

  return prefetchPromise;
}

/**
 * Start prefetch after a delay to not block critical initial render
 */
export function schedulePrefetch(delayMs: number = 2000) {
  setTimeout(() => {
    prefetchProducts();
  }, delayMs);
}
