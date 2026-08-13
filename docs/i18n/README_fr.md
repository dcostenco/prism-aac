<!-- Auto-generated from README.md by scripts/generate_i18n.py — do not edit manually -->
# Prism AAC

**Aidez les enfants non-verbaux à parler.**

Application de Communication Améliorée et Alternative (CAA) pour les enfants ayant des troubles moteurs et des besoins complexes en communication. Touchez des images, construisez des phrases, et entendez-les prononcées à voix haute — en 23 langues. Fonctionne sur n'importe quelle tablette, ordinateur portable, iPhone, iPad et Apple Watch.

Fait partie de la [plateforme Synalux](https://synalux.ai).

🌐 [English](../../README.md) · [Español](README_es.md) · **Français** · [Português](README_pt.md) · [Română](README_ro.md) · [Українська](README_uk.md) · [Русский](README_ru.md) · [Deutsch](README_de.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [中文](README_zh.md) · [العربية](README_ar.md)

<p align="center">
  <a href="https://apps.apple.com/app/id6764692277"><img src="https://img.shields.io/badge/App_Store-Download-0D96F6?style=for-the-badge&logo=apple&logoColor=white" alt="App Store"></a>
  <a href="https://synalux.ai/prism-aac"><img src="https://img.shields.io/badge/Try_It-Free-43e97b?style=for-the-badge" alt="Try Free"></a>
  <a href="https://synalux.ai/pricing"><img src="https://img.shields.io/badge/Plans-Free_+_Paid-764ba2?style=for-the-badge" alt="Pricing"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue?style=for-the-badge" alt="AGPL-3.0"></a>
  <a href="PRIVACY.md"><img src="https://img.shields.io/badge/Privacy-Policy-lightgrey?style=for-the-badge" alt="Privacy"></a>
  <a href="TERMS.md"><img src="https://img.shields.io/badge/Terms-of_Service-lightgrey?style=for-the-badge" alt="Terms"></a>
</p>

![Prism AAC main screen — toolbar, schedule banner, type-here bar, prediction tiles, and qwerty keyboard](../../docs/screenshots/app-hero.png)

### Applications natives

<p align="center">
  <img src="../../docs/screenshots/ios-iphone.png" alt="PrismAAC sur iPhone" width="220" />
  <img src="../../docs/screenshots/ios-ipad.png" alt="PrismAAC sur iPad" width="360" />
  <img src="../../docs/screenshots/watch-ultra.png" alt="PrismAAC sur Apple Watch Ultra" width="120" />
</p>

| Plateforme | Statut | IA embarquée | Notes |
|----------|--------|-------------|-------|
| **Web** (PWA) | Production | Télécharge automatiquement le meilleur modèle local | Tout navigateur, installable |
| **iPad Pro 16 Go** | Production | IA embarquée (14B) | Rapide, privée, sélectionnée automatiquement par la RAM |
| **iPhone / iPad 8 Go** | Production | IA embarquée (8B → repli 1.7B) | Réduit automatiquement la taille pour s'adapter à l'appareil |
| **iPhone / iPad <8 Go** | Production | IA embarquée (1.7B) | S'adapte toujours, 1.1 Go |
| **Apple Watch** | Production | Dictionnaire de phrases hors ligne (1 261 × 20 langues) | Autonome — pictogrammes, TTS, urgence |
| **Extension Chrome** | Production | — | Assistant de lecture dans n'importe quel champ de texte |
| **WiFi vers Mac** | Production | 14B/32B via Ollama | Réglages → IA locale → entrer l'IP du Mac |

---

## Vidéo de prévisualisation de l'App Store

Vidéo de 30 secondes présentant toutes les fonctionnalités majeures avec narration TTS Inworld :

https://github.com/dcostenco/synalux-docs/releases/download/v1.0-module-videos/prism_aac_preview_v5.mp4

| Scène | Fonctionnalité | Capture d'écran |
|---|---|---|
| **Accueil** — toucher les phrases | Tableau de pictogrammes avec 22 catégories, bouton Parler | <img src="../../docs/screenshots/appstore/ipad_home.png" width="200"> |
| **Catégories** | Phrases rapides pour Aide, Nourriture, Lieux, Sentiments | <img src="../../docs/screenshots/appstore/ipad_categories.png" width="200"> |
| **Chat IA** | Composer des messages, pratiquer des conversations | <img src="../../docs/screenshots/appstore/ipad_ai-chat.png" width="200"> |
| **Alerte d'urgence** | Appel de l'aidant/infirmière en un seul toucher | <img src="../../docs/screenshots/appstore/video/frame_03.png" width="200"> |
| **Emploi du temps** | Routines visuelles quotidiennes — matin, école, déjeuner, coucher | <img src="../../docs/screenshots/appstore/ipad_schedule.png" width="200"> |
| **Jeux** | Bubble Pop, Color Hunt, Match It, Yes/No, Finish It | <img src="../../docs/screenshots/appstore/ipad_games.png" width="200"> |
| **Maths & École** | Mathématiques adaptatives avec Indice, Vérifier, Résoudre + pavé numérique | <img src="../../docs/screenshots/appstore/video/frame_06.png" width="200"> |
| **Suivi de la tête et des yeux** | Curseur par fixation oculaire basé sur la caméra, contrôle du regard, calibration | <img src="../../docs/screenshots/appstore/video/frame_07.png" width="200"> |
| **12 Langues** | Anglais, Espagnol, Français, Russe, Japonais, Coréen, Chinois, Arabe et plus | <img src="../../docs/screenshots/appstore/video/frame_08.png" width="200"> |

---

## En un coup d'œil

| Module | Ce qu'il fait | Aperçu |
|---|---|---|
| 📂 **Catégories** | Tuiles d'images de style PECS pour les non-lecteurs | <img src="../../docs/screenshots/panel-categories.png" width="120"> |
| ⌨️ **Taper et parler** | Clavier + prédiction de mots + voix neuronale | <img src="../../docs/screenshots/app-hero.png" width="120"> |
| ✨ **Chat IA** | Assistant embarqué + cloud optimisé pour les utilisateurs de CAA | <img src="../../docs/screenshots/panel-ai-chat.png" width="120"> |
| 💬 **Chat CAA** | Messages entrants des aidants + contacts | <img src="../../docs/screenshots/panel-aac-chat.png" width="120"> |
| 🧮 **Maths + matières** | Canevas en grille de cellules avec tuteur conscient du domaine | <img src="../../docs/screenshots/math-canvas-typed.png" width="120"> |
| 🗓 **Emploi du temps** | Routines visuelles "d'abord-ensuite" | <img src="../../docs/screenshots/panel-schedule.png" width="120"> |
| 🎮 **Jeux** | 12 jeux de CAA thérapeutiques | <img src="../../docs/screenshots/panel-games.png" width="120"> |
| 🏪 **Place de marché** | Packs vocaux, packs de vocabulaire, packs de jeux | <img src="../../docs/screenshots/panel-marketplace.png" width="120"> |
| 🎧 **Lecteur de confort** | Lecteur multimédia de chevet pour les patients hospitalisés | <img src="../../docs/screenshots/panel-comfort-player.png" width="120"> |
| 🛏 **Mode Chevet** | Chat IA plein écran pour utilisation avec téléphone sur support / en position allongée | <img src="../../e2e/_screenshots/bedside-overlay-open.png" width="120"> |
| 👋 **Mains libres** | Reconnaissance des gestes de la tête et des mains | <img src="../../docs/screenshots/panel-settings-input-modes.png" width="120"> |
| ⚙️ **Réglages** | 23 langues, adaptations motrices, niveau de forfait | <img src="../../docs/screenshots/panel-settings.png" width="120"> |

---

## Alternative gratuite à Read & Write

PrismAAC intègre gratuitement toutes les fonctionnalités d'aide à la lecture pour lesquelles la plupart des utilisateurs de CAA achètent Read & Write — dans le navigateur, sans compte requis pour le niveau web. Voir [Taper et parler](#%EF%B8%8F-taper--parler) pour la prononciation en fin de phrase + le surlignage de mots, [Lecteur PDF](#-lecteur-pdf) et [Lecteur de captures d'écran (OCR)](#-lecteur-de-captures-d%C3%A9cran-ocr) pour les documents, et l'[extension Chrome](#-extension-chrome--m%C3%AAmes-fonctionnalit%C3%A9s-d%27aide-%C3%A0-la-lecture-dans-n%27importe-quel-champ-de-texte) pour une couverture multi-applications dans Gmail / Docs / Word Online / partout ailleurs.

## Comparaison de PrismAAC

| | PrismAAC | TouchChat | Proloquo2Go | LAMP Words | TD Snap | CoughDrop | Snap Core First | Grid 3 | Tobii Dynavox |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Chemin de parole **embarqué + HIPAA-sûr** | ✅ | ❌ | ❌ | ❌ | partiel | partiel | ❌ | ❌ | partiel |
| **Classement de phrases par utilisateur** (s'adapte à chaque enfant) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Les corrections des aidants **deviennent automatiquement des données d'entraînement** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Tuteur IA conscient du domaine** (maths + 10 autres matières) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Canevas mathématique en grille de cellules** (pas de LaTeX, pas de tableau blanc) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Historique sensible à la locale + à la région** (280+ régions) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Mode gestuel **mains libres** (tête + mains) | ✅ | partiel | partiel | ❌ | ✅ | partiel | partiel | ✅ | ✅ |
| **Chat IA mains libres** (boucle vocale + mot d'activation + superposition de chevet) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Jeux de CAA thérapeutiques** intégrés | ✅ (12) | ❌ | ❌ | ❌ | ❌ | partiel | partiel | ❌ | ❌ |
| **Open source** (AGPL-3.0) | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Niveau gratuit** pour l'accès à la sécurité vitale | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Place de marché** de packs vocaux | ✅ | ❌ | partiel | ❌ | partiel | ❌ | ❌ | partiel | partiel |
| **Multi-langues** (23) | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Notes des aidants** qui voyagent maison / école / clinique | ✅ | ❌ | ❌ | ❌ | partiel | partiel | partiel | ❌ | partiel |
| Mode autonome **Apple Watch** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Assistant de lecture **Extension Chrome** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

> La comparaison reflète les informations produit publiquement disponibles au 2026-05. PrismAAC est activement développé ; les concurrents peuvent ajouter des fonctionnalités au fil du temps. Les PR sont les bienvenues pour maintenir cette honnêteté — voir `CONTRIBUTING.md`.
>
> Grid 3 et Tobii Dynavox ont de fortes intégrations matérielles de suivi oculaire + balayage par commutateur non reflétées ci-dessus (dépendantes du matériel, configurations de cliniques spécialisées).

---

## iOS & Apple Watch

### iPhone / iPad

Application Swift native enveloppant l'interface utilisateur web dans WKWebView + IA embarquée via llama.cpp Metal. Sélectionne automatiquement le meilleur modèle en fonction de la RAM de l'appareil :

| Appareil | RAM | Modèle | Téléchargement |
|---|---|---|---|
| iPad Pro M1/M2/M4 | 16 Go | 14B Q4_K_M | 8.4 Go depuis HF CDN |
| iPhone 15/16 Pro, iPad Air | 8 Go | 8B Q4_K_M → 1.7B (repli OOM) | 4.7 Go / 1.1 Go |
| iPhone 12-14, anciens iPads | <8 Go | 1.7B Q4_K_M | 1.1 Go |

Sécurité à trois niveaux : filtre de crise synchrone → IA embarquée → repli cloud. La gestion de la mémoire se dégrade gracieusement : IA complète → IA cloud → mode cœur uniquement → mode urgence.

- Zone de sécurité pour Dynamic Island / encoche
- Pont WCSession pour l'envoi d'urgence Apple Watch
- Jetons d'authentification sauvegardés par Keychain
- Repli OOM : si le modèle plus grand ne tient pas, charge automatiquement le modèle plus petit suivant

**Réglages → 🤖 Modèles IA locaux** — téléchargez et gérez les modèles Prism :
- Détecte automatiquement Ollama à `localhost:11434`
- Connexions WiFi : iPad/iPhone → Mac Ollama (14B/32B à pleine précision)
- Téléchargement par modèle avec barre de progression en direct
- Modèles : `:1b7` (1.1 Go) · `:8b` (4.7 Go) · `:14b` (8.4 Go) · `:32b` (16 Go)

### Apple Watch (autonome)

Fonctionne sans iPhone — autonome avec dictionnaire de phrases hors ligne.

<p align="center">
  <img src="../../docs/screenshots/watch-series.png" alt="Watch Series 11" width="140" />
  <img src="../../docs/screenshots/watch-ultra.png" alt="Watch Ultra 3" width="140" />
</p>

- **Traduction hors ligne :** 1 261 phrases × 20 langues incluses (JSON de 411 Ko) — recherche instantanée, 100 % précise, pas de réseau
- Grille de pictogrammes à 2 colonnes avec images ARASAAC
- Chat IA avec dictée + saisie au clavier (cloud en ligne, dictionnaire de phrases hors ligne)
- Système d'urgence : compte à rebours → WCSession → repli cellulaire → TTS
- Traduction avec sortie TTS (dictionnaire hors ligne d'abord, repli cloud)
- Boîte de réception : recevoir et répondre aux messages des aidants
- Épinglage de certificat (SPKI SHA-256) lors de l'envoi d'urgence
- Assainissement NFKC + injection de 23 jetons sur tous les chemins IA

---

## Modules

### 📂 Catégories
Tuiles d'images de style PECS. Touchez une catégorie, touchez une tuile, entendez le mot, regardez-le atterrir dans la barre de message. Fonctionne pour les non-lecteurs, les pré-lecteurs et les communicants émergents. Les ensembles de tuiles et leur ordre se personnalisent au fil du temps via l'activation diffuse — les tuiles que votre enfant touche le plus remontent ; celles inutilisées pendant des mois s'estompent.

**Disposition en mode surround** — les catégories apparaissent dans une colonne de gauche défilante à côté du clavier, de sorte que l'utilisateur de CAA peut toucher les tuiles d'images ET taper simultanément sans changer de mode. La barre de prédiction reste visible ; les deux entrées sont toujours accessibles.

![Categories in surround mode — scrollable category cards on the left, full keyboard on the right](../../docs/screenshots/categories-surround-v2.png)

<details>
<summary><strong>Fonctionnalités + détails techniques</strong></summary>

- 22 catégories par défaut : personnes, nourriture, sentiments, corps, vêtements, animaux, lieux, etc.
- L'aidant peut ajouter / supprimer / réorganiser les tuiles par enfant
- Chaque tuile porte une `textKey` pour l'i18n — changer la langue de l'application réétiquette chaque tuile en un seul toucher
- Les pictogrammes des tuiles proviennent d'ARASAAC + un ensemble sélectionné ; le clonage de voix vous permet de faire correspondre la voix de la tuile à celle des frères et sœurs ou des parents de l'enfant (niveau payant)
- Apprentissage par n-grammes par utilisateur : un enfant qui touche "Je veux manger" trois fois verra "manger" remonter après "veux" lors de la session suivante
- Mémoire holographique HRR : prédictions contextuelles sans recherche en ~0.2 ms via Rust WASM — +27 % de précision Top-1 sur les phrases CAA de base

**Chemin de rendu :** `components/CategoryPanel.tsx` → `useCategoryStore` → tuiles dessinées à partir de `constants/phrases.ts` (système) + remplacements par utilisateur Supabase (payant). Les touches de tuiles invoquent `messageStore.appendText(phrase)` et sont acheminées via `aacSpeak()` pour le TTS.
</details>

---

### ⌨️ Taper et parler
Clavier à l'écran avec **prédiction de mots**, **complétion automatique par IA**, et un bouton **Parler** en un seul toucher qui lit la barre de message à voix haute avec une voix neuronale naturelle. La saisie enseigne au moteur de prédiction : les mots que votre enfant tape le plus souvent apparaissent plus tôt lors de la session suivante.

![Prism AAC keyboard with "hello" typed, prediction tiles, and Speak button](../../docs/screenshots/keyboard-typing.png)

**Fonctionnalités d'aide à la lecture (parité Read & Write)** — pour les utilisateurs ayant des besoins en lecture / mémoire / cognitifs :

- **Prononcer mot par mot** — chaque mot est répété par le TTS dès que vous touchez la barre d'espace, de sorte que vous entendez ce que vous avez tapé sans attendre la phrase complète.
- **Prononcer la phrase sur `.?!`** — terminer une phrase par un point, un point d'interrogation ou un point d'exclamation relit toute la phrase afin que vous ne perdiez pas le fil de ce que vous avez écrit (le problème qui disqualifie NVDA pour les utilisateurs voyants ayant des troubles cognitifs). Activable via Réglages → `speakOnSentenceEnd` (activé par défaut).
- **Surlignage mot par mot pendant la prononciation** — chaque mot prononcé s'illumine avec un fond jaune pendant que le TTS le lit. Les utilisateurs voyants ayant des troubles de la lecture peuvent suivre visuellement ; le surlignage suit l'audio sans nécessiter de dispositif matériel spécial.

<details>
<summary><strong>Fonctionnalités + détails techniques</strong></summary>

- 5 emplacements de prédiction au-dessus du clavier qwerty, rafraîchis à chaque frappe
- Complétion IA ("hw" → "how", "togoso" → "to go so") via Synalux `text/correct` (Gemini 2.5 Flash-Lite, ~752 ms en moyenne, 4.3 fois moins cher que 2.5 Flash)
- Porte inter-langues : le RO `eu` ne fuira pas dans la barre EN même lorsque les deux corpus sont chargés (comparaison de fréquence inter-corpus)
- "Parler" lit avec adaptation automatique de la tonalité (déclarative / interrogative / exclamative inférée de la ponctuation)
- Niveau de voix 1 : Inworld TTS-2 (naturelle/neuronale, toutes les 23 langues de l'application) ; niveau 2 : OS Web Speech (hors ligne, native à l'appareil) ; niveau 3 : WASM espeak-ng (dernier recours)
- Le surlignage de mots est estimé en durée (~60 ms/caractère à un débit de 0.5, s'adapte avec le curseur de débit) — fonctionne sur tous les niveaux TTS sans modifications backend ; la synchronisation précise via Azure `wordBoundary` est une future fonctionnalité Pro.
- Corpus n-grammes SQLite de 1.5 Mo par langue ; unigrammes + bigrammes + trigrammes ; chargé paresseusement lors du changement de langue
- **Mémoire contextuelle HRR** — récupération holographique sans recherche (Rust WASM de 229 Ko) qui apprend de chaque phrase prononcée. Encode les bigrammes + trigrammes dans un vecteur holographique ; sonde en ~0.2 ms à chaque frappe. Couche additive — améliore les 2 premières tuiles de prédiction avec des correspondances contextuelles sans supprimer les prédictions du corpus.

**Benchmark de prédiction HRR** (54 tests unitaires + suite de précision de 10 scénarios) :

| Scénario | Top-1 de base | Top-1 HRR+ | Gain | MRR de base | MRR HRR+ | Gain MRR |
|----------|---------------|------------|------|-------------|---------|----------|
| Phrases CAA de base (1x) | 36.7% | 46.7% | **+27.3%** | 0.634 | 0.672 | +6.0% |
| Phrases CAA de base (5x par jour) | 36.7% | 46.7% | **+27.3%** | 0.634 | 0.672 | +6.0% |
| Vocabulaire personnel | 70.4% | 81.5% | **+15.8%** | 0.809 | 0.883 | +9.2% |
| Mixte (toutes phrases) | 47.2% | 56.9% | **+20.6%** | 0.669 | 0.707 | +5.7% |
| Rappel inter-session | 80.0% | 80.0% | +0.0% | 0.900 | 0.900 | +0.0% |
| Préfixes ambigus | 66.7% | 66.7% | +0.0% | 0.738 | 0.738 | +0.0% |

Top-1 = mot correct est la tuile #1. Top-5 = mot correct dans n'importe quelle tuile. MRR = Rang Réciproque Moyen (plus élevé = mot correct apparaît plus tôt). HRR ne réduit jamais la précision Top-5 dans aucun scénario — aucune régression. Les plus grands gains sur le vocabulaire personnel (+9.2 % MRR) et les phrases CAA de base (+27.3 % Top-1).

**Chemin de rendu :** `components/Keyboard.tsx` → `messageStore.appendChar` → `predictionStore.updatePredictions(text, lang)` → `engine/predictionEngine.ts` (récence × fréquence × boost n-gramme) + superposition IA optionnelle `services/textCorrectService.ts` + sonde bigramme/trigramme HRR `services/hrrContext.ts`. Surlignage : `services/aacSpeak.ts` émet des événements `tts-highlight-start` sur le `ttsHighlightBus` ; `components/MessageBar.tsx` s'abonne et passe `activeWordIndex` à `ColoredText`.
</details>

---

### ✨ Chat IA
Assistant embarqué + cloud optimisé pour la voix de l'utilisateur de CAA. Réponses en continu, chaque ligne peut être touchée pour être insérée dans la barre de message afin que la paternité reste à l'enfant. Le niveau gratuit passe par Gemini 2.5 Flash ; les niveaux payants sont acheminés vers Claude Sonnet 4 avec la flotte prism-coder pour les requêtes courtes.

**Mode IA épuré** — la barre de prédiction de mots se masque automatiquement lorsque le Chat IA est ouvert (les prédictions sont non pertinentes lors de la composition d'une question), gardant l'attention sur la réponse de l'IA et le bouton d'envoi.

**Chat IA mains libres** — activez le bouton 🔁 dans l'en-tête du chat pour entrer dans une boucle vocale continue : le micro s'ouvre automatiquement après chaque réponse de l'IA, afin que l'enfant puisse avoir une conversation complète sans toucher l'écran. Une barre d'état sous l'en-tête du chat confirme que le mode est activé.

**Mode traduction** — lorsque la langue de l'application et la langue de sortie diffèrent (par exemple, entrée en portugais, sortie en anglais), chaque échange IA est automatiquement acheminé via le chemin de traduction avec le streaming activé, de sorte qu'il n'y a pas de pénalité de vitesse par rapport au mode monolingue.

![AI Chat panel — prediction bar hidden in AI mode, full keyboard accessible below](../../docs/screenshots/panel-ai-chat-v2.png)

<details>
<summary><strong>Fonctionnalités + détails techniques</strong></summary>

- Panneau intégré ancré au-dessus du clavier — jamais un modal qui masque la barre de message
- Saisie vocale via l'API Web Speech ; le bouton micro affiche la transcription intermédiaire en direct
- Touchez n'importe quelle ligne IA pour la copier dans la barre de message (préserve la paternité — Valencia et al., CHI 2023)
- **Boucle mains libres** — bouton d'en-tête 🔁 ; redémarre automatiquement le micro 1 s après la fin de chaque réponse IA ; `aria-pressed` + fond vert confirment l'état ; barre d'état sous l'en-tête lorsqu'actif
- **Mot d'activation "Hey Prism"** — disponible dans la superposition du mode Chevet ; une session `SpeechRecognition` continue détecte la phrase et déclenche le micro ; non disponible lorsque le pont natif iOS possède la session audio
- Délai d'attente strict de 15 s côté client + bouton Réessayer (pour que le panneau ne reste pas bloqué sur "Réflexion…" si le réseau tombe)
- 401 / réseau / délai d'attente / autre → mappage d'erreurs convivial ; n'affiche jamais "Session expirée" brut
- Repli Ollama local (`prism-coder:1b7`) hors ligne ; le contenu mixte est bloqué de l'origine du navigateur `synalux.ai` en pratique, donc l'erreur conviviale se déclenche

**Chemin de rendu :** `components/AIChatPanel.tsx` → `services/aiService.askAI()` (ou `translateAI()` en mode traduction) → flux SSE depuis Synalux `/api/v1/chat` avec `credentials: 'include'`. CORS autorise `synalux.ai` + origines de développement localhost.
</details>

---

### 🛏 Mode Chevet

> **Fonctionnalité d'accessibilité critique.** Le mode Chevet existe parce que certains utilisateurs n'ont aucun moyen fiable de parler, de taper ou de toucher un écran. La conception doit d'abord fonctionner pour le cas le plus difficile : un patient allongé dans un lit de soins intensifs, les bras le long du corps, sous ventilation, incapable de produire le moindre son — communiquant uniquement par le regard oculaire ou un seul commutateur matériel tenu entre deux doigts.

Superposition de communication IA plein écran optimisée pour les utilisateurs qui ne peuvent pas atteindre l'écran ou parler de manière fiable. Chaque cible de toucher est surdimensionnée. La voix est un chemin d'entrée parmi plusieurs — pas le seul. L'interface est entièrement utilisable via une technologie d'assistance : balayage par commutateur, regard oculaire, Contrôle vocal iOS, suivi de la tête ou un clavier à l'écran navigué avec un seul commutateur.

Inspiré par les retours directs de la communauté CAA (r/AssistiveTechnology, mai 2025) d'utilisateurs communiquant depuis des lits d'hôpital, en récupération post-chirurgicale et en soins palliatifs.

**Fonctionne-t-il sur Mac / Windows ?** Oui. Le mode Chevet est une fonctionnalité d'application web progressive — il fonctionne dans n'importe quel navigateur sur n'importe quel appareil. Il n'est pas réservé à iOS.

---

#### À qui s'adresse-t-il ?

Le mode Chevet est conçu pour les utilisateurs ayant un large éventail de capacités motrices et vocales. Les Cartes de Phrases Rapides (décrites ci-dessous) sont spécifiquement conçues pour les utilisateurs les plus sévèrement atteints — ceux qui ne peuvent pas parler du tout et ont des mouvements de main très limités ou inexistants.

| Profil d'utilisateur | Méthode de saisie recommandée |
|---|---|
| Peut parler, bras restreints | Voix (🎙 bouton micro) + boucle Mains Libres |
| Vocalisation partielle, parole peu fiable | Mot d'activation "Hey Prism" + boucle Mains Libres |
| Pas de parole, peut toucher l'écran | Cartes de Phrases Rapides (simple toucher) |
| Pas de parole, motricité limitée — un commutateur | Balayage par Contrôle de commutateur iOS ou Accès par commutateur Android sur les Cartes de Phrases Rapides |
| Pas de parole, pas de mouvement des mains — dispositif de suivi oculaire | Le matériel de suivi oculaire (Tobii, EyeGaze Edge, etc.) se présente comme un pointeur de souris — toutes les cartes sont navigables |
| Pas de parole, peut bouger la tête | Suivi de la tête (par exemple, Pointeur de tête iOS, Contrôle de la caméra sur iPhone 16) — les cartes sont des cibles de navigation pleine taille |
| Trachéotomie / sous ventilation, pas de vocalisation | Cartes de Phrases Rapides via le regard oculaire ou le commutateur + mode assisté par l'aidant |

---

#### Support de la plateforme

| Plateforme | Mode Chevet | Cartes Rapides | Boucle Mains Libres 🔁 | Mot d'activation 🎯 |
|---|:---:|:---:|:---:|:---:|
| Web — Mac / Windows / Linux (tout navigateur) | ✅ | ✅ | ✅ | ✅ |
| Web — iPhone / iPad (Safari) | ✅ | ✅ | ✅ | ⚠️ Safari uniquement |
| Application native iOS (App Store) | ✅ | ✅ | ✅ | ❌ utiliser Mains Libres |
| Android (Chrome / Edge) | ✅ | ✅ | ✅ | ✅ |
| Dispositif de suivi oculaire (tout — se présente comme une souris) | ✅ | ✅ | ✅ | ✅ |
| Balayage par commutateur (Contrôle de commutateur iOS) | ✅ | ✅ | ✅ | ❌ |
| Apple Watch | ❌ | ❌ | ❌ | ❌ |

> **Pourquoi pas de mot d'activation dans l'application native iOS ?** Le pont natif prend possession de la session audio (`prismNativeBridge.startVoice`), ce qui entre en conflit avec l'API `SpeechRecognition` du navigateur utilisée par le service de mot d'activation. Utilisez plutôt la **boucle Mains Libres** (🔁) — elle redémarre automatiquement le micro 1 seconde après chaque réponse de l'IA sans nécessiter de saisie continue.

---

#### Comment démarrer

1.  Ouvrez le panneau **Chat IA** — touchez l'icône 🤖 dans la barre d'outils.
2.  Touchez **🛏** dans l'en-tête du panneau — la superposition plein écran s'ouvre immédiatement.
3.  Choisissez votre méthode de saisie (voir les sections ci-dessous).

<p align="center">
  <img src="../../e2e/_screenshots/bedside-overlay-open.png" alt="Superposition du mode Chevet ouverte — interface utilisateur noire plein écran. La bande supérieure affiche les Cartes de Phrases Rapides. La zone centrale affiche les réponses de l'IA. Le bas affiche un grand bouton micro rouge et une rangée de commandes." width="260">
  <img src="../../e2e/_screenshots/bedside-overlay-handsfree-on.png" alt="Mode Chevet avec Mains Libres actif — bouton 🔁 surligné en vert, texte d'état 'Mains Libres ON' visible" width="260">
  <img src="../../e2e/_screenshots/bedside-hands-free-on.png" alt="Bouton de basculement Mains Libres à l'état activé — fond vert, aria-pressed=true" width="260">
</p>

#### Comment arrêter / quitter

-   **Toucher / taper :** touchez **✕** dans le coin supérieur droit de la superposition (cible de 48 × 48 px).
-   **Clavier / commutateur :** appuyez sur **Échap**.
-   **Voix :** prononcez n'importe quelle commande via le Contrôle vocal iOS pendant que la superposition est ouverte.

Votre historique de chat complet et l'état de la session IA sont préservés lorsque vous quittez. La superposition se trouve au-dessus du panneau principal en tant que couche de rendu séparée — rien n'est perdu lorsque vous la fermez.

<p align="center">
  <img src="../../e2e/_screenshots/bedside-overlay-closed.png" alt="Après avoir fermé le mode Chevet — retour au panneau de chat IA principal avec l'historique de conversation intact" width="260">
  <img src="../../e2e/_screenshots/bedside-wakeword-statusbar.png" alt="Barre d'état du panneau principal affichant 'Hey Prism actif' avec un indicateur bleu après le retour du mode Chevet" width="260">
</p>

---

### 🃏 Cartes de Phrases Rapides — pour les utilisateurs non-verbaux et immobiles

> **C'est le chemin critique pour les utilisateurs qui ne peuvent pas parler ou toucher l'écran librement.** Les Cartes de Phrases Rapides sont des boutons de communication préprogrammés qui peuvent être activés par un simple toucher, une fixation oculaire ou une sélection par balayage de commutateur. Pas de saisie. Pas de voix. Pas d'internet requis pour les utiliser.

Chaque carte affiche une grande icône emoji et une courte phrase. Toucher une carte charge immédiatement cette phrase dans la barre de message. Si le **mode Mains Libres** est activé, la phrase est envoyée automatiquement à l'IA.

#### Cartes intégrées

Quinze cartes sont préchargées lors de la première utilisation, regroupées par urgence. Elles ne peuvent pas être supprimées. Elles fonctionnent hors ligne.

**Urgent (priorité absolue — communiquer celles-ci en premier en cas d'urgence médicale) :**

| Icône | Phrase | Quand utiliser |
|:---:|---|---|
| 🆘 | AIDE — URGENCE | Danger immédiat, appel de code, toute situation nécessitant du personnel maintenant |
| 😢 | J'ai mal | Douleur de toute nature — l'emplacement/la gravité peut suivre en texte libre |
| 🫁 | Je n'arrive pas à respirer | Détresse respiratoire, problème de voies respiratoires, crise de panique |
| 🔔 | Appelez l'infirmière | Demande de personnel non urgente |

**Besoins physiques :**

| Icône | Phrase | Quand utiliser |
|:---:|---|---|
| 💧 | De l'eau s'il vous plaît | Soif, bouche sèche, prise de médicaments |
| 🔥 | J'ai trop chaud | Fièvre, couverture, régulation de la température |
| 🥶 | J'ai trop froid | Frissons, couverture, température ambiante |
| ↔️ | Veuillez me repositionner | Soulagement de la pression, confort, positionnement post-chirurgical |
| 💊 | J'ai besoin de mes médicaments | Dose programmée, demande PRN, analgésique |

**Communication :**

| Icône | Phrase | Quand utiliser |
|:---:|---|---|
| ✅ | Oui | Confirmation — répondre aux questions oui/non de l'aidant |
| ❌ | Non | Refus — répondre aux questions oui/non de l'aidant |
| ⏳ | Veuillez patienter | Besoin d'un instant — ne pas continuer encore |

**Émotionnel :**

| Icône | Phrase | Quand utiliser |
|:---:|---|---|
| ❤️ | Je vous aime | Famille, lien émotionnel |
| 🙏 | Merci | Gratitude |
| 😨 | J'ai peur | Anxiété, peur, détresse — déclenche une réponse IA empathique |

#### Comment utiliser les Cartes de Phrases Rapides

**Simple toucher / regard oculaire / sélection par commutateur :**
L'activation d'une carte place son texte dans la barre de message. La phrase peut ensuite être :
-   Envoyée à l'IA pour une réponse contextuelle (par exemple, toucher "J'ai peur" → l'IA répond avec réassurance et pose des questions de suivi)
-   Lue telle quelle — les aidants présents dans la pièce peuvent voir la carte qui a été touchée sur l'écran

**Avec le mode Mains Libres activé :**
La phrase est envoyée automatiquement à l'IA dès que la carte est touchée. Le micro redémarre 1 seconde après la réponse de l'IA — créant une boucle continue sans aucune autre saisie.

**Avec le mot d'activation "Hey Prism" actif (web / bureau) :**
Le mot d'activation + la Carte Rapide peuvent être combinés : l'utilisateur dit "Hey Prism" pour ouvrir le micro, l'IA répond, et l'utilisateur peut ensuite toucher une carte pour continuer la conversation dans une direction différente sans parler à nouveau.

#### Comment ajouter des cartes personnalisées

Les aidants, les BCBA et les membres de la famille peuvent ajouter des cartes personnalisées adaptées aux besoins de communication spécifiques de l'utilisateur — les noms de leurs médecins, leurs phrases préférées, des descriptions de douleur spécifiques, des expressions religieuses ou toute autre chose.

**Étapes :**

1.  En mode Chevet, touchez **＋ Ajouter** à la fin de la bande des Phrases Rapides.
2.  Tapez la phrase que vous voulez sur la carte (jusqu'à 80 caractères).
3.  Touchez **Ajouter une carte** — l'IA génère automatiquement une icône emoji qui correspond au sens de la phrase (par exemple, "Donnez-moi plus de couvertures" → 🛏, "Je veux prier" → 🤲).
4.  L'icône apparaît avec une brève animation "✨ Génération…", puis la carte est enregistrée.

Les cartes personnalisées sont enregistrées localement sur l'appareil (localStorage). Elles persistent entre les sessions et les redémarrages de l'application. Aucun compte ou connexion internet n'est requis pour utiliser les cartes enregistrées — seule la génération initiale de l'icône nécessite un appel réseau.

**Exemples de cartes personnalisées à envisager d'ajouter :**

| Phrase suggérée | Pourquoi |
|---|---|
| `[Nom du médecin], veuillez venir` | Plus rapide que le générique "appelez l'infirmière" pour un clinicien spécifique |
| `J'ai besoin de parler à ma famille` | Situations émotionnelles/légales nécessitant le plus proche parent |
| `Veuillez éteindre les lumières` | Sensibilité sensorielle, migraine, sommeil |
| `Je veux prier` | Soins spirituels — dignité en fin de vie |
| `Quelque chose ne va pas` | Signal de détresse vague — invite l'IA à poser des questions de clarification |
| `J'ai besoin de l'aspiration` | Patients trachéotomisés / sous ventilation |
| `Ma perfusion me fait mal` | Infiltration, alerte de phlébite |
| `Je veux rentrer chez moi` | Conversations palliatives/de sortie |

#### Comment supprimer des cartes personnalisées

1.  Touchez **✏️ Modifier** dans l'en-tête de la bande des Phrases Rapides.
2.  Un badge rouge **✕** apparaît sur chaque carte personnalisée (les cartes intégrées sont protégées et ne peuvent pas être supprimées).
3.  Touchez ✕ sur n'importe quelle carte pour la supprimer.
4.  Touchez **Terminé** pour quitter le mode édition.

#### Configuration du balayage par commutateur (iOS)

Pour les utilisateurs qui ne peuvent activer qu'un seul commutateur externe (contacteur à souffle, contacteur de tête, contacteur de pied, contacteur à coussin) :

1.  Connectez le commutateur à l'iPhone/iPad via Bluetooth ou le port Lightning/USB-C.
2.  Allez dans **Réglages → Accessibilité → Contrôle de commutateur → Commutateurs** et attribuez le commutateur à "Sélectionner l'élément".
3.  Allez dans **Contrôle de commutateur → Style de balayage** et choisissez "Balayage automatique" — l'appareil mettra automatiquement en surbrillance les éléments un par un.
4.  Ouvrez Prism AAC en mode Chevet. Le Contrôle de commutateur balayera automatiquement les Cartes de Phrases Rapides. Activez votre commutateur lorsque la carte souhaitée est en surbrillance.
5.  La phrase est envoyée immédiatement — aucune deuxième action n'est requise.

> Toutes les Cartes de Phrases Rapides portent `data-scan-group="quick-cards"` afin que la technologie d'assistance puisse effectuer un balayage de groupe de toute la bande avant de passer à d'autres régions de l'interface utilisateur.

#### Configuration du suivi oculaire

Le matériel de suivi oculaire (Tobii Dynavox, EyeGaze Edge, PCEye, MyTobii P10, etc.) se présente au système d'exploitation comme un pointeur de souris standard avec clic par fixation. Aucune configuration spéciale n'est nécessaire dans Prism AAC :

1.  Configurez le temps de fixation dans le logiciel de votre dispositif de suivi oculaire (recommandé : 800–1200 ms pour les nouveaux utilisateurs).
2.  Ouvrez Prism AAC en mode Chevet dans n'importe quel navigateur.
3.  Fixez une Carte de Phrases Rapides pour l'activer.

La taille minimale des cartes (88 × 80 px) répond à l'exigence de taille cible AAA de 44 × 44 CSS px de la WCAG 2.5.5, et dépasse le minimum typique recommandé pour l'interaction par suivi oculaire (60 × 60 px).

---

<details>
<summary><strong>Toutes les fonctionnalités + détails d'implémentation technique</strong></summary>

**Cinq sous-systèmes livrés comme une seule fonctionnalité :**

1.  **Cartes de Phrases Rapides** — `services/bedsideCards.ts` + interface utilisateur de la bande dans `components/BedsideOverlay.tsx`.
    -   Stockage : clé `localStorage` `prism_bedside_cards_v1`. Schéma validé à chaque chargement — les entrées mal formées sont silencieusement ignorées.
    -   Limite : 50 cartes personnalisées maximum (empêche une croissance illimitée du stockage).
    -   Cartes intégrées : 15 entrées avec `id` préfixé `builtin-` ; la garde de l'interface utilisateur de suppression vérifie ce préfixe avant d'afficher le badge ✕, garantissant que les valeurs par défaut ne sont jamais supprimées.
    -   Génération d'icônes IA : `services/aiService.ts → inferCardIcon(text)`. Utilise la même chaîne de routage local-Ollama → cloud Synalux que le reste de l'application. Envoie la phrase comme message utilisateur avec un prompt système verrouillé ("Répondre avec exactement un emoji…"). Extrait le premier point de code Unicode de la réponse. Se résout toujours — se replie sur 💬 en cas d'erreur réseau ou de réponse non-emoji.
    -   Hors ligne : les cartes fonctionnent entièrement hors ligne ; seule l'ajout d'une nouvelle carte nécessite un réseau (pour la génération d'icônes — se replie sur 💬 si hors ligne).

2.  **Boucle IA mains libres (🔁)** — également accessible depuis l'en-tête du chat IA principal. Après chaque réponse IA, le micro redémarre automatiquement (délai de 1 s). Un modèle de référence `handsFreeRef` / `startListeningRef` garantit que l'effet appelle toujours le rappel actuel sans se réexécuter à chaque rendu.

    ![Hands-free status bar in main AI panel](../../e2e/_screenshots/bedside-hands-free-statusbar.png)

3.  **Superposition de chevet** — `fixed inset-0 z-50 bg-black` interface utilisateur sombre plein écran rendue comme un `<Fragment>` frère à côté du panneau IA principal afin que l'état du panneau soit préservé entre les cycles d'ouverture/fermeture. Accessibilité : `role="dialog"`, `aria-modal="true"`, `aria-label="Bedside Mode"`, piège à focus WCAG 2.1 SC 2.1.2 (Tab/Shift+Tab cycle à l'intérieur de la superposition, `Escape` ferme). Couverture de la fenêtre d'affichage vérifiée indépendamment E2E (tolérance ≤ 4 px).
    -   **Grand bouton micro** — 112 × 112 px (`w-28 h-28`), rouge + pulsant pendant l'écoute, bordure blanche au repos. Vérifié ≥ 96 px par Playwright `boundingBox()`.
    -   **Bande de Cartes Rapides** — rangée de défilement horizontal, chaque carte `88 × 80 px`, `data-scan-group="quick-cards"` pour le regroupement par balayage de commutateur, `role="list"` / `role="listitem"` pour la sémantique du lecteur d'écran.
    -   **Rangée de commandes** — Mains Libres (vert quand activé), mot d'activation "Hey Prism" (bleu quand activé, masqué quand `!wakeWordSupported`), raccourci Contrôle vocal iOS.
    -   **Quitter** — bouton ✕ (`w-12 h-12`) ou `Escape` → `onClose()` → `bedsideModeActive = false` dans `AIChatPanel` → focus WCAG 2.4.3 retourné au bouton 🛏 qui a ouvert la boîte de dialogue.

    ![Bedside overlay — closed, back to main AI panel](../../e2e/_screenshots/bedside-overlay-closed.png)

4.  **Mot d'activation "Hey Prism"** — `services/wakeWordService.ts`. Exécute une session `SpeechRecognition` continue en arrière-plan. Détecte toute transcription contenant "hey prism", déclenche le micro une fois, puis se réinitialise pour le cycle suivant. Garde : non démarré lorsque le pont natif iOS possède le micro (`prismNativeBridge?.startVoice` présent). L'état actif du mot d'activation est affiché dans la barre d'état du panneau principal après la fermeture de la superposition.

    ![Status bar showing "Hey Prism" active](../../e2e/_screenshots/bedside-wakeword-statusbar.png)

5.  **Guide du Contrôle vocal iOS** — toucher 📱 dans la rangée de commandes tente `prismNativeBridge.openSettings('accessibility')` (lien profond vers Accessibilité sur les builds natives prises en charge). Sur le web / bureau, il se replie sur une carte d'instructions en superposition qui explique `Réglages → Accessibilité → Contrôle vocal → Activé`.

    <p align="center">
      <img src="../../e2e/_screenshots/bedside-voice-control-card.png" alt="Carte d'instructions du Contrôle vocal iOS — guide étape par étape affiché dans la superposition du mode Chevet lorsque 📱 est touché sur le web/bureau" width="260">
      <img src="../../e2e/_screenshots/bedside-voice-control-dismissed.png" alt="Carte d'instructions du Contrôle vocal iOS après fermeture — la superposition revient à la disposition normale du mode chevet" width="260">
    </p>

**Couverture des tests :**
-   `services/bedsideCards.test.ts` — 22 tests unitaires : ensemble de cartes par défaut, aller-retour localStorage, repli JSON mal formé, filtrage des cartes invalides, limite de 50 cartes, contraintes de champ `createCard`.
-   `e2e/bedside-mode.spec.ts` — 17 tests E2E Playwright : visibilité des boutons, basculement `aria-pressed`, classes d'état vert/bleu, texte de la barre d'état, attributs d'accessibilité de la superposition, taille de la `boundingBox` du micro, couverture de la fenêtre d'affichage, affichage/fermeture de la carte d'instructions.

**Fichiers clés :**
-   `components/AIChatPanel.tsx` — état du mode chevet, état des cartes (`bedsideCards`), `handleAddBedsideCard`, `handleDeleteBedsideCard`, boucle mains libres, cycle de vie du mot d'activation, boutons d'en-tête
-   `components/BedsideOverlay.tsx` — interface utilisateur de la superposition, bande de Cartes Rapides, boîte de dialogue d'ajout de carte, mode édition, piège à focus, carte d'instructions du contrôle vocal
-   `services/bedsideCards.ts` — type `BedsideCard`, `DEFAULT_BEDSIDE_CARDS`, `loadCards`, `saveCards`, `createCard`
-   `services/aiService.ts` → `inferCardIcon(text)` — inférence d'emoji par IA
-   `services/wakeWordService.ts` — détection continue de la phrase d'activation
</details>

---

### 📨 Envoyer un message — sélecteur de fournisseur
Lorsqu'un contact a plusieurs fournisseurs configurés (par exemple, à la fois Mail et SMS), une section **"Envoyer via"** apparaît au-dessus de la zone de composition. Un seul toucher permet de changer de fournisseur avant de composer — pas besoin de quitter le panneau.

![Contact provider picker — 'Send via' row with Mail highlighted green, SMS available](../../docs/screenshots/contact-provider-picker.png)

---

### 💬 Chat CAA
Les messages entrants des fournisseurs connectés (Telegram, WhatsApp, Email, Slack, etc.) arrivent dans ce panneau. Le badge de non-lu sur la barre d'outils affiche le compte, l'alarme + la notification inter-onglets se déclenche lorsqu'un nouveau message arrive, et toucher une ligne de message la copie dans la barre afin que l'enfant puisse composer une réponse avec sa propre voix.

![AAC Chat panel showing inbound caregiver messages with unread badge](../../docs/screenshots/panel-aac-chat.png)

<details>
<summary><strong>Fonctionnalités + détails techniques</strong></summary>

- Boîte de réception interrogée via le portail Synalux `/api/v1/prism-aac/inbox/poll` (aucune opération en cas de 404 si le portail n'est pas configuré)
- Notification `BroadcastChannel` inter-onglets sur nouveau message
- Abstraction du fournisseur : ajouter Outlook / Slack / Discord = ~30 LOC chacun (voir `synalux-platform/scripts/fetch-messages.mjs`)
- L'état de lecture est synchronisé afin que les aidants voient quand l'enfant a vu leur message
- Niveau gratuit : 1 fournisseur connecté ; niveau payant : illimité
- TTS par message afin que l'enfant puisse entendre le texte entrant dans sa voix préférée

**Chemin de rendu :** `components/AACChatPanel.tsx` → `services/inboxPolling.ts` (interrogation toutes les 5s lorsque sidePanel === 'aac-chat', toutes les 60s sinon) → `useScheduleStore.setIncomingMessages()`. Chaque message est également ajouté à la piste "Messages des aidants" de l'emploi du temps.
</details>

---

### 🧮 Matières scolaires
Canevas en grille de cellules hébergeant **19 claviers de matières** couvrant l'intégralité du programme du lycée : maths + sciences + programmation + arts + sciences humaines. Chaque onglet achemine le tuteur IA via un modèle de prompt spécifique au domaine (33 modèles au total) afin que le modèle n'applique pas de raisonnement algébrique à un échiquier de Punnett ou ne confonde pas une dynamique musicale avec un littéral de programmation. **L'historique est sensible à la locale et à la région** jusqu'au niveau de l'État / province / Land / communauté autonome — plus de 280 régions dans 23 pays.

![Cell-grid canvas with 5 + 7 = 12 typed across cells](../../docs/screenshots/math-canvas-typed.png)

<details>
<summary><strong>Onglets de matières (19 au total)</strong></summary>

**Mathématiques (9 claviers)** — Principal, Maths Avancées (π √ exposants + 5 outils de décoration : boîte de fraction, maison de division longue, barre de racine, ligne de sommation, barre de fraction), a–z, Maths Diverses (théorie des ensembles + logique), Temps & Dist, Poids, Volume, Géom, Argent.

**Sciences (4)** — Chimie (24 éléments + flèches de réaction + charges + indices + marqueurs de phase), Physique (grec complet + 16 unités SI + ∫/∂/∇/∑/∏ + constantes), Biologie (ADN/ARN + génétique + 8 rangs taxonomiques + 12 organites), Statistiques (μ σ x̄ + 12 opérations + distributions).

**Programmation (2)** — Python (24 opérations + 26 mots-clés) et Java (24 opérations + 26 mots-clés). Le code valide un caractère par cellule afin qu'il s'affiche naturellement sur la grille monospace.

**Arts + Sciences humaines (4)** — Musique (3 clés + 6 notes + 5 silences + 5 altérations + 8 dynamiques), Sciences de la Terre (météo + plaques + 10 planètes + UA/al/pc/Mya/Gya), Histoire (sensible à la locale + à la région), Arts du langage (12 étiquettes POS + 6 types de phrases + ponctuation + styles de citation).

</details>

<details>
<summary><strong>Tuteur IA — 11 domaines × 3 modes = 33 prompts</strong></summary>

![AI tutor overlay with mocked hint above the canvas](../../docs/screenshots/math-tutor-hint.png)

Trois modes par matière : 💡 **Indice** (léger coup de pouce pour l'étape suivante, ne résout jamais), ✓ **Vérifier** (valide la réponse de l'enfant, félicite si correct), 🎓 **Résoudre** (explication complète étape par étape, max 4 étapes). L'onglet actif indique au tuteur la matière sur laquelle l'enfant travaille. Délai d'attente strict de 15 s + bouton Réessayer pour que la superposition ne reste jamais bloquée.
</details>

<details>
<summary><strong>Historique — sensible à la locale + à la région</strong></summary>

![History keyboard in en locale (no region) — universal + national tiers](../../docs/screenshots/math-keyboard-history-en.png)
![History keyboard with US-TX region — Alamo, Texas annexation, JFK appear](../../docs/screenshots/math-keyboard-history-us-tx.png)

Trois niveaux empilés :
1.  Événements **universels** enseignés dans tous les programmes (476, Première Guerre mondiale 1914, Seconde Guerre mondiale 1939, lune 1969)
2.  Événements **nationaux** sélectionnés par `language` (en, es, fr, de, ro, ru, uk, ja, ko, zh, ar, it, pl, nl, he, hi, vi, tr, pt) — 19 langues prises en charge
3.  Événements **infranationaux** sélectionnés par `historyRegion` (US-TX, CA-QC, UK-SCT, ES-CT, IN-MH, DE-BY, …) — **plus de 280 régions dans 23 pays**, y compris les 50 États américains + DC, les 13 provinces / territoires canadiens, les 4 nations du Royaume-Uni, l'Irlande (République + 4 provinces historiques), les 16 Länder allemands, les 17 communautés autonomes espagnoles, les 20 régions italiennes, plus l'Australie, la France, le Mexique, le Brésil, l'Inde, la Chine, la Russie, la Belgique, la Suisse, les Pays-Bas, l'Argentine, l'Afrique du Sud, la Corée, le Pakistan, la Nouvelle-Zélande, la Pologne.

Le prompt du tuteur contient la locale + la région afin qu'une date ambiguë comme 1836 en `US-TX` se résolve en Alamo (pas l'accession de l'Alabama au statut d'État) ; 1759 en `CA-QC` s'ancre aux Plaines d'Abraham ; 1714 en `ES-CT` à la chute de Barcelone.

</details>

<details>
<summary><strong>Flux de tests — 12 matières × problèmes à résoudre de la 8e à la 12e année × 72 tests Playwright</strong></summary>

Feuilles de problèmes étape par étape exerçant chaque clavier de matière, plus un test Playwright exécutable par problème qui pilote le panneau mathématique en direct et vérifie que les glyphes de chaque étape atterrissent dans la grille de cellules. Modélisé directement sur une page de référence d'algèbre de 9e année réelle.

-   **Couche 1 — générique étape par étape :** [`tests/workflows/`](tests/workflows/) — 12 markdowns (maths avancées, biologie, chimie, sciences de la terre, géométrie, histoire, arts du langage, maths diverses, physique, programmation-java, programmation-python, statistiques).
-   **Couche 2 — niveau scolaire réel :** [`tests/workflows/grade-8-12/`](tests/workflows/grade-8-12/) — 12 markdowns avec des problèmes à résoudre à variables nommées (algèbre-9e année, géométrie-10e année, physique-11e année, chimie-10e année, biologie-9e année, statistiques-11e année, programmation-python-9e année, programmation-java-11e année, pré-calcul-12e année, sciences de la terre-9e année, arts du langage-8e année, histoire mondiale-10e année) + [`REPORT.md`](tests/workflows/grade-8-12/REPORT.md) par lacune de clavier de matière.
-   **Couche 3 — Playwright e2e :** [`e2e/math-workflows/`](e2e/math-workflows/) — 72 tests (`npx playwright test --project=desktop e2e/math-workflows`).

Index complet, matières sous-supportées classées, et le guide d'exécution "comment ajouter un nouveau flux de travail" → **[`docs/WORKFLOWS.md`](../../docs/WORKFLOWS.md)**.

</details>

<details>
<summary><strong>Autres fonctionnalités mathématiques (outil de verrouillage, agrandissement en deux touches, enregistrement / synchronisation)</strong></summary>

-   **Outil de verrouillage** — une fois que l'enfant a terminé un problème, verrouillez la région. Les cellules verrouillées s'affichent légèrement estompées et rejettent les modifications.
-   **Agrandissement en deux touches** — le premier toucher arme la touche (échelle 1.4× + halo vert), le second toucher valide. Désarmement automatique après 2 s. Pour les utilisateurs ayant une imprécision motrice.
-   **Enregistrer + synchroniser** — d'abord localement dans `localStorage` ; synchronisation au mieux vers le portail Synalux via le bouton `↻ Sync`. Limite de 100 documents / 200 Ko de corps ; les plus anciens sont évincés.
-   **Temps de maintien de la fixation** — fixation configurable par touche (0–1500 ms) avec anneau de progression vert.

![Saved docs overlay showing one entry and a Sync button](../../docs/screenshots/math-docs-overlay.png)
![A digit key armed in the green-halo magnified state](../../docs/screenshots/math-two-hit-armed.png)
![Lock tool armed, prompting the user to tap a corner of the region](../../docs/screenshots/math-lock-armed.png)

</details>

<details>
<summary><strong>Claviers de matières — images supplémentaires</strong></summary>

![Chemistry keyboard with H₂O](../../docs/screenshots/math-keyboard-chemistry.png)
![Biology keyboard with A T G](../../docs/screenshots/math-keyboard-biology.png)
![Java keyboard with `private String`](../../docs/screenshots/math-keyboard-java.png)
![Music keyboard](../../docs/screenshots/math-keyboard-music.png)
![Statistics keyboard](../../docs/screenshots/math-keyboard-statistics.png)
![Earth Science keyboard](../../docs/screenshots/math-keyboard-earth-science.png)
![Language Arts keyboard](../../docs/screenshots/math-keyboard-language-arts.png)
![Romanian-locale history](../../docs/screenshots/math-keyboard-history-ro.png)

</details>

---

### 🗓 Emploi du temps
Calendrier visuel "d'abord-ensuite" pour le soutien à la routine et à la transition. Chaque étape est une tuile d'image + une étiquette ; terminer une tuile déclenche un carillon + une marque de progression visuelle. La boutique de récompenses (niveau payant) se débloque à la fin d'une routine.

![Schedule panel with first-then board + activity list](../../docs/screenshots/panel-schedule.png)

<details>
<summary><strong>Fonctionnalités + détails techniques</strong></summary>

- Grille de 24 tuiles prédéfinies pour des ajouts d'activités en un seul toucher : se réveiller, se brosser les dents, petit-déjeuner, école, collation, déjeuner, jouer, lire, art, marcher, dîner, bain, histoire du soir, coucher, médicaments, passer le fil dentaire, ranger, lessive, soins aux animaux, sports, …
- Réorganisation par glisser-déposer ; édition en ligne avec icône de crayon ; les ajouts prédéfinis portent une `textKey` afin que le changement de langue réétiquette
- Machine d'état "D'abord-Ensuite" : pulsation de la tuile armée, carillon ascendant à 3 notes à l'expiration du minuteur, sans danger pour le mouvement (`prefers-reduced-motion` → anneau statique), sémantique `aria-pressed`
- Échauffement audio : un oscillateur de 1 Hz quasi silencieux maintient l'AudioContext "en marche" sur iOS Safari afin que le carillon du minuteur joue réellement après un long silence (sans échauffement, le carillon se déclenche dans un contexte suspendu = pas de son)
- Les messages des aidants sont ajoutés à l'emploi du temps comme une piste "Messages" afin que l'enfant voie ce qui arrive + qui a envoyé un message

**Chemin de rendu :** `components/SchedulePanel.tsx` → `useScheduleStore` (24 activités prédéfinies + personnalisées) → `services/feedback.ts:playTimerRing()` → AudioContext partagé via `services/azureTTS.ts:warmupAzureAudio()`.
</details>

---

### 🎮 Jeux
12 jeux de CAA basés sur des preuves. Conçus pour enseigner la communication, **pas pour le temps d'écran**. Chaque jeu enregistre les énoncés + la précision afin que le moteur adaptatif puisse suggérer le jeu le mieux adapté suivant.

![Games panel with 9 game tiles](../../docs/screenshots/panel-games.png)

<details>
<summary><strong>Les 12 jeux + détails techniques</strong></summary>

| Jeu | Compétence ciblée |
|---|---|
| Bubble Pop | Cause + effet, communication intentionnelle |
| Color Hunt | Vocabulaire réceptif (noms de couleurs) |
| My Story | Séquençage narratif |
| Match It | Appariement + pensée catégorielle |
| Yes/No | Discrimination binaire, demander/refuser |
| Finish It | Complétion de phrases (cloze) |
| Category Sort | Catégorisation sémantique |
| Emotion Match | Étiquetage des affects, Théorie de l'Esprit (ToM) |
| What Comes Next | Raisonnement séquentiel |
| Same / Different | Discrimination visuelle — apparier ou contraster |
| I Hear It (Sound Match) | Discrimination auditive + vocabulaire |
| Turn Taker | Pratique du tour de rôle social |

- Niveau gratuit : Bubble Pop, Color Hunt, My Story (3 jeux)
- Niveau payant : les 12 jeux
- Les données de chaque jeu alimentent `services/adaptiveEngine.ts` — longueur de l'énoncé / catégorie / heure de la journée / résultat → suggère le jeu suivant
- Tous les jeux désactivent les catégories de tuiles CAA qui ne sont pas pertinentes pour le vocabulaire de ce jeu, afin que l'enfant ne soit pas distrait

**Chemin de rendu :** `components/GamesPanel.tsx` → composants de jeux individuels dans `components/games/`. Chaque jeu enregistre via `useScheduleStore.recordMessage(text, category)`.
</details>

---

### 🏪 Place de marché
Packs vocaux (voix Inworld, voix personnalisée clonée d'un frère/sœur/parent), packs de vocabulaire (vocabulaire de base espagnol, parole soutenue par des signes), packs de jeux (jeux supplémentaires au-delà des 9). Les applications s'installent dans la barre d'outils via le même registre que les panneaux intégrés.

![Marketplace panel with installable apps](../../docs/screenshots/panel-marketplace.png)

<details>
<summary><strong>Fonctionnalités + détails techniques</strong></summary>

- Les applications vivent comme des entrées JSON (`lib/marketplace/manifests/local.ts`) + un `lib/marketplace/registry.ts` d'exécution avec `getHandler(appId)` renvoyant le composant de panneau
- Clonage de voix (niveau payant) : enregistrement de 90 s → voix entraînée utilisable pour n'importe quel TTS dans l'application, y compris les tuiles de catégorie
- Les applications installées s'affichent comme des boutons de barre d'outils après les applications intégrées ; `useSettingsStore.installedApps` est la source de vérité
- Porte par niveau : la place de marché liste tout, mais les boutons d'installation sont désactivés pour les éléments au-dessus du forfait de l'utilisateur

**Chemin de rendu :** `components/MarketplacePanel.tsx` → `useMarketplaceStore` → backend `synalux/api/v1/marketplace/...` pour l'achat, puis téléchargement d'actifs (fichiers vocaux, JSON de vocabulaire) dans IndexedDB.
</details>

---

### 📄 Lecteur PDF
Ouvrez un PDF, voyez une tuile par page, touchez pour l'entendre prononcée avec votre voix. Feuilles de travail scolaires, lettres à emporter, articles — insérez n'importe quel PDF et écoutez au lieu d'essayer de le lire. Aucun Adobe Reader requis ; toute la bibliothèque fonctionne dans votre navigateur.

![PDF Reader panel — empty state with "+ Open PDF" prompt](../../docs/screenshots/panel-pdf-reader.png)

<details>
<summary><strong>Fonctionnalités + détails techniques</strong></summary>

- Une tuile par page ; chacune affiche les 3 premières lignes + un bouton `▶ Page N` qui passe par `aacSpeak()` (même voix + tonalité + surlignage de mots que tout le reste)
- `▶ Tout lire` concatène chaque page en un seul énoncé continu
- La détection de page vide (PDF d'images numérisées) suggère l'outil OCR
- `pdfjs-dist` importé dynamiquement à la première ouverture — morceau séparé d'environ 3 Mo du CDN, version épinglée au package npm
- Le bouton de la barre d'outils (📄) est optionnel via Réglages → Barre d'outils afin que la barre d'outils minimale par défaut reste propre

**Chemin de rendu :** `components/PdfReaderPanel.tsx` → `services/pdfReader.ts` (pdfjs `getDocument` → `getTextContent` par page) → `services/aacSpeak.ts`.
</details>

---

### 👁 Lecteur de captures d'écran (OCR)
Collez ou téléchargez une photo d'une feuille de travail, une capture d'écran d'une page web, une image d'une page de manuel — le texte reconnu apparaît à côté de l'image et vous pouvez toucher **▶ Parler** pour l'entendre, ou **↧ Envoyer à la barre de message** pour modifier avant de parler.

![Screenshot Reader (OCR) panel — empty state with "+ Open image" prompt](../../docs/screenshots/panel-ocr-capture.png)

<details>
<summary><strong>Fonctionnalités + détails techniques</strong></summary>

- Matrice OCR de 20 langues mappée des locales PrismAAC aux codes Tesseract (eng / spa / fra / por / deu / ron / ukr / rus / jpn / kor / chi_sim / ara / ita / pol / nld / heb / hin / vie / tur / ind)
- Fichiers `traineddata` par langue mis en cache après la première utilisation (~10 Mo pour l'anglais, plus pour le CJK) — la première exécution affiche "Lecture de l'image… (la première exécution télécharge le modèle OCR — peut prendre 10-30 s)"
- Pourcentage de confiance affiché afin que l'utilisateur de CAA puisse savoir s'il doit faire confiance au résultat ou reprendre la photo
- Le crochet de nettoyage `disposeOcr()` termine chaque worker généré au déchargement de la page pour libérer la mémoire WASM
- Le bouton de la barre d'outils (👁) est optionnel via Réglages → Barre d'outils

**Chemin de rendu :** `components/OcrCapturePanel.tsx` → `services/ocr.ts` (`tesseract.js` `createWorker` → `recognize`) → `services/aacSpeak.ts` ou `messageStore.setText`.
</details>

---

### 🎧 Lecteur de confort

Lecteur multimédia de chevet pour les patients hospitalisés — coma, soins intensifs, non-verbaux, ou toute personne ayant besoin d'un contenu de confort continu au chevet.

<details>
<summary>Détails des fonctionnalités</summary>

La famille et les amis enregistrent des messages vocaux, téléchargent des photos et des vidéos. La playlist tourne en boucle en continu afin que le patient ait toujours des voix et des visages familiers à proximité.

-   **Enregistrer** des messages vocaux directement dans l'application (API MediaRecorder)
-   **Télécharger** des fichiers audio, des photos et des clips vidéo (100 Mo par fichier, 500 Mo au total)
-   **Boucle automatique** à travers tous les éléments en continu — configurez-le et partez
-   Mode **plein écran** pour les photos et vidéos (affichage au chevet)
-   Intégration **TTS native** — les phrases touchées sont prononcées via AVSpeechSynthesizer sur iOS
-   **Hors ligne** — tous les médias sont stockés dans IndexedDB, fonctionne sans internet
-   **Accessible au clavier** — chaque commande a des étiquettes ARIA et une navigation au clavier
-   **Évalué de qualité militaire** — 27 failles de sécurité corrigées (fuites d'URL de blob, gestion des quotas, validation des entrées, listes blanches MIME, nettoyage au démontage)
-   Le bouton de la barre d'outils (🎧) est optionnel via Réglages → Barre d'outils

**Limites de stockage :** 50 éléments max, 100 Mo par fichier, 500 Mo au total. Types MIME restreints à l'audio (webm/mp4/mpeg/ogg/wav), aux images (jpeg/png/gif/webp/heic) et à la vidéo (mp4/webm/quicktime).

**Chemin de rendu :** `components/ComfortPlayerPanel.tsx` → `store/comfortPlayerStore.ts` (Zustand + persist) → `services/comfortMediaStorage.ts` (blobs IndexedDB).
</details>

---

### 🧩 Extension Chrome — mêmes fonctionnalités d'aide à la lecture dans n'importe quel champ de texte
L'application web PrismAAC couvre le flux d'aide à la lecture dans sa propre surface. L'extension Chrome (`chrome-extension/`) apporte le **même comportement à N'IMPORTE QUEL champ de texte sur N'IMPORTE QUEL site** — Gmail, Google Docs, Word Online, portails scolaires, formulaires bancaires — comblant la seule lacune de Read & Write qui n'était pas atteignable depuis une page web seule.

![PrismAAC Reading Assistant — speak as you type, with word-by-word highlight, in any text field](../../docs/screenshots/extension-marquee.png)

La superposition flottante s'attache au-dessus de tout champ de texte ciblé. Touchez **▶ Parler** pour relire, ou continuez simplement à taper — terminer une phrase avec `.?!` la relit automatiquement avec chaque mot s'illuminant en jaune au fur et à mesure qu'il est prononcé :

![PrismAAC overlay above a compose page, mid-sentence with "school" highlighted yellow as TTS speaks it](../../docs/screenshots/extension-overlay.png)

La traduction pendant la prononciation affiche À LA FOIS la ligne source (petite italique) et la ligne traduite (taille normale, avec surlignage du mot actif pendant qu'il est prononcé). Plus de 50 langues via le point de terminaison public gratuit de Google (pas de clé API) :

![PrismAAC overlay translating English to Romanian — source line "I had a really good day at school today" with translated "Am avut o zi foarte bună la școală astăzi" below, "foarte" highlighted](../../docs/screenshots/extension-translate.png)

Page d'options — les paramètres se synchronisent sur le profil Chrome de l'utilisateur via `chrome.storage.sync`. Liste de désactivation par site, sélecteur de voix, curseurs de débit / volume / hauteur, sélecteurs de langue, tous optionnels :

![PrismAAC extension options page — speak triggers, target language Romanian, voice picker, rate/volume/pitch sliders](../../docs/screenshots/extension-options.png)

**Installation (mode développeur pour l'instant — liste du Chrome Web Store en attente de révision) :**

```sh
cd chrome-extension
npm install
npm run build
```

Ouvrez `chrome://extensions`, activez le **mode Développeur**, cliquez sur **Charger l'extension non empaquetée**, et choisissez `chrome-extension/dist`.

**Fonctionnalités :**

-   Prononcer la phrase sur `.?!`, prononcer chaque mot à l'espace, tout est activable/désactivable
-   **Surlignage mot par mot** alimenté par l'événement natif `SpeechSynthesisUtterance.boundary` du navigateur (synchronisation VRAIE mot par mot, par rapport à l'heuristique de ~60 ms/caractère de l'application web — la route du portail renvoie un MP3 sans événements de streaming, mais Web Speech les expose nativement)
-   **Traduire pendant la prononciation** — choisissez une langue cible (plus de 50 prises en charge via le point de terminaison public gratuit de Google, pas de clé API). La superposition affiche À LA FOIS la ligne source (petite italique) ET la ligne traduite (avec surlignage du mot actif) ; une voix Web Speech correspondant à la langue cible est sélectionnée automatiquement
-   Superposition Shadow-DOM flottante ancrée au-dessus du champ ciblé (▶ Parler, 📌 Épingler, × Fermer)
-   `Cmd / Ctrl + Shift + S` pour prononcer le champ ciblé à la demande ; `Esc` annule
-   Liste de désactivation par site pour les formulaires bancaires / sensibles
-   Les paramètres se synchronisent sur le profil Chrome de l'utilisateur via `chrome.storage.sync` — aucun compte PrismAAC n'est requis

**Confidentialité :** le mode sans traduction est entièrement hors ligne (Web Speech s'exécute nativement). Le mode traduction effectue un appel HTTPS par phrase unique à `translate.googleapis.com` (mis en cache après la première requête). Source disponible à [`chrome-extension/`](chrome-extension/) — bundle TypeScript + esbuild (contenu 18 Ko, options 7 Ko, arrière-plan 339 B).

---

### 👋 Gestes mains libres
Saisie optionnelle basée sur la caméra pour les utilisateurs qui ne peuvent pas toucher de manière fiable. Profils de clic par fixation de la pose de la tête + de gestes de la pose de la main. S'exécute localement — aucune vidéo ne quitte l'appareil.

<details>
<summary><strong>Fonctionnalités + détails techniques</strong></summary>

-   **Mode de base** : suivi de la pose de la tête (FaceLandmarker, MediaPipe). L'utilisateur regarde une touche, maintient le regard pendant `headTrackingDwellMs` (1200 ms par défaut) → clic. Un anneau de progression visuel se remplit pendant la fixation.
-   **Mode avancé** : suivi de la pose de la main. Profils de gestes personnalisés par utilisateur (paume ouverte = entrée, poing = retour arrière, pincement = espace, etc.) configurés via `components/HandCalibration.tsx`.
-   Pile de sécurité anti-dérive : si la tête de l'utilisateur dérive de plus de `headTrackingDriftThresholdPx` sur `headTrackingDriftWindowMs` images consécutives, le suivi se désactive automatiquement et affiche une invite de recalibrage (rapporté par les utilisateurs en mai 2026 : le suivi suivrait silencieusement la dérive pendant une heure et manquerait les cibles réelles des touches).
-   **Porte de sortie Esc** — appuyer sur Échap sur n'importe quel clavier désactive immédiatement le suivi et réaffiche le clavier qwerty sans perdre la barre de message.
-   Singleton de flux de caméra (`services/cameraStream.ts`) afin que le suivi de la tête et des mains partage un seul flux ; le changement de mode est gratuit.
-   La calibration par utilisateur persiste ; le traqueur corporel se récupère automatiquement à la reprise de session.

**Documentation détaillée :** [`docs/TRACKING_MATH.md`](../../docs/TRACKING_MATH.md) (mathématiques de calibration, apprenant par percentile, mouvement égocentrique, filtre One Euro, ~30 paramètres ajustables), [`docs/GESTURE_RECOGNITION.md`](../../docs/GESTURE_RECOGNITION.md), [`docs/TRACKING_RELIABILITY.md`](../../docs/TRACKING_RELIABILITY.md).
</details>

---

### ⚙️ Réglages
23 langues, thème (clair / sombre / contraste élevé), taille de la grille (4 à 20 tuiles), adaptations motrices (temps de maintien de la fixation mathématique, agrandissement en deux touches, fixation du suivi de la tête, sensibilité des gestes, désactivation automatique de la dérive), sélecteur de voix (payant), correction automatique par IA activée/désactivée, notifications, personnalisation de la barre d'outils, sélecteur de région historique.

![Settings — language picker + theme toggle](../../docs/screenshots/panel-settings.png)

<details>
<summary><strong>Réglages mathématiques + d'accessibilité</strong></summary>

![Settings — math hold-time + two-hit magnify](../../docs/screenshots/panel-settings-math.png)

-   **Temps de maintien de la fixation mathématique** — curseur de 0 à 1500 ms ; 0 = clic instantané, 200 à 1500 ms aide les utilisateurs ayant une imprécision motrice (un anneau de progression vert se remplit pendant la fixation afin qu'ils puissent le voir).
-   **Agrandissement en deux touches** — le premier toucher sur n'importe quelle touche mathématique l'arme (échelle 1.4× + halo vert, pas de validation), le second toucher valide. Désarmement automatique après 2 s. Se compose avec le temps de maintien de la fixation.
-   **Fixation du suivi de la tête** — 200 à 5000 ms.
-   **Sensibilité** — 1 à 10.
-   **Désactivation automatique de la dérive** — bascule + seuil (px) + fenêtre (ms).
-   **Afficher la calibration des mains** — ouvre l'éditeur de profil de pose de la main.

</details>

<details>
<summary><strong>Modes de saisie — voix, gestes, correction automatique par IA</strong></summary>

![Settings — input modes panel](../../docs/screenshots/panel-settings-input-modes.png)

-   **Saisie vocale** — API Web Speech, sensible à la langue (anglais britannique vs anglais américain, etc.) ; niveau gratuit
-   **Correction automatique et complétion par IA** — chaque pause de frappe est acheminée via la correction automatique cloud (Gemini 2.5 Flash-Lite). Désactivé par défaut dans les scénarios à faible bande passante.
-   **Notifications** — alarme + notification inter-onglets sur les messages de chat CAA entrants.
-   **Saisie par caméra** — interrupteur principal de suivi de la tête et des mains.
-   **Cible de suivi de la caméra** — tête, main ou détection automatique.

</details>

<details>
<summary><strong>Personnalisation de la barre d'outils</strong></summary>

La barre d'outils est entièrement réorganisable. La version 0.9.0 par défaut est livrée avec un ensemble minimal (micro, chat CAA, alerte, catégories, réglages) afin que l'écran reste désencombré pour les nouveaux utilisateurs — toutes les autres fonctionnalités intégrées (maths, chat IA, emploi du temps, jeux, place de marché, lecteur de confort, notes, historique, son) peuvent être réactivées en un seul toucher dans Réglages → Barre d'outils. Les applications installées via la place de marché s'insèrent automatiquement après les applications intégrées.

</details>

---

## Essayez-le

| | |
|---|---|
| 🌐 **Application web** | [synalux.ai/prism-aac](https://synalux.ai/prism-aac) — essayez dans n'importe quel navigateur |
| 📱 **iOS** | [App Store](https://apps.apple.com/app/id6764692277) — iPhone, iPad, Apple Watch |
| 💻 **Source** | Ce dépôt. AGPL-3.0 — forkez librement, partagez les modifications |

---

## Forfaits

| | Gratuit | Payant |
|---|---|---|
| Tuiles d'images + 22 catégories | ✅ | ✅ |
| Taper pour parler | ✅ | ✅ |
| Voix par défaut (Inworld) | ✅ | ✅ |
| Clavier scolaire de 19 matières + tuteur IA | ✅ basique | ✅ + modèles premium |
| Emploi du temps | ✅ | ✅ + boutique de récompenses |
| Jeux | 3 (Bubble Pop, Color Hunt, My Story) | Les 12 |
| Sélecteur de voix | — | ✅ toutes les voix Inworld |
| Clonage de voix (votre propre voix) | — | ✅ |
| Synchronisation des notes des aidants | — | ✅ |
| Prédiction de mots (apprentissage par utilisateur) | — | ✅ |
| Historique locale + région | ✅ | ✅ |
| Saisie gestuelle mains libres | ✅ | ✅ |

[Voir les tarifs Synalux →](https://synalux.ai/pricing)

---

## Sécurité clinique

-   **L'accès à la CAA n'est jamais restreint en conséquence.** Un enfant doit toujours avoir sa voix.
-   **Pas de PHI dans le cloud sans consentement.** Les notes des aidants sont chiffrées avant le téléchargement.
-   **L'audio reste local.** La saisie vocale est transcrite dans le navigateur via l'API Web Speech.
-   **Conçu par des BCBA.** Le suivi des opérants verbaux correspond à la Liste de tâches BACB 5e édition.
-   **Paramètres par défaut tenant compte des traumatismes.** Pas de mécanismes de punition. La boutique de récompenses est optionnelle.

En savoir plus : [`ACCESSIBILITY.md`](ACCESSIBILITY.md), [`SECURITY.md`](SECURITY.md).

---

## Infrastructure & RGPD

### Architecture multi-régions

| Composant | Région | Objectif |
|---|---|---|
| **Supabase US** | US Est (Virginie) | Base de données principale — authentification, données utilisateur, notes des aidants |
| **Supabase EU** | UE Centre (Francfort) | Conforme au RGPD — les données des utilisateurs de l'UE ne quittent jamais l'UE |
| **Vercel** | Edge mondial | Application web, routes API, CDN |
| **Inworld TTS** | US | Synthèse vocale neuronale |
| **HuggingFace Hub** | US/UE | Poids du modèle (1.7B, 8B, 14B, 32B) |
| **Sur l'appareil** | Appareil de l'utilisateur | Inférence llama.cpp (iPhone/iPad/Mac) |

### Conformité au RGPD

Les données des utilisateurs de l'UE sont stockées exclusivement dans la région de Francfort (eu-central-1). Le portail détecte la localisation de l'utilisateur via l'en-tête `x-vercel-ip-country` de Vercel et achemine les opérations de base de données vers l'instance Supabase appropriée :

-   **Utilisateurs de l'UE** → `supabase-eu` (Francfort) — données personnelles, authentification, préférences, notes des aidants
-   **Utilisateurs non-UE** → `supabase-us` (Virginie) — mêmes catégories de données, juridiction américaine
-   **Inférence IA** → sur l'appareil (aucune donnée ne quitte l'appareil) ou API Synalux (aucune PII stockée)
-   **Audio TTS** → généré côté serveur, diffusé au client, non stocké

**Garanties de résidence des données :**
-   Les données personnelles de l'UE ne transitent jamais par des serveurs américains
-   Les jetons d'authentification sont délimités à l'instance Supabase régionale
-   Les notes des aidants sont chiffrées au repos (Supabase AES-256)
-   Les enregistrements vocaux (Lecteur de confort) sont stockés dans IndexedDB du navigateur — jamais téléchargés
-   Le modèle IA embarqué s'exécute localement — aucune télémétrie cloud

**Droit à l'effacement :** La suppression de l'utilisateur se propage à l'authentification, aux profils, aux notes des aidants et aux analyses d'utilisation dans la base de données régionale. Les instances auto-hébergées peuvent être effacées avec `supabase db reset`.

### Coûts à l'échelle

| Utilisateurs | Supabase | Vercel | TTS | Modèles IA | Total |
|---|---|---|---|---|---|
| 0–1K | 50 $/mois (2 régions) | 0 $ (Personnel) | ~5 $/mois | 0 $ (embarqué) | ~55 $/mois |
| 1K–10K | 50 $/mois | 20 $/mois (Pro) | ~50 $/mois | 0 $ | ~120 $/mois |
| 10K–100K | 50 $/mois + modules complémentaires de calcul | 20 $/mois | ~200 $/mois | RunPod 125 $/mois | ~395 $/mois |

---

## Modèles IA et support des appareils

Fonctionne sur tous les appareils Apple. Aucune dépendance cloud pour la communication CAA de base.

PrismAAC sélectionne automatiquement le meilleur modèle que votre matériel peut exécuter, se replie gracieusement sur les appareils contraints, et ne nécessite jamais de connexion internet pour la communication de base.

| Appareil | RAM | Modèle | Précision | CAA | Taille | Coût |
|---|---|---|---|---|---|---|
| **iPad Pro M1/M2/M4** | 16 Go | 14B Q4_K_M (v36) | **100%** | 100% | 8.4 Go | 0 $ |
| **iPhone 15/16 Pro, iPad Air** | 8 Go | 8B Q4_K_M (v36) → 1.7B (repli OOM) | **100%** | 100% | 4.7 Go / 1.1 Go | 0 $ |
| **iPhone 12–14, anciens iPads** | <8 Go | 1.7B Q4_K_M (v42) | **100%** | 100% | 1.1 Go | 0 $ |
| **Mac M1+ via WiFi** | 16+ Go | 14B via Ollama (v36) | **100%** | 100% | 8.4 Go | 0 $ |

### Cascade de l'application web

L'application web essaie d'abord l'inférence locale, puis se replie sur le cloud — ainsi les utilisateurs avec Ollama installé paient 0 $ et les utilisateurs sans obtiennent toujours toutes les fonctionnalités.

<details>
<summary>Organigramme de la cascade</summary>

```
  L'utilisateur envoie un message
        |
        v
  +-- OLLAMA LOCAL (détecté automatiquement à localhost:11434) --+
  |                                                              |
  |   14b (100%, ~1.1s) ─[échec]─> 8b (100%, ~0.8s) ─[échec]─> 1b7 (100%, ~1.6s)
  +-------------------------------------------------------------------+
         |
    [tous les locaux échouent ?]
         |
         v
  +-- REPLI CLOUD (API Synalux) --------+
  |  Claude Sonnet 4 (payant) / Gemini (gratuit) |
  |  99% de précision, ~3s                      |
  +-----------------------------------------+

  Chargement automatique : le premier lancement détecte Ollama → télécharge le meilleur modèle → local pour toujours.
```

</details>

### Cascade native iOS

L'application native sonde la RAM disponible au lancement, télécharge le bon modèle depuis HuggingFace CDN (une seule fois), et exécute l'inférence via llama.cpp Metal. Pas de serveur. Pas d'abonnement. Aucune donnée ne quitte l'appareil.

<details>
<summary>Organigramme de la cascade</summary>

```
  Lancement de l'application
      |
      v
  Détection de la RAM (os_proc_available_memory)
      |
      +── 16 Go+ (iPad Pro) ──> 14B Q4_K_M (8.4 Go) ──> 100%, ~1.1s
      |
      +── 8 Go (iPhone/iPad Air) ──> 8B Q4_K_M (4.7 Go) ──> 100%, ~0.8s
      |                                    |
      |                               OOM? → 1.7B Q4_K_M (1.1 Go) → 100%, ~1.6s
      |
      +── <8 Go ──> 1.7B Q4_K_M (1.1 Go) ──> 100%, ~1.6s

  Tous les chemins : llama.cpp Metal, 0 $ pour toujours, aucune donnée ne quitte l'appareil.
  Mise à niveau WiFi : Réglages → IA locale → entrer l'IP du Mac pour 14B/32B.
```

</details>

### Modes de disposition du clavier (persistants)

Trois modes alternent d'un simple toucher — la disposition choisie est enregistrée et restaurée à chaque lancement.

-   **MAX KB** — le clavier remplit tout l'espace sous la barre de prédiction
-   **MIN KB** — catégories 75 % / clavier 25 %
-   **HIDE KB** — catégories plein écran, clavier masqué

<details>
<summary>Diagramme de disposition</summary>

```
  MAX KB                 MIN KB                 HIDE KB
  +--------------------+ +--------------------+ +--------------------+
  | Barre d'outils     | | Barre d'outils     | | Barre d'outils     |
  | Barre de prédiction| | Barre de prédiction| | Bannière d'accueil |
  |                    | |                    | |                    |
  |  CLAVIER           | | Catégories  (75%)  | | Catégories         |
  |  remplit tout      | |                    | | (plein écran)      |
  |  l'espace sous     | |--------------------| |                    |
  |  la prédiction     | | Clavier     (25%)  | |                    |
  | [123][v][  espace  ]| |                    | |                    |
  +--------------------+ +--------------------+ +--------------------+
        |                      |                      |
        +-- bouton [v] ------->+-- bouton latéral ---->+-- bouton latéral --+
        |                                                               |
        +<--------------------------------------------------------------+
```

</details>

### Résumé des coûts

| Chemin | Modèle | Précision | Latence | Coût |
|---|---|---|---|---|
| iPad Pro 16 Go | 14B Q4_K_M (v36) | **100%** | ~1.1s | **0 $** |
| iPhone/iPad 8 Go | 8B Q4_K_M (v36) → 1.7B (repli OOM) | **100%** | ~0.8s | **0 $** |
| Tout appareil | 1.7B Q4_K_M (v42) | **100%** | ~1.6s | **0 $** |
| WiFi vers Mac | 14B via Ollama (v36) | **100%** | ~1.1s | **0 $** |
| Cloud (gratuit) | Gemini 2.5 Flash | 99% | ~3s | Synalux prend en charge |
| Cloud (payant) | Claude Sonnet 4 | 99% | ~3s | Inclus dans le forfait |

**L'argument :** Chaque enfant bénéficie d'une précision de niveau Claude, qu'il utilise un iPhone SE à 329 $ ou un iPad Pro à 2 000 $. Le principe "local d'abord" signifie zéro dépendance cloud, zéro frais d'API mensuels, zéro exposition aux PHI et des temps de réponse inférieurs à la seconde. Les quatre modèles prism-coder obtiennent **100 %** sur le benchmark de routage de 102 cas (prompt système v36/v7, moyenne de 3 graines, mai 2026), sans aucun appel d'outil inventé. Le modèle 32B obtient en outre **300/300 (100 %)** sur la suite d'évaluation étendue eval_300 (17 outils, 9 catégories, validé sur 3 graines).

---

## Auto-hébergement

```bash
git clone https://github.com/dcostenco/prism-aac.git
cd prism-aac
npm install
npm run dev    # http://localhost:3000
```

Synalux exploite la version hébergée canonique (gratuite + payante). Les auto-hébergeurs et les forks doivent publier les modifications sous AGPL-3.0.

### Modèles IA locaux (coût cloud zéro)

**Option A — Dans l'application (recommandé) :** Réglages → 🤖 Modèles IA locaux → cliquez sur Télécharger à côté de n'importe quel modèle. Barre de progression incluse. Fonctionne depuis iPad/iPhone sur le même WiFi qu'un Mac exécutant Ollama.

**Option B — Ligne de commande :**

Installez [Ollama](https://ollama.com), puis :

```bash
ollama pull dcostenco/prism-coder:1b7   # 1.1 Go — toute machine, iPhone 12+ — 100% de routage (v42)
ollama pull dcostenco/prism-coder:8b    # 4.7 Go — iPhone/iPad 8 Go, Mac M1+ — 100% de routage (v36)
ollama pull dcostenco/prism-coder:14b   # 8.4 Go — Mac 16 Go+, iPad Pro — 100% de routage (v36)
ollama pull dcostenco/prism-coder:32b   # 16 Go  — Mac M2 Ultra+ (MoE) — 100% de routage (v7)
```

Ajoutez à `.env.local` : `LOCAL_LLM_URL=http://localhost:11434`

**iPad Pro / iPhone sur WiFi :**
```bash
OLLAMA_HOST=0.0.0.0 ollama serve   # sur Mac
# Puis dans l'application Réglages → IA locale → entrer : http://<mac-ip>:11434
```

Routage automatique : 1.7B → tout appareil · 8B → mobile/périphérique · 14B → standard · 32B → cloud/entreprise. Repli cloud lorsque Ollama est inaccessible.

---

<details>
<summary><strong>📚 Architecture technique (routage de modèle, voix, reconnaissance de gestes, détails de construction)</strong></summary>

**Pile technologique** : Next.js, Zustand, API Web Speech (transcription), Inworld TTS-2 + repli Azure Neural (parole), FaceLandmarker (gestes).

**Routage de modèle** (côté serveur via le portail Synalux) :
-   **Sur l'appareil** (toucher un bouton → phrase) : `prism-coder:1b7` (Qwen3-1.7B Q4_K_M, llama.cpp Metal) — zéro réseau, zéro coût, ~1.6s
-   **Cloud simple** (chat, niveau gratuit) : `prism-coder:14b` (Qwen3-14B affiné) → repli Gemini 2.5 Flash
-   **Cloud complexe** (raisonnement, niveau pro) : `prism-coder:32b` (QwQ-32B affiné) → repli Claude Sonnet 4
-   **Correction automatique + prédiction de mots** : Gemini 2.5 Flash-Lite — 752 ms en moyenne, multilingue (ro/ru/es)
-   Les chemins critiques en termes de vitesse (toucher un bouton → parole) contournent le routage — ne bloquent jamais sur le réseau
-   Précision du routage ([évaluation Prism de 102 cas](https://github.com/dcostenco/prism-coder/tree/main/tests/benchmarks/prism-routing-100), prompt système v36/v7, moyenne de 3 graines, mai 2026) :

    | Modèle | Précision | Latence moyenne | Outils inventés |
    |---|---|---|---|
    | prism-coder:32b swe14 (local) | **100.0%** | 1.4s | 0 |
    | Cascade 14B→32B (local) | **100.0%** | ~1.1s | 0 |
    | prism-coder:8b v36 (local) | **100.0%** | 0.8s | 0 |
    | prism-coder:14b v36 (local) | **100.0%** | 1.1s | 0 |
    | Sonnet 4 (cloud) | **99%** | 3.2s | 0 |
    | Opus 4.7 (cloud) | **98.3%** | 3.0s | 0 |
    | prism-coder:1b7 v42 (local) | **100.0%** | 1.6s | 0 |

-   Évaluation étendue — eval_300 (300 cas, 17 outils, 9 catégories, 3 graines) : prism-coder:32b = **300/300 (100 %)**

**Voix (TTS)** chaîne de repli :
-   Niveau 1 : Inworld TTS-2 (payant toutes langues ; gratuit pour ro/uk/ru/de/ko/ar où Synalux prend en charge le coût)
-   Niveau 2 : Voix premium de l'API Web Speech de l'OS (hors ligne)
-   Niveau 3 : WASM espeak-ng (dernier recours)

**Reconnaissance de gestes** :
-   Basique : pose de la tête + clic par fixation via FaceLandmarker
-   Avancé : pose de la main via MediaPipe ; profils de gestes par utilisateur

**Architecture** : navigation uniquement modale (pas de routeur), thème via tokens.bg/text/border/accent.

**Documentation détaillée dans ce dépôt :**
-   [`docs/TTS-ARCHITECTURE.md`](../../docs/TTS-ARCHITECTURE.md) — routage vocal complet
-   [`docs/GESTURE_RECOGNITION.md`](../../docs/GESTURE_RECOGNITION.md) — internes du mode gestuel
-   [`docs/ADAPTIVE-ENGINE-BEHAVIOR.md`](../../docs/ADAPTIVE-ENGINE-BEHAVIOR.md) — changement de tonalité automatique
-   [`docs/EMERGENCY-NATIVE-ARCHITECTURE.md`](../../docs/EMERGENCY-NATIVE-ARCHITECTURE.md) — chemin d'alerte critique pour la vie
-   [`docs/SELF-LEARNING-SAFETY.md`](../../docs/SELF-LEARNING-SAFETY.md) — garde-fous d'apprentissage par utilisateur
-   [`docs/TRACKING_RELIABILITY.md`](../../docs/TRACKING_RELIABILITY.md) — harnais de fiabilité du suivi de la tête/main
-   [`PRECISION_TOUCH.md`](PRECISION_TOUCH.md) — accessibilité des cibles tactiles
-   [`ACCESSIBILITY.md`](ACCESSIBILITY.md) · [`SECURITY.md`](SECURITY.md) · [`GOVERNANCE.md`](GOVERNANCE.md) · [`AGENTS.md`](AGENTS.md)
-   [`RESEARCH.md`](RESEARCH.md) — base de preuves
-   [`CHANGELOG.md`](CHANGELOG.md) — historique des versions

</details>

<details>
<summary><strong>🆕 Pourquoi PrismAAC est différent (la pile d'algorithmes sous-jacente)</strong></summary>

**Trois choses qu'aucune autre application CAA sur le marché ne fait ensemble :**

### 1. IA embarquée + HIPAA-sûr par défaut

**Pourquoi l'IA locale est importante pour la CAA — vitesse, sécurité et fiabilité :**

| | IA cloud uniquement | PrismAAC (local d'abord) |
|--|---|---|
| Toucher un bouton → parole | 2–30s (aller-retour réseau) | **~0.5s** (sur l'appareil) |
| Fonctionne hors ligne | ❌ Non | ✅ Oui |
| PHI quitte l'appareil | ✅ Toujours | ❌ Jamais (chemin de parole) |
| Conformité HIPAA | Nécessite un BAA avec chaque fournisseur | **Sur l'appareil = pas de BAA nécessaire** |
| Rural / mauvais WiFi | Cassé | **Entièrement fonctionnel** |
| Coût mensuel par utilisateur | 2–15 $ de frais API | **0 $ (local)** |

**Le modèle 1.7B s'exécute entièrement sur votre appareil** — iPad M1+, Mac ou ordinateur portable. Un enfant qui appuie sur un bouton obtient une réponse en ~500 ms sans aucun appel réseau. Aucune PHI, aucun énoncé, aucun modèle de communication ne quitte jamais l'appareil pendant l'utilisation normale.

Les notes des aidants sont chiffrées localement avant toute synchronisation cloud optionnelle. Les plateformes CAA comparables uniquement cloud (synchronisation cloud TouchChat, Proloquo2Go) nécessitent des téléchargements de compte pour fonctionner — PrismAAC non.

**Pour les déploiements en entreprise / cliniques (14B + 32B) :** les modèles 14B et 32B s'exécutent sur un Mac dédié via Ollama sur le réseau clinique. Les iPad se connectent via le WiFi local — les données ne quittent jamais le bâtiment. Aucun accord avec un fournisseur cloud n'est nécessaire pour la conformité HIPAA.

**Comment le configurer :**

```
iPad / iPhone (sur le même WiFi que le Mac)
    ↓  se connecte à
Mac exécutant Ollama (OLLAMA_HOST=0.0.0.0)
    ↓  sert
prism-coder:1b7 · :14b · :32b
    ↓  toute l'inférence reste sur
Réseau local — rien n'atteint internet
```

Réglages → 🤖 Modèles IA locaux → entrer l'IP du Mac → tous les modèles disponibles instantanément. Pas de coût cloud. Pas d'exposition aux PHI. Pas de dépendance réseau pour la communication CAA.

### 2. Classement de phrases qui s'adapte à VOTRE enfant
Les listes de fréquences statiques sont obsolètes. PrismAAC classe les phrases suggérées via l'[**activation diffuse Prism v14.0.0**](https://github.com/dcostenco/prism-coder/blob/main/docs/WOW_FEATURES.md) — le même modèle de mémoire cognitive ACT-R derrière des décennies de recherche de Carnegie Mellon. Récence × fréquence × historique par utilisateur, pas une liste de popularité statique. Les phrases que l'enfant dit aujourd'hui remontent ; les phrases inutilisées pendant un an s'estompent (décroissance du taux d'apprentissage `d=0.25`, ~1 an de demi-vie).

### 3. Les corrections des aidants deviennent des données d'entraînement — automatiquement
Lorsqu'un aidant corrige une suggestion que le modèle a mal comprise (par exemple, "non, le mot est *manger*, pas *vouloir*"), le [collecteur post-vol des hooks d'audit](https://github.com/dcostenco/prism-coder/blob/main/docs/WOW_FEATURES.md#7-the-recipe-combining-all-of-the-above) extrait l'erreur et la persiste. Après environ 50 sessions, le système avertit *avant* que le modèle ne fasse une erreur similaire. Pas de travail d'étiquetage pour les aidants, pas de coûteuses exécutions de réentraînement — les corrections sont le programme.

**Portée honnête :** Précision du routage sur l'[évaluation Prism de 102 cas](https://github.com/dcostenco/prism-coder/tree/main/tests/benchmarks/prism-routing-100) (6 outils Prism, 12 catégories, prompt système v36/v7, graines 2027–2029) : 32b v7 = 100.0 %, 8b v36 = 100.0 %, 14b v36 = 100.0 %, 1.7b v42 = 100.0 %. Aucun nom d'outil inventé sur toutes les tailles de modèle et toutes les graines. Le 1.7B s'exécute sur l'appareil pour un routage rapide des phrases (chargement/enregistrement/compactage) ; les 14B/32B gèrent les sessions complexes et les flux de travail cliniques. Sur le classement complet Berkeley BFCL V4 (plus de 2 000 cas, appel de fonction général), le 1.7B obtient ~59 % — comparable à d'autres modèles de moins de 2B. Ce qui rend PrismAAC défendable n'est pas le score du modèle seul — c'est le modèle plus la pile d'algorithmes d'activation diffuse Prism qui l'entoure.

</details>

---

## Licence

[AGPL-3.0](LICENSE) — open source, approuvée par l'OSI, éligible aux subventions.

Vous êtes libre de forker et de vous auto-héberger. La licence vous oblige également à partager les modifications sous AGPL-3.0 — c'est l'accord qui maintient l'innovation en CAA ouverte et accessible aux familles.