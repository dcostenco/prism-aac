import SwiftUI

/// Large-picture AAC for Apple Watch — designed for children.
///
/// One big picture per screen. Swipe left/right (or Digital Crown) to browse.
/// Single tap speaks the word + sends to iPhone.
/// Emergency button always accessible via red side button / complication.
///
/// UX rationale:
///   - Kids cannot use the Watch keyboard or Scribble
///   - Fine motor skills limited → needs the largest possible tap target
///   - One word at a time → no cognitive overload
///   - Tap = speak immediately (no confirm step)
struct WatchPictogramCards: View {
    @EnvironmentObject var tts: WatchTTS
    @EnvironmentObject var emergency: WatchEmergencyManager
    @EnvironmentObject var session: WatchAISession

    // Flat list of all phrases for swiping (most frequent first)
    private let allPhrases: [AACPhrase] = AACVocab.childFriendlyOrder

    @State private var currentIndex = 0

    var body: some View {
        ZStack {
            // Main swipeable card
            TabView(selection: $currentIndex) {
                ForEach(allPhrases.indices, id: \.self) { i in
                    PictogramCard(phrase: allPhrases[i]) {
                        tts.speak(allPhrases[i].label)
                        session.sendPhrase(allPhrases[i].label)
                        WKInterfaceDevice.current().play(.click)
                    }
                    .tag(i)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))

            // Pager dots at bottom
            VStack {
                Spacer()
                HStack(spacing: 4) {
                    ForEach(0..<min(allPhrases.count, 8), id: \.self) { i in
                        Circle()
                            .fill(i == currentIndex % 8 ? Color.white : Color.white.opacity(0.3))
                            .frame(width: 4, height: 4)
                    }
                }
                .padding(.bottom, 2)
            }

            // SOS overlay — top-right corner, always accessible
            VStack {
                HStack {
                    Spacer()
                    Button {
                        emergency.trigger(phrase: "Help me", severity: .critical)
                        tts.speak("Help!")
                        WKInterfaceDevice.current().play(.notification)
                    } label: {
                        Image(systemName: "sos")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(.white)
                            .frame(width: 28, height: 28)
                            .background(Color.red)
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .padding(.trailing, 2)
                    .padding(.top, 2)
                }
                Spacer()
            }
        }
    }
}

// MARK: - Single full-screen picture card

struct PictogramCard: View {
    let phrase: AACPhrase
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 6) {
                // Picture — fills most of the Watch screen
                if let url = phrase.arasaacURL {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let img):
                            img.resizable()
                               .scaledToFit()
                               .frame(maxWidth: .infinity, maxHeight: 100)
                               .padding(.horizontal, 8)
                        case .failure:
                            LargeSFSymbol(name: phrase.sfSymbol, color: phrase.color)
                        case .empty:
                            LargeSFSymbol(name: phrase.sfSymbol, color: phrase.color)
                                .overlay(ProgressView().scaleEffect(0.5), alignment: .bottom)
                        @unknown default:
                            LargeSFSymbol(name: phrase.sfSymbol, color: phrase.color)
                        }
                    }
                } else {
                    LargeSFSymbol(name: phrase.sfSymbol, color: phrase.color)
                }

                // Label — large, bold, readable on small screen
                Text(phrase.label)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(.primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
                    .padding(.horizontal, 4)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(phrase.color.opacity(0.12))
            .cornerRadius(14)
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 2)
        .padding(.vertical, 2)
        .accessibilityLabel("Say: \(phrase.label)")
        .accessibilityHint("Tap to speak")
    }
}

struct LargeSFSymbol: View {
    let name: String
    let color: Color
    var body: some View {
        Image(systemName: name)
            .font(.system(size: 60))
            .foregroundColor(color)
            .frame(maxWidth: .infinity, maxHeight: 100)
    }
}

// MARK: - Root view: large pictogram cards + emergency overlay

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
