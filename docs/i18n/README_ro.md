<!-- Auto-generated from README.md by scripts/generate_i18n.py — do not edit manually -->
# Prism AAC

**Ajută copiii și adulții nonverbali să vorbească.**

Aplicație de comunicare augmentativă și alternativă (AAC) pentru copii cu deficiențe motorii și nevoi complexe de comunicare. Atinge imagini, construiește propoziții, ascultă-le rostite tare — în 25 de limbi (28 de variante locale). Funcționează pe orice tabletă, laptop, iPhone, iPad și Apple Watch.

Parte a [platformei Synalux](https://synalux.ai).

**Încearcă acum:**
- **Aplicație Web (gratuită):** [synalux.ai/prism-aac](https://synalux.ai/prism-aac) — funcționează pe orice dispozitiv cu un navigator web
- **iOS (iPhone + iPad + Apple Watch):** [App Store](https://apps.apple.com/app/id6764692277)
- **Prețuri:** [synalux.ai/pricing](https://synalux.ai/pricing) — gratuit, plus un plan opțional Prism AAC Cloud (4,99 US$/lună) pentru voce naturală și resurse AI în cloud

🌐 [English](../../README.md) · [Español](README_es.md) · [Français](README_fr.md) · [Português](README_pt.md) · **Română** · [Українська](README_uk.md) · [Русский](README_ru.md) · [Deutsch](README_de.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [中文](README_zh.md) · [العربية](README_ar.md)

<p align="center">
  <a href="https://apps.apple.com/app/id6764692277"><img src="https://img.shields.io/badge/App_Store-Download-0D96F6?style=for-the-badge&logo=apple&logoColor=white" alt="App Store"></a>
  <a href="https://synalux.ai/prism-aac"><img src="https://img.shields.io/badge/Try_It-Free-43e97b?style=for-the-badge" alt="Încearcă gratuit"></a>
  <a href="https://synalux.ai/pricing"><img src="https://img.shields.io/badge/Plans-Free_+_Paid-764ba2?style=for-the-badge" alt="Prețuri"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue?style=for-the-badge" alt="AGPL-3.0"></a>
  <a href="PRIVACY.md"><img src="https://img.shields.io/badge/Privacy-Policy-lightgrey?style=for-the-badge" alt="Confidențialitate"></a>
  <a href="TERMS.md"><img src="https://img.shields.io/badge/Terms-of_Service-lightgrey?style=for-the-badge" alt="Termeni"></a>
</p>

![Ecranul principal Prism AAC pe iPad — bară de instrumente, bară de introducere text, cinci casete de predicție și tastatura qwerty completă (aplicație web de producție, 1.9.0)](../../docs/screenshots/app-hero.png)

### Aplicații native

<p align="center">
  <img src="../../docs/screenshots/ios-iphone.png" alt="PrismAAC pe iPhone" width="220" />
  <img src="../../docs/screenshots/ios-ipad.png" alt="PrismAAC pe iPad" width="360" />
  <img src="../../docs/screenshots/watch-ultra.png" alt="PrismAAC pe Apple Watch Ultra" width="120" />
</p>

<sub>Cadre iPhone și iPad capturate din versiunea 1.9.0 (53) rulate pe aplicația web de producție, 08-09-2026. Cadrul de ceas provine din versiunea 1.4.0.</sub>

| Platformă | Status | AI pe dispozitiv | Note |
|----------|--------|-------------|-------|
| **Web** (PWA) | ✅ Producție | Descarcă automat cel mai bun model local | Orice navigator, instalabilă; plan Cloud prin Stripe |
| **iPad Pro 16GB** | ✅ Producție | AI 4B pe dispozitiv (precizie 100%) | Cel mai rapid, complet privat; plan Cloud prin achiziție în aplicație Apple |
| **iPhone Pro 8GB** | ✅ Producție | 4B Q4_K_M pe dispozitiv (precizie 100%) | Selectat automat în funcție de memoria RAM |
| **Toate modelele iPhone** | ✅ Producție | 2B Q3_K_M pe dispozitiv (precizie 99.1%) | 2.3 GB — se potrivește pe orice iPhone |
| **Apple Watch** | ✅ Producție | Expresii offline (1.261 × 20 limbi) | Autonom — pictagrame, TTS, urgență |
| **Extensie Chrome** | ✅ Producție | — | Asistent de citire în orice câmp de text |
| **WiFi către Mac** | ✅ Producție | 9B/27B prin Ollama | Setări → AI Local → introdu IP-ul Mac-ului |

---

## Video de prezentare App Store

Videoclip de 30 de secunde care prezintă toate caracteristicile principale cu narațiune Inworld TTS:

https://github.com/dcostenco/synalux-docs/releases/download/v1.0-module-videos/prism_aac_preview_v5.mp4

| Scenă | Funcționalitate | Captură de ecran |
|---|---|---|
| **Acasă** — atinge expresii | Tablă cu pictagrame și 22 de categorii, buton Vorbește | <img src="../../docs/screenshots/appstore/ipad_home.png" width="200"> |
| **Categorii** | Expresii rapide pentru Ajutor, Mâncare, Locuri, Sentimente | <img src="../../docs/screenshots/appstore/ipad_categories.png" width="200"> |
| **Chat AI** | Compune mesaje, exersează conversații | <img src="../../docs/screenshots/appstore/ipad_ai-chat.png" width="200"> |
| **Alertă de Urgență** | Apelare printr-o singură atingere pentru îngrijitor/asistent | <img src="../../docs/screenshots/appstore/video/frame_03.png" width="200"> |
| **Program** | Rutine zilnice vizuale — dimineață, școală, prânz, culcare | <img src="../../docs/screenshots/appstore/ipad_schedule.png" width="200"> |
| **Jocuri** | Sparge Bule, Vânătoare de Culori, Potrivește, Da/Nu, Completează | <img src="../../docs/screenshots/appstore/ipad_games.png" width="200"> |
| **Matematică și Școală** | Matematică adaptivă cu Indiciu, Verifică, Rezolvă + tastatură numerică | <img src="../../docs/screenshots/appstore/video/frame_06.png" width="200"> |
| **Urmărire cap și ochi** | Cursor bazat pe fixarea privirii cu camera, control prin privire, calibrare | <img src="../../docs/screenshots/appstore/video/frame_07.png" width="200"> |
| **12 Limbi** | Engleză, Spaniolă, Franceză, Rusă, Japoneză, Coreeană, Chineză, Arabă și altele | <img src="../../docs/screenshots/appstore/video/frame_08.png" width="200"> |

---

## Pe scurt

| Modul | Ce face | Previzualizare |
|---|---|---|
| 📂 **Categorii** | Casete cu imagini în stil PECS pentru persoane care nu citesc | <img src="../../docs/screenshots/panel-categories.png" width="120"> |
| ⌨️ **Scrie și vorbește** | Tastatură + predicție de cuvinte + voce neuronală | <img src="../../docs/screenshots/app-hero.png" width="120"> |
| ✨ **Chat AI** | Asistent pe dispozitiv + cloud adaptat pentru utilizatorii AAC | <img src="../../docs/screenshots/panel-ai-chat.png" width="120"> |
| 💬 **Chat AAC** | Mesaje primite de la îngrijitori + contacte | <img src="../../docs/screenshots/panel-aac-chat.png" width="120"> |
| 🧮 **Matematică + materii** | Pânză cu grilă de celule și tutor specializat pe domeniu | <img src="../../docs/screenshots/math-canvas-typed.png" width="120"> |
| 🗓 **Program** | Rutine vizuale de tip prima dată - apoi | <img src="../../docs/screenshots/panel-schedule.png" width="120"> |
| 🎮 **Jocuri** | 12 jocuri terapeutice AAC | <img src="../../docs/screenshots/panel-games.png" width="120"> |
| 🏪 **Piață (Marketplace)** | Pachete de voci, pachete de vocabular, pachete de jocuri | <img src="../../docs/screenshots/panel-marketplace.png" width="120"> |
| 🎧 **Player de Confort** | Player media la patul pacientului pentru spital | <img src="../../docs/screenshots/panel-comfort-player.png" width="120"> |
| 🛏 **Modul La Pat** | Chat AI pe ecran complet pentru utilizarea telefonului pe suport / culcat | <img src="../../e2e/_screenshots/bedside-overlay-open.png" width="120"> |
| 👁 **Context Vizual** | Camera detectează obiecte → sugerează expresii relevante | <img src="../../docs/screenshots/vision-mealtime.png" width="120"> |
| 👋 **Fără mâini** | Recunoaștere a mișcărilor capului și gesturilor mâinii | <img src="../../docs/screenshots/panel-settings-input-modes.png" width="120"> |
| ⚙️ **Setări** | 25 de limbi, adaptări motorii, selector de voce + memorie cache pentru vorbire | <img src="../../docs/screenshots/panel-settings.png" width="120"> |
| ☁️ **Vorbire și AI în Cloud** | Resursă opțională de 4,99 US$/lună pentru voci naturale + AI în cloud | <img src="../../docs/screenshots/cloud-subscription-iphone.png" width="120"> |

---

## Accesibilitate

Prism AAC a fost supus unui [audit adversarial de accesibilitate în 70 de puncte](ACCESSIBILITY.md) în iunie 2026, testat pe iPhone portret, iPhone peisaj, iPad portret și iPad peisaj. Fiecare problemă a fost remediată și verificată prin teste e2e automatizate.

### Metode de introducere — folosește orice parte a corpului

| Metodă | Cum funcționează | Configurare |
|--------|-------------|-------|
| **Atingere** | Atingere standard + casete cu pictagrame | Funcționează direct după instalare |
| **Urmărire cap** | Camera urmărește mișcarea capului → clic prin menținerea privirii | Setări → Moduri de Introducere |
| **Privire (Eye gaze)** | Ponderea poziției ochilor pe urmăritorul de cap | Setări → Moduri de Introducere |
| **Scanare prin comutator (Switch scanning)** | Scanare automată/manuală cu comutator Bluetooth, tastatură sau gamepad | Setări → Moduri de Introducere → Scanare prin comutator |
| **Recunoaștere gesturi** | Clipit, dat din cap, zâmbet, gura deschisă → acțiuni mapate | Setări → Moduri de Introducere → Gesturi |
| **Introducere vocală** | Dictare cu autocorecție AI, fără mâini, cuvânt de activare | Butonul de microfon din bara de instrumente |
| **Tastatură simplificată** | Cele mai frecvente 15 litere într-o grilă 3×5 (automat pentru gridSize 4) | Setări → Dimensiune Grilă → 4 |

Navigare pe tabla cu imagini: glisează spre stânga/dreapta în grila de vocabular sau pe banda inferioară de categorii pentru a răsfoi paginile. Pe Mac, folosește derularea orizontală pe trackpad sau clic-și-trage; săgețile laterale rămân disponibile. Paginarea nu selectează un cuvânt — atinge sau fă clic în mod deliberat pe o casetă pentru a o selecta. Derularea verticală și zoom-ul prin ciupire nu schimbă paginile. Vezi [navigarea prin glisare și limitele de testare](docs/SWIPE_NAVIGATION.md).

### Aspect adaptiv — iPhone și iPad, portret și peisaj

<p align="center">
  <img src="../../docs/screenshots/a11y-2026-06-18/01-home-board-iphone-6.1.png" alt="iPhone portret" width="160" />
  <img src="../../docs/screenshots/a11y-2026-06-18/01-home-board-iphone-6.1-land.png" alt="iPhone peisaj" width="280" />
  <img src="../../docs/screenshots/a11y-2026-06-18/01-home-board-ipad-13.png" alt="iPad portret" width="240" />
</p>

### Moduri vizuale

<p align="center">
  <img src="../../docs/screenshots/a11y-2026-06-18/06-dark-high-contrast-iphone-6.1.png" alt="Întunecat + contrast ridicat pe iPhone" width="160" />
  <img src="../../docs/screenshots/a11y-2026-06-18/06-dark-high-contrast-ipad-13-land.png" alt="Întunecat + contrast ridicat pe iPad peisaj" width="340" />
</p>

- Teme **Luminos / Întunecat / Contrast Ridicat**
- Interogări media de sistem **`prefers-contrast: more`** și **`prefers-reduced-motion`**
- **Zoom prin ciupire (Pinch-to-zoom)** activat (până la 5×) — conform WCAG 1.4.4
- **16 cuvinte de urgență × 8 limbi** în modul de recuperare după erori critice

Pentru raportul complet de audit cu toate cele 70 de constatări, vezi [ACCESSIBILITY.md](ACCESSIBILITY.md).

---

## Siguranță și confidențialitate

PrismAAC este utilizat de copii, adulți care nu vorbesc și populații clinice. Siguranța nu este o funcționalitate — este o restricție care modelează fiecare cale de inferență.

### Arhitectură de siguranță stratificată

| Strat | Ce | Unde rulează | Latență |
|-------|----|--------------|---------|
| **L1 — Poartă de siguranță deterministă** | Interceptare de criză/medicală bazată pe regex | Client + server (fiecare cale) | 0 ms |
| **L2 — Antrenament pentru siguranța modelului** | Aliniere RLHF Qwen3.5 | Pe dispozitiv + cloud | Integrată |
| **L3 — Poartă de încredere** | Respinge ieșirea scurtă/degradată/cu scurgeri de șablon de prompt | Pe dispozitiv + server | 0 ms |
| **L4 — Verificator de fundamentare** | Verificare NLI: afirmațiile trebuie să fie implicate logic de dovezi | Server (niveluri plătite) | ~200 ms |

### Detalii despre poarta de siguranță L1

Poarta L1 rulează verificări regex deterministe pe **atât pe intrare, cât și pe ieșire** pe toate căile de inferență — inclusiv calea locală Ollama offline care ocolește complet serverul.

**Ce prinde:** expresii de criză la persoana întâi (intenție de autovătămare), instrucțiuni periculoase privind dozarea medicală.

**Ce NU prinde (prin design):** termeni clinici generici („dose of risperidone”, „milligrams”, „suicide prevention training”). Aceștia apar în note legitime BCBA/medicale și blocarea lor ar dăuna utilizatorilor clinici pe care îi deservește acest produs. Pe alinierea propriu-zisă a modelului 2B de pe dispozitiv nu se contează deloc pentru siguranță (obține un scor de ~59% pe BFCL V4 general). L1 este mecanismul primar determinist de siguranță.

**Limitări cunoscute ale L1:**
- **Acoperire inegală a limbilor.** Frazele de criză sunt potrivite în engleză și în alte limbi, iar seturile diferă în funcție de cale. Poarta de chat AI web (`services/crisisSafetyFilter.ts`) potrivește de asemenea fraze în spaniolă, franceză, portugheză, română, rusă, ucraineană, arabă, germană, japoneză, coreeană, chineză și bulgară. Verificarea offline de pe partea clientului (`checkInputSafetyClient`) potrivește de asemenea spaniolă, franceză, portugheză, rusă, arabă, germană și ucraineană. Poarta iOS are propria listă integrată (engleză, spaniolă, franceză, română, rusă, arabă și ebraică) și adaugă cuvinte cheie de la server la lansare când îl poate contacta. Tiparele de dozare medicală sunt doar în engleză pe fiecare cale client. O limbă suportată fără tipare pe o cale dată este protejată doar de antrenamentul propriu de siguranță al modelului (L2).
- **Regex este o limită inferioară, nu o limită superioară.** Suferința parafrazată („I don't want to be here anymore”) nu este potrivită. L1 prinde formulări definite de semnal înalt; L2 (alinierea modelului) gestionează coada lungă.

**Acoperire pe cale:**

| Cale | Intrare L1 | Ieșire L1 | Note |
|------|:----------:|:---------:|------|
| Ollama local (offline, web) | ✅ partea clientului | ✅ partea clientului | `checkInputSafetyClient` + `checkOutputSafetyClient` |
| Pe dispozitiv iOS (llama.cpp) | ✅ nativ | ✅ nativ | `SafetyFilter.swift` (`ios-native/PrismAAC/Sources/Safety/`); verificarea de ieșire interceptează doar conținut de tip jailbreak |
| Portal `/prism-aac/chat` | ✅ | streaming* | Intrare verificată înainte de apelul modelului |
| Portal `/prism-aac/infer` | ✅ | ✅ | Modul partajat de tipare de siguranță |
| Portal `/prism-aac/inference` | ✅ | ✅ | Modul partajat de tipare de siguranță |

*Răspunsurile cloud în streaming se bazează pe siguranța modelului (L2) pentru ieșire — L1 nu poate filtra prin regex un flux de tokeni în zbor.

### Cum arată o interceptare de criză

Dacă un utilizator tastează suferință prin interfața AAC, L1 returnează imediat (înainte de a rula vreun model):

> "I'm concerned about your safety. Please call or text 988 (Suicide & Crisis Lifeline) right now — available 24/7. If in immediate danger, call 911. You are not alone."

### Confidențialitate

- AI-ul de pe dispozitiv procesează prompturile local — niciun fel de date nu părăsește dispozitivul
- Serviciile de vorbire cloud și AI-ul cloud (când sunt utilizate) merg către portalul Synalux prin TLS; textul este procesat în memorie și nu este stocat
- Niciun prompt al utilizatorului nu este stocat sau utilizat pentru antrenament
- Nu este necesar un cont; telemetria anonimă de utilizare/erori (Datadog) nu conține niciodată text tastat sau rostit
- Consultați [PRIVACY.md](../../PRIVACY.md) pentru politica completă de confidențialitate

---

## Alternativă gratuită Read & Write

PrismAAC include toate caracteristicile de asistență la citire pe care majoritatea utilizatorilor AAC le cumpără din Read & Write — gratuit, în browser, fără cont necesar pentru versiunea web. Vezi [Scrie și vorbește](#%EF%B8%8F-scrie-și-vorbește) pentru rostirea la finalul propoziției + evidențierea cuvintelor, [Cititor PDF](#-cititor-pdf) și [Cititor Capturi de Ecran (OCR)](#-cititor-capturi-de-ecran-ocr) pentru documente, precum și [Extensia Chrome](#-extensie-chrome--aceleași-caracteristici-de-asistență-la-citire-în-orice-câmp-de-text) pentru acoperire în toate aplicațiile ca Gmail / Docs / Word Online / oriunde altundeva.

## Cum se compară PrismAAC

| | PrismAAC | TouchChat | Proloquo2Go | LAMP Words | TD Snap | CoughDrop | Snap Core First | Grid 3 | Tobii Dynavox |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Cameră → sugestii de expresii** (vede obiecte, sugerează cuvinte) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **AI pe dispozitiv** (redirecționare 99–100%, suportă HIPAA) | 🟢 | 🔴 | 🔴 | 🔴 | 🟡 | 🟡 | 🔴 | 🔴 | 🟡 |
| **Clasificare expresii per utilizator** (se adaptează fiecărui copil) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| Corecțiile îngrijitorului **devin date de antrenament** | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Tutor AI** (matematică + alte 10 materii) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Pânză de matematică cu grilă de celule** | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Istoric adaptat la regiune** (peste 280 de regiuni) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Fără mâini** cap + mână + gesturi + scanare comutator | 🟢 | 🟡 | 🟡 | 🔴 | 🟢 | 🟡 | 🟡 | 🟢 | 🟢 |
| **Chat AI Fără Mâini** (buclă vocală + cuvânt de activare + la pat) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Jocuri AAC** terapeutice (12 integrate) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🟡 | 🟡 | 🔴 | 🔴 |
| **Sursă deschisă** (AGPL-3.0) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🟢 | 🔴 | 🔴 | 🔴 |
| **Versiune gratuită** (acces de siguranță esențial) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🟢 | 🔴 | 🔴 | 🔴 |
| **Piață** de pachete de voci | 🟢 | 🔴 | 🟡 | 🔴 | 🟡 | 🔴 | 🔴 | 🟡 | 🟡 |
| **Multilingv** (25) | 🟢 | 🟢 | 🟢 | 🔴 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| **Note îngrijitor** (acasă / școală / clinică) | 🟢 | 🔴 | 🔴 | 🔴 | 🟡 | 🟡 | 🟡 | 🔴 | 🟡 |
| Mod autonom **Apple Watch** | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Extensie Chrome** ca asistent de citire | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |

🟢 = suport complet &nbsp;&nbsp; 🟡 = parțial &nbsp;&nbsp; 🔴 = indisponibil

> Comparația reflectă informațiile despre produse disponibile public din mai 2026. PrismAAC este dezvoltat activ; competitorii pot adăuga funcționalități în timp. PR-urile sunt binevenite pentru a menține corectitudinea — vezi `CONTRIBUTING.md`.
>
> Grid 3 și Tobii Dynavox au integrări hardware puternice pentru privire + scanare cu comutatoare care nu sunt reflectate mai sus (dependente de hardware, configurații clinice specializate).

---

## iOS și Apple Watch

### iPhone / iPad

Aplicație nativă Swift care împachetează interfața web într-un WKWebView + o arhitectură **AI pe dispozitiv cu motor dublu** prin llama.cpp Metal. 

Pentru a garanta accesul AI instantaneu și offline pe toate dispozitivele, aplicația rulează automat două modele diferite simultan, pe baza memoriei disponibile a dispozitivului:

| Dispozitiv | RAM | AI Conversațional | Precizie de Redirecționare | Auto-completare |
|---|---|---|---|---|
| iPad Pro M1/M2/M4 | ≥ 16 GB | 4B Q4_K_M (3.4 GB) | **100%** | 360M (integrat) |
| iPhone 15/16 Pro, iPad Air | 8–15 GB | 4B Q4_K_M (3.4 GB) | **100%** | 360M (integrat) |
| Toate celelalte modele iPhone / iPad | < 8 GB | 2B Q3_K_M (2.3 GB) | **99.1%** | 360M (integrat) |

> Precizie: testul de referință BFCL, 115 cazuri de redirecționare a instrumentelor × 3 semințe amestecate, temperatură=0, iunie 2026.

#### AI pe dispozitiv — funcționează offline de la prima lansare

Fiecare dispozitiv vine cu un model AI integrat în aplicație. Fără descărcare, fără WiFi, fără cont necesar — deschide aplicația și începe să comunici.

| Dispozitiv | Model inclus | Dimensiune | Ce face |
|---|---|---|---|
| **iPhone / iPad** | Qwen3.5-4B Q3_K_M | 2.3 GB | Redirecționare instrumente, Fără Mâini, Modul La Pat, Cuvânt de Activare (precizie 99.1%) |
| **Apple Watch** | SmolLM2-360M | 207 MB | Extindere simboluri, expresii de urgență, text predictiv (precizie 100%) |

Modele mai mari (9B, 27B) disponibile prin Setări → AI Local pentru redirecționare de la WiFi la Mac (precizie BFCL 100%).

<details>
<summary><strong>Detalii tehnice</strong></summary>

- **Filtru de siguranță L1 deterministic:** intercepție de crize/medicală prin expresii regulate atât pe intrare (înainte de a rula vreun model), cât și pe ieșire (înainte de a ajunge la utilizator). Șabloanele vizează specific intenția de autovătămare — termenii clinici/farmacologici generici ("doză de", "miligrame") NU sunt interceptați pentru a evita blocarea utilizării clinice legitime a AAC.
- **Siguranță pe ieșire la client:** rezultatele locale Ollama trec prin `checkOutputSafetyClient` înainte de afișare — utilizatorii offline primesc aceeași protecție L1 ca utilizatorii din cloud.
- **Filtru de încredere:** ieșirile de pe dispozitiv sub pragurile de lungime/calitate sunt respinse și trimise către cloud (niveluri plătite) sau degradate funcțional (nivel gratuit).
- Filtrarea bazată pe memorie degradează funcționalitatea treptat: AI complet → AI cloud → doar funcții de bază → modul de urgență
- Plan de rezervă OOM: 4B Q4_K_M → 2B Q3_K_M → 360M
- Spațiu de siguranță (safe area) pentru Insula Dinamică / decupaj
- Punte WCSession pentru trimiterea urgențelor pe Apple Watch
- Jetoane de autentificare stocate în Keychain

</details>

**Setări → 🤖 Modele AI Locale** — descarcă și gestionează modelele de pe dispozitiv:
- Detectează automat Ollama la `localhost:11434`
- WiFi către Mac: iPad/iPhone → Mac Ollama (9B/27B cu precizie BFCL 100%)
- Descărcare individuală a modelelor cu bară de progres în timp real
- Modele: `:2b` (2.3 GB) · `:4b` (3.4 GB) · `:9b` (5.8 GB) · `:27b` (16.8 GB)


### Apple Watch (autonom)

Funcționează fără iPhone — autonom, cu dicționar de expresii offline.

<p align="center">
  <img src="../../docs/screenshots/watch-series.png" alt="Watch Series 11" width="140" />
  <img src="../../docs/screenshots/watch-ultra.png" alt="Watch Ultra 3" width="140" />
</p>

- **Traducere offline:** 1.261 expresii × 20 limbi incluse (JSON 411 KB) — căutare instantanee, 100% precisă, fără rețea
- Grilă de pictagrame pe 2 coloane cu imagini ARASAAC
- Chat AI cu dictare + introducere de la tastatură (cloud când este conectat, dicționar de expresii când este offline)
- Sistem de urgență: numărătoare inversă → WCSession → rezervă pe rețeaua celulară → TTS
- Traducere cu redare vocală TTS (dicționar offline mai întâi, rezervă în cloud)
- Mesaje primite: primește și răspunde la mesajele de la îngrijitori
- Fixare de certificate (SPKI SHA-256) la trimiterea urgențelor
- Sanitizare NFKC + injectare 23-tokens pe toate căile AI

---

## 📊 Tablou de bord pentru îngrijitori (v1.8)

Aplicația urmărește intern date comportamentale bogate — precizia predicțiilor, tendințele motorii, fiabilitatea vocii, stabilitatea urmăririi capului, șabloanele de comunicare, corecțiile îngrijitorilor. Anterior, **nimic din toate acestea nu ajungea la îngrijitori**. Singura interfață pentru îngrijitori era un carnet de note text.

Acum există o filă de **Informații (Insights)** în Panoul Îngrijitorului cu 7 widget-uri de monitorizare în timp real, fiecare susținut de un colector de metrici în fundal care rulează la fiecare 5 minute fără a afecta calea de predicție.

### Ce văd îngrijitorii

| Widget | Ce îți spune | Valoare clinică |
|---|---|---|
| **Eficiența Predicțiilor** | "Rată de succes 72% ↑ vs ultimele 24h" | Setul de vocabular funcționează — sau nu |
| **Adoptarea Vocabularului** | "45 active · 12 noi · 8 neutilizate" | Care expresii au fost adoptate, care trebuie eliminate |
| **Subiecte de Comunicare** | "Top: școală (35%), mâncare (22%)" | Schimbările în distribuția subiectelor pot semnala regresii sau schimbări de mediu |
| **Tendință Motorie** | "Fixare 850ms ↓ (se îmbunătățește)" | Controlul motor se îmbunătățește → timp de fixare mai scurt; scade → trimite la terapie ocupațională |
| **Fiabilitatea Urmăririi** | "2 abateri · 98% timp de funcționare" | Abateri frecvente → verifică poziția pe scaun, oboseala, calibrarea |
| **Fiabilitatea Vocii** | "97% succes · 1 rezervă" | Eșuează Azure TTS? A expirat cheia API? Problemă de conectivitate? |
| **Nivelul Corecțiilor** | "47 corecții în total" | Rata de corecție crește = modelul are nevoie de reantrenare pentru acest copil |

### Aspectul tabloului de bord

| Panou Îngrijitor | | ✕ |
|:---|:---|---:|

| + Notă | Jurnal | **Informații** |
|:---:|:---:|:---:|

> **Eficiența Predicțiilor**
> `72% rată succes` &nbsp;&nbsp; ↑ vs 24h
> ![sparkline](https://img.shields.io/badge/trend-72%25_____85%25_____78%25_____72%25-4CAF50?style=flat-square)

> **Adoptarea Vocabularului**
> `45 active` · `12 noi` · `8 neutilizate`
> `████████████████░░░░░░` adoptat 69% / încercat 18% / neutilizat 13%

> **Subiecte de Comunicare**
> `școală` 35% · `mâncare` 22% · `joacă` 18%
> ![sparkline](https://img.shields.io/badge/school-35%25-9C27B0?style=flat-square) ![sparkline](https://img.shields.io/badge/food-22%25-FF9800?style=flat-square) ![sparkline](https://img.shields.io/badge/play-18%25-2196F3?style=flat-square)

> **Tendință Motorie**
> `Fixare 850ms` &nbsp;&nbsp; ↓ se îmbunătățește
> ![sparkline](https://img.shields.io/badge/trend-1200____1100____950_____850ms-FF9800?style=flat-square)

> **Fiabilitatea Urmăririi**
> `2 abateri azi` · `98% timp funcționare`
> ![sparkline](https://img.shields.io/badge/uptime-98%25-4CAF50?style=flat-square)

> **Fiabilitatea Vocii**
> `97% succes` · `1 rezervă`
> `██████████████████████████████░` Azure 94% / Web Speech 3% / eșec 3%

> **Nivelul Corecțiilor**
> `47 corecții în total` &nbsp;&nbsp; +3 săptămâna aceasta
> ![sparkline](https://img.shields.io/badge/trend-38_____41_____44_____47-795548?style=flat-square)

<sub>286 puncte de date · ultimele 7 zile · se actualizează la fiecare 5 min</sub>

### Arhitectură

```
Atingere pe PredictionBar --> recordPredictionHit() (import dinamic, ~0.01ms)
                                     |
        +--------------------------------------------+
        |      metricsCollector (cronometru 5 min)    |
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
        |  7 zile rulare - intervale 5 min - 400KB   |
        +--------------------------------------------+
                                     |
        +--------------------------------------------+
        |  CaregiverInsightsTab (încărcat lent)       |
        |  7 widget-uri InsightCard + SVG Sparkline  |
        |  Randează doar când este atinsă fila       |
        +--------------------------------------------+
```

### Garanții de performanță

| Aspect | Garanție |
|---|---|
| **Calea tastării** | 0ms adăugați — succesul/ratarea folosesc importuri dinamice + incrementări de contor |
| **Memorie** | ~400KB în localStorage + ~50KB RAM pentru 7 zile |
| **Pachet (Bundle)** | ~2KB JS (fără bibliotecă de grafice — grafice SVG pure) |
| **Offline** | 100% în localStorage — fără apeluri de rețea |
| **iPad** | Carduri cu derulare verticală, grafice mini 120×32px |
| **Confidențialitate** | Fără date de sănătate (PHI) — doar numărători operaționale, protejate prin PIN de îngrijitor |

### Exemplu: citirea widget-ului de eficiență a predicțiilor

```
Eficiența Predicțiilor
78% rată de succes              ↑ vs ultimele 24h
╭──╮ ╭╮╭─╮
│  ╰─╯╰╯ ╰──╮╭──
```

- **78% rată de succes**: în 78% din cazuri, copilul a atins un cuvânt din bara de predicție în loc să tasteze manual. Aceasta înseamnă că setul de vocabular este bine potrivit cu șabloanele de comunicare ale copilului.
- **↑ vs ultimele 24h**: rata de succes s-a îmbunătățit față de ieri — motorul adaptiv învață.
- **Grafic mini**: arată tendința ratei de succes în ultimele 24 de ore. Scăderile pot corela cu subiecte sau medii noi.

Dacă rata de succes scade sub 40%, vocabularul are probabil nevoie de actualizare — copilul comunică despre subiecte pe care motorul de predicție nu le acoperă.

### Exemplu: citirea widget-ului de tendință motorie

```
Tendință Motorie
Fixare 1200ms                   ↑ scade performanța
╭──╮
│  ╰──╮╭──╮╭─
```

- **Fixare 1200ms**: copilul are nevoie de 1,2 secunde de menținere a poziției pentru a declanșa o selecție. Interval tipic: 800–2000ms.
- **↑ scade performanța**: timpul de fixare crește (copilul are nevoie de mai mult timp). Acest lucru ar putea indica oboseală, schimbarea medicației sau o regresie motorie progresivă.
- **Acțiune**: dacă tendința persistă mai mult de 3 zile, marchează pentru reevaluare de terapie ocupațională. Aplicația adaptează automat timpul de fixare, dar un clinician ar trebui să investigheze cauza subiacentă.

---

## Module

### 📂 Categorii

În modul Imagine, Dimensiunea Grilei setează numărul de casete pe pagină de vocabular (4 înseamnă
2 × 2; 6 înseamnă 3 × 2). Glisează spre stânga sau dreapta pe tablă pentru a răsfoi, sau folosește
săgețile de lângă titlul categoriei. Navigarea nu adaugă un cuvânt și nu vorbește;
atinge o casetă pentru a o selecta. Poziția paginii este anunțată cititoarelor de ecran fără
un subsol vizibil separat pentru numărul de pagini.

Casete cu imagini în stil PECS. Atinge o categorie, atinge o casetă, ascultă cuvântul, privește cum ajunge în bara de mesaje. Funcționează la fel de bine pentru cei care nu citesc, cei care învață să citească sau cei în curs de dezvoltare a comunicării. Seturile de casete și ordonarea se personalizează în timp prin activare extinsă — casetele pe care copilul tău le atinge cel mai des urcă; cele neutilizate timp de luni de zile își pierd din vizibilitate.

**Aspect învăluitor (Surround layout)** — categoriile apar într-o coloană derulabilă în stânga, alături de tastatură, astfel încât utilizatorul AAC poate atinge casetele cu imagini ȘI tastează simultan, fără a schimba modurile. Bara de predicție rămâne vizibilă; ambele intrări sunt întotdeauna accesibile.

![Categorii în modul învăluitor — carduri de categorii derulabile în stânga, tastatură completă în dreapta](../../docs/screenshots/categories-surround-v2.png)

<details>
<summary><strong>Funcționalități + detalii tehnice</strong></summary>

- 22 de categorii implicite: oameni, mâncare, sentimente, corp, haine, animale, locuri etc.
- Îngrijitorul poate adăuga / elimina / reordona casetele pentru fiecare copil
- Fiecare casetă conține un `textKey` pentru internaționalizare — schimbarea limbii aplicației reetichetează fiecare casetă dintr-o singură atingere
- Pictagramele casetelor provin din ARASAAC + un set selectat; clonarea vocii îți permite să potrivești vocea casetei cu cea a fraților sau părinților copilului (nivel plătit)
- Învățare n-gram per utilizator: un copil care atinge "Eu vreau mănânc" de trei ori va vedea "mănânc" urcând după "vreau" în sesiunea următoare
- Memorie holografică HRR: predicții contextuale fără căutare în ~0,2ms prin Rust WASM — precizie Top-1 cu +27% mai mare pe expresiile AAC de bază

**Cale de randare:** `components/CategoryPanel.tsx` → `useCategoryStore` → casete preluate din `constants/phrases.ts` (sistem) + modificări per utilizator din Supabase (plătit). Atingerile pe casete apelează `messageStore.appendText(phrase)` și redirecționează prin `aacSpeak()` pentru TTS.
</details>

---

### ⌨️ Scrie și vorbește
Tastatură pe ecran cu **predicție de cuvinte**, **autocompletare AI** și un buton **Vorbește** ce citește bara de mesaje tare, cu o voce neuronală naturală. Tastarea învață motorul de predicție: cuvintele pe care copilul tău le tastează cel mai des apar mai devreme în sesiunea următoare.

![Tastatura Prism AAC cu cuvântul "hello" tapat, casete de predicție și butonul Vorbește](../../docs/screenshots/keyboard-typing.png)

**Caracteristici de asistență la citire (paritate cu Read & Write)** — pentru utilizatori cu nevoi de citire / memorie / cognitive:

- **Rostire per cuvânt** — fiecare cuvânt este redat prin TTS în momentul în care apeși spațiu, astfel încât auzi ce ai tapat fără să aștepți întreaga propoziție.
- **Rostirea propoziției la `.?!`** — finalizarea unei propoziții cu punct, semnul întrebării sau semnul exclamării citește întreaga propoziție înapoi, astfel încât să nu pierzi firul celor scrise (lipsa ce descalifică NVDA pentru utilizatorii văzători cu dizabilități cognitive). Activează din Setări → `speakOnSentenceEnd` (activat implicit).
- **Evidențiere cuvânt cu cuvânt în timpul vorbirii** — fiecare cuvânt rostit se iluminează cu un fundal galben pe măsură ce TTS îl citește. Utilizatorii văzători cu dificultăți de citire pot urmări vizual; evidențierea urmărește semnalul audio fără a fi nevoie de un dispozitiv hardware special.

<details>
<summary><strong>Funcționalități + detalii tehnice</strong></summary>

- 5 poziții de predicție deasupra tastaturii qwerty, actualizate la fiecare apăsare de tastă
- Completare AI ("sal" → "salut", "vrmsa" → "vreau să") prin Synalux `text/correct` (Gemini 2.5 Flash-Lite, ~752ms medie, de 4.3× mai ieftin decât 2.5 Flash)
- Filtru între limbi: un cuvânt din RO precum `eu` nu va apărea în bara EN chiar dacă ambele corpuri de text sunt încărcate (comparație de frecvență între corpuri)
- "Vorbește" citește cu adaptare automată a tonului (declarativ / interogativ / exclamativ dedus din punctuație)
- Lanț de vorbire: memorie cache de vorbire persistentă (rejoadă fără o nouă cerere) → voce cloud prin portal (Inworld TTS-2; Azure Neural pentru limbile care îi lipsesc lui Inworld; Gemini TTS ca ultimă opțiune cloud) → OS Web Speech (offline) → WASM espeak-ng (ultima opțiune). Vezi [`docs/TTS-ARCHITECTURE.md`](docs/TTS-ARCHITECTURE.md) și [`docs/SPEECH_CACHE.md`](docs/SPEECH_CACHE.md)
- Evidențierea cuvintelor este estimată în funcție de durată (~60 ms/caracter la viteză=0,5, se ajustează cu glisorul de viteză) — funcționează pe toate nivelurile TTS fără modificări pe server; sincronizarea precisă prin Azure `wordBoundary` este o funcție viitoare din versiunea Pro.
- Corp de n-gram SQLite de 1,5MB per limbă; unigrame + bigrame + trigrame; încărcare lentă la schimbarea limbii
- **Memorie contextuală HRR** — recuperare holografică fără căutare (229KB Rust WASM) care învață din fiecare expresie rostită. Codifică bigramele + trigramele într-un vector holografic; interoghează în ~0,2ms la fiecare apăsare de tastă. Strat aditiv — sporește primele 2 casete de predicție cu potriviri contextuale fără a elimina predicțiile din corpul principal.

**Test de referință pentru predicția HRR** (54 teste unitare + suită de precizie cu 10 scenarii):

| Scenariu | Referință Top-1 | HRR+ Top-1 | Creștere | Referință MRR | HRR+ MRR | Creștere MRR |
|----------|---------------|------------|------|-------------|---------|----------|
| Expresii AAC de bază (1x) | 36.7% | 46.7% | **+27.3%** | 0.634 | 0.672 | +6.0% |
| Expresii AAC de bază (5x zilnic) | 36.7% | 46.7% | **+27.3%** | 0.634 | 0.672 | +6.0% |
| Vocabular personal | 70.4% | 81.5% | **+15.8%** | 0.809 | 0.883 | +9.2% |
| Mixt (toate expresiile) | 47.2% | 56.9% | **+20.6%** | 0.669 | 0.707 | +5.7% |
| Reamintire între sesiuni | 80.0% | 80.0% | +0.0% | 0.900 | 0.900 | +0.0% |
| Prefixe ambigue | 66.7% | 66.7% | +0.0% | 0.738 | 0.738 | +0.0% |

Top-1 = cuvântul corect este pe caseta #1. Top-5 = cuvântul corect este pe oricare dintre casete. MRR = Rang Reciproc Mediu (mai mare = cuvântul corect apare mai devreme). HRR nu reduce niciodată precizia Top-5 în niciun scenariu — zero regresii. Cele mai mari câștiguri sunt la vocabularul personal (+9,2% MRR) și la expresiile AAC de bază (+27,3% Top-1).

**Cale de randare:** `components/Keyboard.tsx` → `messageStore.appendChar` → `predictionStore.updatePredictions(text, lang)` → `engine/predictionEngine.ts` (recente × frecvență × spor n-gram) + opțional `services/textCorrectService.ts` suprapunere AI + `services/hrrContext.ts` interogare HRR bigram/trigram. Evidențiere: `services/aacSpeak.ts` emite evenimente `tts-highlight-start` pe `ttsHighlightBus`; `components/MessageBar.tsx` se abonează și transmite `activeWordIndex` către `ColoredText`.
</details>

---

### ✨ Chat AI
Asistent pe dispozitiv + cloud adaptat pentru vocea utilizatorului AAC. Răspunsuri transmise în flux, fiecare linie putând fi introdusă prin atingere în bara de mesaje, astfel încât paternitatea textului rămâne la copil. Versiunea gratuită rulează prin Gemini 2.5 Flash; nivelurile plătite redirecționează către Claude Sonnet 4 cu flota prism-coder pentru cereri scurte.

**Modul AI Curat** — bara de predicție a cuvintelor se ascunde automat când Chat AI este deschis (predicțiile sunt irelevante când compui o întrebare), menținând atenția pe răspunsul AI și butonul de trimitere.

**Chat AI Fără Mâini** — activează butonul 🔁 din antetul chat-ului pentru a intra într-o buclă vocală continuă: microfonul se deschide automat după fiecare răspuns AI, astfel încât copilul poate purta o conversație întreagă fără a atinge ecranul. O bară de stare de sub antetul chat-ului confirmă că modul este activ.

**Modul Traducere** — când limba aplicației și limba de ieșire diferă (de ex. introducere în portugheză, ieșire în engleză), fiecare schimb AI este redirecționat automat prin calea de traducere cu fluxul activat, astfel încât nu există nicio penalizare de viteză față de modul monolingv.

![Panou Chat AI — bara de predicție ascunsă în modul AI, tastatura completă accesibilă dedesubt](../../docs/screenshots/panel-ai-chat-v2.png)

<details>
<summary><strong>Funcționalități + detalii tehnice</strong></summary>

- Panou integrat ancorat deasupra tastaturii — niciodată o fereastră modală care să ascundă bara de mesaje
- Introducere vocală prin Web Speech API; butonul de microfon arată transcrierea intermediară în timp real
- Atinge orice linie AI pentru a o copia în bara de mesaje (pstrează autoratul — Valencia et al., CHI 2023)
- **Buclă Fără Mâini** — buton în antet 🔁; repornește automat microfonul la 1 s după ce fiecare răspuns AI se termină; `aria-pressed` + fundalul verde confirmă starea; bară de stare sub antet în timpul activării
- **Cuvânt de activare "Hey Prism"** — disponibil în modul La Pat; sesiunea continuă de `SpeechRecognition` detectează expresia și declanșează microfonul; indisponibil când puntea nativă iOS deține sesiunea audio
- Limitare strictă de timp de 15s pe client + buton Reîncearcă (astfel încât panoul să nu rămână blocat pe "Se gândește..." dacă rețeaua cade)
- 401 / rețea / depășire timp / altele → mapare prietenoasă a erorilor; nu afișează niciodată mesajul brut "Sesiune expirată"
- Rezervă locală Ollama (`prism-coder:2b`) când este offline; conținutul mixt blocat din originea de browser `synalux.ai` în practică, astfel încât eroarea prietenoasă se declanșează

**Cale de randare:** `components/AIChatPanel.tsx` → `services/aiService.askAI()` (sau `translateAI()` în modul traducere) → flux SSE din Synalux `/api/v1/chat` cu `credentials: 'include'`. Lista permisă CORS include `synalux.ai` + origini de dezvoltare localhost.
</details>

---

### 🛏 Modul La Pat

> **Funcționalitate critică de accesibilitate.** Modul La Pat există deoarece unii utilizatori nu au nicio cale sigură de a vorbi, tasta sau atinge un ecran. Designul trebuie să funcționeze mai întâi pentru cel mai dificil caz: un pacient într-un pat de terapie intensivă, cu brațele pe lângă corp, ventilat mecanic, incapabil să producă vreun sunet — comunicând doar prin privire sau printr-un singur comutator hardware ținut între două degete.

Interfață de comunicare AI pe ecran complet optimizată pentru utilizatorii care nu pot ajunge la ecran sau nu pot vorbi sigur. Fiecare țintă de atingere este supradimensionată. Vocea este o singură cale de introducere din mai multe — nu singura. Interfața poate fi operată în întregime prin tehnologii asistive: scanare cu comutator, privire (eye gaze), Control Vocal iOS, urmărire a capului sau o tastatură pe ecran navigată cu un singur comutator.

Inspirat de feedback-ul direct din comunitatea AAC (r/AssistiveTechnology, mai 2025) de la utilizatori care comunică din paturi de spital, recuperare post-chirurgicală și îngrijiri paliative.

**Funcționează pe Mac / Windows?** Da. Modul La Pat este o funcție a aplicației web progresive (PWA) — rulează în orice navigator pe orice dispozitiv. Nu este exclusiv pentru iOS.

---

#### Pentru cine este creat?

Modul La Pat este conceput pentru utilizatori dintr-un spectru larg de abilități motorii și de vorbire. Cardurile cu Expresii Rapide (descrise mai jos) sunt create special pentru utilizatorii din situațiile cele mai severe — cei care nu pot vorbi deloc și au o mișcare a mâinilor foarte limitată sau inexistentă.

| Profil utilizator | Metodă de introducere recomandată |
|---|---|
| Poate vorbi, brațe restricționate | Voce (buton microfon 🎙) + Buclă Fără Mâini |
| Unele vocalizări, vorbire nesigură | Cuvânt de activare "Hey Prism" + Buclă Fără Mâini |
| Fără vorbire, poate atinge ecranul | Carduri cu Expresii Rapide (atingere unică) |
| Fără vorbire, motoriu limitat — un comutator | Control prin Comutator iOS sau Acces prin Comutator Android pe Cardurile cu Expresii Rapide |
| Fără vorbire, fără mișcare a mâinii — dispozitiv de privire | Hardware de privire (Tobii, EyeGaze Edge etc.) prezentat ca cursor de mouse — toate cardurile pot fi navigate |
| Fără vorbire, poate mișca capul | Urmărire cap (de ex. Cursor Cap iOS, Control Cameră pe iPhone 16) — cardurile sunt ținte de navigare de dimensiune completă |
| Traheostomie / ventilat, fără vocalizare | Carduri cu Expresii Rapide prin privire sau comutator + mod asistat de îngrijitor |

---

#### Suport pe platforme

| Platformă | Mod La Pat | Carduri Rapide | Buclă Fără Mâini 🔁 | Cuvânt Activare 🎯 |
|---|:---:|:---:|:---:|:---:|
| Web — Mac / Windows / Linux (orice navigator) | ✅ | ✅ | ✅ | ✅ |
| Web — iPhone / iPad (Safari) | ✅ | ✅ | ✅ | ⚠️ Doar Safari |
| Aplicație nativă iOS (App Store) | ✅ | ✅ | ✅ | ❌ folosește Fără Mâini |
| Android (Chrome / Edge) | ✅ | ✅ | ✅ | ✅ |
| Dispozitiv privire (orice — se prezintă ca mouse) | ✅ | ✅ | ✅ | ✅ |
| Scanare comutator (Control Comutator iOS) | ✅ | ✅ | ✅ | ❌ |
| Apple Watch | ❌ | ❌ | ❌ | ❌ |

> **De ce nu există cuvânt de activare în aplicația nativă iOS?** Puntea nativă preia sesiunea audio (`prismNativeBridge.startVoice`), ceea ce intră în conflict cu API-ul `SpeechRecognition` din browser pe care îl folosește serviciul pentru cuvântul de activare. Folosește în schimb **bucla Fără Mâini** (🔁) — repornește microfonul automat la 1 secundă după fiecare răspuns AI fără a necesita o introducere continuă.

---

#### Cum se pornește

1. Deschide panoul **Chat AI** — atinge pictograma 🤖 din bara de instrumente.
2. Atinge **🛏** în antetul panoului — interfața pe ecran complet se deschide imediat.
3. Alege metoda de introducere (vezi secțiunile de mai jos).

<p align="center">
  <img src="../../e2e/_screenshots/bedside-overlay-open.png" alt="Modul La Pat deschis — interfață neagră pe ecran complet. Banda superioară arată Cardurile cu Expresii Rapide. Zona din mijloc arată răspunsurile AI. Partea de jos arată butonul roșu mare pentru microfon și rândul de comenzi." width="260">
  <img src="../../e2e/_screenshots/bedside-overlay-handsfree-on.png" alt="Modul La Pat cu Fără Mâini activat — butonul 🔁 evidențiat cu verde, textul de stare 'Fără Mâini ACTIV' vizibil" width="260">
  <img src="../../e2e/_screenshots/bedside-hands-free-on.png" alt="Butonul de comutare Fără Mâini în starea activat — fundal verde, aria-pressed=true" width="260">
</p>

#### Cum se oprește / iese

- **Atingere:** atinge **✕** în colțul din dreapta sus al interfeței (țintă de 48 × 48 px).
- **Tastatură / comutator:** apasă pe **Escape**.
- **Voce:** spune orice comandă prin Control Vocal iOS în timp ce interfața este deschisă.

Întregul istoric de chat și starea sesiunii AI sunt păstrate când ieși. Interfața se află deasupra panoului principal ca un strat de randare separat — nimic nu se pierde când o închizi.

<p align="center">
  <img src="../../e2e/_screenshots/bedside-overlay-closed.png" alt="După închiderea Modului La Pat — înapoi la panoul principal de chat AI cu istoricul conversației intact" width="260">
  <img src="../../e2e/_screenshots/bedside-wakeword-statusbar.png" alt="Bara de stare din panoul principal arată 'Hey Prism activ' cu un indicator albastru după revenirea din Modul La Pat" width="260">
</p>

---

### 🃏 Carduri cu Expresii Rapide — pentru utilizatori non-verbali și imobilizați

> **Aceasta este calea critică pentru utilizatorii care nu pot vorbi sau nu își pot mișca liber mâinile.** Cardurile cu Expresii Rapide sunt butoane de comunicare preprogramate care pot fi activate printr-o singură atingere, menținerea privirii sau selecție prin scanare cu comutator. Fără tastare. Fără voce. Fără conexiune la internet necesară pentru a le utiliza.

Fiecare card arată o pictogramă emoji mare și o expresie scurtă. Atingerea unui card încarcă imediat acea expresie în bara de mesaje. Dacă **Modul Fără Mâini** este activat, expresia este trimisă automat către AI.

#### Carduri integrate

Cincisprezece carduri sunt preîncărcate la prima utilizare, grupate după urgență. Nu pot fi șterse. Funcționează offline.

**Urgente (prioritate maximă — comunică-le mai întâi într-o urgență medicală):**

| Pictogramă | Expresie | Când se utilizează |
|:---:|---|---|
| 🆘 | AJUTOR — URGENȚĂ | Pericol imediat, cod de urgență, orice situație ce necesită personal acum |
| 😢 | Mă doare | Durere de orice fel — locația/intensitatea pot urma în text liber |
| 🫁 | Nu pot să respir | Dificultăți respiratorii, probleme ale căilor aeriene, atac de panică |
| 🔔 | Cheamă asistenta | Solicitare de personal care nu este o urgență |

**Nevoie fizice:**

| Pictogramă | Expresie | Când se utilizează |
|:---:|---|---|
| 💧 | Apă, vă rog | Sete, gură uscată, înghițire medicamente |
| 🔥 | Îmi este prea cald | Febră, pătură, reglare temperatură |
| 🥶 | Îmi este frig | Frisoane, pătură, temperatura camerei |
| ↔️ | Vă rog să mă repoziționați | Eliberarea presiunii, confort, poziționare post-chirurgicală |
| 💊 | Am nevoie de medicamente | Doză programată, cerere la nevoie, medicamente pentru durere |

**Comunicare:**

| Pictogramă | Expresie | Când se utilizează |
|:---:|---|---|
| ✅ | Da | Confirmare — răspuns la întrebările cu da/nu ale îngrijitorului |
| ❌ | Nu | Refuz — răspuns la întrebările cu da/nu ale îngrijitorului |
| ⏳ | Vă rog să așteptați | Are nevoie de un moment — nu continuați încă |

**Emoționale:**

| Pictogramă | Expresie | Când se utilizează |
|:---:|---|---|
| ❤️ | Te iubesc | Familie, conexiune emoțională |
| 🙏 | Mulțumesc | Gratitudine |
| 😨 | Îmi este frică | Anxietate, frică, suferință — declanșează un răspuns AI empatic |

#### Cum se utilizează Cardurile cu Expresii Rapide

**Atingere simplă / privire / selecție prin comutator:**
Activarea unui card plasează textul acestuia în bara de mesaje. Expresia poate fi apoi:
- Trimisă către AI pentru un răspuns contextual (de ex. atingerea "Îmi este frică" → AI răspunde cu reasigurare și pune întrebări de urmărire)
- Citită ca atare — îngrijitorii din cameră pot vedea cardul care a fost atins pe ecran

**Cu modul Fără Mâini activat:**
Expresia este trimisă automat către AI în momentul în care cardul este atins. Microfonul repornește la 1 secundă după ce AI răspunde — creând o buclă continuă fără nicio altă introducere de date.

**Cu cuvântul de activare "Hey Prism" activat (web / desktop):**
Cuvântul de activare + Cardul Rapid pot fi combinate: utilizatorul spune "Hey Prism" pentru a deschide microfonul, AI răspunde, iar utilizatorul poate atinge apoi un card pentru a continua conversația într-o altă direcție fără a vorbi din nou.

#### Cum se adaugă carduri personalizate

Îngrijitorii, terapeuții BCBA și membrii familiei pot adăuga carduri personalizate adaptate nevoilor specifice ale utilizatorului — numele medicilor, expresii favorite, descrieri specifice ale durerii, expresii religioase sau orice altceva.

**Pași:**

1. În Modul La Pat, atinge **＋ Adaugă** la capătul benzii de Expresii Rapide.
2. Tastează expresia pe care o dorești pe card (până la 80 de caractere).
3. Atinge **Adaugă Card** — AI-ul generează automat o pictogramă emoji ce se potrivește cu sensul expresiei (de ex. "Dă-mi mai multe pături" → 🛏, "Vreau să mă rog" → 🤲).
4. Pictograma apare cu o scurtă animație "✨ Se generează...", apoi cardul este salvat.

Cardurile personalizate sunt salvate local pe dispozitiv (localStorage). Ele persistă între sesiuni și reporniri ale aplicației. Nu este necesar un cont sau conexiune la internet pentru a folosi cardurile salvate — doar generarea inițială a pictogramei necesită conexiune la rețea.

**Exemple de carduri personalizate ce pot fi adăugate:**

| Expresie sugerată | De ce |
|---|---|
| `[Numele medicului], vă rog veniți` | Mai rapid decât "cheamă asistenta" pentru un clinician specific |
| `Trebuie să vorbesc cu familia mea` | Situații emoționale/legale ce necesită aparținători |
| `Vă rog stingeți lumina` | Sensibilitate senzorială, migrenă, somn |
| `Vreau să mă rog` | Îngrijire spirituală — demnitate în îngrijiri paliative |
| `Ceva nu este în regulă` | Semnal vag de suferință — determină AI-ul să pună întrebări de clarificare |
| `Am nevoie de aspirație` | Pacienți cu traheostomie / ventilat mecanic |
| `Puncția IV mă doare` | Alertă infiltrat, flebită |
| `Vreau să merg acasă` | Conversații paliative/de externare |

#### Cum se șterg cardurile personalizate

1. Atinge **✏️ Editează** în antetul benzii de Expresii Rapide.
2. O pictogramă roșie **✕** apare pe fiecare card personalizat (cardurile integrate sunt protejate și nu pot fi eliminate).
3. Atinge ✕ pe orice card pentru a-l elimina.
4. Atinge **Gata** pentru a ieși din modul de editare.

#### Configurare scanare prin comutator (iOS)

Pentru utilizatorii care pot activa doar un singur comutator extern (sip-and-puff, comutator de cap, comutator de picior, comutator de pernă):

1. Conectează comutatorul la iPhone/iPad prin Bluetooth sau portul Lightning/USB-C.
2. Mergi la **Setări → Accesibilitate → Control Comutator → Comutatoare** și atribuie comutatorul la "Selectare Element".
3. Mergi la **Control Comutator → Stil Scanare** și alege "Scanare Automată" — dispozitivul va evidenția automat elementele unul câte unul.
4. Deschide Prism AAC în Modul La Pat. Controlul prin comutator va scana automat prin Cardurile cu Expresii Rapide. Activează comutatorul când cardul dorit este evidențiat.
5. Expresia este trimisă imediat — nu este necesară o a doua acțiune.

> Toate Cardurile cu Expresii Rapide conțin `data-scan-group="quick-cards"` astfel încât tehnologia asistivă poate scana în grup întreaga bandă înainte de a trece la alte regiuni ale interfeței.

#### Configurare urmărire privire (Eye gaze)

Hardware-ul de urmărire a privirii (Tobii Dynavox, EyeGaze Edge, PCEye, MyTobii P10 etc.) este prezentat sistemului de operare ca un cursor standard de mouse cu clic prin menținere (dwell-click). Nu este necesară o configurare specială în Prism AAC:

1. Configurează timpul de fixare a privirii în software-ul dispozitivului tău (recomandat: 800–1200 ms pentru utilizatorii aflați la început).
2. Deschide Prism AAC în Modul La Pat în orice navigator.
3. Menține privirea pe un Card cu Expresie Rapidă pentru a-l activa.

Dimensiunea minimă a cardului (88 × 80 px) îndeplinește cerința de dimensiune țintă WCAG 2.5.5 AAA de 44 × 44 CSS px și depășește dimensiunea minimă recomandată de obicei pentru interacțiunea prin privire (60 × 60 px).

---

<details>
<summary><strong>Toate funcționalitățile + detalii tehnice de implementare</strong></summary>

**Cinci subsisteme furnizate într-o singură funcționalitate:**

1. **Carduri cu Expresii Rapide** — `services/bedsideCards.ts` + interfața cu bandă din `components/BedsideOverlay.tsx`.

   - Stocare: cheia `localStorage` `prism_bedside_cards_v1`. Schema este validată la fiecare încărcare — intrările incorecte sunt eliminate silențios.
   - Limită: maxim 50 de carduri personalizate (previne creșterea nelimitată a stocării).
   - Carduri integrate: 15 intrări cu `id` prefixat cu `builtin-`; verificarea de protecție a interfeței de ștergere verifică acest prefix înainte de a afișa pictograma ✕, asigurând că valorile implicite nu sunt eliminate niciodată.
   - Generare pictograme AI: `services/aiService.ts → inferCardIcon(text)`. Folosește același lanț de redirecționare Ollama local → cloud Synalux ca și restul aplicației. Trimite expresia ca mesaj utilizator cu un șablon de sistem blocat ("Răspunde cu exact un emoji..."). Extrage primul cod Unicode din răspuns. Rezolvă întotdeauna — revine la 💬 în caz de eroare de rețea sau răspuns fără emoji.
   - Offline: cardurile funcționează complet offline; doar adăugarea unui card nou necesită rețea (pentru generarea pictogramei — revine la 💬 dacă este offline).

2. **Buclă AI fără mâini (🔁)** — accesibilă și din antetul principal de chat AI. După fiecare răspuns AI, microfonul repornește automat (întârziere de 1 s). Un model de referință `handsFreeRef` / `startListeningRef` asigură că efectul apelează întotdeauna funcția curentă de apel invers fără a se rula din nou la fiecare randare.

   ![Bară de stare Fără Mâini în panoul principal de chat AI](../../e2e/_screenshots/bedside-hands-free-statusbar.png)

3. **Interfață La Pat** — `fixed inset-0 z-50 bg-black` interfață întunecată pe tot ecranul randată ca un `<Fragment>` la același nivel alături de panoul principal AI, astfel încât starea panoului este păstrată între ciclurile de deschidere/închidere. Accesibilitate: `role="dialog"`, `aria-modal="true"`, `aria-label="Bedside Mode"`, captură de focalizare WCAG 2.1 SC 2.1.2 (Tab/Shift+Tab navighează în interiorul interfeței, `Escape` închide). Acoperirea spațiului de afișare este verificată independent E2E (toleranță ≤ 4 px).

   - **Buton mare de microfon** — 112 × 112 px (`w-28 h-28`), roșu + pulsație în timpul ascultării, bordură albă în repaus. Verificat ≥ 96 px prin Playwright `boundingBox()`.
   - **Bandă Carduri Rapide** — rând de derulare orizontală, fiecare card de `88 × 80 px`, `data-scan-group="quick-cards"` pentru gruparea scanării prin comutator, `role="list"` / `role="listitem"` pentru semantica cititorului de ecran.
   - **Rând de comenzi** — Fără Mâini (verde când este activ), cuvânt de activare "Hey Prism" (albastru când este activ, ascuns când `!wakeWordSupported`), comandă rapidă Control Vocal iOS.
   - **Ieșire** — buton ✕ (`w-12 h-12`) sau `Escape` → `onClose()` → `bedsideModeActive = false` în `AIChatPanel` → focalizarea WCAG 2.4.3 este returnată la butonul 🛏 care a deschis fereastra.

   ![Interfață La Pat — închisă, înapoi la panoul principal de chat AI](../../e2e/_screenshots/bedside-overlay-closed.png)

4. **Cuvânt de activare "Hey Prism"** — `services/wakeWordService.ts`. Rulează o sesiune continuă de `SpeechRecognition` în fundal. Detectează orice transcriere ce conține "hey prism", declanșează microfonul o dată, apoi se resetează pentru ciclul următor. Protecție: nu pornește când puntea nativă iOS deține microfonul (prezent `prismNativeBridge?.startVoice`). Starea activă a cuvântului de activare este afișată în bara de stare a panoului principal după închiderea interfeței.

   ![Bară de stare ce arată cuvântul de activare "Hey Prism" activ](../../e2e/_screenshots/bedside-wakeword-statusbar.png)

5. **Ghid Control Vocal iOS** — atingerea 📱 în rândul de comenzi încearcă `prismNativeBridge.openSettings('accessibility')` (deschide direct Accesibilitate pe versiunile native suportate). Pe web / desktop revine la un card de instrucțiuni în interfață care explică pașii `Setări → Accesibilitate → Control Vocal → Activat`.

   <p align="center">
     <img src="../../e2e/_screenshots/bedside-voice-control-card.png" alt="Card de instrucțiuni Control Vocal iOS — ghid pas cu pas afișat în interiorul interfeței La Pat când 📱 este atins pe web/desktop" width="260">
     <img src="../../e2e/_screenshots/bedside-voice-control-dismissed.png" alt="Card de instrucțiuni Control Vocal iOS după închidere — interfața revine la aspectul normal la pat" width="260">
   </p>

**Acoperire prin teste:**
- `services/bedsideCards.test.ts` — 22 teste unitare: setul de carduri implicit, salvare/încărcare în localStorage, rezervă pentru JSON incorect, filtrare carduri invalide, limită de 50 de carduri, restricții de câmp `createCard`.
- `e2e/bedside-mode.spec.ts` — 17 teste Playwright E2E: vizibilitate butoane, comutare `aria-pressed`, clase de stare verde/albastru, text bară de stare, atribute de accesibilitate ale interfeței, dimensiune `boundingBox` microfon, acoperire spațiu afișare, afișare/închidere card instrucțiuni.

**Fișiere cheie:**
- `components/AIChatPanel.tsx` — stare la pat, stare carduri (`bedsideCards`), `handleAddBedsideCard`, `handleDeleteBedsideCard`, buclă fără mâini, ciclu de viață cuvânt activare, butoane antet
- `components/BedsideOverlay.tsx` — interfață La Pat, bandă Carduri Rapide, fereastră adăugare card, mod editare, captură focalizare, card instrucțiuni control vocal
- `services/bedsideCards.ts` — tip `BedsideCard`, `DEFAULT_BEDSIDE_CARDS`, `loadCards`, `saveCards`, `createCard`
- `services/aiService.ts` → `inferCardIcon(text)` — deducere emoji prin AI
- `services/wakeWordService.ts` — detectare continuă expresie de activare
</details>

---

### 📨 Trimitere mesaj — selector furnizor
Când un contact are mai mulți furnizori configurați (de ex. atât Mail, cât și SMS), o secțiune **"Trimite prin"** apare deasupra zonei de redactare. O singură atingere schimbă furnizorul înainte de redactare — nu este nevoie să părăsești panoul.

![Selector furnizor contact — rândul 'Trimite prin' cu Mail evidențiat verde, SMS disponibil](../../docs/screenshots/contact-provider-picker.png)

---

### 💬 Chat AAC
Mesajele primite de la furnizorii conectați (Telegram, WhatsApp, Email, Slack etc.) ajung în acest panou. Insigna de mesaje necitite de pe bara de instrumente arată numărul lor, alarma + notificarea între file se declanșează când sosește un mesaj nou, iar atingerea unei linii de mesaj îl copiază în bară, astfel încât copilul să poată compune un răspuns cu propria voce.

![Panoul Chat AAC afișând mesajele primite de la îngrijitor cu insigna de necitite](../../docs/screenshots/panel-aac-chat.png)

<details>
<summary><strong>Funcționalități + detalii tehnice</strong></summary>

- Casetă poștală interogată prin portalul Synalux `/api/v1/prism-aac/inbox/poll` (fără acțiune la 404 dacă portalul nu este configurat)
- Notificare `BroadcastChannel` între file la primirea unui mesaj nou
- Abstracție furnizor: adăugarea Outlook / Slack / Discord = ~30 linii de cod fiecare
- Sincronizarea stării de citire, astfel încât îngrijitorii să vadă când copilul a văzut mesajul
- Versiunea gratuită: 1 furnizor conectat; nivelul plătit: nelimitat
- TTS per mesaj, astfel încât copilul să poată auzi textul primit în vocea sa preferată

**Cale de randare:** `components/AACChatPanel.tsx` → `services/inboxPolling.ts` (interogare la 5s când sidePanel === 'aac-chat', 60s în caz contrar) → `useScheduleStore.setIncomingMessages()`. Fiecare mesaj este adăugat și în secțiunea programului "Mesaje de la îngrijitori".
</details>

---

### 🧮 Materii școlare
Pânză cu grilă de celule ce găzduiește **19 tastaturi pe materii** ce acoperă întregul program de liceu: matematică + științe + programare + arte + umanioare. Fiecare filă redirecționează tutorul AI printr-un șablon de instrucțiuni specific domeniului (33 de șabloane în total), astfel încât modelul să nu aplice raționamente algebrice pe un pătrat Punnett sau să confunde o dinamică muzicală cu un literal de programare. **Istoria se adaptează la limba și regiunea locală** până la nivel de stat / provincie / Land / comunitate autonomă — peste 280 de regiuni din 23 de țări.

![Pânză cu grilă de celule cu 5 + 7 = 12 tapat în celule](../../docs/screenshots/math-canvas-typed.png)

<details>
<summary><strong>File pe materii (19 în total)</strong></summary>

**Matematică (9 tastaturi)** — Principală, Matematică Avansată (π √ exponenți + 5 instrumente de decorare: casetă de fracție, casă de împărțire lungă, bară de radical, linie de sumă, bară de fracție), a–z, Diverse Matematică (teoria mulțimilor + mecanică logică), Timp și Distanță, Greutate, Volum, Geometrie, Bani.

**Științe (4)** — Chimie (24 de elemente + săgeți de reacție + sarcini + indici + markeri de fază), Fizică (grecă completă + 16 unități SI + ∫/∂/∇/∑/∏ + constante), Biologie (ADN/ARN + genetică + 8 ranguri de taxonomie + 12 organite), Statistică (μ σ x̄ + 12 operații + distribuții).

**Programare (2)** — Python (24 operații + 26 cuvinte cheie) și Java (24 operații + 26 cuvinte cheie). Codul introduce câte un caracter per celulă, așezându-se natural pe grila cu lățime fixă.

**Arte + Umanioare (4)** — Muzică (3 chei + 6 note + 5 pauze + 5 alterații + 8 dinamici), Științele Pământului (vreme + plăci + 10 planete + UA/al/pc/Mya/Gya), Istorie (adaptată la limba și regiunea locală), Arte ale Limbajului (12 etichete de părți de vorbire + 6 tipuri de propoziții + punctuație + stiluri de citare).

</details>

<details>
<summary><strong>Tutor AI — 11 domenii × 3 moduri = 33 instrucțiuni</strong></summary>

![Interfață tutor AI cu indiciu afișat deasupra pânzei](../../docs/screenshots/math-tutor-hint.png)

Trei moduri per materie: 💡 **Indiciu** (îndrumare ușoară pentru pasul următor, nu rezolvă niciodată), ✓ **Verifică** (validează răspunsul copilului, celebrează dacă este corect), 🎓 **Rezolvă** (explicație pas cu pas completă, maxim 4 pași). Fila activă îi spune tutorului la ce materie lucrează copilul. Limitare strictă de timp de 15 s + buton Reîncearcă, astfel încât interfața să nu rămână blocată.
</details>

<details>
<summary><strong>Istorie — adaptată la limba și regiunea locală</strong></summary>

![Tastatură de Istorie în limba engleză (fără regiune) — niveluri universale + naționale](../../docs/screenshots/math-keyboard-history-en.png)
![Tastatură de Istorie cu regiunea US-TX — Alamo, anexarea Texasului, JFK apar](../../docs/screenshots/math-keyboard-history-us-tx.png)

Trei niveluri suprapuse:
1. Evenimente **Universale** predate în fiecare programă (476, 1914 Primul Război Mondial, 1939 Al Doilea Război Mondial, 1969 debarcarea pe Lună)
2. Evenimente **Naționale** selectate prin `language` (en, es, fr, de, ro, ru, uk, ja, ko, zh, ar, it, pl, nl, he, hi, vi, tr, pt) — 19 limbi suportate
3. Evenimente **Sub-naționale** selectate prin `historyRegion` (US-TX, CA-QC, UK-SCT, ES-CT, IN-MH, DE-BY, …) — **peste 280 de regiuni din 23 de țări** inclusiv toate cele 50 de state SUA + DC, 13 provincii / teritorii canadiene, toate cele 4 națiuni din Regatul Unit, Irlanda (Republica + 4 provincii istorice), toate cele 16 Landuri germane, toate cele 17 comunități autonome spaniole, toate cele 20 de regiuni italiene, plus AU, FR, MX, BR, IN, CN, RU, BE, CH, NL, AR, ZA, KR, PK, NZ, PL.

Instrucțiunea tutorului poartă limba + regiunea, astfel încât o dată ambiguă precum 1836 în `US-TX` se rezolvă la Bătălia de la Alamo (nu aderarea statului Alabama); 1759 în `CA-QC` se ancorează pe Câmpiile lui Avram; 1714 în `ES-CT` pe căderea Barcelonei.

</details>

<details>
<summary><strong>Fluxuri de lucru de testare — 12 materii × probleme cu text Clasa 8-12 × 72 teste Playwright</strong></summary>

Fișe de probleme pas cu pas ce exersează fiecare tastatură de materie, plus un test Playwright executabil per problemă ce rulează pe panoul de matematică și verifică dacă simbolurile fiecărui pas ajung corect în grila de celule. Modelat direct după o pagină reală de referință pentru algebră de Clasa a 9-a.

- **Stratul 1 — pas cu pas generic:** [`tests/workflows/`](tests/workflows/) — 12 fișiere markdown (matematică-avansată, biologie, chimie, științele-pământului, geometrie, istorie, arte-ale-limbajului, diverse-matematică, fizică, programare-java, programare-python, statistică).
- **Stratul 2 — nivelat pe clase reale:** [`tests/workflows/grade-8-12/`](tests/workflows/grade-8-12/) — 12 fișiere markdown cu probleme cu text și variabile numite (algebră-clasa-9, geometrie-clasa-10, fizică-clasa-11, chimie-clasa-10, biologie-clasa-9, statistică-clasa-11, programare-python-clasa-9, programare-java-clasa-11, pre-calcul-clasa-12, științele-pământului-clasa-9, arte-ale-limbajului-clasa-8, istorie-universală-clasa-10) + raport per materie privind golurile tastaturii [`REPORT.md`](tests/workflows/grade-8-12/REPORT.md).
- **Stratul 3 — Playwright e2e:** [`e2e/math-workflows/`](e2e/math-workflows/) — 72 teste (`npx playwright test --project=desktop e2e/math-workflows`).

Indexul complet, materiile cu suport insuficient clasificate și ghidul "cum să adaugi un flux nou de lucru" → **[`docs/WORKFLOWS.md`](docs/WORKFLOWS.md)**.

</details>

<details>
<summary><strong>Alte funcții de matematică (instrument de blocare, mărire prin două atingeri, salvare / sincronizare)</strong></summary>

- **Instrument de blocare** — după ce copilul termină o problemă, blochează regiunea. Celulele blocate se randează ușor estompate și resping editările.
- **Mărire prin două atingeri** — prima atingere pregătește tasta (scară 1.4× + aureolă verde), a doua atingere o confirmă. Dezactivare automată în 2 s. Pentru utilizatorii cu imprecizie motorie.
- **Salvare + sincronizare** — stocare primară locală în `localStorage`; sincronizare pe cât posibil către portalul Synalux prin butonul `↻ Sincronizare`. Limită de 100 de documente / 200 KB per corp; cele mai vechi sunt eliminate.
- **Menținere prin fixare** — timp de menținere configurabil per tastă (0–1500ms) cu inel de progres verde.

![Interfață documente salvate afișând o intrare și un buton de Sincronizare](../../docs/screenshots/math-docs-overlay.png)
![O tastă numerică pregătită în starea mărită cu aureolă verde](../../docs/screenshots/math-two-hit-armed.png)
![Instrumentul de blocare pregătit, solicitând utilizatorului să atingă un colț al regiunii](../../docs/screenshots/math-lock-armed.png)

</details>

<details>
<summary><strong>Tastaturi pe materii — imagini suplimentare</strong></summary>

![Tastatură de Chimie cu H₂O](../../docs/screenshots/math-keyboard-chemistry.png)
![Tastatură de Biologie cu A T G](../../docs/screenshots/math-keyboard-biology.png)
![Tastatură Java cu `private String`](../../docs/screenshots/math-keyboard-java.png)
![Tastatură de Muzică](../../docs/screenshots/math-keyboard-music.png)
![Tastatură de Statistică](../../docs/screenshots/math-keyboard-statistics.png)
![Tastatură de Științele Pământului](../../docs/screenshots/math-keyboard-earth-science.png)
![Tastatură de Arte ale Limbajului](../../docs/screenshots/math-keyboard-language-arts.png)
![Tastatură de Istorie pentru limba română](../../docs/screenshots/math-keyboard-history-ro.png)

</details>

---

### 🗓 Program
Program vizual prima dată-apoi pentru suport în rutine și tranziții. Fiecare pas este o casetă cu imagine + etichetă; finalizarea unei casete redă un semnal sonor + un marcaj vizual de progres. Magazinul de recompense (nivel plătit) se deblochează la sfârșitul unei rutine.

![Panou Program cu tablă prima dată-apoi + listă de activități](../../docs/screenshots/panel-schedule.png)

<details>
<summary><strong>Funcționalități + detalii tehnice</strong></summary>

- Grilă predefinită cu 24 de casete pentru adăugarea activităților dintr-o atingere: trezire, spălat pe dinți, mic dejun, școală, gustare, prânz, joacă, citit, artă, plimbare, cină, baie, poveste de culcare, culcare, medicamente, ață dentară, curățenie, spălat haine, îngrijire animale, sport, …
- Reordonare prin tragere și plasare; editare directă prin butonul creion; adăugările predefinite conțin `textKey` astfel încât Schimbarea limbii reetichetează totul
- Mașină de stări Prima dată-Apoi: pulsație casetă activată, semnal sonor ascendent din 3 note la expirarea cronometrului, mișcare sigură (`prefers-reduced-motion` → inel static), semantică `aria-pressed`
- Încălzire audio: un oscilator aproape silențios la 1Hz menține starea AudioContext "activă" pe iOS Safari, astfel încât semnalul sonor al cronometrului să se redea într-adevăr după o tăcere lungă (fără încălzire, semnalul se declanșează într-un context suspendat = fără sunet)
- Mesajele îngrijitorului se adaugă la program ca o secțiune "Mesaje", astfel încât copilul să vadă ce urmează + cine i-a scris

**Cale de randare:** `components/SchedulePanel.tsx` → `useScheduleStore` (24 de activități predefinite + personalizate) → `services/feedback.ts:playTimerRing()` → AudioContext comun prin `services/azureTTS.ts:warmupAzureAudio()`.
</details>

---

### 🎮 Jocuri
12 jocuri AAC bazate pe dovezi. Create pentru a preda comunicarea, **nu pentru timpul petrecut în fața ecranului**. Fiecare joc înregistrează enunțurile + precizia, astfel încât motorul adaptiv să poată sugera cel mai potrivit joc următor.

![Panoul Jocuri cu 9 casete de jocuri](../../docs/screenshots/panel-games.png)

<details>
<summary><strong>Cele 12 jocuri + detalii tehnice</strong></summary>

| Joc | Abilitate vizată |
|---|---|
| Sparge Bule | Cauză + efect, comunicare intenționată |
| Vânătoare de Culori | Vocabular receptiv (nume de culori) |
| Povestea Mea | Secvențiere narativă |
| Potrivește | Potrivire + gândire categorială |
| Da / Nu | Discriminare binară, cerere/refuz |
| Completează | Completare de propoziții (cloze) |
| Sortează Categorii | Categorisire semantică |
| Potrivește Emoția | Etichetare afectivă, teoria minții (ToM) |
| Ce Urmează | Raționament secvențial |
| La fel / Diferit | Discriminare vizuală — potrivire sau contrast |
| Ascultă și Potrivește | Discriminare auditivă + vocabular |
| Rândul Fiecăruia | Practică de respectare a rândului în grup |

- Toate cele 12 jocuri sunt gratuite; niciun joc nu este restricționat de abonament
- Datele din fiecare joc alimentează `services/adaptiveEngine.ts` — lungime enunț / categorie / momentul zilei / rezultat → sugerează jocul următor
- Toate jocurile dezactivează categoriile de casete AAC care nu sunt relevante pentru vocabularul acelui joc, astfel încât copilul să nu fie distras

**Cale de randare:** `components/GamesPanel.tsx` → componente individuale de jocuri în `components/games/`. Fiecare joc înregistrează prin `useScheduleStore.recordMessage(text, category)`.
</details>

---

### 🏪 Piață (Marketplace)
Pachete de voci (voci Inworld, voce clonată personalizat a unui frate/părinte), pachete de vocabular (vocabular de bază în spaniolă, vorbire susținută de semne), pachete de jocuri (jocuri suplimentare peste cele 9). Aplicațiile se instalează în bara de instrumente prin registrul pe care îl folosesc și panourile integrate.

![Panoul Piață cu aplicații ce pot fi instalate](../../docs/screenshots/panel-marketplace.png)

<details>
<summary><strong>Funcționalități + detalii tehnice</strong></summary>

- Aplicațiile există ca intrări JSON (`lib/marketplace/manifests/local.ts`) + un registru la rulare `lib/marketplace/registry.ts` cu `getHandler(appId)` ce returnează componenta panoului
- Clonare voce (nivel plătit): înregistrare de 90s → voce antrenată ce poate fi folosită pentru orice TTS din aplicație, inclusiv pentru casetele de categorii
- Aplicațiile instalate se randează ca butoane în bara de instrumente după cele integrate; `useSettingsStore.installedApps` este sursa unică de adevăr
- Restricție per abonament: piața afișează totul, dar butoanele de instalare se dezactivează pentru elementele peste abonamentul utilizatorului

**Cale de randare:** `components/MarketplacePanel.tsx` → `useMarketplaceStore` → backend `synalux/api/v1/marketplace/...` pentru achiziție, apoi descărcare resurse (fișiere voce, JSON vocabular) în IndexedDB.
</details>

---

### 📄 Cititor PDF
Deschide un PDF, vezi o casetă pentru fiecare pagină, atinge pentru a o auzi rostită în vocea ta. Fișe școlare, scrisori trimise acasă, articole — introdu orice PDF și ascultă în loc să încerci să îl citești. Nu este necesar Adobe Reader; întreaga bibliotecă rulează în browserul tău.

![Panou Cititor PDF — stare goală cu îndemnul "+ Deschide PDF"](../../docs/screenshots/panel-pdf-reader.png)

<details>
<summary><strong>Funcționalități + detalii tehnice</strong></summary>

- O casetă per pagină; fiecare arată primele 3 linii + un buton `▶ Pagina N` ce transmite prin `aacSpeak()` (aceeași voce + ton + evidențiere cuvinte ca la orice altceva)
- `▶ Citește tot` concatenează fiecare pagină într-un singur enunț continuu
- Detectarea paginilor goale (PDF-uri scanate ca imagini) sugerează utilizarea instrumentului OCR
- `pdfjs-dist` importat dinamic la prima deschidere — pachet separat de ~3 MB din CDN, cu versiunea fixată în pachetul npm
- Butonul din bara de instrumente (📄) este opțional prin Setări → Bară de instrumente, astfel încât bara implicită minimă rămâne curată

**Cale de randare:** `components/PdfReaderPanel.tsx` → `services/pdfReader.ts` (pdfjs `getDocument` → `getTextContent` per pagină) → `services/aacSpeak.ts`.
</details>

---

### 👁 Cititor Capturi de Ecran (OCR)
Lipește sau încarcă o fotografie a unei fișe de lucru, o captură de ecran a unei pagini web, o imagine a unei pagini dintr-un manual — textul recunoscut apare lângă imagine și poți atinge **▶ Vorbește** pentru a-l auzi, sau **↧ Trimite în bara de mesaje** pentru a-l edita înainte de a-l rosti.

![Panou Cititor Capturi de Ecran (OCR) — stare goală cu îndemnul "+ Deschide imaginea"](../../docs/screenshots/panel-ocr-capture.png)

<details>
<summary><strong>Funcționalități + detalii tehnice</strong></summary>

- Matrice OCR pentru 20 de limbi mapată din variantele locale PrismAAC în coduri Tesseract (eng / spa / fra / por / deu / ron / ukr / rus / jpn / kor / chi_sim / ara / ita / pol / nld / heb / hin / vie / tur / ind)
- Fișiere de date antrenate stocate în memoria cache după prima utilizare (~10 MB pentru engleză, mai mult pentru CJK) — prima rulare arată "Se citește imaginea... (prima rulare descarcă modelul OCR — poate dura 10-30 s)"
- Procent de încredere afișat astfel încât utilizatorul AAC să știe dacă poate avea încredere în rezultat sau trebuie să fotografieze din nou
- Modulul de curățare `disposeOcr()` oprește fiecare modul executant creat la părăsirea paginii pentru a elibera memoria WASM
- Butonul din bara de instrumente (👁) este opțional prin Setări → Bară de instrumente

**Cale de randare:** `components/OcrCapturePanel.tsx` → `services/ocr.ts` (`tesseract.js` `createWorker` → `recognize`) → `services/aacSpeak.ts` sau `messageStore.setText`.
</details>

---

### 🎧 Player de Confort

Player media la patul pacientului pentru spital — comă, Terapie Intensivă, persoane non-verbale sau oricine are nevoie de conținut reconfortant continuu la pat.

<details>
<summary>Detalii funcționalitate</summary>

Familia și prietenii înregistrează mesaje vocale, încarcă fotografii și videoclipuri. Lista se redă în buclă continuă, astfel încât pacientul are întotdeauna voci și fețe familiare în apropiere.

- **Înregistrează** mesaje vocale direct în aplicație (API MediaRecorder)
- **Încarcă** fișiere audio, fotografii și clipuri video (100 MB per fișier, 500 MB în total)
- **Buclă automată** prin toate elementele în mod continuu — pornește-l și poți pleca
- Mod **Ecran complet** pentru fotografii și videoclipuri (afișaj la patul pacientului)
- Integrare **TTS nativă** — expresiile atinse sunt rostite prin AVSpeechSynthesizer pe iOS
- **Offline** — toate fișierele media sunt stocate în IndexedDB, funcționează fără conexiune la internet
- **Accesibil din tastatură** — fiecare comandă are etichete ARIA și navigare din tastatură
- **Revizuit la standarde de securitate ridicate** — 27 de constatări de securitate remediate (scurgeri URL blob, gestionarea cotelor, validarea intrărilor, liste de tipuri MIME permise, curățare la demontare)
- Butonul din bara de instrumente (🎧) este opțional prin Setări → Bară de instrumente

**Limitate stocare:** maxim 50 de elemente, 100 MB per fișier, 500 MB în total. Tipuri MIME restricționate la audio (webm/mp4/mpeg/ogg/wav), imagini (jpeg/png/gif/webp/heic) și video (mp4/webm/quicktime).

**Cale de randare:** `components/ComfortPlayerPanel.tsx` → `store/comfortPlayerStore.ts` (Zustand + persist) → `services/comfortMediaStorage.ts` (blobs IndexedDB).
</details>

---

### 🧩 Extensie Chrome — aceleași caracteristici de asistență la citire în orice câmp de text
Aplicația web PrismAAC acoperă fluxul de asistență la citire în propria sa interfață. Extensia Chrome (`chrome-extension/`) aduce **aceleași funcționalități în ORICE câmp de text pe ORICE site** — Gmail, Google Docs, Word Online, portaluri școlare, formulare bancare — completând singurul gol față de Read & Write ce nu putea fi atins doar dintr-o pagină web.

![Asistent de citire PrismAAC — vorbește pe măsură ce tastezi, cu evidențiere cuvânt cu cuvânt, în orice câmp de text](../../docs/screenshots/extension-marquee.png)

Interfața plutitoare se atașează deasupra oricărui câmp de text focalizat. Atinge **▶ Vorbește** pentru a reciti, sau continuă să tastezi — finalizarea unei propoziții cu `.?!` o citește înapoi automat, fiecare cuvânt iluminându-se în galben pe măsură ce este rostit:

![Interfața PrismAAC deasupra unei pagini de redactare, la mijlocul propoziției cu "school" evidențiat galben în timp ce TTS îl citește](../../docs/screenshots/extension-overlay.png)

Traducerea în timp ce vorbește arată ATÂT linia sursă (cursiv mic), CÂT ȘI linia tradusă (dimensiune completă, cu evidențierea cuvântului activ pe măsură ce este rostit). Peste 50 de limbi prin serviciul public gratuit Google (fără cheie API):

![Interfața PrismAAC traducând din engleză în română — linia sursă "I had a really good day at school today" cu traducerea "Am avut o zi foarte bună la școală astăzi" dedesubt, "foarte" evidențiat](../../docs/screenshots/extension-translate.png)

Pagina de opțiuni — setările se sincronizează pe profilul Chrome al utilizatorului prin `chrome.storage.sync`. Listă de dezactivare per site, selector de voce, glisoare pentru viteză / volum / tonalitate, selectoare de limbă, toate opționale:

![Pagina de opțiuni a extensiei PrismAAC — declanșatoare de vorbire, limba țintă Română, selector de voce, glisoare viteză/volum/tonalitate](../../docs/screenshots/extension-options.png)

**Instalare (mod dezvoltator pentru moment — în curs de revizuire în Chrome Web Store):**

```sh
cd chrome-extension
npm install
npm run build
```

Deschide `chrome://extensions`, activează **Mod dezvoltator (Developer mode)**, apasă pe **Încarcă neîmpachetat (Load unpacked)** și alege folderul `chrome-extension/dist`.

**Funcționalități:**

- Rostirea propoziției la `.?!`, rostirea fiecărui cuvânt la apăsarea tastei spațiu, toate configurabile
- **Evidențiere cuvânt cu cuvânt** susținută de evenimentul nativ al browserului `SpeechSynthesisUtterance.boundary` (sincronizare REALA per cuvânt, față de estimarea de ~60 ms/caracter din aplicația web — calea prin portal returnează MP3 fără evenimente în flux, dar Web Speech le expune nativ)
- **Traducere în timp ce vorbește** — alege o limbă țintă (peste 50 suportate prin serviciul gratuit Google, fără cheie API). Interfața arată ATÂT linia sursă (cursiv mic), CÂT ȘI linia tradusă (cu evidențierea cuvântului activ); o voce Web Speech potrivită cu limba țintă este selectată automat
- Interfață plutitoare Shadow-DOM ancorată deasupra câmpului focalizat (▶ Vorbește, 📌 Fixează, × Închide)
- `Cmd / Ctrl + Shift + S` pentru a citi la cerere câmpul focalizat; `Esc` anulează
- Listă de dezactivare per site pentru formulare bancare / sensibile
- Setările se sincronizează pe profilul Chrome al utilizatorului prin `chrome.storage.sync` — nu este necesar un cont PrismAAC

**Confidențialitate:** modul fără traducere funcționează complet offline (Web Speech rulează nativ). Modul traducere efectuează un singur apel HTTPS per propoziție unică către `translate.googleapis.com` (salvat în memoria cache după prima trimitere). Sursa este disponibilă la [`chrome-extension/`](chrome-extension/) — pachet TypeScript + esbuild (conținut 18 KB, opțiuni 7 KB, fundal 339 B).

---

### 👋 Gesturi fără mâini
Introducere opțională bazată pe cameră pentru utilizatorii care nu pot atinge ecranul în mod sigur. Menținerea poziției capului pentru clic + profiluri de gesturi ale mâinii. Rulează local — niciun videoclip nu părăsește dispozitivul.

<details>
<summary><strong>Funcționalități + detalii tehnice</strong></summary>

- **Modul de bază**: urmărirea poziției capului (FaceLandmarker, Mediapipe). Utilizatorul privește o tastă, menține privirea timp de `headTrackingDwellMs` (implicit 1200 ms) → se execută clic. Un inel vizual de progres se umple în timpul menținerii.
- **Modul avansat**: urmărirea poziției mâinii. Profiluri de gesturi personalizate per utilizator (palma deschisă = enter, pumn = backspace, ciupire = spațiu etc.) configurate prin `components/HandCalibration.tsx`.
- Protecție la abatere: dacă capul utilizatorului se abate cu mai mult de `headTrackingDriftThresholdPx` pe parcursul a `headTrackingDriftWindowMs` cadre consecutive, urmărirea se dezactivează automat și afișează un îndemn de recalibrare (raportat de utilizatori în mai 2026: urmărirea continua silențios abaterea timp de o oră și rata țintele reale de taste).
- **Cale de ieșire prin tasta Esc** — apăsarea tastei Esc pe orice tastatură dezactivează imediat urmărirea și afișează din nou tastatura qwerty fără a pierde bara de mesaje.
- Instanță unică pentru fluxul camerei (`services/cameraStream.ts`), astfel încât urmăritorul de cap + mână folosesc același flux; Schimbarea modurilor se face instantaneu.
- Calibrarea per utilizator persistă; urmăritorul corporal își revine automat la reluarea sesiunii.

**Documentație detaliată:** [`docs/TRACKING_MATH.md`](docs/TRACKING_MATH.md) (matematica calibrării, învățare pe percentile, ego-mișcare, filtru One Euro, ~30 de parametri ajustabili), [`docs/GESTURE_RECOGNITION.md`](docs/GESTURE_RECOGNITION.md), [`docs/TRACKING_RELIABILITY.md`](docs/TRACKING_RELIABILITY.md).
</details>

---

### 👁 Context Vizual — sugestii de expresii prin cameră

Îndreaptă camera către obiecte din viața de zi cu zi și bara de predicție afișează instantaneu expresii relevante. O ceașcă și o furculiță pe masă → "Mai vreau", "Apă vă rog", "Gata". Un pat → "Sunt obosit", "Noapte bună". O carte → "Ajutor vă rog", "Nu înțeleg". **Niciun competitor AAC nu oferă această funcționalitate.**

| Scenă | Obiecte detectate | Expresii sugerate |
|---|---|---|
| 🍽️ Ora mesei | ceașcă, furculiță, lingură, bol, sticlă | "Mai vreau", "Apă vă rog", "Gata", "Delicios", "Prea cald" |
| 😴 Ora de culcare | pat, ursuleț de pluş | "Sunt obosit", "Noapte bună", "Citește o poveste", "O îmbrățișare vă rog" |
| 📚 Teme școlare | carte, laptop, tastatură | "Ajutor vă rog", "Nu înțeleg", "Gata", "Mai mult timp" |
| 🎮 Timp de joacă | ursuleț de pluș, minge de sport | "Vreau să mă joc", "Rândul meu", "Distractiv!", "Din nou!" |
| 🛁 Baie | toaletă, chiuvetă | "Trebuie să merg", "Spală mâinile", "Ajută-mă" |
| 📺 Privit la TV | TV, telecomandă, canapea | "Vreau să mă uit", "Oprește", "Prea tare" |

Expresiile sunt disponibile în peste 12 limbi (engleză, spaniolă, franceză, portugheză, română, ucraineană, rusă, germană, japoneză, coreeană, chineză, arabă și altele). Limba urmărește setarea de limbă a aplicației — schimbă la rusă și camera va sugera "Хочу ещё" în loc de "Mai vreau".

![Context Vizual — scenă de masă detectată](../../docs/screenshots/vision-mealtime.png)

<details>
<summary><strong>Cum funcționează (tehnic)</strong></summary>

**Conductă de procesare:** Cameră (partajată prin `cameraStream.ts`) → MediaPipe ObjectDetector (EfficientDet-Lite0, 4 MB int8, WASM) → Deducere Scenă (reguli deterministice, 11 tipuri de scene) → Injectare în Bara de Predicție (`setAiCompletion` + `learnWord` spor n-gram).

**Performanță:**
- Rulează la **2 FPS** (o detectare la fiecare 500 ms) — obiectele nu se mișcă repede, economisește bateria
- Grad de utilizare CPU: **< 6%** pe mobil
- Dimensiune model: **4 MB** (EfficientDet-Lite0 cuantizat int8, încărcat în mediul de rulare MediaPipe WASM existent)
- Memorie RAM suplimentară totală: **~5 MB** (model + buffere + vocabular expresii)
- Protecție termică: reduce automat la 1 FPS → întrerupe 30s la limitarea termică

**Confidențialitate:**
- 100% pe dispozitiv — cadrele camerei **nu părăsesc niciodată dispozitivul**, fără deducții în cloud
- Rezultatele detectării sunt **efemere** — nu sunt păstrate în localStorage sau cloud
- Clasa `person` este detectată dar **nu este afișată niciodată** utilizatorului și nu este folosită pentru sugestii
- Nu se afișează nicio previzualizare a camerei în timpul detectării obiectelor

**Siguranță:**
- Funcționalitate **DEZACTIVATĂ** implicit — îngrijitorul trebuie să o activeze explicit în Setări → Moduri de Introducere → Context Vizual
- Expresiile vizuale **nu sunt rostite niciodată automat** — copilul trebuie să atingă/mențină privirea activ pentru a vorbi
- Expresiile de urgență sunt separate arhitectural și **nu sunt înlocuite niciodată** de sugestiile vizuale
- Scena trebuie să fie stabilă timp de **3 cadre consecutive** (~1.5s) înainte de activare — previne pâlpâirea

**Model detectare obiecte:** [EfficientDet-Lite0](https://ai.google.dev/edge/mediapipe/solutions/vision/object_detector) — 80 de clase COCO, găzduit pe CDN Vercel alături de modelele existente MediaPipe pentru față/poziție. Același mediu de rulare WASM ca la urmărirea capului.

**Deducere scenă:** Motor de reguli deterministic (fără model ML suplimentar). Regulile mapează combinațiile de obiecte la scene cu ponderare în funcție de momentul zilei: `ceașcă + furculiță + lingură` la prânz = `ora mesei` (încredere 0.90). 11 tipuri de scene, fiecare cu seturi de obiecte configurabile și ajustări în funcție de timp.

**Injectare predicție:** Două puncte de conectare existente în `predictionStore`:
1. `setAiCompletion(phrase)` — plasează expresia principală ca prima casetă de predicție din stânga
2. `learnWord(word, prev)` — sporește vocabularul relevant pentru scenă prin n-grame sintetice cu multiplicator de 10× pentru utilizator

Sporul vizual scade după 30 de secunde când obiectele părăsesc cadrul. Tastarea activă suprimă sugestiile vizuale (intenția utilizatorului are prioritate).

**Fișiere cheie:**
- `services/objectDetectionService.ts` — preluare cameră, buclă MediaPipe, protecție termică
- `services/sceneInference.ts` — motor de reguli, 11 tipuri de scene, ajustare momentul zilei
- `services/visionPredictionBridge.ts` — conectare scenă → bară de predicție
- `constants/visionPhrases.ts` — expresii selectate × 12+ limbi per scenă
- `constants/objectVocabulary.ts` — 30 de etichete de obiecte COCO → tablouri de cuvinte localizate
- `store/visionStore.ts` — magazin Zustand efemer (nu se păstrează)
- `hooks/useVisionContext.ts` — cârlig React ce conectează detectarea ↔ puntea ↔ setările

**Teste:** 62 de teste unitare ce acoperă regulile de deducere a scenei, completitudinea vocabularului de obiecte, acoperirea limbilor pentru expresii, ciclul de viață al magazinului și integrarea completă a conductei (obiecte → scenă → expresii → magazin).

**Verificat E2E în Safari:**
```
SCENE=mealtime   CONF=0.90 PHRASES=I want more|Water please|All done     BADGE=🍽️
SCENE=bedtime    CONF=0.70 PHRASES=I'm tired|Good night|Read a story     BADGE=😴
SCENE=schoolwork CONF=0.80 PHRASES=Help please|I don't understand|Done   BADGE=📚
```
</details>

---

### ⚙️ Setări
25 de limbi / 28 de variante locale, temă (luminos / întunecat / contrast ridicat), dimensiune grilă (4–20 casete), adaptări motorii (menținere prin fixare la matematică, mărire prin două atingeri, fixare privire la urmărirea capului, sensibilitate gesturi, dezactivare automată la abatere), selector de voce (gratuit pentru toată lumea), utilizarea memoriei cache pentru vorbire și păstrarea datelor, autocorecție AI activată/dezactivată, notificări, personalizare bară de instrumente, selector regiune istorică, Cont Synalux cu planul Cloud.

![Setări — selector de limbă + comutator temă](../../docs/screenshots/panel-settings.png)

<details>
<summary><strong>Setări de matematică + accesibilitate</strong></summary>

![Setări — timp de menținere la matematică + mărire prin două atingeri](../../docs/screenshots/panel-settings-math.png)

- **Menținere prin fixare la matematică** — glisor 0–1500 ms; 0 = clic instantaneu, 200–1500 ms ajută utilizatorii cu imprecizie motorie (un inel de progres verde se umple în timpul menținerii pentru a fi vizibil).
- **Mărire prin două atingeri** — prima atingere pe orice tastă de matematică o pregătește (scară 1.4× + aureolă verde, fără confirmare), a doua atingere o confirmă. Dezactivare automată în 2 s. Se combină cu menținerea prin fixare.
- **Fixare privire la urmărirea capului** — 200–5000 ms.
- **Sensibilitate** — 1–10.
- **Dezactivare automată la abatere** — comutator + prag (px) + fereastră (ms).
- **Afișează calibrarea mâinii** — deschide editorul de profiluri pentru poziția mâinii.

</details>

<details>
<summary><strong>Moduri de introducere — voce, gesturi, autocorecție AI</strong></summary>

![Setări — panoul moduri de introducere](../../docs/screenshots/panel-settings-input-modes.png)

- **Introducere vocală** — Web Speech API, adaptat la limbă (engleză UK vs engleză US etc.); nivel gratuit
- **Autocorecție și Completare AI** — fiecare pauză de tastare trece prin autocorecția din cloud (Gemini 2.5 Flash-Lite). Dezactivat implicit în scenarii cu lățime de bandă redusă.
- **Notificări** — alarmă + notificare între file la mesajele primite în chat-ul AAC.
- **Introducere prin cameră** — comutator principal pentru urmărirea capului + mâinii.
- **Țintă urmărire cameră** — cap, mână sau detectare automată.

</details>

<details>
<summary><strong>Personalizarea barei de instrumente</strong></summary>

Bara de instrumente poate fi reordonată complet. Versiunea implicită 0.9.0 vine cu un set minim (microfon, chat AAC, alertă, categorii, setări) astfel încât ecranul să rămână aerisit pentru utilizatorii noi — fiecare modul integrat suplimentar (matematică, chat AI, program, jocuri, piață, player confort, note, istoric, sunet) poate fi reactivat dintr-o atingere în Setări → Bară de instrumente. Aplicațiile instalate din piață se poziționează automat după cele integrate.

</details>

---

## Încearcă

| | |
|---|---|
| 🌐 **Aplicație Web** | [synalux.ai/prism-aac](https://synalux.ai/prism-aac) — încearcă în orice navigator |
| 📱 **iOS** | [App Store](https://apps.apple.com/app/id6764692277) — iPhone, iPad, Apple Watch |
| 💻 **Cod sursă** | Acest depozit. AGPL-3.0 — creează derivări liber, distribuie modificările |

---

## Planuri

Două planuri: **Gratuit (Free)** și **Prism AAC Cloud**. Fără perioadă de probă, fără card necesar pentru opțiunea Gratuită, fără taxe de depășire automate.

| | Gratuit | Prism AAC Cloud — 4,99 US$/lună |
|---|---|---|
| Tablouri de comunicare, tastatură și expresii salvate | ✅ | ✅ |
| Voci disponibile pe dispozitiv și vorbire din memoria cache | ✅ | ✅ |
| AI pe dispozitiv și comunicare de urgență | ✅ | ✅ |
| iOS + Web (PWA) | ✅ | ✅ |
| Vorbire cu voce naturală generată nou | neinclus (servit totuși gratuit pe ruta publică de vorbire până la începerea contorizării) | 50.000 de caractere / lună |
| Solicitări AI în cloud (chat, autocorecție, predicție, tutor) | — | 100 / lună |
| Resetarea resursei | — | Prima zi din fiecare lună, ora 00:00 UTC |

- Cumpărat în aplicația iOS (achiziție în aplicație Apple, StoreKit 2) sau pe web (Stripe); ambele oferă acces la același cont și un singur abonament activ per cont. Anularea pe un canal nu șterge abonamentul de pe celălalt.
- Redarea din memoria cache și vocea de pe dispozitiv nu consumă din resursă. Când resursa este epuizată, vorbirea din cloud și AI-ul din cloud se întrerup până la resetare — nimic din funcțiile de bază ale tablei nu este blocat vreodată.
- Setări → Cont Synalux → **Vorbire și AI în cloud** arată planul, resursa și termenii de reînnoire, cu opțiunile Abonează-te cu Apple, Restabilește achizițiile Apple, Gestionează abonamentul și Reîmprospătează planul cloud.
- Două inconsecvențe deschise, urmărite: (1) sporurile pentru predicția cuvintelor, furnizorii de Chat AAC, contactele îngrijitorilor, furnizorul SMS și datele complete de urgență depind de planul AAC pe care îl setează doar un abonament web (Stripe), astfel încât un abonat exclusiv Apple nu le primește; (2) pictagramele AI și instalările din piață depind de planul platformei Synalux, nu de planul AAC Cloud, astfel încât abonații Cloud de pe oricare dintre canale nu le primesc. Selectorul de voce și toate cele 12 jocuri sunt gratuite pentru toată lumea.

<p align="center">
  <img src="../../docs/screenshots/cloud-subscription-iphone.png" alt="Aplicația iOS: Setări → Cont Synalux → Vorbire și AI în cloud — resursă, termeni de reînnoire, Abonează-te cu Apple · $4.99/lună, Restabilește achizițiile Apple" width="260" />
  <img src="../../docs/screenshots/panel-account-cloud.png" alt="Aplicația Web: aceeași secțiune cu Abonează-te · 4,99 US$/lună prin Stripe" width="260" />
</p>

[Pagina de prețuri →](https://synalux.ai/pricing) · [Termeni](TERMS.md) · [Confidențialitate](PRIVACY.md)

---

## Siguranță clinică

- **Accesul AAC nu este restricționat niciodată ca o consecință.** Un copil trebuie să își păstreze întotdeauna vocea.
- **Fără date de sănătate (PHI) în cloud fără consimțământ.** Notele îngrijitorului se criptează înainte de încărcare.
- **Sunetul rămâne local.** Introducerea vocală se transcrie în browser prin Web Speech API.
- **Proiectat de terapeuți BCBA.** Urmărirea operantă verbală corespunde Listei de Sarcini BACB Ediția a 5-a.
- **Setări implicite bazate pe abordarea traumei.** Fără mecanică de pedeapsă. Magazinul de recompense este opțional.

Citește mai mult: [`ACCESSIBILITY.md`](ACCESSIBILITY.md), [`SECURITY.md`](SECURITY.md).

---

## Rezultatele Testelor

**5.139 de teste automatizate** verifică fiecare funcționalitate pe web, iOS, imagistică și redirecționare AI.

| Ce testăm | Teste | Rezultat |
|---|---|---|
| Aplicația web completă (componente, magazine, servicii) | 4.971 | ✅ trecut |
| Context vizual / cameră / detectare obiecte | 167 | ✅ trecut |
| Urmărire mână + precizie poziție corp | 54 | ✅ trecut |
| Redirecționare AI pe dispozitiv (Ollama în timp real) | 8 | ✅ trecut |
| iOS nativ (XCUITest) | 19 | ✅ trecut |
| Server Prism MCP | 2.679 | ✅ trecut |

**Precizia AI de pe dispozitiv** — cât de sigur alege aplicația acțiunea corectă pentru copilul tău:

| Dispozitiv | Model | Dimensiune | Precizie | Evaluare |
|---|---|---|---|---|
| **Apple Watch** | SmolLM2-360M | 207 MB | **100%** (300/300) | AAC clinic (extindere simboluri, urgență, predicție) |
| **Toate modelele iPhone** | Qwen3.5-4B Q3_K_M | 2.3 GB | **99.1%** (114/115 × 3 rulări) | Redirecționare instrumente BFCL |
| **iPhone Pro / iPad** | Qwen3.5-4B Q4_K_M | 3.4 GB | **100%** (115/115 × 3 rulări) | Redirecționare instrumente BFCL |
| **iPad Pro / Mac** | Prism-Coder 9B | 8.4 GB | **100%** (115/115 × 3 rulări) | Redirecționare instrumente BFCL |

<details>
<summary><strong>Ce înseamnă "precizie de redirecționare de 99.1%" în practică?</strong></summary>

AI-ul de pe dispozitiv decide ce acțiune să ia când copilul tău atinge un buton — salvează o notă, încarcă sesiunea, caută în istoric etc. Testăm acest lucru cu 115 scenarii reale amestecate de 3 ori. Modelul de 2.3 GB obține 114 din 115 corecte de fiecare dată. Singura ratare: tratează "scrie o expresie regulată" ca o căutare de cunoștințe în loc de un răspuns în text simplu — un caz izolat care nu apare niciodată în utilizarea AAC.

Spre comparație, modelul 2B anterior a obținut 90.4% (11 erori). Noul model are de 10 ori mai puține greșeli de redirecționare la aceeași dimensiune de descărcare.

</details>

---

## Infrastructură și GDPR

### Arhitectură multi-regiune

| Componentă | Regiune | Scop |
|---|---|---|
| **Supabase US** | US East (Virginia) | Bază de date principală — autentificare, date utilizator, note îngrijitor |
| **Supabase EU** | EU Central (Frankfurt) | Conform GDPR — datele utilizatorilor din UE nu părăsesc niciodată UE |
| **Vercel** | Global Edge | Aplicație web, rute API, CDN |
| **Inworld TTS** | US | Sinteză vocală neuronală |
| **HuggingFace Hub** | US/EU | Ponderi modele (2B, 4B, 14B, 32B) |
| **Pe dispozitiv** | Dispozitivul utilizatorului | Deducere llama.cpp (iPhone/iPad/Mac) |

### Conformitate GDPR

Datele utilizatorilor din UE sunt stocate exclusiv în regiunea Frankfurt (eu-central-1). Portalul detectează locația utilizatorului prin antetul Vercel `x-vercel-ip-country` și direcționează operațiunile din baza de date către instanța Supabase potrivită:

- **Utilizatori UE** → `supabase-eu` (Frankfurt) — date personale, autentificare, preferințe, note îngrijitor
- **Utilizatori non-UE** → `supabase-us` (Virginia) — aceleași categorii de date, jurisdicție SUA
- **Deducere AI** → pe dispozitiv (nicio dată nu părăsește dispozitivul) sau API Synalux (nicio dată de identificare personală stocată)
- **Sunet TTS** → generat pe server, transmis în flux către client, nestocat

**Garanții privind rezidența datelor:**
- Datele personale din UE nu tranzitează niciodată prin servere din SUA
- Jetoanele de autentificare sunt izolate la instanța regională Supabase
- Notele îngrijitorului sunt criptate la stocare (Supabase AES-256)
- Înregistrările vocale (Playerul de Confort) sunt stocate în IndexedDB din browser — nu sunt încărcate niciodată
- Modelul AI de pe dispozitiv rulează local — telemetrie zero în cloud

**Dreptul la ștergere:** Ștergerea utilizatorului se propagă în lanț pe autentificare, profiluri, note ale îngrijitorilor și analize de utilizare din baza de date regională. Instanțele găzduite propriu pot fi curățate cu `supabase db reset`.

### Costuri la scară

| Utilizatori | Supabase | Vercel | TTS | Modele AI | Total |
|---|---|---|---|---|---|
| 0–1K | $50/lună (2 regiuni) | $0 (Hobby) | ~$5/lună | $0 (pe dispozitiv) | ~$55/lună |
| 1K–10K | $50/lună | $20/lună (Pro) | ~$50/lună | $0 | ~$120/lună |
| 10K–100K | $50/lună + suplimente calcul | $20/lună | ~$200/lună | RunPod $125/lună | ~$395/lună |

---

## Modele AI și suport pentru dispozitive

Funcționează pe orice dispozitiv Apple. Dependență zero de cloud pentru comunicarea AAC de bază.

PrismAAC selectează automat cel mai bun model pe care hardware-ul tău îl poate rula, revine la opțiuni mai ușoare pe dispozitivele limitate și nu necesită niciodată o conexiune la internet pentru comunicarea de bază.

| Dispozitiv | RAM | Model | Precizie | AAC | Dimensiune | Cost |
|---|---|---|---|---|---|---|
| **iPad Pro M1/M2/M4** | 16 GB | 9B LoRA (v36) | **100%** | 100% | 8.4 GB | $0 |
| **iPhone 15/16 Pro, iPad Air** | 8 GB | 4B Q4_K_M (v36) → 2B (rezervă OOM) | **100%** | 100% | 4.7 GB / 1.1 GB | $0 |
| **iPhone 12–14, iPad-uri mai vechi** | <8 GB | 2B Q3_K_M (v43) | **99.1%** | 100% | 2.3 GB | $0 |
| **Mac M1+ prin WiFi** | 16+ GB | 9B/27B prin Ollama (v36) | **100%** | 100% | 8.4 GB | $0 |

### Cascadă aplicație web

Aplicația web încearcă mai întâi deducerea locală, apoi revine la cloud — astfel încât utilizatorii cu Ollama instalat plătesc $0, iar utilizatorii fără el beneficiază în continuare de funcționalitate completă.

<details>
<summary>Diagramă cascadă</summary>

```
  Utilizatorul trimite mesajul
        |
        v
  +-- OLLAMA LOCAL (detectat automat la localhost:11434) --+
  |                                                        |
  |   14b (100%, ~1.1s) ─[eșec]─> 8b (100%, ~0.8s) ─[eșec]─> 2b (100%, ~1.6s)
  +-------------------------------------------------------------------+
         |
    [toate cele locale eșuează?]
         |
         v
  +-- REZERVA CLOUD (API Synalux) ----------+
  |  Claude Sonnet 4 (plătit) / Gemini (gratuit) |
  |  Precizie 99%, ~3s                      |
  +-----------------------------------------+

  Încărcare automată: prima lansare detectează Ollama → descarcă cel mai bun model → local pentru totdeauna.
```

</details>

### Cascadă nativă iOS

Aplicația nativă verifică memoria RAM disponibilă la lansare, descarcă modelul potrivit din CDN-ul HuggingFace (o singură dată) și rulează deducerea prin llama.cpp Metal. Fără server. Fără abonament. Nicio dată nu părăsește dispozitivul.

<details>
<summary>Diagramă cascadă</summary>

```
  Lansare aplicație
      |
      v
  Detectare RAM (os_proc_available_memory)
      |
      +── 16 GB+ (iPad Pro) ──> 9B LoRA (8.4 GB) ──> 100%, ~1.1s
      |
      +── 8 GB (iPhone/iPad Air) ──> 4B Q4_K_M (4.7 GB) ──> 100%, ~0.8s
      |                                    |
      |                               OOM? → 2B Q4_K_M (1.1 GB) → 100%, ~1.6s
      |
      +── <8 GB ──> 2B Q4_K_M (1.1 GB) ──> 100%, ~1.6s

  Toate căile: llama.cpp Metal, $0 pentru totdeauna, nicio dată nu părăsește dispozitivul.
  Actualizare prin WiFi: Setări → AI Local → introdu IP-ul Mac-ului pentru 9B/27B.
```

</details>

### Moduri de aspect tastatură (păstrate)

Trei moduri se schimbe dintr-o singură atingere — aspectul ales este salvat și restaurat la fiecare lansare.

- **MAX KB** — tastatura umple tot spațiul de sub bara de predicție
- **MIN KB** — categorii 75% / tastatură 25%
- **HIDE KB** — categorii pe tot ecranul, tastatură ascunsă

<details>
<summary>Diagramă aspect</summary>

```
  MAX KB                 MIN KB                 HIDE KB
  +--------------------+ +--------------------+ +--------------------+
  | Bară instrumente   | | Bară instrumente   | | Bară instrumente   |
  | Bară predicție     | | Bară predicție     | | Mesaj întâmpinare  |
  |                    | |                    | |                    |
  |  TASTATURĂ         | | Categorii   (75%)  | | Categorii          |
  |  umple tot spațiul | |                    | | (tot ecranul)      |
  |  sub predicție     | |--------------------| |                    |
  |                    | | Tastatură   (25%)  | |                    |
  | [123][v][ spațiu ] | |                    | |                    |
  +--------------------+ +--------------------+ +--------------------+
        |                      |                      |
        +-- buton [v] -------->+-- buton lateral ---->+-- buton lateral --+
        |                                                               |
        +<--------------------------------------------------------------+
```

</details>

### Rezumat costuri

| Cale | Model | Precizie | Latență | Cost |
|---|---|---|---|---|
| iPad Pro 16GB | 9B LoRA (v36) | **100%** | ~1.1s | **$0** |
| iPhone/iPad 8GB | 4B Q4_K_M (v36) → 2B (rezervă OOM) | **100%** | ~0.8s | **$0** |
| Orice dispozitiv | 2B Q4_K_M (v42) | **100%** | ~1.6s | **$0** |
| WiFi către Mac | 9B/27B prin Ollama (v36) | **100%** | ~1.1s | **$0** |
| Cloud (gratuit) | Gemini 2.5 Flash | 99% | ~3s | Acoperit de Synalux |
| Cloud (plătit) | Claude Sonnet 4 | 99% | ~3s | Inclus în plan |

**Punctul forte:** Fiecare copil primește precizie de nivel Claude, indiferent dacă folosește un iPhone SE de $329 sau un iPad Pro de $2.000. Abordarea locală înseamnă dependență zero de cloud, taxe lunare API zero, expunere zero a datelor de sănătate (PHI) și timpi de răspuns sub o secundă. Flota prism-coder obține **99.1–100%** pe testul de referință pentru apelarea funcțiilor BFCL (medie pe 3 semințe, iunie 2026): 27B/9B/4B la 100%, 2B la 99.1%. Modelul 27B obține în plus 100% pe un test intern de evaluare a codării cu 15 probleme.

---

## Găzduire proprie

```bash
git clone https://github.com/dcostenco/prism-aac.git
cd prism-aac
npm install
npm run dev    # http://localhost:3000
```

Synalux operează versiunea oficială găzduită (gratuită + plătită). Persoanele care găzduiesc propriu și creează derivări trebuie să distribuie modificările sub licența AGPL-3.0.

### Modele AI locale (cost zero în cloud)

**Opțiunea A — În aplicație (recomandat):** Setări → 🤖 Modele AI Locale → apasă Descărcare lângă orice model. Include bară de progres. Funcționează de pe iPad/iPhone pe aceeași rețea WiFi cu un Mac ce rulează Ollama.

**Opțiunea B — Linie de comandă:**

Instalează [Ollama](https://ollama.com), apoi:

```bash
ollama pull dcostenco/prism-coder:2b   # 1.1 GB — orice echipament, iPhone 12+ — redirecționare 100% (v42)
ollama pull dcostenco/prism-coder:4b    # 4.7 GB — iPhone/iPad 8GB, Mac M1+ — redirecționare 100% (v36)
ollama pull dcostenco/prism-coder:9b   # 8.4 GB — Mac 16GB+, iPad Pro — redirecționare 100% (v36)
ollama pull dcostenco/prism-coder:27b   # 16 GB  — Mac M2 Ultra+ (MoE) — redirecționare 100% (v7)
```

Adaugă în `.env.local`: `LOCAL_LLM_URL=http://localhost:11434`

**iPad Pro / iPhone pe WiFi:**
```bash
OLLAMA_HOST=0.0.0.0 ollama serve   # pe Mac
# Apoi în Setări aplicație → AI Local → introdu: http://<ip-mac>:11434
```

Redirecționare automată: 2B → orice dispozitiv · 4B → mobil/verificator · 9B → standard · 27B → calitate/întreprindere. Rezervă în cloud când Ollama nu poate fi contactat.

---

<details>
<summary><strong>📚 Arhitectură tehnică (redirecționare modele, voce, recunoaștere gesturi, detalii compilare)</strong></summary>

**Tehnologii**: Next.js, Zustand, Web Speech API (transcriere), Inworld TTS-2 + rezervă Azure Neural (vorbire), FaceLandmarker (gesturi).

**Redirecționare modele** (pe server prin portalul Synalux):
- **Pe dispozitiv** (atingere buton → vorbire): `prism-coder:2b` (Qwen3-2B Q4_K_M, llama.cpp Metal) — rețea zero, cost zero, ~1.6s
- **Cloud simplu** (chat, nivel gratuit): `prism-coder:9b` (Qwen3-14B ajustat) → rezervă Gemini 2.5 Flash
- **Cloud complex** (raționament, nivel pro): `prism-coder:27b` (QwQ-32B ajustat) → rezervă Claude Sonnet 4
- **Autocorecție + predicție cuvinte**: Gemini 2.5 Flash-Lite — 752ms medie, multilingv (ro/ru/es)
- Căile critice pentru viteză (atingere buton → vorbire) ocolesc redirecționarea — nu blochează niciodată pe rețea
- Precizie de redirecționare ([evaluare Prism 102 cazuri](https://github.com/dcostenco/prism-coder/tree/main/tests/benchmarks/prism-routing-100), instrucțiune sistem v36/v7, medie 3 semințe, mai 2026):

  | Model | Precizie | Latență medie | Instrumente inventate |
  |---|---|---|---|
  | prism-coder:27b swe14 (local) | **100.0%** | 1.4s | 0 |
  | cascadă 14B→32B (local) | **100.0%** | ~1.1s | 0 |
  | prism-coder:4b v36 (local) | **100.0%** | 0.8s | 0 |
  | prism-coder:9b v36 (local) | **100.0%** | 1.1s | 0 |
  | Sonnet 4 (cloud) | **99%** | 3.2s | 0 |
  | Opus 4.7 (cloud) | **98.3%** | 3.0s | 0 |
  | prism-coder:2b v42 (local) | **100.0%** | 1.6s | 0 |

- Evaluare extinsă — eval_300 (300 cazuri, 17 instrumente, 9 categorii, 3 semințe): prism-coder:27b = **300/300 (100%)**

Lanț de rezervă **Voce (TTS)**:
- Nivelul 1: Inworld TTS-2 (plătit pentru toate limbile; gratuit pentru ro/uk/ru/de/ko/ar unde Synalux acoperă costul)
- Nivelul 2: OS Web Speech API voci premium (offline)
- Nivelul 3: WASM espeak-ng (ultima opțiune)

**Recunoaștere gesturi**:
- De bază: poziție cap + clic prin menținere prin FaceLandmarker
- Avansat: poziție mână prin MediaPipe; profiluri de gesturi per utilizator

**Arhitectură**: navigare doar prin ferestre modale (fără ruter), temă prin jetoane bg/text/border/accent.

**Documentație detaliată în acest depozit:**
- [`docs/TTS-ARCHITECTURE.md`](docs/TTS-ARCHITECTURE.md) — redirecționare completă a vorbirii
- [`docs/GESTURE_RECOGNITION.md`](docs/GESTURE_RECOGNITION.md) — detalii interne modul gesturi
- [`docs/ADAPTIVE-ENGINE-BEHAVIOR.md`](docs/ADAPTIVE-ENGINE-BEHAVIOR.md) — comutare automată a tonului
- [`docs/EMERGENCY-NATIVE-ARCHITECTURE.md`](docs/EMERGENCY-NATIVE-ARCHITECTURE.md) — cale de alertă critică pentru viață
- [`docs/SELF-LEARNING-SAFETY.md`](docs/SELF-LEARNING-SAFETY.md) — protecții de auto-învățare per utilizator
- [`docs/TRACKING_RELIABILITY.md`](docs/TRACKING_RELIABILITY.md) — cadru de fiabilitate pentru urmăritorul de cap/mână
- [`PRECISION_TOUCH.md`](PRECISION_TOUCH.md) — accesibilitate ținte de atingere
- [`ACCESSIBILITY.md`](ACCESSIBILITY.md) · [`SECURITY.md`](SECURITY.md) · [`GOVERNANCE.md`](GOVERNANCE.md) · [`AGENTS.md`](AGENTS.md)
- [`RESEARCH.md`](RESEARCH.md) — baza de dovezi
- [`CHANGELOG.md`](CHANGELOG.md) — istoricul versiunilor

</details>

<details>
<summary><strong>🆕 De ce PrismAAC este diferit (stiva de algoritmi subiacentă)</strong></summary>

**Trei lucruri pe care nicio altă aplicație AAC de pe piață nu le face împreună:**

### 1. AI pe dispozitiv — suportă garanțiile tehnice de protecție HIPAA

**De ce contează AI-ul local pentru AAC — viteză, securitate și fiabilitate:**

| | Doar AI în Cloud | PrismAAC (prioritar local) |
|--|---|---|
| Atingere buton → vorbire | 2–30s (dus-întors în rețea) | **~0.5s** (pe dispozitiv) |
| Funcționează offline | ❌ Nu | ✅ Da |
| Datele de sănătate părăsesc dispozitivul | ✅ Întotdeauna | ❌ Niciodată (calea de vorbire) |
| Suport HIPAA | Necesită BAA cu fiecare furnizor | **Rularea pe dispozitiv păstrează datele de sănătate local — ajută la îndeplinirea garanțiilor tehnice** |
| Zone rurale / WiFi slab | Necreata / Inutilizabil | **Complet funcțional** |
| Cost lunar per utilizator | $2–15 taxe API | **$0 (local)** |

**Modelul 2B rulează în întregime pe dispozitivul tău** — iPad M1+, Mac sau laptop. Un copil care apasă un buton primește un răspuns în ~500ms cu zero apeluri de rețea. Nicio dată de sănătate, enunț sau șablon de comunicare nu părăsește dispozitivul în timpul utilizării normale.

Notele îngrijitorilor se criptează local înainte de orice sincronizare opțională în cloud. Platformele AAC comparabile exclusiv cloud (TouchChat, sincronizarea cloud Proloquo2Go) necesită încărcări în cont pentru a funcționa — PrismAAC nu necesită acest lucru.

**Pentru implementări de întreprindere / clinice (9B + 27B):** modelele 9B și 27B rulează pe un Mac dedicat prin Ollama în rețeaua clinică. iPad-urile se conectează prin WiFi-ul local — datele nu părăsesc clădirea. Această arhitectură susține garanțiile tehnice de protecție HIPAA prin păstrarea datelor de sănătate în locație; conformitatea HIPAA este responsabilitatea entității acoperite care implementează sistemul și necesită propriile controale administrative, fizice și tehnice, plus acordurile BAA aplicabile.

**Cum se configurează:**

```
iPad / iPhone (pe același WiFi cu Mac-ul)
    ↓  se conectează la
Mac ce rulează Ollama (OLLAMA_HOST=0.0.0.0)
    ↓  deservește
prism-coder:2b · :14b · :32b
    ↓  toată deducerea rămâne pe
Rețeaua locală — nimic nu ajunge pe internet
```

Setări → 🤖 Modele AI Locale → introdu IP-ul Mac-ului → toate modelele sunt disponibile instantaneu. Cost zero în cloud. Expunere zero a datelor de sănătate. Nicio dependență de rețea pentru comunicarea AAC.

### 2. Clasificare expresii ce se adaptează copilului TĂU
Listele statice de frecvență sunt depășite. PrismAAC clasifică expresiile sugerate prin [**activarea extinsă Prism v14.0.0**](https://github.com/dcostenco/prism-coder/blob/main/docs/WOW_FEATURES.md) — același model cognitiv de memorie ACT-R aflat în spatele deceniilor de cercetare de la Universitatea Carnegie Mellon. Recență × frecvență × istoric per utilizator, nu o listă statică de popularitate. Expresiile pe care copilul le spune astăzi urcă; cele neutilizate timp de un an își pierd din vizibilitate (scădere a ratei de învățare `d=0.25`, timp de înjumătățire ~1 an).

### 3. Corecțiile îngrijitorului devin date de antrenament — automat
Când un îngrijitor corectează o sugestie pe care modelul a greșit-o (de ex. "nu, cuvântul este *mănânc*, nu *vreau*"), [colectorul post-lansare din audit-hooks](https://github.com/dcostenco/prism-coder/blob/main/docs/WOW_FEATURES.md#7-the-recipe-combining-all-of-the-above) extrage greșeala și o salvează. După ~50 de sesiuni, sistemul avertizează *înainte* ca modelul să facă o greșeală similară. Fără muncă de etichetare pentru îngrijitori, fără rulări scumpe de reantrenare — corecțiile reprezintă programa de învățare.

**Domeniu de aplicare transparent:** Precizia de redirecționare pe [evaluarea Prism de 115 cazuri](https://github.com/dcostenco/prism-coder/tree/main/tests/benchmarks/prism-routing-100) (7 instrumente Prism, 12 categorii, medie pe 3 semințe, iunie 2026): 27b = 100.0%, 9b = 100.0%, 4b = 100.0%, 2b = 99.1%. Nume de instrumente inventate zero pe toate dimensiunile de modele și toate semințele. Modelul 2B rulează pe dispozitiv pentru redirecționarea rapidă a expresiilor; modelele 9B/27B gestionează sesiunile complexe și fluxurile de lucru clinice prin WiFi către Mac. Pe clasamentul complet Berkeley BFCL V4 (peste 2.000 de cazuri generale de apelare a funcțiilor), modelul 2B obține ~59% — comparabil cu alte modele sub 2B. Ceea ce face ca PrismAAC să fie sustenabil nu este doar scorul modelului — ci modelul plus stiva de algoritmi de activare extinsă Prism ce îl înconjoară.

</details>

---

## Pentru dezvoltatori

```bash
npm install && npm run dev   # http://localhost:3000/prism-aac
npm run test                 # 4900+ teste unitare
npm run e2e                  # Playwright pe 11 profiluri de dispozitive
```

### Monitorizare

| Tablou de bord | Ce urmărește |
|-----------|---------------|
| [Prism AAC — User Analytics](https://app.datadoghq.com/dashboard/shk-8fb-qjk/prism-aac--user-analytics) | Sesiuni, erori, predicții de cuvinte, atingeri de expresii, evenimente de vorbire, limbi, țări, dispozitive, planuri de facturare, telemetrie urmărire cap |

Integrare Datadog RUM: vezi `lib/datadog.ts` + `components/DatadogInit.tsx`. 7 teste de performanță e2e în `e2e/datadog-integration.spec.ts`.

---

## Licență

[AGPL-3.0](LICENSE) — sursă deschisă, aprobată OSI, eligibilă pentru granturi.

Ești liber să creezi derivări și să găzduiești pe propriul server. Licența îți impune să distribuie modificările tot sub licența AGPL-3.0 — aceasta este înțelegerea care păstrează inovația AAC deschisă și accesibilă familiilor.

© 2024–2026 Synalux LLC
