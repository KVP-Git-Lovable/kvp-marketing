# Complete Offline Functionality Guide

## Overview
The app now has **complete offline support** for all critical field sales operations. Everything works without internet connection, and data automatically syncs when you're back online.

## ✅ What Works Offline

### 1. Authentication & Permissions
- ✅ Login/Logout (using cached credentials)
- ✅ Camera, Location, Storage permissions requested on first login
- ✅ User profile and role cached locally
- ✅ Permission modal is non-blocking (can be skipped)

### 2. Beat Management (Complete Offline)
- ✅ View all beats (cached locally)
- ✅ Create new beats (queued for sync)
- ✅ Edit existing beats (queued for sync)
- ✅ Beat plans and schedules
- ✅ Auto-syncs when back online

### 3. Retailer Management (Complete Offline)
- ✅ View all retailers (cached locally)
- ✅ Create new retailers (queued for sync)
- ✅ Edit retailer details (queued for sync)
- ✅ Add retailer to beat (queued for sync)
- ✅ Retailer selection in order flow
- ✅ Auto-syncs when back online

### 4. Order Entry (Complete Offline)
- ✅ View all products with variants (cached locally)
- ✅ Grid view for product selection
- ✅ Table view for order entry
- ✅ Unit conversion (KG/Grams) calculations
- ✅ Scheme calculations and discounts
- ✅ Cart functionality
- ✅ Order review and preview
- ✅ Order submission (queued for sync)
- ✅ Return stock (queued for sync)
- ✅ No order marking (queued for sync)
- ✅ Competition data entry (queued for sync)
- ✅ Auto-syncs when back online

### 5. Stock Management
- ✅ View closing stock (cached)
- ✅ Stock quantity tracking
- ✅ Return stock entry

### 6. Competition Tracking
- ✅ View competitors (cached)
- ✅ View competition SKUs (cached)
- ✅ Add competition data (queued for sync)
- ✅ Competition photos and notes

## 📦 Cached Data (Available Offline)

The following data is automatically cached for offline use:

1. **Products**
   - All active products
   - Product variants
   - Product schemes
   - Product categories
   - Pricing and stock information

2. **Beats**
   - All active beats
   - Beat plans for ±7 days
   - Beat assignments

3. **Retailers**
   - All retailers
   - Retailer details
   - Beat assignments

4. **Competition Data**
   - Competitors list
   - Competition SKUs
   - Previous competition entries

## 🔄 Automatic Sync

When you come back online, the app automatically:

1. **Detects online status** using browser events and network probing
2. **Processes sync queue** in the correct order:
   - Beat creation/updates
   - Retailer creation/updates
   - Orders and order items
   - Competition data
   - Return stock
   - No order reasons

3. **Shows sync progress** with toast notifications:
   - "Syncing..." when sync starts
   - "Sync Complete: X items synced" when done
   - "Sync Failed" if errors occur

4. **Retries failed syncs** automatically

## 📱 Permission Flow

### First Time Login:
1. User logs in successfully
2. App navigates to dashboard (no blocking)
3. After 2 seconds, permission modal appears (can be skipped)
4. User grants/denies permissions for:
   - 📷 Camera (for photos)
   - 📍 Location (for GPS tracking)
   - 💾 Storage (for offline data)

### Subsequent Logins:
- Permissions are remembered
- No modal shown if already granted
- App works immediately

## 🗄️ Storage Architecture

### IndexedDB Stores:
- `products` - Product catalog
- `variants` - Product variants
- `schemes` - Product schemes
- `categories` - Product categories
- `retailers` - Retailer database
- `beats` - Beat information
- `beatPlans` - Beat schedules
- `competitionMaster` - Competitors
- `competitionSkus` - Competition SKUs
- `competitionData` - Competition entries
- `orders` - Offline orders
- `syncQueue` - Pending sync items

### localStorage:
- User authentication
- User profile
- Permission status
- Cache timestamps

## 🔧 Usage Examples

### Creating a Beat Offline:
```typescript
import { useOfflineBeats } from '@/hooks/useOfflineBeats';

const { createBeat, isOnline } = useOfflineBeats();

const handleCreate = async () => {
  const result = await createBeat({
    beat_name: "Downtown Beat",
    beat_id: "BEAT001",
    // ... other fields
  });
  
  if (result.success && result.offline) {
    console.log('Beat saved offline, will sync later');
  }
};
```

### Creating a Retailer Offline:
```typescript
import { useOfflineRetailers } from '@/hooks/useOfflineRetailers';

const { createRetailer, isOnline } = useOfflineRetailers();

const handleCreate = async () => {
  const result = await createRetailer({
    name: "ABC Store",
    address: "123 Main St",
    // ... other fields
  });
  
  if (result.success && result.offline) {
    console.log('Retailer saved offline, will sync later');
  }
};
```

### Submitting an Order Offline:
```typescript
import { useOfflineOrderComplete } from '@/hooks/useOfflineOrderComplete';

const { submitOrder, isOnline } = useOfflineOrderComplete();

const handleSubmit = async () => {
  const result = await submitOrder(orderData, orderItems);
  
  if (result.success && result.offline) {
    console.log('Order queued for sync');
  }
};
```

## 🐛 Troubleshooting

### White Screen on PWA:
- Check if service worker is registered
- Clear cache and reload
- Check console for errors
- Ensure first-time load is with internet

### Data Not Syncing:
- Check sync queue: `offlineStorage.getSyncQueue()`
- Check network status: `navigator.onLine`
- Check console for sync errors
- Try force refresh: Ctrl+Shift+R

### Permissions Not Working:
- Check browser permissions settings
- Re-grant permissions in browser settings
- Skip and re-trigger permission modal later

## 📊 Monitoring

### Check Sync Queue:
```javascript
import { offlineStorage } from '@/lib/offlineStorage';
const queue = await offlineStorage.getSyncQueue();
console.log('Pending syncs:', queue.length);
```

### Check Cached Data:
```javascript
const products = await offlineStorage.getAll('products');
console.log('Cached products:', products.length);
```

### Force Cache Refresh:
```javascript
import { useMasterDataCache } from '@/hooks/useMasterDataCache';
const { cacheAllMasterData } = useMasterDataCache();
await cacheAllMasterData();
```

## 🚀 Testing Offline Mode

1. **In Browser DevTools:**
   - Open DevTools (F12)
   - Go to Network tab
   - Select "Offline" from dropdown
   - Test all features

2. **In Mobile:**
   - Enable Airplane mode
   - Test all features
   - Disable Airplane mode
   - Watch auto-sync

3. **In PWA:**
   - Install PWA
   - Test offline
   - Should work identically to mobile

## ✨ Key Features

- 🚀 **Instant Loading**: Cached data loads immediately
- 🔄 **Auto Sync**: No manual intervention needed
- 💾 **Unlimited Storage**: IndexedDB handles large datasets
- 📱 **Mobile First**: Designed for field sales teams
- 🔒 **Secure**: All data encrypted in transit
- ⚡ **Fast**: No network delays when offline

## 📝 Notes

- All offline operations are **non-blocking**
- Permission modal can be **skipped** without breaking functionality
- Data syncs in **correct order** to maintain referential integrity
- **No data loss** - everything is queued safely
- Works in **PWA and native APK** identically
