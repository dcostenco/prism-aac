import SwiftUI

struct OnboardingView: View {
    @Binding var isComplete: Bool
    @State private var page = 0

    private let pages: [OnboardingPage] = [
        OnboardingPage(
            icon: "bubble.left.and.text.bubble.right.fill",
            title: "Welcome to Prism AAC",
            subtitle: "Help nonverbal kids and adults talk.",
            bullets: [
                "Tap pictures, build sentences, hear them spoken aloud",
                "Works in 23 languages",
                "iPhone, iPad, and Apple Watch"
            ],
            color: .blue
        ),
        OnboardingPage(
            icon: "brain",
            title: "On-Device AI",
            subtitle: "Private. Fast. Works offline.",
            bullets: [
                "Runs on your device when supported — cloud only as fallback",
                "Sub-second responses with no internet needed",
                "Automatic model selection based on your device"
            ],
            color: .purple
        ),
        OnboardingPage(
            icon: "hand.tap.fill",
            title: "Built for Accessibility",
            subtitle: "Multiple ways to communicate.",
            bullets: [
                "Touch with large tap targets (44pt minimum)",
                "Voice input with 22-language speech recognition",
                "Full iOS Switch Control and Voice Control support",
                "Apple Watch standalone for wrist-based communication"
            ],
            color: .green
        ),
        OnboardingPage(
            icon: "shield.checkered",
            title: "Clinical Safety",
            subtitle: "Built for the most vulnerable users.",
            bullets: [
                "Crisis detection on every AI response",
                "AAC access is never restricted as a consequence",
                "Emergency alerts to caregivers via Apple Watch"
            ],
            color: .red
        ),
    ]

    var body: some View {
        VStack(spacing: 0) {
            TabView(selection: $page) {
                ForEach(Array(pages.enumerated()), id: \.offset) { index, pg in
                    VStack(spacing: 24) {
                        Spacer()
                        Image(systemName: pg.icon)
                            .font(.system(size: 72))
                            .foregroundStyle(pg.color)
                            .symbolRenderingMode(.hierarchical)

                        Text(pg.title)
                            .font(.title).fontWeight(.bold)
                            .multilineTextAlignment(.center)

                        Text(pg.subtitle)
                            .font(.title3)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)

                        VStack(alignment: .leading, spacing: 12) {
                            ForEach(pg.bullets, id: \.self) { bullet in
                                HStack(alignment: .top, spacing: 10) {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(pg.color)
                                        .font(.body)
                                    Text(bullet)
                                        .font(.body)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }
                        }
                        .padding(.horizontal, 32)
                        Spacer()
                    }
                    .padding()
                    .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .always))
            .indexViewStyle(.page(backgroundDisplayMode: .always))

            Button(action: {
                if page < pages.count - 1 {
                    withAnimation { page += 1 }
                } else {
                    UserDefaults.standard.set(true, forKey: "onboarding_complete")
                    withAnimation { isComplete = true }
                }
            }) {
                Text(page < pages.count - 1 ? "Continue" : "Get Started")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(pages[page].color)
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 32)
        }
        .background(Color(UIColor.systemBackground))
    }
}

private struct OnboardingPage {
    let icon: String
    let title: String
    let subtitle: String
    let bullets: [String]
    let color: Color
}
