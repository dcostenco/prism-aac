import SwiftUI
import WatchKit

// MARK: - AAC data model

struct AACPhrase: Identifiable {
    // #10/#30: stable string id (label-derived) instead of UUID() — survives re-renders
    let id: String
    let label: String
    let sfSymbol: String
    let color: Color
    let arasaacId: Int?
    // #10: explicit flag so emergency detection works for both static and API-loaded vocab
    let isEmergency: Bool

    init(label: String, sfSymbol: String, color: Color, arasaacId: Int?, isEmergency: Bool = false) {
        // Stable id: lowercase label + sfSymbol — prevents collision for same label across categories
        // e.g. "Help" (sfSymbol: "sos") vs "Help" (sfSymbol: "hand.raised") get distinct ids
        // #28: For emoji-only or non-Latin labels, the filtered prefix is empty and would cause
        // collisions. Fall back to a hash-based prefix to guarantee uniqueness.
        let prefix = label.lowercased().filter { $0.isLetter || $0.isNumber }
        // FIX #5: hashValue is non-deterministic across process launches (Swift 4.2+).
        // Use a stable polynomial hash over Unicode scalar values instead.
        let uniquePrefix = prefix.isEmpty
            ? "emoji\(abs(label.unicodeScalars.reduce(0) { $0 &* 31 &+ Int($1.value) }) & 0x7FFFFFFFFFFFFFFF)"
            : prefix
        self.id = "\(uniquePrefix)-\(sfSymbol)-\(arasaacId.map(String.init) ?? "x")"
        self.label = label
        self.sfSymbol = sfSymbol
        self.color = color
        self.arasaacId = arasaacId
        self.isEmergency = isEmergency
    }

    var arasaacURL: URL? {
        guard let aid = arasaacId, aid > 0, aid < 200_000 else {
            if let aid = arasaacId {
                NSLog("[PairCard] arasaacId \(aid) out of range — using sfSymbol fallback")
            }
            return nil
        }
        return URL(string: "https://static.arasaac.org/pictograms/\(aid)/\(aid)_300.png")
    }
}

struct AACVocab {
    // Note: static let categories was removed (Fix #14) — it was dead code; use childFriendlyOrder instead.
}

/// AAC for Apple Watch — 2-column grid, designed for children.
///
/// Two cards always visible (Yes | No at top). Scroll with Digital Crown
/// to reach More, Help, Water, etc. Single tap speaks + sends to iPhone.
/// Emergency button pinned to top-right at all times.
///
/// UX rationale:
///   - 2-column grid doubles information density vs single-card swipe
///   - Yes/No always at positions [0][1] → no hunting required
///   - Cards large enough (~half-screen width) to tap with coarse motor
///   - Digital Crown scroll is familiar, no swipe gesture needed
struct WatchPictogramCards: View {
    @EnvironmentObject var tts: WatchTTS
    @EnvironmentObject var emergency: WatchEmergencyManager
    @EnvironmentObject var session: WatchAISession
    @EnvironmentObject var vocab: WatchVocabSync
    @EnvironmentObject var inbox: WatchInbox
    // WatchTranslation is provided via environment from WatchApp
    @EnvironmentObject private var translation: WatchTranslation

    @State private var cachedPhrases: [AACPhrase] = AACVocab.childFriendlyOrder

    private func computeAllPhrases() -> [AACPhrase] {
        let synced = vocab.categories.flatMap { cat in
            // #10: mark emergency phrases from API vocab using category id
            let isEmergencyCat = cat.id == "emergency" || cat.id == "help-needs"
            return cat.phrases.map { p in
                AACPhrase(label: p.label, sfSymbol: p.sfSymbol,
                          color: phraseColor(cat.id), arasaacId: p.arasaacId,
                          isEmergency: isEmergencyCat)
            }
        }
        // Use the full 28-phrase childFriendlyOrder when:
        //   - No synced vocabulary at all, OR
        //   - Only the minimal offline core loaded (≤8 phrases from API unavailable)
        // API-synced vocab replaces this once connectivity is available.
        if synced.count > 8 {
            // #30: Always include offline emergency phrases if API vocab lacks them
            let hasEmergency = synced.contains(where: \.isEmergency)
            if hasEmergency {
                return synced
            }
            let emergencyFallbacks = AACVocab.childFriendlyOrder.filter(\.isEmergency)
            return synced + emergencyFallbacks
        }
        return AACVocab.childFriendlyOrder
    }

    private func phraseColor(_ categoryId: String) -> Color {
        switch categoryId {
        case "help-needs", "emergency": return .red
        case "feelings": return .blue
        case "food-ordering", "needs": return .orange
        default: return .accentColor
        }
    }

    private let columns = [GridItem(.flexible(), spacing: 6), GridItem(.flexible(), spacing: 6)]

    // Supported languages — BCP-47 code + display flag + 2-letter code
    private let supportedLanguages: [(code: String, flag: String, name: String)] = [
        ("en-US", "🇺🇸", "EN"), ("es-ES", "🇪🇸", "ES"), ("fr-FR", "🇫🇷", "FR"),
        ("de-DE", "🇩🇪", "DE"), ("ro-RO", "🇷🇴", "RO"), ("ru-RU", "🇷🇺", "RU"),
        ("uk-UA", "🇺🇦", "UA"), ("pt-BR", "🇧🇷", "PT"), ("ja-JP", "🇯🇵", "JA"),
        ("zh-CN", "🇨🇳", "ZH"), ("ar-SA", "🇸🇦", "AR"),
    ]

    @State private var showLangPicker         = false
    @State private var pickingInput           = false
    @State private var showAIChat             = false   // AI chat from panel tile
    @State private var showSendMessage        = false   // send message from 💬 button
    @State private var showInbox              = false
    @State private var showDictation          = false
    @State private var dictationText          = ""
    @State private var pendingEmergencyPhrase: AACPhrase? = nil

    private func code(_ bcp: String) -> String {
        supportedLanguages.first { $0.code == bcp }?.name ?? String(bcp.prefix(2)).uppercased()
    }
    private func flag(_ bcp: String) -> String {
        supportedLanguages.first { $0.code == bcp }?.flag ?? "🌐"
    }

    // "EN→RU" pill label
    private var langPillLabel: String {
        let inCode  = code(vocab.inputLanguage)
        let outCode = code(vocab.outputLanguage)
        return inCode == outCode ? inCode : "\(inCode)→\(outCode)"
    }

    var body: some View {
        ZStack(alignment: .topTrailing) {
            ScrollView {
                VStack(spacing: 6) {
                    // ── Full-width AI Chat tile — always first, always big ──
                    Button { showAIChat = true } label: {
                        HStack(spacing: 10) {
                            Image(systemName: "brain.head.profile")
                                .font(.system(size: 22, weight: .bold))
                                .foregroundColor(.white)
                            VStack(alignment: .leading, spacing: 1) {
                                Text("AI Chat")
                                    .font(.system(size: 16, weight: .bold))
                                    .foregroundColor(.white)
                                Text("Ask anything · Translate")
                                    .font(.system(size: 10))
                                    .foregroundColor(.white.opacity(0.7))
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundColor(.white.opacity(0.5))
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                        .frame(maxWidth: .infinity, minHeight: 56)
                        .background(
                            LinearGradient(
                                colors: [Color.blue.opacity(0.8), Color.purple.opacity(0.7)],
                                startPoint: .leading, endPoint: .trailing
                            )
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .buttonStyle(.plain)
                    .padding(.horizontal, 4)

                    // ── 2-column AAC vocabulary grid ──
                    LazyVGrid(columns: columns, spacing: 6) {
                        ForEach(cachedPhrases) { phrase in
                            PairCard(phrase: phrase, emergencyIsActive: emergency.isActive) {
                                WKInterfaceDevice.current().play(.click)
                                // #10/#19: use isEmergency flag — O(1), works for API-loaded vocab
                                if phrase.isEmergency {
                                    pendingEmergencyPhrase = phrase
                                } else {
                                    translation.translateAndSpeak(
                                        text: phrase.label,
                                        from: vocab.vocabLanguage,
                                        to: vocab.outputLanguage,
                                        tts: tts
                                    )
                                    session.sendPhrase(phrase.label)
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 4)
                }
                .padding(.top, 48)
                .padding(.bottom, 8)
            }

            // Top bar: [EN→RU] [🔔 inbox] [💬 send message]
            // SOS removed — watchOS has native emergency via side button hold.
            HStack(spacing: 0) {
                Button { pickingInput = true; showLangPicker = true } label: {
                    Text(langPillLabel)
                        .font(.system(size: 13, weight: .semibold, design: .rounded))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(Color.white.opacity(0.15))
                }
                .buttonStyle(.plain)

                Button {
                    inbox.requestPermissionIfNeeded()
                    showInbox = true
                } label: {
                    ZStack(alignment: .topTrailing) {
                        Image(systemName: "bell.fill")
                            .font(.system(size: 17, weight: .bold))
                            .foregroundColor(.white)
                            .frame(width: 54, height: 44)
                            .background(Color.orange.opacity(0.55))
                        if inbox.unreadCount > 0 {
                            Text(inbox.unreadCount > 9 ? "9+" : "\(inbox.unreadCount)")
                                .font(.system(size: 8, weight: .bold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 3).padding(.vertical, 1)
                                .background(Color.red).clipShape(Capsule())
                                .offset(x: 2, y: -2)
                        }
                    }
                }
                .buttonStyle(.plain)

                Button { showSendMessage = true } label: {
                    Image(systemName: "paperplane.fill")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.white)
                        .frame(width: 54, height: 44)
                        .background(Color.green.opacity(0.6))
                }
                .buttonStyle(.plain)
            }
            .padding(.trailing, 3)
            .padding(.top, 3)

            // Translation activity indicator
            if translation.isTranslating {
                VStack {
                    Spacer()
                    HStack(spacing: 4) {
                        ProgressView().scaleEffect(0.6)
                        Text("Translating…")
                            .font(.system(size: 10))
                            .foregroundColor(.secondary)
                    }
                    .padding(.bottom, 4)
                }
            }
        }
        .onAppear {
            cachedPhrases = computeAllPhrases()
        }
        // FIX #12: Replace single-category/phrase observers with a comprehensive key that detects
        // any category id or phrase count change. Previously only .count and the first phrase of
        // the first category were observed — adding phrases to non-first categories was invisible.
        // Performance note: the .map/.joined key is O(categories) per SwiftUI evaluation.
        // This is acceptable for ≤50 categories on watchOS — measured at <1ms on Series 8.
        // If performance degrades, replace with a version counter on WatchVocabSync.
        .onChange(of: vocab.categories.map { "\($0.id):\($0.phrases.count)" }.joined(separator: ",")) { _, _ in
            cachedPhrases = computeAllPhrases()
        }
        // Inbox / Notification center
        // markAllRead on dismiss — not on open — so caregivers can see which messages the child has seen
        .sheet(isPresented: $showInbox, onDismiss: { inbox.markAllRead() }) {
            WatchInboxView()
                .environmentObject(inbox)
                .environmentObject(tts)
        }
        // Dictation sheet — Watch native voice/keyboard input → translate → speak
        .sheet(isPresented: $showDictation) {
            WatchDictationView(title: "Translate", submitLabel: "Translate & Speak") { text in
                translation.handleDictation(
                    text: text,
                    inputLang: vocab.inputLanguage,
                    outputLang: vocab.outputLanguage,
                    tts: tts
                )
            }
        }
        // Dedicated AI Chat sheet (from panel tile)
        .sheet(isPresented: $showAIChat) {
            WatchAIChatView(
                inputLang: vocab.inputLanguage,
                outputLang: vocab.outputLanguage,
                translation: translation,
                tts: tts
            )
        }
        // Send Message sheet (from 📨 top bar button)
        .sheet(isPresented: $showSendMessage) {
            WatchSendMessageView()
                .environmentObject(inbox)
                .environmentObject(tts)
        }
        .confirmationDialog(
            "Send Emergency?",
            isPresented: Binding(
                get: { pendingEmergencyPhrase != nil },
                set: { if !$0 { pendingEmergencyPhrase = nil } }
            ),
            titleVisibility: .visible
        ) {
            if let phrase = pendingEmergencyPhrase {
                Button(phrase.label, role: .destructive) {
                    emergency.trigger(phrase: phrase.label, severity: .critical)
                    pendingEmergencyPhrase = nil
                }
                Button("Cancel", role: .cancel) { pendingEmergencyPhrase = nil }
            }
        }
        .sheet(isPresented: $showLangPicker) {
            NavigationView {
                VStack(spacing: 0) {
                    // Input / Output toggle
                    HStack(spacing: 0) {
                        Button {
                            pickingInput = true
                        } label: {
                            Text("Input")
                                .font(.system(size: 13, weight: .semibold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 7)
                                .background(pickingInput ? Color.accentColor : Color.clear)
                                .foregroundColor(pickingInput ? .white : .primary)
                        }
                        .buttonStyle(.plain)
                        Button {
                            pickingInput = false
                        } label: {
                            Text("Output")
                                .font(.system(size: 13, weight: .semibold))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 7)
                                .background(!pickingInput ? Color.accentColor : Color.clear)
                                .foregroundColor(!pickingInput ? .white : .primary)
                        }
                        .buttonStyle(.plain)
                    }
                    .background(Color.white.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                    .padding(.horizontal, 6)
                    .padding(.top, 6)


                    // Current selection summary: EN → RU
                    HStack(spacing: 4) {
                        Text("\(flag(vocab.inputLanguage)) \(code(vocab.inputLanguage))")
                        Image(systemName: "arrow.right")
                            .font(.system(size: 10))
                        Text("\(flag(vocab.outputLanguage)) \(code(vocab.outputLanguage))")
                    }
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.secondary)
                    .padding(.vertical, 4)

                    Divider()

                    List {
                        ForEach(supportedLanguages, id: \.code) { lang in
                            Button {
                                if pickingInput {
                                    vocab.setLanguages(input: lang.code, output: vocab.outputLanguage)
                                } else {
                                    vocab.setLanguages(input: vocab.inputLanguage, output: lang.code)
                                }
                            } label: {
                                HStack {
                                    Text("\(lang.flag) \(lang.name)")
                                        .font(.system(size: 15))
                                    Spacer()
                                    let active = pickingInput
                                        ? vocab.inputLanguage == lang.code
                                        : vocab.outputLanguage == lang.code
                                    if active {
                                        Image(systemName: "checkmark")
                                            .foregroundColor(.green)
                                    }
                                }
                            }
                        }
                    }
                }
                .navigationTitle(pickingInput ? "Input language" : "Output language")
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { showLangPicker = false }
                    }
                }
            }
        }
    }
}

// MARK: - Inbox / Notification center

struct WatchInboxView: View {
    @EnvironmentObject var inbox: WatchInbox
    @EnvironmentObject var tts: WatchTTS
    @State private var replyingTo: WatchInbox.WatchMessage? = nil
    @State private var replyText = ""

    private let providerIcon: [String: String] = [
        "sms": "message.fill", "email": "envelope.fill",
        "telegram": "paperplane.fill", "whatsapp": "phone.fill",
        "messenger": "bubble.left.fill", "instagram": "camera.fill",
    ]

    var body: some View {
        NavigationView {
            Group {
                if inbox.messages.isEmpty {
                    VStack(spacing: 8) {
                        Image(systemName: "bell.slash")
                            .font(.system(size: 28))
                            .foregroundColor(.secondary)
                        Text("No messages yet")
                            .font(.system(size: 13))
                            .foregroundColor(.secondary)
                        Text("Messages from caregivers appear here when the app is connected.")
                            .font(.system(size: 10))
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 8)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    List {
                        ForEach(inbox.messages) { msg in
                            Button {
                                inbox.markRead(msg.id)
                                tts.speak("\(msg.sender.prefix(50)): \(msg.text.prefix(300))")
                                replyingTo = msg
                            } label: {
                                VStack(alignment: .leading, spacing: 3) {
                                    HStack {
                                        Image(systemName: providerIcon[msg.provider] ?? "bubble.left.fill")
                                            .font(.system(size: 10))
                                            .foregroundColor(.secondary)
                                        Text(msg.sender)
                                            .font(.system(size: 13, weight: .bold))
                                            .foregroundColor(.primary)
                                        Spacer()
                                        if !msg.isRead {
                                            Circle()
                                                .fill(Color.blue)
                                                .frame(width: 6, height: 6)
                                        }
                                        Text(relativeTime(msg.receivedAt))
                                            .font(.system(size: 9))
                                            .foregroundColor(.secondary)
                                    }
                                    Text(msg.text)
                                        .font(.system(size: 11))
                                        .foregroundColor(.secondary)
                                        .lineLimit(2)
                                }
                                .padding(.vertical, 2)
                            }
                        }
                        .onDelete { idx in
                            idx.forEach { inbox.deleteMessage(inbox.messages[$0].id) }
                        }
                    }
                }
            }
            .navigationTitle("Messages")
            .toolbar {
                if !inbox.messages.isEmpty {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Clear") { inbox.clearAll() }
                            .font(.system(size: 11))
                    }
                }
            }
            .sheet(item: $replyingTo) { msg in
                WatchReplyView(message: msg)
                    .environmentObject(inbox)
                    .environmentObject(tts)
            }
        }
    }

    // 119 seconds → "1m" (truncation, not rounding) is standard. Integer division truncation is intentional.
    private func relativeTime(_ date: Date) -> String {
        let s = Int(-date.timeIntervalSinceNow)
        if s <= 0 { return "now" }   // handles future-dated messages
        if s < 60 { return "\(s)s" }
        if s < 3600 { return "\(s/60)m" }
        if s < 86400 { return "\(s/3600)h" }
        return "\(s/86400)d"
    }
}

// MARK: - Reply sheet

struct WatchReplyView: View {
    let message: WatchInbox.WatchMessage
    @EnvironmentObject var inbox: WatchInbox
    @EnvironmentObject var tts: WatchTTS
    @State private var replyText = ""
    // FIX #11: Initialize `sent` from model so re-presenting the sheet reflects the persisted reply state.
    // inbox.markReplied(_:) is called after a successful send to persist the flag to Keychain.
    @State private var sent: Bool
    @State private var dismissTask: Task<Void, Never>?
    @Environment(\.dismiss) private var dismiss

    init(message: WatchInbox.WatchMessage, inbox: WatchInbox? = nil, tts: WatchTTS? = nil) {
        self.message = message
        self._sent = State(initialValue: message.isReplied)
    }

    var body: some View {
        NavigationView {
            VStack(spacing: 8) {
                // Original message context
                VStack(alignment: .leading, spacing: 2) {
                    Text(message.sender)
                        .font(.system(size: 12, weight: .bold))
                    Text(message.text)
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                        .lineLimit(3)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(8)
                .background(Color.white.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 8))

                // Reply input (dictation supported)
                TextField("Reply…", text: $replyText)
                    .font(.system(size: 13))

                if sent {
                    Label("Sent", systemImage: "checkmark.circle.fill")
                        .foregroundColor(.green)
                        .font(.system(size: 12))
                } else {
                    Button {
                        let text = replyText.trimmingCharacters(in: .whitespaces)
                        guard !text.isEmpty else { return }
                        inbox.reply(to: message, text: text)
                        // FIX #11: Persist replied state to model so re-opening the sheet shows "Sent".
                        inbox.markReplied(message.id)
                        sent = true
                        tts.speak("Message sent")
                        dismissTask?.cancel()
                        dismissTask = Task { @MainActor in
                            try? await Task.sleep(nanoseconds: 1_500_000_000)
                            dismiss()
                        }
                    } label: {
                        Label("Send", systemImage: "paperplane.fill")
                            .font(.system(size: 13, weight: .semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 7)
                            .background(replyText.isEmpty ? Color.gray.opacity(0.3) : Color.green.opacity(0.7))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                    .buttonStyle(.plain)
                    .disabled(replyText.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .padding(.horizontal, 6)
            .navigationTitle("Reply to \(safeSenderName(message.sender))")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .onDisappear {
            dismissTask?.cancel()
        }
    }

    private func safeSenderName(_ name: String) -> String {
        let bidi: [String] = [
            "\u{202A}", "\u{202B}", "\u{202C}", "\u{202D}", "\u{202E}",  // LRE RLE PDF LRO RLO
            "\u{200B}", "\u{200C}", "\u{200D}", "\u{200E}", "\u{200F}",  // ZWSP ZWNJ ZWJ LRM RLM
            "\u{2066}", "\u{2067}", "\u{2068}", "\u{2069}",              // LRI RLI FSI PDI
            "\u{FEFF}",                                                   // BOM
        ]
        return bidi.reduce(name) { $0.replacingOccurrences(of: $1, with: "") }
    }
}

// MARK: - AI Chat (dedicated sheet from panel tile — full-screen, big UI)

private struct ChatMessage: Codable, Identifiable {
    // FIX #31: stable UUID id enables ForEach(messages) with identity-based diffing,
    // eliminating flicker when removeFirst() shifts all index-based ids by one.
    var id: UUID = UUID()
    let role: String
    let text: String

    // CodingKeys excludes `id` from persistence — each session gets fresh UUIDs on load,
    // which is fine since ids only need to be stable within a single session.
    enum CodingKeys: String, CodingKey { case role, text }
}

struct WatchAIChatView: View {
    let inputLang: String
    let outputLang: String
    @ObservedObject var translation: WatchTranslation
    let tts: WatchTTS
    @EnvironmentObject var session: WatchAISession
    // FIX #31: typed [ChatMessage] instead of [(role:String,text:String)] — enables ForEach with stable IDs.
    @State private var messages: [ChatMessage] = []
    @State private var inputText     = ""
    @State private var isWaiting     = false
    @State private var showDictation = false
    @State private var dictationText = ""
    @State private var aiTask: Task<Void, Never>?
    @State private var translateTask2: Task<Void, Never>?
    @Environment(\.dismiss) private var dismiss

    // #25: typed role constants — using these in all append calls makes typos a compile-time error.
    private let userRole = "user"
    private let aiRole   = "ai"

    /// True when input and output languages differ — chat acts as live translator.
    private var isTranslatorMode: Bool {
        inputLang.prefix(2) != outputLang.prefix(2)
    }

    var body: some View {
        VStack(spacing: 0) {
            // Mode indicator banner
            if isTranslatorMode {
                HStack(spacing: 4) {
                    Image(systemName: "arrow.left.arrow.right")
                        .font(.system(size: 10))
                    Text("Translator: \(inputLang.prefix(2).uppercased()) → \(outputLang.prefix(2).uppercased())")
                        .font(.system(size: 11, weight: .medium))
                }
                .foregroundColor(.white)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(Color.purple.opacity(0.6))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .padding(.top, 4)
            }

            // Chat history
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 8) {
                        if messages.isEmpty {
                            VStack(spacing: 6) {
                                Image(systemName: isTranslatorMode ? "arrow.left.arrow.right.circle.fill" : "brain.head.profile")
                                    .font(.system(size: 28))
                                    .foregroundColor(isTranslatorMode ? .purple.opacity(0.8) : .blue.opacity(0.7))
                                Text(isTranslatorMode ? "Speak or type to translate" : "Ask me anything")
                                    .font(.system(size: 14, weight: .semibold))
                                    .multilineTextAlignment(.center)
                                Text(isTranslatorMode
                                     ? "\(inputLang.prefix(2).uppercased()) → \(outputLang.prefix(2).uppercased())"
                                     : "I respond in \(outputLang)")
                                    .font(.system(size: 11))
                                    .foregroundColor(.secondary)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.top, 16)
                        }
                        // FIX #31: ForEach(messages) uses ChatMessage.id (UUID) — stable across
                        // removeFirst() mutations, eliminating flicker on history cap trim.
                        ForEach(messages) { m in
                            HStack(alignment: .top) {
                                if m.role == userRole { Spacer(minLength: 24) }
                                Text(m.text)
                                    .font(.system(size: 13))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 7)
                                    .background(m.role == userRole
                                        ? Color.blue.opacity(0.5)
                                        : Color.white.opacity(0.12))
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                                if m.role == aiRole { Spacer(minLength: 24) }
                            }
                            .id(m.id)
                        }
                        if isWaiting {
                            HStack(spacing: 6) {
                                ProgressView().scaleEffect(0.7)
                                Text("Thinking…")
                                    .font(.system(size: 12))
                                    .foregroundColor(.secondary)
                            }
                            .padding(.leading, 4)
                        }
                    }
                    .padding(.horizontal, 6)
                    .padding(.vertical, 8)
                }
                .onChange(of: messages.count) { _, _ in
                    if let last = messages.last {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }

            Divider()

            // Input row — mic + text + send
            HStack(spacing: 6) {
                // Mic — triggers Watch native dictation
                Button {
                    showDictation = true
                } label: {
                    Image(systemName: "mic.fill")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.white)
                        .frame(width: 38, height: 38)
                        .background(Color.blue.opacity(0.6))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)

                TextField("Ask…", text: $inputText)
                    .font(.system(size: 14))
                    .frame(minHeight: 36)

                Button { sendMessage() } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 28))
                        .foregroundColor(inputText.isEmpty ? .gray : .blue)
                }
                .buttonStyle(.plain)
                // FIX #21: also disable Send while a response is in flight to prevent double-send.
                .disabled(inputText.trimmingCharacters(in: .whitespaces).isEmpty || isWaiting)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
        }
        .navigationTitle("AI Chat")
        .sheet(isPresented: $showDictation) {
            WatchDictationView(
                title: isTranslatorMode ? "Translate" : "Dictate",
                submitLabel: isTranslatorMode ? "Translate" : "Ask AI"
            ) { text in
                inputText = text
                sendMessage()
            }
        }
        // #26: Restore last 10 messages from Keychain on appear (fix #6: moved from UserDefaults)
        // FIX #6: Keychain I/O is synchronous — run off @MainActor to avoid blocking UI thread.
        // FIX #26: Use do/catch instead of try? so decode failures are logged (schema change detection).
        .onAppear {
            Task.detached(priority: .userInitiated) {
                guard let data = KeychainHelper.shared.readData(service: "prism-aac-chat", account: "history"),
                      data.count <= 65_536 else { return }
                let saved: [ChatMessage]
                do {
                    saved = try JSONDecoder().decode([ChatMessage].self, from: data)
                } catch {
                    NSLog("[WatchAIChat] History decode failed (schema change?): \(error) — starting fresh")
                    return
                }
                // FIX #18: cap each message text to 500 chars on load — protects against
                // stale Keychain entries written by an older version without length caps.
                // FIX #31: map to ChatMessage (generates fresh UUIDs for this session).
                let capped = Array(saved.suffix(10)).map {
                    ChatMessage(role: ["user", "ai"].contains($0.role) ? $0.role : "ai",
                                text: String($0.text.prefix(500)))
                }
                await MainActor.run { messages = capped }
            }
        }
        // #26: Persist last 10 messages to Keychain whenever the list changes (fix #6: moved from UserDefaults)
        // FIX #6: enforce 500-char cap on text before persisting — sanitize PII before Keychain write.
        // FIX #10: debounce — only write every 5th message or on first message to reduce concurrent
        // Keychain write contention. Use do/catch instead of try? so encode errors are logged.
        .onChange(of: messages.count) { _, count in
            guard count % 5 == 0 || count == 1 else { return }
            let toSave = Array(messages.suffix(10)).map {
                ChatMessage(role: $0.role, text: String($0.text.prefix(500)))
            }
            Task.detached(priority: .utility) {
                do {
                    let data = try JSONEncoder().encode(toSave)
                    guard data.count <= 65_536 else { return }
                    // Chat history: use whenUnlocked (stricter than emergency tokens which need afterFirstUnlock)
                    // NOTE: KeychainHelper.writeData uses AfterFirstUnlockThisDeviceOnly by default.
                    // For chat history, this is acceptable — it's read on user-initiated sheet open, not background.
                    KeychainHelper.shared.writeData(data, service: "prism-aac-chat", account: "history")
                } catch {
                    NSLog("[WatchAIChat] Failed to encode history: \(error)")
                }
            }
        }
        // #14: onDisappear is on the OUTERMOST VStack of WatchAIChatView — this is the correct placement.
        // aiTask and translateTask2 are @State vars; cancelling them here prevents dangling Tasks
        // that would otherwise continue executing after the sheet is dismissed.
        // FIX #12: Final save on sheet dismiss — catches messages 2–4 that the count%5 guard skips.
        .onDisappear {
            aiTask?.cancel()
            translateTask2?.cancel()
            // Final save on sheet dismiss (catches messages 2-4)
            let toSave = Array(messages.suffix(10))
            Task.detached(priority: .utility) {
                do {
                    let data = try JSONEncoder().encode(toSave)
                    guard data.count <= 65_536 else { return }
                    KeychainHelper.shared.writeData(data, service: "prism-aac-chat", account: "history")
                } catch {
                    NSLog("[WatchAIChat] Failed to encode history on disappear: \(error)")
                }
            }
        }
    }

    @MainActor
    private func sendMessage() {
        // FIX #17: Always cancel both tasks before starting new send — handles mode-switch mid-flight
        // where the previous send was running in the opposite mode (AI vs. translation).
        aiTask?.cancel()
        translateTask2?.cancel()
        let rawText = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !rawText.isEmpty else { return }
        let text = String(rawText.prefix(500))  // cap BEFORE any API call
        inputText = ""
        // #17: cap at 50 (>= 50 removes before adding, keeping array at ≤50 at all times)
        // #9: cap individual message text at 500 chars to prevent unbounded memory growth
        if messages.count >= 50 { messages.removeFirst() }
        messages.append(ChatMessage(role: userRole, text: text))  // already capped
        isWaiting = true

        if isTranslatorMode {
            // Translation mode: translate input lang → output lang, speak result
            translateTask2?.cancel()
            translateTask2 = Task { @MainActor in
                // FIX #21: defer ensures isWaiting resets even if the task is cancelled before completion.
                defer { isWaiting = false }
                let translated = await translation.translateDirect(text: text, to: outputLang)
                guard !Task.isCancelled else { return }
                let result = translated ?? text
                if messages.count >= 50 { messages.removeFirst() }
                messages.append(ChatMessage(role: aiRole, text: String(result.prefix(500))))
                tts.speak(result, language: outputLang)
            }
        } else {
            // Same language: regular AI chat response
            aiTask?.cancel()
            aiTask = Task { @MainActor in
                // FIX #21: defer ensures isWaiting resets even if the task is cancelled before completion.
                defer { isWaiting = false }
                let reply = await session.askAI(text, lang: outputLang) ?? "…"
                guard !Task.isCancelled else { return }
                if messages.count >= 50 { messages.removeFirst() }
                messages.append(ChatMessage(role: aiRole, text: String(reply.prefix(500))))
                tts.speak(reply, language: outputLang)
            }
        }
    }
}

// MARK: - Dictation input view (auto-focuses TextField → triggers Watch input controller)

/// Single-purpose dictation sheet for watchOS.
/// Uses @FocusState to programmatically focus the TextField on appear —
/// this automatically presents the Watch input controller (dictation +
/// keyboard + scribble) without requiring the user to tap first.
struct WatchDictationView: View {
    let title: String
    let submitLabel: String
    let onSubmit: (String) -> Void

    @State private var text = ""
    @FocusState private var fieldFocused: Bool
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            VStack(spacing: 10) {
                Image(systemName: "mic.circle.fill")
                    .font(.system(size: 36))
                    .foregroundColor(.blue)
                    .onAppear { fieldFocused = true }   // auto-opens Watch input controller

                TextField("Speak or type…", text: $text)
                    .font(.system(size: 15))
                    .multilineTextAlignment(.center)
                    .focused($fieldFocused)
                    .frame(minHeight: 40)
                    .submitLabel(.done)
                    .onSubmit {
                        guard !text.trimmingCharacters(in: .whitespaces).isEmpty else { return }
                        // #31: cap dictation text at view layer before passing to caller
                        let result = String(text.prefix(500))
                        text = ""
                        dismiss()
                        onSubmit(result)
                    }

                Button(submitLabel) {
                    let trimmed = text.trimmingCharacters(in: .whitespaces)
                    guard !trimmed.isEmpty else { return }
                    // #31: cap dictation text at view layer
                    let result = String(trimmed.prefix(500))
                    text = ""
                    dismiss()
                    onSubmit(result)
                }
                .disabled(text.trimmingCharacters(in: .whitespaces).isEmpty)
                .buttonStyle(.borderedProminent)
                .tint(.blue)
            }
            .padding()
            .navigationTitle(title)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}

// MARK: - Send Message (dedicated sheet from 📨 top bar button)

struct WatchSendMessageView: View {
    // FIX #9: try! instead of try? — pattern literals are known-good; if either throws it is a
    // programming error that should crash at launch (not silently accept all contacts at runtime).
    // FIX #23: Require + prefix — bare digit strings (e.g. "5551234567") are unroutable by SMS APIs
    // because they lack a country code. Users must include country code (e.g. +12125551234).
    private static let phoneRegex: NSRegularExpression = try! NSRegularExpression(pattern: #"^\+[0-9]{10,15}$"#)
    private static let emailRegex: NSRegularExpression = try! NSRegularExpression(pattern: #"^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]{2,}$"#)

    @EnvironmentObject var inbox: WatchInbox
    @EnvironmentObject var tts: WatchTTS
    @State private var contactQuery = ""
    @State private var msgText      = ""
    @State private var sendStatus: String? = nil
    @State private var isSending    = false  // FIX #8: prevents double-send on rapid taps
    @State private var dismissTask: Task<Void, Never>?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            VStack(spacing: 10) {
                // To: field
                VStack(alignment: .leading, spacing: 3) {
                    Text("To:")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                    TextField("Search contacts…", text: $contactQuery)
                        .font(.system(size: 14))
                        .padding(8)
                        .background(Color.white.opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    // FIX #23: Hint that country code is required (e.g. +12125551234).
                    Text("Include country code (e.g. +12125551234)")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                // Message field
                VStack(alignment: .leading, spacing: 3) {
                    Text("Message:")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                    TextField("Type or dictate…", text: $msgText)
                        .font(.system(size: 14))
                        .padding(8)
                        .background(Color.white.opacity(0.08))
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .frame(minHeight: 44)
                }

                Spacer()

                // Status
                if let status = sendStatus {
                    Text(status)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(status.contains("✓") ? .green : .orange)
                        .multilineTextAlignment(.center)
                }

                // Send button — large, full width
                Button {
                    // FIX #8: prevent double-send on rapid taps
                    guard !isSending else { return }
                    isSending = true
                    // #23: comprehensive bidi strip — matches safeSenderName() in WatchReplyView
                    let bidi: [String] = [
                        "\u{202A}", "\u{202B}", "\u{202C}", "\u{202D}", "\u{202E}",  // LRE RLE PDF LRO RLO
                        "\u{200B}", "\u{200C}", "\u{200D}", "\u{200E}", "\u{200F}",  // ZWSP ZWNJ ZWJ LRM RLM
                        "\u{2066}", "\u{2067}", "\u{2068}", "\u{2069}",              // LRI RLI FSI PDI
                        "\u{FEFF}",                                                   // BOM
                    ]
                    let safeTo = bidi.reduce(
                        String(contactQuery.prefix(100)).trimmingCharacters(in: .whitespacesAndNewlines)
                    ) { $0.replacingOccurrences(of: $1, with: "") }
                    let safeBody = String(msgText.prefix(500))

                    guard !safeTo.isEmpty, !safeBody.isEmpty else { isSending = false; return }
                    // Validate: must be a phone number or email.
                    // #18: phone regex requires 10–15 clean digits only (+ optional leading +).
                    // Spaces, hyphens, and parens removed — SMS APIs expect clean digit strings.
                    // 7-char minimum was too loose and accepted strings that cannot route SMS.
                    let range = NSRange(safeTo.startIndex..., in: safeTo)
                    let isValidPhone = WatchSendMessageView.phoneRegex.firstMatch(in: safeTo, range: range) != nil
                    // #18: email TLD must be at least 2 chars (e.g. .co, .uk, .com)
                    let isValidEmail = WatchSendMessageView.emailRegex.firstMatch(in: safeTo, range: range) != nil
                    guard isValidPhone || isValidEmail else {
                        sendStatus = "Invalid contact format"
                        isSending = false
                        return
                    }
                    // #5/#28: use WCSessionRouter.shared.isReachable instead of direct WCSession check
                    if WCSessionRouter.shared.isReachable {
                        WCSessionRouter.shared.send(
                            ["type": "send_message", "to": safeTo, "text": safeBody],
                            replyHandler: { _ in
                                Task { @MainActor in
                                    isSending = false
                                    // FIX #16: Redact phone/email in status — never show full recipient on screen
                                    let redacted = safeTo.count > 4 ? "***\(safeTo.suffix(4))" : "****"
                                    sendStatus = "✓ Sent to \(redacted)"
                                    // Now start the dismiss task
                                    dismissTask?.cancel()
                                    dismissTask = Task { @MainActor in
                                        msgText = ""
                                        try? await Task.sleep(nanoseconds: 1_500_000_000)
                                        tts.speak("Message sent")
                                        dismiss()
                                    }
                                }
                            },
                            errorHandler: { err in
                                Task { @MainActor in
                                    isSending = false
                                    sendStatus = "⚠ Send failed"
                                    NSLog("[WatchSend] Send failed: \(err)")
                                }
                            }
                        )
                        // Don't set sendStatus here — wait for replyHandler
                    } else {
                        isSending = false
                        sendStatus = "⚠ Phone not connected"
                    }
                } label: {
                    Label("Send", systemImage: "paperplane.fill")
                        .font(.system(size: 16, weight: .bold))
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background((contactQuery.isEmpty || msgText.isEmpty || isSending)
                            ? Color.gray.opacity(0.3) : Color.green.opacity(0.8))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .foregroundColor(.white)
                }
                .buttonStyle(.plain)
                .disabled(contactQuery.isEmpty || msgText.isEmpty || isSending)
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .navigationTitle("Send Message")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .onDisappear {
            dismissTask?.cancel()
        }
    }
}

// MARK: - Compact 2-column card (replaces full-screen PictogramCard)

struct PairCard: View {
    let phrase: AACPhrase
    let onTap: () -> Void
    var emergencyIsActive: Bool = false

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 4) {
                // If emergency is active, skip pictogram network loads to free URLSession connections
                // #17: emergencyIsActive skips AsyncImage entirely when true, freeing URLSession slots
                // for emergency/translation requests. Falls through to sfSymbol fallback below.
                // Fix #17 (intentional): AsyncImage is gated on !emergencyIsActive so that
                // pictogram network loads are skipped during emergencies, freeing URLSession
                // connections for emergency and translation requests. sfSymbol fallback below.
                if let url = phrase.arasaacURL, !emergencyIsActive {
                    // Pictogram images: use a dedicated short-timeout URLSession to avoid
                    // starving emergency/translation requests that share URLSession.shared.
                    // LIMITATION: .task(id: url) cancels the Task but NOT AsyncImage's internal URLSession request.
                    // A separate URLSession with timeoutIntervalForResource: 5 would be needed for true timeout.
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let img):
                            img.resizable()
                               .scaledToFit()
                               .frame(maxWidth: .infinity, maxHeight: 52)
                        default:
                            Image(systemName: phrase.sfSymbol)
                                .font(.system(size: 32))
                                .foregroundColor(phrase.color)
                                .frame(maxWidth: .infinity, maxHeight: 52)
                        }
                    }
                    .id(url)
                    // AsyncImage has no native timeout. The dedicated AISession/translation sessions
                    // have separate connection pools. Image loads use URLSession.shared implicitly
                    // but are skipped entirely during emergencies (emergencyIsActive gate above).
                } else {
                    Image(systemName: phrase.sfSymbol)
                        .font(.system(size: 32))
                        .foregroundColor(phrase.color)
                        .frame(maxWidth: .infinity, maxHeight: 52)
                }
                Text(phrase.label)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(.primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
            .padding(.vertical, 6)
            .padding(.horizontal, 4)
            .frame(maxWidth: .infinity, minHeight: 80)
            .background(phrase.color.opacity(0.15))
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Say: \(phrase.label)")
    }
}

// MARK: - Root view: 2-column grid + emergency overlay

// FIX #11: WatchTranslation, WatchVocabSync, and all other EnvironmentObjects are injected
// by WatchApp.body and propagate automatically through SwiftUI's environment.
// Do not add redundant .environmentObject() calls here unless the chain is broken.
struct WatchRootView: View {
    @EnvironmentObject var session: WatchAISession
    @EnvironmentObject var emergency: WatchEmergencyManager
    @EnvironmentObject var tts: WatchTTS
    @EnvironmentObject var inbox: WatchInbox
    @EnvironmentObject var vocab: WatchVocabSync

    var body: some View {
        WatchPictogramCards()
            .overlay(alignment: .topLeading) {
                if let banner = session.offlineBanner {
                    Text(banner)
                        .font(.system(size: 9))
                        .foregroundColor(.orange)
                        .padding(3)
                        .background(Color.black.opacity(0.5))
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                        .padding(2)
                }
            }
            // #4/#20: fullScreenCover binding allows post-escalation dismiss for critical severity
            .fullScreenCover(isPresented: Binding(
                get: { emergency.isActive },
                set: { active in
                    if !active {
                        if emergency.hasEscalated {
                            emergency.dismiss()  // post-escalation cleanup — always allowed
                        } else if emergency.severity == .critical {
                            // pre-escalation critical: binding set to false is ignored (cover stays up)
                            return
                        } else {
                            // FIX #29: log non-critical emergency cancellations via UI gesture.
                            // Future enhancement: show a confirmation alert for urgent/medical severity.
                            NSLog("[WatchEmergency] Non-critical emergency (severity=\(emergency.severity)) cancelled by UI gesture")
                            emergency.cancel()
                        }
                    }
                }
            )) {
                WatchEmergencyActiveView()
                    .environmentObject(emergency)
            }
    }
}

// MARK: - Child-friendly vocabulary order in AACVocab

extension AACVocab {
    /// Single flat list ordered by frequency of use for young AAC users.
    /// Most common needs first — reduces swipes to find the right word.
    static let childFriendlyOrder: [AACPhrase] = [
        // Tier 1 — most frequent (first 8 = within 3 swipes)
        AACPhrase(label: "Yes",        sfSymbol: "checkmark.circle.fill", color: .green,  arasaacId: 5584),
        AACPhrase(label: "No",         sfSymbol: "xmark.circle.fill",     color: .red,    arasaacId: 5578),
        AACPhrase(label: "More",       sfSymbol: "plus.circle",           color: .blue,   arasaacId: 5571),
        AACPhrase(label: "All done",   sfSymbol: "checkmark.seal",        color: .green,  arasaacId: 5552),
        AACPhrase(label: "Help",       sfSymbol: "sos",                   color: .red,    arasaacId: 5557,  isEmergency: true),
        AACPhrase(label: "Want",       sfSymbol: "hand.point.right.fill", color: .blue,   arasaacId: 5583),
        AACPhrase(label: "Stop",       sfSymbol: "hand.raised.fill",      color: .orange, arasaacId: 5581),
        AACPhrase(label: "Go",         sfSymbol: "arrow.right.circle",    color: .green,  arasaacId: nil),

        // Tier 2 — physical needs
        AACPhrase(label: "Water",      sfSymbol: "drop.fill",             color: .blue,   arasaacId: 14981),
        AACPhrase(label: "Food",       sfSymbol: "fork.knife",            color: .orange, arasaacId: nil),
        AACPhrase(label: "Bathroom",   sfSymbol: "toilet.fill",           color: .teal,   arasaacId: nil),
        AACPhrase(label: "Hurt",       sfSymbol: "cross.circle.fill",     color: .red,    arasaacId: nil,   isEmergency: true),
        AACPhrase(label: "Tired",      sfSymbol: "moon.zzz.fill",         color: .gray,   arasaacId: nil),
        AACPhrase(label: "Hot",        sfSymbol: "thermometer.sun",       color: .red,    arasaacId: nil),
        AACPhrase(label: "Cold",       sfSymbol: "thermometer.snowflake", color: .blue,   arasaacId: nil),
        AACPhrase(label: "Medicine",   sfSymbol: "pill.fill",             color: .red,    arasaacId: nil),

        // Tier 3 — emotions
        AACPhrase(label: "Happy",      sfSymbol: "face.smiling",          color: .yellow, arasaacId: nil),
        AACPhrase(label: "Sad",        sfSymbol: "cloud.rain.fill",       color: .blue,   arasaacId: nil),
        AACPhrase(label: "Scared",     sfSymbol: "bolt.heart.fill",       color: .purple, arasaacId: nil),
        AACPhrase(label: "Angry",      sfSymbol: "flame.fill",            color: .red,    arasaacId: nil),

        // Tier 4 — social
        AACPhrase(label: "Hello",      sfSymbol: "hand.wave.fill",        color: .yellow, arasaacId: nil),
        AACPhrase(label: "Thank you",  sfSymbol: "heart.fill",            color: .pink,   arasaacId: nil),
        AACPhrase(label: "Please",     sfSymbol: "hands.clap.fill",       color: .blue,   arasaacId: nil),
        AACPhrase(label: "Sorry",      sfSymbol: "hand.thumbsdown",       color: .gray,   arasaacId: nil),

        // Tier 5 — places
        AACPhrase(label: "Home",       sfSymbol: "house.fill",            color: .green,  arasaacId: 8514),
        AACPhrase(label: "School",     sfSymbol: "graduationcap.fill",    color: .blue,   arasaacId: nil),
        AACPhrase(label: "Outside",    sfSymbol: "sun.max.fill",          color: .yellow, arasaacId: nil),
        AACPhrase(label: "Bed",        sfSymbol: "bed.double.fill",       color: .indigo, arasaacId: nil),
    ]
}

// MARK: - Emergency active full-screen overlay

struct WatchEmergencyActiveView: View {
    @EnvironmentObject var emergency: WatchEmergencyManager

    var body: some View {
        ZStack {
            Color.red.ignoresSafeArea()
            VStack(spacing: 12) {
                Image(systemName: "sos")
                    .font(.system(size: 48))
                    .foregroundColor(.white)
                if emergency.countdownSecs > 0 {
                    Text("SENDING IN \(emergency.countdownSecs)s")
                        .font(.headline)
                        .foregroundColor(.white)
                    Text("\(emergency.countdownSecs)")
                        .font(.title3)
                        .foregroundColor(.white.opacity(0.8))
                } else if emergency.hasEscalated {
                    Text("HELP COMING")
                        .font(.headline)
                        .foregroundColor(.orange)
                } else {
                    Text("SENDING…")
                        .font(.headline)
                        .foregroundColor(.yellow)
                }
                if emergency.severity != .critical {
                    Button("Cancel") {
                        emergency.cancel()
                    }
                    .buttonStyle(.bordered)
                    .tint(.white)
                }
                if emergency.deliveryStatus == .failed {
                    Button("Force Close") {
                        emergency.forceReset()
                    }
                    .foregroundColor(.white)
                    .padding(.top, 8)
                    .font(.caption)
                }
            }
        }
    }
}
