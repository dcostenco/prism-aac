import SwiftUI
import WatchKit

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

    private var allPhrases: [AACPhrase] {
        let synced = vocab.categories.flatMap { cat in
            cat.phrases.map { p in
                AACPhrase(label: p.label, sfSymbol: p.sfSymbol, color: phraseColor(cat.id), arasaacId: p.arasaacId)
            }
        }
        return synced.isEmpty ? AACVocab.childFriendlyOrder : synced
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

    // Supported languages — BCP-47 code + display flag + short name
    private let supportedLanguages: [(code: String, flag: String, name: String)] = [
        ("en-US", "🇺🇸", "EN"), ("es-ES", "🇪🇸", "ES"), ("fr-FR", "🇫🇷", "FR"),
        ("de-DE", "🇩🇪", "DE"), ("ro-RO", "🇷🇴", "RO"), ("ru-RU", "🇷🇺", "RU"),
        ("uk-UA", "🇺🇦", "UA"), ("pt-BR", "🇧🇷", "PT"), ("ja-JP", "🇯🇵", "JA"),
        ("zh-CN", "🇨🇳", "ZH"), ("ar-SA", "🇸🇦", "AR"),
    ]

    @State private var showLangPicker = false

    private var currentFlag: String {
        supportedLanguages.first { $0.code == vocab.language }?.flag ?? "🌐"
    }

    var body: some View {
        ZStack(alignment: .topTrailing) {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 6) {
                    ForEach(allPhrases) { phrase in
                        PairCard(phrase: phrase) {
                            tts.speak(phrase.label)
                            session.sendPhrase(phrase.label)
                            WKInterfaceDevice.current().play(.click)
                        }
                    }
                }
                .padding(.horizontal, 4)
                .padding(.top, 32)   // leave room for top buttons
                .padding(.bottom, 8)
            }

            // Top-right button row: language flag | SOS
            HStack(spacing: 4) {
                // Language selector
                Button { showLangPicker = true } label: {
                    Text(currentFlag)
                        .font(.system(size: 13))
                        .frame(width: 24, height: 24)
                        .background(Color.white.opacity(0.15))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)

                // SOS — always reachable
                Button {
                    emergency.trigger(phrase: "Help me", severity: .critical)
                    tts.speak("Help!")
                    WKInterfaceDevice.current().play(.notification)
                } label: {
                    Image(systemName: "sos")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.white)
                        .frame(width: 24, height: 24)
                        .background(Color.red)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
            }
            .padding(.trailing, 2)
            .padding(.top, 2)
        }
        .sheet(isPresented: $showLangPicker) {
            List {
                ForEach(supportedLanguages, id: \.code) { lang in
                    Button {
                        vocab.setLanguage(lang.code)
                        showLangPicker = false
                    } label: {
                        HStack {
                            Text("\(lang.flag) \(lang.name)")
                                .font(.system(size: 15))
                            Spacer()
                            if vocab.language == lang.code {
                                Image(systemName: "checkmark")
                                    .foregroundColor(.green)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Language")
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
            .fullScreenCover(isPresented: .constant(emergency.isActive)) {
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
