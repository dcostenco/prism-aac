import SwiftUI

/// Root view — tabs for Phrases, AI Chat, Emergency.
/// Digital Crown scrolls within each tab.
struct WatchRootView: View {
    @EnvironmentObject var session: WatchAISession
    @EnvironmentObject var emergency: WatchEmergencyManager
    @EnvironmentObject var tts: WatchTTS

    var body: some View {
        TabView {
            // Tab 1 — Core phrase board (always offline)
            WatchPhraseBoardView()
                .tabItem { Label("Phrases", systemImage: "text.bubble") }

            // Tab 2 — AI Chat (companion or cloud)
            WatchAIChatView()
                .tabItem { Label("AI", systemImage: "sparkles") }

            // Tab 3 — Emergency (always offline)
            WatchEmergencyView()
                .tabItem { Label("SOS", systemImage: "sos") }
        }
        .tabViewStyle(.page)
        .overlay(alignment: .top) {
            // Connectivity banner
            if let banner = session.offlineBanner {
                Text(banner)
                    .font(.system(size: 10))
                    .foregroundColor(.orange)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.orange.opacity(0.2))
                    .cornerRadius(4)
                    .padding(.top, 2)
            }
        }
        // Full-screen emergency overlay when SOS triggered
        .fullScreenCover(isPresented: .constant(emergency.isActive)) {
            WatchEmergencyActiveView()
                .environmentObject(emergency)
        }
    }
}

// MARK: - Phrase board

struct WatchPhraseBoardView: View {
    @EnvironmentObject var tts: WatchTTS

    private let categories: [(icon: String, phrases: [String])] = [
        ("🆘", ["I need help", "It hurts", "I can't breathe", "Call my caregiver"]),
        ("😊", ["Yes", "No", "More", "Stop", "Wait", "Thank you"]),
        ("🍽️", ["I'm hungry", "I want water", "I'm thirsty", "I'm done eating"]),
        ("🏠", ["I need the bathroom", "I'm cold", "I'm hot", "I want to go home"]),
        ("💊", ["I need my medicine", "I feel sick", "I'm tired", "I need to rest"]),
    ]

    @State private var selectedCategory = 0

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                // Category picker
                Picker("", selection: $selectedCategory) {
                    ForEach(categories.indices, id: \.self) { i in
                        Text(categories[i].icon).tag(i)
                    }
                }
                .pickerStyle(.wheel)
                .frame(height: 50)

                // Phrases
                ForEach(categories[selectedCategory].phrases, id: \.self) { phrase in
                    Button {
                        tts.speak(phrase)
                        WKInterfaceDevice.current().play(.click)
                    } label: {
                        Text(phrase)
                            .font(.system(size: 14, weight: .medium))
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                    }
                    .buttonStyle(.bordered)
                    .tint(phrase.contains("help") || phrase.contains("hurt") || phrase.contains("breathe") ? .red : .blue)
                }
            }
            .padding(.horizontal, 4)
        }
        .navigationTitle("Phrases")
    }
}

// MARK: - AI Chat

struct WatchAIChatView: View {
    @EnvironmentObject var session: WatchAISession
    @EnvironmentObject var tts: WatchTTS

    @State private var inputText = ""
    @State private var showDictation = false

    // Suggested questions for quick tap — no typing needed
    private let suggestions = [
        "What should I say?",
        "Help me ask for water",
        "I need to explain I'm in pain",
        "How do I say I want to go home?",
        "I feel sick — help me tell someone",
    ]

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                // Connectivity indicator
                HStack(spacing: 4) {
                    Circle()
                        .fill(session.mode == .offline ? Color.red
                              : session.mode == .companion ? Color.green : Color.yellow)
                        .frame(width: 6, height: 6)
                    Text(session.mode == .offline ? "Offline" :
                         session.mode == .companion ? "iPhone AI" : "Cloud AI")
                        .font(.system(size: 10))
                        .foregroundColor(.secondary)
                    Spacer()
                }

                // AI response
                if session.isThinking {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding()
                } else if !session.reply.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(session.reply)
                            .font(.system(size: 13))
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(8)
                            .background(Color(.secondarySystemBackground))
                            .cornerRadius(8)

                        Button {
                            tts.speak(session.reply)
                            WKInterfaceDevice.current().play(.click)
                        } label: {
                            Label("Speak", systemImage: "speaker.wave.2")
                                .font(.system(size: 12))
                        }
                        .buttonStyle(.bordered)
                        .tint(.green)
                    }
                }

                // Quick suggestions — tap to ask without typing
                ForEach(suggestions, id: \.self) { q in
                    Button {
                        Task { await session.ask(q) }
                        WKInterfaceDevice.current().play(.click)
                    } label: {
                        Text(q)
                            .font(.system(size: 12))
                            .multilineTextAlignment(.leading)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 6)
                    }
                    .buttonStyle(.bordered)
                    .disabled(session.isThinking)
                }

                // Scribble / Dictation input
                Button {
                    showDictation = true
                } label: {
                    Label("Type / Dictate", systemImage: "mic")
                        .font(.system(size: 12))
                }
                .buttonStyle(.borderedProminent)
                .sheet(isPresented: $showDictation) {
                    WatchDictationView { text in
                        Task { await session.ask(text) }
                    }
                }
            }
            .padding(.horizontal, 4)
        }
        .navigationTitle("AI ✦")
    }
}

// MARK: - Dictation sheet (Scribble or Voice)

struct WatchDictationView: View {
    let onSubmit: (String) -> Void
    @State private var text = ""
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 8) {
            TextField("Ask anything…", text: $text)
                .textFieldStyle(.plain)
                .font(.system(size: 14))

            Button("Send") {
                if !text.isEmpty {
                    onSubmit(text)
                    dismiss()
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(text.isEmpty)

            Button("Cancel") { dismiss() }
                .buttonStyle(.bordered)
                .tint(.secondary)
        }
        .padding()
    }
}

// MARK: - Emergency view (idle state — always offline capable)

struct WatchEmergencyView: View {
    @EnvironmentObject var emergency: WatchEmergencyManager
    @EnvironmentObject var tts: WatchTTS

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                Button {
                    emergency.trigger(phrase: "I need help now", severity: .critical)
                    tts.speak("Help!")
                    WKInterfaceDevice.current().play(.notification)
                } label: {
                    VStack(spacing: 4) {
                        Image(systemName: "sos")
                            .font(.system(size: 36, weight: .bold))
                        Text("SOS")
                            .font(.headline)
                    }
                    .frame(maxWidth: .infinity, minHeight: 70)
                }
                .buttonStyle(.borderedProminent)
                .tint(.red)

                ForEach(emergencyPhrases, id: \.text) { item in
                    Button {
                        tts.speak(item.text)
                        emergency.sendPhrase(item.text)
                        WKInterfaceDevice.current().play(.click)
                    } label: {
                        HStack {
                            Text(item.icon)
                            Text(item.text)
                                .font(.system(size: 13))
                            Spacer()
                        }
                        .padding(.vertical, 4)
                    }
                    .buttonStyle(.bordered)
                    .tint(.red)
                }
            }
            .padding(.horizontal, 4)
        }
        .navigationTitle("Emergency")
    }

    private let emergencyPhrases: [(icon: String, text: String)] = [
        ("😰", "I can't breathe"),
        ("💊", "I need my medicine"),
        ("😢", "I'm in pain"),
        ("🏥", "I need a doctor"),
        ("🆘", "Call my caregiver"),
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
                    .symbolEffect(.pulse)
                Text("HELP COMING")
                    .font(.headline)
                    .foregroundColor(.white)
                Text(emergency.countdownText)
                    .font(.title3)
                    .foregroundColor(.white.opacity(0.8))
                Button("Cancel") { emergency.cancel() }
                    .buttonStyle(.bordered)
                    .tint(.white)
            }
        }
    }
}

// MARK: - Notification view (for watch alerts)

struct WatchNotificationView: View {
    var body: some View {
        VStack {
            Image(systemName: "bell.fill")
            Text("PrismAAC Alert")
        }
    }
}
