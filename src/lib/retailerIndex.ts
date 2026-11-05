/**
 * In-Memory Retailer Index for Fast Filtering
 * 
 * Builds indexes on first load for O(1) lookups instead of O(n) array scans.
 * Critical for handling 10,000+ retailers without lag.
 */

// Use a minimal interface that matches any retailer-like object
interface IndexableRetailer {
  id: string;
  name: string;
  beat_id: string;
  category?: string | null;
  potential?: string | null;
  retail_type?: string | null;
  phone?: string | null;
  address?: string | null;
  [key: string]: any;
}

interface RetailerIndex {
  // All retailers by ID for O(1) lookup
  byId: Map<string, IndexableRetailer>;
  // IDs grouped by beat
  byBeat: Map<string, Set<string>>;
  // IDs grouped by category
  byCategory: Map<string, Set<string>>;
  // IDs grouped by potential
  byPotential: Map<string, Set<string>>;
  // IDs grouped by retail type
  byRetailType: Map<string, Set<string>>;
  // Search tokens -> retailer IDs (for fast text search)
  searchIndex: Map<string, Set<string>>;
  // All retailer IDs for iteration
  allIds: Set<string>;
  // Build timestamp
  builtAt: number;
}

// Singleton index instance
let currentIndex: RetailerIndex | null = null;
let indexVersion = 0;

/**
 * Tokenize text into searchable tokens
 */
function tokenize(text: string): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length >= 2);
}

/**
 * Build the index from retailers array
 * Call this once after loading retailers from cache/network
 */
export function buildRetailerIndex<T extends IndexableRetailer>(retailers: T[]): RetailerIndex {
  console.time('[RetailerIndex] Build time');
  
  const index: RetailerIndex = {
    byId: new Map(),
    byBeat: new Map(),
    byCategory: new Map(),
    byPotential: new Map(),
    byRetailType: new Map(),
    searchIndex: new Map(),
    allIds: new Set(),
    builtAt: Date.now(),
  };

  for (const retailer of retailers) {
    const id = retailer.id;
    
    // Store retailer by ID
    index.byId.set(id, retailer);
    index.allIds.add(id);
    
    // Index by beat
    if (retailer.beat_id) {
      if (!index.byBeat.has(retailer.beat_id)) {
        index.byBeat.set(retailer.beat_id, new Set());
      }
      index.byBeat.get(retailer.beat_id)!.add(id);
    }
    
    // Index by category
    if (retailer.category) {
      const cat = retailer.category.toLowerCase();
      if (!index.byCategory.has(cat)) {
        index.byCategory.set(cat, new Set());
      }
      index.byCategory.get(cat)!.add(id);
    }
    
    // Index by potential
    if (retailer.potential) {
      if (!index.byPotential.has(retailer.potential)) {
        index.byPotential.set(retailer.potential, new Set());
      }
      index.byPotential.get(retailer.potential)!.add(id);
    }
    
    // Index by retail type
    if (retailer.retail_type) {
      const rt = retailer.retail_type.toLowerCase();
      if (!index.byRetailType.has(rt)) {
        index.byRetailType.set(rt, new Set());
      }
      index.byRetailType.get(rt)!.add(id);
    }
    
    // Build search index from name, phone, address
    const searchableText = [
      retailer.name,
      retailer.phone,
      retailer.address,
      retailer.category,
      retailer.beat_id
    ].filter(Boolean).join(' ');
    
    const tokens = tokenize(searchableText);
    for (const token of tokens) {
      if (!index.searchIndex.has(token)) {
        index.searchIndex.set(token, new Set());
      }
      index.searchIndex.get(token)!.add(id);
    }
  }
  
  currentIndex = index;
  indexVersion++;
  
  console.timeEnd('[RetailerIndex] Build time');
  console.log(`[RetailerIndex] Built index for ${retailers.length} retailers`);
  
  return index;
}

/**
 * Get the current index (or null if not built)
 */
export function getRetailerIndex(): RetailerIndex | null {
  return currentIndex;
}

/**
 * Filter retailers using the index - O(1) lookups instead of O(n) scans
 * Returns IndexableRetailer[] which is compatible with any retailer type
 */
export function filterRetailersIndexed<T extends IndexableRetailer = IndexableRetailer>(
  options: {
    searchQuery?: string;
    beatId?: string;
    category?: string;
    potential?: string;
    retailType?: string;
  }
): T[] {
  if (!currentIndex) {
    console.warn('[RetailerIndex] Index not built, returning empty');
    return [];
  }
  
  const { searchQuery, beatId, category, potential, retailType } = options;
  
  // Start with all IDs
  let resultIds: Set<string> = new Set(currentIndex.allIds);
  
  // Filter by beat (O(1))
  if (beatId) {
    const beatIds = currentIndex.byBeat.get(beatId);
    if (beatIds) {
      resultIds = intersection(resultIds, beatIds);
    } else {
      return [];
    }
  }
  
  // Filter by category (O(1))
  if (category) {
    const catIds = currentIndex.byCategory.get(category.toLowerCase());
    if (catIds) {
      resultIds = intersection(resultIds, catIds);
    } else {
      return [];
    }
  }
  
  // Filter by potential (O(1))
  if (potential) {
    const potIds = currentIndex.byPotential.get(potential);
    if (potIds) {
      resultIds = intersection(resultIds, potIds);
    } else {
      return [];
    }
  }
  
  // Filter by retail type (O(1))
  if (retailType) {
    const rtIds = currentIndex.byRetailType.get(retailType.toLowerCase());
    if (rtIds) {
      resultIds = intersection(resultIds, rtIds);
    } else {
      return [];
    }
  }
  
  // Text search using search index
  if (searchQuery && searchQuery.trim()) {
    const tokens = tokenize(searchQuery);
    for (const token of tokens) {
      // Find all IDs that match this token (prefix match)
      const matchingIds = new Set<string>();
      for (const [indexToken, ids] of currentIndex.searchIndex) {
        if (indexToken.startsWith(token) || indexToken.includes(token)) {
          for (const id of ids) {
            matchingIds.add(id);
          }
        }
      }
      resultIds = intersection(resultIds, matchingIds);
    }
  }
  
  // Convert IDs to retailers
  const results: T[] = [];
  for (const id of resultIds) {
    const retailer = currentIndex.byId.get(id);
    if (retailer) {
      results.push(retailer as T);
    }
  }
  
  return results;
}

/**
 * Get retailer by ID - O(1)
 */
export function getRetailerById<T extends IndexableRetailer = IndexableRetailer>(id: string): T | undefined {
  return currentIndex?.byId.get(id) as T | undefined;
}

/**
 * Get all unique values for a field (for filter dropdowns)
 */
export function getUniqueValues(field: 'beat' | 'category' | 'potential' | 'retailType'): string[] {
  if (!currentIndex) return [];
  
  switch (field) {
    case 'beat':
      return Array.from(currentIndex.byBeat.keys()).sort();
    case 'category':
      return Array.from(currentIndex.byCategory.keys()).sort();
    case 'potential':
      return Array.from(currentIndex.byPotential.keys()).sort();
    case 'retailType':
      return Array.from(currentIndex.byRetailType.keys()).sort();
    default:
      return [];
  }
}

/**
 * Clear the index (call on logout or when switching users)
 */
export function clearRetailerIndex(): void {
  if (currentIndex) {
    // Explicitly clear all Maps and Sets to help GC
    currentIndex.byId.clear();
    currentIndex.byBeat.clear();
    currentIndex.byCategory.clear();
    currentIndex.byPotential.clear();
    currentIndex.byRetailType.clear();
    currentIndex.searchIndex.clear();
    currentIndex.allIds.clear();
  }
  currentIndex = null;
  indexVersion++;
  console.log('[RetailerIndex] Index cleared and memory released');
}

/**
 * Get memory usage estimate (for debugging)
 */
export function getIndexMemoryEstimate(): { retailers: number; searchTokens: number } {
  if (!currentIndex) return { retailers: 0, searchTokens: 0 };
  return {
    retailers: currentIndex.byId.size,
    searchTokens: currentIndex.searchIndex.size
  };
}

/**
 * Get index version (for cache invalidation)
 */
export function getIndexVersion(): number {
  return indexVersion;
}

/**
 * Helper: Set intersection
 */
function intersection(setA: Set<string>, setB: Set<string>): Set<string> {
  const result = new Set<string>();
  // Iterate over smaller set for efficiency
  const [smaller, larger] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
  for (const item of smaller) {
    if (larger.has(item)) {
      result.add(item);
    }
  }
  return result;
}
