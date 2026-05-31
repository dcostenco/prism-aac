<!-- Auto-generated from README.md by scripts/generate_i18n.py — do not edit manually -->
# Prism AAC

**Ajută copiii si adults nonverbali să vorbească.**

Aplicație de Comunicare Augmentativă și Alternativă pentru copii cu deficiențe motorii și nevoi complexe de comunicare. Atinge imagini, construiește propoziții, ascultă-le rostite cu voce tare — în 23 de limbi. Funcționează pe orice tabletă, laptop, iPhone, iPad și Apple Watch.

Parte a [platformei Synalux](https://synalux.ai).

🌐 [English](../../README.md) · [Español](README_es.md) · [Français](README_fr.md) · [Português](README_pt.md) · **Română** · [Українська](README_uk.md) · [Русский](README_ru.md) · [Deutsch](README_de.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [中文](README_zh.md) · [العربية](README_ar.md)

<p align="center">
  <a href="https://apps.apple.com/app/id6764692277"><img src="https://img.shields.io/badge/App_Store-Download-0D96F6?style=for-the-badge&logo=apple&logoColor=white" alt="App Store"></a>
  <a href="https://synalux.ai/prism-aac"><img src="https://img.shields.io/badge/Try_It-Free-43e97b?style=for-the-badge" alt="Încearcă gratuit"></a>
  <a href="https://synalux.ai/pricing"><img src="https://img.shields.io/badge/Plans-Free_+_Paid-764ba2?style=for-the-badge" alt="Prețuri"></a>
  <a href="../../LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue?style=for-the-badge" alt="AGPL-3.0"></a>
  <a href="../../PRIVACY.md"><img src="https://img.shields.io/badge/Privacy-Policy-lightgrey?style=for-the-badge" alt="Confidențialitate"></a>
  <a href="../../TERMS.md"><img src="https://img.shields.io/badge/Terms-of_Service-lightgrey?style=for-the-badge" alt="Termeni"></a>
</p>

![Ecranul principal Prism AAC — bară de instrumente, banner program, bară de tastare, dale de predicție și tastatură qwerty](../../docs/screenshots/app-hero.png)

### Aplicații native

<p align="center">
  <img src="../../docs/screenshots/ios-iphone.png" alt="PrismAAC pe iPhone" width="220" />
  <img src="../../docs/screenshots/ios-ipad.png" alt="PrismAAC pe iPad" width="360" />
  <img src="../../docs/screenshots/watch-ultra.png" alt="PrismAAC pe Apple Watch Ultra" width="120" />
</p>

| Platformă | Stare | AI pe dispozitiv | Note |
|----------|--------|-------------|-------|
| **Web** (PWA) | Producție | Descarcă automat cel mai bun model local | Orice browser, instalabil |
| **iPad Pro 16GB** | Producție | AI pe dispozitiv (14B) | Rapid, privat, selectat automat după RAM |
| **iPhone / iPad 8GB** | Producție | AI pe dispozitiv (8B → 1.7B fallback) | Se redimensionează automat pentru a se potrivi dispozitivului |
| **iPhone / iPad <8GB** | Producție | AI pe dispozitiv (1.7B) | Se potrivește întotdeauna, 1.1 GB |
| **Apple Watch** | Producție | Dicționar de fraze offline (1,261 × 20 limbi) | Autonom — pictograme, TTS, urgență |
| **Extensie Chrome** | Producție | — | Asistent de lectură în orice câmp de text |
| **WiFi către Mac** | Producție | 14B/32B via Ollama | Setări → AI Local → introduceți IP-ul Mac |

---

## Video de previzualizare App Store

Video de 30 de secunde care prezintă toate funcțiile majore cu narațiune Inworld TTS:

https://github.com/dcostenco/synalux-docs/releases/download/v1.0-module-videos/prism_aac_preview_v5.mp4

| Scenă | Funcționalitate | Captură de ecran |
|---|---|---|
| **Acasă** — atinge fraze | Panou cu pictograme cu 22 de categorii, buton de Vorbire | <img src="../../docs/screenshots/appstore/ipad_home.png" width="200"> |
| **Categorii** | Fraze rapide pentru Ajutor, Mâncare, Locuri, Sentimente | <img src="../../docs/screenshots/appstore/ipad_categories.png" width="200"> |
| **Chat AI** | Compune mesaje, exersează conversații | <img src="../../docs/screenshots/appstore/ipad_ai-chat.png" width="200"> |
| **Alertă de urgență** | Apel cu o singură atingere pentru îngrijitor/asistentă | <img src="../../docs/screenshots/appstore/video/frame_03.png" width="200"> |
| **Program** | Rutine zilnice vizuale — dimineață, școală, prânz, culcare | <img src="../../docs/screenshots/appstore/ipad_schedule.png" width="200"> |
| **Jocuri** | Bubble Pop, Color Hunt, Match It, Yes/No, Finish It | <img src="../../docs/screenshots/appstore/ipad_games.png" width="200"> |
| **Matematică și Școală** | Matematică adaptivă cu Sugestie, Verificare, Rezolvare + tastatură numerică | <img src="../../docs/screenshots/appstore/video/frame_06.png" width="200"> |
| **Urmărirea capului și a ochilor** | Cursor de staționare bazat pe cameră, control prin privire, calibrare | <img src="../../docs/screenshots/appstore/video/frame_07.png" width="200"> |
| **12 Limbi** | Engleză, Spaniolă, Franceză, Rusă, Japoneză, Coreeană, Chineză, Arabă și altele | <img src="../../docs/screenshots/appstore/video/frame_08.png" width="200"> |

---

## Pe scurt

| Modul | Ce face | Previzualizare |
|---|---|---|
| 📂 **Categorii** | Dale cu imagini în stil PECS pentru non-cititori | <img src="../../docs/screenshots/panel-categories.png" width="120"> |
| ⌨️ **Tastează și vorbește** | Tastatură + predicție de cuvinte + voce neurală | <img src="../../docs/screenshots/app-hero.png" width="120"> |
| ✨ **Chat AI** | Asistent pe dispozitiv + în cloud, adaptat pentru utilizatorii AAC | <img src="../../docs/screenshots/panel-ai-chat.png" width="120"> |
| 💬 **Chat AAC** | Mesaje primite de la îngrijitori + contacte | <img src="../../docs/screenshots/panel-aac-chat.png" width="120"> |
| 🧮 **Matematică + materii** | Pânză cu grilă de celule cu tutore conștient de domeniu | <img src="../../docs/screenshots/math-canvas-typed.png" width="120"> |
| 🗓 **Program** | Rutine vizuale "mai întâi-apoi" | <img src="../../docs/screenshots/panel-schedule.png" width="120"> |
| 🎮 **Jocuri** | 12 jocuri AAC terapeutice | <img src="../../docs/screenshots/panel-games.png" width="120"> |
| 🏪 **Piață** | Pachete de voci, pachete de vocabular, pachete de jocuri | <img src="../../docs/screenshots/panel-marketplace.png" width="120"> |
| 🎧 **Player de confort** | Player media de noptieră pentru pacienții din spital | <img src="../../docs/screenshots/panel-comfort-player.png" width="120"> |
| 🛏 **Mod Noptieră** | Chat AI pe ecran complet pentru utilizare cu telefonul în suport / culcat | <img src="../../e2e/_screenshots/bedside-overlay-open.png" width="120"> |
| 👋 **Fără mâini** | Recunoaștere gesturi cap + mână | <img src="../../docs/screenshots/panel-settings-input-modes.png" width="120"> |
| ⚙️ **Setări** | 23 de limbi, adaptări motorii, nivel de abonament | <img src="../../docs/screenshots/panel-settings.png" width="120"> |

---

## Alternativă gratuită la Read & Write

PrismAAC include fiecare funcție de asistent de lectură pentru care majoritatea utilizatorilor AAC cumpără Read & Write — gratuit, în browser, fără a fi necesar un cont pentru nivelul web. Consultați [Tastează și vorbește](#%EF%B8%8F-type--speak) pentru vorbire la sfârșit de propoziție + evidențiere cuvinte, [Cititor PDF](#-pdf-reader) și [Cititor de capturi de ecran (OCR)](#-screenshot-reader-ocr) pentru documente, și [extensia Chrome](#-chrome-extension--same-reading-assistant-features-in-any-text-field) pentru acoperire între aplicații în Gmail / Docs / Word Online / oriunde altundeva.

## Cum se compară PrismAAC

| | PrismAAC | TouchChat | Proloquo2Go | LAMP Words | TD Snap | CoughDrop | Snap Core First | Grid 3 | Tobii Dynavox |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Cale vocală **pe dispozitiv + sigură HIPAA** | ✅ | ❌ | ❌ | ❌ | parțial | parțial | ❌ | ❌ | parțial |
| **Clasament fraze per utilizator** (se adaptează fiecărui copil) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Corecțiile îngrijitorului **devin automat date de antrenament** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Tutore AI conștient de domeniu** (matematică + 10 alte materii) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Pânză matematică cu grilă de celule** (fără LaTeX, fără tablă albă) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Istoric conștient de locație + regiune** (280+ regiuni) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Mod gesturi cap + mână **fără mâini** | ✅ | parțial | parțial | ❌ | ✅ | parțial | parțial | ✅ | ✅ |
| **Chat AI fără mâini** (buclă vocală + cuvânt de activare + suprapunere de noptieră) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Jocuri AAC** terapeutice încorporate | ✅ (12) | ❌ | ❌ | ❌ | ❌ | parțial | parțial | ❌ | ❌ |
| **Sursă deschisă** (AGPL-3.0) | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Nivel gratuit** pentru acces de siguranță vitală | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Piață** pachete de voci | ✅ | ❌ | parțial | ❌ | parțial | ❌ | ❌ | parțial | parțial |
| **Multi-limbă** (23) | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Note îngrijitor** care călătoresc acasă / școală / clinică | ✅ | ❌ | ❌ | ❌ | parțial | parțial | parțial | ❌ | parțial |
| Mod autonom **Apple Watch** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Asistent de lectură **extensie Chrome** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

> Comparația reflectă informațiile despre produse disponibile public începând cu 2026-05. PrismAAC este în dezvoltare activă; concurenții pot adăuga funcționalități în timp. PR-urile sunt binevenite pentru a menține această comparație onestă — vezi `CONTRIBUTING.md`.
>
> Grid 3 și Tobii Dynavox au integrări hardware puternice de urmărire a privirii + scanare cu comutator, care nu sunt reflectate mai sus (dependente de hardware, configurații clinice specializate).

---

## iOS și Apple Watch

### iPhone / iPad

Aplicație nativă Swift care încapsulează interfața web în WKWebView + AI pe dispozitiv via llama.cpp Metal. Selectează automat cel mai bun model în funcție de RAM-ul dispozitivului:

| Dispozitiv | RAM | Model | Descărcare |
|---|---|---|---|
| iPad Pro M1/M2/M4 | 16 GB | 14B Q4_K_M | 8.4 GB de pe HF CDN |
| iPhone 15/16 Pro, iPad Air | 8 GB | 8B Q4_K_M → 1.7B (fallback OOM) | 4.7 GB / 1.1 GB |
| iPhone 12-14, iPad-uri mai vechi | <8 GB | 1.7B Q4_K_M | 1.1 GB |

Siguranță pe trei niveluri: filtru de criză sincron → AI pe dispozitiv → fallback în cloud. Gestionarea memoriei degradează grațios: AI complet → AI în cloud → doar nucleu → mod de urgență.

- Spațiu sigur pentru Dynamic Island / crestătură
- Punte WCSession pentru expedierea de urgență Apple Watch
- Token-uri de autentificare susținute de Keychain
- Fallback OOM: dacă modelul mai mare nu se potrivește, încarcă automat următorul model mai mic

**Setări → 🤖 Modele AI Locale** — descărcați și gestionați modelele Prism:
- Detectează Ollama automat la `localhost:11434`
- Conexiuni WiFi: iPad/iPhone → Mac Ollama (14B/32B la acuratețe maximă)
- Descărcare per model cu bară de progres în timp real
- Modele: `:1b7` (1.1 GB) · `:8b` (4.7 GB) · `:14b` (8.4 GB) · `:32b` (16 GB)

### Apple Watch (autonom)

Funcționează fără iPhone — autonom cu dicționar de fraze offline.

<p align="center">
  <img src="../../docs/screenshots/watch-series.png" alt="Watch Series 11" width="140" />
  <img src="../../docs/screenshots/watch-ultra.png" alt="Watch Ultra 3" width="140" />
</p>

- **Traducere offline:** 1,261 fraze × 20 limbi incluse (411 KB JSON) — căutare instantanee, 100% precisă, fără rețea
- Grilă de pictograme pe 2 coloane cu imagini ARASAAC
- Chat AI cu dictare + introducere de la tastatură (cloud când este online, dicționar de fraze când este offline)
- Sistem de urgență: numărătoare inversă → WCSession → fallback celular → TTS
- Traducere cu ieșire TTS (dicționar offline mai întâi, fallback în cloud)
- Mesaje primite: primiți și răspundeți la mesaje de la îngrijitori
- Fixare certificat (SPKI SHA-256) la expedierea de urgență
- NFKC + igienizare injecție cu 23 de token-uri pe toate căile AI

---

## Module

### 📂 Categorii
Dale cu imagini în stil PECS. Atinge o categorie, atinge o dală, ascultă cuvântul, urmărește-l cum apare în bara de mesaje. Funcționează atât pentru non-cititori, pre-cititori, cât și pentru comunicatorii în devenire. Seturile de dale și ordinea se personalizează în timp prin activare răspândită — dalele pe care copilul le atinge cel mai des urcă; cele neutilizate luni de zile se estompează.

**Aspect înconjurător** — categoriile apar într-o coloană stângă derulabilă, alături de tastatură, astfel încât utilizatorul AAC poate atinge dalele cu imagini ȘI tasta simultan fără a schimba modurile. Bara de predicție rămâne vizibilă; ambele intrări sunt întotdeauna accesibile.

![Categorii în modul înconjurător — carduri de categorii derulabile în stânga, tastatură completă în dreapta](../../docs/screenshots/categories-surround-v2.png)

<details>
<summary><strong>Funcționalități + detalii tehnice</strong></summary>

- 22 de categorii implicite: oameni, mâncare, sentimente, corp, haine, animale, locuri etc.
- Îngrijitorul poate adăuga / elimina / reordona dale per copil
- Fiecare dală conține o `textKey` pentru i18n — schimbarea limbii aplicației reetichetează fiecare dală cu o singură atingere
- Pictogramele dalelor provin de la ARASAAC + un set curat; clonarea vocii vă permite să potriviți vocea dalei cu cea a fraților sau părinților copilului (nivel plătit)
- Învățare n-gram per utilizator: un copil care atinge "Vreau să mănânc" de trei ori vede "mănânc" urcând după "vreau" în sesiunea următoare
- Memorie holografică HRR: predicții contextuale fără căutare în ~0.2ms via Rust WASM — +27% acuratețe Top-1 pe fraze AAC de bază

**Calea de randare:** `components/CategoryPanel.tsx` → `useCategoryStore` → dale extrase din `constants/phrases.ts` (sistem) + suprascrieri Supabase per utilizator (plătit). Atingerea dalelor invocă `messageStore.appendText(phrase)` și rutează prin `aacSpeak()` pentru TTS.
</details>

---

### ⌨️ Tastează și vorbește
Tastatură pe ecran cu **predicție de cuvinte**, **completare automată AI** și un buton **Vorbire** cu o singură atingere care citește bara de mesaje cu voce tare, într-o voce neurală naturală. Tastarea învață motorul de predicție: cuvintele pe care copilul le tastează cel mai des apar mai devreme în sesiunea următoare.

![Tastatura Prism AAC cu "hello" tastat, dale de predicție și butonul Vorbire](../../docs/screenshots/keyboard-typing.png)

**Funcționalități de asistent de lectură (paritate Read & Write)** — pentru utilizatorii cu nevoi de lectură / memorie / cognitive:

- **Vorbire per cuvânt** — fiecare cuvânt este redat prin TTS în momentul în care atingeți spațiu, astfel încât auziți ce ați tastat fără să așteptați propoziția completă.
- **Rostește propoziția la `.?!`** — finalizarea unei propoziții cu un punct, semn de întrebare sau semn de exclamare citește întreaga propoziție înapoi, astfel încât să nu pierdeți șirul a ceea ce ați scris (lacuna care descalifică NVDA pentru utilizatorii cu vedere cu dizabilități cognitive). Comutați prin Setări → `speakOnSentenceEnd` (activat implicit).
- **Evidențiere cuvânt cu cuvânt în timpul vorbirii** — fiecare cuvânt rostit se luminează cu un fundal galben pe măsură ce TTS îl citește. Utilizatorii cu vedere cu dizabilități de lectură pot urmări vizual; evidențierea urmărește sunetul fără a necesita un dispozitiv hardware special.

<details>
<summary><strong>Funcționalități + detalii tehnice</strong></summary>

- 5 sloturi de predicție deasupra tastaturii qwerty, reîmprospătate la fiecare apăsare de tastă
- Completare AI ("hw" → "how", "togoso" → "to go so") via Synalux `text/correct` (Gemini 2.5 Flash-Lite, ~752ms medie, de 4.3 ori mai ieftin decât 2.5 Flash)
- Poartă inter-lingvistică: RO `eu` nu va apărea în bara EN chiar și atunci când ambele corpusuri sunt încărcate (comparație de frecvență inter-corpus)
- "Vorbire" citește cu adaptare automată a tonului (declarativ / interogativ / exclamativ inferat din punctuație)
- Nivel voce 1: Inworld TTS-2 (natural/neural, toate cele 23 de limbi ale aplicației); nivel 2: OS Web Speech (offline, nativ dispozitiv); nivel 3: WASM espeak-ng (ultima soluție)
- Evidențierea cuvintelor este estimată pe durată (~60 ms/caracter @ rată=0.5, se scalează cu cursorul de rată) — funcționează pe fiecare nivel TTS fără modificări de backend; sincronizarea precisă via Azure `wordBoundary` este o funcție Pro viitoare.
- Corpus n-gram SQLite de 1.5MB per limbă; unigrame + bigrame + trigrame; încărcat leneș la schimbarea limbii
- **Memorie contextuală HRR** — recuperare holografică fără căutare (229KB Rust WASM) care învață din fiecare frază rostită. Codifică bigrame + trigrame într-un vector holografic; sondează în ~0.2ms la fiecare apăsare de tastă. Strat aditiv — amplifică primele 2 dale de predicție cu potriviri contextuale fără a elimina predicțiile corpusului.

**Benchmark de predicție HRR** (54 de teste unitare + suită de precizie cu 10 scenarii):

| Scenariu | Baseline Top-1 | HRR+ Top-1 | Creștere | Baseline MRR | HRR+ MRR | Creștere MRR |
|----------|---------------|------------|------|-------------|---------|----------|
| Fraze AAC de bază (1x) | 36.7% | 46.7% | **+27.3%** | 0.634 | 0.672 | +6.0% |
| Fraze AAC de bază (5x zilnic) | 36.7% | 46.7% | **+27.3%** | 0.634 | 0.672 | +6.0% |
| Vocabular personal | 70.4% | 81.5% | **+15.8%** | 0.809 | 0.883 | +9.2% |
| Mixt (toate frazele) | 47.2% | 56.9% | **+20.6%** | 0.669 | 0.707 | +5.7% |
| Reamintire între sesiuni | 80.0% | 80.0% | +0.0% | 0.900 | 0.900 | +0.0% |
| Prefixe ambigue | 66.7% | 66.7% | +0.0% | 0.738 | 0.738 | +0.0% |

Top-1 = cuvântul corect este dala #1. Top-5 = cuvântul corect în orice dală. MRR = Rang Reciproc Mediu (mai mare = cuvântul corect apare mai devreme). HRR nu reduce niciodată acuratețea Top-5 în niciun scenariu — zero regresii. Cele mai mari câștiguri pe vocabular personal (+9.2% MRR) și fraze AAC de bază (+27.3% Top-1).

**Calea de randare:** `components/Keyboard.tsx` → `messageStore.appendChar` → `predictionStore.updatePredictions(text, lang)` → `engine/predictionEngine.ts` (recency × frequency × n-gram boost) + suprapunere AI opțională `services/textCorrectService.ts` + sondă bigramă/trigramă HRR `services/hrrContext.ts`. Evidențiere: `services/aacSpeak.ts` emite evenimente `tts-highlight-start` pe `ttsHighlightBus`; `components/MessageBar.tsx` se abonează și transmite `activeWordIndex` către `ColoredText`.
</details>

---

### ✨ Chat AI
Asistent pe dispozitiv + în cloud, adaptat pentru vocea utilizatorului AAC. Răspunsuri transmise în flux, fiecare linie se inserează prin atingere în bara de mesaje, astfel încât autoratul rămâne la copil. Nivelul gratuit rulează prin Gemini 2.5 Flash; nivelurile plătite rutează către Claude Sonnet 4 cu flota prism-coder pentru interogări scurte.

**Mod AI curat** — bara de predicție a cuvintelor se ascunde automat când Chatul AI este deschis (predicțiile sunt irelevante la compunerea unei întrebări), menținând focalizarea pe răspunsul AI și butonul de trimitere.

**Chat AI fără mâini** — activați butonul 🔁 din antetul chatului pentru a intra într-o buclă vocală continuă: microfonul se deschide automat după fiecare răspuns AI, astfel încât copilul poate purta o conversație completă fără a atinge ecranul. O bară de stare sub antetul chatului confirmă că modul este activ.

**Mod de traducere** — atunci când limba aplicației și limba de ieșire diferă (de exemplu, intrare în portugheză, ieșire în engleză), fiecare schimb AI este rutat automat prin calea de traducere cu streaming activat, astfel încât nu există penalizare de viteză față de modul monolingv.

![Panoul Chat AI — bara de predicție ascunsă în modul AI, tastatură completă accesibilă dedesubt](../../docs/screenshots/panel-ai-chat-v2.png)

<details>
<summary><strong>Funcționalități + detalii tehnice</strong></summary>

- Panou inline ancorat deasupra tastaturii — niciodată un modal care ascunde bara de mesaje
- Intrare vocală via Web Speech API; butonul microfonului arată transcrierea intermediară în timp real
- Atingeți orice linie AI pentru a o copia în bara de mesaje (păstrează autoratul — Valencia et al., CHI 2023)
- **Buclă fără mâini** — buton 🔁 în antet; repornește automat microfonul la 1 s după finalizarea fiecărui răspuns AI; `aria-pressed` + fundal verde confirmă starea; bară de stare sub antet în timp ce este activ
- **Cuvânt de activare "Hey Prism"** — disponibil în suprapunerea Mod Noptieră; sesiunea continuă `SpeechRecognition` detectează fraza și declanșează microfonul; nu este disponibil când puntea nativă iOS deține sesiunea audio
- Timeout fix de 15s pe partea clientului + buton Reîncercare (astfel încât panoul să nu rămână blocat pe "Gândire…" dacă rețeaua cade)
- 401 / rețea / timeout / altele → mapare erori prietenoase; nu afișează niciodată "Sesiune expirată" brut
- Fallback Ollama local (`prism-coder:1b7`) când este offline; conținutul mixt blocat de la originea browserului `synalux.ai` în practică, astfel încât eroarea prietenoasă se declanșează

**Calea de randare:** `components/AIChatPanel.tsx` → `services/aiService.askAI()` (sau `translateAI()` în modul de traducere) → flux SSE de la Synalux `/api/v1/chat` cu `credentials: 'include'`. CORS permite `synalux.ai` + originile de dezvoltare localhost.
</details>

---

### 🛏 Mod Noptieră

> **Funcționalitate critică de accesibilitate.** Modul Noptieră există deoarece unii utilizatori nu au o modalitate fiabilă de a vorbi, tasta sau atinge un ecran. Designul trebuie să funcționeze mai întâi pentru cel mai dificil caz: un pacient culcat într-un pat de terapie intensivă, cu brațele pe lângă corp, ventilat, incapabil să producă niciun sunet — comunicând doar prin privire sau un singur comutator hardware ținut între două degete.

Suprapunere de comunicare AI pe ecran complet, optimizată pentru utilizatorii care nu pot ajunge la ecran sau vorbi în mod fiabil. Fiecare țintă de atingere este supradimensionată. Vocea este o cale de intrare printre mai multe — nu singura. Interfața este operabilă în întregime prin tehnologie asistivă: scanare cu comutator, urmărire a privirii, Control Vocal iOS, urmărire a capului sau o tastatură pe ecran navigată cu un singur comutator.

Inspirat de feedback direct din partea comunității AAC (r/AssistiveTechnology, mai 2025) de la utilizatori care comunică din paturile de spital, recuperare post-chirurgicală și setări de îngrijire paliativă.

**Funcționează pe Mac / Windows?** Da. Modul Noptieră este o funcționalitate a aplicației web progresive — rulează în orice browser pe orice dispozitiv. Nu este doar pentru iOS.

---

#### Pentru cine este?

Modul Noptieră este conceput pentru utilizatori cu un spectru larg de abilități motorii și de vorbire. Cardurile de Fraze Rapide (descrise mai jos) sunt special concepute pentru utilizatorii cu cele mai severe limitări — cei care nu pot vorbi deloc și au mișcări ale mâinilor foarte limitate sau deloc.

| Profil utilizator | Metodă de intrare recomandată |
|---|---|
| Poate vorbi, brațe restricționate | Voce (🎙 buton microfon) + buclă Fără Mâini |
| Unele vocalizări, vorbire nesigură | Cuvânt de activare "Hey Prism" + buclă Fără Mâini |
| Fără vorbire, poate atinge ecranul | Carduri de Fraze Rapide (o singură atingere) |
| Fără vorbire, motor limitat — un singur comutator | Scanare Control Comutator iOS sau Acces Comutator Android peste Carduri de Fraze Rapide |
| Fără vorbire, fără mișcare a mâinilor — dispozitiv de urmărire a privirii | Hardware de urmărire a privirii (Tobii, EyeGaze Edge etc.) se prezintă ca un indicator de mouse — toate cardurile sunt navigabile |
| Fără vorbire, poate mișca capul | Urmărirea capului (ex. Indicator Cap iOS, Control Cameră pe iPhone 16) — cardurile sunt ținte de navigare de dimensiune completă |
| Traheotomie / ventilat, fără vocalizare | Carduri de Fraze Rapide via urmărire a privirii sau comutator + mod asistat de îngrijitor |

---

#### Suport platformă

| Platformă | Mod Noptieră | Carduri Rapide | Buclă Fără Mâini 🔁 | Cuvânt de Activare 🎯 |
|---|:---:|:---:|:---:|:---:|
| Web — Mac / Windows / Linux (orice browser) | ✅ | ✅ | ✅ | ✅ |
| Web — iPhone / iPad (Safari) | ✅ | ✅ | ✅ | ⚠️ Doar Safari |
| Aplicație nativă iOS (App Store) | ✅ | ✅ | ✅ | ❌ utilizați Fără Mâini |
| Android (Chrome / Edge) | ✅ | ✅ | ✅ | ✅ |
| Dispozitiv de urmărire a privirii (orice — se prezintă ca mouse) | ✅ | ✅ | ✅ | ✅ |
| Scanare cu comutator (Control Comutator iOS) | ✅ | ✅ | ✅ | ❌ |
| Apple Watch | ❌ | ❌ | ❌ | ❌ |

> **De ce nu există cuvânt de activare în aplicația nativă iOS?** Puntea nativă preia proprietatea sesiunii audio (`prismNativeBridge.startVoice`), ceea ce intră în conflict cu API-ul `SpeechRecognition` al browserului pe care îl utilizează serviciul de cuvânt de activare. Utilizați în schimb **bucla Fără Mâini** (🔁) — aceasta repornește microfonul automat la 1 secundă după fiecare răspuns AI, fără a necesita nicio intrare continuă.

---

#### Cum să începeți

1. Deschideți panoul **Chat AI** — atingeți pictograma 🤖 din bara de instrumente.
2. Atingeți **🛏** în antetul panoului — suprapunerea pe ecran complet se deschide imediat.
3. Alegeți metoda de intrare (vezi secțiunile de mai jos).

<p align="center">
  <img src="../../e2e/_screenshots/bedside-overlay-open.png" alt="Suprapunerea Mod Noptieră deschisă — interfață neagră pe ecran complet. Banda superioară arată Carduri de Fraze Rapide. Zona de mijloc arată răspunsurile AI. Partea de jos arată butonul mare roșu al microfonului și rândul de comenzi." width="260">
  <img src="../../e2e/_screenshots/bedside-overlay-handsfree-on.png" alt="Mod Noptieră cu Fără Mâini activ — butonul 🔁 evidențiat verde, textul de stare 'Fără Mâini ACTIV' vizibil" width="260">
  <img src="../../e2e/_screenshots/bedside-hands-free-on.png" alt="Buton de comutare Fără Mâini în stare activă — fundal verde, aria-pressed=true" width="260">
</p>

#### Cum să opriți / ieșiți

- **Atingere / apăsare:** atingeți **✕** în colțul din dreapta sus al suprapunerii (țintă de 48 × 48 px).
- **Tastatură / comutator:** apăsați **Escape**.
- **Voce:** rostiți orice comandă prin Control Vocal iOS în timp ce suprapunerea este deschisă.

Întregul istoric al chatului și starea sesiunii AI sunt păstrate la ieșire. Suprapunerea se află deasupra panoului principal ca un strat de randare separat — nimic nu se pierde când o închideți.

<p align="center">
  <img src="../../e2e/_screenshots/bedside-overlay-closed.png" alt="După închiderea Modului Noptieră — înapoi la panoul principal de chat AI cu istoricul conversației intact" width="260">
  <img src="../../e2e/_screenshots/bedside-wakeword-statusbar.png" alt="Bara de stare a panoului principal arătând 'Hey Prism activ' cu indicator albastru după revenirea din Modul Noptieră" width="260">
</p>

---

### 🃏 Carduri de Fraze Rapide — pentru utilizatori non-verbali și imobilizați

> **Aceasta este calea critică pentru utilizatorii care nu pot vorbi sau atinge ecranul liber.** Cardurile de Fraze Rapide sunt butoane de comunicare pre-programate care pot fi activate printr-o singură atingere, staționare a privirii sau selecție prin scanare cu comutator. Fără tastare. Fără voce. Nu este necesar internet pentru a le utiliza.

Fiecare card afișează o pictogramă emoji mare și o frază scurtă. Atingerea unui card încarcă imediat acea frază în bara de mesaje. Dacă modul **Fără Mâini** este activat, fraza este trimisă automat către AI.

#### Carduri încorporate

Cincisprezece carduri sunt preîncărcate la prima utilizare, grupate după urgență. Nu pot fi șterse. Funcționează offline.

**Urgent (prioritate maximă — comunicați-le mai întâi într-o urgență medicală):**

| Icon | Frază | Când se utilizează |
|:---:|---|---|
| 🆘 | AJUTOR — URGENȚĂ | Pericol imediat, apel de cod, orice situație care necesită personal acum |
| 😢 | Mă doare | Durere de orice fel — locația/severitatea pot urma în text liber |
| 🫁 | Nu pot respira | Detresă respiratorie, problemă cu căile respiratorii, atac de panică |
| 🔔 | Cheamă asistenta | Solicitare de personal non-urgență |

**Nevoile fizice:**

| Icon | Frază | Când se utilizează |
|:---:|---|---|
| 💧 | Apă, vă rog | Sete, gură uscată, înghițire medicamente |
| 🔥 | Îmi este prea cald | Febră, pătură, reglarea temperaturii |
| 🥶 | Îmi este prea frig | Frisoane, pătură, temperatura camerei |
| ↔️ | Vă rog să mă repoziționați | Ameliorarea presiunii, confort, poziționare post-chirurgicală |
| 💊 | Am nevoie de medicamentele mele | Doză programată, solicitare PRN, medicamente pentru durere |

**Comunicare:**

| Icon | Frază | Când se utilizează |
|:---:|---|---|
| ✅ | Da | Confirmare — răspuns la întrebări da/nu ale îngrijitorului |
| ❌ | Nu | Refuz — răspuns la întrebări da/nu ale îngrijitorului |
| ⏳ | Vă rog să așteptați | Are nevoie de un moment — nu continuați încă |

**Emoțional:**

| Icon | Frază | Când se utilizează |
|:---:|---|---|
| ❤️ | Te iubesc | Familie, conexiune emoțională |
| 🙏 | Mulțumesc | Recunoștință |
| 😨 | Mi-e frică | Anxietate, frică, detresă — declanșează un răspuns AI empatic |

#### Cum se utilizează Cardurile de Fraze Rapide

**O singură atingere / urmărire a privirii / selecție cu comutator:**
Activarea unui card plasează textul său în bara de mesaje. Fraza poate fi apoi:
- Trimisă către AI pentru un răspuns contextual (ex. atingerea "Mi-e frică" → AI răspunde cu reasigurare și pune întrebări suplimentare)
- Citită ca atare — îngrijitorii din cameră pot vedea cardul care a fost atins pe ecran

**Cu modul Fără Mâini activat:**
Fraza este trimisă automat către AI în momentul în care cardul este atins. Microfonul repornește la 1 secundă după ce AI răspunde — creând o buclă continuă fără nicio altă intrare.

**Cu cuvântul de activare "Hey Prism" activ (web / desktop):**
Cuvântul de activare + Card Rapid pot fi combinate: utilizatorul spune "Hey Prism" pentru a deschide microfonul, AI răspunde, iar utilizatorul poate apoi atinge un card pentru a continua conversația într-o direcție diferită fără a mai vorbi.

#### Cum se adaugă carduri personalizate

Îngrijitorii, BCBA-ii și membrii familiei pot adăuga carduri personalizate adaptate nevoilor specifice de comunicare ale utilizatorului — numele medicilor lor, fraze preferate, descrieri specifice ale durerii, expresii religioase sau orice altceva.

**Pași:**

1. În Modul Noptieră, atingeți **＋ Adaugă** la sfârșitul benzii de Fraze Rapide.
2. Tastați fraza dorită pe card (până la 80 de caractere).
3. Atingeți **Adaugă Card** — AI generează automat o pictogramă emoji care se potrivește cu sensul frazei (ex. "Dă-mi mai multe pături" → 🛏, "Vreau să mă rog" → 🤲).
4. Pictograma apare cu o scurtă animație "✨ Generare…", apoi cardul este salvat.

Cardurile personalizate sunt salvate local pe dispozitiv (localStorage). Ele persistă între sesiuni și reporniri ale aplicației. Nu este necesar un cont sau o conexiune la internet pentru a utiliza cardurile salvate — doar generarea inițială a pictogramei necesită un apel de rețea.

**Exemple de carduri personalizate de luat în considerare pentru adăugare:**

| Frază sugerată | De ce |
|---|---|
| `[Numele doctorului], vă rog să veniți` | Mai rapid decât "cheamă asistenta" generic pentru un clinician specific |
| `Trebuie să vorbesc cu familia mea` | Situații emoționale/legale care necesită rude de gradul I |
| `Vă rog să stingeți luminile` | Sensibilitate senzorială, migrenă, somn |
| `Vreau să mă rog` | Îngrijire spirituală — demnitate în setările de sfârșit de viață |
| `Ceva nu este în regulă` | Semnal vag de detresă — determină AI să pună întrebări clarificatoare |
| `Am nevoie de aspirație` | Pacienți cu traheotomie / ventilator |
| `Perfuzia mă doare` | Infiltrare, alertă de flebită |
| `Vreau să merg acasă` | Conversații paliative/de externare |

#### Cum se șterg cardurile personalizate

1. Atingeți **✏️ Editează** în antetul benzii de Fraze Rapide.
2. O insignă roșie **✕** apare pe fiecare card personalizat (cardurile încorporate sunt protejate și nu pot fi eliminate).
3. Atingeți ✕ pe orice card pentru a-l elimina.
4. Atingeți **Gata** pentru a ieși din modul de editare.

#### Configurare scanare cu comutator (iOS)

Pentru utilizatorii care pot activa doar un singur comutator extern (sip-and-puff, comutator de cap, comutator de picior, comutator de pernă):

1. Conectați comutatorul la iPhone/iPad via Bluetooth sau portul lightning/USB-C.
2. Accesați **Setări → Accesibilitate → Control Comutator → Comutatoare** și atribuiți comutatorul la "Selectează Element".
3. Accesați **Control Comutator → Stil de Scanare** și alegeți "Scanare Automată" — dispozitivul va evidenția automat elementele unul câte unul.
4. Deschideți Prism AAC în Modul Noptieră. Controlul Comutatorului va scana automat Cardurile de Fraze Rapide. Activați comutatorul când cardul dorit este evidențiat.
5. Fraza este trimisă imediat — nu este necesară o a doua acțiune.

> Toate Cardurile de Fraze Rapide poartă `data-scan-group="quick-cards"` astfel încât tehnologia asistivă poate scana în grup întreaga bandă înainte de a trece la alte regiuni ale interfeței.

#### Configurare urmărire a privirii

Hardware-ul de urmărire a privirii (Tobii Dynavox, EyeGaze Edge, PCEye, MyTobii P10 etc.) se prezintă sistemului de operare ca un indicator de mouse standard cu clic prin staționare. Nu este necesară o configurare specială în Prism AAC:

1. Configurați timpul de staționare în software-ul dispozitivului dvs. de urmărire a privirii (recomandat: 800–1200 ms pentru utilizatorii noi).
2. Deschideți Prism AAC în Modul Noptieră în orice browser.
3. Staționați cu privirea pe un Card de Frază Rapidă pentru a-l activa.

Dimensiunea minimă a cardului (88 × 80 px) îndeplinește cerința WCAG 2.5.5 AAA privind dimensiunea țintei de 44 × 44 px CSS și depășește minimul tipic recomandat pentru interacțiunea cu privirea (60 × 60 px).

---

<details>
<summary><strong>Toate funcționalitățile + detalii de implementare tehnică</strong></summary>

**Cinci subsisteme livrate ca o singură funcționalitate:**

1. **Carduri de Fraze Rapide** — `services/bedsideCards.ts` + interfața benzii în `components/BedsideOverlay.tsx`.

   - Stocare: cheie `localStorage` `prism_bedside_cards_v1`. Validare schemă la fiecare încărcare — intrările malformate sunt eliminate silențios.
   - Limită: maxim 50 de carduri personalizate (previne creșterea nelimitată a stocării).
   - Carduri încorporate: 15 intrări cu `id` prefixat `builtin-`; garda UI de ștergere verifică acest prefix înainte de a afișa insigna ✕, asigurând că valorile implicite nu sunt niciodată eliminate.
   - Generare pictogramă AI: `services/aiService.ts → inferCardIcon(text)`. Utilizează același lanț de rutare local-Ollama → cloud Synalux ca și restul aplicației. Trimite fraza ca mesaj de utilizator cu un prompt de sistem blocat ("Răspunde cu exact un emoji…"). Extrage primul punct de cod Unicode din răspuns. Se rezolvă întotdeauna — revine la 💬 la eroare de rețea sau răspuns non-emoji.
   - Offline: cardurile funcționează complet offline; doar adăugarea unui card nou necesită rețea (pentru generarea pictogramei — revine la 💬 dacă este offline).

2. **Buclă AI fără mâini (🔁)** — accesibilă și din antetul principal al chatului AI. După fiecare răspuns AI, microfonul repornește automat (întârziere de 1 s). Un model de referință `handsFreeRef` / `startListeningRef` asigură că efectul apelează întotdeauna callback-ul curent fără a rula din nou la fiecare randare.

   ![Bara de stare Fără Mâini în panoul principal AI](../../e2e/_screenshots/bedside-hands-free-statusbar.png)

3. **Suprapunere de noptieră** — interfață întunecată pe ecran complet `fixed inset-0 z-50 bg-black` randată ca un `<Fragment>` frate alături de panoul principal AI, astfel încât starea panoului este păstrată între ciclurile de deschidere/închidere. Accesibilitate: `role="dialog"`, `aria-modal="true"`, `aria-label="Mod Noptieră"`, capcană de focalizare WCAG 2.1 SC 2.1.2 (Tab/Shift+Tab cicluri în cadrul suprapunerii, `Escape` închide). Acoperirea viewport-ului verificată independent E2E (toleranță ≤ 4 px).

   - **Buton mare microfon** — 112 × 112 px (`w-28 h-28`), roșu + pulsând în timpul ascultării, margine albă în repaus. Verificat ≥ 96 px de Playwright `boundingBox()`.
   - **Bandă Carduri Rapide** — rând de derulare orizontală, fiecare card `88 × 80 px`, `data-scan-group="quick-cards"` pentru gruparea scanării cu comutator, `role="list"` / `role="listitem"` pentru semantica cititorului de ecran.
   - **Rând de comenzi** — Fără Mâini (verde când este activat), cuvânt de activare "Hey Prism" (albastru când este activat, ascuns când `!wakeWordSupported`), scurtătură Control Vocal iOS.
   - **Ieșire** — buton ✕ (`w-12 h-12`) sau `Escape` → `onClose()` → `bedsideModeActive = false` în `AIChatPanel` → focalizarea WCAG 2.4.3 returnată la butonul 🛏 care a deschis dialogul.

   ![Suprapunere de noptieră — închisă, înapoi la panoul principal AI](../../e2e/_screenshots/bedside-overlay-closed.png)

4. **Cuvânt de activare "Hey Prism"** — `services/wakeWordService.ts`. Rulează o sesiune continuă `SpeechRecognition` în fundal. Detectează orice transcriere care conține "hey prism", declanșează microfonul o dată, apoi se resetează pentru următorul ciclu. Garda: nu este pornit când puntea nativă iOS deține microfonul (`prismNativeBridge?.startVoice` prezent). Starea activă a cuvântului de activare este afișată în bara de stare a panoului principal după închiderea suprapunerii.

   ![Bara de stare arătând "Hey Prism" activ](../../e2e/_screenshots/bedside-wakeword-statusbar.png)

5. **Ghid Control Vocal iOS** — atingerea 📱 în rândul de comenzi încearcă `prismNativeBridge.openSettings('accessibility')` (link direct către Accesibilitate pe versiunile native suportate). Pe web / desktop, revine la un card de instrucțiuni în suprapunere care ghidează prin `Setări → Accesibilitate → Control Vocal → Activat`.

   <p align="center">
     <img src="../../e2e/_screenshots/bedside-voice-control-card.png" alt="Card de instrucțiuni Control Vocal iOS — ghid pas cu pas afișat în suprapunerea Mod Noptieră când 📱 este atins pe web/desktop" width="260">
     <img src="../../e2e/_screenshots/bedside-voice-control-dismissed.png" alt="Card de instrucțiuni Control Vocal iOS după închidere — suprapunerea revine la aspectul normal de noptieră" width="260">
   </p>

**Acoperire teste:**
- `services/bedsideCards.test.ts` — 22 de teste unitare: set de carduri implicit, localStorage round-trip, fallback JSON malformat, filtrare carduri invalide, limită de 50 de carduri, constrângeri de câmp `createCard`.
- `e2e/bedside-mode.spec.ts` — 17 teste E2E Playwright: vizibilitate buton, comutare `aria-pressed`, clase de stare verde/albastru, text bară de stare, atribute de accesibilitate suprapunere, dimensiune `boundingBox` microfon, acoperire viewport, afișare/închidere card instrucțiuni.

**Fișiere cheie:**
- `components/AIChatPanel.tsx` — stare noptieră, stare card (`bedsideCards`), `handleAddBedsideCard`, `handleDeleteBedsideCard`, buclă fără mâini, ciclu de viață cuvânt de activare, butoane antet
- `components/BedsideOverlay.tsx` — interfață suprapunere, bandă Carduri Rapide, dialog adăugare card, mod editare, capcană de focalizare, card instrucțiuni control vocal
- `services/bedsideCards.ts` — tip `BedsideCard`, `DEFAULT_BEDSIDE_CARDS`, `loadCards`, `saveCards`, `createCard`
- `services/aiService.ts` → `inferCardIcon(text)` — inferență emoji AI
- `services/wakeWordService.ts` — detectare continuă frază de activare
</details>

---

### 📨 Trimite un mesaj — selector de furnizor
Când un contact are mai mulți furnizori configurați (ex. atât Mail, cât și SMS), o secțiune **"Trimite via"** apare deasupra zonei de compunere. O singură atingere schimbă furnizorul înainte de a compune — nu este nevoie să părăsiți panoul.

![Selector de furnizor de contact — rândul 'Trimite via' cu Mail evidențiat verde, SMS disponibil](../../docs/screenshots/contact-provider-picker.png)

---

### 💬 Chat AAC
Mesajele primite de la furnizorii conectați (Telegram, WhatsApp, Email, Slack etc.) ajung în acest panou. Insigna de necitit din bara de instrumente arată numărul, alarma + notificarea între file se declanșează când sosește un mesaj nou, iar atingerea unei linii de mesaj o copiază în bară, astfel încât copilul să poată compune un răspuns cu propria voce.

![Panoul Chat AAC arătând mesaje primite de la îngrijitori cu insignă de necitit](../../docs/screenshots/panel-aac-chat.png)

<details>
<summary><strong>Funcționalități + detalii tehnice</strong></summary>

- Mesaje primite interogate via portalul Synalux `/api/v1/prism-aac/inbox/poll` (no-op la 404 dacă portalul nu este configurat)
- Notificare `BroadcastChannel` între file la mesaj nou
- Abstractizare furnizor: adăugarea Outlook / Slack / Discord = ~30 LOC fiecare (vezi `synalux-private/scripts/fetch-messages.mjs`)
- Starea de citire se sincronizează înapoi, astfel încât îngrijitorii să vadă când copilul a văzut mesajul lor
- Nivel gratuit: 1 furnizor conectat; nivel plătit: nelimitat
- TTS per mesaj, astfel încât copilul să poată auzi textul primit în vocea preferată

**Calea de randare:** `components/AACChatPanel.tsx` → `services/inboxPolling.ts` (interogare la 5s când sidePanel === 'aac-chat', 60s altfel) → `useScheduleStore.setIncomingMessages()`. Fiecare mesaj este, de asemenea, adăugat la pista "Mesaje de la îngrijitori" a programului.
</details>

---

### 🧮 Materii școlare
Pânză cu grilă de celule care găzduiește **19 tastaturi de materii** care acoperă întregul program de liceu: matematică + științe + programare + arte + științe umaniste. Fiecare filă rutează tutorele AI printr-un șablon de prompt specific domeniului (33 de șabloane în total), astfel încât modelul să nu aplice raționamentul algebric unei diagrame Punnett sau să confunde o dinamică muzicală cu un literal de programare. **Istoria este conștientă de locație + regiune** până la nivel de stat / provincie / Land / comunitate autonomă — peste 280 de regiuni în 23 de țări.

![Pânză cu grilă de celule cu 5 + 7 = 12 tastat pe celule](../../docs/screenshots/math-canvas-typed.png)

<details>
<summary><strong>File de materii (19 în total)</strong></summary>

**Matematică (9 tastaturi)** — Principală, Matematică Avansată (π √ exponenți + 5 instrumente de decorare: casetă fracție, casă de împărțire lungă, bară rădăcină, linie de sumare, bară fracție), a–z, Matematică Diverse (teoria mulțimilor + logică), Timp & Distanță, Greutate, Volum, Geometrie, Bani.

**Științe (4)** — Chimie (24 elemente + săgeți de reacție + sarcini + indici + markeri de fază), Fizică (greacă completă + 16 unități SI + ∫/∂/∇/∑/∏ + constante), Biologie (ADN/ARN + genetică + 8 ranguri taxonomice + 12 organite), Statistică (μ σ x̄ + 12 operații + distribuții).

**Programare (2)** — Python (24 operații + 26 cuvinte cheie) și Java (24 operații + 26 cuvinte cheie). Codul introduce un caracter per celulă, astfel încât se aranjează natural pe grila monospace.

**Arte + Științe Umaniste (4)** — Muzică (3 chei + 6 note + 5 pauze + 5 alterații + 8 dinamici), Științe ale Pământului (vreme + plăci + 10 planete + AU/ly/pc/Mya/Gya), Istorie (conștientă de locație + regiune), Arte Lingvistice (12 părți de vorbire + 6 tipuri de propoziții + punctuație + stiluri de citare).

</details>

<details>
<summary><strong>Tutore AI — 11 domenii × 3 moduri = 33 de prompturi</strong></summary>

![Suprapunere tutore AI cu sugestie simulată deasupra pânzei](../../docs/screenshots/math-tutor-hint.png)

Trei moduri per materie: 💡 **Sugestie** (îndrumare blândă pentru pasul următor, nu rezolvă niciodată), ✓ **Verificare** (validează răspunsul copilului, sărbătorește dacă este corect), 🎓 **Rezolvare** (parcurgere completă pas cu pas, maxim 4 pași). Fila activă îi spune tutorelui la ce materie lucrează copilul. Timeout fix de 15 s + buton Reîncercare, astfel încât suprapunerea să nu rămână blocată niciodată.
</details>

<details>
<summary><strong>Istorie — conștientă de locație + regiune</strong></summary>

![Tastatură Istorie în locația en (fără regiune) — niveluri universal + național](../../docs/screenshots/math-keyboard-history-en.png)
![Tastatură Istorie cu regiunea US-TX — Alamo, anexarea Texasului, JFK apar](../../docs/screenshots/math-keyboard-history-us-tx.png)

Trei niveluri suprapuse:
1. Evenimente **universale** predate în fiecare curriculum (476, 1914 Primul Război Mondial, 1939 Al Doilea Război Mondial, 1969 aselenizare)
2. Evenimente **naționale** selectate după `language` (en, es, fr, de, ro, ru, uk, ja, ko, zh, ar, it, pl, nl, he, hi, vi, tr, pt) — 19 limbi suportate
3. Evenimente **sub-naționale** selectate după `historyRegion` (US-TX, CA-QC, UK-SCT, ES-CT, IN-MH, DE-BY, …) — **peste 280 de regiuni în 23 de țări**, inclusiv toate cele 50 de state americane + DC, 13 provincii / teritorii canadiene, toate cele 4 națiuni ale Regatului Unit, Irlanda (Republica + 4 provincii istorice), toate cele 16 Landuri germane, toate cele 17 comunități autonome spaniole, toate cele 20 de regiuni italiene, plus AU, FR, MX, BR, IN, CN, RU, BE, CH, NL, AR, ZA, KR, PK, NZ, PL.

Promptul tutorelui poartă locația + regiunea, astfel încât o dată ambiguă precum 1836 în `US-TX` se rezolvă la Alamo (nu la statutul de stat al Alabamei); 1759 în `CA-QC` se ancorează la Câmpiile lui Abraham; 1714 în `ES-CT` la căderea Barcelonei.

</details>

<details>
<summary><strong>Fluxuri de lucru de testare — 12 materii × probleme cu cuvinte de clasa 8-12 × 72 de teste Playwright</strong></summary>

Fișe de probleme pas cu pas care exersează fiecare tastatură de materie, plus un test Playwright executabil per problemă care controlează panoul de matematică live și verifică dacă glifele fiecărui pas ajung în grila de celule. Modelat direct după o pagină de referință reală de algebră de clasa a 9-a.

- **Stratul 1 — pas cu pas generic:** [`tests/workflows/`](../../tests/workflows/) — 12 fișiere markdown (matematică avansată, biologie, chimie, științe ale pământului, geometrie, istorie, arte lingvistice, matematică diverse, fizică, programare-java, programare-python, statistică).
- **Stratul 2 — clasă reală pe niveluri de clasă:** [`tests/workflows/grade-8-12/`](../../tests/workflows/grade-8-12/) — 12 fișiere markdown cu probleme cu cuvinte cu variabile numite (algebră-clasa-9, geometrie-clasa-10, fizică-clasa-11, chimie-clasa-10, biologie-clasa-9, statistică-clasa-11, programare-python-clasa-9, programare-java-clasa-11, pre-calcul-clasa-12, științe-pământului-clasa-9, arte-lingvistice-clasa-8, istorie-mondială-clasa-10) + [`REPORT.md`](../../tests/workflows/grade-8-12/REPORT.md) cu lacune de tastatură per materie.
- **Stratul 3 — Playwright e2e:** [`e2e/math-workflows/`](../../e2e/math-workflows/) — 72 de teste (`npx playwright test --project=desktop e2e/math-workflows`).

Index complet, materii sub-suportate clasificate și ghidul "cum să adăugați un nou flux de lucru" → **[`docs/WORKFLOWS.md`](../../docs/WORKFLOWS.md)**.

</details>

<details>
<summary><strong>Alte funcționalități matematice (instrument de blocare, mărire cu două atingeri, salvare / sincronizare)</strong></summary>

- **Instrument de blocare** — după ce copilul termină o problemă, blocați regiunea. Celulele blocate se randează ușor estompate și resping editările.
- **Mărire cu două atingeri** — prima atingere activează tasta (scalare de 1.4× + halou verde), a doua atingere confirmă. Dezactivare automată după 2 s. Pentru utilizatorii cu imprecizie motorie.
- **Salvare + sincronizare** — local-first în `localStorage`; sincronizare cu cel mai bun efort către portalul Synalux via butonul `↻ Sincronizare`. Limită 100 de documente / 200 KB corp; cele mai vechi sunt eliminate.
- **Timp de staționare** — staționare configurabilă per tastă (0–1500ms) cu inel de progres verde.

![Suprapunere documente salvate arătând o intrare și un buton Sincronizare](../../docs/screenshots/math-docs-overlay.png)
![O tastă numerică activată în starea mărită cu halou verde](../../docs/screenshots/math-two-hit-armed.png)
![Instrument de blocare activat, solicitând utilizatorului să atingă un colț al regiunii](../../docs/screenshots/math-lock-armed.png)

</details>

<details>
<summary><strong>Tastaturi de materii — imagini suplimentare</strong></summary>

![Tastatură Chimie cu H₂O](../../docs/screenshots/math-keyboard-chemistry.png)
![Tastatură Biologie cu A T G](../../docs/screenshots/math-keyboard-biology.png)
![Tastatură Java cu `private String`](../../docs/screenshots/math-keyboard-java.png)
![Tastatură Muzică](../../docs/screenshots/math-keyboard-music.png)
![Tastatură Statistică](../../docs/screenshots/math-keyboard-statistics.png)
![Tastatură Științe ale Pământului](../../docs/screenshots/math-keyboard-earth-science.png)
![Tastatură Arte Lingvistice](../../docs/screenshots/math-keyboard-language-arts.png)
![Istorie în locația română](../../docs/screenshots/math-keyboard-history-ro.png)

</details>

---

### 🗓 Program
Program vizual "mai întâi-apoi" pentru rutină + suport de tranziție. Fiecare pas este o dală cu imagine + etichetă; finalizarea unei dale declanșează un sunet + un marcaj vizual de progres. Magazinul de recompense (nivel plătit) se deblochează la sfârșitul unei rutine.

![Panoul Program cu tablă "mai întâi-apoi" + listă de activități](../../docs/screenshots/panel-schedule.png)

<details>
<summary><strong>Funcționalități + detalii tehnice</strong></summary>

- Grilă presetată de 24 de dale pentru adăugări de activități cu o singură atingere: trezire, spălat pe dinți, mic dejun, școală, gustare, prânz, joacă, citit, artă, plimbare, cină, baie, poveste de culcare, culcare, medicamente, ață dentară, curățenie, spălătorie, îngrijire animale de companie, sport, …
- Reordonare prin drag-and-drop; editare inline cu pictogramă creion; adăugările presetate poartă `textKey`, astfel încât schimbarea limbii reetichetează
- Mașină de stare "Mai întâi-Apoi": pulsare dală armată, sunet ascendent de 3 note la expirarea temporizatorului, sigur pentru mișcare (`prefers-reduced-motion` → inel static), semantică `aria-pressed`
- Încălzire audio: oscilatorul de 1Hz aproape silențios menține AudioContext "activ" pe iOS Safari, astfel încât sunetul temporizatorului să se audă efectiv după o tăcere lungă (fără încălzire, sunetul se declanșează într-un context suspendat = fără sunet)
- Mesajele îngrijitorului se adaugă la program ca o pistă "Mesaje", astfel încât copilul să vadă ce urmează + cine a trimis mesaj

**Calea de randare:** `components/SchedulePanel.tsx` → `useScheduleStore` (24 de activități presetate + personalizate) → `services/feedback.ts:playTimerRing()` → AudioContext partajat via `services/azureTTS.ts:warmupAzureAudio()`.
</details>

---

### 🎮 Jocuri
12 jocuri AAC bazate pe dovezi. Construite pentru a învăța comunicarea, **nu pentru timpul petrecut în fața ecranului**. Fiecare joc înregistrează enunțurile + acuratețea, astfel încât motorul adaptiv poate sugera următorul joc cel mai potrivit.

![Panoul Jocuri cu 9 dale de joc](../../docs/screenshots/panel-games.png)

<details>
<summary><strong>Cele 12 jocuri + detalii tehnice</strong></summary>

| Joc | Abilitate vizată |
|---|---|
| Bubble Pop | Cauză + efect, comunicare intenționată |
| Color Hunt | Vocabular receptiv (nume de culori) |
| My Story | Secvențiere narativă |
| Match It | Potrivire + gândire categorică |
| Yes/No | Discriminare binară, cerere/refuz |
| Finish It | Completare propoziție (cloze) |
| Category Sort | Categorizare semantică |
| Emotion Match | Etichetare afectivă, ToM |
| What Comes Next | Raționament secvențial |
| Same / Different | Discriminare vizuală — potrivire sau contrast |
| I Hear It (Sound Match) | Discriminare auditivă + vocabular |
| Turn Taker | Practică de luare a rândului social |

- Nivel gratuit: Bubble Pop, Color Hunt, My Story (3 jocuri)
- Nivel plătit: toate cele 12
- Date per joc alimentează `services/adaptiveEngine.ts` — lungime enunț / categorie / oră din zi / rezultat → sugerează următorul joc
- Toate jocurile dezactivează categoriile de dale AAC care nu sunt relevante pentru vocabularul acelui joc, astfel încât copilul să nu fie distras

**Calea de randare:** `components/GamesPanel.tsx` → componente individuale de joc în `components/games/`. Fiecare joc înregistrează via `useScheduleStore.recordMessage(text, category)`.
</details>

---

### 🏪 Piață
Pachete de voci (voci Inworld, voce personalizată clonată a unui frate/părinte), pachete de vocabular (vocabular de bază spaniol, vorbire asistată prin semne), pachete de jocuri (jocuri suplimentare pe lângă cele 9). Aplicațiile se instalează în bara de instrumente prin același registru pe care îl utilizează panourile încorporate.

![Panoul Piață cu aplicații instalabile](../../docs/screenshots/panel-marketplace.png)

<details>
<summary><strong>Funcționalități + detalii tehnice</strong></summary>

- Aplicațiile există ca intrări JSON (`lib/marketplace/manifests/local.ts`) + un `lib/marketplace/registry.ts` de rulare cu `getHandler(appId)` care returnează componenta panoului
- Clonare voce (nivel plătit): înregistrare de 90s → voce antrenată utilizabilă pentru orice TTS în aplicație, inclusiv dale de categorii
- Aplicațiile instalate se randează ca butoane în bara de instrumente după cele încorporate; `useSettingsStore.installedApps` este sursa de adevăr
- Poartă per nivel: piața listează totul, dar butoanele de instalare se dezactivează pentru elementele peste planul utilizatorului

**Calea de randare:** `components/MarketplacePanel.tsx` → `useMarketplaceStore` → backend `synalux/api/v1/marketplace/...` pentru achiziție, apoi descărcare de active (fișiere vocale, JSON vocabular) în IndexedDB.
</details>

---

### 📄 Cititor PDF
Deschideți un PDF, vedeți o dală per pagină, atingeți pentru a o auzi rostită cu vocea dvs. Fișe de lucru școlare, scrisori de acasă, articole — introduceți orice PDF și ascultați în loc să încercați să-l citiți. Nu este necesar Adobe Reader; întreaga bibliotecă rulează în browserul dvs.

![Panoul Cititor PDF — stare goală cu promptul "+ Deschide PDF"](../../docs/screenshots/panel-pdf-reader.png)

<details>
<summary><strong>Funcționalități + detalii tehnice</strong></summary>

- O dală per pagină; fiecare arată primele 3 linii + un buton `▶ Pagina N` care trece prin `aacSpeak()` (aceeași voce + ton + evidențiere cuvânt ca tot restul)
- `▶ Citește tot` concatenează fiecare pagină într-un singur enunț continuu
- Detectarea paginilor goale (PDF-uri cu imagini scanate) sugerează instrumentul OCR
- `pdfjs-dist` importat dinamic la prima deschidere — un fragment separat de ~3 MB de la CDN, versiune fixată la pachetul npm
- Butonul din bara de instrumente (📄) este opțional via Setări → Bară de instrumente, astfel încât bara de instrumente implicită minimală să rămână curată

**Calea de randare:** `components/PdfReaderPanel.tsx` → `services/pdfReader.ts` (pdfjs `getDocument` → per-page `getTextContent`) → `services/aacSpeak.ts`.
</details>

---

### 👁 Cititor de capturi de ecran (OCR)
Lipiți sau încărcați o fotografie a unei fișe de lucru, o captură de ecran a unei pagini web, o imagine a unei pagini de manual — textul recunoscut apare lângă imagine și puteți atinge **▶ Vorbește** pentru a-l auzi, sau **↧ Trimite în bara de mesaje** pentru a edita înainte de a vorbi.

![Panoul Cititor de capturi de ecran (OCR) — stare goală cu promptul "+ Deschide imagine"](../../docs/screenshots/panel
