import Foundation
#if !os(watchOS)
import DatadogCore
import DatadogRUM
import DatadogCrashReporting
#endif

/// Telemetry for PrismCoach iOS.
///
/// Dual-write strategy:
///   1. Real Datadog RUM SDK — actions, errors, user context, crash reporting.
///   2. Synalux portal POST (/api/v1/telemetry) — portal dashboard retention.
///
/// On watchOS the Datadog SDK is unavailable (PLCrashReporter doesn't support
/// watchOS). Only the Synalux telemetry channel fires.
public final class DatadogLogger {
    public static let shared = DatadogLogger()

    // MARK: - Synalux telemetry (legacy channel, kept for portal dashboard)
    private let telemetryURL = URL(string: "https://synalux.ai/api/v1/telemetry")!
    private let service = "prism-aac"
    private let synaluxQueue = DispatchQueue(label: "ai.synalux.telemetry", qos: .utility)
    private var buffer: [[String: Any]] = []
    private var flushTimer: DispatchWorkItem?

    private var userId: String?
    private var userTier: String?
    private var appVersion: String?

    private var datadogInitialized = false

    private init() {
        appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String
    }

    // MARK: - Initialization (call once from app startup)

    public func initialize() {
        guard !datadogInitialized else { return }

        #if os(watchOS)
        print("[DatadogLogger] watchOS — Datadog SDK unavailable, Synalux-only mode")
        #else
        guard let clientToken = Self.plistValue(forKey: "DD_CLIENT_TOKEN"),
              let applicationId = Self.plistValue(forKey: "DD_APPLICATION_ID"),
              !clientToken.isEmpty, !applicationId.isEmpty else {
            print("[DatadogLogger] DD_CLIENT_TOKEN or DD_APPLICATION_ID missing from Info.plist — Datadog SDK disabled, Synalux-only mode")
            return
        }

        #if DEBUG
        let env = "development"
        #else
        let env = "production"
        #endif

        Datadog.initialize(
            with: Datadog.Configuration(
                clientToken: clientToken,
                env: env,
                service: service
            ),
            trackingConsent: .granted
        )

        RUM.enable(
            with: RUM.Configuration(
                applicationID: applicationId,
                sessionSampleRate: 100.0,
                trackFrustrations: true,
                trackBackgroundEvents: false,
                longTaskThreshold: 0.1,
                vitalsUpdateFrequency: .average
            )
        )

        CrashReporting.enable()

        datadogInitialized = true
        print("[DatadogLogger] Datadog SDK initialized (service=\(service), env=\(env))")
        #endif
    }

    // MARK: - Public API

    public func setUser(id: String, tier: String?) {
        synaluxQueue.async {
            self.userId = id
            self.userTier = tier
        }

        #if !os(watchOS)
        if datadogInitialized {
            RUMMonitor.shared().addAttribute(forKey: "usr.tier", value: tier ?? "unknown")
            Datadog.setUserInfo(id: id, extraInfo: ["tier": tier ?? "unknown"])
        }
        #endif
    }

    public func action(_ name: String, context: [String: Any] = [:]) {
        #if !os(watchOS)
        if datadogInitialized {
            let stringContext = context.compactMapValues { "\($0)" }
            RUMMonitor.shared().addAction(type: .custom, name: name, attributes: stringContext)
        }
        #endif
        synaluxLog(level: "info", message: name, context: context, eventType: "action")
    }

    public func error(_ message: String, error: Error? = nil, context: [String: Any] = [:]) {
        var ctx = context
        if let error = error {
            ctx["error_message"] = error.localizedDescription
            ctx["error_type"] = String(describing: type(of: error))
        }

        #if !os(watchOS)
        if datadogInitialized {
            if let error = error {
                RUMMonitor.shared().addError(error: error, source: .source, attributes: ctx.compactMapValues { "\($0)" })
            } else {
                RUMMonitor.shared().addError(message: message, type: "AppError", source: .source, attributes: ctx.compactMapValues { "\($0)" })
            }
        }
        #endif
        synaluxLog(level: "error", message: message, context: ctx, eventType: "error")
    }

    public func log(level: String, message: String, context: [String: Any] = [:], eventType: String = "log") {
        #if !os(watchOS)
        if datadogInitialized {
            if level == "error" {
                RUMMonitor.shared().addError(message: message, type: eventType, source: .source, attributes: context.compactMapValues { "\($0)" })
            } else {
                RUMMonitor.shared().addAction(type: .custom, name: message, attributes: context.compactMapValues { "\($0)" })
            }
        }
        #endif
        synaluxLog(level: level, message: message, context: context, eventType: eventType)
    }

    // MARK: - Synalux telemetry (private)

    private func synaluxLog(level: String, message: String, context: [String: Any], eventType: String) {
        synaluxQueue.async {
            var entry: [String: Any] = [
                "service": self.service,
                "event_type": eventType,
                "message": message,
            ]
            var ctx = context
            ctx["level"] = level
            if let v = self.appVersion { ctx["version"] = v }
            entry["context"] = ctx
            if let uid = self.userId { entry["user_id"] = uid }
            if let tier = self.userTier { entry["user_plan"] = tier }
            self.buffer.append(entry)
            self.scheduleFlush()
        }
    }

    private func scheduleFlush() {
        flushTimer?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.flush() }
        flushTimer = work
        synaluxQueue.asyncAfter(deadline: .now() + 5, execute: work)
    }

    private func flush() {
        guard !buffer.isEmpty else { return }
        let batch = Array(buffer.prefix(50))
        buffer.removeFirst(min(50, buffer.count))

        var request = URLRequest(url: telemetryURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 10

        guard let body = try? JSONSerialization.data(withJSONObject: batch) else { return }
        request.httpBody = body

        URLSession.shared.dataTask(with: request) { _, _, _ in }.resume()

        if !buffer.isEmpty { scheduleFlush() }
    }

    // MARK: - Helpers

    private static func plistValue(forKey key: String) -> String? {
        if let value = Bundle.main.infoDictionary?[key] as? String,
           !value.isEmpty, !value.hasPrefix("$") {
            return value
        }
        return ProcessInfo.processInfo.environment[key]
    }
}
