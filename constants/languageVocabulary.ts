import { SupportedLanguage } from '@/engine/i18n';
import { WordFreqEntry } from '@/types';
import { DEFAULT_PHRASES } from '@/constants/phrases';
import { getPhraseText } from '@/constants/phraseTranslations';
import { buildNgramsFromPhrases } from '@/engine/predictionEngine';

const SEED_LAST_USED = 0;

const cache = new Map<SupportedLanguage, { wordFreq: Record<string, WordFreqEntry>; bigrams: Record<string, WordFreqEntry> }>();

export function buildLanguageVocabulary(lang: SupportedLanguage): {
  wordFreq: Record<string, WordFreqEntry>;
  bigrams: Record<string, WordFreqEntry>;
} {
  if (cache.has(lang)) return cache.get(lang)!;

  const wordFreq: Record<string, WordFreqEntry> = {};
  const phrases: string[] = DEFAULT_PHRASES.map(p => getPhraseText(p.id, lang, p.text));

  for (const phrase of phrases) {
    for (const raw of phrase.split(/\s+/)) {
      const word = raw.toLowerCase().replace(/[^\p{L}'-]/gu, '');
      if (word.length < 1) continue;
      wordFreq[word] = { count: (wordFreq[word]?.count ?? 0) + 1, lastUsed: SEED_LAST_USED };
    }
  }

  const { bigrams } = buildNgramsFromPhrases(phrases);
  for (const k of Object.keys(bigrams)) bigrams[k] = { ...bigrams[k], lastUsed: SEED_LAST_USED };

  const result = { wordFreq, bigrams };
  cache.set(lang, result);
  return result;
}

export const AAC_VOCABULARY: Record<SupportedLanguage, string[]> = {
  en: ['I', 'want', 'need', 'help', 'yes', 'no', 'more', 'stop', 'go', 'please', 'thank you', 'hello', 'goodbye', 'sorry', 'eat', 'drink', 'play', 'read', 'like', 'happy', 'sad', 'mom', 'dad', 'friend', 'school', 'home', 'bathroom', 'water', 'done', 'wait', 'open', 'close', 'big', 'small', 'good', 'bad', 'hot', 'cold', 'all', 'my', 'your', 'we', 'they', 'can', 'do', 'feel', 'think', 'know', 'see'],
  ro: ['eu', 'vreau', 'nevoie', 'ajutor', 'da', 'nu', 'mai', 'stop', 'du-te', 'te rog', 'mulțumesc', 'bună', 'la revedere', 'scuze', 'mâncare', 'bea', 'joacă', 'citește', 'îmi place', 'fericit', 'trist', 'mama', 'tata', 'prieten', 'școală', 'acasă', 'baie', 'apă', 'gata', 'așteaptă', 'deschide', 'închide', 'mare', 'mic', 'bun', 'rău', 'cald', 'rece', 'tot', 'al meu', 'al tău', 'noi', 'ei', 'pot', 'fac', 'simt', 'cred', 'știu', 'văd'],
  es: ['yo', 'quiero', 'necesito', 'ayuda', 'sí', 'no', 'más', 'para', 'ir', 'por favor', 'gracias', 'hola', 'adiós', 'perdón', 'comer', 'beber', 'jugar', 'leer', 'me gusta', 'feliz', 'triste', 'mamá', 'papá', 'amigo', 'escuela', 'casa', 'baño', 'agua', 'listo', 'espera', 'abrir', 'cerrar', 'grande', 'pequeño', 'bueno', 'malo', 'caliente', 'frío', 'todo', 'mi', 'tu', 'nosotros', 'ellos', 'puedo', 'hago', 'siento', 'creo', 'sé', 'veo'],
  fr: ['je', 'veux', 'besoin', 'aide', 'oui', 'non', 'plus', 'arrête', 'aller', "s'il vous plaît", 'merci', 'bonjour', 'au revoir', 'désolé', 'manger', 'boire', 'jouer', 'lire', 'aime', 'content', 'triste', 'maman', 'papa', 'ami', 'école', 'maison', 'toilettes', 'eau', 'fini', 'attends', 'ouvrir', 'fermer', 'grand', 'petit', 'bon', 'mauvais', 'chaud', 'froid', 'tout', 'mon', 'ton', 'nous', 'ils', 'peux', 'fais', 'sens', 'pense', 'sais', 'vois'],
  pt: ['eu', 'quero', 'preciso', 'ajuda', 'sim', 'não', 'mais', 'pare', 'ir', 'por favor', 'obrigado', 'olá', 'tchau', 'desculpe', 'comer', 'beber', 'brincar', 'ler', 'gosto', 'feliz', 'triste', 'mamãe', 'papai', 'amigo', 'escola', 'casa', 'banheiro', 'água', 'pronto', 'espere', 'abrir', 'fechar', 'grande', 'pequeno', 'bom', 'mau', 'quente', 'frio', 'tudo', 'meu', 'seu', 'nós', 'eles', 'posso', 'faço', 'sinto', 'acho', 'sei', 'vejo'],
  de: ['ich', 'will', 'brauche', 'hilfe', 'ja', 'nein', 'mehr', 'stopp', 'gehen', 'bitte', 'danke', 'hallo', 'tschüss', 'entschuldigung', 'essen', 'trinken', 'spielen', 'lesen', 'mag', 'glücklich', 'traurig', 'mama', 'papa', 'freund', 'schule', 'zuhause', 'toilette', 'wasser', 'fertig', 'warte', 'öffnen', 'schließen', 'groß', 'klein', 'gut', 'schlecht', 'heiß', 'kalt', 'alles', 'mein', 'dein', 'wir', 'sie', 'kann', 'mache', 'fühle', 'denke', 'weiß', 'sehe'],
  ru: ['я', 'хочу', 'нужно', 'помощь', 'да', 'нет', 'ещё', 'стоп', 'идти', 'пожалуйста', 'спасибо', 'привет', 'пока', 'извини', 'есть', 'пить', 'играть', 'читать', 'нравится', 'счастливый', 'грустный', 'мама', 'папа', 'друг', 'школа', 'дом', 'туалет', 'вода', 'готово', 'подожди', 'открыть', 'закрыть', 'большой', 'маленький', 'хорошо', 'плохо', 'горячий', 'холодный', 'всё', 'мой', 'твой', 'мы', 'они', 'могу', 'делаю', 'чувствую', 'думаю', 'знаю', 'вижу'],
  uk: ['я', 'хочу', 'потрібно', 'допомога', 'так', 'ні', 'ще', 'стоп', 'іти', 'будь ласка', 'дякую', 'привіт', 'бувай', 'вибач', 'їсти', 'пити', 'грати', 'читати', 'подобається', 'щасливий', 'сумний', 'мама', 'тато', 'друг', 'школа', 'дім', 'туалет', 'вода', 'готово', 'зачекай', 'відкрити', 'закрити', 'великий', 'малий', 'добре', 'погано', 'гарячий', 'холодний', 'все', 'мій', 'твій', 'ми', 'вони', 'можу', 'роблю', 'відчуваю', 'думаю', 'знаю', 'бачу'],
  ja: ['わたし', 'ほしい', 'たすけて', 'はい', 'いいえ', 'もっと', 'やめて', 'いく', 'おねがい', 'ありがとう', 'こんにちは', 'さようなら', 'ごめん', 'たべる', 'のむ', 'あそぶ', 'よむ', 'すき', 'うれしい', 'かなしい', 'まま', 'ぱぱ', 'ともだち', 'がっこう', 'いえ', 'トイレ', 'みず', 'おわり', 'まって', 'あける', 'しめる', 'おおきい', 'ちいさい', 'いい', 'わるい', 'あつい', 'さむい', 'ぜんぶ', 'わたしの', 'あなたの', 'わたしたち', 'かれら', 'できる', 'する', 'かんじる', 'おもう', 'しる', 'みる'],
  ko: ['나', '원해요', '필요해요', '도와주세요', '네', '아니요', '더', '그만', '가요', '제발', '감사합니다', '안녕하세요', '안녕히', '미안해요', '먹어요', '마셔요', '놀아요', '읽어요', '좋아요', '행복해요', '슬퍼요', '엄마', '아빠', '친구', '학교', '집', '화장실', '물', '끝', '기다려요', '열어요', '닫아요', '커요', '작아요', '좋아요', '나빠요', '뜨거워요', '추워요', '전부', '내', '네', '우리', '그들', '할수있어요', '해요', '느껴요', '생각해요', '알아요', '봐요'],
  zh: ['我', '要', '需要', '帮助', '是', '不', '更多', '停', '去', '请', '谢谢', '你好', '再见', '对不起', '吃', '喝', '玩', '读', '喜欢', '开心', '难过', '妈妈', '爸爸', '朋友', '学校', '家', '厕所', '水', '好了', '等', '打开', '关', '大', '小', '好', '坏', '热', '冷', '全部', '我的', '你的', '我们', '他们', '能', '做', '感觉', '想', '知道', '看'],
  'zh-Hans': ['我', '要', '需要', '帮助', '是', '不', '更多', '停', '去', '请', '谢谢', '你好', '再见', '对不起', '吃', '喝', '玩', '读', '喜欢', '开心', '难过', '妈妈', '爸爸', '朋友', '学校', '家', '厕所', '水', '好了', '等', '打开', '关', '大', '小', '好', '坏', '热', '冷', '全部', '我的', '你的', '我们', '他们', '能', '做', '感觉', '想', '知道', '看'],
  'zh-Hant': ['我', '要', '需要', '幫助', '是', '不', '更多', '停', '去', '請', '謝謝', '你好', '再見', '對不起', '吃', '喝', '玩', '讀', '喜歡', '開心', '難過', '媽媽', '爸爸', '朋友', '學校', '家', '廁所', '水', '好了', '等', '打開', '關', '大', '小', '好', '壞', '熱', '冷', '全部', '我的', '你的', '我們', '他們', '能', '做', '感覺', '想', '知道', '看'],
  'zh-HK': ['我', '要', '需要', '幫助', '是', '不', '更多', '停', '去', '請', '謝謝', '你好', '再見', '對不起', '吃', '喝', '玩', '讀', '喜歡', '開心', '難過', '媽媽', '爸爸', '朋友', '學校', '家', '廁所', '水', '好了', '等', '打開', '關', '大', '小', '好', '壞', '熱', '冷', '全部', '我的', '你的', '我們', '他們', '能', '做', '感覺', '想', '知道', '看'],
  ar: ['أنا', 'أريد', 'أحتاج', 'مساعدة', 'نعم', 'لا', 'المزيد', 'قف', 'اذهب', 'من فضلك', 'شكرا', 'مرحبا', 'مع السلامة', 'آسف', 'أكل', 'اشرب', 'العب', 'اقرأ', 'أحب', 'سعيد', 'حزين', 'ماما', 'بابا', 'صديق', 'مدرسة', 'بيت', 'حمام', 'ماء', 'انتهيت', 'انتظر', 'افتح', 'أغلق', 'كبير', 'صغير', 'جيد', 'سيء', 'حار', 'بارد', 'كل', 'ملكي', 'ملكك', 'نحن', 'هم', 'أستطيع', 'أفعل', 'أشعر', 'أعتقد', 'أعرف', 'أرى'],
};
