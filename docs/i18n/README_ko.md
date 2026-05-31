<!-- Auto-generated from README.md by scripts/generate_i18n.py — do not edit manually -->
# Prism AAC

**말을 하지 못하는 아이들이 소통할 수 있도록 돕습니다.**

운동 장애 및 복잡한 의사소통 요구가 있는 아동을 위한 보완대체 의사소통(AAC) 앱입니다. 그림을 탭하고, 문장을 만들고, 23개 언어로 소리 내어 말하는 것을 들을 수 있습니다. 모든 태블릿, 노트북, iPhone, iPad, Apple Watch에서 작동합니다.

[Synalux 플랫폼](https://synalux.ai)의 일부입니다.

🌐 [English](../../README.md) · [Español](README_es.md) · [Français](README_fr.md) · [Português](README_pt.md) · [Română](README_ro.md) · [Українська](README_uk.md) · [Русский](README_ru.md) · [Deutsch](README_de.md) · [日本語](README_ja.md) · **한국어** · [中文](README_zh.md) · [العربية](README_ar.md)

<p align="center">
  <a href="https://apps.apple.com/app/id6764692277"><img src="https://img.shields.io/badge/App_Store-Download-0D96F6?style=for-the-badge&logo=apple&logoColor=white" alt="앱 스토어"></a>
  <a href="https://synalux.ai/prism-aac"><img src="https://img.shields.io/badge/Try_It-Free-43e97b?style=for-the-badge" alt="무료 체험"></a>
  <a href="https://synalux.ai/pricing"><img src="https://img.shields.io/badge/Plans-Free_+_Paid-764ba2?style=for-the-badge" alt="요금제"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue?style=for-the-badge" alt="AGPL-3.0"></a>
  <a href="PRIVACY.md"><img src="https://img.shields.io/badge/Privacy-Policy-lightgrey?style=for-the-badge" alt="개인정보처리방침"></a>
  <a href="TERMS.md"><img src="https://img.shields.io/badge/Terms-of_Service-lightgrey?style=for-the-badge" alt="서비스 약관"></a>
</p>

![Prism AAC 메인 화면 — 도구 모음, 일정 배너, 입력 바, 예측 타일, 쿼티 키보드](../../docs/screenshots/app-hero.png)

### 네이티브 앱

<p align="center">
  <img src="../../docs/screenshots/ios-iphone.png" alt="iPhone에서 PrismAAC" width="220" />
  <img src="../../docs/screenshots/ios-ipad.png" alt="iPad에서 PrismAAC" width="360" />
  <img src="../../docs/screenshots/watch-ultra.png" alt="Apple Watch Ultra에서 PrismAAC" width="120" />
</p>

| 플랫폼 | 상태 | 온디바이스 AI | 참고 |
|----------|--------|-------------|-------|
| **웹** (PWA) | 운영 중 | 최적의 로컬 모델 자동 다운로드 | 모든 브라우저, 설치 가능 |
| **iPad Pro 16GB** | 운영 중 | 온디바이스 AI (14B) | 빠르고, 비공개이며, RAM에 따라 자동 선택 |
| **iPhone / iPad 8GB** | 운영 중 | 온디바이스 AI (8B → 1.7B 대체) | 기기에 맞게 자동 축소 |
| **iPhone / iPad <8GB** | 운영 중 | 온디바이스 AI (1.7B) | 항상 적합, 1.1 GB |
| **Apple Watch** | 운영 중 | 오프라인 문구 사전 (1,261개 × 20개 언어) | 독립 실행형 — 그림 문자, TTS, 긴급 상황 |
| **Chrome 확장 프로그램** | 운영 중 | — | 모든 텍스트 필드에서 읽기 도우미 |
| **Mac으로 WiFi 연결** | 운영 중 | Ollama를 통한 14B/32B | 설정 → 로컬 AI → Mac IP 입력 |

---

## 앱 스토어 미리보기 영상

Inworld TTS 내레이션과 함께 모든 주요 기능을 보여주는 30초 영상:

https://github.com/dcostenco/synalux-docs/releases/download/v1.0-module-videos/prism_aac_preview_v5.mp4

| 장면 | 기능 | 스크린샷 |
|---|---|---|
| **홈** — 문구 탭 | 22개 카테고리가 있는 그림 문자 보드, 말하기 버튼 | <img src="../../docs/screenshots/appstore/ipad_home.png" width="200"> |
| **카테고리** | 도움, 음식, 장소, 감정에 대한 빠른 문구 | <img src="../../docs/screenshots/appstore/ipad_categories.png" width="200"> |
| **AI 채팅** | 메시지 작성, 대화 연습 | <img src="../../docs/screenshots/appstore/ipad_ai-chat.png" width="200"> |
| **긴급 알림** | 한 번 탭으로 보호자/간호사 호출 | <img src="../../docs/screenshots/appstore/video/frame_03.png" width="200"> |
| **일정** | 시각적 일상 루틴 — 아침, 학교, 점심, 취침 시간 | <img src="../../docs/screenshots/appstore/ipad_schedule.png" width="200"> |
| **게임** | 버블 팝, 컬러 헌트, 매치 잇, 예/아니오, 피니시 잇 | <img src="../../docs/screenshots/appstore/ipad_games.png" width="200"> |
| **수학 및 학교** | 힌트, 확인, 풀이 + 숫자 패드가 있는 적응형 수학 | <img src="../../docs/screenshots/appstore/video/frame_06.png" width="200"> |
| **머리 및 시선 추적** | 카메라 기반 응시 커서, 시선 제어, 보정 | <img src="../../docs/screenshots/appstore/video/frame_07.png" width="200"> |
| **12개 언어** | 영어, 스페인어, 프랑스어, 러시아어, 일본어, 한국어, 중국어, 아랍어 등 | <img src="../../docs/screenshots/appstore/video/frame_08.png" width="200"> |

---

## 한눈에 보기

| 모듈 | 기능 | 미리보기 |
|---|---|---|
| 📂 **카테고리** | 비독자를 위한 PECS 스타일 그림 타일 | <img src="../../docs/screenshots/panel-categories.png" width="120"> |
| ⌨️ **입력 및 말하기** | 키보드 + 단어 예측 + 신경망 음성 | <img src="../../docs/screenshots/app-hero.png" width="120"> |
| ✨ **AI 채팅** | AAC 사용자를 위해 조정된 온디바이스 + 클라우드 어시스턴트 | <img src="../../docs/screenshots/panel-ai-chat.png" width="120"> |
| 💬 **AAC 채팅** | 보호자 + 연락처로부터의 수신 메시지 | <img src="../../docs/screenshots/panel-aac-chat.png" width="120"> |
| 🧮 **수학 + 과목** | 도메인 인식 튜터가 있는 셀 그리드 캔버스 | <img src="../../docs/screenshots/math-canvas-typed.png" width="120"> |
| 🗓 **일정** | 시각적 선행-후행 루틴 | <img src="../../docs/screenshots/panel-schedule.png" width="120"> |
| 🎮 **게임** | 12가지 치료용 AAC 게임 | <img src="../../docs/screenshots/panel-games.png" width="120"> |
| 🏪 **마켓플레이스** | 음성 팩, 어휘 팩, 게임 팩 | <img src="../../docs/screenshots/panel-marketplace.png" width="120"> |
| 🎧 **컴포트 플레이어** | 병원 환자를 위한 침대 옆 미디어 플레이어 | <img src="../../docs/screenshots/panel-comfort-player.png" width="120"> |
| 🛏 **침대 옆 모드** | 스탠드에 놓인 휴대폰 / 누운 자세 사용을 위한 전체 화면 AI 채팅 | <img src="../../e2e/_screenshots/bedside-overlay-open.png" width="120"> |
| 👋 **핸즈프리** | 머리 + 손 제스처 인식 | <img src="../../docs/screenshots/panel-settings-input-modes.png" width="120"> |
| ⚙️ **설정** | 23개 언어, 운동 보조 기능, 요금제 등급 | <img src="../../docs/screenshots/panel-settings.png" width="120"> |

---

## 무료 Read & Write 대체 기능

PrismAAC는 대부분의 AAC 사용자가 Read & Write를 구매하는 모든 읽기 도우미 기능을 무료로 제공하며, 웹 티어에서는 계정 없이 브라우저에서 사용할 수 있습니다. 문장 끝 말하기 + 단어 강조 기능은 [입력 및 말하기](#%EF%B8%8F-type--speak)를, 문서의 경우 [PDF 리더](#-pdf-reader) 및 [스크린샷 리더 (OCR)](#-screenshot-reader-ocr)를, Gmail / Docs / Word Online / 기타 모든 곳에서 앱 간 적용을 위해서는 [Chrome 확장 프로그램](#-chrome-extension--same-reading-assistant-features-in-any-text-field)을 참조하세요.

## PrismAAC 비교

| | PrismAAC | TouchChat | Proloquo2Go | LAMP Words | TD Snap | CoughDrop | Snap Core First | Grid 3 | Tobii Dynavox |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 온디바이스 + HIPAA 안전 음성 경로 | ✅ | ❌ | ❌ | ❌ | 부분적 | 부분적 | ❌ | ❌ | 부분적 |
| 사용자별 문구 순위 (각 아동에게 적응) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 보호자 수정 사항이 자동으로 훈련 데이터가 됨 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 도메인 인식 AI 튜터 (수학 + 10개 기타 과목) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 셀 그리드 수학 캔버스 (LaTeX, 화이트보드 없음) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 지역 + 지역 인식 기록 (280개 이상 지역) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 핸즈프리 머리 + 손 제스처 모드 | ✅ | 부분적 | 부분적 | ❌ | ✅ | 부분적 | 부분적 | ✅ | ✅ |
| 핸즈프리 AI 채팅 (음성 루프 + 호출어 + 침대 옆 오버레이) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 내장된 치료용 AAC 게임 | ✅ (12) | ❌ | ❌ | ❌ | ❌ | 부분적 | 부분적 | ❌ | ❌ |
| 오픈 소스 (AGPL-3.0) | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| 생명 안전 접근을 위한 무료 티어 | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| 음성 팩 마켓플레이스 | ✅ | ❌ | 부분적 | ❌ | 부분적 | ❌ | ❌ | 부분적 | 부분적 |
| 다국어 (23개) | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 집 / 학교 / 클리닉으로 이동하는 보호자 메모 | ✅ | ❌ | ❌ | ❌ | 부분적 | 부분적 | 부분적 | ❌ | 부분적 |
| Apple Watch 독립 실행형 모드 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Chrome 확장 프로그램 읽기 도우미 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

> 이 비교는 2026년 5월 현재 공개된 제품 정보를 반영합니다. PrismAAC는 활발히 개발 중이며, 경쟁사들은 시간이 지남에 따라 기능을 추가할 수 있습니다. 이 정보를 정확하게 유지하기 위한 PR은 언제든지 환영합니다 — `CONTRIBUTING.md`를 참조하세요.
>
> Grid 3 및 Tobii Dynavox는 위에서 반영되지 않은 강력한 시선 추적 + 스위치 스캐닝 하드웨어 통합 기능을 가지고 있습니다 (하드웨어 의존적, 전문 클리닉 설정).

---

## iOS 및 Apple Watch

### iPhone / iPad

WKWebView에 웹 UI를 래핑하고 llama.cpp Metal을 통해 온디바이스 AI를 사용하는 네이티브 Swift 앱입니다. 기기 RAM에 따라 최적의 모델을 자동 선택합니다:

| 기기 | RAM | 모델 | 다운로드 |
|---|---|---|---|
| iPad Pro M1/M2/M4 | 16 GB | 14B Q4_K_M | HF CDN에서 8.4 GB |
| iPhone 15/16 Pro, iPad Air | 8 GB | 8B Q4_K_M → 1.7B (OOM 대체) | 4.7 GB / 1.1 GB |
| iPhone 12-14, 구형 iPad | <8 GB | 1.7B Q4_K_M | 1.1 GB |

3단계 안전 장치: 동기식 위기 필터 → 온디바이스 AI → 클라우드 대체. 메모리 인식 게이팅은 점진적으로 성능을 저하시킵니다: 전체 AI → 클라우드 AI → 코어 전용 → 긴급 모드.

- Dynamic Island / 노치용 안전 영역 인셋
- Apple Watch 긴급 발송용 WCSession 브리지
- 키체인 기반 인증 토큰
- OOM 대체: 더 큰 모델이 맞지 않으면 자동으로 다음으로 작은 모델을 로드합니다.

**설정 → 🤖 로컬 AI 모델** — Prism 모델 다운로드 및 관리:
- `localhost:11434`에서 Ollama 자동 감지
- WiFi 연결: iPad/iPhone → Mac Ollama (14B/32B 전체 정확도)
- 실시간 진행률 표시줄이 있는 모델별 다운로드
- 모델: `:1b7` (1.1 GB) · `:8b` (4.7 GB) · `:14b` (8.4 GB) · `:32b` (16 GB)

### Apple Watch (독립 실행형)

iPhone 없이 작동 — 오프라인 문구 사전이 있는 독립 실행형.

<p align="center">
  <img src="../../docs/screenshots/watch-series.png" alt="Watch Series 11" width="140" />
  <img src="../../docs/screenshots/watch-ultra.png" alt="Watch Ultra 3" width="140" />
</p>

- **오프라인 번역:** 1,261개 문구 × 20개 언어 번들 (411 KB JSON) — 즉시 조회, 100% 정확, 네트워크 불필요
- ARASAAC 이미지가 있는 2열 그림 문자 그리드
- 받아쓰기 + 키보드 입력이 가능한 AI 채팅 (온라인 시 클라우드, 오프라인 시 문구 사전)
- 긴급 시스템: 카운트다운 → WCSession → 셀룰러 대체 → TTS
- TTS 출력과 함께 번역 (오프라인 사전 우선, 클라우드 대체)
- 받은 편지함: 보호자로부터 메시지 수신 및 회신
- 긴급 발송 시 인증서 고정 (SPKI SHA-256)
- 모든 AI 경로에서 NFKC + 23토큰 주입 살균

---

## 모듈

### 📂 카테고리
PECS 스타일 그림 타일. 카테고리를 탭하고, 타일을 탭하고, 단어를 듣고, 메시지 바에 나타나는 것을 확인하세요. 비독자, 예비 독자, 초기 의사소통자 모두에게 적합합니다. 타일 세트와 순서는 확산 활성화를 통해 시간이 지남에 따라 개인화됩니다 — 자녀가 가장 많이 탭하는 타일은 위로 올라오고, 몇 달 동안 사용되지 않은 타일은 사라집니다.

**서라운드 레이아웃** — 카테고리는 키보드 옆의 스크롤 가능한 왼쪽 열에 나타나므로, AAC 사용자는 모드를 전환하지 않고도 그림 타일을 탭하고 동시에 입력할 수 있습니다. 예측 바는 계속 표시되며, 두 입력 모두 항상 접근 가능합니다.

![서라운드 모드의 카테고리 — 왼쪽에 스크롤 가능한 카테고리 카드, 오른쪽에 전체 키보드](../../docs/screenshots/categories-surround-v2.png)

<details>
<summary><strong>기능 + 기술 세부 정보</strong></summary>

- 22가지 기본 카테고리: 사람, 음식, 감정, 신체, 옷, 동물, 장소 등
- 보호자는 아동별로 타일을 추가 / 제거 / 재정렬할 수 있습니다.
- 각 타일은 i18n을 위한 `textKey`를 가지고 있습니다 — 앱 언어를 전환하면 한 번의 탭으로 모든 타일의 레이블이 다시 지정됩니다.
- 타일 그림 문자는 ARASAAC + 선별된 세트에서 가져옵니다; 음성 복제는 타일의 음성을 아동의 형제자매 또는 부모의 음성과 일치시킬 수 있도록 합니다 (유료 티어).
- 사용자별 n-그램 학습: "I want eat"을 세 번 탭한 아동은 다음 세션에서 "want" 다음에 "eat"이 올라오는 것을 봅니다.
- HRR 홀로그래픽 메모리: Rust WASM을 통해 ~0.2ms 내에 제로 검색 문맥 예측 — 핵심 AAC 문구에서 Top-1 정확도 +27% 향상

**렌더링 경로:** `components/CategoryPanel.tsx` → `useCategoryStore` → `constants/phrases.ts` (시스템) + Supabase 사용자별 재정의 (유료)에서 가져온 타일. 타일 탭은 `messageStore.appendText(phrase)`를 호출하고 TTS를 위해 `aacSpeak()`를 통해 라우팅됩니다.
</details>

---

### ⌨️ 입력 및 말하기
**단어 예측**, **AI 자동 완성** 및 메시지 바를 자연스러운 신경망 음성으로 소리 내어 읽어주는 원탭 **말하기** 버튼이 있는 화면 키보드입니다. 타이핑은 예측 엔진을 학습시킵니다: 자녀가 가장 많이 입력하는 단어는 다음 세션에서 더 일찍 나타납니다.

![Prism AAC 키보드에 "hello"가 입력된 모습, 예측 타일, 말하기 버튼](../../docs/screenshots/keyboard-typing.png)

**읽기 도우미 기능 (Read & Write 동등)** — 읽기 / 기억 / 인지적 요구가 있는 사용자를 위해:

- **단어별 말하기** — 스페이스를 탭하는 순간 모든 단어가 TTS를 통해 울려 퍼지므로, 전체 문장을 기다리지 않고 입력한 내용을 들을 수 있습니다.
- **`.?!`에서 문장 말하기** — 마침표, 물음표 또는 느낌표로 문장을 마치면 전체 문장을 다시 읽어주어 작성한 내용을 놓치지 않도록 합니다 (인지 장애가 있는 시각 사용자에게 NVDA를 부적합하게 만드는 간극). 설정 → `speakOnSentenceEnd`를 통해 전환할 수 있습니다 (기본값 켜짐).
- **말하는 동안 단어별 강조** — TTS가 읽는 동안 모든 발화된 단어가 노란색 배경으로 강조됩니다. 읽기 장애가 있는 시각 사용자는 시각적으로 따라갈 수 있으며, 강조 표시는 특별한 하드웨어 장치 없이 오디오를 추적합니다.

<details>
<summary><strong>기능 + 기술 세부 정보</strong></summary>

- 쿼티 위에 5개의 예측 슬롯, 각 키 입력 시 새로 고침
- Synalux `text/correct`를 통한 AI 완성 ("hw" → "how", "togoso" → "to go so") (Gemini 2.5 Flash-Lite, 평균 ~752ms, 2.5 Flash보다 4.3배 저렴)
- 교차 언어 게이트: 두 코퍼스가 모두 로드된 경우에도 RO `eu`가 EN 바에 유출되지 않습니다 (교차 코퍼스 빈도 비교).
- "말하기"는 자동 톤 적응 (구두점에서 평서문 / 의문문 / 감탄문 추론)으로 읽습니다.
- 음성 티어 1: Inworld TTS-2 (자연/신경망, 23개 앱 언어 모두); 티어 2: OS 웹 음성 (오프라인, 기기 기본); 티어 3: WASM espeak-ng (최후의 수단)
- 단어 강조는 지속 시간 추정 (~60 ms/문자 @ 속도=0.5, 속도 슬라이더에 따라 조절) — 백엔드 변경 없이 모든 TTS 티어에서 작동합니다; Azure `wordBoundary`를 통한 정밀 동기화는 향후 Pro 기능입니다.
- 언어당 1.5MB SQLite n-그램 코퍼스; 유니그램 + 바이그램 + 트라이그램; 언어 전환 시 지연 로드
- **HRR 문맥 메모리** — 모든 발화된 문구에서 학습하는 제로 검색 홀로그래픽 검색 (229KB Rust WASM). 바이그램 + 트라이그램을 홀로그래픽 벡터로 인코딩합니다; 각 키 입력 시 ~0.2ms 내에 탐색합니다. 추가 레이어 — 코퍼스 예측을 제거하지 않고 문맥 일치로 처음 2개의 예측 타일을 강화합니다.

**HRR 예측 벤치마크** (54개 단위 테스트 + 10개 시나리오 정밀도 스위트):

| 시나리오 | 기준 Top-1 | HRR+ Top-1 | 향상 | 기준 MRR | HRR+ MRR | MRR 향상 |
|----------|---------------|------------|------|-------------|---------|----------|
| 핵심 AAC 문구 (1회) | 36.7% | 46.7% | **+27.3%** | 0.634 | 0.672 | +6.0% |
| 핵심 AAC 문구 (매일 5회) | 36.7% | 46.7% | **+27.3%** | 0.634 | 0.672 | +6.0% |
| 개인 어휘 | 70.4% | 81.5% | **+15.8%** | 0.809 | 0.883 | +9.2% |
| 혼합 (모든 문구) | 47.2% | 56.9% | **+20.6%** | 0.669 | 0.707 | +5.7% |
| 세션 간 회상 | 80.0% | 80.0% | +0.0% | 0.900 | 0.900 | +0.0% |
| 모호한 접두사 | 66.7% | 66.7% | +0.0% | 0.738 | 0.738 | +0.0% |

Top-1 = 올바른 단어가 타일 #1. Top-5 = 올바른 단어가 모든 타일에 있음. MRR = 평균 역순위 (높을수록 올바른 단어가 더 일찍 나타남). HRR은 어떤 시나리오에서도 Top-5 정확도를 감소시키지 않습니다 — 회귀 없음. 개인 어휘 (+9.2% MRR) 및 핵심 AAC 문구 (+27.3% Top-1)에서 가장 큰 이점.

**렌더링 경로:** `components/Keyboard.tsx` → `messageStore.appendChar` → `predictionStore.updatePredictions(text, lang)` → `engine/predictionEngine.ts` (최신성 × 빈도 × n-그램 부스트) + 선택적 `services/textCorrectService.ts` AI 오버레이 + `services/hrrContext.ts` HRR 바이그램/트라이그램 탐색. 강조: `services/aacSpeak.ts`는 `ttsHighlightBus`에 `tts-highlight-start` 이벤트를 발생시킵니다; `components/MessageBar.tsx`는 구독하고 `activeWordIndex`를 `ColoredText`에 전달합니다.
</details>

---

### ✨ AI 채팅
AAC 사용자의 음성에 맞춰 조정된 온디바이스 + 클라우드 어시스턴트입니다. 스트리밍되는 응답, 모든 줄은 메시지 바에 탭하여 삽입할 수 있으므로 저작권은 아동에게 유지됩니다. 무료 티어는 Gemini 2.5 Flash를 통해 실행되며, 유료 티어는 짧은 쿼리를 위해 prism-coder 플릿과 함께 Claude Sonnet 4로 라우팅됩니다.

**클린 AI 모드** — AI 채팅이 열려 있을 때 단어 예측 바가 자동으로 숨겨져 (질문을 작성할 때 예측은 관련이 없으므로) AI 응답과 제출 버튼에 집중할 수 있습니다.

**핸즈프리 AI 채팅** — 채팅 헤더의 🔁 버튼을 활성화하여 연속 음성 루프에 진입합니다: 각 AI 응답 후 마이크가 자동으로 열리므로, 아동은 화면을 만지지 않고도 완전한 대화를 이어갈 수 있습니다. 채팅 헤더 아래의 상태 바는 모드가 켜져 있음을 확인합니다.

**번역 모드** — 앱 언어와 출력 언어가 다른 경우 (예: 포르투갈어 입력, 영어 출력), 모든 AI 교환은 스트리밍이 활성화된 번역 경로를 통해 자동으로 라우팅되므로, 단일 언어 모드에 비해 속도 저하가 없습니다.

![AI 채팅 패널 — AI 모드에서 숨겨진 예측 바, 아래에 접근 가능한 전체 키보드](../../docs/screenshots/panel-ai-chat-v2.png)

<details>
<summary><strong>기능 + 기술 세부 정보</strong></summary>

- 키보드 위에 도킹된 인라인 패널 — 메시지 바를 숨기는 모달이 아님
- 웹 음성 API를 통한 음성 입력; 마이크 버튼은 실시간 중간 전사본을 표시
- AI 줄을 탭하여 메시지 바에 복사 (저작권 보존 — Valencia et al., CHI 2023)
- **핸즈프리 루프** — 🔁 헤더 버튼; 각 AI 응답 완료 후 1초 뒤 마이크 자동 재시작; `aria-pressed` + 녹색 배경으로 상태 확인; 활성화 시 헤더 아래 상태 바
- **"Hey Prism" 호출어** — 침대 옆 오버레이 내에서 사용 가능; 연속 `SpeechRecognition` 세션이 문구를 감지하고 마이크를 트리거; iOS 네이티브 브리지가 오디오 세션을 소유할 때는 사용 불가
- 클라이언트 측 15초 하드 타임아웃 + 재시도 버튼 (네트워크가 끊어져도 패널이 "생각 중…"에 멈추지 않도록)
- 401 / 네트워크 / 타임아웃 / 기타 → 친숙한 오류 매핑; "세션 만료" 원시 메시지 표시 안 함
- 오프라인 시 로컬 Ollama 대체 (`prism-coder:1b7`); 실제로는 `synalux.ai` 브라우저 원본에서 혼합 콘텐츠가 차단되므로 친숙한 오류가 발생

**렌더링 경로:** `components/AIChatPanel.tsx` → `services/aiService.askAI()` (또는 번역 모드에서 `translateAI()`) → `credentials: 'include'`와 함께 Synalux `/api/v1/chat`에서 SSE 스트림. CORS는 `synalux.ai` + localhost 개발 원본을 허용합니다.
</details>

---

### 🛏 침대 옆 모드

> **핵심 접근성 기능.** 침대 옆 모드는 일부 사용자가 말하거나, 입력하거나, 화면을 터치할 신뢰할 수 있는 방법이 없기 때문에 존재합니다. 이 디자인은 가장 어려운 경우를 먼저 고려해야 합니다: 중환자실 침대에 누워 팔을 옆에 두고 인공호흡기를 착용하여 어떤 소리도 낼 수 없는 환자 — 오직 시선 추적이나 두 손가락 사이에 쥔 단일 하드웨어 스위치를 통해서만 소통하는 경우.

화면에 닿거나 안정적으로 말할 수 없는 사용자를 위해 최적화된 전체 화면 AI 통신 오버레이입니다. 모든 탭 대상은 크게 만들어졌습니다. 음성은 여러 입력 경로 중 하나일 뿐, 유일한 경로가 아닙니다. 이 인터페이스는 스위치 스캐닝, 시선 추적, iOS 음성 제어, 머리 추적 또는 단일 스위치로 탐색되는 화면 키보드와 같은 보조 기술을 통해 완전히 작동할 수 있습니다.

병원 침대, 수술 후 회복, 완화 의료 환경에서 소통하는 사용자들의 AAC 커뮤니티 (r/AssistiveTechnology, 2025년 5월)의 직접적인 피드백에서 영감을 받았습니다.

**Mac / Windows에서 작동하나요?** 네. 침대 옆 모드는 프로그레시브 웹 앱(PWA) 기능으로, 모든 기기의 모든 브라우저에서 실행됩니다. iOS 전용이 아닙니다.

---

#### 누구를 위한 기능인가요?

침대 옆 모드는 광범위한 운동 및 언어 능력 스펙트럼을 가진 사용자를 위해 설계되었습니다. 아래에 설명된 빠른 문구 카드는 전혀 말할 수 없거나 손 움직임이 매우 제한적이거나 없는 가장 심각한 사용자들을 위해 특별히 설계되었습니다.

| 사용자 프로필 | 권장 입력 방식 |
|---|---|
| 말할 수 있지만 팔 움직임이 제한적 | 음성 (🎙 마이크 버튼) + 핸즈프리 루프 |
| 일부 발성 가능, 불안정한 언어 | "Hey Prism" 호출어 + 핸즈프리 루프 |
| 말할 수 없지만 화면 탭 가능 | 빠른 문구 카드 (단일 탭) |
| 말할 수 없지만 운동 능력 제한적 — 단일 스위치 | 빠른 문구 카드 위에서 iOS 스위치 제어 또는 Android 스위치 접근 스캐닝 |
| 말할 수 없지만 손 움직임 없음 — 시선 추적 장치 | 시선 추적 하드웨어 (Tobii, EyeGaze Edge 등)는 마우스 포인터로 작동 — 모든 카드 탐색 가능 |
| 말할 수 없지만 머리 움직임 가능 | 머리 추적 (예: iOS 머리 포인터, iPhone 16의 카메라 제어) — 카드는 전체 크기 탐색 대상 |
| 기관절개술 / 인공호흡기 착용, 발성 불가 | 시선 추적 또는 스위치를 통한 빠른 문구 카드 + 보호자 보조 모드 |

---

#### 플랫폼 지원

| 플랫폼 | 침대 옆 모드 | 빠른 카드 | 핸즈프리 루프 🔁 | 호출어 🎯 |
|---|:---:|:---:|:---:|:---:|
| 웹 — Mac / Windows / Linux (모든 브라우저) | ✅ | ✅ | ✅ | ✅ |
| 웹 — iPhone / iPad (Safari) | ✅ | ✅ | ✅ | ⚠️ Safari 전용 |
| iOS 네이티브 앱 (앱 스토어) | ✅ | ✅ | ✅ | ❌ 핸즈프리 사용 |
| Android (Chrome / Edge) | ✅ | ✅ | ✅ | ✅ |
| 시선 추적 장치 (모든 장치 — 마우스로 작동) | ✅ | ✅ | ✅ | ✅ |
| 스위치 스캐닝 (iOS 스위치 제어) | ✅ | ✅ | ✅ | ❌ |
| Apple Watch | ❌ | ❌ | ❌ | ❌ |

> **iOS 네이티브 앱에 호출어가 없는 이유는 무엇인가요?** 네이티브 브리지가 오디오 세션 (`prismNativeBridge.startVoice`)의 소유권을 가져가므로, 호출어 서비스가 사용하는 브라우저 `SpeechRecognition` API와 충돌합니다. 대신 **핸즈프리 루프** (🔁)를 사용하세요 — 각 AI 응답 후 1초 뒤에 마이크를 자동으로 다시 시작하여 지속적인 입력이 필요하지 않습니다.

---

#### 시작 방법

1. **AI 채팅** 패널을 엽니다 — 도구 모음에서 🤖 아이콘을 탭합니다.
2. 패널 헤더에서 **🛏**을 탭합니다 — 전체 화면 오버레이가 즉시 열립니다.
3. 입력 방식을 선택합니다 (아래 섹션 참조).

<p align="center">
  <img src="../../e2e/_screenshots/bedside-overlay-open.png" alt="침대 옆 모드 오버레이 열림 — 검은색 전체 화면 UI. 상단 스트립에는 빠른 문구 카드가 표시됩니다. 중간 영역에는 AI 응답이 표시됩니다. 하단에는 큰 빨간색 마이크 버튼과 제어 행이 표시됩니다." width="260">
  <img src="../../e2e/_screenshots/bedside-overlay-handsfree-on.png" alt="핸즈프리 활성화된 침대 옆 모드 — 🔁 버튼이 녹색으로 강조 표시되고, '핸즈프리 ON' 상태 텍스트가 표시됩니다." width="260">
  <img src="../../e2e/_screenshots/bedside-hands-free-on.png" alt="켜진 상태의 핸즈프리 토글 버튼 — 녹색 배경, aria-pressed=true" width="260">
</p>

#### 중지 / 종료 방법

- **터치 / 탭:** 오버레이의 오른쪽 상단 모서리에 있는 **✕**를 탭합니다 (48 × 48 px 대상).
- **키보드 / 스위치:** **Escape**를 누릅니다.
- **음성:** 오버레이가 열려 있는 동안 iOS 음성 제어를 통해 아무 명령이나 말합니다.

종료 시 전체 채팅 기록과 AI 세션 상태가 보존됩니다. 오버레이는 메인 패널 위에 별도의 렌더링 레이어로 존재하므로, 닫아도 아무것도 손실되지 않습니다.

<p align="center">
  <img src="../../e2e/_screenshots/bedside-overlay-closed.png" alt="침대 옆 모드 종료 후 — 대화 기록이 그대로 유지된 메인 AI 채팅 패널로 돌아옴" width="260">
  <img src="../../e2e/_screenshots/bedside-wakeword-statusbar.png" alt="침대 옆 모드에서 돌아온 후 'Hey Prism 활성'이 파란색 표시기와 함께 표시되는 메인 패널 상태 바" width="260">
</p>

---

### 🃏 빠른 문구 카드 — 비언어 및 움직임이 제한적인 사용자를 위해

> **이것은 자유롭게 말하거나 화면을 터치할 수 없는 사용자를 위한 핵심 경로입니다.** 빠른 문구 카드는 한 번의 탭, 시선 응시, 또는 스위치 스캔 선택으로 활성화할 수 있는 미리 프로그래밍된 통신 버튼입니다. 타이핑, 음성, 인터넷 연결이 필요하지 않습니다.

각 카드에는 큰 이모티콘 아이콘과 짧은 문구가 표시됩니다. 카드를 탭하면 해당 문구가 즉시 메시지 바에 로드됩니다. **핸즈프리 모드**가 켜져 있으면 문구가 자동으로 AI로 전송됩니다.

#### 내장 카드

처음 사용 시 15개의 카드가 긴급도별로 그룹화되어 미리 로드됩니다. 이 카드들은 삭제할 수 없으며, 오프라인에서 작동합니다.

**긴급 (최우선 순위 — 의료 비상 상황에서 먼저 전달):**

| 아이콘 | 문구 | 사용 시점 |
|:---:|---|---|
| 🆘 | 도움 — 긴급 상황 | 즉각적인 위험, 코드 호출, 지금 직원이 필요한 모든 상황 |
| 😢 | 아파요 | 모든 종류의 통증 — 위치/심각도는 자유 텍스트로 이어서 설명 가능 |
| 🫁 | 숨을 쉴 수 없어요 | 호흡 곤란, 기도 문제, 공황 발작 |
| 🔔 | 간호사 불러주세요 | 비응급 직원 요청 |

**신체적 요구:**

| 아이콘 | 문구 | 사용 시점 |
|:---:|---|---|
| 💧 | 물 주세요 | 갈증, 구강 건조, 약물 삼키기 |
| 🔥 | 너무 더워요 | 발열, 담요, 체온 조절 |
| 🥶 | 너무 추워요 | 오한, 담요, 실내 온도 |
| ↔️ | 자세 좀 바꿔주세요 | 압력 완화, 편안함, 수술 후 자세 |
| 💊 | 약이 필요해요 | 정해진 복용량, PRN 요청, 진통제 |

**의사소통:**

| 아이콘 | 문구 | 사용 시점 |
|:---:|---|---|
| ✅ | 네 | 확인 — 보호자의 예/아니오 질문에 답하기 |
| ❌ | 아니요 | 거부 — 보호자의 예/아니오 질문에 답하기 |
| ⏳ | 잠시만요 | 잠시 시간이 필요함 — 아직 진행하지 마세요 |

**감정:**

| 아이콘 | 문구 | 사용 시점 |
|:---:|---|---|
| ❤️ | 사랑해요 | 가족, 정서적 유대 |
| 🙏 | 감사합니다 | 감사 |
| 😨 | 무서워요 | 불안, 두려움, 고통 — 공감적인 AI 응답 트리거 |

#### 빠른 문구 카드 사용 방법

**단일 탭 / 시선 추적 / 스위치 선택:**
카드를 활성화하면 해당 텍스트가 메시지 바에 표시됩니다. 이 문구는 다음 용도로 사용될 수 있습니다:
- 문맥에 맞는 응답을 위해 AI로 전송 (예: "무서워요"를 탭하면 → AI가 안심시키고 후속 질문을 합니다)
- 그대로 읽기 — 방에 있는 보호자는 화면에서 탭된 카드를 볼 수 있습니다.

**핸즈프리 모드 켜짐 시:**
카드를 탭하는 순간 문구가 자동으로 AI로 전송됩니다. AI가 응답한 후 1초 뒤에 마이크가 다시 시작되어 추가 입력 없이 연속적인 루프를 생성합니다.

**"Hey Prism" 호출어 활성화 시 (웹 / 데스크톱):**
호출어 + 빠른 카드를 결합할 수 있습니다: 사용자가 "Hey Prism"이라고 말하여 마이크를 열고, AI가 응답하면 사용자는 다시 말하지 않고 카드를 탭하여 다른 방향으로 대화를 계속할 수 있습니다.

#### 사용자 지정 카드 추가 방법

보호자, BCBA 및 가족 구성원은 특정 사용자의 의사소통 요구에 맞춰 개인화된 카드를 추가할 수 있습니다 — 의사 이름, 좋아하는 문구, 특정 통증 설명, 종교적 표현 또는 기타 모든 것.

**단계:**

1. 침대 옆 모드에서 빠른 문구 스트립 끝에 있는 **＋ 추가**를 탭합니다.
2. 카드에 원하는 문구를 입력합니다 (최대 80자).
3. **카드 추가**를 탭합니다 — AI가 문구의 의미와 일치하는 이모티콘 아이콘을 자동으로 생성합니다 (예: "담요 더 주세요" → 🛏, "기도하고 싶어요" → 🤲).
4. 아이콘이 짧은 "✨ 생성 중…" 애니메이션과 함께 나타난 다음, 카드가 저장됩니다.

사용자 지정 카드는 기기에 로컬로 저장됩니다 (localStorage). 세션 및 앱 재시작 시에도 유지됩니다. 저장된 카드를 사용하기 위해 계정이나 인터넷 연결이 필요하지 않으며 — 초기 아이콘 생성에만 네트워크 호출이 필요합니다.

**추가할 수 있는 사용자 지정 카드 예시:**

| 제안 문구 | 이유 |
|---|---|
| `[의사 이름], 와주세요` | 특정 임상의에게 "간호사 불러주세요"보다 빠름 |
| `가족과 이야기해야 해요` | 가족의 도움이 필요한 정서적/법적 상황 |
| `불 좀 꺼주세요` | 감각 과민, 편두통, 수면 |
| `기도하고 싶어요` | 영적 돌봄 — 임종 시 존엄성 |
| `뭔가 이상해요` | 모호한 고통 신호 — AI가 명확한 질문을 하도록 유도 |
| `흡인기가 필요해요` | 기관절개술 / 인공호흡기 환자 |
| `IV가 아파요` | 침윤, 정맥염 경고 |
| `집에 가고 싶어요` | 완화/퇴원 대화 |

#### 사용자 지정 카드 삭제 방법

1. 빠른 문구 스트립 헤더에서 **✏️ 편집**을 탭합니다.
2. 각 사용자 지정 카드에 빨간색 **✕** 배지가 나타납니다 (내장 카드는 보호되어 제거할 수 없습니다).
3. 카드의 ✕를 탭하여 제거합니다.
4. **완료**를 탭하여 편집 모드를 종료합니다.

#### 스위치 스캐닝 설정 (iOS)

단일 외부 스위치 (흡입-배출, 머리 스위치, 발 스위치, 베개 스위치)만 활성화할 수 있는 사용자를 위해:

1. 스위치를 Bluetooth 또는 라이트닝/USB-C 포트를 통해 iPhone/iPad에 연결합니다.
2. **설정 → 손쉬운 사용 → 스위치 제어 → 스위치**로 이동하여 스위치를 "항목 선택"에 할당합니다.
3. **스위치 제어 → 스캐닝 스타일**로 이동하여 "자동 스캐닝"을 선택합니다 — 기기가 항목을 하나씩 자동으로 강조 표시합니다.
4. 침대 옆 모드에서 Prism AAC를 엽니다. 스위치 제어가 빠른 문구 카드를 자동으로 스캔합니다. 원하는 카드가 강조 표시될 때 스위치를 활성화합니다.
5. 문구가 즉시 전송됩니다 — 두 번째 동작이 필요하지 않습니다.

> 모든 빠른 문구 카드는 `data-scan-group="quick-cards"`를 포함하므로 보조 기술이 다른 UI 영역으로 이동하기 전에 전체 스트립을 그룹 스캔할 수 있습니다.

#### 시선 추적 설정

시선 추적 하드웨어 (Tobii Dynavox, EyeGaze Edge, PCEye, MyTobii P10 등)는 운영 체제에 응시 클릭이 있는 표준 마우스 포인터로 나타납니다. Prism AAC에서는 특별한 구성이 필요하지 않습니다:

1. 시선 추적 장치 소프트웨어에서 응시 시간을 구성합니다 (권장: 처음 사용자에게는 800–1200 ms).
2. 모든 브라우저에서 침대 옆 모드로 Prism AAC를 엽니다.
3. 빠른 문구 카드에 응시하여 활성화합니다.

최소 카드 크기 (88 × 80 px)는 WCAG 2.5.5 AAA 대상 크기 요구 사항인 44 × 44 CSS px를 충족하며, 시선 추적 상호 작용에 일반적으로 권장되는 최소값 (60 × 60 px)을 초과합니다.

---

<details>
<summary><strong>모든 기능 + 기술 구현 세부 정보</strong></summary>

**하나의 기능으로 제공되는 5가지 하위 시스템:**

1. **빠른 문구 카드** — `services/bedsideCards.ts` + `components/BedsideOverlay.tsx`의 스트립 UI.

   - 저장소: `localStorage` 키 `prism_bedside_cards_v1`. 모든 로드 시 스키마 유효성 검사 — 잘못된 형식의 항목은 자동으로 삭제됩니다.
   - 제한: 최대 50개의 사용자 지정 카드 (무한한 저장 공간 증가 방지).
   - 내장 카드: `builtin-` 접두사가 붙은 `id`를 가진 15개 항목; 삭제 UI 가드는 ✕ 배지를 표시하기 전에 이 접두사를 확인하여 기본값이 제거되지 않도록 합니다.
   - AI 아이콘 생성: `services/aiService.ts → inferCardIcon(text)`. 앱의 나머지 부분과 동일한 로컬 Ollama → Synalux 클라우드 라우팅 체인을 사용합니다. 잠긴 시스템 프롬프트 ("정확히 하나의 이모티콘으로 응답…")와 함께 문구를 사용자 메시지로 보냅니다. 응답에서 첫 번째 유니코드 코드 포인트를 추출합니다. 항상 해결됩니다 — 네트워크 오류 또는 이모티콘이 아닌 응답 시 💬로 대체됩니다.
   - 오프라인: 카드는 완전히 오프라인에서 작동합니다; 새 카드를 추가하는 경우에만 네트워크가 필요합니다 (아이콘 생성용 — 오프라인 시 💬로 대체).

2. **핸즈프리 AI 루프 (🔁)** — 메인 AI 채팅 헤더에서도 접근 가능합니다. 각 AI 응답 후 마이크가 자동으로 다시 시작됩니다 (1초 지연). `handsFreeRef` / `startListeningRef` 참조 패턴은 효과가 모든 렌더링에서 다시 실행되지 않고 항상 현재 콜백을 호출하도록 보장합니다.

   ![메인 AI 패널의 핸즈프리 상태 바](../../e2e/_screenshots/bedside-hands-free-statusbar.png)

3. **침대 옆 오버레이** — `fixed inset-0 z-50 bg-black` 전체 화면 어두운 UI는 메인 AI 패널과 함께 형제 `<Fragment>`로 렌더링되어 패널 상태가 열기/닫기 주기 동안 보존됩니다. 접근성: `role="dialog"`, `aria-modal="true"`, `aria-label="Bedside Mode"`, WCAG 2.1 SC 2.1.2 포커스 트랩 (오버레이 내에서 Tab/Shift+Tab 순환, `Escape` 닫기). 뷰포트 커버리지는 독립적으로 E2E 검증되었습니다 (≤ 4 px 허용 오차).

   - **큰 마이크 버튼** — 112 × 112 px (`w-28 h-28`), 듣는 동안 빨간색 + 깜빡임, 휴식 시 흰색 테두리. Playwright `boundingBox()`로 ≥ 96 px 검증.
   - **빠른 카드 스트립** — 가로 스크롤 행, 각 카드 `88 × 80 px`, 스위치 스캔 그룹화를 위한 `data-scan-group="quick-cards"`, 화면 리더 시맨틱을 위한 `role="list"` / `role="listitem"`.
   - **제어 행** — 핸즈프리 (켜져 있을 때 녹색), "Hey Prism" 호출어 (켜져 있을 때 파란색, `!wakeWordSupported`일 때 숨김), iOS 음성 제어 단축키.
   - **종료** — ✕ 버튼 (`w-12 h-12`) 또는 `Escape` → `onClose()` → `AIChatPanel`에서 `bedsideModeActive = false` → WCAG 2.4.3 포커스가 대화 상자를 연 🛏 버튼으로 돌아감.

   ![침대 옆 오버레이 — 닫힘, 메인 AI 패널로 돌아옴](../../e2e/_screenshots/bedside-overlay-closed.png)

4. **"Hey Prism" 호출어** — `services/wakeWordService.ts`. 백그라운드에서 연속적인 `SpeechRecognition` 세션을 실행합니다. "hey prism"을 포함하는 모든 전사본을 감지하고, 마이크를 한 번 작동시킨 다음 다음 주기를 위해 재설정합니다. 보호: iOS 네이티브 브리지가 마이크를 소유할 때 (`prismNativeBridge?.startVoice` 존재) 시작되지 않습니다. 호출어 활성 상태는 오버레이를 닫은 후 메인 패널 상태 바에 표시됩니다.

   ![ "Hey Prism" 활성 상태를 보여주는 상태 바](../../e2e/_screenshots/bedside-wakeword-statusbar.png)

5. **iOS 음성 제어 가이드** — 제어 행에서 📱를 탭하면 `prismNativeBridge.openSettings('accessibility')`를 시도합니다 (지원되는 네이티브 빌드에서 손쉬운 사용으로 딥링크). 웹 / 데스크톱에서는 `설정 → 손쉬운 사용 → 음성 제어 → 켜짐`을 안내하는 오버레이 내 지침 카드로 대체됩니다.

   <p align="center">
     <img src="../../e2e/_screenshots/bedside-voice-control-card.png" alt="iOS 음성 제어 지침 카드 — 웹/데스크톱에서 📱를 탭할 때 침대 옆 오버레이 내에 표시되는 단계별 가이드" width="260">
     <img src="../../e2e/_screenshots/bedside-voice-control-dismissed.png" alt="iOS 음성 제어 지침 카드 해제 후 — 오버레이가 일반 침대 옆 레이아웃으로 돌아옴" width="260">
   </p>

**테스트 범위:**
- `services/bedsideCards.test.ts` — 22개 단위 테스트: 기본 카드 세트, localStorage 왕복, 잘못된 JSON 대체, 유효하지 않은 카드 필터링, 50개 카드 제한, `createCard` 필드 제약 조건.
- `e2e/bedside-mode.spec.ts` — 17개 Playwright E2E 테스트: 버튼 가시성, `aria-pressed` 토글, 녹색/파란색 상태 클래스, 상태 바 텍스트, 오버레이 접근성 속성, 마이크 `boundingBox` 크기, 뷰포트 커버리지, 지침 카드 표시/해제.

**주요 파일:**
- `components/AIChatPanel.tsx` — 침대 옆 상태, 카드 상태 (`bedsideCards`), `handleAddBedsideCard`, `handleDeleteBedsideCard`, 핸즈프리 루프, 호출어 수명 주기, 헤더 버튼
- `components/BedsideOverlay.tsx` — 오버레이 UI, 빠른 카드 스트립, 카드 추가 대화 상자, 편집 모드, 포커스 트랩, 음성 제어 지침 카드
- `services/bedsideCards.ts` — `BedsideCard` 타입, `DEFAULT_BEDSIDE_CARDS`, `loadCards`, `saveCards`, `createCard`
- `services/aiService.ts` → `inferCardIcon(text)` — AI 이모티콘 추론
- `services/wakeWordService.ts` — 연속 호출어 감지
</details>

---

### 📨 메시지 보내기 — 제공자 선택기
연락처에 여러 구성된 제공자 (예: 메일과 SMS 모두)가 있는 경우, 작성 영역 위에 **"다음으로 보내기"** 섹션이 나타납니다. 한 번 탭으로 작성 전에 제공자를 전환할 수 있습니다 — 패널을 떠날 필요가 없습니다.

![연락처 제공자 선택기 — 메일이 녹색으로 강조 표시된 '다음으로 보내기' 행, SMS 사용 가능](../../docs/screenshots/contact-provider-picker.png)

---

### 💬 AAC 채팅
연결된 제공자 (Telegram, WhatsApp, 이메일, Slack 등)로부터의 수신 메시지는 이 패널에 도착합니다. 도구 모음의 읽지 않은 배지는 개수를 표시하고, 새 메시지가 도착하면 알람 + 교차 탭 알림이 발생하며, 메시지 줄을 탭하면 메시지 바에 복사되어 아동이 자신의 음성으로 답장을 작성할 수 있습니다.

![읽지 않은 배지가 있는 수신 보호자 메시지를 보여주는 AAC 채팅 패널](../../docs/screenshots/panel-aac-chat.png)

<details>
<summary><strong>기능 + 기술 세부 정보</strong></summary>

- Synalux 포털 `/api/v1/prism-aac/inbox/poll`을 통한 폴링된 받은 편지함 (포털이 구성되지 않은 경우 404에서 no-op)
- 새 메시지 도착 시 교차 탭 `BroadcastChannel` 알림
- 제공자 추상화: Outlook / Slack / Discord 추가 = 각 ~30 LOC ( `synalux-private/scripts/fetch-messages.mjs` 참조)
- 읽음 상태가 다시 동기화되어 보호자가 자녀가 메시지를 본 시점을 알 수 있습니다.
- 무료 티어: 1개 연결된 제공자; 유료 티어: 무제한
- 메시지별 TTS를 통해 아동이 선호하는 음성으로 수신 텍스트를 들을 수 있습니다.

**렌더링 경로:** `components/SchedulePanel.tsx` → `useScheduleStore` (24개 사전 설정 활동 + 사용자 지정) → `services/feedback.ts:playTimerRing()` → `services/azureTTS.ts:warmupAzureAudio()`를 통한 공유 AudioContext.
</details>

---

### 🧮 학교 과목
전체 고등학교 과정을 다루는 **19개 과목 키보드**를 호스팅하는 셀 그리드 캔버스: 수학 + 과학 + 프로그래밍 + 예술 + 인문학. 각 탭은 AI 튜터를 도메인별 프롬프트 템플릿 (총 33개 템플릿)을 통해 라우팅하므로, 모델은 Punnett 사각형에 대수적 추론을 적용하거나 음악 다이내믹을 프로그래밍 리터럴로 오인하지 않습니다. **역사는 지역 + 지역 인식**으로 주 / 주 / 주 / 자치 공동체 수준까지 — 23개국에 걸쳐 280개 이상의 지역을 지원합니다.

![셀에 5 + 7 = 12가 입력된 셀 그리드 캔버스](../../docs/screenshots/math-canvas-typed.png)

<details>
<summary><strong>과목 탭 (총 19개)</strong></summary>

**수학 (9개 키보드)** — 기본, 고급 수학 (π √ 지수 + 5가지 장식 도구: 분수 상자, 나눗셈 기호, 근호 바, 합계 선, 분수 바), a–z, 기타 수학 (집합론 + 논리), 시간 및 거리, 무게, 부피, 기하학, 돈.

**과학 (4개)** — 화학 (24개 원소 + 반응 화살표 + 전하 + 아래 첨자 + 상 표시자), 물리 (전체 그리스어 + 16개 SI 단위 + ∫/∂/∇/∑/∏ + 상수), 생물학 (DNA/RNA + 유전학 + 8개 분류 등급 + 12개 세포 소기관), 통계학 (μ σ x̄ + 12개 연산 + 분포).

**프로그래밍 (2개)** — Python (24개 연산 + 26개 키워드) 및 Java (24개 연산 + 26개 키워드). 코드는 셀당 한 문자를 커밋하여 모노스페이스 그리드에 자연스럽게 배치됩니다.

**예술 + 인문학 (4개)** — 음악 (3개 음자리표 + 6개 음표 + 5개 쉼표 + 5개 임시표 + 8개 다이내믹), 지구 과학 (날씨 + 판 + 10개 행성 + AU/ly/pc/Mya/Gya), 역사 (지역 + 지역 인식), 언어 예술 (12개 품사 태그 + 6개 문장 유형 + 구두점 + 인용 스타일).

</details>

<details>
<summary><strong>AI 튜터 — 11개 도메인 × 3개 모드 = 33개 프롬프트</strong></summary>

![캔버스 위에 모의 힌트가 있는 AI 튜터 오버레이](../../docs/screenshots/math-tutor-hint.png)

과목당 세 가지 모드: 💡 **힌트** (부드러운 다음 단계 안내, 절대 해결하지 않음), ✓ **확인** (아동의 답변 유효성 검사, 정답이면 축하), 🎓 **풀이** (전체 단계별 안내, 최대 4단계). 활성 탭은 튜터에게 아동이 어떤 과목을 하고 있는지 알려줍니다. 15초 하드 타임아웃 + 재시도 버튼으로 오버레이가 멈추지 않도록 합니다.
</details>

<details>
<summary><strong>역사 — 지역 + 지역 인식</strong></summary>

![en 로케일 (지역 없음)의 역사 키보드 — 보편적 + 국가적 티어](../../docs/screenshots/math-keyboard-history-en.png)
![US-TX 지역의 역사 키보드 — 알라모, 텍사스 합병, JFK 등장](../../docs/screenshots/math-keyboard-history-us-tx.png)

세 가지 티어 스택:
1. **보편적** 사건 (모든 교육 과정에서 가르치는 사건) (476, 1914년 1차 세계 대전, 1939년 2차 세계 대전, 1969년 달 착륙)
2. `language`에 따라 선택된 **국가적** 사건 (en, es, fr, de, ro, ru, uk, ja, ko, zh, ar, it, pl, nl, he, hi, vi, tr, pt) — 19개 언어 지원
3. `historyRegion`에 따라 선택된 **하위 국가적** 사건 (US-TX, CA-QC, UK-SCT, ES-CT, IN-MH, DE-BY, …) — 50개 미국 주 + DC, 13개 캐나다 주/준주, 4개 영국 국가, 아일랜드 (공화국 + 4개 역사적 주), 16개 독일 주, 17개 스페인 자치 공동체, 20개 이탈리아 지역을 포함한 **23개국에 걸쳐 280개 이상의 지역**, 또한 AU, FR, MX, BR, IN, CN, RU, BE, CH, NL, AR, ZA, KR, PK, NZ, PL.

튜터 프롬프트는 로케일 + 지역을 포함하므로 `US-TX`의 1836년과 같은 모호한 날짜는 알라모 (앨라배마 주 승격 아님)로 해결됩니다; `CA-QC`의 1759년은 아브라함 평원으로 고정됩니다; `ES-CT`의 1714년은 바르셀로나 함락으로 고정됩니다.

</details>

<details>
<summary><strong>테스트 워크플로우 — 12개 과목 × 8-12학년 단어 문제 × 72개 Playwright 테스트</strong></summary>

모든 과목 키보드를 연습하는 단계별 문제 시트와, 라이브 수학 패널을 구동하고 각 단계의 글리프가 셀 그리드에 제대로 들어가는지 확인하는 문제당 실행 가능한 Playwright 테스트가 포함됩니다. 실제 9학년 대수학 참조 페이지를 직접 모델링했습니다.

- **레이어 1 — 일반 단계별:** [`tests/workflows/`](tests/workflows/) — 12개 마크다운 (고급 수학, 생물학, 화학, 지구 과학, 기하학, 역사, 언어 예술, 기타 수학, 물리, 프로그래밍-자바, 프로그래밍-파이썬, 통계).
- **레이어 2 — 학년별 실제 교실:** [`tests/workflows/grade-8-12/`](tests/workflows/grade-8-12/) — 명명된 변수 단어 문제가 있는 12개 마크다운 (대수학-9학년, 기하학-10학년, 물리-11학년, 화학-10학년, 생물학-9학년, 통계학-11학년, 프로그래밍-파이썬-9학년, 프로그래밍-자바-11학년, 미적분-12학년, 지구 과학-9학년, 언어 예술-8학년, 세계사-10학년) + 과목별 키보드 간격 [`REPORT.md`](tests/workflows/grade-8-12/REPORT.md).
- **레이어 3 — Playwright e2e:** [`e2e/math-workflows/`](e2e/math-workflows/) — 72개 테스트 (`npx playwright test --project=desktop e2e/math-workflows`).

전체 인덱스, 지원 부족 과목 순위, "새 워크플로우 추가 방법" 런북 → **[`docs/WORKFLOWS.md`](docs/WORKFLOWS.md)**.

</details>

<details>
<summary><strong>기타 수학 기능 (잠금 도구, 두 번 탭 확대, 저장 / 동기화)</strong></summary>

- **잠금 도구** — 아동이 문제를 마친 후 영역을 잠급니다. 잠긴 셀은 약간 어둡게 렌더링되고 편집을 거부합니다.
- **두 번 탭 확대** — 첫 번째 탭은 키를 활성화하고 (1.4배 확대 + 녹색 후광), 두 번째 탭은 확정합니다. 2초 후 자동 비활성화됩니다. 운동 정밀도가 낮은 사용자를 위한 기능입니다.
- **저장 + 동기화** — `localStorage`에 로컬 우선; `↻ 동기화` 버튼을 통해 Synalux 포털로 최선을 다해 동기화. 100개 문서 / 200KB 본문 제한; 가장 오래된 것은 제거됩니다.
- **누르고 있기 응시** — 녹색 진행 링과 함께 키별 응시 시간 (0–1500ms) 구성 가능.

![하나의 항목과 동기화 버튼을 보여주는 저장된 문서 오버레이](../../docs/screenshots/math-docs-overlay.png)
![녹색 후광 확대 상태로 활성화된 숫자 키](../../docs/screenshots/math-two-hit-armed.png)
![잠금 도구가 활성화되어 사용자에게 영역의 모서리를 탭하도록 안내](../../docs/screenshots/math-lock-armed.png)

</details>

<details>
<summary><strong>과목 키보드 — 추가 사진</strong></summary>

![H₂O가 있는 화학 키보드](../../docs/screenshots/math-keyboard-chemistry.png)
![A T G가 있는 생물학 키보드](../../docs/screenshots/math-keyboard-biology.png)
![`private String`이 있는 Java 키보드](../../docs/screenshots/math-keyboard-java.png)
![음악 키보드](../../docs/screenshots/math-keyboard-music.png)
![통계 키보드](../../docs/screenshots/math-keyboard-statistics.png)
![지구 과학 키보드](../../docs/screenshots/math-keyboard-earth-science.png)
![언어 예술 키보드](../../docs/screenshots/math-keyboard-language-arts.png)
![루마니아어 로케일 역사](../../docs/screenshots/math-keyboard-history-ro.png)

</details>

---

### 🗓 일정
루틴 + 전환 지원을 위한 시각적 선행-후행 일정입니다. 각 단계는 그림 타일 + 레이블로 구성되며, 타일을 완료하면 차임벨이 울리고 시각적 진행 표시가 나타납니다. 루틴이 끝나면 보상 상점 (유료 티어)이 잠금 해제됩니다.

![선행-후행 보드 + 활동 목록이 있는 일정 패널](../../docs/screenshots/panel-schedule.png)

<details>
<summary><strong>기능 + 기술 세부 정보</strong></summary>

- 원탭 활동 추가를 위한 24개 타일 사전 설정 그리드: 기상, 양치질, 아침 식사, 학교, 간식, 점심, 놀이, 독서, 미술, 산책, 저녁 식사, 목욕, 취침 이야기, 취침, 약 복용, 치실, 정리, 세탁, 반려동물 돌보기, 스포츠, …
- 드래그 앤 드롭 재정렬; 연필 아이콘 인라인 편집; 사전 설정은 `textKey`를 포함하여 언어 전환 시 레이블을 다시 지정합니다.
- 선행-후행 상태 머신: 활성화된 타일 깜빡임, 타이머 만료 시 3음 상승 차임벨, 모션 안전 (`prefers-reduced-motion` → 정적 링), `aria-pressed` 시맨틱
- 오디오 워밍업: 거의 소리 없는 1Hz 발진기가 iOS Safari에서 AudioContext를 "실행" 상태로 유지하여 긴 침묵 후에도 타이머 차임벨이 실제로 재생되도록 합니다 (워밍업 없이는 차임벨이 일시 중단된 컨텍스트로 발생하여 소리가 나지 않음).
- 보호자 메시지는 "메시지" 트랙으로 일정에 추가되어 아동이 다가오는 일과 누가 메시지를 보냈는지 확인할 수 있습니다.

**렌더링 경로:** `components/SchedulePanel.tsx` → `useScheduleStore` (24개 사전 설정 활동 + 사용자 지정) → `services/feedback.ts:playTimerRing()` → `services/azureTTS.ts:warmupAzureAudio()`를 통한 공유 AudioContext.
</details>

---

### 🎮 게임
12가지 증거 기반 AAC 게임. **스크린 타임이 아닌** 의사소통 교육을 위해 제작되었습니다. 각 게임은 발화 + 정확도를 기록하여 적응형 엔진이 다음으로 가장 적합한 게임을 제안할 수 있도록 합니다.

![9개의 게임 타일이 있는 게임 패널](../../docs/screenshots/panel-games.png)

<details>
<summary><strong>12가지 게임 + 기술 세부 정보</strong></summary>

| 게임 | 목표 기술 |
|---|---|
| 버블 팝 | 원인 + 결과, 의도적 의사소통 |
| 컬러 헌트 | 수용 어휘 (색상 이름) |
| 내 이야기 | 이야기 순서화 |
| 매치 잇 | 매칭 + 범주적 사고 |
| 예/아니오 | 이진 변별, 요청/거부 |
| 피니시 잇 | 문장 완성 (클로즈) |
| 카테고리 분류 | 의미론적 범주화 |
| 감정 매칭 | 정서 라벨링, 마음 이론 |
| 다음은 무엇일까 | 순차적 추론 |
| 같음 / 다름 | 시각 변별 — 일치 또는 대비 |
| 소리 듣기 (소리 매칭) | 청각 변별 + 어휘 |
| 차례 지키기 | 사회적 차례 지키기 연습 |

- 무료 티어: 버블 팝, 컬러 헌트, 내 이야기 (3가지 게임)
- 유료 티어: 12가지 모두
- 게임별 데이터는 `services/adaptiveEngine.ts`에 공급됩니다 — 발화 길이 / 카테고리 / 시간대 / 결과 → 다음 게임을 제안합니다.
- 모든 게임은 해당 게임의 어휘와 관련 없는 AAC 타일 카테고리를 비활성화하여 아동이 산만해지지 않도록 합니다.

**렌더링 경로:** `components/GamesPanel.tsx` → `components/games/`의 개별 게임 구성 요소. 각 게임은 `useScheduleStore.recordMessage(text, category)`를 통해 기록됩니다.
</details>

---

### 🏪 마켓플레이스
음성 팩 (Inworld 음성, 형제자매/부모의 사용자 지정 복제 음성), 어휘 팩 (스페인어 핵심, 수화 지원 음성), 게임 팩 (9가지 외 추가 게임). 앱은 내장 패널이 사용하는 동일한 레지스트리를 통해 도구 모음에 설치됩니다.

![설치 가능한 앱이 있는 마켓플레이스 패널](../../docs/screenshots/panel-marketplace.png)

<details>
<summary><strong>기능 + 기술 세부 정보</strong></summary>

- 앱은 JSON 항목 (`lib/marketplace/manifests/local.ts`) + 패널 구성 요소를 반환하는 `getHandler(appId)`가 있는 런타임 `lib/marketplace/registry.ts`로 존재합니다.
- 음성 복제 (유료 티어): 90초 녹음 → 카테고리 타일을 포함하여 앱의 모든 TTS에 사용할 수 있는 훈련된 음성
- 설치된 앱은 내장 앱 뒤에 도구 모음 버튼으로 렌더링됩니다; `useSettingsStore.installedApps`가 진실의 원천입니다.
- 티어별 게이트: 마켓플레이스는 모든 것을 나열하지만, 사용자의 요금제보다 높은 항목에 대해서는 설치 버튼이 비활성화됩니다.

**렌더링 경로:** `components/MarketplacePanel.tsx` → `useMarketplaceStore` → 구매를 위한 백엔드 `synalux/api/v1/marketplace/...`, 그 다음 IndexedDB로 자산 다운로드 (음성 파일, 어휘 JSON).
</details>

---

### 📄 PDF 리더
PDF를 열고, 페이지당 하나의 타일을 보고, 탭하여 자신의 음성으로 들을 수 있습니다. 학교 워크시트, 가정 통신문, 기사 — 어떤 PDF든 입력하여 읽으려고 노력하는 대신 들을 수 있습니다. Adobe Reader가 필요 없으며, 전체 라이브러리가 브라우저에서 실행됩니다.

![PDF 리더 패널 — "+ PDF 열기" 프롬프트가 있는 빈 상태](../../docs/screenshots/panel-pdf-reader.png)

<details>
<summary><strong>기능 + 기술 세부 정보</strong></summary>

- 페이지당 하나의 타일; 각 타일은 처음 3줄 + `▶ 페이지 N` 버튼을 표시하며, 이 버튼은 `aacSpeak()`를 통해 (다른 모든 것과 동일한 음성 + 톤 + 단어 강조) 소리를 출력합니다.
- `▶ 모두 읽기`는 모든 페이지를 하나의 연속적인 발화로 연결합니다.
- 빈 페이지 감지 (스캔 이미지 PDF)는 OCR 도구를 제안합니다.
- `pdfjs-dist`는 첫 열기 시 동적으로 가져옵니다 — CDN에서 별도의 ~3 MB 청크, npm 패키지에 버전 고정.
- 도구 모음 버튼 (📄)은 설정 → 도구 모음을 통해 선택 사항이므로, 최소 기본 도구 모음이 깔끔하게 유지됩니다.

**렌더링 경로:** `components/PdfReaderPanel.tsx` → `services/pdfReader.ts` (pdfjs `getDocument` → 페이지별 `getTextContent`) → `services/aacSpeak.ts`.
</details>

---

### 👁 스크린샷 리더 (OCR)
워크시트 사진, 웹페이지 스크린샷, 교과서 페이지 사진을 붙여넣거나 업로드하면 인식된 텍스트가 이미지 옆에 나타나고, **▶ 말하기**를 탭하여 들을 수 있거나, **↧ 메시지 바에 보내기**를 탭하여 말하기 전에 편집할 수 있습니다.

![스크린샷 리더 (OCR) 패널 — "+ 이미지 열기" 프롬프트가 있는 빈 상태](../../docs/screenshots/panel-ocr-capture.png)

<details>
<summary><strong>기능 + 기술 세부 정보</strong></summary>

- PrismAAC 로케일에서 Tesseract 코드로 매핑된 20개 언어 OCR 매트릭스 (eng / spa / fra / por / deu / ron / ukr / rus / jpn / kor / chi_sim / ara / ita / pol / nld / heb / hin / vie / tur / ind)
- 언어별 traineddata 파일은 첫 사용 후 캐시됩니다 (영어의 경우 ~10 MB, CJK의 경우 더 많음) — 첫 실행 시 "이미지 읽는 중… (첫 실행 시 OCR 모델 다운로드 — 10-30초 소요될 수 있음)"이 표시됩니다.
- 신뢰도 백분율이 표시되어 AAC 사용자가 결과를 신뢰할지 또는 다시 촬영할지 판단할 수 있습니다.
- `disposeOcr()` 정리 훅은 페이지 언로드 시 생성된 모든 워커를 종료하여 WASM 메모리를 해제합니다.
- 도구 모음 버튼 (👁)은 설정 → 도구 모음을 통해 선택 사항입니다.

**렌더링 경로:** `components/OcrCapturePanel.tsx` → `services/ocr.ts` (`tesseract.js` `createWorker` → `recognize`) → `services/aacSpeak.ts` 또는 `messageStore.setText`.
</details>

---

### 🎧 컴포트 플레이어

병원 환자를 위한 침대 옆 미디어 플레이어 — 혼수 상태, 중환자실, 비언어 환자 또는 침대 옆에서 지속적인 위로 콘텐츠가 필요한 모든 사람.

<details>
<summary>기능 세부 정보</summary>

가족과 친구들은 음성 메시지를 녹음하고 사진과 비디오를 업로드합니다. 재생 목록은 계속해서 반복되므로 환자는 항상 익숙한 목소리와 얼굴을 가까이 둘 수 있습니다.

- **녹음** 앱에서 직접 음성 메시지 (MediaRecorder API)
- **업로드** 오디오 파일, 사진, 비디오 클립 (파일당 100 MB, 총 500 MB)
- **자동 반복** 모든 항목을 계속해서 자동 반복 — 설정하고 자리를 비울 수 있습니다.
- **전체 화면** 사진 및 비디오용 모드 (침대 옆 디스플레이)
- **네이티브 TTS** 통합 — iOS에서 AVSpeechSynthesizer를 통해 탭된 문구 발화
- **오프라인** — 모든 미디어는 IndexedDB에 저장되며 인터넷 없이 작동합니다.
- **키보드 접근 가능** — 모든 컨트롤에는 ARIA 레이블과 키보드 탐색 기능이 있습니다.
- **군사 등급 검토** — 27가지 보안 문제 해결 (블롭 URL 유출, 할당량 처리, 입력 유효성 검사, MIME 허용 목록, 언마운트 정리)
- 도구 모음 버튼 (🎧)은 설정 → 도구 모음을 통해 선택 사항입니다.

**저장 용량 제한:** 최대 50개 항목, 파일당 100 MB, 총 500 MB. MIME 유형은 오디오 (webm/mp4/mpeg/ogg/wav), 이미지 (jpeg/png/gif/webp/heic), 비디오 (mp4/webm/quicktime)로 제한됩니다.

**렌더링 경로:** `components/ComfortPlayerPanel.tsx` → `store/comfortPlayerStore.ts` (Zustand + persist) → `services/comfortMediaStorage.ts` (IndexedDB 블롭).
</details>

---

### 🧩 Chrome 확장 프로그램 — 모든 텍스트 필드에서 동일한 읽기 도우미 기능
PrismAAC 웹 앱은 자체 표면 내에서 읽기 도우미 흐름을 다룹니다. Chrome 확장 프로그램 (`chrome-extension/`)은 **모든 사이트의 모든 텍스트 필드** — Gmail, Google Docs, Word Online, 학교 포털, 은행 양식 — 에 **동일한 동작**을 제공하여 웹 페이지만으로는 도달할 수 없었던 유일한 Read & Write 간극을 메웁니다.

![PrismAAC 읽기 도우미 — 모든 텍스트 필드에서 입력하면서 말하기, 단어별 강조 기능](../../docs/screenshots/extension-marquee.png)

떠다니는 오버레이는 포커스된 텍스트 필드 위에 부착됩니다. **▶ 말하기**를 탭하여 다시 읽거나, 계속 입력하기만 하면 됩니다 — `.?!`로 문장을 마치면 각 단어가 말해질 때 노란색으로 강조되면서 자동으로 다시 읽어줍니다:

![작성 페이지 위의 PrismAAC 오버레이, TTS가 "school"을 말할 때 노란색으로 강조된 문장 중간](../../docs/screenshots/extension-overlay.png)

말하면서 번역 기능은 원본 줄 (작은 이탤릭체)과 번역된 줄 (전체 크기, 말해질 때 활성 단어 강조 포함)을 모두 표시합니다. Google의 무료 공개 엔드포인트 (API 키 없음)를 통해 50개 이상의 언어를 지원합니다:

![PrismAAC 오버레이가 영어를 루마니아어로 번역 — 원본 줄 "I had a really good day at school today"와 번역된 "Am avut o zi foarte bună la școală astăzi"가 아래에 표시되며, "foarte"가 강조 표시됨](../../docs/screenshots/extension-translate.png)

옵션 페이지 — `chrome.storage.sync`를 통해 사용자의 Chrome 프로필 전체에 걸쳐 설정 동기화. 사이트별 비활성화 목록, 음성 선택기, 속도 / 볼륨 / 피치 슬라이더, 언어 선택기, 모두 선택 사항:

![PrismAAC 확장 프로그램 옵션 페이지 — 말하기 트리거, 대상 언어 루마니아어, 음성 선택기, 속도/볼륨/피치 슬라이더](../../docs/screenshots/extension-options.png)

**설치 (현재 개발자 모드 — Chrome 웹 스토어 등록 검토 중):**

```sh
cd chrome-extension
npm install
npm run build
```

`chrome://extensions`를 열고, **개발자 모드**를 활성화하고, **압축 해제된 확장 프로그램 로드**를 클릭한 다음, `chrome-extension/dist`를 선택합니다.

**기능:**

- `.?!`에서 문장 말하기, 스페이스에서 각 단어 말하기, 모두 토글 가능
- **단어별 강조**는 브라우저의 네이티브 `SpeechSynthesisUtterance.boundary` 이벤트로 구동됩니다 (웹 앱의 ~60 ms/문자 휴리스틱과 달리 TRUE 단어별 동기화 — 포털 경로는 스트리밍 이벤트 없이 MP3를 반환하지만, 웹 음성은 이를 네이티브로 노출합니다).
- **말하면서 번역** — 대상 언어를 선택합니다 (Google의 무료 공개 엔드포인트, API 키 없음으로 50개 이상 지원). 오버레이는 원본 줄 (작은 이탤릭체)과 번역된 줄 (활성 단어 강조 포함)을 모두 표시합니다; 대상 언어와 일치하는 웹 음성 음성이 자동 선택됩니다.
- 포커스된 필드 위에 고정된 떠다니는 Shadow-DOM 오버레이 (▶ 말하기, 📌 고정, × 닫기)
- `Cmd / Ctrl + Shift + S`를 눌러 포커스된 필드를 필요에 따라 말하게 합니다; `Esc`는 취소합니다.
- 은행 / 민감한 양식에 대한 사이트별 비활성화 목록
- `chrome.storage.sync`를 통해 사용자의 Chrome 프로필 전체에 걸쳐 설정 동기화 — PrismAAC 계정 필요 없음

**개인정보 보호:** 번역 없음 모드는 완전히 오프라인입니다 (웹 음성은 네이티브로 실행). 번역 모드는 고유한 문장당 한 번의 HTTPS 호출을 `translate.googleapis.com`으로 만듭니다 (첫 히트 후 캐시됨). 소스는 [`chrome-extension/`](chrome-extension/)에서 확인할 수 있습니다 — TypeScript + esbuild 번들 (콘텐츠 18 KB, 옵션 7 KB, 백그라운드 339 B).

---

### 👋 핸즈프리 제스처
안정적으로 탭할 수 없는 사용자를 위한 선택적 카메라 기반 입력. 머리 자세 응시 클릭 + 손 자세 제스처 프로필. 로컬에서 실행됩니다 — 비디오는 기기를 떠나지 않습니다.

<details>
<summary><strong>기능 + 기술 세부 정보</strong></summary>

- **기본 모드**: 머리 자세 추적 (FaceLandmarker, MediaPipe). 사용자가 키를 보고 `headTrackingDwellMs` (기본값 1200 ms) 동안 응시를 유지 → 클릭. 응시하는 동안 시각적 진행 링이 채워집니다.
- **고급 모드**: 손 자세 추적. `components/HandCalibration.tsx`를 통해 구성된 사용자별 사용자 지정 제스처 프로필 (손바닥 열기 = 엔터, 주먹 = 백스페이스, 꼬집기 = 스페이스 등).
- 드리프트 안전 스택: 사용자의 머리가 `headTrackingDriftWindowMs` 연속 프레임 동안 `headTrackingDriftThresholdPx` 이상 드리프트하면 추적이 자동으로 비활성화되고 재보정 프롬프트가 표시됩니다 (2026년 5월 사용자 보고: 추적이 한 시간 동안 드리프트를 조용히 따라가 실제 키 대상을 놓칠 수 있음).
- **Esc 비상 탈출** — 어떤 키보드에서든 Esc를 누르면 추적이 즉시 비활성화되고 메시지 바를 잃지 않고 쿼티가 다시 표시됩니다.
- 카메라 스트림 싱글톤 (`services/cameraStream.ts`)으로 머리 + 손 추적기가 하나의 스트림을 공유; 모드 전환은 무료입니다.
- 사용자별 보정이 유지됩니다; 신체 추적기는 세션 재개 시 자동으로 복구됩니다.

**자세한 문서:** [`docs/TRACKING_MATH.md`](docs/TRACKING_MATH.md) (보정 수학, 백분위 학습기, 자기 운동, 원 유로 필터, ~30가지 조정 가능 항목), [`docs/GESTURE_RECOGNITION.md`](docs/GESTURE_RECOGNITION.md), [`docs/TRACKING_RELIABILITY.md`](docs/TRACKING_RELIABILITY.md).
</details>

---

### ⚙️ 설정
23개 언어, 테마 (밝음 / 어두움 / 고대비), 그리드 크기 (4–20개 타일), 운동 보조 기능 (수학 누르고 있기 응시, 두 번 탭 확대, 머리 추적 응시, 제스처 민감도, 드리프트 자동 비활성화), 음성 선택기 (유료), AI 자동 수정 켜기/끄기, 알림, 도구 모음 사용자 지정, 기록 지역 선택기.

![설정 — 언어 선택기 + 테마 토글](../../docs/screenshots/panel-settings.png)

<details>
<summary><strong>수학 + 접근성 설정</strong></summary>

![설정 — 수학 누르고 있기 시간 + 두 번 탭 확대](../../docs/screenshots/panel-settings-math.png)

- **수학 누르고 있기 응시** — 0–1500 ms 슬라이더; 0 = 즉시 클릭, 200–1500 ms는 운동 정밀도가 낮은 사용자에게 도움이 됩니다 (응시하는 동안 녹색 진행 링이 채워져 볼 수 있습니다).
- **두 번 탭 확대** — 어떤 수학 키든 첫 번째 탭은 키를 활성화하고 (1.4배 확대 + 녹색 후광, 확정 없음), 두 번째 탭은 확정합니다. 2초 후 자동 비활성화됩니다. 누르고 있기 응시와 함께 작동합니다.
- **머리 추적 응시** — 200–5000 ms.
- **민감도** — 1–10.
- **드리프트 자동 비활성화** — 토글 + 임계값 (px) + 창 (ms).
- **손 보정 표시** — 손 자세 프로필 편집기를 엽니다.

</details>

<details>
<summary><strong>입력 모드 — 음성, 제스처, AI 자동 수정</strong></summary>

![설정 — 입력 모드 패널](../../docs/screenshots/panel-settings-input-modes.png)

- **음성 입력** — 웹 음성 API, 언어 인식 (영국 영어 vs 미국 영어 등); 무료 티어
- **AI 자동 수정 및 완성** — 모든 키 입력 일시 중지는 클라우드 자동 수정 (Gemini 2.5 Flash-Lite)을 통해 라우팅됩니다. 낮은 대역폭 시나리오에서는 기본적으로 꺼져 있습니다.
- **알림** — 수신 AAC 채팅 메시지에 대한 알람 + 교차 탭 알림.
- **카메라 입력** — 머리 + 손 추적 마스터 스위치.
- **카메라 추적 대상** — 머리, 손 또는 자동 감지.

</details>

<details>
<summary><strong>도구 모음 사용자 지정</strong></summary>

도구 모음은 완전히 재정렬 가능합니다. 기본 0.9.0 버전은 최소한의 세트 (마이크, AAC 채팅, 알림, 카테고리, 설정)로 제공되어 신규 사용자를 위해 화면이 깔끔하게 유지됩니다 — 다른 모든 내장 기능 (수학, AI 채팅, 일정, 게임, 마켓플레이스, 컴포트 플레이어, 메모, 기록, 소리)은 설정 → 도구 모음에서 한 번 탭으로 다시 활성화할 수 있습니다. 마켓플레이스에서 설치된 앱은 내장 앱 뒤에 자동으로 배치됩니다.

</details>

---

## 사용해보기

| | |
|---|---|
| 🌐 **웹 앱** | [synalux.ai/prism-aac](https://synalux.ai/prism-aac) — 모든 브라우저에서 사용해보기 |
| 📱 **iOS** | [앱 스토어](https://apps.apple.com/app/id6764692277) — iPhone, iPad, Apple Watch |
| 💻 **소스** | 이 저장소. AGPL-3.0 — 자유롭게 포크하고 수정 사항을 공유하세요. |

---

## 요금제

| | 무료 | 유료 |
|---|---|---|
| 그림 타일 + 22개 카테고리 | ✅ | ✅ |
| 입력하여 말하기 | ✅ | ✅ |
| 기본 음성 (Inworld) | ✅ | ✅ |
| 19개 과목 학교 키보드 + AI 튜터 | ✅ 기본 | ✅ + 프리미엄 모델 |
| 일정 | ✅ | ✅ + 보상 상점 |
| 게임 | 3가지 (버블 팝, 컬러 헌트, 내 이야기) | 12가지 모두 |
| 음성 선택기 | — | ✅ 모든 Inworld 음성 |
| 음성 복제 (자신의 음성) | — | ✅ |
| 보호자 메모 동기화 | — | ✅ |
| 단어 예측 (사용자별 학습) | — | ✅ |
| 지역 + 지역 기록 | ✅ | ✅ |
| 핸즈프리 제스처 입력 | ✅ | ✅ |

[Synalux 요금제 보기 →](https://synalux.ai/pricing)

---

## 임상 안전

- **AAC 접근은 결과적으로 절대 제한되지 않습니다.** 아동은 항상 자신의 목소리를 가져야 합니다.
- **동의 없이 클라우드에 PHI 없음.** 보호자 메모는 업로드 전에 암호화됩니다.
- **오디오는 로컬에 유지됩니다.** 음성 입력은 웹 음성 API를 통해 브라우저에서 전사됩니다.
- **BCBA에 의해 설계되었습니다.** 언어적 조작 추적은 BACB Task List 5th Edition과 일치합니다.
- **트라우마 정보 기본값.** 처벌 메커니즘 없음. 보상 상점은 선택 사항입니다.

더 읽어보기: [`ACCESSIBILITY.md`](ACCESSIBILITY.md), [`SECURITY.md`](SECURITY.md).

---

## 인프라 및 GDPR

### 다중 지역 아키텍처

| 구성 요소 | 지역 | 목적 |
|---|---|---|
| **Supabase 미국** | 미국 동부 (버지니아) | 주요 데이터베이스 — 인증, 사용자 데이터, 보호자 메모 |
| **Supabase EU** | EU 중앙 (프랑크푸르트) | GDPR 준수 — EU 사용자 데이터는 EU를 벗어나지 않습니다. |
| **Vercel** | 글로벌 엣지 | 웹 앱, API 경로, CDN |
| **Inworld TTS** | 미국 | 신경망 텍스트 음성 변환 |
| **HuggingFace Hub** | 미국/EU | 모델 가중치 (1.7B, 8B, 14B, 32B) |
| **온디바이스** | 사용자 기기 | llama.cpp 추론 (iPhone/iPad/Mac) |

### GDPR 준수

EU 사용자의 데이터는 프랑크푸르트 (eu-central