package com.kvp.salesnavigator;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FirebaseCrashlyticsPlugin.class);
        registerPlugin(FirebasePerformancePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
