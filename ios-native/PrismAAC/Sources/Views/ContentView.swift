import SwiftUI

struct ContentView: View {
    @EnvironmentObject var app: AppState
    @State private var composedText = ""
    @State private var showAIPanel = false
    @State private var selectedLanguage = "en-US"

    var body: some View {
        GeometryReader { geo in
            let isLandscape = geo.size.width > geo.size.height
            Group {
                if isLandscape && geo.size.height < 500 {
                    // iPhone landscape: side-by-side
                    landscapeLayout(geo: geo)
                } else {
                    // Portrait (all) and iPad landscape: vertical, fills screen
                    portraitLayout(geo: geo)
                }
            }
        }
        .background(Color(.systemBackground))
        .animation(.easeInOut(duration: 0.2), value: app.tier)
        .animation(.easeInOut(duration: 0.2), value: showAIPanel)
    }

    // MARK: - Portrait + iPad landscape: vertical, phrase grid fills space

    private func portraitLayout(geo: GeometryProxy) -> some View {
        let keyboardH = min(geo.size.height * 0.32, 220.0)
        let msgBarH   = 70.0
        let phraseH   = geo.size.height - keyboardH - msgBarH - (app.memoryBanner != nil ? 32 : 0)

        return VStack(spacing: 0) {
            if let banner = app.memoryBanner { MemoryBannerView(message: banner, tier: app.tier) }
            MessageBarView(
                text: $composedText,
                onSpeak: { app.pipeline.speak(text: composedText, language: selectedLanguage) },
                onClear: { composedText = "" }
            )
            .frame(height: msgBarH)
            if showAIPanel && app.tier.aiEnabled {
                AIResponseView(pipeline: app.pipeline, question: composedText)
                    .frame(maxHeight: 180)
                    .transition(.move(edge: .top))
            }
            PhraseBoardView(
                onPhrase: { phrase in composedText += (composedText.isEmpty ? "" : " ") + phrase },
                availableHeight: phraseH
            )
            .frame(height: phraseH)
            KeyboardView(
                text: $composedText,
                onSpeak: { app.pipeline.speak(text: composedText, language: selectedLanguage) },
                onAsk: app.tier.aiEnabled ? { showAIPanel.toggle() } : nil
            )
            .frame(height: keyboardH)
        }
    }

    // MARK: - iPhone landscape: side-by-side

    private func landscapeLayout(geo: GeometryProxy) -> some View {
        VStack(spacing: 0) {
            if let banner = app.memoryBanner { MemoryBannerView(message: banner, tier: app.tier) }
            MessageBarView(
                text: $composedText,
                onSpeak: { app.pipeline.speak(text: composedText, language: selectedLanguage) },
                onClear: { composedText = "" }
            )
            .frame(height: 52)
            HStack(spacing: 0) {
                PhraseBoardView(
                    onPhrase: { phrase in composedText += (composedText.isEmpty ? "" : " ") + phrase },
                    availableHeight: geo.size.height - 52
                )
                .frame(width: geo.size.width * 0.42)
                Divider()
                KeyboardView(
                    text: $composedText,
                    onSpeak: { app.pipeline.speak(text: composedText, language: selectedLanguage) },
                    onAsk: app.tier.aiEnabled ? { showAIPanel.toggle() } : nil
                )
                .frame(maxWidth: .infinity)
            }
            .frame(maxHeight: .infinity)
        }
    }
}

// MARK: - Memory banner

struct MemoryBannerView: View {
    let message: String
    let tier: AppState.FeatureTier

    private var color: Color { tier == .emergency ? .red : .orange }

    var body: some View {
        HStack {
            Image(systemName: tier == .emergency ? "exclamationmark.triangle.fill" : "memorychip")
            Text(message).font(.caption).fontWeight(.medium)
            Spacer()
        }
        .padding(.horizontal, 12).padding(.vertical, 6)
        .background(color.opacity(0.15)).foregroundColor(color)
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
                .lineLimit(2)

            Button(action: onSpeak) {
                Image(systemName: "play.fill")
                    .font(.title2).foregroundColor(.white)
                    .frame(width: 52, height: 52)
                    .background(text.isEmpty ? Color.gray : Color.green)
                    .cornerRadius(12)
            }
            .disabled(text.isEmpty)
            .accessibilityLabel("Speak")

            Button(action: onClear) {
                Image(systemName: "xmark.circle.fill")
                    .font(.title2).foregroundColor(.white)
                    .frame(width: 52, height: 52)
                    .background(Color.red.opacity(0.8))
                    .cornerRadius(12)
            }
            .accessibilityLabel("Clear")
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(Color(.systemBackground))
    }
}

// MARK: - Phrase board (fills all remaining height)

struct PhraseBoardView: View {
    let onPhrase: (String) -> Void
    var availableHeight: Double = 300

    private let coreCategories: [(icon: String, label: String, phrases: [String])] = [
        ("⚡", "Quick",    ["Yes", "No", "More", "Stop", "Help", "Wait", "Thank you", "All done"]),
        ("😊", "Feelings", ["Happy", "Sad", "Tired", "Hurt", "Scared", "Hungry"]),
        ("💧", "Needs",    ["Water", "Food", "Bathroom", "Medicine", "Sit down", "Go home"]),
        ("🏠", "Places",   ["Home", "School", "Hospital", "Bathroom", "Outside", "Car"]),
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
                            Text(coreCategories[i].label)
                                .padding(.horizontal, 14).padding(.vertical, 8)
                                .background(selectedCategory == i ? Color.accentColor : Color(.tertiarySystemBackground))
                                .foregroundColor(selectedCategory == i ? .white : .primary)
                                .cornerRadius(20)
                                .font(.subheadline).fontWeight(.medium)
                        }
                        .accessibilityLabel(coreCategories[i].label)
                    }
                }
                .padding(.horizontal, 12).padding(.vertical, 6)
            }

            // Phrase grid — buttons fill ALL available height equally
            let phrases = coreCategories[selectedCategory].phrases
            let tabBarH: Double = 44
            let gridH = max(80, availableHeight - tabBarH - 8)
            let cols = phrases.count <= 4 ? 2 : (phrases.count <= 6 ? 3 : 4)
            let rows = Int(ceil(Double(phrases.count) / Double(cols)))
            let btnH = max(44, (gridH - Double(rows - 1) * 8) / Double(rows))

            LazyVGrid(
                columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: cols),
                spacing: 8
            ) {
                ForEach(phrases, id: \.self) { phrase in
                    Button {
                        onPhrase(phrase)
                    } label: {
                        Text(phrase)
                            .font(.callout).fontWeight(.semibold)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity)
                            .frame(height: btnH)
                            .background(Color(.secondarySystemBackground))
                            .cornerRadius(10)
                            .foregroundColor(.primary)
                    }
                    .accessibilityLabel(phrase)
                }
            }
            .padding(.horizontal, 8).padding(.bottom, 4)
        }
    }
}

// MARK: - Key button (extracted to help type-checker)

private struct KeyButton: View {
    let char: Character
    let onTap: () -> Void
    var body: some View {
        Button(String(char), action: onTap)
            .font(.title3).fontWeight(.medium)
            .frame(maxWidth: .infinity, minHeight: 44)
            .background(Color(.tertiarySystemBackground))
            .cornerRadius(6)
            .foregroundColor(.primary)
            .accessibilityLabel(String(char))
    }
}

// MARK: - Keyboard

struct KeyboardView: View {
    @Binding var text: String
    let onSpeak: () -> Void
    let onAsk: (() -> Void)?

    private let rows = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"]

    var body: some View {
        VStack(spacing: 3) {
            ForEach(rows, id: \.self) { row in
                HStack(spacing: 3) {
                    ForEach(Array(row), id: \.self) { char in
                        KeyButton(char: char, onTap: { text += String(char).lowercased() })
                    }
                }
            }

            // Utility row — all buttons always visible
            HStack(spacing: 4) {
                Button("space") { text += " " }
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .background(Color(.tertiarySystemBackground))
                    .cornerRadius(6)
                    .font(.callout)
                    .accessibilityLabel("space")

                Button {
                    if !text.isEmpty { text.removeLast() }
                } label: {
                    Image(systemName: "delete.left")
                        .font(.title3)
                }
                .frame(width: 52).frame(minHeight: 44)
                .background(Color(.tertiarySystemBackground))
                .cornerRadius(6)
                .accessibilityLabel("Delete")

                if let onAsk {
                    Button("AI ✦", action: onAsk)
                        .frame(width: 68).frame(minHeight: 44)
                        .background(Color.accentColor)
                        .foregroundColor(.white)
                        .cornerRadius(6)
                        .fontWeight(.bold)
                        .accessibilityLabel("AI ✦")
                }

                Button("Speak", action: onSpeak)
                    .frame(width: 80).frame(minHeight: 44)
                    .background(text.isEmpty ? Color.gray : Color.green)
                    .foregroundColor(.white)
                    .cornerRadius(6)
                    .fontWeight(.bold)
                    .disabled(text.isEmpty)
                    .accessibilityLabel("Speak")
            }
        }
        .padding(.horizontal, 6).padding(.vertical, 6)
        .background(Color(.secondarySystemBackground))
    }
}

// MARK: - AI response panel

struct AIResponseView: View {
    let pipeline: AACPipeline
    let question: String
    @State private var response = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Label("AI Response", systemImage: "sparkles")
                .font(.caption).foregroundColor(.secondary)
            ScrollView {
                Text(response.isEmpty ? "Thinking…" : response)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(10)
        .background(Color(.tertiarySystemBackground))
        .cornerRadius(10)
        .padding(.horizontal, 10)
        .task {
            let stream = pipeline.ask(question: question)
            for await token in stream { response += token }
        }
    }
}

// MARK: - Model loading view

struct ModelLoadingView: View {
    @EnvironmentObject var app: AppState
    @State private var phase: Phase = .checking
    @State private var progress: Double = 0

    enum Phase { case checking, downloading, failed, lowMemory }

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "brain.fill").font(.system(size: 64)).foregroundColor(.accentColor)
            switch phase {
            case .checking:
                ProgressView("Checking device memory…")
            case .downloading:
                VStack(spacing: 12) {
                    Text("Downloading AI model").font(.headline)
                    ProgressView(value: progress).padding(.horizontal, 32)
                    Text("\(Int(progress * 100))% — 864 MB").font(.caption).foregroundColor(.secondary)
                }
            case .lowMemory:
                VStack(spacing: 12) {
                    Text("Device memory is low").font(.headline)
                    Text("Core AAC and cloud AI still work.").font(.callout).foregroundColor(.secondary)
                    Button("Continue with Core AAC") { app.enterCoreOnlyMode() }.buttonStyle(.borderedProminent)
                }
            case .failed:
                VStack(spacing: 12) {
                    Text("Download failed").font(.headline)
                    Button("Try again") { Task { await startDownload() } }.buttonStyle(.bordered)
                    Button("Continue without AI") { app.enterCoreOnlyMode() }
                }
            }
            Spacer()
            if phase == .downloading || phase == .checking {
                Button("Use Core AAC only") { app.enterCoreOnlyMode() }
                    .font(.caption).foregroundColor(.secondary)
            }
        }
        .task { await startDownload() }
    }

    private func startDownload() async {
        phase = .checking
        let free = AppState.measureFreeMemoryMB()
        guard free >= 1_200 else { phase = .lowMemory; return }
        let url = FileManager.default
            .urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("models/prism-ios-1.5b-q4.gguf")
        if FileManager.default.fileExists(atPath: url.path) {
            await app.loadModel(from: url); return
        }
        phase = .downloading
        do {
            // Download from CDN (URL set once model is hosted)
            let cdnURL = URL(string: "https://synalux.ai/models/prism-ios-1.5b-q4.gguf")!
            let (bytes, _) = try await URLSession.shared.bytes(from: cdnURL)
            var data = Data(); var written: Int64 = 0
            for try await chunk in bytes {
                data.append(chunk); written += 1
                if written % 65536 == 0 { await MainActor.run { progress = Double(written) / 864_000_000 } }
            }
            try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
            try data.write(to: url)
            await app.loadModel(from: url)
        } catch { phase = .failed }
    }
}
