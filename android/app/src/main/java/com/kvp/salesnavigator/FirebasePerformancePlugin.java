package com.kvp.salesnavigator;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.perf.FirebasePerformance;
import com.google.firebase.perf.metrics.Trace;

import java.util.HashMap;
import java.util.Map;

@CapacitorPlugin(name = "FirebasePerformancePlugin")
public class FirebasePerformancePlugin extends Plugin {
    private Map<String, Trace> traces = new HashMap<>();

    @PluginMethod
    public void startTrace(PluginCall call) {
        String traceName = call.getString("traceName");
        if (traceName != null && !traces.containsKey(traceName)) {
            Trace trace = FirebasePerformance.getInstance().newTrace(traceName);
            trace.start();
            traces.put(traceName, trace);
        }
        call.resolve();
    }

    @PluginMethod
    public void stopTrace(PluginCall call) {
        String traceName = call.getString("traceName");
        if (traceName != null && traces.containsKey(traceName)) {
            Trace trace = traces.get(traceName);
            trace.stop();
            traces.remove(traceName);
        }
        call.resolve();
    }

    @PluginMethod
    public void putAttribute(PluginCall call) {
        String traceName = call.getString("traceName");
        String attribute = call.getString("attribute");
        String value = call.getString("value");
        
        if (traceName != null && attribute != null && value != null && traces.containsKey(traceName)) {
            Trace trace = traces.get(traceName);
            trace.putAttribute(attribute, value);
        }
        call.resolve();
    }
}
