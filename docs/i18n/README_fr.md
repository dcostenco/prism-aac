<!-- Auto-generated from README.md by scripts/generate_i18n.py — do not edit manually -->
# Prism AAC

**Aider les enfants et adultes non verbaux à s'exprimer.**

Application de Communication Alternative et Améliorée (CAA) pour les enfants présentant des déficiences motrices et des besoins de communication complexes. Appuyez sur des images, composez des phrases, écoutez-les prononcées à haute voix — en 25 langues (28 déclinaisons régionales). Fonctionne sur n'importe quelle tablette, ordinateur portable, iPhone, iPad et Apple Watch.

Fait partie de la [plateforme Synalux](https://synalux.ai).

**Essayez dès maintenant :**
- **Application Web (gratuite) :** [synalux.ai/prism-aac](https://synalux.ai/prism-aac) — fonctionne sur tout appareil doté d'un navigateur
- **iOS (iPhone + iPad + Apple Watch) :** [App Store](https://apps.apple.com/app/id6764692277)
- **Tarifs :** [synalux.ai/pricing](https://synalux.ai/pricing) — gratuit, avec un forfait optionnel Prism AAC Cloud (4,99 US$/mois) pour la synthèse vocale naturelle et les quotas d'IA cloud

🌐 [English](../../README.md) · [Español](README_es.md) · **Français** · [Português](README_pt.md) · [Română](README_ro.md) · [Українська](README_uk.md) · [Русский](README_ru.md) · [Deutsch](README_de.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [中文](README_zh.md) · [العربية](README_ar.md)

<p align="center">
  <a href="https://apps.apple.com/app/id6764692277"><img src="https://img.shields.io/badge/App_Store-Download-0D96F6?style=for-the-badge&logo=apple&logoColor=white" alt="App Store"></a>
  <a href="https://synalux.ai/prism-aac"><img src="https://img.shields.io/badge/Try_It-Free-43e97b?style=for-the-badge" alt="Try Free"></a>
  <a href="https://synalux.ai/pricing"><img src="https://img.shields.io/badge/Plans-Free_+_Paid-764ba2?style=for-the-badge" alt="Pricing"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue?style=for-the-badge" alt="AGPL-3.0"></a>
  <a href="PRIVACY.md"><img src="https://img.shields.io/badge/Privacy-Policy-lightgrey?style=for-the-badge" alt="Privacy"></a>
  <a href="TERMS.md"><img src="https://img.shields.io/badge/Terms-of_Service-lightgrey?style=for-the-badge" alt="Terms"></a>
</p>

![Écran principal de Prism AAC sur iPad — barre d'outils, barre de saisie, cinq tuiles de prédiction et clavier AZERTY complet (application web de production, 1.9.0)](../../docs/screenshots/app-hero.png)

### Applications natives

<p align="center">
  <img src="../../docs/screenshots/ios-iphone.png" alt="PrismAAC sur iPhone" width="220" />
  <img src="../../docs/screenshots/ios-ipad.png" alt="PrismAAC sur iPad" width="360" />
  <img src="../../docs/screenshots/watch-ultra.png" alt="PrismAAC sur Apple Watch Ultra" width="120" />
</p>

<sub>Captures d'écran iPhone et iPad réalisées sur la version 1.9.0 (53) exécutant l'application web de production, 08-09-2026. Capture Watch issue de la version 1.4.0.</sub>

| Plateforme | État | IA sur l'appareil | Remarques |
|------------|------|-------------------|-----------|
| **Web** (PWA) | ✅ Production | Télécharge auto le meilleur modèle local | Tout navigateur, installable ; forfait Cloud via Stripe |
| **iPad Pro 16GB** | ✅ Production | IA 4B sur l'appareil (précision 100%) | Le plus rapide, totalement privé ; forfait Cloud via achat intégré Apple |
| **iPhone Pro 8GB** | ✅ Production | IA 4B Q4_K_M sur l'appareil (précision 100%) | Sélectionné automatiquement selon la RAM |
| **Tous les iPhones** | ✅ Production | IA 2B Q3_K_M sur l'appareil (précision 99,1%) | 2,3 Go — compatible avec tous les iPhones |
| **Apple Watch** | ✅ Production | Phrases hors ligne (1 261 × 20 langues) | Autonome — pictogrammes, TTS, urgence |
| **Extension Chrome** | ✅ Production | — | Assistant de lecture dans tout champ de texte |
| **WiFi vers Mac** | ✅ Production | 9B/27B via Ollama | Paramètres → IA locale → entrer l'IP du Mac |

---

## Vidéo d'aperçu App Store

Vidéo de 30 secondes présentant toutes les fonctionnalités majeures avec narration Inworld TTS :

https://github.com/dcostenco/synalux-docs/releases/download/v1.0-module-videos/prism_aac_preview_v5.mp4

| Scène | Fonctionnalité | Capture d'écran |
|---|---|---|
| **Accueil** — appuyer sur les phrases | Tableau de pictogrammes avec 22 catégories, bouton Parler | <img src="../../docs/screenshots/appstore/ipad_home.png" width="200"> |
| **Catégories** | Phrases rapides pour Aide, Nourriture, Lieux, Émotions | <img src="../../docs/screenshots/appstore/ipad_categories.png" width="200"> |
| **Chat IA** | Composer des messages, pratiquer des conversations | <img src="../../docs/screenshots/appstore/ipad_ai-chat.png" width="200"> |
| **Alerte d'urgence** | Appel de l'aidant/infirmier en un seul geste | <img src="../../docs/screenshots/appstore/video/frame_03.png" width="200"> |
| **Emploi du temps** | Routines quotidiennes visuelles — matin, école, déjeuner, coucher | <img src="../../docs/screenshots/appstore/ipad_schedule.png" width="200"> |
| **Jeux** | Éclater des bulles, Chasse aux couleurs, Associer, Oui/Non, Compléter | <img src="../../docs/screenshots/appstore/ipad_games.png" width="200"> |
| **Maths & École** | Maths adaptatives avec Indice, Vérifier, Résoudre + pavé numérique | <img src="../../docs/screenshots/appstore/video/frame_06.png" width="200"> |
| **Poursuite oculaire & céphalique** | Curseur à fixation par caméra, contrôle du regard, étalonnage | <img src="../../docs/screenshots/appstore/video/frame_07.png" width="200"> |
| **12 Langues** | Anglais, Espagnol, Français, Russe, Japonais, Coréen, Chinois, Arabe et plus | <img src="../../docs/screenshots/appstore/video/frame_08.png" width="200"> |

---

## Aperçu rapide

| Module | Rôle | Aperçu |
|---|---|---|
| 📂 **Catégories** | Tuiles d'images style PECS pour non-lecteurs | <img src="../../docs/screenshots/panel-categories.png" width="120"> |
| ⌨️ **Saisir & parler** | Clavier + prédiction de mots + voix neurale | <img src="../../docs/screenshots/app-hero.png" width="120"> |
| ✨ **Chat IA** | Assistant sur l'appareil + cloud adapté aux utilisateurs de CAA | <img src="../../docs/screenshots/panel-ai-chat.png" width="120"> |
| 💬 **Chat CAA** | Messages entrants des aidants + contacts | <img src="../../docs/screenshots/panel-aac-chat.png" width="120"> |
| 🧮 **Maths + matières** | Canvas à grille de cellules avec tuteur spécialisé | <img src="../../docs/screenshots/math-canvas-typed.png" width="120"> |
| 🗓 **Emploi du temps** | Routines visuelles de type "d'abord-ensuite" | <img src="../../docs/screenshots/panel-schedule.png" width="120"> |
| 🎮 **Jeux** | 12 jeux de CAA thérapeutiques | <img src="../../docs/screenshots/panel-games.png" width="120"> |
| 🏪 **Boutique** | Packs de voix, de vocabulaire, de jeux | <img src="../../docs/screenshots/panel-marketplace.png" width="120"> |
| 🎧 **Lecteur Réconfort** | Lecteur multimédia de chevet pour patients hospitalisés | <img src="../../docs/screenshots/panel-comfort-player.png" width="120"> |
| 🛏 **Mode Chevet** | Chat IA en plein écran pour téléphone sur support / utilisation allongée | <img src="../../e2e/_screenshots/bedside-overlay-open.png" width="120"> |
| 👁 **Contexte visuel** | La caméra détecte les objets → suggère des phrases adaptées | <img src="../../docs/screenshots/vision-mealtime.png" width="120"> |
| 👋 **Mains libres** | Reconnaissance des mouvements de la tête + gestes de la main | <img src="../../docs/screenshots/panel-settings-input-modes.png" width="120"> |
| ⚙️ **Paramètres** | 25 langues, adaptations motrices, sélecteur de voix + cache vocal | <img src="../../docs/screenshots/panel-settings.png" width="120"> |
| ☁️ **Synthèse & IA Cloud** | Forfait optionnel à 4,99 US$/mois pour voix naturelles + IA cloud | <img src="../../docs/screenshots/cloud-subscription-iphone.png" width="120"> |

---

## Accessibilité

Prism AAC a fait l'objet d'un [audit d'accessibilité antagoniste de 70 points](ACCESSIBILITY.md) en juin 2026, testé sur iPhone portrait, iPhone paysage, iPad portrait et iPad paysage. Chaque problème a été corrigé et vérifié par des tests e2e automatisés.

### Méthodes de saisie — utilisez n'importe quelle partie du corps

| Méthode | Fonctionnement | Configuration |
|---------|----------------|---------------|
| **Tactile** | Appui standard + tuiles de pictogrammes | Fonctionne immédiatement |
| **Poursuite céphalique** | La caméra suit la tête → clic par fixation | Paramètres → Modes de saisie |
| **Regard oculaire** | Pondération de la position des yeux sur la poursuite céphalique | Paramètres → Modes de saisie |
| **Balayage par contacteur** | Balayage auto/manuel avec contacteur Bluetooth, clavier ou manette | Paramètres → Modes de saisie → Balayage par contacteur |
| **Reconnaissance de gestes** | Clignement, hochement, sourire, bouche ouverte → actions associées | Paramètres → Modes de saisie → Gestes |
| **Saisie vocale** | Dictée avec autocorrection par IA, mains libres, mot d'activation | Bouton micro sur la barre d'outils |
| **Clavier simplifié** | 15 lettres les plus fréquentes dans une grille 3×5 (auto si taille 4) | Paramètres → Taille de grille → 4 |

Navigation dans le tableau d'images : balayez vers la gauche/droite dans la grille de vocabulaire ou sur la bande inférieure des catégories pour parcourir les pages. Sur Mac, utilisez le défilement horizontal du pavé tactile ou le cliquer-glisser ; les flèches latérales restent disponibles. Le changement de page ne choisit pas de mot — appuyez ou cliquez délibérément sur une tuile pour la sélectionner. Le défilement vertical et le pincement pour zoomer ne tournent pas les pages. Voir [navigation par balayage et limites de test](docs/SWIPE_NAVIGATION.md).

### Disposition adaptative — iPhone & iPad, portrait & paysage

<p align="center">
  <img src="../../docs/screenshots/a11y-2026-06-18/01-home-board-iphone-6.1.png" alt="iPhone portrait" width="160" />
  <img src="../../docs/screenshots/a11y-2026-06-18/01-home-board-iphone-6.1-land.png" alt="iPhone paysage" width="280" />
  <img src="../../docs/screenshots/a11y-2026-06-18/01-home-board-ipad-13.png" alt="iPad portrait" width="240" />
</p>

### Modes visuels

<p align="center">
  <img src="../../docs/screenshots/a11y-2026-06-18/06-dark-high-contrast-iphone-6.1.png" alt="Sombre + haut contraste sur iPhone" width="160" />
  <img src="../../docs/screenshots/a11y-2026-06-18/06-dark-high-contrast-ipad-13-land.png" alt="Sombre + haut contraste sur iPad paysage" width="340" />
</p>

- Thèmes **Clair / Sombre / Haut Contraste**
- Requêtes média système **`prefers-contrast: more`** et **`prefers-reduced-motion`**
- **Pincement pour zoomer** activé (jusqu'à 5×) — conforme WCAG 1.4.4
- **16 mots d'urgence × 8 langues** en mode de récupération après plantage

Pour consulter le rapport d'audit complet avec les 70 constatations, voir [ACCESSIBILITY.md](ACCESSIBILITY.md).

---

## Sécurité et confidentialité

PrismAAC est utilisé par des enfants, des adultes non verbaux et des populations cliniques. La sécurité n'est pas une fonctionnalité — c'est une contrainte qui façonne chaque parcours d'inférence.

### Architecture de sécurité en couches

| Couche | Quoi | Où cela s'exécute | Latence |
|--------|------|-------------------|---------|
| **L1 — Barrière de sécurité déterministe** | Interception de crise/médicale basée sur des expressions régulières | Client + serveur (chaque parcours) | 0 ms |
| **L2 — Entraînement du modèle à la sécurité** | Alignement RLHF de Qwen3.5 | Sur l'appareil + cloud | Intégré |
| **L3 — Barrière de confiance** | Rejette les sorties courtes/incohérentes/contenant du texte de modèle de prompt ayant fuité | Sur l'appareil + serveur | 0 ms |
| **L4 — Vérificateur d'ancrage** | Vérification NLI : les affirmations doivent découler logiquement des preuves | Serveur (offres payantes) | ~200 ms |

### Détails de la barrière de sécurité L1

La barrière L1 exécute des vérifications déterministes par expressions régulières sur **l'entrée et la sortie** à travers tous les parcours d'inférence — y compris le parcours Ollama local hors ligne qui contourne entièrement le serveur.

**Ce qu'elle intercepte :** les expressions de crise à la première personne (intention d'auto-mutilation), les instructions dangereuses de dosage médical.

**Ce qu'elle n'intercepte PAS (par conception) :** les termes cliniques génériques (« dose of risperidone », « milligrams », « suicide prevention training »). Ceux-ci apparaissent dans des notes légitimes de BCBA/médicales et les bloquer nuirait aux utilisateurs cliniques que ce produit sert. L'alignement propre du modèle 2B sur l'appareil n'est pas du tout utilisé comme garantie de sécurité (il obtient ~59 % sur BFCL V4 général). L1 est le mécanisme de sécurité déterministe principal.

**Limitations connues de L1 :**
- **Couverture linguistique inégale.** Les phrases de crise sont comparées en anglais et dans d'autres langues, et les ensembles diffèrent selon le parcours. La barrière du chat IA web (`services/crisisSafetyFilter.ts`) recherche également des phrases en espagnol, français, portugais, roumain, russe, ukrainien, arabe, allemand, japonais, coréen, chinois et bulgare. La vérification hors ligne côté client (`checkInputSafetyClient`) recherche également en espagnol, français, portugais, russe, arabe, allemand et ukrainien. La barrière iOS possède sa propre liste intégrée (anglais, espagnol, français, roumain, russe, arabe et hébreu) et ajoute des mots-clés provenant du serveur au lancement lorsqu'elle peut l'atteindre. Les motifs de dosage médical sont uniquement en anglais sur chaque parcours client. Une langue prise en charge sans motifs sur un parcours donné est protégée uniquement par l'entraînement propre du modèle à la sécurité (L2).
- **L'expression régulière est un plancher, pas un plafond.** La détresse paraphrasée (« I don't want to be here anymore ») n'est pas détectée. L1 intercepte les formulations définies à fort signal ; L2 (alignement du modèle) gère la longue traîne.

**Couverture par parcours :**

| Parcours | Entrée L1 | Sortie L1 | Notes |
|----------|:---------:|:---------:|-------|
| Ollama local (hors ligne, web) | ✅ côté client | ✅ côté client | `checkInputSafetyClient` + `checkOutputSafetyClient` |
| Sur l'appareil iOS (llama.cpp) | ✅ natif | ✅ natif | `SafetyFilter.swift` (`../../ios-native/PrismAAC/Sources/Safety/`) ; la vérification de la sortie intercepte le contenu de jailbreak uniquement |
| Portail `/prism-aac/chat` | ✅ | flux continu* | Entrée vérifiée avant l'appel au modèle |
| Portail `/prism-aac/infer` | ✅ | ✅ | Module partagé de motifs de sécurité |
| Portail `/prism-aac/inference` | ✅ | ✅ | Module partagé de motifs de sécurité |

*Les réponses cloud en flux continu s'appuient sur la sécurité du modèle (L2) pour la sortie — L1 ne peut pas filtrer par expression régulière un flux de jetons en cours de route.

### À quoi ressemble une interception de crise

Si un utilisateur saisit de la détresse via l'interface CAA, L1 répond immédiatement (avant qu'aucun modèle ne s'exécute) :

> "I'm concerned about your safety. Please call or text 988 (Suicide & Crisis Lifeline) right now — available 24/7. If in immediate danger, call 911. You are not alone."

### Confidentialité

- L'IA sur l'appareil traite les prompts localement — aucune donnée ne quitte l'appareil
- Les services vocaux cloud et l'IA cloud (lorsqu'ils sont utilisés) vont vers le portail Synalux via TLS ; le texte est traité en mémoire et n'est pas stocké
- Aucun prompt d'utilisateur n'est stocké ou utilisé pour l'entraînement
- Aucun compte n'est requis ; la télémétrie anonyme d'utilisation/d'erreur (Datadog) ne contient jamais de texte saisi ou parlé
- Voir [PRIVACY.md](../../PRIVACY.md) pour la politique de confidentialité complète

---

## Alternative gratuite à Read & Write

PrismAAC intègre toutes les fonctionnalités d'assistance à la lecture pour lesquelles la plupart des utilisateurs de CAA achètent Read & Write — gratuitement, dans le navigateur, sans aucun compte requis pour la version web. Voir [Saisir & parler](#%EF%B8%8F-saisir--parler) pour la lecture en fin de phrase + le surlignage des mots, [Lecteur PDF](#-lecteur-pdf) et [Lecteur d'affichage (OCR)](#-lecteur-daffichage-ocr) pour les documents, ainsi que [l'extension Chrome](#-extension-chrome--les-m%C3%AAmes-fonctionnalit%C3%A9s-dassistance-%C3%A0-la-lecture-dans-tout-champ-de-texte) pour une utilisation transversale dans Gmail / Docs / Word Online / partout ailleurs.

## Comparatif de PrismAAC

| | PrismAAC | TouchChat | Proloquo2Go | LAMP Words | TD Snap | CoughDrop | Snap Core First | Grid 3 | Tobii Dynavox |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Caméra → suggestion de phrases** (détecte les objets, suggère des mots) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **IA sur l'appareil** (routage 99–100%, compatible HIPAA) | 🟢 | 🔴 | 🔴 | 🔴 | 🟡 | 🟡 | 🔴 | 🔴 | 🟡 |
| **Classement des phrases par utilisateur** (s'adapte à chaque enfant) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| Les corrections des aidants **deviennent des données d'entraînement** | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Tuteur IA** (maths + 10 autres matières) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Canvas de maths à grille de cellules** | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Historique adapté à la région** (280+ régions) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Mains libres** tête + main + gestes + balayage par contacteur | 🟢 | 🟡 | 🟡 | 🔴 | 🟢 | 🟡 | 🟡 | 🟢 | 🟢 |
| **Chat IA mains libres** (boucle vocale + mot d'activation + chevet) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Jeux de CAA** thérapeutiques (12 intégrés) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🟡 | 🟡 | 🔴 | 🔴 |
| **Open source** (AGPL-3.0) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🟢 | 🔴 | 🔴 | 🔴 |
| **Offre gratuite** (accès vital garanti) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🟢 | 🔴 | 🔴 | 🔴 |
| **Boutique** de packs vocaux | 🟢 | 🔴 | 🟡 | 🔴 | 🟡 | 🔴 | 🔴 | 🟡 | 🟡 |
| **Multilingue** (25 langues) | 🟢 | 🟢 | 🟢 | 🔴 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| **Notes de l'aidant** (maison / école / clinique) | 🟢 | 🔴 | 🔴 | 🔴 | 🟡 | 🟡 | 🟡 | 🔴 | 🟡 |
| Mode autonome **Apple Watch** | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| Assistant de lecture **Extension Chrome** | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |

🟢 = pris en charge complètement &nbsp;&nbsp; 🟡 = partiel &nbsp;&nbsp; 🔴 = non disponible

> Ce comparatif reflète les informations publiques sur les produits en date de mai 2026. PrismAAC est en développement actif ; les concurrents sont susceptibles d'ajouter des fonctionnalités. Les PR sont les bienvenues pour maintenir l'exactitude de ce tableau — voir `CONTRIBUTING.md`.
>
> Grid 3 et Tobii Dynavox proposent des intégrations matérielles poussées pour la poursuite oculaire et le balayage par contacteur non représentées ci-dessus (dépendantes du matériel, installations cliniques spécialisées).

---

## iOS & Apple Watch

### iPhone / iPad

Application Swift native enveloppant l'interface web dans une WKWebView avec une architecture **Double Moteur d'IA sur l'appareil** via llama.cpp Metal.

Afin de garantir un accès IA instantané et hors ligne sur tous les appareils, l'application exécute automatiquement deux modèles différents en simultané selon la mémoire disponible :

| Appareil | RAM | IA Conversationnelle | Précision de routage | Saisie semi-automatique |
|---|---|---|---|---|
| iPad Pro M1/M2/M4 | ≥ 16 Go | 4B Q4_K_M (3,4 Go) | **100%** | 360M (intégré) |
| iPhone 15/16 Pro, iPad Air | 8–15 Go | 4B Q4_K_M (3,4 Go) | **100%** | 360M (intégré) |
| Tous autres iPhones / iPads | < 8 Go | 2B Q3_K_M (2,3 Go) | **99,1%** | 360M (intégré) |

> Précision : benchmark BFCL, 115 cas de routage d'outils × 3 graines mélangées, température=0, juin 2026.

#### IA sur l'appareil — fonctionne hors ligne dès le premier lancement

Chaque appareil est livré avec un modèle d'IA intégré à l'application. Aucun téléchargement, aucune connexion WiFi ni aucun compte requis — ouvrez l'application et commencez à communiquer.

| Appareil | Modèle intégré | Taille | Rôle |
|---|---|---|---|
| **iPhone / iPad** | Qwen3.5-4B Q3_K_M | 2,3 Go | Routage d'outils, Mains libres, Mode Chevet, Mot d'activation (précision 99,1%) |
| **Apple Watch** | SmolLM2-360M | 207 Mo | Extension de symboles, phrases d'urgence, texte prédictif (précision 100%) |

Des modèles plus grands (9B, 27B) sont disponibles via Paramètres → IA locale pour le routage WiFi vers Mac (précision BFCL 100%).

<details>
<summary><strong>Détails techniques</strong></summary>

- **Filtre de sécurité déterministe L1 :** interception regex de crise/médicale sur l'entrée (avant l'exécution du modèle) et sur la sortie (avant d'atteindre l'utilisateur). Les schémas ciblent spécifiquement l'intention d'auto-mutilation — les termes cliniques/pharmacologiques génériques ("dose de", "milligrammes") ne sont PAS interceptés pour éviter de bloquer l'usage clinique légitime de la CAA.
- **Sécurité de sortie côté client :** les résultats Ollama locaux passent par `checkOutputSafetyClient` avant l'affichage — les utilisateurs hors ligne bénéficient de la même protection L1 que les utilisateurs cloud.
- **Filtre de confiance :** les sorties sur l'appareil inférieures aux seuils de longueur/qualité sont rejetées et transmises au cloud (forfaits payants) ou dégradées proprement (forfait gratuit).
- La dégradation selon la mémoire s'effectue proprement : IA complète → IA cloud → fonctions de base uniquement → mode urgence
- Repli OOM : 4B Q4_K_M → 2B Q3_K_M → 360M
- Prise en compte de la zone sécurisée (Safe Area) pour Dynamic Island / encoche
- Pont WCSession pour l'envoi d'urgence Apple Watch
- Jetons d'authentification stockés dans le Trousseau (Keychain)

</details>

**Paramètres → 🤖 Modèles d'IA locaux** — télécharger et gérer les modèles sur l'appareil :
- Détection automatique d'Ollama sur `localhost:11434`
- WiFi vers Mac : iPad/iPhone → Ollama Mac (9B/27B à 100% de précision BFCL)
- Téléchargement modèle par modèle avec barre de progression en direct
- Modèles : `:2b` (2,3 Go) · `:4b` (3,4 Go) · `:9b` (5,8 Go) · `:27b` (16,8 Go)


### Apple Watch (autonome)

Fonctionne sans iPhone — mode autonome avec dictionnaire de phrases hors ligne.

<p align="center">
  <img src="../../docs/screenshots/watch-series.png" alt="Watch Series 11" width="140" />
  <img src="../../docs/screenshots/watch-ultra.png" alt="Watch Ultra 3" width="140" />
</p>

- **Traduction hors ligne :** 1 261 phrases × 20 langues intégrées (JSON de 411 Ko) — recherche instantanée, 100% précise, sans réseau
- Grille de pictogrammes à 2 colonnes avec images ARASAAC
- Chat IA avec dictée + saisie au clavier (cloud en ligne, dictionnaire de phrases hors ligne)
- Système d'urgence : compte à rebours → WCSession → repli cellulaire → synthèse vocale
- Traduction avec sortie vocale (dictionnaire hors ligne en priorité, repli cloud)
- Boîte de réception : recevoir et répondre aux messages des aidants
- Épinglage de certificat (SPKI SHA-256) pour les envois d'urgence
- Assainissement NFKC + nettoyage d'injection à 23 jetons sur tous les parcours d'IA

---

## 📊 Tableau de bord des statistiques de l'aidant (v1.8)

L'application enregistre en interne des données comportementales riches — précision de la prédiction, tendances motrices, fiabilité vocale, stabilité de la poursuite céphalique, schémas de communication, corrections de l'aidant. Auparavant, **aucune de ces données n'atteignait les aidants**. La seule interface aidant était un bloc-notes texte.

Un **onglet Statistiques** est désormais intégré dans le Panneau de l'aidant avec 7 widgets de suivi en direct, appuyés par un collecteur de métriques en arrière-plan qui s'exécute toutes les 5 minutes sans impacter le parcours de prédiction.

### Ce que voient les aidants

| Widget | Indication | Valeur clinique |
|---|---|---|
| **Efficacité de la prédiction** | "Taux de réussite de 72% ↑ vs 24h préc." | Le jeu de vocabulaire est adapté — ou non |
| **Adoption du vocabulaire** | "45 actifs · 12 nouveaux · 8 inutilisés" | Quelles phrases sont adoptées, lesquelles retirer |
| **Sujets de communication** | "Top : école (35%), repas (22%)" | Les variations de sujets peuvent signaler une régression ou un changement d'environnement |
| **Tendance motrice** | "Fixation 850ms ↓ (amélioration)" | Contrôle moteur en amélioration → fixation plus courte ; en baisse → orienter vers un ergothérapeute |
| **Fiabilité du suivi** | "2 dérivations · 98% de disponibilité" | Dérivations fréquentes → vérifier la posture, la fatigue, l'étalonnage |
| **Fiabilité vocale** | "97% de succès · 1 repli" | Azure TTS échoue ? Clé API expirée ? Problème de connectivité ? |
| **Charge de correction** | "47 corrections au total" | Taux de correction en hausse = le modèle nécessite un réentraînement pour cet enfant |

### Disposition du tableau de bord

| Panneau de l'aidant | | ✕ |
|:---|:---|---:|

| + Note | Journal | **Statistiques** |
|:---:|:---:|:---:|

> **Efficacité de la prédiction**
> `72% de réussite` &nbsp;&nbsp; ↑ vs 24h
> ![sparkline](https://img.shields.io/badge/trend-72%25_____85%25_____78%25_____72%25-4CAF50?style=flat-square)

> **Adoption du vocabulaire**
> `45 actifs` · `12 nouveaux` · `8 inutilisés`
> `████████████████░░░░░░` adoptés 69% / essayés 18% / inutilisés 13%

> **Sujets de communication**
> `école` 35% · `repas` 22% · `jeu` 18%
> ![sparkline](https://img.shields.io/badge/school-35%25-9C27B0?style=flat-square) ![sparkline](https://img.shields.io/badge/food-22%25-FF9800?style=flat-square) ![sparkline](https://img.shields.io/badge/play-18%25-2196F3?style=flat-square)

> **Tendance motrice**
> `Fixation 850ms` &nbsp;&nbsp; ↓ amélioration
> ![sparkline](https://img.shields.io/badge/trend-1200____1100____950_____850ms-FF9800?style=flat-square)

> **Fiabilité du suivi**
> `2 dérivations aujourd'hui` · `98% de disponibilité`
> ![sparkline](https://img.shields.io/badge/uptime-98%25-4CAF50?style=flat-square)

> **Fiabilité vocale**
> `97% de succès` · `1 repli`
> `██████████████████████████████░` Azure 94% / Synthèse Web 3% / échec 3%

> **Charge de correction**
> `47 corrections au total` &nbsp;&nbsp; +3 cette semaine
> ![sparkline](https://img.shields.io/badge/trend-38_____41_____44_____47-795548?style=flat-square)

<sub>286 points de données · 7 derniers jours · mise à jour toutes les 5 min</sub>

### Architecture

```
Appui sur PredictionBar --> recordPredictionHit() (import dynamique, ~0.01ms)
                                     |
        +--------------------------------------------+
        |      metricsCollector (minuteur 5 min)     |
        |                                            |
        |  subscribeTtsHealth() ------> ttsAccum     |
        |  subscribeTrackingEvents() -> trackAccum   |
        |  getAdaptiveSignals() ------> moteur/sujets|
        |  corpusHealth() ------------> corrections  |
        |  phraseUsageStore ----------> vocabulaire  |
        |                                            |
        |  flushBucket() -> metricsStore.buckets     |
        +--------------------------------------------+
                                     |
        +--------------------------------------------+
        |  metricsStore (zustand + localStorage)     |
        |  glissant sur 7 jours - blocs 5m - 400Ko   |
        +--------------------------------------------+
                                     |
        +--------------------------------------------+
        |  CaregiverInsightsTab (chargement différé) |
        |  7 widgets InsightCard + Sparkline SVG     |
        |  Rendu uniquement quand l'aidant clique    |
        +--------------------------------------------+
```

### Garanties de performance

| Domaine | Garantie |
|---|---|
| **Parcours de saisie** | 0 ms ajoutée — la détection de réussite/échec utilise des imports dynamiques + incrémentations de compteurs |
| **Mémoire** | ~400 Ko localStorage + ~50 Ko RAM sur 7 jours |
| **Taille de bundle** | ~2 Ko JS (pas de bibliothèque de graphiques — graphiques sparkline en SVG pur) |
| **Hors ligne** | 100% localStorage — aucun appel réseau |
| **iPad** | Cartes à défilement vertical, sparklines 120×32px |
| **Confidentialité** | Aucune information de santé nominative — comptages opérationnels uniquement, protégés par le code PIN aidant |

### Exemple : lire le widget d'efficacité de la prédiction

```
Efficacité de la prédiction
78% de réussite                  ↑ vs 24h préc.
╭──╮ ╭╮╭─╮
│  ╰─╯╰╯ ╰──╮╭──
```

- **78% de réussite** : 78% du temps, l'enfant a sélectionné un mot dans la barre de prédiction au lieu de le saisir manuellement. Cela indique que le jeu de vocabulaire correspond bien aux habitudes de communication de l'enfant.
- **↑ vs 24h préc.** : le taux de réussite s'est amélioré par rapport à la veille — le moteur adaptatif apprend.
- **Sparkline** : affiche la tendance du taux de réussite sur les dernières 24 heures. Les baisses peuvent être liées à de nouveaux sujets ou changements d'environnement.

Si le taux de réussite chute en dessous de 40%, le vocabulaire doit probablement être mis à jour — l'enfant communique sur des sujets non couverts par le moteur de prédiction.

### Exemple : lire le widget de tendance motrice

```
Tendance motrice
Fixation 1200ms                ↑ en hausse
╭──╮
│  ╰──╮╭──╮╭─
```

- **Fixation 1200ms** : l'enfant doit maintenir son regard 1,2 seconde sur un élément pour déclencher la sélection. Plage classique : 800–2000 ms.
- **↑ en hausse** : le temps de fixation augmente (l'enfant a besoin de plus de temps). Cela peut indiquer de la fatigue, un changement de traitement ou une baisse progressive du contrôle moteur.
- **Action** : si la tendance persiste plus de 3 jours, signaler à l'ergothérapeute. L'application adapte automatiquement le temps de fixation, mais un bilan clinique est conseillé.

---

## Modules

### 📂 Catégories

En mode Image, la Taille de grille définit le nombre de tuiles par page de vocabulaire (4 correspond à 2 × 2 ; 6 correspond à 3 × 2). Balayez vers la gauche ou la droite sur le tableau pour parcourir, ou utilisez les flèches à côté du titre de la catégorie. La navigation n'ajoute pas de mot et ne déclenche pas la voix ; appuyez sur une tuile pour la sélectionner. La position de la page est annoncée aux lecteurs d'écran sans pied de page visible séparé.

Tuiles d'images style PECS. Appuyez sur une catégorie, appuyez sur une tuile, écoutez le mot, observez son ajout dans la barre de message. Convient aux non-lecteurs, pré-lecteurs et communicateurs en apprentissage. Les ensembles de tuiles et leur ordre s'adaptent progressivement au fil du temps via la propagation d'activation — les tuiles les plus utilisées remontent ; celles inutilisées pendant plusieurs mois s'estompent.

**Disposition enveloppante** — les catégories apparaissent dans une colonne défilante à gauche du clavier, permettant à l'utilisateur de CAA d'appuyer sur des tuiles d'images ET de saisir du texte simultanément sans changer de mode. La barre de prédiction reste visible ; les deux modes de saisie sont toujours accessibles.

![Catégories en mode enveloppant — cartes de catégories défilantes à gauche, clavier complet à droite](../../docs/screenshots/categories-surround-v2.png)

<details>
<summary><strong>Fonctionnalités + détails techniques</strong></summary>

- 22 catégories par défaut : personnes, nourriture, émotions, corps, vêtements, animaux, lieux, etc.
- L'aidant peut ajouter / supprimer / réordonner les tuiles pour chaque enfant
- Chaque tuile possède une clé `textKey` pour l'i18n — changer la langue de l'application réétiquette toutes les tuiles en un seul geste
- Les pictogrammes proviennent d'ARASAAC + d'un jeu sélectionné ; le clonage vocal permet d'associer la voix de la tuile aux frères, sœurs ou parents de l'enfant (forfait payant)
- Apprentissage des n-grammes par utilisateur : un enfant qui clique trois fois sur "Je veux manger" verra "manger" remonter après "veux" lors de la session suivante
- Mémoire holographique HRR : prédictions contextuelles sans recherche en ~0,2ms via Rust WASM — +27% de précision Top-1 sur les phrases clés de CAA

**Parcours de rendu :** `components/CategoryPanel.tsx` → `useCategoryStore` → tuiles extraites de `constants/phrases.ts` (système) + surcharges Supabase par utilisateur (payant). Les appuis sur les tuiles déclenchent `messageStore.appendText(phrase)` et passent par `aacSpeak()` pour la synthèse vocale.
</details>

---

### ⌨️ Saisir & parler
Clavier à l'écran avec **prédiction de mots**, **saisie automatique par IA**, et un bouton **Parler** pour lire le message à haute voix avec une voix neurale naturelle. La saisie alimente le moteur de prédiction : les mots les plus utilisés par l'enfant apparaissent plus rapidement lors de la session suivante.

![Clavier Prism AAC avec "hello" saisi, tuiles de prédiction et bouton Parler](../../docs/screenshots/keyboard-typing.png)

**Fonctionnalités d'assistance à la lecture (équivalence Read & Write)** — pour les utilisateurs ayant des besoins en lecture / mémoire / cognition :

- **Lecture mot à mot** — chaque mot est énoncé par la synthèse vocale dès que vous appuyez sur espace, pour entendre ce qui a été écrit sans attendre la phrase complète.
- **Lecture de la phrase sur `.?!`** — terminer une phrase par un point, un point d'interrogation ou un point d'exclamation relit la phrase entière afin de ne pas perdre le fil (le manque qui disqualifie NVDA pour les utilisateurs voyants avec troubles cognitifs). Activable via Paramètres → `speakOnSentenceEnd` (activé par défaut).
- **Surlignage mot à mot pendant la lecture** — chaque mot prononcé s'illumine avec un fond jaune pendant la lecture. Les utilisateurs voyants ayant des difficultés de lecture peuvent suivre visuellement ; le surlignage suit l'audio sans nécessiter de matériel spécifique.

<details>
<summary><strong>Fonctionnalités + détails techniques</strong></summary>

- 5 emplacements de prédiction au-dessus du clavier, actualisés à chaque frappe
- Saisie automatique par IA ("bonj" → "bonjour", "mange" → "manger") via Synalux `text/correct` (Gemini 2.5 Flash-Lite, ~752ms en moyenne, 4,3× moins cher que 2.5 Flash)
- Filtre inter-langues : le RO `eu` ne s'infiltrera pas dans la barre EN même si les deux corpus sont chargés (comparaison de fréquence inter-corpus)
- "Parler" lit avec adaptation automatique du ton (déclaratif / interrogatif / exclamatif déduit de la ponctuation)
- Chaîne vocale : cache vocal persistant (rejoue sans nouvelle requête) → voix cloud via le portail (Inworld TTS-2 ; Azure Neural pour les langues non couvertes par Inworld ; Gemini TTS en dernier recours cloud) → Synthèse vocale du système d'exploitation (hors ligne) → WASM espeak-ng (ultime recours). Voir [`docs/TTS-ARCHITECTURE.md`](docs/TTS-ARCHITECTURE.md) et [`docs/SPEECH_CACHE.md`](docs/SPEECH_CACHE.md)
- Le surlignage des mots est basé sur une estimation de durée (~60 ms/char à vitesse=0.5, modulé par le curseur de vitesse) — fonctionne sur tous les niveaux de synthèse vocale sans modification du serveur ; la synchronisation précise via Azure `wordBoundary` constitue une fonctionnalité Pro à venir.
- Corpus de n-grammes SQLite de 1,5 Mo par langue ; unigrammes + bigrammes + trigrammes ; chargé progressivement lors du changement de langue
- **Mémoire contextuelle HRR** — recherche holographique sans parcours (229 Ko Rust WASM) qui apprend de chaque phrase prononcée. Encode les bigrammes + trigrammes dans un vecteur holographique ; interroge en ~0,2ms à chaque frappe. Couche additive — renforce les 2 premières tuiles de prédiction avec des correspondances contextuelles sans supprimer les prédictions du corpus.

**Benchmark de prédiction HRR** (54 tests unitaires + suite de précision 10 scénarios) :

| Scénario | Baseline Top-1 | HRR+ Top-1 | Gain | Baseline MRR | HRR+ MRR | Gain MRR |
|----------|---------------|------------|------|-------------|---------|----------|
| Phrases CAA de base (1x) | 36,7% | 46,7% | **+27,3%** | 0,634 | 0,672 | +6,0% |
| Phrases CAA de base (5x/jour) | 36,7% | 46,7% | **+27,3%** | 0,634 | 0,672 | +6,0% |
| Vocabulaire personnel | 70,4% | 81,5% | **+15,8%** | 0,809 | 0,883 | +9,2% |
| Mixte (toutes phrases) | 47,2% | 56,9% | **+20,6%** | 0,669 | 0,707 | +5.7% |
| Rappel inter-sessions | 80,0% | 80,0% | +0,0% | 0,900 | 0,900 | +0,0% |
| Préfixes ambigus | 66,7% | 66,7% | +0,0% | 0,738 | 0,738 | +0,0% |

Top-1 = le mot correct est la tuile n°1. Top-5 = le mot correct est présent dans l'une des tuiles. MRR = Rang Réciproque Moyen (plus élevé = le mot correct apparaît plus tôt). HRR ne réduit jamais la précision Top-5 dans aucun scénario — zéro régression. Gains les plus importants sur le vocabulaire personnel (+9,2% MRR) et les phrases CAA de base (+27,3% Top-1).

**Parcours de rendu :** `components/Keyboard.tsx` → `messageStore.appendChar` → `predictionStore.updatePredictions(text, lang)` → `engine/predictionEngine.ts` (récence × fréquence × boost n-gramme) + surcouche optionnelle IA `services/textCorrectService.ts` + interrogation HRR bigramme/trigramme `services/hrrContext.ts`. Surlignage : `services/aacSpeak.ts` émet les événements `tts-highlight-start` sur le bus `ttsHighlightBus` ; `components/MessageBar.tsx` s'y abonne et transmet `activeWordIndex` à `ColoredText`.
</details>

---

### ✨ Chat IA
Assistant sur l'appareil + cloud adapté à la voix de l'utilisateur de CAA. Réponses en flux continu, chaque ligne pouvant être insérée dans la barre de message en un appui pour garantir que l'enfant reste l'auteur de ses propos. L'offre gratuite utilise Gemini 2.5 Flash ; les forfaits payants basculent vers Claude Sonnet 4 avec la flotte prism-coder pour les requêtes courtes.

**Mode IA épuré** — la barre de prédiction de mots se masque automatiquement lorsque le Chat IA est ouvert (les prédictions étant superflues lors de la composition d'une question), permettant de se concentrer sur la réponse de l'IA et le bouton d'envoi.

**Chat IA mains libres** — activez le bouton 🔁 dans l'en-tête du chat pour lancer une boucle vocale continue : le micro s'ouvre automatiquement après chaque réponse de l'IA, permettant à l'enfant de poursuivre la conversation sans toucher l'écran. Une barre d'état sous l'en-tête du chat confirme l'activation du mode.

**Mode traduction** — lorsque la langue de l'application et la langue de sortie diffèrent (ex. saisie en portugais, sortie en anglais), chaque échange IA passe automatiquement par le chemin de traduction avec le flux continu activé, évitant tout ralentissement par rapport au mode monolingue.

![Panneau Chat IA — barre de prédiction masquée en mode IA, clavier complet accessible en bas](../../docs/screenshots/panel-ai-chat-v2.png)

<details>
<summary><strong>Fonctionnalités + détails techniques</strong></summary>

- Panneau intégré ancré au-dessus du clavier — pas une fenêtre modale qui masque la barre de message
- Saisie vocale via l'API Web Speech ; le bouton micro affiche la transcription intermédiaire en direct
- Appuyez sur n'importe quelle ligne de l'IA pour la copier dans la barre de message (préserve la paternité du texte — Valencia et al., CHI 2023)
- **Boucle mains libres** — bouton d'en-tête 🔁 ; relance le micro 1 s après la fin de chaque réponse IA ; `aria-pressed` + fond vert confirment l'état ; barre d'état sous l'en-tête lorsque le mode est actif
- **Mot d'activation "Hey Prism"** — disponible dans le mode Chevet ; une session continue de `SpeechRecognition` détecte la phrase et déclenche le micro ; indisponible lorsque le pont natif iOS gère la session audio
- Délai d'expiration strict de 15s côté client + bouton Réessayer (pour éviter que le panneau ne reste bloqué sur "Réflexion en cours..." en cas de perte de réseau)
- 401 / réseau / expiration / autre → gestion d'erreur explicite ; n'affiche jamais "Session expirée" de façon brute
- Repli vers Ollama local (`prism-coder:2b`) en mode hors ligne ; le contenu mixte étant bloqué depuis l'origine navigateur `synalux.ai` en pratique, l'erreur lisible s'affiche

**Parcours de rendu :** `components/AIChatPanel.tsx` → `services/aiService.askAI()` (ou `translateAI()` en mode traduction) → flux SSE depuis Synalux `/api/v1/chat` avec `credentials: 'include'`. CORS autorise `synalux.ai` + origines de développement localhost.
</details>

---

### 🛏 Mode Chevet

> **Fonctionnalité d'accessibilité essentielle.** Le mode Chevet est conçu pour les utilisateurs n'ayant aucun moyen fiable de parler, de saisir du texte ou de toucher un écran. La conception doit répondre en priorité au cas le plus complexe : un patient allongé dans un lit de soins intensifs, les bras le long du corps, sous ventilation assistée, incapable de produire le moindre son — communiquant uniquement par le regard ou à l'aide d'un contacteur unique maintenu entre deux doigts.

Interface de communication IA en plein écran optimisée pour les personnes ne pouvant pas atteindre l'écran ou s'exprimer oralement. Chaque zone d'appui est surdimensionnée. La voix est un moyen de saisie parmi d'autres — pas le seul. L'interface est entièrement exploitable via les technologies d'assistance : balayage par contacteur, poursuite oculaire, contrôle vocal iOS, suivi de la tête, ou via un clavier à l'écran parcouru avec un unique contacteur.

Inspiré des retours directs de la communauté CAA (r/AssistiveTechnology, mai 2025) d'utilisateurs communiquant depuis des lits d'hôpital, en salle de réveil post-chirurgicale ou en soins palliatifs.

**Fonctionne-t-il sur Mac / Windows ?** Oui. Le mode Chevet est une fonctionnalité PWA — il s'exécute dans n'importe quel navigateur sur tout appareil. Il n'est pas réservé à iOS.

---

#### À qui s'adresse ce mode ?

Le mode Chevet s'adresse à des utilisateurs possédant des capacités motrices et vocales variées. Les Cartes de phrases rapides (décrites ci-dessous) sont conçues spécifiquement pour les cas les plus severes — les personnes incapables de parler et ayant des mouvements de la main très limités ou nuls.

| Profil utilisateur | Méthode de saisie recommandée |
|---|---|
| Peut parler, mobilité des bras réduite | Voix (bouton micro 🎙) + Boucle Mains Libres |
| Vocalisations possibles, parole peu intelligible | Mot d'activation "Hey Prism" + Boucle Mains Libres |
| Absence de parole, peut toucher l'écran | Cartes de phrases rapides (appui unique) |
| Absence de parole, motricité restreinte — un seul contacteur | Balayage via Contrôle de sélection iOS ou Accès par contacteur Android sur les Cartes de phrases rapides |
| Absence de parole, aucun mouvement de la main — commande oculaire | Le matériel de commande oculaire (Tobii, EyeGaze Edge, etc.) simule un curseur de souris — toutes les cartes sont accessibles |
| Absence de parole, mouvements de la tête possibles | Poursuite céphalique (ex. Pointeurs de tête iOS, Commande de l'appareil photo sur iPhone 16) — les cartes servent de cibles de navigation de pleine taille |
| Trachéotomie / sous ventilateur, aucune vocalisation | Cartes de phrases rapides via poursuite oculaire ou contacteur + mode assisté par l'aidant |

---

#### Compatibilité plateforme

| Plateforme | Mode Chevet | Cartes rapides | Boucle Mains Libres 🔁 | Mot d'activation 🎯 |
|---|:---:|:---:|:---:|:---:|
| Web — Mac / Windows / Linux (tout navigateur) | ✅ | ✅ | ✅ | ✅ |
| Web — iPhone / iPad (Safari) | ✅ | ✅ | ✅ | ⚠️ Safari uniquement |
| Application native iOS (App Store) | ✅ | ✅ | ✅ | ❌ utiliser Mains Libres |
| Android (Chrome / Edge) | ✅ | ✅ | ✅ | ✅ |
| Commande oculaire (toute marque — simule une souris) | ✅ | ✅ | ✅ | ✅ |
| Balayage par contacteur (Contrôle de sélection iOS) | ✅ | ✅ | ✅ | ❌ |
| Apple Watch | ❌ | ❌ | ❌ | ❌ |

> **Pourquoi le mot d'activation est-il absent de l'application native iOS ?** Le pont natif prend le contrôle de la session audio (`prismNativeBridge.startVoice`), ce qui entre en conflit avec l'API `SpeechRecognition` du navigateur utilisée par le service de mot d'activation. Utilisez à la place la **boucle Mains Libres** (🔁) — elle relance automatiquement le micro 1 seconde après chaque réponse de l'IA sans nécessiter d'action continue.

---

#### Comment démarrer

1. Ouvrez le panneau **Chat IA** — appuyez sur l'icône 🤖 dans la barre d'outils.
2. Appuyez sur **🛏** dans l'en-tête du panneau — l'interface plein écran s'ouvre immédiatement.
3. Choisissez votre mode de saisie (voir sections ci-dessous).

<p align="center">
  <img src="../../e2e/_screenshots/bedside-overlay-open.png" alt="Interface du mode Chevet ouverte — UI plein écran noire. La bande supérieure montre les cartes de phrases rapides. La zone centrale affiche les réponses IA. Le bas présente un grand bouton micro rouge et la barre de commandes." width="260">
  <img src="../../e2e/_screenshots/bedside-overlay-handsfree-on.png" alt="Mode Chevet avec Mains Libres actif — bouton 🔁 surligné en vert, texte d'état 'Mains Libres ON' visible" width="260">
  <img src="../../e2e/_screenshots/bedside-hands-free-on.png" alt="Bouton d'activation Mains Libres activé — fond vert, aria-pressed=true" width="260">
</p>

#### Comment arrêter / quitter

- **Tactile / appui :** appuyez sur **✕** dans le coin supérieur droit de l'interface (zone cible de 48 × 48 px).
- **Clavier / contacteur :** appuyez sur **Échap**.
- **Voix :** énoncez une commande via le Contrôle vocal iOS lorsque l'interface est ouverte.

L'historique complet des échanges et l'état de la session IA sont conservés à la fermeture. L'interface se superpose au panneau principal sous forme de couche de rendu distincte — aucune donnée n'est perdue lors de la fermeture.

<p align="center">
  <img src="../../e2e/_screenshots/bedside-overlay-closed.png" alt="Après la fermeture du mode Chevet — retour au panneau de chat IA principal avec l'historique de conversation intact" width="260">
  <img src="../../e2e/_screenshots/bedside-wakeword-statusbar.png" alt="Barre d'état du panneau principal affichant 'Hey Prism actif' avec un indicateur bleu après le retour du mode Chevet" width="260">
</p>

---

### 🃏 Cartes de phrases rapides — pour utilisateurs non verbaux et sans mobilité

> **Il s'agit du chemin d'accès essentiel pour les personnes ne pouvant ni parler ni toucher l'écran librement.** Les Cartes de phrases rapides sont des boutons de communication préprogrammés déclenchables par un appui unique, une fixation oculaire ou une sélection par balayage. Aucune saisie. Pas de voix. Aucune connexion internet requise.

Chaque carte affiche un pictogramme/émoticône de grande taille et une phrase courte. Un appui sur une carte charge immédiatement la phrase dans la barre de message. Si le **mode Mains Libres** est actif, la phrase est transmise automatiquement à l'IA.

#### Cartes intégrées

Quinze cartes sont préchargées dès la première utilisation, classées par ordre d'urgence. Elles ne peuvent pas être supprimées et fonctionnent hors ligne.

**Urgent (priorité absolue — à utiliser en premier en cas d'urgence médicale) :**

| Icône | Phrase | Quand l'utiliser |
|:---:|---|---|
| 🆘 | AIDE — URGENCE | Danger immédiat, appel de garde, toute situation nécessitant du personnel tout de suite |
| 😢 | J'ai mal | Douleur globale — la localisation/l'intensité peuvent suivre en texte libre |
| 🫁 | Je ne peux pas respirer | Détresse respiratoire, problème de voies aériennes, crise de panique |
| 🔔 | Appeler l'infirmière | Demande de personnel hors urgence vitale |

**Besoins physiques :**

| Icône | Phrase | Quand l'utiliser |
|:---:|---|---|
| 💧 | De l'eau s'il vous plaît | Soif, bouche sèche, prise de médicaments |
| 🔥 | J'ai trop chaud | Fièvre, couverture, réglage de la température |
| 🥶 | J'ai trop froid | Frissons, couverture, température de la pièce |
| ↔️ | Changez-moi de position | Soulagement des points de pression, confort, installation post-chirurgicale |
| 💊 | J'ai besoin de mes médicaments | Dose programmée, demande ponctuelle, antalgiques |

**Communication :**

| Icône | Phrase | Quand l'utiliser |
|:---:|---|---|
| ✅ | Oui | Confirmation — répondre aux questions oui/non des soignants |
| ❌ | Non | Refus — répondre aux questions oui/non des soignants |
| ⏳ | Attendez s'il vous plaît | Besoin d'un moment — ne pas poursuivre tout de suite |

**Émotionnel :**

| Icône | Phrase | Quand l'utiliser |
|:---:|---|---|
| ❤️ | Je vous aime | Proches, lien affectif |
| 🙏 | Merci | Gratitude |
| 😨 | J'ai peur | Anxiété, peur, détresse — déclenche une réponse IA empathique |

#### Mode d'emploi des Cartes de phrases rapides

**Appui unique / fixation oculaire / sélection par contacteur :**
Activer une carte insère son texte dans la barre de message. La phrase peut ensuite être :
- Envoyée à l'IA pour obtenir une réponse contextuelle (ex. appuyer sur "J'ai peur" → l'IA répond par des propos rassurants et pose des questions de suivi)
- Lute telle quelle — les soignants présents dans la pièce peuvent lire la carte sélectionnée directement à l'écran

**Avec le mode Mains Libres activé :**
La phrase est transmise à l'IA dès la sélection de la carte. Le micro se réactive 1 seconde après la réponse de l'IA — créant une boucle continue sans autre manipulation.

**Avec le mot d'activation "Hey Prism" (web / ordinateur) :**
Il est possible de combiner mot d'activation + carte rapide : l'utilisateur prononce "Hey Prism" pour ouvrir le micro, l'IA répond, puis l'utilisateur peut appuyer sur une carte pour orienter la conversation différemment sans parler à nouveau.

#### Ajouter des cartes personnalisées

Les aidants, les professionnels (BCBA) et la famille peuvent ajouter des cartes personnalisées adaptées aux besoins de l'utilisateur — le nom des médecins, ses expressions favorites, des descriptions de douleurs spécifiques, des besoins spirituels ou toute autre mention.

**Procédure :**

1. Dans le mode Chevet, appuyez sur **＋ Ajouter** à la fin de la bande de phrases rapides.
2. Saisissez la phrase souhaitée sur la carte (jusqu'à 80 caractères).
3. Appuyez sur **Ajouter la carte** — l'IA génère automatiquement une émoticône correspondant au sens de la phrase (ex. "Donnez-moi une autre couverture" → 🛏, "Je veux prier" → 🤲).
4. L'icône apparaît avec une courte animation "✨ Génération...", puis la carte est enregistrée.

Les cartes personnalisées sont stockées localement sur l'appareil (localStorage). Elles restent conservées d'une session à l'autre et après un redémarrage. Aucun compte ni connexion internet n'est requis pour utiliser les cartes enregistrées — seule la génération initiale de l'icône nécessite un accès réseau.

**Exemples de cartes personnalisées utiles :**

| Phrase suggérée | Intérêt |
|---|---|
| `Faites venir le Dr [Nom]` | Plus direct que "appeler l'infirmière" pour solliciter un médecin précis |
| `Je dois parler à ma famille` | Situations importantes nécessitant la présence des proches |
| `Éteignez la lumière s'il vous plaît` | Sensibilité sensorielle, migraine, besoin de repos |
| `Je veux prier` | Accompagnement spirituel — respect de la personne |
| `Quelque chose ne va pas` | Signal de détresse général — incite l'IA à poser des questions pour préciser |
| `J'ai besoin de l'aspiration` | Patients sous trachéotomie / respirateur |
| `Ma perfusion me fait mal` | Alerte sur un problème de perfusion / phlébite |
| `Je veux rentrer à la maison` | Échanges sur le retour à domicile ou les soins palliatifs |

#### Supprimer des cartes personnalisées

1. Appuyez sur **✏️ Modifier** dans l'en-tête de la bande de phrases rapides.
2. Un badge rouge **✕** s'affiche sur chaque carte personnalisée (les cartes intégrées sont protégées et ne peuvent pas être supprimées).
3. Appuyez sur ✕ sur une carte pour la retirer.
4. Appuyez sur **Terminé** pour quitter le mode d'édition.

#### Configuration du balayage par contacteur (iOS)

Pour les personnes utilisant un unique contacteur externe (au souffle, à la tête, au pied, au coussin) :

1. Associez le contacteur à l'iPhone/iPad en Bluetooth ou via le port Lightning/USB-C.
2. Accédez à **Réglages → Accessibilité → Contrôle de sélection → Contacteurs** et attribuez le contacteur à "Sélectionner l'élément".
3. Accédez à **Contrôle de sélection → Style de balayage** et sélectionnez "Balayage automatique" — l'appareil mettra en surbrillance les éléments les uns après les autres.
4. Ouvrez Prism AAC en mode Chevet. Le Contrôle de sélection parcourra automatiquement les cartes de phrases rapides. Activez le contacteur lorsque la carte souhaitée est mise en valeur.
5. La phrase est envoyée immédiatement — aucune action supplémentaire n'est requise.

> Toutes les cartes rapides possèdent l'attribut `data-scan-group="quick-cards"` permettant aux technologies d'assistance de parcourir la bande entière par groupe avant de passer aux autres zones de l'interface.

#### Configuration de la poursuite oculaire

Le matériel de poursuite oculaire (Tobii Dynavox, EyeGaze Edge, PCEye, MyTobii P10, etc.) est reconnu par le système d'exploitation comme un pointeur de souris standard avec clic par fixation. Aucune configuration particulière n'est requise dans Prism AAC :

1. Réglez la durée de fixation dans le logiciel de votre dispositif oculaire (durée recommandée : 800–1200 ms pour débuter).
2. Ouvrez Prism AAC en mode Chevet dans n'importe quel navigateur.
3. Fixez votre regard sur une carte de phrase rapide pour la déclencher.

La taille minimale des cartes (88 × 80 px) respecte les exigences de zone cible WCAG 2.5.5 AAA (44 × 44 px CSS) et dépasse le minimum habituellement recommandé pour l'interaction par le regard (60 × 60 px).

---

<details>
<summary><strong>Ensemble des fonctionnalités + détails de l'implémentation technique</strong></summary>

**Cinq sous-systèmes regroupés dans une même fonctionnalité :**

1. **Cartes de phrases rapides** — `services/bedsideCards.ts` + interface en bande dans `components/BedsideOverlay.tsx`.

   - Stockage : clé `localStorage` `prism_bedside_cards_v1`. Validé par schéma à chaque chargement — les entrées incorrectes sont ignorées.
   - Limite : 50 cartes personnalisées maximum (évite la saturation de la mémoire).
   - Cartes intégrées : 15 entrées avec un `id` préfixé par `builtin-` ; la vérification d'édition contrôle ce préfixe avant d'afficher le badge ✕, garantissant que les cartes par défaut restent conservées.
   - Génération d'icônes par IA : `services/aiService.ts → inferCardIcon(text)`. Utilise la même chaîne de routage Ollama local → cloud Synalux que le reste de l'application. Transmet la phrase en message utilisateur avec une consigne système verrouillée ("Répondez avec un seul émoticône..."). Extrait le premier point de code Unicode de la réponse. Retourne toujours un résultat — bascule sur 💬 en cas d'erreur réseau ou de réponse non conforme.
   - Hors ligne : les cartes fonctionnent totalement hors ligne ; seul l'ajout d'une nouvelle carte nécessite le réseau (pour la génération d'icône — bascule sur 💬 si hors ligne).

2. **Boucle IA mains libres (🔁)** — accessible également depuis l'en-tête du chat IA principal. Après chaque réponse de l'IA, le micro se relance automatiquement (délai d'1 s). Une structure de référence `handsFreeRef` / `startListeningRef` permet d'exécuter le rappel à jour sans relancer l'effet à chaque rendu.

   ![Barre d'état mains libres dans le panneau IA principal](../../e2e/_screenshots/bedside-hands-free-statusbar.png)

3. **Interface Chevet** — UI sombre plein écran `fixed inset-0 z-50 bg-black` affichée au même niveau `<Fragment>` que le panneau IA principal pour conserver l'état du panneau entre les ouvertures et fermetures. Accessibilité : `role="dialog"`, `aria-modal="true"`, `aria-label="Mode Chevet"`, piège à focus WCAG 2.1 SC 2.1.2 (Tab/Maj+Tab naviguent au sein de l'interface, `Échap` ferme). La couverture de la zone d'affichage est vérifiée de bout en bout par tests E2E (tolérance ≤ 4 px).

   - **Grand bouton micro** — 112 × 112 px (`w-28 h-28`), rouge et pulsant en écoute, bordure blanche au repos. Vérifié ≥ 96 px par `boundingBox()` sous Playwright.
   - **Bande de cartes rapides** — ligne à défilement horizontal, chaque carte mesure `88 × 80 px`, attribut `data-scan-group="quick-cards"` pour le regroupement lors du balayage, sémantique `role="list"` / `role="listitem"` pour les lecteurs d'écran.
   - **Ligne de commandes** — Mains Libres (vert si actif), mot d'activation "Hey Prism" (bleu si actif, masqué si `!wakeWordSupported`), raccourci Contrôle vocal iOS.
   - **Quitter** — bouton ✕ (`w-12 h-12`) ou `Échap` → `onClose()` → `bedsideModeActive = false` dans `AIChatPanel` → le focus WCAG 2.4.3 retourne sur le bouton 🛏 qui a ouvert la fenêtre.

   ![Interface Chevet — fermée, retour au panneau IA principal](../../e2e/_screenshots/bedside-overlay-closed.png)

4. **Mot d'activation "Hey Prism"** — `services/wakeWordService.ts`. Maintient une session `SpeechRecognition` continue en arrière-plan. Détecte toute transcription contenant "hey prism", active le micro une fois, puis se réinitialise pour la suite. Protection : ne se lance pas si le pont natif iOS contrôle le micro (présence de `prismNativeBridge?.startVoice`). L'état actif du mot d'activation est rappelé dans la barre d'état du panneau principal après la fermeture de l'interface.

   ![Barre d'état indiquant "Hey Prism" actif](../../e2e/_screenshots/bedside-wakeword-statusbar.png)

5. **Guide Contrôle vocal iOS** — appuyer sur 📱 dans la ligne de commandes tente d'exécuter `prismNativeBridge.openSettings('accessibility')` (oriente vers les Réglages d'accessibilité sur les versions natives compatibles). Sur le web / ordinateur, affiche une carte d'instructions indiquant les étapes `Réglages → Accessibilité → Contrôle vocal → Activé`.

   <p align="center">
     <img src="../../e2e/_screenshots/bedside-voice-control-card.png" alt="Carte d'instructions pour le Contrôle vocal iOS — guide étape par étape affiché dans l'interface Chevet lors d'un appui sur 📱 sur web/ordinateur" width="260">
     <img src="../../e2e/_screenshots/bedside-voice-control-dismissed.png" alt="Carte d'instructions pour le Contrôle vocal masquée — l'interface revient à sa disposition Chevet normale" width="260">
   </p>

**Couverture des tests :**
- `services/bedsideCards.test.ts` — 22 tests unitaires : jeu de cartes par défaut, enregistrement/lecture localStorage, gestion du JSON incorrect, filtrage des cartes invalides, limite de 50 cartes, contraintes des champs de `createCard`.
- `e2e/bedside-mode.spec.ts` — 17 tests E2E Playwright : visibilité des boutons, bascule de `aria-pressed`, classes d'état vert/bleu, texte de la barre d'état, attributs d'accessibilité de l'interface, dimensions du micro via `boundingBox`, couverture de l'affichage, affichage/masquage de la carte d'instructions.

**Fichiers clés :**
- `components/AIChatPanel.tsx` — état chevet, état des cartes (`bedsideCards`), `handleAddBedsideCard`, `handleDeleteBedsideCard`, boucle mains libres, cycle de vie du mot d'activation, boutons d'en-tête
- `components/BedsideOverlay.tsx` — interface plein écran, bande de cartes rapides, fenêtre d'ajout de carte, mode édition, piège à focus, carte d'instructions du contrôle vocal
- `services/bedsideCards.ts` — type `BedsideCard`, `DEFAULT_BEDSIDE_CARDS`, `loadCards`, `saveCards`, `createCard`
- `services/aiService.ts` → `inferCardIcon(text)` — déduction de l'émoticône par l'IA
- `services/wakeWordService.ts` — détection continue de la phrase d'activation
</details>

---

### 📨 Envoyer un message — choix du canal
Lorsqu'un contact dispose de plusieurs canaux configurés (ex. e-mail et SMS), une section **"Envoyer via"** s'affiche au-dessus de la zone de saisie. Un seul appui permet de changer de canal avant la rédaction — sans quitter le panneau.

![Sélecteur de canal pour les contacts — ligne 'Envoyer via' avec E-mail en vert et SMS disponible](../../docs/screenshots/contact-provider-picker.png)

---

### 💬 Chat CAA
Les messages entrants provenant des canaux connectés (Telegram, WhatsApp, E-mail, Slack, etc.) arrivent dans ce panneau. Le badge de messages non lus sur la barre d'outils indique le nombre, l'alarme + notification inter-onglets se déclenchent à la réception d'un nouveau message, et un appui sur une ligne de message la copie dans la barre afin que l'enfant puisse préparer sa réponse avec sa propre voix.

![Panneau de Chat CAA affichant les messages entrants de l'aidant avec un badge non lu](../../docs/screenshots/panel-aac-chat.png)

<details>
<summary><strong>Fonctionnalités + détails techniques</strong></summary>

- Relevé de boîte de réception via le portail Synalux `/api/v1/prism-aac/inbox/poll` (sans effet sur les erreurs 404 si le portail n'est pas configuré)
- Notification `BroadcastChannel` entre les onglets lors de la réception d'un nouveau message
- Abstraction des canaux : l'ajout d'Outlook / Slack / Discord nécessite environ 30 lignes de code chacun
- L'état de lecture est synchronisé pour indiquer aux aidants quand l'enfant a pris connaissance du message
- Offre gratuite : 1 canal connecté ; forfait payant : illimité
- Synthèse vocale par message pour permettre à l'enfant d'écouter le texte entrant avec la voix de son choix

**Parcours de rendu :** `components/AACChatPanel.tsx` → `services/inboxPolling.ts` (relevé toutes les 5s lorsque sidePanel === 'aac-chat', 60s sinon) → `useScheduleStore.setIncomingMessages()`. Chaque message est également ajouté au fil "Messages des aidants" de l'emploi du temps.
</details>

---

### 🧮 Matières scolaires
Canvas à grille de cellules intégrant **19 claviers thématiques** couvrant l'ensemble du programme du secondaire : maths + sciences + programmation + arts + sciences humaines. Chaque onglet oriente le tuteur IA via un modèle de consigne spécifique (33 modèles au total) afin d'éviter qu'il n'applique un raisonnement algébrique à un tableau de Punnett ou ne confonde une nuance musicale avec une valeur de programmation. **L'histoire s'adapte à la langue et à la région** jusqu'au niveau de l'État / province / Land / communauté autonome — plus de 280 régions réparties sur 23 pays.

![Canvas à grille de cellules avec 5 + 7 = 12 saisi dans les cases](../../docs/screenshots/math-canvas-typed.png)

<details>
<summary><strong>Onglets de matières (19 au total)</strong></summary>

**Maths (9 claviers)** — Principal, Maths avancées (π √ exposants + 5 outils de mise en forme : case fraction, crochet de division posée, barre de racine, ligne de somme, barre de fraction), a–z, Maths diverses (théorie des ensembles + logique), Temps & Distances, Poids, Volumes, Géométrie, Monnaie.

**Sciences (4)** — Chimie (24 éléments + flèches de réaction + charges + indices + états de la matière), Physique (alphabet grec complet + 16 unités SI + ∫/∂/∇/∑/∏ + constantes), Biologie (ADN/ARN + génétique + 8 rangs taxonomiques + 12 organites), Statistiques (μ σ x̄ + 12 opérations + distributions).

**Programmation (2)** — Python (24 opérateurs + 26 mots-clés) et Java (24 opérateurs + 26 mots-clés). Le code s'insère à raison d'un caractère par case pour un alignement naturel sur la grille à chasse fixe.

**Arts + Sciences humaines (4)** — Musique (3 clés + 6 figures de notes + 5 silences + 5 altérations + 8 nuances), Sciences de la Terre (météo + plaques + 10 planètes + ua/al/pc/Ma/Ga), Histoire (adaptée à la langue et à la région), Français/Lettres (12 natures grammaticales + 6 types de phrases + ponctuation + styles de citation).

</details>

<details>
<summary><strong>Tuteur IA — 11 domaines × 3 modes = 33 consignes</strong></summary>

![Fenêtre du tuteur IA affichant un indice au-dessus du canvas](../../docs/screenshots/math-tutor-hint.png)

Trois modes par matière : 💡 **Indice** (conseil progressif pour l'étape suivante, sans donner la solution), ✓ **Vérifier** (valide la réponse de l'enfant, félicite si elle est exacte), 🎓 **Résoudre** (explication détaillée étape par étape, 4 étapes maximum). L'onglet actif informe le tuteur de la matière en cours. Expiration stricte de 15 s + bouton Réessayer pour éviter les blocages de l'interface.
</details>

<details>
<summary><strong>Histoire — adaptée à la langue et à la région</strong></summary>

![Clavier d'histoire en langue fr (sans région) — repères universels + nationaux](../../docs/screenshots/math-keyboard-history-en.png)
![Clavier d'histoire avec la région US-TX — Alamo, annexion du Texas, JFK apparaissent](../../docs/screenshots/math-keyboard-history-us-tx.png)

Trois niveaux superposés :
1. Événements **universels** abordés dans tous les programmes (476, 1914 Première Guerre mondiale, 1939 Seconde Guerre mondiale, 1969 premier pas sur la Lune)
2. Événements **nationaux** sélectionnés selon la `langue` (en, es, fr, de, ro, ru, uk, ja, ko, zh, ar, it, pl, nl, he, hi, vi, tr, pt) — 19 langues prises en charge
3. Événements **régionaux** sélectionnés selon la `région d'histoire` (US-TX, CA-QC, UK-SCT, ES-CT, IN-MH, DE-BY, …) — **280+ régions à travers 23 pays** incluant les 50 États américains + DC, les 13 provinces/territoires canadiens, les 4 nations du Royaume-Uni, l'Irlande (République + 4 provinces historiques), les 16 Länder allemands, les 17 communautés autonomes espagnoles, les 20 régions italiennes, ainsi que AU, FR, MX, BR, IN, CN, RU, BE, CH, NL, AR, ZA, KR, PK, NZ, PL.

La consigne du tuteur intègre la langue et la région : ainsi, une date comme 1836 en région `US-TX` fait référence à Fort Alamo (et non à la création de l'État de l'Alabama) ; 1759 en `CA-QC` correspond aux Plaines d'Abraham ; 1714 en `ES-CT` à la chute de Barcelone.

</details>

<details>
<summary><strong>Scénarios de test — 12 matières × problèmes écrits niveaux 4ème à Terminale × 72 tests Playwright</strong></summary>

Fiches d'exercices détaillées étape par étape pour chaque clavier de matière, complétées par un test Playwright exécutable par exercice qui simule l'utilisation du panneau de maths et contrôle le bon positionnement de chaque symbole dans la grille. Modélisé sur une fiche de révision d'algèbre de niveau 3ème.

- **Niveau 1 — déroulé étape par étape générique :** [`tests/workflows/`](tests/workflows/) — 12 documents markdown (maths-avancées, biologie, chimie, sciences-de-la-terre, géométrie, histoire, lettres, maths-diverses, physique, programmation-java, programmation-python, statistiques).
- **Niveau 2 — exercices réels par niveau scolaire :** [`tests/workflows/grade-8-12/`](tests/workflows/grade-8-12/) — 12 documents markdown contenant des problèmes écrits avec variables nommées (algèbre-3ème, géométrie-2nde, physique-1ère, chimie-2nde, biologie-3ème, statistiques-1ère, programmation-python-3ème, programmation-java-1ère, pré-calcul-terminale, sciences-de-la-terre-3ème, lettres-4ème, histoire-géo-2nde) + rapport d'analyse d'écart par clavier [`REPORT.md`](tests/workflows/grade-8-12/REPORT.md).
- **Niveau 3 — e2e Playwright :** [`e2e/math-workflows/`](e2e/math-workflows/) — 72 tests (`npx playwright test --project=desktop e2e/math-workflows`).

Sommaire complet, classement des matières à renforcer et guide "ajouter un nouveau scénario" → **[`docs/WORKFLOWS.md`](docs/WORKFLOWS.md)**.

</details>

<details>
<summary><strong>Autres fonctionnalités mathématiques (verrouillage, loupe à deux appuis, enregistrement / synchro)</strong></summary>

- **Outil de verrouillage** — une fois l'exercice terminé, verrouillez la zone. Les cases verrouillées apparaissent légèrement assombries et refusent toute modification.
- **Loupe à deux appuis** — le premier appui prépare la touche (agrandissement 1,4× + halo vert), le second valide la saisie. Désarmement automatique après 2 s. Adapté aux personnes ayant des imprécisions motrices.
- **Enregistrement + synchro** — stockage local prioritaire dans `localStorage` ; synchronisation vers le portail Synalux via le bouton `↻ Synchro`. Limite de 100 documents / 200 Ko ; suppression des plus anciens si dépassé.
- **Fixation par maintien** — durée de maintien réglable par touche (0–1500ms) avec anneau de progression vert.

![Interface des documents enregistrés affichant une entrée et un bouton Synchro](../../docs/screenshots/math-docs-overlay.png)
![Touche numérique préparée en état agrandi avec halo vert](../../docs/screenshots/math-two-hit-armed.png)
![Outil de verrouillage actif, invitant l'utilisateur à cliquer sur un coin de la zone](../../docs/screenshots/math-lock-armed.png)

</details>

<details>
<summary><strong>Claviers de matières — captures complémentaires</strong></summary>

![Clavier de chimie avec H₂O](../../docs/screenshots/math-keyboard-chemistry.png)
![Clavier de biologie avec A T G](../../docs/screenshots/math-keyboard-biology.png)
![Clavier Java avec `private String`](../../docs/screenshots/math-keyboard-java.png)
![Clavier de musique](../../docs/screenshots/math-keyboard-music.png)
![Clavier de statistiques](../../docs/screenshots/math-keyboard-statistics.png)
![Clavier de sciences de la Terre](../../docs/screenshots/math-keyboard-earth-science.png)
![Clavier de lettres/français](../../docs/screenshots/math-keyboard-language-arts.png)
![Clavier d'histoire pour la langue roumaine](../../docs/screenshots/math-keyboard-history-ro.png)

</details>

---

### 🗓 Emploi du temps
Emploi du temps visuel "d'abord-ensuite" pour accompagner les routines et les transitions. Chaque étape est représentée par une tuile d'image avec une étiquette ; valider une tuile déclenche un signal sonore + un repère visuel de progression. Une boutique de récompenses (forfait payant) se débloque à la fin d'une routine.

![Panneau d'emploi du temps avec tableau d'abord-ensuite + liste d'activités](../../docs/screenshots/panel-schedule.png)

<details>
<summary><strong>Fonctionnalités + détails techniques</strong></summary>

- Grille de 24 activités prédéfinies ajoutables en un appui : se réveiller, se brosser les dents, petit-déjeuner, école, goûter, déjeuner, jouer, lire, dessin, promenade, dîner, bain, histoire du soir, coucher, médicaments, fil dentaire, ranger, lessive, s'occuper des animaux, sport, …
- Réorganisation par glisser-déplacer ; modification directe via l'icône crayon ; les ajouts prédéfinis intègrent une clé `textKey` pour adapter les libellés lors d'un changement de langue
- Automate d'états D'abord-Ensuite : impulsion sur la tuile sélectionnée, carillon montant à 3 notes à la fin du minuteur, respect des préférences de mouvement (`prefers-reduced-motion` → anneau fixe), sémantique `aria-pressed`
- Maintien audio : un oscillateur à 1Hz quasiment inaudible conserve l'AudioContext "actif" sur iOS Safari afin que le signal sonore du minuteur retentisse bien après un long silence (sans cela, le son se déclenche dans un contexte suspendu = aucun son produit)
- Les messages des aidants s'intègrent à l'emploi du temps sous forme de fil "Messages" pour permettre à l'enfant de visualiser le programme à venir et l'émetteur du message

**Parcours de rendu :** `components/SchedulePanel.tsx` → `useScheduleStore` (24 activités prédéfinies + personnalisées) → `services/feedback.ts:playTimerRing()` → AudioContext partagé via `services/azureTTS.ts:warmupAzureAudio()`.
</details>

---

### 🎮 Jeux
12 jeux de CAA conçus sur des bases thérapeutiques. Élaborés pour encourager la communication, **non pour occuper l'écran**. Chaque jeu enregistre les productions verbales + la précision pour permettre au moteur adaptatif de proposer le jeu le plus adapté par la suite.

![Panneau de jeux avec 9 tuiles de jeux](../../docs/screenshots/panel-games.png)

<details>
<summary><strong>Les 12 jeux + détails techniques</strong></summary>

| Jeu | Compétence travaillée |
|---|---|
| Éclater les bulles | Cause à effet, communication intentionnelle |
| Chasse aux couleurs | Vocabulaire réceptif (noms des couleurs) |
| Mon histoire | Structuration du récit |
| Associer | Association + classement par catégorie |
| Oui / Non | Discrimination binaire, demande / refus |
| Compléter | Complétion de phrases (texte à trous) |
| Trier par catégorie | Catégorisation sémantique |
| Associer les émotions | Identification des émotions, théorie de l'esprit |
| Et ensuite ? | Raisonnement séquentiel |
| Identique / Différent | Discrimination visuelle — associer ou opposer |
| J'entends (Jeu des sons) | Discrimination auditive + vocabulaire |
| Chacun son tour | Apprentissage du tour de rôle dans l'échange |

- Les 12 jeux sont gratuits ; aucun jeu n'est bloqué selon le forfait
- Les données de chaque jeu alimentent `services/adaptiveEngine.ts` — longueur de phrase / catégorie / moment de la journée / résultat → suggère le jeu suivant
- Tous les jeux désactivent les catégories de tuiles de CAA non pertinentes pour le vocabulaire du jeu en cours, afin d'éviter les distractions pour l'enfant

**Parcours de rendu :** `components/GamesPanel.tsx` → composants de jeux individuels dans `components/games/`. Chaque jeu enregistre via `useScheduleStore.recordMessage(text, category)`.
</details>

---

### 🏪 Boutique
Packs de voix (voix Inworld, voix personnalisée clonée d'un frère/une sœur/un parent), packs de vocabulaire (vocabulaire de base, communication améliorée par signes), packs de jeux (jeux supplémentaires au-delà des 9). Les applications s'installent dans la barre d'outils via le même registre que les panneaux intégrés.

![Panneau de la boutique avec applications installables](../../docs/screenshots/panel-marketplace.png)

<details>
<summary><strong>Fonctionnalités + détails techniques</strong></summary>

- Les applications sont définies sous forme de fichiers JSON (`lib/marketplace/manifests/local.ts`) avec un registre d'exécution `lib/marketplace/registry.ts` où `getHandler(appId)` retourne le composant du panneau
- Clonage vocal (forfait payant) : enregistrement de 90s → voix créée utilisable pour n'importe quelle synthèse vocale dans l'application, y compris les tuiles de catégories
- Les applications installées s'affichent sous forme de boutons dans la barre d'outils après les fonctions intégrées ; `useSettingsStore.installedApps` sert de référence
- Restriction par forfait : la boutique présente l'ensemble du catalogue, mais les boutons d'installation sont désactivés pour les éléments supérieurs au forfait actuel

**Parcours de rendu :** `components/MarketplacePanel.tsx` → `useMarketplaceStore` → serveur `synalux/api/v1/marketplace/...` pour la validation, puis téléchargement des éléments (fichiers vocaux, JSON de vocabulaire) dans IndexedDB.
</details>

---

### 📄 Lecteur PDF
Ouvrez un PDF, obtenez une tuile par page, appuyez pour écouter le texte lu avec votre voix. Fiches d'exercices, mots de l'école, articles — importez n'importe quel document PDF et écoutez au lieu d'essayer de le lire. Aucun logiciel tiers type Adobe Reader n'est nécessaire ; l'ensemble du traitement s'effectue dans votre navigateur.

![Panneau du Lecteur PDF — état vide avec invitation "+ Ouvrir un PDF"](../../docs/screenshots/panel-pdf-reader.png)

<details>
<summary><strong>Fonctionnalités + détails techniques</strong></summary>

- Une tuile par page ; chaque tuile présente les 3 premières lignes + un bouton `▶ Page N` qui transmet le texte à `aacSpeak()` (même voix + même ton + même surlignage mot à mot que le reste de l'application)
- `▶ Tout lire` enchaîne la lecture de l'ensemble des pages en une seule fois
- La détection de pages vides (fichiers PDF issus de numérisations) oriente vers l'outil d'OCR
- `pdfjs-dist` est chargé dynamiquement lors de la première ouverture — bloc séparé d'environ 3 Mo depuis le CDN, version fixée sur le paquet npm
- Le bouton de la barre d'outils (📄) est activable dans Paramètres → Barre d'outils pour conserver une interface d'origine épurée

**Parcours de rendu :** `components/PdfReaderPanel.tsx` → `services/pdfReader.ts` (pdfjs `getDocument` → `getTextContent` par page) → `services/aacSpeak.ts`.
</details>

---

### 👁 Lecteur d'affichage (OCR)
Collez ou importez la photo d'un exercice, une capture d'écran de page web, la photo d'un livre — le texte extrait s'affiche à côté de l'image. Il suffit d'appuyer sur **▶ Parler** pour l'écouter, ou sur **↧ Envoyer à la barre de message** pour le modifier avant la lecture.

![Panneau du Lecteur d'affichage (OCR) — état vide avec invitation "+ Ouvrir une image"](../../docs/screenshots/panel-ocr-capture.png)

<details>
<summary><strong>Fonctionnalités + détails techniques</strong></summary>

- Prise en charge de 20 langues pour l'OCR associées aux langues de PrismAAC vers les codes Tesseract (eng / spa / fra / por / deu / ron / ukr / rus / jpn / kor / chi_sim / ara / ita / pol / nld / heb / hin / vie / tur / ind)
- Fichiers de données linguistiques enregistrés en cache après le premier usage (~10 Mo pour le français, davantage pour les langues CJK) — le premier lancement indique "Lecture de l'image… (le premier lancement télécharge le modèle d'OCR — peut prendre 10 à 30 s)"
- Le pourcentage de confiance est indiqué pour permettre à l'utilisateur d'évaluer la qualité de l'extraction ou de reprendre une photo
- La fonction de nettoyage `disposeOcr()` ferme les processus secondaires à la fermeture de la page pour libérer la mémoire WASM
- Le bouton de la barre d'outils (👁) est activable dans Paramètres → Barre d'outils

**Parcours de rendu :** `components/OcrCapturePanel.tsx` → `services/ocr.ts` (`tesseract.js` `createWorker` → `recognize`) → `services/aacSpeak.ts` ou `messageStore.setText`.
</details>

---

### 🎧 Lecteur Réconfort

Lecteur multimédia de chevet pour les patients hospitalisés — coma, réanimation, personnes non verbales, ou toute personne nécessitant la diffusion continue de contenus réconfortants au lit du patient.

<details>
<summary>Détails de la fonctionnalité</summary>

Les proches et amis enregistrent des messages vocaux, ajoutent des photos et des vidéos. La liste de lecture tourne en boucle pour que le patient conserve des voix et visages familiers à ses côtés.

- **Enregistrer** des messages vocaux directement dans l'application (API MediaRecorder)
- **Ajouter** des fichiers audio, des photos et des séquences vidéo (100 Mo par fichier, 500 Mo au total)
- **Lecture en boucle** automatique de tous les éléments — lancez et laissez tourner
- Mode **Plein écran** pour les photos et vidéos (affichage au chevet)
- **Synthèse vocale native** intégrée — les phrases sélectionnées sont lues via AVSpeechSynthesizer sur iOS
- **Hors ligne** — l'ensemble des médias est conservé dans IndexedDB, fonctionne sans réseau
- **Accessible au clavier** — chaque élément dispose de balises ARIA et d'une navigation au clavier
- **Sécurité vérifiée** — 27 points de sécurité corrigés (fuites d'URL blob, gestion des limites de stockage, contrôle des saisies, listes de types MIME autorisés, nettoyage à la fermeture)
- Le bouton de la barre d'outils (🎧) est activable dans Paramètres → Barre d'outils

**Limites de stockage :** 50 éléments maximum, 100 Mo par fichier, 500 Mo au total. Types MIME limités aux formats audio (webm/mp4/mpeg/ogg/wav), images (jpeg/png/gif/webp/heic) et vidéo (mp4/webm/quicktime).

**Parcours de rendu :** `components/ComfortPlayerPanel.tsx` → `store/comfortPlayerStore.ts` (Zustand + conservation) → `services/comfortMediaStorage.ts` (fichiers IndexedDB).
</details>

---

### 🧩 Extension Chrome — les mêmes fonctionnalités d'assistance à la lecture dans tout champ de texte
L'application web PrismAAC intègre l'assistance à la lecture au sein de son interface. L'extension Chrome (`chrome-extension/`) apporte **le même fonctionnement à N'IMPORTE QUEL champ de texte sur N'IMPORTE QUEL site** — Gmail, Google Docs, Word Online, espaces scolaires, formulaires — complétant ainsi l'utilisation sur le web.

![Assistant de lecture PrismAAC — lecture au fil de la saisie avec surlignage mot à mot dans tout champ de texte](../../docs/screenshots/extension-marquee.png)

L'interface flottante se positionne au-dessus de tout champ de texte sélectionné. Appuyez sur **▶ Parler** pour relire, ou poursuivez votre saisie — terminer une phrase par `.?!` la relit automatiquement en surlignant chaque mot en jaune au cours de la lecture :

![Interface PrismAAC au-dessus d'une page de rédaction, en cours de phrase avec "school" surligné en jaune pendant la lecture vocale](../../docs/screenshots/extension-overlay.png)

La traduction simultanée affiche À LA FOIS la phrase d'origine (en petits caractères italiques) et la phrase traduite (en taille normale, avec surlignage du mot lu). Plus de 50 langues prises en charge via l'accès public gratuit Google (sans clé API) :

![Interface PrismAAC traduisant de l'anglais vers le roumain — ligne source "I had a really good day at school today" avec la traduction "Am avut o zi foarte bună la școală astăzi" en dessous, "foarte" surligné](../../docs/screenshots/extension-translate.png)

Page d'options — les réglages se synchronisent sur le profil Chrome de l'utilisateur via `chrome.storage.sync`. Liste de désactivation par site, choix de la voix, curseurs de vitesse / volume / hauteur, choix des langues, entièrement modifiables :

![Page d'options de l'extension PrismAAC — déclencheurs de lecture, langue cible roumain, choix de la voix, curseurs de vitesse/volume/hauteur](../../docs/screenshots/extension-options.png)

**Installation (mode développeur actuellement — publication Chrome Web Store en cours de validation) :**

```sh
cd chrome-extension
npm install
npm run build
```

Ouvrez `chrome://extensions`, activez le **Mode développeur**, cliquez sur **Charger l'extension non empaquetée**, puis sélectionnez le dossier `chrome-extension/dist`.

**Fonctionnalités :**

- Lecture de la phrase sur `.?!`, lecture de chaque mot sur la barre d'espace, options activables/désactivables
- **Surlignage mot à mot** s'appuyant sur l'événement natif `SpeechSynthesisUtterance.boundary` du navigateur (synchronisation mot à mot directe, par rapport à l'estimation à ~60 ms/char de l'application web — le parcours portail fournissant du MP3 sans événements de flux, tandis que la synthèse Web les fournit en natif)
- **Traduction pendant la lecture** — choisissez une langue cible (plus de 50 langues gérées via l'accès public Google, sans clé API). L'interface présente À LA FOIS la ligne source (italique court) ET la ligne traduite (avec surlignage du mot lu) ; une voix correspondant à la langue cible est sélectionnée automatiquement
- Interface Shadow-DOM flottante ancrée au-dessus du champ actif (▶ Parler, 📌 Épingler, × Fermer)
- Raccourci `Cmd / Ctrl + Maj + S` pour lire le champ actif à la demande ; `Échap` interrompt la lecture
- Liste d'exclusion par site pour les espaces bancaires ou formulaires sensibles
- Synchronisation des réglages sur le profil Chrome via `chrome.storage.sync` — aucun compte PrismAAC requis

**Confidentialité :** le mode sans traduction fonctionne entièrement hors ligne (la synthèse vocale Web s'exécute localement). Le mode traduction effectue un appel HTTPS par phrase unique vers `translate.googleapis.com` (mis en cache après la première requête). Code source accessible dans [`chrome-extension/`](chrome-extension/) — TypeScript + assemblage esbuild (contenu 18 Ko, options 7 Ko, arrière-plan 339 o).

---

### 👋 Gestes mains libres
Saisie optionnelle par caméra pour les personnes éprouvant des difficultés à effectuer des appuis tactiles. Sélection par fixation de la tête + profils de gestes des mains. Fonctionne localement — aucune image vidéo ne quitte l'appareil.

<details>
<summary><strong>Fonctionnalités + détails techniques</strong></summary>

- **Mode simple** : suivi de la posture de la tête (FaceLandmarker, Mediapipe). L'utilisateur regarde une touche, maintient son regard pendant la durée `headTrackingDwellMs` (1200 ms par défaut) → déclenche le clic. Un anneau visuel de progression se remplit durant la fixation.
- **Mode avancé** : suivi des mains. Profils de gestes personnalisés par utilisateur (main ouverte = entrée, poing = retour arrière, pincement = espace, etc.) configurés dans `components/HandCalibration.tsx`.
- Sécurité contre la dérive : si la tête de l'utilisateur dévie de plus de `headTrackingDriftThresholdPx` sur `headTrackingDriftWindowMs` images consécutives, le suivi s'interrompt automatiquement et propose un réétalonnage (remarque utilisateur de mai 2026 : le suivi pouvait dériver progressivement sur une heure sans alerte et manquer les touches ciblées).
- **Touche d'interruption Échap** — appuyer sur Échap sur n'importe quel clavier désactive immédiatement le suivi et réaffiche le clavier AZERTY sans effacer la barre de message.
- Gestionnaire de flux caméra unique (`services/cameraStream.ts`) pour partager la même source entre le suivi de la tête et des mains ; le changement de mode s'effectue sans surcoût.
- Étalonnage conservé par utilisateur ; le système de suivi se réactive automatiquement à la reprise de la session.

**Documentation détaillée :** [`docs/TRACKING_MATH.md`](docs/TRACKING_MATH.md) (calculs d'étalonnage, apprentissage par centiles, auto-déplacement, filtre One Euro, ~30 paramètres de réglage), [`docs/GESTURE_RECOGNITION.md`](docs/GESTURE_RECOGNITION.md), [`docs/TRACKING_RELIABILITY.md`](docs/TRACKING_RELIABILITY.md).
</details>

---

### 👁 Contexte visuel — suggestions de phrases par caméra

Pointez la caméra vers des objets du quotidien pour voir apparaître immédiatement des phrases adaptées dans la barre de prédiction. Une tasse et une fourchette sur la table → "J'en veux encore", "De l'eau s'il vous plaît", "C'est fini". Un lit → "Je suis fatigué", "Bonne nuit". Un livre → "Aidez-moi s'il vous plaît", "Je ne comprends pas". **Aucun autre outil de CAA ne propose cette fonction.**

| Scène | Objets détectés | Phrases suggérées |
|---|---|---|
| 🍽️ Repas | tasse, fourchette, cuillère, bol, bouteille | "J'en veux encore", "De l'eau s'il vous plaît", "C'est fini", "C'est bon", "C'est trop chaud" |
| 😴 Coucher | lit, ours en peluche | "Je suis fatigué", "Bonne nuit", "Raconte une histoire", "Un câlin s'il te plaît" |
| 📚 Travail scolaire | livre, ordinateur portable, clavier | "Aidez-moi s'il vous plaît", "Je ne comprends pas", "J'ai fini", "Encore un peu de temps" |
| 🎮 Jeux | ours en peluche, ballon | "Je veux jouer", "À mon tour", "C'est amusant !", "Encore !" |
| 🛁 Toilette | toilettes, lavabo | "J'ai besoin d'y aller", "Se laver les mains", "Aide-moi" |
| 📺 Télévision | TV, télécommande, canapé | "Je veux regarder", "Éteins", "C'est trop fort" |

Les phrases sont disponibles dans plus de 12 langues (anglais, espagnol, français, portugais, roumain, ukrainien, russe, allemand, japonais, coréen, chinois, arabe, et plus). La langue s'adapte aux réglages de l'application — passez en russe et la caméra suggérera "Хочу ещё" à la place de "J'en veux encore".

![Contexte visuel — scène de repas détectée](../../docs/screenshots/vision-mealtime.png)

<details>
<summary><strong>Fonctionnement (technique)</strong></summary>

**Chaîne de traitement :** Caméra (partagée via `cameraStream.ts`) → MediaPipe ObjectDetector (EfficientDet-Lite0, 4 Mo int8, WASM) → Déduction de scène (règles déterministes, 11 types de scènes) → Injection dans la barre de prédiction (`setAiCompletion` + renforcement des n-grammes via `learnWord`).

**Performance :**
- Traitement à **2 images/s** (une détection toutes les 500 ms) — les objets bougent peu, préserve la batterie
- Charge processeur : **< 6%** sur mobile
- Taille du modèle : **4 Mo** (quantifié en int8 EfficientDet-Lite0, chargé dans l'environnement WASM MediaPipe existant)
- Mémoire vive ajoutée : **~5 Mo** (modèle + tampons + vocabulaire de phrases)
- Contrôle thermique : réduit automatiquement à 1 image/s → pause de 30s en cas de chauffe importante

**Confidentialité :**
- 100% sur l'appareil — les images de la caméra **ne quittent jamais l'appareil**, aucun traitement cloud
- Les résultats de détection sont **temporaires** — non enregistrés dans localStorage ni dans le cloud
- La catégorie `personne` est détectée mais **jamais affichée** à l'utilisateur ni utilisée pour les suggestions
- Aucun aperçu caméra affiché pendant la détection d'objets

**Sécurité :**
- Fonctionnalité **désactivée par défaut** — l'aidant doit l'activer volontairement dans Paramètres → Modes de saisie → Contexte visuel
- Les phrases visuelles ne sont **jamais lues automatiquement** — l'enfant doit effectuer un appui/une fixation pour déclencher la parole
- Les phrases d'urgence conservent un fonctionnement distinct et ne sont **jamais remplacées** par les suggestions visuelles
- La scène doit rester stable pendant **3 images consécutives** (~1,5s) avant activation — évite les variations intempestives

**Modèle de détection d'objets :** [EfficientDet-Lite0](https://ai.google.dev/edge/mediapipe/solutions/vision/object_detector) — 80 classes COCO, hébergé sur CDN Vercel aux côtés des modèles de visage/posture MediaPipe existants. Même environnement WASM que le suivi de la tête.

**Déduction de scène :** Moteur de règles déterministe (sans modèle ML supplémentaire). Les règles associent des combinaisons d'objets à des scènes en tenant compte du moment de la journée : `tasse + fourchette + cuillère` à midi = `repas` (indice de confiance 0,90). 11 types de scènes, possédant des ensembles d'objets et ajustements horaires configurables.

**Injection dans la prédiction :** Utilise deux points d'ancrage existants dans `predictionStore` :
1. `setAiCompletion(phrase)` — place la phrase principale dans la tuile de prédiction la plus à gauche
2. `learnWord(word, prev)` — renforce le vocabulaire lié à la scène via des n-grammes synthétiques avec un coefficient utilisateur de 10×

Le renforcement visuel s'estompe au bout de 30 secondes lorsque les objets quittent le champ. La saisie active masque les suggestions visuelles (la volonté de l'utilisateur reste prioritaire).

**Fichiers principaux :**
- `services/objectDetectionService.ts` — gestion caméra, boucle MediaPipe, suivi thermique
- `services/sceneInference.ts` — moteur de règles, 11 types de scènes, ajustement selon l'heure
- `services/visionPredictionBridge.ts` — liaison scène → barre de prédiction
- `constants/visionPhrases.ts` — phrases sélectionnées × 12+ langues par scène
- `constants/objectVocabulary.ts` — 30 libellés d'objets COCO → tableaux de mots traduits
- `store/visionStore.ts` — stockage Zustand temporaire (non conservé)
- `hooks/useVisionContext.ts` — liaison React détection ↔ pont ↔ paramètres

**Tests :** 62 tests unitaires couvrant les règles de déduction de scènes, la validité du vocabulaire d'objets, la couverture linguistique des phrases, le cycle de vie du stockage et l'intégration complète de la chaîne (objets → scène → phrases → stockage).

**Vérifié de bout en bout dans Safari :**
```
SCENE=mealtime   CONF=0.90 PHRASES=I want more|Water please|All done     BADGE=🍽️
SCENE=bedtime    CONF=0.70 PHRASES=I'm tired|Good night|Read a story     BADGE=😴
SCENE=schoolwork CONF=0.80 PHRASES=Help please|I don't understand|Done   BADGE=📚
```
</details>

---

### ⚙️ Paramètres
25 langues / 28 déclinaisons régionales, thèmes (clair / sombre / haut contraste), taille de grille (4 à 20 tuiles), réglages moteurs (temps de maintien en maths, loupe à deux appuis, durée de fixation de la tête, sensibilité des gestes, désactivation automatique sur dérive), choix de la voix (gratuit pour tous), gestion et durée du cache vocal, autocorrection IA activée/désactivée, notifications, personnalisation de la barre d'outils, choix de la région pour l'histoire, Compte Synalux avec forfait Cloud.

![Paramètres — choix de la langue + changement de thème](../../docs/screenshots/panel-settings.png)

<details>
<summary><strong>Paramètres de maths + accessibilité</strong></summary>

![Paramètres — temps de maintien en maths + loupe à deux appuis](../../docs/screenshots/panel-settings-math.png)

- **Fixation par maintien en maths** — curseur de 0 à 1500 ms ; 0 = clic immédiat, 200 à 1500 ms aide les personnes ayant des imprécisions motrices (un anneau de progression vert se remplit pendant la fixation pour fournir un repère visuel).
- **Loupe à deux appuis** — un premier appui sur une touche mathématique la prépare (agrandissement 1,4× + halo vert, sans valider), le second appui valide. Désarmement automatique après 2 s. Se combine avec la fixation par maintien.
- **Fixation par poursuite céphalique** — 200 à 5000 ms.
- **Sensibilité** — 1 à 10.
- **Désactivation automatique sur dérive** — interrupteur + Seuil (px) + Fenêtre (ms).
- **Afficher l'étalonnage des mains** — ouvre l'éditeur de profils de gestes manuelles.

</details>

<details>
<summary><strong>Modes de saisie — voix, gestes, autocorrection IA</strong></summary>

![Paramètres — panneau des modes de saisie](../../docs/screenshots/panel-settings-input-modes.png)

- **Saisie vocale** — API Web Speech, adaptée à la langue (anglais britannique vs américain, etc.) ; offre gratuite
- **Autocorrection & Complétion IA** — chaque pause de saisie passe par l'autocorrection cloud (Gemini 2.5 Flash-Lite). Désactivée par défaut en cas de faible bande passante.
- **Notifications** — alerte sonore + notification inter-onglets lors de la réception de messages CAA.
- **Saisie par caméra** — interrupteur général pour le suivi de la tête et des mains.
- **Cible de suivi caméra** — tête, main, ou détection automatique.

</details>

<details>
<summary><strong>Personnalisation de la barre d'outils</strong></summary>

La barre d'outils est entièrement réorganisable. La version 0.9.0 par défaut propose un jeu réduit (micro, chat CAA, alerte, catégories, paramètres) pour conserver un affichage simple au premier usage — chaque autre fonction intégrée (maths, chat IA, emploi du temps, jeux, boutique, lecteur réconfort, notes, historique, sons) peut être réactivée en un appui dans Paramètres → Barre d'outils. Les applications installées depuis la boutique se placent automatiquement après les éléments intégrés.

</details>

---

## Essayer

| | |
|---|---|
| 🌐 **Application Web** | [synalux.ai/prism-aac](https://synalux.ai/prism-aac) — tester dans tout navigateur |
| 📱 **iOS** | [App Store](https://apps.apple.com/app/id6764692277) — iPhone, iPad, Apple Watch |
| 💻 **Code source** | Ce dépôt. AGPL-3.0 — réutilisez et partagez librement vos modifications |

---

## Forfaits

Deux forfaits : **Gratuit** et **Prism AAC Cloud**. Sans période d'essai, carte bancaire non requise pour l'offre Gratuite, aucun dépassement facturé automatiquement.

| | Gratuit | Prism AAC Cloud — 4,99 US$/mois |
|---|---|---|
| Tableaux de communication, clavier et phrases enregistrées | ✅ | ✅ |
| Voix disponibles sur l'appareil et voix en cache | ✅ | ✅ |
| IA sur l'appareil et communication d'urgence | ✅ | ✅ |
| iOS + Web (PWA) | ✅ | ✅ |
| Génération de nouvelles voix naturelles | non inclus (accès gratuit conservé sur la synthèse publique jusqu'au comptage) | 50 000 caractères / mois |
| Requêtes IA Cloud (chat, autocorrection, prédiction, tuteur) | — | 100 / mois |
| Réinitialisation du quota | — | 1er de chaque mois à 00:00 UTC |

- S'achète dans l'application iOS (achat intégré Apple, StoreKit 2) ou sur le web (Stripe) ; les deux modes ouvrent l'accès au même compte avec un abonnement actif par compte. Annuler un canal ne supprime pas l'autre.
- La lecture des voix en cache et les voix natives de l'appareil ne consomment pas le quota. Lorsque le quota est atteint, la synthèse vocale cloud et l'IA cloud s'interrompent jusqu'à la réinitialisation — les fonctions de communication de base restent accessibles en permanence.
- Paramètres → Compte Synalux → **Synthèse & IA Cloud** affiche le forfait, le quota et les modalités de renouvellement, avec les options S'abonner avec Apple, Restaurer les achats Apple, Gérer l'abonnement et Actualiser le forfait cloud.
- Deux points particuliers identifiés : (1) les améliorations de prédiction de mots, les canaux de Chat CAA, les contacts aidants, le canal SMS et les données d'urgence complètes s'activent sur le forfait CAA configuré via l'abonnement web (Stripe), ce qui fait qu'un abonné uniquement Apple ne les reçoit pas ; (2) les pictogrammes IA et les installations de la boutique s'activent sur le forfait de la plateforme Synalux, et non sur le forfait AAC Cloud, ce qui fait que les abonnés Cloud sur l'un ou l'autre canal ne les reçoivent pas. Le choix des voix et l'ensemble des 12 jeux sont gratuits pour tous.

<p align="center">
  <img src="../../docs/screenshots/cloud-subscription-iphone.png" alt="Application iOS : Paramètres → Compte Synalux → Synthèse & IA Cloud — quota, conditions de renouvellement, S'abonner avec Apple · 4,99 $/mois, Restaurer les achats Apple" width="260" />
  <img src="../../docs/screenshots/panel-account-cloud.png" alt="Application Web : la même section avec S'abonner · 4,99 US$/mois via Stripe" width="260" />
</p>

[Page des tarifs →](https://synalux.ai/pricing) · [Conditions](TERMS.md) · [Confidentialité](PRIVACY.md)

---

## Sécurité clinique

- **L'accès à la CAA n'est jamais interrompu.** Un enfant doit pouvoir conserver sa voix en toutes circonstances.
- **Aucune information de santé dans le cloud sans accord.** Les notes des aidants sont chiffrées avant envoi.
- **L'audio reste local.** La saisie vocale est transcrite dans le navigateur via l'API Web Speech.
- **Conçu avec des professionnels BCBA.** Le suivi opérationnel verbal répond aux exigences du BACB Task List 5th Edition.
- **Choix adaptés à la sensibilité des utilisateurs.** Aucun mécanisme de punition. La boutique de récompenses est optionnelle.

Pour en savoir plus : [`ACCESSIBILITY.md`](ACCESSIBILITY.md), [`SECURITY.md`](SECURITY.md).

---

## Résultats des tests

**5 139 tests automatisés** contrôlent chaque fonction sur le web, iOS, le contexte visuel et le routage de l'IA.

| Domaines vérifiés | Tests | Résultat |
|---|---|---|
| Application web complète (composants, stocks, services) | 4 971 | ✅ réussi |
| Contexte visuel / caméra / détection d'objets | 167 | ✅ réussi |
| Suivi des mains + précision de la posture corporelle | 54 | ✅ réussi |
| Routage de l'IA sur l'appareil (Ollama actif) | 8 | ✅ réussi |
| Application native iOS (XCUITest) | 19 | ✅ réussi |
| Serveur Prism MCP | 2 679 | ✅ réussi |

**Précision de l'IA sur l'appareil** — fiabilité d'orientation de l'application selon l'action souhaitée :

| Appareil | Modèle | Taille | Précision | Évaluation |
|---|---|---|---|---|
| **Apple Watch** | SmolLM2-360M | 207 Mo | **100%** (300/300) | CAA clinique (symboles, urgence, prédiction) |
| **Tous les iPhones** | Qwen3.5-4B Q3_K_M | 2,3 Go | **99,1%** (114/115 × 3 séries) | Routage d'outils BFCL |
| **iPhone Pro / iPad** | Qwen3.5-4B Q4_K_M | 3,4 Go | **100%** (115/115 × 3 séries) | Routage d'outils BFCL |
| **iPad Pro / Mac** | Prism-Coder 9B | 8,4 Go | **100%** (115/115 × 3 séries) | Routage d'outils BFCL |

<details>
<summary><strong>Que signifie "99,1% de précision de routage" en pratique ?</strong></summary>

L'IA intégrée détermine la fonction à déclencher lorsque votre enfant appuie sur un bouton — enregistrer une note, charger sa session, rechercher dans son historique, etc. Nous évaluons ce comportement sur 115 scénarios réels joués 3 fois dans un ordre mélangé. Le modèle de 2,3 Go traite correctement 114 situations sur 115 à chaque passage. La seule erreur : il interprète "rédiger une regex" comme une recherche documentaire plutôt que comme une réponse en texte brut — un cas marginal qui ne se présente pas en utilisation CAA.

À titre de comparaison, le modèle 2B précédent obtenait 90,4% (11 erreurs). Le nouveau modèle divise par 10 les erreurs d'orientation pour une taille de téléchargement équivalente.

</details>

---

## Infrastructure & RGPD

### Architecture multi-régions

| Composant | Région | Rôle |
|---|---|---|
| **Supabase US** | US Est (Virginie) | Base de données principale — authentification, données utilisateurs, notes des aidants |
| **Supabase EU** | EU Centre (Francfort) | Conforme RGPD — les données des utilisateurs européens restent au sein de l'UE |
| **Vercel** | Réseau mondial | Application web, routes API, CDN |
| **Inworld TTS** | États-Unis | Synthèse vocale neurale |
| **HuggingFace Hub** | US/UE | Poids des modèles (2B, 4B, 14B, 32B) |
| **Sur l'appareil** | Appareil de l'utilisateur | Traitement llama.cpp (iPhone/iPad/Mac) |

### Conformité RGPD

Les données des utilisateurs de l'Union Européenne sont conservées exclusivement dans la région de Francfort (eu-central-1). Le portail identifie l'origine géographique via l'en-tête Vercel `x-vercel-ip-country` et oriente les requêtes vers l'instance Supabase adaptée :

- **Utilisateurs UE** → `supabase-eu` (Francfort) — données personnelles, authentification, préférences, notes des aidants
- **Utilisateurs hors UE** → `supabase-us` (Virginie) — mêmes catégories de données, juridiction américaine
- **Traitements IA** → sur l'appareil (aucune donnée ne quitte l'appareil) ou API Synalux (aucune donnée nominative conservée)
- **Audio de synthèse vocale** → produit côté serveur, transmis au client, non conservé

**Garanties de localisation des données :**
- Les données personnelles UE ne transitent pas par des serveurs américains
- Jetons d'authentification associés à l'instance régionale Supabase
- Notes des aidants chiffrées au repos (Supabase AES-256)
- Enregistrements vocaux (Lecteur Réconfort) conservés dans IndexedDB au niveau du navigateur — jamais envoyés
- Le modèle IA sur l'appareil s'exécute localement — aucune donnée de télémétrie cloud

**Droit à l'effacement :** La demande de suppression d'un utilisateur s'applique sur l'authentification, les profils, les notes d'aidants et les statistiques d'usage au sein de la base de données régionale. Les installations autonomes peuvent être réinitialisées via `supabase db reset`.

### Coûts à échelle

| Utilisateurs | Supabase | Vercel | Synthèse vocale | Modèles IA | Total |
|---|---|---|---|---|---|
| 0–1K | 50$/mois (2 régions) | 0$ (Gratuit) | ~$5/mois | 0$ (sur l'appareil) | ~$55/mois |
| 1K–10K | 50$/mois | 20$/mois (Pro) | ~$50/mois | 0$ | ~$120/mois |
| 10K–100K | 50$/mois + options de calcul | 20$/mois | ~$200/mois | RunPod 125$/mois | ~$395/mois |

---

## Modèles IA & appareils pris en charge

Compatible avec l'ensemble des appareils Apple. Indépendance complète vis-à-vis du cloud pour la communication de base.

PrismAAC sélectionne automatiquement le modèle le plus adapté à votre matériel, s'adapte sur les appareils plus anciens, et ne nécessite pas de connexion internet pour la communication usuelle.

| Appareil | RAM | Modèle | Précision | CAA | Taille | Coût |
|---|---|---|---|---|---|---|
| **iPad Pro M1/M2/M4** | 16 Go | 9B LoRA (v36) | **100%** | 100% | 8,4 Go | 0$ |
| **iPhone 15/16 Pro, iPad Air** | 8 Go | 4B Q4_K_M (v36) → 2B (repli OOM) | **100%** | 100% | 4,7 Go / 1,1 Go | 0$ |
| **iPhone 12–14, iPads anciens** | <8 Go | 2B Q3_K_M (v43) | **99,1%** | 100% | 2,3 Go | 0$ |
| **Mac M1+ via WiFi** | 16+ Go | 9B/27B via Ollama (v36) | **100%** | 100% | 8,4 Go | 0$ |

### Cascades sur l'application Web

L'application web privilégie le traitement local, puis bascule vers le cloud si besoin — ainsi, les personnes disposant d'Ollama l'utilisent gratuitement sans surcoût, et les autres conservent l'accès à l'ensemble des fonctions.

<details>
<summary>Schéma de fonctionnement</summary>

```
  L'utilisateur envoie un message
        |
        v
  +-- OLLAMA LOCAL (détecté sur localhost:11434) ----------+
  |                                                        |
  |   14b (100%, ~1.1s) ─[échec]─> 8b (100%, ~0.8s) ─[échec]─> 2b (100%, ~1.6s)
  +--------------------------------------------------------+
         |
    [échec local complet ?]
         |
         v
  +-- REPLI CLOUD (API Synalux) ------------+
  |  Claude Sonnet 4 (payant) / Gemini (gratuit) |
  |  99% de précision, ~3s                  |
  +-----------------------------------------+

  Chargement auto : le premier lancement détecte Ollama → récupère le modèle adapté → usage local permanent.
```

</details>

### Cascades sur iOS natif

L'application native contrôle la mémoire vive disponible au démarrage, télécharge le modèle adapté depuis le CDN HuggingFace (une seule fois), puis exécute le traitement via llama.cpp Metal. Sans serveur. Sans abonnement. Aucune donnée ne quitte l'appareil.

<details>
<summary>Schéma de fonctionnement</summary>

```
  Lancement de l'application
      |
      v
  Contrôle RAM (os_proc_available_memory)
      |
      +── 16 Go+ (iPad Pro) ──> 9B LoRA (8,4 Go) ──> 100%, ~1.1s
      |
      +── 8 Go (iPhone/iPad Air) ──> 4B Q4_K_M (4,7 Go) ──> 100%, ~0.8s
      |                                    |
      |                               OOM? → 2B Q4_K_M (1,1 Go) → 100%, ~1.6s
      |
      +── <8 Go ──> 2B Q4_K_M (1,1 Go) ──> 100%, ~1.6s

  Tous parcours : llama.cpp Metal, 0$ permanent, aucune donnée transmise.
  Passage WiFi : Paramètres → IA locale → indiquer l'IP du Mac pour 9B/27B.
```

</details>

### Modes d'affichage du clavier (conservés)

Trois dispositions s'alternent d'un simple appui — le mode choisi est conservé et réappliqué aux ouvertures suivantes.

- **MAX KB** — le clavier occupe tout l'espace disponible sous la barre de prédiction
- **MIN KB** — catégories à 75% / clavier à 25%
- **HIDE KB** — catégories en plein écran, clavier masqué

<details>
<summary>Schéma des dispositions</summary>

```
  MAX KB                 MIN KB                 HIDE KB
  +--------------------+ +--------------------+ +--------------------+
  | Barre d'outils     | | Barre d'outils     | | Barre d'outils     |
  | Barre de prédiction| | Barre de prédiction| | Bandeau d'accueil  |
  |                    | |                    | |                    |
  |  CLAVIER           | | Catégories  (75%)  | | Catégories         |
  |  occupe l'espace   | |                    | | (plein écran)      |
  |  sous la prédiction| |--------------------| |                    |
  |                    | | Clavier     (25%)  | |                    |
  | [123][v][  espace ]| |                    | |                    |
  +--------------------+ +--------------------+ +--------------------+
        |                      |                      |
        +-- bouton [v] ------->+-- bouton latéral --->+-- bouton latéral --+
        |                                                                  |
        +<-----------------------------------------------------------------+
```

</details>

### Synthèse des coûts

| Parcours | Modèle | Précision | Latence | Coût |
|---|---|---|---|---|
| iPad Pro 16GB | 9B LoRA (v36) | **100%** | ~1.1s | **0$** |
| iPhone/iPad 8GB | 4B Q4_K_M (v36) → 2B (repli OOM) | **100%** | ~0.8s | **0$** |
| Tout appareil | 2B Q4_K_M (v42) | **100%** | ~1.6s | **0$** |
| WiFi vers Mac | 9B/27B via Ollama (v36) | **100%** | ~1.1s | **0$** |
| Cloud (gratuit) | Gemini 2.5 Flash | 99% | ~3s | Pris en charge par Synalux |
| Cloud (payant) | Claude Sonnet 4 | 99% | ~3s | Inclus dans le forfait |

**L'engagement :** Chaque enfant bénéficie d'une précision équivalente à Claude, qu'il utilise un iPhone SE à 329$ ou un iPad Pro à 2 000$. Le choix du local garantit une indépendance totale du réseau, l'absence d'abonnements mensuels à des API, le respect de la confidentialité des données de santé, et des temps de réponse inférieurs à la seconde. La flotte prism-coder obtient **99,1 à 100%** sur le benchmark d'appels de fonctions BFCL (moyenne sur 3 séries, juin 2026) : 27B/9B/4B à 100%, 2B à 99,1%. Le modèle 27B obtient de plus 100% sur un jeu de test interne de 15 exercices de programmation.

---

## Auto-hébergement

```bash
git clone https://github.com/dcostenco/prism-aac.git
cd prism-aac
npm install
npm run dev    # http://localhost:3000
```

Synalux édite la version officielle hébergée (offres gratuite et payante). Les personnes réutilisant ou modifiant le code source doivent publier leurs changements sous licence AGPL-3.0.

### Modèles IA locaux (aucun coût cloud)

**Option A — Depuis l'application (recommandé) :** Paramètres → 🤖 Modèles d'IA locaux → cliquez sur Télécharger à côté du modèle choisi. Une barre de progression s'affiche. Fonctionne depuis un iPad/iPhone connecté au même réseau WiFi qu'un Mac exécutant Ollama.

**Option B — Ligne de commande :**

Installez [Ollama](https://ollama.com), puis lancez :

```bash
ollama pull dcostenco/prism-coder:2b   # 1,1 Go — toute machine, iPhone 12+ — routage 100% (v42)
ollama pull dcostenco/prism-coder:4b    # 4,7 Go — iPhone/iPad 8Go, Mac M1+ — routage 100% (v36)
ollama pull dcostenco/prism-coder:9b   # 8,4 Go — Mac 16Go+, iPad Pro — routage 100% (v36)
ollama pull dcostenco/prism-coder:27b   # 16 Go  — Mac M2 Ultra+ (MoE) — routage 100% (v7)
```

Ajoutez au fichier `.env.local` : `LOCAL_LLM_URL=http://localhost:11434`

**iPad Pro / iPhone connecté en WiFi :**
```bash
OLLAMA_HOST=0.0.0.0 ollama serve   # sur Mac
# Puis dans l'application : Paramètres → IA locale → indiquer : http://<ip-du-mac>:11434
```

Orientation automatique : 2B → tous appareils · 4B → mobile/vérification · 9B → standard · 27B → haute précision/usage institutionnel. Repli sur le cloud si Ollama n'est pas joignable.

---

<details>
<summary><strong>📚 Architecture technique (routage des modèles, voix, gestes, détails d'assemblage)</strong></summary>

**Technologies utilisées** : Next.js, Zustand, API Web Speech (transcription), Inworld TTS-2 + repli Azure Neural (synthèse vocale), FaceLandmarker (gestes).

**Routage des modèles** (côté serveur via le portail Synalux) :
- **Sur l'appareil** (appui bouton → phrase) : `prism-coder:2b` (Qwen3-2B Q4_K_M, llama.cpp Metal) — aucun réseau, coût nul, ~1,6s
- **Cloud simple** (chat, offre gratuite) : `prism-coder:9b` (Qwen3-14B réentraîné) → repli Gemini 2.5 Flash
- **Cloud complexe** (raisonnement, forfait pro) : `prism-coder:27b` (QwQ-32B réentraîné) → repli Claude Sonnet 4
- **Autocorrection + prédiction de mots** : Gemini 2.5 Flash-Lite — 752ms en moyenne, multilingue (ro/ru/es)
- Les actions nécessitant une réponse immédiate (appui bouton → parole) contournent le routage pour éviter tout blocage réseau
- Précision du routage ([évaluation Prism sur 102 cas](https://github.com/dcostenco/prism-coder/tree/main/tests/benchmarks/prism-routing-100), consignes système v36/v7, moyenne sur 3 séries, mai 2026) :

  | Modèle | Précision | Latence moyenne | Outils inventés |
  |---|---|---|---|
  | prism-coder:27b swe14 (local) | **100,0%** | 1,4s | 0 |
  | Cascade 14B→32B (local) | **100,0%** | ~1,1s | 0 |
  | prism-coder:4b v36 (local) | **100,0%** | 0,8s | 0 |
  | prism-coder:9b v36 (local) | **100,0%** | 1,1s | 0 |
  | Sonnet 4 (cloud) | **99%** | 3,2s | 0 |
  | Opus 4.7 (cloud) | **98,3%** | 3,0s | 0 |
  | prism-coder:2b v42 (local) | **100,0%** | 1,6s | 0 |

- Évaluation élargie — eval_300 (300 situations, 17 outils, 9 catégories, 3 séries) : prism-coder:27b = **300/300 (100%)**

**Ordre de priorité pour la synthèse vocale (TTS)** :
- Niveau 1 : Inworld TTS-2 (payant toutes langues ; gratuit pour ro/uk/ru/de/ko/ar où Synalux prend en charge les coûts)
- Niveau 2 : Voix supérieures de l'API Web Speech du système d'exploitation (hors ligne)
- Niveau 3 : WASM espeak-ng (dernier recours)

**Gestion des gestes** :
- Mode simple : position de la tête + clic par fixation via FaceLandmarker
- Mode avancé : posture de la main via MediaPipe ; profils de gestes enregistrés par utilisateur

**Structure** : navigation basée sur des fenêtres modales (sans gestionnaire de routes), thèmes personnalisés via jetons bg/text/border/accent.

**Documentation technique présente dans le dépôt :**
- [`docs/TTS-ARCHITECTURE.md`](docs/TTS-ARCHITECTURE.md) — détail du parcours de la synthèse vocale
- [`docs/GESTURE_RECOGNITION.md`](docs/GESTURE_RECOGNITION.md) — fonctionnement du mode gestuel
- [`docs/ADAPTIVE-ENGINE-BEHAVIOR.md`](docs/ADAPTIVE-ENGINE-BEHAVIOR.md) — bascule automatique du ton
- [`docs/EMERGENCY-NATIVE-ARCHITECTURE.md`](docs/EMERGENCY-NATIVE-ARCHITECTURE.md) — chaîne de traitement des alertes d'urgence
- [`docs/SELF-LEARNING-SAFETY.md`](docs/SELF-LEARNING-SAFETY.md) — gardes-fous de l'apprentissage par utilisateur
- [`docs/TRACKING_RELIABILITY.md`](docs/TRACKING_RELIABILITY.md) — banc de test pour le suivi tête/mains
- [`PRECISION_TOUCH.md`](PRECISION_TOUCH.md) — dimensions des zones d'appui et accessibilité
- [`ACCESSIBILITY.md`](ACCESSIBILITY.md) · [`SECURITY.md`](SECURITY.md) · [`GOVERNANCE.md`](GOVERNANCE.md) · [`AGENTS.md`](AGENTS.md)
- [`RESEARCH.md`](RESEARCH.md) — bases scientifiques et études
- [`CHANGELOG.md`](CHANGELOG.md) — historique des évolutions

</details>

<details>
<summary><strong>🆕 Pourquoi PrismAAC se différencie (les algorithmes sous-jacents)</strong></summary>

**Trois caractéristiques inédites associées dans une même application de CAA :**

### 1. IA sur l'appareil — respect des exigences techniques HIPAA

**L'intérêt d'une IA locale pour la CAA — rapidité, sécurité et fiabilité :**

| | IA Cloud uniquement | PrismAAC (local prioritaire) |
|--|---|---|
| Appui bouton → parole | 2 à 30s (aller-retour réseau) | **~0,5s** (sur l'appareil) |
| Fonctionnement hors ligne | ❌ Non | ✅ Oui |
| Transmission des données de santé | ✅ Systématique | ❌ Aucune (parcours vocal) |
| Prise en compte HIPAA | Requiert un accord BAA avec chaque prestataire | **Le traitement local conserve les données sur place — aide à respecter les règles techniques** |
| Zones mal couvertes / WiFi faible | Inutilisable | **Parfaitement fonctionnel** |
| Coût mensuel par utilisateur | 2 à 15$ de frais d'API | **0$ (local)** |

**Le modèle 2B fonctionne intégralement sur votre appareil** — iPad M1+, Mac, ou ordinateur portable. L'appui sur un bouton produit une réponse en ~500ms sans aucun échange réseau. Aucune donnée de santé, aucun propos tenu ni aucune habitude de communication ne quittent l'appareil en utilisation normale.

Les notes des aidants sont chiffrées localement avant toute synchronisation cloud optionnelle. Les plateformes de CAA concurrentes reposant exclusivement sur le cloud (synchronisation cloud TouchChat, Proloquo2Go) nécessitent la création d'un compte distant pour fonctionner — ce qui n'est pas le cas de PrismAAC.

**Pour les déploiements institutionnels / cliniques (9B + 27B) :** les modèles 9B et 27B s'exécutent sur un Mac dédié via Ollama au sein du réseau interne de l'établissement. Les iPad s'y connectent en WiFi local — les données ne sortent pas du bâtiment. Cette organisation permet de répondre aux exigences techniques de la réglementation HIPAA en conservant les données sur site ; la conformité globale restant sous la responsabilité de l'établissement utilisateur à travers ses propres mesures administratives, physiques et techniques.

**Exemple de mise en place :**

```
iPad / iPhone (sur le même réseau WiFi que le Mac)
    ↓  connexion vers
Mac exécutant Ollama (OLLAMA_HOST=0.0.0.0)
    ↓  met à disposition
prism-coder:2b · :14b · :32b
    ↓  l'ensemble des calculs reste sur le
Réseau local — aucune donnée ne sort sur internet
```

Paramètres → 🤖 Modèles d'IA locaux → indiquer l'IP du Mac → l'ensemble des modèles est accessible immédiatement. Sans frais cloud. Sans exposition des données. Sans dépendance réseau pour la communication CAA.

### 2. Classement des phrases adapté à VOTRE enfant
Les listes de fréquence fixes appartiennent au passé. PrismAAC classe les phrases suggérées via le modèle d'activation [**Prism v14.0.0**](https://github.com/dcostenco/prism-coder/blob/main/docs/WOW_FEATURES.md) — fondé sur le modèle de mémoire cognitive ACT-R issu des travaux de recherche de l'Université Carnegie Mellon. Ancienneté × fréquence × historique de l'utilisateur, plutôt qu'un classement figé. Les phrases utilisées aujourd'hui remontent ; celles délaissées depuis un an s'estompent (atténuation progressive `d=0.25`, demi-vie d'environ 1 an).

### 3. Les corrections des aidants entraînent le modèle — automatiquement
Lorsqu'un aidant corrige une proposition inappropriée du modèle (ex. "non, le mot est *manger*, pas *vouloir*"), le module [audit-hooks postflight harvester](https://github.com/dcostenco/prism-coder/blob/main/docs/WOW_FEATURES.md#7-the-recipe-combining-all-of-the-above) enregistre l'ajustement. Après environ 50 sessions, le système prévient *avant* que le modèle ne reproduise la même erreur. Aucun travail de saisie pour les aidants, aucun entraînement lourd — les ajustements du quotidien forment le modèle.

**Résultats constatés :** Précision du routage sur l'évaluation [Prism 115 cas](https://github.com/dcostenco/prism-coder/tree/main/tests/benchmarks/prism-routing-100) (7 outils Prism, 12 catégories, moyenne sur 3 séries, juin 2026) : 27b = 100,0%, 9b = 100,0%, 4b = 100,0%, 2b = 99,1%. Aucun nom d'outil inventé sur l'ensemble des tailles de modèles et des séries. Le modèle 2B s'exécute sur l'appareil pour un choix de phrases rapide ; les modèles 9B/27B prennent en charge les échanges complexes et usages cliniques via le WiFi connecté au Mac. Sur le classement général Berkeley BFCL V4 (plus de 2 000 cas d'appels de fonctions), le 2B atteint ~59% — un résultat comparable aux modèles de taille similaire. L'intérêt de PrismAAC réside dans l'association du modèle avec l'ensemble des algorithmes d'activation Prism.

</details>

---

## Pour les développeurs

```bash
npm install && npm run dev   # http://localhost:3000/prism-aac
npm run test                 # 4900+ tests unitaires
npm run e2e                  # Playwright sur 11 profils d'appareils
```

### Suivi et télémétrie

| Tableau de bord | Métriques suivies |
|-----------|---------------|
| [Prism AAC — User Analytics](https://app.datadoghq.com/dashboard/shk-8fb-qjk/prism-aac--user-analytics) | Sessions, erreurs, prédictions de mots, choix de phrases, événements vocaux, langues, pays, appareils, forfaits, télémétrie du suivi de la tête |

Intégration Datadog RUM : voir `lib/datadog.ts` + `components/DatadogInit.tsx`. 7 tests de performance e2e dans `e2e/datadog-integration.spec.ts`.

---

## Licence

[AGPL-3.0](LICENSE) — open source, certifié OSI, éligible aux subventions.

Vous êtes libre de créer une branche et d'auto-héberger le projet. La licence vous impose de publier vos propres modifications sous licence AGPL-3.0 — un principe qui garantit que les avancées sur la CAA restent ouvertes et accessibles à toutes les familles.

© 2024–2026 Synalux LLC
