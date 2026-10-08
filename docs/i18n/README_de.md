<!-- Auto-generated from README.md by scripts/generate_i18n.py — do not edit manually -->
# Prism AAC

**Unterstützung für nichtsprechende Kinder und Erwachsene beim Kommunizieren.**

App für Unterstützte Kommunikation (UK) für Kinder mit motorischen Einschränkungen und komplexem Kommunikationsbedarf. Tippe auf Bilder, baue Sätze und lasse sie laut vorlesen — in 25 Sprachen (28 Gebietsschemata). Läuft auf jedem Tablet, Laptop, iPhone, iPad und jeder Apple Watch.

Teil der [Synalux-Plattform](https://synalux.ai).

**Jetzt ausprobieren:**
- **Web-App (kostenlos):** [synalux.ai/prism-aac](https://synalux.ai/prism-aac) — funktioniert auf jedem Gerät mit einem Browser
- **iOS (iPhone + iPad + Apple Watch):** [App Store](https://apps.apple.com/app/id6764692277)
- **Preise:** [synalux.ai/pricing](https://synalux.ai/pricing) — kostenlos, zusätzlich optionaler Prism AAC Cloud-Tarif (4,99 US$/Monat) für natürlich klingende Sprachausgabe und Cloud-AI-Kontingente

🌐 [English](../../README.md) · [Español](README_es.md) · [Français](README_fr.md) · [Português](README_pt.md) · [Română](README_ro.md) · [Українська](README_uk.md) · [Русский](README_ru.md) · **Deutsch** · [日本語](README_ja.md) · [한국어](README_ko.md) · [中文](README_zh.md) · [العربية](README_ar.md)

<p align="center">
  <a href="https://apps.apple.com/app/id6764692277"><img src="https://img.shields.io/badge/App_Store-Download-0D96F6?style=for-the-badge&logo=apple&logoColor=white" alt="App Store"></a>
  <a href="https://synalux.ai/prism-aac"><img src="https://img.shields.io/badge/Try_It-Free-43e97b?style=for-the-badge" alt="Kostenlos testen"></a>
  <a href="https://synalux.ai/pricing"><img src="https://img.shields.io/badge/Plans-Free_+_Paid-764ba2?style=for-the-badge" alt="Preise"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue?style=for-the-badge" alt="AGPL-3.0"></a>
  <a href="../../PRIVACY.md"><img src="https://img.shields.io/badge/Privacy-Policy-lightgrey?style=for-the-badge" alt="Datenschutz"></a>
  <a href="../../TERMS.md"><img src="https://img.shields.io/badge/Terms-of_Service-lightgrey?style=for-the-badge" alt="AGB"></a>
</p>

![Prism AAC Hauptbildschirm auf dem iPad — Symbolleiste, Eingabezeile, fünf Vorhersage-Kacheln und die vollständige QWERTY-Tastatur (Produktions-Web-App, 1.9.0)](../../docs/screenshots/app-hero.png)

### Native Apps

<p align="center">
  <img src="../../docs/screenshots/ios-iphone.png" alt="PrismAAC auf dem iPhone" width="220" />
  <img src="../../docs/screenshots/ios-ipad.png" alt="PrismAAC auf dem iPad" width="360" />
  <img src="../../docs/screenshots/watch-ultra.png" alt="PrismAAC auf der Apple Watch Ultra" width="120" />
</p>

<sub>iPhone- und iPad-Rahmen aufgenommen von Build 1.9.0 (53) der Produktions-Web-App, 08.09.2026. Apple Watch-Rahmen von Build 1.4.0.</sub>

| Plattform | Status | On-Device AI | Hinweise |
|-----------|--------|--------------|----------|
| **Web** (PWA) | ✅ Produktion | Lädt automatisch das beste lokale Modell herunter | Jeder Browser, installierbar; Cloud-Tarif über Stripe |
| **iPad Pro 16GB** | ✅ Produktion | 4B On-Device AI (100% Genauigkeit) | Am schnellsten, vollständig privat; Cloud-Tarif über Apple In-App-Kauf |
| **iPhone Pro 8GB** | ✅ Produktion | 4B Q4_K_M On-Device (100% Genauigkeit) | Automatische Auswahl basierend auf RAM |
| **Alle iPhones** | ✅ Produktion | 2B Q3_K_M On-Device (99,1% Genauigkeit) | 2,3 GB — passt auf jedes iPhone |
| **Apple Watch** | ✅ Produktion | Offline-Phrasen (1.261 × 20 Sprachen) | Eigenständig — Piktogramme, TTS, Notfall |
| **Chrome-Erweiterung** | ✅ Produktion | — | Leseassistent in jedem Textfeld |
| **WLAN zu Mac** | ✅ Produktion | 9B/27B über Ollama | Einstellungen → Lokale AI → Mac-IP eingeben |

---

## App Store-Vorschauvideo

30-sekündiges Video, das alle wichtigen Funktionen mit Inworld-TTS-Sprachausgabe zeigt:

https://github.com/dcostenco/synalux-docs/releases/download/v1.0-module-videos/prism_aac_preview_v5.mp4

| Szene | Funktion | Screenshot |
|---|---|---|
| **Startseite** — Phrasen antippen | Piktogramm-Tafel mit 22 Kategorien, Vorlesen-Button | <img src="../../docs/screenshots/appstore/ipad_home.png" width="200"> |
| **Kategorien** | Schnelle Phrasen für Hilfe, Essen, Orte, Gefühle | <img src="../../docs/screenshots/appstore/ipad_categories.png" width="200"> |
| **KI-Chat** | Nachrichten verfassen, Gespräche üben | <img src="../../docs/screenshots/appstore/ipad_ai-chat.png" width="200"> |
| **Notruf-Alarm** | Pflegekraft-/Pflegepersonal-Ruf mit einem Tipp | <img src="../../docs/screenshots/appstore/video/frame_03.png" width="200"> |
| **Tagesplan** | Visuelle Tagesroutinen — Morgen, Schule, Mittagessen, Schlafenszeit | <img src="../../docs/screenshots/appstore/ipad_schedule.png" width="200"> |
| **Spiele** | Seifenblasen platzen, Farbensuche, Zuordnen, Ja/Nein, Vervollständigen | <img src="../../docs/screenshots/appstore/ipad_games.png" width="200"> |
| **Mathe & Schule** | Adaptives Rechnen mit Hinweis, Prüfen, Lösen + Ziffernblock | <img src="../../docs/screenshots/appstore/video/frame_06.png" width="200"> |
| **Kopf- & Blicksteuerung** | Kamerabasierter Verweilcursor, Blicksteuerung, Kalibrierung | <img src="../../docs/screenshots/appstore/video/frame_07.png" width="200"> |
| **12 Sprachen** | Englisch, Spanisch, Französisch, Russisch, Japanisch, Koreanisch, Chinesisch, Arabisch & mehr | <img src="../../docs/screenshots/appstore/video/frame_08.png" width="200"> |

---

## Auf einen Blick

| Modul | Funktion | Vorschau |
|---|---|---|
| 📂 **Kategorien** | Symbolkarten im PECS-Stil für Nicht-Lese-Kundige | <img src="../../docs/screenshots/panel-categories.png" width="120"> |
| ⌨️ **Tippen & Sprechen** | Tastatur + Wortvorhersage + neuronale Stimme | <img src="../../docs/screenshots/app-hero.png" width="120"> |
| ✨ **KI-Chat** | Lokaler + Cloud-Assistent, optimiert für UK-Nutzer | <img src="../../docs/screenshots/panel-ai-chat.png" width="120"> |
| 💬 **UK-Chat** | Eingehende Nachrichten von Bezugspersonen + Kontakten | <img src="../../docs/screenshots/panel-aac-chat.png" width="120"> |
| 🧮 **Mathematik + Fächer** | Zelle-Raster-Arbeitsfläche mit fachspezifischem Tutor | <img src="../../docs/screenshots/math-canvas-typed.png" width="120"> |
| 🗓 **Tagesplan** | Visuelle Zuerst-Dann-Abläufe | <img src="../../docs/screenshots/panel-schedule.png" width="120"> |
| 🎮 **Spiele** | 12 therapeutische UK-Spiele | <img src="../../docs/screenshots/panel-games.png" width="120"> |
| 🏪 **Marktplatz** | Sprachpakete, Vokabularpakete, Spielepakete | <img src="../../docs/screenshots/panel-marketplace.png" width="120"> |
| 🎧 **Komfort-Player** | Medienplayer am Krankenbett für Patienten | <img src="../../docs/screenshots/panel-comfort-player.png" width="120"> |
| 🛏 **Bett-Modus** | Vollbild-KI-Chat für die Nutzung im Halter oder im Liegen | <img src="../../e2e/_screenshots/bedside-overlay-open.png" width="120"> |
| 👁 **Visueller Kontext** | Kamera erkennt Objekte → schlägt passende Sätze vor | <img src="../../docs/screenshots/vision-mealtime.png" width="120"> |
| 👋 **Freihändig** | Kopf- + Handgestenerkennung | <img src="../../docs/screenshots/panel-settings-input-modes.png" width="120"> |
| ⚙️ **Einstellungen** | 25 Sprachen, motorische Anpassungen, Sprachauswahl + Sprachspeicher | <img src="../../docs/screenshots/panel-settings.png" width="120"> |
| ☁️ **Cloud-Sprache und KI** | Optionales Guthaben für 4,99 US$/Monat für natürliche Stimmen + Cloud-KI | <img src="../../docs/screenshots/cloud-subscription-iphone.png" width="120"> |

---

## Barrierefreiheit

Prism AAC wurde im Juni 2026 einem [70 Punkte umfassenden gegnerischen Accessibility-Audit](ACCESSIBILITY.md) unterzogen und auf dem iPhone (Hoch- und Querformat) sowie dem iPad (Hoch- und Querformat) getestet. Jedes Problem wurde behoben und mit automatisierten E2E-Tests verifiziert.

### Eingabemethoden – nutzen Sie jeden Körperteil

| Methode | Funktionsweise | Einrichtung |
|--------|-------------|-------|
| **Touch** | Standard-Tippen + Piktogramm-Kacheln | Funktioniert direkt nach der Installation |
| **Kopfsteuerung (Head Tracking)** | Kamera folgt Kopfbewegungen → Verweil-Klick (Dwell Click) | Einstellungen → Eingabemodi |
| **Blicksteuerung (Eye Gaze)** | Augenpositions-Gewichtung über den Kopf-Tracker | Einstellungen → Eingabemodi |
| **Tastersteuerung (Switch Scanning)** | Automatisches/manuelles Scanning mit Bluetooth-Taster, Tastatur oder Gamepad | Einstellungen → Eingabemodi → Tastersteuerung |
| **Gestenaktivierung** | Blinzeln, Nicken, Lächeln, Mund öffnen → zugewiesene Aktionen | Einstellungen → Eingabemodi → Gesten |
| **Spracheingabe** | Diktat mit KI-Autokorrektur, freihändig, Aktivierungswort | Mikrofonsymbol in der Werkzeugleiste |
| **Vereinfachte Tastatur** | Die 15 häufigsten Buchstaben in einem 3×5-Raster (automatisch bei Rastergröße 4) | Einstellungen → Rastergröße → 4 |

Navigation im Symbolfeld: Wischen Sie nach links/rechts innerhalb des Vokabularrasters oder der unteren Kategorieseite, um durch die Seiten zu blättern. Verwenden Sie auf einem Mac das horizontale Scrollen per Trackpad oder Klicken-und-Ziehen; die Pfeile am Rand bleiben weiterhin verfügbar. Das Umblättern wählt kein Wort aus – tippen oder klicken Sie gezielt auf eine Kachel, um sie auszuwählen. Vertikales Scrollen und Zoom-Gesten verändern die Seite nicht. Siehe [Wischnavigation und Testgrenzen](../../docs/SWIPE_NAVIGATION.md).

### Responsives Layout – iPhone & iPad, Hoch- & Querformat

<p align="center">
  <img src="../../docs/screenshots/a11y-2026-06-18/01-home-board-iphone-6.1.png" alt="iPhone Hochformat" width="160" />
  <img src="../../docs/screenshots/a11y-2026-06-18/01-home-board-iphone-6.1-land.png" alt="iPhone Querformat" width="280" />
  <img src="../../docs/screenshots/a11y-2026-06-18/01-home-board-ipad-13.png" alt="iPad Hochformat" width="240" />
</p>

### Visuelle Modi

<p align="center">
  <img src="../../docs/screenshots/a11y-2026-06-18/06-dark-high-contrast-iphone-6.1.png" alt="Dunkel + hoher Kontrast auf dem iPhone" width="160" />
  <img src="../../docs/screenshots/a11y-2026-06-18/06-dark-high-contrast-ipad-13-land.png" alt="Dunkel + hoher Kontrast auf dem iPad Querformat" width="340" />
</p>

- Design-Farbschemata für **Hell / Dunkel / Hoher Kontrast**
- System-Media-Queries für **`prefers-contrast: more`** und **`prefers-reduced-motion`**
- **Aufziehen zum Zoom (Pinch-to-zoom)** aktiviert (bis zu 5×) – WCAG 1.4.4-konform
- **16 Notfallwörter × 8 Sprachen** im Absturz-Wiederherstellungsmodus

Den vollständigen Audit-Bericht mit allen 70 Ergebnissen finden Sie unter [ACCESSIBILITY.md](ACCESSIBILITY.md).

---

## Sicherheit & Datenschutz

PrismAAC wird von Kindern, nichtsprechenden Erwachsenen und klinischen Populationen verwendet. Sicherheit ist kein Feature – sie ist eine Anforderung, die jeden Inferenzpfad prägt.

### Mehrschichtige Sicherheitsarchitektur

| Schicht | Was | Wo es läuft | Latenz |
|-------|------|---------------|---------|
| **L1 — Deterministisches Sicherheitsschranke** | Regex-basierte Krisen-/medizinische Abfangung | Client + Server (jeder Pfad) | 0 ms |
| **L2 — Modell-Sicherheitstraining** | Qwen3.5 RLHF-Ausrichtung | Auf dem Gerät + Cloud | Integriert |
| **L3 — Konfidenzschranke** | Weist kurze/unleserliche/aus der Prompt-Vorlage ausgetretene Ausgaben zurück | Auf dem Gerät + Server | 0 ms |
| **L4 — Fundierungsprüfer** | NLI-Prüfung: Aussagen müssen logisch aus den Beweisen folgen | Server (kostenpflichtige Stufen) | ~200 ms |

### Details zur L1-Sicherheitsschranke

Die L1-Schranke führt deterministische Regex-Prüfungen für **sowohl Eingabe als auch Ausgabe** über alle Inferenzpfade hinweg aus – einschließlich des lokalen Offline-Ollama-Pfads, der den Server vollständig umgeht.

**Was sie erfasst:** Krisenausdrücke in der ersten Person (Absicht zur Selbstschädigung), gefährliche medizinische Dosierungsanweisungen.

**Was sie (konzeptionell) NICHT erfasst:** generische klinische Begriffe ("dose of risperidone", "milligrams", "suicide prevention training"). Diese kommen in legitimen BCBA-/medizinischen Notizen vor und ihre Blockierung würde den klinischen Benutzern schaden, denen dieses Produkt dient. Auf die eigene Ausrichtung des 2B-Modells auf dem Gerät wird für die Sicherheit überhaupt nicht vertraut (es erreicht ~59 % bei allgemeinem BFCL V4). L1 ist der primäre deterministische Sicherheitsmechanismus.

**Bekannte L1-Einschränkungen:**
- **Ungleichmäßige Abdeckung von Sprachen.** Krisensätze werden auf Englisch und in anderen Sprachen abgeglichen, und die Mengen unterscheiden sich je nach Pfad. Die Web-KI-Chat-Schranke (`services/crisisSafetyFilter.ts`) gleicht auch spanische, französische, portugiesische, rumänische, russische, ukrainische, arabische, deutsche, japanische, koreanische, chinesische und bulgarische Sätze ab. Die Offline-Client-seitige Prüfung (`checkInputSafetyClient`) gleicht auch Spanisch, Französisch, Portugiesisch, Russisch, Arabisch, Deutsch und Ukrainisch ab. Die iOS-Schranke verfügt über eine eigene integrierte Liste (Englisch, Spanisch, Französisch, Rumänisch, Russisch, Arabisch und Hebräisch) und fügt beim Start Schlüsselwörter vom Server hinzu, wenn sie ihn erreichen kann. Muster für medizinische Dosierungen sind auf jedem Client-Pfad nur auf Englisch vorhanden. Eine unterstützte Sprache ohne Muster auf einem gegebenen Pfad ist nur durch das eigene Sicherheitstraining des Modells (L2) geschützt.
- **Regex ist ein Minimum, kein Maximum.** Umformulierte Notlagen ("I don't want to be here anymore") werden nicht abgeglichen. L1 erfasst definierte phrasierte Ausdrücke mit hohem Signalwert; L2 (Modellausrichtung) deckt den langen Tail ab.

**Abdeckung nach Pfad:**

| Pfad | L1 Eingabe | L1 Ausgabe | Hinweise |
|------|:--------:|:---------:|-------|
| Lokales Ollama (offline, Web) | ✅ Client-seitig | ✅ Client-seitig | `checkInputSafetyClient` + `checkOutputSafetyClient` |
| iOS auf dem Gerät (llama.cpp) | ✅ nativ | ✅ nativ | `SafetyFilter.swift` (`../../ios-native/PrismAAC/Sources/Safety/`); die Ausgabeprüfung fängt nur Jailbreak-Inhalte ab |
| Portal `/prism-aac/chat` | ✅ | Streaming* | Eingabe vor Modellaufruf geprüft |
| Portal `/prism-aac/infer` | ✅ | ✅ | Geteiltes Sicherheitsmuster-Modul |
| Portal `/prism-aac/inference` | ✅ | ✅ | Geteiltes Sicherheitsmuster-Modul |

*Streaming-Cloud-Antworten verlassen sich bei der Ausgabe auf die Modellsicherheit (L2) – L1 kann einen Token-Stream nicht während der Übertragung per Regex filtern.

### Wie eine Krisenabfangung aussieht

Wenn ein Benutzer über die AAC-Schnittstelle eine Notlage eingibt, gibt L1 sofort Folgendes zurück (bevor irgendein Modell läuft):

> "I'm concerned about your safety. Please call or text 988 (Suicide & Crisis Lifeline) right now — available 24/7. If in immediate danger, call 911. You are not alone."

### Datenschutz

- KI auf dem Gerät verarbeitet Prompts lokal – keine Daten verlassen das Gerät
- Cloud-Sprachdienste und Cloud-KI (falls verwendet) gehen über TLS an das Synalux-Portal; Text wird im Arbeitsspeicher verarbeitet und nicht gespeichert
- Es werden keine Benutzer-Prompts gespeichert oder für das Training verwendet
- Es ist kein Konto erforderlich; anonyme Nutzungs-/Fehler-Telemetrie (Datadog) enthält niemals getippten oder gesprochenen Text
- Siehe [PRIVACY.md](../../PRIVACY.md) für die vollständige Datenschutzrichtlinie

## Kostenlose Read & Write-Alternative

PrismAAC bietet jede Leseassistenz-Funktion, für die die meisten Unterstützte-Kommunikation-Nutzer Read & Write kaufen — kostenlos, im Browser und ohne erforderliches Konto für die Web-Version. Siehe [Tippen & Sprechen](#%EF%B8%8F-type--speak) für das Vorlesen am Satzende + Wort-Hervorhebung, [PDF-Reader](#-pdf-reader) und [Screenshot-Reader (OCR)](#-screenshot-reader-ocr) für Dokumente sowie die [Chrome-Erweiterung](#-chrome-extension--same-reading-assistant-features-in-any-text-field) für die app-übergreifende Abdeckung in Gmail / Docs / Word Online / überall sonst.

## PrismAAC im Vergleich

| | PrismAAC | TouchChat | Proloquo2Go | LAMP Words | TD Snap | CoughDrop | Snap Core First | Grid 3 | Tobii Dynavox |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Kamera → Phrasenvorschlag** (erkennt Objekte, schlägt Wörter vor) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Lokale KI auf dem Gerät** (99–100 % Routing, unterstützt HIPAA) | 🟢 | 🔴 | 🔴 | 🔴 | 🟡 | 🟡 | 🔴 | 🔴 | 🟡 |
| **Benutzerspezifisches Phrasen-Ranking** (passt sich jedem Kind an) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| Korrekturen durch Pflegekräfte **werden zu Trainingsdaten** | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **KI-Tutor** (Mathematik + 10 weitere Fächer) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Zellen-Raster-Mathe-Arbeitsfläche** | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Regionalspezifischer Verlauf** (280+ Regionen) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Freihändig** Kopf- + Hand- + Gesten- + Taster-Scanning | 🟢 | 🟡 | 🟡 | 🔴 | 🟢 | 🟡 | 🟡 | 🟢 | 🟢 |
| **Freihändiger KI-Chat** (Sprachschleife + Aktivierungswort + Nachttisch-Modus) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| Therapeutische **UK-Spiele** (12 integriert) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🟡 | 🟡 | 🔴 | 🔴 |
| **Open Source** (AGPL-3.0) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🟢 | 🔴 | 🔴 | 🔴 |
| **Kostenlose Stufe** (lebenswichtiger Grundzugang) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🟢 | 🔴 | 🔴 | 🔴 |
| **Marktplatz** für Sprachpakete | 🟢 | 🔴 | 🟡 | 🔴 | 🟡 | 🔴 | 🔴 | 🟡 | 🟡 |
| **Mehrsprachig** (25 Sprachen) | 🟢 | 🟢 | 🟢 | 🔴 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| **Notizen für Pflegekräfte** (Zuhause / Schule / Klinik) | 🟢 | 🔴 | 🔴 | 🔴 | 🟡 | 🟡 | 🟡 | 🔴 | 🟡 |
| **Apple Watch** Eigenständiger Modus | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Chrome-Erweiterung** als Leseassistent | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |

🟢 = Volle Unterstützung &nbsp;&nbsp; 🟡 = Teilweise &nbsp;&nbsp; 🔴 = Nicht verfügbar

> Der Vergleich spiegelt öffentlich zugängliche Produktinformationen mit Stand Mai 2026 wider. PrismAAC wird aktiv weiterentwickelt; Mitbewerber können im Laufe der Zeit Funktionen hinzufügen. Pull Requests sind willkommen, um diese Übersicht fair und aktuell zu halten — siehe `CONTRIBUTING.md`.
>
> Grid 3 und Tobii Dynavox verfügen über starke Hardware-Integrationen für Blicksteuerung + Taster-Scanning, die oben nicht abgebildet sind (hardwareabhängige, spezialisierte klinische Setups).

---

## iOS & Apple Watch

### iPhone / iPad

Nationale Swift-App, die die Web-Benutzeroberfläche in WKWebView + eine **Dual-Engine On-Device AI**-Architektur über llama.cpp Metal einbettet.

Um einen augenblicklichen, offlinefähigen KI-Zugriff auf allen Geräten zu garantieren, führt die App automatisch zwei verschiedene Modelle gleichzeitig aus, basierend auf dem verfügbaren Arbeitsspeicher des Geräts:

| Gerät | RAM | Konversations-KI | Routing-Genauigkeit | Autovervollständigung |
|---|---|---|---|---|
| iPad Pro M1/M2/M4 | ≥ 16 GB | 4B Q4_K_M (3,4 GB) | **100%** | 360M (integriert) |
| iPhone 15/16 Pro, iPad Air | 8–15 GB | 4B Q4_K_M (3,4 GB) | **100%** | 360M (integriert) |
| Alle anderen iPhones / iPads | < 8 GB | 2B Q3_K_M (2,3 GB) | **99,1%** | 360M (integriert) |

> Genauigkeit: BFCL-Benchmark, 115 Werkzeug-Routing-Fälle × 3 gemischte Seeds, Temperatur=0, Juni 2026.

#### On-Device AI — funktioniert offline ab dem ersten Start

Jedes Gerät wird mit einem in die App integrierten KI-Modell ausgeliefert. Kein Download, kein WLAN, kein Konto erforderlich — App öffnen und direkt kommunizieren.

| Gerät | Mitgeliefertes Modell | Größe | Funktion |
|---|---|---|---|
| **iPhone / iPad** | Qwen3.5-4B Q3_K_M | 2,3 GB | Werkzeug-Routing, Freihandmodus, Nachttisch-Modus, Aktivierungswort (99,1% Genauigkeit) |
| **Apple Watch** | SmolLM2-360M | 207 MB | Symbolerweiterung, Notfallphrasen, vorausschauender Text (100% Genauigkeit) |

Größere Modelle (9B, 27B) sind über Einstellungen → Lokale KI für das Routing vom WLAN zum Mac verfügbar (100% BFCL-Genauigkeit).

<details>
<summary><strong>Technische Details</strong></summary>

- **L1-Sicherheitssperre (deterministisch):** Abfangen von Krisen-/medizinischen Mustern via Regex sowohl bei der Eingabe (bevor ein Modell ausgeführt wird) als auch bei der Ausgabe (bevor sie den Benutzer erreicht). Muster zielen speziell auf Selbstschädigungsabsichten ab — generische klinische/pharmakologische Begriffe („Dosis von“, „Milligramm“) werden NICHT abgefangen, um die legitime klinische UK-Nutzung nicht zu blockieren.
- **Clientseitige Ausgabesicherheit:** Lokale Ollama-Ergebnisse durchlaufen vor der Anzeige `checkOutputSafetyClient` — Offline-Benutzer erhalten denselben L1-Schutz wie Cloud-Benutzer.
- **Konfidenzsperre:** On-Device-Ausgaben unterhalb von Längen-/Qualitätsschwellenwerten werden abgelehnt und an die Cloud eskaliert (kostenpflichtige Tarife) oder kontrolliert heruntergestuft (kostenloser Tarif).
- Arbeitsspeicherbewusste Steuerung verringert die Funktionalität schrittweise: Vollständige KI → Cloud-KI → Nur Kernfunktionen → Notfallmodus
- OOM-Auffangmodell (Out-of-Memory): 4B Q4_K_M → 2B Q3_K_M → 360M
- Safe-Area-Anpassung für Dynamic Island / Notch
- WCSession-Brücke für den Apple Watch-Notrufversand
- Keychain-gesicherte Authentifizierungs-Tokens

</details>

**Einstellungen → 🤖 Lokale KI-Modelle** — On-Device-Modelle herunterladen und verwalten:
- Erkennt Ollama automatisch unter `localhost:11434`
- WLAN zum Mac: iPad/iPhone → Mac Ollama (9B/27B bei 100% BFCL-Genauigkeit)
- Modellweiser Download mit Live-Fortschrittsbalken
- Modelle: `:2b` (2,3 GB) · `:4b` (3,4 GB) · `:9b` (5,8 GB) · `:27b` (16,8 GB)


### Apple Watch (eigenständig)

Funktioniert ohne iPhone — eigenständig mit Offline-Phrasenwörterbuch.

<p align="center">
  <img src="../../docs/screenshots/watch-series.png" alt="Watch Series 11" width="140" />
  <img src="../../docs/screenshots/watch-ultra.png" alt="Watch Ultra 3" width="140" />
</p>

- **Offline-Übersetzung:** 1.261 Phrasen × 20 Sprachen integriert (411 KB JSON) — sofortiges Nachschlagen, 100% genau, kein Netzwerk erforderlich
- 2-spaltiges Piktogramm-Raster mit ARASAAC-Bildern
- KI-Chat mit Diktat + Tastatureingabe (Cloud im Online-Zustand, Phrasenwörterbuch im Offline-Zustand)
- Notfallsystem: Countdown → WCSession → Mobilfunk-Rückfallebene → TTS
- Übersetzung mit TTS-Ausgabe (zuerst Offline-Wörterbuch, Cloud als Rückfallebene)
- Posteingang: Nachrichten von Pflegekräften/Bezugspersonen empfangen und beantworten
- Certificate Pinning (SPKI SHA-256) beim Notrufversand
- NFKC + 23-Token-Injektionsbereinigung auf allen KI-Pfaden

---

## 📊 Erkenntnisse-Dashboard für Bezugspersonen (v1.8)

Die App erfasst intern umfangreiche Verhaltensdaten — Vorhersagegenauigkeit, motorische Trends, Verlässlichkeit der Sprachausgabe, Stabilität der Kopf-Blicksteuerung, Kommunikationsmuster, Korrekturen durch Bezugspersonen. Bisher **gelangte nichts davon an die Bezugspersonen**. Die einzige Benutzeroberfläche für Bezugspersonen war ein einfaches Textnotizfeld.

Jetzt gibt es einen **Erkenntnisse-Tab** im Bezugspersonen-Bereich mit 7 Live-Überwachungs-Widgets, die jeweils von einer Hintergrund-Metrikerfassung unterstützt werden, die alle 5 Minuten läuft, ohne den Vorhersagepfad zu beeinträchtigen.

### Was Bezugspersonen sehen

| Widget | Was es Ihnen sagt | Klinischer Nutzen |
|---|---|---|
| **Vorhersageeffektivität** | „72 % Trefferquote ↑ ggü. vorherigen 24 Std.“ | Vokabularauswahl funktioniert — oder eben nicht |
| **Vokabularübernahme** | „45 aktiv · 12 neu · 8 ungenutzt“ | Welche Phrasen übernommen wurden, welche entfernt werden müssen |
| **Kommunikationsthemen** | „Top: Schule (35 %), Essen (22 %)“ | Verschiebungen der Themenverteilung können auf Rückschritte oder Umgebungsveränderungen hinweisen |
| **Motorik-Trend** | „Verweilzeit 850 ms ↓ (verbessert sich)“ | Motorische Kontrolle verbessert sich → kürzere Verweilzeit; verschlechtert sich → Überweisung zur Ergotherapie |
| **Blicksteuerungs-Verlässlichkeit** | „2 Abweichungen · 98 % Betriebszeit“ | Häufige Abweichungen → Sitzposition, Ermüdung, Kalibrierung prüfen |
| **Sprachausgabe-Verlässlichkeit** | „97 % Erfolg · 1 Rückfalllösung“ | Azure TTS fehlgeschlagen? API-Schlüssel abgelaufen? Verbindungsproblem? |
| **Korrekturaufwand** | „47 Korrekturen insgesamt“ | Steigende Korrekturrate = Modell muss für dieses Kind neu trainiert werden |

### Dashboard-Layout

| Bezugspersonen-Bereich | | ✕ |
|:---|:---|---:|

| + Notiz | Protokoll | **Erkenntnisse** |
|:---:|:---:|:---:|

> **Vorhersageeffektivität**
> `72 % Trefferquote` &nbsp;&nbsp; ↑ ggü. 24 Std.
> ![sparkline](https://img.shields.io/badge/trend-72%25_____85%25_____78%25_____72%25-4CAF50?style=flat-square)

> **Vokabularübernahme**
> `45 aktiv` · `12 neu` · `8 ungenutzt`
> `████████████████░░░░░░` übernommen 69 % / ausprobiert 18 % / ungenutzt 13 %

> **Kommunikationsthemen**
> `Schule` 35 % · `Essen` 22 % · `Spielen` 18 %
> ![sparkline](https://img.shields.io/badge/school-35%25-9C27B0?style=flat-square) ![sparkline](https://img.shields.io/badge/food-22%25-FF9800?style=flat-square) ![sparkline](https://img.shields.io/badge/play-18%25-2196F3?style=flat-square)

> **Motorik-Trend**
> `Verweilzeit 850 ms` &nbsp;&nbsp; ↓ verbessert sich
> ![sparkline](https://img.shields.io/badge/trend-1200____1100____950_____850ms-FF9800?style=flat-square)

> **Blicksteuerungs-Verlässlichkeit**
> `2 Abweichungen heute` · `98 % Betriebszeit`
> ![sparkline](https://img.shields.io/badge/uptime-98%25-4CAF50?style=flat-square)

> **Sprachausgabe-Verlässlichkeit**
> `97 % Erfolg` · `1 Rückfalllösung`
> `██████████████████████████████░` Azure 94 % / Web Speech 3 % / Fehler 3 %

> **Korrekturaufwand**
> `47 Korrekturen insgesamt` &nbsp;&nbsp; +3 diese Woche
> ![sparkline](https://img.shields.io/badge/trend-38_____41_____44_____47-795548?style=flat-square)

<sub>286 Datenpunkte · Letzte 7 Tage · Aktualisierung alle 5 Min.</sub>

### Architektur

```
PredictionBar tap --> recordPredictionHit() (dynamic import, ~0.01ms)
                                     |
        +--------------------------------------------+
        |      metricsCollector (5-min timer)         |
        |                                            |
        |  subscribeTtsHealth() ------> ttsAccum     |
        |  subscribeTrackingEvents() -> trackAccum   |
        |  getAdaptiveSignals() ------> motor/topics |
        |  corpusHealth() ------------> corrections  |
        |  phraseUsageStore ----------> vocabulary   |
        |                                            |
        |  flushBucket() -> metricsStore.buckets     |
        +--------------------------------------------+
                                     |
        +--------------------------------------------+
        |  metricsStore (zustand + localStorage)     |
        |  7-day rolling - 5-min buckets - 400KB     |
        +--------------------------------------------+
                                     |
        +--------------------------------------------+
        |  CaregiverInsightsTab (lazy-loaded)        |
        |  7 InsightCard widgets + SVG Sparkline     |
        |  Renders only when caregiver taps tab      |
        +--------------------------------------------+
```

### Leistungsgarantien

| Aspekt | Garantie |
|---|---|
| **Tastatureingabe-Pfad** | 0 ms Verzögerung — Treffer/Fehlversuche nutzen dynamische Importe + Zählerinkrementierung |
| **Arbeitsspeicher** | ~400 KB localStorage + ~50 KB RAM für 7 Tage |
| **Bundle-Größe** | ~2 KB JS (keine Diagramm-Bibliothek — reine SVG-Sparklines) |
| **Offline-Funktionalität** | 100 % localStorage — keine Netzwerkaufrufe |
| **iPad** | Vertikal scrollbare Karten, Sparklines in 120 × 32 px |
| **Datenschutz** | Keine HIPAA-relevanten Daten — nur betriebliche Zählwerte, geschützt hinter dem Bezugspersonen-PIN |

### Beispiel: Lesen des Vorhersageeffektivitäts-Widgets

```
Prediction Effectiveness
78% hit rate                    ↑ vs prior 24h
╭──╮ ╭╮╭─╮
│  ╰─╯╰╯ ╰──╮╭──
```

- **78 % Trefferquote**: In 78 % der Fälle tippte das Kind auf ein Wort aus der Vorhersageleiste, anstatt es manuell einzugeben. Dies bedeutet, dass das Vokabular gut zu den Kommunikationsmustern des Kindes passt.
- **↑ ggü. vorherigen 24 Std.**: Die Trefferquote hat sich im Vergleich zu gestern verbessert — die adaptive Engine lernt dazu.
- **Sparkline**: Zeigt den Trend der Trefferquote über die letzten 24 Stunden. Einbrüche können mit neuen Themen oder veränderten Umgebungen korrelieren.

Fällt die Trefferquote unter 40 %, muss das Vokabular wahrscheinlich aktualisiert werden — das Kind kommuniziert über Themen, die die Vorhersage-Engine nicht abdeckt.

### Beispiel: Lesen des Motorik-Trend-Widgets

```
Motor Trend
Dwell 1200ms                   ↑ declining
╭──╮
│  ╰──╮╭──╮╭─
```

- **Verweilzeit 1200 ms**: Das Kind muss das Ziel 1,2 Sekunden lang fixieren, um eine Auswahl auszulösen. Typischer Bereich: 800–2000 ms.
- **↑ verschlechtert sich**: Die Verweilzeit nimmt zu (das Kind benötigt mehr Zeit). Dies könnte auf Ermüdung, eine Medikamentenumstellung oder einen fortschreitenden motorischen Rückgang hinweisen.
- **Handlungsempfehlung**: Bleibt der Trend länger als 3 Tage bestehen, sollte eine ergotherapeutische Überprüfung veranlasst werden. Die App passt die Verweilzeit automatisch an, aber die zugrunde liegende Ursache sollte klinisch untersucht werden.

---

## Module

### 📂 Kategorien

Im Bild-Modus legt die Rastergröße die Anzahl der Kacheln pro Vokabularseite fest (4 bedeutet 2 × 2; 6 bedeutet 3 × 2). Wischen Sie nach links oder rechts über die Oberfläche, um zu blättern, oder nutzen Sie die Pfeiltasten neben dem Kategorietitel. Die Navigation fügt kein Wort hinzu und spricht nicht; tippen Sie auf eine Kachel, um sie auszuwählen. Die Seitenzahl wird für Screenreader angesagt, ohne dass eine separate visuelle Fußzeile mit der Seitenzahl erforderlich ist.

Bildkacheln im PECS-Stil. Tippen Sie auf eine Kategorie, tippen Sie auf eine Kachel, hören Sie das Wort und sehen Sie zu, wie es in der Nachrichtenleiste landet. Funktioniert für Nichtleser, Leseanfänger und fortgeschrittene Kommunizierende gleichermaßen. Kachelsätze und deren Reihenfolge personalisieren sich im Laufe der Zeit durch aktivierende Ausbreitung — Kacheln, die Ihr Kind am häufigsten tippt, rücken nach oben; Kacheln, die monatelang nicht genutzt wurden, verblassen.

**Surround-Layout** — Kategorien erscheinen in einer scrollbaren linken Spalte neben der Tastatur, sodass der AAC-Benutzer Bildkacheln tippen UND gleichzeitig schreiben kann, ohne den Modus zu wechseln. Die Vorhersageleiste bleibt sichtbar; beide Eingaben sind immer zugänglich.

![Kategorien im Surround-Modus — scrollbare Kategoriekarten links, vollständige Tastatur rechts](../../docs/screenshots/categories-surround-v2.png)

<details>
<summary><strong>Funktionen + technische Details</strong></summary>

- 22 Standardkategorien: Personen, Essen, Gefühle, Körper, Kleidung, Tiere, Orte usw.
- Betreuungspersonen können Kacheln pro Kind hinzufügen / entfernen / umordnen
- Jede Kachel enthält einen `textKey` für die Internationalisierung (i18n) — das Wechseln der App-Sprache benennt jede Kachel mit einem Tippen um
- Kachel-Piktogramme stammen von ARASAAC + einem kuratierten Set; Stimmklonen ermöglicht es Ihnen, die Stimme der Kachel an die der Geschwister oder Eltern des Kindes anzupassen (kostenpflichtige Stufe)
- N-Gramm-Lernen pro Benutzer: Ein Kind, das dreimal „Ich will essen“ tippt, sieht in der nächsten Sitzung „essen“ nach „will“ nach oben rücken
- Holografischer HRR-Speicher: Kontextbezogene Vorhersagen ohne Suche in ~0,2 ms über Rust WASM — +27 % Top-1-Genauigkeit bei zentralen AAC-Phrasen

**Render-Pfad:** `components/CategoryPanel.tsx` → `useCategoryStore` → Kacheln gezeichnet aus `constants/phrases.ts` (System) + Supabase-Überschreibungen pro Benutzer (kostenpflichtig). Kachel-Tipps rufen `messageStore.appendText(phrase)` auf und leiten über `aacSpeak()` für TTS weiter.
</details>

---

### ⌨️ Schreiben & Sprechen
Bildschirmtastatur mit **Wortvorhersage**, **KI-Autovervollständigung** und einer **Sprechen**-Taste mit einem Tippen, die die Nachrichtenleiste mit einer natürlichen neuronalen Stimme laut vorliest. Das Schreiben schult die Vorhersage-Engine: Wörter, die Ihr Kind am häufigsten tippt, erscheinen in der nächsten Sitzung früher.

![Prism AAC-Tastatur mit getipptem „hello“, Vorhersagekacheln und Sprechen-Taste](../../docs/screenshots/keyboard-typing.png)

**Leseassistenz-Funktionen (Read & Write-Parität)** — für Benutzer mit Lese-, Gedächtnis- oder kognitiven Anforderungen:

- **Wortweise sprechen** — jedes Wort wird über TTS genau in dem Moment wiedergegeben, in dem Sie die Leertaste tippen, sodass Sie hören, was Sie geschrieben haben, ohne auf den vollständigen Satz zu warten.
- **Satz sprechen bei `.?!`** — das Beenden eines Satzes mit einem Punkt, Fragezeichen oder Ausrufezeichen liest den gesamten Satz vor, damit Sie den Faden nicht verlieren (die Lücke, die NVDA für sehende Benutzer mit kognitiven Einschränkungen ungeeignet macht). Umschalten über Einstellungen → `speakOnSentenceEnd` (Standardmäßig aktiviert).
- **Wort-für-Wort-Hervorhebung beim Sprechen** — jedes gesprochene Wort leuchtet mit gelbem Hintergrund auf, während TTS es vorliest. Sehende Benutzer mit Leseschwäche können visuell folgen; die Hervorhebung folgt dem Audio, ohne dass ein spezielles Hardwaregerät erforderlich ist.

<details>
<summary><strong>Funktionen + technische Details</strong></summary>

- 5 Vorhersageplätze über der QWERTY-Tastatur, die bei jedem Tastenanschlag aktualisiert werden
- KI-Vervollständigung („hw“ → „how“, „togoso“ → „to go so“) über Synalux `text/correct` (Gemini 2.5 Flash-Lite, ~752 ms Ø, 4,3× günstiger als 2.5 Flash)
- Sprachübergreifende Sperre: Das rumänische `eu` gelangt nicht in die englische Leiste, selbst wenn beide Korpora geladen sind (sprachübergreifender Häufigkeitsvergleich)
- „Sprechen“ liest mit automatischer Tonanpassung (Aussage-, Frage- oder Ausrufesatz aus Satzzeichen abgeleitet)
- Sprachkette: Persistenter Sprach-Cache (Wiedergabe ohne Anfrage) → Cloud-Stimme über das Portal (Inworld TTS-2; Azure Neural für Sprachen, die Inworld fehlen; Gemini TTS als letzte Cloud-Option) → OS Web Speech (offline) → WASM espeak-ng (letzte Option). Siehe [`docs/TTS-ARCHITECTURE.md`](../../docs/TTS-ARCHITECTURE.md) und [`docs/SPEECH_CACHE.md`](../../docs/SPEECH_CACHE.md)
- Die Wort-Hervorhebung wird zeitlich geschätzt (~60 ms/Zeichen bei Sprechgeschwindigkeit=0.5, skaliert mit dem Geschwindigkeitsregler) — funktioniert über alle TTS-Stufen hinweg ohne Backend-Änderungen; präzise Synchronisierung über Azure `wordBoundary` ist eine zukünftige Pro-Funktion.
- 1,5 MB SQLite N-Gramm-Korpus pro Sprache; Unigramme + Bigramme + Trigramme; wird beim Sprachwechsel verzögert geladen (Lazy Loading)
- **Kontextueller HRR-Speicher** — suchfreie holografische Abfrage (229 KB Rust WASM), die aus jeder gesprochenen Phrase lernt. Kodiert Bigramme + Trigramme in einen holografischen Vektor; prüft bei jedem Tastenanschlag in ~0,2 ms. Additive Schicht — hebt die ersten 2 Vorhersagekacheln mit kontextuellen Treffern hervor, ohne Korpus-Vorhersagen zu entfernen.

**HRR-Vorhersage-Benchmark** (54 Unit-Tests + Precision-Suite mit 10 Szenarien):

| Szenario | Baseline Top-1 | HRR+ Top-1 | Zuwachs | Baseline MRR | HRR+ MRR | MRR-Zuwachs |
|----------|---------------|------------|------|-------------|---------|----------|
| Zentrale AAC-Phrasen (1x) | 36,7 % | 46,7 % | **+27,3 %** | 0,634 | 0,672 | +6,0 % |
| Zentrale AAC-Phrasen (5x täglich) | 36,7 % | 46,7 % | **+27,3 %** | 0,634 | 0,672 | +6,0 % |
| Persönliches Vokabular | 70,4 % | 81,5 % | **+15,8 %** | 0,809 | 0,883 | +9,2 % |
| Gemischt (alle Phrasen) | 47,2 % | 569 % | **+20,6 %** | 0,669 | 0,707 | +5,7 % |
| Sitzungsübergreifender Abruf | 80,0 % | 80,0 % | +0,0 % | 0,900 | 0,900 | +0,0 % |
| Mehrdeutige Präfixe | 66,7 % | 66,7 % | +0,0 % | 0,738 | 0,738 | +0,0 % |

Top-1 = korrektes Wort ist Kachel #1. Top-5 = korrektes Wort in irgendeiner Kachel. MRR = Mean Reciprocal Rank (höher = korrektes Wort erscheint früher). HRR reduziert die Top-5-Genauigkeit in keinem Szenario — null Regressionen. Die größten Gewinne gibt es beim persönlichen Vokabular (+9,2 % MRR) und bei zentralen AAC-Phrasen (+27,3 % Top-1).

**Render-Pfad:** `components/Keyboard.tsx` → `messageStore.appendChar` → `predictionStore.updatePredictions(text, lang)` → `engine/predictionEngine.ts` (Aktualität × Häufigkeit × N-Gramm-Boost) + optionales `services/textCorrectService.ts` KI-Overlay + `services/hrrContext.ts` HRR-Bigramm/Trigramm-Prüfung. Hervorhebung: `services/aacSpeak.ts` sendet `tts-highlight-start`-Ereignisse auf dem `ttsHighlightBus`; `components/MessageBar.tsx` abonniert und übergibt `activeWordIndex` an `ColoredText`.
</details>

---

### ✨ KI-Chat
Auf dem Gerät + Cloud-Assistent, abgestimmt auf die Stimme des AAC-Benutzers. Gestreamte Antworten, jede Zeile per Tippen in die Nachrichtenleiste einfügbar, damit die Urheberschaft beim Kind bleibt. Die kostenlose Stufe läuft über Gemini 2.5 Flash; kostenpflichtige Stufen werden für kurze Anfragen an Claude Sonnet 4 mit der prism-coder-Flotte geleitet.

**Cleaner KI-Modus** — Die Wortvorhersageleiste wird automatisch ausgeblendet, wenn der KI-Chat geöffnet ist (Vorhersagen sind beim Formulieren einer Frage irrelevant), wodurch der Fokus auf der KI-Antwort und der Senden-Taste bleibt.

**Freihand-KI-Chat** — Aktivieren Sie die 🔁-Taste in der Chat-Kopfzeile, um in eine kontinuierliche Sprachschleife zu gelangen: Das Mikrofon öffnet sich nach jeder KI-Antwort automatisch, sodass das Kind ein vollständiges Gespräch führen kann, ohne den Bildschirm zu berühren. Eine Statusleiste unter der Chat-Kopfzeile bestätigt, dass der Modus aktiv ist.

**Übersetzungsmodus** — Wenn die App-Sprache und die Ausgabesprache voneinander abweichen (z. B. Eingabe auf Portugiesisch, Ausgabe auf Englisch), wird jeder KI-Austausch automatisch über den Übersetzungspfad mit aktiviertem Streaming geleitet, sodass kein Geschwindigkeitsnachteil gegenüber dem einsprachigen Modus entsteht.

![KI-Chat-Panel — Vorhersageleiste im KI-Modus ausgeblendet, vollständige Tastatur unten zugänglich](../../docs/screenshots/panel-ai-chat-v2.png)

<details>
<summary><strong>Funktionen + technische Details</strong></summary>

- Inline-Panel über der Tastatur angedockt — niemals ein Modalfenster, das die Nachrichtenleiste verdeckt
- Spracheingabe über Web Speech API; Mikrofon-Taste zeigt Live-Zwischenskript
- Tippen Sie auf eine beliebige KI-Zeile, um sie in die Nachrichtenleiste zu kopieren (bewahrt die Urheberschaft — Valencia et al., CHI 2023)
- **Freihand-Schleife** — 🔁-Kopfzeilentaste; startet das Mikrofon 1 s nach Abschluss jeder KI-Antwort automatisch neu; `aria-pressed` + grüner Hintergrund bestätigen den Status; Statusleiste unter der Kopfzeile, während sie aktiv ist
- **„Hey Prism“-Aktivierungswort** — verfügbar im Nachttisch-Overlay; kontinuierliche `SpeechRecognition`-Sitzung erkennt die Phrase und löst das Mikrofon aus; nicht verfügbar, wenn die native iOS-Bridge die Audiositzung steuert
- Harter 15-s-Timeout auf Client-Seite + Wiederholen-Taste (damit das Panel bei Netzwerkausfall nicht bei „Denkt nach…“ hängen bleibt)
- 401 / Netzwerk / Timeout / Sonstige → benutzerfreundliche Fehlerzuordnung; zeigt niemals ungefiltert „Sitzung abgelaufen“ an
- Lokaler Ollama-Fallback (`prism-coder:2b`) im Offline-Betrieb; Gemischte Inhalte in der Praxis vom Browser-Ursprung `synalux.ai` blockiert, sodass der benutzerfreundliche Fehler ausgelöst wird

**Render-Pfad:** `components/AIChatPanel.tsx` → `services/aiService.askAI()` (oder `translateAI()` im Übersetzungsmodus) → SSE-Stream von Synalux `/api/v1/chat` mit `credentials: 'include'`. CORS erlaubt `synalux.ai` + localhost-Entwicklungsursprünge.
</details>

---

### 🛏 Nachttisch-Modus

> **Kritische Barrierefreiheitsfunktion.** Der Nachttisch-Modus existiert, weil manche Benutzer keine verlässliche Möglichkeit haben zu sprechen, zu schreiben oder einen Bildschirm zu berühren. Das Design muss zuerst für den schwersten Fall funktionieren: ein Patient, der im Intensivbett liegt, die Arme an den Seiten, beatmet, unfähig einen Ton zu erzeugen — und nur über Blicksteuerung oder einen einzelnen Hardware-Taster zwischen zwei Fingern kommuniziert.

Vollbild-KI-Kommunikations-Overlay, optimiert für Benutzer, die den Bildschirm nicht erreichen oder nicht zuverlässig sprechen können. Jedes Tippziel ist übergroß. Sprache ist ein Eingabepfad unter mehreren — nicht der einzige. Die Benutzeroberfläche ist vollständig über assistierende Technologien bedienbar: Tastersteuerung, Blicksteuerung, iOS-Sprachsteuerung, Kopfsteuerung oder eine Bildschirmtastatur, die mit einem einzigen Taster bedient wird.

Inspiriert von direktem Feedback aus der AAC-Community (r/AssistiveTechnology, Mai 2025) von Benutzern, die aus Krankenbetten, der postoperativen Genesung und der Palliativpflege heraus kommunizieren.

**Funktioniert das auf Mac / Windows?** Ja. Der Nachttisch-Modus ist eine Funktion einer Progressive Web App (PWA) — er läuft in jedem Browser auf jedem Gerät. Er ist nicht iOS-exklusiv.

---

#### Für wen ist das gedacht?

Der Nachttisch-Modus wurde für Benutzer mit einem breiten Spektrum an motorischen und sprachlichen Fähigkeiten entwickelt. Die Schnellphrasen-Karten (unten beschrieben) wurden speziell für Benutzer am schwersten Ende des Spektrums entwickelt — diejenigen, die überhaupt nicht sprechen können und nur sehr eingeschränkte oder gar keine Handbewegungen haben.

| Benutzerprofil | Empfohlene Eingabemethode |
|---|---|
| Kann sprechen, Arme eingeschränkt | Sprache (🎙 Mikrofon-Taste) + Freihand-Schleife |
| Etwas Lautbildung, unzuverlässige Sprache | „Hey Prism“-Aktivierungswort + Freihand-Schleife |
| Keine Sprache, kann Bildschirm tippen | Schnellphrasen-Karten (einzelnes Tippen) |
| Keine Sprache, eingeschränkte Motorik — ein Taster | iOS Schaltersteuerung oder Android Switch Access-Abtastung über Schnellphrasen-Karten |
| Keine Sprache, keine Handbewegung — Blicksteuerungsgerät | Blicksteuerungshardware (Tobii, EyeGaze Edge etc.) stellt sich als Mauszeiger dar — alle Karten sind navigierbar |
| Keine Sprache, kann Kopf bewegen | Kopfsteuerung (z. B. iOS Schaltersteuerung/Kopfzeiger, Kamerasteuerung auf dem iPhone 16) — Karten sind vollständige Navigationsziele |
| Tracheostomie / beatmet, keine Lautbildung | Schnellphrasen-Karten über Blicksteuerung oder Taster + Modus mit Unterstützung durch Betreuungspersonen |

---

#### Plattformunterstützung

| Plattform | Nachttisch-Modus | Schnellkarten | Freihand-Schleife 🔁 | Aktivierungswort 🎯 |
|---|:---:|:---:|:---:|:---:|
| Web — Mac / Windows / Linux (jeder Browser) | ✅ | ✅ | ✅ | ✅ |
| Web — iPhone / iPad (Safari) | ✅ | ✅ | ✅ | ⚠️ Nur Safari |
| Native iOS-App (App Store) | ✅ | ✅ | ✅ | ❌ Freihand nutzen |
| Android (Chrome / Edge) | ✅ | ✅ | ✅ | ✅ |
| Blicksteuerungsgerät (jedes — stellt sich als Maus dar) | ✅ | ✅ | ✅ | ✅ |
| Taster-Abtastung (iOS Schaltersteuerung) | ✅ | ✅ | ✅ | ❌ |
| Apple Watch | ❌ | ❌ | ❌ | ❌ |

> **Warum kein Aktivierungswort in der nativen iOS-App?** Die native Bridge übernimmt die Audiositzung (`prismNativeBridge.startVoice`), was mit der `SpeechRecognition`-API des Browsers kollidiert, die vom Aktivierungswort-Dienst genutzt wird. Verwenden Sie stattdessen die **Freihand-Schleife** (🔁) — sie startet das Mikrofon 1 Sekunde nach jeder KI-Antwort automatisch neu, ohne dass eine fortlaufende Eingabe erforderlich ist.

---

#### So starten Sie

1. Öffnen Sie das **KI-Chat**-Panel — tippen Sie auf das 🤖-Symbol in der Werkzeugleiste.
2. Tippen Sie auf **🛏** in der Panel-Kopfzeile — das Vollbild-Overlay öffnet sich sofort.
3. Wählen Sie Ihre Eingabemethode (siehe Abschnitte unten).

<p align="center">
  <img src="../../e2e/_screenshots/bedside-overlay-open.png" alt="Nachttisch-Modus-Overlay geöffnet — schwarze Vollbild-Benutzeroberfläche. Oberer Streifen zeigt Schnellphrasen-Karten. Mittlerer Bereich zeigt KI-Antworten. Unten zeigt große rote Mikrofon-Taste und Steuerungszeile." width="260">
  <img src="../../e2e/_screenshots/bedside-overlay-handsfree-on.png" alt="Nachttisch-Modus mit aktiver Freihand-Funktion — 🔁-Taste grün hervorgehoben, Statustext 'Freihand AN' sichtbar" width="260">
  <img src="../../e2e/_screenshots/bedside-hands-free-on.png" alt="Freihand-Umschalter im eingeschalteten Zustand — grüner Hintergrund, aria-pressed=true" width="260">
</p>

#### So beenden / verlassen Sie den Modus

- **Touch / Tippen:** Tippen Sie auf **✕** in der oberen rechten Ecke des Overlays (48 × 48 px Zielgröße).
- **Tastatur / Taster:** Drücken Sie **Escape**.
- **Sprache:** Sagen Sie einen beliebigen Befehl über die iOS-Sprachsteuerung, während das Overlay geöffnet ist.

Ihr vollständiger Chat-Verlauf und der KI-Sitzungsstatus bleiben beim Beenden erhalten. Das Overlay liegt als separate Render-Schicht über dem Hauptpanel — beim Schließen geht nichts verloren.

<p align="center">
  <img src="../../e2e/_screenshots/bedside-overlay-closed.png" alt="Nach dem Schließen des Nachttisch-Modus — zurück zum Haupt-KI-Chat-Panel mit intaktem Gesprächsverlauf" width="260">
  <img src="../../e2e/_screenshots/bedside-wakeword-statusbar.png" alt="Statusleiste des Hauptpanels zeigt 'Hey Prism aktiv' mit blauem Indikator nach der Rückkehr aus dem Nachttisch-Modus" width="260">
</p>

---

### 🃏 Schnellphrasen-Karten — für nicht-verbale und bewegungseingeschränkte Benutzer

> **Dies ist der kritische Pfad für Benutzer, die nicht frei sprechen oder den Bildschirm nicht berühren können.** Schnellphrasen-Karten sind vorprogrammierte Kommunikationstasten, die durch ein einzelnes Tippen, Verweilen mit der Blicksteuerung (Dwell) oder Auswählen per Taster-Abtastung aktiviert werden können. Kein Schreiben. Keine Sprache. Keine Internetverbindung zur Nutzung erforderlich.

Jede Karte zeigt ein großes Emoji-Symbol und eine kurze Phrase. Das Tippen auf eine Karte lädt diese Phrase sofort in die Nachrichtenleiste. Wenn der **Freihand-Modus** eingeschaltet ist, wird die Phrase automatisch an die KI gesendet.

#### Integrierte Karten

Fünfzehn Karten sind bei der ersten Nutzung vorgeladen, gruppiert nach Dringlichkeit. Sie können nicht gelöscht werden. Sie funktionieren offline.

**Dringend (höchste Priorität — diese in einem medizinischen Notfall zuerst kommunizieren):**

| Symbol | Phrase | Wann zu verwenden |
|:---:|---|---|
| 🆘 | HILFE — NOTFALL | Unmittelbare Gefahr, Notruf, jede Situation, die sofort Personal erfordert |
| 😢 | Ich habe Schmerzen | Schmerzen jeglicher Art — Ort/Intensität kann als Freitext folgen |
| 🫁 | Ich bekomme keine Luft | Atemnot, Sorge um die Atemwege, Panikattacke |
| 🔔 | Pflegekraft rufen | Anforderung von Personal außerhalb von Notfällen |

**Körperliche Bedürfnisse:**

| Symbol | Phrase | Wann zu verwenden |
|:---:|---|---|
| 💧 | Wasser bitte | Durst, trockener Mund, Medikamenteneinnahme |
| 🔥 | Mir ist zu warm | Fieber, Decke, Temperaturregulierung |
| 🥶 | Mir ist zu kalt | Schüttelfrost, Decke, Raumtemperatur |
| ↔️ | Bitte umlagern | Druckentlastung, Komfort, postoperative Positionierung |
| 💊 | Ich brauche meine Medikamente | Geplante Dosis, Bedarfsmedikation, Schmerzmittel |

**Kommunikation:**

| Symbol | Phrase | Wann zu verwenden |
|:---:|---|---|
| ✅ | Ja | Bestätigung — Beantwortung von Ja/Nein-Fragen der Betreuungsperson |
| ❌ | Nein | Ablehnung — Beantwortung von Ja/Nein-Fragen der Betreuungsperson |
| ⏳ | Bitte warten | Braucht einen Moment — noch nicht fortfahren |

**Emotional:**

| Symbol | Phrase | Wann zu verwenden |
|:---:|---|---|
| ❤️ | Ich liebe dich | Familie, emotionale Verbundenheit |
| 🙏 | Danke | Dankbarkeit |
| 😨 | Ich habe Angst | Angst, Furcht, Verzweiflung — löst einfühlsame KI-Antwort aus |

#### So verwenden Sie Schnellphrasen-Karten

**Einzelnes Tippen / Blicksteuerung / Tasterauswahl:**
Das Aktivieren einer Karte fügt ihren Text in die Nachrichtenleiste ein. Die Phrase kann dann:
- An die KI für eine kontextbezogene Antwort gesendet werden (z. B. Tippen auf „Ich habe Angst“ → KI antwortet mit Beruhigung und stellt weiterführende Fragen)
- So wie sie ist gelesen werden — Betreuungspersonen im Raum können die Karte sehen, die auf dem Bildschirm angeklickt wurde

**Bei eingeschaltetem Freihand-Modus:**
Die Phrase wird in dem Moment automatisch an die KI gesendet, in dem die Karte angeklickt wird. Das Mikrofon startet 1 Sekunde nach der Antwort der KI neu — wodurch eine kontinuierliche Schleife ohne weitere Eingabe entsteht.

**Mit aktivem „Hey Prism“-Aktivierungswort (Web / Desktop):**
Aktivierungswort + Schnellkarte können kombiniert werden: Der Benutzer sagt „Hey Prism“, um das Mikrofon zu öffnen, die KI antwortet, und der Benutzer kann dann auf eine Karte tippen, um das Gespräch in eine andere Richtung fortzusetzen, ohne erneut zu sprechen.

#### So fügen Sie benutzerdefinierte Karten hinzu

Betreuungspersonen, Verhaltenstherapeuten (BCBAs) und Familienangehörige können personalisierte Karten hinzufügen, die auf die spezifischen Kommunikationsbedürfnisse des Benutzers zugeschnitten sind — die Namen ihrer Ärzte, Lieblingsphrasen, spezifische Schmerzbeschreibungen, religiöse Ausdrücke oder alles andere.

**Schritte:**

1. Tippen Sie im Nachttisch-Modus am Ende des Schnellphrasen-Streifens auf **＋ Hinzufügen**.
2. Tippen Sie die Phrase ein, die Sie auf der Karte haben möchten (bis zu 80 Zeichen).
3. Tippen Sie auf **Karte hinzufügen** — die KI generiert automatisch ein Emoji-Symbol, das zur Bedeutung der Phrase passt (z. B. „Gib mir mehr Decken“ → 🛏, „Ich möchte beten“ → 🤲).
4. Das Symbol erscheint mit einer kurzen Animation „✨ Generieren…“, dann wird die Karte gespeichert.

Benutzerdefinierte Karten werden lokal auf dem Gerät gespeichert (localStorage). Sie bleiben über Sitzungen und App-Neustarts hinweg erhalten. Es ist kein Konto und keine Internetverbindung erforderlich, um gespeicherte Karten zu verwenden — nur die initiale Symbolgenerierung erfordert einen Netzwerkaufruf.

**Beispiele für benutzerdefinierte Karten, die Sie hinzufügen könnten:**

| Vorgeschlagene Phrase | Warum |
|---|---|
| `[Name des Arztes], bitte kommen` | Schneller als ein generisches „Pflegekraft rufen“ für einen bestimmten Arzt |
| `Ich muss mit meiner Familie sprechen` | Emotionale/rechtliche Situationen, die Angehörige erfordern |
| `Bitte das Licht ausschalten` | Sensorische Empfindlichkeit, Migräne, Schlaf |
| `Ich möchte beten` | Seelsorge — Würde in Situationen am Lebensende |
| `Etwas fühlt sich falsch an` | Unbestimmtes Signal für Wohlbefinden — veranlasst die KI, klärende Fragen zu stellen |
| `Ich brauche das Absauggerät` | Tracheostomie- / Beatmungspatienten |
| `Mein Zugang tut weh` | Alarm bei Infiltration, Phlebitis |
| `Ich möchte nach Hause` | Palliativ-/Entlassungsgespräche |

#### So löschen Sie benutzerdefinierte Karten

1. Tippen Sie in der Kopfzeile des Schnellphrasen-Streifens auf **✏️ Bearbeiten**.
2. Auf jeder benutzerdefinierten Karte erscheint ein rotes **✕**-Badge (integrierte Karten sind geschützt und können nicht entfernt werden).
3. Tippen Sie auf ✕ auf einer beliebigen Karte, um sie zu entfernen.
4. Tippen Sie auf **Fertig**, um den Bearbeitungsmodus zu verlassen.

#### Einrichtung der Taster-Abtastung (iOS)

Für Benutzer, die nur einen einzelnen externen Taster aktivieren können (Saug-/Pusteschalter, Kopftaster, Fußtaster, Kissentaster):

1. Verbinden Sie den Taster über Bluetooth oder den Lightning-/USB-C-Anschluss mit dem iPhone/iPad.
2. Gehen Sie zu **Einstellungen → Bedienungshilfen → Schaltersteuerung → Schalter** und weisen Sie den Taster der Aktion „Objekt auswählen“ zu.
3. Gehen Sie zu **Schaltersteuerung → Scannmethode** und wählen Sie „Automatisches Scannen“ — das Gerät hebt Objekte automatisch nacheinander hervor.
4. Öffnen Sie Prism AAC im Nachttisch-Modus. Die Schaltersteuerung scannt automatisch durch die Schnellphrasen-Karten. Aktivieren Sie Ihren Taster, wenn die gewünschte Karte hervorgehoben ist.
5. Die Phrase wird sofort gesendet — keine zweite Aktion erforderlich.

> Alle Schnellphrasen-Karten tragen `data-scan-group="quick-cards"`, sodass assistierende Technologien den gesamten Streifen als Gruppe scannen können, bevor sie zu anderen Benutzeroberflächenbereichen wechseln.

#### Einrichtung der Blicksteuerung

Blicksteuerungshardware (Tobii Dynavox, EyeGaze Edge, PCEye, MyTobii P10 etc.) stellt sich dem Betriebssystem als Standard-Mauszeiger mit Verweil-Klick (Dwell-Click) dar. In Prism AAC ist keine spezielle Konfiguration erforderlich:

1. Konfigurieren Sie die Verweilzeit in der Software Ihres Blicksteuerungsgeräts (empfohlen: 800–1200 ms für Erstbenutzer).
2. Öffnen Sie Prism AAC im Nachttisch-Modus in einem beliebigen Browser.
3. Verweilen Sie auf einer Schnellphrasen-Karte, um sie zu aktivieren.

Die Mindestkartengröße (88 × 80 px) erfüllt die WCAG 2.5.5 AAA-Zielgrößenanforderung von 44 × 44 CSS-px und übertrifft die typische Mindestempfehlung für die Interaktion mit der Blicksteuerung (60 × 60 px).

---

<details>
<summary><strong>Alle Funktionen + technische Details zur Implementierung</strong></summary>

**Fünf Subsysteme als eine Funktion ausgeliefert:**

1. **Schnellphrasen-Karten** — `services/bedsideCards.ts` + Streifen-UI in `components/BedsideOverlay.tsx`.

   - Speicher: `localStorage`-Schlüssel `prism_bedside_cards_v1`. Schema-validiert bei jedem Laden — fehlerhafte Einträge werden stumm verworfen.
   - Obergrenze: Maximal 50 benutzerdefinierte Karten (verhindert unbegrenztes Speicherwachstum).
   - Integrierte Karten: 15 Einträge mit `id`-Präfix `builtin-`; die Lösch-UI-Sperre prüft dieses Präfix, bevor das ✕-Badge angezeigt wird, um sicherzustellen, dass Standards niemals entfernt werden.
   - KI-Symbolgenerierung: `services/aiService.ts → inferCardIcon(text)`. Verwendet dieselbe lokale Ollama → Synalux Cloud-Routing-Kette wie der Rest der App. Sendet die Phrase als Benutzernachricht mit einem gesperrten System-Prompt („Antworte mit genau einem Emoji…“). Extrahiert den ersten Unicode-Codepunkt aus der Antwort. Wird immer aufgelöst — fällt bei Netzwerkfehlern oder Nicht-Emoji-Antworten auf 💬 zurück.
   - Offline: Karten funktionieren vollständig offline; nur das Hinzufügen einer neuen Karte erfordert ein Netzwerk (für die Symbolgenerierung — fällt offline auf 💬 zurück).

2. **Freihand-KI-Schleife (🔁)** — auch über die Haupt-KI-Chat-Kopfzeile zugänglich. Nach jeder KI-Antwort startet das Mikrofon automatisch neu (1 s Verzögerung). Ein `handsFreeRef` / `startListeningRef`-Ref-Muster stellt sicher, dass der Effekt immer den aktuellen Callback aufruft, ohne bei jedem Rendern erneut zu laufen.

   ![Freihand-Statusleiste im Haupt-KI-Panel](../../e2e/_screenshots/bedside-hands-free-statusbar.png)

3. **Nachttisch-Overlay** — `fixed inset-0 z-50 bg-black` Dunkle Vollbild-UI, gerendert als Geschwister-`<Fragment>` neben dem Haupt-KI-Panel, sodass der Panel-Status über Öffnen/Schließen-Zyklen hinweg erhalten bleibt. Barrierefreiheit: `role="dialog"`, `aria-modal="true"`, `aria-label="Bedside Mode"`, WCAG 2.1 SC 2.1.2 Fokusfalle (Tab/Umschalt+Tab wechselt innerhalb des Overlays, `Escape` schließt). Abdeckung des Ansichtsfensters unabhängig E2E-verifiziert (≤ 4 px Toleranz).

   - **Große Mikrofon-Taste** — 112 × 112 px (`w-28 h-28`), rot + pulsierend beim Zuhören, weißer Rahmen im Ruhezustand. Bestätigt ≥ 96 px durch Playwright `boundingBox()`.
   - **Schnellkarten-Streifen** — horizontale Scroll-Zeile, jede Karte `88 × 80 px`, `data-scan-group="quick-cards"` für Gruppierung bei Taster-Abtastung, `role="list"` / `role="listitem"` für Screenreader-Semantik.
   - **Steuerungszeile** — Freihand (grün wenn an), „Hey Prism“-Aktivierungswort (blau wenn an, ausgeblendet wenn `!wakeWordSupported`), iOS Sprachsteuerungsverknüpfung.
   - **Beenden** — ✕-Taste (`w-12 h-12`) oder `Escape` → `onClose()` → `bedsideModeActive = false` in `AIChatPanel` → WCAG 2.4.3 Fokus zurückgegeben an die 🛏-Taste, die den Dialog geöffnet hat.

   ![Nachttisch-Overlay — geschlossen, zurück zum Haupt-KI-Panel](../../e2e/_screenshots/bedside-overlay-closed.png)

4. **„Hey Prism“-Aktivierungswort** — `services/wakeWordService.ts`. Führt eine kontinuierliche `SpeechRecognition`-Sitzung im Hintergrund aus. Erkennt jedes Transkript, das „hey prism“ enthält, löst das Mikrofon einmal aus und setzt es dann für den nächsten Zyklus zurück. Schutz: wird nicht gestartet, wenn die native iOS-Bridge das Mikrofon besitzt (`prismNativeBridge?.startVoice` vorhanden). Der aktive Status des Aktivierungsworts wird nach dem Schließen des Overlays in der Statusleiste des Hauptpanels angezeigt.

   ![Statusleiste zeigt "Hey Prism" aktiv](../../e2e/_screenshots/bedside-wakeword-statusbar.png)

5. **Anleitung für iOS-Sprachsteuerung** — Das Tippen auf 📱 in der Steuerungszeile versucht `prismNativeBridge.openSettings('accessibility')` (Deep-Link zu den Bedienungshilfen auf unterstützten nativen Builds). Im Web / auf dem Desktop fällt es auf eine Anleitungskarte im Overlay zurück, die durch `Einstellungen → Bedienungshilfen → Sprachsteuerung → Ein` führt.

   <p align="center">
     <img src="../../e2e/_screenshots/bedside-voice-control-card.png" alt="Anleitungskarte für iOS-Sprachsteuerung — Schritt-für-Schritt-Anleitung im Nachttisch-Overlay, wenn 📱 im Web/Desktop angetippt wird" width="260">
     <img src="../../e2e/_screenshots/bedside-voice-control-dismissed.png" alt="Anleitungskarte für iOS-Sprachsteuerung nach dem Ausblenden — Overlay kehrt zum normalen Nachttisch-Layout zurück" width="260">
   </p>

**Testabdeckung:**
- `services/bedsideCards.test.ts` — 22 Unit-Tests: Standard-Kartensatz, localStorage-Roundtrip, Fallback bei fehlerhaftem JSON, Filterung ungültiger Karten, 50-Karten-Obergrenze, `createCard`-Feldeinschränkungen.
- `e2e/bedside-mode.spec.ts` — 17 Playwright E2E-Tests: Tasten-Sichtbarkeit, `aria-pressed`-Umschaltung, grün/blaue Statusklassen, Statusleistentext, Barrierefreiheitsattribute des Overlays, Mikrofon `boundingBox`-Größe, Abdeckung des Ansichtsfensters, Einblenden/Ausblenden der Anleitungskarte.

**Wichtige Dateien:**
- `components/AIChatPanel.tsx` — Nachttisch-Status, Karten-Status (`bedsideCards`), `handleAddBedsideCard`, `handleDeleteBedsideCard`, Freihand-Schleife, Aktivierungswort-Lebenszyklus, Kopfzeilentasten
- `components/BedsideOverlay.tsx` — Overlay-UI, Schnellkarten-Streifen, Karte-Hinzufügen-Dialog, Bearbeitungsmodus, Fokusfalle, Sprachsteuerungs-Anleitungskarte
- `services/bedsideCards.ts` — `BedsideCard`-Typ, `DEFAULT_BEDSIDE_CARDS`, `loadCards`, `saveCards`, `createCard`
- `services/aiService.ts` → `inferCardIcon(text)` — KI-Emoji-Zuordnung
- `services/wakeWordService.ts` — Kontinuierliche Erkennung der Aktivierungsphrase
</details>

---

### 📨 Nachricht senden — Anbieter-Auswahl
Wenn ein Kontakt über mehrere konfigurierte Anbieter verfügt (z. B. sowohl E-Mail als auch SMS), erscheint über dem Verfassungsbereich der Abschnitt **„Senden über“**. Ein Tippen wechselt den Anbieter vor dem Verfassen — das Panel muss nicht verlassen werden.

![Kontakt-Anbieter-Auswahl — 'Senden über'-Zeile mit grün hervorgehobener E-Mail, SMS verfügbar](../../docs/screenshots/contact-provider-picker.png)

---

### 💬 AAC-Chat
Eingehende Nachrichten von verbundenen Anbietern (Telegram, WhatsApp, E-Mail, Slack usw.) landen in diesem Panel. Das Badge für ungelesene Nachrichten in der Werkzeugleiste zeigt die Anzahl an, der Alarm + die tab-übergreifende Benachrichtigung werden ausgelöst, wenn eine neue Nachricht eintrifft, und das Tippen auf eine Nachrichtenzeile kopiert diese in die Leiste, damit das Kind eine Antwort mit seiner eigenen Stimme verfassen kann.

![AAC-Chat-Panel mit eingehenden Nachrichten von Betreuungspersonen und Badge für ungelesene Nachrichten](../../docs/screenshots/panel-aac-chat.png)

<details>
<summary><strong>Funktionen + technische Details</strong></summary>

- Posteingang per Polling über das Synalux-Portal `/api/v1/prism-aac/inbox/poll` (Keine Aktion bei 404, falls das Portal nicht konfiguriert ist)
- Tab-übergreifende `BroadcastChannel`-Benachrichtigung bei neuer Nachricht
- Anbieter-Abstraktion: Hinzufügen von Outlook / Slack / Discord = jeweils ~30 Zeilen Code
- Lese-Status wird zurücksynchronisiert, sodass Betreuungspersonen sehen, wann das Kind ihre Nachricht gelesen hat
- Kostenlose Stufe: 1 verbundener Anbieter; kostenpflichtige Stufe: unbegrenzt
- TTS pro Nachricht, damit das Kind den eingehenden Text in seiner bevorzugten Stimme hören kann

**Render-Pfad:** `components/AACChatPanel.tsx` → `services/inboxPolling.ts` (5s Polling, wenn sidePanel === 'aac-chat', sonst 60s) → `useScheduleStore.setIncomingMessages()`. Jede Nachricht wird auch an die Spur „Nachrichten von Betreuungspersonen“ des Tagesplans angehängt.
</details>

---

### 🧮 Schulfächer
Zellen-Raster-Arbeitsfläche mit **19 Fächertastaturen**, die das gesamte Lehrprogramm der Sekundarstufe abdecken: Mathematik + Naturwissenschaften + Programmieren + Kunst + Geisteswissenschaften. Jeder Tab leitet den KI-Tutor durch eine domänenspezifische Prompt-Vorlage (insgesamt 33 Vorlagen), damit das Modell keine algebraischen Überlegungen auf ein Punnett-Quadrat anwendet oder eine musikalische Dynamik mit einem Programmier-Literal verwechselt. **Geschichte ist sprach- und regionalspezifisch** bis auf die Ebene von Bundesstaaten / Provinzen / Ländern / autonomen Gemeinschaften — über 280 Regionen in 23 Ländern.

![Zellen-Raster-Arbeitsfläche mit 5 + 7 = 12 in Zellen getippt](../../docs/screenshots/math-canvas-typed.png)

<details>
<summary><strong>Fächer-Tabs (insgesamt 19)</strong></summary>

**Mathematik (9 Tastaturen)** — Haupttastatur, Erw. Mathematik (π √ Exponenten + 5 Gestaltungswerkzeuge: Bruchfeld, Schriftliche Division, Wurzelbalken, Summenzeile, Bruchbalken), a–z, Verschiedene Mathematik (Mengenlehre + Logik), Zeit & Distanz, Gewicht, Volumen, Geometrie, Geld.

**Naturwissenschaften (4)** — Chemie (24 Elemente + Reaktionspfeile + Ladungen + Tiefstellungen + Phasenmarker), Physik (vollständiges Griechisch + 16 SI-Einheiten + ∫/∂/∇/∑/∏ + Konstanten), Biologie (DNA/RNA + Genetik + 8 Taxonomie-Ränge + 12 Organellen), Statistik (μ σ x̄ + 12 Operatoren + Verteilungen).

**Programmieren (2)** — Python (24 Operatoren + 26 Schlüsselwörter) und Java (24 Operatoren + 26 Schlüsselwörter). Code überträgt ein Zeichen pro Zelle, sodass er sich natürlich auf dem Festbreitenraster anordnet.

**Kunst + Geisteswissenschaften (4)** — Musik (3 Schlüssel + 6 Notenwerte + 5 Pausen + 5 Versetzungszeichen + 8 Dynamikbezeichnungen), Erdwissenschaften (Wetter + Plattentektonik + 10 Planeten + AE/Lj/pc/Mya/Gya), Geschichte (sprach- + regionalspezifisch), Sprachkunst (12 Wortart-Tags + 6 Satzarten + Interpunktion + Zitierstile).

</details>

<details>
<summary><strong>KI-Tutor — 11 Domänen × 3 Modi = 33 Prompts</strong></summary>

![KI-Tutor-Overlay mit simuliertem Hinweis über der Arbeitsfläche](../../docs/screenshots/math-tutor-hint.png)

Drei Modi pro Fach: 💡 **Hinweis** (sanfter Anstoß für den nächsten Schritt, löst niemals direkt), ✓ **Überprüfen** (validiert die Antwort des Kindes, feiert bei Korrektheit), 🎓 **Lösen** (vollständige Schritt-für-Schritt-Anleitung, max. 4 Schritte). Der aktive Tab teilt dem Tutor mit, in welchem Fach sich das Kind befindet. Harter 15-s-Timeout + Wiederholen-Taste, damit das Overlay niemals hängen bleibt.
</details>

<details>
<summary><strong>Geschichte — sprach- und regionalspezifisch</strong></summary>

![Geschichte-Tastatur im Sprachraum 'en' (ohne Region) — universelle + nationale Ebenen](../../docs/screenshots/math-keyboard-history-en.png)
![Geschichte-Tastatur mit Region US-TX — Alamo, Annexion von Texas, JFK erscheinen](../../docs/screenshots/math-keyboard-history-us-tx.png)

Drei gestapelte Ebenen:
1. **Universelle** Ereignisse, die in jedem Lehrplan gelehrt werden (476, 1914 Erster Weltkrieg, 1939 Zweiter Weltkrieg, 1969 Mondlandung)
2. **Nationale** Ereignisse, ausgewählt nach `language` (en, es, fr, de, ro, ru, uk, ja, ko, zh, ar, it, pl, nl, he, hi, vi, tr, pt) — 19 unterstützte Sprachen
3. **Subnationale** Ereignisse, ausgewählt nach `historyRegion` (US-TX, CA-QC, UK-SCT, ES-CT, IN-MH, DE-BY, …) — **über 280 Regionen in 23 Ländern**, einschließlich aller 50 US-Bundesstaaten + DC, 13 kanadischer Provinzen / Territorien, aller 4 UK-Nationen, Irland (Republik + 4 historische Provinzen), aller 16 deutscher Bundesländer, aller 17 spanischer Autonomer Gemeinschaften, aller 20 italienischer Regionen sowie AU, FR, MX, BR, IN, CN, RU, BE, CH, NL, AR, ZA, KR, PK, NZ, PL.

Der Tutor-Prompt enthält die Sprache und Region, sodass ein mehrdeutiges Datum wie 1836 in `US-TX` als Alamo aufgelöst wird (nicht als Staatsbürgerschaft von Alabama); 1759 in `CA-QC` bezieht sich auf die Schlacht auf der Abraham-Ebene; 1714 in `ES-CT` auf den Fall von Barcelona.

</details>

<details>
<summary><strong>Test-Workflows — 12 Fächer × Textaufgaben der Klassen 8–12 × 72 Playwright-Tests</strong></summary>

Schritt-für-Schritt-Aufgabenblätter, die jede Fächertastatur testen, sowie ein ausführbarer Playwright-Test pro Aufgabe, der das Live-Mathematik-Panel steuert und verifiziert, dass die Glyphen jedes Schritts im Zellenraster landen. Direkt nach dem Vorbild einer echten Algebra-Referenzseite der 9. Klasse modelliert.

- **Ebene 1 — Generisch Schritt-für-Schritt:** [`tests/workflows/`](../../tests/workflows/) — 12 Markdown-Dateien (advanced-math, biology, chemistry, earth-science, geometry, history, language-arts, misc-math, physics, programming-java, programming-python, statistics).
- **Ebene 2 — Nach Klassenstufen gegliederte echte Klassenzimmer:** [`tests/workflows/grade-8-12/`](../../tests/workflows/grade-8-12/) — 12 Markdown-Dateien mit Textaufgaben mit benannten Variablen (algebra-grade-9, geometry-grade-10, physics-grade-11, chemistry-grade-10, biology-grade-9, statistics-grade-11, programming-python-grade-9, programming-java-grade-11, pre-calc-grade-12, earth-science-grade-9, language-arts-grade-8, world-history-grade-10) + Tastaturlücken-[`REPORT.md`](../../tests/workflows/grade-8-12/REPORT.md) pro Fach.
- **Ebene 3 — Playwright End-to-End:** [`e2e/math-workflows/`](../../e2e/math-workflows/) — 72 Tests (`npx playwright test --project=desktop e2e/math-workflows`).

Vollständiger Index, Rangliste unterstützter Fächer und das Handbuch „Wie man einen neuen Workflow hinzufügt“ → **[`docs/WORKFLOWS.md`](../../docs/WORKFLOWS.md)**.

</details>

<details>
<summary><strong>Weitere Mathematik-Funktionen (Sperrwerkzeug, Lupe mit zwei Tippern, Speichern / Synchronisieren)</strong></summary>

- **Sperrwerkzeug** — Nachdem das Kind eine Aufgabe beendet hat, sperren Sie den Bereich. Gesperrte Zellen werden leicht abgedunkelt dargestellt und lehnen Bearbeitungen ab.
- **Lupe mit zwei Tippern** — Der erste Tipp bereitet die Taste vor (1,4× Vergrößerung + grüner Heiligenschein), der zweite Tipp führt die Eingabe aus. Automatische Deaktivierung nach 2 s. Für Benutzer mit motorischer Ungenauigkeit.
- **Speichern + Synchronisieren** — Local-First in `localStorage`; Best-Effort-Synchronisierung mit dem Synalux-Portal über die Taste `↻ Sync`. Obergrenze 100 Dokumente / 200 KB Inhalt; älteste werden gelöscht.
- **Haltezeit-Verweilen** — Konfigurierbares Verweilen pro Taste (0–1500 ms) mit grünem Fortschrittsring.

![Overlay für gespeicherte Dokumente mit einem Eintrag und einer Sync-Taste](../../docs/screenshots/math-docs-overlay.png)
![Eine Zifferntaste im vorbereiteten Vergrößerungszustand mit grünem Heiligenschein](../../docs/screenshots/math-two-hit-armed.png)
![Sperrwerkzeug vorbereitet, fordert den Benutzer auf, auf eine Ecke des Bereichs zu tippen](../../docs/screenshots/math-lock-armed.png)

</details>

<details>
<summary><strong>Fächertastaturen — zusätzliche Bilder</strong></summary>

![Chemie-Tastatur mit H₂O](../../docs/screenshots/math-keyboard-chemistry.png)
![Biologie-Tastatur mit A T G](../../docs/screenshots/math-keyboard-biology.png)
![Java-Tastatur mit `private String`](../../docs/screenshots/math-keyboard-java.png)
![Musik-Tastatur](../../docs/screenshots/math-keyboard-music.png)
![Statistik-Tastatur](../../docs/screenshots/math-keyboard-statistics.png)
![Erdwissenschaften-Tastatur](../../docs/screenshots/math-keyboard-earth-science.png)
![Sprachkunst-Tastatur](../../docs/screenshots/math-keyboard-language-arts.png)
![Geschichte im rumänischen Sprachraum](../../docs/screenshots/math-keyboard-history-ro.png)

</details>

---

### 🗓 Tagesplan
Visueller Zuerst-Dann-Tagesplan zur Unterstützung von Routinen + Übergängen. Jeder Schritt ist eine Bildkachel + Beschriftung; das Fertigstellen einer Kachel löst einen Signalton + eine visuelle Fortschrittsmarkierung aus. Der Belohnungsshop (kostenpflichtige Stufe) wird am Ende einer Routine freigeschaltet.

![Tagesplan-Panel mit Zuerst-Dann-Board + Aktivitätsliste](../../docs/screenshots/panel-schedule.png)

<details>
<summary><strong>Funktionen + technische Details</strong></summary>

- Voreingestelltes Raster mit 24 Kacheln zum Hinzufügen von Aktivitäten mit einem Tippen: Aufstehen, Zähne putzen, Frühstück, Schule, Snack, Mittagessen, Spielen, Lesen, Kunst, Spaziergang, Abendessen, Baden, Gute-Nacht-Geschichte, Schlafengehen, Medikamente, Zahnseide, Aufräumen, Wäsche, Haustierpflege, Sport, …
- Neuordnung per Drag-and-Drop; Inline-Bearbeitung über Bleistiftsymbol; voreingestellte Hinzufügungen enthalten einen `textKey`, sodass beim Sprachwechsel die Beschriftungen angepasst werden
- Zuerst-Dann-Zustandsmaschine: Pulsieren vorbereiteter Kacheln, aufsteigender Signalton mit 3 Tönen bei Ablauf des Timers, bewegungssicher (`prefers-reduced-motion` → statischer Ring), `aria-pressed`-Semantik
- Audio-Aufwärmung: Ein nahezu lautloser 1-Hz-Oszillator hält den AudioContext unter iOS Safari „am Laufen“, sodass der Timer-Signalton nach langer Stille tatsächlich abgespielt wird (ohne Aufwärmung wird der Signalton in einen angehaltenen Kontext ausgelöst = kein Ton)
- Nachrichten von Betreuungspersonen werden als „Nachrichten“-Spur an den Tagesplan angehängt, sodass das Kind sieht, was ansteht + wer eine Nachricht gesendet hat

**Render-Pfad:** `components/SchedulePanel.tsx` → `useScheduleStore` (24 voreingestellte Aktivitäten + benutzerdefinierte) → `services/feedback.ts:playTimerRing()` → geteilter AudioContext über `services/azureTTS.ts:warmupAzureAudio()`.
</details>

---

### 🎮 Spiele
12 evidenzbasierte AAC-Spiele. Entwickelt, um Kommunikation zu lehren, **nicht für Bildschirmnutzung zum Zeitvertreib**. Jedes Spiel zeichnet Äußerungen + Genauigkeit auf, sodass die adaptive Engine das am besten passende nächste Spiel vorschlagen kann.

![Spiele-Panel mit 9 Spielkacheln](../../docs/screenshots/panel-games.png)

<details>
<summary><strong>Die 12 Spiele + technische Details</strong></summary>

| Spiel | Zielfertigkeit |
|---|---|
| Seifenblasen platzen | Ursache + Wirkung, zielgerichtete Kommunikation |
| Farbenjagd | Rezeptiver Wortschatz (Farbnamen) |
| Meine Geschichte | Narratives Sequenzieren |
| Zuordnen | Zuordnung + kategoriales Denken |
| Ja / Nein | Binäre Unterscheidung, Anfordern / Ablehnen |
| Vervollständigen | Satzvervollständigung (Lückentext) |
| Kategorien sortieren | Semantische Kategorisierung |
| Gefühle zuordnen | Benennen von Affekten, Theory of Mind (ToM) |
| Was kommt als Nächstes | Sequenzielles Schlussfolgern |
| Gleich / Anders | Visuelle Unterscheidung — Übereinstimmung oder Kontrast |
| Ich höre es (Geräusche zuordnen) | Auditive Unterscheidung + Wortschatz |
| Abwechseln | Soziales Üben der Abwechselns |

- Alle 12 Spiele sind kostenlos; kein Spiel ist durch einen kostenpflichtigen Tarif beschränkt
- Spieldaten speisen `services/adaptiveEngine.ts` — Länge der Äußerung / Kategorie / Tageszeit / Ergebnis → schlägt das nächste Spiel vor
- Alle Spiele deaktivieren AAC-Kachelkategorien, die für den Wortschatz dieses Spiels nicht relevant sind, damit das Kind nicht abgelenkt wird

**Render-Pfad:** `components/GamesPanel.tsx` → einzelne Spielkomponenten in `components/games/`. Jedes Spiel zeichnet über `useScheduleStore.recordMessage(text, category)` auf.
</details>

---

### 🏪 Marktplatz
Stimmpakete (Inworld-Stimmen, benutzerdefinierte geklonte Stimme eines Geschwisterkinds/Elternteils), Vokabelpakete (Spanischer Kernwortschatz, gebärdenunterstützte Sprache), Spielepakete (zusätzliche Spiele über die 9 hinaus). Apps lassen sich über dasselbe Register in die Werkzeugleiste installieren, das auch die integrierten Panels nutzen.

![Marktplatz-Panel mit installierbaren Apps](../../docs/screenshots/panel-marketplace.png)

<details>
<summary><strong>Funktionen + technische Details</strong></summary>

- Apps existieren als JSON-Einträge (`lib/marketplace/manifests/local.ts`) + eine Laufzeit-`lib/marketplace/registry.ts` mit `getHandler(appId)`, die die Panel-Komponente zurückgibt
- Stimmklonen (kostenpflichtige Stufe): 90s Aufnahme → trainierte Stimme nutzbar für jedes TTS in der App, einschließlich Kategoriekacheln
- Installierte Apps werden als Werkzeugleisten-Schaltflächen nach den integrierten Funktionen gerendert; `useSettingsStore.installedApps` ist die Datenquelle
- Zugriffssteuerung pro Stufe: Der Marktplatz listet alles auf, aber die Installieren-Tasten sind für Elemente deaktiviert, die über dem Tarif des Benutzers liegen

**Render-Pfad:** `components/MarketplacePanel.tsx` → `useMarketplaceStore` → Backend `synalux/api/v1/marketplace/...` für den Kauf, dann Asset-Download (Sprachdateien, Vokabel-JSON) in die IndexedDB.
</details>

---

### 📄 PDF-Reader
Öffnen Sie ein PDF, sehen Sie eine Kachel pro Seite, tippen Sie darauf, um sie in Ihrer Stimme sprechen zu hören. Schularbeitsblätter, Elternbriefe, Artikel — fügen Sie jedes PDF ein und hören Sie zu, anstatt zu versuchen, es zu lesen. Kein Adobe Reader erforderlich; die gesamte Bibliothek läuft in Ihrem Browser.

![PDF-Reader-Panel — leerer Zustand mit Aufforderung "+ PDF öffnen"](../../docs/screenshots/panel-pdf-reader.png)

<details>
<summary><strong>Funktionen + technische Details</strong></summary>

- Eine Kachel pro Seite; jede zeigt die ersten 3 Zeilen + eine `▶ Seite N`-Taste, die über `aacSpeak()` geleitet wird (dieselbe Stimme + Tonfall + Wort-Hervorhebung wie alles andere)
- `▶ Alle lesen` verkettet jede Seite zu einer einzigen kontinuierlichen Äußerung
- Erkennung leerer Seiten (gescannte Bild-PDFs) schlägt das OCR-Werkzeug vor
- `pdfjs-dist` wird beim ersten Öffnen dynamisch importiert — separater ~3 MB Chunk vom CDN, der an die Version des npm-Pakets gebunden ist
- Werkzeugleisten-Schaltfläche (📄) ist optional über Einstellungen → Werkzeugleiste aktivierbar, damit die standardmäßig minimale Werkzeugleiste übersichtlich bleibt

**Render-Pfad:** `components/PdfReaderPanel.tsx` → `services/pdfReader.ts` (pdfjs `getDocument` → `getTextContent` pro Seite) → `services/aacSpeak.ts`.
</details>

---

### 👁 Screenshot-Reader (OCR)
Fügen Sie ein Foto eines Arbeitsblatts, einen Screenshot einer Webseite oder ein Bild einer Schulbuchseite ein oder laden Sie es hoch — der erkannte Text erscheint neben dem Bild und Sie können auf **▶ Sprechen** tippen, um ihn zu hören, oder auf **↧ In Nachrichtenleiste einfügen**, um ihn vor dem Sprechen zu bearbeiten.

![Screenshot-Reader (OCR)-Panel — leerer Zustand mit Aufforderung "+ Bild öffnen"](../../docs/screenshots/panel-ocr-capture.png)

<details>
<summary><strong>Funktionen + technische Details</strong></summary>

- OCR-Matrix für 20 Sprachen, zugewiesen von PrismAAC-Sprachräumen zu Tesseract-Codes (eng / spa / fra / por / deu / ron / ukr / rus / jpn / kor / chi_sim / ara / ita / pol / nld / heb / hin / vie / tur / ind)
- Trainierte Sprachdateien (traineddata) werden nach der ersten Nutzung zwischengespeichert (~10 MB für Englisch, mehr für CJK) — der erste Durchlauf zeigt „Bild wird gelesen… (beim ersten Durchlauf wird das OCR-Modell heruntergeladen — kann 10-30 s dauern)“
- Der Genauigkeitswert in Prozent wird angezeigt, damit der AAC-Benutzer beurteilen kann, ob er dem Ergebnis vertrauen oder das Bild erneut aufnehmen soll
- `disposeOcr()` Cleanup-Hook beendet jeden erzeugten Worker beim Entladen der Seite, um WASM-Speicher freizugeben
- Werkzeugleisten-Schaltfläche (👁) ist optional über Einstellungen → Werkzeugleiste aktivierbar

**Render-Pfad:** `components/OcrCapturePanel.tsx` → `services/ocr.ts` (`tesseract.js` `createWorker` → `recognize`) → `services/aacSpeak.ts` oder `messageStore.setText`.
</details>

---

### 🎧 Komfort-Player

Nachttisch-Medienplayer für Krankenhauspatienten — Koma, Intensivstation, nicht-verbal oder für alle, die durchgehende Komfort-Inhalte am Krankenbett benötigen.

<details>
<summary>Details zu den Funktionen</summary>

Familie und Freunde nehmen Sprachnachrichten auf, laden Fotos und Videos hoch. Die Wiedergabeliste läuft in einer Endlosschleife, sodass der Patient immer vertraute Stimmen und Gesichter in der Nähe hat.

- **Aufnehmen** von Sprachnachrichten direkt in der App (MediaRecorder API)
- **Hochladen** von Audiodateien, Fotos und Videoclips (100 MB pro Datei, 500 MB insgesamt)
- **Endlosschleife** durch alle Elemente fortlaufend — einstellen und beruhigt weggehen
- **Vollbildmodus** für Fotos und Video (Nachttisch-Anzeige)
- **Native TTS-Integration** — angetippte Phrasen werden auf iOS über AVSpeechSynthesizer gesprochen
- **Offline** — alle Medien werden in der IndexedDB gespeichert, funktioniert ohne Internet
- **Über Tastatur zugänglich** — jedes Bedienelement verfügt über ARIA-Beschriftungen und Tastaturnavigation
- **Nach militärischen Standards geprüft** — 27 Sicherheitserkenntnisse behoben (Blob-URL-Lücken, Quota-Handhabung, Eingabevalidierung, MIME-Positivlisten, Bereinigung beim Unmounten)
- Werkzeugleisten-Schaltfläche (🎧) ist optional über Einstellungen → Werkzeugleiste aktivierbar

**Speicherlimits:** Maximal 50 Elemente, 100 MB pro Datei, 500 MB insgesamt. MIME-Typen beschränkt auf Audio (webm/mp4/mpeg/ogg/wav), Bilder (jpeg/png/gif/webp/heic) und Video (mp4/webm/quicktime).

**Render-Pfad:** `components/ComfortPlayerPanel.tsx` → `store/comfortPlayerStore.ts` (Zustand + Persistierung) → `services/comfortMediaStorage.ts` (IndexedDB Blobs).
</details>

---

### 🧩 Chrome-Erweiterung — dieselben Leseassistenz-Funktionen in jedem Textfeld
Die PrismAAC-Web-App deckt den Leseassistenz-Ablauf innerhalb ihrer eigenen Oberfläche ab. Die Chrome-Erweiterung (`chrome-extension/`) bringt **dasselbe Verhalten in JEDES Textfeld auf JEDER Website** — Gmail, Google Docs, Word Online, Schulportale, Bankformulare — und schließt die einzige Read & Write-Lücke, die von einer Webseite alleine nicht erreichbar war.

![PrismAAC Leseassistent — Sprechen beim Schreiben, mit Wort-für-Wort-Hervorhebung, in jedem Textfeld](../../docs/screenshots/extension-marquee.png)

Das schwebende Overlay dockt über jedem fokussierten Textfeld an. Tippen Sie auf **▶ Sprechen**, um erneut zu lesen, oder schreiben Sie einfach weiter — das Beenden eines Satzes mit `.?!` liest ihn automatisch vor, wobei jedes Wort beim Sprechen gelb leuchtet:

![PrismAAC-Overlay über einer Seite zum Verfassen, mitten im Satz mit gelb hervorgehobenem „school“, während TTS es spricht](../../docs/screenshots/extension-overlay.png)

Übersetzen während des Sprechens zeigt SOWOHL die Quellzeile (klein, kursiv) ALS AUCH die übersetzte Zeile (volle Größe, mit Hervorhebung des aktiven Wortes beim Sprechen). 50+ Sprachen über den kostenlosen öffentlichen Endpunkt von Google (kein API-Schlüssel erforderlich):

![PrismAAC-Overlay übersetzt Englisch ins Rumänische — Quellzeile „I had a really good day at school today“ mit übersetztem „Am avut o zi foarte bună la școală astăzi“ darunter, „foarte“ hervorgehoben](../../docs/screenshots/extension-translate.png)

Optionsseite — Einstellungen werden über das Chrome-Profil des Benutzers mittels `chrome.storage.sync` synchronisiert. Deaktivierungsliste pro Website, Stimmenauswahl, Regler für Geschwindigkeit / Lautstärke / Tonhöhe, Sprachauswahl, alles optional:

![PrismAAC Erweiterungs-Optionsseite — Sprechauslöser, Zielsprache Rumänisch, Stimmenauswahl, Regler für Geschwindigkeit/Lautstärke/Tonhöhe](../../docs/screenshots/extension-options.png)

**Installation (vorerst Entwicklermodus — Eintrag im Chrome Web Store wartet auf Überprüfung):**

```sh
cd chrome-extension
npm install
npm run build
```

Öffnen Sie `chrome://extensions`, aktivieren Sie den **Entwicklermodus**, klicken Sie auf **Entpackte Erweiterung laden** und wählen Sie `chrome-extension/dist`.

**Funktionen:**

- Satz sprechen bei `.?!`, jedes Wort bei Leertaste sprechen, alles umschaltbar
- **Wort-für-Wort-Hervorhebung**, angetrieben durch das native `SpeechSynthesisUtterance.boundary`-Ereignis des Browsers (ECHTE Synchronisierung pro Wort, im Vergleich zur ~60 ms/Zeichen-Heuristik der Web-App — die Portal-Route liefert MP3 ohne Streaming-Ereignisse zurück, aber Web Speech legt diese nativ offen)
- **Beim Sprechen übersetzen** — wählen Sie eine Zielsprache (50+ unterstützt über den kostenlosen öffentlichen Endpunkt von Google, kein API-Schlüssel erforderlich). Das Overlay zeigt SOWOHL die Quellzeile (klein, kursiv) ALS AUCH die übersetzte Zeile (mit Hervorhebung des aktiven Wortes); eine Web Speech-Stimme, die zur Zielsprache passt, wird automatisch ausgewählt
- Schwebendes Shadow-DOM-Overlay, das über dem fokussierten Feld verankert ist (▶ Sprechen, 📌 Anheften, × Schließen)
- `Cmd / Ctrl + Shift + S`, um das fokussierte Feld bei Bedarf vorzulesen; `Esc` bricht ab
- Deaktivierungsliste pro Website für Banken / sensible Formulare
- Einstellungen werden über das Chrome-Profil des Benutzers mittels `chrome.storage.sync` synchronisiert — kein PrismAAC-Konto erforderlich

**Datenschutz:** Der Modus ohne Übersetzung ist vollständig offline (Web Speech läuft nativ). Der Übersetzungsmodus tätigt einen HTTPS-Aufruf pro eindeutigem Satz an `translate.googleapis.com` (nach dem ersten Treffer zwischengespeichert). Quellcode verfügbar unter [`chrome-extension/`](chrome-extension/) — TypeScript + esbuild Bundle (Inhalt 18 KB, Optionen 7 KB, Hintergrund 339 B).

---

### 👋 Freihand-Gesten
Optionale kamerabasierte Eingabe für Benutzer, die nicht zuverlässig tippen können. Verweil-Klick per Kopfhaltung + Gestenprofile per Handhaltung. Läuft lokal — es verlassen keine Videos das Gerät.

<details>
<summary><strong>Funktionen + technische Details</strong></summary>

- **Basis-Modus**: Kopfhaltungs-Tracking (FaceLandmarker, MediaPipe). Der Benutzer schaut auf eine Taste, hält den Blick für `headTrackingDwellMs` (Standard 1200 ms) → Klick. Ein visueller Fortschrittsring füllt sich während des Verweilens.
- **Erweiterter Modus**: Handhaltungs-Tracking. Benutzerdefinierte Gestenprofile pro Benutzer (offene Handfläche = Eingabe, Faust = Rücktaste, Zusammenkneifen = Leertaste usw.), konfiguriert über `components/HandCalibration.tsx`.
- Driftsicherheits-System: Wenn der Kopf des Benutzers über `headTrackingDriftWindowMs` aufeinanderfolgende Frames hinweg mehr als `headTrackingDriftThresholdPx` driftet, wird das Tracking automatisch deaktiviert und eine Aufforderung zur Neukalibrierung angezeigt (von Benutzern im Mai 2026 gemeldet: Das Tracking würde sonst der Drift über eine Stunde stumm folgen und die eigentlichen Tastenziele verfehlen).
- **Esc-Notausstieg** — Das Drücken von Esc auf einer beliebigen Tastatur deaktiviert das Tracking sofort und zeigt die QWERTY-Tastatur wieder an, ohne die Nachrichtenleiste zu verlieren.
- Kamera-Stream-Singleton (`services/cameraStream.ts`), sodass Kopf- und Hand-Tracker einen Stream teilen; der Wechsel der Modi ist kostenfrei.
- Die Kalibrierung pro Benutzer bleibt erhalten; der Körper-Tracker stellt sich beim Fortsetzen der Sitzung automatisch wieder her.

**Detaillierte Dokumentation:** [`docs/TRACKING_MATH.md`](../../docs/TRACKING_MATH.md) (Kalibrierungsmathematik, Perzentil-Lerner, Eigenbewegung, One-Euro-Filter, ~30 einstellbare Parameter), [`docs/GESTURE_RECOGNITION.md`](../../docs/GESTURE_RECOGNITION.md), [`docs/TRACKING_RELIABILITY.md`](../../docs/TRACKING_RELIABILITY.md).
</details>

---

### 👁 Visueller Kontext — Kameragestützte Phrasenvorschläge

Richten Sie die Kamera auf alltägliche Gegenstände und die Vorhersageleiste zeigt sofort relevante Phrasen an. Tasse und Gabel auf dem Tisch → „Ich möchte mehr“, „Wasser bitte“, „Fertig“. Ein Bett → „Ich bin müde“, „Gute Nacht“. Ein Buch → „Hilfe bitte“, „Ich verstehe das nicht“. **Kein AAC-Mitbewerber bietet dies.**

| Szene | Erkannte Objekte | Vorgeschlagene Phrasen |
|---|---|---|
| 🍽️ Mahlzeit | Tasse, Gabel, Löffel, Schüssel, Flasche | „Ich möchte mehr“, „Wasser bitte“, „Fertig“, „Lcker“, „Zu heiß“ |
| 😴 Schlafenszeit | Bett, Teddybär | „Ich bin müde“, „Gute Nacht“, „Geschichte vorlesen“, „Bitte umarmen“ |
| 📚 Schularbeit | Buch, Laptop, Tastatur | „Hilfe bitte“, „Ich verstehe das nicht“, „Fertig“, „Mehr Zeit“ |
| 🎮 Spielzeit | Teddybär, Sportball | „Ich möchte spielen“, „Ich bin dran“, „Toll!“, „Noch einmal!“ |
| 🛁 Badezeit | Toilette, Waschbecken | „Ich muss mal“, „Hände waschen“, „Hilf mir“ |
| 📺 Fernsehen | Fernseher, Fernbedienung, Sofa | „Ich möchte fernsehen“, „Ausschalten“, „Zu laut“ |

Phrasen sind in 12+ Sprachen verfügbar (Englisch, Spanisch, Französisch, Portugiesisch, Rumänisch, Ukrainisch, Russisch, Deutsch, Japanisch, Koreanisch, Chinesisch, Arabisch und mehr). Die Sprache folgt der Sprachstellung der App — wechseln Sie zu Russisch und die Kamera schlägt „Хочу ещё“ anstelle von „Ich möchte mehr“ vor.

![Visueller Kontext — Mahlzeit-Szene erkannt](../../docs/screenshots/vision-mealtime.png)

<details>
<summary><strong>Wie es funktioniert (technisch)</strong></summary>

**Ablauf:** Kamera (geteilt über referenzgezähltes `cameraStream.ts`) → MediaPipe ObjectDetector (EfficientDet-Lite0, 4 MB int8, WASM) → Szenen-Schlussfolgerung (deterministische Regeln, 11 Szenentypen) → Injizieren in die Vorhersageleiste (`setAiCompletion` + `learnWord` N-Gramm-Boost).

**Leistung:**
- Läuft mit **2 FPS** (eine Erkennung alle 500 ms) — Objekte bewegen sich nicht schnell, das spart Akku
- CPU-Auslastung: **< 6 %** auf Mobilgeräten
- Modellgröße: **4 MB** (int8 quantisiertes EfficientDet-Lite0, geladen in die bestehende MediaPipe WASM-Laufzeitumgebung)
- Gesamter zusätzlicher RAM: **~5 MB** (Modell + Puffer + Phrasenvokabular)
- Überhitzungsschutz: wird bei thermischer Drosselung automatisch auf 1 FPS reduziert → pausiert für 30 s

**Datenschutz:**
- 100 % auf dem Gerät — Kamerabilder **verlassen niemals das Gerät**, keine Cloud-Schlussfolgerung
- Erkennungsergebnisse sind **flüchtig** — werden nicht im localStorage oder in der Cloud gespeichert
- Die Klasse `person` wird erkannt, aber **niemals dem Benutzer angezeigt** oder für Vorschläge verwendet
- Während der Objekterkennung wird keine Kameravorschau angezeigt

**Sicherheit:**
- Funktion ist standardmäßig **AUS** — Betreuungspersonen müssen sie explizit unter Einstellungen → Eingabemodi → Visueller Kontext aktivieren
- Visuelle Phrasen werden **niemals automatisch gesprochen** — das Kind muss aktiv tippen/verweilen, um zu sprechen
- Notfallphrasen sind architektonisch getrennt und werden **niemals durch visuelle Vorschläge verdrängt**
- Die Szene muss für **3 aufeinanderfolgende Frames** (~1,5 s) stabil sein, bevor sie aktiviert wird — verhindert Flackern

**Objekterkennungsmodell:** [EfficientDet-Lite0](https://ai.google.dev/edge/mediapipe/solutions/vision/object_detector) — 80 COCO-Klassen, selbst gehostet auf dem Vercel CDN zusammen mit den bestehenden MediaPipe Gesicht/Haltungs-Modellen. Dieselbe WASM-Laufzeitumgebung wie die Kopfsteuerung.

**Szenen-Schlussfolgerung:** Deterministische Regel-Engine (kein zusätzliches ML-Modell). Regeln ordnen Objektkombinationen Szenen mit Tageszeit-Gewichtung zu: `cup + fork + spoon` mittags = `mealtime` (Konfidenz 0,90). 11 Szenentypen, jeder mit konfigurierbaren Objektsätzen und Tageszeit-Boosts.

**Vorhersage-Injektion:** Zwei bestehende Hooks in `predictionStore`:
1. `setAiCompletion(phrase)` — platziert die oberste Phrase als linke Vorhersagekachel
2. `learnWord(word, prev)` — verstärkt szenerellevantes Vokabular über synthetische N-Gramme mit 10× Benutzer-Multiplikator

Der visuelle Boost klingt nach 30 Sekunden ab, wenn Objekte den Frame verlassen. Aktives Schreiben unterdrückt visuelle Vorschläge (Benutzerabsicht hat Priorität).

**Wichtige Dateien:**
- `services/objectDetectionService.ts` — Kameraerfassung, MediaPipe-Schleife, Überhitzungsschutz
- `services/sceneInference.ts` — Regel-Engine, 11 Szenentypen, Tageszeit-Boost
- `services/visionPredictionBridge.ts` — Szene → Injizieren in die Vorhersageleiste
- `constants/visionPhrases.ts` — kuratierte Phrasen × 12+ Sprachen pro Szene
- `constants/objectVocabulary.ts` — 30 COCO-Objektbezeichnungen → lokalisierte Wort-Arrays
- `store/visionStore.ts` — flüchtiger Zustand-Store (nicht persistent)
- `hooks/useVisionContext.ts` — React-Hook zur Verbindung Erkennung ↔ Bridge ↔ Einstellungen

**Tests:** 62 Unit-Tests zur Abdeckung von Szenen-Schlussfolgerungsregeln, Vollständigkeit des Objektvokabulars, Abdeckung der Phrasensprachen, Store-Lebenszyklus und vollständiger Pipeline-Integration (Objekte → Szene → Phrasen → Store).

**Verifiziert E2E in Safari:**
```
SCENE=mealtime   CONF=0.90 PHRASES=I want more|Water please|All done     BADGE=🍽️
SCENE=bedtime    CONF=0.70 PHRASES=I'm tired|Good night|Read a story     BADGE=😴
SCENE=schoolwork CONF=0.80 PHRASES=Help please|I don't understand|Done   BADGE=📚
```
</details>

---

### ⚙️ Einstellungen
25 Sprachen / 28 Sprachräume, Design (Hell / Dunkel / Hoher Kontrast), Rastergröße (4–20 Kacheln), motorische Anpassungen (Mathematik-Haltezeit-Verweilen, Lupe mit zwei Tippern, Kopfsteuerungs-Verweilen, Gesten-Empfindlichkeit, automatische Drift-Deaktivierung), Stimmenauswahl (kostenlos für alle), Nutzung und Speicherung des Sprach-Caches, KI-Autokorrektur Ein/Aus, Benachrichtigungen, Anpassung der Werkzeugleiste, Auswahl der Geschichtsregion, Synalux-Konto mit dem Cloud-Tarif.

![Einstellungen — Sprachauswahl + Design-Umschalter](../../docs/screenshots/panel-settings.png)

<details>
<summary><strong>Mathematik- + Barrierefreiheits-Einstellungen</strong></summary>

![Einstellungen — Mathematik-Haltezeit + Lupe mit zwei Tippern](../../docs/screenshots/panel-settings-math.png)

- **Mathematik-Haltezeit-Verweilen** — Schieberegler von 0–1500 ms; 0 = sofortiger Klick, 200–1500 ms hilft Benutzern mit motorischer Ungenauigkeit (ein grüner Fortschrittsring füllt sich während des Verweilens, damit sie es sehen können).
- **Lupe mit zwei Tippern** — Der erste Tipp auf eine beliebige Mathematik-Taste bereitet diese vor (1,4× Vergrößerung + grüner Heiligenschein, keine Eingabe), der zweite Tipp führt die Eingabe aus. Automatische Deaktivierung nach 2 s. Lässt sich mit dem Haltezeit-Verweilen kombinieren.
- **Kopfsteuerungs-Verweilen** — 200–5000 ms.
- **Empfindlichkeit** — 1–10.
- **Automatische Drift-Deaktivierung** — Umschalter + Schwellenwert (px) + Fenster (ms).
- **Handkalibrierung anzeigen** — öffnet den Editor für Handhaltungs-Profile.

</details>

<details>
<summary><strong>Eingabemodi — Sprache, Gesten, KI-Autokorrektur</strong></summary>

![Einstellungen — Eingabemodi-Panel](../../docs/screenshots/panel-settings-input-modes.png)

- **Spracheingabe** — Web Speech API, sprachbewusst (z. B. Britisches Englisch vs. US-Englisch usw.); kostenlose Stufe
- **KI-Autokorrektur & Vervollständigung** — jede Pause beim Tastenanschlag wird über die Cloud-Autokorrektur geleitet (Gemini 2.5 Flash-Lite). Bei geringer Bandbreite standardmäßig ausgeschaltet.
- **Benachrichtigungen** — Alarm + tab-übergreifende Benachrichtigung bei eingehenden AAC-Chat-Nachrichten.
- **Kamera-Eingabe** — Hauptschalter für Kopf- + Hand-Tracking.
- **Ziel für Kamera-Tracking** — Kopf, Hand oder automatische Erkennung.

</details>

<details>
<summary><strong>Anpassung der Werkzeugleiste</strong></summary>

Die Werkzeugleiste lässt sich vollständig umordnen. Die Standardversion 0.9.0 wird mit einem minimalen Satz ausgeliefert (Mikrofon, AAC-Chat, Alarm, Kategorien, Einstellungen), damit der Bildschirm für neue Benutzer aufgeräumt bleibt — jede andere integrierte Funktion (Mathematik, KI-Chat, Tagesplan, Spiele, Marktplatz, Komfort-Player, Notizen, Verlauf, Ton) kann mit einem Tippen unter Einstellungen → Werkzeugleiste wieder aktiviert werden. Über den Marktplatz installierte Apps fügen sich automatisch nach den integrierten Funktionen ein.

</details>

---

## Ausprobieren

| | |
|---|---|
| 🌐 **Web-App** | [synalux.ai/prism-aac](../../synalux.ai/prism-aac) — in jedem Browser ausprobieren |
| 📱 **iOS** | [App Store](../../apps.apple.com/app/id6764692277) — iPhone, iPad, Apple Watch |
| 💻 **Quellcode** | Dieses Repository. AGPL-3.0 — frei forken, Änderungen teilen |

---

## Tarife

Zwei Tarife: **Kostenlos** und **Prism AAC Cloud**. Keine Testphase, keine Kreditkarte für die kostenlose Version erforderlich, keine automatischen Zusatzgebühren.

| | Kostenlos | Prism AAC Cloud — 4,99 US$/Monat |
|---|---|---|
| Kommunikationsoberflächen, Tastatur und gespeicherte Phrasen | ✅ | ✅ |
| Verfügbare Gerätestimmen und zwischengespeicherte Sprachausgabe | ✅ | ✅ |
| Lokale KI auf dem Gerät und Notfallkommunikation | ✅ | ✅ |
| iOS + Web (PWA) | ✅ | ✅ |
| Neu generierte Sprachausgabe mit natürlicher Stimme | Nicht enthalten (wird auf der öffentlichen Sprachroute weiterhin kostenlos bereitgestellt, bis die Verbrauchsmessung startet) | 50.000 Zeichen / Monat |
| Cloud-KI-Anfragen (Chat, Autokorrektur, Vorhersage, Tutor) | — | 100 / Monat |
| Zurücksetzen des Kontingents | — | Am 1. jedes Monats um 00:00 Uhr UTC |

- Der Kauf erfolgt in der iOS-App (Apple In-App-Kauf, StoreKit 2) oder im Web (Stripe); beide gewähren Zugriff auf dasselbe Konto und ein aktives Abonnement pro Konto. Das Kündigen eines Kanals löscht niemals den anderen.
- Zwischengespeicherte Wiedergabe und die Gerätestimme verbrauchen niemals das Kontingent. Wenn das Kontingent aufgebraucht ist, pausieren Cloud-Sprachausgabe und Cloud-KI bis zum Zurücksetzen — die Grundfunktionen der Kommunikationsoberfläche werden niemals blockiert.
- Einstellungen → Synalux-Konto → **Cloud-Sprachausgabe und KI** zeigt den Tarif, das Kontingent und die Verlängerungsbedingungen mit den Optionen „Mit Apple abonnieren“, „Apple-Käufe wiederherstellen“, „Abonnement verwalten“ und „Cloud-Tarif aktualisieren“.
- Zwei offene Unstimmigkeiten werden nachverfolgt: (1) Wortvorhersage-Verstärker, UK-Chat-Anbieter, Bezugspersonen-Kontakte, der SMS-Anbieter und der vollständige Notfall-Datensatz hängen vom UK-Tarif ab, der nur durch ein Web-Abonnement (Stripe) gesetzt wird; reine Apple-Abonnenten erhalten diese daher nicht. (2) KI-Piktogramme und Marketplace-Installationen hängen vom Synalux-Plattformtarif ab, nicht vom AAC-Cloud-Tarif, weshalb Cloud-Abonnenten auf beiden Kanälen diese nicht erhalten. Die Stimmenauswahl und alle 12 Spiele sind für alle kostenlos.

<p align="center">
  <img src="../../docs/screenshots/cloud-subscription-iphone.png" alt="iOS-App: Einstellungen → Synalux-Konto → Cloud-Sprachausgabe und KI — Kontingent, Verlängerungsbedingungen, Mit Apple abonnieren · 4,99 $/Monat, Apple-Käufe wiederherstellen" width="260" />
  <img src="../../docs/screenshots/panel-account-cloud.png" alt="Web-App: Derselbe Bereich mit Abonnieren · 4,99 US$/Monat über Stripe" width="260" />
</p>

[Preisübersicht →](https://synalux.ai/pricing) · [AGB](TERMS.md) · [Datenschutz](PRIVACY.md)

---

## Klinische Sicherheit

- **AAC-Zugang wird niemals als Konsequenz eingeschränkt.** Ein Kind muss immer seine Stimme behalten.
- **Keine PHI in der Cloud ohne Einwilligung.** Notizen von Pflegepersonen werden vor dem Upload verschlüsselt.
- **Audio bleibt lokal.** Spracheingaben werden direkt im Browser über die Web Speech API transkribiert.
- **Entwickelt von BCBAs.** Die Erfassung verbaler Operanten entspricht der BACB Task List 5. Auflage.
- **Traumasensible Standardeinstellungen.** Keine Bestrafungsmechanismen. Der Belohnungsshop ist optional.

Mehr erfahren: [`ACCESSIBILITY.md`](../../ACCESSIBILITY.md), [`SECURITY.md`](../../SECURITY.md).

---

## Testergebnisse

**5.139 automatisierte Tests** überprüfen jede Funktion in Web, iOS, Vision und AI-Routing.

| Was wir testen | Tests | Ergebnis |
|---|---|---|
| Vollständige Web-App (Komponenten, Stores, Services) | 4.971 | ✅ bestanden |
| Vision / Kamera / Objekterkennung | 167 | ✅ bestanden |
| Hand-Tracking + Körperhaltung-Präzision | 54 | ✅ bestanden |
| On-Device-AI-Routing (Live-Ollama) | 8 | ✅ bestanden |
| iOS nativ (XCUITest) | 19 | ✅ bestanden |
| Prism MCP-Server | 2.679 | ✅ bestanden |

**On-Device-AI-Genauigkeit** — wie zuverlässig die App die richtige Aktion für Ihr Kind auswählt:

| Gerät | Modell | Größe | Genauigkeit | Evaluierung |
|---|---|---|---|---|
| **Apple Watch** | SmolLM2-360M | 207 MB | **100%** (300/300) | AAC-Klinik (Symbolerweiterung, Notfall, Vorhersage) |
| **Alle iPhones** | Qwen3.5-4B Q3_K_M | 2,3 GB | **99,1%** (114/115 × 3 Durchläufe) | BFCL Tool-Routing |
| **iPhone Pro / iPad** | Qwen3.5-4B Q4_K_M | 3,4 GB | **100%** (115/115 × 3 Durchläufe) | BFCL Tool-Routing |
| **iPad Pro / Mac** | Prism-Coder 9B | 8,4 GB | **100%** (115/115 × 3 Durchläufe) | BFCL Tool-Routing |

<details>
<summary><strong>Was bedeutet "99,1% Routing-Genauigkeit" in der Praxis?</strong></summary>

Die On-Device-AI entscheidet, welche Aktion ausgeführt werden soll, wenn Ihr Kind auf eine Schaltfläche tippt — eine Notiz speichern, die Sitzung laden, den Verlauf durchsuchen usw. Wir testen dies mit 115 realen Szenarien, die 3 Mal gemischt werden. Das 2,3-GB-Modell liegt jedes Mal bei 114 von 115 richtig. Der einzige Fehlschlag: Es behandelt "einen RegEx schreiben" als Wissensabfrage statt als Klartextantwort — ein Grenzfall, der bei der AAC-Nutzung niemals vorkommt.

Zum Vergleich: Das vorherige 2B-Modell erreichte 90,4% (11 Fehler). Das neue Modell weist bei gleicher Download-Größe 10-mal weniger Routing-Fehler auf.

</details>

---

## Infrastruktur & DSGVO

### Multi-Regionen-Architektur

| Komponente | Region | Zweck |
|---|---|---|
| **Supabase US** | US East (Virginia) | Primäre Datenbank — Authentifizierung, Benutzerdaten, Notizen der Pflegekräfte |
| **Supabase EU** | EU Central (Frankfurt) | DSGVO-konform — Daten von EU-Benutzern verlassen niemals die EU |
| **Vercel** | Global Edge | Web-App, API-Routen, CDN |
| **Inworld TTS** | US | Neuronale Text-to-Speech (Sprachsynthese) |
| **HuggingFace Hub** | US/EU | Modellgewichte (2B, 4B, 14B, 32B) |
| **On-Device** | Gerät des Benutzers | llama.cpp-Inferenz (iPhone/iPad/Mac) |

### DSGVO-Konformität

Die Daten von EU-Benutzern werden ausschließlich in der Region Frankfurt (eu-central-1) gespeichert. Das Portal erkennt den Standort des Benutzers über den Header `x-vercel-ip-country` von Vercel und leitet Datenbankoperationen an die entsprechende Supabase-Instanz weiter:

- **EU-Benutzer** → `supabase-eu` (Frankfurt) — personenbezogene Daten, Authentifizierung, Einstellungen, Notizen der Pflegekräfte
- **Nicht-EU-Benutzer** → `supabase-us` (Virginia) — dieselben Datenkategorien, US-Gerichtsbarkeit
- **KI-Inferenz** → On-Device (keine Daten verlassen das Gerät) oder Synalux API (keine PII gespeichert)
- **TTS-Audio** → serverseitig generiert, zum Client gestreamt, nicht gespeichert

**Garantien zur Datenresidenz:**
- Personenbezogene Daten aus der EU werden niemals über US-Server übertragen
- Auth-Tokens sind auf die jeweilige regionale Supabase-Instanz beschränkt
- Notizen der Pflegekräfte sind im Ruhezustand verschlüsselt (Supabase AES-256)
- Sprachaufnahmen (Comfort Player) werden im IndexedDB des Browsers gespeichert — niemals hochgeladen
- Das lokale KI-Modell läuft auf dem Gerät — keinerlei Telemetrie in die Cloud

**Recht auf Löschung:** Die Löschung eines Benutzers wird kaskadierend über Authentifizierung, Profile, Notizen der Pflegekräfte und Nutzungsanalysen in der regionalen Datenbank ausgeführt. Selbst gehostete Instanzen können mit `supabase db reset` vollständig zurückgesetzt werden.

### Skalierungskosten

| Benutzer | Supabase | Vercel | TTS | KI-Modelle | Gesamt |
|---|---|---|---|---|---|
| 0–1K | 50 $/Monat (2 Regionen) | 0 $ (Hobby) | ~5 $/Monat | 0 $ (On-Device) | ~55 $/Monat |
| 1K–10K | 50 $/Monat | 20 $/Monat (Pro) | ~50 $/Monat | 0 $ | ~120 $/Monat |
| 10K–100K | 50 $/Monat + Compute-Add-ons | 20 $/Monat | ~200 $/Monat | RunPod 125 $/Monat | ~395 $/Monat |

---

## KI-Modelle & Geräteunterstützung

Funktioniert auf jedem Apple-Gerät. Null Cloud-Abhängigkeit für die grundlegende UK-Kommunikation.

PrismAAC wählt automatisch das beste Modell aus, das Ihre Hardware ausführen kann, weicht auf leistungsschwächeren Geräten nahtlos auf kleinere Modelle aus und benötigt für die grundlegende Kommunikation niemals eine Internetverbindung.

| Gerät | RAM | Modell | Genauigkeit | UK | Größe | Kosten |
|---|---|---|---|---|---|---|
| **iPad Pro M1/M2/M4** | 16 GB | 9B LoRA (v36) | **100%** | 100% | 8,4 GB | $0 |
| **iPhone 15/16 Pro, iPad Air** | 8 GB | 4B Q4_K_M (v36) → 2B (OOM-Fallback) | **100%** | 100% | 4,7 GB / 1,1 GB | $0 |
| **iPhone 12–14, ältere iPads** | <8 GB | 2B Q3_K_M (v43) | **99,1%** | 100% | 2,3 GB | $0 |
| **Mac M1+ über WLAN** | 16+ GB | 9B/27B über Ollama (v36) | **100%** | 100% | 8,4 GB | $0 |

### Web-App-Kaskade

Die Web-App versucht zuerst die lokale Inferenz und weicht erst dann auf die Cloud aus — so zahlen Nutzer mit installiertem Ollama $0 und Nutzer ohne Ollama erhalten trotzdem den vollen Funktionsumfang.

<details>
<summary>Kaskaden-Ablaufdiagramm</summary>

```
  Nutzer sendet Nachricht
        |
        v
  +-- LOKALES OLLAMA (automatisch unter localhost:11434 erkannt) --+
  |                                                                 |
  |   14b (100%, ~1,1s) ─[Fehler]─> 8b (100%, ~0,8s) ─[Fehler]─> 2b (100%, ~1,6s)
  +-----------------------------------------------------------------+
         |
    [alle lokalen fehlgeschlagen?]
         |
         v
  +-- CLOUD-FALLBACK (Synalux API) ---------+
  |  Claude Sonnet 4 (kostenpflichtig) /    |
  |  Gemini (kostenlos)                     |
  |  99% Genauigkeit, ~3s                   |
  +-----------------------------------------+

  Auto-Sideload: Beim ersten Start wird Ollama erkannt → lädt das beste Modell herunter → dauerhaft lokal.
```

</details>

### Native iOS-Kaskade

Die native App prüft beim Start den verfügbaren RAM, lädt das passende Modell einmalig vom HuggingFace CDN herunter und führt die Inferenz über llama.cpp Metal aus. Kein Server. Kein Abonnement. Keine Daten verlassen das Gerät.

<details>
<summary>Kaskaden-Ablaufdiagramm</summary>

```
  App-Start
      |
      v
  RAM-Erkennung (os_proc_available_memory)
      |
      +── 16 GB+ (iPad Pro) ──> 9B LoRA (8,4 GB) ──> 100%, ~1,1s
      |
      +── 8 GB (iPhone/iPad Air) ──> 4B Q4_K_M (4,7 GB) ──> 100%, ~0,8s
      |                                    |
      |                               OOM? → 2B Q4_K_M (1,1 GB) → 100%, ~1,6s
      |
      +── <8 GB ──> 2B Q4_K_M (1,1 GB) ──> 100%, ~1,6s

  Alle Pfade: llama.cpp Metal, dauerhaft $0, keine Daten verlassen das Gerät.
  WLAN-Upgrade: Einstellungen → Lokale KI → Mac-IP für 9B/27B eingeben.
```

</details>

### Tastatur-Layout-Modi (dauerhaft gespeichert)

Drei Modi wechseln mit einem einzigen Tippen — das gewählte Layout wird gespeichert und bei jedem Start wiederhergestellt.

- **MAX KB** — Tastatur füllt den gesamten Platz unter der Vorhersageleiste aus
- **MIN KB** — Kategorien 75% / Tastatur 25%
- **HIDE KB** — Kategorien im Vollbildmodus, Tastatur ausgeblendet

<details>
<summary>Layout-Diagramm</summary>

```
  MAX KB                 MIN KB                 HIDE KB
  +--------------------+ +--------------------+ +--------------------+
  | Werkzeugleiste     | | Werkzeugleiste     | | Werkzeugleiste     |
  | Vorhersageleiste   | | Vorhersageleiste   | | Begrüßungsbanner   |
  |                    | |                    | |                    |
  |  TASTATUR          | | Kategorien  (75%)  | | Kategorien         |
  |  füllt den gesamten| |                    | | (Vollbild)         |
  |  Platz darunter    | |--------------------| |                    |
  |                    | | Tastatur    (25%)  | |                    |
  | [123][v][ Leert.  ]| |                    | |                    |
  +--------------------+ +--------------------+ +--------------------+
        |                      |                      |
        +-- [v]-Button ------->+-- Seitenleisten-Btn ->+-- Seitenleisten-Btn --+
        |                                                                      |
        +<---------------------------------------------------------------------+
```

</details>

### Kostenübersicht

| Pfad | Modell | Genauigkeit | Latenz | Kosten |
|---|---|---|---|---|
| iPad Pro 16GB | 9B LoRA (v36) | **100%** | ~1,1s | **$0** |
| iPhone/iPad 8GB | 4B Q4_K_M (v36) → 2B (OOM-Fallback) | **100%** | ~0,8s | **$0** |
| Jedes Gerät | 2B Q4_K_M (v42) | **100%** | ~1,6s | **$0** |
| WLAN zum Mac | 9B/27B über Ollama (v36) | **100%** | ~1,1s | **$0** |
| Cloud (kostenlos) | Gemini 2.5 Flash | 99% | ~3s | Wird von Synalux übernommen |
| Cloud (kostenpflichtig) | Claude Sonnet 4 | 99% | ~3s | Im Tarif enthalten |

**Das Versprechen:** Jedes Kind erhält eine Genauigkeit auf Claude-Niveau — egal ob auf einem $329 iPhone SE oder einem $2.000 iPad Pro. Lokale Ausführung bedeutet null Cloud-Abhängigkeit, null monatliche API-Gebühren, null Freilegung von Gesundheitsdaten (PHI) und Antwortzeiten von unter einer Sekunde. Die prism-coder-Flotte erzielt **99,1–100%** im BFCL Function-Calling-Benchmark (Mittelwert aus 3 Durchläufen, Juni 2026): 27B/9B/4B erreichen 100%, 2B erreicht 99,1%. Das 27B-Modell erzielt zudem 100% bei einer internen Programmier-Evaluierung mit 15 Aufgaben.

---

## Self-Hosting

```bash
git clone https://github.com/dcostenco/prism-aac.git
cd prism-aac
npm install
npm run dev    # http://localhost:3000
```

Synalux betreibt die kanonische gehostete Version (kostenlos + kostenpflichtig). Self-Hoster und Forks müssen Änderungen unter der AGPL-3.0 veröffentlichen.

### Lokale KI-Modelle (null Cloud-Kosten)

**Option A — In-App (empfohlen):** Einstellungen → 🤖 Lokale KI-Modelle → klicken Sie auf Herunterladen neben einem beliebigen Modell. Inklusive Fortschrittsbalken. Funktioniert vom iPad/iPhone im selben WLAN wie ein Mac, auf dem Ollama läuft.

**Option B — Befehlszeile:**

Installieren Sie [Ollama](https://ollama.com), dann:

```bash
ollama pull dcostenco/prism-coder:2b   # 1.1 GB — jedes Gerät, iPhone 12+ — 100% Routing (v42)
ollama pull dcostenco/prism-coder:4b    # 4.7 GB — iPhone/iPad 8GB, Mac M1+ — 100% Routing (v36)
ollama pull dcostenco/prism-coder:9b   # 8.4 GB — Mac 16GB+, iPad Pro — 100% Routing (v36)
ollama pull dcostenco/prism-coder:27b   # 16 GB  — Mac M2 Ultra+ (MoE) — 100% Routing (v7)
```

In `.env.local` einzufügen: `LOCAL_LLM_URL=http://localhost:11434`

**iPad Pro / iPhone im WLAN:**
```bash
OLLAMA_HOST=0.0.0.0 ollama serve   # auf dem Mac
# Dann in den App-Einstellungen → Lokale KI → eingeben: http://<mac-ip>:11434
```

Auto-Routing: 2B → jedes Gerät · 4B → Mobil/Verifizierer · 9B → Standard · 27B → Qualität/Enterprise. Cloud-Rückfallebene (Fallback), wenn Ollama nicht erreichbar ist.

---

<details>
<summary><strong>📚 Technische Architektur (Modell-Routing, Sprachausgabe, Gestenerkennung, Build-Details)</strong></summary>

**Stack**: Next.js, Zustand, Web Speech API (Transkription), Inworld TTS-2 + Azure Neural Fallback (Sprachausgabe), FaceLandmarker (Gesten).

**Modell-Routing** (serverseitig über das Synalux-Portal):
- **Auf dem Gerät** (Tastendruck → Phrase): `prism-coder:2b` (Qwen3-2B Q4_K_M, llama.cpp Metal) — kein Netzwerk, keine Kosten, ~1,6s
- **Cloud einfach** (Chat, kostenlose Stufe): `prism-coder:9b` (Qwen3-14B feineingestellt) → Gemini 2.5 Flash Fallback
- **Cloud komplex** (Schlussfolgerung, Pro-Stufe): `prism-coder:27b` (QwQ-32B feineingestellt) → Claude Sonnet 4 Fallback
- **Autokorrektur + Wortvorhersage**: Gemini 2.5 Flash-Lite — 752ms Ø, mehrsprachig (ro/ru/es)
- Geschwindigkeitskritische Pfade (Tastendruck → Sprachausgabe) umgehen das Routing — blockieren niemals das Netzwerk
- Routing-Genauigkeit ([102-Fälle Prism-Bewertung](https://github.com/dcostenco/prism-coder/tree/main/tests/benchmarks/prism-routing-100), v36/v7 System-Prompt, 3-Seed-Mittelwert, Mai 2026):

  | Modell | Genauigkeit | Ø Latenz | Erfundene Tools |
  |---|---|---|---|
  | prism-coder:27b swe14 (lokal) | **100.0%** | 1.4s | 0 |
  | 14B→32B Kaskade (lokal) | **100.0%** | ~1.1s | 0 |
  | prism-coder:4b v36 (lokal) | **100.0%** | 0.8s | 0 |
  | prism-coder:9b v36 (lokal) | **100.0%** | 1.1s | 0 |
  | Sonnet 4 (Cloud) | **99%** | 3.2s | 0 |
  | Opus 4.7 (Cloud) | **98.3%** | 3.0s | 0 |
  | prism-coder:2b v42 (lokal) | **100.0%** | 1.6s | 0 |

- Erweiterte Bewertung — eval_300 (300 Fälle, 17 Tools, 9 Kategorien, 3-Seed): prism-coder:27b = **300/300 (100%)**

**Sprachausgabe (TTS)** Fallback-Kette:
- Stufe 1: Inworld TTS-2 (kostenpflichtig für alle Sprachen; kostenlos für ro/uk/ru/de/ko/ar, wo Synalux die Kosten übernimmt)
- Stufe 2: OS Web Speech API Premium-Stimmen (offline)
- Stufe 3: WASM espeak-ng (letzter Ausweg)

**Gestenerkennung**:
- Grundlegend: Kopfhaltung + Verweildauer-Klick (Dwell Click) über FaceLandmarker
- Erweitert: Handhaltung über MediaPipe; benutzerdefinierte Gestenprofile

**Architektur**: reine modale Navigation (kein Router), Theme über Token (bg/text/border/accent).

**Detaillierte Dokumentation in diesem Repository:**
- [`docs/TTS-ARCHITECTURE.md`](docs/TTS-ARCHITECTURE.md) — vollständiges Sprach-Routing
- [`docs/GESTURE_RECOGNITION.md`](docs/GESTURE_RECOGNITION.md) — Interna des Gestenmodus
- [`docs/ADAPTIVE-ENGINE-BEHAVIOR.md`](docs/ADAPTIVE-ENGINE-BEHAVIOR.md) — automatische Tonfall-Umschaltung
- [`docs/EMERGENCY-NATIVE-ARCHITECTURE.md`](docs/EMERGENCY-NATIVE-ARCHITECTURE.md) — lebenserhaltender Notfall-Pfad
- [`docs/SELF-LEARNING-SAFETY.md`](docs/SELF-LEARNING-SAFETY.md) — Schutzmechanismen für benutzerdefiniertes Lernen
- [`docs/TRACKING_RELIABILITY.md`](docs/TRACKING_RELIABILITY.md) — Testumgebung für Kopf-/Handtracking-Zuverlässigkeit
- [`PRECISION_TOUCH.md`](PRECISION_TOUCH.md) — Barrierefreiheit bei Touch-Zielen
- [`ACCESSIBILITY.md`](ACCESSIBILITY.md) · [`SECURITY.md`](SECURITY.md) · [`GOVERNANCE.md`](GOVERNANCE.md) · [`AGENTS.md`](AGENTS.md)
- [`RESEARCH.md`](RESEARCH.md) — Evidenzbasis
- [`CHANGELOG.md`](CHANGELOG.md) — Versionsverlauf

</details>

<details>
<summary><strong>🆕 Warum PrismAAC anders ist (der zugrundeliegende Algorithmen-Stack)</strong></summary>

**Drei Dinge, die keine andere UK-App auf dem Markt gemeinsam bietet:**

### 1. KI auf dem Gerät — unterstützt technische HIPAA-Schutzmaßnahmen

**Warum lokale KI für UK wichtig ist — Geschwindigkeit, Sicherheit und Zuverlässigkeit:**

| | Nur Cloud-KI | PrismAAC (Local-First) |
|--|---|---|
| Tastendruck → Sprachausgabe | 2–30s (Netzwerk-Umlaufzeit) | **~0.5s** (auf dem Gerät) |
| Funktioniert offline | ❌ Nein | ✅ Ja |
| PHI verlässt das Gerät | ✅ Immer | ❌ Niemals (Sprachpfad) |
| HIPAA-Unterstützung | Erfordert BAA mit jedem Anbieter | **Lokal auf dem Gerät hält PHI intern — hilft technische Schutzmaßnahmen zu erfüllen** |
| Ländliche Gebiete / schlechtes WLAN | Unterbrochen | **Voll funktionsfähig** |
| Monatliche Kosten pro Benutzer | 2–15 $ API-Gebühren | **0 $ (lokal)** |

**Das 2B-Modell läuft vollständig auf Ihrem Gerät** — iPad M1+, Mac oder Laptop. Wenn ein Kind eine Taste drückt, erhält es eine Rückmeldung in ~500 ms ohne jegliche Netzwerkaufrufe. Im normalen Betrieb verlassen weder PHI noch Äußerungen oder Kommunikationsmuster das Gerät.

Notizen von Betreuungspersonen werden lokal verschlüsselt, bevor eine optionale Cloud-Synchronisierung erfolgt. Vergleichbare reine Cloud-UK-Plattformen (TouchChat, Proloquo2Go Cloud-Sync) erfordern Konto-Uploads zur Nutzung — PrismAAC nicht.

**Für Enterprise- / klinische Einsätze (9B + 27B):** Die 9B- und 27B-Modelle laufen auf einem dedizierten Mac über Ollama im klinischen Netzwerk. iPads verbinden sich über das lokale WLAN — Daten verlassen niemals das Gebäude. Diese Architektur unterstützt technische HIPAA-Schutzmaßnahmen, indem PHI vor Ort verbleibt; die HIPAA-Konformität liegt in der Verantwortung der einsetzenden Organisation und erfordert deren eigene administrative, physische und technische Kontrollen sowie entsprechende BAAs.

**So richten Sie es ein:**

```
iPad / iPhone (im selben WLAN wie der Mac)
    ↓  verbindet sich mit
Mac mit Ollama (OLLAMA_HOST=0.0.0.0)
    ↓  bereitgestellt durch
prism-coder:2b · :14b · :32b
    ↓  alle Inferenzentscheidungen bleiben im
Lokalen Netzwerk — nichts gelangt ins Internet
```

Einstellungen → 🤖 Lokale KI-Modelle → Mac-IP eingeben → alle Modelle sind sofort verfügbar. Keine Cloud-Kosten. Keine Exposition von PHI. Keine Netzwerkabhängigkeit für die UK-Kommunikation.

### 2. Phrasen-Ranking, das sich an IHREm Kind ausrichtet
Statische Häufigkeitslisten sind veraltet. PrismAAC sortiert vorgeschlagene Phrasen über die [**Prism v14.0.0 Aktivierungsausbreitung (Spreading Activation)**](https://github.com/dcostenco/prism-coder/blob/main/docs/WOW_FEATURES.md) — dasselbe kognitive ACT-R-Gedächtnismodell, das auf jahrzehntelanger Forschung der Carnegie Mellon University basiert. Aktualität × Häufigkeit × benutzerdefinierter Verlauf, keine statische Beliebtheitsliste. Phrasen, die das Kind heute nutzt, steigen auf; Phrasen, die ein Jahr lang nicht verwendet wurden, verblassen (Lernraten-Verfall `d=0.25`, ~1 Jahr Halbwertszeit).

### 3. Korrekturen durch Betreuungspersonen werden automatisch zu Trainingsdaten
Wenn eine Betreuungsperson einen Korrekturvorschlag des Modells anpasst (z. B. „nein, das Wort ist *essen*, nicht *wollen*“), extrahiert der [Audit-Hooks-Postflight-Harvester](https://github.com/dcostenco/prism-coder/blob/main/docs/WOW_FEATURES.md#7-the-recipe-combining-all-of-the-above) diese Abweichung und speichert sie dauerhaft. Nach ~50 Sitzungen warnt das System, *bevor* das Modell einen ähnlichen Fehler macht. Aufwand für die Kennzeichnung entfällt für Betreuungspersonen, ebenso wie teure Nachschulungsläufe — die Korrekturen sind der Lehrplan.

**Ehrlicher Rahmen:** Routing-Genauigkeit bei der [115-Fälle Prism-Bewertung](https://github.com/dcostenco/prism-coder/tree/main/tests/benchmarks/prism-routing-100) (7 Prism-Tools, 12 Kategorien, 3-Seed-Mittelwert, Juni 2026): 27b = 100.0%, 9b = 100.0%, 4b = 100.0%, 2b = 99.1%. Null erfundene Tool-Namen über alle Modellgrößen und Seeds hinweg. Das 2B-Modell läuft auf dem Gerät für schnelles Phrasen-Routing; 9B/27B verarbeiten komplexe Sitzungen und klinische Arbeitsabläufe über WLAN-to-Mac. Im vollständigen Berkeley BFCL V4 Leaderboard (2.000+ allgemeine Function-Calling-Fälle) erreicht das 2B-Modell ~59% — vergleichbar mit anderen Modellen unter 2B. Was PrismAAC alleinstellend macht, ist nicht das Modellergebnis allein — es ist das Modell in Kombination mit dem zugrundeliegenden Prism-Aktivierungsausbreitungs-Algorithmen-Stack.

</details>

---

## Für Entwickler

```bash
npm install && npm run dev   # http://localhost:3000/prism-aac
npm run test                 # 4900+ Unit-Tests
npm run e2e                  # Playwright über 11 Geräteprofile hinweg
```

### Überwachung

| Dashboard | Was nachverfolgt wird |
|-----------|---------------|
| [Prism AAC — User Analytics](https://app.datadoghq.com/dashboard/shk-8fb-qjk/prism-aac--user-analytics) | Sitzungen, Fehler, Wortvorhersagen, Phrasen-Taps, Sprachausgabe-Ereignisse, Sprachen, Länder, Geräte, Abrechnungspläne, Kopfverfolgungs-Telemetrie |

Datadog RUM-Integration: siehe `lib/datadog.ts` + `components/DatadogInit.tsx`. 7 E2E-Performance-Tests in `e2e/datadog-integration.spec.ts`.

---

## Lizenz

[AGPL-3.0](LICENSE) — Open Source, OSI-zugelassen, förderfähig.

Sie können das Projekt gerne forken und selbst hosten. Die Lizenz verlangt, dass Sie Änderungen ebenfalls unter der AGPL-3.0 teilen — das ist die Vereinbarung, die AAC-Innovationen dauerhaft offen und für Familien zugänglich hält.

© 2024–2026 Synalux LLC
