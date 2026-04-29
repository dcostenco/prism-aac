// Prism AAC — Apple Watch Companion App
// Quick phrase buttons for wrist-level communication
// WatchKit + SwiftUI (watchOS 10+)

import SwiftUI
import AVFoundation

@main
struct PrismAACWatchApp: App {
    var body: some Scene {
        WindowGroup {
            QuickPhrasesView()
        }
    }
}

// MARK: - Data

struct PhraseCategory: Identifiable {
    let id: String
    let name: String
    let icon: String
    let phrases: [String]
}

let categories: [PhraseCategory] = [
    PhraseCategory(id: "help", name: "Help", icon: "🆘", phrases: [
        "I need help", "Yes", "No", "All done", "Bathroom", "I am hungry", "I am thirsty", "Take a break"
    ]),
    PhraseCategory(id: "talk", name: "Talk", icon: "💬", phrases: [
        "Hello", "Thank you", "Please", "Goodbye", "Sorry", "Excuse me", "How are you?", "Wait"
    ]),
    PhraseCategory(id: "food", name: "Food", icon: "🍽️", phrases: [
        "Water", "Juice", "Pizza", "I would like to order", "Check please", "Fries", "Sandwich"
    ]),
    PhraseCategory(id: "places", name: "Places", icon: "📍", phrases: [
        "Home", "School", "Park", "Restaurant", "Library", "Mall", "Car"
    ]),
    PhraseCategory(id: "people", name: "People", icon: "👥", phrases: [
        "Mom", "Dad", "Teacher", "Friend", "Doctor", "Family"
    ]),
]

// MARK: - Views

struct QuickPhrasesView: View {
    @State private var selectedCategory: PhraseCategory? = nil
    @State private var lastSpoken: String = ""

    var body: some View {
        NavigationStack {
            if let cat = selectedCategory {
                PhraseListView(category: cat, lastSpoken: $lastSpoken, onBack: { selectedCategory = nil })
            } else {
                CategoryGridView(onSelect: { selectedCategory = $0 }, lastSpoken: lastSpoken)
            }
        }
    }
}

struct CategoryGridView: View {
    let onSelect: (PhraseCategory) -> Void
    let lastSpoken: String

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                // Last spoken badge
                if !lastSpoken.isEmpty {
                    Text("🔊 \(lastSpoken)")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.white.opacity(0.1))
                        .cornerRadius(8)
                }

                // Category buttons
                ForEach(categories) { cat in
                    Button(action: { onSelect(cat) }) {
                        HStack {
                            Text(cat.icon)
                                .font(.title3)
                            Text(cat.name)
                                .font(.headline)
                                .fontWeight(.bold)
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .background(Color.white.opacity(0.08))
                        .cornerRadius(12)
                    }
                    .buttonStyle(.plain)
                }

                // Quick emergency buttons (always visible)
                HStack(spacing: 6) {
                    QuickButton(text: "Help", color: .red)
                    QuickButton(text: "Yes", color: .green)
                    QuickButton(text: "No", color: .orange)
                }
                .padding(.top, 4)
            }
            .padding(.horizontal, 4)
        }
        .navigationTitle("Prism AAC")
    }
}

struct PhraseListView: View {
    let category: PhraseCategory
    @Binding var lastSpoken: String
    let onBack: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 6) {
                Button(action: onBack) {
                    HStack {
                        Image(systemName: "chevron.left")
                        Text("Back")
                    }
                    .font(.caption)
                    .foregroundColor(.purple)
                }

                Text("\(category.icon) \(category.name)")
                    .font(.headline)
                    .fontWeight(.bold)

                ForEach(category.phrases, id: \.self) { phrase in
                    Button(action: {
                        speakPhrase(phrase)
                        lastSpoken = phrase
                        WKInterfaceDevice.current().play(.click)
                    }) {
                        Text(phrase)
                            .font(.body)
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .background(Color.purple.opacity(0.3))
                            .cornerRadius(10)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 4)
        }
    }
}

struct QuickButton: View {
    let text: String
    let color: Color

    var body: some View {
        Button(action: {
            speakPhrase(text)
            WKInterfaceDevice.current().play(.click)
        }) {
            Text(text)
                .font(.caption)
                .fontWeight(.bold)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(color.opacity(0.3))
                .cornerRadius(8)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - TTS

func speakPhrase(_ text: String) {
    let utterance = AVSpeechUtterance(string: text)
    utterance.rate = AVSpeechUtteranceDefaultSpeechRate * 0.6
    utterance.volume = 1.0
    let synthesizer = AVSpeechSynthesizer()
    synthesizer.speak(utterance)
}
