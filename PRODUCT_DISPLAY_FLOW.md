# Product Display Flow - Established Standard

## Overview
This document defines the **established and permanent** product display flow from Product Master to all user-facing screens (Order Entry, Van Stock, Cart, Invoices).

## Active Product Rules

### What Gets Displayed?
- ✅ Products/variants with `is_active = true` → **SHOWN**
- ✅ Products/variants with `is_active = null` or `undefined` → **SHOWN** (treated as active)
- ❌ Products/variants with `is_active = false` → **HIDDEN**

### When Changes Take Effect
When a product is added or updated in **Product Master**:
1. Change the `is_active` field to `true`
2. Product immediately syncs to cache (within 30 seconds)
3. Product appears in Order Entry, Van Stock, and all order screens
4. No manual refresh needed - automatic background sync

## Display Naming Convention (SYSTEM-WIDE)

### Base Products (No Variants)
```
Display: product.name
Example: "Coca Cola 2L"
```

### Base Products (With Variants)
```
Display: 
  - Base product: product.name
  - Each variant: variant.variant_name (ONLY variant name, NOT "base - variant")

Example:
  - "Coca Cola" (base product, ₹50)
  - "Coca Cola 2L" (variant, ₹100)
  - "Coca Cola 500ml" (variant, ₹30)

NOT: "Coca Cola - Coca Cola 2L" ❌
```

### Product Variants
```
Display: variant.variant_name
Example: "Coca Cola 2L" (NOT "Coca Cola - Coca Cola 2L")
```

## Technical Flow

### 1. Product Master Entry
Admin adds/updates product:
```sql
INSERT INTO products (name, is_active) VALUES ('New Product', true);
INSERT INTO product_variants (product_id, variant_name, is_active) VALUES (uuid, 'Variant 1', true);
```

### 2. Background Sync (`useOfflineOrderEntry.ts`)
```typescript
// Fetches products where is_active = true OR null
.or('is_active.eq.true,is_active.is.null')

// Caches to IndexedDB for offline access
offlineStorage.save(STORES.PRODUCTS, product)
```

### 3. Order Entry Display
- **Cache-First Load**: Instantly loads from IndexedDB
- **Background Sync**: Updates cache in background if online
- **Filter**: Only shows products where `is_active !== false`

### 4. Product Dropdown (`TableOrderForm.tsx`)
```typescript
// Always includes:
// 1. All active base products (even if they have variants)
// 2. All active variants of those products

activeProducts.forEach(product => {
  // Add base product
  options.push({ label: `${product.name} | ₹${product.rate}` });
  
  // Add active variants (variant name only, no prefix)
  product.variants.forEach(variant => {
    if (variant.is_active) {
      options.push({ label: `${variant.variant_name} | ₹${variant.price}` });
    }
  });
});
```

## Components Following This Standard

### ✅ Implemented
1. `useOfflineOrderEntry.ts` - Product fetching and caching
2. `TableOrderForm.tsx` - Product dropdown in table mode
3. `VanStockManagement.tsx` - Stock management product list
4. `OrderEntry.tsx` - Grid and table mode product display

### 🔄 To Verify
- Cart product display
- Invoice product display
- Product search and filtering

## Testing Checklist

### When Adding New Product
- [ ] Add product in Product Master with `is_active = true`
- [ ] Product appears in Order Entry within 30 seconds
- [ ] Product appears in Van Stock Management
- [ ] Product name displays correctly (base product shows name)
- [ ] If variants exist, variant shows only variant name
- [ ] Product can be selected and added to cart
- [ ] Product appears correctly in invoice

### When Adding Variant
- [ ] Add variant in Product Master with `is_active = true`
- [ ] Variant appears in Order Entry dropdown
- [ ] Variant displays ONLY variant name (not "base - variant")
- [ ] Variant can be selected independently
- [ ] Variant pricing is correct

### When Deactivating Product
- [ ] Set `is_active = false` in Product Master
- [ ] Product disappears from Order Entry within 30 seconds
- [ ] Product no longer selectable in new orders
- [ ] Existing orders with product remain unchanged

## Troubleshooting

### Product not showing in Order Entry
1. Check `is_active` status in Product Master → must be `true` or `null`
2. Wait 30 seconds for background sync
3. Manually reload Order Entry page
4. Check browser console for sync errors
5. Verify product exists in Supabase `products` table

### Wrong product name displaying
1. For base products: Check `name` field in `products` table
2. For variants: Check `variant_name` field in `product_variants` table
3. Ensure no custom display logic is overriding the standard
4. Clear cache and reload: IndexedDB → OfflineAppDB → products/variants

### Product count mismatch
1. Count active products in Product Master (is_active = true)
2. Count displayed products in Order Entry dropdown
3. If mismatch, check:
   - Variants marked as inactive
   - Duplicate entries
   - Background sync completion

## Code References

### Key Files
- `src/hooks/useOfflineOrderEntry.ts` - Product fetching logic
- `src/components/TableOrderForm.tsx` - Product dropdown
- `src/pages/OrderEntry.tsx` - Grid mode display
- `src/components/VanStockManagement.tsx` - Van stock product list
- `src/lib/offlineStorage.ts` - IndexedDB caching

### Database Tables
- `products` - Base products
- `product_variants` - Product variants
- `product_categories` - Categories
- `product_schemes` - Promotional schemes

## Future Enhancements
- Real-time product sync (WebSocket)
- Product search optimization
- Advanced filtering by category/brand
- Bulk product import from CSV
- Product analytics dashboard
