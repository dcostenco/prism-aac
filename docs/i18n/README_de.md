<!-- Auto-generated from README.md by scripts/generate_i18n.py — do not edit manually -->
# Prism AAC

**Helfen Sie nicht-sprechenden Kindern, sich auszudrücken.**

App für Unterstützte Kommunikation (UK) für Kinder mit motorischen Einschränkungen und komplexen Kommunikationsbedürfnissen. Tippen Sie auf Bilder, bilden Sie Sätze, lassen Sie sie laut vorlesen – in 23 Sprachen. Funktioniert auf jedem Tablet, Laptop, iPhone, iPad und jeder Apple Watch.

Teil der [Synalux Plattform](https://synalux.ai).

🌐 [English](../../README.md) · [Español](README_es.md) · [Français](README_fr.md) · [Português](README_pt.md) · [Română](README_ro.md) · [Українська](README_uk.md) · [Русский](README_ru.md) · **Deutsch** · [日本語](README_ja.md) · [한국어](README_ko.md) · [中文](README_zh.md) · [العربية](README_ar.md)

<p align="center">
  <a href="https://apps.apple.com/app/id6764692277"><img src="https://img.shields.io/badge/App_Store-Download-0D96F6?style=for-the-badge&logo=apple&logoColor=white" alt="App Store"></a>
  <a href="https://synalux.ai/prism-aac"><img src="https://img.shields.io/badge/Try_It-Free-43e97b?style=for-the-badge" alt="Kostenlos testen"></a>
  <a href="https://synalux.ai/pricing"><img src="https://img.shields.io/badge/Plans-Free_+_Paid-764ba2?style=for-the-badge" alt="Preise"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue?style=for-the-badge" alt="AGPL-3.0"></a>
  <a href="PRIVACY.md"><img src="https://img.shields.io/badge/Privacy-Policy-lightgrey?style=for-the-badge" alt="Datenschutz"></a>
  <a href="TERMS.md"><img src="https://img.shields.io/badge/Terms-of_Service-lightgrey?style=for-the-badge" alt="Nutzungsbedingungen"></a>
</p>

![Prism AAC Hauptbildschirm — Symbolleiste, Zeitplan-Banner, Tipp-hier-Leiste, Vorhersagekacheln und QWERTZ-Tastatur](../../docs/screenshots/app-hero.png)

### Native Apps

<p align="center">
  <img src="../../docs/screenshots/ios-iphone.png" alt="PrismAAC auf iPhone" width="220" />
  <img src="../../docs/screenshots/ios-ipad.png" alt="PrismAAC auf iPad" width="360" />
  <img src="../../docs/screenshots/watch-ultra.png" alt="PrismAAC auf Apple Watch Ultra" width="120" />
</p>

| Plattform | Status | KI auf dem Gerät | Hinweise |
|----------|--------|-------------|-------|
| **Web** (PWA) | Produktion | Lädt automatisch das beste lokale Modell herunter | Jeder Browser, installierbar |
| **iPad Pro 16GB** | Produktion | KI auf dem Gerät (14B) | Schnell, privat, automatisch nach RAM ausgewählt |
| **iPhone / iPad 8GB** | Produktion | KI auf dem Gerät (8B → 1.7B Fallback) | Passt sich automatisch an das Gerät an |
| **iPhone / iPad <8GB** | Produktion | KI auf dem Gerät (1.7B) | Passt immer, 1,1 GB |
| **Apple Watch** | Produktion | Offline-Phrasenwörterbuch (1.261 × 20 Sprachen) | Eigenständig — Piktogramme, TTS, Notfall |
| **Chrome Extension** | Produktion | — | Lese-Assistent in jedem Textfeld |
| **WLAN zu Mac** | Produktion | 14B/32B über Ollama | Einstellungen → Lokale KI → Mac-IP eingeben |

---

## App Store Vorschau-Video

30-sekündiges Video, das alle wichtigen Funktionen mit Inworld TTS-Narration zeigt:

https://github.com/dcostenco/synalux-docs/releases/download/v1.0-module-videos/prism_aac_preview_v5.mp4

| Szene | Funktion | Screenshot |
|---|---|---|
| **Startseite** — Phrasen antippen | Piktogramm-Tafel mit 22 Kategorien, Sprechen-Taste | <img src="../../docs/screenshots/appstore/ipad_home.png" width="200"> |
| **Kategorien** | Schnelle Phrasen für Hilfe, Essen, Orte, Gefühle | <img src="../../docs/screenshots/appstore/ipad_categories.png" width="200"> |
| **KI-Chat** | Nachrichten verfassen, Gespräche üben | <img src="../../docs/screenshots/appstore/ipad_ai-chat.png" width="200"> |
| **Notfall-Alarm** | Ein-Tipp-Anruf für Betreuer/Pflegepersonal | <img src="../../docs/screenshots/appstore/video/frame_03.png" width="200"> |
| **Zeitplan** | Visuelle Tagesabläufe — Morgen, Schule, Mittagessen, Schlafenszeit | <img src="../../docs/screenshots/appstore/ipad_schedule.png" width="200"> |
| **Spiele** | Blasen platzen lassen, Farbenjagd, Passendes finden, Ja/Nein, Beenden Sie es | <img src="../../docs/screenshots/appstore/ipad_games.png" width="200"> |
| **Mathematik & Schule** | Adaptive Mathematik mit Hinweis, Prüfen, Lösen + Ziffernblock | <img src="../../docs/screenshots/appstore/video/frame_06.png" width="200"> |
| **Kopf- & Blickverfolgung** | Kamerabasierter Verweil-Cursor, Blicksteuerung, Kalibrierung | <img src="../../docs/screenshots/appstore/video/frame_07.png" width="200"> |
| **12 Sprachen** | Englisch, Spanisch, Französisch, Russisch, Japanisch, Koreanisch, Chinesisch, Arabisch & mehr | <img src="../../docs/screenshots/appstore/video/frame_08.png" width="200"> |

---

## Auf einen Blick

| Modul | Was es tut | Vorschau |
|---|---|---|
| 📂 **Kategorien** | PECS-ähnliche Bildkacheln für Nicht-Leser | <img src="../../docs/screenshots/panel-categories.png" width="120"> |
| ⌨️ **Tippen & Sprechen** | Tastatur + Wortvorhersage + neuronale Stimme | <img src="../../docs/screenshots/app-hero.png" width="120"> |
| ✨ **KI-Chat** | KI-Assistent auf dem Gerät + in der Cloud, abgestimmt auf UK-Nutzer | <img src="../../docs/screenshots/panel-ai-chat.png" width="120"> |
| 💬 **UK-Chat** | Eingehende Nachrichten von Betreuern + Kontakten | <img src="../../docs/screenshots/panel-aac-chat.png" width="120"> |
| 🧮 **Mathematik + Fächer** | Zellraster-Leinwand mit domänenspezifischem Tutor | <img src="../../docs/screenshots/math-canvas-typed.png" width="120"> |
| 🗓 **Zeitplan** | Visuelle 'Zuerst-Dann'-Routinen | <img src="../../docs/screenshots/panel-schedule.png" width="120"> |
| 🎮 **Spiele** | 12 therapeutische UK-Spiele | <img src="../../docs/screenshots/panel-games.png" width="120"> |
| 🏪 **Marktplatz** | Stimmenpakete, Vokabelpakete, Spielepakete | <img src="../../docs/screenshots/panel-marketplace.png" width="120"> |
| 🎧 **Komfort-Player** | Medienplayer für Patienten am Krankenbett | <img src="../../docs/screenshots/panel-comfort-player.png" width="120"> |
| 🛏 **Bettmodus** | Vollbild-KI-Chat für die Nutzung im Ständer / im Liegen | <img src="../../e2e/_screenshots/bedside-overlay-open.png" width="120"> |
| 👋 **Freihändig** | Kopf- + Handgestenerkennung | <img src="../../docs/screenshots/panel-settings-input-modes.png" width="120"> |
| ⚙️ **Einstellungen** | 23 Sprachen, motorische Anpassungen, Tarifstufe | <img src="../../docs/screenshots/panel-settings.png" width="120"> |

---

## Kostenlose Read & Write Alternative

PrismAAC bietet jede Lese-Assistent-Funktion, für die die meisten UK-Nutzer Read & Write kaufen – kostenlos, im Browser, ohne dass für die Web-Version ein Konto erforderlich ist. Siehe [Tippen & Sprechen](#%EF%B8%8F-tippen--sprechen) für Satzende-Sprechen + Wort-Hervorhebung, [PDF-Reader](#-pdf-reader) und [Screenshot-Reader (OCR)](#-screenshot-reader-ocr) für Dokumente und die [Chrome-Erweiterung](#-chrome-extension--same-reading-assistant-features-in-any-text-field) für die App-übergreifende Abdeckung in Gmail / Docs / Word Online / überall sonst.

## Wie PrismAAC im Vergleich abschneidet

| | PrismAAC | TouchChat | Proloquo2Go | LAMP Words | TD Snap | CoughDrop | Snap Core First | Grid 3 | Tobii Dynavox |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Sprachpfad auf dem Gerät + HIPAA-sicher** | ✅ | ❌ | ❌ | ❌ | teilweise | teilweise | ❌ | ❌ | teilweise |
| **Phrasen-Ranking pro Nutzer** (passt sich jedem Kind an) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Korrekturen von Betreuern **werden automatisch zu Trainingsdaten** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Domänenspezifischer KI-Tutor** (Mathematik + 10 weitere Fächer) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Zellraster-Mathematik-Leinwand** (kein LaTeX, kein Whiteboard) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Gebiets- + regionsspezifische Historie** (über 280 Regionen) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Freihändiger** Kopf- + Handgestenmodus | ✅ | teilweise | teilweise | ❌ | ✅ | teilweise | teilweise | ✅ | ✅ |
| **Freihändiger KI-Chat** (Sprachschleife + Aktivierungswort + Bettmodus-Overlay) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Integrierte therapeutische **UK-Spiele** | ✅ (12) | ❌ | ❌ | ❌ | ❌ | teilweise | teilweise | ❌ | ❌ |
| **Open Source** (AGPL-3.0) | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Kostenlose Stufe** für lebensrettenden Zugang | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Marktplatz** für Stimmenpakete | ✅ | ❌ | teilweise | ❌ | teilweise | ❌ | ❌ | teilweise | teilweise |
| **Mehrsprachig** (23) | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Betreuer-Notizen**, die zwischen Zuhause / Schule / Klinik mitreisen | ✅ | ❌ | ❌ | ❌ | teilweise | teilweise | teilweise | ❌ | teilweise |
| **Apple Watch** Standalone-Modus | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Chrome-Erweiterung** als Lese-Assistent | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

> Der Vergleich spiegelt öffentlich verfügbare Produktinformationen vom Mai 2026 wider. PrismAAC wird aktiv weiterentwickelt; Wettbewerber können im Laufe der Zeit Funktionen hinzufügen. Pull Requests sind willkommen, um dies aktuell zu halten — siehe `CONTRIBUTING.md`.
>
> Grid 3 und Tobii Dynavox verfügen über starke Hardware-Integrationen für Blicksteuerung + Tasterscanning, die oben nicht aufgeführt sind (hardwareabhängig, spezialisierte Klinik-Setups).

---

## iOS & Apple Watch

### iPhone / iPad

Native Swift-App, die die Web-Benutzeroberfläche in WKWebView + KI auf dem Gerät über llama.cpp Metal umschließt. Wählt automatisch das beste Modell nach Geräte-RAM aus:

| Gerät | RAM | Modell | Download |
|---|---|---|---|
| iPad Pro M1/M2/M4 | 16 GB | 14B Q4_K_M | 8,4 GB von HF CDN |
| iPhone 15/16 Pro, iPad Air | 8 GB | 8B Q4_K_M → 1.7B (OOM Fallback) | 4,7 GB / 1,1 GB |
| iPhone 12-14, ältere iPads | <8 GB | 1.7B Q4_K_M | 1,1 GB |

Dreischichtige Sicherheit: synchroner Krisenfilter → KI auf dem Gerät → Cloud-Fallback. Speicherbewusste Steuerung degradiert elegant: volle KI → Cloud-KI → nur Kernfunktionen → Notfallmodus.

- Sicherer Bereich für Dynamic Island / Notch
- WCSession-Brücke für Apple Watch Notfallversand
- Keychain-gestützte Authentifizierungs-Tokens
- OOM-Fallback: Wenn das größere Modell nicht passt, wird automatisch das nächstkleinere geladen

**Einstellungen → 🤖 Lokale KI-Modelle** — Prism-Modelle herunterladen und verwalten:
- Erkennt Ollama automatisch unter `localhost:11434`
- WLAN-Verbindungen: iPad/iPhone → Mac Ollama (14B/32B mit voller Genauigkeit)
- Modell-Download mit Live-Fortschrittsbalken
- Modelle: `:1b7` (1,1 GB) · `:8b` (4,7 GB) · `:14b` (8,4 GB) · `:32b` (16 GB)

### Apple Watch (eigenständig)

Funktioniert ohne iPhone — eigenständig mit Offline-Phrasenwörterbuch.

<p align="center">
  <img src="../../docs/screenshots/watch-series.png" alt="Watch Series 11" width="140" />
  <img src="../../docs/screenshots/watch-ultra.png" alt="Watch Ultra 3" width="140" />
</p>

- **Offline-Übersetzung:** 1.261 Phrasen × 20 Sprachen gebündelt (411 KB JSON) — sofortige Suche, 100% genau, kein Netzwerk
- 2-spaltiges Piktogramm-Raster mit ARASAAC-Bildern
- KI-Chat mit Diktat + Tastatureingabe (Cloud bei Online-Verbindung, Phrasenwörterbuch bei Offline-Verbindung)
- Notfallsystem: Countdown → WCSession → Mobilfunk-Fallback → TTS
- Übersetzung mit TTS-Ausgabe (zuerst Offline-Wörterbuch, dann Cloud-Fallback)
- Posteingang: Nachrichten von Betreuern empfangen und beantworten
- Zertifikat-Pinning (SPKI SHA-256) beim Notfallversand
- NFKC + 23-Token-Injektionsbereinigung auf allen KI-Pfaden

---

## Module

### 📂 Kategorien
PECS-ähnliche Bildkacheln. Eine Kategorie antippen, eine Kachel antippen, das Wort hören, zusehen, wie es in der Nachrichtenleiste landet. Funktioniert gleichermaßen für Nicht-Leser, Vorleser und aufstrebende Kommunikatoren. Kachelsätze und -reihenfolge personalisieren sich im Laufe der Zeit durch "Spreading Activation" — die Kacheln, die Ihr Kind am häufigsten antippt, steigen auf; die monatelang ungenutzten verblassen.

**Surround-Layout** — Kategorien erscheinen in einer scrollbaren linken Spalte neben der Tastatur, sodass der UK-Nutzer Bildkacheln antippen UND gleichzeitig tippen kann, ohne den Modus wechseln zu müssen. Die Vorhersageleiste bleibt sichtbar; beide Eingaben sind immer zugänglich.

![Kategorien im Surround-Modus — scrollbare Kategoriekarten links, vollständige Tastatur rechts](../../docs/screenshots/categories-surround-v2.png)

<details>
<summary><strong>Funktionen + technische Details</strong></summary>

- 22 Standardkategorien: Personen, Essen, Gefühle, Körper, Kleidung, Tiere, Orte usw.
- Betreuer können Kacheln pro Kind hinzufügen / entfernen / neu anordnen
- Jede Kachel trägt einen `textKey` für i18n — das Wechseln der App-Sprache beschriftet jede Kachel mit einem Tipp neu
- Kachel-Piktogramme stammen von ARASAAC + einem kuratierten Set; Sprachklonung ermöglicht es Ihnen, die Stimme der Kachel an die Geschwister oder Eltern des Kindes anzupassen (kostenpflichtige Stufe)
- N-Gramm-Lernen pro Nutzer: Ein Kind, das dreimal „Ich will essen“ antippt, sieht „essen“ in der nächsten Sitzung nach „will“ aufsteigen
- HRR holographischer Speicher: kontextuelle Vorhersagen ohne Suche in ~0,2 ms über Rust WASM — +27% Top-1 Genauigkeit bei zentralen UK-Phrasen

**Render-Pfad:** `components/CategoryPanel.tsx` → `useCategoryStore` → Kacheln, die aus `constants/phrases.ts` (System) + Supabase nutzerspezifischen Überschreibungen (kostenpflichtig) gezeichnet werden. Kachel-Tipps rufen `messageStore.appendText(phrase)` auf und leiten sie über `aacSpeak()` für TTS weiter.
</details>

---

### ⌨️ Tippen & Sprechen
Bildschirmtastatur mit **Wortvorhersage**, **KI-Autovervollständigung** und einer **Sprechen**-Taste, die die Nachrichtenleiste mit einer natürlichen neuronalen Stimme vorliest. Das Tippen trainiert die Vorhersage-Engine: Wörter, die Ihr Kind am häufigsten tippt, erscheinen in der nächsten Sitzung früher.

![Prism AAC Tastatur mit getipptem "hello", Vorhersagekacheln und Sprechen-Taste](../../docs/screenshots/keyboard-typing.png)

**Lese-Assistent-Funktionen (Read & Write Parität)** — für Nutzer mit Lese- / Gedächtnis- / kognitiven Bedürfnissen:

- **Wort für Wort sprechen** — jedes Wort wird über TTS wiedergegeben, sobald Sie die Leertaste antippen, sodass Sie hören, was Sie getippt haben, ohne auf den vollständigen Satz warten zu müssen.
- **Satz bei `.?!` sprechen** — das Beenden eines Satzes mit einem Punkt, Fragezeichen oder Ausrufezeichen liest den gesamten Satz zurück, damit Sie nicht den Überblick über das Geschriebene verlieren (die Lücke, die NVDA für sehende Nutzer mit kognitiven Behinderungen disqualifiziert). Umschalten über Einstellungen → `speakOnSentenceEnd` (standardmäßig aktiviert).
- **Wort-für-Wort-Hervorhebung während des Sprechens** — jedes gesprochene Wort leuchtet mit einem gelben Hintergrund auf, während TTS es liest. Sehende Nutzer mit Leseschwierigkeiten können visuell folgen; die Hervorhebung verfolgt den Ton, ohne ein spezielles Hardwaregerät zu benötigen.

<details>
<summary><strong>Funktionen + technische Details</strong></summary>

- 5 Vorhersage-Slots über der QWERTZ-Tastatur, bei jedem Tastendruck aktualisiert
- KI-Vervollständigung („hw“ → „how“, „togoso“ → „to go so“) über Synalux `text/correct` (Gemini 2.5 Flash-Lite, ~752 ms im Durchschnitt, 4,3-mal günstiger als 2.5 Flash)
- Sprachübergreifende Sperre: RO `eu` gelangt nicht in die EN-Leiste, selbst wenn beide Korpora geladen sind (sprachenübergreifender Frequenzvergleich)
- „Sprechen“ liest mit automatischer Tonanpassung (deklarativ / interrogativ / exklamatorisch aus der Interpunktion abgeleitet)
- Sprachstufe 1: Inworld TTS-2 (natürlich/neuronal, alle 23 App-Sprachen); Stufe 2: OS Web Speech (offline, gerätenativ); Stufe 3: WASM espeak-ng (letzter Ausweg)
- Die Wort-Hervorhebung ist zeitlich geschätzt (~60 ms/Zeichen bei Rate=0,5, skaliert mit dem Rate-Schieberegler) — funktioniert über jede TTS-Stufe hinweg ohne Backend-Änderungen; präzise Synchronisation über Azure `wordBoundary` ist eine zukünftige Pro-Funktion.
- 1,5 MB SQLite N-Gramm-Korpus pro Sprache; Unigramme + Bigramme + Trigramme; bei Sprachwechsel lazy-geladen
- **HRR kontextueller Speicher** — holographische Abfrage ohne Suche (229 KB Rust WASM), die aus jeder gesprochenen Phrase lernt. Kodiert Bigramme + Trigramme in einen holographischen Vektor; Abfragen in ~0,2 ms bei jedem Tastendruck. Additive Schicht — verstärkt die ersten 2 Vorhersagekacheln mit kontextuellen Übereinstimmungen, ohne Korpusvorhersagen zu entfernen.

**HRR Vorhersage-Benchmark** (54 Unit-Tests + 10-Szenario-Präzisionssuite):

| Szenario | Baseline Top-1 | HRR+ Top-1 | Steigerung | Baseline MRR | HRR+ MRR | MRR Steigerung |
|----------|---------------|------------|------|-------------|---------|----------|
| Zentrale UK-Phrasen (1x) | 36,7% | 46,7% | **+27,3%** | 0,634 | 0,672 | +6,0% |
| Zentrale UK-Phrasen (5x täglich) | 36,7% | 46,7% | **+27,3%** | 0,634 | 0,672 | +6,0% |
| Persönlicher Wortschatz | 70,4% | 81,5% | **+15,8%** | 0,809 | 0,883 | +9,2% |
| Gemischt (alle Phrasen) | 47,2% | 56,9% | **+20,6%** | 0,669 | 0,707 | +5,7% |
| Sitzungsübergreifender Abruf | 80,0% | 80,0% | +0,0% | 0,900 | 0,900 | +0,0% |
| Mehrdeutige Präfixe | 66,7% | 66,7% | +0,0% | 0,738 | 0,738 | +0,0% |

Top-1 = korrektes Wort ist Kachel #1. Top-5 = korrektes Wort in einer beliebigen Kachel. MRR = Mean Reciprocal Rank (höher = korrektes Wort erscheint früher). HRR reduziert die Top-5-Genauigkeit in keinem Szenario — keine Regressionen. Größte Gewinne beim persönlichen Wortschatz (+9,2% MRR) und bei zentralen UK-Phrasen (+27,3% Top-1).

**Render-Pfad:** `components/Keyboard.tsx` → `messageStore.appendChar` → `predictionStore.updatePredictions(text, lang)` → `engine/predictionEngine.ts` (Aktualität × Häufigkeit × N-Gramm-Boost) + optionales `services/textCorrectService.ts` KI-Overlay + `services/hrrContext.ts` HRR Bigramm/Trigramm-Abfrage. Hervorhebung: `services/aacSpeak.ts` sendet `tts-highlight-start`-Ereignisse an den `ttsHighlightBus`; `components/MessageBar.tsx` abonniert und übergibt `activeWordIndex` an `ColoredText`.
</details>

---

### ✨ KI-Chat
KI-Assistent auf dem Gerät + in der Cloud, abgestimmt auf die Stimme des UK-Nutzers. Gestreamte Antworten, jede Zeile kann per Tipp in die Nachrichtenleiste eingefügt werden, sodass die Urheberschaft beim Kind bleibt. Die kostenlose Stufe läuft über Gemini 2.5 Flash; kostenpflichtige Stufen leiten zu Claude Sonnet 4 mit der prism-coder Flotte für kurze Anfragen.

**Sauberer KI-Modus** — die Wortvorhersageleiste blendet sich automatisch aus, wenn der KI-Chat geöffnet ist (Vorhersagen sind beim Verfassen einer Frage irrelevant), wodurch der Fokus auf die KI-Antwort und die Senden-Taste gelegt wird.

**Freihändiger KI-Chat** — aktivieren Sie die 🔁-Taste im Chat-Header, um eine kontinuierliche Sprachschleife zu starten: Das Mikrofon öffnet sich automatisch nach jeder KI-Antwort, sodass das Kind ein vollständiges Gespräch führen kann, ohne den Bildschirm zu berühren. Eine Statusleiste unter dem Chat-Header bestätigt, dass der Modus aktiv ist.

**Übersetzungsmodus** — wenn die App-Sprache und die Ausgabesprache unterschiedlich sind (z.B. Eingabe auf Portugiesisch, Ausgabe auf Englisch), wird jeder KI-Austausch automatisch über den Übersetzungspfad mit aktiviertem Streaming geleitet, sodass es keinen Geschwindigkeitsnachteil gegenüber dem monolingualen Modus gibt.

![KI-Chat-Panel — Vorhersageleiste im KI-Modus ausgeblendet, vollständige Tastatur unten zugänglich](../../docs/screenshots/panel-ai-chat-v2.png)

<details>
<summary><strong>Funktionen + technische Details</strong></summary>

- Inline-Panel über der Tastatur angedockt — niemals ein Modal, das die Nachrichtenleiste verdeckt
- Spracheingabe über Web Speech API; Mikrofon-Taste zeigt Live-Zwischentranskript an
- Jede KI-Zeile antippen, um sie in die Nachrichtenleiste zu kopieren (bewahrt die Urheberschaft — Valencia et al., CHI 2023)
- **Freihändige Schleife** — 🔁 Header-Taste; startet das Mikrofon 1 Sekunde nach Abschluss jeder KI-Antwort automatisch neu; `aria-pressed` + grüner Hintergrund bestätigen den Status; Statusleiste unter dem Header, während aktiv
- **„Hey Prism“ Aktivierungswort** — verfügbar im Bettmodus-Overlay; kontinuierliche `SpeechRecognition`-Sitzung erkennt die Phrase und aktiviert das Mikrofon; nicht verfügbar, wenn die native iOS-Brücke die Audiositzung besitzt
- 15s harter Timeout clientseitig + Wiederholen-Taste (damit das Panel nicht bei „Denke nach…“ hängen bleibt, wenn das Netzwerk ausfällt)
- 401 / Netzwerk / Timeout / andere → benutzerfreundliche Fehlerzuordnung; zeigt niemals „Sitzung abgelaufen“ roh an
- Lokaler Ollama-Fallback (`prism-coder:1b7`) bei Offline-Verbindung; Mixed-Content wird in der Praxis vom `synalux.ai`-Browser-Ursprung blockiert, sodass der benutzerfreundliche Fehler ausgelöst wird

**Render-Pfad:** `components/AIChatPanel.tsx` → `services/aiService.askAI()` (oder `translateAI()` im Übersetzungsmodus) → SSE-Stream von Synalux `/api/v1/chat` mit `credentials: 'include'`. CORS erlaubt `synalux.ai` + localhost Entwicklungsursprünge.
</details>

---

### 🛏 Bettmodus

> **Kritisches Barrierefreiheitsmerkmal.** Der Bettmodus existiert, weil einige Nutzer keine zuverlässige Möglichkeit haben, zu sprechen, zu tippen oder einen Bildschirm zu berühren. Das Design muss zuerst für den schwierigsten Fall funktionieren: einen Patienten, der in einem Intensivbett liegt, die Arme an den Seiten, beatmet, unfähig, Geräusche zu erzeugen — und nur durch Blicksteuerung oder einen einzelnen Hardwareschalter, der zwischen zwei Fingern gehalten wird, kommuniziert.

Vollbild-KI-Kommunikations-Overlay, optimiert für Nutzer, die den Bildschirm nicht erreichen oder zuverlässig sprechen können. Jedes Tippziel ist überdimensioniert. Sprache ist einer von mehreren Eingabepfaden — nicht der einzige. Die Benutzeroberfläche ist vollständig über unterstützende Technologien bedienbar: Tasterscanning, Blicksteuerung, iOS Sprachsteuerung, Kopfverfolgung oder eine Bildschirmtastatur, die mit einem einzigen Schalter navigiert wird.

Inspiriert durch direktes Feedback aus der UK-Community (r/AssistiveTechnology, Mai 2025) von Nutzern, die aus Krankenhausbetten, nach chirurgischen Eingriffen und in der Palliativpflege kommunizieren.

**Funktioniert es auf Mac / Windows?** Ja. Der Bettmodus ist eine Progressive Web App-Funktion — er läuft in jedem Browser auf jedem Gerät. Er ist nicht nur für iOS.

---

#### Für wen ist das?

Der Bettmodus ist für Nutzer mit einem breiten Spektrum an motorischen und sprachlichen Fähigkeiten konzipiert. Die Schnellphrasen-Karten (unten beschrieben) sind speziell für Nutzer am schwersten Ende des Spektrums konzipiert — diejenigen, die überhaupt nicht sprechen können und sehr eingeschränkte oder keine Handbewegungen haben.

| Nutzerprofil | Empfohlene Eingabemethode |
|---|---|
| Kann sprechen, Arme eingeschränkt | Sprache (🎙 Mikrofon-Taste) + Freihändige Schleife |
| Einige Vokalisationen, unzuverlässige Sprache | „Hey Prism“ Aktivierungswort + Freihändige Schleife |
| Keine Sprache, kann Bildschirm antippen | Schnellphrasen-Karten (einzelner Tipp) |
| Keine Sprache, eingeschränkte Motorik — ein Schalter | iOS Schaltersteuerung oder Android Schalterzugriff-Scanning über Schnellphrasen-Karten |
| Keine Sprache, keine Handbewegung — Blicksteuerungsgerät | Blicksteuerungs-Hardware (Tobii, EyeGaze Edge usw.) wird als Mauszeiger dargestellt — alle Karten sind navigierbar |
| Keine Sprache, kann Kopf bewegen | Kopfverfolgung (z.B. iOS Kopfzeiger, Kamerasteuerung auf iPhone 16) — Karten sind Navigationsziele in voller Größe |
| Tracheotomie / beatmet, keine Vokalisation | Schnellphrasen-Karten über Blicksteuerung oder Schalter + betreuerunterstützter Modus |

---

#### Plattformunterstützung

| Plattform | Bettmodus | Schnellkarten | Freihändige Schleife 🔁 | Aktivierungswort 🎯 |
|---|:---:|:---:|:---:|:---:|
| Web — Mac / Windows / Linux (jeder Browser) | ✅ | ✅ | ✅ | ✅ |
| Web — iPhone / iPad (Safari) | ✅ | ✅ | ✅ | ⚠️ Nur Safari |
| Native iOS-App (App Store) | ✅ | ✅ | ✅ | ❌ Freihändig verwenden |
| Android (Chrome / Edge) | ✅ | ✅ | ✅ | ✅ |
| Blicksteuerungsgerät (beliebig — wird als Maus dargestellt) | ✅ | ✅ | ✅ | ✅ |
| Tasterscanning (iOS Schaltersteuerung) | ✅ | ✅ | ✅ | ❌ |
| Apple Watch | ❌ | ❌ | ❌ | ❌ |

> **Warum kein Aktivierungswort in der nativen iOS-App?** Die native Brücke übernimmt die Audiositzung (`prismNativeBridge.startVoice`), was mit der `SpeechRecognition`-API des Browsers kollidiert, die der Aktivierungswort-Dienst verwendet. Verwenden Sie stattdessen die **Freihändige Schleife** (🔁) — sie startet das Mikrofon 1 Sekunde nach jeder KI-Antwort automatisch neu, ohne dass eine weitere Eingabe erforderlich ist.

---

#### So starten Sie

1.  Öffnen Sie das **KI-Chat**-Panel — tippen Sie auf das 🤖-Symbol in der Symbolleiste.
2.  Tippen Sie auf **🛏** im Panel-Header — das Vollbild-Overlay öffnet sich sofort.
3.  Wählen Sie Ihre Eingabemethode (siehe Abschnitte unten).

<p align="center">
  <img src="../../e2e/_screenshots/bedside-overlay-open.png" alt="Bettmodus-Overlay geöffnet — schwarze Vollbild-Benutzeroberfläche. Oberer Streifen zeigt Schnellphrasen-Karten. Mittlerer Bereich zeigt KI-Antworten. Unten zeigt große rote Mikrofon-Taste und Steuerungszeile." width="260">
  <img src="../../e2e/_screenshots/bedside-overlay-handsfree-on.png" alt="Bettmodus mit aktiver Freihändiger Funktion — 🔁-Taste grün hervorgehoben, Status-Text 'Freihändig AN' sichtbar" width="260">
  <img src="../../e2e/_screenshots/bedside-hands-free-on.png" alt="Freihändige Umschalt-Taste im aktiven Zustand — grüner Hintergrund, aria-pressed=true" width="260">
</p>

#### So beenden Sie / verlassen Sie

-   **Berühren / Tippen:** Tippen Sie auf **✕** in der oberen rechten Ecke des Overlays (48 × 48 px Ziel).
-   **Tastatur / Schalter:** Drücken Sie **Escape**.
-   **Sprache:** Sagen Sie einen beliebigen Befehl über die iOS Sprachsteuerung, während das Overlay geöffnet ist.

Ihr vollständiger Chat-Verlauf und der KI-Sitzungsstatus bleiben beim Beenden erhalten. Das Overlay liegt als separate Render-Schicht über dem Hauptpanel — nichts geht verloren, wenn Sie es schließen.

<p align="center">
  <img src="../../e2e/_screenshots/bedside-overlay-closed.png" alt="Nach dem Schließen des Bettmodus — zurück zum Haupt-KI-Chat-Panel mit intaktem Gesprächsverlauf" width="260">
  <img src="../../e2e/_screenshots/bedside-wakeword-statusbar.png" alt="Statusleiste des Hauptpanels zeigt 'Hey Prism aktiv' mit blauem Indikator nach Rückkehr aus dem Bettmodus" width="260">
</p>

---

### 🃏 Schnellphrasen-Karten — für nicht-sprechende und bewegungseingeschränkte Nutzer

> **Dies ist der kritische Pfad für Nutzer, die nicht frei sprechen oder den Bildschirm berühren können.** Schnellphrasen-Karten sind vorprogrammierte Kommunikationsschaltflächen, die durch einen einzigen Tipp, Blickverweildauer oder Tasterscanning aktiviert werden können. Kein Tippen. Keine Stimme. Keine Internetverbindung erforderlich, um sie zu nutzen.

Jede Karte zeigt ein großes Emoji-Symbol und eine kurze Phrase. Das Antippen einer Karte lädt diese Phrase sofort in die Nachrichtenleiste. Wenn der **Freihändige Modus** aktiviert ist, wird die Phrase automatisch an die KI gesendet.

#### Integrierte Karten

Fünfzehn Karten sind bei der ersten Nutzung vorinstalliert, nach Dringlichkeit gruppiert. Sie können nicht gelöscht werden. Sie funktionieren offline.

**Dringend (höchste Priorität — diese zuerst in einem medizinischen Notfall kommunizieren):**

| Symbol | Phrase | Wann zu verwenden |
|:---:|---|---|
| 🆘 | HILFE — NOTFALL | Unmittelbare Gefahr, Notruf, jede Situation, die sofort Personal erfordert |
| 😢 | Ich habe Schmerzen | Schmerzen jeglicher Art — Ort/Schweregrad können im Freitext folgen |
| 🫁 | Ich kann nicht atmen | Atemnot, Atemwegsprobleme, Panikattacke |
| 🔔 | Rufen Sie die Krankenschwester | Nicht-Notfall-Personalanfrage |

**Physische Bedürfnisse:**

| Symbol | Phrase | Wann zu verwenden |
|:---:|---|---|
| 💧 | Wasser bitte | Durst, trockener Mund, Medikamenteneinnahme |
| 🔥 | Mir ist zu heiß | Fieber, Decke, Temperaturregulierung |
| 🥶 | Mir ist zu kalt | Schüttelfrost, Decke, Raumtemperatur |
| ↔️ | Bitte lagern Sie mich um | Druckentlastung, Komfort, postoperative Lagerung |
| 💊 | Ich brauche meine Medikamente | Geplante Dosis, PRN-Anfrage, Schmerzmedikation |

**Kommunikation:**

| Symbol | Phrase | Wann zu verwenden |
|:---:|---|---|
| ✅ | Ja | Bestätigung — Beantwortung von Ja/Nein-Fragen des Betreuers |
| ❌ | Nein | Ablehnung — Beantwortung von Ja/Nein-Fragen des Betreuers |
| ⏳ | Bitte warten Sie | Braucht einen Moment — noch nicht fortfahren |

**Emotional:**

| Symbol | Phrase | Wann zu verwenden |
|:---:|---|---|
| ❤️ | Ich liebe dich | Familie, emotionale Verbindung |
| 🙏 | Danke | Dankbarkeit |
| 😨 | Ich habe Angst | Angst, Furcht, Not — löst empathische KI-Antwort aus |

#### So verwenden Sie Schnellphrasen-Karten

**Einzelner Tipp / Blicksteuerung / Schalterauswahl:**
Das Aktivieren einer Karte platziert ihren Text in der Nachrichtenleiste. Die Phrase kann dann:
- An die KI gesendet werden für eine kontextbezogene Antwort (z.B. Antippen von „Ich habe Angst“ → KI antwortet mit Beruhigung und stellt Folgefragen)
- So wie sie ist gelesen werden — Betreuer im Raum können die angetippte Karte auf dem Bildschirm sehen

**Mit aktiviertem Freihändigen Modus:**
Die Phrase wird automatisch an die KI gesendet, sobald die Karte angetippt wird. Das Mikrofon startet 1 Sekunde nach der KI-Antwort neu — wodurch eine kontinuierliche Schleife ohne weitere Eingabe entsteht.

**Mit aktivem „Hey Prism“ Aktivierungswort (Web / Desktop):**
Aktivierungswort + Schnellkarte können kombiniert werden: Der Nutzer sagt „Hey Prism“, um das Mikrofon zu öffnen, die KI antwortet, und der Nutzer kann dann eine Karte antippen, um das Gespräch in eine andere Richtung fortzusetzen, ohne erneut zu sprechen.

#### So fügen Sie benutzerdefinierte Karten hinzu

Betreuer, BCBAs und Familienmitglieder können personalisierte Karten hinzufügen, die auf die spezifischen Kommunikationsbedürfnisse des Nutzers zugeschnitten sind — die Namen ihrer Ärzte, Lieblingsphrasen, spezifische Schmerzbeschreibungen, religiöse Ausdrücke oder alles andere.

**Schritte:**

1.  Im Bettmodus tippen Sie auf **＋ Hinzufügen** am Ende des Schnellphrasen-Streifens.
2.  Geben Sie die gewünschte Phrase auf der Karte ein (bis zu 80 Zeichen).
3.  Tippen Sie auf **Karte hinzufügen** — die KI generiert automatisch ein Emoji-Symbol, das zur Bedeutung der Phrase passt (z.B. „Gib mir mehr Decken“ → 🛏, „Ich möchte beten“ → 🤲).
4.  Das Symbol erscheint mit einer kurzen „✨ Generiere…“-Animation, dann wird die Karte gespeichert.

Benutzerdefinierte Karten werden lokal auf dem Gerät gespeichert (localStorage). Sie bleiben über Sitzungen und App-Neustarts hinweg erhalten. Für die Nutzung gespeicherter Karten ist kein Konto oder Internetverbindung erforderlich — nur die anfängliche Symbolgenerierung erfordert einen Netzwerkaufruf.

**Beispiel für benutzerdefinierte Karten, die hinzugefügt werden könnten:**

| Vorgeschlagene Phrase | Warum |
|---|---|
| `[Name des Arztes], bitte kommen Sie` | Schneller als das allgemeine „Krankenschwester rufen“ für einen bestimmten Kliniker |
| `Ich muss mit meiner Familie sprechen` | Emotionale/rechtliche Situationen, die Angehörige erfordern |
| `Bitte schalten Sie das Licht aus` | Sensorische Empfindlichkeit, Migräne, Schlaf |
| `Ich möchte beten` | Spirituelle Betreuung — Würde in der Sterbebegleitung |
| `Etwas fühlt sich falsch an` | Vages Notsignal — fordert die KI auf, klärende Fragen zu stellen |
| `Ich brauche die Absaugung` | Tracheotomie- / Beatmungspatienten |
| `Meine Infusion schmerzt` | Infiltration, Phlebitis-Alarm |
| `Ich möchte nach Hause gehen` | Palliativ-/Entlassungsgespräche |

#### So löschen Sie benutzerdefinierte Karten

1.  Tippen Sie auf **✏️ Bearbeiten** im Header des Schnellphrasen-Streifens.
2.  Ein rotes **✕**-Abzeichen erscheint auf jeder benutzerdefinierten Karte (integrierte Karten sind geschützt und können nicht entfernt werden).
3.  Tippen Sie auf ✕ auf einer beliebigen Karte, um sie zu entfernen.
4.  Tippen Sie auf **Fertig**, um den Bearbeitungsmodus zu verlassen.

#### Tasterscanning-Einrichtung (iOS)

Für Nutzer, die nur einen einzigen externen Schalter aktivieren können (Saug-Blas-Schalter, Kopfschalter, Fußschalter, Kissenschalter):

1.  Verbinden Sie den Schalter über Bluetooth oder den Lightning-/USB-C-Anschluss mit dem iPhone/iPad.
2.  Gehen Sie zu **Einstellungen → Bedienungshilfen → Schaltersteuerung → Schalter** und weisen Sie dem Schalter „Objekt auswählen“ zu.
3.  Gehen Sie zu **Schaltersteuerung → Scan-Stil** und wählen Sie „Automatisches Scannen“ — das Gerät hebt die Elemente nacheinander automatisch hervor.
4.  Öffnen Sie Prism AAC im Bettmodus. Die Schaltersteuerung scannt automatisch durch die Schnellphrasen-Karten. Aktivieren Sie Ihren Schalter, wenn die gewünschte Karte hervorgehoben ist.
5.  Die Phrase wird sofort gesendet — keine zweite Aktion erforderlich.

> Alle Schnellphrasen-Karten tragen `data-scan-group="quick-cards"`, damit unterstützende Technologien den gesamten Streifen gruppiert scannen können, bevor sie zu anderen UI-Bereichen wechseln.

#### Blicksteuerungs-Einrichtung

Blicksteuerungs-Hardware (Tobii Dynavox, EyeGaze Edge, PCEye, MyTobii P10 usw.) wird dem Betriebssystem als Standard-Mauszeiger mit Verweil-Klick präsentiert. In Prism AAC ist keine spezielle Konfiguration erforderlich:

1.  Konfigurieren Sie die Verweildauer in Ihrer Blicksteuerungs-Software (empfohlen: 800–1200 ms für Erstnutzer).
2.  Öffnen Sie Prism AAC im Bettmodus in einem beliebigen Browser.
3.  Verweilen Sie auf einer Schnellphrasen-Karte, um sie zu aktivieren.

Die minimale Kartengröße (88 × 80 px) erfüllt die WCAG 2.5.5 AAA-Anforderung an die Zielgröße von 44 × 44 CSS px und übertrifft das typische Minimum, das für die Blicksteuerungsinteraktion empfohlen wird (60 × 60 px).

---

<details>
<summary><strong>Alle Funktionen + technische Implementierungsdetails</strong></summary>

**Fünf Subsysteme als eine Funktion ausgeliefert:**

1.  **Schnellphrasen-Karten** — `services/bedsideCards.ts` + Streifen-UI in `components/BedsideOverlay.tsx`.

    -   Speicherung: `localStorage`-Schlüssel `prism_bedside_cards_v1`. Schema-validiert bei jedem Laden — fehlerhafte Einträge werden stillschweigend verworfen.
    -   Begrenzung: Maximal 50 benutzerdefinierte Karten (verhindert unbegrenztes Speicherwachstum).
    -   Integrierte Karten: 15 Einträge mit `id` präfix `builtin-`; die Lösch-UI-Sperre prüft dieses Präfix, bevor das ✕-Abzeichen angezeigt wird, um sicherzustellen, dass Standardwerte niemals entfernt werden.
    -   KI-Symbolgenerierung: `services/aiService.ts → inferCardIcon(text)`. Verwendet dieselbe lokale Ollama → Synalux Cloud-Routing-Kette wie der Rest der App. Sendet die Phrase als Benutzernachricht mit einem gesperrten System-Prompt („Antworte mit genau einem Emoji…“). Extrahiert den ersten Unicode-Codepunkt aus der Antwort. Löst immer auf — fällt bei Netzwerkfehler oder Nicht-Emoji-Antwort auf 💬 zurück.
    -   Offline: Karten funktionieren vollständig offline; nur das Hinzufügen einer neuen Karte erfordert Netzwerk (für die Symbolgenerierung — fällt auf 💬 zurück, wenn offline).

2.  **Freihändige KI-Schleife (🔁)** — auch über den Haupt-KI-Chat-Header zugänglich. Nach jeder KI-Antwort startet das Mikrofon automatisch neu (1 s Verzögerung). Ein `handsFreeRef` / `startListeningRef` Ref-Muster stellt sicher, dass der Effekt immer den aktuellen Callback aufruft, ohne bei jedem Render-Vorgang erneut ausgeführt zu werden.

    ![Freihändige Statusleiste im Haupt-KI-Panel](../../e2e/_screenshots/bedside-hands-free-statusbar.png)

3.  **Bettmodus-Overlay** — `fixed inset-0 z-50 bg-black` Vollbild-dunkle Benutzeroberfläche, gerendert als Geschwister-`<Fragment>` neben dem Haupt-KI-Panel, sodass der Panel-Status über Öffnungs-/Schließzyklen hinweg erhalten bleibt. Barrierefreiheit: `role="dialog"`, `aria-modal="true"`, `aria-label="Bettmodus"`, WCAG 2.1 SC 2.1.2 Fokusfalle (Tab/Shift+Tab-Zyklen innerhalb des Overlays, `Escape` schließt). Viewport-Abdeckung unabhängig E2E-verifiziert (≤ 4 px Toleranz).

    -   **Große Mikrofon-Taste** — 112 × 112 px (`w-28 h-28`), rot + pulsierend während des Hörens, weißer Rand im Ruhezustand. Verifiziert ≥ 96 px durch Playwright `boundingBox()`.
    -   **Schnellkarten-Streifen** — horizontale Scroll-Zeile, jede Karte `88 × 80 px`, `data-scan-group="quick-cards"` für Tasterscanning-Gruppierung, `role="list"` / `role="listitem"` für Screenreader-Semantik.
    -   **Steuerungszeile** — Freihändig (grün, wenn an), „Hey Prism“ Aktivierungswort (blau, wenn an, ausgeblendet, wenn `!wakeWordSupported`), iOS Sprachsteuerungs-Verknüpfung.
    -   **Beenden** — ✕-Taste (`w-12 h-12`) oder `Escape` → `onClose()` → `bedsideModeActive = false` in `AIChatPanel` → WCAG 2.4.3 Fokus kehrt zur 🛏-Taste zurück, die den Dialog geöffnet hat.

    ![Bettmodus-Overlay — geschlossen, zurück zum Haupt-KI-Panel](../../e2e/_screenshots/bedside-overlay-closed.png)

4.  **„Hey Prism“ Aktivierungswort** — `services/wakeWordService.ts`. Führt eine kontinuierliche `SpeechRecognition`-Sitzung im Hintergrund aus. Erkennt jedes Transkript, das „hey prism“ enthält, aktiviert das Mikrofon einmal und setzt es dann für den nächsten Zyklus zurück. Schutz: wird nicht gestartet, wenn die native iOS-Brücke das Mikrofon besitzt (`prismNativeBridge?.startVoice` vorhanden). Der aktive Zustand des Aktivierungsworts wird in der Statusleiste des Hauptpanels nach dem Schließen des Overlays angezeigt.

    ![Statusleiste zeigt „Hey Prism“ aktiv](../../e2e/_screenshots/bedside-wakeword-statusbar.png)

5.  **iOS Sprachsteuerungsanleitung** — das Antippen von 📱 in der Steuerungszeile versucht `prismNativeBridge.openSettings('accessibility')` (verlinkt direkt zu den Bedienungshilfen auf unterstützten nativen Builds). Im Web / auf dem Desktop fällt es auf eine Anweisungskarte im Overlay zurück, die durch `Einstellungen → Bedienungshilfen → Sprachsteuerung → Ein` führt.

    <p align="center">
      <img src="../../e2e/_screenshots/bedside-voice-control-card.png" alt="iOS Sprachsteuerungs-Anweisungskarte — Schritt-für-Schritt-Anleitung, die im Bettmodus-Overlay angezeigt wird, wenn 📱 im Web/Desktop angetippt wird" width="260">
      <img src="../../e2e/_screenshots/bedside-voice-control-dismissed.png" alt="iOS Sprachsteuerungs-Anweisungskarte nach dem Schließen — Overlay kehrt zum normalen Bettmodus-Layout zurück" width="260">
    </p>

**Testabdeckung:**
-   `services/bedsideCards.test.ts` — 22 Unit-Tests: Standardkartensatz, localStorage Round-Trip, fehlerhafter JSON-Fallback, Filterung ungültiger Karten, 50-Karten-Begrenzung, `createCard`-Feld-Einschränkungen.
-   `e2e/bedside-mode.spec.ts` — 17 Playwright E2E-Tests: Schaltflächensichtbarkeit, `aria-pressed`-Umschaltung, grüne/blaue Statusklassen, Statusleistentext, Overlay-Barrierefreiheitsattribute, Mikrofon `boundingBox`-Größe, Viewport-Abdeckung, Anweisungskarte anzeigen/ausblenden.

**Schlüsseldateien:**
-   `components/AIChatPanel.tsx` — Bettmodus-Status, Kartenstatus (`bedsideCards`), `handleAddBedsideCard`, `handleDeleteBedsideCard`, Freihändige Schleife, Aktivierungswort-Lebenszyklus, Header-Schaltflächen
-   `components/BedsideOverlay.tsx` — Overlay-UI, Schnellkarten-Streifen, Karte hinzufügen-Dialog, Bearbeitungsmodus, Fokusfalle, Sprachsteuerungs-Anweisungskarte
-   `services/bedsideCards.ts` — `BedsideCard`-Typ, `DEFAULT_BEDSIDE_CARDS`, `loadCards`, `saveCards`, `createCard`
-   `services/aiService.ts` → `inferCardIcon(text)` — KI-Emoji-Inferenz
-   `services/wakeWordService.ts` — kontinuierliche Erkennung von Aktivierungsphrasen
</details>

---

### 📨 Nachricht senden — Anbieter-Auswahl
Wenn ein Kontakt mehrere konfigurierte Anbieter hat (z.B. sowohl E-Mail als auch SMS), erscheint ein Abschnitt **„Senden über“** über dem Verfassungsbereich. Ein Tipp wechselt den Anbieter vor dem Verfassen — kein Verlassen des Panels erforderlich.

![Kontaktanbieter-Auswahl — Zeile „Senden über“ mit grün hervorgehobener E-Mail, SMS verfügbar](../../docs/screenshots/contact-provider-picker.png)

---

### 💬 UK-Chat
Eingehende Nachrichten von verbundenen Anbietern (Telegram, WhatsApp, E-Mail, Slack usw.) landen in diesem Panel. Das Ungelesen-Abzeichen in der Symbolleiste zeigt die Anzahl an, der Alarm + die Cross-Tab-Benachrichtigung wird ausgelöst, wenn eine neue Nachricht eintrifft, und das Antippen einer Nachrichtenzeile kopiert sie in die Leiste, sodass das Kind eine Antwort mit seiner eigenen Stimme verfassen kann.

![UK-Chat-Panel zeigt eingehende Betreuer-Nachrichten mit Ungelesen-Abzeichen](../../docs/screenshots/panel-aac-chat.png)

<details>
<summary><strong>Funktionen + technische Details</strong></summary>

- Abgefragter Posteingang über Synalux-Portal `/api/v1/prism-aac/inbox/poll` (keine Operation bei 404, wenn Portal nicht konfiguriert)
- Cross-Tab `BroadcastChannel`-Benachrichtigung bei neuer Nachricht
- Anbieter-Abstraktion: Hinzufügen von Outlook / Slack / Discord = jeweils ~30 LOC (siehe `synalux-platform/scripts/fetch-messages.mjs`)
- Lesestatus wird zurücksynchronisiert, damit Betreuer sehen, wann das Kind ihre Nachricht gesehen hat
- Kostenlose Stufe: 1 verbundener Anbieter; kostenpflichtige Stufe: unbegrenzt
- TTS pro Nachricht, damit das Kind den eingehenden Text in seiner bevorzugten Stimme hören kann

**Render-Pfad:** `components/AACChatPanel.tsx` → `services/inboxPolling.ts` (5s Abfrage, wenn sidePanel === 'aac-chat', sonst 60s) → `useScheduleStore.setIncomingMessages()`. Jede Nachricht wird auch der „Nachrichten von Betreuern“-Spur des Zeitplans hinzugefügt.
</details>

---

### 🧮 Schulfächer
Zellraster-Leinwand mit **19 Fach-Tastaturen**, die das gesamte Gymnasiumsprogramm abdecken: Mathematik + Naturwissenschaften + Programmierung + Kunst + Geisteswissenschaften. Jede Registerkarte leitet den KI-Tutor durch eine domänenspezifische Prompt-Vorlage (insgesamt 33 Vorlagen), sodass das Modell keine algebraischen Überlegungen auf ein Punnett-Quadrat anwendet oder eine Musikdynamik mit einem Programmierliteral verwechselt. **Die Geschichte ist gebiets- + regionsspezifisch** bis auf die Ebene von Bundesstaaten / Provinzen / Ländern / autonomen Gemeinschaften — über 280 Regionen in 23 Ländern.

![Zellraster-Leinwand mit 5 + 7 = 12 in Zellen getippt](../../docs/screenshots/math-canvas-typed.png)

<details>
<summary><strong>Fächer-Registerkarten (insgesamt 19)</strong></summary>

**Mathematik (9 Tastaturen)** — Haupt, Erw. Mathematik (π √ Exponenten + 5 Dekorationswerkzeuge: Bruchfeld, schriftliche Division, Wurzelbalken, Summenlinie, Bruchstrich), a–z, Verschiedene Mathematik (Mengenlehre + Logik), Zeit & Distanz, Gewicht, Volumen, Geometrie, Geld.

**Naturwissenschaften (4)** — Chemie (24 Elemente + Reaktionspfeile + Ladungen + Indizes + Phasenmarker), Physik (vollständiges Griechisch + 16 SI-Einheiten + ∫/∂/∇/∑/∏ + Konstanten), Biologie (DNA/RNA + Genetik + 8 Taxonomie-Ränge + 12 Organellen), Statistik (μ σ x̄ + 12 Operationen + Verteilungen).

**Programmierung (2)** — Python (24 Operationen + 26 Schlüsselwörter) und Java (24 Operationen + 26 Schlüsselwörter). Code schreibt ein Zeichen pro Zelle, sodass es sich natürlich auf dem Monospace-Raster anordnet.

**Kunst + Geisteswissenschaften (4)** — Musik (3 Notenschlüssel + 6 Noten + 5 Pausen + 5 Vorzeichen + 8 Dynamiken), Geowissenschaften (Wetter + Platten + 10 Planeten + AE/Lj/pc/Mya/Gya), Geschichte (gebiets- + regionsspezifisch), Sprachwissenschaften (12 POS-Tags + 6 Satztypen + Interpunktion + Zitationsstile).

</details>

<details>
<summary><strong>KI-Tutor — 11 Domänen × 3 Modi = 33 Prompts</strong></summary>

![KI-Tutor-Overlay mit simuliertem Hinweis über der Leinwand](../../docs/screenshots/math-tutor-hint.png)

Drei Modi pro Fach: 💡 **Hinweis** (sanfter Anstoß zum nächsten Schritt, löst nie), ✓ **Prüfen** (validiert die Antwort des Kindes, feiert bei Korrektheit), 🎓 **Lösen** (vollständige Schritt-für-Schritt-Anleitung, max. 4 Schritte). Die aktive Registerkarte teilt dem Tutor mit, welches Fach das Kind bearbeitet. 15 s harter Timeout + Wiederholen-Taste, damit das Overlay nie hängen bleibt.
</details>

<details>
<summary><strong>Geschichte — gebiets- + regionsspezifisch</strong></summary>

![Geschichts-Tastatur im en-Gebietsschema (keine Region) — universelle + nationale Stufen](../../docs/screenshots/math-keyboard-history-en.png)
![Geschichts-Tastatur mit US-TX-Region — Alamo, Texas-Annexion, JFK erscheinen](../../docs/screenshots/math-keyboard-history-us-tx.png)

Drei gestapelte Stufen:
1.  **Universelle** Ereignisse, die in jedem Lehrplan gelehrt werden (476, 1914 Erster Weltkrieg, 1939 Zweiter Weltkrieg, 1969 Mondlandung)
2.  **Nationale** Ereignisse, ausgewählt nach `language` (en, es, fr, de, ro, ru, uk, ja, ko, zh, ar, it, pl, nl, he, hi, vi, tr, pt) — 19 unterstützte Sprachen
3.  **Subnationale** Ereignisse, ausgewählt nach `historyRegion` (US-TX, CA-QC, UK-SCT, ES-CT, IN-MH, DE-BY, …) — **über 280 Regionen in 23 Ländern**, einschließlich aller 50 US-Bundesstaaten + DC, 13 kanadische Provinzen / Territorien, alle 4 UK-Nationen, Irland (Republik + 4 historische Provinzen), alle 16 deutschen Länder, alle 17 spanischen autonomen Gemeinschaften, alle 20 italienischen Regionen, plus AU, FR, MX, BR, IN, CN, RU, BE, CH, NL, AR, ZA, KR, PK, NZ, PL.

Der Tutor-Prompt enthält das Gebietsschema + die Region, sodass ein mehrdeutiges Datum wie 1836 in `US-TX` zum Alamo (nicht zur Staatsgründung von Alabama) aufgelöst wird; 1759 in `CA-QC` zu den Plains of Abraham; 1714 in `ES-CT` zum Fall von Barcelona.

</details>

<details>
<summary><strong>Test-Workflows — 12 Fächer × Textaufgaben der Klassen 8-12 × 72 Playwright-Tests</strong></summary>

Schritt-für-Schritt-Aufgabenblätter, die jede Fach-Tastatur trainieren, plus ein ausführbarer Playwright-Test pro Aufgabe, der das Live-Mathematik-Panel steuert und überprüft, ob die Glyphen jedes Schritts im Zellraster landen. Direkt nach einer echten Algebra-Referenzseite der 9. Klasse modelliert.

-   **Schicht 1 — generisch Schritt-für-Schritt:** [`tests/workflows/`](tests/workflows/) — 12 Markdowns (advanced-math, biology, chemistry, earth-science, geometry, history, language-arts, misc-math, physics, programming-java, programming-python, statistics).
-   **Schicht 2 — klassenstufenbezogenes reales Klassenzimmer:** [`tests/workflows/grade-8-12/`](tests/workflows/grade-8-12/) — 12 Markdowns mit benannten Variablen-Textaufgaben (algebra-grade-9, geometry-grade-10, physics-grade-11, chemistry-grade-10, biology-grade-9, statistics-grade-11, programming-python-grade-9, programming-java-grade-11, pre-calc-grade-12, earth-science-grade-9, language-arts-grade-8, world-history-grade-10) + pro-Fach-Tastatur-Lücken [`REPORT.md`](tests/workflows/grade-8-12/REPORT.md).
-   **Schicht 3 — Playwright E2E:** [`e2e/math-workflows/`](e2e/math-workflows/) — 72 Tests (`npx playwright test --project=desktop e2e/math-workflows`).

Vollständiger Index, rangierte unterversorgte Fächer und das „Wie man einen neuen Workflow hinzufügt“-Runbook → **[`docs/WORKFLOWS.md`](docs/WORKFLOWS.md)**.

</details>

<details>
<summary><strong>Weitere Mathematik-Funktionen (Sperrwerkzeug, Zwei-Treffer-Vergrößerung, Speichern / Synchronisieren)</strong></summary>

-   **Sperrwerkzeug** — nachdem das Kind eine Aufgabe beendet hat, den Bereich sperren. Gesperrte Zellen werden leicht abgedunkelt dargestellt und lehnen Bearbeitungen ab.
-   **Zwei-Treffer-Vergrößerung** — erster Tipp aktiviert die Taste (1,4-fache Skalierung + grüner Heiligenschein, kein Commit), zweiter Tipp bestätigt. 2 s automatische Deaktivierung. Für Nutzer mit motorischer Ungenauigkeit.
-   **Speichern + Synchronisieren** — zuerst lokal in `localStorage`; Best-Effort-Synchronisierung mit dem Synalux-Portal über die `↻ Synchronisieren`-Taste. Begrenzung 100 Dokumente / 200 KB Inhalt; älteste werden entfernt.
-   **Haltezeit-Verweildauer** — konfigurierbare Verweildauer pro Taste (0–1500 ms) mit grünem Fortschrittsring.

![Overlay für gespeicherte Dokumente zeigt einen Eintrag und eine Synchronisieren-Taste](../../docs/screenshots/math-docs-overlay.png)
![Eine Zifferntaste im grün-halo-vergrößerten Zustand aktiviert](../../docs/screenshots/math-two-hit-armed.png)
![Sperrwerkzeug aktiviert, fordert den Benutzer auf, eine Ecke des Bereichs anzutippen](../../docs/screenshots/math-lock-armed.png)

</details>

<details>
<summary><strong>Fach-Tastaturen — zusätzliche Bilder</strong></summary>

![Chemie-Tastatur mit H₂O](../../docs/screenshots/math-keyboard-chemistry.png)
![Biologie-Tastatur mit A T G](../../docs/screenshots/math-keyboard-biology.png)
![Java-Tastatur mit `private String`](../../docs/screenshots/math-keyboard-java.png)
![Musik-Tastatur](../../docs/screenshots/math-keyboard-music.png)
![Statistik-Tastatur](../../docs/screenshots/math-keyboard-statistics.png)
![Geowissenschaften-Tastatur](../../docs/screenshots/math-keyboard-earth-science.png)
![Sprachwissenschaften-Tastatur](../../docs/screenshots/math-keyboard-language-arts.png)
![Rumänisch-lokalisierte Geschichte](../../docs/screenshots/math-keyboard-history-ro.png)

</details>

---

### 🗓 Zeitplan
Visueller 'Zuerst-Dann'-Zeitplan zur Unterstützung von Routinen + Übergängen. Jeder Schritt ist eine Bildkachel + Beschriftung; das Beenden einer Kachel löst ein Klingeln + eine visuelle Fortschrittsmarkierung aus. Der Belohnungsshop (kostenpflichtige Stufe) wird am Ende einer Routine freigeschaltet.

![Zeitplan-Panel mit 'Zuerst-Dann'-Tafel + Aktivitätenliste](../../docs/screenshots/panel-schedule.png)

<details>
<summary><strong>Funktionen + technische Details</strong></summary>

- 24-Kachel-Voreinstellungsraster für Ein-Tipp-Aktivitäten: aufwachen, Zähne putzen, Frühstück, Schule, Snack, Mittagessen, spielen, lesen, Kunst, spazieren gehen, Abendessen, Bad, Gute-Nacht-Geschichte, Schlafenszeit, Medikamente, Zahnseide, aufräumen, Wäsche, Tierpflege, Sport, …
- Drag-and-Drop-Neuordnung; Inline-Bearbeitung mit Bleistiftsymbol; Voreinstellungen tragen `textKey`, sodass Sprachwechsel neu beschriften
- 'Zuerst-Dann'-Zustandsmaschine: aktivierter Kachel-Puls, 3-Noten-aufsteigendes Klingeln bei Timerablauf, bewegungssicher (`prefers-reduced-motion` → statischer Ring), `aria-pressed`-Semantik
- Audio-Aufwärmen: Nahezu geräuschloser 1Hz-Oszillator hält den AudioContext auf iOS Safari „am Laufen“, sodass das Timer-Klingeln nach langer Stille tatsächlich abgespielt wird (ohne Aufwärmen feuert das Klingeln in einen suspendierten Kontext = kein Ton).
- Betreuer-Nachrichten werden dem Zeitplan als „Nachrichten“-Spur hinzugefügt, sodass das Kind sieht, was kommt + wer eine Nachricht gesendet hat.

**Render-Pfad:** `components/SchedulePanel.tsx` → `useScheduleStore` (24 voreingestellte Aktivitäten + benutzerdefinierte) → `services/feedback.ts:playTimerRing()` → geteilter AudioContext über `services/azureTTS.ts:warmupAzureAudio()`.
</details>

---

### 🎮 Spiele
12 evidenzbasierte UK-Spiele. Entwickelt, um Kommunikation zu lehren, **nicht für Bildschirmzeit**. Jedes Spiel zeichnet Äußerungen + Genauigkeit auf, sodass die adaptive Engine das nächstbeste passende Spiel vorschlagen kann.

![Spiele-Panel mit 9 Spielkacheln](../../docs/screenshots/panel-games.png)

<details>
<summary><strong>Die 12 Spiele + technische Details</strong></summary>

| Spiel | Zielfertigkeit |
|---|---|
| Blasen platzen lassen | Ursache + Wirkung, absichtliche Kommunikation |
| Farbenjagd | Rezeptiver Wortschatz (Farbnamen) |
| Meine Geschichte | Narrative Reihenfolge |
| Passendes finden | Zuordnung + kategoriales Denken |
| Ja/Nein | Binäre Diskriminierung, Anfragen/Ablehnen |
| Beenden Sie es | Satzvervollständigung (Lückentext) |
| Kategorie sortieren | Semantische Kategorisierung |
| Emotionen zuordnen | Affekt-Benennung, Theory of Mind |
| Was kommt als Nächstes | Sequenzielles Denken |
| Gleich / Anders | Visuelle Diskriminierung — Übereinstimmung oder Kontrast |
| Ich höre es (Geräusch-Zuordnung) | Auditive Diskriminierung + Wortschatz |
| Reihenfolge einhalten | Übung im sozialen Abwechseln |

- Kostenlose Stufe: Blasen platzen lassen, Farbenjagd, Meine Geschichte (3 Spiele)
- Kostenpflichtige Stufe: alle 12
- Spieldaten speisen `services/adaptiveEngine.ts` — Äußerungslänge / Kategorie / Tageszeit / Ergebnis → schlägt das nächste Spiel vor
- Alle Spiele deaktivieren UK-Kachelkategorien, die für das Vokabular des jeweiligen Spiels nicht relevant sind, damit das Kind nicht abgelenkt wird.

**Render-Pfad:** `components/GamesPanel.tsx` → individuelle Spielkomponenten in `components/games/`. Jedes Spiel zeichnet über `useScheduleStore.recordMessage(text, category)` auf.
</details>

---

### 🏪 Marktplatz
Stimmenpakete (Inworld-Stimmen, benutzerdefinierte geklonte Stimme eines Geschwisters/Elternteils), Vokabelpakete (Spanisch-Kern, gebärdenunterstützte Sprache), Spielepakete (zusätzliche Spiele über die 9 hinaus). Apps werden über dasselbe Register, das die integrierten Panels verwenden, in die Symbolleiste installiert.

![Marktplatz-Panel mit installierbaren Apps](../../docs/screenshots/panel-marketplace.png)

<details>
<summary><strong>Funktionen + technische Details</strong></summary>

- Apps existieren als JSON-Einträge (`lib/marketplace/manifests/local.ts`) + ein Laufzeit-`lib/marketplace/registry.ts` mit `getHandler(appId)`, das die Panel-Komponente zurückgibt
- Sprachklonung (kostenpflichtige Stufe): 90s Aufnahme → trainierte Stimme, nutzbar für jede TTS in der App, einschließlich Kategoriekacheln
- Installierte Apps werden als Symbolleisten-Schaltflächen nach den integrierten Apps gerendert; `useSettingsStore.installedApps` ist die Quelle der Wahrheit
- Pro-Stufen-Gate: Marktplatz listet alles auf, aber Installationsschaltflächen sind für Artikel oberhalb des Nutzerplans deaktiviert

**Render-Pfad:** `components/MarketplacePanel.tsx` → `useMarketplaceStore` → Backend `synalux/api/v1/marketplace/...` für den Kauf, dann Asset-Download (Stimmdateien, Vokabel-JSON) in IndexedDB.
</details>

---

### 📄 PDF-Reader
Öffnen Sie ein PDF, sehen Sie eine Kachel pro Seite, tippen Sie, um es in Ihrer Stimme vorgelesen zu bekommen. Schulaufgaben, Hausaufgaben, Artikel — jedes PDF eingeben und anhören, anstatt es zu lesen. Kein Adobe Reader erforderlich; die gesamte Bibliothek läuft in Ihrem Browser.

![PDF-Reader-Panel — leerer Zustand mit „+ PDF öffnen“-Aufforderung](../../docs/screenshots/panel-pdf-reader.png)

<details>
<summary><strong>Funktionen + technische Details</strong></summary>

- Eine Kachel pro Seite; jede zeigt die ersten 3 Zeilen + eine `▶ Seite N`-Taste, die über `aacSpeak()` geleitet wird (gleiche Stimme + Ton + Wort-Hervorhebung wie alles andere)
- `▶ Alles lesen` verkettet jede Seite zu einer kontinuierlichen Äußerung
- Erkennung leerer Seiten (gescannte Bild-PDFs) schlägt das OCR-Tool vor
- `pdfjs-dist` dynamisch importiert beim ersten Öffnen — separater ~3 MB Chunk vom CDN, Versions-gepinnt an das npm-Paket
- Symbolleisten-Schaltfläche (📄) ist über Einstellungen → Symbolleiste optional aktivierbar, damit die minimale Standard-Symbolleiste sauber bleibt

**Render-Pfad:** `components/PdfReaderPanel.tsx` → `services/pdfReader.ts` (pdfjs `getDocument` → pro-Seite `getTextContent`) → `services/aacSpeak.ts`.
</details>

---

### 👁 Screenshot-Reader (OCR)
Fügen Sie ein Foto eines Arbeitsblatts, einen Screenshot einer Webseite, ein Bild einer Lehrbuchseite ein oder laden Sie es hoch — der erkannte Text erscheint neben dem Bild, und Sie können auf **▶ Sprechen** tippen, um ihn zu hören, oder auf **↧ An Nachrichtenleiste senden**, um ihn vor dem Sprechen zu bearbeiten.

![Screenshot-Reader (OCR)-Panel — leerer Zustand mit „+ Bild öffnen“-Aufforderung](../../docs/screenshots/panel-ocr-capture.png)

<details>
<summary><strong>Funktionen + technische Details</strong></summary>

- 20-Sprachen-OCR-Matrix, abgebildet von PrismAAC-Gebietsschemas auf Tesseract-Codes (eng / spa / fra / por / deu / ron / ukr / rus / jpn / kor / chi_sim / ara / ita / pol / nld / heb / hin / vie / tur / ind)
- Sprachspezifische traineddata-Dateien werden nach der ersten Verwendung zwischengespeichert (~10 MB für Englisch, mehr für CJK) — der erste Durchlauf zeigt „Bild wird gelesen… (erster Durchlauf lädt das OCR-Modell herunter — kann 10-30 s dauern)“
- Vertrauensprozentsatz wird angezeigt, damit der UK-Nutzer erkennen kann, ob er dem Ergebnis vertrauen oder es erneut aufnehmen soll
- `disposeOcr()` Cleanup-Hook beendet jeden gestarteten Worker beim Entladen der Seite, um WASM-Speicher freizugeben
- Symbolleisten-Schaltfläche (👁) ist über Einstellungen → Symbolleiste optional aktivierbar

**Render-Pfad:** `components/OcrCapturePanel.tsx` → `services/ocr.ts` (`tesseract.js` `createWorker` → `recognize`) → `services/aacSpeak.ts` oder `messageStore.setText`.
</details>

---

### 🎧 Komfort-Player

Medienplayer für Patienten am Krankenbett — Koma, Intensivstation, nicht-verbal oder jeder, der kontinuierlichen Komfortinhalt am Krankenbett benötigt.

<details>
<summary>Funktionsdetails</summary>

Familie und Freunde nehmen Sprachnachrichten auf, laden Fotos und Videos hoch. Die Wiedergabeliste läuft kontinuierlich, sodass der Patient immer vertraute Stimmen und Gesichter in der Nähe hat.

-   **Sprachnachrichten** direkt in der App aufnehmen (MediaRecorder API)
-   **Audiodateien, Fotos und Videoclips** hochladen (100 MB pro Datei, 500 MB insgesamt)
-   **Automatische Endlosschleife** durch alle Elemente — einstellen und gehen
-   **Vollbildmodus** für Fotos und Videos (Anzeige am Krankenbett)
-   **Native TTS-Integration** — angetippte Phrasen werden über AVSpeechSynthesizer auf iOS gesprochen
-   **Offline** — alle Medien in IndexedDB gespeichert, funktioniert ohne Internet
-   **Tastaturzugänglich** — jede Steuerung hat ARIA-Labels und Tastaturnavigation
-   **Militärstandard geprüft** — 27 Sicherheitslücken behoben (Blob-URL-Lecks, Quota-Handhabung, Eingabevalidierung, MIME-Zulassungslisten, Unmount-Bereinigung)
-   Symbolleisten-Schaltfläche (🎧) ist über Einstellungen → Symbolleiste optional aktivierbar

**Speicherlimits:** max. 50 Elemente, 100 MB pro Datei, 500 MB insgesamt. MIME-Typen beschränkt auf Audio (webm/mp4/mpeg/ogg/wav), Bilder (jpeg/png/gif/webp/heic) und Video (mp4/webm/quicktime).

**Render-Pfad:** `components/ComfortPlayerPanel.tsx` → `store/comfortPlayerStore.ts` (Zustand + persist) → `services/comfortMediaStorage.ts` (IndexedDB blobs).
</details>

---

### 🧩 Chrome-Erweiterung — dieselben Lese-Assistent-Funktionen in jedem Textfeld
Die PrismAAC Web-App deckt den Lese-Assistent-Workflow innerhalb ihrer eigenen Oberfläche ab. Die Chrome-Erweiterung (`chrome-extension/`) bringt das **gleiche Verhalten in JEDES Textfeld auf JEDER Website** — Gmail, Google Docs, Word Online, Schulportale, Bankformulare — und schließt damit die einzige Read & Write-Lücke, die von einer Webseite allein nicht erreichbar war.

![PrismAAC Lese-Assistent — sprechen während des Tippens, mit Wort-für-Wort-Hervorhebung, in jedem Textfeld](../../docs/screenshots/extension-marquee.png)

Das schwebende Overlay wird über jedem fokussierten Textfeld angebracht. Tippen Sie auf **▶ Sprechen**, um erneut zu lesen, oder tippen Sie einfach weiter — das Beenden eines Satzes mit `.?!` liest ihn automatisch zurück, wobei jedes Wort beim Sprechen gelb aufleuchtet:

![PrismAAC-Overlay über einer Verfassen-Seite, mitten im Satz mit „school“ gelb hervorgehoben, während TTS es spricht](../../docs/screenshots/extension-overlay.png)

Übersetzen während des Sprechens zeigt SOWOHL die Quellzeile (klein kursiv) als auch die übersetzte Zeile (volle Größe, mit Hervorhebung des aktiven Wortes während des Sprechens). Über 50 Sprachen über Googles kostenlosen öffentlichen Endpunkt (kein API-Schlüssel):

![PrismAAC-Overlay übersetzt Englisch nach Rumänisch — Quellzeile „I had a really good day at school today“ mit übersetzter „Am avut o zi foarte bună la școală astăzi“ darunter, „foarte“ hervorgehoben](../../docs/screenshots/extension-translate.png)

Optionsseite — Einstellungen synchronisieren sich über das Chrome-Profil des Nutzers via `chrome.storage.sync`. Pro-Site-Deaktivierungsliste, Stimmenauswahl, Rate-/Lautstärke-/Tonhöhen-Schieberegler, Sprachauswahl, alles optional:

![PrismAAC Erweiterungs-Optionsseite — Sprech-Trigger, Zielsprache Rumänisch, Stimmenauswahl, Rate-/Lautstärke-/Tonhöhen-Schieberegler](../../docs/screenshots/extension-options.png)

**Installation (derzeit im Entwicklermodus — Chrome Web Store-Eintragung steht noch aus):**

```sh
cd chrome-extension
npm install
npm run build
```

Öffnen Sie `chrome://extensions`, aktivieren Sie den **Entwicklermodus**, klicken Sie auf **Entpackte Erweiterung laden** und wählen Sie `chrome-extension/dist`.

**Funktionen:**

-   Satz bei `.?!` sprechen, jedes Wort bei Leertaste sprechen, alles umschaltbar
-   **Wort-für-Wort-Hervorhebung**, angetrieben durch das native `SpeechSynthesisUtterance.boundary`-Ereignis des Browsers (ECHTE Wort-für-Wort-Synchronisation, im Gegensatz zur ~60 ms/Zeichen-Heuristik der Web-App — die Portalroute gibt MP3 ohne Streaming-Ereignisse zurück, aber Web Speech stellt sie nativ bereit)
-   **Übersetzen während des Sprechens** — wählen Sie eine Zielsprache (über 50 werden über Googles kostenlosen öffentlichen Endpunkt unterstützt, kein API-Schlüssel). Das Overlay zeigt SOWOHL die Quellzeile (klein kursiv) ALS AUCH die übersetzte Zeile (mit Hervorhebung des aktiven Wortes); eine Web Speech-Stimme, die der Zielsprache entspricht, wird automatisch ausgewählt.
-   Schwebendes Shadow-DOM-Overlay, verankert über dem fokussierten Feld (▶ Sprechen, 📌 Anheften, × Schließen)
-   `Cmd / Strg + Umschalt + S`, um das fokussierte Feld bei Bedarf zu sprechen; `Esc` bricht ab
-   Pro-Site-Deaktivierungsliste für Bank- / sensible Formulare
-   Einstellungen synchronisieren sich über das Chrome-Profil des Nutzers via `chrome.storage.sync` — kein PrismAAC-Konto erforderlich

**Datenschutz:** Der Nicht-Übersetzungsmodus ist vollständig offline (Web Speech läuft nativ). Der Übersetzungsmodus tätigt einen HTTPS-Aufruf pro einzigartigem Satz an `translate.googleapis.com` (nach dem ersten Treffer zwischengespeichert). Quellcode verfügbar unter [`chrome-extension/`](chrome-extension/) — TypeScript + esbuild-Bundle (Inhalt 18 KB, Optionen 7 KB, Hintergrund 339 B).

---

### 👋 Freihändige Gesten
Optionale kamerabasierte Eingabe für Nutzer, die nicht zuverlässig tippen können. Kopfhaltungs-Verweil-Klick + Handhaltungs-Gestenprofile. Läuft lokal — kein Video verlässt das Gerät.

<details>
<summary><strong>Funktionen + technische Details</strong></summary>

-   **Basis-Modus**: Kopfhaltungs-Tracking (FaceLandmarker, MediaPipe). Nutzer blickt auf eine Taste, hält den Blick für `headTrackingDwellMs` (Standard 1200 ms) → Klick. Ein visueller Fortschrittsring füllt sich während des Verweilens.
-   **Erweiterter Modus**: Handhaltungs-Tracking. Benutzerdefinierte Gestenprofile pro Nutzer (offene Handfläche = Enter, Faust = Rücktaste, Kneifen = Leertaste usw.), konfiguriert über `components/HandCalibration.tsx`.
-   Drift-Sicherheitsstapel: Wenn der Kopf des Nutzers über `headTrackingDriftThresholdPx` über `headTrackingDriftWindowMs` aufeinanderfolgende Frames hinaus driftet, deaktiviert sich das Tracking automatisch und zeigt eine Neukalibrierungsaufforderung an (Nutzerbericht Mai 2026: Tracking würde stumm dem Drift über eine Stunde folgen und die tatsächlichen Tastenziele verfehlen).
-   **Esc-Notausgang** — das Drücken von Esc auf jeder Tastatur deaktiviert das Tracking sofort und zeigt die QWERTZ-Tastatur wieder an, ohne die Nachrichtenleiste zu verlieren.
-   Kamera-Stream-Singleton (`services/cameraStream.ts`), sodass Kopf- + Hand-Tracker einen Stream teilen; das Wechseln der Modi ist kostenlos.
-   Die Kalibrierung pro Nutzer bleibt erhalten; der Körper-Tracker erholt sich bei Sitzungswiederaufnahme automatisch.

**Detaillierte Dokumentation:** [`docs/TRACKING_MATH.md`](docs/TRACKING_MATH.md) (Kalibrierungsmathematik, Perzentil-Lerner, Ego-Motion, One Euro Filter, ~30 Einstellmöglichkeiten), [`docs/GESTURE_RECOGNITION.md`](docs/GESTURE_RECOGNITION.md), [`docs/TRACKING_RELIABILITY.md`](docs/TRACKING_RELIABILITY.md).
</details>

---

### ⚙️ Einstellungen
23 Sprachen, Thema (hell / dunkel / hoher Kontrast), Rastergröße (4–20 Kacheln), motorische Anpassungen (Mathematik-Haltezeit-Verweildauer, Zwei-Treffer-Vergrößerung, Kopfverfolgungs-Verweildauer, Gestenempfindlichkeit, Drift-Auto-Deaktivierung), Stimmenauswahl (kostenpflichtig), KI-Autokorrektur ein/aus, Benachrichtigungen, Symbolleistenanpassung, Historienregion-Auswahl.

![Einstellungen — Sprachauswahl + Themenumschalter](../../docs/screenshots/panel-settings.png)

<details>
<summary><strong>Mathematik- + Barrierefreiheitseinstellungen</strong></summary>

![Einstellungen — Mathematik-Haltezeit + Zwei-Treffer-Vergrößerung](../../docs/screenshots/panel-settings-math.png)

-   **Mathematik-Haltezeit-Verweildauer** — 0–1500 ms Schieberegler; 0 = sofortiger Klick, 200–1500 ms hilft Nutzern mit motorischer Ungenauigkeit (ein grüner Fortschrittsring füllt sich während des Verweilens, damit sie es sehen können).
-   **Zwei-Treffer-Vergrößerung** — erster Tipp auf eine beliebige Mathematik-Taste aktiviert sie (1,4-fache Skalierung + grüner Heiligenschein, kein Commit), zweiter Tipp bestätigt. 2 s automatische Deaktivierung. Kombiniert sich mit der Haltezeit-Verweildauer.
-   **Kopfverfolgungs-Verweildauer** — 200–5000 ms.
-   **Empfindlichkeit** — 1–10.
-   **Drift-Auto-Deaktivierung** — Umschalter + Schwellenwert (px) + Fenster (ms).
-   **Handkalibrierung anzeigen** — öffnet den Handhaltungs-Profil-Editor.

</details>

<details>
<summary><strong>Eingabemodi — Sprache, Gesten, KI-Autokorrektur</strong></summary>

![Einstellungen — Eingabemodi-Panel](../../docs/screenshots/panel-settings-input-modes.png)

-   **Spracheingabe** — Web Speech API, sprachbewusst (britisches Englisch vs. amerikanisches Englisch usw.); kostenlose Stufe
-   **KI-Autokorrektur & Vervollständigung** — jede Tastendruckpause wird über die Cloud-Autokorrektur geleitet (Gemini 2.5 Flash-Lite). Standardmäßig in Szenarien mit geringer Bandbreite deaktiviert.
-   **Benachrichtigungen** — Alarm + Cross-Tab-Benachrichtigung bei eingehenden UK-Chat-Nachrichten.
-   **Kameraeingabe** — Hauptschalter für Kopf- + Handverfolgung.
-   **Kamera-Tracking-Ziel** — Kopf, Hand oder automatische Erkennung.

</details>

<details>
<summary><strong>Symbolleistenanpassung</strong></summary>

Die Symbolleiste ist vollständig neu anordenbar. Standard 0.9.0 wird mit einem minimalen Satz (Mikrofon, UK-Chat, Alarm, Kategorien, Einstellungen) ausgeliefert, damit der Bildschirm für neue Nutzer übersichtlich bleibt — jede andere integrierte Funktion (Mathematik, KI-Chat, Zeitplan, Spiele, Marktplatz, Komfort-Player, Notizen, Verlauf, Ton) kann mit einem Tipp in Einstellungen → Symbolleiste wieder aktiviert werden. Über den Marktplatz installierte Apps werden automatisch nach den integrierten Apps eingefügt.

</details>

---

## Ausprobieren

| | |
|---|---|
| 🌐 **Web-App** | [synalux.ai/prism-aac](https://synalux.ai/prism-aac) — in jedem Browser ausprobieren |
| 📱 **iOS** | [App Store](https://apps.apple.com/app/id6764692277) — iPhone, iPad, Apple Watch |
| 💻 **Quellcode** | Dieses Repo. AGPL-3.0 — frei forken, Änderungen teilen |

---

## Pläne

| | Kostenlos | Kostenpflichtig |
|---|---|---|
| Bildkacheln + 22 Kategorien | ✅ | ✅ |
| Tippen zum Sprechen | ✅ | ✅ |
| Standardstimme (Inworld) | ✅ | ✅ |
| 19-Fächer-Schultastatur + KI-Tutor | ✅ Basis | ✅ + Premium-Modelle |
| Zeitplan | ✅ | ✅ + Belohnungsshop |
| Spiele | 3 (Blasen platzen lassen, Farbenjagd, Meine Geschichte) | Alle 12 |
| Stimmenauswahl | — | ✅ alle Inworld-Stimmen |
| Sprachklonung (Ihre eigene Stimme) | — | ✅ |
| Betreuer-Notizen synchronisieren | — | ✅ |
| Wortvorhersage (nutzerspezifisches Lernen) | — | ✅ |
| Gebiets- + Regionshistorie | ✅ | ✅ |
| Freihändige Gesteneingabe | ✅ | ✅ |

[Synalux Preise ansehen →](https://synalux.ai/pricing)

---

## Klinische Sicherheit

-   **Der UK-Zugang wird niemals eingeschränkt.** Ein Kind muss immer seine Stimme haben.
-   **Keine PHI in der Cloud ohne Zustimmung.** Betreuer-Notizen werden vor dem Hochladen verschlüsselt.
-   **Audio bleibt lokal.** Spracheingabe wird im Browser über die Web Speech API transkribiert.
-   **Entwickelt von BCBAs.** Die Verfolgung verbaler Operanten entspricht der BACB Task List 5th Edition.
-   **Traumasensible Standardeinstellungen.** Keine Bestrafungsmechanismen. Belohnungsshop ist optional.

Mehr lesen: [`ACCESSIBILITY.md`](ACCESSIBILITY.md), [`SECURITY.md`](SECURITY.md).

---

## Infrastruktur & GDPR

### Multi-Regionen-Architektur

| Komponente | Region | Zweck |
|---|---|---|
| **Supabase US** | US East (Virginia) | Primäre Datenbank — Authentifizierung, Nutzerdaten, Betreuer-Notizen |
| **Supabase EU** | EU Central (Frankfurt) | GDPR-konform — EU-Nutzerdaten verlassen niemals die EU |
| **Vercel** | Global Edge | Web-App, API-Routen, CDN |
| **Inworld TTS** | US | Neuronale Text-zu-Sprache |
| **HuggingFace Hub** | US/EU | Modellgewichte (1.7B, 8B, 14B, 32B) |
| **Auf dem Gerät** | Gerät des Nutzers | llama.cpp Inferenz (iPhone/iPad/Mac) |

### GDPR-Konformität

Die Daten von EU-Nutzern werden ausschließlich in der Region Frankfurt (eu-central-1) gespeichert. Das Portal erkennt den Standort des Nutzers über den `x-vercel-ip-country`-Header von Vercel und leitet Datenbankoperationen an die entsprechende Supabase-Instanz weiter:

-   **EU-Nutzer** → `supabase-eu` (Frankfurt) — persönliche Daten, Authentifizierung, Präferenzen, Betreuer-Notizen
-   **Nicht-EU-Nutzer** → `supabase-us` (Virginia) — gleiche Datenkategorien, US-Gerichtsbarkeit
-   **KI-Inferenz** → auf dem Gerät (keine Daten verlassen das Gerät) oder Synalux API (keine PII gespeichert)
-   **TTS-Audio** → serverseitig generiert, an den Client gestreamt, nicht gespeichert

**Garantien zur Datenresidenz:**
-   Persönliche Daten von EU-Bürgern werden niemals über US-Server übertragen
-   Authentifizierungs-Tokens auf die regionale Supabase-Instanz beschränkt
-   Betreuer-Notizen im Ruhezustand verschlüsselt (Supabase AES-256)
-   Sprachaufnahmen (Komfort-Player) im Browser IndexedDB gespeichert — niemals hochgeladen
-   KI-Modell auf dem Gerät läuft lokal — keine Cloud-Telemetrie

**Recht auf Löschung:** Die Nutzerlöschung kaskadiert über Authentifizierung, Profile, Betreuer-Notizen und Nutzungsanalysen in der regionalen Datenbank. Selbst gehostete Instanzen können mit `supabase db reset` gelöscht werden.

### Kosten im großen Maßstab

| Nutzer | Supabase | Vercel | TTS | KI-Modelle | Gesamt |
|---|---|---|---|---|---|
| 0–1K | $50/Monat (2 Regionen) | $0 (Hobby) | ~$5/Monat | $0 (auf dem Gerät) | ~$55/Monat |
| 1K–10K | $50/Monat | $20/Monat (Pro) | ~$50/Monat | $0 | ~$120/Monat |
| 10K–100K | $50/Monat + Compute-Add-ons | $20/Monat | ~$200/Monat | RunPod $125/Monat | ~$395/Monat |

---

## KI-Modelle & Geräteunterstützung

Funktioniert auf jedem Apple-Gerät. Keine Cloud-Abhängigkeit für die Kern-UK-Kommunikation.

PrismAAC wählt automatisch das beste Modell aus, das Ihre Hardware ausführen kann, fällt bei eingeschränkten Geräten elegant zurück und benötigt niemals eine Internetverbindung für die grundlegende Kommunikation.

| Gerät | RAM | Modell | Genauigkeit | UK | Größe | Kosten |
|---|---|---|---|---|---|---|
| **iPad Pro M1/M2/M4** | 16 GB | 14B Q4_K_M (v36) | **100%** | 100% | 8,4 GB | $0 |
| **iPhone 15/16 Pro, iPad Air** | 8 GB | 8B Q4_K_M (v36) → 1.7B (OOM Fallback) | **100%** | 100% | 4,7 GB / 1,1 GB | $0 |
| **iPhone 12–14, ältere iPads** | <8 GB | 1.7B Q4_K_M (v42) | **100%** | 100% | 1,1 GB | $0 |
| **Mac M1+ über WLAN** | 16+ GB | 14B über Ollama (v36) | **100%** | 100% | 8,4 GB | $0 |

### Web-App-Kaskade

Die Web-App versucht zuerst die lokale Inferenz, dann fällt sie auf die Cloud zurück — so zahlen Nutzer mit installiertem Ollama $0 und Nutzer ohne erhalten trotzdem die volle Funktionalität.

<details>
<summary>Kaskaden-Flussdiagramm</summary>

```
  Nutzer sendet Nachricht
        |
        v
  +-- LOKALES OLLAMA (automatisch erkannt unter localhost:11434) --+
  |                                                                |
  |   14b (100%, ~1.1s) ─[Fehler]─> 8b (100%, ~0.8s) ─[Fehler]─> 1b7 (100%, ~1.6s)
  +-------------------------------------------------------------------+
         |
    [alle lokalen fehlgeschlagen?]
         |
         v
  +-- CLOUD-FALLBACK (Synalux API) --------+
  |  Claude Sonnet 4 (kostenpflichtig) / Gemini (kostenlos) |
  |  99% Genauigkeit, ~3s                                   |
  +-----------------------------------------+

  Auto-Sideload: Erster Start erkennt Ollama → zieht bestes Modell → für immer lokal.
```

</details>

### Native iOS-Kaskade

Die native App prüft beim Start den verfügbaren RAM, lädt das richtige Modell vom HuggingFace CDN (einmalig) herunter und führt die Inferenz über llama.cpp Metal aus. Kein Server. Kein Abonnement. Keine Daten verlassen das Gerät.

<details>
<summary>Kaskaden-Flussdiagramm</summary>

```
  App-Start
      |
      v
  RAM-Erkennung (os_proc_available_memory)
      |
      +── 16 GB+ (iPad Pro) ──> 14B Q4_K_M (8,4 GB) ──> 100%, ~1.1s
      |
      +── 8 GB (iPhone/iPad Air) ──> 8B Q4_K_M (4,7 GB) ──> 100%, ~0.8s
      |                                    |
      |                               OOM? → 1.7B Q4_K_M (1,1 GB) → 100%, ~1.6s
      |
      +── <8 GB ──> 1.7B Q4_K_M (1,1 GB) ──> 100%, ~1.6s

  Alle Pfade: llama.cpp Metal, $0 für immer, keine Daten verlassen das Gerät.
  WLAN-Upgrade: Einstellungen → Lokale KI → Mac-IP für 14B/32B eingeben.
```

</details>

### Tastatur-Layout-Modi (persistent)

Drei Modi wechseln mit einem einzigen Tipp — das gewählte Layout wird bei jedem Start gespeichert und wiederhergestellt.

-   **MAX KB** — Tastatur füllt den gesamten Bereich unter der Vorhersageleiste
-   **MIN KB** — Kategorien 75% / Tastatur 25%
-   **KB AUSBLENDEN** — Kategorien Vollbild, Tastatur ausgeblendet

<details>
<summary>Layout-Diagramm</summary>

```
  MAX KB                 MIN KB                 KB AUSBLENDEN
  +--------------------+ +--------------------+ +--------------------+
  | Symbolleiste       | | Symbolleiste       | | Symbolleiste       |
  | Vorhersageleiste   | | Vorhersageleiste   | | Begrüßungsbanner   |
  |                    | |                    | |                    |
  |  TASTATUR          | | Kategorien  (75%)  | | Kategorien         |
  |  füllt den gesamten| |                    | | (Vollbild)         |
  |  Bereich unter der | |--------------------| |                    |
  |  Vorhersage        | | Tastatur    (25%)  | |                    |
  | [123][v][  Leertaste]| |                    | |                    |
  +--------------------+ +--------------------+ +--------------------+
        |                      |                      |
        +-- [v] Taste ------->+-- Seitenleisten-Taste-->+-- Seitenleisten-Taste --+
        |                                                               |
        +<--------------------------------------------------------------+
```

</details>

### Kostenübersicht

| Pfad | Modell | Genauigkeit | Latenz | Kosten |
|---|---|---|---|---|
| iPad Pro 16GB | 14B Q4_K_M (v36) | **100%** | ~1.1s | **$0** |
| iPhone/iPad 8GB | 8B Q4_K_M (v36) → 1.7B (OOM Fallback) | **100%** | ~0.8s | **$0** |
| Jedes Gerät | 1.7B Q4_K_M (v42) | **100%** | ~1.6s | **$0** |
| WLAN zu Mac | 14B über Ollama (v36) | **100%** | ~1.1s | **$0** |
| Cloud (kostenlos) | Gemini 2.5 Flash | 99% | ~3s | Synalux übernimmt |
| Cloud (kostenpflichtig) | Claude Sonnet 4 | 99% | ~3s | Im Plan enthalten |

**Das Argument:** Jedes Kind erhält Claude-ähnliche Genauigkeit, egal ob es ein $329 iPhone SE oder ein $2.000 iPad Pro verwendet. Lokal-zuerst bedeutet keine Cloud-Abhängigkeit, keine monatlichen API-Gebühren, keine PHI-Exposition und Antwortzeiten unter einer Sekunde. Alle vier prism-coder Modelle erreichen **100%** im 102-Fall-Routing-Benchmark (v36/v7 System-Prompt, 3-Seed-Mittelwert, Mai 2026), ohne erfundene Tool-Aufrufe. Das 32B-Modell erreicht zusätzlich **300/300 (100%)** in der erweiterten eval_300 Suite (17 Tools, 9 Kategorien, 3-Seed validiert).

---

## Selbst hosten

```bash
git clone https://github.com/dcostenco/prism-aac.git
cd prism-aac
npm install
npm run dev    # http://localhost:3000
```

Synalux betreibt die kanonische gehostete Version (kostenlos + kostenpflichtig). Selbst-Hoster und Forks müssen Änderungen unter AGPL-3.0 veröffentlichen.

### Lokale KI-Modelle (keine Cloud-Kosten)

**Option A — In-App (empfohlen):** Einstellungen → 🤖 Lokale KI-Modelle → auf „Herunterladen“ neben einem beliebigen Modell klicken. Fortschrittsbalken enthalten. Funktioniert von iPad/iPhone im selben WLAN wie ein Mac mit Ollama.

**Option B — Kommandozeile:**

Installieren Sie [Ollama](https://ollama.com), dann:

```bash
ollama pull dcostenco/prism-coder:1b7   # 1,1 GB — jede Maschine, iPhone 12+ — 100% Routing (v42)
ollama pull dcostenco/prism-coder:8b    # 4,7 GB — iPhone/iPad 8GB, Mac M1+ — 100% Routing (v36)
ollama pull dcostenco/prism-coder:14b   # 8,4 GB — Mac 16GB+, iPad Pro — 100% Routing (v36)
ollama pull dcostenco/prism-coder:32b   # 16 GB  — Mac M2 Ultra+ (MoE) — 100% Routing (v7)
```

Fügen Sie zu `.env.local` hinzu: `LOCAL_LLM_URL=http://localhost:11434`

**iPad Pro / iPhone im WLAN:**
```bash
OLLAMA_HOST=0.0.0.0 ollama serve   # auf Mac
# Dann in den App-Einstellungen → Lokale KI → eingeben: http://<mac-ip>:11434
```

Automatisches Routing: 1.7B → jedes Gerät · 8B → mobil/Edge · 14B → Standard · 32B → Cloud/Enterprise. Cloud-Fallback, wenn Ollama unerreichbar ist.

---

<details>
<summary><strong>📚 Technische Architektur (Modell-Routing, Sprache, Gestenerkennung, Build-Details)</strong></summary>

**Stack**: Next.js, Zustand, Web Speech API (Transkription), Inworld TTS-2 + Azure Neural Fallback (Sprache), FaceLandmarker (Gesten).

**Modell-Routing** (serverseitig über Synalux-Portal):
-   **Auf dem Gerät** (Tasten-Tipp → Phrase): `prism-coder:1b7` (Qwen3-1.7B Q4_K_M, llama.cpp Metal) — kein Netzwerk, keine Kosten, ~1,6s
-   **Cloud einfach** (Chat, kostenlose Stufe): `prism-coder:14b` (Qwen3-14B feinabgestimmt) → Gemini 2.5 Flash Fallback
-   **Cloud komplex** (Argumentation, Pro-Stufe): `prism-coder:32b` (QwQ-32B feinabgestimmt) → Claude Sonnet 4 Fallback
-   **Autokorrektur + Wortvorhersage**: Gemini 2.5 Flash-Lite — 752 ms im Durchschnitt, mehrsprachig (ro/ru/es)
-   Geschwindigkeitskritische Pfade (Tasten-Tipp → Sprache) umgehen das Routing — blockiert niemals das Netzwerk
-   Routing-Genauigkeit ([102-Fall Prism-Evaluierung](https://github.com/dcostenco/prism-coder/tree/main/tests/benchmarks/prism-routing-100), v36/v7 System-Prompt, 3-Seed-Mittelwert, Mai 2026):

  | Modell | Genauigkeit | Durchschnittliche Latenz | Erfundene Tools |
  |---|---|---|---|
  | prism-coder:32b swe14 (lokal) | **100,0%** | 1,4s | 0 |
  | 14B→32B Kaskade (lokal) | **100,0%** | ~1.1s | 0 |
  | prism-coder:8b v36 (lokal) | **100,0%** | 0,8s | 0 |
  | prism-coder:14b v36 (lokal) | **100,0%** | 1,1s | 0 |
  | Sonnet 4 (Cloud) | **99%** | 3,2s | 0 |
  | Opus 4.7 (Cloud) | **98,3%** | 3,0s | 0 |
  | prism-coder:1b7 v42 (lokal) | **100,0%** | 1,6s | 0 |

-   Erweiterte Evaluierung — eval_300 (300 Fälle, 17 Tools, 9 Kategorien, 3-Seed): prism-coder:32b = **300/300 (100%)**

**Sprach (TTS) Fallback-Kette:**
-   Stufe 1: Inworld TTS-2 (kostenpflichtig alle Sprachen; kostenlos für ro/uk/ru/de/ko/ar, wo Synalux die Kosten übernimmt)
-   Stufe 2: OS Web Speech API Premium-Stimmen (offline)
-   Stufe 3: WASM espeak-ng (letzter Ausweg)

**Gestenerkennung**:
-   Basis: Kopfhaltung + Verweil-Klick über FaceLandmarker
-   Erweitert: Handhaltung über MediaPipe; nutzerspezifische Gestenprofile

**Architektur**: Modal-only-Navigation (kein Router), Thema über tokens.bg/text/border/accent.

**Detaillierte Dokumentation in diesem Repo:**
-   [`docs/TTS-ARCHITECTURE.md`](docs/TTS-ARCHITECTURE.md) — vollständiges Sprach-Routing
-   [`docs/GESTURE_RECOGNITION.md`](docs/GESTURE_RECOGNITION.md) — Interna des Gestenmodus
-   [`docs/ADAPTIVE-ENGINE-BEHAVIOR.md`](docs/ADAPTIVE-ENGINE-BEHAVIOR.md) — automatische Tonumschaltung
-   [`docs/EMERGENCY-NATIVE-ARCHITECTURE.md`](docs/EMERGENCY-NATIVE-ARCHITECTURE.md) — lebenswichtiger Alarmpfad
-   [`docs/SELF-LEARNING-SAFETY.md`](docs/SELF-LEARNING-SAFETY.md) — nutzerspezifische Lern-Leitplanken
-   [`docs/TRACKING_RELIABILITY.md`](docs/TRACKING_RELIABILITY.md) — Zuverlässigkeits-Harness für Kopf-/Hand-Tracking
-   [`PRECISION_TOUCH.md`](PRECISION_TOUCH.md) — Barrierefreiheit von Berührungszielen
-   [`ACCESSIBILITY.md`](ACCESSIBILITY.md) · [`SECURITY.md`](SECURITY.md) · [`GOVERNANCE.md`](GOVERNANCE.md) · [`AGENTS.md`](AGENTS.md)
-   [`RESEARCH.md`](RESEARCH.md) — Evidenzbasis
-   [`CHANGELOG.md`](CHANGELOG.md) — Versionshistorie

</details>

<details>
<summary><strong>🆕 Warum PrismAAC anders ist (der zugrunde liegende Algorithmus-Stack)</strong></summary>

**Drei Dinge, die keine andere UK-App auf dem Markt zusammen bietet:**

### 1. KI auf dem Gerät + HIPAA-sicher standardmäßig

**Warum lokale KI für UK wichtig ist — Geschwindigkeit, Sicherheit und Zuverlässigkeit:**

| | Nur Cloud-KI | PrismAAC (lokal-zuerst) |
|--|---|---|
| Tasten-Tipp → Sprache | 2–30s (Netzwerk-Roundtrip) | **~0.5s** (auf dem Gerät) |
| Funktioniert offline | ❌ Nein | ✅ Ja |
| PHI verlässt Gerät | ✅ Immer | ❌ Nie (Sprachpfad) |
| HIPAA-Konformität | Erfordert BAA mit jedem Anbieter | **Auf dem Gerät = kein BAA erforderlich** |
| Ländlich / schlechtes WLAN | Kaputt | **Voll funktionsfähig** |
| Monatliche Kosten pro Nutzer | $2–15 API-Gebühren | **$0 (lokal)** |

**Das 1.7B-Modell läuft vollständig auf Ihrem Gerät** — iPad M1+, Mac oder Laptop. Ein Kind, das eine Taste drückt, erhält eine Antwort in ~500 ms ohne Netzwerkaufrufe. Keine PHI, keine Äußerungen, keine Kommunikationsmuster verlassen das Gerät während des normalen Gebrauchs.

Betreuer-Notizen werden lokal verschlüsselt, bevor eine optionale Cloud-Synchronisierung erfolgt. Vergleichbare Cloud-only UK-Plattformen (TouchChat, Proloquo2Go Cloud-Synchronisierung) erfordern Konto-Uploads, um zu funktionieren — PrismAAC nicht.

**Für Unternehmens- / klinische Bereitstellungen (14B + 32B):** Die 14B- und 32B-Modelle laufen auf einem dedizierten Mac über Ollama im klinischen Netzwerk. iPads verbinden sich über das lokale WLAN — Daten verlassen das Gebäude niemals. Keine Cloud-Anbietervereinbarungen für HIPAA-Konformität erforderlich.

**So richten Sie es ein:**

```
iPad / iPhone (im selben WLAN wie Mac)
    ↓  verbindet sich mit
Mac mit Ollama (OLLAMA_HOST=0.0.0.0)
    ↓  dient
prism-coder:1b7 · :14b · :32b
    ↓  alle Inferenzen bleiben auf
Lokales Netzwerk — nichts erreicht das Internet
```

Einstellungen → 🤖 Lokale KI-Modelle → Mac-IP eingeben → alle Modelle sofort verfügbar. Keine Cloud-Kosten. Keine PHI-Exposition. Keine Netzwerkabhängigkeit für die UK-Kommunikation.

### 2. Phrasen-Ranking, das sich IHREM Kind anpasst
Statische Frequenzlisten sind obsolet. PrismAAC ordnet vorgeschlagene Phrasen über [**Prism v14.0.0 Spreading Activation**](https://github.com/dcostenco/prism-coder/blob/main/docs/WOW_FEATURES.md) — dasselbe kognitive Gedächtnismodell ACT-R, das hinter Jahrzehnten der Carnegie Mellon-Forschung steht. Aktualität × Häufigkeit × nutzerspezifische Historie, keine statische Beliebtheitsliste. Phrasen, die das Kind heute sagt, steigen auf; Phrasen, die ein Jahr lang nicht verwendet wurden, verblassen (Lernraten-Zerfall `d=0.25`, ~1 Jahr Halbwertszeit).

### 3. Betreuer-Korrekturen werden automatisch zu Trainingsdaten
Wenn ein Betreuer einen Vorschlag korrigiert, den das Modell falsch verstanden hat (z.B. „nein, das Wort ist *essen*, nicht *wollen*“), extrahiert der [audit-hooks postflight harvester](https://github.com/dcostenco/prism-coder/blob/main/docs/WOW_FEATURES.md#7-the-recipe-combining-all-of-the-above) den Fehler und speichert ihn. Nach ~50 Sitzungen warnt das System, *bevor* das Modell einen ähnlichen Fehler macht. Keine Beschriftungsarbeit für Betreuer, keine teuren Umschulungsläufe — die Korrekturen sind der Lehrplan.

**Ehrlicher Umfang:** Routing-Genauigkeit bei der [102-Fall Prism-Evaluierung](https://github.com/dcostenco/prism-coder/tree/main/tests/benchmarks/prism-routing-100) (6 Prism-Tools, 12 Kategorien, v36/v7 System-Prompt, Seeds 2027–2029): 32b v7 = 100,0%, 8b v36 = 100,0%, 14b v36 = 100,0%, 1,7b v42 = 100,0%. Keine erfundenen Tool-Namen über alle Modellgrößen und alle Seeds hinweg. Das 1,7B läuft auf dem Gerät für schnelles Phrasen-Routing (Laden/Speichern/Kompaktieren); die 14B/32B handhaben komplexe Sitzungen und klinische Workflows. Auf der vollständigen Berkeley BFCL V4-Bestenliste (über 2.000 Fälle, allgemeiner Funktionsaufruf) erreicht das 1,7B ~59% — vergleichbar mit anderen Modellen unter 2B. Was PrismAAC verteidigungsfähig macht, ist nicht nur der Modell-Score allein — es ist das Modell plus der umgebende Prism Spreading-Activation-Algorithmus-Stack.

</details>

---

## Lizenz

[AGPL-3.0](LICENSE) — Open Source, OSI-genehmigt, förderfähig.

Es steht Ihnen frei, zu forken und selbst zu hosten. Die Lizenz verlangt, dass Sie Änderungen ebenfalls unter AGPL-3.0 teilen — das ist die Vereinbarung, die UK-Innovationen offen und für Familien zugänglich hält.