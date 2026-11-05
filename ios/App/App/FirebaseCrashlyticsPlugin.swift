import Foundation
import Capacitor
import FirebaseCrashlytics

@objc(FirebaseCrashlyticsPlugin)
public class FirebaseCrashlyticsPlugin: CAPPlugin {

    @objc func setEnabled(_ call: CAPPluginCall) {
        let enabled = call.getBool("enabled") ?? true
        Crashlytics.crashlytics().setCrashlyticsCollectionEnabled(enabled)
        call.resolve()
    }

    @objc func log(_ call: CAPPluginCall) {
        if let message = call.getString("message") {
            Crashlytics.crashlytics().log(message)
        }
        call.resolve()
    }

    @objc func setUserId(_ call: CAPPluginCall) {
        if let userId = call.getString("userId") {
            Crashlytics.crashlytics().setUserID(userId)
        }
        call.resolve()
    }

    @objc func recordException(_ call: CAPPluginCall) {
        if let message = call.getString("message") {
            let error = NSError(domain: "AppError", code: 0, userInfo: [NSLocalizedDescriptionKey: message])
            Crashlytics.crashlytics().record(error: error)
        }
        call.resolve()
    }

    @objc func crash(_ call: CAPPluginCall) {
        call.resolve()
        // Trigger a crash after resolving the call
        fatalError("Test crash from app - " + (call.getString("message") ?? ""))
    }
}
