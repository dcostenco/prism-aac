import WidgetKit
import SwiftUI

struct PhraseEntry: TimelineEntry {
    let date: Date
    let phrases: [QuickPhrase]
}

struct QuickPhrase: Identifiable {
    let id: String
    let emoji: String
    let text: String
}

struct PhraseProvider: TimelineProvider {
    private static let defaultPhrases: [QuickPhrase] = [
        QuickPhrase(id: "help",    emoji: "🆘", text: "Help"),
        QuickPhrase(id: "yes",     emoji: "✅", text: "Yes"),
        QuickPhrase(id: "no",      emoji: "❌", text: "No"),
        QuickPhrase(id: "water",   emoji: "💧", text: "Water"),
        QuickPhrase(id: "pain",    emoji: "😢", text: "Pain"),
        QuickPhrase(id: "more",    emoji: "🔄", text: "More"),
    ]

    func placeholder(in context: Context) -> PhraseEntry {
        PhraseEntry(date: .now, phrases: Self.defaultPhrases)
    }

    func getSnapshot(in context: Context, completion: @escaping (PhraseEntry) -> Void) {
        completion(PhraseEntry(date: .now, phrases: Self.defaultPhrases))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PhraseEntry>) -> Void) {
        let entry = PhraseEntry(date: .now, phrases: Self.defaultPhrases)
        let timeline = Timeline(entries: [entry], policy: .never)
        completion(timeline)
    }
}

struct PrismWidgetSmall: View {
    let entry: PhraseEntry

    var body: some View {
        VStack(spacing: 6) {
            HStack {
                Image(systemName: "bubble.left.and.text.bubble.right.fill")
                    .foregroundStyle(.blue)
                Text("Prism AAC")
                    .font(.caption2).fontWeight(.bold)
                Spacer()
            }
            .padding(.bottom, 2)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 6) {
                ForEach(entry.phrases.prefix(4)) { phrase in
                    Link(destination: URL(string: "prism-aac://speak?text=\(phrase.text.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? phrase.text)")!) {
                        HStack(spacing: 4) {
                            Text(phrase.emoji).font(.callout)
                            Text(phrase.text).font(.caption2).fontWeight(.medium)
                                .lineLimit(1)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                        .background(.blue.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }
            }
        }
        .padding(12)
    }
}

struct PrismWidgetMedium: View {
    let entry: PhraseEntry

    var body: some View {
        VStack(spacing: 6) {
            HStack {
                Image(systemName: "bubble.left.and.text.bubble.right.fill")
                    .foregroundStyle(.blue)
                Text("Prism AAC — Quick Phrases")
                    .font(.caption).fontWeight(.bold)
                Spacer()
            }
            .padding(.bottom, 2)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 6) {
                ForEach(entry.phrases) { phrase in
                    Link(destination: URL(string: "prism-aac://speak?text=\(phrase.text.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? phrase.text)")!) {
                        VStack(spacing: 2) {
                            Text(phrase.emoji).font(.title3)
                            Text(phrase.text).font(.caption2).fontWeight(.medium)
                                .lineLimit(1)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(.blue.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                    }
                }
            }
        }
        .padding(12)
    }
}

@main
struct PrismAACWidgetBundle: WidgetBundle {
    var body: some Widget {
        PrismQuickPhrasesWidget()
    }
}

struct PrismQuickPhrasesWidget: Widget {
    let kind = "PrismQuickPhrases"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PhraseProvider()) { entry in
            if #available(iOSApplicationExtension 17.0, *) {
                Group {
                    PrismWidgetSmall(entry: entry)
                }
                .containerBackground(.fill.tertiary, for: .widget)
            } else {
                PrismWidgetSmall(entry: entry)
                    .padding()
                    .background()
            }
        }
        .configurationDisplayName("Quick Phrases")
        .description("Tap to speak common AAC phrases instantly.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
