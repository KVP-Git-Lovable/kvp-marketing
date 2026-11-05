# PWA Testing Guide - Test Before Converting to APK

**IMPORTANT**: Always test all features in PWA mode first. If it works in PWA, it will work in the native Android APK.

## Why Test PWA First?

1. ✅ **Faster**: No need to build APK, instant testing in browser
2. ✅ **Same Features**: PWA uses same code as native app
3. ✅ **Easy Debugging**: Browser DevTools for debugging
4. ✅ **Permissions Work**: Camera, Location, Storage all work in PWA
5. ✅ **Offline Mode**: Test offline functionality without building APK

## How to Install PWA (Progressive Web App)

### On Android/Chrome:
1. Open the app in Chrome browser
2. You'll see an "Install" prompt at the bottom or in the menu
3. Click "Install" or go to Menu (⋮) → "Install app"
4. App icon will be added to your home screen
5. Open from home screen - works like a native app!

### On iPhone/Safari:
1. Open the app in Safari
2. Tap the Share button (square with arrow)
3. Scroll and tap "Add to Home Screen"
4. Tap "Add"
5. App icon appears on home screen

### On Desktop/Chrome:
1. Open the app in Chrome
2. Look for install icon (⊕) in the address bar
3. Click "Install"
4. App opens in its own window

## Testing Checklist - Do This Before Building APK

### ✅ 1. Permission Testing

**Test Location Permission:**
1. Open PWA and sign in
2. Browser should show: "Allow [app] to access your location?"
3. Options: "Allow" or "Block"
4. Click "Allow"
5. Go to Attendance page
6. Location should work for check-in

**Test Camera Permission:**
1. In PWA, go to Attendance
2. Click "Start Day" or "End Day"
3. Browser shows: "Allow [app] to use your camera?"
4. Click "Allow"
5. Camera should open for taking photo
6. Take photo and verify it uploads

**Test Storage (Always Available):**
- No prompt needed in browser
- localStorage and IndexedDB always work
- Data persists between sessions

### ✅ 2. Offline Mode Testing

**Step 1: Load Data While Online**
1. Open PWA and sign in
2. Navigate to:
   - My Visits (loads visit data)
   - Beats (loads beat data)
   - Order Entry (loads product data)
   - Retailers (loads retailer data)
3. Wait 5 seconds for data to cache
4. You'll see console logs: "✅ All master data cached successfully"

**Step 2: Test Offline**
1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Check "Offline" checkbox (or set to "Offline" in throttling)
4. OR turn off WiFi/Mobile data
5. Navigate through the app:
   - ✅ My Visits → Should show cached visits
   - ✅ Beats → Should show cached beats
   - ✅ Order Entry → Should show cached products
   - ✅ Cart → Should work, items saved locally
   - ✅ Retailers → Should show cached retailers

**Step 3: Make Changes Offline**
1. Still offline, go to Order Entry
2. Add products to cart
3. Go to Cart page
4. Verify items are there
5. Try to submit order → Should queue for sync
6. Check localStorage in DevTools → Should see queued order

**Step 4: Test Auto-Sync**
1. Turn internet back on (uncheck "Offline" in DevTools)
2. Wait 5-10 seconds
3. Queued orders should automatically sync
4. Toast notification: "Synced successfully"
5. Verify data in database

### ✅ 3. Feature Testing (All Pages)

**Attendance:**
- ✅ Location permission requested
- ✅ Camera permission requested
- ✅ Start Day works
- ✅ End Day works
- ✅ Photos upload successfully
- ✅ GPS tracking works

**My Visits:**
- ✅ Shows today's planned visits
- ✅ Check-in works with location
- ✅ Can add retailers inline
- ✅ Works offline with cached data

**Beats:**
- ✅ Shows all beats
- ✅ Can create beat plans
- ✅ Can add retailers to beats
- ✅ Cached for offline access

**Order Entry:**
- ✅ Shows products with variants
- ✅ Can add to cart
- ✅ Schemes calculate correctly
- ✅ Works offline with cached products

**Cart:**
- ✅ Shows cart items
- ✅ Can modify quantities
- ✅ Can remove items
- ✅ Payment flow works
- ✅ Orders queue when offline

**Retailers:**
- ✅ Shows all retailers
- ✅ Can search retailers
- ✅ Cached for offline use
- ✅ Can view retailer details

### ✅ 4. Storage Testing

**Check What's Stored:**
1. Open DevTools (F12)
2. Go to "Application" tab
3. Check:
   - **localStorage**: User data, cached auth
   - **IndexedDB**: Products, beats, retailers, orders
   - **Service Worker**: Check "Service Workers" section
   - **Cache Storage**: Check precached assets

**Verify Cache Size:**
- Application → Storage → Check usage
- Should be under 50MB typically
- Increase if needed in service worker config

### ✅ 5. Update Testing

**Test App Updates:**
1. Make a code change in Lovable
2. Click "Update" in publish dialog
3. Wait for deployment
4. Reload PWA
5. Should show update notification
6. Click "Update" to get new version
7. App should refresh with new changes

## Common Issues & Solutions

### ❌ Problem: "Permission denied" for camera
**Solution**: 
- Go to browser Settings → Site Settings → Camera
- Find your app URL
- Change to "Allow"
- Reload app

### ❌ Problem: Location not working
**Solution**:
- Browser Settings → Site Settings → Location
- Set to "Allow"
- Make sure device GPS is enabled
- Reload app

### ❌ Problem: Data not persisting offline
**Solution**:
- Check DevTools → Application → IndexedDB
- Verify data is being cached
- Check console for "Cached X items" messages
- May need to stay online longer for initial cache

### ❌ Problem: App not working offline
**Solution**:
- Make sure you loaded data while online first
- Check Service Worker is active (DevTools → Application → Service Workers)
- Check offline.html is cached
- Try clearing cache and reloading while online

### ❌ Problem: Updates not showing
**Solution**:
- Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- Unregister service worker in DevTools
- Clear cache and reload

## Development Workflow

### Perfect Development Flow:
```
1. Make changes in Lovable
   ↓
2. Test in browser (dev mode)
   ↓
3. Test permissions in browser
   ↓
4. Test offline mode in browser
   ↓
5. Install as PWA
   ↓
6. Test PWA thoroughly
   ↓
7. If PWA works → Build APK
   ↓
8. APK will work same as PWA!
```

### DON'T DO THIS:
```
❌ Make changes → Build APK → Test
   (Too slow, hard to debug)
```

### DO THIS:
```
✅ Make changes → Test PWA → Then build APK
   (Fast, easy debugging, guaranteed to work)
```

## Debugging Tools

### Chrome DevTools:
- **Console**: See logs, errors
- **Network**: Monitor API calls, simulate offline
- **Application**: Check storage, service worker, cache
- **Sources**: Debug JavaScript
- **Performance**: Check app speed

### Testing Offline:
1. DevTools → Network → Check "Offline"
2. OR DevTools → Network → Throttling → "Offline"
3. OR Turn off WiFi/Mobile data

### Checking Permissions:
1. DevTools → Console
2. Run: `navigator.permissions.query({name: 'camera'})`
3. Run: `navigator.permissions.query({name: 'geolocation'})`

## Before Building APK

### Final Checklist:
- [ ] All permissions work in PWA
- [ ] Offline mode works perfectly
- [ ] All features tested and working
- [ ] No console errors
- [ ] Data persists offline
- [ ] Orders sync when back online
- [ ] Camera works for photos
- [ ] Location works for check-ins
- [ ] GPS tracking works
- [ ] Update mechanism works

### Only Then:
✅ **Export to GitHub** → Follow `capacitor-setup.md` → Build APK

## Remember

🎯 **PWA = Preview of APK**
- If it works in PWA, it will work in APK
- PWA testing is faster and easier
- Always test PWA first!

💡 **Pro Tip**: Keep PWA installed on your phone for quick testing during development. Only build APK when everything is perfect in PWA.
