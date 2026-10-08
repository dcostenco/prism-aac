<!-- Auto-generated from README.md by scripts/generate_i18n.py — do not edit manually -->
# Prism AAC

**말이 어려운 어린이와 성인을 돕습니다.**

운동 장애 및 복합적인 소통 필요가 있는 어린이를 위한 보안대체소통(AAC) 앱입니다. 그림을 누르고, 문장을 만들고, 음성으로 들어보세요 — 25개 언어(28개 지역)로 제공됩니다. 모든 태블릿, 노트북, iPhone, iPad 및 Apple Watch에서 작동합니다.

[Synalux 플랫폼](https://synalux.ai)의 일부입니다.

**지금 사용해 보기:**
- **웹 앱 (무료):** [synalux.ai/prism-aac](https://synalux.ai/prism-aac) — 브라우저가 있는 모든 기기에서 작동
- **iOS (iPhone + iPad + Apple Watch):** [App Store](https://apps.apple.com/app/id6764692277)
- **요금제:** [synalux.ai/pricing](https://synalux.ai/pricing) — 무료 및 자연스러운 음성 발화와 클라우드 AI 제공량이 포함된 선택적 Prism AAC Cloud 요금제 (월 US$4.99)

🌐 [English](../../README.md) · [Español](README_es.md) · [Français](README_fr.md) · [Português](README_pt.md) · [Română](README_ro.md) · [Українська](README_uk.md) · [Русский](README_ru.md) · [Deutsch](README_de.md) · [日本語](README_ja.md) · **한국어** · [中文](README_zh.md) · [العربية](README_ar.md)

<p align="center">
  <a href="https://apps.apple.com/app/id6764692277"><img src="https://img.shields.io/badge/App_Store-Download-0D96F6?style=for-the-badge&logo=apple&logoColor=white" alt="App Store"></a>
  <a href="https://synalux.ai/prism-aac"><img src="https://img.shields.io/badge/Try_It-Free-43e97b?style=for-the-badge" alt="Try Free"></a>
  <a href="https://synalux.ai/pricing"><img src="https://img.shields.io/badge/Plans-Free_+_Paid-764ba2?style=for-the-badge" alt="Pricing"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue?style=for-the-badge" alt="AGPL-3.0"></a>
  <a href="PRIVACY.md"><img src="https://img.shields.io/badge/Privacy-Policy-lightgrey?style=for-the-badge" alt="Privacy"></a>
  <a href="TERMS.md"><img src="https://img.shields.io/badge/Terms-of_Service-lightgrey?style=for-the-badge" alt="Terms"></a>
</p>

![iPad에서의 Prism AAC 메인 화면 — 도구 모음, 입력란, 5개의 예측 타일 및 전체 QWERTY 키보드 (프로덕션 웹 앱, 1.9.0)](../../docs/screenshots/app-hero.png)

### 네이티브 앱

<p align="center">
  <img src="../../docs/screenshots/ios-iphone.png" alt="iPhone에서의 PrismAAC" width="220" />
  <img src="../../docs/screenshots/ios-ipad.png" alt="iPad에서의 PrismAAC" width="360" />
  <img src="../../docs/screenshots/watch-ultra.png" alt="Apple Watch Ultra에서의 PrismAAC" width="120" />
</p>

<sub>iPhone 및 iPad 프레임은 프로덕션 웹 앱을 실행하는 빌드 1.9.0 (53)에서 캡처됨 (2026-09-08). Watch 프레임은 1.4.0에서 캡처됨.</sub>

| 플랫폼 | 상태 | 기기 내 AI | 비고 |
|----------|--------|-------------|-------|
| **웹** (PWA) | ✅ 프로덕션 | 최적의 로컬 모델 자동 다운로드 | 모든 브라우저 지원, 설치 가능; Stripe을 통한 Cloud 요금제 |
| **iPad Pro 16GB** | ✅ 프로덕션 | 4B 기기 내 AI (100% 정확도) | 가장 빠르고 완벽한 개인정보 보호; Apple 인앱 결제를 통한 Cloud 요금제 |
| **iPhone Pro 8GB** | ✅ 프로덕션 | 4B Q4_K_M 기기 내 (100% 정확도) | RAM 용량에 따라 자동 선택 |
| **모든 iPhone** | ✅ 프로덕션 | 2B Q3_K_M 기기 내 (99.1% 정확도) | 2.3 GB — 모든 iPhone 지원 |
| **Apple Watch** | ✅ 프로덕션 | 오프라인 어구 (1,261개 × 20개 언어) | 단독 실행 — 픽토그램, TTS, 긴급 상황 |
| **Chrome 확장 프로그램** | ✅ 프로덕션 | — | 모든 텍스트 입력란 지원 읽기 보조 도구 |
| **WiFi로 Mac 연결** | ✅ 프로덕션 | Ollama 기반 9B/27B | 설정 → 로컬 AI → Mac IP 입력 |

---

## App Store 미리보기 동영상

Inworld TTS 나레이션과 함께 모든 주요 기능을 보여주는 30초 동영상:

https://github.com/dcostenco/synalux-docs/releases/download/v1.0-module-videos/prism_aac_preview_v5.mp4

| 장면 | 기능 | 스크린샷 |
|---|---|---|
| **홈** — 어구 탭 | 22개 카테고리의 픽토그램 보드, 읽기 버튼 | <img src="../../docs/screenshots/appstore/ipad_home.png" width="200"> |
| **카테고리** | 도움, 음식, 장소, 감정을 위한 빠른 어구 | <img src="../../docs/screenshots/appstore/ipad_categories.png" width="200"> |
| **AI 채팅** | 메시지 작성, 대화 연습 | <img src="../../docs/screenshots/appstore/ipad_ai-chat.png" width="200"> |
| **비상 알림** | 원탭 간병인/간호사 호출 | <img src="../../docs/screenshots/appstore/video/frame_03.png" width="200"> |
| **일정** | 시각적 일일 루틴 — 아침, 학교, 점심, 잠자리 | <img src="../../docs/screenshots/appstore/ipad_schedule.png" width="200"> |
| **게임** | 버블 팝, 색상 찾기, 짝 맞추기, 예/아니오, 완성하기 | <img src="../../docs/screenshots/appstore/ipad_games.png" width="200"> |
| **수학 및 학업** | 힌트, 채점, 풀이 + 숫자 패드가 포함된 적응형 수학 | <img src="../../docs/screenshots/appstore/video/frame_06.png" width="200"> |
| **머리 및 시선 추적** | 카메라 기반 머무르기 커서, 시선 제어, 보정 | <img src="../../docs/screenshots/appstore/video/frame_07.png" width="200"> |
| **12개 언어** | 영어, 스페인어, 프랑스어, 러시아어, 일본어, 한국어, 중국어, 아랍어 등 | <img src="../../docs/screenshots/appstore/video/frame_08.png" width="200"> |

---

## 한눈에 보기

| 모듈 | 기능 | 미리보기 |
|---|---|---|
| 📂 **카테고리** | 글을 읽지 못하는 사용자를 위한 PECS 방식의 그림 타일 | <img src="../../docs/screenshots/panel-categories.png" width="120"> |
| ⌨️ **입력 및 발화** | 키보드 + 단어 예측 + 신경망 음성 | <img src="../../docs/screenshots/app-hero.png" width="120"> |
| ✨ **AI 채팅** | AAC 사용자에 맞춘 기기 내 및 클라우드 어시스턴트 | <img src="../../docs/screenshots/panel-ai-chat.png" width="120"> |
| 💬 **AAC 대화** | 간병인 및 연락처에서 도착한 수신 메시지 | <img src="../../docs/screenshots/panel-aac-chat.png" width="120"> |
| 🧮 **수학 + 과목** | 영역 인식 튜터가 있는 셀 그리드 캔버스 | <img src="../../docs/screenshots/math-canvas-typed.png" width="120"> |
| 🗓 **일정** | 시각적 단계별 루틴 | <img src="../../docs/screenshots/panel-schedule.png" width="120"> |
| 🎮 **게임** | 12가지 치료 목적의 AAC 게임 | <img src="../../docs/screenshots/panel-games.png" width="120"> |
| 🏪 **마켓플레이스** | 음성 팩, 어휘 팩, 게임 팩 | <img src="../../docs/screenshots/panel-marketplace.png" width="120"> |
| 🎧 **컴포트 플레이어** | 병원 입원 환자를 위한 침상 미디어 플레이어 | <img src="../../docs/screenshots/panel-comfort-player.png" width="120"> |
| 🛏 **침상 모드** | 거치대 사용 / 누워있는 상태를 위한 전체 화면 AI 채팅 | <img src="../../e2e/_screenshots/bedside-overlay-open.png" width="120"> |
| 👁 **시각적 컨텍스트** | 카메라인식 사물 → 관련 어구 추천 | <img src="../../docs/screenshots/vision-mealtime.png" width="120"> |
| 👋 **핸즈프리** | 머리 및 손 제스처 인식 | <img src="../../docs/screenshots/panel-settings-input-modes.png" width="120"> |
| ⚙️ **설정** | 25개 언어, 운동 장애 편의 기능, 음성 선택기 + 음성 캐시 | <img src="../../docs/screenshots/panel-settings.png" width="120"> |
| ☁️ **클라우드 음성 및 AI** | 자연스러운 음성 + 클라우드 AI를 위한 선택적 월 US$4.99 제공량 | <img src="../../docs/screenshots/cloud-subscription-iphone.png" width="120"> |

---

## 접근성

Prism AAC는 2026년 6월에 iPhone 세로/가로, iPad 세로/가로 모드 전반에서 [70개 항목의 적대적 접근성 감사](ACCESSIBILITY.md)를 받았습니다. 모든 문제는 수정되었으며 자동화된 e2e 테스트를 통해 검증되었습니다.

### 입력 방식 — 신체 어느 부위든 사용 가능

| 방식 | 작동 원리 | 설정 |
|--------|-------------|-------|
| **터치** | 표준 탭 + 픽토그램 타일 | 별도 설정 없이 즉시 사용 |
| **머리 추적** | 카메라인식 머리 움직임 추적 → 머무르기 클릭 | 설정 → 입력 모드 |
| **시선 추적** | 머리 추적기에 시선 위치 가중치 적용 | 설정 → 입력 모드 |
| **스위치 스캐닝** | Bluetooth 스위치, 키보드 또는 게임패드로 자동/수동 스캔 | 설정 → 입력 모드 → 스위치 스캐닝 |
| **제스처 인식** | 깜빡임, 끄덕임, 미소, 입 벌리기 → 지정 동작 매핑 | 설정 → 입력 모드 → 제스처 |
| **음성 입력** | AI 자동 수정 기능이 있는 받아쓰기, 핸즈프리, 호출어 | 도구 모음의 마이크 버튼 |
| **간소화된 키보드** | 3×5 그리드에 가장 자주 쓰이는 15개 자모 배치 (gridSize 4 자동 적용) | 설정 → 그리드 크기 → 4 |

그림 보드 탐색: 어휘 그리드 내부 또는 하단 카테고리 띠를 좌우로 스와이프하여 페이지를 넘깁니다. Mac에서는 트랙패드 수평 스크롤이나 클릭 후 드래그를 사용하며, 가장자리 화살표도 계속 사용할 수 있습니다. 페이지 이동만으로는 단어가 선택되지 않으며, 선택하려면 타일을 직접 탭하거나 클릭해야 합니다. 수직 스크롤과 확대/축소 제스처로는 페이지가 넘어가지 않습니다. 자세한 내용은 [스와이프 탐색 및 테스트 범위](docs/SWIPE_NAVIGATION.md)를 참조하세요.

### 반응형 레이아웃 — iPhone 및 iPad, 세로 및 가로

<p align="center">
  <img src="../../docs/screenshots/a11y-2026-06-18/01-home-board-iphone-6.1.png" alt="iPhone 세로" width="160" />
  <img src="../../docs/screenshots/a11y-2026-06-18/01-home-board-iphone-6.1-land.png" alt="iPhone 가로" width="280" />
  <img src="../../docs/screenshots/a11y-2026-06-18/01-home-board-ipad-13.png" alt="iPad 세로" width="240" />
</p>

### 시각 모드

<p align="center">
  <img src="../../docs/screenshots/a11y-2026-06-18/06-dark-high-contrast-iphone-6.1.png" alt="iPhone의 다크 + 고대비 모드" width="160" />
  <img src="../../docs/screenshots/a11y-2026-06-18/06-dark-high-contrast-ipad-13-land.png" alt="iPad 가로 모드의 다크 + 고대비 모드" width="340" />
</p>

- **라이트 / 다크 / 고대비** 테마
- **`prefers-contrast: more`** 및 **`prefers-reduced-motion`** 시스템 미디어 쿼리 지원
- **확대/축소(Pinch-to-zoom)** 지원 (최대 5배) — WCAG 1.4.4 준수
- 비상 복구 모드에서 **16개 긴급 단어 × 8개 언어** 제공

70개 모든 결과를 포함한 감사 보고서 전문은 [ACCESSIBILITY.md](ACCESSIBILITY.md)를 참조하세요.

---

## Safety & Privacy

PrismAAC는 아동, 말을 하지 못하는 성인(nonverbal adults) 및 임상군(clinical populations)이 사용합니다. 안전은 하나의 기능이 아니라 모든 추론 경로를 형성하는 제약 조건입니다.

### Layered safety architecture

| Layer | What | Where it runs | Latency |
|-------|------|---------------|---------|
| **L1 — Deterministic safety gate** | 정규식 기반 위기/의료 차단 | 클라이언트 + 서버 (모든 경로) | 0 ms |
| **L2 — Model safety training** | Qwen3.5 RLHF 정렬 | 온디바이스 + 클라우드 | 내장됨 |
| **L3 — Confidence gate** | 짧거나, 두서없는(garbled) 문장, 프롬프트 템플릿이 유출된 출력(template-leaked output) 거부 | 온디바이스 + 서버 | 0 ms |
| **L4 — Grounding verifier** | NLI 검증: 주장은 증거에 의해 논리적으로 귀결되어야 함(claims must be entailed by evidence) | 서버 (유료 요금제) | ~200 ms |

### L1 safety gate details

L1 게이트는 서버를 완전히 우회하는 오프라인 로컬 Ollama 경로를 포함하여 모든 추론 경로에서 **입력과 출력 모두**에 대해 확정적(deterministic) 정규식 검사를 실행합니다.

**차단 대상:** 1인칭 위기 표현(자해 의도), 위험한 의료 용법/용량 지시.

**차단하지 않는 대상 (의도된 설계):** 일반적인 임상 용어("dose of risperidone", "milligrams", "suicide prevention training"). 이러한 용어는 정당한 BCBA/의료 기록에 등장하며, 이를 차단하면 이 제품이 지원하는 임상 사용자에게 피해를 줍니다. 온디바이스 2B 모델 자체의 정렬은 안전을 위해 전혀 의존하지 않습니다(일반 BFCL V4에서 ~59% 점수 기록). L1이 기본 확정적 안전 메커니즘입니다.

**알려진 L1의 한계:**
- **고르지 않은 언어 커버리지.** 위기 문구는 영어 및 기타 언어로 매칭되며, 세트는 경로에 따라 다릅니다. 웹 AI 채팅 게이트(`services/crisisSafetyFilter.ts`)는 스페인어, 프랑스어, 포르투갈어, Romanian, 러시아어, 우크라이나어, 아랍어, 독일어, 일본어, 한국어, 중국어 및 불가리아어 문구도 매칭합니다. 오프라인 클라이언트 측 검사(`checkInputSafetyClient`)는 스페인어, 프랑스어, 포르투갈어, 러시아어, 아랍어, 독일어 및 우크라이나어도 매칭합니다. iOS 게이트는 자체 내장 목록(영어, 스페인어, 프랑스어, Romanian, 러시아어, 아랍어 및 히브리어)을 보유하고 있으며, 연결 가능할 때 시작 시 서버에서 키워드를 추가합니다. 의료 용법/용량 패턴은 모든 클라이언트 경로에서 영어 전용입니다. 특정 경로에서 패턴이 없는 지원 언어는 모델 자체의 안전 훈련(L2)에 의해서만 보호됩니다.
- **정규식은 하한선이지 상한선이 아닙니다.** 다른 말로 바꾸어 표현된 심리적 고통("I don't want to be here anymore")은 매칭되지 않습니다. L1은 정의된 고신호 표현(defined high-signal phrasings)을 차단하고, L2(모델 정렬)가 롱테일을 처리합니다.

**경로별 커버리지:**

| Path | L1 Input | L1 Output | Notes |
|------|:--------:|:---------:|-------|
| 로컬 Ollama (오프라인, 웹) | ✅ 클라이언트 측 | ✅ 클라이언트 측 | `checkInputSafetyClient` + `checkOutputSafetyClient` |
| iOS 온디바이스 (llama.cpp) | ✅ 네이티브 | ✅ 네이티브 | `SafetyFilter.swift` (`../../ios-native/PrismAAC/Sources/Safety/`); 출력 검사는 탈옥 콘텐츠(jailbreak content)만 차단함 |
| 포털 `/prism-aac/chat` | ✅ | 스트리밍* | 모델 호출 전 입력 검사됨 |
| 포털 `/prism-aac/infer` | ✅ | ✅ | 공유 안전 패턴 모듈 |
| 포털 `/prism-aac/inference` | ✅ | ✅ | 공유 안전 패턴 모듈 |

*스트리밍 클라우드 응답은 출력을 위해 모델 안전(L2)에 의존합니다. L1은 전송 중인 토큰 스트림을 정규식으로 필터링할 수 없습니다.

### What a crisis interception looks like

사용자가 AAC 인터페이스를 통해 심리적 고통을 입력하면, L1은 (모델이 실행되기 전에) 즉시 다음을 반환합니다:

> "I'm concerned about your safety. Please call or text 988 (Suicide & Crisis Lifeline) right now — available 24/7. If in immediate danger, call 911. You are not alone."

### Privacy

- 온디바이스 AI는 프롬프트를 로컬에서 처리합니다 — no data leaves the device
- 클라우드 음성 서비스(Cloud speech) 및 클라우드 AI(사용되는 경우)는 TLS를 통해 Synalux 포털로 전송되며, 텍스트는 메모리에서 처리되고 저장되지 않습니다
- 사용자 프롬프트는 저장되거나 훈련에 사용되지 않습니다
- 계정이 필요하지 않으며, 무기명 사용량/오류 텔레메트리(Datadog)에는 입력되거나 말한 텍스트가 절대 포함되지 않습니다
- 전체 개인정보 처리방침은 [PRIVACY.md](../../PRIVACY.md)를 참조하십시오

## 무료 Read & Write 대안

PrismAAC는 대부분의 AAC 사용자가 Read & Write를 구매할 때 필요로 하는 모든 읽기 보조 기능을 무료로 제공합니다. 웹 계정 없이 브라우저에서 바로 사용할 수 있습니다. 문장 끝 발화 + 단어 강조는 [입력 및 발화](#%EF%B8%8F-입력-및-발화), 문서는 [PDF 리더](#-pdf-리더) 및 [스크린샷 리더 (OCR)](#-스크린샷-리더-ocr), Gmail / Docs / Word Online 등 다양한 앱에서의 사용은 [Chrome 확장 프로그램](#-chrome-확장-프로그램--모든-텍스트-입력란에서-동일한-읽기-보조-기능-제공) 항목을 참조하세요.

## PrismAAC 비교

| | PrismAAC | TouchChat | Proloquo2Go | LAMP Words | TD Snap | CoughDrop | Snap Core First | Grid 3 | Tobii Dynavox |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **카메라 → 어구 추천** (사물 인식 후 단어 추천) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **기기 내 AI** (99–100% 라우팅, HIPAA 지원) | 🟢 | 🔴 | 🔴 | 🔴 | 🟡 | 🟡 | 🔴 | 🔴 | 🟡 |
| **사용자별 어구 순위** (아동 맞춤 적용) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| 간병인 수정 사항이 **학습 데이터로 반영** | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **AI 튜터** (수학 + 10개 주요 과목) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **셀 그리드 수학 캔버스** | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **지역 맞춤형 역사 지원** (280개 이상 지역) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **핸즈프리** 머리 + 손 + 제스처 + 스위치 스캐닝 | 🟢 | 🟡 | 🟡 | 🔴 | 🟢 | 🟡 | 🟡 | 🟢 | 🟢 |
| **핸즈프리 AI 채팅** (음성 루프 + 호출어 + 침상 모드) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| 치료 목적 **AAC 게임** (12가지 내장) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🟡 | 🟡 | 🔴 | 🔴 |
| **오픈 소스** (AGPL-3.0) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🟢 | 🔴 | 🔴 | 🔴 |
| **무료 제공** (생명 안전 접근성) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🟢 | 🔴 | 🔴 | 🔴 |
| 음성 팩 **마켓플레이스** | 🟢 | 🔴 | 🟡 | 🔴 | 🟡 | 🔴 | 🔴 | 🟡 | 🟡 |
| **다국어 지원** (25개) | 🟢 | 🟢 | 🟢 | 🔴 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| **간병인 노트** (가정 / 학교 / 병원) | 🟢 | 🔴 | 🔴 | 🔴 | 🟡 | 🟡 | 🟡 | 🔴 | 🟡 |
| **Apple Watch** 단독 모드 | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Chrome 확장 프로그램** 읽기 보조 도구 | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |

🟢 = 전체 지원 &nbsp;&nbsp; 🟡 = 부분 지원 &nbsp;&nbsp; 🔴 = 미지원

> 본 비교표는 2026년 5월 기준 공개된 제품 정보를 반영합니다. PrismAAC는 지속적으로 업데이트되며, 경쟁 제품 역시 기능이 추가될 수 있습니다. 객관적인 내용 유지를 위한 PR을 환영합니다 — `CONTRIBUTING.md`를 참고하세요.
>
> Grid 3 및 Tobii Dynavox는 표에 반영되지 않은 강력한 시선 추적 + 스위치 스캐닝 하드웨어 연동을 제공합니다 (특수 임상 환경 및 전용 하드웨어 필요).

---

## iOS 및 Apple Watch

### iPhone / iPad

llama.cpp Metal 기반의 **듀얼 엔진 기기 내 AI** 아키텍처와 WKWebView로 웹 UI를 감싼 네이티브 Swift 앱입니다. 

다양한 기기에서 오프라인 상태로 지연 없이 AI에 접근할 수 있도록, 기기의 가용 메모리에 따라 두 개의 서로 다른 모델을 자동으로 동시에 실행합니다:

| 기기 | RAM | 대화형 AI | 라우팅 정확도 | 자동 완성 |
|---|---|---|---|---|
| iPad Pro M1/M2/M4 | ≥ 16 GB | 4B Q4_K_M (3.4 GB) | **100%** | 360M (내장) |
| iPhone 15/16 Pro, iPad Air | 8–15 GB | 4B Q4_K_M (3.4 GB) | **100%** | 360M (내장) |
| 기타 모든 iPhone / iPad | < 8 GB | 2B Q3_K_M (2.3 GB) | **99.1%** | 360M (내장) |

> 정확도: BFCL 벤치마크, 115개 도구 라우팅 케이스 × 3회 무작위 시드 테스트, temperature=0 (2026년 6월 기준).

#### 기기 내 AI — 첫 실행부터 오프라인 작동

모든 기기 앱 내부에는 AI 모델이 기본 내장되어 있습니다. 다운로드, WiFi 연결, 계정이 필요 없이 앱을 켜는 즉시 소통을 시작할 수 있습니다.

| 기기 | 번들 모델 | 용량 | 역할 |
|---|---|---|---|
| **iPhone / iPad** | Qwen3.5-4B Q3_K_M | 2.3 GB | 도구 라우팅, 핸즈프리, 침상 모드, 호출어 (99.1% 정확도) |
| **Apple Watch** | SmolLM2-360M | 207 MB | 기호 확장, 긴급 어구, 예측 텍스트 (100% 정확도) |

WiFi를 통해 Mac에 연결하는 경우, 설정 → 로컬 AI 메뉴에서 더 큰 모델(9B, 27B)을 지정하여 활용할 수 있습니다 (BFCL 정확도 100%).

<details>
<summary><strong>기술적 세부사항</strong></summary>

- **L1 결정론적 안전 게이트:** 모델 실행 전 입력 및 사용자 도달 전 출력 모두에 정규식 기반 위기/의료 차단 적용. 자해 의도를 집중 감지하며, 정당한 임상 AAC 사용을 차단하지 않도록 일반 임상/약학 용어("복용량", "밀리그램")는 차단하지 않습니다.
- **클라이언트 측 출력 안전:** 로컬 Ollama 결과는 표시되기 전 `checkOutputSafetyClient`를 거치므로 오프라인 사용자도 클라우드 사용자와 동일한 L1 보호를 받습니다.
- **신뢰도 게이트:** 임계값 미만의 기기 내 출력은 거부되어 클라우드로 전달되거나(유료) 유연하게 대체(무료)됩니다.
- 메모리 상태에 따른 유연한 단계적 저하: 전체 AI → 클라우드 AI → 핵심 기능 전용 → 긴급 모드
- OOM(메모리 부족) 예비 처리: 4B Q4_K_M → 2B Q3_K_M → 360M
- Dynamic Island / 노치를 고려한 Safe area 적용
- Apple Watch 긴급 요청 전송을 위한 WCSession 브릿지
- Keychain 기반 인증 토큰 관리

</details>

**설정 → 🤖 로컬 AI 모델** — 기기 내 모델 다운로드 및 관리:
- `localhost:11434`에서 Ollama 자동 감지
- Mac에 WiFi 연결: iPad/iPhone → Mac Ollama (BFCL 정확도 100%의 9B/27B)
- 실시간 진행 표시줄을 통한 모델별 다운로드
- 지원 모델: `:2b` (2.3 GB) · `:4b` (3.4 GB) · `:9b` (5.8 GB) · `:27b` (16.8 GB)


### Apple Watch (단독 실행)

iPhone 없이 독립 실행 가능 — 오프라인 어구 사전을 탑재하고 있습니다.

<p align="center">
  <img src="../../docs/screenshots/watch-series.png" alt="Watch Series 11" width="140" />
  <img src="../../docs/screenshots/watch-ultra.png" alt="Watch Ultra 3" width="140" />
</p>

- **오프라인 번역:** 1,261개 어구 × 20개 언어 포함 (411 KB JSON) — 네트워크 없이 100% 정확한 즉시 조회
- ARASAAC 이미지가 포함된 2열 픽토그램 그리드
- 받아쓰기 + 키보드 입력이 포함된 AI 채팅 (온라인 시 클라우드, 오프라인 시 어구 사전 사용)
- 긴급 시스템: 카운트다운 → WCSession → 셀룰러 예비 전환 → TTS
- TTS 출력이 포함된 번역 (오프라인 사전 우선, 클라우드 예비 전환)
- 수신함: 간병인이 보낸 메시지 수신 및 답장
- 긴급 발송 시 인증서 피닝 (SPKI SHA-256) 적용
- 모든 AI 경로에 NFKC + 23개 토큰 주입 위협 정화 적용

---

## 📊 간병인 인사이트 대시보드 (v1.8)

앱 내부에서는 예측 정확도, 운동 추이, 음성 신뢰도, 머리 추적 안정성, 소통 패턴, 간병인의 수정 내역 등 다양한 행동 데이터를 기록합니다. 이전에는 **이러한 데이터가 간병인에게 전달되지 않고** 텍스트 메모장만 제공되었습니다.

이제 간병인 패널의 **인사이트 탭**에서 7개의 실시간 모니터링 위젯을 확인할 수 있습니다. 각 위젯은 예측 경로에 영향을 주지 않고 5분마다 실행되는 백그라운드 지표 수집기를 기반으로 작동합니다.

### 간병인 확인 가능 항목

| 위젯 | 의미 | 임상적 가치 |
|---|---|---|
| **예측 효율성** | "적중률 72% ↑ (지난 24시간 대비)" | 어휘 집합이 적절하게 작동하는지 확인 |
| **어휘 활용도** | "활성 45개 · 신규 12개 · 미사용 8개" | 채택된 어구와 제거가 필요한 어구 구분 |
| **소통 주제** | "주요 주제: 학교 (35%), 음식 (22%)" | 주제 분포 변화를 통한 퇴행이나 환경 변화 감지 |
| **운동 추이** | "머무르기 시간 850ms ↓ (개선됨)" | 운동 제어력 개선 → 시간 단축 / 저하 → 작업치료(OT) 상담 권장 |
| **추적 신뢰도** | "이탈 2회 · 가동률 98%" | 빈번한 이탈 → 자세, 피로도, 보정 상태 점검 필요 |
| **음성 신뢰도** | "성공률 97% · 예비 전환 1회" | Azure TTS 오류, API 키 만료, 연결 문제 점검 |
| **수정 부담** | "총 수정 횟수 47회" | 수정 비율 증가 = 이 아동에 맞춘 모델 재학습 필요 |

### 대시보드 레이아웃

| 간병인 패널 | | ✕ |
|:---|:---|---:|

| + 메모 | 기록 | **인사이트** |
|:---:|:---:|:---:|

> **예측 효율성**
> `적중률 72%` &nbsp;&nbsp; ↑ 지난 24시간 대비
> ![sparkline](https://img.shields.io/badge/trend-72%25_____85%25_____78%25_____72%25-4CAF50?style=flat-square)

> **어휘 활용도**
> `활성 45개` · `신규 12개` · `미사용 8개`
> `████████████████░░░░░░` 채택 69% / 시도 18% / 미사용 13%

> **소통 주제**
> `학교` 35% · `음식` 22% · `놀이` 18%
> ![sparkline](https://img.shields.io/badge/school-35%25-9C27B0?style=flat-square) ![sparkline](https://img.shields.io/badge/food-22%25-FF9800?style=flat-square) ![sparkline](https://img.shields.io/badge/play-18%25-2196F3?style=flat-square)

> **운동 추이**
> `머무르기 시간 850ms` &nbsp;&nbsp; ↓ 개선됨
> ![sparkline](https://img.shields.io/badge/trend-1200____1100____950_____850ms-FF9800?style=flat-square)

> **추적 신뢰도**
> `오늘 이탈 2회` · `가동률 98%`
> ![sparkline](https://img.shields.io/badge/uptime-98%25-4CAF50?style=flat-square)

> **음성 신뢰도**
> `성공률 97%` · `예비 전환 1회`
> `██████████████████████████████░` Azure 94% / Web Speech 3% / 실패 3%

> **수정 부담**
> `총 수정 횟수 47회` &nbsp;&nbsp; 이번 주 +3
> ![sparkline](https://img.shields.io/badge/trend-38_____41_____44_____47-795548?style=flat-square)

<sub>데이터 포인트 286개 · 최근 7일 · 5분마다 업데이트</sub>

### 아키텍처

```
PredictionBar 탭 --> recordPredictionHit() (동적 임포트, ~0.01ms)
                                     |
        +--------------------------------------------+
        |      metricsCollector (5분 타이머)          |
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
        |  7일 순환 - 5분 버킷 - 400KB               |
        +--------------------------------------------+
                                     |
        +--------------------------------------------+
        |  CaregiverInsightsTab (지연 로딩)           |
        |  7개 InsightCard 위젯 + SVG 스파크라인      |
        |  간병인이 탭을 누를 때만 렌더링               |
        +--------------------------------------------+
```

### 성능 보장

| 항목 | 보장사항 |
|---|---|
| **키 입력 경로** | 0ms 지연 추가 — 적중/미적중 처리는 동적 임포트 + 카운터 증가 사용 |
| **메모리** | 최근 7일간 ~400KB localStorage + ~50KB RAM 사용 |
| **번들 크기** | ~2KB JS (차트 라이브러리 미사용 — 순수 SVG 스파크라인) |
| **오프라인** | 100% localStorage 활용 — 네트워크 호출 없음 |
| **iPad** | 수직 스크롤 카드, 120×32px 스파크라인 적용 |
| **개인정보** | 개인 건강 정보(PHI) 미포함 — 작업 건수만 포함되며 간병인 PIN으로 보호됨 |

### 예시: 예측 효율성 위젯 읽기

```
예측 효율성
적중률 78%                    ↑ 지난 24시간 대비
╭──╮ ╭╮╭─╮
│  ╰─╯╰╯ ╰──╮╭──
```

- **적중률 78%**: 아동이 직접 입력하는 대신 예측 바의 단어를 78% 비율로 선택했음을 의미합니다. 현재 어휘 구성이 아동의 소통 패턴에 잘 들어맞고 있음을 나타냅니다.
- **↑ 지난 24시간 대비**: 어제에 비해 적중률이 상승했습니다 — 적응형 엔진이 학습하고 있음을 의미합니다.
- **스파크라인**: 지난 24시간 동안의 적중률 추이를 나타냅니다. 하락한 구간은 새로운 소통 주제나 환경 변화와 관련이 있을 수 있습니다.

적중률이 40% 미만으로 떨어지면 예측 엔진이 다루지 못하는 새로운 주제로 대화 중일 수 있으므로 어휘 목록을 업데이트하는 것이 좋습니다.

### 예시: 운동 추이 위젯 읽기

```
운동 추이
머무르기 시간 1200ms            ↑ 반응 속도 저하
╭──╮
│  ╰──╮╭──╮╭─
```

- **머무르기 시간 1200ms**: 선택을 확정하려면 1.2초 동안 타일에 커서를 올리고 있어야 합니다. (일반적인 범위: 800–2000ms)
- **↑ 반응 속도 저하**: 머무르기 시간이 길어지고 있습니다. 피로 누적, 약물 변경 또는 근육 제어력 저하를 의미할 수 있습니다.
- **조치 사항**: 이 추세가 3일 이상 지속되면 작업치료사(OT)의 확인을 받아보세요. 앱이 시간을 자동 조절하지만 원인 파악이 필요합니다.

---

## 모듈

### 📂 카테고리

그림 모드에서 그리드 크기는 어휘 페이지당 타일 수를 결정합니다 (4는 2 × 2, 6은 3 × 2). 보드 위를 좌우로 스와이프하거나 카테고리 제목 옆의 화살표를 사용하여 페이지를 이동합니다. 페이지 이동 자체로는 단어가 입력되거나 소리가 나지 않으며, 선택하려는 타일을 직접 탭해야 합니다. 별도의 페이지 번호 표시 없이 스크린 리더가 현재 페이지 위치를 읽어줍니다.

PECS 방식의 그림 타일입니다. 카테고리를 탭하고 타일을 누르면 단어가 음성으로 출력되고 입력란에 들어갑니다. 문자를 읽지 못하거나 이제 배우기 시작한 사용자 모두에게 적합합니다. 퍼짐 활성화(Spreading Activation) 알고리즘을 통해 사용 패턴에 따라 타일 배치가 최적화됩니다 — 자주 누르는 타일은 위로 올라오고, 몇 달 동안 쓰지 않은 타일은 차츰 뒤로 밀려납니다.

**서라운드 레이아웃** — 카테고리가 키보드 좌측 스크롤 칼럼에 함께 배치되어, 모드를 전환할 필요 없이 그림 타일 선택과 텍스트 입력을 동시에 진행할 수 있습니다. 상단 예측 바도 유지되므로 두 입력 방식 모두 언제든 활용할 수 있습니다.

![서라운드 모드의 카테고리 — 왼쪽에 스크롤 가능한 카테고리 카드, 오른쪽에 전체 키보드](../../docs/screenshots/categories-surround-v2.png)

<details>
<summary><strong>기능 및 기술 세부사항</strong></summary>

- 기본 22개 카테고리 제공: 사람, 음식, 감정, 신체, 옷, 동물, 장소 등
- 간병인이 아동별로 타일을 자유롭게 추가, 삭제, 재배치 가능
- 각 타일에는 다국어 지원을 위한 `textKey`가 지정되어 있어, 앱 언어를 변경하면 한 번의 탭으로 모든 타일의 라벨이 자동 전환됩니다
- 타일 픽토그램은 ARASAAC 및 엄선된 라이브러리를 사용합니다. 음성 복제 기능을 활용하면 아동의 형제나 부모의 목소리로 타일 소리를 설정할 수 있습니다 (유료)
- 사용자별 n-gram 학습: "I want eat"을 세 번 입력한 아동에게는 다음 세션부터 "want" 다음에 "eat" 타일이 상단에 배치됩니다
- HRR 홀로그래픽 메모리: Rust WASM 기반으로 약 0.2ms 만에 맥락 예측을 수행하여, 핵심 AAC 어구의 Top-1 정확도를 +27% 향상시킵니다

**렌더링 경로:** `components/CategoryPanel.tsx` → `useCategoryStore` → `constants/phrases.ts`(시스템) 및 Supabase 사용자 재정의 값(유료)에서 타일을 불러옴. 타일을 탭하면 `messageStore.appendText(phrase)`가 실행되며 `aacSpeak()`를 통해 음성이 출력됩니다.
</details>

---

### ⌨️ 입력 및 발화
화면 키보드와 **단어 예측**, **AI 자동 완성**, 그리고 입력란의 메시지를 자연스러운 신경망 음성으로 읽어주는 **읽기** 버튼을 제공합니다. 키보드로 입력한 내역은 예측 엔진에 학습되어, 자주 사용하는 단어가 다음 입력 시 우선적으로 추천됩니다.

![`hello`가 입력된 Prism AAC 키보드, 예측 타일 및 읽기 버튼](../../docs/screenshots/keyboard-typing.png)

**읽기 보조 기능 (Read & Write 지원 기능 포함)** — 읽기, 기억, 인지 도움이 필요한 사용자를 위한 기능:

- **단어별 발화** — 띄어쓰기를 누르는 순간 해당 단어를 음성으로 바로 읽어주어, 문장을 다 쓰지 않아도 입력한 단어를 확인할 수 있습니다.
- **문장 완성 시 읽기 (`.?!`)** — 마침표, 물음표, 느낌표로 문장을 끝맺으면 전체 문장을 다시 읽어주어 작성 내용을 놓치지 않도록 돕습니다. 설정 → `speakOnSentenceEnd` 항목에서 켜고 끌 수 있습니다 (기본값 ON).
- **발화 시 단어 단위 하이라이트** — 음성이 출력되는 동안 읽고 있는 단어의 배경이 노란색으로 강조됩니다. 시각적 읽기 지원이 필요한 사용자가 위치를 쉽게 따라갈 수 있습니다.

<details>
<summary><strong>기능 및 기술 세부사항</strong></summary>

- QWERTY 상단에 5개의 예측 타일이 배치되며, 키를 누를 때마다 신속하게 갱신됩니다
- AI 자동 완성 기능("hw" → "how", "togoso" → "to go so")은 Synalux `text/correct` API(Gemini 2.5 Flash-Lite 기반, 평균 반응속도 ~752ms)를 활용합니다
- 교차 언어 간섭 방지: 루마니아어 `eu` 단어가 영어 입력란에 혼합되어 나타나지 않도록 말뭉치 빈도를 교차 비교합니다
- 문장 부호(평서문/의문문/감탄문)를 분석하여 어조를 자동으로 조절하여 읽어줍니다
- 음성 출력 단계: 영구 음성 캐시(동일 문장 재요청 없이 즉시 재생) → 포털 클라우드 음성(Inworld TTS-2, 지원하지 않는 언어는 Azure Neural 및 Gemini TTS 활용) → OS Web Speech(오프라인) → WASM espeak-ng(최종 예비용). 자세한 내용은 [`docs/TTS-ARCHITECTURE.md`](docs/TTS-ARCHITECTURE.md) 및 [`docs/SPEECH_CACHE.md`](docs/SPEECH_CACHE.md)를 참고하세요
- 단어 하이라이트 시간 추정(~60ms/글자, 배속 설정에 따라 가변 적용) — 백엔드 수정 없이 모든 TTS 레벨에서 동작합니다
- 언어별 1.5MB SQLite n-gram 말뭉치 활용 (단일어/2연어/3연어), 언어 변경 시 지연 로딩
- **HRR 맥락 기억** — 발화된 문장을 학습하는 229KB Rust WASM 기반 홀로그래픽 검색 기술 적용. 키를 누를 때마다 ~0.2ms 속도로 관련 어구를 탐색하여 예측 타일 상단에 배치합니다

**HRR 예측 벤치마크** (54개 단위 테스트 + 10개 정밀 시나리오):

| 시나리오 | 기존 Top-1 | HRR+ Top-1 | 향상 | 기존 MRR | HRR+ MRR | MRR 향상 |
|----------|---------------|------------|------|-------------|---------|----------|
| 핵심 AAC 어구 (1회) | 36.7% | 46.7% | **+27.3%** | 0.634 | 0.672 | +6.0% |
| 핵심 AAC 어구 (매일 5회) | 36.7% | 46.7% | **+27.3%** | 0.634 | 0.672 | +6.0% |
| 개인 어휘 목록 | 70.4% | 81.5% | **+15.8%** | 0.809 | 0.883 | +9.2% |
| 혼합 (전체 어구) | 47.2% | 56.9% | **+20.6%** | 0.669 | 0.707 | +5.7% |
| 세션 간 재호출 | 80.0% | 80.0% | +0.0% | 0.900 | 0.900 | +0.0% |
| 모호한 접두사 | 66.7% | 66.7% | +0.0% | 0.738 | 0.738 | +0.0% |

Top-1 = 첫 번째 타일에 정답 위치. Top-5 = 5개 타일 중 정답 포함. MRR = 평균 상호 순위 (높을수록 정답이 앞에 위치). HRR 적용 시 정확도가 떨어지는 예외 케이스는 없었습니다. 개인 어휘(+9.2% MRR) 및 핵심 AAC 어구(+27.3% Top-1)에서 성능 향상이 돋보였습니다.

**렌더링 경로:** `components/Keyboard.tsx` → `messageStore.appendChar` → `predictionStore.updatePredictions(text, lang)` → `engine/predictionEngine.ts` (최신성 × 빈도 × n-gram 가중치) + 선택적 `services/textCorrectService.ts` AI 보정 + `services/hrrContext.ts` HRR 검색. 하이라이트: `services/aacSpeak.ts`가 `ttsHighlightBus`에 `ttsHighlightStart` 이벤트를 전송하면 `components/MessageBar.tsx`가 이를 수신하여 `ColoredText`에 `activeWordIndex`를 전달합니다.
</details>

---

### ✨ AI 채팅
AAC 사용자의 표현 방식에 맞춰 작동하는 기기 내 및 클라우드 어시스턴트입니다. 생성되는 답변을 실시간 스트리밍으로 보여주며, 각 줄을 탭하면 입력란으로 옮겨져 아동이 직접 문장의 주체가 될 수 있도록 돕습니다. 무료 플랜은 Gemini 2.5 Flash 기반으로 작동하며, 유료 플랜은 Claude Sonnet 4 및 짧은 질의용 prism-coder 모델을 활용합니다.

**클린 AI 모드** — AI 채팅창이 열리면 단어 예측 바가 자동으로 숨겨져(질문 작성 시에는 예측이 필요하지 않으므로) 답변과 전송 버튼에 집중할 수 있습니다.

**핸즈프리 AI 대화** — 상단 헤더의 🔁 버튼을 누르면 연속 음성 대화 모드로 전환됩니다. AI 답변이 끝난 후 마이크가 자동으로 다시 켜지므로 화면을 터치하지 않고도 대화를 계속 이어갈 수 있습니다. 헤더 아래 상태 표시줄에서 모드 활성화 여부를 확인할 수 있습니다.

**실시간 번역 모드** — 앱 설정 언어와 출력 언어가 다를 경우(예: 포르투갈어로 입력하여 영어로 출력), 대화 내용이 스트리밍 상태로 번역 경로를 통과하여 단일 언어 모드와 동일한 속도로 응답을 받아볼 수 있습니다.

![AI 채팅 패널 — AI 모드에서 예측 바가 숨겨지고 하단에 전체 키보드 사용 가능](../../docs/screenshots/panel-ai-chat-v2.png)

<details>
<summary><strong>기능 및 기술 세부사항</strong></summary>

- 입력란을 가리지 않도록 키보드 상단에 일체형 패널로 배치됩니다
- Web Speech API 기반 음성 입력 지원, 마이크 버튼 선택 시 인식 중인 내용이 실시간 표시됩니다
- AI가 생성한 문장을 탭하면 입력란으로 복사됩니다 (사용자가 문장의 주도권을 유지하도록 돕는 설계 — Valencia et al., CHI 2023)
- **핸즈프리 루프** — 🔁 헤더 버튼 선택; AI 답변 종료 1초 후 마이크 자동 재개; `aria-pressed` 속성 및 녹색 배경으로 상태 확인 가능
- **"Hey Prism" 호출어** — 침상 모드 레이어에서 작동; 지속적인 `SpeechRecognition`을 통해 어구를 감지하고 마이크를 켭니다 (iOS 네이티브 오디오 세션 제어 시 미지원)
- 네트워크 단절 시 대기 상태에 갇히지 않도록 클라이언트 측 15초 타임아웃 및 재시도 버튼 제공
- 401 / 네트워크 오류 / 타임아웃 발생 시 원문 에러 대신 이해하기 쉬운 문구로 안내합니다
- 오프라인 상태일 때는 로컬 Ollama (`prism-coder:2b`) 모델로 전환됩니다

**렌더링 경로:** `components/AIChatPanel.tsx` → `services/aiService.askAI()` (또는 번역 모드 시 `translateAI()`) → Synalux `/api/v1/chat` 서비스에서 SSE 스트림 수신.
</details>

---

### 🛏 침상 모드

> **중요 접근성 기능.** 침상 모드는 음성 발화, 키보드 입력, 화면 터치가 어려운 사용자를 위해 제작되었습니다. 중환자실(ICU) 침대에 누워 인공호흡기를 착용하고 음성을 낼 수 없으며 손 움직임이 제한된 사용자가 시선 추적이나 한 개의 스위치 단자만으로 소통할 수 있도록 지원합니다.

화면 터치나 말하기가 어려운 환경에 최적화된 전체 화면 AI 소통 인터페이스입니다. 모든 버튼과 선택 영역이 크게 배치되어 있습니다. 음성은 여러 입력 수단 중 하나일 뿐입니다. 스위치 스캐닝, 시선 추적, iOS 음성 제어, 머리 추적, 스위치 제어 화면 키보드 등 보조공학 기기 및 기능과 완벽히 연동됩니다.

병원 침상, 수술 후 회복실, 호스피스 환경에서 사용한 AAC 커뮤니티의 현장 피드백(r/AssistiveTechnology, 2025년 5월)을 바탕으로 개발되었습니다.

**Mac / Windows에서도 작동하나요?** 네, 침상 모드는 브라우저에서 동작하는 프로그레시브 웹 앱(PWA) 기능으로, 특정 OS에 제한되지 않고 모든 기기에서 실행할 수 있습니다.

---

#### 사용 대상

다양한 운동 및 언어 능력을 가진 사용자를 폭넓게 지원합니다. 아래 소개할 빠른 어구 카드가 소통과 손 움직임이 크게 제한된 사용자에게 큰 도움을 줍니다.

| 사용자 유형 | 추천 입력 방식 |
|---|---|
| 말하기 가능, 팔 움직임 제한 | 음성 (🎙 마이크 버튼) + 핸즈프리 루프 |
| 발성 가능, 정확한 발화 어려움 | "Hey Prism" 호출어 + 핸즈프리 루프 |
| 발화 불가, 화면 터치 가능 | 빠른 어구 카드 (1회 탭) |
| 발화 불가, 운동 능력 제한 (스위치 1개) | 빠른 어구 카드 위에서 iOS 스위치 제어 또는 Android 스위치 접근 스캐닝 사용 |
| 발화 불가, 손 움직임 불가 (시선 추적기) | 마우스 커서 방식으로 인식되는 모든 시선 추적 장비 (Tobii, EyeGaze Edge 등) |
| 발화 불가, 머리 이동 가능 | 머리 추적 (iOS 헤드 포인터, iPhone 16 카메라 컨트롤 등) |
| 기관절개 / 인공호흡기 착용, 발성 불가 | 시선 추적/스위치를 통한 빠른 어구 카드 + 간병인 보조 모드 |

---

#### 플랫폼 지원 현황

| 플랫폼 | 침상 모드 | 빠른 카드 | 핸즈프리 루프 🔁 | 호출어 🎯 |
|---|:---:|:---:|:---:|:---:|
| 웹 — Mac / Windows / Linux (모든 브라우저) | ✅ | ✅ | ✅ | ✅ |
| 웹 — iPhone / iPad (Safari) | ✅ | ✅ | ✅ | ⚠️ Safari 전용 |
| iOS 네이티브 앱 (App Store) | ✅ | ✅ | ✅ | ❌ 핸즈프리 사용 권장 |
| Android (Chrome / Edge) | ✅ | ✅ | ✅ | ✅ |
| 시선 추적 장비 (마우스 포인터 방식) | ✅ | ✅ | ✅ | ✅ |
| 스위치 스캐닝 (iOS 스위치 제어) | ✅ | ✅ | ✅ | ❌ |
| Apple Watch | ❌ | ❌ | ❌ | ❌ |

> **iOS 네이티브 앱에서 호출어가 지원되지 않는 이유:** 네이티브 브릿지가 오디오 세션을 직접 제어(`prismNativeBridge.startVoice`)하므로, 호출어 서비스가 사용하는 브라우저 `SpeechRecognition` API와 충돌이 발생합니다. 대신 AI 응답 종료 1초 후 마이크를 자동으로 다시 켜주는 **핸즈프리 루프**(🔁)를 활용하세요.

---

#### 실행 방법

1. 도구 모음의 🤖 아이콘을 눌러 **AI 채팅** 패널을 엽니다.
2. 패널 상단의 **🛏** 아이콘을 누르면 전체 화면 레이어가 즉시 활성화됩니다.
3. 원하는 입력 방식을 선택하여 소통을 시작합니다.

<p align="center">
  <img src="../../e2e/_screenshots/bedside-overlay-open.png" alt="침상 모드 활성화 상태 — 검은색 전체 화면 UI. 상단에 빠른 어구 카드가 배치되고 중앙에 AI 응답, 하단에 대형 빨간색 마이크 버튼이 위치함." width="260">
  <img src="../../e2e/_screenshots/bedside-overlay-handsfree-on.png" alt="핸즈프리가 활성화된 침상 모드 — 🔁 버튼이 녹색으로 강조되고 '핸즈프리 ON' 문구가 표시됨" width="260">
  <img src="../../e2e/_screenshots/bedside-hands-free-on.png" alt="녹색 배경과 aria-pressed=true 상태의 핸즈프리 토글 버튼" width="260">
</p>

#### 종료 방법

- **터치 / 탭:** 화면 우측 상단의 **✕** 버튼을 누릅니다 (48 × 48 px 클릭 영역).
- **키보드 / 스위치:** **Escape** 키를 누릅니다.
- **음성:** 레이어가 열려있는 동안 iOS 음성 제어 명령어를 말합니다.

종료하더라도 이전 대화 내역과 AI 세션 상태는 그대로 유지됩니다. 기존 패널 위에 독립된 레이어로 띄워지므로 작업 내용이 손실되지 않습니다.

<p align="center">
  <img src="../../e2e/_screenshots/bedside-overlay-closed.png" alt="침상 모드 종료 후 — 대화 기록이 유지된 채 메인 AI 채팅 패널로 복귀" width="260">
  <img src="../../e2e/_screenshots/bedside-wakeword-statusbar.png" alt="침상 모드에서 돌아온 후 메인 패널 상단에 'Hey Prism 활성화됨' 상태 메시지와 파란색 표시등이 출력됨" width="260">
</p>

---

### 🃏 빠른 어구 카드 — 언어 및 신체 표현이 어려운 사용자용

> **말하기와 화면 터치가 어려운 사용자를 위한 핵심 소통 수단입니다.** 빠른 어구 카드는 한번의 탭, 시선 응시, 스위치 스캔 선택으로 즉시 실행되는 사전 정의 버튼입니다. 타이핑이나 음성이 필요하지 않으며, 인터넷 연결 없이 오프라인에서도 작동합니다.

각 카드에는 대형 이모지 아이콘과 짧은 어구가 표시됩니다. 카드를 누르면 해당 어구가 입력란에 즉시 채워집니다. **핸즈프리 모드**가 켜져 있다면 해당 어구가 AI에 자동으로 전송됩니다.

#### 내장 카드 목록

사용 빈도가 높은 15개 카드가 기본 포함되어 제공됩니다. 이 카드는 삭제되지 않으며 오프라인에서 항상 사용할 수 있습니다.

**긴급 상황 (최우선 순위 — 의료 긴급 상황 시 즉시 소통):**

| 아이콘 | 어구 | 사용 상황 |
|:---:|---|---|
| 🆘 | 도와주세요 — 응급 상황입니다 | 즉각적인 위험, 긴급 호출, 의료진의 즉각적인 도움이 필요할 때 |
| 😢 | 통증이 있어요 | 신체 통증 발생 시 — 세부 위치/정도 표현 전 우선 전달 |
| 🫁 | 숨쉬기 힘들어요 | 호흡 곤란, 기도 이상, 공황 증상 발생 시 |
| 🔔 | 간호사 선생님을 불러주세요 | 일반적인 의료진 호출 필요 시 |

**신체적 욕구 표현:**

| 아이콘 | 어구 | 사용 상황 |
|:---:|---|---|
| 💧 | 물 좀 주세요 | 목마름, 구강 건조, 약 복용 시 |
| 🔥 | 너무 더워요 | 발열, 체온 조절, 이불 조절 필요 시 |
| 🥶 | 너무 추워요 | 오한, 체온 저하, 이불 조절 필요 시 |
| ↔️ | 자세를 바꿔주세요 | 체위 변경, 체중 분산, 수술 후 자세 교정 |
| 💊 | 약을 먹어야 해요 | 정기 약물 복용, 진통제 요청 시 |

**일상 소통:**

| 아이콘 | 어구 | 사용 상황 |
|:---:|---|---|
| ✅ | 네 | 긍정 표현 — 간병인의 질문에 답변할 때 |
| ❌ | 아니오 | 부정 표현 — 간병인의 질문에 답변할 때 |
| ⏳ | 잠시만 기다려주세요 | 준비 시간이 필요할 때 |

**정서 표현:**

| 아이콘 | 어구 | 사용 상황 |
|:---:|---|---|
| ❤️ | 사랑해요 | 가족과의 정서적 교감 |
| 🙏 | 감사합니다 | 고마움 표현 |
| 😨 | 무서워요 | 불안, 두려움 표현 — AI가 공감 반응을 유도함 |

#### 빠른 어구 카드 활용법

**단일 탭 / 시선 응시 / 스위치 선택:**
카드를 선택하면 텍스트가 입력란에 지정되며 다음 단계로 활용할 수 있습니다:
- AI에 전달하여 맥락에 맞는 답변 유도 (예: "무서워요" 선택 → AI가 안심시키는 메시지와 함께 상태를 묻는 질문 생성)
- 화면에 카드를 띄워 방 안에 있는 간병인이 메시지를 직접 확인하도록 활용

**핸즈프리 모드와 함께 사용:**
카드를 누르는 즉시 메시지가 AI로 자동 전송됩니다. AI 답변이 끝난 1초 후 마이크가 자동으로 재개되어 연속 대화가 가능합니다.

**"Hey Prism" 호출어와 함께 사용 (웹 / 데스크톱):**
호출어와 빠른 카드를 조합할 수 있습니다: "Hey Prism"으로 마이크를 켠 후, AI 응답에 대해 카드를 탭하여 추가 발화 없이 대화를 자유롭게 이어갈 수 있습니다.

#### 사용자 지정 카드 추가

간병인, 치료사, 가족은 담당 의사 이름, 자주 쓰는 표현, 특정 통증 부위, 종교적 표현 등 사용자에게 필요한 맞춤 카드를 직접 추가할 수 있습니다.

**추가 방법:**

1. 침상 모드 내부의 빠른 어구 띠 오른쪽 끝에 위치한 **＋ 추가** 버튼을 누릅니다.
2. 카드에 넣을 어구를 입력합니다 (최대 80자).
3. **카드 추가**를 누르면, AI가 문장의 의미를 분석하여 적절한 이모지 아이콘을 자동으로 지정합니다 (예: "이불 더 주세요" → 🛏, "기도하고 싶어요" → 🤲).
4. "✨ 생성 중…" 안내와 함께 아이콘이 지정된 후 카드가 저장됩니다.

추가된 카드는 기기 내부(localStorage)에 안전하게 저장됩니다. 앱을 재시작해도 유지되며, 계정 로그인이나 인터넷 연결 없이 항상 사용할 수 있습니다 (최초 아이콘 생성 시에만 네트워크가 사용됩니다).

**추천 사용자 지정 카드 예시:**

| 어구 예시 | 활용 이유 |
|---|---|
| `[의사 이름] 선생님, 와주세요` | 일반 호출보다 특정 의료진을 지칭하여 신속히 호출 |
| `가족과 이야기하고 싶어요` | 심리적 안정 및 중요 의사 결정 시 요청 |
| `불 좀 꺼주세요` | 빛 과민성, 두통, 수면 환경 조성 |
| `기도하고 싶어요` | 정서적 안정 및 종교적 케어 |
| `몸 상태가 이상해요` | 막연한 신체 불편함 전달 — AI가 세부 증상을 물어보도록 유도 |
| `석션이 필요해요` | 기관절개/인공호흡기 환자의 흡인 요청 |
| `주사 부위가 아파요` | 수액 혈관 누출 및 통증 알림 |
| `집에 가고 싶어요` | 심리적 상태 전달 및 퇴원 관련 대화 |

#### 사용자 지정 카드 삭제

1. 빠른 어구 띠 헤더의 **✏️ 편집** 버튼을 누릅니다.
2. 추가했던 카드 상단에 빨간색 **✕** 표시가 나타납니다 (기본 제공 카드는 보호되어 삭제되지 않습니다).
3. 삭제하려는 카드의 ✕ 표시를 누릅니다.
4. **완료**를 눌러 편집 모드를 마칩니다.

#### 스위치 스캐닝 설정 (iOS)

한 개의 외부 스위치(呼吸 스위치, 머리 스위치, 발 스위치, 베개 스위치 등)만 사용할 수 있는 경우:

1. iPhone/iPad에 Bluetooth 또는 젠더를 통해 스위치를 연결합니다.
2. **설정 → 접근성 → 스위치 제어 → 스위치**로 이동하여 연결된 스위치에 "항목 선택" 동작을 할당합니다.
3. **스위치 제어 → 스캔 방식**에서 "자동 스캐닝"을 선택합니다 — 화면 항목이 순차적으로 하이라이트됩니다.
4. Prism AAC의 침상 모드를 실행합니다. 스위치 제어가 빠른 어구 카드를 순차적으로 탐색할 때, 원하는 카드가 하이라이트되면 스위치를 눌러 선택합니다.
5. 어구가 즉시 입력 및 전송됩니다.

> 모든 빠른 어구 카드에는 `data-scan-group="quick-cards"` 속성이 적용되어 있어 보조공학 기기가 카드 영역을 그룹으로 묶어 효율적으로 스캔할 수 있습니다.

#### 시선 추적 장치 설정

시선 추적 장비(Tobii Dynavox, EyeGaze Edge, PCEye, MyTobii P10 등)는 OS에서 일반 마우스 커서(머무르기 클릭 지원)로 인식됩니다. 별도의 복잡한 설정 없이 사용할 수 있습니다:

1. 시선 추적 소프트웨어에서 머무르기 시간(Dwell Time)을 설정합니다 (초보자의 경우 800–1200ms 권장).
2. 브라우저에서 Prism AAC 침상 모드를 엽니다.
3. 원하는 빠른 어구 카드를 일정 시간 바라보고 있으면 클릭이 확정됩니다.

카드의 최소 크기(88 × 80 px)는 WCAG 2.5.5 AAA 표준 목표 크기(44 × 44 CSS px)를 상회하며, 일반적인 시선 추적 권장 크기(60 × 60 px)보다 넉넉하게 설계되었습니다.

---

<details>
<summary><strong>전체 기능 및 기술 구현 세부사항</strong></summary>

**통합 개발된 5가지 하위 시스템:**

1. **빠른 어구 카드** — `services/bedsideCards.ts` + `components/BedsideOverlay.tsx` UI 띠.

   - 저장소: `localStorage` 내 `prism_bedside_cards_v1` 키 활용. 로드 시 스키마 검증을 거쳐 잘못된 형식은 자동으로 걸러냅니다.
   - 용량 제한: 최대 50개 저장 가능 (메모리 과다 점유 방지).
   - 내장 카드: `builtin-` 접두사 ID를 가진 15개 카드 제공; 삭제 모드 시 해당 접두사를 검사하여 ✕ 버튼이 노출되지 않도록 보호합니다.
   - AI 아이콘 생성: `services/aiService.ts → inferCardIcon(text)` 사용. 로컬 Ollama 및 Synalux 클라우드 경로를 동일하게 활용합니다. 프롬프트 규칙에 따라 어구에 들어맞는 단일 이모지 코드 포인트를 추출해 반환합니다. 네트워크 오류 발생 시 💬 기본 아이콘으로 대체됩니다.
   - 오프라인 지원: 카드 활용은 완전히 오프라인으로 동작하며, 카드를 새로 등록할 때 아이콘 생성을 위해서만 네트워크를 활용합니다 (오프라인 시 💬로 기본 등록).

2. **핸즈프리 AI 대화 (🔁)** — AI 채팅 상단 헤더에서도 접근 가능합니다. AI 응답이 종료되면 1초 후 마이크가 자동으로 다시 켜집니다. `handsFreeRef` / `startListeningRef` 패턴을 사용하여 리렌더링 시에도 이벤트 콜백이 안정적으로 유지됩니다.

   ![메인 AI 패널의 핸즈프리 상태 표시줄](../../e2e/_screenshots/bedside-hands-free-statusbar.png)

3. **침상 모드 레이어** — `fixed inset-0 z-50 bg-black` 형태의 전체 화면 다크 UI로 렌더링되어 메인 AI 패널의 대화 상태를 그대로 유지합니다. 접근성 사양: `role="dialog"`, `aria-modal="true"`, `aria-label="Bedside Mode"`, WCAG 2.1 SC 2.1.2 포커스 트랩 적용 (Tab/Shift+Tab으로 레이어 내부 순환, `Escape` 키로 종료). 뷰포트 영역이 오차 없이 깔끔하게 전환됩니다 (≤ 4px 오차 허용 범위).

   - **대형 마이크 버튼** — 112 × 112 px (`w-28 h-28`), 음성 인식 중에는 빨간색 펄스 애니메이션이 동작하고 대기 중에는 흰색 테두리로 표시됩니다. Playwright `boundingBox()`로 96px 이상 크기를 보장합니다.
   - **빠른 카드 띠** — 가로 스크롤 영역, 각 카드 크기 `88 × 80 px`, 스위치 제어 그룹화를 위한 `data-scan-group="quick-cards"` 속성 포함, 스크린 리더용 `role="list"` / `role="listitem"` 적용.
   - **제어 버튼 영역** — 핸즈프리 (활성화 시 녹색), "Hey Prism" 호출어 (활성화 시 파란색, `!wakeWordSupported` 환경 시 숨김), iOS 음성 제어 안내.
   - **종료** — ✕ 버튼 (`w-12 h-12`) 또는 `Escape` 키 입력 → `onClose()` 실행 → `AIChatPanel` 내 `bedsideModeActive = false` 처리 → WCAG 2.4.3 표준에 따라 초점이 모드를 켰던 🛏 버튼으로 정확히 돌아갑니다.

   ![침상 모드 레이어 종료 후 메인 AI 패널 복귀](../../e2e/_screenshots/bedside-overlay-closed.png)

4. **"Hey Prism" 호출어** — `services/wakeWordService.ts`. 백그라운드에서 `SpeechRecognition`을 지속 실행합니다. 음성 중 "hey prism" 문구가 들어오면 마이크를 켜고 다음 인식을 대기합니다. 단, iOS 네이티브 브릿지가 마이크를 제어 중일 때는 중복 실행되지 않도록 안전 장치가 적용되어 있습니다. 모드를 닫은 후 메인 패널 상단 상태 바에서 활성화 여부를 확인할 수 있습니다.

   ![Hey Prism 활성화 상태 바 표시](../../e2e/_screenshots/bedside-wakeword-statusbar.png)

5. **iOS 음성 제어 안내** — 제어 영역의 📱 버튼을 누르면 `prismNativeBridge.openSettings('accessibility')` 실행을 시도합니다 (지원되는 네이티브 빌드에서 접근성 설정으로 이동). 웹/데스크톱 환경에서는 레이어 내부에 `설정 → 접근성 → 음성 제어 → 켬` 경로를 안내하는 카드가 표시됩니다.

   <p align="center">
     <img src="../../e2e/_screenshots/bedside-voice-control-card.png" alt="iOS 음성 제어 안내 카드 — 웹/데스크톱 환경에서 📱 버튼 선택 시 침상 모드 레이어 내부에 단계별 안내 표시" width="260">
     <img src="../../e2e/_screenshots/bedside-voice-control-dismissed.png" alt="안내 카드를 닫은 후 일반 침상 모드 레이아웃으로 돌아온 모습" width="260">
   </p>

**테스트 커버리지:**
- `services/bedsideCards.test.ts` — 22개 단위 테스트: 기본 카드 세트, localStorage 저장 및 복원, 잘못된 JSON 예외 처리, 무효 카드 필터링, 50개 제한 테스트, `createCard` 제약 조건 검증.
- `e2e/bedside-mode.spec.ts` — 17개 Playwright E2E 테스트: 버튼 노출, `aria-pressed` 상태 전환, 녹색/파란색 상태 클래스 적용, 상태 바 문구 검증, 접근성 속성 검증, 마이크 `boundingBox` 크기 측정, 뷰포트 영역 검증, 안내 카드 노출 및 닫기 테스트.

**주요 관련 파일:**
- `components/AIChatPanel.tsx` — 침상 모드 상태 관리, 카드 상태(`bedsideCards`), `handleAddBedsideCard`, `handleDeleteBedsideCard`, 핸즈프리 루프, 호출어 수명 주기, 상단 버튼
- `components/BedsideOverlay.tsx` — 침상 모드 UI 레이어, 빠른 카드 띠, 카드 추가 팝업, 편집 모드, 포커스 트랩, 음성 제어 안내 카드
- `services/bedsideCards.ts` — `BedsideCard` 타입 정의, `DEFAULT_BEDSIDE_CARDS`, `loadCards`, `saveCards`, `createCard`
- `services/aiService.ts` → `inferCardIcon(text)` — AI 이모지 추론
- `services/wakeWordService.ts` — 지속적인 호출어 감지
</details>

---

### 📨 메시지 전송 — 공급자 선택기
연락처에 여러 전송 수단(예: 이메일과 SMS 모두)이 설정되어 있는 경우, 작성 영역 상단에 **"전송 방법"** 선택창이 표시됩니다. 패널을 벗어나지 않고 탭 한 번으로 전송 방식을 변경할 수 있습니다.

![연락처 전송 수단 선택기 — 이메일이 녹색으로 강조되고 SMS도 선택 가능한 '전송 방법' 행](../../docs/screenshots/contact-provider-picker.png)

---

### 💬 AAC 대화
연결된 채널(Telegram, WhatsApp, 이메일, Slack 등)을 통해 들어온 수신 메시지가 이 패널에 수집됩니다. 도구 모음의 안 읽은 메시지 배지에 건수가 표시되며, 새 메시지가 도착하면 알림음과 탭 간 알림이 켜집니다. 메시지 문장을 탭하면 입력란으로 전달되어 사용자 자신의 목소리로 답장을 작성할 수 있습니다.

![수신된 간병인 메시지와 안 읽음 배지가 표시된 AAC 대화 패널](../../docs/screenshots/panel-aac-chat.png)

<details>
<summary><strong>기능 및 기술 세부사항</strong></summary>

- Synalux 포털 `/api/v1/prism-aac/inbox/poll`을 통한 폴링 수신함 (포털 미설정 시 작동 안 함)
- 새 메시지 수신 시 탭 간 `BroadcastChannel` 알림 발송
- 채널 확장 구조: Outlook / Slack / Discord 등 새로운 채널 추가 시 약 30줄의 코드 구현으로 가능
- 간병인이 수신 여부를 알 수 있도록 읽음 상태 동기화 제공
- 무료 플랜: 1개 채널 연결 가능, 유료 플랜: 제한 없음
- 수신 메시지별 TTS를 지원하여 수신된 글을 선호하는 음성으로 들어볼 수 있음

**렌더링 경로:** `components/AACChatPanel.tsx` → `services/inboxPolling.ts` (sidePanel === 'aac-chat'일 때 5초, 그 외 60초 폴링) → `useScheduleStore.setIncomingMessages()`. 수신된 메시지는 일정 패널의 "간병인 메시지" 항목에도 함께 기록됩니다.
</details>

---

### 🧮 학업 과목 지원
수학, 과학, 프로그래밍, 미술, 인문학 등 중고등학교 과정 전반을 커버하는 **19개 과목별 전용 키보드**가 셀 그리드 캔버스 형태로 제공됩니다. 과목 탭 이동 시 AI 튜터가 과목에 최적화된 프롬프트 템플릿(총 33개)으로 자동 전환되어, 화학 공식이나 프로그래밍 코드에 일반 수학 식을 적용하는 오류를 방지합니다. **역사 과목은 사용자 거주 국가, 주, 도 단위까지 인식**하여 23개국 280개 이상의 세부 지역 정보를 지원합니다.

![셀 그리드에 `5 + 7 = 12`가 입력된 모습](../../docs/screenshots/math-canvas-typed.png)

<details>
<summary><strong>과목별 키보드 (총 19개)</strong></summary>

**수학 (9개 키보드)** — 기본 수학, 고급 수학(π √ 지수 + 5가지 기호 도구: 분수 틀, 나눗셈 틀, 루트 바, 합계 기호, 분수 바), a–z, 기타 수학(집합론 + 논리 기호), 시간 및 거리, 무게, 부피, 도형, 화폐.

**과학 (4개)** — 화학(24개 원소 기호 + 반응 화살표 + 전하 + 첨자 + 상태 기호), 물리학(전체 그리스 자모 + 16개 SI 단위 + ∫/∂/∇/∑/∏ + 주요 상수), 생물학(DNA/RNA + 유전 기호 + 8단계 분류군 + 12개 세포기관), 통계학(μ σ x̄ + 12개 연산자 + 확률 분포).

**프로그래밍 (2개)** — Python(24개 연산자 + 26개 예약어) 및 Java(24개 연산자 + 26개 예약어). 코드가 셀마다 한 글자씩 입력되어 고정 폭 그리드 상에 보기 쉽게 정렬됩니다.

**예술 및 인문학 (4개)** — 음악(3가지 음자리표 + 6가지 음표 + 5가지 쉼표 + 5가지 조표 + 8가지 센메조 기호), 지구과학(날씨 + 판 구조 + 10개 행성/천체 + AU/ly/pc/Mya/Gya 단위), 역사(언어 및 세부 지역 맞춤 지원), 국어/문학(12가지 품사 태그 + 6가지 문장 성분 + 문장 부호 + 인용 양식).

</details>

<details>
<summary><strong>AI 튜터 — 11개 분야 × 3가지 모드 = 33개 프롬프트</strong></summary>

![캔버스 상단에 힌트 메시지가 나타난 AI 튜터 레이어](../../docs/screenshots/math-tutor-hint.png)

과목별 3가지 지원 모드: 💡 **힌트** (답을 직접 주지 않고 다음 단계를 스스로 생각하도록 유도), ✓ **채점** (작성한 답을 검토하고 정답 시 칭찬 전달), 🎓 **풀이** (최대 4단계의 세부 풀이 과정 안내). 현재 탭 위치에 따라 AI가 해당 과목에 맞춰 대답합니다. 15초 타임아웃 및 재시도 기능이 포함되어 있어 응답 대기 상태에 갇히지 않습니다.
</details>

<details>
<summary><strong>역사 과목 — 언어 및 세부 지역 완벽 지원</strong></summary>

![영어 기본 로케일 역사 키보드 — 세계사 및 국사 레이어](../../docs/screenshots/math-keyboard-history-en.png)
![텍사스 주(US-TX) 지역 설정 시 — 알라모 전투, 텍사스 합병, JFK 관련 키 노출](../../docs/screenshots/math-keyboard-history-us-tx.png)

3단계 구조로 구성되어 있습니다:
1. **세계사** 전 세계 교육과정에 공통 포함되는 주요 사건 (476년 서로마 멸망, 1914년 제1차 세계대전, 1939년 제2차 세계대전, 1969년 달 착륙 등)
2. **국사** `언어` 설정에 따라 결정 (en, es, fr, de, ro, ru, uk, ja, ko, zh, ar, it, pl, nl, he, hi, vi, tr, pt) — 19개 언어 지원
3. **지역사** `historyRegion` 설정에 따라 추가 지정 (US-TX, CA-QC, UK-SCT, ES-CT, IN-MH, DE-BY 등) — **23개국 280개 이상의 세부 지역** 지원 (미국 50개 주 + 워싱턴 DC, 캐나다 13개 주/주, 영국 4개 구성국, 아일랜드, 독일 16개 주, 스페인 17개 자치주, 이탈리아 20개 주, 한국, 호주, 프랑스, 멕시코, 브라질, 인도, 중국, 러시아, 벨기에, 스위스, 네덜란드, 아르헨티나, 남아공, 파키스탄, 뉴질랜드, 폴란드 등).

지역 정보가 프롬프트에 전달되므로 `US-TX` 설정 시 1836년 키는 알라모 전투를 의미하게 되며, `CA-QC` 설정 시 1759년 키는 아브라함 평원 전투를 의미하게 됩니다.

</details>

<details>
<summary><strong>검증 워크플로 — 12개 과목 × 중3~고3 수준 문제 × 72개 Playwright 테스트</strong></summary>

모든 과목 키보드를 검증하는 단계별 문제 워크시트와 라이브 수학 패널을 직접 조작하며 입력값이 그리드에 올바르게 들어가는지 확인하는 실행 가능한 Playwright 테스트를 포함합니다. 실제 중학교 3학년 수학 교과서 내용을 기반으로 제작되었습니다.

- **1단계 — 단계별 기본 워크플로:** [`tests/workflows/`](tests/workflows/) — 12개 마크다운 문서 (고급 수학, 생물학, 화학, 지구과학, 기하학, 역사, 국어, 기타 수학, 물리학, Java 프로그래밍, Python 프로그래밍, 통계학).
- **2단계 —학년별 실제 문제 워크플로:** [`tests/workflows/grade-8-12/`](tests/workflows/grade-8-12/) — 실생활 문장제 문제가 포함된 12개 문서 (중3 대수학, 고1 기하학, 고2 물리학, 고1 화학, 중3 생물학, 고2 통계학, 중3 Python, 고2 Java, 고3 미적분학, 중3 지구과학, 중2 국어, 고1 세계사) + 과목별 지원 현황 보고서 [`REPORT.md`](tests/workflows/grade-8-12/REPORT.md).
- **3단계 — Playwright e2e 자동화 테스트:** [`e2e/math-workflows/`](e2e/math-workflows/) — 72개 자동화 테스트 (`npx playwright test --project=desktop e2e/math-workflows`).

전체 워크플로 목록 및 활용 안내서 → **[`docs/WORKFLOWS.md`](docs/WORKFLOWS.md)**.

</details>

<details>
<summary><strong>기타 수학 편의 기능 (잠금 도구, 2회 탭 확대, 저장 및 동기화)</strong></summary>

- **영역 잠금 도구** — 문제를 다 푼 후 해당 영역을 잠글 수 있습니다. 잠긴 셀은 옅게 표시되며 수정이 제한됩니다.
- **2회 탭 확대 기능** — 첫 번째 탭 시 키가 확대되어 할당되고(1.4배 확대 + 녹색 테두리 표시), 두 번째 탭 시 최종 입력됩니다. 2초 동안 입력이 없으면 자동으로 해제됩니다. 손 움직임이 세밀하지 않은 사용자에게 유용합니다.
- **저장 및 동기화** — 로컬 `localStorage` 저장 지원; `↻ 동기화` 버튼으로 Synalux 포털과 동기화할 수 있습니다. 최대 100개 문서 / 200KB 용량 내에서 유지되며 오래된 순으로 정리됩니다.
- **입력 유지 시간 설정** — 키별 입력 인식 시간(0–1500ms)을 설정할 수 있으며 녹색 진행 표시 링이 함께 출력됩니다.

![1개의 작성 내역과 동기화 버튼이 노출된 저장 문서 레이어](../../docs/screenshots/math-docs-overlay.png)
![2회 탭 확장 기능으로 녹색 테두리와 함께 확대된 숫자 키](../../docs/screenshots/math-two-hit-armed.png)
![영역 지정을 위해 모서리 선택을 안내하는 잠금 도구 활성화 상태](../../docs/screenshots/math-lock-armed.png)

</details>

<details>
<summary><strong>과목별 키보드 — 추가 스크린샷</strong></summary>

![H₂O가 입력된 화학 키보드](../../docs/screenshots/math-keyboard-chemistry.png)
![A T G가 입력된 생물학 키보드](../../docs/screenshots/math-keyboard-biology.png)
![`private String` 문구가 입력된 Java 키보드](../../docs/screenshots/math-keyboard-java.png)
![음악 키보드](../../docs/screenshots/math-keyboard-music.png)
![통계학 키보드](../../docs/screenshots/math-keyboard-statistics.png)
![지구과학 키보드](../../docs/screenshots/math-keyboard-earth-science.png)
![국어/문학 키보드](../../docs/screenshots/math-keyboard-language-arts.png)
![루마니아 역사 키보드](../../docs/screenshots/math-keyboard-history-ro.png)

</details>

---

### 🗓 일정
일상 생활 및 일과 전환을 돕는 시각적 단계별 일정표입니다. 각 과정은 그림 타일과 설명 라벨로 표시되며, 단계를 완료하면 완료 알림음과 시각적 완료 표시가 켜집니다. 일정을 마치면 보상 샵(유료 플랜)을 이용할 수 있습니다.

![단계별 일과 보드와 활동 목록이 배치된 일정 패널](../../docs/screenshots/panel-schedule.png)

<details>
<summary><strong>기능 및 기술 세부사항</strong></summary>

- 일상 활동을 한 번의 탭으로 추가할 수 있는 24개 기본 타일 제공: 일어나기, 양치하기, 아침 식사, 학교 가기, 간식 먹기, 점심 식사, 놀기, 책 읽기, 미술 활동, 산책하기, 저녁 식사, 목욕하기, 잠자리 동화, 잠자리에 들기, 약 먹기, 치실하기, 방 정리하기, 빨래하기, 반려동물 돌보기, 운동하기 등
- 드래그 앤 드롭 순서 변경; 연필 아이콘을 통한 즉시 이름 수정; 기본 프리셋에는 `textKey`가 지정되어 언어 변경 시 라벨이 자동 전환됩니다
- 단계별 처리 상태: 진행 중인 타일 펄스 애니메이션, 타이머 완료 시 3음계 알림음 출력, 무빙 최소화 지원(`prefers-reduced-motion` 적용 시 정적 링으로 대체), `aria-pressed` 접근성 속성 적용
- 오디오 워밍업 기술: iOS Safari에서 긴 오프닝 후 타이머 알림음이 묻히지 않도록 미세한 1Hz 무음 신호로 AudioContext 상태를 활성화 상태로 유지합니다
- 간병인이 전달한 메시지는 일정표 상단에 "메시지" 항목으로 표시되어 전달받은 내용을 쉽게 확인할 수 있습니다

**렌더링 경로:** `components/SchedulePanel.tsx` → `useScheduleStore` (24개 기본 활동 및 사용자 정의) → `services/feedback.ts:playTimerRing()` → `services/azureTTS.ts:warmupAzureAudio()`를 통한 AudioContext 연동.
</details>

---

### 🎮 게임
치료 기법에 기반한 12가지 AAC 전용 게임입니다. 단순한 재미가 아닌 **소통 능력 향상을 목적으로 개발**되었습니다. 각 게임은 발화 시도와 정확도를 기록하여 적응형 학습 엔진이 다음에 필요한 적절한 게임을 추천할 수 있도록 돕습니다.

![9개 게임 타일이 포함된 게임 패널](../../docs/screenshots/panel-games.png)

<details>
<summary><strong>12가지 게임 및 기술 세부사항</strong></summary>

| 게임 | 목표 소통 능력 |
|---|---|
| 버블 팝 | 원인과 결과 이해, 의도적인 소통 시도 |
| 색상 찾기 | 수용 어휘력 향상 (색상 명칭) |
| 나의 이야기 | 이야기 구성 및 순서 이해 |
| 짝 맞추기 | 사물 연결 및 범주화 사고 |
| 예/아니오 | 이분법적 수락 및 거절 표현 |
| 완성하기 | 문장 완성 능력 (빈칸 채우기) |
| 카테고리 분류 | 의미별 유의어 및 범주 분류 |
| 감정 맞추기 | 감정 상태 표현 및 타인 마음 이해 |
| 다음 순서 찾기 | 순차적 추론 능력 |
| 같은 점 / 다른 점 | 시각적 변별력 — 공통점과 차이점 찾기 |
| 소리 듣고 맞추기 | 청각적 변별력 + 사물 어휘력 |
| 차례 지키기 | 대화 및 활동에서의 차례 지키기 실습 |

- 12가지 게임 모두 무료로 사용할 수 있으며 플랜에 따른 제한이 없습니다
- 게임 데이터는 `services/adaptiveEngine.ts`로 전달되어 발화 길이 / 카테고리 / 이용 시간대 / 결과를 분석해 맞춤 게임을 추천합니다
- 대화 집중도를 위해 게임에 사용되지 않는 AAC 타일 카테고리는 자동으로 비활성화됩니다

**렌더링 경로:** `components/GamesPanel.tsx` → `components/games/` 내부의 개별 게임 컴포넌트. 각 게임의 발화 기록은 `useScheduleStore.recordMessage(text, category)`를 통해 저장됩니다.
</details>

---

### 🏪 마켓플레이스
음성 팩(Inworld 고품질 음성, 형제/부모의 복제 음성), 어휘 팩(스페인어 핵심 어휘, 수어 지원 어휘), 게임 팩(기본 제공 외 추가 게임)을 이용할 수 있습니다. 설치한 앱은 기본 패널과 동일하게 도구 모음에 바로 배치되어 사용할 수 있습니다.

![설치 가능한 앱이 노출된 마켓플레이스 패널](../../docs/screenshots/panel-marketplace.png)

<details>
<summary><strong>기능 및 기술 세부사항</strong></summary>

- 앱 정보는 JSON 포맷(`lib/marketplace/manifests/local.ts`)과 런타임 `lib/marketplace/registry.ts`로 관리되며 `getHandler(appId)`를 통해 해당 패널 컴포넌트를 불러옵니다
- 음성 복제 (유료 플랜): 90초 분량의 음성 녹음 → 복제된 음성을 카테고리 타일을 포함한 앱 내 모든 TTS 발화에 적용 가능
- 설치된 앱은 기본 메뉴 뒤에 도구 모음 버튼으로 추가되며, `useSettingsStore.installedApps`에서 설치 현황을 관리합니다
- 플랜별 이용 제한: 이용 중인 플랜보다 높은 레벨의 상품은 버튼이 비활성화되어 표시됩니다

**렌더링 경로:** `components/MarketplacePanel.tsx` → `useMarketplaceStore` → 구매 시 Synalux 포털 API 호출 후 에셋 파일(음성 파일, 어휘 JSON)을 IndexedDB에 다운로드하여 사용합니다.
</details>

---

### 📄 PDF 리더
PDF 문서를 불러오면 각 페이지가 하나의 타일로 전환되어, 탭 한 번으로 문서 내용을 설정된 음성으로 들어볼 수 있습니다. 학교 알림장, 유인물, 뉴스 기사 등 읽기 힘든 긴 글을 직접 읽는 대신 편하게 들을 수 있습니다. 별도의 PDF 프로그램이 필요 없으며 모든 과정이 브라우저 내에서 안전하게 처리됩니다.

![PDF 리더 패널 — "+ PDF 열기" 안내가 있는 초기 화면](../../docs/screenshots/panel-pdf-reader.png)

<details>
<summary><strong>기능 및 기술 세부사항</strong></summary>

- 각 페이지가 하나의 타일로 구성되며 상단 3줄의 내용과 함께 `▶ N 페이지 읽기` 버튼이 제공됩니다 (기존 설정 음성, 어조, 하이라이트 기능 동일 적용)
- `▶ 전체 읽기` 선택 시 모든 페이지를 처음부터 끝까지 연결하여 읽어줍니다
- 스캔된 이미지 형태의 PDF인 경우 OCR 도구를 사용하도록 안내 메시지를 띄웁니다
- `pdfjs-dist` 모듈을 지연 로딩 방식으로 불러와 초기 앱 용량에 영향을 주지 않도록 관리합니다
- 설정 → 도구 모음 메뉴에서 PDF 리더 버튼(📄)의 표시 여부를 자유롭게 설정할 수 있습니다

**렌더링 경로:** `components/PdfReaderPanel.tsx` → `services/pdfReader.ts` (pdfjs `getDocument` → 페이지별 `getTextContent` 추출) → `services/aacSpeak.ts`.
</details>

---

### 👁 스크린샷 리더 (OCR)
유인물 사진, 웹페이지 캡처, 교재 사진을 캡처하여 올리면 텍스트가 인식되어 이미지 옆에 추출됩니다. **▶ 읽기**를 눌러 소리로 듣거나 **↧ 메시지 바 전송**을 눌러 내용을 다듬은 후 소리로 들을 수 있습니다.

![스크린샷 리더 (OCR) 패널 — "+ 이미지 열기" 안내가 있는 초기 화면](../../docs/screenshots/panel-ocr-capture.png)

<details>
<summary><strong>기능 및 기술 세부사항</strong></summary>

- PrismAAC 지원 언어에 맞춘 20개 언어 OCR 매핑 지원 (영어, 스페인어, 프랑스어, 포르투갈어, 독일어, 루마니아어, 우크라이나어, 러시아어, 일본어, 한국어, 중국어 간체, 아랍어, 이탈리아어, 폴란드어, 네덜란드어, 히브리어, 힌디어, 베트남어, 튀르키예어, 인도네시아어)
- 언어별 데이터 파일은 최초 사용 시 캐시 처리됩니다 (영어 기준 약 10MB) — 초기 로딩 시 "이미지 읽는 중… (최초 실행 시 OCR 모델 다운로드로 10~30초 소요될 수 있습니다)" 문구가 안내됩니다
- 텍스트 인식 신뢰도(%)가 함께 표시되어 인식 결과를 한눈에 판단할 수 있습니다
- `disposeOcr()` 정리 로직을 포함하여 페이지 이동 시 사용된 WASM 메모리를 신속하게 해제합니다
- 설정 → 도구 모음 메뉴에서 스크린샷 리더 버튼(👁)의 표시 여부를 설정할 수 있습니다

**렌더링 경로:** `components/OcrCapturePanel.tsx` → `services/ocr.ts` (`tesseract.js` `createWorker` → `recognize`) → `services/aacSpeak.ts` 또는 `messageStore.setText`.
</details>

---

### 🎧 컴포트 플레이어

병실에 있는 환자, 의식 장애 환자, 중환자실(ICU) 입원 환자 등 지속적인 정서적 안정이 필요한 사람들을 위한 침상 전용 미디어 플레이어입니다.

<details>
<summary>세부 기능</summary>

가족과 지인이 음성 메시지를 녹음하고 사진과 동영상을 등록해 둘 수 있습니다. 등록된 미디어가 연속 재생되어 환자가 익숙한 목소리와 얼굴을 접하며 안정을 취할 수 있도록 돕습니다.

- 앱 내에서 음성 메시지를 직접 **녹음**할 수 있습니다 (MediaRecorder API)
- 오디오 파일, 사진, 동영상 클립 **업로드** 지원 (파일당 100MB, 총 500MB 한도)
- 등록된 미디어 전체 **자동 무한 반복 재생** 지원
- 사진 및 동영상을 침대 옆에 띄워둘 수 있는 **전체 화면** 모드 제공
- **네이티브 TTS** 연동 — 탭한 어구를 iOS AVSpeechSynthesizer로 발화
- **오프라인 동작** — 모든 미디어가 IndexedDB에 안전하게 저장되어 인터넷 없이 동작
- **키보드 및 접근성 지원** — 모든 버튼에 ARIA 라벨 및 키보드 이동 지원
- **보안 검증 완료** — 27가지 보안 점검 항목 반영 (메모리 누수 방지, 용량 제한 관리, 파일 확장자 제한 등)
- 설정 → 도구 모음 메뉴에서 컴포트 플레이어 버튼(🎧)의 표시 여부를 설정할 수 있습니다

**저장 용량 제한:** 최대 50개 항목, 파일당 100MB, 총 500MB까지 저장할 수 있습니다. 허용 확장자는 오디오(webm/mp4/mpeg/ogg/wav), 이미지(jpeg/png/gif/webp/heic), 동영상(mp4/webm/quicktime)으로 제한됩니다.

**렌더링 경로:** `components/ComfortPlayerPanel.tsx` → `store/comfortPlayerStore.ts` (Zustand + persist) → `services/comfortMediaStorage.ts` (IndexedDB 블롭 저장).
</details>

---

### 🧩 Chrome 확장 프로그램 — 모든 텍스트 입력란에서 동일한 읽기 보조 기능 제공
PrismAAC 웹 앱 내부에서 지원하는 읽기 보조 기능을 Chrome 확장 프로그램(`chrome-extension/`)을 통해 **인터넷상의 모든 입력창(Gmail, Google Docs, Word Online, 학교 포털 등)**에서 동일하게 활용할 수 있습니다.

![PrismAAC 읽기 보조 확장 프로그램 — 어느 웹사이트 입력창에서든 실시간 단어 강조와 함께 읽어주는 모습](../../docs/screenshots/extension-marquee.png)

입력창 선택 시 상단에 작은 플로팅 도구 모음이 표시됩니다. **▶ 읽기**를 눌러 다시 듣거나 문장을 계속 입력할 수 있으며, 문장 끝(`.?!`) 입력 시 작성된 문장이 자동으로 노란색 하이라이트와 함께 읽혀집니다:

![작성 중인 문장의 'school' 단어가 읽히면서 노란색으로 강조되는 플로팅 도구 모음](../../docs/screenshots/extension-overlay.png)

발화와 함께 번역 기능을 켜면 원문(작은 이탈릭체)과 번역문(강조 하이라이트 적용)이 함께 표시됩니다. Google 공개 번역을 활용하여 별도 API 키 없이 50개 이상의 언어를 무료로 지원합니다:

![영어를 루마니아어로 번역하며 읽어주는 모습 — 원문 아래 번역문이 표시되고 읽고 있는 'foarte' 단어가 강조된 상태](../../docs/screenshots/extension-translate.png)

옵션 페이지 — 설정 내용이 Chrome 프로필을 통해 기기 간 자동 동기화됩니다 (`chrome.storage.sync`). 사이트별 비활성화, 음성 선택, 읽기 속도/음높이/볼륨 조절 등 세부 설정이 가능합니다:

![PrismAAC 확장 프로그램 옵션 페이지 — 발화 조건, 번역 대상 언어, 음성 선택기, 속도/볼륨/음높이 조절 슬라이더](../../docs/screenshots/extension-options.png)

**설치 방법 (개발자 모드 방식):**

```sh
cd chrome-extension
npm install
npm run build
```

Chrome 주소창에 `chrome://extensions`를 입력하고, 우측 상단 **개발자 모드**를 켠 뒤, **압축풀린 확장 프로그램 로드**를 눌러 `chrome-extension/dist` 폴더를 선택합니다.

**주요 기능:**

- 문장 완성 시(`.?!`) 읽기, 띄어쓰기 입력 시 단어 읽기 기능 개별 설정 가능
- 브라우저 표준 `SpeechSynthesisUtterance.boundary` 이벤트를 이용한 **단어 단위 하이라이트** 적용 (실시간 정밀 하이라이트 제공)
- **읽어주며 동시에 번역** — 50개 이상의 지원 언어 중 선택 가능. 플로팅 창에 원문과 번역문이 함께 표시되며 번역 언어에 맞는 음성이 자동 선택됩니다
- 선택된 입력창 상단에 떠 있는 전용 도구 모음 제공 (▶ 읽기, 📌 위치 고정, × 닫기)
- `Cmd / Ctrl + Shift + S` 단축키로 원하는 순간에 즉시 읽기 실행 가능, `Esc` 키로 취소
- 보안 및 개인정보가 중요한 사이트를 위한 사이트별 예외 설정 제공
- Chrome 프로필에 설정이 안전하게 동기화됨 (`chrome.storage.sync`) — 별도의 PrismAAC 계정이 필요 없습니다

**개인정보 보호:** 번역 기능을 쓰지 않을 때는 오프라인으로만 동작합니다 (브라우저 내장 Web Speech 사용). 번역 사용 시 문장 단위로 `translate.googleapis.com`으로 통신합니다 (중복 문장은 캐시 처리됨). 전체 소스코드는 [`chrome-extension/`](chrome-extension/) 폴더에서 확인 가능합니다.

---

### 👋 핸즈프리 제스처
화면을 직접 터치하기 어려운 사용자를 위해 카메라인식 제스처 입력 기능을 옵션으로 제공합니다. 머리 위치 추적을 통한 응시 선택과 손 모양 제스처 프로필을 지원합니다. 모든 데이터가 로컬에서 처리되므로 외부로 영상이 유출되지 않습니다.

<details>
<summary><strong>기능 및 기술 세부사항</strong></summary>

- **기본 모드**: 머리 위치 추적 (FaceLandmarker, Mediapipe). 원하는 키를 일정 시간 바라보고 있으면(`headTrackingDwellMs`, 기본값 1200ms) 선택이 확정됩니다. 바라보는 동안 시각적 링이 채워집니다.
- **고급 모드**: 손 위치 및 모양 추적. 사용자별 제스처 프로필(손바닥 펴기 = 입력, 주먹 쥐기 = 지우기, 집기 = 띄어쓰기 등)을 `components/HandCalibration.tsx`에서 설정해 사용할 수 있습니다.
- 영점 이탈 안전장치: 연속된 프레임에서 머리 위치가 설정 범위(`headTrackingDriftThresholdPx`, `headTrackingDriftWindowMs`) 이상 벗어나면, 실수를 방지하기 위해 추적이 자동 일시정지되고 재보정 안내가 표시됩니다.
- **Esc 키를 통한 탈출 기능** — 언제든 키보드의 Esc 키를 누르면 진행 중인 입력 내용 손실 없이 추적 기능이 비활성화되고 일반 입력 모드로 돌아옵니다.
- 카메라 스트림 공유 기술(`services/cameraStream.ts`)을 적용하여 머리 추적과 손 추적 간 전환이 지연 없이 매끄럽게 이루어집니다.
- 설정한 보정 정보가 저장되어 다음 사용 시에도 유지됩니다.

**세부 문서:** [`docs/TRACKING_MATH.md`](docs/TRACKING_MATH.md) (보정 연산식, 원 유럽 필터 등 세부 필터 수학 공식), [`docs/GESTURE_RECOGNITION.md`](docs/GESTURE_RECOGNITION.md), [`docs/TRACKING_RELIABILITY.md`](docs/TRACKING_RELIABILITY.md).
</details>

---

### 👁 시각적 컨텍스트 — 카메라인식 상황별 어구 추천

카메라로 주변 물체를 비추면 예측 바에 관련 어구가 즉시 나타납니다. 식탁 위의 컵과 포크를 비추면 → "더 주세요", "물 주세요", "다 먹었어요". 침대를 비추면 → "피곤해요", "잘 자요". 책을 비추면 → "도와주세요", "모르겠어요". **기존 AAC 제품에서는 볼 수 없었던 유일한 기능입니다.**

| 장면 | 감지된 사물 | 추천 어구 |
|---|---|---|
| 🍽️ 식사 시간 | 컵, 포크, 스푼, 그릇, 병 | "더 주세요", "물 주세요", "다 먹었어요", "맛있어요", "너무 뜨거워요" |
| 😴 취침 시간 | 침대, 곰 인형 | "피곤해요", "잘 자요", "책 읽어주세요", "안아주세요" |
| 📚 공부 시간 | 책, 노트북, 키보드 | "도와주세요", "모르겠어요", "다 했어요", "시간 더 주세요" |
| 🎮 놀이 시간 | 곰 인형, 공 | "놀고 싶어요", "내 차례예요", "재밌어요!", "한 번 더!" |
| 🛁 욕실 / 세면 | 변기, 세면대 | "화장실 갈래요", "손 씻을래요", "도와주세요" |
| 📺 TV 시청 | TV, 리모컨, 소파 | "TV 볼래요", "끄고 싶어요", "소리가 너무 커요" |

추천 어구는 한국어를 포함해 12개 이상의 언어를 지원합니다 (영어, 스페인어, 프랑스어, 포르투갈어, 루마니아어, 우크라이나어, 러시아어, 독일어, 일본어, 중국어, 아랍어 등). 앱 설정 언어에 맞춰 어구가 자동 전환되어, 러시아어로 설정되어 있으면 "Water please" 대신 "Воды, пожалуйста"가 추천됩니다.

![시각적 컨텍스트 — 식사 시간 장면 감지 모습](../../docs/screenshots/vision-mealtime.png)

<details>
<summary><strong>작동 원리 (기술 세부사항)</strong></summary>

**파이프라인:** 카메라 (`cameraStream.ts` 공유) → MediaPipe ObjectDetector (EfficientDet-Lite0, 4MB int8, WASM) → 장면 추론 (결정론적 규칙, 11개 장면 유형) → 예측 바 적용 (`setAiCompletion` + `learnWord` n-gram 연동).

**성능:**
- **초당 2프레임 (2 FPS)**으로 동작 (500ms 마다 1회 감지) — 배터리 소모 최소화
- 모바일 CPU 점유율: **6% 미만**
- 모델 크기: **4 MB** (MediaPipe WASM 런타임 상에서 지연 없이 로드)
- 추가 RAM 사용량: **약 5 MB**
- 발열 보호 기능: 기기 발열 감지 시 1 FPS로 감축 → 지속 시 30초간 일시정지

**개인정보 보호:**
- 100% 기기 내부 처리 — 카메라 영상이 **외부로 유출되지 않음**
- 감지된 데이터는 **일회성으로 사용**되며 저장되지 않음
- 사람(`person`) 객체 인식 시 **어구를 추천하지 않음**
- 사물 감지 중 화면에 별도의 카메라 프리뷰가 노출되지 않음

**안전성:**
- 기본 설정은 **OFF** 상태로 제공되며 간병인이 직접 켜야 함
- 카메라인식 어구가 **자동으로 소리 내어 읽혀지지 않음** (사용자가 직접 탭해야 함)
- 긴급 어구 영역과 분리되어 있어 중요한 긴급 어구를 덮어씌우지 않음
- 사물이 **1.5초 이상 안정적으로 카메라에 포착**되어야 적용됨 (오작동 방지)

**객체 감지 모델:** [EfficientDet-Lite0](https://ai.google.dev/edge/mediapipe/solutions/vision/object_detector) — 80개 COCO 객체 분류 지원. 머리 추적에 쓰이는 동일한 MediaPipe WASM 런타임을 공유합니다.

**장면 추론 엔진:** 추가 ML 모델 없이 정해진 규칙 알고리즘으로 동작합니다. 시간대 가중치와 사물 조합을 계산하여 장면을 판단합니다 (예: 점심 시간에 `컵 + 포크 + 스푼` 감지 시 = `식사 시간` 판정).

**예측 바 연동:** `predictionStore` 내 2개 인터페이스 활용:
1. `setAiCompletion(phrase)` — 가장 연관도 높은 어구를 예측 바 첫 번째 타일에 배치
2. `learnWord(word, prev)` — 관련 어휘 그룹의 추천 순위를 시각적 연관성에 맞춰 한시적으로 상향 조절

카메라 화면에서 해당 사물이 사라지면 30초 후 추천 가중치가 원상복구됩니다. 사용자가 직접 키보드를 누르기 시작하면 시각 추천보다 사용자 입력을 최우선으로 처리합니다.

**핵심 관련 파일:**
- `services/objectDetectionService.ts` — 카메라 영상 수집, MediaPipe 실행, 발열 감지
- `services/sceneInference.ts` — 11개 장면 판정 규칙 및 시간대 가중치 연산
- `services/visionPredictionBridge.ts` — 장면 판정 결과 → 예측 바 연동
- `constants/visionPhrases.ts` — 장면별 12개 이상 언어 어구 세트
- `constants/objectVocabulary.ts` — 30개 COCO 사물 라벨 → 다국어 단어 매핑
- `store/visionStore.ts` — 휘발성 Zustand 스토어 (저장 안 됨)
- `hooks/useVisionContext.ts` — 사물 감지 ↔ 예측 바 ↔ 설정을 연결하는 React 훅

**테스트 커버리지:** 장면 판정 규칙, 다국어 어구 적절성, 스토어 동작 검증 등 62개 단위 테스트 완료.

**Safari E2E 검증 결과:**
```
장면=식사시간   신뢰도=0.90 추천어구=더 주세요|물 주세요|다 먹었어요     배지=🍽️
장면=취침시간   신뢰도=0.70 추천어구=피곤해요|잘 자요|책 읽어주세요     배지=😴
장면=공부시간   신뢰도=0.80 추천어구=도와주세요|모르겠어요|다 했어요   배지=📚
```
</details>

---

### ⚙️ 설정
25개 언어 / 28개 지역 지원, 테마 선택 (라이트 / 다크 / 고대비), 그리드 크기 조절 (4–20 타일), 운동 편의 기능 (수학 누름 시간 설정, 2회 탭 확대, 머리 추적 누름 시간, 제스처 민감도, 영점 이탈 자동 정지), 음성 선택기 (전체 무료 제공), 음성 캐시 설정 및 관리, AI 자동 보정 켜기/끄기, 알림 설정, 도구 모음 맞춤 구성, 역사 지역 선택, Cloud 요금제가 포함된 Synalux 계정 관리를 지원합니다.

![설정 — 언어 선택기 및 테마 전환 버튼](../../docs/screenshots/panel-settings.png)

<details>
<summary><strong>수학 및 접근성 설정</strong></summary>

![설정 — 수학 입력 유지 시간 및 2회 탭 확대 설정](../../docs/screenshots/panel-settings-math.png)

- **수학 입력 유지 시간 설정** — 0–1500ms 조절 슬라이더 제공; 0 = 즉시 입력, 200–1500ms 설정 시 세밀한 손 움직임이 어려운 사용자를 위해 누르고 있는 동안 녹색 진행 링이 표시되며 확정됩니다.
- **2회 탭 확대 기능** — 첫 번째 탭 시 선택된 수학 키가 확대 표시되고(1.4배 확대 + 녹색 테두리), 두 번째 탭 시 최종 입력됩니다. 2초 후 자동 해제됩니다. 입력 유지 시간과 함께 조합하여 사용할 수 있습니다.
- **머리 추적 머무르기 시간** — 200–5000ms 조절.
- **민감도 조절** — 1–10단계.
- **영점 이탈 자동 정지** — 기능 토글 + 이동 범위(px) + 판정 시간(ms) 설정.
- **손 제스처 보정 열기** — 사용자 맞춤 손 모양 제스처 설정창을 엽니다.

</details>

<details>
<summary><strong>입력 모드 — 음성, 제스처, AI 자동 보정</strong></summary>

![설정 — 입력 모드 패널](../../docs/screenshots/panel-settings-input-modes.png)

- **음성 입력** — Web Speech API 기반, 언어 설정 연동; 무료 제공
- **AI 자동 보정 및 완성** — 키 입력 정지 시 클라우드 보정 기능 실행 (Gemini 2.5 Flash-Lite 활용). 네트워크가 느린 환경을 고려해 기본 OFF 처리되어 있습니다.
- **알림 설정** — AAC 수신 메시지 도착 시 알림음 및 탭 간 알림 발송.
- **카메라 입력** — 머리 및 손 추적 기능의 전체 켜기/끄기 스위치.
- **추적 대상 선택** — 머리, 손, 또는 자동 감지 선택.

</details>

<details>
<summary><strong>도구 모음 맞춤 구성</strong></summary>

도구 모음 순서를 자유롭게 변경할 수 있습니다. 기본 설정에서는 처음 사용하는 사용자가 복잡함을 느끼지 않도록 핵심 기능(마이크, AAC 대화, 긴급 알림, 카테고리, 설정) 위주로 구성되어 제공됩니다. 그 외 모든 모듈(수학, AI 채팅, 일정, 게임, 마켓플레이스, 컴포트 플레이어, 메모, 기록, 소리 등)은 설정 → 도구 모음 메뉴에서 언제든 한 번의 탭으로 추가할 수 있습니다. 마켓플레이스에서 설치한 앱은 기본 메뉴 뒤에 자동으로 배치됩니다.

</details>

---

## 지금 사용해 보기

| | |
|---|---|
| 🌐 **웹 앱** | [synalux.ai/prism-aac](https://synalux.ai/prism-aac) — 브라우저에서 바로 사용해 보기 |
| 📱 **iOS** | [App Store](https://apps.apple.com/app/id6764692277) — iPhone, iPad, Apple Watch 지원 |
| 💻 **소스 코드** | 본 저장소에서 제공됩니다. AGPL-3.0 라이선스 — 자유롭게 포크하고 수정본을 공유하세요 |

---

## 요금제 안내

두 가지 요금제 제공: **무료(Free)** 및 **Prism AAC Cloud**. 체험 기간이 없으며, 무료 이용 시 카드가 필요 없고, 초과 요금이 자동으로 청구되지 않습니다.

| | 무료 (Free) | Prism AAC Cloud — 월 US$4.99 |
|---|---|---|
| 소통 보드, 키보드 및 저장된 어구 | ✅ | ✅ |
| 이용 가능한 기기 음성 및 캐시된 음성 | ✅ | ✅ |
| 기기 내 AI 및 긴급 소통 기능 | ✅ | ✅ |
| iOS + 웹 (PWA) | ✅ | ✅ |
| 새로 생성되는 자연스러운 음성 발화 | 미포함 (차단 전까지 공개 음성 경로를 통해 무료로 제공됨) | 월 50,000자 |
| 클라우드 AI 요청 (채팅, 자동 보정, 예측, 튜터) | — | 월 100회 |
| 제공량 리셋 주기 | — | 매월 1일 00:00 UTC 기준 |

- iOS 앱 내 결제(Apple 인앱 결제, StoreKit 2) 또는 웹(Stripe)을 통해 구독할 수 있으며, 하나의 계정에 하나의 활성 구독이 적용됩니다. 한쪽 채널을 취소하더라도 다른 채널의 계정 정보가 삭제되지 않습니다.
- 기기에 저장된 캐시 음성 및 기본 음성 출력은 제한 용량을 차감하지 않습니다. 제공량이 모두 소모되면 클라우드 음성 및 클라우드 AI 기능만 다음 리셋 시까지 잠시 정지되며, 일반 소통 기능은 절대 제한되지 않습니다.
- 설정 → Synalux 계정 → **클라우드 음성 및 AI** 메뉴에서 현재 요금제, 잔여 제공량, 갱신 일자를 확인할 수 있으며 Apple 구독, 구매 복원, 구독 관리 기능을 이용할 수 있습니다.
- 현재 확인된 시스템 참고 사항: (1) 단어 예측 강화, AAC 대화 채널, 간병인 연락처, SMS 전송 기능 등 일부 부가 기능은 Stripe(웹) 구독 기반 요금제 정책과 연동되어 있어 Apple 인앱 결제 전용 구독 시에는 적용되지 않을 수 있습니다; (2) AI 픽토그램 및 마켓플레이스 앱 설치는 Synalux 플랫폼 종합 요금제 기준이 적용됩니다. 음성 선택기 및 12가지 게임은 요금제와 관계없이 모든 사용자에게 무료로 제공됩니다.

<p align="center">
  <img src="../../docs/screenshots/cloud-subscription-iphone.png" alt="iOS 앱: 설정 → Synalux 계정 → 클라우드 음성 및 AI — 제공량, 갱신 조건, Apple으로 구독하기 · $4.99/월, 구매 복원" width="260" />
  <img src="../../docs/screenshots/panel-account-cloud.png" alt="웹 앱: 동일한 섹션 및 구독하기 버튼 · Stripe을 통한 월 US$4.99" width="260" />
</p>

[요금 안내 페이지 →](https://synalux.ai/pricing) · [이용약관](TERMS.md) · [개인정보 처리방침](PRIVACY.md)

---

## 임상 안전성 검증

- **어떠한 이유로든 사용자의 AAC 접근 권한이 제한되지 않습니다.** 아동은 언제나 자신의 목소리를 낼 수 있어야 합니다.
- **동의 없이 개인 건강 정보(PHI)를 클라우드로 전송하지 않습니다.** 간병인 메모는 업로드 전 암호화됩니다.
- **음성 데이터는 기기 내부에서만 처리됩니다.** 음성 입력은 브라우저의 Web Speech API를 활용해 로컬에서 변환됩니다.
- **응용행동분석 전문가(BCBA)가 설계했습니다.** 언어 행동 추적 체계는 BACB Task List 5th Edition 기준을 준수합니다.
- **트라우마를 고려한 디자인을 적용했습니다.** 억압적인 요소가 없으며 보상 샵 기능은 선택적으로 켤 수 있습니다.

세부 내용: [`ACCESSIBILITY.md`](ACCESSIBILITY.md), [`SECURITY.md`](SECURITY.md).

---

## 테스트 결과

**5,139개의 자동화 테스트**를 통해 웹, iOS, 시각적 감지 및 AI 라라우팅 등 모든 기능의 안정성을 검증합니다.

| 테스트 항목 | 테스트 수 | 결과 |
|---|---|---|
| 웹 앱 전체 (컴포넌트, 스토어, 서비스) | 4,971개 | ✅ 통과 |
| 시각적 감지 / 카메라 / 사물 인식 | 167개 | ✅ 통과 |
| 손 추적 + 신체 포즈 정밀도 | 54개 | ✅ 통과 |
| 기기 내 AI 라우팅 (실시간 Ollama) | 8개 | ✅ 통과 |
| iOS 네이티브 (XCUITest) | 19개 | ✅ 통과 |
| Prism MCP 서버 | 2,679개 | ✅ 통과 |

**기기 내 AI 정확도** — 사용자의 의도에 맞춰 앱이 해당 기능을 얼마나 정확하게 수행하는지 나타냅니다:

| 기기 | 모델 | 용량 | 정확도 | 평가 기준 |
|---|---|---|---|---|
| **Apple Watch** | SmolLM2-360M | 207 MB | **100%** (300/300) | AAC 임상 (기호 확장, 긴급 어구, 예측 입력) |
| **모든 iPhone** | Qwen3.5-4B Q3_K_M | 2.3 GB | **99.1%** (114/115 × 3회) | BFCL 도구 라우팅 평가 |
| **iPhone Pro / iPad** | Qwen3.5-4B Q4_K_M | 3.4 GB | **100%** (115/115 × 3회) | BFCL 도구 라우팅 평가 |
| **iPad Pro / Mac** | Prism-Coder 9B | 8.4 GB | **100%** (115/115 × 3회) | BFCL 도구 라우팅 평가 |

<details>
<summary><strong>"99.1% 라우팅 정확도"가 실제 소통에서 의미하는 바는 무엇인가요?</strong></summary>

기기 내 AI는 사용자가 버튼을 누를 때 어떤 동작을 수행할지 판단합니다 (메모 저장, 세션 불러오기, 기록 검색 등). 115개의 실제 대화 시나리오를 3번 섞어 테스트를 진행했습니다. 2.3 GB 모델은 115개 중 114개를 정확히 맞췄습니다. 유일하게 놓친 1건은 "정규식 작성해줘"라는 입력을 단순 응답 대신 지식 검색으로 판단한 케이스로, 실제 AAC 소통에서는 발생하지 않는 예외 상황입니다.

이전 2B 모델의 정확도가 90.4%(11개 오류)였던 것과 비교하면, 동일한 용량에서 라우팅 오류율을 10분의 1 수준으로 대폭 줄였습니다.

</details>

---

## 인프라 및 GDPR 준수

### 다중 지역(Multi-region) 아키텍처

| 구성 요소 | 위치 | 목적 |
|---|---|---|
| **Supabase US** | 미국 동부 (버기니아) | 기본 데이터베이스 — 인증, 사용자 데이터, 간병인 메모 |
| **Supabase EU** | 유럽 중앙 (프랑크푸르트) | GDPR 준수 — EU 사용자 데이터가 유럽 외부로 유출되지 않도록 보장 |
| **Vercel** | 글로벌 엣지 (Global Edge) | 웹 앱 호스팅, API 라우팅, CDN |
| **Inworld TTS** | 미국 | 신경망 음성 합성 (Text-to-Speech) |
| **HuggingFace Hub** | 미국/유럽 | 모델 가중치 파일 제공 (2B, 4B, 14B, 32B) |
| **기기 내 (On-device)** | 사용자 기기 | llama.cpp 추론 실행 (iPhone/iPad/Mac) |

### GDPR 개인정보 보호 준수

유럽(EU) 사용자의 데이터는 프랑크푸르트(eu-central-1) 지역에만 안전하게 저장됩니다. Vercel의 `x-vercel-ip-country` 헤더를 통해 사용자의 접속 위치를 감지하여 적절한 Supabase 데이터베이스로 연동합니다:

- **EU 사용자** → `supabase-eu` (프랑크푸르트) — 개인정보, 인증 데이터, 설정, 간병인 메모 저장
- **비 EU 사용자** → `supabase-us` (버시니아) — 동일 데이터 항목 저장, 미국 관할
- **AI 추론** → 기기 내부에서 실행 (데이터 유출 없음) 또는 Synalux API 사용 (식별 정보 저장 안 함)
- **TTS 음성 오디오** → 서버에서 생성 후 즉시 스트리밍되며 저장되지 않음

**데이터 거주성 보장:**
- EU 사용자의 개인 데이터는 미국 서버를 경유하지 않음
- 인증 토큰은 해당 지역의 Supabase 데이터베이스 내에서만 유효함
- 저장된 간병인 메모 암호화 적용 (Supabase AES-256)
- 컴포트 플레이어의 음성 녹음 파일은 브라우저 IndexedDB에만 저장되며 외부로 업로드되지 않음
- 기기 내 AI 모델은 로컬에서 실행되어 진단 데이터가 외부로 전송되지 않음

**잊혀질 권리 (삭제 요청):** 삭제 요청 시 해당 지역 데이터베이스의 인증, 프로필, 간병인 메모, 이용 데이터가 함께 일괄 삭제됩니다. 직접 호스팅하는 경우 `supabase db reset` 명령으로 데이터를 초기화할 수 있습니다.

### 운용 비용 안내

| 사용자 규모 | Supabase | Vercel | TTS 음성 비용 | AI 모델 비용 | 합계 |
|---|---|---|---|---|---|
| 0–1천 명 | $50/월 (2개 지역) | $0 (Hobby 플랜) | ~$5/월 | $0 (기기 내 처리) | ~$55/월 |
| 1천–1만 명 | $50/월 | $20/월 (Pro 플랜) | ~$50/월 | $0 | ~$120/월 |
| 1만–10만 명 | $50/월 + 서버 확장 | $20/월 | ~$200/월 | RunPod $125/월 | ~$395/월 |

---

## AI 모델 및 기기 지원 현황

Apple의 모든 기기에서 안정적으로 작동합니다. 핵심 AAC 소통 기능은 클라우드 연결 없이 오프라인으로 작동합니다.

PrismAAC는 기기의 성능을 자동으로 측정하여 가장 적합한 AI 모델을 선택합니다. 사양이 낮은 기기에서도 기능이 유연하게 유지되며, 오프라인 상태에서도 기본 소통이 중단되지 않습니다.

| 기기 | RAM | 적용 모델 | 정확도 | AAC 기능 | 모델 용량 | 운용 비용 |
|---|---|---|---|---|---|---|
| **iPad Pro M1/M2/M4** | 16 GB | 9B LoRA (v36) | **100%** | 100% 지원 | 8.4 GB | $0 |
| **iPhone 15/16 Pro, iPad Air** | 8 GB | 4B Q4_K_M (v36) → 2B (메모리 부족 시) | **100%** | 100% 지원 | 4.7 GB / 1.1 GB | $0 |
| **iPhone 12–14, 이전 iPad** | <8 GB | 2B Q3_K_M (v43) | **99.1%** | 100% 지원 | 2.3 GB | $0 |
| **WiFi 연결 Mac (M1 이상)** | 16+ GB | Ollama 기반 9B/27B (v36) | **100%** | 100% 지원 | 8.4 GB | $0 |

### 웹 앱 예비 실행 구조

웹 앱은 로컬 처리를 최우선으로 시도한 후 클라우드로 예비 전환됩니다 — 컴퓨터에 Ollama가 설치된 사용자는 추가 비용 없이 이용할 수 있고, 설치되지 않은 사용자도 모든 기능을 안정적으로 사용할 수 있습니다.

<details>
<summary>실행 흐름도 보기</summary>

```
  메시지 입력
        |
        v
  +-- 로컬 OLLAMA 실행 (localhost:11434 감지) ------------+
  |                                                      |
  |   14b (100%, ~1.1초) ─[실패]─> 8b (100%, ~0.8초) ─[실패]─> 2b (100%, ~1.6초)
  +------------------------------------------------------+
         |
    [로컬 실행 불가 시]
         |
         v
  +-- 클라우드 서버 예비 전환 (Synalux API) ---+
  |  Claude Sonnet 4 (유료) / Gemini (무료)   |
  |  99% 정확도, ~3초 반응                    |
  +-------------------------------------------+

  자동 로딩: 첫 실행 시 Ollama 감지 → 최적 모델 다운로드 → 오프라인 영구 사용.
```

</details>

### iOS 네이티브 예비 실행 구조

네이티브 앱은 실행 시 기기의 가용 RAM을 측정하여, HuggingFace CDN에서 기기에 맞는 최적의 모델을 최초 1회 다운로드한 후 llama.cpp Metal 기술로 로컬 처리합니다. 서버, 구독, 데이터 외부 유출이 발생하지 않습니다.

<details>
<summary>실행 흐름도 보기</summary>

```
  앱 실행
      |
      v
  가용 RAM 측정 (os_proc_available_memory)
      |
      +── 16 GB+ (iPad Pro) ──> 9B LoRA (8.4 GB) ──> 100% 정확도, ~1.1초
      |
      +── 8 GB (iPhone/iPad Air) ──> 4B Q4_K_M (4.7 GB) ──> 100% 정확도, ~0.8초
      |                                    |
      |                              메모리 부족 시? → 2B Q4_K_M (1.1 GB) → 100%, ~1.6초
      |
      +── <8 GB ──> 2B Q4_K_M (1.1 GB) ──> 100% 정확도, ~1.6초

  모든 경로: llama.cpp Metal 활용, 평생 무료, 데이터 외부 유출 없음.
  WiFi 연결 활용: 설정 → 로컬 AI → Mac IP 입력 시 9B/27B 고성능 모델 사용 가능.
```

</details>

### 키보드 레이아웃 모드 (설정 저장)

탭 한 번으로 3가지 모드를 전환할 수 있으며, 선택한 모드가 자동으로 저장되어 다음 실행 시에도 유지됩니다.

- **최대 키보드 (MAX KB)** — 키보드가 예측 바 하단 전체를 차지합니다
- **최소 키보드 (MIN KB)** — 카테고리 75% / 키보드 25% 비율로 배치됩니다
- **키보드 숨김 (HIDE KB)** — 카테고리가 전체 화면에 표시되고 키보드가 숨겨집니다

<details>
<summary>레이아웃 다이어그램 보기</summary>

```
  최대 키보드            최소 키보드            키보드 숨김
  +--------------------+ +--------------------+ +--------------------+
  | 도구 모음          | | 도구 모음          | | 도구 모음          |
  | 예측 바            | | 예측 바            | | 안내 문구          |
  |                    | |                    | |                    |
  |  키보드            | | 카테고리    (75%)  | | 카테고리           |
  |  화면 하단 전체    | |                    | | (전체 화면)        |
  |                    | |--------------------| |                    |
  |                    | | 키보드      (25%)  | |                    |
  | [123][v][ 스페이스 ]| |                    | |                    |
  +--------------------+ +--------------------+ +--------------------+
        |                      |                      |
        +-- [v] 버튼 --------->+-- 사이드바 버튼 ----->+-- 사이드바 버튼 --+
        |                                                               |
        +<--------------------------------------------------------------+
```

</details>

### 비용 및 성능 요약

| 실행 환경 | 적용 모델 | 정확도 | 반응 속도 | 비용 |
|---|---|---|---|---|
| iPad Pro 16GB | 9B LoRA (v36) | **100%** | ~1.1초 | **$0** |
| iPhone/iPad 8GB | 4B Q4_K_M (v36) → 2B (예비용) | **100%** | ~0.8초 | **$0** |
| 모든 기기 | 2B Q4_K_M (v42) | **100%** | ~1.6초 | **$0** |
| WiFi 연결 Mac | Ollama 기반 9B/27B (v36) | **100%** | ~1.1초 | **$0** |
| 클라우드 (무료) | Gemini 2.5 Flash | 99% | ~3초 | Synalux 부담 |
| 클라우드 (유료) | Claude Sonnet 4 | 99% | ~3초 | 요금제에 포함 |

**핵심 가치:** 30만 원대 iPhone SE를 쓰든 200만 원대 iPad Pro를 쓰든 상관없이 모든 사용자에게 Claude 수준의 높은 정확도를 제공합니다. 로컬 우선 구조를 적용하여 클라우드 의존성, 월 API 비용, 개인 정보 유출 위험을 없애고 1초 내외의 빠른 반응 속도를 보장합니다. prism-coder 모델 그룹은 BFCL 기능 호출 벤치마크 테스트에서 **99.1–100%**의 높은 정확도를 기록했습니다 (2026년 6월 3회 평균): 27B/9B/4B 모델 100%, 2B 모델 99.1%.

---

## 셀프 호스팅 (Self-host)

```bash
git clone https://github.com/dcostenco/prism-aac.git
cd prism-aac
npm install
npm run dev    # http://localhost:3000
```

Synalux는 호스팅 버전(무료 및 유료)을 공식 운영합니다. 직접 서버를 구축하거나 소스 코드를 수정하여 사용할 경우 AGPL-3.0 라이선스에 따라 변경 사항을 공개해야 합니다.

### 로컬 AI 모델 구축 (클라우드 비용 0원)

**방법 A — 앱 내에서 설정 (권장):** 설정 → 🤖 로컬 AI 모델 → 원하는 모델 옆의 다운로드 버튼 클릭. 진행 상태바 제공. Mac에서 Ollama를 실행하고 동일한 WiFi 네트워크에 연결된 iPad/iPhone에서 즉시 연결하여 사용할 수 있습니다.

**방법 B — 커맨드 라인 활용:**

[Ollama](https://ollama.com)를 설치한 후 다음 명령어를 실행합니다:

```bash
ollama pull dcostenco/prism-coder:2b   # 1.1 GB — 모든 기기, iPhone 12 이상 — 100% 라우팅 (v42)
ollama pull dcostenco/prism-coder:4b   # 4.7 GB — iPhone/iPad 8GB, Mac M1 이상 — 100% 라우팅 (v36)
ollama pull dcostenco/prism-coder:9b   # 8.4 GB — Mac 16GB 이상, iPad Pro — 100% 라우팅 (v36)
ollama pull dcostenco/prism-coder:27b  # 16 GB  — Mac M2 Ultra 이상 — 100% 라우팅 (v7)
```

`.env.local` 파일에 다음 내용을 추가합니다: `LOCAL_LLM_URL=http://localhost:11434`

**WiFi 환경의 iPad Pro / iPhone 연결:**
```bash
OLLAMA_HOST=0.0.0.0 ollama serve   # Mac에서 실행
# 이후 앱 설정 → 로컬 AI → Mac IP 입력: http://<mac-ip>:11434
```

자동 모델 선택: 2B → 모든 기기 · 4B → 모바일/검증용 · 9B → 표준 환경 · 27B → 고성능/기업 환경. Ollama에 연결할 수 없는 경우 클라우드로 자동 예비 전환됩니다.

---

<details>
<summary><strong>📚 기술 아키텍처 (모델 라우팅, 음성 처리, 제스처 인식, 빌드 정보)</strong></summary>

**기술 스택**: Next.js, Zustand, Web Speech API (음성 인식), Inworld TTS-2 + Azure Neural 예비 전환 (음성 합성), FaceLandmarker (제스처 분석).

**모델 라우팅** (Synalux 포털을 통한 서버 측 라우팅):
- **기기 내 처리** (버튼 탭 → 어구 출력): `prism-coder:2b` (Qwen3-2B Q4_K_M, llama.cpp Metal) — 네트워크 미사용, 비용 0원, ~1.6초
- **클라우드 단순 처리** (대화, 무료 플랜): `prism-coder:9b` (Qwen3-14B 파인튜닝) → Gemini 2.5 Flash 예비 전환
- **클라우드 복합 처리** (추론, 유료 플랜): `prism-coder:27b` (QwQ-32B 파인튜닝) → Claude Sonnet 4 예비 전환
- **자동 보정 + 단어 예측**: Gemini 2.5 Flash-Lite — 평균 752ms, 다국어 지원
- 빠른 반응이 필요한 경로(버튼 탭 → 음성 출력)는 라우팅 과정을 우회하여 지연 없이 즉시 발화됩니다
- 라우팅 정확도 평가 (2026년 5월 테스트 기준):

  | 적용 모델 | 정확도 | 평균 지연 시간 | 환각 도구 발생 |
  |---|---|---|---|
  | prism-coder:27b swe14 (로컬) | **100.0%** | 1.4초 | 0 |
  | 14B→32B 연쇄 전환 (로컬) | **100.0%** | ~1.1초 | 0 |
  | prism-coder:4b v36 (로컬) | **100.0%** | 0.8초 | 0 |
  | prism-coder:9b v36 (로컬) | **100.0%** | 1.1초 | 0 |
  | Sonnet 4 (클라우드) | **99%** | 3.2초 | 0 |
  | Opus 4.7 (클라우드) | **98.3%** | 3.0초 | 0 |
  | prism-coder:2b v42 (로컬) | **100.0%** | 1.6초 | 0 |

- 광범위 평가 — eval_300 (300개 케이스, 17개 도구, 9개 카테고리): prism-coder:27b = **300/300 (100%)**

**음성 합성 (TTS)** 예비 전환 단계:
- 1단계: Inworld TTS-2 (유료 전체 언어; 한국어/루마니아어/우크라이나어/러시아어/독일어/아랍어 무료 제공)
- 2단계: OS 내장 Web Speech API 고품질 음성 (오프라인)
- 3단계: WASM espeak-ng (최종 예비용)

**제스처 인식 기술**:
- 기본 모드: FaceLandmarker를 활용한 머리 위치 추적 및 응시 선택
- 고급 모드: MediaPipe 기반 손 포즈 추적 및 사용자 맞춤 제스처 프로필

**앱 아키텍처**: 모달 기반 단일 화면 구조, 테마 토큰 기반 디자인 적용.

**세부 기술 문서:**
- [`docs/TTS-ARCHITECTURE.md`](docs/TTS-ARCHITECTURE.md) — 음성 라우팅 전체 아키텍처
- [`docs/GESTURE_RECOGNITION.md`](docs/GESTURE_RECOGNITION.md) — 제스처 입력 내부 작동 방식
- [`docs/ADAPTIVE-ENGINE-BEHAVIOR.md`](docs/ADAPTIVE-ENGINE-BEHAVIOR.md) — 어조 자동 조절 시스템
- [`docs/EMERGENCY-NATIVE-ARCHITECTURE.md`](docs/EMERGENCY-NATIVE-ARCHITECTURE.md) — 긴급 상황 알림 전달 체계
- [`docs/SELF-LEARNING-SAFETY.md`](docs/SELF-LEARNING-SAFETY.md) — 사용자 학습 안전 가이드라인
- [`docs/TRACKING_RELIABILITY.md`](docs/TRACKING_RELIABILITY.md) — 머리/손 추적 신뢰도 검증 가이드
- [`PRECISION_TOUCH.md`](PRECISION_TOUCH.md) — 터치 영역 접근성 지침
- [`ACCESSIBILITY.md`](ACCESSIBILITY.md) · [`SECURITY.md`](SECURITY.md) · [`GOVERNANCE.md`](GOVERNANCE.md) · [`AGENTS.md`](AGENTS.md)
- [`RESEARCH.md`](RESEARCH.md) — 개발 논문 및 학술 근거
- [`CHANGELOG.md`](CHANGELOG.md) — 버전별 변경 내역

</details>

<details>
<summary><strong>🆕 PrismAAC만의 차별점 (자체 개발 알고리즘 스택)</strong></summary>

**기존 AAC 제품들과 차별화되는 3가지 핵심 기술:**

### 1. 기기 내 AI — HIPAA 기술적 보호 조치 지원

**로컬 AI가 AAC 소통에서 중요한 이유 — 속도, 보안, 신뢰성:**

| 항목 | 클라우드 AI 전용 방식 | PrismAAC (로컬 우선 방식) |
|--|---|---|
| 버튼 탭 → 음성 출력 | 2–30초 (네트워크 왕복 필요) | **~0.5초** (기기 내부 처리) |
| 오프라인 동작 여부 | ❌ 불가능 | ✅ 가능 |
| 데이터 외부 유출 | ✅ 항상 발생 | ❌ 없음 (음성 출력 경로) |
| HIPAA 준수 지원 | 공급업체별 BAA 계약 필요 | **기기 내부 처리로 개인 건강 정보 로컬 유지 — 기술적 보호 조치 충족에 기여** |
| 무선망 불안정 지역 | 소통 불가 | **완벽하게 작동** |
| 사용자당 월 비용 | $2–15 API 비용 발생 | **$0 (로컬 처리)** |

**2B 모델이 기기 내부에서 직접 실행됩니다** — iPad M1 이상, Mac, 노트북 지원. 버튼을 누르면 네트워크 연결 없이 ~500ms 만에 응답합니다. 소통 내역이나 데이터가 외부로 전송되지 않습니다.

간병인 메모는 클라우드 동기화 전 로컬에서 암호화됩니다. 기존 클라우드 기반 AAC 플랫폼(TouchChat, Proloquo2Go 클라우드 동기화 등)은 작동을 위해 계정에 데이터를 업로드해야 하지만, PrismAAC는 그럴 필요가 없습니다.

**기관 및 병원 임상 환경 구축 (9B + 27B):** 9B 및 27B 모델은 병원 내부 네트워크의 Mac 컴퓨터(Ollama 기반)에서 독립적으로 실행될 수 있습니다. iPad는 내부 WiFi를 통해 연결되므로 데이터가 병원 건물 밖으로 나가지 않습니다. 이 아키텍처는 개인 건강 정보(PHI)를 온프레미스에 유지하여 HIPAA 기술적 보호 조치 구성을 지원합니다; HIPAA 준수는 도입 기관의 책임이며 자율적인 행정적, 물리적, 기술적 통제 및 BAA 계약 체결이 필요합니다.

**연결 설정 방법:**

```
iPad / iPhone (Mac과 동일한 WiFi 연결)
    ↓  접속
Mac에서 Ollama 실행 (OLLAMA_HOST=0.0.0.0)
    ↓  모델 제공
prism-coder:2b · :14b · :32b
    ↓  모든 추론이 로컬에서 처리됨
내부 네트워크 — 인터넷으로 데이터가 나가지 않음
```

설정 → 🤖 로컬 AI 모델 → Mac IP 입력 → 모든 모델을 즉시 활용할 수 있습니다. 클라우드 비용이 발생하지 않으며, 개인 정보 유출 우려 없이 오프라인에서도 소통이 가능합니다.

### 2. 사용자에 맞게 자율 학습하는 어구 추천
고정된 단어 순서 목록은 과거의 방식입니다. PrismAAC는 카네기 멜론 대학 연구진이 개발한 ACT-R 인지 기억 모델 기반의 [**Prism v14.0.0 퍼짐 활성화(Spreading Activation)**](https://github.com/dcostenco/prism-coder/blob/main/docs/WOW_FEATURES.md) 기술을 적용해 어구 순위를 정합니다. 단순히 자주 쓰는 순서가 아니라, 최근성 × 빈도 × 사용자별 대화 패턴을 종합 계산합니다. 오늘 자주 쓴 어구는 상단으로 올라오고, 1년 동안 쓰지 않은 어구는 자연스럽게 뒤로 이동합니다.

### 3. 간병인의 수정 내역이 자동으로 학습 데이터가 됨
간병인이 AI의 잘못된 추천을 올바르게 수정하면(예: "아니야, *want*가 아니라 *eat* 단어야"), 시스템이 해당 수정 내역을 분석하여 기억합니다. 약 50회 이상 사용 후에는 AI가 유사한 실수를 범하기 전에 미리 실수를 방지합니다. 간병인이 일일이 라벨링 작업을 하거나 고비용의 재학습을 거칠 필요가 없습니다 — 매일의 수정 과정이 곧 학습 과정이 됩니다.

**평가 성능 안내:** [115개 Prism 평가 시나리오](https://github.com/dcostenco/prism-coder/tree/main/tests/benchmarks/prism-routing-100) 테스트 결과 (7개 도구, 12개 카테고리, 2026년 6월 3회 평균): 27b = 100.0%, 9b = 100.0%, 4b = 100.0%, 2b = 99.1% 정확도를 기록했습니다. 전체 모델 크기에서 도구 명칭을 잘못 만들어내는 환각 현상이 발생하지 않았습니다. 2B 모델은 오프라인 소통을 위해 기기 내에서 실행되며, 9B/27B 모델은 WiFi 연결을 통해 복잡한 임상 과제를 처리합니다. 광범위한 버클리 BFCL V4 벤치마크(2,000개 이상의 기능 호출 평가)에서 2B 모델은 동급 모델들과 유사한 ~59% 점수를 보였습니다. PrismAAC가 높은 평가를 받는 것은 단순 모델 점수 때문만이 아니라, 퍼짐 활성화 기반 인지 기억 알고리즘 스택이 완벽하게 결합되어 작동하기 때문입니다.

</details>

---

## 개발자 안내

```bash
npm install && npm run dev   # http://localhost:3000/prism-aac
npm run test                 # 4,900개 이상의 단위 테스트 실행
npm run e2e                  # 11개 기기 프로필 대상 Playwright 테스트
```

### 모니터링 시스템

| 대시보드 | 모니터링 항목 |
|-----------|---------------|
| [Prism AAC — 사용자 분석 대시보드](https://app.datadoghq.com/dashboard/shk-8fb-qjk/prism-aac--user-analytics) | 세션, 오류 발생률, 단어 예측 정확도, 어구 선택 횟수, 발화 이벤트, 언어별/국가별/기기별 통계, 요금제 현황, 머리 추적 데이터 |

Datadog RUM 연동: `lib/datadog.ts` 및 `components/DatadogInit.tsx` 파일 참조. `e2e/datadog-integration.spec.ts`에서 7개 성능 테스트 제공.

---

## 라이선스

[AGPL-3.0](LICENSE) — 오픈 소스, OSI 승인, 무료 활용 가능.

자유롭게 포크하여 직접 서버를 구축할 수 있습니다. 단, 라이선스 조건에 따라 소스 코드를 수정하여 배포하는 경우 변경된 소스 코드도 AGPL-3.0 라이선스로 공개해야 합니다 — 이는 AAC 소통 기술 발전의 혜택이 모든 가족들에게 투명하게 제공되도록 하기 위한 약속입니다.

© 2024–2026 Synalux LLC
