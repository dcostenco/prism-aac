import Foundation

/// Layer 1 — Deterministic safety filter.
/// Runs synchronously before any model call. Zero latency. Cannot hallucinate.
///
/// Two categories:
///   .crisis   → hardcoded 911/988 response (self-harm, emergency)
///   .medical  → hardcoded refusal (medication dosing)
///
/// Also used as a post-check on Layer 2 output before returning to user.
struct SafetyFilter {

    enum Result {
        case safe
        case crisis(response: String)
        case medical(response: String)
    }

    // MARK: - Keyword sets

    private static let crisisKeywords: [String] = [
        "kill myself", "end my life", "want to die", "suicide", "hurt myself",
        "self harm", "can't breathe", "cant breathe", "choking", "help me",
        "call 911", "call 999", "call 112", "emergency", "heart attack",
        "i'm dying", "im dying", "overdosed", "i took too many",
        "help i", "please help", "sos", "not breathing",
        // FIX L2: Multilingual crisis keywords — matches Watch coverage
        "ayuda", "ayúdame", "no puedo respirar", "llama al 911", "emergencia",
        "aidez-moi", "au secours", "je ne peux pas respirer",
        "ajutor", "nu pot respira",
        "pomogite", "ne mogu dyshat",
        "помогите", "не могу дышать", "скорую", "помощь",
        "النجدة", "لا أستطيع التنفس",
        "עזרה",
    ]

    private static let medicalDoseKeywords: [String] = [
        "how many mg", "how many pills", "how much medication",
        "medication dose", "pill dose", "drug dose", "overdose amount",
        "safe amount to take", "maximum dose", "lethal dose",
        "how much tylenol", "how much ibuprofen", "how much benadryl",
    ]

    // FIX M3: Cached compiled patterns with startup validation — log and crash in DEBUG on failure
    private static let crisisPatterns: [NSRegularExpression] = crisisKeywords.compactMap { keyword in
        let pattern = "(?:^|[^\\p{L}\\p{N}])\(NSRegularExpression.escapedPattern(for: keyword))(?:$|[^\\p{L}\\p{N}])"
        do {
            return try NSRegularExpression(pattern: pattern, options: [.caseInsensitive])
        } catch {
            NSLog("[SafetyFilter] CRITICAL: Pattern compile failed for '\(keyword)': \(error)")
            return nil
        }
    }

    private static let dosePatterns: [NSRegularExpression] = medicalDoseKeywords.compactMap { keyword in
        let pattern = "(?:^|[^\\p{L}\\p{N}])\(NSRegularExpression.escapedPattern(for: keyword))(?:$|[^\\p{L}\\p{N}])"
        do {
            return try NSRegularExpression(pattern: pattern, options: [.caseInsensitive])
        } catch {
            NSLog("[SafetyFilter] CRITICAL: Pattern compile failed for '\(keyword)': \(error)")
            return nil
        }
    }

    private static let _crisisPatternCheck: Void = {
        let missing = crisisKeywords.count - crisisPatterns.count
        if missing > 0 {
            NSLog("[SafetyFilter] CRITICAL: \(missing) crisis pattern(s) failed to compile")
            #if DEBUG
            fatalError("[SafetyFilter] \(missing) crisis pattern(s) failed to compile")
            #endif
        }
    }()

    private static let _dosePatternCheck: Void = {
        let missing = medicalDoseKeywords.count - dosePatterns.count
        if missing > 0 {
            NSLog("[SafetyFilter] CRITICAL: \(missing) dose pattern(s) failed to compile")
            #if DEBUG
            fatalError("[SafetyFilter] \(missing) dose pattern(s) failed to compile")
            #endif
        }
    }()

    // MARK: - Remote keyword updates (portal source of truth)

    // Additional patterns fetched from GET /api/v1/safety/config.
    // Populated once at startup; empty if fetch fails (hardcoded list always runs).
    // Written only from `loadRemoteKeywords()` via `remoteQueue` — safe to read from any thread.
    private nonisolated(unsafe) static var additionalCrisisPatterns: [NSRegularExpression] = []
    private nonisolated(unsafe) static var additionalDosePatterns: [NSRegularExpression] = []

    // Serial queue ensures concurrent calls to loadRemoteKeywords() don't race on the arrays.
    private static let remoteQueue = DispatchQueue(label: "SafetyFilter.remote")

    // Dedicated session with resource timeout — URLSession.shared has no resource timeout,
    // so a stalled portal can hang loadRemoteKeywords() indefinitely.
    private static let remoteSession: URLSession = {
        let cfg = URLSessionConfiguration.ephemeral
        cfg.timeoutIntervalForRequest  = 10
        cfg.timeoutIntervalForResource = 15
        return URLSession(configuration: cfg)
    }()

    /// Fetch keyword updates from the portal and add any new ones to the active pattern set.
    /// Call once at app startup. Never throws — failure leaves hardcoded patterns intact.
    static func loadRemoteKeywords() async {
        guard let url = URL(string: "https://synalux.ai/api/v1/safety/config") else { return }
        do {
            let (data, response) = try await Self.remoteSession.data(from: url)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return }
            guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }

            let remoteCrisis  = (json["crisis"]  as? [String]) ?? []
            let remoteMedical = (json["medical"] as? [String]) ?? []

            // Only compile patterns for keywords not already in the hardcoded set.
            let newCrisis  = remoteCrisis.filter  { !crisisKeywords.contains($0) }
            let newMedical = remoteMedical.filter { !medicalDoseKeywords.contains($0) }

            let compiledCrisis = newCrisis.compactMap { keyword -> NSRegularExpression? in
                let pattern = "(?:^|[^\\p{L}\\p{N}])\(NSRegularExpression.escapedPattern(for: keyword))(?:$|[^\\p{L}\\p{N}])"
                return try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive])
            }
            let compiledDose = newMedical.compactMap { keyword -> NSRegularExpression? in
                let pattern = "(?:^|[^\\p{L}\\p{N}])\(NSRegularExpression.escapedPattern(for: keyword))(?:$|[^\\p{L}\\p{N}])"
                return try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive])
            }
            remoteQueue.sync {
                additionalCrisisPatterns = compiledCrisis
                additionalDosePatterns   = compiledDose
            }
            NSLog("[SafetyFilter] Remote update: +\(newCrisis.count) crisis, +\(newMedical.count) medical keywords")
        } catch {
            NSLog("[SafetyFilter] Remote keyword fetch failed (static list active): \(error)")
        }
    }

    // MARK: - Check

    static func check(_ input: String) -> Result {
        _ = _crisisPatternCheck
        _ = _dosePatternCheck
        // FIX M2: Use input directly with .caseInsensitive regex — avoids Turkish dotless-I bug
        let range = NSRange(input.startIndex..., in: input)

        // Copy remote arrays through the queue before iterating — the write side (loadRemoteKeywords)
        // is also queue-serialized, so reads and writes can't tear each other.
        let (remoteCrisis, remoteDose): ([NSRegularExpression], [NSRegularExpression]) = remoteQueue.sync {
            (additionalCrisisPatterns, additionalDosePatterns)
        }

        for regex in Self.crisisPatterns {
            if regex.firstMatch(in: input, options: [], range: range) != nil {
                return .crisis(response: crisisResponse())
            }
        }
        for regex in remoteCrisis {
            if regex.firstMatch(in: input, options: [], range: range) != nil {
                return .crisis(response: crisisResponse())
            }
        }

        for regex in Self.dosePatterns {
            if regex.firstMatch(in: input, options: [], range: range) != nil {
                return .medical(response: medicalRefusal())
            }
        }
        for regex in remoteDose {
            if regex.firstMatch(in: input, options: [], range: range) != nil {
                return .medical(response: medicalRefusal())
            }
        }

        return .safe
    }

    // MARK: - Hardcoded responses

    // FIX L5: marked private — internal implementation details
    private static func crisisResponse() -> String {
        let lang = Locale.current.language.languageCode?.identifier ?? "en"
        switch lang {
        case "es": return "🆘 Llama al 911 · Estoy aquí contigo."
        case "fr": return "🆘 Appelle le 15/112 · Je suis avec toi."
        case "ro": return "🆘 Sună la 112 · Sunt cu tine."
        case "ru": return "🆘 Звони 112 · Я рядом с тобой."
        case "ar": return "🆘 اتصل بـ 911 · أنا معك."
        case "he": return "🆘 חייג 100/101 · אני איתך."
        default:
            return """
            If this is an emergency, call 911 (US) or your local emergency number now.

            For mental health crisis support:
            • Call or text 988 (Suicide & Crisis Lifeline, US)
            • Text HOME to 741741 (Crisis Text Line)

            I'm here with you. You are not alone.
            """
        }
    }

    private static func medicalRefusal() -> String {
        "For medication questions, please ask your doctor or pharmacist. " +
        "I can't give medical dosing advice."
    }
}
