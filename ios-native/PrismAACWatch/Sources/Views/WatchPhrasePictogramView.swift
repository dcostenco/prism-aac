import SwiftUI

/// AAC pictogram phrase board for Apple Watch.
///
/// Layout: 2-column grid of symbol+label tiles.
/// Symbols: ARASAAC pictograms loaded via AsyncImage.
/// Falls back to SF Symbols offline (no network required for core vocab).
///
/// Watch Series 10 / Ultra 2 (watchOS 11+): uses the built-in keyboard
/// for free-text input. Older watches use Dictation or Scribble.
struct WatchPhrasePictogramView: View {
    @EnvironmentObject var tts: WatchTTS
    @EnvironmentObject var session: WatchAISession
    @State private var selectedCategory = 0

    var body: some View {
        ScrollView {
            VStack(spacing: 6) {
                // Category selector (Digital Crown friendly)
                Picker("", selection: $selectedCategory) {
                    ForEach(AACVocab.categories.indices, id: \.self) { i in
                        Text(AACVocab.categories[i].icon)
                            .font(.title3)
                            .tag(i)
                    }
                }
                .pickerStyle(.wheel)
                .frame(height: 44)

                // 2-column pictogram grid
                let phrases = AACVocab.categories[selectedCategory].phrases
                LazyVGrid(
                    columns: [GridItem(.flexible(), spacing: 6), GridItem(.flexible(), spacing: 6)],
                    spacing: 6
                ) {
                    ForEach(phrases) { item in
                        PictogramTile(item: item) {
                            tts.speak(item.label)
                            WKInterfaceDevice.current().play(.click)
                            // Also send to iPhone for richer TTS if reachable
                            session.sendPhrase(item.label)
                        }
                    }
                }
            }
            .padding(.horizontal, 4)
        }
    }
}

// MARK: - Pictogram tile

struct PictogramTile: View {
    let item: AACPhrase
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 3) {
                // Try ARASAAC image → fall back to SF Symbol
                if let url = item.arasaacURL {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let img):
                            img.resizable()
                               .scaledToFit()
                               .frame(width: 36, height: 36)
                        default:
                            SFSymbolFallback(name: item.sfSymbol, color: item.color)
                        }
                    }
                } else {
                    SFSymbolFallback(name: item.sfSymbol, color: item.color)
                }

                Text(item.label)
                    .font(.system(size: 11, weight: .medium))
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
                    .minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity, minHeight: 68)
            .padding(4)
            .background(item.color.opacity(0.15))
            .cornerRadius(10)
        }
        .buttonStyle(.plain)
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .stroke(item.color.opacity(0.4), lineWidth: 1)
        )
        .accessibilityLabel(item.label)
    }
}

struct SFSymbolFallback: View {
    let name: String
    let color: Color
    var body: some View {
        Image(systemName: name)
            .font(.system(size: 28))
            .foregroundColor(color)
            .frame(width: 36, height: 36)
    }
}

// MARK: - AAC vocabulary data

struct AACPhrase: Identifiable {
    let id = UUID()
    let label: String
    let sfSymbol: String      // offline fallback
    let color: Color
    let arasaacId: Int?       // ARASAAC pictogram ID (nil = SF Symbol only)

    var arasaacURL: URL? {
        guard let id = arasaacId else { return nil }
        return URL(string: "https://static.arasaac.org/pictograms/\(id)/\(id)_300.png")
    }
}

struct AACCategory {
    let icon: String
    let name: String
    let phrases: [AACPhrase]
}

struct AACVocab {
    static let categories: [AACCategory] = [

        AACCategory(icon: "⚡", name: "Quick", phrases: [
            AACPhrase(label: "Yes",       sfSymbol: "checkmark.circle.fill", color: .green,  arasaacId: 5584),
            AACPhrase(label: "No",        sfSymbol: "xmark.circle.fill",     color: .red,    arasaacId: 5578),
            AACPhrase(label: "More",      sfSymbol: "plus.circle",           color: .blue,   arasaacId: 5571),
            AACPhrase(label: "Stop",      sfSymbol: "hand.raised.fill",      color: .orange, arasaacId: 5581),
            AACPhrase(label: "Help",      sfSymbol: "sos",                   color: .red,    arasaacId: 5557),
            AACPhrase(label: "Wait",      sfSymbol: "pause.circle",          color: .yellow, arasaacId: 5583),
            AACPhrase(label: "Thank you", sfSymbol: "heart.fill",            color: .pink,   arasaacId: 5582),
            AACPhrase(label: "All done",  sfSymbol: "checkmark.seal",        color: .green,  arasaacId: 5552),
        ]),

        AACCategory(icon: "😊", name: "Feelings", phrases: [
            AACPhrase(label: "Happy",   sfSymbol: "face.smiling",             color: .yellow, arasaacId: nil),
            AACPhrase(label: "Sad",     sfSymbol: "cloud.rain.fill",          color: .blue,   arasaacId: nil),
            AACPhrase(label: "Hurt",    sfSymbol: "cross.circle.fill",        color: .red,    arasaacId: nil),
            AACPhrase(label: "Scared",  sfSymbol: "bolt.heart.fill",          color: .purple, arasaacId: nil),
            AACPhrase(label: "Tired",   sfSymbol: "moon.zzz.fill",            color: .gray,   arasaacId: nil),
            AACPhrase(label: "Hungry",  sfSymbol: "fork.knife",               color: .orange, arasaacId: nil),
        ]),

        AACCategory(icon: "💧", name: "Needs", phrases: [
            AACPhrase(label: "Water",     sfSymbol: "drop.fill",              color: .blue,   arasaacId: 14981),
            AACPhrase(label: "Food",      sfSymbol: "fork.knife",             color: .orange, arasaacId: nil),
            AACPhrase(label: "Bathroom",  sfSymbol: "toilet.fill",            color: .teal,   arasaacId: nil),
            AACPhrase(label: "Medicine",  sfSymbol: "pill.fill",              color: .red,    arasaacId: nil),
            AACPhrase(label: "Sit down",  sfSymbol: "chair.fill",             color: .brown,  arasaacId: nil),
            AACPhrase(label: "Go home",   sfSymbol: "house.fill",             color: .green,  arasaacId: 8514),
        ]),

        AACCategory(icon: "🆘", name: "Emergency", phrases: [
            AACPhrase(label: "Call 911",         sfSymbol: "phone.fill",        color: .red,    arasaacId: nil),
            AACPhrase(label: "Can't breathe",    sfSymbol: "lungs.fill",        color: .red,    arasaacId: nil),
            AACPhrase(label: "I'm in pain",      sfSymbol: "cross.fill",        color: .red,    arasaacId: nil),
            AACPhrase(label: "Call my caregiver",sfSymbol: "person.crop.circle",color: .red,    arasaacId: nil),
            AACPhrase(label: "Need doctor",      sfSymbol: "stethoscope",       color: .red,    arasaacId: nil),
            AACPhrase(label: "Allergic reaction",sfSymbol: "allergens",         color: .orange, arasaacId: nil),
        ]),
    ]
}
