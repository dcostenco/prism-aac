<!-- Auto-generated from README.md by scripts/generate_i18n.py — do not edit manually -->
# Prism AAC

**帮助非语言表达儿童和成人开口说话。**

专为肢体运动障碍和有复杂沟通需求的儿童设计的辅助与替代沟通（AAC）应用。点击图片、组合句子、听取朗读——支持 25 种语言（28 个地区版本）。可在任何平板电脑、笔记本电脑、iPhone、iPad 和 Apple Watch 上使用。

[Synalux 平台](https://synalux.ai) 的一部分。

**立即体验：**
- **Web 应用（免费）：** [synalux.ai/prism-aac](https://synalux.ai/prism-aac) — 可在任何带有浏览器的设备上运行
- **iOS（iPhone + iPad + Apple Watch）：** [App Store](https://apps.apple.com/app/id6764692277)
- **价格方案：** [synalux.ai/pricing](https://synalux.ai/pricing) — 免费版，另有可选的 Prism AAC Cloud 计划（每月 4.99 美元），提供自然语音朗读和云端 AI 配额

🌐 [English](../../README.md) · [Español](README_es.md) · [Français](README_fr.md) · [Português](README_pt.md) · [Română](README_ro.md) · [Українська](README_uk.md) · [Русский](README_ru.md) · [Deutsch](README_de.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · **中文** · [العربية](README_ar.md)

<p align="center">
  <a href="https://apps.apple.com/app/id6764692277"><img src="https://img.shields.io/badge/App_Store-Download-0D96F6?style=for-the-badge&logo=apple&logoColor=white" alt="App Store"></a>
  <a href="https://synalux.ai/prism-aac"><img src="https://img.shields.io/badge/Try_It-Free-43e97b?style=for-the-badge" alt="Try Free"></a>
  <a href="https://synalux.ai/pricing"><img src="https://img.shields.io/badge/Plans-Free_+_Paid-764ba2?style=for-the-badge" alt="Pricing"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-AGPL--3.0-blue?style=for-the-badge" alt="AGPL-3.0"></a>
  <a href="../../PRIVACY.md"><img src="https://img.shields.io/badge/Privacy-Policy-lightgrey?style=for-the-badge" alt="Privacy"></a>
  <a href="../../TERMS.md"><img src="https://img.shields.io/badge/Terms-of_Service-lightgrey?style=for-the-badge" alt="Terms"></a>
</p>

![iPad 上的 Prism AAC 主画面 — 工具栏、输入框、五个预测词贴片以及完整 QWERTY 键盘（正式发布 Web 应用，1.9.0）](../../docs/screenshots/app-hero.png)

### 原生应用

<p align="center">
  <img src="../../docs/screenshots/ios-iphone.png" alt="iPhone 上的 PrismAAC" width="220" />
  <img src="../../docs/screenshots/ios-ipad.png" alt="iPad 上的 PrismAAC" width="360" />
  <img src="../../docs/screenshots/watch-ultra.png" alt="Apple Watch Ultra 上的 PrismAAC" width="120" />
</p>

<sub>iPhone 和 iPad 截帧捕获自运行正式发布 Web 应用的构建版本 1.9.0 (53)，2026-09-08。Watch 截帧取自 1.4.0。</sub>

| 平台 | 状态 | 端侧 AI | 备注 |
|----------|--------|-------------|-------|
| **Web** (PWA) | ✅ 正式发布 | 自动下载最佳本地模型 | 任何浏览器均可安装；可经由 Stripe 订阅 Cloud 计划 |
| **iPad Pro 16GB** | ✅ 正式发布 | 4B 端侧 AI（100% 准确率） | 最快且完全私密；通过 Apple 应用内购买订阅 Cloud 计划 |
| **iPhone Pro 8GB** | ✅ 正式发布 | 4B Q4_K_M 端侧（100% 准确率） | 依据 RAM 自动选择 |
| **所有 iPhone** | ✅ 正式发布 | 2B Q3_K_M 端侧（99.1% 准确率） | 2.3 GB — 适用于所有 iPhone |
| **Apple Watch** | ✅ 正式发布 | 离线短语（1,261 × 20 种语言） | 独立运行 — 象形图、TTS、紧急呼叫 |
| **Chrome 扩展程序** | ✅ 正式发布 | — | 任意文本框中的阅读助手 |
| **WiFi 连接至 Mac** | ✅ 正式发布 | 通过 Ollama 支持 9B/27B | 设置 → 本地 AI → 输入 Mac IP |

---

## App Store 预览视频

30 秒视频，配以 Inworld TTS 旁白，展现所有主要功能：

https://github.com/dcostenco/synalux-docs/releases/download/v1.0-module-videos/prism_aac_preview_v5.mp4

| 场景 | 功能 | 截图 |
|---|---|---|
| **首页** — 点击短语 | 拥有 22 个分类的象形图面板，朗读按钮 | <img src="../../docs/screenshots/appstore/ipad_home.png" width="200"> |
| **分类** | 求助、食物、地点、情绪的快捷短语 | <img src="../../docs/screenshots/appstore/ipad_categories.png" width="200"> |
| **AI 对话** | 编写消息，练习对话 | <img src="../../docs/screenshots/appstore/ipad_ai-chat.png" width="200"> |
| **紧急警报** | 一键呼叫照护者/护士 | <img src="../../docs/screenshots/appstore/video/frame_03.png" width="200"> |
| **日程表** | 视觉化日常作息 — 早晨、学校、午餐、睡前 | <img src="../../docs/screenshots/appstore/ipad_schedule.png" width="200"> |
| **游戏** | 戳气泡、寻找颜色、对对碰、是不是、完成句子 | <img src="../../docs/screenshots/appstore/ipad_games.png" width="200"> |
| **数学与学科** | 自适应数学，包含提示、检查、解答 + 数字键盘 | <img src="../../docs/screenshots/appstore/video/frame_06.png" width="200"> |
| **头部与眼球追踪** | 基于摄像头的驻留光标、注视控制、校准 | <img src="../../docs/screenshots/appstore/video/frame_07.png" width="200"> |
| **12 种语言** | 英语、西班牙语、法语、俄语、日语、韩语、中文、阿拉伯语等 | <img src="../../docs/screenshots/appstore/video/frame_08.png" width="200"> |

---

## 概览

| 模块 | 功能 | 预览 |
|---|---|---|
| 📂 **分类** | 适合非阅读者的 PECS 风格图片贴片 | <img src="../../docs/screenshots/panel-categories.png" width="120"> |
| ⌨️ **输入与朗读** | 键盘 + 词汇预测 + 神经网络语音 | <img src="../../docs/screenshots/app-hero.png" width="120"> |
| ✨ **AI 对话** | 专为 AAC 用户调校的端侧 + 云端助手 | <img src="../../docs/screenshots/panel-ai-chat.png" width="120"> |
| 💬 **AAC 聊天** | 接收来自照护者 + 联系人的消息 | <img src="../../docs/screenshots/panel-aac-chat.png" width="120"> |
| 🧮 **数学 + 学科** | 带有领域感知导师的网格画布 | <img src="../../docs/screenshots/math-canvas-typed.png" width="120"> |
| 🗓 **日程表** | 视觉化“先…然后…”日常作息 | <img src="../../docs/screenshots/panel-schedule.png" width="120"> |
| 🎮 **游戏** | 12 款康复辅助 AAC 游戏 | <img src="../../docs/screenshots/panel-games.png" width="120"> |
| 🏪 **应用市场** | 语音包、词汇包、游戏包 | <img src="../../docs/screenshots/panel-marketplace.png" width="120"> |
| 🎧 **舒缓播放器** | 专为住院患者设计的床边媒体播放器 | <img src="../../docs/screenshots/panel-comfort-player.png" width="120"> |
| 🛏 **床边模式** | 全屏 AI 对话，适用于手机支架/卧床使用 | <img src="../../e2e/_screenshots/bedside-overlay-open.png" width="120"> |
| 👁 **视觉语境** | 摄像头识别物体 → 推荐相关短语 | <img src="../../docs/screenshots/vision-mealtime.png" width="120"> |
| 👋 **无障碍手势** | 头部 + 手势识别 | <img src="../../docs/screenshots/panel-settings-input-modes.png" width="120"> |
| ⚙️ **设置** | 25 种语言、运动调节、语音选择器 + 语音缓存 | <img src="../../docs/screenshots/panel-settings.png" width="120"> |
| ☁️ **云端语音与 AI** | 可选的 4.99 美元/月配额，用于自然语音 + 云端 AI | <img src="../../docs/screenshots/cloud-subscription-iphone.png" width="120"> |

---

## 无障碍设计

Prism AAC 于 2026 年 6 月接受了 [70 项对抗性无障碍审计](ACCESSIBILITY.md)，涵盖 iPhone 竖屏、iPhone 横屏、iPad 竖屏和 iPad 横屏测试。所有发现的问题均已修复并通过自动化端到端测试验证。

### 输入方式 — 身体任何部位皆可操作

| 方式 | 工作原理 | 设置 |
|--------|-------------|-------|
| **触控** | 标准点击 + 象形图贴片 | 开箱即用 |
| **头部追踪** | 摄像头追踪头部运动 → 驻留点击 | 设置 → 输入模式 |
| **眼动注视** | 头部追踪器上的眼球位置加权 | 设置 → 输入模式 |
| **开关扫描** | 通过蓝牙开关、键盘或游戏手柄进行自动/手动扫描 | 设置 → 输入模式 → 开关扫描 |
| **手势识别** | 眨眼、点头、微笑、张嘴 → 映射操作 | 设置 → 输入模式 → 手势 |
| **语音输入** | 带有 AI 自动纠错的听写、免提、唤醒词 | 工具栏上的麦克风按钮 |
| **简化键盘** | 3×5 网格中最常用的 15 个字母（网格大小为 4 时自动启用） | 设置 → 网格大小 → 4 |

图片面板导航：在词汇网格或底部分类条内向左/右滑动以浏览页面。在 Mac 上，可使用触控板水平滚动或按住鼠标拖拽；边缘箭头依然可用。翻页不会自动选择词汇—必须主动点击或按下贴片进行选择。垂直滚动和平移缩放不会触发翻页。请参阅 [滑动导航和测试边界](docs/SWIPE_NAVIGATION.md)。

### 响应式布局 — iPhone 与 iPad，竖屏与横屏

<p align="center">
  <img src="../../docs/screenshots/a11y-2026-06-18/01-home-board-iphone-6.1.png" alt="iPhone 竖屏" width="160" />
  <img src="../../docs/screenshots/a11y-2026-06-18/01-home-board-iphone-6.1-land.png" alt="iPhone 横屏" width="280" />
  <img src="../../docs/screenshots/a11y-2026-06-18/01-home-board-ipad-13.png" alt="iPad 竖屏" width="240" />
</p>

### 视觉模式

<p align="center">
  <img src="../../docs/screenshots/a11y-2026-06-18/06-dark-high-contrast-iphone-6.1.png" alt="iPhone 上的深色 + 高对比度" width="160" />
  <img src="../../docs/screenshots/a11y-2026-06-18/06-dark-high-contrast-ipad-13-land.png" alt="iPad 横屏上的深色 + 高对比度" width="340" />
</p>

- **浅色 / 深色 / 高对比度** 主题
- **`prefers-contrast: more`** 和 **`prefers-reduced-motion`** 系统媒体查询
- 支持 **捏合缩放**（最高 5 倍） — 符合 WCAG 1.4.4 标准
- 崩溃恢复模式中内置 **16 个紧急词汇 × 8 种语言**

要查看包含全部 70 项结果的完整审计报告，请参阅 [ACCESSIBILITY.md](ACCESSIBILITY.md)。

---

## 安全与隐私

PrismAAC 的使用者包括儿童、无语言能力的成年人（nonverbal adults）以及临床人群（clinical populations）。安全不是一项功能——它是一个塑造每一条推理路径的约束条件。

### 分层安全架构

| 层级 | 内容 | 运行位置 | 延迟 |
|-------|------|---------------|---------|
| **L1 — 确定性安全门控** | 基于正则表达式的危机/医疗拦截 | 客户端 + 服务端（每一条路径） | 0 ms |
| **L2 — 模型安全训练** | Qwen3.5 RLHF 对齐 | 端侧 + 云端 | 内置 |
| **L3 — 置信度门控** | 拒绝过短/乱码（garbled）/模板泄漏输出（template-leaked output） | 端侧 + 服务端 | 0 ms |
| **L4 — 事实依据验证器** | NLI 检查：主张必须由证据逻辑推导得出（claims must be entailed by evidence） | 服务端（付费层级） | ~200 ms |

### L1 安全门控细节

L1 门控在所有推理路径上对**输入和输出**运行确定性正则表达式检查——包括完全绕过服务端的离线本地 Ollama 路径。

**它捕获的内容：** 第一人称危机表述（自残意图）、危险的医疗用量指令。

**它不捕获的内容（按设计）：** 通用临床术语（“dose of risperidone”、“milligrams”、“suicide prevention training”）。这些词汇出现在合法的 BCBA/医疗记录中，阻断它们会伤害本产品所服务的临床人群。端侧 2B 模型自身的对齐完全不被依赖于安全（is not relied upon for safety，其在通用 BFCL V4 上得分约 59%）。L1 是主要的确定性安全机制。

**已知 L1 局限性：**
- **语言覆盖不均衡。** 危机短语在英语和其他语言中进行匹配，且组合因路径而异。Web AI 聊天门控（`services/crisisSafetyFilter.ts`）还匹配西班牙语、法语、葡萄牙语、罗马尼亚语（Romanian）、俄语、乌克兰语、阿拉伯语、德语、日语、韩语、中文和保加利亚语短语。离线客户端检查（`checkInputSafetyClient`）还匹配西班牙语、法语、葡萄牙语、俄语、阿拉伯语、德语和乌克兰语。iOS 门控有其自身的内置列表（英语、西班牙语、法语、罗马尼亚语、俄语、阿拉伯语和希伯来语），并在启动时如果能连接服务端，会从服务端添加关键词。医疗用量模式在每个客户端路径上仅限英语。在给定路径上没有模式的受支持语言仅由模型自身的安全训练（L2）保护。
- **正则表达式是底线，而非上限。** 转述的困境表述（“I don't want to be here anymore”）不会被匹配。L1 捕获定义的强信号表述；L2（模型对齐）处理长尾情况。

**按路径划分的覆盖范围：**

| 路径 | L1 输入 | L1 输出 | 备注 |
|------|:--------:|:---------:|-------|
| 本地 Ollama（离线，web） | ✅ 客户端 | ✅ 客户端 | `checkInputSafetyClient` + `checkOutputSafetyClient` |
| iOS 端侧（llama.cpp） | ✅ 原生 | ✅ 原生 | `SafetyFilter.swift`（`ios-native/PrismAAC/Sources/Safety/`）；输出检查仅拦截越狱内容（intercepts jailbreak content only） |
| Portal `/prism-aac/chat` | ✅ | 流式* | 在模型调用前检查输入 |
| Portal `/prism-aac/infer` | ✅ | ✅ | 共享安全模式模块 |
| Portal `/prism-aac/inference` | ✅ | ✅ | 共享安全模式模块 |

*流式云端响应输出依赖于模型安全（L2）——L1 无法在传输途中对 Token 流进行正则表达式过滤。

### 危机拦截的效果展示

如果用户通过 AAC 界面输入困境表述，L1 会立即返回（在任何模型运行之前）：

> "I'm concerned about your safety. Please call or text 988 (Suicide & Crisis Lifeline) right now — available 24/7. If in immediate danger, call 911. You are not alone."

### 隐私

- 端侧 AI 在本地处理提示词——无数据离开设备（no data leaves the device）
- 云端语音服务（Cloud speech）和云端 AI（使用时）通过 TLS 传输至 Synalux portal；文本在内存中处理且不被存储
- 不存储任何用户提示词，也不用于训练
- 不需要账户；匿名使用/错误遥测（Datadog）从不包含输入或口述的文本
- 请参阅 [PRIVACY.md](../../PRIVACY.md) 查看完整的隐私政策

---

## 免费替代 Read & Write

PrismAAC 内置了多数 AAC 用户付费购买 Read & Write 所需的所有阅读辅助功能 — 全部免费提供，在浏览器中运行，Web 版无需账号。参见 [输入与朗读](#%EF%B8%8F-输入与朗读) 查看句末朗读 + 词汇高亮，参阅 [PDF 阅读器](#-pdf-阅读器) 和 [截图阅读器 (OCR)](#-截图阅读器-ocr) 处理文档，以及 [Chrome 扩展程序](#-chrome-扩展程序--在任何文本框中享受相同的阅读辅助功能) 实现 Gmail / Docs / Word Online / 任何其他应用的全场景覆盖。

## PrismAAC 竞品对比

| | PrismAAC | TouchChat | Proloquo2Go | LAMP Words | TD Snap | CoughDrop | Snap Core First | Grid 3 | Tobii Dynavox |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **摄像头 → 短语推荐**（识别物体，推荐词汇） | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **端侧 AI**（99–100% 路由，支持 HIPAA） | 🟢 | 🔴 | 🔴 | 🔴 | 🟡 | 🟡 | 🔴 | 🔴 | 🟡 |
| **单用户短语排序**（自适应每个儿童） | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| 照护者纠错**转化为训练数据** | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **AI 导师**（数学 + 10 个其他学科） | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **网格数学画布** | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **地区感知历史**（280+ 地区） | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **免提** 头部 + 手部 + 手势 + 开关扫描 | 🟢 | 🟡 | 🟡 | 🔴 | 🟢 | 🟡 | 🟡 | 🟢 | 🟢 |
| **免提 AI 对话**（语音循环 + 唤醒词 + 床边） | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| 康复训练 **AAC 游戏**（内置 12 款） | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🟡 | 🟡 | 🔴 | 🔴 |
| **开源** (AGPL-3.0) | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🟢 | 🔴 | 🔴 | 🔴 |
| **免费版**（生命安全保障） | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🟢 | 🔴 | 🔴 | 🔴 |
| 语音包 **应用市场** | 🟢 | 🔴 | 🟡 | 🔴 | 🟡 | 🔴 | 🔴 | 🟡 | 🟡 |
| **多语言** (25) | 🟢 | 🟢 | 🟢 | 🔴 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| **照护者记录**（家庭 / 学校 / 诊所） | 🟢 | 🔴 | 🔴 | 🔴 | 🟡 | 🟡 | 🟡 | 🔴 | 🟡 |
| **Apple Watch** 独立模式 | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |
| **Chrome 扩展程序** 阅读助手 | 🟢 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 | 🔴 |

🟢 = 完全支持 &nbsp;&nbsp; 🟡 = 部分支持 &nbsp;&nbsp; 🔴 = 不支持

> 对比数据反映截至 2026-05 的公开产品信息。PrismAAC 处于积极开发状态；竞品可能会随时间增加功能。欢迎提交 PR 帮助保持客观真实 — 详见 `CONTRIBUTING.md`。
>
> Grid 3 和 Tobii Dynavox 拥有强大的眼动注视 + 开关扫描硬件集成，未在上表中列出（依赖硬件，需专业诊所配置）。

---

## iOS 与 Apple Watch

### iPhone / iPad

原生 Swift 应用，通过 WKWebView 打包 Web UI，并通过 llama.cpp Metal 提供 **双引擎端侧 AI** 架构。

为保障跨设备即时、离线的 AI 访问体验，应用会根据设备的可用内存自动同时运行两个不同模型：

| 设备 | RAM | 对话 AI | 路由准确率 | 自动补全 |
|---|---|---|---|---|
| iPad Pro M1/M2/M4 | ≥ 16 GB | 4B Q4_K_M (3.4 GB) | **100%** | 360M（内置） |
| iPhone 15/16 Pro, iPad Air | 8–15 GB | 4B Q4_K_M (3.4 GB) | **100%** | 360M（内置） |
| 所有其他 iPhone / iPad | < 8 GB | 2B Q3_K_M (2.3 GB) | **99.1%** | 360M（内置） |

> 准确率测试：BFCL 基准，115 个工具路由测试用例 × 3 次随机种子，temperature=0，2026 年 6 月。

#### 端侧 AI — 首次启动即可离线工作

每台设备的应用中都内置了 AI 模型。无需下载、无需 WiFi、无需注册账号 — 打开应用即可开始沟通。

| 设备 | 内置模型 | 体积 | 功能 |
|---|---|---|---|
| **iPhone / iPad** | Qwen3.5-4B Q3_K_M | 2.3 GB | 工具路由、免提、床边模式、唤醒词（99.1% 准确率） |
| **Apple Watch** | SmolLM2-360M | 207 MB | 符号扩展、紧急短语、预测文本（100% 准确率） |

可在“设置 → 本地 AI”中选择更大的模型（9B, 27B），通过 WiFi 连接至 Mac 进行路由（100% BFCL 准确率）。

<details>
<summary><strong>技术细节</strong></summary>

- **L1 确定性安全网关：** 在输入（任何模型运行前）和输出（到达用户前）阶段执行危机/医疗正则拦截。模式专门针对自残意图 — 通用临床/药理术语（“剂量”、“毫克”）不会被拦截，以避免影响合规的 AAC 临床使用。
- **客户端输出安全：** 本地 Ollama 结果在显示前会通过 `checkOutputSafetyClient` — 离线用户享有与云端用户相同的 L1 保护。
- **置信度网关：** 低于长度/质量阈值的端侧输出将被拒绝，并升级至云端（付费层）或降级处理（免费层）。
- 内存感知网关实现平滑降级：完整 AI → 云端 AI → 仅核心功能 → 紧急模式
- OOM 降级策略：4B Q4_K_M → 2B Q3_K_M → 360M
- 适配灵动岛 / 缺口屏的安全区域边距
- 用于 Apple Watch 紧急调度的 WCSession 桥接
- 基于 Keychain 的身份验证 Token 存储

</details>

**设置 → 🤖 本地 AI 模型** — 下载与管理端侧模型：
- 自动检测运行在 `localhost:11434` 的 Ollama
- 通过 WiFi 连接至 Mac：iPad/iPhone → Mac Ollama（9B/27B 达到 100% BFCL 准确率）
- 带有实时进度条的单模型下载
- 模型选项：`:2b` (2.3 GB) · `:4b` (3.4 GB) · `:9b` (5.8 GB) · `:27b` (16.8 GB)


### Apple Watch（独立运行）

脱离 iPhone 依然可用 — 内置离线短语字典，独立运行。

<p align="center">
  <img src="../../docs/screenshots/watch-series.png" alt="Watch Series 11" width="140" />
  <img src="../../docs/screenshots/watch-ultra.png" alt="Watch Ultra 3" width="140" />
</p>

- **离线翻译：** 预置 1,261 个短语 × 20 种语言（411 KB JSON） — 毫秒级查阅，100% 准确，无需网络
- 采用 ARASAAC 图片的双列象形图网格
- 带有听写 + 键盘输入的 AI 对话（在线时连接云端，离线时查阅短语字典）
- 紧急系统：倒计时 → WCSession → 蜂窝网络后备 → TTS
- 带 TTS 朗读的翻译（优先离线字典，失败后备至云端）
- 收件箱：接收并回复照护者的消息
- 紧急调度采用证书固定（SPKI SHA-256）
- 所有 AI 路径均经过 NFKC + 23-Token 注入过滤清理

---

## 📊 照护者洞察仪表盘 (v1.8)

应用在内部追踪丰富的行为数据 — 预测准确率、运动能力趋势、语音稳定性、头部追踪稳定性、沟通模式、照护者纠错。以往，**这些数据均未展示给照护者**。照护者唯一的 UI 只是一个文本便签本。

现在，照护者面板中新增了 **洞察标签页**，提供 7 个实时监控组件，底层由后台指标收集器支持，每 5 分钟运行一次，完全不影响预测路径。

### 照护者看到的内容

| 组件 | 展现的信息 | 临床价值 |
|---|---|---|
| **预测有效性** | “命中率 72% ↑（对比前 24 小时）” | 词汇集配置是否生效 |
| **词汇采纳率** | “45 个常用 · 12 个新用 · 8 个未用” | 哪些短语被采纳，哪些需要移除 |
| **沟通主题** | “热门：学校 (35%), 食物 (22%)” | 主题分布变化可能预示能力退化或环境改变 |
| **运动能力趋势** | “驻留 850ms ↓（改善中）” | 运动控制提升 → 驻留时间变短；退化 → 需转诊作业治疗（OT） |
| **追踪稳定性** | “2 次偏移 · 98% 正常运行” | 频繁偏移 → 检查坐姿、疲劳度、校准状态 |
| **语音稳定性** | “97% 成功 · 1 次后备” | Azure TTS 失败？API 密钥过期？网络连接问题？ |
| **纠错负担** | “累计 47 次纠错” | 纠错率上升 = 模型需要针对该儿童重新训练 |

### 仪表盘布局

| 照护者面板 | | ✕ |
|:---|:---|---:|

| + 便签 | 记录 | **洞察** |
|:---:|:---:|:---:|

> **预测有效性**
> `命中率 72%` &nbsp;&nbsp; ↑ 对比 24h
> ![sparkline](https://img.shields.io/badge/trend-72%25_____85%25_____78%25_____72%25-4CAF50?style=flat-square)

> **词汇采纳率**
> `45 个常用` · `12 个新用` · `8 个未用`
> `████████████████░░░░░░` 采纳 69% / 尝试 18% / 未用 13%

> **沟通主题**
> `学校` 35% · `食物` 22% · `游玩` 18%
> ![sparkline](https://img.shields.io/badge/school-35%25-9C27B0?style=flat-square) ![sparkline](https://img.shields.io/badge/food-22%25-FF9800?style=flat-square) ![sparkline](https://img.shields.io/badge/play-18%25-2196F3?style=flat-square)

> **运动能力趋势**
> `驻留 850ms` &nbsp;&nbsp; ↓ 改善中
> ![sparkline](https://img.shields.io/badge/trend-1200____1100____950_____850ms-FF9800?style=flat-square)

> **追踪稳定性**
> `今日偏移 2 次` · `98% 正常运行`
> ![sparkline](https://img.shields.io/badge/uptime-98%25-4CAF50?style=flat-square)

> **语音稳定性**
> `97% 成功` · `1 次后备`
> `██████████████████████████████░` Azure 94% / Web Speech 3% / 失败 3%

> **纠错负担**
> `累计 47 次纠错` &nbsp;&nbsp; 本周 +3
> ![sparkline](https://img.shields.io/badge/trend-38_____41_____44_____47-795548?style=flat-square)

<sub>286 个数据点 · 近 7 天 · 每 5 分钟更新</sub>

### 架构

```
点击预测条 --> recordPredictionHit() (动态导入, ~0.01ms)
                                     |
        +--------------------------------------------+
        |      metricsCollector (5 分钟定时器)         |
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
        |  7 天滚动 - 5 分钟分桶 - 400KB               |
        +--------------------------------------------+
                                     |
        +--------------------------------------------+
        |  CaregiverInsightsTab (延迟加载)            |
        |  7 个 InsightCard 组件 + SVG 迷你图         |
        |  仅在照护者点击标签页时渲染                   |
        +--------------------------------------------+
```

### 性能保障

| 关注点 | 保障措施 |
|---|---|
| **按键路径** | 增加 0ms 延迟 — 命中/未命中采用动态导入 + 计数器累加 |
| **内存占用** | 7 天数据仅占用 ~400KB localStorage + ~50KB RAM |
| **包体积** | ~2KB JS（无需图表库 — 纯 SVG 迷你图） |
| **离线可用** | 100% 基于 localStorage — 无网络请求 |
| **iPad 适配** | 垂直滚动卡片，120×32px 迷你图 |
| **隐私安全** | 无个人健康信息（PHI） — 仅保留操作计数，置于照护者 PIN 码后 |

### 示例：解读预测有效性组件

```
预测有效性
命中率 78%                      ↑ 对比前 24h
╭──╮ ╭╮╭─╮
│  ╰─╯╰╯ ╰──╮╭──
```

- **命中率 78%**：78% 的情况下，儿童直接点击预测条中的词汇，而非手动打字。这意味着词汇集与儿童的沟通习惯高度匹配。
- **↑ 对比前 24h**：命中率较昨日有所提升 — 自适应引擎正在持续学习。
- **迷你图**：显示过去 24 小时的命中率趋势。下降可能与新话题或新环境有关。

如果命中率降至 40% 以下，通常意味着需要更新词汇集 — 儿童正在交流预测引擎未覆盖的内容。

### 示例：解读运动能力趋势组件

```
运动能力趋势
驻留 1200ms                    ↑ 退化中
╭──╮
│  ╰──╮╭──╮╭─
```

- **驻留 1200ms**：儿童需要悬停 1.2 秒以触发选择。典型范围：800–2000ms。
- **↑ 退化中**：驻留时间变长（儿童需要更多时间）。这可能提示疲劳、药物调整或运动功能进行性退化。
- **建议操作**：若该趋势持续 3 天以上，需标记并转诊 OT 评估。应用会自动调整驻留时间，但临床医生应排查潜在原因。

---

## 模块

### 📂 分类

在图片模式下，“网格大小”决定了每个词汇页面的贴片数量（4 代表
2 × 2；6 代表 3 × 2）。在面板上向左或向右滑动以浏览页面，或者使用分类标题旁边的
Chevron 符号。导航操作不会添加词汇或触发朗读；
点击贴片即可选择该词汇。页面位置会自动向屏幕阅读器播报，
无需额外的可见页数页脚。

PECS 风格的图片贴片。点击分类，点击贴片，听到词发音，并看到词落入消息栏。适用于非阅读者、预备阅读者和初级沟通者。贴片集和排序会随着时间推移通过扩散激活实现个性化 — 儿童点击最多的贴片会上升；数月未用的贴片会自动淡出。

**环绕式布局** — 分类显示在键盘旁可滚动的左侧列中，因此 AAC 用户可以同时点击图片贴片和进行打字，无需切换模式。预测条保持可见；两种输入方式始终触手可及。

![环绕模式下的分类 — 左侧为可滚动的分类卡片，右侧为完整键盘](../../docs/screenshots/categories-surround-v2.png)

<details>
<summary><strong>功能 + 技术细节</strong></summary>

- 22 个默认分类：人物、食物、情绪、身体、衣服、动物、地点等。
- 照护者可为每个儿童添加/删除/重新排序贴片
- 每个贴片带有用于国际化的 `textKey` — 切换应用语言可一键重新标记所有贴片
- 贴片象形图来自 ARASAAC + 精选集合；声音克隆允许您将贴片的声音匹配为儿童的兄弟姐妹或父母（付费层）
- 单用户 N-Gram 学习：连续三次点击“我想吃”的儿童，在下一阶段会看到“吃”排在“想”之后
- HRR 全息记忆：通过 Rust WASM 在 ~0.2ms 内实现零搜索上下文预测 — 核心 AAC 短语的 Top-1 准确率提升 +27%

**渲染路径：** `components/CategoryPanel.tsx` → `useCategoryStore` → 绘制来自 `constants/phrases.ts`（系统）的贴片 + Supabase 单用户覆盖（付费）。点击贴片调用 `messageStore.appendText(phrase)` 并通过 `aacSpeak()` 进行 TTS 发音。
</details>

---

### ⌨️ 输入与朗读
带有 **词汇预测**、**AI 自动补全** 和一键 **朗读** 按钮的屏幕键盘，可用自然神经网络语音朗读消息栏。打字会训练预测引擎：儿童打字最多的词汇会在下一阶段更早呈现。

![已打出“hello”的 Prism AAC 键盘、预测贴片和朗读按钮](../../docs/screenshots/keyboard-typing.png)

**阅读辅助功能（具备 Read & Write 等级的功能）** — 适用于有阅读/记忆/认知需求的用户：

- **逐词朗读** — 每当按下空格键时，每个词汇都会通过 TTS 立即发出声音，无需等待整句话完成即可听到打出的内容。
- **标点符号 `.?!` 句末朗读** — 用句号、问号或感叹号结束句子时会朗读整句话，避免遗忘所写内容（解决了带认知障碍的健视用户使用 NVDA 时的体验痛点）。可通过 设置 → `speakOnSentenceEnd` 进行切换（默认开启）。
- **朗读时逐词高亮显示** — TTS 朗读时，每个读出的词汇都会亮起黄色背景。带阅读障碍的健视用户可以跟随视觉引导；高亮显示可精准匹配语音，无需额外的硬件设备。

<details>
<summary><strong>功能 + 技术细节</strong></summary>

- QWERTY 键盘上方有 5 个预测槽位，随每次按键刷新
- 通过 Synalux `text/correct`（Gemini 2.5 Flash-Lite，平均 ~752ms，比 2.5 Flash 便宜 4.3 倍）实现 AI 补全（例如 "hw" → "how"，"togoso" → "to go so"）
- 跨语言隔离：即使加载了两种语料库，罗马尼亚语的 `eu` 也不会泄露到英语输入栏中（跨语料库频率对比）
- “朗读”采用自适应语调（根据标点符号推断陈述/疑问/感叹）
- 语音链：持久化语音缓存（无需重复请求即可播放）→ 通过门户获取云端语音（Inworld TTS-2；Inworld 缺失的语言使用 Azure Neural；Gemini TTS 作为云端保底方案）→ 系统 Web Speech（离线）→ WASM espeak-ng（最终保底）。参阅 [`docs/TTS-ARCHITECTURE.md`](../../docs/TTS-ARCHITECTURE.md) 和 [`docs/SPEECH_CACHE.md`](../../docs/SPEECH_CACHE.md)
- 词汇高亮采用时长估算（ rate=0.5 时约为 ~60 ms/字符，随语速滑块缩放） — 适用于所有 TTS 层级，无需修改后端；通过 Azure `wordBoundary` 实现精准同步是规划中的 Pro 功能。
- 每种语言包含 1.5MB 的 SQLite N-Gram 语料库；包含 Unigram + Bigram + Trigram；切换语言时延迟加载
- **HRR 上下文记忆** — 零搜索全息检索（229KB Rust WASM），可从每个朗读短语中学习。将 Bigram + Trigram 编码为全息向量；每次按键在 ~0.2ms 内完成检索。叠加层设计 — 提升前 2 个带有上下文匹配的预测贴片，且不影响语料库原有预测。

**HRR 预测基准测试**（54 个单元测试 + 10 场景精准度套件）：

| 场景 | 基线 Top-1 | HRR+ Top-1 | 提升 | 基线 MRR | HRR+ MRR | MRR 提升 |
|----------|---------------|------------|------|-------------|---------|----------|
| 核心 AAC 短语 (1x) | 36.7% | 46.7% | **+27.3%** | 0.634 | 0.672 | +6.0% |
| 核心 AAC 短语 (每日 5x) | 36.7% | 46.7% | **+27.3%** | 0.634 | 0.672 | +6.0% |
| 个人词汇 | 70.4% | 81.5% | **+15.8%** | 0.809 | 0.883 | +9.2% |
| 混合（所有短语） | 47.2% | 56.9% | **+20.6%** | 0.669 | 0.707 | +5.7% |
| 跨会话召回 | 80.0% | 80.0% | +0.0% | 0.900 | 0.900 | +0.0% |
| 模棱两可的前缀 | 66.7% | 66.7% | +0.0% | 0.738 | 0.738 | +0.0% |

Top-1 = 目标词汇位于第 1 个贴片。Top-5 = 目标词汇位于任意前 5 个贴片。MRR = 平均倒数排名（越高代表目标词汇越靠前）。HRR 在任何场景下都不会降低 Top-5 准确率 — 零性能退化。最大收益体现在个人词汇（+9.2% MRR）和核心 AAC 短语（+27.3% Top-1）。

**渲染路径：** `components/Keyboard.tsx` → `messageStore.appendChar` → `predictionStore.updatePredictions(text, lang)` → `engine/predictionEngine.ts`（新鲜度 × 频率 × N-Gram 提升）+ 可选的 `services/textCorrectService.ts` AI 叠加 + `services/hrrContext.ts` HRR Bigram/Trigram 检索。高亮显示：`services/aacSpeak.ts` 在 `ttsHighlightBus` 上触发 `ttsHighlight-start` 事件；`components/MessageBar.tsx` 订阅该事件并将 `activeWordIndex` 传递给 `ColoredText`。
</details>

---

### ✨ AI 对话
针对 AAC 用户的表达习惯进行了调校的端侧 + 云端助手。支持流式响应，每一行都可以一键插入到消息栏中，确保内容创作权始终属于儿童。免费层通过 Gemini 2.5 Flash 运行；付费层路由至 Claude Sonnet 4，短查询由 prism-coder 框架承载。

**简洁 AI 模式** — 打开 AI 对话时，词汇预测条会自动隐藏（组织问题时预测词并无用处），从而保持对 AI 响应和发送按钮的专注。

**免提 AI 对话** — 点击对话顶部的 🔁 按钮即可进入连续语音循环：每次 AI 响应完毕后麦克风会自动打开，儿童无需触碰屏幕即可持续进行完整对话。对话标题下方的状态栏可确认该模式已开启。

**翻译模式** — 当应用语言与输出语言不一致时（例如输入葡萄牙语，输出英语），每次 AI 交流都会自动路由至启用了流式传输的翻译路径，相比单语模式没有任何速度损失。

![AI 对话面板 — AI 模式下预测条已隐藏，下方可使用完整键盘](../../docs/screenshots/panel-ai-chat-v2.png)

<details>
<summary><strong>功能 + 技术细节</strong></summary>

- 停靠在键盘上方的内联面板 — 绝不使用会遮挡消息栏的弹窗
- 通过 Web Speech API 进行语音输入；麦克风按钮显示实时临时转写
- 点击任意 AI 文本行将其复制到消息栏中（保留内容创作权 — Valencia et al., CHI 2023）
- **免提循环** — 🔁 顶部按钮；AI 响应结束 1 秒后自动重启麦克风；`aria-pressed` + 绿色背景确认状态；激活时在标题下方显示状态栏
- **“Hey Prism” 唤醒词** — 可在床边模式叠加层中使用；持续的 `SpeechRecognition` 会话检测该短语并触发麦克风；iOS 原生桥接接管音频会话时不可用
- 客户端 15 秒硬超时 + 重试按钮（防止面板因网络断开而卡在“思考中…”）
- 401 / 网络 / 超时 / 其他 → 友好的错误映射；绝不直接显示原始“会话已过期”
- 离线时后备至本地 Ollama (`prism-coder:2b`)；由于浏览器同源策略，从 `synalux.ai` 发起的混合内容请求会被拦截，从而触发友好的错误提示

**渲染路径：** `components/AIChatPanel.tsx` → `services/aiService.askAI()`（或翻译模式下的 `translateAI()`）→ 来自 Synalux `/api/v1/chat` 的 SSE 流（附带 `credentials: 'include'`）。CORS 白名单包含 `synalux.ai` + 本地开发源。
</details>

---

### 🛏 床边模式

> **至关重要的无障碍功能。** 床边模式的引入是因为部分用户无法可靠地说话、打字或触摸屏幕。设计方案必须优先满足最极端的使用场景：卧在重症监护室（ICU）病床上、双臂平放、使用呼吸机、无法发出声音的患者 — 仅能通过眼动注视或两指间夹持的单个硬件开关进行沟通。

全屏 AI 沟通叠加层，专为无法触及屏幕或无法可靠发声的用户而优化。所有点击目标均经过放大处理。语音仅作为多种输入方式之一，而非唯一方式。该界面完全可以通过辅助技术进行操作：开关扫描、眼动注视、iOS 语音控制、头部追踪，或通过单个开关导航屏幕键盘。

灵感直接来源于 AAC 社区（r/AssistiveTechnology，2025 年 5 月）中卧床患者、术后恢复期及安宁疗护等场景使用者的真实反馈。

**是否支持在 Mac / Windows 上使用？** 是的。床边模式是一项渐进式 Web 应用（PWA）功能 — 可在任何设备上的任何浏览器中运行，并非 iOS 独占。

---

#### 适用人群

床边模式适用于各种不同运动和语言能力水平的用户。下文提到的“快捷短语卡片”是专为最严重精细动作障碍的群体设计的 — 适用于完全无法说话且手部活动能力极度受限或完全丧失的用户。

| 用户画像 | 推荐输入方式 |
|---|---|
| 可以说话，双臂活动受限 | 语音（🎙 麦克风按钮）+ 免提循环 |
| 有部分发声能力，语言不可靠 | “Hey Prism” 唤醒词 + 免提循环 |
| 无法说话，但可以点击屏幕 | 快捷短语卡片（单次点击） |
| 无法说话，运动能力受限 — 单开关 | 在快捷短语卡片上使用 iOS 开关控制或 Android 开关控制扫描 |
| 无法说话，手部无活动能力 — 眼控设备 | 眼动硬件（Tobii、EyeGaze Edge 等）映射为鼠标指针 — 所有卡片均可选择导航 |
| 无法说话，但头部可以活动 | 头部追踪（例如 iOS 头部指针、iPhone 16 上的相机控制） — 卡片为全尺寸导航目标 |
| 切气管 / 使用呼吸机，无法发声 | 通过眼动注视或开关选择快捷短语卡片 + 照护者辅助模式 |

---

#### 平台支持

| 平台 | 床边模式 | 快捷卡片 | 免提循环 🔁 | 唤醒词 🎯 |
|---|:---:|:---:|:---:|:---:|
| Web — Mac / Windows / Linux（任意浏览器） | ✅ | ✅ | ✅ | ✅ |
| Web — iPhone / iPad (Safari) | ✅ | ✅ | ✅ | ⚠️ 仅限 Safari |
| iOS 原生应用（App Store） | ✅ | ✅ | ✅ | ❌ 请使用免提功能 |
| Android (Chrome / Edge) | ✅ | ✅ | ✅ | ✅ |
| 眼控设备（任意 — 映射为鼠标） | ✅ | ✅ | ✅ | ✅ |
| 开关扫描（iOS 开关控制） | ✅ | ✅ | ✅ | ❌ |
| Apple Watch | ❌ | ❌ | ❌ | ❌ |

> **为何 iOS 原生应用中不支持唤醒词？** 原生桥接接管了音频会话（`prismNativeBridge.startVoice`），这与唤醒词服务所使用的浏览器 `SpeechRecognition` API 存在冲突。请改为使用 **免提循环** (🔁) — 它会在每次 AI 响应结束 1 秒后自动重启麦克风，无需任何持续输入。

---

#### 如何开始

1. 打开 **AI 对话** 面板 — 点击工具栏中的 🤖 图标。
2. 点击面板顶部的 **🛏** — 全屏叠加层将立即打开。
3. 选择您的输入方式（详见下方章节）。

<p align="center">
  <img src="../../e2e/_screenshots/bedside-overlay-open.png" alt="床边模式叠加层已打开 — 黑色全屏 UI。顶部一栏显示快捷短语卡片。中间区域显示 AI 响应。底部显示巨大的红色麦克风按钮和控制按钮行。" width="260">
  <img src="../../e2e/_screenshots/bedside-overlay-handsfree-on.png" alt="免提模式激活时的床边模式 — 🔁 按钮高亮显示为绿色，可见状态文本“Hands-Free ON”" width="260">
  <img src="../../e2e/_screenshots/bedside-hands-free-on.png" alt="处于开启状态的免提切换按钮 — 绿色背景，aria-pressed=true" width="260">
</p>

#### 如何停止 / 退出

- **触控 / 点击：** 点击叠加层右上角的 **✕**（48 × 48 px 目标）。
- **键盘 / 开关：** 按下 **Escape** 键。
- **语音：** 在叠加层打开状态下，通过 iOS 语音控制发出任何指令。

退出时，完整的对话历史和 AI 会话状态均会被保留。叠加层作为独立的渲染层叠加在主面板上方 — 关闭它不会丢失任何内容。

<p align="center">
  <img src="../../e2e/_screenshots/bedside-overlay-closed.png" alt="关闭床边模式后 — 返回至主 AI 对话面板，对话历史完好无损" width="260">
  <img src="../../e2e/_screenshots/bedside-wakeword-statusbar.png" alt="从床边模式返回后，主面板状态栏显示蓝色指示器及“Hey Prism active”" width="260">
</p>

---

### 🃏 快捷短语卡片 — 适用于非语言及行动不便的用户

> **这是无法说话或无法自由触控屏幕用户的关键路径。** 快捷短语卡片是预设的沟通按钮，可通过单次点击、眼动注视驻留或开关扫描选择来激活。无需打字、无需发声，使用时无需连接网络。

每张卡片都包含一个大型 Emoji 图标和短短的短语。点击卡片会立即将该短语填入消息栏。如果启用了 **免提模式**，该短语会自动发送给 AI。

#### 内置卡片

首次使用时会预装 15 张卡片，按紧急程度分组。这些卡片无法被删除，且支持离线使用。

**紧急（最高优先级 — 在医疗紧急情况下优先沟通）：**

| 图标 | 短语 | 适用场景 |
|:---:|---|---|
| 🆘 | HELP — EMERGENCY | 处于危险中、急救呼叫、需要医护人员立即到场的情况 |
| 😢 | I'm in pain | 身体任何部位疼痛 — 具体位置/程度可在文本中补充 |
| 🫁 | I can't breathe | 呼吸困难、气道问题、恐慌发作 |
| 🔔 | Call the nurse | 非紧急情况呼叫医护人员 |

**生理需求：**

| 图标 | 短语 | 适用场景 |
|:---:|---|---|
| 💧 | Water please | 口渴、口干、服药需要喝水 |
| 🔥 | I am too hot | 发烧、盖被过厚、体温调节 |
| 🥶 | I am too cold | 发冷、需要加盖被子、房间温度低 |
| ↔️ | Please reposition me | 缓解压力、寻求舒适体位、术后体位调整 |
| 💊 | I need my medication | 按时服药、按需给药（PRN）请求、止痛药 |

**日常沟通：**

| 图标 | 短语 | 适用场景 |
|:---:|---|---|
| ✅ | Yes | 确认 — 回答照护者的“是不是”问题 |
| ❌ | No | 拒绝 — 回答照护者的“是不是”问题 |
| ⏳ | Please wait | 需要一点时间 — 请先不要继续 |

**情感表达：**

| 图标 | 短语 | 适用场景 |
|:---:|---|---|
| ❤️ | I love you | 家人交流、情感连接 |
| 🙏 | Thank you | 表达感谢 |
| 😨 | I'm scared | 焦虑、恐惧、不适 — 可触发带有同理心的 AI 响应 |

#### 如何使用快捷短语卡片

**单次点击 / 眼动注视 / 开关选择：**
激活卡片会将其文本放入消息栏中。随后可对该短语执行以下操作：
- 发送给 AI 以获取针对性的回答（例如：点击“我感到害怕” → AI 回复安慰话语并询问进一步情况）
- 直接展示文本 — 房间内的照护者可以直接看到屏幕上被点击的卡片

**开启免提模式时：**
点击卡片的瞬间，短语就会被自动发送给 AI。AI 响应结束后 1 秒，麦克风会自动重启 — 无需任何额外操作即可实现连续对话。

**启用“Hey Prism”唤醒词时（Web / 桌面端）：**
唤醒词可与快捷卡片结合使用：用户说出“Hey Prism”打开麦克风，AI 做出回答，随后用户无需再说话，只需点击卡片即可将对话引导至新方向。

#### 如何添加自定义卡片

照护者、BCBA 及家属可以根据用户的具体沟通需求添加个性化卡片 — 例如医生姓名、常用口头禅、具体的疼痛描述、宗教表达或其他任何内容。

**步骤：**

1. 在床边模式中，点击快捷短语一栏末尾的 **＋ Add**。
2. 输入希望展示在卡片上的短语（最多 80 个字符）。
3. 点击 **Add Card** — AI 会自动生成与短语含义相匹配的 Emoji 图标（例如：“给我多拿条被子” → 🛏，“我想祈祷” → 🤲）。
4. 图标展示一段简短的“✨ Generating…”动画后，卡片即保存成功。

自定义卡片保存在设备本地（localStorage）。它们会在多次会话和应用重启后继续保留。使用已保存卡片无需注册账号或连接网络 — 仅初始生成图标时需要网络请求。

**建议添加的自定义卡片示例：**

| 建议短语 | 适用原因 |
|---|---|
| `请叫 [医生姓名] 过来` | 比通用的“呼叫护士”更快速地指定特定医生 |
| `我想见见我的家人` | 需要直系亲属到场的沟通/法律场景 |
| `请把灯关掉` | 感官过载、偏头痛、睡眠需求 |
| `我想祈祷` | 精神关怀 — 安宁疗护场景中的尊严维护 |
| `我感觉身体不舒服` | 模糊的不适信号 — 提示 AI 进行澄清式提问 |
| `我需要吸痰` | 气管切开 / 使用呼吸机的患者 |
| `我的输液管很疼` | 液体渗漏、静脉炎预警 |
| `我想回家` | 姑息治疗 / 出院沟通 |

#### 如何删除自定义卡片

1. 点击快捷短语栏标题处的 **✏️ Edit**。
2. 每张自定义卡片上会出现一个红色的 **✕** 徽标（内置卡片受到保护，无法删除）。
3. 点击任意卡片上的 ✕ 即可将其删除。
4. 点击 **Done** 退出编辑模式。

#### 开关扫描设置（iOS）

适用于只能触发单个外接开关的用户（吹气开关、头部开关、脚踏开关、枕头开关）：

1. 通过蓝牙或 Lightning/USB-C 接口将开关连接至 iPhone/iPad。
2. 前往 **设置 → 辅助功能 → 开关控制 → 开关**，并将该开关分配为“选择项目”。
3. 前往 **开关控制 → 扫描样式** 并选择“自动扫描” — 设备将自动逐个高亮显示项目。
4. 打开 Prism AAC 的床边模式。开关控制会自动开始扫描各个快捷短语卡片。当高亮框选中目标卡片时，触发您的开关。
5. 短语会立即发送 — 无需第二次确认操作。

> 所有快捷短语卡片均带有 `data-scan-group="quick-cards"` 属性，以便辅助技术在跳转至其他 UI 区域前对整栏进行分组扫描。

#### 眼动注视设置

眼动硬件（Tobii Dynavox、EyeGaze Edge、PCEye、MyTobii P10 等）在操作系统中会被映射为带驻留点击功能的标准鼠标指针。Prism AAC 中无需进行额外特殊配置：

1. 在您的眼控设备软件中配置驻留时间（初次使用者建议设置为：800–1200 ms）。
2. 在任意浏览器中打开 Prism AAC 的床边模式。
3. 将视线驻留于快捷短语卡片上即可触发激活。

卡片的最小尺寸（88 × 80 px）符合 WCAG 2.5.5 AAA 级目标的尺寸要求（44 × 44 CSS px），且超出了眼动交互通常推荐的最小尺寸（60 × 60 px）。

---

<details>
<summary><strong>全部功能 + 技术实现细节</strong></summary>

**五个子系统作为一个整合功能发布：**

1. **快捷短语卡片** — `services/bedsideCards.ts` + `components/BedsideOverlay.tsx` 中的展示一栏。

   - 存储：`localStorage` 键名 `prism_bedside_cards_v1`。每次加载时均进行 Schema 校验 — 格式损坏的条目将被静默丢弃。
   - 上限：最多 50 张自定义卡片（防止存储空间无休止膨胀）。
   - 内置卡片：15 个带有 `builtin-` 前缀 `id` 的条目；删除 UI 的保护拦截会在展示 ✕ 徽标前校验该前缀，确保默认卡片不会被移除。
   - AI 图标生成：`services/aiService.ts → inferCardIcon(text)`。采用与应用其余部分相同的本地 Ollama → Synalux 云端路由链。以锁定系统提示词（“Reply with exactly one emoji…”）将短语作为用户消息发送。提取响应中的第一个 Unicode 码点。始终安全返回 — 遇网络错误或非 Emoji 响应时退回至 💬。
   - 离线支持：卡片完全支持离线使用；仅添加新卡片时需要网络（用于生成图标 — 离线时自动退回至 💬）。

2. **免提 AI 循环 (🔁)** — 亦可从主 AI 对话标题栏触发。每次 AI 响应完毕后，麦克风会自动重启（延迟 1 秒）。采用了 `handsFreeRef` / `startListeningRef` 引用模式，确保 Effect 始终调用最新的回调函数，而无需在每次渲染时重新运行。

   ![主 AI 面板中的免提状态栏](../../e2e/_screenshots/bedside-hands-free-statusbar.png)

3. **床边模式叠加层** — `fixed inset-0 z-50 bg-black` 全屏深色 UI，作为主 AI 面板的同级 `<Fragment>` 进行渲染，确保面板状态在打开/关闭循环中得以保留。无障碍性：`role="dialog"`、`aria-modal="true"`、`aria-label="Bedside Mode"`，符合 WCAG 2.1 SC 2.1.2 焦点陷阱标准（Tab/Shift+Tab 在叠加层内部循环，`Escape` 键执行关闭）。视口覆盖率经过独立端到端验证（≤ 4 px 容差）。

   - **大型麦克风按钮** — 112 × 112 px (`w-28 h-28`)，倾听时呈现红色 + 脉动效果，静止时呈现白色边框。经过 Playwright `boundingBox()` 验证 ≥ 96 px。
   - **快捷卡片栏** — 水平滚动行，每张卡片 `88 × 80 px`，带有用于开关扫描分组的 `data-scan-group="quick-cards"`，以及符合屏幕阅读器语义的 `role="list"` / `role="listitem"`。
   - **控制按钮行** — 免提模式（开启时呈绿色）、“Hey Prism”唤醒词（开启时呈蓝色，当 `!wakeWordSupported` 时隐藏）、iOS 语音控制快捷方式。
   - **退出** — ✕ 按钮 (`w-12 h-12`) 或 `Escape` → `onClose()` → `AIChatPanel` 中的 `bedsideModeActive = false` → 根据 WCAG 2.4.3 要求，焦点归还至打开该对话框的 🛏 按钮。

   ![床边模式叠加层 — 已关闭，返回主 AI 面板](../../e2e/_screenshots/bedside-overlay-closed.png)

4. **“Hey Prism” 唤醒词** — `services/wakeWordService.ts`。在后台运行持续的 `SpeechRecognition` 会话。检测到任何包含“hey prism”的转写文本时，触发一次麦克风，随后重置进入下一个循环。保护拦截：当 iOS 原生桥接接管麦克风时（存在 `prismNativeBridge?.startVoice`）不启动。关闭叠加层后，唤醒词激活状态将展示在主面板状态栏中。

   ![状态栏显示“Hey Prism”处于激活状态](../../e2e/_screenshots/bedside-wakeword-statusbar.png)

5. **iOS 语音控制指南** — 点击控制行中的 📱 会尝试调用 `prismNativeBridge.openSettings('accessibility')`（在支持的原生构建中深度跳转至辅助功能）。在 Web / 桌面端，它会后备显示叠加层内部的说明卡片，指引完成 `设置 → 辅助功能 → 语音控制 → 开启`。

   <p align="center">
     <img src="../../e2e/_screenshots/bedside-voice-control-card.png" alt="iOS 语音控制说明卡片 — 在 Web/桌面端点击 📱 时，床边模式叠加层内显示的逐步指南" width="260">
     <img src="../../e2e/_screenshots/bedside-voice-control-dismissed.png" alt="关闭说明卡片后的 iOS 语音控制 — 叠加层恢复为正常的床边模式布局" width="260">
   </p>

**测试覆盖率：**
- `services/bedsideCards.test.ts` — 22 个单元测试：默认卡片集、localStorage 存储读写、异常 JSON 后备、非法卡片过滤、50 张卡片上限、`createCard` 字段约束。
- `e2e/bedside-mode.spec.ts` — 17 个 Playwright 端到端测试：按钮可见性、`aria-pressed` 状态切换、绿色/蓝色状态类名、状态栏文本、叠加层无障碍属性、麦克风 `boundingBox` 尺寸、视口覆盖率、说明卡片显示/关闭。

**核心文件：**
- `components/AIChatPanel.tsx` — 床边模式状态、卡片状态 (`bedsideCards`)、`handleAddBedsideCard`、`handleDeleteBedsideCard`、免提循环、唤醒词生命周期、标题栏按钮
- `components/BedsideOverlay.tsx` — 叠加层 UI、快捷卡片栏、添加卡片对话框、编辑模式、焦点陷阱、语音控制说明卡片
- `services/bedsideCards.ts` — `BedsideCard` 类型定义、`DEFAULT_BEDSIDE_CARDS`、`loadCards`、`saveCards`、`createCard`
- `services/aiService.ts` → `inferCardIcon(text)` — AI Emoji 推断
- `services/wakeWordService.ts` — 持续唤醒短语检测
</details>

---

### 📨 发送消息 — 服务提供商选择器
当某个联系人配置了多种服务提供商（例如同时配置了邮件和短信）时，撰写区域上方会出现 **“Send via”** 区域。在撰写前只需点击一次即可切换提供商 — 无需离开面板。

![联系人服务提供商选择器 — 'Send via' 行高亮显示绿色 Mail，SMS 选项可用](../../docs/screenshots/contact-provider-picker.png)

---

### 💬 AAC 聊天
来自已连接服务提供商（Telegram、WhatsApp、Email、Slack 等）的接收消息将落入此面板中。工具栏上的未读徽标会显示数量，新消息到达时会触发警报 + 跨标签页通知，点击消息行会将其复制到输入栏中，以便儿童用自己的声音撰写回复。

![显示照护者来信和未读徽标的 AAC 聊天面板](../../docs/screenshots/panel-aac-chat.png)

<details>
<summary><strong>功能 + 技术细节</strong></summary>

- 通过 Synalux 门户 `/api/v1/prism-aac/inbox/poll` 进行轮询收件箱（若未配置门户，遇 404 不执行任何操作）
- 收到新消息时进行跨标签页 `BroadcastChannel` 通知
- 服务提供商抽象：添加 Outlook / Slack / Discord 各只需 ~30 行代码
- 已读状态同步更新，照护者可以看到儿童何时阅读了消息
- 免费层：1 个已连接提供商；付费层：无限制
- 单条消息 TTS 朗读，儿童可以用偏好的声音听取来信文本

**渲染路径：** `components/AACChatPanel.tsx` → `services/inboxPolling.ts`（当 sidePanel === 'aac-chat' 时 5 秒轮询，否则 60 秒轮询）→ `useScheduleStore.setIncomingMessages()`。每条消息还会作为“来自照护者的消息”音轨追加到日程表中。
</details>

---

### 🧮 学科学科
网格画布承载了 **19 个学科键盘**，涵盖高中全部课程：数学 + 科学 + 编程 + 艺术 + 人文。每个标签页都会将 AI 导师引导至特定领域的提示词模板（共 33 个模板），因此模型绝不会将代数推理应用到庞氏图上，也不会将音乐强弱记号误认为是编程字面量。**历史学科具有语言 + 地区感知能力**，可细化至州 / 省 / 邦 / 自治区层级 — 覆盖 23 个国家的 280+ 个地区。

![单元格网格画布，单元格中输入了 5 + 7 = 12](../../docs/screenshots/math-canvas-typed.png)

<details>
<summary><strong>学科标签页（共 19 个）</strong></summary>

**数学（9 个键盘）** — 主键盘、高等数学（π √ 指数 + 5 种修饰工具：分数框、长除法房屋、根号条、求和线、分数条）、a–z、杂项数学（集合论 + 逻辑）、时间与距离、重量、体积、几何、货币。

**科学（4 个）** — 化学（24 种元素 + 反应箭头 + 电荷 + 下标 + 相态标记）、物理（完整希腊字母 + 16 个国际单位 + ∫/∂/∇/∑/∏ + 常数）、生物（DNA/RNA + 遗传学 + 8 个分类等级 + 12 个细胞器）、统计学（μ σ x̄ + 12 种运算符 + 分布）。

**编程（2 个）** — Python（24 种运算符 + 26 个关键字）和 Java（24 种运算符 + 26 个关键字）。代码在每个单元格中提交一个字符，从而在等宽网格上自然排版。

**艺术 + 人文（4 个）** — 音乐（3 种谱号 + 6 种音符 + 5 种休止符 + 5 种变音记号 + 8 种强弱记号）、地球科学（天气 + 板块 + 10 颗行星 + AU/ly/pc/Mya/Gya）、历史（语言 + 地区感知）、语言艺术（12 种词性标签 + 6 种句型 + 标点符号 + 引用格式）。

</details>

<details>
<summary><strong>AI 导师 — 11 个领域 × 3 种模式 = 33 个提示词</strong></summary>

![画布上方带有模拟提示的 AI 导师叠加层](../../docs/screenshots/math-tutor-hint.png)

每个学科提供三种模式：💡 **提示**（温和的下一步引导，绝不直接给答案）、✓ **检查**（验证儿童的答案，正确时给予鼓励）、🎓 **解答**（完整的逐步讲解，最多 4 步）。当前激活的标签页会告知导师儿童正在学习哪个学科。15 秒硬超时 + 重试按钮，确保叠加层不会卡死。
</details>

<details>
<summary><strong>历史 — 语言 + 地区感知</strong></summary>

![英语环境下的历史键盘（无指定地区）— 通用 + 国家层级](../../docs/screenshots/math-keyboard-history-en.png)
![US-TX 地区的历史键盘 — 阿拉莫、德克萨斯并入美国、肯尼迪事件呈现](../../docs/screenshots/math-keyboard-history-us-tx.png)

三层堆叠架构：
1. **通用** 适用于每个教学大纲的事件（476 年、1914 年一战、1939 年二战、1969 年登月）
2. **国家** 由 `language` 选择的事件（en、es、fr、de、ro、ru、uk、ja、ko、zh、ar、it、pl、nl、he、hi、vi、tr、pt） — 支持 19 种语言
3. **地方级** 由 `historyRegion` 选择的事件（US-TX、CA-QC、UK-SCT、ES-CT、IN-MH、DE-BY…） — **覆盖 23 个国家的 280+ 个地区**，包括美国全部 50 个州 + 华盛顿特区、加拿大 13 个省/地区、英国全部 4 个组成国、爱尔兰（共和国 + 4 个历史省份）、德国全部 16 个联邦州、西班牙全部 17 个自治区、意大利全部 20 个大区，以及 AU、FR、MX、BR、IN、CN、RU、BE、CH、NL、AR、ZA、KR、PK、NZ、PL。

导师提示词带有语言 + 地区标识，因此在 `US-TX` 地区，像 1836 年这样存在歧义的年份会被解析为阿拉莫之战（而非阿拉巴马建州）；在 `CA-QC` 地区，1759 年锚定为亚伯拉罕平原战役；在 `ES-CT` 地区，1714 年锚定为巴塞罗那陷落。

</details>

<details>
<summary><strong>测试工作流 — 12 个学科 × 8-12 年级应用题 × 72 个 Playwright 测试</strong></summary>

演练每个学科键盘的逐步问题集，并为每个问题配备一个可执行的 Playwright 测试，用来驱动实时数学面板并验证每个步骤的字符是否准确落入单元格网格中。直接以真实的 9 年级代数参考页面为模型构建。

- **第 1 层 — 逐步通用测试：** [`tests/workflows/`](../../tests/workflows/) — 12 个 Markdown 文件（高等数学、生物学、化学、地球科学、几何学、历史学、语言艺术、杂项数学、物理学、Java 编程、Python 编程、统计学）。
- **第 2 层 — 分年级真实课堂测试：** [`tests/workflows/grade-8-12/`](../../tests/workflows/grade-8-12/) — 12 个包含具名变量应用题的 Markdown 文件（9 年级代数、10 年级几何、11 年级物理、10 年级化学、9 年级生物、11 年级统计学、9 年级 Python 编程、11 年级 Java 编程、12 年级预备微积分、9 年级地球科学、8 年级语言艺术、10 年级世界历史）+ 单学科键盘差距报告 [`REPORT.md`](../../tests/workflows/grade-8-12/REPORT.md)。
- **第 3 层 — Playwright 端到端测试：** [`e2e/math-workflows/`](../../e2e/math-workflows/) — 72 个测试（`npx playwright test --project=desktop e2e/math-workflows`）。

完整索引、亟需补充的学科排名以及“如何添加新工作流”的手册 → **[`docs/WORKFLOWS.md`](../../docs/WORKFLOWS.md)**。

</details>

<details>
<summary><strong>数学的其他功能（锁定工具、两次点击放大、保存 / 同步）</strong></summary>

- **锁定工具** — 儿童完成解答后，可锁定该区域。被锁定的单元格会稍显暗淡且拒绝修改。
- **两次点击放大** — 第一次点击预备按键（1.4 倍放大 + 绿色光圈），第二次点击确认提交。2 秒后自动取消预备状态。适用于运动精准度欠佳的用户。
- **保存 + 同步** — 优先本地存储至 `localStorage`；点击 `↻ Sync` 按钮尽力同步至 Synalux 门户。上限 100 份文档 / 200 KB 体积；超限淘汰最旧文档。
- **按压驻留** — 每个按键均可配置驻留时间（0–1500ms），带有绿色进度环。

![显示一个条目和同步按钮的已保存文档叠加层](../../docs/screenshots/math-docs-overlay.png)
![处于绿色光圈预备放大状态的数字按键](../../docs/screenshots/math-two-hit-armed.png)
![处于预备状态的锁定工具，提示用户点击区域的角点](../../docs/screenshots/math-lock-armed.png)

</details>

<details>
<summary><strong>学科学科键盘 — 更多图片</strong></summary>

![带有 H₂O 的化学键盘](../../docs/screenshots/math-keyboard-chemistry.png)
![带有 A T G 的生物学键盘](../../docs/screenshots/math-keyboard-biology.png)
![带有 `private String` 的 Java 键盘](../../docs/screenshots/math-keyboard-java.png)
![音乐键盘](../../docs/screenshots/math-keyboard-music.png)
![统计学键盘](../../docs/screenshots/math-keyboard-statistics.png)
![地球科学键盘](../../docs/screenshots/math-keyboard-earth-science.png)
![语言艺术键盘](../../docs/screenshots/math-keyboard-language-arts.png)
![罗马尼亚语环境下的历史键盘](../../docs/screenshots/math-keyboard-history-ro.png)

</details>

---

### 🗓 日程表
用于日常作息 + 过渡支持的视觉化“先…然后…”日程表。每个步骤都是一个图片贴片 + 标签；完成一个贴片会播放提示音并显示视觉进度标记。奖励商店（付费层）会在作息流程结束后解锁。

![带有先-后板 + 活动列表的日程表面板](../../docs/screenshots/panel-schedule.png)

<details>
<summary><strong>功能 + 技术细节</strong></summary>

- 24 个预设贴片网格，用于一键添加活动：起床、刷牙、吃早餐、上学、吃点心、吃午饭、游玩、阅读、美术、散步、吃晚饭、洗澡、睡前故事、睡觉、吃药、用牙线、整理房间、洗衣服、照料宠物、体育运动…
- 拖拽重新排序；铅笔图标内联编辑；预设添加带有 `textKey`，因此切换语言会自动更新标签
- 先-后状态机：预备贴片脉动、定时器到期播放 3 音阶上行提示音、减弱动态效果（`prefers-reduced-motion` → 静态环）、`aria-pressed` 语义
- 音频预热：微弱的 1Hz 振荡器可保持 iOS Safari 上的 AudioContext 处于“运行”状态，以便在长时间静音后定时器提示音能正常播放（若无预热，提示音会在挂起的上下文触发 = 听不到声音）
- 来自照护者的消息会作为“消息”音轨追加到日程表中，以便儿童了解接下来的安排及谁发来了消息

**渲染路径：** `components/SchedulePanel.tsx` → `useScheduleStore`（24 个预设活动 + 自定义）→ `services/feedback.ts:playTimerRing()` → 通过 `services/azureTTS.ts:warmupAzureAudio()` 共享 AudioContext。
</details>

---

### 🎮 游戏
12 款基于循证医学的 AAC 游戏。专为沟通教学设计，**而非用于消磨屏幕时间**。每款游戏都会记录表达内容和准确率，以便自适应引擎推荐最契合的下一款游戏。

![包含 9 个游戏贴片的游戏面板](../../docs/screenshots/panel-games.png)

<details>
<summary><strong>12 款游戏 + 技术细节</strong></summary>

| 游戏 | 训练技能 |
|---|---|
| 戳气泡 | 因果关系，主动沟通意图 |
| 寻找颜色 | 接受性词汇（颜色名称） |
| 我的故事 | 叙事排序 |
| 对对碰 | 配对 + 分类思维 |
| 是不是 | 二元辨析，请求/拒绝 |
| 完成句子 | 句子补全（完形填空） |
| 分类归纳 | 语义分类 |
| 情绪配对 | 情感命名，心理理论 (ToM) |
| 下一步是什么 | 顺序推理 |
| 相同 / 不同 | 视觉辨析 — 寻求共同点或对比 |
| 声音对对碰 | 听觉辨析 + 词汇量 |
| 轮流练习 | 社交轮流互动练习 |

- 所有 12 款游戏均可免费使用；无任何游戏受订阅计划限制
- 每款游戏的数据均会输入至 `services/adaptiveEngine.ts` — 表达长度 / 分类 / 发生时间 / 结果 → 推荐下一款游戏
- 所有游戏均会自动禁用与该游戏词汇无关的 AAC 贴片分类，防止儿童注意力分散

**渲染路径：** `components/GamesPanel.tsx` → `components/games/` 中的各个游戏组件。每款游戏通过 `useScheduleStore.recordMessage(text, category)` 记录数据。
</details>

---

### 🏪 应用市场
语音包（Inworld 语音，兄弟姐妹/父母的自定义克隆语音）、词汇包（西班牙语核心词汇，手势辅助语音）、游戏包（9 款基础游戏之外的额外游戏）。安装的应用会接入工具栏，采用与内置面板相同的注册表。

![包含可安装应用的应用市场面板](../../docs/screenshots/panel-marketplace.png)

<details>
<summary><strong>功能 + 技术细节</strong></summary>

- 应用以 JSON 条目形式存在（`lib/marketplace/manifests/local.ts`）+ 运行时的 `lib/marketplace/registry.ts`，通过 `getHandler(appId)` 返回面板组件
- 声音克隆（付费层）：90 秒录音 → 训练出的声音可用于应用中的任何 TTS，包括分类贴片
- 已安装的应用会按顺序渲染在内置应用之后的工具栏按钮中；`useSettingsStore.installedApps` 为单一事实来源
- 订阅层拦截：应用市场展示所有内容，但高于用户当前订阅计划的项目安装按钮将被禁用

**渲染路径：** `components/MarketplacePanel.tsx` → `useMarketplaceStore` → 后端 `synalux/api/v1/marketplace/...` 用于购买，随后将资源（语音文件、词汇 JSON）下载保存至 IndexedDB。
</details>

---

### 📄 PDF 阅读器
打开 PDF，每个页面呈现为一个贴片，点击即可用您的声音朗读。学校练习册、带 home 字母、文章 — 导入任何 PDF，用倾听代替艰难的阅读。无需安装 Adobe Reader；整个库完全在您的浏览器中运行。

![PDF 阅读器面板 — 带有“+ 打开 PDF”提示的空白状态](../../docs/screenshots/panel-pdf-reader.png)

<details>
<summary><strong>功能 + 技术细节</strong></summary>

- 每个页面呈现为一个贴片；每个贴片显示前 3 行内容 + 一个 `▶ 第 N 页` 按钮，通过 `aacSpeak()` 进行播放（与其他功能保持相同的声音 + 语调 + 词汇高亮）
- `▶ 朗读全部` 可将所有页面串联为一个连续的朗读段落
- 空白页检测（扫描件 PDF）会自动提示使用 OCR 工具
- 首次打开时动态导入 `pdfjs-dist` — 来自 CDN 的独立 ~3 MB 分包，版本锁定至 npm 包
- 工具栏按钮（📄）可通过 设置 → 工具栏 进行手动开启，保持默认工具栏简洁

**渲染路径：** `components/PdfReaderPanel.tsx` → `services/pdfReader.ts`（pdfjs `getDocument` → 逐页 `getTextContent`）→ `services/aacSpeak.ts`。
</details>

---

### 👁 截图阅读器 (OCR)
粘贴或上传练习册照片、网页截图、教科书页面照片 — 识别出的文本会展示在图片旁，您可以点击 **▶ 朗读** 进行听取，或点击 **↧ 发送至消息栏** 在朗读前进行编辑。

![截图阅读器 (OCR) 面板 — 带有“+ 打开图片”提示的空白状态](../../docs/screenshots/panel-ocr-capture.png)

<details>
<summary><strong>功能 + 技术细节</strong></summary>

- 20 种语言的 OCR 矩阵，从 PrismAAC Locale 映射至 Tesseract 代码（eng / spa / fra / por / deu / ron / ukr / rus / jpn / kor / chi_sim / ara / ita / pol / nld / heb / hin / vie / tur / ind）
- 每种语言的 traineddata 文件在首次使用后缓存（英语约为 ~10 MB，中日韩语言更大） — 首次运行显示“正在读取图片…（首次运行需下载 OCR 模型 — 可能需要 10-30 秒）”
- 显示置信度百分比，以便 AAC 用户判断是否信任识别结果或重新拍摄
- `disposeOcr()` 清理 Hook 会在页面卸载时终止所有创建的 Worker，释放 WASM 内存
- 工具栏按钮（👁）可通过 设置 → 工具栏 进行手动开启

**渲染路径：** `components/OcrCapturePanel.tsx` → `services/ocr.ts`（`tesseract.js` `createWorker` → `recognize`）→ `services/aacSpeak.ts` 或 `messageStore.setText`。
</details>

---

### 🎧 舒缓播放器

专为住院患者设计的床边媒体播放器 — 适用于昏迷、ICU、非语言表达或任何需要在床边持续播放舒适内容的用户。

<details>
<summary>功能细节</summary>

家人和朋友可以录制语音消息、上传照片和视频。播放列表会自动循环播放，让熟悉的声音和面孔时刻陪伴在患者身边。

- 直接在应用中 **录制** 语音消息（MediaRecorder API）
- **上传** 音频文件、照片和视频片段（单文件限 100 MB，总量限 500 MB）
- 自动 **无缝循环** 播放所有内容 — 设置完毕后即可离开
- 照片和视频支持 **全屏** 模式（床边展示）
- 集成 **原生 TTS** — 点击短语可通过 iOS 上的 AVSpeechSynthesizer 朗读
- **离线** 可用 — 所有媒体文件保存在 IndexedDB 中，无网状态下正常工作
- 支持 **键盘无障碍操作** — 每个控制项均具备 ARIA 标签和键盘导航
- 通过 **军工级审查** — 修复了 27 项安全缺陷（Blob URL 泄露、配额处理、输入校验、MIME 白名单、卸载清理）
- 工具栏按钮（🎧）可通过 设置 → 工具栏 进行手动开启

**存储限制：** 最多 50 个文件，单个文件最大 100 MB，总量上限 500 MB。MIME 类型限制为音频 (webm/mp4/mpeg/ogg/wav)、图片 (jpeg/png/gif/webp/heic) 和视频 (mp4/webm/quicktime)。

**渲染路径：** `components/ComfortPlayerPanel.tsx` → `store/comfortPlayerStore.ts` (Zustand + 持久化) → `services/comfortMediaStorage.ts` (IndexedDB Blob)。
</details>

---

### 🧩 Chrome 扩展程序 — 在任何文本框中享受相同的阅读辅助功能
PrismAAC Web 应用在其自身界面中涵盖了阅读辅助流程。Chrome 扩展程序 (`chrome-extension/`) 则将 **相同的体验带到了任何网站上的任意文本框中** — Gmail、Google Docs、Word Online、学校门户、银行表单 — 填补了此前仅靠网页无法覆盖的 Read & Write 体验空白。

![PrismAAC 阅读助手 — 边打字边朗读，带有逐词高亮，适用于任何文本框](../../docs/screenshots/extension-marquee.png)

悬浮叠加层会自动附着在获取焦点的文本框上方。点击 **▶ 朗读** 重新听取，或继续打字 — 用 `.?!` 结束句子时会自动朗读，读出的每个词汇都会高亮显示为黄色：

![撰写页面上方的 PrismAAC 叠加层，句中，TTS 朗读时“school”高亮显示为黄色](../../docs/screenshots/extension-overlay.png)

边朗读边翻译功能会同时展示源语句（斜体小字）和翻译后的语句（正常字号，朗读时激活词汇高亮）。通过 Google 免费公共接口支持 50+ 种语言（无需 API 密钥）：

![PrismAAC 扩展程序将英语翻译为罗马尼亚语 — 源语句“I had a really good day at school today”，下方为翻译出的“Am avut o zi foarte bună la școală astăzi”，“foarte”处于高亮状态](../../docs/screenshots/extension-translate.png)

选项页面 — 设置可通过 `chrome.storage.sync` 在用户的 Chrome 配置文件之间自动同步。支持针对特定网站的禁用列表、语音选择器、语速 / 音量 / 音调滑块、语言选择器，全由用户自主开启：

![PrismAAC 扩展程序选项页面 — 朗读触发条件、目标语言罗马尼亚语、语音选择器、语速/音量/音调滑块](../../docs/screenshots/extension-options.png)

**安装（目前为开发者模式 — Chrome Web Store 审核中）：**

```sh
cd chrome-extension
npm install
npm run build
```

打开 `chrome://extensions`，启用 **开发者模式**，点击 **加载已解压的扩展程序**，并选择 `chrome-extension/dist`。

**功能：**

- 遇到 `.?!` 自动朗读句子，按下空格键自动朗读单个词汇，均可独立开关
- 由浏览器原生的 `SpeechSynthesisUtterance.boundary` 事件驱动 **逐词高亮显示**（实现真正的逐词精准同步；对比 Web 应用采用的 ~60 ms/字符估算方法 — 门户路径返回无流式事件的 MP3，而 Web Speech API 原生暴露了这些事件）
- **边朗读边翻译** — 选择目标语言（通过 Google 免费公共接口支持 50+ 种语言，无需 API 密钥）。叠加层会同时展示源语句（斜体小字）和翻译后的语句（带当前朗读词汇高亮）；系统会自动匹配并选择与目标语言相符的 Web Speech 语音
- 锚定在获得焦点的输入框上方的悬浮 Shadow-DOM 叠加层（▶ 朗读，📌 固定，× 关闭）
- 按下 `Cmd / Ctrl + Shift + S` 可根据需要朗读当前焦点的输入框；按下 `Esc` 取消
- 针对银行 / 敏感表单的单网站禁用列表
- 设置通过 `chrome.storage.sync` 在用户的 Chrome 配置文件间自动同步 — 无需 PrismAAC 账号

**隐私：** 未启用翻译模式时完全离线（Web Speech 在本地原生运行）。翻译模式会对每一个独立句子向 `translate.googleapis.com` 发起一次 HTTPS 请求（首次请求后会自动缓存）。源代码位于 [`chrome-extension/`](../../chrome-extension/) — TypeScript + esbuild 打包（Content 18 KB，Options 7 KB，Background 339 B）。

---

### 👋 无障碍手势
可选的基于摄像头的输入方式，专为无法可靠进行触控点击的用户设计。支持头部姿态驻留点击 + 手部姿态手势配置文件。完全在本地运行 — 视频数据绝不离开设备。

<details>
<summary><strong>功能 + 技术细节</strong></summary>

- **基础模式**：头部姿态追踪 (FaceLandmarker, Mediapipe)。用户注视某个按键，保持视线达到 `headTrackingDwellMs`（默认 1200 ms）→ 触发点击。驻留期间视觉进度环会自动填满。
- **高级模式**：手部姿态追踪。可通过 `components/HandCalibration.tsx` 配置自定义单用户手势配置文件（张开手掌 = 回车，握拳 = 退格，捏合 = 空格等）。
- 偏移安全防护：若用户的头部在连续 `headTrackingDriftWindowMs` 帧内偏移超出 `headTrackingDriftThresholdPx`，追踪会自动禁用并弹出重新校准提示（用户于 2026 年 5 月反馈：此前追踪会在一小时内静默发生偏移，导致无法命中实际的目标按键）。
- **Esc 逃生通道** — 在任何键盘上按下 Esc 会立即禁用追踪并重新展示 QWERTY 键盘，且不会丢失消息栏的内容。
- 摄像头流单例模式 (`services/cameraStream.ts`)，头部 + 手部追踪器共享同一个视频流；切换模式零开销。
- 单用户校准数据持久化存储；主体追踪器会在会话恢复时自动复原。

**详细文档：** [`docs/TRACKING_MATH.md`](../../docs/TRACKING_MATH.md)（校准数学模型、百分位学习器、自我运动、一欧元过滤器、~30 个可调参数）、[`docs/GESTURE_RECOGNITION.md`](../../docs/GESTURE_RECOGNITION.md)、[`docs/TRACKING_RELIABILITY.md`](../../docs/TRACKING_RELIABILITY.md)。
</details>

---

### 👁 视觉语境 — 摄像头驱动的短语推荐

将摄像头对准日常物品，预测条会立即浮现相关短语。桌子上的水杯和叉子 → “我还想要”、“请给我水”、“吃好了”。床 → “我累了”、“晚安”。书本 → “请帮帮我”、“我不明白”。**这是任何其他 AAC 竞品都不具备的功能。**

| 场景 | 识别出的物品 | 推荐的短语 |
|---|---|---|
| 🍽️ 就餐 | 水杯、叉子、勺子、碗、瓶子 | “我还想要”、“请给我水”、“吃好了”、“好吃”、“太烫了” |
| 😴 睡觉 | 床、泰迪熊 | “我累了”、“晚安”、“讲个故事”、“请抱抱我” |
| 📚 上课/做作业 | 书本、笔记本电脑、键盘 | “请帮帮我”、“我不明白”、“做完了”、“还需要时间” |
| 🎮 游玩 | 泰迪熊、运动皮球 | “我想玩”、“轮到我了”、“真好玩！”、“再玩一次！” |
| 🛁 卫生间 | 马桶、洗手池 | “我要上厕所”、“洗手”、“帮帮我” |
| 📺 看电视 | 电视、遥控器、沙发 | “我想看电视”、“把它关掉”、“声音太大了” |

短语支持 12+ 种语言（英语、西班牙语、法语、葡萄牙语、罗马尼亚语、乌克兰语、俄语、德语、日语、韩语、中文、阿拉伯语等）。语言会自动跟随应用的语言设置 — 切换至俄语，摄像头推荐的短语会自动由 “I want more” 变为 “Хочу ещё”。

![视觉语境 — 检测到就餐场景](../../docs/screenshots/vision-mealtime.png)

<details>
<summary><strong>工作原理（技术细节）</strong></summary>

**流水线：** 摄像头（通过引用计数的 `cameraStream.ts` 共享）→ MediaPipe ObjectDetector（EfficientDet-Lite0，4 MB int8，WASM）→ 场景推理（确定性规则，11 种场景类型）→ 预测条注入（`setAiCompletion` + `learnWord` N-Gram 提升）。

**性能表现：**
- 运行帧率为 **2 FPS**（每 500 ms 执行一次检测）— 静态物品移动缓慢，极大节省电量
- CPU 占空比：移动设备上 **< 6%**
- 模型体积：**4 MB**（int8 量化的 EfficientDet-Lite0，加载至现有的 MediaPipe WASM 运行时中）
- 额外内存总占用：**~5 MB**（模型 + 缓冲区 + 短语词汇表）
- 发热保护：发热降频时会自动降级至 1 FPS → 暂停 30 秒

**隐私保护：**
- 100% 端侧运行 — 摄像头画面 **绝不离开设备**，无任何云端推理
- 检测结果 **即用即弃** — 不会持久化保存至 localStorage 或云端
- `person`（人）类别虽会被检测，但 **绝不展示** 给用户，也不用于短语推荐
- 目标检测期间不展示任何摄像头预览画面

**安全机制：**
- 该功能默认 **关闭** — 照护者必须在 设置 → 输入模式 → 视觉语境 中显式开启
- 视觉推荐短语 **绝不会自动朗读** — 儿童必须主动点击/驻留才会触发朗读
- 紧急短语在架构上独立存在，**绝不会被视觉推荐短语挤占**
- 场景必须保持稳定达到 **连续 3 帧**（约 ~1.5 秒）才会激活 — 防止画面闪烁

**目标检测模型：** [EfficientDet-Lite0](https://ai.google.dev/edge/mediapipe/solutions/vision/object_detector) — 80 个 COCO 类别，托管在 Vercel CDN 上，与现有的 MediaPipe 人脸/姿态模型同源。与头部追踪共用同一个 WASM 运行时。

**场景推理：** 确定性规则引擎（无额外 ML 模型）。规则将物品组合映射至场景，并带有时间段加权：正午时分出现 `水杯 + 叉子 + 勺子` = `就餐`（置信度 0.90）。共有 11 种场景类型，每种类型均包含可配置的物品集和时间段权重加成。

**预测注入：** 调用 `predictionStore` 中的两个既有 Hook：
1. `setAiCompletion(phrase)` — 将最匹配的短语放置在最左侧的预测贴片上
2. `learnWord(word, prev)` — 通过带有 10 倍用户权重的合成 N-Gram 提升场景相关词汇

当物品离开画面 30 秒后，视觉提升效果会自动衰减。主动打字会抑制视觉推荐（用户意图优先）。

**核心文件：**
- `services/objectDetectionService.ts` — 摄像头获取、MediaPipe 循环、发热保护
- `services/sceneInference.ts` — 规则引擎、11 种场景类型、时间段加权
- `services/visionPredictionBridge.ts` — 场景 → 预测条注入桥接
- `constants/visionPhrases.ts` — 精选短语 × 12+ 种语言（按场景分类）
- `constants/objectVocabulary.ts` — 30 个 COCO 物品标签 → 本地化词汇数组
- `store/visionStore.ts` — 即用即弃的 Zustand Store（不持久化保存）
- `hooks/useVisionContext.ts` — 连接 检测 ↔ 桥接 ↔ 设置 的 React Hook

**测试：** 62 个单元测试，覆盖场景推理规则、物品词汇表完整性、短语语言覆盖率、Store 生命周期以及全流水线集成（物品 → 场景 → 短语 → Store）。

**Safari 环境端到端验证结果：**
```
SCENE=mealtime   CONF=0.90 PHRASES=I want more|Water please|All done     BADGE=🍽️
SCENE=bedtime    CONF=0.70 PHRASES=I'm tired|Good night|Read a story     BADGE=😴
SCENE=schoolwork CONF=0.80 PHRASES=Help please|I don't understand|Done   BADGE=📚
```
</details>

---

### ⚙️ 设置
25 种语言 / 28 个地区版本、主题（浅色 / 深色 / 高对比度）、网格大小（4–20 个贴片）、运动调节（数学按压驻留、两次点击放大、头部追踪驻留、手势灵敏度、偏移自动禁用）、语音选择器（所有人免费）、语音缓存使用与保留、AI 自动纠错开关、通知设置、工具栏自定义、历史地区选择器，以及带 Cloud 计划的 Synalux 账号。

![设置 — 语言选择器 + 主题切换](../../docs/screenshots/panel-settings.png)

<details>
<summary><strong>数学 + 无障碍设置</strong></summary>

![设置 — 数学按压驻留 + 两次点击放大](../../docs/screenshots/panel-settings-math.png)

- **数学按压驻留** — 0–1500 ms 滑块；0 = 立即点击，200–1500 ms 可帮助精细动作欠佳的用户（驻留期间会填满绿色进度环，便于直观感知）。
- **两次点击放大** — 第一次点击任意数学键使其进入预备状态（1.4 倍放大 + 绿色光圈，未确认提交），第二次点击确认提交。2 秒后自动取消预备状态。可与按压驻留叠加使用。
- **头部追踪驻留** — 200–5000 ms。
- **灵敏度** — 1–10。
- **偏移自动禁用** — 开关切换 + 阈值（px）+ 时间窗口（ms）。
- **显示手部校准** — 打开手部姿态配置文件编辑器。

</details>

<details>
<summary><strong>输入模式 — 语音、手势、AI 自动纠错</strong></summary>

![设置 — 输入模式面板](../../docs/screenshots/panel-settings-input-modes.png)

- **语音输入** — Web Speech API，具备语言感知能力（英式英语 vs 美式英语等）；免费层可用
- **AI 自动纠错与补全** — 每次打字停顿均会通过云端自动纠错（Gemini 2.5 Flash-Lite）进行处理。在低带宽场景下默认关闭。
- **通知** — 收到 AAC 聊天消息时触发警报 + 跨标签页通知。
- **摄像头输入** — 头部 + 手部追踪总开关。
- **摄像头追踪目标** — 头部、手部或自动检测。

</details>

<details>
<summary><strong>工具栏自定义</strong></summary>

工具栏支持完全自定义排序。0.9.0 默认版本精简了展示工具（麦克风、AAC 聊天、警报、分类、设置），确保新用户的屏幕干净不杂乱 — 所有其他内置模块（数学、AI 对话、日程表、游戏、应用市场、舒缓播放器、便签、历史、声音）均可在 设置 → 工具栏 中一键重新开启。从应用市场安装的应用会自动追加在内置模块之后。

</details>

---

## 立即体验

| | |
|---|---|
| 🌐 **Web 应用** | [synalux.ai/prism-aac](https://synalux.ai/prism-aac) — 在任何浏览器中体验 |
| 📱 **iOS** | [App Store](https://apps.apple.com/app/id6764692277) — iPhone, iPad, Apple Watch |
| 💻 **源代码** | 本仓库。AGPL-3.0 — 可自由 Fork 和分享修改版本 |

---

## 订阅计划

提供两种计划：**免费版** 和 **Prism AAC Cloud**。免费版无需试用期、无需绑定信用卡，绝无自动超额扣费。

| | 免费版 | Prism AAC Cloud — 4.99 美元/月 |
|---|---|---|
| 沟通面板、键盘和已保存短语 | ✅ | ✅ |
| 可用的设备语音与缓存语音 | ✅ | ✅ |
| 端侧 AI 和紧急沟通功能 | ✅ | ✅ |
| iOS + Web (PWA) | ✅ | ✅ |
| 新生成的自然语音朗读 | 不包含（在开始计费前仍可在公共语音路径上免费使用） | 50,000 个字符 / 月 |
| 云端 AI 请求（对话、自动纠错、预测、导师） | — | 100 次 / 月 |
| 配额重置时间 | — | 每月 1 日 00:00 UTC |

- 可在 iOS 应用内购买（Apple 应用内购买，StoreKit 2）或在 Web 端购买（Stripe）；两者赋予相同的账号权益，且每个账号仅限一个生效的订阅。取消其中一个渠道的订阅绝不会擦除另一个。
- 播放已缓存的语音和设备自带语音绝不消耗配额。当配额耗尽时，云端语音和云端 AI 将暂停使用直至重置 — 界面上的基础沟通功能绝不会受阻。
- 设置 → Synalux 账号 → **云端语音与 AI** 会展示订阅计划、配额及续订条款，并提供“通过 Apple 订阅”、“恢复 Apple 购买”、“管理订阅”以及“刷新云端计划”等选项。
- 尚存两处已知的不一致性，已在跟踪解决中：(1) 词汇预测提升、AAC 聊天提供商、照护者联系人、短信提供商以及完整的紧急载荷目前仅绑定在 Web 端 (Stripe) 订阅的 AAC 计划上，仅在 Apple 端订阅的用户暂时无法获取；(2) AI 象形图和应用市场安装绑定在 Synalux 平台计划而非 AAC Cloud 计划上，因此任意渠道的 Cloud 订阅用户暂时无法使用这些功能。语音选择器和全部 12 款游戏对所有人免费开放。

<p align="center">
  <img src="../../docs/screenshots/cloud-subscription-iphone.png" alt="iOS 应用：设置 → Synalux 账号 → 云端语音与 AI — 配额、续订条款、通过 Apple 订阅 · $4.99/月、恢复 Apple 购买" width="260" />
  <img src="../../docs/screenshots/panel-account-cloud.png" alt="Web 应用：相同区域，包含通过 Stripe 订阅 · 4.99 美元/月" width="260" />
</p>

[查看价格页面 →](https://synalux.ai/pricing) · [服务条款](TERMS.md) · [隐私政策](PRIVACY.md)

---

## 临床安全保障

- **AAC 沟通权限绝不会因任何原因受限。** 儿童必须时刻拥有发声的权利。
- **未经同意，绝不将个人健康信息 (PHI) 上传至云端。** 照护者便签在上传前必须在本地完成加密。
- **音频保留在本地。** 语音输入通过 Web Speech API 在浏览器本地转写。
- **由 BCBA（副行为分析师）参与设计。** 言语行为（Verbal Operant）追踪契合 BACB 第 5 版任务清单。
- **基于创伤知情（Trauma-informed）原则的默认配置。** 无惩罚机制。奖励商店设为可选开启。

了解更多：[`ACCESSIBILITY.md`](ACCESSIBILITY.md), [`SECURITY.md`](SECURITY.md)。

---

## 测试结果

**5,139 个自动化测试** 跨 Web、iOS、视觉和 AI 路由验证了每一项功能。

| 测试内容 | 测试数量 | 结果 |
|---|---|---|
| 完整 Web 应用（组件、Store、服务） | 4,971 | ✅ 通过 |
| 视觉 / 摄像头 / 目标检测 | 167 | ✅ 通过 |
| 手部追踪 + 身体姿态精度 | 54 | ✅ 通过 |
| 端侧 AI 路由（实时 Ollama） | 8 | ✅ 通过 |
| iOS 原生 (XCUITest) | 19 | ✅ 通过 |
| Prism MCP 服务器 | 2,679 | ✅ 通过 |

**端侧 AI 准确率** — 应用为您的孩子准确挑选对应操作的可靠程度：

| 设备 | 模型 | 体积 | 准确率 | 评估集 |
|---|---|---|---|---|
| **Apple Watch** | SmolLM2-360M | 207 MB | **100%** (300/300) | AAC 临床（符号扩展、紧急呼叫、预测） |
| **所有 iPhone** | Qwen3.5-4B Q3_K_M | 2.3 GB | **99.1%** (114/115 × 3 次运行) | BFCL 工具路由 |
| **iPhone Pro / iPad** | Qwen3.5-4B Q4_K_M | 3.4 GB | **100%** (115/115 × 3 次运行) | BFCL 工具路由 |
| **iPad Pro / Mac** | Prism-Coder 9B | 8.4 GB | **100%** (115/115 × 3 次运行) | BFCL 工具路由 |

<details>
<summary><strong>实际使用中，“99.1% 的路由准确率”意味着什么？</strong></summary>

当您的孩子点击按钮时，端侧 AI 负责决定触发哪项操作 — 保存便签、加载会话、搜索历史等。我们通过 115 个真实场景打乱顺序测试 3 次来进行验证。2.3 GB 模型每次都能在 115 个用例中准确命中 114 个。唯一的例外：它会将“编写正则表达式”误判为知识查询而非纯文本响应 — 这一边缘情况在 AAC 的实际使用中绝不会出现。

相比之下，早期的 2B 模型得分仅为 90.4%（出现 11 次错误）。新模型在下载体积保持不变的前提下，路由错误减少了 10 倍。

</details>

---

## 基础架构与 GDPR

### 多区域架构

| 组件 | 区域 | 用途 |
|---|---|---|
| **Supabase US** | 美国东部 (维吉尼亚) | 主数据库 — 认证、用户数据、照护者便签 |
| **Supabase EU** | 欧洲中部 (法兰克福) | 符合 GDPR — 欧洲用户数据绝不离开欧洲 |
| **Vercel** | 全球边缘网络 | Web 应用、API 路由、CDN |
| **Inworld TTS** | 美国 | 神经网络文本转语音 |
| **HuggingFace Hub** | 美国/欧洲 | 模型权重 (2B, 4B, 14B, 32B) |
| **端侧** | 用户设备 | llama.cpp 推理 (iPhone/iPad/Mac) |

### GDPR 合规

欧洲用户的数据严格存储于法兰克福 (eu-central-1) 区域。门户会通过 Vercel 的 `x-vercel-ip-country` 请求头自动识别用户位置，并将数据库操作路由至对应的 Supabase 实例：

- **欧洲用户** → `supabase-eu` (法兰克福) — 个人数据、认证、偏好设置、照护者便签
- **非欧洲用户** → `supabase-us` (维吉尼亚) — 相同的数据类别，受美国管辖
- **AI 推理** → 端侧运行（数据绝不离开设备）或通过 Synalux API（不存储任何个人可识别信息 PII）
- **TTS 音频** → 服务端生成，流式传输至客户端，不进行保存

**数据驻留保障：**
- 欧洲用户的个人数据绝不经过美国服务器中转
- 身份验证 Token 严格限定在对应区域的 Supabase 实例范围内
- 照护者便签在静态存储时进行加密 (Supabase AES-256)
- 语音录音（舒缓播放器）仅存储于浏览器 IndexedDB 中 — 绝不上传
- 端侧 AI 模型完全在本地运行 — 零云端遥测

**删除权（被遗忘权）：** 用户发起删除将级联清理区域数据库中的认证信息、个人资料、照护者便签及使用分析数据。私有部署实例可通过 `supabase db reset` 清空数据。

### 规模化成本

| 用户规模 | Supabase | Vercel | TTS | AI 模型 | 总计 |
|---|---|---|---|---|---|
| 0–1K | $50/月 (2 个区域) | $0 (Hobby 免费版) | ~$5/月 | $0 (端侧) | ~$55/月 |
| 1K–10K | $50/月 | $20/月 (Pro 专业版) | ~$50/月 | $0 | ~$120/月 |
| 10K–100K | $50/月 + 计算扩展包 | $20/月 | ~$200/月 | RunPod $125/月 | ~$395/月 |

---

## AI 模型与设备支持

支持所有 Apple 设备。核心 AAC 沟通功能零云端依赖。

PrismAAC 会根据您的硬件自动选择最佳模型，在性能受限的设备上实现平滑降级，且基础沟通功能绝不需要网络连接。

| 设备 | RAM | 模型 | 准确率 | AAC 支持 | 体积 | 成本 |
|---|---|---|---|---|---|---|
| **iPad Pro M1/M2/M4** | 16 GB | 9B LoRA (v36) | **100%** | 100% | 8.4 GB | $0 |
| **iPhone 15/16 Pro, iPad Air** | 8 GB | 4B Q4_K_M (v36) → 2B (OOM 后备) | **100%** | 100% | 4.7 GB / 1.1 GB | $0 |
| **iPhone 12–14, 较早期 iPad** | <8 GB | 2B Q3_K_M (v43) | **99.1%** | 100% | 2.3 GB | $0 |
| **通过 WiFi 连接 Mac M1+** | 16+ GB | 通过 Ollama (v36) 运行 9B/27B | **100%** | 100% | 8.4 GB | $0 |

### Web 应用降级链

Web 应用优先尝试本地推理，失败后自动退回至云端 — 因此安装了 Ollama 的用户开销为 $0，未安装的用户依然能获得完整的功能体验。

<details>
<summary>降级流程图</summary>

```
  用户发送消息
        |
        v
  +-- 本地 OLLAMA (自动检测 localhost:11434) ----------+
  |                                                      |
  |   14b (100%, ~1.1s) ─[失败]─> 8b (100%, ~0.8s) ─[失败]─> 2b (100%, ~1.6s)
  +-------------------------------------------------------------------+
         |
    [本地全部失败？]
         |
         v
  +-- 云端后备 (Synalux API) --------------+
  |  Claude Sonnet 4 (付费) / Gemini (免费) |
  |  99% 准确率, ~3s                      |
  +-----------------------------------------+

  自动静默加载：首次启动检测到 Ollama → 拉取最佳模型 → 永久本地运行。
```

</details>

### iOS 原生降级链

原生应用在启动时探测可用 RAM，从 HuggingFace CDN 一次性下载合适的模型，并通过 llama.cpp Metal 执行推理。无服务器、无订阅、数据绝不离开设备。

<details>
<summary>降级流程图</summary>

```
  应用启动
      |
      v
  RAM 探测 (os_proc_available_memory)
      |
      +── 16 GB+ (iPad Pro) ──> 9B LoRA (8.4 GB) ──> 100%, ~1.1s
      |
      +── 8 GB (iPhone/iPad Air) ──> 4B Q4_K_M (4.7 GB) ──> 100%, ~0.8s
      |                                    |
      |                               内存不足？ → 2B Q4_K_M (1.1 GB) → 100%, ~1.6s
      |
      +── <8 GB ──> 2B Q4_K_M (1.1 GB) ──> 100%, ~1.6s

  所有路径：llama.cpp Metal，永久 $0，数据绝不离开设备。
  WiFi 升级：设置 → 本地 AI → 输入 Mac IP 以使用 9B/27B。
```

</details>

### 键盘布局模式（持久化）

只需点击一次即可在三种模式间切换 — 所选布局会自动保存并在每次启动时恢复。

- **MAX KB（最大键盘）** — 键盘填满预测条下方的所有空间
- **MIN KB（最小键盘）** — 分类占 75% / 键盘占 25%
- **HIDE KB（隐藏键盘）** — 分类全屏展示，键盘隐藏

<details>
<summary>布局图示</summary>

```
  MAX KB                 MIN KB                 HIDE KB
  +--------------------+ +--------------------+ +--------------------+
  | 工具栏             | | 工具栏             | | 工具栏             |
  | 预测条             | | 预测条             | | 问候语横幅         |
  |                    | |                    | |                    |
  |  键盘              | | 分类        (75%)  | | 分类               |
  |  填满预测条        | |                    | | (全屏)             |
  |  下方所有空间      | |--------------------| |                    |
  |                    | | 键盘        (25%)  | |                    |
  | [123][v][  空格  ] | |                    | |                    |
  +--------------------+ +--------------------+ +--------------------+
        |                      |                      |
        +-- [v] 按钮 --------->+-- 侧边栏按钮 ------->+-- 侧边栏按钮 ---+
        |                                                               |
        +<--------------------------------------------------------------+
```

</details>

### 成本汇总

| 路径 | 模型 | 准确率 | 延迟 | 成本 |
|---|---|---|---|---|
| iPad Pro 16GB | 9B LoRA (v36) | **100%** | ~1.1s | **$0** |
| iPhone/iPad 8GB | 4B Q4_K_M (v36) → 2B (OOM 后备) | **100%** | ~0.8s | **$0** |
| 任意设备 | 2B Q4_K_M (v42) | **100%** | ~1.6s | **$0** |
| 通过 WiFi 连接 Mac | 通过 Ollama (v36) 运行 9B/27B | **100%** | ~1.1s | **$0** |
| 云端（免费） | Gemini 2.5 Flash | 99% | ~3s | Synalux 承担 |
| 云端（付费） | Claude Sonnet 4 | 99% | ~3s | 已包含在套餐中 |

**核心优势：** 无论孩子使用的是 $329 的 iPhone SE 还是 $2,000 的 iPad Pro，都能获得 Claude 级别的准确体验。本地优先意味着零云端依赖、零每月 API 费用、零 PHI 泄露风险以及亚秒级响应。prism-coder 框架在 BFCL 函数调用基准测试中得分达到 **99.1–100%**（3 次种子均值，2026 年 6 月）：27B/9B/4B 均达 100%，2B 达 99.1%。此外，27B 在内部 15 个代码演练评估中同样达到 100%。

---

## 自行托管

```bash
git clone https://github.com/dcostenco/prism-aac.git
cd prism-aac
npm install
npm run dev    # http://localhost:3000
```

Synalux 运营官方托管版本（免费 + 付费）。自托管者和 Fork 版本必须在 AGPL-3.0 协议下开源其修改。

### 本地 AI 模型（零云端成本）

**方式 A — 应用内（推荐）：** 设置 → 🤖 本地 AI 模型 → 点击任意模型旁边的“下载”。内置进度条。支持与运行 Ollama 的 Mac 在同一 WiFi 下的 iPad/iPhone。

**方式 B — 命令行：**

安装 [Ollama](https://ollama.com)，随后运行：

```bash
ollama pull dcostenco/prism-coder:2b   # 1.1 GB — 适合任何机器、iPhone 12+ — 100% 路由 (v42)
ollama pull dcostenco/prism-coder:4b    # 4.7 GB — 适合 iPhone/iPad 8GB, Mac M1+ — 100% 路由 (v36)
ollama pull dcostenco/prism-coder:9b   # 8.4 GB — 适合 Mac 16GB+, iPad Pro — 100% 路由 (v36)
ollama pull dcostenco/prism-coder:27b   # 16 GB  — 适合 Mac M2 Ultra+ (MoE) — 100% 路由 (v7)
```

添加至 `.env.local`: `LOCAL_LLM_URL=http://localhost:11434`

**WiFi 环境下的 iPad Pro / iPhone：**
```bash
OLLAMA_HOST=0.0.0.0 ollama serve   # 在 Mac 上运行
# 随后在应用 设置 → 本地 AI 中输入：http://<mac-ip>:11434
```

自动路由机制：2B → 任意设备 · 4B → 移动端/验证器 · 9B → 标准场景 · 27B → 高质量/企业级场景。当 Ollama 无法连接时自动后备至云端。

---

<details>
<summary><strong>📚 技术架构（模型路由、语音、手势识别、构建细节）</strong></summary>

**技术栈**: Next.js, Zustand, Web Speech API (转写), Inworld TTS-2 + Azure Neural 后备 (语音朗读), FaceLandmarker (手势)。

**模型路由**（由 Synalux 门户在服务端进行）：
- **端侧**（按键点击 → 短语）：`prism-coder:2b` (Qwen3-2B Q4_K_M, llama.cpp Metal) — 零网络、零成本，约 ~1.6 秒
- **云端简单路径**（对话，免费层）：`prism-coder:9b` (Qwen3-14B 微调) → 后备至 Gemini 2.5 Flash
- **云端复杂路径**（推理，专业层）：`prism-coder:27b` (QwQ-32B 微调) → 后备至 Claude Sonnet 4
- **自动纠错 + 词汇预测**：Gemini 2.5 Flash-Lite — 平均 752ms，支持多语言 (ro/ru/es)
- 速度敏感路径（按键点击 → 朗读）跳过路由 — 绝不阻塞在网络请求上
- 路由准确率（[102 个用例 Prism 评估集](https://github.com/dcostenco/prism-coder/tree/main/tests/benchmarks/prism-routing-100)，v36/v7 系统提示词，3 次种子均值，2026 年 5 月）：

  | 模型 | 准确率 | 平均延迟 | 捏造工具数 |
  |---|---|---|---|
  | prism-coder:27b swe14 (本地) | **100.0%** | 1.4s | 0 |
  | 14B→32B 级联 (本地) | **100.0%** | ~1.1s | 0 |
  | prism-coder:4b v36 (本地) | **100.0%** | 0.8s | 0 |
  | prism-coder:9b v36 (本地) | **100.0%** | 1.1s | 0 |
  | Sonnet 4 (云端) | **99%** | 3.2s | 0 |
  | Opus 4.7 (云端) | **98.3%** | 3.0s | 0 |
  | prism-coder:2b v42 (本地) | **100.0%** | 1.6s | 0 |

- 扩展评估集 — eval_300（300 个用例，17 个工具，9 个分类，3 次种子）：prism-coder:27b = **300/300 (100%)**

**语音 (TTS)** 降级链：
- 第 1 层：Inworld TTS-2（付费版支持所有语言；免费版支持 Synalux 承担成本的 ro/uk/ru/de/ko/ar）
- 第 2 层：系统 Web Speech API 高清语音（离线）
- 第 3 层：WASM espeak-ng（保底方案）

**手势识别**：
- 基础：通过 FaceLandmarker 实现头部姿态 + 驻留点击
- 高级：通过 MediaPipe 实现手部姿态；单用户手势配置文件

**架构**：仅弹窗导航（无路由重定向），主题由 tokens.bg/text/border/accent 控制。

**本仓库中的详细文档：**
- [`docs/TTS-ARCHITECTURE.md`](../../docs/TTS-ARCHITECTURE.md) — 完整语音路由
- [`docs/GESTURE_RECOGNITION.md`](../../docs/GESTURE_RECOGNITION.md) — 手势模式内部原理
- [`docs/ADAPTIVE-ENGINE-BEHAVIOR.md`](../../docs/ADAPTIVE-ENGINE-BEHAVIOR.md) — 自动语调切换
- [`docs/EMERGENCY-NATIVE-ARCHITECTURE.md`](../../docs/EMERGENCY-NATIVE-ARCHITECTURE.md) — 生命关键警报路径
- [`docs/SELF-LEARNING-SAFETY.md`](../../docs/SELF-LEARNING-SAFETY.md) — 单用户学习安全边界
- [`docs/TRACKING_RELIABILITY.md`](../../docs/TRACKING_RELIABILITY.md) — 头部/手部追踪可靠性测试套件
- [`PRECISION_TOUCH.md`](../../PRECISION_TOUCH.md) — 触控目标无障碍设计
- [`ACCESSIBILITY.md`](../../ACCESSIBILITY.md) · [`SECURITY.md`](../../SECURITY.md) · [`GOVERNANCE.md`](../../GOVERNANCE.md) · [`AGENTS.md`](../../AGENTS.md)
- [`RESEARCH.md`](../../RESEARCH.md) — 循证依据
- [`CHANGELOG.md`](../../CHANGELOG.md) — 版本历史

</details>

<details>
<summary><strong>🆕 为何 PrismAAC 独树一帜（底层算法栈）</strong></summary>

**市面上没有任何其他 AAC 应用能同时实现这三点：**

### 1. 端侧 AI — 支持 HIPAA 技术安全保障

**为何本地 AI 对 AAC 如此重要 — 速度、安全与可靠性：**

| | 仅依赖云端 AI | PrismAAC (本地优先) |
|--|---|---|
| 点击按钮 → 语音朗读 | 2–30s（网络往返） | **~0.5s**（端侧） |
| 离线可用 | ❌ 否 | ✅ 是 |
| PHI 离开设备 | ✅ 始终离开 | ❌ 绝不离开（语音路径） |
| HIPAA 支持 | 需要与每个供应商签署 BAA | **端侧确保 PHI 保留在本地 — 助力满足技术安全保障要求** |
| 偏远地区 / 弱网 | 无法使用 | **完全正常工作** |
| 每用户每月成本 | $2–15 API 费用 | **$0 (本地)** |

**2B 模型完全在您的设备上运行** — iPad M1+、Mac 或笔记本电脑。孩子点击按钮即可在 ~500ms 内获得响应，无需发起任何网络请求。在正常使用过程中，任何个人健康信息 (PHI)、表达内容或沟通模式绝不离开设备。

照护者便签在任何可选的云端同步前都会在本地完成加密。相比之下，仅支持云端的 AAC 平台（TouchChat、Proloquo2Go 云端同步）必须上传账号数据才能运行 — PrismAAC 则完全不需要。

**针对企业 / 临床部署场景 (9B + 27B)：** 9B 和 27B 模型通过 Ollama 运行在临床网络内部的专用 Mac 上。iPad 通过本地 WiFi 发起连接 — 数据绝不离开建筑物。该架构通过将 PHI 保留在本地，助力符合 HIPAA 技术安全保障的要求；HIPAA 最终合规性由部署单位（Covered Entity）自行负责，需落实其自身的行政、物理和技术控制措施以及签署适用的 BAA。

**如何配置：**

```
iPad / iPhone（与 Mac 处于同一 WiFi 下）
    ↓  连接至
运行 Ollama 的 Mac (OLLAMA_HOST=0.0.0.0)
    ↓  提供服务
prism-coder:2b · :14b · :32b
    ↓  所有推理保留在
局域网内部 — 无任何数据发送至互联网
```

设置 → 🤖 本地 AI 模型 → 输入 Mac IP → 所有模型即可立即可用。零云端成本。零 PHI 泄露。AAC 基础沟通零网络依赖。

### 2. 契合您孩子的短语排序
静态词频列表已经过时。PrismAAC 通过 [**Prism v14.0.0 激活扩散机制**](https://github.com/dcostenco/prism-coder/blob/main/docs/WOW_FEATURES.md) 对推荐短语进行排序 — 该机制基于卡内基梅隆大学数十年研究成果背后的 ACT-R 认知记忆模型。基于新鲜度 × 频率 × 单用户历史记录，而非静态的热门列表。孩子今天说过的短语排名会上升；一年未用的短语会自动衰减（遗忘率 `d=0.25`，半衰期约为 1 年）。

### 3. 照护者纠错自动转化为训练数据
当照护者更正了模型给出的错误推荐（例如：“不对，这个词是 *吃*，不是 *想*”）时，[审计 Hook 运行后收集器](https://github.com/dcostenco/prism-coder/blob/main/docs/WOW_FEATURES.md#7-the-recipe-combining-all-of-the-above) 会自动提取错误用例并保存。在大约 50 次会话后，系统会在模型犯下类似错误 *之前* 提前预警。照护者无需进行任何标注工作，也无需执行昂贵的重新训练 — 纠错过程本身就是训练课程。

**客观看待能力边界：** 在 [115 个用例 Prism 评估集](https://github.com/dcostenco/prism-coder/tree/main/tests/benchmarks/prism-routing-100)（7 个 Prism 工具，12 个分类，3 次种子均值，2026 年 6 月）上的路由准确率为：27b = 100.0%，9b = 100.0%，4b = 100.0%，2b = 99.1%。在所有模型体积和所有随机种子下，捏造工具名称的情况均为零。2B 模型在端侧运行以实现快速短语路由；9B/27B 模型则通过 WiFi 连接 Mac 处理复杂会话和临床工作流。在完整的 Berkeley BFCL V4 榜单（2,000+ 通用函数调用用例）中，2B 得分约为 ~59% — 与其他 2B 以下模型相当。PrismAAC 真正的护城河不仅在于模型得分本身 — 更在于模型与周边 Prism 激活扩散算法栈的有机结合。

</details>

---

## 开发者指南

```bash
npm install && npm run dev   # http://localhost:3000/prism-aac
npm run test                 # 4900+ 单元测试
npm run e2e                  # 跨 11 个设备配置文件的 Playwright 测试
```

### 监控

| 仪表盘 | 追踪内容 |
|-----------|---------------|
| [Prism AAC — 用户分析](https://app.datadoghq.com/dashboard/shk-8fb-qjk/prism-aac--user-analytics) | 会话、错误、词汇预测、短语点击、朗读事件、语言、国家、设备、订阅套餐、头部追踪遥测数据 |

Datadog RUM 集成：参见 `lib/datadog.ts` + `components/DatadogInit.tsx`。7 个端到端性能测试位于 `e2e/datadog-integration.spec.ts`。

---

## 开源协议

[AGPL-3.0](LICENSE) — 开源、OSI 认可、符合资助条件。

您可以自由 Fork 并自行托管。协议要求您同样在 AGPL-3.0 下开源您的修改版本 — 正是这一契约让 AAC 技术的创新成果得以保持公开，惠及千家万户。

© 2024–2026 Synalux LLC
