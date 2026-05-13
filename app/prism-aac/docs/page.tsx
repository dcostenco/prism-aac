export const metadata = {
  title: 'Prism AAC — Support & Documentation',
  description: 'Help and support for Prism AAC communication app',
};

export default function DocsPage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px', fontFamily: '-apple-system, sans-serif', color: '#1a1a1a' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Prism AAC — Support</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>Free augmentative &amp; alternative communication app by <a href="https://synalux.ai" style={{ color: '#6366f1' }}>Synalux Health</a></p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>Getting Started</h2>
        <ul style={{ lineHeight: 1.8 }}>
          <li>Open <a href="https://synalux.ai/prism-aac" style={{ color: '#6366f1' }}>synalux.ai/prism-aac</a> on any device</li>
          <li>Tap a category (Help, Food, People, etc.) to see phrase tiles</li>
          <li>Tap a phrase — it appears in the message bar and speaks aloud</li>
          <li>Use the keyboard to type custom messages</li>
          <li>Press <strong>Speak ▶</strong> to hear your message</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>Features</h2>
        <ul style={{ lineHeight: 1.8 }}>
          <li><strong>23 languages</strong> — English, Spanish, French, Russian, Romanian, Arabic, Japanese, Korean, Chinese, and more</li>
          <li><strong>AI Chat</strong> — ask questions, get help composing messages</li>
          <li><strong>Translation</strong> — type in one language, hear it in another</li>
          <li><strong>Voice input</strong> — speak and see your words transcribed</li>
          <li><strong>Comfort Player</strong> — record voice messages and play photos/videos for bedside comfort</li>
          <li><strong>Offline support</strong> — core phrases and TTS work without internet</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>Contact Support</h2>
        <ul style={{ lineHeight: 1.8 }}>
          <li>Email: <a href="mailto:support@synalux.ai" style={{ color: '#6366f1' }}>support@synalux.ai</a></li>
          <li>GitHub: <a href="https://github.com/dcostenco/prism-aac/issues" style={{ color: '#6366f1' }}>Report an issue</a></li>
          <li>Website: <a href="https://synalux.ai" style={{ color: '#6366f1' }}>synalux.ai</a></li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, marginBottom: 12 }}>Privacy &amp; Accessibility</h2>
        <ul style={{ lineHeight: 1.8 }}>
          <li>No tracking, no ads, no data selling</li>
          <li>Voice recordings stay on your device</li>
          <li>GDPR compliant — EU data stays in EU (Frankfurt)</li>
          <li>Designed for motor accessibility — large buttons, switch access, head tracking</li>
          <li><a href="https://github.com/dcostenco/prism-aac/blob/main/PRIVACY.md" style={{ color: '#6366f1' }}>Privacy Policy</a></li>
          <li><a href="https://github.com/dcostenco/prism-aac/blob/main/TERMS.md" style={{ color: '#6366f1' }}>Terms of Service</a></li>
        </ul>
      </section>

      <footer style={{ borderTop: '1px solid #eee', paddingTop: 20, color: '#999', fontSize: 14 }}>
        © 2026 Dmitri Costenco / Synalux Health. All rights reserved.
      </footer>
    </main>
  );
}
