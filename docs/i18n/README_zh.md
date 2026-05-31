<!-- Auto-generated from README.md by scripts/generate_i18n.py — do not edit manually -->
# Prism AAC

**帮助无法说话的孩子进行交流。**

适用于有运动障碍和复杂沟通需求儿童的辅助与替代沟通（AAC）应用。轻触图片，构建句子，并以23种语言朗读出来。可在任何平板电脑、笔记本电脑、iPhone、iPad和Apple Watch上运行。

[Synalux 平台](https://synalux.ai)的一部分。

🌐 [English](../../README.md) · [Español](README_es.md) · [Français](README_fr.md) · [Português](README_pt.md) · [Română](README_ro.md) · [Українська](README_uk.md) · [Русский](README_ru.md) · [Deutsch](README_de.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · **中文** · [العربية](README_ar.md)

<p align="center">
  <a href="https://apps.apple.com/app/id6764692277"><img src="https://img.shields.io/badge/App_Store-Download-0D96F6?style=for-the-badge&logo=apple&logoColor=white" alt="App Store"></a>
  <a href="https://synalux.ai/prism-aac"><img src="https://img.shields.io/badge/Try_It-Free-43e97b?style=for-the-badge" alt="免费试用"></a>
  <a href="https://synalux.ai/pricing"><img src="https://img.shields.io/badge/Plans-Free_+_Paid-764ba2?style=for-the-badge" alt="定价"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue?style=for-the-badge" alt="AGPL-3.0"></a>
  <a href="PRIVACY.md"><img src="https://img.shields.io/badge/Privacy-Policy-lightgrey?style=for-the-badge" alt="隐私政策"></a>
  <a href="TERMS.md"><img src="https://img.shields.io/badge/Terms-of_Service-lightgrey?style=for-the-badge" alt="服务条款"></a>
</p>

![Prism AAC 主屏幕 — 工具栏、日程横幅、输入栏、预测磁贴和QWERTY键盘](../../docs/screenshots/app-hero.png)

### 原生应用

<p align="center">
  <img src="../../docs/screenshots/ios-iphone.png" alt="iPhone 上的 PrismAAC" width="220" />
  <img src="../../docs/screenshots/ios-ipad.png" alt="iPad 上的 PrismAAC" width="360" />
  <img src="../../docs/screenshots/watch-ultra.png" alt="Apple Watch Ultra 上的 PrismAAC" width="120" />
</p>

| 平台 | 状态 | 设备端 AI | 备注 |
|----------|--------|-------------|-------|
| **网页版** (PWA) | 已上线 | 自动下载最佳本地模型 | 任何浏览器，可安装 |
| **iPad Pro 16GB** | 已上线 | 设备端 AI (14B) | 快速、私密、根据内存自动选择 |
| **iPhone / iPad 8GB** | 已上线 | 设备端 AI (8B → 1.7B 备用) | 自动缩小以适应设备 |
| **iPhone / iPad <8GB** | 已上线 | 设备端 AI (1.7B) | 始终适用，1.1 GB |
| **Apple Watch** | 已上线 | 离线短语词典 (1,261 × 20 种语言) | 独立运行 — 象形图、TTS、紧急情况 |
| **Chrome 扩展程序** | 已上线 | — | 任何文本字段中的阅读助手 |
| **WiFi 连接 Mac** | 已上线 | 通过 Ollama 实现 14B/32B | 设置 → 本地 AI → 输入 Mac IP |

---

## App Store 预览视频

30秒视频，展示所有主要功能，并配有 Inworld TTS 旁白：

https://github.com/dcostenco/synalux-docs/releases/download/v1.0-module-videos/prism_aac_preview_v5.mp4

| 场景 | 功能 | 截图 |
|---|---|---|
| **主页** — 轻触短语 | 包含22个类别的象形图板，朗读按钮 | <img src="../../docs/screenshots/appstore/ipad_home.png" width="200"> |
| **类别** | 用于求助、食物、地点、感受的快速短语 | <img src="../../docs/screenshots/appstore/ipad_categories.png" width="200"> |
| **AI 聊天** | 撰写消息，练习对话 | <img src="../../docs/screenshots/appstore/ipad_ai-chat.png" width="200"> |
| **紧急警报** | 一键呼叫看护人/护士 | <img src="../../docs/screenshots/appstore/video/frame_03.png" width="200"> |
| **日程** | 可视化日常作息 — 早上、上学、午餐、睡前 | <img src="../../docs/screenshots/appstore/ipad_schedule.png" width="200"> |
| **游戏** | 泡泡消除、颜色搜寻、配对、是/否、完成它 | <img src="../../docs/screenshots/appstore/ipad_games.png" width="200"> |
| **数学与学习** | 带有提示、检查、解决功能的自适应数学 + 数字键盘 | <img src="../../docs/screenshots/appstore/video/frame_06.png" width="200"> |
| **头部与眼动追踪** | 基于摄像头的停留光标、凝视控制、校准 | <img src="../../docs/screenshots/appstore/video/frame_07.png" width="200"> |
| **12 种语言** | 英语、西班牙语、法语、俄语、日语、韩语、中文、阿拉伯语及更多 | <img src="../../docs/screenshots/appstore/video/frame_08.png" width="200"> |

---

## 一览

| 模块 | 功能 | 预览 |
|---|---|---|
| 📂 **类别** | 为非阅读者设计的 PECS 风格图片磁贴 | <img src="../../docs/screenshots/panel-categories.png" width="120"> |
| ⌨️ **打字与朗读** | 键盘 + 单词预测 + 神经网络语音 | <img src="../../docs/screenshots/app-hero.png" width="120"> |
| ✨ **AI 聊天** | 为 AAC 用户优化的设备端 + 云端助手 | <img src="../../docs/screenshots/panel-ai-chat.png" width="120"> |
| 💬 **AAC 聊天** | 来自看护人 + 联系人的传入消息 | <img src="../../docs/screenshots/panel-aac-chat.png" width="120"> |
| 🧮 **数学 + 学科** | 带有领域感知导师的单元格网格画布 | <img src="../../docs/screenshots/math-canvas-typed.png" width="120"> |
| 🗓 **日程** | 可视化“先做再做”的日常安排 | <img src="../../docs/screenshots/panel-schedule.png" width="120"> |
| 🎮 **游戏** | 12 款治疗性 AAC 游戏 | <img src="../../docs/screenshots/panel-games.png" width="120"> |
| 🏪 **市场** | 语音包、词汇包、游戏包 | <img src="../../docs/screenshots/panel-marketplace.png" width="120"> |
| 🎧 **舒适播放器** | 为住院患者设计的床边媒体播放器 | <img src="../../docs/screenshots/panel-comfort-player.png" width="120"> |
| 🛏 **床边模式** | 适用于手机支架/卧床使用的全屏 AI 聊天 | <img src="../../e2e/_screenshots/bedside-overlay-open.png" width="120"> |
| 👋 **免提** | 头部 + 手势识别 | <img src="../../docs/screenshots/panel-settings-input-modes.png" width="120"> |
| ⚙️ **设置** | 23 种语言、运动辅助功能、套餐等级 | <img src="../../docs/screenshots/panel-settings.png" width="120"> |

---

## 免费的 Read & Write 替代方案

PrismAAC 提供了大多数 AAC 用户购买 Read & Write 所需的所有阅读辅助功能——免费，在浏览器中，网页版无需账户。请参阅[打字与朗读](#%EF%B8%8F-type--speak)以了解句子末尾朗读 + 单词高亮，[PDF 阅读器](#-pdf-reader)和[截图阅读器 (OCR)](#-screenshot-reader-ocr)以了解文档功能，以及[Chrome 扩展程序](#-chrome-extension--same-reading-assistant-features-in-any-text-field)以在 Gmail / Docs / Word Online / 其他任何地方实现跨应用覆盖。

## PrismAAC 对比

| | PrismAAC | TouchChat | Proloquo2Go | LAMP Words | TD Snap | CoughDrop | Snap Core First | Grid 3 | Tobii Dynavox |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **设备端 + HIPAA 安全**语音路径 | ✅ | ❌ | ❌ | ❌ | 部分 | 部分 | ❌ | ❌ | 部分 |
| **按用户短语排名** (适应每个孩子) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 看护人纠正**自动成为训练数据** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **领域感知 AI 导师** (数学 + 10 门其他学科) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **单元格网格数学画布** (无 LaTeX，无白板) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **区域 + 地域感知历史** (280+ 个区域) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **免提**头部 + 手势模式 | ✅ | 部分 | 部分 | ❌ | ✅ | 部分 | 部分 | ✅ | ✅ |
| **免提 AI 聊天** (语音循环 + 唤醒词 + 床边覆盖) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 内置治疗性 **AAC 游戏** | ✅ (12) | ❌ | ❌ | ❌ | ❌ | 部分 | 部分 | ❌ | ❌ |
| **开源** (AGPL-3.0) | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| 用于生命安全访问的**免费套餐** | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| 语音包**市场** | ✅ | ❌ | 部分 | ❌ | 部分 | ❌ | ❌ | 部分 | 部分 |
| **多语言** (23) | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **看护人笔记**，可在家庭/学校/诊所之间共享 | ✅ | ❌ | ❌ | ❌ | 部分 | 部分 | 部分 | ❌ | 部分 |
| **Apple Watch** 独立模式 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Chrome 扩展程序**阅读助手 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

> 此比较反映了截至 2026 年 5 月公开可用的产品信息。PrismAAC 正在积极开发中；竞争对手可能会随着时间推移添加功能。欢迎提交 PR 以保持此信息的真实性 — 请参阅 `CONTRIBUTING.md`。
>
> Grid 3 和 Tobii Dynavox 具有强大的眼动追踪 + 开关扫描硬件集成，此处未反映（依赖于硬件，需要专业诊所设置）。

---

## iOS 和 Apple Watch

### iPhone / iPad

原生 Swift 应用，通过 WKWebView 封装网页 UI + 通过 llama.cpp Metal 实现设备端 AI。根据设备内存自动选择最佳模型：

| 设备 | 内存 | 模型 | 下载 |
|---|---|---|---|
| iPad Pro M1/M2/M4 | 16 GB | 14B Q4_K_M | 从 HF CDN 下载 8.4 GB |
| iPhone 15/16 Pro, iPad Air | 8 GB | 8B Q4_K_M → 1.7B (内存不足备用) | 4.7 GB / 1.1 GB |
| iPhone 12-14，旧款 iPad | <8 GB | 1.7B Q4_K_M | 1.1 GB |

三层安全：同步危机过滤器 → 设备端 AI → 云端备用。内存感知门控优雅降级：完整 AI → 云端 AI → 仅核心功能 → 紧急模式。

- 灵动岛/刘海屏安全区域内嵌
- 用于 Apple Watch 紧急调度的 WCSession 桥接
- 基于钥匙串的认证令牌
- 内存不足备用：如果较大模型不适用，则自动加载下一个较小模型

**设置 → 🤖 本地 AI 模型** — 下载和管理 Prism 模型：
- 自动检测 `localhost:11434` 上的 Ollama
- WiFi 连接：iPad/iPhone → Mac Ollama (14B/32B 全精度)
- 每个模型都有实时进度条下载
- 模型：`:1b7` (1.1 GB) · `:8b` (4.7 GB) · `:14b` (8.4 GB) · `:32b` (16 GB)

### Apple Watch (独立运行)

无需 iPhone 即可运行 — 独立运行，带有离线短语词典。

<p align="center">
  <img src="../../docs/screenshots/watch-series.png" alt="Watch Series 11" width="140" />
  <img src="../../docs/screenshots/watch-ultra.png" alt="Watch Ultra 3" width="140" />
</p>

- **离线翻译：** 捆绑了 1,261 个短语 × 20 种语言 (411 KB JSON) — 即时查找，100% 准确，无需网络
- 带有 ARASAAC 图片的两列象形图网格
- 带有听写 + 键盘输入的 AI 聊天（在线时使用云端，离线时使用短语词典）
- 紧急系统：倒计时 → WCSession → 蜂窝网络备用 → TTS
- 带有 TTS 输出的翻译（优先离线词典，云端备用）
- 收件箱：接收并回复看护人的消息
- 紧急调度时的证书锁定 (SPKI SHA-256)
- 所有 AI 路径上的 NFKC + 23 令牌注入清理

---

## 模块

### 📂 类别
PECS 风格的图片磁贴。轻触一个类别，轻触一个磁贴，听到单词，看着它出现在消息栏中。适用于非阅读者、学前阅读者和新兴沟通者。磁贴集和排序会随着时间通过扩散激活进行个性化 — 您的孩子最常轻触的磁贴会上升；数月未使用的磁贴会淡出。

**环绕布局** — 类别显示在键盘旁边的可滚动左侧列中，因此 AAC 用户可以同时轻触图片磁贴和打字，无需切换模式。预测栏保持可见；两种输入始终可访问。

![环绕模式下的类别 — 左侧是可滚动的类别卡片，右侧是完整键盘](../../docs/screenshots/categories-surround-v2.png)

<details>
<summary><strong>功能 + 技术细节</strong></summary>

- 22 个默认类别：人物、食物、感受、身体、衣服、动物、地点等。
- 看护人可以为每个孩子添加/删除/重新排序磁贴
- 每个磁贴都带有一个用于 i18n 的 `textKey` — 切换应用语言可一键重新标记所有磁贴
- 磁贴象形图来自 ARASAAC + 精选集；语音克隆允许您将磁贴的语音与孩子的兄弟姐妹或父母匹配（付费套餐）
- 按用户 n-gram 学习：一个孩子轻触“我想吃”三次后，在下一次会话中，“吃”会在“想”之后上升
- HRR 全息记忆：通过 Rust WASM 在约 0.2 毫秒内实现零搜索上下文预测 — 核心 AAC 短语的 Top-1 准确率提高 27%

**渲染路径：** `components/CategoryPanel.tsx` → `useCategoryStore` → 从 `constants/phrases.ts` (系统) + Supabase 按用户覆盖 (付费) 绘制磁贴。磁贴轻触调用 `messageStore.appendText(phrase)` 并通过 `aacSpeak()` 路由进行 TTS。
</details>

---

### ⌨️ 打字与朗读
屏幕键盘，具有**单词预测**、**AI 自动完成**和一键**朗读**按钮，以自然的神经网络语音朗读消息栏。打字会训练预测引擎：您的孩子最常输入的单词会在下一次会话中更早出现。

![Prism AAC 键盘，输入“hello”，带有预测磁贴和朗读按钮](../../docs/screenshots/keyboard-typing.png)

**阅读辅助功能 (与 Read & Write 功能对等)** — 适用于有阅读/记忆/认知需求的用户：

- **逐字朗读** — 每当您轻触空格键时，每个单词都会通过 TTS 回响，因此您无需等待整个句子即可听到您输入的内容。
- **在 `.?!` 处朗读句子** — 用句号、问号或感叹号结束句子时，会朗读整个句子，这样您就不会忘记自己写了什么（这是导致 NVDA 不适用于有认知障碍的视力正常用户的原因）。通过“设置 → `speakOnSentenceEnd`”切换（默认为开启）。
- **朗读时逐字高亮** — 每个朗读的单词都会在 TTS 朗读时以黄色背景亮起。有阅读障碍的视力正常用户可以视觉跟踪；高亮会跟踪音频，无需特殊硬件设备。

<details>
<summary><strong>功能 + 技术细节</strong></summary>

- QWERTY 键盘上方有 5 个预测槽位，每次按键都会刷新
- 通过 Synalux `text/correct` 进行 AI 补全（“hw”→“how”，“togoso”→“to go so”）（Gemini 2.5 Flash-Lite，平均约 752 毫秒，比 2.5 Flash 便宜 4.3 倍）
- 跨语言门控：即使同时加载了两种语料库，罗马尼亚语的 `eu` 也不会泄露到英语栏中（跨语料库频率比较）
- “朗读”会进行自动语调适应（根据标点符号推断陈述句/疑问句/感叹句）
- 语音层级 1：Inworld TTS-2（自然/神经网络，所有 23 种应用语言）；层级 2：OS Web Speech（离线，设备原生）；层级 3：WASM espeak-ng（最后备用）
- 单词高亮是持续时间估算的（约 60 毫秒/字符 @ 速率=0.5，随速率滑块缩放）— 适用于所有 TTS 层级，无需后端更改；通过 Azure `wordBoundary` 进行精确同步是未来的专业版功能。
- 每种语言 1.5MB SQLite n-gram 语料库；单字组 + 双字组 + 三字组；在语言切换时延迟加载
- **HRR 上下文记忆** — 零搜索全息检索 (229KB Rust WASM)，从每个朗读的短语中学习。将双字组 + 三字组编码为全息向量；在每次按键时以约 0.2 毫秒进行探测。附加层 — 通过上下文匹配提升前 2 个预测磁贴，而不删除语料库预测。

**HRR 预测基准** (54 个单元测试 + 10 个场景精度套件)：

| 场景 | 基线 Top-1 | HRR+ Top-1 | 提升 | 基线 MRR | HRR+ MRR | MRR 提升 |
|----------|---------------|------------|------|-------------|---------|----------|
| 核心 AAC 短语 (1x) | 36.7% | 46.7% | **+27.3%** | 0.634 | 0.672 | +6.0% |
| 核心 AAC 短语 (每天 5x) | 36.7% | 46.7% | **+27.3%** | 0.634 | 0.672 | +6.0% |
| 个人词汇 | 70.4% | 81.5% | **+15.8%** | 0.809 | 0.883 | +9.2% |
| 混合 (所有短语) | 47.2% | 56.9% | **+20.6%** | 0.669 | 0.707 | +5.7% |
| 跨会话召回 | 80.0% | 80.0% | +0.0% | 0.900 | 0.900 | +0.0% |
| 模糊前缀 | 66.7% | 66.7% | +0.0% | 0.738 | 0.738 | +0.0% |

Top-1 = 正确单词是磁贴 #1。Top-5 = 任何磁贴中的正确单词。MRR = 平均倒数排名（越高 = 正确单词出现越早）。HRR 在任何场景下都不会降低 Top-5 准确率 — 零回归。在个人词汇 (+9.2% MRR) 和核心 AAC 短语 (+27.3% Top-1) 上取得最大胜利。

**渲染路径：** `components/Keyboard.tsx` → `messageStore.appendChar` → `predictionStore.updatePredictions(text, lang)` → `engine/predictionEngine.ts` (新近度 × 频率 × n-gram 提升) + 可选的 `services/textCorrectService.ts` AI 覆盖 + `services/hrrContext.ts` HRR 双字组/三字组探测。高亮：`services/aacSpeak.ts` 在 `ttsHighlightBus` 上发出 `tts-highlight-start` 事件；`components/MessageBar.tsx` 订阅并传递 `activeWordIndex` 给 `ColoredText`。
</details>

---

### ✨ AI 聊天
为 AAC 用户语音优化的设备端 + 云端助手。流式响应，每行都可以轻触插入到消息栏中，以便作者身份始终归属于孩子。免费套餐通过 Gemini 2.5 Flash 运行；付费套餐通过 prism-coder 舰队路由到 Claude Sonnet 4 进行短查询。

**简洁 AI 模式** — 当 AI 聊天打开时，单词预测栏会自动隐藏（在撰写问题时预测不相关），将焦点保持在 AI 响应和提交按钮上。

**免提 AI 聊天** — 激活聊天标题中的 🔁 按钮以进入连续语音循环：每次 AI 响应后麦克风会自动打开，因此孩子无需触摸屏幕即可进行完整的对话。聊天标题下方的状态栏会确认该模式已开启。

**翻译模式** — 当应用语言和输出语言不同时（例如，输入葡萄牙语，输出英语），每次 AI 交互都会自动通过翻译路径路由，并启用流式传输，因此与单语模式相比没有速度损失。

![AI 聊天面板 — AI 模式下预测栏隐藏，下方可访问完整键盘](../../docs/screenshots/panel-ai-chat-v2.png)

<details>
<summary><strong>功能 + 技术细节</strong></summary>

- 停靠在键盘上方的内联面板 — 绝不是隐藏消息栏的模态框
- 通过 Web Speech API 进行语音输入；麦克风按钮显示实时临时转录
- 轻触任何 AI 行以将其复制到消息栏中（保留作者身份 — Valencia 等人，CHI 2023）
- **免提循环** — 🔁 标题按钮；每次 AI 响应结束后 1 秒自动重启麦克风；`aria-pressed` + 绿色背景确认状态；活动时标题下方显示状态栏
- **“Hey Prism”唤醒词** — 在床边覆盖层内可用；连续的 `SpeechRecognition` 会话检测到短语并触发麦克风；当 iOS 原生桥接拥有音频会话时不可用
- 客户端 15 秒硬超时 + 重试按钮（因此如果网络中断，面板不会卡在“思考中…”）
- 401 / 网络 / 超时 / 其他 → 友好的错误映射；从不显示原始的“会话已过期”
- 离线时本地 Ollama 备用 (`prism-coder:1b7`)；实际上，来自 `synalux.ai` 浏览器源的混合内容被阻止，因此会触发友好的错误

**渲染路径：** `components/AIChatPanel.tsx` → `services/aiService.askAI()`（或翻译模式下的 `translateAI()`）→ 来自 Synalux `/api/v1/chat` 的 SSE 流，带有 `credentials: 'include'`。CORS 允许列表 `synalux.ai` + localhost 开发源。
</details>

---

### 🛏 床边模式

> **关键辅助功能。** 床边模式之所以存在，是因为有些用户无法可靠地说话、打字或触摸屏幕。设计必须首先适用于最困难的情况：一名患者躺在 ICU 病床上，手臂放在身体两侧，插着呼吸机，无法发出任何声音 — 只能通过眼动追踪或两指之间夹持的单个硬件开关进行交流。

全屏 AI 通信覆盖层，专为无法触及屏幕或可靠说话的用户优化。每个轻触目标都超大。语音是多种输入路径之一 — 而非唯一路径。该界面完全可通过辅助技术操作：开关扫描、眼动追踪、iOS 语音控制、头部追踪或通过单个开关导航的屏幕键盘。

灵感来自 AAC 社区（r/AssistiveTechnology，2025 年 5 月）中来自医院病床、术后恢复和姑息治疗环境用户的直接反馈。

**它能在 Mac / Windows 上运行吗？** 是的。床边模式是一个渐进式网页应用功能 — 它可以在任何设备上的任何浏览器中运行。它并非仅限于 iOS。

---

#### 适用人群？

床边模式专为具有广泛运动和言语能力的用户设计。快速短语卡片（如下所述）专门为最严重的用户设计 — 那些完全无法说话且手部活动非常有限或没有手部活动的用户。

| 用户画像 | 推荐输入方法 |
|---|---|
| 能说话，手臂受限 | 语音 (🎙 麦克风按钮) + 免提循环 |
| 有发声，言语不可靠 | “Hey Prism”唤醒词 + 免提循环 |
| 无言语，能轻触屏幕 | 快速短语卡片 (单次轻触) |
| 无言语，运动受限 — 单个开关 | iOS 开关控制或 Android 开关辅助扫描快速短语卡片 |
| 无言语，无手部动作 — 眼动追踪设备 | 眼动追踪硬件（Tobii、EyeGaze Edge 等）表现为鼠标指针 — 所有卡片均可导航 |
| 无言语，能移动头部 | 头部追踪（例如 iOS 头部指针，iPhone 16 上的摄像头控制）— 卡片是全尺寸导航目标 |
| 气管切开术/插管，无发声 | 通过眼动追踪或开关 + 看护人辅助模式使用快速短语卡片 |

---

#### 平台支持

| 平台 | 床边模式 | 快速卡片 | 免提循环 🔁 | 唤醒词 🎯 |
|---|:---:|:---:|:---:|:---:|
| 网页版 — Mac / Windows / Linux (任何浏览器) | ✅ | ✅ | ✅ | ✅ |
| 网页版 — iPhone / iPad (Safari) | ✅ | ✅ | ✅ | ⚠️ 仅限 Safari |
| iOS 原生应用 (App Store) | ✅ | ✅ | ✅ | ❌ 使用免提 |
| Android (Chrome / Edge) | ✅ | ✅ | ✅ | ✅ |
| 眼动追踪设备 (任何 — 表现为鼠标) | ✅ | ✅ | ✅ | ✅ |
| 开关扫描 (iOS 开关控制) | ✅ | ✅ | ✅ | ❌ |
| Apple Watch | ❌ | ❌ | ❌ | ❌ |

> **为什么 iOS 原生应用中没有唤醒词？** 原生桥接会占用音频会话 (`prismNativeBridge.startVoice`)，这与唤醒词服务使用的浏览器 `SpeechRecognition` API 冲突。请改用**免提循环** (🔁) — 它会在每次 AI 响应后 1 秒自动重启麦克风，无需任何持续输入。

---

#### 如何开始

1.  打开 **AI 聊天** 面板 — 轻触工具栏中的 🤖 图标。
2.  轻触面板标题中的 **🛏** — 全屏覆盖层会立即打开。
3.  选择您的输入方法（请参阅以下部分）。

<p align="center">
  <img src="../../e2e/_screenshots/bedside-overlay-open.png" alt="床边模式覆盖层打开 — 黑色全屏 UI。顶部条显示快速短语卡片。中间区域显示 AI 响应。底部显示大型红色麦克风按钮和控制行。" width="260">
  <img src="../../e2e/_screenshots/bedside-overlay-handsfree-on.png" alt="免提激活的床边模式 — 🔁 按钮高亮显示为绿色，状态文本“免提开启”可见" width="260">
  <img src="../../e2e/_screenshots/bedside-hands-free-on.png" alt="免提切换按钮处于开启状态 — 绿色背景，aria-pressed=true" width="260">
</p>

#### 如何停止/退出

-   **触摸/轻触：** 轻触覆盖层右上角的 **✕**（48 × 48 像素目标）。
-   **键盘/开关：** 按下 **Escape**。
-   **语音：** 在覆盖层打开时，通过 iOS 语音控制说出任何命令。

退出时，您的完整聊天历史记录和 AI 会话状态将得到保留。覆盖层作为独立的渲染层位于主面板之上 — 关闭时不会丢失任何内容。

<p align="center">
  <img src="../../e2e/_screenshots/bedside-overlay-closed.png" alt="关闭床边模式后 — 返回到主 AI 聊天面板，对话历史记录完整" width="260">
  <img src="../../e2e/_screenshots/bedside-wakeword-statusbar.png" alt="从床边模式返回后，主面板状态栏显示“Hey Prism active”并带有蓝色指示器" width="260">
</p>

---

### 🃏 快速短语卡片 — 适用于无法说话和无法移动的用户

> **这是无法自由说话或触摸屏幕的用户的关键路径。** 快速短语卡片是预编程的通信按钮，可以通过单次轻触、眼动停留或开关扫描选择来激活。无需打字。无需语音。使用它们无需互联网。

每张卡片都显示一个大型表情符号图标和一个短语。轻触卡片会立即将该短语加载到消息栏中。如果**免提模式**开启，该短语会自动发送给 AI。

#### 内置卡片

首次使用时预加载了十五张卡片，按紧急程度分组。它们无法删除。它们可以离线工作。

**紧急 (最高优先级 — 在医疗紧急情况下首先传达这些信息)：**

| 图标 | 短语 | 何时使用 |
|:---:|---|---|
| 🆘 | 求助 — 紧急情况 | 立即危险、呼叫代码、任何需要立即工作人员的情况 |
| 😢 | 我疼痛 | 任何类型的疼痛 — 位置/严重程度可在自由文本中说明 |
| 🫁 | 我无法呼吸 | 呼吸窘迫、气道问题、恐慌发作 |
| 🔔 | 呼叫护士 | 非紧急工作人员请求 |

**生理需求：**

| 图标 | 短语 | 何时使用 |
|:---:|---|---|
| 💧 | 请给我水 | 口渴、口干、吞咽药物 |
| 🔥 | 我太热了 | 发烧、毯子、体温调节 |
| 🥶 | 我太冷了 | 发冷、毯子、室温 |
| ↔️ | 请帮我调整姿势 | 缓解压力、舒适、术后体位 |
| 💊 | 我需要我的药 | 预定剂量、按需请求、止痛药 |

**沟通：**

| 图标 | 短语 | 何时使用 |
|:---:|---|---|
| ✅ | 是 | 确认 — 回答看护人的是/否问题 |
| ❌ | 否 | 拒绝 — 回答看护人的是/否问题 |
| ⏳ | 请稍等 | 需要一点时间 — 暂时不要继续 |

**情感：**

| 图标 | 短语 | 何时使用 |
|:---:|---|---|
| ❤️ | 我爱你 | 家人、情感联系 |
| 🙏 | 谢谢你 | 感激 |
| 😨 | 我害怕 | 焦虑、恐惧、痛苦 — 触发 AI 的同理心响应 |

#### 如何使用快速短语卡片

**单次轻触 / 眼动追踪 / 开关选择：**
激活卡片会将其文本放入消息栏。然后该短语可以：
-   发送给 AI 以获得上下文响应（例如，轻触“我害怕”→ AI 会回应安慰并提出后续问题）
-   按原样朗读 — 房间里的看护人可以看到屏幕上被轻触的卡片

**开启免提模式时：**
卡片被轻触的瞬间，短语会自动发送给 AI。AI 响应后 1 秒，麦克风会重新启动 — 创建一个无需任何进一步输入的连续循环。

**“Hey Prism”唤醒词激活时（网页版/桌面版）：**
唤醒词 + 快速卡片可以结合使用：用户说“Hey Prism”打开麦克风，AI 响应，然后用户可以轻触卡片以在不同方向上继续对话，而无需再次说话。

#### 如何添加自定义卡片

看护人、BCBA 和家庭成员可以添加根据特定用户沟通需求量身定制的个性化卡片 — 他们的医生姓名、最喜欢的短语、具体的疼痛描述、宗教表达或任何其他内容。

**步骤：**

1.  在床边模式中，轻触快速短语条末尾的 **＋ 添加**。
2.  输入您希望卡片上显示的短语（最多 80 个字符）。
3.  轻触 **添加卡片** — AI 会自动生成一个与短语含义匹配的表情符号图标（例如，“给我更多毯子”→ 🛏，“我想祈祷”→ 🤲）。
4.  图标会伴随短暂的“✨ 生成中…”动画出现，然后卡片被保存。

自定义卡片本地保存在设备上 (localStorage)。它们在会话和应用重启后仍然存在。使用已保存的卡片无需账户或互联网连接 — 只有初始图标生成需要网络调用。

**可考虑添加的自定义卡片示例：**

| 建议短语 | 原因 |
|---|---|
| `[医生姓名]，请过来` | 比通用的“呼叫护士”更快地联系特定临床医生 |
| `我需要和我的家人说话` | 需要近亲的情感/法律情况 |
| `请关灯` | 感官敏感、偏头痛、睡眠 |
| `我想祈祷` | 精神关怀 — 临终关怀中的尊严 |
| `感觉不对劲` | 模糊的求救信号 — 促使 AI 提出澄清问题 |
| `我需要吸痰` | 气管切开术/呼吸机患者 |
| `我的静脉输液管疼` | 渗漏、静脉炎警报 |
| `我想回家` | 姑息治疗/出院对话 |

#### 如何删除自定义卡片

1.  轻触快速短语条标题中的 **✏️ 编辑**。
2.  每个自定义卡片上会出现一个红色的 **✕** 徽章（内置卡片受保护，无法删除）。
3.  轻触任何卡片上的 ✕ 以将其删除。
4.  轻触 **完成** 以退出编辑模式。

#### 开关扫描设置 (iOS)

对于只能激活单个外部开关（吸吹开关、头部开关、脚踏开关、枕头开关）的用户：

1.  通过蓝牙或 Lightning/USB-C 端口将开关连接到 iPhone/iPad。
2.  前往 **设置 → 辅助功能 → 开关控制 → 开关**，并将开关分配给“选择项目”。
3.  前往 **开关控制 → 扫描样式**，选择“自动扫描” — 设备将自动逐一高亮显示项目。
4.  在床边模式中打开 Prism AAC。开关控制将自动扫描快速短语卡片。当所需卡片高亮显示时，激活您的开关。
5.  短语会立即发送 — 无需第二次操作。

> 所有快速短语卡片都带有 `data-scan-group="quick-cards"`，因此辅助技术可以在移动到其他 UI 区域之前对整个条带进行分组扫描。

#### 眼动追踪设置

眼动追踪硬件（Tobii Dynavox、EyeGaze Edge、PCEye、MyTobii P10 等）在操作系统中表现为带有停留点击的标准鼠标指针。Prism AAC 中无需特殊配置：

1.  在您的眼动追踪设备软件中配置停留时间（建议：首次用户 800–1200 毫秒）。
2.  在任何浏览器中以床边模式打开 Prism AAC。
3.  停留在快速短语卡片上以激活它。

最小卡片尺寸 (88 × 80 像素) 符合 WCAG 2.5.5 AAA 目标尺寸要求 44 × 44 CSS 像素，并超过了眼动交互通常推荐的最小尺寸 (60 × 60 像素)。

---

<details>
<summary><strong>所有功能 + 技术实现细节</strong></summary>

**五个子系统作为一个功能发布：**

1.  **快速短语卡片** — `services/bedsideCards.ts` + `components/BedsideOverlay.tsx` 中的条带 UI。

    -   存储：`localStorage` 键 `prism_bedside_cards_v1`。每次加载时进行模式验证 — 格式错误的条目会被静默丢弃。
    -   上限：最多 50 张自定义卡片（防止无限制的存储增长）。
    -   内置卡片：15 个条目，`id` 前缀为 `builtin-`；删除 UI 守卫在显示 ✕ 徽章之前检查此前缀，确保默认值永远不会被删除。
    -   AI 图标生成：`services/aiService.ts → inferCardIcon(text)`。使用与应用其余部分相同的本地 Ollama → Synalux 云路由链。将短语作为用户消息发送，并带有锁定的系统提示（“只回复一个表情符号…”）。从响应中提取第一个 Unicode 码点。始终解析 — 在网络错误或非表情符号响应时回退到 💬。
    -   离线：卡片完全离线工作；只有添加新卡片才需要网络（用于图标生成 — 如果离线则回退到 💬）。

2.  **免提 AI 循环 (🔁)** — 也可从主 AI 聊天标题访问。每次 AI 响应后麦克风会自动重启（延迟 1 秒）。`handsFreeRef` / `startListeningRef` 引用模式确保效果始终调用当前回调，而不会在每次渲染时重新运行。

    ![主 AI 面板中的免提状态栏](../../e2e/_screenshots/bedside-hands-free-statusbar.png)

3.  **床边覆盖层** — `fixed inset-0 z-50 bg-black` 全屏深色 UI，作为主 AI 面板的同级 `<Fragment>` 渲染，因此面板状态在打开/关闭周期中得以保留。辅助功能：`role="dialog"`、`aria-modal="true"`、`aria-label="Bedside Mode"`、WCAG 2.1 SC 2.1.2 焦点陷阱（Tab/Shift+Tab 在覆盖层内循环，`Escape` 关闭）。视口覆盖范围经过独立 E2E 验证（≤ 4 像素容差）。

    -   **大麦克风按钮** — 112 × 112 像素 (`w-28 h-28`)，监听时红色 + 脉冲，静止时白色边框。经 Playwright `boundingBox()` 验证 ≥ 96 像素。
    -   **快速卡片条** — 水平滚动行，每张卡片 `88 × 80 像素`，`data-scan-group="quick-cards"` 用于开关扫描分组，`role="list"` / `role="listitem"` 用于屏幕阅读器语义。
    -   **控制行** — 免提（开启时绿色），“Hey Prism”唤醒词（开启时蓝色，当 `!wakeWordSupported` 时隐藏），iOS 语音控制快捷方式。
    -   **退出** — ✕ 按钮 (`w-12 h-12`) 或 `Escape` → `onClose()` → `AIChatPanel` 中的 `bedsideModeActive = false` → WCAG 2.4.3 焦点返回到打开对话框的 🛏 按钮。

    ![床边覆盖层 — 关闭，返回主 AI 面板](../../e2e/_screenshots/bedside-overlay-closed.png)

4.  **“Hey Prism”唤醒词** — `services/wakeWordService.ts`。在后台运行连续的 `SpeechRecognition` 会话。检测任何包含“hey prism”的转录，触发麦克风一次，然后重置以进行下一个循环。防护：当 iOS 原生桥接拥有麦克风时（`prismNativeBridge?.startVoice` 存在）不启动。关闭覆盖层后，唤醒词激活状态显示在主面板状态栏中。

    ![状态栏显示“Hey Prism”已激活](../../e2e/_screenshots/bedside-wakeword-statusbar.png)

5.  **iOS 语音控制指南** — 轻触控制行中的 📱 会尝试 `prismNativeBridge.openSettings('accessibility')`（在支持的原生构建上深度链接到辅助功能）。在网页版/桌面版上，它会回退到覆盖层内的说明卡片，引导用户完成“设置 → 辅助功能 → 语音控制 → 开启”。

    <p align="center">
      <img src="../../e2e/_screenshots/bedside-voice-control-card.png" alt="iOS 语音控制说明卡片 — 在网页版/桌面版上轻触 📱 时，床边覆盖层内显示的逐步指南" width="260">
      <img src="../../e2e/_screenshots/bedside-voice-control-dismissed.png" alt="iOS 语音控制说明卡片关闭后 — 覆盖层返回正常床边布局" width="260">
    </p>

**测试覆盖率：**
-   `services/bedsideCards.test.ts` — 22 个单元测试：默认卡片集、localStorage 往返、格式错误的 JSON 回退、无效卡片过滤、50 张卡片上限、`createCard` 字段约束。
-   `e2e/bedside-mode.spec.ts` — 17 个 Playwright E2E 测试：按钮可见性、`aria-pressed` 切换、绿色/蓝色状态类、状态栏文本、覆盖层辅助功能属性、麦克风 `boundingBox` 大小、视口覆盖、说明卡片显示/关闭。

**关键文件：**
-   `components/AIChatPanel.tsx` — 床边状态、卡片状态 (`bedsideCards`)、`handleAddBedsideCard`、`handleDeleteBedsideCard`、免提循环、唤醒词生命周期、标题按钮
-   `components/BedsideOverlay.tsx` — 覆盖层 UI、快速卡片条、添加卡片对话框、编辑模式、焦点陷阱、语音控制说明卡片
-   `services/bedsideCards.ts` — `BedsideCard` 类型、`DEFAULT_BEDSIDE_CARDS`、`loadCards`、`saveCards`、`createCard`
-   `services/aiService.ts` → `inferCardIcon(text)` — AI 表情符号推断
-   `services/wakeWordService.ts` — 连续唤醒短语检测
</details>

---

### 📨 发送消息 — 提供商选择器
当一个联系人配置了多个提供商（例如，邮件和短信）时，撰写区域上方会出现一个 **“通过…发送”** 部分。一键切换提供商即可撰写 — 无需离开面板。

![联系人提供商选择器 — “通过…发送”行，邮件高亮显示为绿色，短信可用](../../docs/screenshots/contact-provider-picker.png)

---

### 💬 AAC 聊天
来自已连接提供商（Telegram、WhatsApp、电子邮件、Slack 等）的传入消息会显示在此面板中。工具栏上的未读徽章显示数量，当新消息到达时会触发警报 + 跨标签页通知，轻触消息行会将其复制到消息栏中，以便孩子可以用自己的声音撰写回复。

![AAC 聊天面板显示带有未读徽章的传入看护人消息](../../docs/screenshots/panel-aac-chat.png)

<details>
<summary><strong>功能 + 技术细节</strong></summary>

- 通过 Synalux 门户 `/api/v1/prism-aac/inbox/poll` 轮询收件箱（如果门户未配置，则 404 时无操作）
- 新消息的跨标签页 `BroadcastChannel` 通知
- 提供商抽象：添加 Outlook / Slack / Discord = 每个约 30 行代码（请参阅 `synalux-private/scripts/fetch-messages.mjs`）
- 已读状态同步回传，以便看护人看到孩子何时已读消息
- 免费套餐：1 个连接提供商；付费套餐：无限制
- 每条消息的 TTS，以便孩子可以用他们喜欢的语音听到传入文本

**渲染路径：** `components/AACChatPanel.tsx` → `services/inboxPolling.ts`（当 sidePanel === 'aac-chat' 时 5 秒轮询，否则 60 秒）→ `useScheduleStore.setIncomingMessages()`。每条消息也会附加到日程的“来自看护人的消息”轨道。
</details>

---

### 🧮 学校科目
单元格网格画布，托管 **19 个学科键盘**，涵盖完整高中课程：数学 + 科学 + 编程 + 艺术 + 人文。每个标签页通过领域特定的提示模板（总共 33 个模板）将 AI 导师路由，因此模型不会将代数推理应用于 Punnett 方格，也不会将音乐动态误认为是编程字面量。**历史记录具有区域 + 地域感知能力**，精确到州/省/联邦州/自治区级别 — 涵盖 23 个国家的 280 多个区域。

![单元格网格画布，单元格中输入 5 + 7 = 12](../../docs/screenshots/math-canvas-typed.png)

<details>
<summary><strong>学科标签页 (共 19 个)</strong></summary>

**数学 (9 个键盘)** — 主键盘、高级数学 (π √ 指数 + 5 个装饰工具：分数框、长除法框、根号条、求和线、分数线)、a–z、杂项数学 (集合论 + 逻辑)、时间与距离、重量、体积、几何、金钱。

**科学 (4 个)** — 化学 (24 种元素 + 反应箭头 + 电荷 + 下标 + 相位标记)、物理 (完整希腊字母 + 16 个 SI 单位 + ∫/∂/∇/∑/∏ + 常数)、生物 (DNA/RNA + 遗传学 + 8 个分类等级 + 12 个细胞器)、统计学 (μ σ x̄ + 12 个运算 + 分布)。

**编程 (2 个)** — Python (24 个运算符 + 26 个关键字) 和 Java (24 个运算符 + 26 个关键字)。代码每个单元格提交一个字符，因此它在等宽网格上自然布局。

**艺术 + 人文 (4 个)** — 音乐 (3 个谱号 + 6 个音符 + 5 个休止符 + 5 个变音记号 + 8 个力度记号)、地球科学 (天气 + 板块 + 10 颗行星 + AU/ly/pc/Mya/Gya)、历史 (区域 + 地域感知)、语言艺术 (12 个词性标签 + 6 种句子类型 + 标点符号 + 引用样式)。

</details>

<details>
<summary><strong>AI 导师 — 11 个领域 × 3 种模式 = 33 个提示</strong></summary>

![AI 导师覆盖层，画布上方有模拟提示](../../docs/screenshots/math-tutor-hint.png)

每个学科有三种模式：💡 **提示**（温和的下一步提示，从不直接解决）、✓ **检查**（验证孩子的答案，如果正确则庆祝）、🎓 **解决**（完整的逐步演练，最多 4 步）。活动标签页告诉导师孩子正在学习哪个学科。15 秒硬超时 + 重试按钮，因此覆盖层永远不会卡住。
</details>

<details>
<summary><strong>历史 — 区域 + 地域感知</strong></summary>

![en 区域设置（无地域）下的历史键盘 — 通用 + 国家级别](../../docs/screenshots/math-keyboard-history-en.png)
![带有 US-TX 地域的历史键盘 — 阿拉莫、德克萨斯吞并、JFK 出现](../../docs/screenshots/math-keyboard-history-us-tx.png)

三层堆叠：
1.  **通用**事件，在每个课程中教授 (476, 1914 第一次世界大战, 1939 第二次世界大战, 1969 登月)
2.  **国家**事件，由 `language` 选择 (en, es, fr, de, ro, ru, uk, ja, ko, zh, ar, it, pl, nl, he, hi, vi, tr, pt) — 支持 19 种语言
3.  **次国家**事件，由 `historyRegion` 选择 (US-TX, CA-QC, UK-SCT, ES-CT, IN-MH, DE-BY, …) — **涵盖 23 个国家的 280 多个区域**，包括所有 50 个美国州 + 哥伦比亚特区、13 个加拿大省/地区、所有 4 个英国国家、爱尔兰（共和国 + 4 个历史省份）、所有 16 个德国联邦州、所有 17 个西班牙自治区、所有 20 个意大利大区，以及澳大利亚、法国、墨西哥、巴西、印度、中国、俄罗斯、比利时、瑞士、荷兰、阿根廷、南非、韩国、巴基斯坦、新西兰、波兰。

导师提示带有区域设置 + 地域，因此像 `US-TX` 中 1836 年这样模糊的日期会解析为阿拉莫（而不是阿拉巴马州建州）；`CA-QC` 中 1759 年会锚定到亚伯拉罕平原；`ES-CT` 中 1714 年会锚定到巴塞罗那陷落。

</details>

<details>
<summary><strong>测试工作流 — 12 个学科 × 8-12 年级应用题 × 72 个 Playwright 测试</strong></summary>

逐步问题表，练习每个学科键盘，加上每个问题的可执行 Playwright 测试，驱动实时数学面板并验证每个步骤的字形是否落在单元格网格中。直接模仿真实的 9 年级代数参考页。

-   **第 1 层 — 通用逐步：** [`tests/workflows/`](tests/workflows/) — 12 个 Markdown 文件（高级数学、生物、化学、地球科学、几何、历史、语言艺术、杂项数学、物理、Java 编程、Python 编程、统计学）。
-   **第 2 层 — 年级分级的真实课堂：** [`tests/workflows/grade-8-12/`](tests/workflows/grade-8-12/) — 12 个 Markdown 文件，包含命名变量应用题（代数-9 年级、几何-10 年级、物理-11 年级、化学-10 年级、生物-9 年级、统计学-11 年级、Python 编程-9 年级、Java 编程-11 年级、预备微积分-12 年级、地球科学-9 年级、语言艺术-8 年级、世界历史-10 年级）+ 每学科键盘间隙 [`REPORT.md`](tests/workflows/grade-8-12/REPORT.md)。
-   **第 3 层 — Playwright 端到端：** [`e2e/math-workflows/`](e2e/math-workflows/) — 72 个测试 (`npx playwright test --project=desktop e2e/math-workflows`)。

完整索引、排名靠前的支持不足学科以及“如何添加新工作流”运行手册 → **[`docs/WORKFLOWS.md`](docs/WORKFLOWS.md)**。

</details>

<details>
<summary><strong>其他数学功能（锁定工具、两次点击放大、保存/同步）</strong></summary>

-   **锁定工具** — 孩子完成问题后，锁定该区域。锁定的单元格会略微变暗并拒绝编辑。
-   **两次点击放大** — 第一次点击任何数学键会激活它（1.4 倍缩放 + 绿色光晕，不提交），第二次点击提交。2 秒自动解除。适用于运动不精确的用户。
-   **保存 + 同步** — 优先本地保存到 `localStorage`；通过 `↻ 同步` 按钮尽力同步到 Synalux 门户。上限 100 份文档 / 200 KB 正文；最旧的会被逐出。
-   **按住停留** — 可配置的每个按键停留时间 (0–1500 毫秒)，带有绿色进度环。

![已保存文档覆盖层，显示一个条目和同步按钮](../../docs/screenshots/math-docs-overlay.png)
![一个数字键处于绿色光晕放大状态](../../docs/screenshots/math-two-hit-armed.png)
![锁定工具已激活，提示用户轻触区域的一个角落](../../docs/screenshots/math-lock-armed.png)

</details>

<details>
<summary><strong>学科键盘 — 附加图片</strong></summary>

![带有 H₂O 的化学键盘](../../docs/screenshots/math-keyboard-chemistry.png)
![带有 A T G 的生物键盘](../../docs/screenshots/math-keyboard-biology.png)
![带有 `private String` 的 Java 键盘](../../docs/screenshots/math-keyboard-java.png)
![音乐键盘](../../docs/screenshots/math-keyboard-music.png)
![统计学键盘](../../docs/screenshots/math-keyboard-statistics.png)
![地球科学键盘](../../docs/screenshots/math-keyboard-earth-science.png)
![语言艺术键盘](../../docs/screenshots/math-keyboard-language-arts.png)
![罗马尼亚语区域设置的历史](../../docs/screenshots/math-keyboard-history-ro.png)

</details>

---

### 🗓 日程
可视化“先做再做”的日程安排，用于支持日常活动和过渡。每个步骤都是一个图片磁贴 + 标签；完成一个磁贴会发出提示音 + 一个视觉进度标记。奖励商店（付费套餐）会在例行活动结束时解锁。

![日程面板，带有“先做再做”板 + 活动列表](../../docs/screenshots/panel-schedule.png)

<details>
<summary><strong>功能 + 技术细节</strong></summary>

- 24 个磁贴预设网格，用于一键添加活动：起床、刷牙、早餐、上学、零食、午餐、玩耍、阅读、艺术、散步、晚餐、洗澡、睡前故事、睡觉、服药、使用牙线、整理、洗衣、宠物护理、运动，…
- 拖放重新排序；铅笔图标内联编辑；预设添加带有 `textKey`，因此语言切换会重新标记
- “先做再做”状态机：激活磁贴脉冲、计时器到期时 3 音符上升提示音、运动安全（`prefers-reduced-motion` → 静态环）、`aria-pressed` 语义
- 音频预热：近乎无声的 1Hz 振荡器使 iOS Safari 上的 AudioContext 保持“运行”，因此计时器提示音在长时间静音后实际播放（没有预热，提示音会触发到暂停的上下文 = 没有声音）
- 看护人消息作为“消息”轨道附加到日程中，以便孩子看到即将发生的事情 + 谁发了消息

**渲染路径：** `components/SchedulePanel.tsx` → `useScheduleStore`（24 个预设活动 + 自定义）→ `services/feedback.ts:playTimerRing()` → 通过 `services/azureTTS.ts:warmupAzureAudio()` 共享 AudioContext。
</details>

---

### 🎮 游戏
12 款基于证据的 AAC 游戏。旨在教授沟通，**而非用于屏幕时间**。每款游戏都会记录发声 + 准确性，以便自适应引擎可以建议下一个最适合的游戏。

![游戏面板，带有 9 个游戏磁贴](../../docs/screenshots/panel-games.png)

<details>
<summary><strong>12 款游戏 + 技术细节</strong></summary>

| 游戏 | 目标技能 |
|---|---|
| 泡泡消除 | 因果关系，有意沟通 |
| 颜色搜寻 | 接受性词汇（颜色名称） |
| 我的故事 | 叙事排序 |
| 配对 | 配对 + 分类思维 |
| 是/否 | 二元辨别，请求/拒绝 |
| 完成它 | 句子补全（完形填空） |
| 类别排序 | 语义分类 |
| 情感配对 | 情感标记，心智理论 |
| 接下来是什么 | 顺序推理 |
| 相同/不同 | 视觉辨别 — 匹配或对比 |
| 我听到了 (声音配对) | 听觉辨别 + 词汇 |
| 轮流 | 社交轮流练习 |

- 免费套餐：泡泡消除、颜色搜寻、我的故事（3 款游戏）
- 付费套餐：全部 12 款
- 每款游戏的数据馈送 `services/adaptiveEngine.ts` — 发声长度/类别/一天中的时间/结果 → 建议下一个游戏
- 所有游戏都会禁用与该游戏词汇不相关的 AAC 磁贴类别，因此孩子不会分心

**渲染路径：** `components/GamesPanel.tsx` → `components/games/` 中的各个游戏组件。每个游戏通过 `useScheduleStore.recordMessage(text, category)` 进行记录。
</details>

---

### 🏪 市场
语音包 (Inworld 语音、兄弟姐妹/父母的自定义克隆语音)、词汇包 (西班牙语核心词汇、手语辅助语音)、游戏包 (9 款游戏之外的额外游戏)。应用通过与内置面板相同的注册表安装到工具栏中。

![带有可安装应用的市集面板](../../docs/screenshots/panel-marketplace.png)

<details>
<summary><strong>功能 + 技术细节</strong></summary>

- 应用以 JSON 条目 (`lib/marketplace/manifests/local.ts`) + 运行时 `lib/marketplace/registry.ts` 的形式存在，其中 `getHandler(appId)` 返回面板组件
- 语音克隆（付费套餐）：90 秒录音 → 训练后的语音可用于应用中的任何 TTS，包括类别磁贴
- 已安装的应用在内置应用之后渲染为工具栏按钮；`useSettingsStore.installedApps` 是事实来源
- 按套餐等级限制：市场列出所有内容，但对于超出用户套餐的项目，安装按钮会禁用

**渲染路径：** `components/MarketplacePanel.tsx` → `useMarketplaceStore` → 后端 `synalux/api/v1/marketplace/...` 用于购买，然后将资产下载（语音文件、词汇 JSON）到 IndexedDB。
</details>

---

### 📄 PDF 阅读器
打开 PDF，每页显示一个磁贴，轻触即可用您的声音朗读。学校作业、带回家信件、文章 — 导入任何 PDF 并聆听，而不是尝试阅读。无需 Adobe Reader；整个库都在您的浏览器中运行。

![PDF 阅读器面板 — 空状态，带有“+ 打开 PDF”提示](../../docs/screenshots/panel-pdf-reader.png)

<details>
<summary><strong>功能 + 技术细节</strong></summary>

- 每页一个磁贴；每个磁贴显示前 3 行 + 一个 `▶ 第 N 页` 按钮，通过 `aacSpeak()` 管道（与所有其他内容相同的语音 + 语调 + 单词高亮）
- `▶ 全部朗读` 将所有页面连接成一个连续的发声
- 空页检测（扫描图像 PDF）建议使用 OCR 工具
- 首次打开时动态导入 `pdfjs-dist` — 从 CDN 分离出约 3 MB 的块，版本固定到 npm 包
- 工具栏按钮 (📄) 可通过“设置 → 工具栏”选择启用，以保持最小默认工具栏的整洁

**渲染路径：** `components/PdfReaderPanel.tsx` → `services/pdfReader.ts` (pdfjs `getDocument` → 每页 `getTextContent`) → `services/aacSpeak.ts`。
</details>

---

### 👁 截图阅读器 (OCR)
粘贴或上传工作表照片、网页截图、教科书页面图片 — 识别出的文本会显示在图片旁边，您可以轻触 **▶ 朗读** 来听取，或 **↧ 发送到消息栏** 在朗读前进行编辑。

![截图阅读器 (OCR) 面板 — 空状态，带有“+ 打开图片”提示](../../docs/screenshots/panel-ocr-capture.png)

<details>
<summary><strong>功能 + 技术细节</strong></summary>

- 20 种语言的 OCR 矩阵，从 PrismAAC 区域设置映射到 Tesseract 代码（eng / spa / fra / por / deu / ron / ukr / rus / jpn / kor / chi_sim / ara / ita / pol / nld / heb / hin / vie / tur / ind）
- 每种语言的训练数据文件在首次使用后缓存（英语约 10 MB，CJK 更多）— 首次运行时显示“正在读取图像…（首次运行会下载 OCR 模型 — 可能需要 10-30 秒）”
- 显示置信度百分比，以便 AAC 用户判断是否信任结果或重新拍摄
- `disposeOcr()` 清理钩子在页面卸载时终止每个生成的 worker 以释放 WASM 内存
- 工具栏按钮 (👁) 可通过“设置 → 工具栏”选择启用

**渲染路径：** `components/OcrCapturePanel.tsx` → `services/ocr.ts` (`tesseract.js` `createWorker` → `recognize`) → `services/aacSpeak.ts` 或 `messageStore.setText`。
</details>

---

### 🎧 舒适播放器

为住院患者设计的床边媒体播放器 — 昏迷、ICU、无法说话或任何需要在床边持续获得舒适内容的人。

<details>
<summary>功能详情</summary>

家人和朋友录制语音消息，上传照片和视频。播放列表持续循环，因此患者身边总有熟悉的声音和面孔。

-   直接在应用中**录制**语音消息 (MediaRecorder API)
-   **上传**音频文件、照片和视频片段（每个文件 100 MB，总计 500 MB）
-   持续**自动循环**所有项目 — 设置好即可离开
-   照片和视频的**全屏**模式（床边显示）
-   **原生 TTS** 集成 — 轻触的短语通过 iOS 上的 AVSpeechSynthesizer 朗读
-   **离线** — 所有媒体存储在 IndexedDB 中，无需互联网即可工作
-   **键盘可访问** — 每个控件都有 ARIA 标签和键盘导航
-   **军事级审查** — 修复了 27 个安全问题（blob URL 泄露、配额处理、输入验证、MIME 允许列表、卸载清理）
-   工具栏按钮 (🎧) 可通过“设置 → 工具栏”选择启用

**存储限制：** 最多 50 个项目，每个文件 100 MB，总计 500 MB。MIME 类型限制为音频 (webm/mp4/mpeg/ogg/wav)、图像 (jpeg/png/gif/webp/heic) 和视频 (mp4/webm/quicktime)。

**渲染路径：** `components/ComfortPlayerPanel.tsx` → `store/comfortPlayerStore.ts` (Zustand + 持久化) → `services/comfortMediaStorage.ts` (IndexedDB blobs)。
</details>

---

### 🧩 Chrome 扩展程序 — 任何文本字段中相同的阅读辅助功能
PrismAAC 网页应用在其自身界面内涵盖了阅读辅助流程。Chrome 扩展程序 (`chrome-extension/`) 将**相同的行为带到任何网站上的任何文本字段** — Gmail、Google Docs、Word Online、学校门户、银行表格 — 弥补了仅凭网页无法实现的 Read & Write 唯一差距。

![PrismAAC 阅读助手 — 在任何文本字段中，边打字边朗读，并逐字高亮](../../docs/screenshots/extension-marquee.png)

浮动覆盖层会附加到任何聚焦的文本字段上方。轻触 **▶ 朗读** 以重新阅读，或者继续打字 — 用 `.?!` 结束句子时，它会自动朗读回来，每个单词在朗读时都会以黄色亮起：

![PrismAAC 覆盖层位于撰写页面上方，句子中间的“school”在 TTS 朗读时以黄色高亮显示](../../docs/screenshots/extension-overlay.png)

边说边翻译会同时显示源语言行（小斜体）和翻译后的行（全尺寸，并在朗读时高亮显示活动单词）。通过 Google 的免费公共 API 端点支持 50 多种语言（无需 API 密钥）：

![PrismAAC 覆盖层将英语翻译成罗马尼亚语 — 源语言行“I had a really good day at school today”，下方是翻译后的“Am avut o zi foarte bună la școală astăzi”，其中“foarte”高亮显示](../../docs/screenshots/extension-translate.png)

选项页面 — 通过 `chrome.storage.sync` 在用户的 Chrome 配置文件之间同步设置。按站点禁用列表、语音选择器、语速/音量/音高滑块、语言选择器，所有这些都是可选的：

![PrismAAC 扩展程序选项页面 — 朗读触发器、目标语言罗马尼亚语、语音选择器、语速/音量/音高滑块](../../docs/screenshots/extension-options.png)

**安装（目前为开发者模式 — Chrome 网上应用店列表待审核）：**

```sh
cd chrome-extension
npm install
npm run build
```

打开 `chrome://extensions`，启用**开发者模式**，点击**加载已解压的扩展程序**，然后选择 `chrome-extension/dist`。

**功能：**

-   在 `.?!` 处朗读句子，在空格处朗读每个单词，所有这些都可切换
-   **逐字高亮** 由浏览器原生的 `SpeechSynthesisUtterance.boundary` 事件提供支持（真正的逐字同步，而非网页应用约 60 毫秒/字符的启发式方法 — 门户路由返回不带流事件的 MP3，但 Web Speech 原生暴露了这些事件）
-   **边说边翻译** — 选择目标语言（通过 Google 的免费公共 API 端点支持 50 多种语言，无需 API 密钥）。覆盖层同时显示源语言行（小斜体）和翻译后的行（带有活动单词高亮）；会自动选择与目标语言匹配的 Web Speech 语音
-   锚定在聚焦字段上方的浮动 Shadow-DOM 覆盖层（▶ 朗读、📌 固定、× 关闭）
-   按 `Cmd / Ctrl + Shift + S` 可按需朗读聚焦字段；`Esc` 取消
-   用于银行/敏感表格的按站点禁用列表
-   通过 `chrome.storage.sync` 在用户的 Chrome 配置文件之间同步设置 — 无需 PrismAAC 账户

**隐私：** 无翻译模式完全离线（Web Speech 原生运行）。翻译模式对每个唯一的句子向 `translate.googleapis.com` 发出一次 HTTPS 调用（首次命中后缓存）。源代码可在 [`chrome-extension/`](chrome-extension/) 获取 — TypeScript + esbuild 打包（内容 18 KB，选项 7 KB，后台 339 B）。

---

### 👋 免提手势
可选的基于摄像头的输入，适用于无法可靠轻触的用户。头部姿态停留点击 + 手部姿态手势配置文件。本地运行 — 视频不会离开设备。

<details>
<summary><strong>功能 + 技术细节</strong></summary>

-   **基本模式**：头部姿态追踪 (FaceLandmarker, MediaPipe)。用户看向一个按键，凝视 `headTrackingDwellMs`（默认 1200 毫秒）→ 点击。凝视期间会填充视觉进度环。
-   **高级模式**：手部姿态追踪。通过 `components/HandCalibration.tsx` 配置自定义的按用户手势配置文件（张开手掌 = 回车，握拳 = 退格，捏合 = 空格等）。
-   漂移安全堆栈：如果用户的头部在 `headTrackingDriftWindowMs` 连续帧内漂移超过 `headTrackingDriftThresholdPx`，追踪会自动禁用并显示重新校准提示（用户报告 2026 年 5 月：追踪会在一小时内悄悄跟随漂移并错过实际按键目标）。
-   **Esc 紧急出口** — 在任何键盘上按下 Esc 会立即禁用追踪并重新显示 QWERTY 键盘，而不会丢失消息栏。
-   摄像头流单例 (`services/cameraStream.ts`)，因此头部 + 手部追踪器共享一个流；切换模式是免费的。
-   按用户校准会持久化；身体追踪器在会话恢复时自动恢复。

**详细文档：** [`docs/TRACKING_MATH.md`](docs/TRACKING_MATH.md)（校准数学、百分位学习器、自我运动、One Euro 滤波器、约 30 个可调参数），[`docs/GESTURE_RECOGNITION.md`](docs/GESTURE_RECOGNITION.md)，[`docs/TRACKING_RELIABILITY.md`](docs/TRACKING_RELIABILITY.md)。
</details>

---

### ⚙️ 设置
23 种语言、主题（浅色/深色/高对比度）、网格大小（4-20 个磁贴）、运动辅助功能（数学按住停留、两次点击放大、头部追踪停留、手势灵敏度、漂移自动禁用）、语音选择器（付费）、AI 自动更正开/关、通知、工具栏自定义、历史区域选择器。

![设置 — 语言选择器 + 主题切换](../../docs/screenshots/panel-settings.png)

<details>
<summary><strong>数学 + 辅助功能设置</strong></summary>

![设置 — 数学按住停留 + 两次点击放大](../../docs/screenshots/panel-settings-math.png)

-   **数学按住停留** — 0–1500 毫秒滑块；0 = 即时点击，200–1500 毫秒有助于运动不精确的用户（停留期间会填充绿色进度环，以便他们可以看到）。
-   **两次点击放大** — 第一次点击任何数学键会激活它（1.4 倍缩放 + 绿色光晕，不提交），第二次点击提交。2 秒自动解除。与按住停留功能结合使用。
-   **头部追踪停留** — 200–5000 毫秒。
-   **灵敏度** — 1–10。
-   **漂移自动禁用** — 切换 + 阈值 (像素) + 窗口 (毫秒)。
-   **显示手部校准** — 打开手部姿态配置文件编辑器。

</details>

<details>
<summary><strong>输入模式 — 语音、手势、AI 自动更正</strong></summary>

![设置 — 输入模式面板](../../docs/screenshots/panel-settings-input-modes.png)

-   **语音输入** — Web Speech API，语言感知（英式英语与美式英语等）；免费套餐
-   **AI 自动更正与补全** — 每次按键暂停都会通过云端自动更正（Gemini 2.5 Flash-Lite）进行路由。在低带宽场景下默认关闭。
-   **通知** — 传入 AAC 聊天消息时的警报 + 跨标签页通知。
-   **摄像头输入** — 头部 + 手部追踪主开关。
-   **摄像头追踪目标** — 头部、手部或自动检测。

</details>

<details>
<summary><strong>工具栏自定义</strong></summary>

工具栏完全可重新排序。默认 0.9.0 版本附带一组最小化功能（麦克风、AAC 聊天、警报、类别、设置），以便新用户屏幕保持整洁 — 所有其他内置功能（数学、AI 聊天、日程、游戏、市场、舒适播放器、笔记、历史、声音）都可以在“设置 → 工具栏”中一键重新启用。市场安装的应用会自动在内置功能之后插入。

</details>

---

## 立即体验

| | |
|---|---|
| 🌐 **网页应用** | [synalux.ai/prism-aac](https://synalux.ai/prism-aac) — 在任何浏览器中试用 |
| 📱 **iOS** | [App Store](https://apps.apple.com/app/id6764692277) — iPhone, iPad, Apple Watch |
| 💻 **源代码** | 此仓库。AGPL-3.0 — 自由分叉，分享修改 |

---

## 套餐

| | 免费版 | 付费版 |
|---|---|---|
| 图片磁贴 + 22 个类别 | ✅ | ✅ |
| 打字朗读 | ✅ | ✅ |
| 默认语音 (Inworld) | ✅ | ✅ |
| 19 学科键盘 + AI 导师 | ✅ 基本 | ✅ + 高级模型 |
| 日程 | ✅ | ✅ + 奖励商店 |
| 游戏 | 3 款（泡泡消除、颜色搜寻、我的故事） | 全部 12 款 |
| 语音选择器 | — | ✅ 所有 Inworld 语音 |
| 语音克隆（您的声音） | — | ✅ |
| 看护人笔记同步 | — | ✅ |
| 单词预测（按用户学习） | — | ✅ |
| 区域 + 地域历史 | ✅ | ✅ |
| 免提手势输入 | ✅ | ✅ |

[查看 Synalux 定价 →](https://synalux.ai/pricing)

---

## 临床安全

-   **AAC 访问绝不会因此受限。** 孩子必须始终拥有自己的声音。
-   **未经同意，云端不存储 PHI。** 看护人笔记在上传前加密。
-   **音频保留在本地。** 语音输入通过 Web Speech API 在浏览器中转录。
-   **由 BCBA 设计。** 语言操作追踪符合 BACB 任务列表第 5 版。
-   **创伤知情默认设置。** 无惩罚机制。奖励商店是可选的。

阅读更多：[`ACCESSIBILITY.md`](ACCESSIBILITY.md)，[`SECURITY.md`](SECURITY.md)。

---

## 基础设施与 GDPR

### 多区域架构

| 组件 | 区域 | 目的 |
|---|---|---|
| **Supabase 美国** | 美国东部 (弗吉尼亚) | 主数据库 — 认证、用户数据、看护人笔记 |
| **Supabase 欧盟** | 欧盟中部 (法兰克福) | 符合 GDPR — 欧盟用户数据永不离开欧盟 |
| **Vercel** | 全球边缘 | 网页应用、API 路由、CDN |
| **Inworld TTS** | 美国 | 神经网络文本转语音 |
| **HuggingFace Hub** | 美国/欧盟 | 模型权重 (1.7B, 8B, 14B, 32B) |
| **设备端** | 用户设备 | llama.cpp 推理 (iPhone/iPad/Mac) |

### GDPR 合规性

欧盟用户的数据仅存储在法兰克福 (eu-central-1) 区域。门户通过 Vercel 的 `x-vercel-ip-country` 头部检测用户位置，并将数据库操作路由到相应的 Supabase 实例：

-   **欧盟用户** → `supabase-eu` (法兰克福) — 个人数据、认证、偏好设置、看护人笔记
-   **非欧盟用户** → `supabase-us` (弗吉尼亚) — 相同数据类别，美国管辖
-   **AI 推理** → 设备端（无数据离开设备）或 Synalux API（不存储 PII）
-   **TTS 音频** → 服务器端生成，流式传输到客户端，不存储

**数据驻留保证：**
-   欧盟个人数据绝不通过美国服务器传输
-   认证令牌限定于区域 Supabase 实例
-   看护人笔记静态加密 (Supabase AES-256)
-   语音录音（舒适播放器）存储在浏览器 IndexedDB 中 — 永不上传
-   设备端 AI 模型本地运行 — 零云端遥测

**删除权：** 用户删除会在区域数据库中级联到认证、配置文件、看护人笔记和使用分析。自托管实例可以使用 `supabase db reset` 清除。

### 规模化成本

| 用户 | Supabase | Vercel | TTS | AI 模型 | 总计 |
|---|---|---|---|---|---|
| 0–1K | 每月 50 美元 (2 个区域) | 0 美元 (爱好版) | 每月约 5 美元 | 0 美元 (设备端) | 每月约 55 美元 |
| 1K–10K | 每月 50 美元 | 每月 20 美元 (专业版) | 每月约 50 美元 | 0 美元 | 每月约 120 美元 |
| 10K–100K | 每月 50 美元 + 计算附加组件 | 每月 20 美元 | 每月约 200 美元 | RunPod 每月 125 美元 | 每月约 395 美元 |

---

## AI 模型与设备支持

适用于所有 Apple 设备。核心 AAC 通信零云端依赖。

PrismAAC 会自动选择您的硬件可以运行的最佳模型，在受限设备上优雅降级，并且基本通信从不需要互联网连接。

| 设备 | 内存 | 模型 | 准确率 | AAC | 大小 | 成本 |
|---|---|---|---|---|---|---|
| **iPad Pro M1/M2/M4** | 16 GB | 14B Q4_K_M (v36) | **100%** | 100% | 8.4 GB | 0 美元 |
| **iPhone 15/16 Pro, iPad Air** | 8 GB | 8B Q4_K_M (v36) → 1.7B (内存不足备用) | **100%** | 100% | 4.7 GB / 1.1 GB | 0 美元 |
| **iPhone 12–14，旧款 iPad** | <8 GB | 1.7B Q4_K_M (v42) | **100%** | 100% | 1.1 GB | 0 美元 |
| **Mac M1+ 通过 WiFi** | 16+ GB | 通过 Ollama 实现 14B (v36) | **100%** | 100% | 8.4 GB | 0 美元 |

### 网页应用级联

网页应用首先尝试本地推理，然后回退到云端 — 因此安装了 Ollama 的用户支付 0 美元，而没有安装的用户仍然可以获得完整功能。

<details>
<summary>级联流程图</summary>

```
  用户发送消息
        |
        v
  +-- 本地 OLLAMA (在 localhost:11434 自动检测) --+
  |                                                      |
  |   14b (100%, ~1.1s) ─[失败]─> 8b (100%, ~0.8s) ─[失败]─> 1b7 (100%, ~1.6s)
  +-------------------------------------------------------------------+
         |
    [所有本地失败？]
         |
         v
  +-- 云端备用 (Synalux API) --------+
  |  Claude Sonnet 4 (付费) / Gemini (免费) |
  |  99% 准确率, ~3s                      |
  +-----------------------------------------+

  自动侧载：首次启动检测 Ollama → 拉取最佳模型 → 永久本地。
```

</details>

### iOS 原生级联

原生应用在启动时探测可用内存，从 HuggingFace CDN 下载正确的模型（一次性），并通过 llama.cpp Metal 运行推理。无服务器。无订阅。无数据离开设备。

<details>
<summary>级联流程图</summary>

```
  应用启动
      |
      v
  内存检测 (os_proc_available_memory)
      |
      +── 16 GB+ (iPad Pro) ──> 14B Q4_K_M