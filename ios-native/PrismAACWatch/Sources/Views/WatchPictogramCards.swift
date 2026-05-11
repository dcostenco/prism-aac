import SwiftUI
import WatchKit
import WatchConnectivity

// MARK: - AAC data model

struct AACPhrase: Identifiable {
    let id = UUID()
    let label: String
    let sfSymbol: String
    let color: Color
    let arasaacId: Int?

    var arasaacURL: URL? {
        guard let aid = arasaacId else { return nil }
        return URL(string: "https://static.arasaac.org/pictograms/\(aid)/\(aid)_300.png")
    }
}

struct AACVocab {
    static let categories: [(icon: String, name: String, phrases: [AACPhrase])] = [
        ("⚡", "Quick", [
            AACPhrase(label: "Yes",      sfSymbol: "checkmark.circle.fill", color: .green,  arasaacId: 5584),
            AACPhrase(label: "No",       sfSymbol: "xmark.circle.fill",     color: .red,    arasaacId: 5578),
            AACPhrase(label: "More",     sfSymbol: "plus.circle",           color: .blue,   arasaacId: 5571),
            AACPhrase(label: "Stop",     sfSymbol: "hand.raised.fill",      color: .orange, arasaacId: 5581),
            AACPhrase(label: "Help",     sfSymbol: "sos",                   color: .red,    arasaacId: 5557),
            AACPhrase(label: "Wait",     sfSymbol: "pause.circle",          color: .yellow, arasaacId: 5583),
            AACPhrase(label: "Thank you",sfSymbol: "heart.fill",            color: .pink,   arasaacId: 5582),
            AACPhrase(label: "All done", sfSymbol: "checkmark.seal",        color: .green,  arasaacId: 5552),
        ]),
        ("💧", "Needs", [
            AACPhrase(label: "Water",    sfSymbol: "drop.fill",             color: .blue,   arasaacId: 14981),
            AACPhrase(label: "Food",     sfSymbol: "fork.knife",            color: .orange, arasaacId: nil),
            AACPhrase(label: "Bathroom", sfSymbol: "toilet.fill",           color: .teal,   arasaacId: nil),
            AACPhrase(label: "Medicine", sfSymbol: "pill.fill",             color: .red,    arasaacId: nil),
            AACPhrase(label: "Home",     sfSymbol: "house.fill",            color: .green,  arasaacId: 8514),
        ]),
        ("🆘", "Emergency", [
            AACPhrase(label: "Call 911",      sfSymbol: "phone.fill",       color: .red,    arasaacId: nil),
            AACPhrase(label: "Can't breathe", sfSymbol: "lungs.fill",       color: .red,    arasaacId: nil),
            AACPhrase(label: "I'm in pain",   sfSymbol: "cross.fill",       color: .red,    arasaacId: nil),
            AACPhrase(label: "Need doctor",   sfSymbol: "stethoscope",      color: .red,    arasaacId: nil),
        ]),
    ]
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
    @StateObject private var translation = WatchTranslation()

    private var allPhrases: [AACPhrase] {
        let synced = vocab.categories.flatMap { cat in
            cat.phrases.map { p in
                AACPhrase(label: p.label, sfSymbol: p.sfSymbol, color: phraseColor(cat.id), arasaacId: p.arasaacId)
            }
        }
        // Use the full 28-phrase childFriendlyOrder when:
        //   - No synced vocabulary at all, OR
        //   - Only the minimal offline core loaded (≤8 phrases from API unavailable)
        // API-synced vocab replaces this once connectivity is available.
        return synced.count > 8 ? synced : AACVocab.childFriendlyOrder
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
                        .cornerRadius(14)
                    }
                    .buttonStyle(.plain)
                    .padding(.horizontal, 4)

                    // ── 2-column AAC vocabulary grid ──
                    LazyVGrid(columns: columns, spacing: 6) {
                        ForEach(allPhrases) { phrase in
                            PairCard(phrase: phrase) {
                                WKInterfaceDevice.current().play(.click)
                                // Emergency phrases require confirmation before sending
                                if phrase.color == .red && AACVocab.categories.contains(where: { $0.name == "Emergency" && $0.phrases.contains(where: { $0.label == phrase.label }) }) {
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
                    inbox.requestPermissionIfNeeded(); showInbox = true; inbox.markAllRead()
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
        // Inbox / Notification center
        .sheet(isPresented: $showInbox) {
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

    private func relativeTime(_ date: Date) -> String {
        let s = Int(-date.timeIntervalSinceNow)
        if s < 60 { return "now" }
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
    @State private var sent = false
    @Environment(\.dismiss) private var dismiss

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
                .cornerRadius(8)

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
                        sent = true
                        tts.speak("Message sent")
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { dismiss() }
                    } label: {
                        Label("Send", systemImage: "paperplane.fill")
                            .font(.system(size: 13, weight: .semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 7)
                            .background(replyText.isEmpty ? Color.gray.opacity(0.3) : Color.green.opacity(0.7))
                            .cornerRadius(10)
                    }
                    .buttonStyle(.plain)
                    .disabled(replyText.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .padding(.horizontal, 6)
            .navigationTitle("Reply to \(message.sender)")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }
}

// MARK: - AI Chat (dedicated sheet from panel tile — full-screen, big UI)

struct WatchAIChatView: View {
    let inputLang: String
    let outputLang: String
    let translation: WatchTranslation
    let tts: WatchTTS
    @EnvironmentObject var session: WatchAISession
    @State private var messages: [(role: String, text: String)] = []
    @State private var inputText     = ""
    @State private var isWaiting     = false
    @State private var showDictation = false
    @State private var dictationText = ""
    @Environment(\.dismiss) private var dismiss

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
                .cornerRadius(8)
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
                        ForEach(messages.indices, id: \.self) { i in
                            let m = messages[i]
                            HStack(alignment: .top) {
                                if m.role == "user" { Spacer(minLength: 24) }
                                Text(m.text)
                                    .font(.system(size: 13))
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 7)
                                    .background(m.role == "user"
                                        ? Color.blue.opacity(0.5)
                                        : Color.white.opacity(0.12))
                                    .cornerRadius(12)
                                if m.role == "ai" { Spacer(minLength: 24) }
                            }
                            .id(i)
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
                .onChange(of: messages.count) { _ in
                    if let last = messages.indices.last {
                        proxy.scrollTo(last, anchor: .bottom)
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
                .disabled(inputText.trimmingCharacters(in: .whitespaces).isEmpty)
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
    }

    private func sendMessage() {
        let text = inputText.trimmingCharacters(in: .whitespaces)
        guard !text.isEmpty else { return }
        inputText = ""
        if messages.count > 50 { messages.removeFirst() }
        messages.append((role: "user", text: text))
        isWaiting = true

        if isTranslatorMode {
            // Translation mode: translate input lang → output lang, speak result
            Task { @MainActor in
                let translated = await translation.translateDirect(text: text, to: outputLang)
                let result = translated ?? text
                isWaiting = false
                if messages.count > 50 { messages.removeFirst() }
                messages.append((role: "ai", text: result))
                tts.speak(result, language: outputLang)
            }
        } else {
            // Same language: regular AI chat response
            Task { @MainActor in
                let reply = await session.askAI(text, lang: outputLang) ?? "…"
                isWaiting = false
                if messages.count > 50 { messages.removeFirst() }
                messages.append((role: "ai", text: reply))
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
                        let result = text
                        text = ""
                        dismiss()
                        onSubmit(result)
                    }

                Button(submitLabel) {
                    let result = text.trimmingCharacters(in: .whitespaces)
                    guard !result.isEmpty else { return }
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
    @EnvironmentObject var inbox: WatchInbox
    @EnvironmentObject var tts: WatchTTS
    @State private var contactQuery = ""
    @State private var msgText      = ""
    @State private var sendStatus: String? = nil
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
                        .cornerRadius(10)
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
                        .cornerRadius(10)
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
                    let safeTo   = String(contactQuery.prefix(100)).trimmingCharacters(in: .whitespacesAndNewlines)
                    let safeBody = String(msgText.prefix(500))

                    guard !safeTo.isEmpty, !safeBody.isEmpty else { return }
                    if WCSession.isSupported() && WCSession.default.isReachable {
                        WCSessionRouter.shared.send(
                            ["type": "send_message", "to": safeTo, "text": safeBody],
                            errorHandler: { err in NSLog("[WatchSend] Failed: \(err)") }
                        )
                        Task { @MainActor in
                            sendStatus = "✓ Sent to \(safeTo)"
                            msgText = ""
                            tts.speak("Message sent")
                            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { dismiss() }
                        }
                    } else {
                        sendStatus = "⚠ Phone not connected"
                    }
                } label: {
                    Label("Send", systemImage: "paperplane.fill")
                        .font(.system(size: 16, weight: .bold))
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background((contactQuery.isEmpty || msgText.isEmpty)
                            ? Color.gray.opacity(0.3) : Color.green.opacity(0.8))
                        .cornerRadius(12)
                        .foregroundColor(.white)
                }
                .buttonStyle(.plain)
                .disabled(contactQuery.isEmpty || msgText.isEmpty)
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
    }
}

// MARK: - Compact 2-column card (replaces full-screen PictogramCard)

struct PairCard: View {
    let phrase: AACPhrase
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 4) {
                if let url = phrase.arasaacURL {
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
            .cornerRadius(12)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Say: \(phrase.label)")
    }
}

// MARK: - Root view: 2-column grid + emergency overlay

struct WatchRootView: View {
    @EnvironmentObject var session: WatchAISession
    @EnvironmentObject var emergency: WatchEmergencyManager
    @EnvironmentObject var tts: WatchTTS
    @EnvironmentObject var inbox: WatchInbox

    var body: some View {
        WatchPictogramCards()
            .overlay(alignment: .topLeading) {
                if let banner = session.offlineBanner {
                    Text(banner)
                        .font(.system(size: 9))
                        .foregroundColor(.orange)
                        .padding(3)
                        .background(Color.black.opacity(0.5))
                        .cornerRadius(4)
                        .padding(2)
                }
            }
            .fullScreenCover(isPresented: Binding(
                get: { emergency.isActive },
                set: { active in
                    if !active && emergency.severity != .critical {
                        emergency.cancel()
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
        AACPhrase(label: "Help",       sfSymbol: "sos",                   color: .red,    arasaacId: 5557),
        AACPhrase(label: "Want",       sfSymbol: "hand.point.right.fill", color: .blue,   arasaacId: 5583),
        AACPhrase(label: "Stop",       sfSymbol: "hand.raised.fill",      color: .orange, arasaacId: 5581),
        AACPhrase(label: "Go",         sfSymbol: "arrow.right.circle",    color: .green,  arasaacId: nil),

        // Tier 2 — physical needs
        AACPhrase(label: "Water",      sfSymbol: "drop.fill",             color: .blue,   arasaacId: 14981),
        AACPhrase(label: "Food",       sfSymbol: "fork.knife",            color: .orange, arasaacId: nil),
        AACPhrase(label: "Bathroom",   sfSymbol: "toilet.fill",           color: .teal,   arasaacId: nil),
        AACPhrase(label: "Hurt",       sfSymbol: "cross.circle.fill",     color: .red,    arasaacId: nil),
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
                        .foregroundColor(.red)
                } else {
                    Text("HELP COMING")
                        .font(.headline)
                        .foregroundColor(.orange)
                }
                Text(emergency.countdownText)
                    .font(.title3)
                    .foregroundColor(.white.opacity(0.8))
                if emergency.severity != .critical {
                    Button("Cancel") {
                        emergency.cancel()
                    }
                    .buttonStyle(.bordered)
                    .tint(.white)
                }
            }
        }
    }
}
