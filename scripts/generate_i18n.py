#!/usr/bin/env python3
"""
Auto-generate Prism AAC i18n landing pages and platform docs.
Triggered by GitHub Actions on README.md or docs/ changes.
"""
import os
import pathlib

REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
I18N_DIR = REPO_ROOT / "docs" / "i18n"
PLATFORMS_DIR = REPO_ROOT / "docs" / "platforms"

LANGS = {
    "es": {
        "name": "Español",
        "title": "Prism AAC — Comunicación Aumentativa y Alternativa",
        "tagline": "Comunicación construida para la vida real.",
        "why": "¿Por qué Prism AAC?",
        "why_desc": "La mayoría de las apps AAC te obligan a elegir: tableros con imágenes o escritura. Prism AAC mantiene ambos disponibles sin cambiar de pantalla. El teclado siempre está a un toque, las predicciones aprenden lo que realmente dices, y las categorías están organizadas alrededor de situaciones reales.",
        "features_title": "Características principales",
        "download": "Descargar e instalar",
        "back": "← Volver al README en inglés",
        "keyboard": "Teclado y predicción",
        "categories": "Categorías y frases",
        "voice": "Voz y habla",
        "accessibility": "Accesibilidad",
        "languages": "Idiomas",
        "tiers": "Planes de suscripción",
        "ipad_title": "Prism AAC para iPad",
        "ipad_desc": "Guía completa de instalación y uso en iPad. Compatible con iPadOS 16+, optimizado para todos los tamaños de iPad.",
        "desktop_title": "Prism AAC para Escritorio",
        "desktop_desc": "Ejecute Prism AAC en Windows, macOS o Linux como aplicación web progresiva o aplicación de escritorio Electron.",
        "web_title": "Prism AAC Web",
        "web_desc": "Acceda a Prism AAC desde cualquier navegador moderno. Sin instalación requerida.",
    },
    "fr": {
        "name": "Français",
        "title": "Prism AAC — Communication Augmentative et Alternative",
        "tagline": "Communication construite pour la vie réelle.",
        "why": "Pourquoi Prism AAC ?",
        "why_desc": "La plupart des applications CAA vous forcent à choisir : tableaux d'images ou clavier. Prism AAC garde les deux disponibles sans changer d'écran. Le clavier est toujours à portée, les prédictions apprennent ce que vous dites vraiment, et les catégories sont organisées autour de situations réelles.",
        "features_title": "Fonctionnalités principales",
        "download": "Télécharger et installer",
        "back": "← Retour au README en anglais",
        "keyboard": "Clavier et prédiction",
        "categories": "Catégories et phrases",
        "voice": "Voix et parole",
        "accessibility": "Accessibilité",
        "languages": "Langues",
        "tiers": "Abonnements",
        "ipad_title": "Prism AAC pour iPad",
        "ipad_desc": "Guide complet d'installation et d'utilisation sur iPad. Compatible iPadOS 16+, optimisé pour toutes les tailles d'iPad.",
        "desktop_title": "Prism AAC pour Bureau",
        "desktop_desc": "Exécutez Prism AAC sur Windows, macOS ou Linux en tant qu'application web progressive ou application Electron.",
        "web_title": "Prism AAC Web",
        "web_desc": "Accédez à Prism AAC depuis n'importe quel navigateur moderne. Aucune installation requise.",
    },
    "pt": {
        "name": "Português",
        "title": "Prism AAC — Comunicação Aumentativa e Alternativa",
        "tagline": "Comunicação construída para a vida real.",
        "why": "Por que Prism AAC?",
        "why_desc": "A maioria dos aplicativos de CAA força uma escolha: pranchas de imagens ou digitação. O Prism AAC mantém ambos disponíveis sem trocar de tela. O teclado está sempre a um toque, as previsões aprendem o que você realmente diz, e as categorias são organizadas em torno de situações reais.",
        "features_title": "Recursos principais",
        "download": "Baixar e instalar",
        "back": "← Voltar ao README em inglês",
        "keyboard": "Teclado e previsão",
        "categories": "Categorias e frases",
        "voice": "Voz e fala",
        "accessibility": "Acessibilidade",
        "languages": "Idiomas",
        "tiers": "Planos de assinatura",
        "ipad_title": "Prism AAC para iPad",
        "ipad_desc": "Guia completo de instalação e uso no iPad. Compatível com iPadOS 16+, otimizado para todos os tamanhos de iPad.",
        "desktop_title": "Prism AAC para Desktop",
        "desktop_desc": "Execute o Prism AAC no Windows, macOS ou Linux como aplicativo web progressivo ou aplicativo Electron.",
        "web_title": "Prism AAC Web",
        "web_desc": "Acesse o Prism AAC de qualquer navegador moderno. Sem instalação necessária.",
    },
    "ro": {
        "name": "Română",
        "title": "Prism AAC — Comunicare Augmentativă și Alternativă",
        "tagline": "Comunicare construită pentru viața reală.",
        "why": "De ce Prism AAC?",
        "why_desc": "Majoritatea aplicațiilor AAC te forțează să alegi: panouri cu imagini sau tastatură. Prism AAC le păstrează pe amândouă disponibile fără să schimbi ecranul. Tastatura este mereu la un atingere, predicțiile învață ce spui cu adevărat, iar categoriile sunt organizate în jurul situațiilor reale.",
        "features_title": "Funcționalități principale",
        "download": "Descarcă și instalează",
        "back": "← Înapoi la README în engleză",
        "keyboard": "Tastatură și predicție",
        "categories": "Categorii și fraze",
        "voice": "Voce și vorbire",
        "accessibility": "Accesibilitate",
        "languages": "Limbi",
        "tiers": "Planuri de abonament",
        "ipad_title": "Prism AAC pentru iPad",
        "ipad_desc": "Ghid complet de instalare și utilizare pe iPad. Compatibil cu iPadOS 16+, optimizat pentru toate dimensiunile de iPad.",
        "desktop_title": "Prism AAC pentru Desktop",
        "desktop_desc": "Rulați Prism AAC pe Windows, macOS sau Linux ca aplicație web progresivă sau aplicație Electron.",
        "web_title": "Prism AAC Web",
        "web_desc": "Accesați Prism AAC din orice browser modern. Nu necesită instalare.",
    },
    "uk": {
        "name": "Українська",
        "title": "Prism AAC — Аугментативна та альтернативна комунікація",
        "tagline": "Комунікація, створена для реального життя.",
        "why": "Чому Prism AAC?",
        "why_desc": "Більшість AAC-додатків змушують обирати: дошки з картинками або клавіатура. Prism AAC зберігає обидва варіанти без зміни екрану. Клавіатура завжди на відстані одного дотику, передбачення вчаться тому, що ви насправді говорите, а категорії побудовані навколо реальних ситуацій.",
        "features_title": "Основні функції",
        "download": "Завантажити та встановити",
        "back": "← Назад до README англійською",
        "keyboard": "Клавіатура та передбачення",
        "categories": "Категорії та фрази",
        "voice": "Голос та мовлення",
        "accessibility": "Доступність",
        "languages": "Мови",
        "tiers": "Плани підписки",
        "ipad_title": "Prism AAC для iPad",
        "ipad_desc": "Повний посібник з встановлення та використання на iPad. Сумісний з iPadOS 16+, оптимізований для всіх розмірів iPad.",
        "desktop_title": "Prism AAC для комп'ютера",
        "desktop_desc": "Запускайте Prism AAC на Windows, macOS або Linux як прогресивний веб-додаток або додаток Electron.",
        "web_title": "Prism AAC Веб",
        "web_desc": "Отримайте доступ до Prism AAC з будь-якого сучасного браузера. Встановлення не потрібне.",
    },
    "ru": {
        "name": "Русский",
        "title": "Prism AAC — Аугментативная и альтернативная коммуникация",
        "tagline": "Коммуникация, созданная для реальной жизни.",
        "why": "Почему Prism AAC?",
        "why_desc": "Большинство AAC-приложений заставляют выбирать: доски с картинками или клавиатура. Prism AAC сохраняет оба варианта без смены экрана. Клавиатура всегда на расстоянии одного касания, предсказания учатся тому, что вы действительно говорите, а категории построены вокруг реальных ситуаций.",
        "features_title": "Основные функции",
        "download": "Скачать и установить",
        "back": "← Назад к README на английском",
        "keyboard": "Клавиатура и предсказания",
        "categories": "Категории и фразы",
        "voice": "Голос и речь",
        "accessibility": "Доступность",
        "languages": "Языки",
        "tiers": "Планы подписки",
        "ipad_title": "Prism AAC для iPad",
        "ipad_desc": "Полное руководство по установке и использованию на iPad. Совместим с iPadOS 16+, оптимизирован для всех размеров iPad.",
        "desktop_title": "Prism AAC для компьютера",
        "desktop_desc": "Запускайте Prism AAC на Windows, macOS или Linux как прогрессивное веб-приложение или приложение Electron.",
        "web_title": "Prism AAC Веб",
        "web_desc": "Получите доступ к Prism AAC из любого современного браузера. Установка не требуется.",
    },
    "de": {
        "name": "Deutsch",
        "title": "Prism AAC — Unterstützte Kommunikation",
        "tagline": "Kommunikation für das echte Leben gebaut.",
        "why": "Warum Prism AAC?",
        "why_desc": "Die meisten AAC-Apps zwingen zur Wahl: Bildtafeln oder Tastatur. Prism AAC hält beides verfügbar ohne Bildschirmwechsel. Die Tastatur ist immer einen Tipp entfernt, Vorhersagen lernen was Sie wirklich sagen, und Kategorien sind um reale Situationen herum aufgebaut.",
        "features_title": "Hauptfunktionen",
        "download": "Herunterladen und installieren",
        "back": "← Zurück zum englischen README",
        "keyboard": "Tastatur und Vorhersage",
        "categories": "Kategorien und Phrasen",
        "voice": "Stimme und Sprache",
        "accessibility": "Barrierefreiheit",
        "languages": "Sprachen",
        "tiers": "Abonnement-Pläne",
        "ipad_title": "Prism AAC für iPad",
        "ipad_desc": "Vollständige Installations- und Nutzungsanleitung für iPad. Kompatibel mit iPadOS 16+, optimiert für alle iPad-Größen.",
        "desktop_title": "Prism AAC für Desktop",
        "desktop_desc": "Führen Sie Prism AAC auf Windows, macOS oder Linux als Progressive Web App oder Electron-Anwendung aus.",
        "web_title": "Prism AAC Web",
        "web_desc": "Greifen Sie auf Prism AAC von jedem modernen Browser aus zu. Keine Installation erforderlich.",
    },
    "ja": {
        "name": "日本語",
        "title": "Prism AAC — 拡大代替コミュニケーション",
        "tagline": "実生活のために作られたコミュニケーション。",
        "why": "なぜPrism AACなのか？",
        "why_desc": "ほとんどのAACアプリは選択を強います：絵カードかキーボードか。Prism AACは画面を切り替えることなく両方を利用可能にします。キーボードは常にワンタップで、予測はあなたが実際に言うことを学習し、カテゴリは実際の状況に基づいて構築されています。",
        "features_title": "主な機能",
        "download": "ダウンロードとインストール",
        "back": "← 英語のREADMEに戻る",
        "keyboard": "キーボードと予測",
        "categories": "カテゴリとフレーズ",
        "voice": "音声と発話",
        "accessibility": "アクセシビリティ",
        "languages": "言語",
        "tiers": "サブスクリプションプラン",
        "ipad_title": "iPad版 Prism AAC",
        "ipad_desc": "iPadでのインストールと使用の完全ガイド。iPadOS 16+対応、すべてのiPadサイズに最適化。",
        "desktop_title": "デスクトップ版 Prism AAC",
        "desktop_desc": "Windows、macOS、LinuxでPrism AACをプログレッシブウェブアプリまたはElectronアプリとして実行。",
        "web_title": "Prism AAC ウェブ版",
        "web_desc": "モダンブラウザからPrism AACにアクセス。インストール不要。",
    },
    "ko": {
        "name": "한국어",
        "title": "Prism AAC — 보완대체 의사소통",
        "tagline": "실생활을 위해 만들어진 의사소통.",
        "why": "왜 Prism AAC인가?",
        "why_desc": "대부분의 AAC 앱은 선택을 강요합니다: 그림판 또는 키보드. Prism AAC는 화면 전환 없이 둘 다 사용할 수 있습니다. 키보드는 항상 한 번의 탭으로 접근 가능하고, 예측은 실제로 말하는 것을 학습하며, 카테고리는 실제 상황을 중심으로 구성됩니다.",
        "features_title": "주요 기능",
        "download": "다운로드 및 설치",
        "back": "← 영어 README로 돌아가기",
        "keyboard": "키보드와 예측",
        "categories": "카테고리와 문구",
        "voice": "음성과 발화",
        "accessibility": "접근성",
        "languages": "언어",
        "tiers": "구독 플랜",
        "ipad_title": "iPad용 Prism AAC",
        "ipad_desc": "iPad에서의 설치 및 사용 완전 가이드. iPadOS 16+ 호환, 모든 iPad 크기에 최적화.",
        "desktop_title": "데스크톱용 Prism AAC",
        "desktop_desc": "Windows, macOS, Linux에서 프로그레시브 웹 앱 또는 Electron 앱으로 Prism AAC를 실행하세요.",
        "web_title": "Prism AAC 웹",
        "web_desc": "모든 최신 브라우저에서 Prism AAC에 접근하세요. 설치가 필요 없습니다.",
    },
    "zh": {
        "name": "中文",
        "title": "Prism AAC — 辅助替代沟通",
        "tagline": "为真实生活而构建的沟通工具。",
        "why": "为什么选择 Prism AAC？",
        "why_desc": "大多数AAC应用迫使你做出选择：图片板或键盘。Prism AAC让两者都可用，无需切换屏幕。键盘始终一触即达，预测学习你真正说的话，类别围绕真实场景构建。",
        "features_title": "主要功能",
        "download": "下载与安装",
        "back": "← 返回英文 README",
        "keyboard": "键盘与预测",
        "categories": "类别与短语",
        "voice": "语音与发声",
        "accessibility": "无障碍",
        "languages": "语言",
        "tiers": "订阅计划",
        "ipad_title": "iPad 版 Prism AAC",
        "ipad_desc": "iPad 安装和使用完整指南。兼容 iPadOS 16+，针对所有 iPad 尺寸优化。",
        "desktop_title": "桌面版 Prism AAC",
        "desktop_desc": "在 Windows、macOS 或 Linux 上以渐进式网页应用或 Electron 应用运行 Prism AAC。",
        "web_title": "Prism AAC 网页版",
        "web_desc": "从任何现代浏览器访问 Prism AAC。无需安装。",
    },
    "ar": {
        "name": "العربية",
        "title": "Prism AAC — التواصل المعزز والبديل",
        "tagline": "تواصل مبني للحياة الواقعية.",
        "why": "لماذا Prism AAC؟",
        "why_desc": "معظم تطبيقات AAC تجبرك على الاختيار: لوحات الصور أو لوحة المفاتيح. Prism AAC يبقي كلاهما متاحاً دون تبديل الشاشات. لوحة المفاتيح دائماً بلمسة واحدة، التنبؤات تتعلم ما تقوله فعلاً، والفئات مبنية حول مواقف حقيقية.",
        "features_title": "الميزات الرئيسية",
        "download": "تحميل وتثبيت",
        "back": "← العودة إلى README بالإنجليزية",
        "keyboard": "لوحة المفاتيح والتنبؤ",
        "categories": "الفئات والعبارات",
        "voice": "الصوت والنطق",
        "accessibility": "إمكانية الوصول",
        "languages": "اللغات",
        "tiers": "خطط الاشتراك",
        "ipad_title": "Prism AAC لأجهزة iPad",
        "ipad_desc": "دليل كامل للتثبيت والاستخدام على iPad. متوافق مع iPadOS 16+، محسّن لجميع أحجام iPad.",
        "desktop_title": "Prism AAC لسطح المكتب",
        "desktop_desc": "شغّل Prism AAC على Windows أو macOS أو Linux كتطبيق ويب تقدمي أو تطبيق Electron.",
        "web_title": "Prism AAC ويب",
        "web_desc": "الوصول إلى Prism AAC من أي متصفح حديث. لا يتطلب تثبيت.",
    },
}

ALL_CODES = list(LANGS.keys())

def lang_switcher():
    parts = ["[English](../../README.md)"]
    for code in ALL_CODES:
        parts.append(f"[{LANGS[code]['name']}](README_{code}.md)")
    return " | ".join(parts)

FEATURES_TABLE = """
| Feature | Description |
|---------|-------------|
| Adaptive Prediction | 5-slot prediction bar, learns from usage (bigram + frequency + recency) |
| Categories | Help/Needs, Quick Talk, Places/Plans, Food/Ordering, People/Social, School/Work |
| Ordering Flows | Multi-step restaurant ordering (Chipotle, General Restaurant) |
| Math Keyboard | Basic operations + advanced symbols (Standard+) |
| Azure Neural TTS | 12 languages, 9 emotional tones, SSML prosody control |
| Offline Mode | System TTS + local SQLite — works without internet |
| 12 Languages | EN, ES, FR, PT, RO, UK, RU, DE, JA, KO, ZH, AR (RTL) |
| Accessibility | 64dp touch targets, high-contrast mode, haptic feedback |
"""

TIERS_TABLE = """
| | Free | Standard | Advanced | Enterprise |
|---|---|---|---|---|
| Voice | System TTS | Azure Neural | Azure Neural + custom | Custom/cloned |
| Tones | — | 5 | All 9 | All + custom |
| Custom categories | — | 20 | Unlimited | Unlimited |
| Custom phrases | 50 | 500 | Unlimited | Unlimited |
| Languages | 1 | 3 | All 12 | All 12 + custom |
| Cloud backup | — | Yes | Yes | Yes + HIPAA |
"""

PLATFORMS_TABLE = """
| Platform | Format | Status |
|----------|--------|--------|
| iPad | Native (iPadOS 16+) | Beta |
| Android | APK / Play Store | Planned |
| Windows | `.exe` (Electron) | Planned |
| macOS | `.dmg` / PWA | Planned |
| Linux | `.AppImage` | Planned |
| Web | Browser PWA | Available |
"""


def generate_main_readmes():
    """Generate translated main README landing pages."""
    I18N_DIR.mkdir(parents=True, exist_ok=True)
    switcher = lang_switcher()

    for code, L in LANGS.items():
        rtl = 'dir="rtl"' if code == "ar" else ""
        content = f"""<!-- Auto-generated by scripts/generate_i18n.py — do not edit manually -->
# {L['title']}

{f'<div {rtl}>' if rtl else ''}

**{L['tagline']}**

{switcher}

---

## {L['why']}

{L['why_desc']}

## {L['features_title']}

{FEATURES_TABLE}

## {L['download']}

{PLATFORMS_TABLE}

### iPad

```bash
git clone https://github.com/dcostenco/prism-aac.git
cd prism-aac && npm install
npx expo run:ios
```

### Android

```bash
npx eas build --platform android --profile preview
```

### Web / Desktop

```bash
npx expo start --web
# Open http://localhost:8081 — install as PWA from browser menu
```

## {L['tiers']}

{TIERS_TABLE}

---

[{L['back']}](../../README.md)

{'</div>' if rtl else ''}
"""
        path = I18N_DIR / f"README_{code}.md"
        path.write_text(content, encoding="utf-8")
        print(f"  Generated: docs/i18n/README_{code}.md ({L['name']})")


def generate_platform_docs():
    """Generate platform-specific docs for iPad, Desktop, Web — in all languages."""
    PLATFORMS_DIR.mkdir(parents=True, exist_ok=True)

    for code, L in [("en", {
        "ipad_title": "Prism AAC for iPad",
        "ipad_desc": "Complete installation and usage guide for iPad. Compatible with iPadOS 16+, optimized for all iPad sizes.",
        "desktop_title": "Prism AAC for Desktop",
        "desktop_desc": "Run Prism AAC on Windows, macOS, or Linux as a Progressive Web App or Electron application.",
        "web_title": "Prism AAC Web",
        "web_desc": "Access Prism AAC from any modern browser. No installation required.",
        "back": "← Back to English README",
    })] + list(LANGS.items()):

        # iPad doc
        ipad = f"""<!-- Auto-generated by scripts/generate_i18n.py -->
# {L['ipad_title']}

{L['ipad_desc']}

## Requirements

- iPadOS 16.0 or later
- iPad mini (5th gen+), iPad Air (3rd gen+), iPad Pro (any), iPad (8th gen+)
- ~50 MB storage

## Install

### Option 1: TestFlight (Beta)

```
Coming soon — TestFlight link will be published here
```

### Option 2: Build from Source

```bash
# Prerequisites
xcode-select --install
sudo gem install cocoapods

# Build
git clone https://github.com/dcostenco/prism-aac.git
cd prism-aac
npm install
npx expo run:ios --device
```

## iPad-Specific Features

- **Split View & Slide Over** — use Prism AAC alongside other apps
- **Apple Pencil** — not required, all interactions are touch-based
- **External keyboard** — full support, predictions update as you type
- **Landscape & Portrait** — adapts layout to orientation
- **Large display optimization** — takes advantage of iPad Pro screen real estate

## Accessibility on iPad

- VoiceOver compatible
- Dynamic Type support
- Switch Control compatible
- 64dp minimum touch targets
- High-contrast mode

---

[{L['back']}](../../README.md)
"""
        (PLATFORMS_DIR / f"IPAD_{code}.md").write_text(ipad, encoding="utf-8")

        # Desktop doc
        desktop = f"""<!-- Auto-generated by scripts/generate_i18n.py -->
# {L['desktop_title']}

{L['desktop_desc']}

## Platforms

| OS | Method | Status |
|----|--------|--------|
| Windows 10/11 | Electron `.exe` | Planned |
| macOS 12+ | Electron `.dmg` / PWA | Planned |
| Linux (Ubuntu/Fedora) | `.AppImage` | Planned |

## Install as PWA (Available Now)

### Windows / macOS / Linux

```bash
git clone https://github.com/dcostenco/prism-aac.git
cd prism-aac
npm install
npx expo start --web
```

1. Open **http://localhost:8081** in Chrome or Edge
2. Click the install icon in the address bar (or Menu → "Install Prism AAC")
3. Prism AAC now runs as a standalone desktop window

### Production Build

```bash
npx expo export --platform web
# Deploy the dist/ folder to any static host
```

## Desktop-Specific Features

- **Keyboard shortcuts** — full keyboard navigation
- **Window resizing** — responsive layout adapts from narrow to wide
- **System TTS** — uses OS speech synthesis (no internet required)
- **Local storage** — SQLite database stored in browser IndexedDB
- **Offline capable** — PWA works without internet after first load

## Electron Packages (Coming Soon)

Pre-built desktop installers will be available on [GitHub Releases](https://github.com/dcostenco/prism-aac/releases):

- `PrismAAC-Setup.exe` — Windows installer
- `PrismAAC.dmg` — macOS disk image
- `PrismAAC.AppImage` — Linux portable

---

[{L['back']}](../../README.md)
"""
        (PLATFORMS_DIR / f"DESKTOP_{code}.md").write_text(desktop, encoding="utf-8")

        # Web doc
        web = f"""<!-- Auto-generated by scripts/generate_i18n.py -->
# {L['web_title']}

{L['web_desc']}

## Supported Browsers

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | Full support |
| Edge | 90+ | Full support |
| Safari | 16+ | Full support |
| Firefox | 100+ | Full support (no PWA install) |

## Quick Start

### Hosted Version

```
Coming soon — https://synalux.ai/prism-aac
```

### Self-Hosted

```bash
git clone https://github.com/dcostenco/prism-aac.git
cd prism-aac
npm install
npx expo start --web
# Open http://localhost:8081
```

### Deploy to Production

```bash
npx expo export --platform web
# Upload dist/ to Vercel, Netlify, Cloudflare Pages, or any static host
```

## Web-Specific Notes

- **Speech synthesis** — uses the Web Speech API (browser-provided voices)
- **Azure Neural TTS** — available on Standard+ tiers (requires internet)
- **Data storage** — SQLite via WASM, stored in browser origin storage
- **Offline mode** — PWA service worker caches app shell after first visit
- **Install as app** — Chrome/Edge: address bar install button for desktop-app experience

## Limitations vs Native

| Feature | Web | Native (iPad/Android) |
|---------|-----|----------------------|
| TTS voices | Browser voices only (free tier) | OS neural voices |
| Haptic feedback | Not available | Full support |
| Push notifications | Limited | Full support |
| Storage | Browser quota (~50MB) | Device storage |
| Performance | Good | Excellent |

---

[{L['back']}](../../README.md)
"""
        (PLATFORMS_DIR / f"WEB_{code}.md").write_text(web, encoding="utf-8")

    print(f"  Generated: {3 * (len(LANGS) + 1)} platform docs (iPad/Desktop/Web x {len(LANGS) + 1} languages)")


def main():
    print("Generating Prism AAC i18n files...")
    generate_main_readmes()
    generate_platform_docs()
    print("Done.")


if __name__ == "__main__":
    main()
