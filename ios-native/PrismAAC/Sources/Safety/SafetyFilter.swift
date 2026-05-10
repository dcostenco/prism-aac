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

    private static let crisisKeywords: Set<String> = [
        "kill myself", "end my life", "want to die", "suicide", "hurt myself",
        "self harm", "can't breathe", "cant breathe", "choking", "help me",
        "call 911", "call 999", "call 112", "emergency", "heart attack",
        "i'm dying", "im dying", "overdosed", "i took too many",
        "help i", "please help", "sos", "not breathing",
    ]

    private static let medicalDoseKeywords: Set<String> = [
        "how many mg", "how many pills", "how much medication",
        "medication dose", "pill dose", "drug dose", "overdose amount",
        "safe amount to take", "maximum dose", "lethal dose",
        "how much tylenol", "how much ibuprofen", "how much benadryl",
    ]

    // MARK: - Check

    static func check(_ input: String) -> Result {
        let lower = input.lowercased()

        for keyword in crisisKeywords where lower.contains(keyword) {
            return .crisis(response: crisisResponse())
        }

        for keyword in medicalDoseKeywords where lower.contains(keyword) {
            return .medical(response: medicalRefusal())
        }

        return .safe
    }

    // MARK: - Hardcoded responses

    static func crisisResponse() -> String {
        """
        If this is an emergency, call 911 (US) or your local emergency number now.

        For mental health crisis support:
        • Call or text 988 (Suicide & Crisis Lifeline, US)
        • Text HOME to 741741 (Crisis Text Line)

        I'm here with you. You are not alone.
        """
    }

    static func medicalRefusal() -> String {
        "For medication questions, please ask your doctor or pharmacist. " +
        "I can't give medical dosing advice."
    }
}
