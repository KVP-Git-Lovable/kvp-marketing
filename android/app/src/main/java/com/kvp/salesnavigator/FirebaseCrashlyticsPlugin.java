package com.kvp.salesnavigator;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.crashlytics.FirebaseCrashlytics;

@CapacitorPlugin(name = "FirebaseCrashlyticsPlugin")
public class FirebaseCrashlyticsPlugin extends Plugin {

    @PluginMethod
    public void setEnabled(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", true);
        FirebaseCrashlytics.getInstance().setCrashlyticsCollectionEnabled(enabled);
        call.resolve();
    }

    @PluginMethod
    public void log(PluginCall call) {
        String message = call.getString("message");
        if (message != null) {
            FirebaseCrashlytics.getInstance().log(message);
        }
        call.resolve();
    }

    @PluginMethod
    public void setUserId(PluginCall call) {
        String userId = call.getString("userId");
        if (userId != null) {
            FirebaseCrashlytics.getInstance().setUserId(userId);
        }
        call.resolve();
    }

    @PluginMethod
    public void recordException(PluginCall call) {
        String message = call.getString("message");
        if (message != null) {
            FirebaseCrashlytics.getInstance().recordException(new Exception(message));
        }
        call.resolve();
    }

    @PluginMethod
    public void crash(PluginCall call) {
        call.resolve(); // Resolve before crashing so the bridge doesn't hang
        throw new RuntimeException("Test crash from app - " + call.getString("message"));
    }
}
