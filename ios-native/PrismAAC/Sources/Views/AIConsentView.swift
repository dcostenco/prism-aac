import SwiftUI

struct AIConsentView: View {
    @Binding var isAccepted: Bool

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                Spacer().frame(height: 40)

                Image(systemName: "cpu.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(.purple)
                    .symbolRenderingMode(.hierarchical)

                Text("On-Device AI")
                    .font(.title).fontWeight(.bold)

                Text("Prism AAC uses artificial intelligence to help with word prediction, sentence building, and communication support.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)

                VStack(alignment: .leading, spacing: 16) {
                    AIInfoRow(icon: "iphone", color: .blue,
                              title: "On-Device Processing",
                              detail: "AI runs locally on your device using a built-in language model. Your communication data never leaves your device.")

                    AIInfoRow(icon: "icloud.slash", color: .green,
                              title: "Works Offline",
                              detail: "Core AAC features work without an internet connection. Cloud AI is used only as a fallback when on-device inference is unavailable.")

                    AIInfoRow(icon: "cloud", color: .orange,
                              title: "Cloud Fallback",
                              detail: "When on-device AI is unavailable, queries may be sent to Synalux servers and processed by cloud AI providers (Google Gemini or Anthropic Claude). No account identifiers are included in AI queries.")

                    AIInfoRow(icon: "lock.shield", color: .red,
                              title: "Safety",
                              detail: "All AI responses pass through a deterministic safety gate that intercepts crisis and harmful content before it reaches the user.")
                }
                .padding(.horizontal, 20)

                Link("View Privacy Policy", destination: URL(string: "https://synalux.ai/prism-aac/privacy")!)
                    .font(.footnote)

                Button(action: {
                    UserDefaults.standard.set(true, forKey: "ai_consent_accepted")
                    withAnimation { isAccepted = true }
                }) {
                    Text("Continue")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(.blue)
                        .foregroundColor(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                }
                .padding(.horizontal, 24)

                Button(action: {
                    UserDefaults.standard.set(true, forKey: "ai_consent_accepted")
                    UserDefaults.standard.set(true, forKey: "ai_declined")
                    withAnimation { isAccepted = true }
                }) {
                    Text("Continue without AI")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 4)

                Text("You can change AI settings at any time in the app.")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .padding(.bottom, 32)
            }
        }
        .background(Color(UIColor.systemBackground))
    }
}

private struct AIInfoRow: View {
    let icon: String
    let color: Color
    let title: String
    let detail: String

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(color)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(.subheadline).fontWeight(.semibold)
                Text(detail).font(.caption).foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}
