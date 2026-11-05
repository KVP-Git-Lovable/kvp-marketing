# Offline Sync Usage Guide

## Overview
The app now has full offline support with automatic syncing when back online. You'll see:
- **Status Bar** at the bottom showing connection status and pending items
- **Auto-upload** of all queued data when connectivity is restored
- **Toast notifications** for sync status

## Visual Indicators

### 1. Status Bar (Bottom of Screen)
- **Online**: Blue background with WiFi icon - "Online ✅"
- **Offline**: Gray background with WiFi Off icon - "Offline Mode • X items queued"
- **Syncing**: Blue with upload icon - "Online • Uploading X items..."
- **Success**: Green with checkmark - "All data synced successfully ✅" (auto-hides after 3s)

### 2. Navbar Indicators
- **KVP Logo**: Green when online, gray when offline
- **Sync Badge**: Shows pending count and sync status

## How to Use in Your Code

### Example 1: Save Order with Offline Support
```typescript
import { useOfflineSync } from '@/hooks/useOfflineSync';

function OrderEntry() {
  const { saveWithOfflineSupport, isOnline } = useOfflineSync();
  
  const handleSaveOrder = async (orderData) => {
    // This will save to IndexedDB and queue for sync
    await saveWithOfflineSupport(
      'orders',           // store name
      orderData,          // data to save
      'CREATE_ORDER'      // sync action
    );
  };
}
```

### Example 2: Check-In with Offline Support
```typescript
const handleCheckIn = async () => {
  const checkInData = {
    id: crypto.randomUUID(),
    user_id: user.id,
    date: new Date().toISOString().split('T')[0],
    check_in_time: new Date().toISOString(),
    check_in_location: { lat, lng },
    check_in_address: address,
    status: 'present'
  };
  
  await saveWithOfflineSupport(
    'attendance',
    checkInData,
    'CREATE_ATTENDANCE'
  );
};
```

### Example 3: Add Stock Data Offline
```typescript
const handleAddStock = async (stockData) => {
  await saveWithOfflineSupport(
    'stock',
    {
      id: crypto.randomUUID(),
      user_id: user.id,
      retailer_id: retailerId,
      product_id: productId,
      product_name: productName,
      stock_quantity: quantity,
      created_at: new Date().toISOString()
    },
    'CREATE_STOCK'
  );
};
```

### Example 4: Update Retailer Info
```typescript
const handleUpdateRetailer = async (retailerId, updates) => {
  await saveWithOfflineSupport(
    'retailers',
    {
      id: retailerId,
      updates: updates
    },
    'UPDATE_RETAILER'
  );
};
```

## Supported Actions

### Sync Actions Available:
- `CREATE_ORDER` - Create new order
- `UPDATE_ORDER` - Update existing order
- `CREATE_VISIT` / `CHECK_IN` - Create visit or check-in
- `CHECK_OUT` - Update visit with check-out
- `CREATE_STOCK` - Add stock data
- `UPDATE_STOCK` - Update stock data
- `CREATE_RETAILER` - Add new retailer
- `UPDATE_RETAILER` - Update retailer info
- `CREATE_ATTENDANCE` - Attendance check-in
- `UPDATE_ATTENDANCE` - Attendance check-out

## Automatic Syncing

The sync happens automatically:
1. **When offline**: All changes are saved to IndexedDB and queued
2. **When online**: Queue is checked every 2 seconds
3. **On reconnect**: All queued items are synced immediately
4. **Status shown**: Visual feedback throughout the process

## Testing Offline Mode

### To test offline functionality:
1. Open DevTools (F12)
2. Go to Network tab
3. Check "Offline" checkbox
4. Perform actions (add order, check-in, etc.)
5. See items queue in status bar
6. Uncheck "Offline"
7. Watch auto-sync happen

### To view queue:
- DevTools → Application → IndexedDB → OfflineAppDB → syncQueue
- See all pending items with timestamps

## User Experience Flow

```
User Action (e.g., Create Order)
        ↓
Saved to IndexedDB immediately ✅
        ↓
    Is Online?
    /        \
  YES        NO
   ↓          ↓
Sync Now   Queue Item
   ↓          ↓
Success!   Show "Saved Offline"
            ↓
        Wait for Online
            ↓
        Auto-Sync All
            ↓
      Show Success ✅
```

## Error Handling

If sync fails:
- Item remains in queue
- User sees error notification
- Will retry on next connectivity check
- Can be manually triggered

## Benefits

✅ **No Data Loss**: Everything saved locally first
✅ **Seamless Experience**: Works offline/online without user thinking about it
✅ **Visual Feedback**: Always know what's happening
✅ **Auto Recovery**: Syncs automatically when back online
✅ **Performance**: Fast local saves, background sync
