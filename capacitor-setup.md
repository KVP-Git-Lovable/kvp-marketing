# Capacitor Android App Setup Guide

## ⚠️ IMPORTANT: Test PWA First!

**Before building APK, test everything in PWA mode first!**

See [PWA-TESTING-GUIDE.md](./PWA-TESTING-GUIDE.md) for detailed testing instructions.

### Why PWA First?
- ✅ Same code as APK - if PWA works, APK will work
- ✅ Instant testing - no need to build APK
- ✅ Easy debugging - use browser DevTools
- ✅ All permissions work - camera, location, storage
- ✅ Offline mode testing - test sync functionality

### Recommended Workflow:
```
1. Make changes in Lovable
2. Test in browser
3. Install and test as PWA
4. Only when PWA is perfect → Build APK
```

---

## Prerequisites
- Android Studio installed
- Node.js and npm installed
- Git installed
- **All features tested and working in PWA**

## Setup Steps

### 1. Export and Clone Project
1. In Lovable, click "Export to Github" button
2. Clone your repository locally:
```bash
git clone <your-repo-url>
cd <your-project>
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Add Android Platform
```bash
npx cap add android
```

### 4. Update Native Platform
```bash
npx cap update android
```

### 5. Build the Web App
```bash
npm run build
```

### 6. Sync Changes to Native Platform
```bash
npx cap sync android
```

### 7. Open in Android Studio
```bash
npx cap open android
```

### 8. How Permissions Work

The app requests permissions **when you actually use the features**, just like any normal app:

#### **Location Permission**
- Requested when: You sign in, or access Attendance page for check-in/GPS tracking
- Options shown: "Allow while using the app", "Allow all the time", "Deny"
- Used for: Check-ins, GPS tracking, location-based features
- **Test in PWA first**: Browser shows "Allow/Block"

#### **Camera Permission**  
- Requested when: You open the camera to take a photo (attendance, visit photos, etc.)
- Options shown: "Allow while using the app", "Allow once", "Deny"
- Used for: Attendance photos, visit documentation, branding photos
- **Test in PWA first**: Browser shows "Allow/Block"

#### **Storage Permission** (Native only)
- Requested when: You sign in (for offline data storage)
- Options shown: "Allow", "Deny"
- Used for: Offline mode, caching data locally
- **Test in PWA first**: Always available in browser (localStorage/IndexedDB)

### 9. Run on Device/Emulator

In Android Studio:
1. Select your device/emulator from the dropdown
2. Click the green "Run" button (or press Shift+F10)

Or from command line:
```bash
npx cap run android
```

## Testing Permissions (Should Match PWA Behavior)

Since you already tested in PWA, the APK should behave identically:

### Test Permission Flow:
1. **First Launch:**
   - Open app, no permissions requested yet
   - Sign in → Location permission dialog appears (just like PWA)
   - Choose "Allow while using app" or "Allow all the time"

2. **Camera Access:**
   - Go to Attendance page
   - Click "Start Day" or "End Day"
   - Camera permission dialog appears (just like PWA)
   - Choose "Allow while using app" or "Allow once"

3. **Deny & Re-request:**
   - If you deny a permission, the feature won't work (same as PWA)
   - You can grant it later from Android Settings → Apps → Your App → Permissions

### Test Offline Mode (Should Match PWA Behavior):
1. Sign in and grant permissions
2. Let the app cache data (wait a few seconds)
3. Turn off WiFi and mobile data
4. Navigate to:
   - My Visits → should show cached visits (same as PWA)
   - Cart → should work and queue orders (same as PWA)
   - Beats → should show cached beats (same as PWA)
   - Retailers → should show cached retailers (same as PWA)
5. Turn internet back on
6. Pending orders should sync automatically (same as PWA)

**If anything works differently than PWA, it's a bug - go back and fix in PWA first!**

## Troubleshooting

### Permission dialogs not appearing?
- **First check**: Did they work in PWA? If not, fix PWA first
- Make sure you're on a physical device or emulator with Play Services
- Check Android Settings → Apps → Your App → Permissions
- Try clearing app data and relaunching

### "Permission denied" errors?
- **First check**: Did they work in PWA? If not, fix PWA first
- Go to Android Settings → Apps → Your App → Permissions
- Manually grant required permissions
- Restart the app

### App not loading?
- Run `npm run build` followed by `npx cap sync android`
- Clean and rebuild in Android Studio
- **Check**: Does PWA load correctly?

### Offline mode not working?
- **First check**: Does it work in PWA? If not, fix PWA first
- Make sure Storage permission is granted
- Check that you're signed in before going offline
- Verify localStorage/IndexedDB is working in WebView

### Features work in PWA but not in APK?
1. Check WebView is up to date on device
2. Enable WebView debugging
3. Check for console errors in Chrome://inspect
4. Verify all assets are bundled correctly
5. Check Capacitor plugin versions

## After Making Changes - Critical Workflow

**ALWAYS follow this workflow for any changes:**

```
1. Make changes in Lovable
   ↓
2. Test in browser (desktop/mobile view)
   ↓
3. Test as PWA (install and test)
   ↓
4. Verify all features work in PWA
   ↓
5. Only then update APK:
   - git pull
   - npm install
   - npm run build
   - npx cap sync android
   - Reload in Android Studio
```

**Never skip PWA testing! It saves hours of debugging.**

## Building APK for Distribution

1. In Android Studio: Build > Build Bundle(s) / APK(s) > Build APK(s)
2. APK will be in: `android/app/build/outputs/apk/debug/`
3. For production: Use "Generate Signed Bundle" instead

## Important Notes

- **Test PWA first, always!** It's faster and easier
- Permissions are requested when needed, not on app startup (same as PWA)
- Browser and native apps show proper permission dialogs
- "Allow while using app" is recommended for location (saves battery)
- Storage permission enables offline data persistence (same as PWA)
- Camera and location permissions are critical for core features (same as PWA)
- If it works in PWA, it will work in APK
- The app is configured with hot-reload for development
- For production, update `capacitor.config.ts` to remove the server configuration

## Quick Reference

**PWA Testing**: See [PWA-TESTING-GUIDE.md](./PWA-TESTING-GUIDE.md)

**Development Flow**:
1. Develop in Lovable
2. Test in browser
3. Test as PWA ← **Most important step!**
4. Build APK (only when PWA is perfect)

**Remember**: PWA = APK Preview. Always test PWA first!
