import SwiftUI

struct ContentView: View {
    @EnvironmentObject var app: AppState
    @State private var composedText = ""
    @State private var showAIPanel = false
    @State private var selectedLanguage = "en-US"

    var body: some View {
        VStack(spacing: 0) {

            // Memory tier banner — shown only when degraded
            if let banner = app.memoryBanner {
                MemoryBannerView(message: banner, tier: app.tier)
            }

            // Message bar — always visible, always functional
            MessageBarView(
                text: $composedText,
                onSpeak: { app.pipeline.speak(text: composedText, language: selectedLanguage) },
                onClear: { composedText = "" }
            )

            // Main content area — adapts to tier
            if showAIPanel && app.tier.aiEnabled {
                AIResponseView(pipeline: app.pipeline, question: composedText)
                    .transition(.move(edge: .bottom))
            }

            // Core phrase board — ALWAYS available regardless of tier
            PhraseBoardView(onPhrase: { phrase in
                composedText += (composedText.isEmpty ? "" : " ") + phrase
            })

            Spacer(minLength: 0)

            // Keyboard row
            KeyboardView(
                text: $composedText,
                onSpeak: { app.pipeline.speak(text: composedText, language: selectedLanguage) },
                onAsk: app.tier.aiEnabled ? { showAIPanel = true } : nil
            )
        }
        .background(Color(.systemBackground))
        .animation(.easeInOut(duration: 0.2), value: app.tier)
        .animation(.easeInOut(duration: 0.2), value: showAIPanel)
    }
}

// MARK: - Memory banner

struct MemoryBannerView: View {
    let message: String
    let tier: AppState.FeatureTier

    private var color: Color {
        tier == .emergency ? .red : .orange
    }

    var body: some View {
        HStack {
            Image(systemName: tier == .emergency ? "exclamationmark.triangle.fill" : "memorychip")
            Text(message)
                .font(.caption)
                .fontWeight(.medium)
            Spacer()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(color.opacity(0.15))
        .foregroundColor(color)
    }
}

// MARK: - Message bar

struct MessageBarView: View {
    @Binding var text: String
    let onSpeak: () -> Void
    let onClear: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            Text(text.isEmpty ? "Tap to build a message…" : text)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(10)
                .background(Color(.secondarySystemBackground))
                .cornerRadius(10)
                .foregroundColor(text.isEmpty ? .secondary : .primary)
                .font(.title3)

            Button(action: onSpeak) {
                Image(systemName: "play.fill")
                    .font(.title2)
                    .foregroundColor(.white)
                    .frame(width: 52, height: 52)
                    .background(text.isEmpty ? Color.gray : Color.green)
                    .cornerRadius(12)
            }
            .disabled(text.isEmpty)
            .accessibilityLabel("Speak")

            Button(action: onClear) {
                Image(systemName: "xmark.circle.fill")
                    .font(.title2)
                    .foregroundColor(.white)
                    .frame(width: 52, height: 52)
                    .background(Color.red.opacity(0.8))
                    .cornerRadius(12)
            }
            .accessibilityLabel("Clear")
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color(.systemBackground))
    }
}

// MARK: - Phrase board

struct PhraseBoardView: View {
    let onPhrase: (String) -> Void

    // Core vocabulary — loaded from CoreVocab.json at runtime
    private let coreCategories: [(icon: String, label: String, phrases: [String])] = [
        ("🙋", "Quick", ["Yes", "No", "More", "Stop", "Help", "Wait"]),
        ("😊", "Feelings", ["Happy", "Sad", "Tired", "Hurt", "Scared", "Hungry"]),
        ("💬", "Needs", ["I need", "I want", "I have", "Please", "Thank you"]),
        ("🏠", "Places", ["Home", "School", "Hospital", "Bathroom", "Outside"]),
    ]

    @State private var selectedCategory = 0

    var body: some View {
        VStack(spacing: 0) {
            // Category tabs
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(coreCategories.indices, id: \.self) { i in
                        Button {
                            selectedCategory = i
                        } label: {
                            Label(coreCategories[i].label, systemImage: "")
                                .padding(.horizontal, 14)
                                .padding(.vertical, 8)
                                .background(selectedCategory == i ? Color.accentColor : Color(.tertiarySystemBackground))
                                .foregroundColor(selectedCategory == i ? .white : .primary)
                                .cornerRadius(20)
                        }
                    }
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
            }

            // Phrase grid
            let phrases = coreCategories[selectedCategory].phrases
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 100, maximum: 160))], spacing: 8) {
                ForEach(phrases, id: \.self) { phrase in
                    Button {
                        onPhrase(phrase)
                    } label: {
                        Text(phrase)
                            .font(.callout)
                            .fontWeight(.medium)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Color(.secondarySystemBackground))
                            .cornerRadius(10)
                            .foregroundColor(.primary)
                    }
                    .accessibilityLabel(phrase)
                }
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 8)
        }
    }
}

// MARK: - Keyboard

struct KeyboardView: View {
    @Binding var text: String
    let onSpeak: () -> Void
    let onAsk: (() -> Void)?  // nil when AI unavailable

    var body: some View {
        VStack(spacing: 4) {
            // QWERTY rows (simplified — full layout via UIKit integration)
            ForEach(["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"], id: \.self) { row in
                HStack(spacing: 4) {
                    ForEach(Array(row), id: \.self) { char in
                        Button(String(char)) {
                            text += String(char).lowercased()
                        }
                        .font(.title3)
                        .fontWeight(.medium)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(Color(.tertiarySystemBackground))
                        .cornerRadius(6)
                        .foregroundColor(.primary)
                    }
                }
            }

            // Utility row
            HStack(spacing: 6) {
                // Space
                Button("space") { text += " " }
                    .frame(maxWidth: .infinity, maxHeight: 44)
                    .background(Color(.tertiarySystemBackground))
                    .cornerRadius(6)

                // Backspace
                Button {
                    if !text.isEmpty { text.removeLast() }
                } label: {
                    Image(systemName: "delete.left")
                }
                .frame(width: 56, height: 44)
                .background(Color(.tertiarySystemBackground))
                .cornerRadius(6)

                // AI Ask — hidden when unavailable
                if let onAsk {
                    Button("AI ✦", action: onAsk)
                        .frame(width: 72, height: 44)
                        .background(Color.accentColor)
                        .foregroundColor(.white)
                        .cornerRadius(6)
                        .fontWeight(.bold)
                }

                // Speak
                Button("Speak", action: onSpeak)
                    .frame(width: 88, height: 44)
                    .background(Color.green)
                    .foregroundColor(.white)
                    .cornerRadius(6)
                    .fontWeight(.bold)
                    .disabled(text.isEmpty)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 8)
        .background(Color(.secondarySystemBackground))
    }
}

// MARK: - AI response panel

struct AIResponseView: View {
    let pipeline: AACPipeline
    let question: String
    @State private var response = ""
    @State private var stream: AsyncStream<String>?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("AI Response", systemImage: "sparkles")
                .font(.caption)
                .foregroundColor(.secondary)
            ScrollView {
                Text(response.isEmpty ? "Thinking…" : response)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .frame(maxHeight: 120)
        }
        .padding(12)
        .background(Color(.tertiarySystemBackground))
        .cornerRadius(12)
        .padding(.horizontal, 12)
        .task {
            stream = pipeline.ask(question: question)
            if let s = stream {
                for await token in s { response += token }
            }
        }
    }
}

// MARK: - Model loading / download screen

struct ModelLoadingView: View {
    @EnvironmentObject var app: AppState
    @State private var downloadProgress: Double = 0
    @State private var phase: Phase = .checking

    enum Phase { case checking, downloading, failed, lowMemory }

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "brain.fill")
                .font(.system(size: 64))
                .foregroundColor(.accentColor)

            switch phase {
            case .checking:
                ProgressView("Checking device memory…")
            case .downloading:
                VStack(spacing: 12) {
                    Text("Downloading AI model")
                        .font(.headline)
                    ProgressView(value: downloadProgress)
                        .padding(.horizontal, 32)
                    Text("\(Int(downloadProgress * 100))% — 864 MB")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            case .lowMemory:
                VStack(spacing: 12) {
                    Text("Device memory is low")
                        .font(.headline)
                    Text("The on-device AI requires ~1.2 GB of free memory. " +
                         "You can still use core AAC features and cloud AI when connected.")
                        .font(.callout)
                        .multilineTextAlignment(.center)
                        .foregroundColor(.secondary)
                        .padding(.horizontal, 24)
                    Button("Continue with Core AAC") { app.enterCoreOnlyMode() }
                        .buttonStyle(.borderedProminent)
                }
            case .failed:
                VStack(spacing: 12) {
                    Text("Download failed")
                        .font(.headline)
                    Button("Try again") { Task { await startDownload() } }
                        .buttonStyle(.bordered)
                    Button("Continue without AI") { app.enterCoreOnlyMode() }
                }
            }

            Spacer()

            // Always allow skipping AI model
            if phase == .downloading || phase == .checking {
                Button("Use Core AAC only (no AI)") { app.enterCoreOnlyMode() }
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .task { await startDownload() }
    }

    private func startDownload() async {
        phase = .checking

        // Memory check before downloading
        let free = AppState.measureFreeMemoryMB()
        guard free >= 1_200 else {
            phase = .lowMemory
            return
        }

        // Check if already downloaded
        let modelURL = modelFileURL()
        if FileManager.default.fileExists(atPath: modelURL.path) {
            await app.loadModel(from: modelURL)
            return
        }

        phase = .downloading
        do {
            try await downloadModel(to: modelURL)
            await app.loadModel(from: modelURL)
        } catch {
            phase = .failed
        }
    }

    private func downloadModel(to dest: URL) async throws {
        let cdnURL = URL(string: "https://synalux.ai/models/prism-ios-1.5b-q4.gguf")!
        let (bytes, _) = try await URLSession.shared.bytes(from: cdnURL)
        var data = Data()
        var written: Int64 = 0
        let total: Int64 = 905_969_664  // 864 MB — update when model is finalised

        for try await chunk in bytes {
            data.append(chunk)
            written += 1
            if written % 65536 == 0 {
                let progress = min(1.0, Double(written) / Double(total))
                await MainActor.run { downloadProgress = progress }
            }
        }
        try data.write(to: dest)
    }

    private func modelFileURL() -> URL {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        return docs.appendingPathComponent("models/prism-ios-1.5b-q4.gguf")
    }
}
