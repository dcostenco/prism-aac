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

    static let _crisisPatternCheck: Void = {
        let missing = crisisKeywords.count - crisisPatterns.count
        if missing > 0 {
            NSLog("[SafetyFilter] CRITICAL: \(missing) crisis pattern(s) failed to compile")
            #if DEBUG
            fatalError("[SafetyFilter] \(missing) crisis pattern(s) failed to compile")
            #endif
        }
    }()

    static let _dosePatternCheck: Void = {
        let missing = medicalDoseKeywords.count - dosePatterns.count
        if missing > 0 {
            NSLog("[SafetyFilter] CRITICAL: \(missing) dose pattern(s) failed to compile")
            #if DEBUG
            fatalError("[SafetyFilter] \(missing) dose pattern(s) failed to compile")
            #endif
        }
    }()

    // MARK: - Check

    static func check(_ input: String) -> Result {
        _ = _crisisPatternCheck
        _ = _dosePatternCheck
        // FIX M2: Use input directly with .caseInsensitive regex — avoids Turkish dotless-I bug
        let range = NSRange(input.startIndex..., in: input)

        for regex in Self.crisisPatterns {
            if regex.firstMatch(in: input, options: [], range: range) != nil {
                return .crisis(response: crisisResponse())
            }
        }

        for regex in Self.dosePatterns {
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
