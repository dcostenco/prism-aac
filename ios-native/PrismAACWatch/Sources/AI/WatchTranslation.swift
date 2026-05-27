import Foundation
import AVFoundation
import Security

// NOTE: NSLog is used for operational logging. Auth tokens are never logged.
// Operational data (message counts, status codes) is considered acceptable in production logs.
// For future: migrate to os_log with appropriate log levels.

/// Translation + live voice input for the Watch.
///
/// Phrase tap:  translate label via synalux API → speak in output lang
/// Mic button:  triggers Watch dictation UI → translate → TTS output
@MainActor
final class WatchTranslation: ObservableObject {

    @Published private(set) var isTranslating = false
    @Published var isListening   = false
    @Published private(set) var pendingText = ""  // FIX #32: restrict external mutation

    private var translateTask: Task<Void, Never>?
    private var listeningWatchdog: Task<Void, Never>?

    deinit {
        // NOTE: deinit accesses @MainActor-isolated properties. Task.cancel() is safe
        // from any thread — it only sets an atomic flag. No actor state mutation occurs.
        translateTask?.cancel()
        listeningWatchdog?.cancel()
    }

    // #18: force-unwrap instead of fatalError — both crash on bad literal, but ! is idiomatic for known-good literals
    private let translateURL = URL(string: "https://synalux.ai/api/v1/translate")!

    // #8: dedicated session with both request and resource timeouts — URLSession.shared has no resource timeout
    private static let translationSession: URLSession = {
        let cfg = URLSessionConfiguration.ephemeral
        cfg.timeoutIntervalForRequest  = 10
        cfg.timeoutIntervalForResource = 15
        return URLSession(configuration: cfg)
    }()

    // MARK: - Offline dictionary (1,261 phrases × 20 languages, 100% accurate)

    nonisolated private static let offlineDict: [String: [String: String]] = {
        guard let url = Bundle.main.url(forResource: "aacTranslations", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let phrases = json["phrases"] as? [[String: Any]] else {
            NSLog("[WatchTranslation] Failed to load offline dictionary")
            return [:]
        }
        var dict: [String: [String: String]] = [:]
        for p in phrases {
            guard let en = p["en"] as? String,
                  let translations = p["translations"] as? [String: String] else { continue }
            dict[en.lowercased()] = translations
        }
        NSLog("[WatchTranslation] Loaded \(dict.count) offline phrases")
        return dict
    }()

    private func offlineTranslate(text: String, to toLang: String) -> String? {
        let lang = String(toLang.prefix(2))
        return Self.offlineDict[text.lowercased()]?[lang]
    }

    /// Synchronous offline-only label translation for UI rendering.
    /// Returns the translation if available, otherwise the original text.
    /// Checks both the AAC phrase dictionary (1,261 entries) and the
    /// category-names table (22 entries) so category cards and phrase tiles
    /// both render localized labels.
    nonisolated static func localizedLabel(_ text: String, to toLang: String) -> String {
        let lang = String(toLang.prefix(2))
        if lang == "en" { return text }
        let key = text.lowercased()
        if let t = offlineDict[key]?[lang] { return t }
        if let t = categoryNames[key]?[lang] { return t }
        return text
    }

    /// Translations for the 22 iOS-parity category names — extracted from
    /// `i18n/<lang>.json` `cat_*` keys. Sync rule: when category names in
    /// `iOSDefaultSet` change, update this table in the same commit.
    nonisolated private static let categoryNames: [String: [String: String]] = [
        "i / you / we":      ["ro": "Eu / Tu / Noi", "es": "Yo / Tú / Nosotros", "fr": "Je / Tu / Nous", "pt": "Eu / Você / Nós", "de": "Ich / Du / Wir", "ru": "Я / Ты / Мы", "uk": "Я / Ти / Ми", "ja": "わたし / あなた / わたしたち", "zh": "我 / 你 / 我们", "ko": "나 / 너 / 우리", "ar": "أنا / أنت / نحن", "hi": "मैं / आप / हम", "nl": "Ik / Jij / Wij", "pl": "Ja / Ty / My", "tr": "Ben / Sen / Biz", "vi": "Tôi / Bạn / Chúng ta", "tl": "Ako / Ikaw / Tayo", "id": "Saya / Anda / Kami", "it": "Io / Tu / Noi", "he": "אני / אתה / אנחנו"],
        "core verbs":        ["ro": "Verbe de bază", "es": "Verbos Básicos", "fr": "Verbes de Base", "pt": "Verbos Básicos", "de": "Grundverben", "ru": "Основные Глаголы", "uk": "Основні Дієслова", "ja": "基本動詞", "zh": "核心动词", "ko": "기본 동사", "ar": "أفعال أساسية", "hi": "मुख्य क्रियाएँ", "nl": "Kernwerkwoorden", "pl": "Podstawowe czasowniki", "tr": "Temel Fiiller", "vi": "Động từ cốt lõi", "tl": "Mga Pangunahing Pandiwa", "id": "Kata Kerja Inti", "it": "Verbi principali", "he": "פעלים בסיסיים"],
        "more / not / all":  ["ro": "Mai mult / Nu / Tot", "es": "Más / No / Todo", "fr": "Plus / Non / Tout", "pt": "Mais / Não / Tudo", "de": "Mehr / Nicht / Alle", "ru": "Больше / Нет / Все", "uk": "Більше / Ні / Все", "ja": "もっと / ない / ぜんぶ", "zh": "更多 / 不 / 全部", "ko": "더 / 아니 / 모두", "ar": "أكثر / لا / الكل", "hi": "और / नहीं / सब", "nl": "Meer / Niet / Alles", "pl": "Więcej / Nie / Wszystko", "tr": "Daha / Değil / Hepsi", "vi": "Thêm / Không / Tất cả", "tl": "Higit pa / Hindi / Lahat", "id": "Lagi / Tidak / Semua", "it": "Più / Non / Tutto", "he": "עוד / לא / הכל"],
        "little words":      ["ro": "Cuvinte mici", "es": "Palabras Pequeñas", "fr": "Petits Mots", "pt": "Palavras Pequenas", "de": "Kleine Wörter", "ru": "Маленькие Слова", "uk": "Маленькі Слова", "ja": "小さなことば", "zh": "小词", "ko": "짧은 말", "ar": "كلمات صغيرة", "hi": "छोटे शब्द", "nl": "Kleine woorden", "pl": "Małe słowa", "tr": "Küçük Sözcükler", "vi": "Từ nhỏ", "tl": "Mga Maliit na Salita", "id": "Kata Kecil", "it": "Paroline", "he": "מילים קטנות"],
        "help / needs":      ["ro": "Ajutor / Nevoi", "es": "Ayuda / Necesidades", "fr": "Aide / Besoins", "pt": "Ajuda / Necessidades", "de": "Hilfe / Bedürfnisse", "ru": "Помощь / Потребности", "uk": "Допомога / Потреби", "ja": "ヘルプ / ニーズ", "zh": "帮助 / 需求", "ko": "도움 / 필요", "ar": "مساعدة / احتياجات", "hi": "मदद / ज़रूरतें", "nl": "Hulp / Behoeften", "pl": "Pomoc / Potrzeby", "tr": "Yardım / İhtiyaçlar", "vi": "Trợ giúp / Nhu cầu", "tl": "Tulong / Pangangailangan", "id": "Bantuan / Kebutuhan", "it": "Aiuto / Bisogni", "he": "עזרה / צרכים"],
        "quick talk":        ["ro": "Vorbire rapidă", "es": "Charla Rápida", "fr": "Parole Rapide", "pt": "Fala Rápida", "de": "Schnelles Sprechen", "ru": "Быстрый Разговор", "uk": "Швидка Розмова", "ja": "クイックトーク", "zh": "快速对话", "ko": "빠른 대화", "ar": "محادثة سريعة", "hi": "जल्दी बात", "nl": "Snel praten", "pl": "Szybka rozmowa", "tr": "Hızlı Konuşma", "vi": "Nói nhanh", "tl": "Mabilis na Usap", "id": "Bicara Cepat", "it": "Conversazione rapida", "he": "שיחה מהירה"],
        "feelings":          ["ro": "Sentimente", "es": "Sentimientos", "fr": "Sentiments", "pt": "Sentimentos", "de": "Gefühle", "ru": "Чувства", "uk": "Почуття", "ja": "気持ち", "zh": "感受", "ko": "감정", "ar": "مشاعر", "hi": "भावनाएँ", "nl": "Gevoelens", "pl": "Uczucia", "tr": "Duygular", "vi": "Cảm xúc", "tl": "Mga Damdamin", "id": "Perasaan", "it": "Emozioni", "he": "רגשות"],
        "questions":         ["ro": "Întrebări", "es": "Preguntas", "fr": "Questions", "pt": "Perguntas", "de": "Fragen", "ru": "Вопросы", "uk": "Запитання", "ja": "質問", "zh": "问题", "ko": "질문", "ar": "أسئلة", "hi": "प्रश्न", "nl": "Vragen", "pl": "Pytania", "tr": "Sorular", "vi": "Câu hỏi", "tl": "Mga Tanong", "id": "Pertanyaan", "it": "Domande", "he": "שאלות"],
        "actions":           ["ro": "Acțiuni", "es": "Acciones", "fr": "Actions", "pt": "Ações", "de": "Aktionen", "ru": "Действия", "uk": "Дії", "ja": "動作", "zh": "动作", "ko": "행동", "ar": "أفعال", "hi": "क्रियाएँ", "nl": "Acties", "pl": "Czynności", "tr": "Eylemler", "vi": "Hành động", "tl": "Mga Aksyon", "id": "Tindakan", "it": "Azioni", "he": "פעולות"],
        "describing words":  ["ro": "Cuvinte descriptive", "es": "Palabras Descriptivas", "fr": "Mots Descriptifs", "pt": "Palavras Descritivas", "de": "Beschreibende Wörter", "ru": "Описательные Слова", "uk": "Описові Слова", "ja": "説明する言葉", "zh": "描述词", "ko": "설명하는 말", "ar": "كلمات وصفية", "hi": "वर्णन शब्द", "nl": "Beschrijvende woorden", "pl": "Słowa opisujące", "tr": "Niteleyici Sözcükler", "vi": "Từ mô tả", "tl": "Mga Pang-uri", "id": "Kata Sifat", "it": "Parole descrittive", "he": "מילות תיאור"],
        "people":            ["ro": "Persoane", "es": "Personas", "fr": "Personnes", "pt": "Pessoas", "de": "Menschen", "ru": "Люди", "uk": "Люди", "ja": "人々", "zh": "人物", "ko": "사람", "ar": "أشخاص", "hi": "लोग", "nl": "Mensen", "pl": "Ludzie", "tr": "Kişiler", "vi": "Mọi người", "tl": "Mga Tao", "id": "Orang", "it": "Persone", "he": "אנשים"],
        "food & drink":      ["ro": "Mâncare & Băutură", "es": "Comida y Bebida", "fr": "Nourriture et Boissons", "pt": "Comida e Bebida", "de": "Essen und Trinken", "ru": "Еда и Напитки", "uk": "Їжа та Напої", "ja": "食べ物と飲み物", "zh": "食物和饮料", "ko": "음식과 음료", "ar": "طعام ومشروبات", "hi": "खाना और पीना", "nl": "Eten en drinken", "pl": "Jedzenie i picie", "tr": "Yiyecek ve İçecek", "vi": "Thức ăn & Đồ uống", "tl": "Pagkain at Inumin", "id": "Makanan & Minuman", "it": "Cibo e bevande", "he": "אוכל ושתייה"],
        "places":            ["ro": "Locuri", "es": "Lugares", "fr": "Lieux", "pt": "Lugares", "de": "Orte", "ru": "Места", "uk": "Місця", "ja": "場所", "zh": "地点", "ko": "장소", "ar": "أماكن", "hi": "जगहें", "nl": "Plaatsen", "pl": "Miejsca", "tr": "Yerler", "vi": "Địa điểm", "tl": "Mga Lugar", "id": "Tempat", "it": "Luoghi", "he": "מקומות"],
        "school / work":     ["ro": "Școală / Muncă", "es": "Escuela / Trabajo", "fr": "École / Travail", "pt": "Escola / Trabalho", "de": "Schule / Arbeit", "ru": "Школа / Работа", "uk": "Школа / Робота", "ja": "学校 / 仕事", "zh": "学校 / 工作", "ko": "학교 / 직장", "ar": "مدرسة / عمل", "hi": "स्कूल / काम", "nl": "School / Werk", "pl": "Szkoła / Praca", "tr": "Okul / İş", "vi": "Trường / Làm việc", "tl": "Eskwela / Trabaho", "id": "Sekolah / Kerja", "it": "Scuola / Lavoro", "he": "בית ספר / עבודה"],
        "health / body":     ["ro": "Sănătate / Corp", "es": "Salud / Cuerpo", "fr": "Santé / Corps", "pt": "Saúde / Corpo", "de": "Gesundheit / Körper", "ru": "Здоровье / Тело", "uk": "Здоров'я / Тіло", "ja": "健康 / 体", "zh": "健康 / 身体", "ko": "건강 / 몸", "ar": "صحة / جسم", "hi": "सेहत / शरीर", "nl": "Gezondheid / Lichaam", "pl": "Zdrowie / Ciało", "tr": "Sağlık / Vücut", "vi": "Sức khỏe / Cơ thể", "tl": "Kalusugan / Katawan", "id": "Kesehatan / Tubuh", "it": "Salute / Corpo", "he": "בריאות / גוף"],
        "time":              ["ro": "Timp", "es": "Tiempo", "fr": "Temps", "pt": "Tempo", "de": "Zeit", "ru": "Время", "uk": "Час", "ja": "時間", "zh": "时间", "ko": "시간", "ar": "الوقت", "hi": "समय", "nl": "Tijd", "pl": "Czas", "tr": "Zaman", "vi": "Thời gian", "tl": "Oras", "id": "Waktu", "it": "Tempo", "he": "זמן"],
        "animals":           ["ro": "Animale", "es": "Animales", "fr": "Animaux", "pt": "Animais", "de": "Tiere", "ru": "Животные", "uk": "Тварини", "ja": "動物", "zh": "动物", "ko": "동물", "ar": "حيوانات", "hi": "जानवर", "nl": "Dieren", "pl": "Zwierzęta", "tr": "Hayvanlar", "vi": "Động vật", "tl": "Mga Hayop", "id": "Hewan", "it": "Animali", "he": "חיות"],
        "colors":            ["ro": "Culori", "es": "Colores", "fr": "Couleurs", "pt": "Cores", "de": "Farben", "ru": "Цвета", "uk": "Кольори", "ja": "色", "zh": "颜色", "ko": "색깔", "ar": "ألوان", "hi": "रंग", "nl": "Kleuren", "pl": "Kolory", "tr": "Renkler", "vi": "Màu sắc", "tl": "Mga Kulay", "id": "Warna", "it": "Colori", "he": "צבעים"],
        "clothes":           ["ro": "Haine", "es": "Ropa", "fr": "Vêtements", "pt": "Roupas", "de": "Kleidung", "ru": "Одежда", "uk": "Одяг", "ja": "服", "zh": "衣服", "ko": "옷", "ar": "ملابس", "hi": "कपड़े", "nl": "Kleding", "pl": "Ubrania", "tr": "Kıyafetler", "vi": "Quần áo", "tl": "Mga Damit", "id": "Pakaian", "it": "Abbigliamento", "he": "בגדים"],
        "transportation":    ["ro": "Transport", "es": "Transporte", "fr": "Transport", "pt": "Transporte", "de": "Verkehrsmittel", "ru": "Транспорт", "uk": "Транспорт", "ja": "乗り物", "zh": "交通工具", "ko": "교통수단", "ar": "وسائل النقل", "hi": "वाहन", "nl": "Vervoer", "pl": "Transport", "tr": "Ulaşım", "vi": "Phương tiện", "tl": "Transportasyon", "id": "Transportasi", "it": "Trasporti", "he": "תחבורה"],
        "weather":           ["ro": "Vreme", "es": "Clima", "fr": "Météo", "pt": "Clima", "de": "Wetter", "ru": "Погода", "uk": "Погода", "ja": "天気", "zh": "天气", "ko": "날씨", "ar": "الطقس", "hi": "मौसम", "nl": "Weer", "pl": "Pogoda", "tr": "Hava Durumu", "vi": "Thời tiết", "tl": "Panahon", "id": "Cuaca", "it": "Meteo", "he": "מזג אוויר"],
        "toys & fun":        ["ro": "Jucării & Distracție", "es": "Juguetes y Diversión", "fr": "Jouets et Loisirs", "pt": "Brinquedos e Diversão", "de": "Spielzeug und Spaß", "ru": "Игрушки и Развлечения", "uk": "Іграшки та Розваги", "ja": "おもちゃと遊び", "zh": "玩具和娱乐", "ko": "장난감과 놀이", "ar": "ألعاب ومرح", "hi": "खिलौने और मज़ा", "nl": "Speelgoed en plezier", "pl": "Zabawki i zabawa", "tr": "Oyuncaklar ve Eğlence", "vi": "Đồ chơi & Vui chơi", "tl": "Mga Laruan at Saya", "id": "Mainan & Hiburan", "it": "Giochi e divertimento", "he": "צעצועים וכיף"],
    ]

    // MARK: - Phrase translation (tap-to-speak)

    func translateAndSpeak(
        text: String,
        from fromLang: String,
        to toLang: String,
        tts: WatchTTS
    ) {
        if fromLang.prefix(2) == toLang.prefix(2) && !(fromLang.prefix(2) == "zh" && fromLang != toLang) {
            tts.speak(text, language: toLang)
            return
        }
        // Offline first — instant, 100% accurate, no network
        if let offline = offlineTranslate(text: text, to: toLang) {
            NSLog("[WatchTranslation] Offline hit: \(text) → \(offline)")
            tts.speak(offline, language: toLang)
            return
        }
        // Cloud fallback for phrases not in dictionary
        translateTask?.cancel()
        isTranslating = true
        translateTask = Task { @MainActor [weak self] in
            guard let self else { return }
            defer { self.isTranslating = false }
            let translated = await self.translate(text: text, from: fromLang, to: toLang)
            guard !Task.isCancelled else { return }
            if let translated = translated {
                tts.speak(translated, language: toLang)
            } else {
                tts.speak(text, language: fromLang.isEmpty ? toLang : fromLang)
            }
        }
    }

    /// Public version of translate() — used by AI Chat translator mode to
    /// get the translated string without immediately speaking it.
    func translateDirect(text: String, from fromLang: String, to toLang: String) async -> String? {
        return await translate(text: text, from: fromLang, to: toLang)
    }

    private func translate(text: String, from fromLang: String = "en", to toLang: String) async -> String? {
        // #31: bail immediately if caller's task was cancelled before network work begins
        guard !Task.isCancelled else { return nil }
        // FIX #7: Auth check FIRST — don't construct request body if we can't send it
        guard let token = KeychainHelper.shared.read(service: "prism-aac", account: "auth-token") else {
            NSLog("[WatchTranslation] No auth token — skipping translation request")
            return nil
        }

        // L-1: NFKC normalize BEFORE safety gate — homoglyphs composed via compatibility
        // equivalence bypass keyword checks when compared against plain ASCII patterns.
        // Normalize to canonical form first so the safety filter sees the same character
        // representations that the allowlist and pattern matchers expect.
        let nfkcInput = String(text.prefix(300))
            .applyingTransform(.init("NFKC; [:Mn:] Remove; NFKC"), reverse: false)
            ?? String(text.prefix(300))

        // Safety gate on NFKC-normalized input
        let safety = WatchSafetyFilter.check(nfkcInput)
        if case .crisis = safety { return nil }
        if case .medical = safety { return nil }

        // Sanitize language code — allowlist BCP-47 format only (alphanumerics + hyphen, max 20 chars)
        let safeLang = String(toLang.prefix(20))
            .components(separatedBy: CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-")).inverted)
            .joined()

        // Validate lang against known-good allowlist before injecting into prompt
        // FIX M1: include regional BCP-47 codes that the UI lang picker uses
        let allowedLangs: Set<String> = ["en", "en-US", "es", "es-ES", "ro", "ro-RO", "ru", "ru-RU",
            "fr", "fr-FR", "de", "de-DE", "it", "pt", "pt-BR", "ar", "ar-SA",
            "zh-Hans", "zh-Hant", "zh-CN", "ja", "ja-JP", "ko", "he", "hi",
            "nl", "pl", "uk", "uk-UA", "tr", "vi", "tl", "id"]
        // #22: BCP-47 regex guard in addition to allowlist — prevents prompt injection if allowlist entry is malformed
        let bcp47Regex = #"^[a-zA-Z]{2,8}(-[a-zA-Z0-9]{1,8})*$"#
        let validLang: String
        if allowedLangs.contains(safeLang) && safeLang.range(of: bcp47Regex, options: .regularExpression) != nil {
            validLang = safeLang
        } else {
            validLang = "en-US"
        }

        // Sanitize source language — same pattern as target; fall back to "en" on invalid
        let safeFromLang = String(fromLang.prefix(20))
            .components(separatedBy: CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-")).inverted)
            .joined()
        let validFromLang: String
        if allowedLangs.contains(safeFromLang) && safeFromLang.range(of: bcp47Regex, options: .regularExpression) != nil {
            validFromLang = safeFromLang
        } else {
            validFromLang = "en"
        }

        // Sanitize user text — use already-normalized nfkcInput as the base

        // Step 1: NFKC normalize is done above (nfkcInput)
        let nfkcText = nfkcInput

        // Step 2: Literal token strip on normalized input
        let safeText = nfkcText
            .replacingOccurrences(of: "<|im_start|>", with: "")
            .replacingOccurrences(of: "<|im_end|>", with: "")
            .replacingOccurrences(of: "<|system|>", with: "")
            .replacingOccurrences(of: "[INST]", with: "")
            .replacingOccurrences(of: "[/INST]", with: "")
            .replacingOccurrences(of: "<<SYS>>", with: "")
            .replacingOccurrences(of: "<</SYS>>", with: "")
            .replacingOccurrences(of: "<|eot_id|>", with: "")
            .replacingOccurrences(of: "<|start_header_id|>", with: "")
            .replacingOccurrences(of: "<|end_header_id|>", with: "")
            .replacingOccurrences(of: "<|user|>", with: "")
            .replacingOccurrences(of: "<|assistant|>", with: "")
            .replacingOccurrences(of: "<|endoftext|>", with: "")
            .replacingOccurrences(of: "<s>", with: "")
            .replacingOccurrences(of: "</s>", with: "")
            .replacingOccurrences(of: "<|end_of_turn|>", with: "")
            .replacingOccurrences(of: "<|start_of_turn|>", with: "")
            // #23: HTML entity stripping — prevents prompt injection via encoded angle brackets
            .replacingOccurrences(of: "&#x", with: "")  // #24: hex entities (e.g. &#x3C; = <)
            .replacingOccurrences(of: "&#X", with: "")  // uppercase X variant bypass (#23)
            .replacingOccurrences(of: "&#", with: "")
            .replacingOccurrences(of: "&lt;", with: "")
            .replacingOccurrences(of: "&gt;", with: "")
            .replacingOccurrences(of: "\\u003c", with: "")  // JSON-escaped <
            .replacingOccurrences(of: "\\u003e", with: "")  // JSON-escaped >

        // Step 3: Final bracket strip on normalized+stripped text
        let finalText = safeText.components(separatedBy: CharacterSet(charactersIn: "<>[]|")).joined()

        var req = URLRequest(url: translateURL)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        // timeout configured on translationSession (timeoutIntervalForRequest: 10, timeoutIntervalForResource: 15)
        do {
            req.httpBody = try JSONSerialization.data(withJSONObject: [
                "text":       finalText,
                "sourceLang": validFromLang,
                "targetLang": validLang,
            ])
        } catch {
            NSLog("[WatchTranslation] JSON serialization failed: \(error) — returning nil")
            return nil
        }
        do {
            let (data, response) = try await WatchTranslation.translationSession.data(for: req)
            if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
                NSLog("[WatchTranslation] HTTP error \(http.statusCode)")
                return nil
            }
            guard data.count <= 65_536 else { return nil }
            guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let raw = json["translated"] as? String,
                  !raw.isEmpty else {
                NSLog("[WatchTranslation] Unexpected translate response structure")
                return nil
            }
            return sanitizeTranslation(String(raw.prefix(300)).trimmingCharacters(in: .whitespacesAndNewlines))
        } catch is CancellationError {
            // #30: Task was cancelled (user navigated away) — not an error worth logging
            return nil
        } catch {
            NSLog("[WatchTranslation] Translation failed: \(error)")
            return nil
        }
    }

    // FIX M1: sanitize translation AI output — matches WatchAISession.sanitizeResponse()
    private static let outputTokens = ["<|im_start|>","<|im_end|>","<|system|>","[INST]","[/INST]",
                      "<<SYS>>","<</SYS>>","<|eot_id|>","<|start_header_id|>",
                      "<|end_header_id|>","<|user|>","<|assistant|>","<|endoftext|>",
                      "<s>","</s>","<|end_of_turn|>","<|start_of_turn|>",
                      "&#x","&#X","&#","&lt;","&gt;","\\u003c","\\u003e"]

    private func sanitizeTranslation(_ raw: String) -> String {
        let nfkc = raw.applyingTransform(.init("NFKC; [:Mn:] Remove; NFKC"), reverse: false) ?? raw
        let stripped = Self.outputTokens.reduce(nfkc) { $0.replacingOccurrences(of: $1, with: "") }
        return stripped.components(separatedBy: CharacterSet(charactersIn: "<>[]|")).joined()
    }

    // MARK: - Voice / dictation input

    /// Show Watch dictation UI (caller presents a TextField sheet).
    func startListening() {
        isListening = true
        // #10: store watchdog Task so it can be cancelled when dictation completes;
        // #24/#28: safety reset — if handleDictation is never called (e.g. user cancels without submitting),
        // isListening would remain true indefinitely. Reset after 30s max (reduced from 60s).
        listeningWatchdog?.cancel()
        listeningWatchdog = Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 30_000_000_000)
            guard let self, self.isListening else { return }
            NSLog("[WatchTranslation] Listening watchdog fired — resetting isListening")
            self.isListening = false
            self.listeningWatchdog = nil
        }
    }

    // #45: stopListening() removed — handleDictation() sets isListening = false directly
    // and no external caller uses this function. isListening property is retained for SwiftUI bindings.

    /// Handle text from Watch dictation sheet → translate → speak.
    func handleDictation(
        text: String,
        inputLang: String,
        outputLang: String,
        tts: WatchTTS
    ) {
        // #10: cancel watchdog — dictation completed normally
        listeningWatchdog?.cancel()
        listeningWatchdog = nil
        isListening = false
        pendingText = text
        guard !text.isEmpty else { return }
        translateAndSpeak(text: text, from: inputLang, to: outputLang, tts: tts)
    }
}
