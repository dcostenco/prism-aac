'use client';
import { useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { useUIStore } from '@/store/uiStore';
import { usePredictionStore } from '@/store/predictionStore';
import { tapFeedback } from '@/services/feedback';
import { useT } from '@/engine/useT';
import { aacSpeak } from '@/services/aacSpeak';
import { useSettingsStore } from '@/store/settingsStore';
import { DEFAULT_PHRASES } from '@/constants/phrases';
import { getPhraseText } from '@/constants/phraseTranslations';
import { useAuthStore } from '@/store/authStore';

function PanelShell({ children }: { children: ReactNode }) {
  const { t } = useT();
  return (
    <section aria-label={t('games')} className="flex-[3] min-h-0 flex flex-col surface-bar border-y border-theme">
      {children}
    </section>
  );
}

type ActiveGame =
  | 'none'
  | 'bubble-pop'
  | 'color-hunt'
  | 'my-story'
  | 'match-it'
  | 'yes-no'
  | 'finish-it'
  | 'category-sort'
  | 'emotion-match'
  | 'sequence'
  | 'same-different'
  | 'sound-match'
  | 'turn-taker';

const COLORS = [
  { bg: '#FF6B6B', name: 'Red' },
  { bg: '#4ECDC4', name: 'Teal' },
  { bg: '#45B7D1', name: 'Blue' },
  { bg: '#96CEB4', name: 'Green' },
  { bg: '#FFEAA7', name: 'Yellow' },
  { bg: '#DDA0DD', name: 'Purple' },
  { bg: '#FF9F43', name: 'Orange' },
  { bg: '#55E6C1', name: 'Mint' },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getChildWords(lang: string): string[] {
  const wf = usePredictionStore.getState().wordFreq;
  const topWords = Object.entries(wf)
    .filter(([w]) => [...w].length >= 1 && w.length < 12)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 30)
    .map(([w]) => w.charAt(0).toUpperCase() + w.slice(1));

  if (topWords.length < 8) {
    const defaults = DEFAULT_PHRASES.slice(0, 20).map(p => {
      const text = getPhraseText(p.id, lang as never, p.text);
      return text.split(/\s+/)[0];
    }).filter(w => [...w].length >= 1 && w.length < 10);
    return shuffle([...new Set([...topWords, ...defaults])]).slice(0, 20);
  }
  return topWords;
}

/* ═════════════════════════════════════════════════════════════
   GAME 1: Bubble Pop — tap floating bubbles to hear words
   Colorful, animated, cause-and-effect. Every tap speaks the word.
   Uses the child's OWN vocabulary from their prediction store.
   ═════════════════════════════════════════════════════════════ */

interface Bubble {
  id: number;
  word: string;
  x: number;
  y: number;
  size: number;
  color: string;
  speed: number;
  popped: boolean;
}

function BubblePopGame({ onBack }: { onBack: () => void }) {
  const { t } = useT();
  const { speechRate, speechVolume, language } = useSettingsStore();
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [celebration, setCelebration] = useState(false);
  const [staticMode, setStaticMode] = useState(false);
  const rafRef = useRef(0);
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const spawnBubbles = useCallback(() => {
    const words = getChildWords(language);
    const count = Math.min(4 + level, 10);
    const newBubbles: Bubble[] = [];
    for (let i = 0; i < count; i++) {
      const word = words[i % words.length];
      const color = COLORS[i % COLORS.length];
      newBubbles.push({
        id: Date.now() + i,
        word,
        x: 10 + Math.random() * 70,
        y: staticMode ? 10 + Math.random() * 75 : 100 + Math.random() * 20,
        size: 60 + Math.random() * 30,
        color: color.bg,
        speed: 0.3 + Math.random() * 0.4 + level * 0.05,
        popped: false,
      });
    }
    setBubbles(newBubbles);
  }, [level, language, staticMode]);

  useEffect(() => { queueMicrotask(spawnBubbles); }, [spawnBubbles]);

  useEffect(() => {
    if (staticMode) return;
    const animate = () => {
      setBubbles(prev => {
        const updated = prev.map(b => b.popped ? b : { ...b, y: b.y - b.speed });
        if (updated.every(b => b.popped || b.y < -15)) {
          return updated;
        }
        return updated;
      });
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [staticMode]);

  const allGone = bubbles.length > 0 && bubbles.every(b => b.popped || b.y < -15);

  useEffect(() => {
    if (allGone && !celebration) {
      queueMicrotask(() => setCelebration(true));
      celebrationTimerRef.current = setTimeout(() => {
        setCelebration(false);
        setLevel(l => l + 1);
        spawnBubbles();
      }, 2000);
    }
    return () => {
      if (celebrationTimerRef.current) {
        clearTimeout(celebrationTimerRef.current);
        celebrationTimerRef.current = null;
      }
    };
  }, [allGone, celebration, spawnBubbles]);

  const popBubble = (id: number) => {
    tapFeedback();
    setBubbles(prev => prev.map(b => {
      if (b.id === id && !b.popped) {
        aacSpeak(b.word, speechRate, speechVolume);
        setScore(s => s + 1);
        return { ...b, popped: true };
      }
      return b;
    }));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-theme shrink-0">
        <button className="aac-btn min-h-[44px] px-3 rounded-xl surface-key text-muted font-bold border border-theme" onClick={() => { tapFeedback(); onBack(); }}>
          ← {t('back_to_games')}
        </button>
        <span className="text-primary font-bold text-xl">🫧 Bubble Pop</span>
        <div className="flex items-center gap-2 text-right">
          <button onClick={() => setStaticMode(v => !v)} className="aac-btn px-3 py-1 rounded-lg text-xs font-bold border border-theme surface-key text-primary">{staticMode ? '🎯 Static' : '🌊 Moving'}</button>
          <span className="text-primary font-bold">⭐ {score}</span>
          <span className="text-muted text-xs ml-2">Lv.{level}</span>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 relative overflow-hidden" style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
        {celebration && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <div className="text-6xl animate-bounce">🎉</div>
          </div>
        )}

        {bubbles.map(b => !b.popped && b.y > -15 && (
          <button
            key={b.id}
            onClick={() => popBubble(b.id)}
            className="absolute rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-75 select-none"
            style={{
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: b.size,
              height: b.size,
              backgroundColor: b.color,
              transform: `translateX(-50%)`,
              boxShadow: `0 0 20px ${b.color}60, inset 0 -4px 8px rgba(0,0,0,0.2), inset 0 4px 8px rgba(255,255,255,0.3)`,
            }}
          >
            <span className="text-white font-bold text-center leading-tight drop-shadow-md" style={{ fontSize: Math.max(10, b.size / 5) }}>
              {b.word}
            </span>
          </button>
        ))}

        {bubbles.filter(b => b.popped).map(b => (
          <div
            key={`pop-${b.id}`}
            className="absolute pointer-events-none animate-ping"
            style={{ left: `${b.x}%`, top: `${b.y}%`, transform: 'translate(-50%, -50%)' }}
          >
            <span className="text-4xl">✨</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   GAME 2: Color Hunt — find and tap the named color
   Teaches color vocabulary + receptive language (understanding).
   Big colorful tiles, spoken target, immediate feedback.
   ═════════════════════════════════════════════════════════════ */

const COLOR_I18N: Record<string, Record<string, string>> = {
  Red:    { en: 'Red', es: 'Rojo', fr: 'Rouge', de: 'Rot', pt: 'Vermelho', ro: 'Roșu', uk: 'Червоний', ru: 'Красный', ja: '赤', ko: '빨강', zh: '红色', ar: 'أحمر' },
  Blue:   { en: 'Blue', es: 'Azul', fr: 'Bleu', de: 'Blau', pt: 'Azul', ro: 'Albastru', uk: 'Синій', ru: 'Синий', ja: '青', ko: '파랑', zh: '蓝色', ar: 'أزرق' },
  Green:  { en: 'Green', es: 'Verde', fr: 'Vert', de: 'Grün', pt: 'Verde', ro: 'Verde', uk: 'Зелений', ru: 'Зелёный', ja: '緑', ko: '초록', zh: '绿色', ar: 'أخضر' },
  Yellow: { en: 'Yellow', es: 'Amarillo', fr: 'Jaune', de: 'Gelb', pt: 'Amarelo', ro: 'Galben', uk: 'Жовтий', ru: 'Жёлтый', ja: '黄', ko: '노랑', zh: '黄色', ar: 'أصفر' },
  Purple: { en: 'Purple', es: 'Morado', fr: 'Violet', de: 'Lila', pt: 'Roxo', ro: 'Violet', uk: 'Фіолетовий', ru: 'Фиолетовый', ja: '紫', ko: '보라', zh: '紫色', ar: 'بنفسجي' },
  Orange: { en: 'Orange', es: 'Naranja', fr: 'Orange', de: 'Orange', pt: 'Laranja', ro: 'Portocaliu', uk: 'Помаранчевий', ru: 'Оранжевый', ja: 'オレンジ', ko: '주황', zh: '橙色', ar: 'برتقالي' },
  Pink:   { en: 'Pink', es: 'Rosa', fr: 'Rose', de: 'Rosa', pt: 'Rosa', ro: 'Roz', uk: 'Рожевий', ru: 'Розовый', ja: 'ピンク', ko: '분홍', zh: '粉色', ar: 'وردي' },
  Brown:  { en: 'Brown', es: 'Marrón', fr: 'Marron', de: 'Braun', pt: 'Marrom', ro: 'Maro', uk: 'Коричневий', ru: 'Коричневый', ja: '茶色', ko: '갈색', zh: '棕色', ar: 'بني' },
};

function localColor(key: string, lang: string): string {
  return COLOR_I18N[key]?.[lang.split('-')[0]] || COLOR_I18N[key]?.en || key;
}

const COLOR_VOCAB = [
  { key: 'Red', bg: '#FF6B6B', emoji: '🔴' },
  { key: 'Blue', bg: '#45B7D1', emoji: '🔵' },
  { key: 'Green', bg: '#96CEB4', emoji: '🟢' },
  { key: 'Yellow', bg: '#FFEAA7', emoji: '🟡' },
  { key: 'Purple', bg: '#DDA0DD', emoji: '🟣' },
  { key: 'Orange', bg: '#FF9F43', emoji: '🟠' },
  { key: 'Pink', bg: '#FD79A8', emoji: '🩷' },
  { key: 'Brown', bg: '#B8860B', emoji: '🟤' },
];

function ColorHuntGame({ onBack }: { onBack: () => void }) {
  const { t } = useT();
  const { speechRate, speechVolume, language } = useSettingsStore();
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [gridSize, setGridSize] = useState(4);
  const [choices, setChoices] = useState<typeof COLOR_VOCAB>([]);
  const [target, setTarget] = useState<typeof COLOR_VOCAB[0] | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [tappedIdx, setTappedIdx] = useState(-1);

  const newRound = useCallback(() => {
    const size = Math.min(4 + Math.floor(round / 3), 8);
    setGridSize(size);
    const shuffled = shuffle(COLOR_VOCAB).slice(0, size);
    setChoices(shuffled);
    const tgt = shuffled[Math.floor(Math.random() * shuffled.length)];
    setTarget(tgt);
    setFeedback(null);
    setTappedIdx(-1);
    const localName = localColor(tgt.key, language);
    setTimeout(() => aacSpeak(localName, speechRate, speechVolume), 300);
  }, [round, speechRate, speechVolume]);

  useEffect(() => { queueMicrotask(newRound); }, [newRound]);

  const handleTap = (color: typeof COLOR_VOCAB[0], idx: number) => {
    tapFeedback();
    setTappedIdx(idx);
    if (color.key === target?.key) {
      setFeedback('correct');
      setScore(s => s + 1);
      aacSpeak(localColor(color.key, language), speechRate, speechVolume);
      setTimeout(() => { setRound(r => r + 1); }, 1500);
    } else {
      setFeedback('wrong');
      setTimeout(() => { setFeedback(null); setTappedIdx(-1); }, 800);
    }
  };

  const cols = gridSize <= 4 ? 'grid-cols-2' : gridSize <= 6 ? 'grid-cols-3' : 'grid-cols-4';

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-theme shrink-0">
        <button className="aac-btn min-h-[44px] px-3 rounded-xl surface-key text-muted font-bold border border-theme" onClick={() => { tapFeedback(); onBack(); }}>
          ← {t('back_to_games')}
        </button>
        <span className="text-primary font-bold text-xl">🎨 Color Hunt</span>
        <span className="text-primary font-bold">⭐ {score}</span>
      </div>

      <div className="shrink-0 py-3 text-center">
        <span className="text-3xl font-black" style={{ color: target?.bg }}>
          {target?.emoji} {target ? localColor(target.key, language) : ''}?
        </span>
      </div>

      <div className={`flex-1 grid ${cols} gap-3 p-4`}>
        {choices.map((color, idx) => (
          <button
            key={`${round}-${idx}`}
            onClick={() => handleTap(color, idx)}
            disabled={feedback === 'correct'}
            className={`rounded-3xl flex items-center justify-center transition-all duration-200 select-none shadow-lg active:scale-90 ${
              tappedIdx === idx && feedback === 'correct' ? 'ring-4 ring-white scale-110' :
              tappedIdx === idx && feedback === 'wrong' ? 'opacity-50 shake' : ''
            }`}
            style={{
              backgroundColor: color.bg,
              boxShadow: `0 6px 20px ${color.bg}40`,
              minHeight: 'clamp(80px, 15vh, 140px)',
            }}
          >
            <span className="text-white font-black text-2xl md:text-3xl drop-shadow-lg">{localColor(color.key, language)}</span>
          </button>
        ))}
      </div>

      {feedback === 'correct' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="text-8xl animate-bounce">🌟</div>
        </div>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   GAME 3: My Story — build a sentence from picture cards
   The child taps colorful picture cards to build a sentence,
   then the app speaks it. Teaches sentence construction + manding.
   Uses the child's schedule + vocabulary for personalized content.
   ═════════════════════════════════════════════════════════════ */

interface StoryCard {
  id: string;
  words: Record<string, string>;
  emoji: string;
  color: string;
  category: 'who' | 'action' | 'what' | 'where';
}

function storyWord(card: StoryCard, lang: string): string {
  return card.words[lang.split('-')[0]] || card.words.en;
}

const STORY_CARDS: StoryCard[] = [
  { id: 'i', words: { en: 'I', es: 'Yo', fr: 'Je', de: 'Ich', pt: 'Eu', ro: 'Eu', uk: 'Я', ru: 'Я', ja: '私', ko: '나', zh: '我', ar: 'أنا' }, emoji: '🧒', color: '#FF6B6B', category: 'who' },
  { id: 'mom', words: { en: 'Mom', es: 'Mamá', fr: 'Maman', de: 'Mama', pt: 'Mamãe', ro: 'Mama', uk: 'Мама', ru: 'Мама', ja: 'ママ', ko: '엄마', zh: '妈妈', ar: 'ماما' }, emoji: '👩', color: '#FF6B6B', category: 'who' },
  { id: 'dad', words: { en: 'Dad', es: 'Papá', fr: 'Papa', de: 'Papa', pt: 'Papai', ro: 'Tata', uk: 'Тато', ru: 'Папа', ja: 'パパ', ko: '아빠', zh: '爸爸', ar: 'بابا' }, emoji: '👨', color: '#FF6B6B', category: 'who' },
  { id: 'want', words: { en: 'want', es: 'quiero', fr: 'veux', de: 'will', pt: 'quero', ro: 'vreau', uk: 'хочу', ru: 'хочу', ja: 'ほしい', ko: '원해', zh: '要', ar: 'أريد' }, emoji: '🙏', color: '#4ECDC4', category: 'action' },
  { id: 'go', words: { en: 'go', es: 'ir', fr: 'aller', de: 'gehen', pt: 'ir', ro: 'merge', uk: 'іти', ru: 'идти', ja: '行く', ko: '가다', zh: '去', ar: 'أذهب' }, emoji: '🚶', color: '#4ECDC4', category: 'action' },
  { id: 'eat', words: { en: 'eat', es: 'comer', fr: 'manger', de: 'essen', pt: 'comer', ro: 'mânca', uk: 'їсти', ru: 'есть', ja: '食べる', ko: '먹다', zh: '吃', ar: 'آكل' }, emoji: '🍽️', color: '#4ECDC4', category: 'action' },
  { id: 'play', words: { en: 'play', es: 'jugar', fr: 'jouer', de: 'spielen', pt: 'brincar', ro: 'juca', uk: 'грати', ru: 'играть', ja: '遊ぶ', ko: '놀다', zh: '玩', ar: 'ألعب' }, emoji: '🎈', color: '#4ECDC4', category: 'action' },
  { id: 'drink', words: { en: 'drink', es: 'beber', fr: 'boire', de: 'trinken', pt: 'beber', ro: 'bea', uk: 'пити', ru: 'пить', ja: '飲む', ko: '마시다', zh: '喝', ar: 'أشرب' }, emoji: '🥤', color: '#4ECDC4', category: 'action' },
  { id: 'water', words: { en: 'water', es: 'agua', fr: 'eau', de: 'Wasser', pt: 'água', ro: 'apă', uk: 'воду', ru: 'воду', ja: '水', ko: '물', zh: '水', ar: 'ماء' }, emoji: '💧', color: '#45B7D1', category: 'what' },
  { id: 'food', words: { en: 'food', es: 'comida', fr: 'nourriture', de: 'Essen', pt: 'comida', ro: 'mâncare', uk: 'їжу', ru: 'еду', ja: '食べ物', ko: '음식', zh: '食物', ar: 'طعام' }, emoji: '🍕', color: '#45B7D1', category: 'what' },
  { id: 'ball', words: { en: 'ball', es: 'pelota', fr: 'ballon', de: 'Ball', pt: 'bola', ro: 'minge', uk: 'м\'яч', ru: 'мяч', ja: 'ボール', ko: '공', zh: '球', ar: 'كرة' }, emoji: '⚽', color: '#45B7D1', category: 'what' },
  { id: 'book', words: { en: 'book', es: 'libro', fr: 'livre', de: 'Buch', pt: 'livro', ro: 'carte', uk: 'книгу', ru: 'книгу', ja: '本', ko: '책', zh: '书', ar: 'كتاب' }, emoji: '📖', color: '#45B7D1', category: 'what' },
  { id: 'music', words: { en: 'music', es: 'música', fr: 'musique', de: 'Musik', pt: 'música', ro: 'muzică', uk: 'музику', ru: 'музыку', ja: '音楽', ko: '음악', zh: '音乐', ar: 'موسيقى' }, emoji: '🎵', color: '#45B7D1', category: 'what' },
  { id: 'home', words: { en: 'home', es: 'casa', fr: 'maison', de: 'Hause', pt: 'casa', ro: 'acasă', uk: 'додому', ru: 'домой', ja: '家', ko: '집', zh: '家', ar: 'البيت' }, emoji: '🏠', color: '#96CEB4', category: 'where' },
  { id: 'park', words: { en: 'park', es: 'parque', fr: 'parc', de: 'Park', pt: 'parque', ro: 'parc', uk: 'парк', ru: 'парк', ja: '公園', ko: '공원', zh: '公园', ar: 'الحديقة' }, emoji: '🌳', color: '#96CEB4', category: 'where' },
  { id: 'school', words: { en: 'school', es: 'escuela', fr: 'école', de: 'Schule', pt: 'escola', ro: 'școală', uk: 'школу', ru: 'школу', ja: '学校', ko: '학교', zh: '学校', ar: 'المدرسة' }, emoji: '🏫', color: '#96CEB4', category: 'where' },
];

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  who: { label: 'Who?', color: '#FF6B6B' },
  action: { label: 'Does what?', color: '#4ECDC4' },
  what: { label: 'What?', color: '#45B7D1' },
  where: { label: 'Where?', color: '#96CEB4' },
};

function MyStoryGame({ onBack }: { onBack: () => void }) {
  const { t } = useT();
  const { speechRate, speechVolume, language } = useSettingsStore();
  const [sentence, setSentence] = useState<StoryCard[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('who');

  const addCard = (card: StoryCard) => {
    tapFeedback();
    aacSpeak(storyWord(card, language), speechRate, speechVolume);
    setSentence(prev => [...prev, card]);

    const categories = ['who', 'action', 'what', 'where'];
    const nextIdx = categories.indexOf(card.category) + 1;
    if (nextIdx < categories.length) setActiveCategory(categories[nextIdx]);
  };

  const speakSentence = () => {
    tapFeedback();
    const text = sentence.map(c => storyWord(c, language)).join(' ');
    aacSpeak(text, speechRate, speechVolume);
  };

  const clearSentence = () => {
    tapFeedback();
    setSentence([]);
    setActiveCategory('who');
  };

  const removeLastCard = () => {
    tapFeedback();
    setSentence(prev => {
      const next = prev.slice(0, -1);
      if (next.length > 0) {
        const categories = ['who', 'action', 'what', 'where'];
        const lastCat = next[next.length - 1].category;
        const nextIdx = categories.indexOf(lastCat) + 1;
        setActiveCategory(categories[Math.min(nextIdx, categories.length - 1)]);
      } else {
        setActiveCategory('who');
      }
      return next;
    });
  };

  const filteredCards = STORY_CARDS.filter(c => c.category === activeCategory);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-theme shrink-0">
        <button className="aac-btn min-h-[44px] px-3 rounded-xl surface-key text-muted font-bold border border-theme" onClick={() => { tapFeedback(); onBack(); }}>
          ← {t('back_to_games')}
        </button>
        <span className="text-primary font-bold text-xl">📖 My Story</span>
        <div className="flex gap-1">
          <button onClick={removeLastCard} disabled={sentence.length === 0} className="aac-btn w-10 h-10 rounded-xl surface-key text-lg border border-theme disabled:opacity-30">↩</button>
          <button onClick={clearSentence} disabled={sentence.length === 0} className="aac-btn w-10 h-10 rounded-xl surface-key text-lg border border-theme disabled:opacity-30">🗑</button>
        </div>
      </div>

      {/* Sentence builder strip */}
      <div className="shrink-0 px-3 py-2 border-b border-theme min-h-[70px] flex items-center gap-2 overflow-x-auto">
        {sentence.length === 0 ? (
          <span className="text-muted text-lg italic">Tap cards to build a sentence...</span>
        ) : (
          <>
            {sentence.map((card, i) => (
              <div
                key={`${card.id}-${i}`}
                className="shrink-0 rounded-xl px-3 py-2 flex items-center gap-1 shadow-md"
                style={{ backgroundColor: card.color }}
              >
                <span className="text-xl">{card.emoji}</span>
                <span className="text-white font-bold text-lg">{storyWord(card, language)}</span>
              </div>
            ))}
            <button
              onClick={speakSentence}
              className="shrink-0 rounded-xl px-4 py-2 bg-[#4CAF50] text-white font-bold text-lg shadow-lg active:scale-90 transition-transform flex items-center gap-1"
            >
              ▶ Speak
            </button>
          </>
        )}
      </div>

      {/* Category indicator */}
      <div className="shrink-0 flex gap-2 px-3 py-2">
        {Object.entries(CATEGORY_LABELS).map(([cat, { label, color }]) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 rounded-full font-bold text-sm transition-all ${
              activeCategory === cat ? 'text-white scale-110 shadow-lg' : 'text-white/60 scale-95'
            }`}
            style={{ backgroundColor: activeCategory === cat ? color : `${color}40` }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Card grid */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
          {filteredCards.map(card => (
            <button
              key={card.id}
              onClick={() => addCard(card)}
              className="rounded-2xl flex flex-col items-center justify-center gap-1 p-3 shadow-lg active:scale-90 transition-transform select-none"
              style={{
                backgroundColor: card.color,
                minHeight: 'clamp(70px, 12vh, 110px)',
                boxShadow: `0 4px 15px ${card.color}40`,
              }}
            >
              <span className="text-3xl md:text-4xl">{card.emoji}</span>
              <span className="text-white font-bold text-sm md:text-base">{storyWord(card, language)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   GAME 4: Match It — Receptive identification (listener responding)
   TTS says "find the [item]", child taps correct picture from 4.
   Teaches receptive vocabulary, listener responding per BACB Task List.
   ═════════════════════════════════════════════════════════════ */

const MATCH_ITEMS_I18N: Record<string, Record<string, string>> = {
  dog:    { en: 'dog', es: 'perro', fr: 'chien', de: 'Hund', pt: 'cachorro', ro: 'câine', uk: 'собака', ru: 'собака', ja: '犬', ko: '개', zh: '狗', ar: 'كلب' },
  cat:    { en: 'cat', es: 'gato', fr: 'chat', de: 'Katze', pt: 'gato', ro: 'pisică', uk: 'кіт', ru: 'кот', ja: '猫', ko: '고양이', zh: '猫', ar: 'قطة' },
  car:    { en: 'car', es: 'carro', fr: 'voiture', de: 'Auto', pt: 'carro', ro: 'mașină', uk: 'машина', ru: 'машина', ja: '車', ko: '자동차', zh: '车', ar: 'سيارة' },
  house:  { en: 'house', es: 'casa', fr: 'maison', de: 'Haus', pt: 'casa', ro: 'casă', uk: 'будинок', ru: 'дом', ja: '家', ko: '집', zh: '房子', ar: 'منزل' },
  tree:   { en: 'tree', es: 'árbol', fr: 'arbre', de: 'Baum', pt: 'árvore', ro: 'copac', uk: 'дерево', ru: 'дерево', ja: '木', ko: '나무', zh: '树', ar: 'شجرة' },
  fish:   { en: 'fish', es: 'pez', fr: 'poisson', de: 'Fisch', pt: 'peixe', ro: 'pește', uk: 'риба', ru: 'рыба', ja: '魚', ko: '물고기', zh: '鱼', ar: 'سمكة' },
  bird:   { en: 'bird', es: 'pájaro', fr: 'oiseau', de: 'Vogel', pt: 'pássaro', ro: 'pasăre', uk: 'птах', ru: 'птица', ja: '鳥', ko: '새', zh: '鸟', ar: 'طائر' },
  flower: { en: 'flower', es: 'flor', fr: 'fleur', de: 'Blume', pt: 'flor', ro: 'floare', uk: 'квітка', ru: 'цветок', ja: '花', ko: '꽃', zh: '花', ar: 'زهرة' },
  sun:    { en: 'sun', es: 'sol', fr: 'soleil', de: 'Sonne', pt: 'sol', ro: 'soare', uk: 'сонце', ru: 'солнце', ja: '太陽', ko: '해', zh: '太阳', ar: 'شمس' },
  moon:   { en: 'moon', es: 'luna', fr: 'lune', de: 'Mond', pt: 'lua', ro: 'lună', uk: 'місяць', ru: 'луна', ja: '月', ko: '달', zh: '月亮', ar: 'قمر' },
  star:   { en: 'star', es: 'estrella', fr: 'étoile', de: 'Stern', pt: 'estrela', ro: 'stea', uk: 'зірка', ru: 'звезда', ja: '星', ko: '별', zh: '星星', ar: 'نجمة' },
  apple:  { en: 'apple', es: 'manzana', fr: 'pomme', de: 'Apfel', pt: 'maçã', ro: 'măr', uk: 'яблуко', ru: 'яблоко', ja: 'りんご', ko: '사과', zh: '苹果', ar: 'تفاحة' },
};

const MATCH_FIND_I18N: Record<string, string> = {
  en: 'Find the', es: 'Encuentra el', fr: 'Trouve le', de: 'Finde den', pt: 'Encontre o',
  ro: 'Găsește', uk: 'Знайди', ru: 'Найди', ja: '見つけて', ko: '찾아봐', zh: '找到', ar: 'جد',
};

const MATCH_ITEMS = [
  { key: 'dog', emoji: '🐕' },
  { key: 'cat', emoji: '🐱' },
  { key: 'car', emoji: '🚗' },
  { key: 'house', emoji: '🏠' },
  { key: 'tree', emoji: '🌳' },
  { key: 'fish', emoji: '🐟' },
  { key: 'bird', emoji: '🐦' },
  { key: 'flower', emoji: '🌸' },
  { key: 'sun', emoji: '☀️' },
  { key: 'moon', emoji: '🌙' },
  { key: 'star', emoji: '⭐' },
  { key: 'apple', emoji: '🍎' },
];

function localMatchItem(key: string, lang: string): string {
  return MATCH_ITEMS_I18N[key]?.[lang.split('-')[0]] || MATCH_ITEMS_I18N[key]?.en || key;
}

function MatchItGame({ onBack }: { onBack: () => void }) {
  const { t } = useT();
  const { speechRate, speechVolume, language } = useSettingsStore();
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [round, setRound] = useState(0);
  const [target, setTarget] = useState<typeof MATCH_ITEMS[0] | null>(null);
  const [choices, setChoices] = useState<typeof MATCH_ITEMS>([]);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [tappedKey, setTappedKey] = useState('');

  const findPrompt = MATCH_FIND_I18N[language.split('-')[0]] || MATCH_FIND_I18N.en;

  const newRound = useCallback(() => {
    const all = shuffle(MATCH_ITEMS);
    const tgt = all[0];
    const distractors = all.slice(1, 4);
    const ch = shuffle([tgt, ...distractors]);
    setTarget(tgt);
    setChoices(ch);
    setFeedback(null);
    setTappedKey('');
    const localName = localMatchItem(tgt.key, language);
    setTimeout(() => aacSpeak(`${findPrompt} ${localName}`, speechRate, speechVolume), 300);
  }, [round, speechRate, speechVolume, language, findPrompt]);

  useEffect(() => { queueMicrotask(newRound); }, [newRound]);

  const handleTap = (item: typeof MATCH_ITEMS[0]) => {
    tapFeedback();
    setTappedKey(item.key);
    const localName = localMatchItem(item.key, language);
    aacSpeak(localName, speechRate, speechVolume);
    if (item.key === target?.key) {
      setFeedback('correct');
      setScore(s => s + 1);
      if ((score + 1) % 5 === 0) setLevel(l => l + 1);
      setTimeout(() => { setRound(r => r + 1); }, 1500);
    } else {
      setFeedback('wrong');
      setTimeout(() => { setFeedback(null); setTappedKey(''); }, 800);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-theme shrink-0">
        <button className="aac-btn min-h-[44px] px-3 rounded-xl surface-key text-muted font-bold border border-theme" onClick={() => { tapFeedback(); onBack(); }}>
          ← {t('back_to_games')}
        </button>
        <span className="text-primary font-bold text-xl">🔍 Match It</span>
        <div className="text-right">
          <span className="text-primary font-bold">⭐ {score}</span>
          <span className="text-muted text-xs ml-2">Lv.{level}</span>
        </div>
      </div>

      <div className="shrink-0 py-4 text-center" style={{ background: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' }}>
        <span className="text-2xl md:text-3xl font-black text-white drop-shadow-lg">
          {findPrompt} {target ? localMatchItem(target.key, language) : ''}?
        </span>
        <button
          onClick={() => { tapFeedback(); if (target) aacSpeak(`${findPrompt} ${localMatchItem(target.key, language)}`, speechRate, speechVolume); }}
          className="ml-3 text-2xl"
        >🔊</button>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-4 p-4" style={{ background: 'linear-gradient(180deg, #fbc2eb 0%, #a6c1ee 100%)' }}>
        {choices.map(item => (
          <button
            key={`${round}-${item.key}`}
            onClick={() => handleTap(item)}
            disabled={feedback === 'correct'}
            className={`rounded-3xl flex flex-col items-center justify-center gap-2 shadow-xl active:scale-90 transition-all duration-200 select-none ${
              tappedKey === item.key && feedback === 'correct' ? 'ring-4 ring-green-400 scale-110' :
              tappedKey === item.key && feedback === 'wrong' ? 'opacity-50 shake' : ''
            }`}
            style={{
              backgroundColor: 'rgba(255,255,255,0.9)',
              minHeight: 'clamp(100px, 20vh, 180px)',
              boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
            }}
          >
            <span className="text-5xl md:text-6xl">{item.emoji}</span>
            <span className="text-gray-700 font-bold text-lg">{localMatchItem(item.key, language)}</span>
          </button>
        ))}
      </div>

      {feedback === 'correct' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="text-8xl animate-bounce">🌟</div>
        </div>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   GAME 5: Yes/No — Conditional discrimination
   Shows emoji + asks "Is this a [label]?" (50% correct, 50% wrong).
   Child taps big Yes or No. Teaches conditional discrimination.
   ═════════════════════════════════════════════════════════════ */

const YESNO_IS_THIS_I18N: Record<string, string> = {
  en: 'Is this a', es: '¿Es esto un', fr: 'Est-ce un', de: 'Ist das ein', pt: 'Isso é um',
  ro: 'Acesta este un', uk: 'Це', ru: 'Это', ja: 'これは', ko: '이것은', zh: '这是', ar: 'هل هذا',
};

const YESNO_YES_I18N: Record<string, string> = {
  en: 'Yes', es: 'Sí', fr: 'Oui', de: 'Ja', pt: 'Sim',
  ro: 'Da', uk: 'Так', ru: 'Да', ja: 'はい', ko: '네', zh: '是', ar: 'نعم',
};

const YESNO_NO_I18N: Record<string, string> = {
  en: 'No', es: 'No', fr: 'Non', de: 'Nein', pt: 'Não',
  ro: 'Nu', uk: 'Ні', ru: 'Нет', ja: 'いいえ', ko: '아니요', zh: '不是', ar: 'لا',
};

function YesNoGame({ onBack }: { onBack: () => void }) {
  const { t } = useT();
  const { speechRate, speechVolume, language } = useSettingsStore();
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [round, setRound] = useState(0);
  const [shownItem, setShownItem] = useState<typeof MATCH_ITEMS[0] | null>(null);
  const [askedLabel, setAskedLabel] = useState('');
  const [isCorrectPair, setIsCorrectPair] = useState(true);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  const langKey = language.split('-')[0];
  const isThisA = YESNO_IS_THIS_I18N[langKey] || YESNO_IS_THIS_I18N.en;
  const yesText = YESNO_YES_I18N[langKey] || YESNO_YES_I18N.en;
  const noText = YESNO_NO_I18N[langKey] || YESNO_NO_I18N.en;

  const newRound = useCallback(() => {
    const all = shuffle(MATCH_ITEMS);
    const item = all[0];
    const correct = Math.random() < 0.5;
    setShownItem(item);
    setIsCorrectPair(correct);
    const label = correct ? localMatchItem(item.key, language) : localMatchItem(all[1].key, language);
    setAskedLabel(label);
    setFeedback(null);
    setTimeout(() => aacSpeak(`${isThisA} ${label}?`, speechRate, speechVolume), 300);
  }, [round, speechRate, speechVolume, language, isThisA]);

  useEffect(() => { queueMicrotask(newRound); }, [newRound]);

  const handleAnswer = (answeredYes: boolean) => {
    tapFeedback();
    const correctAnswer = isCorrectPair ? true : false;
    const isRight = answeredYes === correctAnswer;
    aacSpeak(answeredYes ? yesText : noText, speechRate, speechVolume);
    if (isRight) {
      setFeedback('correct');
      setScore(s => s + 1);
      if ((score + 1) % 5 === 0) setLevel(l => l + 1);
      setTimeout(() => { setRound(r => r + 1); }, 1500);
    } else {
      setFeedback('wrong');
      setTimeout(() => { setFeedback(null); }, 800);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-theme shrink-0">
        <button className="aac-btn min-h-[44px] px-3 rounded-xl surface-key text-muted font-bold border border-theme" onClick={() => { tapFeedback(); onBack(); }}>
          ← {t('back_to_games')}
        </button>
        <span className="text-primary font-bold text-xl">❓ Yes / No</span>
        <div className="text-right">
          <span className="text-primary font-bold">⭐ {score}</span>
          <span className="text-muted text-xs ml-2">Lv.{level}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6" style={{ background: 'linear-gradient(180deg, #ffecd2 0%, #fcb69f 100%)' }}>
        <div className="text-8xl">{shownItem?.emoji}</div>
        <div className="text-2xl md:text-3xl font-black text-gray-800 text-center">
          {isThisA} {askedLabel}?
        </div>
        <button
          onClick={() => { tapFeedback(); aacSpeak(`${isThisA} ${askedLabel}?`, speechRate, speechVolume); }}
          className="text-3xl"
        >🔊</button>

        <div className="flex gap-6 w-full max-w-md">
          <button
            onClick={() => handleAnswer(true)}
            disabled={feedback === 'correct'}
            className={`flex-1 rounded-3xl flex flex-col items-center justify-center gap-2 shadow-xl active:scale-90 transition-all select-none ${
              feedback === 'correct' && isCorrectPair ? 'ring-4 ring-green-400' : ''
            }`}
            style={{
              background: 'linear-gradient(135deg, #56ab2f 0%, #a8e063 100%)',
              minHeight: 'clamp(100px, 18vh, 160px)',
            }}
          >
            <span className="text-5xl">✅</span>
            <span className="text-white font-black text-2xl">{yesText}</span>
          </button>

          <button
            onClick={() => handleAnswer(false)}
            disabled={feedback === 'correct'}
            className={`flex-1 rounded-3xl flex flex-col items-center justify-center gap-2 shadow-xl active:scale-90 transition-all select-none ${
              feedback === 'correct' && !isCorrectPair ? 'ring-4 ring-green-400' : ''
            }`}
            style={{
              background: 'linear-gradient(135deg, #f85032 0%, #e73827 100%)',
              minHeight: 'clamp(100px, 18vh, 160px)',
            }}
          >
            <span className="text-5xl">❌</span>
            <span className="text-white font-black text-2xl">{noText}</span>
          </button>
        </div>
      </div>

      {feedback === 'correct' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="text-8xl animate-bounce">🌟</div>
        </div>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   GAME 6: Finish It — Manding with carrier phrases
   Shows "I want ___" with 4 picture choices. Child taps to complete.
   Teaches manding (requesting) using carrier phrases per VB-MAPP.
   ═════════════════════════════════════════════════════════════ */

const CARRIER_I18N: Record<string, Record<string, string>> = {
  'I want':  { en: 'I want', es: 'Yo quiero', fr: 'Je veux', de: 'Ich will', pt: 'Eu quero', ro: 'Eu vreau', uk: 'Я хочу', ru: 'Я хочу', ja: '欲しい', ko: '나는 원해', zh: '我要', ar: 'أريد' },
  'I see':   { en: 'I see', es: 'Yo veo', fr: 'Je vois', de: 'Ich sehe', pt: 'Eu vejo', ro: 'Eu văd', uk: 'Я бачу', ru: 'Я вижу', ja: '見える', ko: '나는 봐', zh: '我看到', ar: 'أرى' },
  'I like':  { en: 'I like', es: 'Me gusta', fr: 'J\'aime', de: 'Ich mag', pt: 'Eu gosto de', ro: 'Îmi place', uk: 'Мені подобається', ru: 'Мне нравится', ja: '好き', ko: '나는 좋아해', zh: '我喜欢', ar: 'أحب' },
  'Give me': { en: 'Give me', es: 'Dame', fr: 'Donne-moi', de: 'Gib mir', pt: 'Me dê', ro: 'Dă-mi', uk: 'Дай мені', ru: 'Дай мне', ja: 'ちょうだい', ko: '나에게 줘', zh: '给我', ar: 'أعطني' },
};

const FINISH_ITEMS = [
  { key: 'water', emoji: '💧' },
  { key: 'food', emoji: '🍕' },
  { key: 'apple', emoji: '🍎' },
  { key: 'ball', emoji: '⚽' },
  { key: 'book', emoji: '📖' },
  { key: 'dog', emoji: '🐕' },
  { key: 'cat', emoji: '🐱' },
  { key: 'flower', emoji: '🌸' },
  { key: 'star', emoji: '⭐' },
  { key: 'fish', emoji: '🐟' },
  { key: 'bird', emoji: '🐦' },
  { key: 'car', emoji: '🚗' },
];

const FINISH_ITEMS_I18N: Record<string, Record<string, string>> = {
  water:  { en: 'water', es: 'agua', fr: 'eau', de: 'Wasser', pt: 'água', ro: 'apă', uk: 'воду', ru: 'воду', ja: '水', ko: '물', zh: '水', ar: 'ماء' },
  food:   { en: 'food', es: 'comida', fr: 'nourriture', de: 'Essen', pt: 'comida', ro: 'mâncare', uk: 'їжу', ru: 'еду', ja: '食べ物', ko: '음식', zh: '食物', ar: 'طعام' },
  apple:  { en: 'apple', es: 'manzana', fr: 'pomme', de: 'Apfel', pt: 'maçã', ro: 'măr', uk: 'яблуко', ru: 'яблоко', ja: 'りんご', ko: '사과', zh: '苹果', ar: 'تفاحة' },
  ball:   { en: 'ball', es: 'pelota', fr: 'ballon', de: 'Ball', pt: 'bola', ro: 'minge', uk: 'м\'яч', ru: 'мяч', ja: 'ボール', ko: '공', zh: '球', ar: 'كرة' },
  book:   { en: 'book', es: 'libro', fr: 'livre', de: 'Buch', pt: 'livro', ro: 'carte', uk: 'книгу', ru: 'книгу', ja: '本', ko: '책', zh: '书', ar: 'كتاب' },
  dog:    { en: 'dog', es: 'perro', fr: 'chien', de: 'Hund', pt: 'cachorro', ro: 'câine', uk: 'собаку', ru: 'собаку', ja: '犬', ko: '개', zh: '狗', ar: 'كلب' },
  cat:    { en: 'cat', es: 'gato', fr: 'chat', de: 'Katze', pt: 'gato', ro: 'pisică', uk: 'кота', ru: 'кота', ja: '猫', ko: '고양이', zh: '猫', ar: 'قطة' },
  flower: { en: 'flower', es: 'flor', fr: 'fleur', de: 'Blume', pt: 'flor', ro: 'floare', uk: 'квітку', ru: 'цветок', ja: '花', ko: '꽃', zh: '花', ar: 'زهرة' },
  star:   { en: 'star', es: 'estrella', fr: 'étoile', de: 'Stern', pt: 'estrela', ro: 'stea', uk: 'зірку', ru: 'звезду', ja: '星', ko: '별', zh: '星星', ar: 'نجمة' },
  fish:   { en: 'fish', es: 'pez', fr: 'poisson', de: 'Fisch', pt: 'peixe', ro: 'pește', uk: 'рибу', ru: 'рыбу', ja: '魚', ko: '물고기', zh: '鱼', ar: 'سمكة' },
  bird:   { en: 'bird', es: 'pájaro', fr: 'oiseau', de: 'Vogel', pt: 'pássaro', ro: 'pasăre', uk: 'птаха', ru: 'птицу', ja: '鳥', ko: '새', zh: '鸟', ar: 'طائر' },
  car:    { en: 'car', es: 'carro', fr: 'voiture', de: 'Auto', pt: 'carro', ro: 'mașină', uk: 'машину', ru: 'машину', ja: '車', ko: '자동차', zh: '车', ar: 'سيارة' },
};

function FinishItGame({ onBack }: { onBack: () => void }) {
  const { t } = useT();
  const { speechRate, speechVolume, language } = useSettingsStore();
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [round, setRound] = useState(0);
  const [carrier, setCarrier] = useState('I want');
  const [target, setTarget] = useState<typeof FINISH_ITEMS[0] | null>(null);
  const [choices, setChoices] = useState<typeof FINISH_ITEMS>([]);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [tappedKey, setTappedKey] = useState('');

  const langKey = language.split('-')[0];

  const localCarrier = (key: string) => CARRIER_I18N[key]?.[langKey] || CARRIER_I18N[key]?.en || key;
  const localFinish = (key: string) => FINISH_ITEMS_I18N[key]?.[langKey] || FINISH_ITEMS_I18N[key]?.en || key;

  const newRound = useCallback(() => {
    const carrierKeys = Object.keys(CARRIER_I18N);
    const ck = carrierKeys[Math.floor(Math.random() * carrierKeys.length)];
    setCarrier(ck);
    const all = shuffle(FINISH_ITEMS);
    const tgt = all[0];
    const distractors = all.slice(1, 4);
    const ch = shuffle([tgt, ...distractors]);
    setTarget(tgt);
    setChoices(ch);
    setFeedback(null);
    setTappedKey('');
    const phrase = `${localCarrier(ck)} ___`;
    setTimeout(() => aacSpeak(phrase, speechRate, speechVolume), 300);
  }, [round, speechRate, speechVolume, language]);

  useEffect(() => { queueMicrotask(newRound); }, [newRound]);

  const handleTap = (item: typeof FINISH_ITEMS[0]) => {
    tapFeedback();
    setTappedKey(item.key);
    const fullPhrase = `${localCarrier(carrier)} ${localFinish(item.key)}`;
    aacSpeak(fullPhrase, speechRate, speechVolume);
    if (item.key === target?.key) {
      setFeedback('correct');
      setScore(s => s + 1);
      if ((score + 1) % 5 === 0) setLevel(l => l + 1);
      setTimeout(() => { setRound(r => r + 1); }, 1500);
    } else {
      setFeedback('wrong');
      setTimeout(() => { setFeedback(null); setTappedKey(''); }, 800);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-theme shrink-0">
        <button className="aac-btn min-h-[44px] px-3 rounded-xl surface-key text-muted font-bold border border-theme" onClick={() => { tapFeedback(); onBack(); }}>
          ← {t('back_to_games')}
        </button>
        <span className="text-primary font-bold text-xl">💬 Finish It</span>
        <div className="text-right">
          <span className="text-primary font-bold">⭐ {score}</span>
          <span className="text-muted text-xs ml-2">Lv.{level}</span>
        </div>
      </div>

      <div className="shrink-0 py-4 text-center" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <span className="text-2xl md:text-3xl font-black text-white drop-shadow-lg">
          {localCarrier(carrier)} ___
        </span>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-4 p-4" style={{ background: 'linear-gradient(180deg, #764ba2 0%, #e0c3fc 100%)' }}>
        {choices.map(item => (
          <button
            key={`${round}-${item.key}`}
            onClick={() => handleTap(item)}
            disabled={feedback === 'correct'}
            className={`rounded-3xl flex flex-col items-center justify-center gap-2 shadow-xl active:scale-90 transition-all duration-200 select-none ${
              tappedKey === item.key && feedback === 'correct' ? 'ring-4 ring-green-400 scale-110' :
              tappedKey === item.key && feedback === 'wrong' ? 'opacity-50 shake' : ''
            }`}
            style={{
              backgroundColor: 'rgba(255,255,255,0.9)',
              minHeight: 'clamp(100px, 20vh, 180px)',
              boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
            }}
          >
            <span className="text-5xl md:text-6xl">{item.emoji}</span>
            <span className="text-gray-700 font-bold text-lg">{localFinish(item.key)}</span>
          </button>
        ))}
      </div>

      {feedback === 'correct' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="text-8xl animate-bounce">🌟</div>
        </div>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   GAME 7: Category Sort — Feature-function-class
   Shows item at top, child taps which category it belongs to.
   Teaches feature/function/class (FFC) per BACB Task List.
   ═════════════════════════════════════════════════════════════ */

const CATEGORY_SORT_I18N: Record<string, Record<string, string>> = {
  Food:     { en: 'Food', es: 'Comida', fr: 'Nourriture', de: 'Essen', pt: 'Comida', ro: 'Mâncare', uk: 'Їжа', ru: 'Еда', ja: '食べ物', ko: '음식', zh: '食物', ar: 'طعام' },
  Animals:  { en: 'Animals', es: 'Animales', fr: 'Animaux', de: 'Tiere', pt: 'Animais', ro: 'Animale', uk: 'Тварини', ru: 'Животные', ja: '動物', ko: '동물', zh: '动物', ar: 'حيوانات' },
  Clothing: { en: 'Clothing', es: 'Ropa', fr: 'Vêtements', de: 'Kleidung', pt: 'Roupas', ro: 'Îmbrăcăminte', uk: 'Одяг', ru: 'Одежда', ja: '服', ko: '옷', zh: '衣服', ar: 'ملابس' },
  Places:   { en: 'Places', es: 'Lugares', fr: 'Lieux', de: 'Orte', pt: 'Lugares', ro: 'Locuri', uk: 'Місця', ru: 'Места', ja: '場所', ko: '장소', zh: '地方', ar: 'أماكن' },
};

const CATEGORY_SORT_ITEMS_I18N: Record<string, Record<string, string>> = {
  apple:   { en: 'apple', es: 'manzana', fr: 'pomme', de: 'Apfel', pt: 'maçã', ro: 'măr', uk: 'яблуко', ru: 'яблоко', ja: 'りんご', ko: '사과', zh: '苹果', ar: 'تفاحة' },
  pizza:   { en: 'pizza', es: 'pizza', fr: 'pizza', de: 'Pizza', pt: 'pizza', ro: 'pizza', uk: 'піца', ru: 'пицца', ja: 'ピザ', ko: '피자', zh: '披萨', ar: 'بيتزا' },
  cake:    { en: 'cake', es: 'pastel', fr: 'gâteau', de: 'Kuchen', pt: 'bolo', ro: 'tort', uk: 'торт', ru: 'торт', ja: 'ケーキ', ko: '케이크', zh: '蛋糕', ar: 'كعكة' },
  banana:  { en: 'banana', es: 'plátano', fr: 'banane', de: 'Banane', pt: 'banana', ro: 'banană', uk: 'банан', ru: 'банан', ja: 'バナナ', ko: '바나나', zh: '香蕉', ar: 'موز' },
  dog:     { en: 'dog', es: 'perro', fr: 'chien', de: 'Hund', pt: 'cachorro', ro: 'câine', uk: 'собака', ru: 'собака', ja: '犬', ko: '개', zh: '狗', ar: 'كلب' },
  cat:     { en: 'cat', es: 'gato', fr: 'chat', de: 'Katze', pt: 'gato', ro: 'pisică', uk: 'кіт', ru: 'кот', ja: '猫', ko: '고양이', zh: '猫', ar: 'قطة' },
  fish:    { en: 'fish', es: 'pez', fr: 'poisson', de: 'Fisch', pt: 'peixe', ro: 'pește', uk: 'риба', ru: 'рыба', ja: '魚', ko: '물고기', zh: '鱼', ar: 'سمكة' },
  bird:    { en: 'bird', es: 'pájaro', fr: 'oiseau', de: 'Vogel', pt: 'pássaro', ro: 'pasăre', uk: 'птах', ru: 'птица', ja: '鳥', ko: '새', zh: '鸟', ar: 'طائر' },
  hat:     { en: 'hat', es: 'sombrero', fr: 'chapeau', de: 'Hut', pt: 'chapéu', ro: 'pălărie', uk: 'капелюх', ru: 'шляпа', ja: '帽子', ko: '모자', zh: '帽子', ar: 'قبعة' },
  shirt:   { en: 'shirt', es: 'camisa', fr: 'chemise', de: 'Hemd', pt: 'camisa', ro: 'cămașă', uk: 'сорочка', ru: 'рубашка', ja: 'シャツ', ko: '셔츠', zh: '衬衫', ar: 'قميص' },
  shoe:    { en: 'shoe', es: 'zapato', fr: 'chaussure', de: 'Schuh', pt: 'sapato', ro: 'pantof', uk: 'черевик', ru: 'ботинок', ja: '靴', ko: '신발', zh: '鞋子', ar: 'حذاء' },
  sock:    { en: 'sock', es: 'calcetín', fr: 'chaussette', de: 'Socke', pt: 'meia', ro: 'ciorap', uk: 'шкарпетка', ru: 'носок', ja: '靴下', ko: '양말', zh: '袜子', ar: 'جورب' },
  house:   { en: 'house', es: 'casa', fr: 'maison', de: 'Haus', pt: 'casa', ro: 'casă', uk: 'будинок', ru: 'дом', ja: '家', ko: '집', zh: '房子', ar: 'منزل' },
  school:  { en: 'school', es: 'escuela', fr: 'école', de: 'Schule', pt: 'escola', ro: 'școală', uk: 'школа', ru: 'школа', ja: '学校', ko: '학교', zh: '学校', ar: 'مدرسة' },
  park:    { en: 'park', es: 'parque', fr: 'parc', de: 'Park', pt: 'parque', ro: 'parc', uk: 'парк', ru: 'парк', ja: '公園', ko: '공원', zh: '公园', ar: 'حديقة' },
  store:   { en: 'store', es: 'tienda', fr: 'magasin', de: 'Laden', pt: 'loja', ro: 'magazin', uk: 'магазин', ru: 'магазин', ja: '店', ko: '가게', zh: '商店', ar: 'متجر' },
};

const CATEGORY_SORT_DATA: { key: string; emoji: string; category: string }[] = [
  { key: 'apple', emoji: '🍎', category: 'Food' },
  { key: 'pizza', emoji: '🍕', category: 'Food' },
  { key: 'cake', emoji: '🎂', category: 'Food' },
  { key: 'banana', emoji: '🍌', category: 'Food' },
  { key: 'dog', emoji: '🐕', category: 'Animals' },
  { key: 'cat', emoji: '🐱', category: 'Animals' },
  { key: 'fish', emoji: '🐟', category: 'Animals' },
  { key: 'bird', emoji: '🐦', category: 'Animals' },
  { key: 'hat', emoji: '🧢', category: 'Clothing' },
  { key: 'shirt', emoji: '👕', category: 'Clothing' },
  { key: 'shoe', emoji: '👟', category: 'Clothing' },
  { key: 'sock', emoji: '🧦', category: 'Clothing' },
  { key: 'house', emoji: '🏠', category: 'Places' },
  { key: 'school', emoji: '🏫', category: 'Places' },
  { key: 'park', emoji: '🌳', category: 'Places' },
  { key: 'store', emoji: '🏪', category: 'Places' },
];

const CATEGORY_ICONS: Record<string, string> = { Food: '🍎', Animals: '🐾', Clothing: '👕', Places: '🏠' };
const CATEGORY_COLORS: Record<string, string> = { Food: '#FF6B6B', Animals: '#4ECDC4', Clothing: '#DDA0DD', Places: '#45B7D1' };

function CategorySortGame({ onBack }: { onBack: () => void }) {
  const { t } = useT();
  const { speechRate, speechVolume, language } = useSettingsStore();
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [round, setRound] = useState(0);
  const [currentItem, setCurrentItem] = useState<typeof CATEGORY_SORT_DATA[0] | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [tappedCat, setTappedCat] = useState('');

  const langKey = language.split('-')[0];
  const localCat = (key: string) => CATEGORY_SORT_I18N[key]?.[langKey] || CATEGORY_SORT_I18N[key]?.en || key;
  const localItem = (key: string) => CATEGORY_SORT_ITEMS_I18N[key]?.[langKey] || CATEGORY_SORT_ITEMS_I18N[key]?.en || key;

  const newRound = useCallback(() => {
    const item = shuffle(CATEGORY_SORT_DATA)[0];
    setCurrentItem(item);
    setFeedback(null);
    setTappedCat('');
    setTimeout(() => aacSpeak(localItem(item.key), speechRate, speechVolume), 300);
  }, [round, speechRate, speechVolume, language]);

  useEffect(() => { queueMicrotask(newRound); }, [newRound]);

  const handleCategoryTap = (catKey: string) => {
    tapFeedback();
    setTappedCat(catKey);
    aacSpeak(localCat(catKey), speechRate, speechVolume);
    if (catKey === currentItem?.category) {
      setFeedback('correct');
      setScore(s => s + 1);
      if ((score + 1) % 5 === 0) setLevel(l => l + 1);
      setTimeout(() => { setRound(r => r + 1); }, 1500);
    } else {
      setFeedback('wrong');
      setTimeout(() => { setFeedback(null); setTappedCat(''); }, 800);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-theme shrink-0">
        <button className="aac-btn min-h-[44px] px-3 rounded-xl surface-key text-muted font-bold border border-theme" onClick={() => { tapFeedback(); onBack(); }}>
          ← {t('back_to_games')}
        </button>
        <span className="text-primary font-bold text-xl">🗂 Category Sort</span>
        <div className="text-right">
          <span className="text-primary font-bold">⭐ {score}</span>
          <span className="text-muted text-xs ml-2">Lv.{level}</span>
        </div>
      </div>

      <div className="shrink-0 py-6 flex flex-col items-center gap-2" style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' }}>
        <span className="text-7xl">{currentItem?.emoji}</span>
        <span className="text-2xl font-black text-white drop-shadow-lg">{currentItem ? localItem(currentItem.key) : ''}</span>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-4 p-4" style={{ background: 'linear-gradient(180deg, #38f9d7 0%, #e0f7fa 100%)' }}>
        {Object.keys(CATEGORY_SORT_I18N).map(catKey => (
          <button
            key={`${round}-${catKey}`}
            onClick={() => handleCategoryTap(catKey)}
            disabled={feedback === 'correct'}
            className={`rounded-3xl flex flex-col items-center justify-center gap-2 shadow-xl active:scale-90 transition-all duration-200 select-none ${
              tappedCat === catKey && feedback === 'correct' ? 'ring-4 ring-green-400 scale-110' :
              tappedCat === catKey && feedback === 'wrong' ? 'opacity-50 shake' : ''
            }`}
            style={{
              backgroundColor: CATEGORY_COLORS[catKey],
              minHeight: 'clamp(100px, 20vh, 160px)',
              boxShadow: `0 8px 25px ${CATEGORY_COLORS[catKey]}40`,
            }}
          >
            <span className="text-4xl">{CATEGORY_ICONS[catKey]}</span>
            <span className="text-white font-black text-xl">{localCat(catKey)}</span>
          </button>
        ))}
      </div>

      {feedback === 'correct' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="text-8xl animate-bounce">🌟</div>
        </div>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   GAME 8: Emotion Match — Tacting emotions
   Shows scenario text, child picks matching emotion emoji.
   Teaches tacting (labeling) emotions per VB-MAPP and ABLLS-R.
   ═════════════════════════════════════════════════════════════ */

const EMOTION_I18N: Record<string, Record<string, string>> = {
  Happy:     { en: 'Happy', es: 'Feliz', fr: 'Content', de: 'Glücklich', pt: 'Feliz', ro: 'Fericit', uk: 'Щасливий', ru: 'Счастливый', ja: '嬉しい', ko: '행복해', zh: '开心', ar: 'سعيد' },
  Sad:       { en: 'Sad', es: 'Triste', fr: 'Triste', de: 'Traurig', pt: 'Triste', ro: 'Trist', uk: 'Сумний', ru: 'Грустный', ja: '悲しい', ko: '슬퍼', zh: '难过', ar: 'حزين' },
  Scared:    { en: 'Scared', es: 'Asustado', fr: 'Effrayé', de: 'Ängstlich', pt: 'Assustado', ro: 'Speriat', uk: 'Переляканий', ru: 'Испуганный', ja: '怖い', ko: '무서워', zh: '害怕', ar: 'خائف' },
  Angry:     { en: 'Angry', es: 'Enojado', fr: 'En colère', de: 'Wütend', pt: 'Bravo', ro: 'Supărat', uk: 'Злий', ru: 'Злой', ja: '怒り', ko: '화나', zh: '生气', ar: 'غاضب' },
  Surprised: { en: 'Surprised', es: 'Sorprendido', fr: 'Surpris', de: 'Überrascht', pt: 'Surpreso', ro: 'Surprins', uk: 'Здивований', ru: 'Удивлённый', ja: '驚き', ko: '놀라', zh: '惊讶', ar: 'متفاجئ' },
};

const EMOTION_EMOJIS: { key: string; emoji: string }[] = [
  { key: 'Happy', emoji: '😊' },
  { key: 'Sad', emoji: '😢' },
  { key: 'Scared', emoji: '😨' },
  { key: 'Angry', emoji: '😡' },
  { key: 'Surprised', emoji: '😲' },
];

const SCENARIOS_I18N: { answer: string; text: Record<string, string> }[] = [
  { answer: 'Happy', text: { en: 'Birthday party!', es: '¡Fiesta de cumpleaños!', fr: 'Fête d\'anniversaire!', de: 'Geburtstagsfeier!', pt: 'Festa de aniversário!', ro: 'Petrecere de ziua de naștere!', uk: 'Свято дня народження!', ru: 'День рождения!', ja: '誕生日パーティー！', ko: '생일 파티!', zh: '生日派对！', ar: 'حفلة عيد ميلاد!' } },
  { answer: 'Happy', text: { en: 'Getting a new toy!', es: '¡Recibir un juguete nuevo!', fr: 'Recevoir un nouveau jouet!', de: 'Ein neues Spielzeug bekommen!', pt: 'Ganhar um brinquedo novo!', ro: 'Primești o jucărie nouă!', uk: 'Нова іграшка!', ru: 'Новая игрушка!', ja: '新しいおもちゃ！', ko: '새 장난감!', zh: '得到新玩具！', ar: 'الحصول على لعبة جديدة!' } },
  { answer: 'Sad', text: { en: 'Lost my toy', es: 'Perdí mi juguete', fr: 'J\'ai perdu mon jouet', de: 'Mein Spielzeug verloren', pt: 'Perdi meu brinquedo', ro: 'Mi-am pierdut jucăria', uk: 'Загубив іграшку', ru: 'Потерял игрушку', ja: 'おもちゃをなくした', ko: '장난감을 잃어버렸어', zh: '丢了玩具', ar: 'فقدت لعبتي' } },
  { answer: 'Sad', text: { en: 'Friend went away', es: 'Mi amigo se fue', fr: 'Mon ami est parti', de: 'Freund ist weggegangen', pt: 'Amigo foi embora', ro: 'Prietenul a plecat', uk: 'Друг пішов', ru: 'Друг ушёл', ja: '友達が行った', ko: '친구가 갔어', zh: '朋友走了', ar: 'صديقي ذهب' } },
  { answer: 'Scared', text: { en: 'Thunder and lightning!', es: '¡Truenos y relámpagos!', fr: 'Tonnerre et éclairs!', de: 'Donner und Blitz!', pt: 'Trovão e relâmpago!', ro: 'Tunete și fulgere!', uk: 'Грім і блискавка!', ru: 'Гром и молния!', ja: '雷！', ko: '천둥번개!', zh: '打雷闪电！', ar: 'رعد وبرق!' } },
  { answer: 'Scared', text: { en: 'Dark room', es: 'Habitación oscura', fr: 'Chambre sombre', de: 'Dunkles Zimmer', pt: 'Quarto escuro', ro: 'Cameră întunecată', uk: 'Темна кімната', ru: 'Тёмная комната', ja: '暗い部屋', ko: '어두운 방', zh: '黑暗的房间', ar: 'غرفة مظلمة' } },
  { answer: 'Angry', text: { en: 'Someone took my snack!', es: '¡Alguien tomó mi merienda!', fr: 'Quelqu\'un a pris mon goûter!', de: 'Jemand hat meinen Snack genommen!', pt: 'Alguém pegou meu lanche!', ro: 'Cineva mi-a luat gustarea!', uk: 'Хтось взяв мою їжу!', ru: 'Кто-то взял мою еду!', ja: 'おやつを取られた！', ko: '누가 내 간식을 가져갔어!', zh: '有人拿了我的零食！', ar: 'أحد أخذ وجبتي!' } },
  { answer: 'Angry', text: { en: 'Broken toy', es: 'Juguete roto', fr: 'Jouet cassé', de: 'Kaputtes Spielzeug', pt: 'Brinquedo quebrado', ro: 'Jucărie stricată', uk: 'Зламана іграшка', ru: 'Сломанная игрушка', ja: '壊れたおもちゃ', ko: '부서진 장난감', zh: '坏了的玩具', ar: 'لعبة مكسورة' } },
  { answer: 'Surprised', text: { en: 'Surprise visitor!', es: '¡Visita sorpresa!', fr: 'Visiteur surprise!', de: 'Überraschungsbesuch!', pt: 'Visita surpresa!', ro: 'Vizitator surpriză!', uk: 'Несподіваний гість!', ru: 'Неожиданный гость!', ja: 'サプライズ！', ko: '깜짝 방문!', zh: '意外来客！', ar: 'زائر مفاجئ!' } },
  { answer: 'Surprised', text: { en: 'Magic trick!', es: '¡Truco de magia!', fr: 'Tour de magie!', de: 'Zaubertrick!', pt: 'Truque de mágica!', ro: 'Truc de magie!', uk: 'Чарівний трюк!', ru: 'Фокус!', ja: '手品！', ko: '마술!', zh: '魔术！', ar: 'خدعة سحرية!' } },
];

function EmotionMatchGame({ onBack }: { onBack: () => void }) {
  const { t } = useT();
  const { speechRate, speechVolume, language } = useSettingsStore();
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [round, setRound] = useState(0);
  const [scenario, setScenario] = useState<typeof SCENARIOS_I18N[0] | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [tappedKey, setTappedKey] = useState('');

  const langKey = language.split('-')[0];
  const localEmotion = (key: string) => EMOTION_I18N[key]?.[langKey] || EMOTION_I18N[key]?.en || key;

  const newRound = useCallback(() => {
    const s = shuffle(SCENARIOS_I18N)[0];
    setScenario(s);
    setFeedback(null);
    setTappedKey('');
    const text = s.text[langKey] || s.text.en;
    setTimeout(() => aacSpeak(text, speechRate, speechVolume), 300);
  }, [round, speechRate, speechVolume, language, langKey]);

  useEffect(() => { queueMicrotask(newRound); }, [newRound]);

  const handleTap = (emotionKey: string) => {
    tapFeedback();
    setTappedKey(emotionKey);
    aacSpeak(localEmotion(emotionKey), speechRate, speechVolume);
    if (emotionKey === scenario?.answer) {
      setFeedback('correct');
      setScore(s => s + 1);
      if ((score + 1) % 5 === 0) setLevel(l => l + 1);
      setTimeout(() => { setRound(r => r + 1); }, 1500);
    } else {
      setFeedback('wrong');
      setTimeout(() => { setFeedback(null); setTappedKey(''); }, 800);
    }
  };

  const scenarioText = scenario ? (scenario.text[langKey] || scenario.text.en) : '';

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-theme shrink-0">
        <button className="aac-btn min-h-[44px] px-3 rounded-xl surface-key text-muted font-bold border border-theme" onClick={() => { tapFeedback(); onBack(); }}>
          ← {t('back_to_games')}
        </button>
        <span className="text-primary font-bold text-xl">🎭 Emotions</span>
        <div className="text-right">
          <span className="text-primary font-bold">⭐ {score}</span>
          <span className="text-muted text-xs ml-2">Lv.{level}</span>
        </div>
      </div>

      <div className="shrink-0 py-6 px-4 text-center" style={{ background: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)' }}>
        <span className="text-2xl md:text-3xl font-black text-white drop-shadow-lg">{scenarioText}</span>
        <button
          onClick={() => { tapFeedback(); aacSpeak(scenarioText, speechRate, speechVolume); }}
          className="ml-3 text-2xl"
        >🔊</button>
      </div>

      <div className="flex-1 flex flex-col gap-3 p-4 overflow-y-auto" style={{ background: 'linear-gradient(180deg, #fda085 0%, #f6d365 50%, #ffecd2 100%)' }}>
        {EMOTION_EMOJIS.map(em => (
          <button
            key={`${round}-${em.key}`}
            onClick={() => handleTap(em.key)}
            disabled={feedback === 'correct'}
            className={`rounded-3xl flex items-center gap-4 px-6 shadow-xl active:scale-95 transition-all duration-200 select-none ${
              tappedKey === em.key && feedback === 'correct' ? 'ring-4 ring-green-400 scale-105' :
              tappedKey === em.key && feedback === 'wrong' ? 'opacity-50 shake' : ''
            }`}
            style={{
              backgroundColor: 'rgba(255,255,255,0.9)',
              minHeight: 'clamp(60px, 12vh, 90px)',
              boxShadow: '0 6px 20px rgba(0,0,0,0.1)',
            }}
          >
            <span className="text-4xl">{em.emoji}</span>
            <span className="text-gray-800 font-black text-xl">{localEmotion(em.key)}</span>
          </button>
        ))}
      </div>

      {feedback === 'correct' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="text-8xl animate-bounce">🌟</div>
        </div>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   GAME 9: Sequence — What Comes Next
   Shows 2 pictures in order, child picks the 3rd from choices.
   Teaches sequencing and temporal ordering skills.
   ═════════════════════════════════════════════════════════════ */

const SEQUENCE_STEP_I18N: Record<string, Record<string, string>> = {
  'wake up':       { en: 'wake up', es: 'despertar', fr: 'se réveiller', de: 'aufwachen', pt: 'acordar', ro: 'trezire', uk: 'прокинутися', ru: 'проснуться', ja: '起きる', ko: '일어나다', zh: '起床', ar: 'استيقظ' },
  'brush teeth':   { en: 'brush teeth', es: 'cepillarse', fr: 'brosser les dents', de: 'Zähne putzen', pt: 'escovar', ro: 'spăla pe dinți', uk: 'чистити зуби', ru: 'чистить зубы', ja: '歯磨き', ko: '양치하다', zh: '刷牙', ar: 'تنظيف الأسنان' },
  'eat breakfast':  { en: 'eat breakfast', es: 'desayunar', fr: 'petit-déjeuner', de: 'frühstücken', pt: 'café da manhã', ro: 'mic dejun', uk: 'снідати', ru: 'завтракать', ja: '朝ごはん', ko: '아침 먹다', zh: '吃早餐', ar: 'تناول الفطور' },
  'get dressed':   { en: 'get dressed', es: 'vestirse', fr: 's\'habiller', de: 'anziehen', pt: 'se vestir', ro: 'îmbrăcare', uk: 'одягнутися', ru: 'одеться', ja: '着替え', ko: '옷입다', zh: '穿衣服', ar: 'ارتداء الملابس' },
  'go to school':  { en: 'go to school', es: 'ir a la escuela', fr: 'aller à l\'école', de: 'zur Schule gehen', pt: 'ir à escola', ro: 'merge la școală', uk: 'іти до школи', ru: 'идти в школу', ja: '学校に行く', ko: '학교 가다', zh: '去上学', ar: 'الذهاب للمدرسة' },
  'play outside':  { en: 'play outside', es: 'jugar afuera', fr: 'jouer dehors', de: 'draußen spielen', pt: 'brincar fora', ro: 'joacă afară', uk: 'грати надворі', ru: 'играть на улице', ja: '外で遊ぶ', ko: '밖에서 놀다', zh: '在外面玩', ar: 'اللعب بالخارج' },
  'eat dinner':    { en: 'eat dinner', es: 'cenar', fr: 'dîner', de: 'Abendessen', pt: 'jantar', ro: 'cina', uk: 'вечеряти', ru: 'ужинать', ja: '夕ごはん', ko: '저녁 먹다', zh: '吃晚饭', ar: 'تناول العشاء' },
  'take a bath':   { en: 'take a bath', es: 'bañarse', fr: 'prendre un bain', de: 'baden', pt: 'tomar banho', ro: 'baie', uk: 'купатися', ru: 'купаться', ja: 'お風呂', ko: '목욕하다', zh: '洗澡', ar: 'الاستحمام' },
  'read a book':   { en: 'read a book', es: 'leer un libro', fr: 'lire un livre', de: 'Buch lesen', pt: 'ler um livro', ro: 'citește o carte', uk: 'читати книгу', ru: 'читать книгу', ja: '本を読む', ko: '책 읽다', zh: '读书', ar: 'قراءة كتاب' },
  'go to sleep':   { en: 'go to sleep', es: 'dormir', fr: 'dormir', de: 'schlafen', pt: 'dormir', ro: 'adormire', uk: 'спати', ru: 'спать', ja: '寝る', ko: '잠자다', zh: '睡觉', ar: 'النوم' },
  'wash hands':    { en: 'wash hands', es: 'lavarse las manos', fr: 'se laver les mains', de: 'Hände waschen', pt: 'lavar as mãos', ro: 'spălat pe mâini', uk: 'мити руки', ru: 'мыть руки', ja: '手を洗う', ko: '손 씻다', zh: '洗手', ar: 'غسل اليدين' },
  'eat lunch':     { en: 'eat lunch', es: 'almorzar', fr: 'déjeuner', de: 'Mittagessen', pt: 'almoçar', ro: 'prânz', uk: 'обідати', ru: 'обедать', ja: '昼ごはん', ko: '점심 먹다', zh: '吃午饭', ar: 'تناول الغداء' },
};

const SEQUENCE_STEP_EMOJIS: Record<string, string> = {
  'wake up': '😴', 'brush teeth': '🪥', 'eat breakfast': '🥣', 'get dressed': '👕',
  'go to school': '🏫', 'play outside': '🌳', 'eat dinner': '🍽️', 'take a bath': '🛁',
  'read a book': '📖', 'go to sleep': '😴', 'wash hands': '🧼', 'eat lunch': '🥪',
};

const SEQUENCES: { steps: string[] }[] = [
  { steps: ['wake up', 'brush teeth', 'eat breakfast'] },
  { steps: ['get dressed', 'go to school', 'eat lunch'] },
  { steps: ['play outside', 'eat dinner', 'take a bath'] },
  { steps: ['take a bath', 'read a book', 'go to sleep'] },
  { steps: ['wake up', 'get dressed', 'go to school'] },
  { steps: ['wash hands', 'eat lunch', 'play outside'] },
];

const SEQUENCE_WHAT_NEXT_I18N: Record<string, string> = {
  en: 'What comes next?', es: '¿Qué sigue?', fr: 'Qu\'est-ce qui vient ensuite?', de: 'Was kommt als nächstes?',
  pt: 'O que vem depois?', ro: 'Ce urmează?', uk: 'Що далі?', ru: 'Что дальше?',
  ja: '次は何？', ko: '다음은?', zh: '接下来是什么？', ar: 'ما التالي؟',
};

function SequenceGame({ onBack }: { onBack: () => void }) {
  const { t } = useT();
  const { speechRate, speechVolume, language } = useSettingsStore();
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [round, setRound] = useState(0);
  const [sequence, setSequence] = useState<typeof SEQUENCES[0] | null>(null);
  const [choices, setChoices] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [tappedStep, setTappedStep] = useState('');

  const langKey = language.split('-')[0];
  const localStep = (key: string) => SEQUENCE_STEP_I18N[key]?.[langKey] || SEQUENCE_STEP_I18N[key]?.en || key;
  const whatNext = SEQUENCE_WHAT_NEXT_I18N[langKey] || SEQUENCE_WHAT_NEXT_I18N.en;

  const newRound = useCallback(() => {
    const seq = shuffle(SEQUENCES)[0];
    setSequence(seq);
    const correctAnswer = seq.steps[2];
    const allSteps = Object.keys(SEQUENCE_STEP_I18N);
    const distractors = shuffle(allSteps.filter(s => s !== correctAnswer && s !== seq.steps[0] && s !== seq.steps[1])).slice(0, 3);
    const ch = shuffle([correctAnswer, ...distractors]);
    setChoices(ch);
    setFeedback(null);
    setTappedStep('');
    const step1 = localStep(seq.steps[0]);
    const step2 = localStep(seq.steps[1]);
    setTimeout(() => aacSpeak(`${step1}, ${step2}, ${whatNext}`, speechRate, speechVolume), 300);
  }, [round, speechRate, speechVolume, language, whatNext]);

  useEffect(() => { queueMicrotask(newRound); }, [newRound]);

  const handleTap = (stepKey: string) => {
    tapFeedback();
    setTappedStep(stepKey);
    aacSpeak(localStep(stepKey), speechRate, speechVolume);
    if (stepKey === sequence?.steps[2]) {
      setFeedback('correct');
      setScore(s => s + 1);
      if ((score + 1) % 5 === 0) setLevel(l => l + 1);
      setTimeout(() => { setRound(r => r + 1); }, 1500);
    } else {
      setFeedback('wrong');
      setTimeout(() => { setFeedback(null); setTappedStep(''); }, 800);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-theme shrink-0">
        <button className="aac-btn min-h-[44px] px-3 rounded-xl surface-key text-muted font-bold border border-theme" onClick={() => { tapFeedback(); onBack(); }}>
          ← {t('back_to_games')}
        </button>
        <span className="text-primary font-bold text-xl">📋 Sequence</span>
        <div className="text-right">
          <span className="text-primary font-bold">⭐ {score}</span>
          <span className="text-muted text-xs ml-2">Lv.{level}</span>
        </div>
      </div>

      <div className="shrink-0 py-4 px-4" style={{ background: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)' }}>
        <div className="flex items-center justify-center gap-4">
          {sequence && (
            <>
              <div className="flex flex-col items-center bg-white/80 rounded-2xl p-3 shadow-lg">
                <span className="text-4xl">{SEQUENCE_STEP_EMOJIS[sequence.steps[0]]}</span>
                <span className="text-sm font-bold text-gray-700 mt-1">{localStep(sequence.steps[0])}</span>
              </div>
              <span className="text-3xl font-black text-white">→</span>
              <div className="flex flex-col items-center bg-white/80 rounded-2xl p-3 shadow-lg">
                <span className="text-4xl">{SEQUENCE_STEP_EMOJIS[sequence.steps[1]]}</span>
                <span className="text-sm font-bold text-gray-700 mt-1">{localStep(sequence.steps[1])}</span>
              </div>
              <span className="text-3xl font-black text-white">→</span>
              <div className="flex flex-col items-center bg-white/40 rounded-2xl p-3 shadow-lg border-2 border-dashed border-white">
                <span className="text-4xl">❓</span>
                <span className="text-sm font-bold text-white mt-1">{whatNext}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-4 p-4" style={{ background: 'linear-gradient(180deg, #c2e9fb 0%, #e0f7fa 100%)' }}>
        {choices.map(stepKey => (
          <button
            key={`${round}-${stepKey}`}
            onClick={() => handleTap(stepKey)}
            disabled={feedback === 'correct'}
            className={`rounded-3xl flex flex-col items-center justify-center gap-2 shadow-xl active:scale-90 transition-all duration-200 select-none ${
              tappedStep === stepKey && feedback === 'correct' ? 'ring-4 ring-green-400 scale-110' :
              tappedStep === stepKey && feedback === 'wrong' ? 'opacity-50 shake' : ''
            }`}
            style={{
              backgroundColor: 'rgba(255,255,255,0.9)',
              minHeight: 'clamp(80px, 18vh, 140px)',
              boxShadow: '0 8px 25px rgba(0,0,0,0.1)',
            }}
          >
            <span className="text-4xl">{SEQUENCE_STEP_EMOJIS[stepKey]}</span>
            <span className="text-gray-700 font-bold text-base text-center">{localStep(stepKey)}</span>
          </button>
        ))}
      </div>

      {feedback === 'correct' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="text-8xl animate-bounce">🌟</div>
        </div>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   GAME 10: Same/Different — Visual discrimination
   Shows 3 emoji items: 2 are same, 1 is different.
   Child taps the odd one out. Difficulty increases.
   ═════════════════════════════════════════════════════════════ */

const SAME_DIFF_I18N: Record<string, Record<string, string>> = {
  'Find the different one': { en: 'Find the different one!', es: '¡Encuentra el diferente!', fr: 'Trouve le différent!', de: 'Finde den anderen!', pt: 'Encontre o diferente!', ro: 'Găsește pe cel diferit!', uk: 'Знайди інший!', ru: 'Найди другой!', ja: '違うものを見つけて！', ko: '다른 것을 찾아!', zh: '找到不同的！', ar: 'جد المختلف!' },
};

const SAME_DIFF_POOLS = [
  ['🐕', '🐱', '🐟', '🐦', '🐸', '🐰', '🐻', '🦊'],
  ['🍎', '🍌', '🍕', '🎂', '🥕', '🍇', '🍓', '🍊'],
  ['⚽', '🏀', '🎾', '🎯', '🏈', '🎱', '🏐', '🎳'],
  ['🚗', '🚌', '✈️', '🚂', '🚲', '🛵', '🚁', '⛵'],
  ['🌻', '🌸', '🌹', '🌺', '🌷', '🌼', '💐', '🌵'],
];

function SameDifferentGame({ onBack }: { onBack: () => void }) {
  const { t } = useT();
  const { speechRate, speechVolume, language } = useSettingsStore();
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [round, setRound] = useState(0);
  const [items, setItems] = useState<{ emoji: string; isDifferent: boolean }[]>([]);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [tappedIdx, setTappedIdx] = useState(-1);

  const langKey = language.split('-')[0];
  const prompt = SAME_DIFF_I18N['Find the different one']?.[langKey] || SAME_DIFF_I18N['Find the different one']?.en || 'Find the different one!';

  const newRound = useCallback(() => {
    const pool = shuffle(SAME_DIFF_POOLS)[0];
    const [same, different] = shuffle(pool).slice(0, 2);
    const count = Math.min(3 + Math.floor(level / 3), 7);
    const diffIdx = Math.floor(Math.random() * count);
    const result: { emoji: string; isDifferent: boolean }[] = [];
    for (let i = 0; i < count; i++) {
      result.push({ emoji: i === diffIdx ? different : same, isDifferent: i === diffIdx });
    }
    setItems(result);
    setFeedback(null);
    setTappedIdx(-1);
    setTimeout(() => aacSpeak(prompt, speechRate, speechVolume), 300);
  }, [round, level, speechRate, speechVolume, language, prompt]);

  useEffect(() => { queueMicrotask(newRound); }, [newRound]);

  const handleTap = (idx: number) => {
    tapFeedback();
    setTappedIdx(idx);
    aacSpeak(items[idx].emoji, speechRate, speechVolume);
    if (items[idx].isDifferent) {
      setFeedback('correct');
      setScore(s => s + 1);
      if ((score + 1) % 4 === 0) setLevel(l => l + 1);
      setTimeout(() => { setRound(r => r + 1); }, 1500);
    } else {
      setFeedback('wrong');
      setTimeout(() => { setFeedback(null); setTappedIdx(-1); }, 800);
    }
  };

  const cols = items.length <= 3 ? 'grid-cols-3' : items.length <= 5 ? 'grid-cols-3' : 'grid-cols-4';

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-theme shrink-0">
        <button className="aac-btn min-h-[44px] px-3 rounded-xl surface-key text-muted font-bold border border-theme" onClick={() => { tapFeedback(); onBack(); }}>
          ← {t('back_to_games')}
        </button>
        <span className="text-primary font-bold text-xl">👀 Same/Different</span>
        <div className="text-right">
          <span className="text-primary font-bold">⭐ {score}</span>
          <span className="text-muted text-xs ml-2">Lv.{level}</span>
        </div>
      </div>

      <div className="shrink-0 py-4 text-center" style={{ background: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)' }}>
        <span className="text-2xl md:text-3xl font-black text-white drop-shadow-lg">{prompt}</span>
      </div>

      <div className={`flex-1 grid ${cols} gap-4 p-6 place-content-center`} style={{ background: 'linear-gradient(180deg, #fecfef 0%, #fdfcfb 100%)' }}>
        {items.map((item, idx) => (
          <button
            key={`${round}-${idx}`}
            onClick={() => handleTap(idx)}
            disabled={feedback === 'correct'}
            className={`rounded-3xl flex items-center justify-center shadow-xl active:scale-90 transition-all duration-200 select-none ${
              tappedIdx === idx && feedback === 'correct' ? 'ring-4 ring-green-400 scale-110' :
              tappedIdx === idx && feedback === 'wrong' ? 'opacity-50 shake' : ''
            }`}
            style={{
              backgroundColor: 'rgba(255,255,255,0.95)',
              minHeight: 'clamp(80px, 18vh, 140px)',
              boxShadow: '0 8px 25px rgba(0,0,0,0.1)',
            }}
          >
            <span className="text-5xl md:text-6xl">{item.emoji}</span>
          </button>
        ))}
      </div>

      {feedback === 'correct' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="text-8xl animate-bounce">🌟</div>
        </div>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   GAME 11: Sound Match (I Hear It) — Auditory description matching
   Shows 4 animal/object pictures, TTS plays description,
   child taps correct picture. Teaches auditory comprehension.
   ═════════════════════════════════════════════════════════════ */

const SOUND_CLUE_I18N: Record<string, Record<string, string>> = {
  dog:    { en: 'This animal says woof', es: 'Este animal dice guau', fr: 'Cet animal dit ouaf', de: 'Dieses Tier sagt wau', pt: 'Este animal faz au au', ro: 'Acest animal face ham', uk: 'Ця тварина каже гав', ru: 'Это животное говорит гав', ja: 'この動物はワンと鳴く', ko: '이 동물은 멍멍', zh: '这个动物说汪', ar: 'هذا الحيوان يقول هاو' },
  cat:    { en: 'This animal says meow', es: 'Este animal dice miau', fr: 'Cet animal dit miaou', de: 'Dieses Tier sagt miau', pt: 'Este animal faz miau', ro: 'Acest animal face miau', uk: 'Ця тварина каже нявь', ru: 'Это животное говорит мяу', ja: 'この動物はニャーと鳴く', ko: '이 동물은 야옹', zh: '这个动物说喵', ar: 'هذا الحيوان يقول مياو' },
  bird:   { en: 'This animal can fly', es: 'Este animal puede volar', fr: 'Cet animal peut voler', de: 'Dieses Tier kann fliegen', pt: 'Este animal pode voar', ro: 'Acest animal poate zbura', uk: 'Ця тварина може літати', ru: 'Это животное может летать', ja: 'この動物は飛べる', ko: '이 동물은 날 수 있어', zh: '这个动物会飞', ar: 'هذا الحيوان يطير' },
  fish:   { en: 'This animal lives in water', es: 'Este animal vive en el agua', fr: 'Cet animal vit dans l\'eau', de: 'Dieses Tier lebt im Wasser', pt: 'Este animal vive na água', ro: 'Acest animal trăiește în apă', uk: 'Ця тварина живе у воді', ru: 'Это животное живёт в воде', ja: 'この動物は水に住む', ko: '이 동물은 물에 살아', zh: '这个动物住在水里', ar: 'هذا الحيوان يعيش في الماء' },
  car:    { en: 'This goes beep beep on the road', es: 'Esto hace bip bip en la carretera', fr: 'Cela fait bip bip sur la route', de: 'Das macht piep piep auf der Straße', pt: 'Isso faz bip bip na estrada', ro: 'Acesta face bip bip pe drum', uk: 'Це їде біп біп по дорозі', ru: 'Это бибикает на дороге', ja: 'これは道でビービー鳴る', ko: '이것은 도로에서 빵빵', zh: '这个在路上滴滴响', ar: 'هذا يصدر صوت بيب على الطريق' },
  sun:    { en: 'This is bright and warm in the sky', es: 'Esto es brillante y cálido en el cielo', fr: 'C\'est brillant et chaud dans le ciel', de: 'Das ist hell und warm am Himmel', pt: 'Isso é brilhante e quente no céu', ro: 'Acesta este strălucitor și cald pe cer', uk: 'Це яскраве і тепле на небі', ru: 'Это яркое и тёплое на небе', ja: 'これは空で明るくて暖かい', ko: '이것은 하늘에서 밝고 따뜻해', zh: '这个在天上又亮又暖', ar: 'هذا ساطع ودافئ في السماء' },
  moon:   { en: 'This comes out at night', es: 'Esto sale de noche', fr: 'Cela sort la nuit', de: 'Das kommt nachts heraus', pt: 'Isso aparece de noite', ro: 'Acesta apare noaptea', uk: 'Це з\'являється вночі', ru: 'Это появляется ночью', ja: 'これは夜に出る', ko: '이것은 밤에 나와', zh: '这个晚上出来', ar: 'هذا يظهر في الليل' },
  apple:  { en: 'This is a red fruit you can eat', es: 'Esta es una fruta roja para comer', fr: 'C\'est un fruit rouge à manger', de: 'Das ist eine rote Frucht zum Essen', pt: 'Esta é uma fruta vermelha para comer', ro: 'Acesta este un fruct roșu de mâncat', uk: 'Це червоний фрукт', ru: 'Это красный фрукт', ja: 'これは赤い食べられる果物', ko: '이것은 먹을 수 있는 빨간 과일', zh: '这是一个可以吃的红色水果', ar: 'هذه فاكهة حمراء تؤكل' },
  flower: { en: 'This grows in a garden and smells nice', es: 'Esto crece en un jardín y huele bien', fr: 'Ça pousse dans un jardin et sent bon', de: 'Das wächst im Garten und riecht gut', pt: 'Isso cresce no jardim e cheira bem', ro: 'Aceasta crește în grădină și miroase frumos', uk: 'Це росте в саду і гарно пахне', ru: 'Это растёт в саду и хорошо пахнет', ja: 'これは庭に育ちいい匂い', ko: '이것은 정원에서 자라고 좋은 냄새가 나', zh: '这个长在花园里很香', ar: 'هذا ينمو في الحديقة ورائحته جميلة' },
  star:   { en: 'This twinkles in the night sky', es: 'Esto brilla en el cielo de noche', fr: 'Ça brille dans le ciel la nuit', de: 'Das funkelt am Nachthimmel', pt: 'Isso brilha no céu à noite', ro: 'Aceasta strălucește pe cerul nopții', uk: 'Це мерехтить на нічному небі', ru: 'Это мерцает на ночном небе', ja: 'これは夜空できらきら光る', ko: '이것은 밤하늘에서 반짝여', zh: '这个在夜空中闪烁', ar: 'هذا يتلألأ في سماء الليل' },
  tree:   { en: 'This is tall and green with leaves', es: 'Esto es alto y verde con hojas', fr: 'C\'est grand et vert avec des feuilles', de: 'Das ist groß und grün mit Blättern', pt: 'Isso é alto e verde com folhas', ro: 'Acesta este înalt și verde cu frunze', uk: 'Це високе і зелене з листям', ru: 'Это высокое и зелёное с листьями', ja: 'これは背が高く緑で葉がある', ko: '이것은 크고 초록이고 잎이 있어', zh: '这个又高又绿有叶子', ar: 'هذا طويل وأخضر بأوراق' },
  house:  { en: 'People live inside this', es: 'La gente vive dentro de esto', fr: 'Les gens vivent dedans', de: 'Menschen wohnen darin', pt: 'Pessoas moram dentro disso', ro: 'Oamenii locuiesc aici', uk: 'Люди живуть тут', ru: 'Люди живут в этом', ja: '人が中に住んでいる', ko: '사람들이 이 안에 살아', zh: '人们住在里面', ar: 'الناس يعيشون في هذا' },
};

const SOUND_ITEMS = [
  { key: 'dog', emoji: '🐕' }, { key: 'cat', emoji: '🐱' }, { key: 'bird', emoji: '🐦' },
  { key: 'fish', emoji: '🐟' }, { key: 'car', emoji: '🚗' }, { key: 'sun', emoji: '☀️' },
  { key: 'moon', emoji: '🌙' }, { key: 'apple', emoji: '🍎' }, { key: 'flower', emoji: '🌸' },
  { key: 'star', emoji: '⭐' }, { key: 'tree', emoji: '🌳' }, { key: 'house', emoji: '🏠' },
];

function SoundMatchGame({ onBack }: { onBack: () => void }) {
  const { t } = useT();
  const { speechRate, speechVolume, language } = useSettingsStore();
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [round, setRound] = useState(0);
  const [target, setTarget] = useState<typeof SOUND_ITEMS[0] | null>(null);
  const [choices, setChoices] = useState<typeof SOUND_ITEMS>([]);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [tappedKey, setTappedKey] = useState('');

  const langKey = language.split('-')[0];

  const newRound = useCallback(() => {
    const all = shuffle(SOUND_ITEMS);
    const tgt = all[0];
    const distractors = all.slice(1, 4);
    const ch = shuffle([tgt, ...distractors]);
    setTarget(tgt);
    setChoices(ch);
    setFeedback(null);
    setTappedKey('');
    const clue = SOUND_CLUE_I18N[tgt.key]?.[langKey] || SOUND_CLUE_I18N[tgt.key]?.en || '';
    setTimeout(() => aacSpeak(clue, speechRate, speechVolume), 300);
  }, [round, speechRate, speechVolume, language, langKey]);

  useEffect(() => { queueMicrotask(newRound); }, [newRound]);

  const handleTap = (item: typeof SOUND_ITEMS[0]) => {
    tapFeedback();
    setTappedKey(item.key);
    const name = localMatchItem(item.key, language);
    aacSpeak(name, speechRate, speechVolume);
    if (item.key === target?.key) {
      setFeedback('correct');
      setScore(s => s + 1);
      if ((score + 1) % 5 === 0) setLevel(l => l + 1);
      setTimeout(() => { setRound(r => r + 1); }, 1500);
    } else {
      setFeedback('wrong');
      setTimeout(() => { setFeedback(null); setTappedKey(''); }, 800);
    }
  };

  const clueText = target ? (SOUND_CLUE_I18N[target.key]?.[langKey] || SOUND_CLUE_I18N[target.key]?.en || '') : '';

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-theme shrink-0">
        <button className="aac-btn min-h-[44px] px-3 rounded-xl surface-key text-muted font-bold border border-theme" onClick={() => { tapFeedback(); onBack(); }}>
          ← {t('back_to_games')}
        </button>
        <span className="text-primary font-bold text-xl">🔊 I Hear It</span>
        <div className="text-right">
          <span className="text-primary font-bold">⭐ {score}</span>
          <span className="text-muted text-xs ml-2">Lv.{level}</span>
        </div>
      </div>

      <div className="shrink-0 py-4 px-4 text-center" style={{ background: 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)' }}>
        <span className="text-xl md:text-2xl font-black text-white drop-shadow-lg">{clueText}</span>
        <button
          onClick={() => { tapFeedback(); aacSpeak(clueText, speechRate, speechVolume); }}
          className="ml-3 text-2xl"
        >🔊</button>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-4 p-4" style={{ background: 'linear-gradient(180deg, #66a6ff 0%, #cce5ff 100%)' }}>
        {choices.map(item => (
          <button
            key={`${round}-${item.key}`}
            onClick={() => handleTap(item)}
            disabled={feedback === 'correct'}
            className={`rounded-3xl flex flex-col items-center justify-center gap-2 shadow-xl active:scale-90 transition-all duration-200 select-none ${
              tappedKey === item.key && feedback === 'correct' ? 'ring-4 ring-green-400 scale-110' :
              tappedKey === item.key && feedback === 'wrong' ? 'opacity-50 shake' : ''
            }`}
            style={{
              backgroundColor: 'rgba(255,255,255,0.9)',
              minHeight: 'clamp(100px, 20vh, 180px)',
              boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
            }}
          >
            <span className="text-5xl md:text-6xl">{item.emoji}</span>
            <span className="text-gray-700 font-bold text-lg">{localMatchItem(item.key, language)}</span>
          </button>
        ))}
      </div>

      {feedback === 'correct' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="text-8xl animate-bounce">🌟</div>
        </div>
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   GAME 12: Turn Taker — Social communication / turn-taking
   Simple dice roll game. Shows "My turn" / "Your turn" with
   big dice animation. Teaches waiting and turn-taking vocabulary.
   ═════════════════════════════════════════════════════════════ */

const TURN_MY_I18N: Record<string, string> = {
  en: 'My turn!', es: '¡Mi turno!', fr: 'Mon tour!', de: 'Mein Zug!', pt: 'Minha vez!',
  ro: 'Rândul meu!', uk: 'Мій хід!', ru: 'Мой ход!', ja: '私の番！', ko: '내 차례!', zh: '我的回合！', ar: 'دوري!',
};

const TURN_YOUR_I18N: Record<string, string> = {
  en: 'Your turn!', es: '¡Tu turno!', fr: 'Ton tour!', de: 'Dein Zug!', pt: 'Sua vez!',
  ro: 'Rândul tău!', uk: 'Твій хід!', ru: 'Твой ход!', ja: 'あなたの番！', ko: '네 차례!', zh: '你的回合！', ar: 'دورك!',
};

const TURN_ROLL_I18N: Record<string, string> = {
  en: 'Roll!', es: '¡Tira!', fr: 'Lance!', de: 'Würfle!', pt: 'Jogue!',
  ro: 'Aruncă!', uk: 'Кидай!', ru: 'Кидай!', ja: '振って！', ko: '굴려!', zh: '掷！', ar: 'ارمِ!',
};

const TURN_WAIT_I18N: Record<string, string> = {
  en: 'Wait...', es: 'Espera...', fr: 'Attends...', de: 'Warte...', pt: 'Espere...',
  ro: 'Așteaptă...', uk: 'Зачекай...', ru: 'Подожди...', ja: '待って...', ko: '기다려...', zh: '等一下...', ar: 'انتظر...',
};

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

function TurnTakerGame({ onBack }: { onBack: () => void }) {
  const { t } = useT();
  const { speechRate, speechVolume, language } = useSettingsStore();
  const [myScore, setMyScore] = useState(0);
  const [yourScore, setYourScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [isMyTurn, setIsMyTurn] = useState(true);
  const [diceValue, setDiceValue] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [celebration, setCelebration] = useState(false);
  const rollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const langKey = language.split('-')[0];
  const myTurnText = TURN_MY_I18N[langKey] || TURN_MY_I18N.en;
  const yourTurnText = TURN_YOUR_I18N[langKey] || TURN_YOUR_I18N.en;
  const rollText = TURN_ROLL_I18N[langKey] || TURN_ROLL_I18N.en;
  const waitText = TURN_WAIT_I18N[langKey] || TURN_WAIT_I18N.en;

  useEffect(() => {
    const turnText = isMyTurn ? myTurnText : yourTurnText;
    aacSpeak(turnText, speechRate, speechVolume);
  }, [isMyTurn, myTurnText, yourTurnText, speechRate, speechVolume]);

  const doRoll = () => {
    tapFeedback();
    if (rolling) return;
    setRolling(true);
    aacSpeak(rollText, speechRate, speechVolume);

    let ticks = 0;
    rollIntervalRef.current = setInterval(() => {
      setDiceValue(Math.floor(Math.random() * 6));
      ticks++;
      if (ticks >= 10) {
        if (rollIntervalRef.current) { clearInterval(rollIntervalRef.current); rollIntervalRef.current = null; }
        const finalValue = Math.floor(Math.random() * 6);
        setDiceValue(finalValue);
        const points = finalValue + 1;
        if (isMyTurn) {
          setMyScore(s => s + points);
        } else {
          setYourScore(s => s + points);
        }
        setRolling(false);

        const total = (isMyTurn ? myScore + points : myScore) + (isMyTurn ? yourScore : yourScore + points);
        if (total > 0 && total % 20 === 0) {
          setLevel(l => l + 1);
          setCelebration(true);
          setTimeout(() => setCelebration(false), 2000);
        }

        setTimeout(() => {
          setIsMyTurn(prev => !prev);
        }, 1500);
      }
    }, 100);
  };

  // Cleanup roll interval on unmount
  useEffect(() => {
    return () => {
      if (rollIntervalRef.current) { clearInterval(rollIntervalRef.current); rollIntervalRef.current = null; }
    };
  }, []);

  // Auto-roll for "My turn" (the app/parent's turn)
  useEffect(() => {
    if (isMyTurn && !rolling) {
      const timer = setTimeout(() => { doRoll(); }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isMyTurn, rolling]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-theme shrink-0">
        <button className="aac-btn min-h-[44px] px-3 rounded-xl surface-key text-muted font-bold border border-theme" onClick={() => { tapFeedback(); onBack(); }}>
          ← {t('back_to_games')}
        </button>
        <span className="text-primary font-bold text-xl">🎲 Turn Taker</span>
        <div className="text-right">
          <span className="text-primary font-bold text-sm">👤 {myScore} | 🧒 {yourScore}</span>
          <span className="text-muted text-xs ml-2">Lv.{level}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6" style={{
        background: isMyTurn
          ? 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)'
          : 'linear-gradient(180deg, #f093fb 0%, #f5576c 100%)',
      }}>
        {celebration && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <div className="text-6xl animate-bounce">🎉</div>
          </div>
        )}

        <div className="text-3xl md:text-4xl font-black text-white drop-shadow-lg">
          {isMyTurn ? `👤 ${myTurnText}` : `🧒 ${yourTurnText}`}
        </div>

        <div className={`text-9xl transition-transform duration-200 ${rolling ? 'animate-spin' : ''}`}>
          {DICE_FACES[diceValue]}
        </div>

        {isMyTurn ? (
          <div className="text-2xl font-bold text-white/80">{waitText}</div>
        ) : (
          <button
            onClick={doRoll}
            disabled={rolling}
            className="rounded-3xl px-12 py-6 shadow-xl active:scale-90 transition-all select-none disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #f5af19 0%, #f12711 100%)',
              minHeight: 'clamp(80px, 15vh, 120px)',
            }}
          >
            <span className="text-white font-black text-3xl">{rollText} 🎲</span>
          </button>
        )}

        <div className="flex gap-6 text-white/90 text-xl font-bold">
          <span>👤 {myScore}</span>
          <span>🧒 {yourScore}</span>
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   GAME SELECTOR — colorful cards with previews
   Games 1-3 are FREE, Games 4-12 are PAID TIER ONLY
   ═════════════════════════════════════════════════════════════ */

const GAME_CARDS: {
  id: ActiveGame;
  emoji: string;
  title: string;
  subtitle: string;
  gradient: string;
  paid: boolean;
}[] = [
  { id: 'bubble-pop', emoji: '🫧', title: 'Bubble Pop', subtitle: 'Pop bubbles to hear your words!', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', paid: false },
  { id: 'color-hunt', emoji: '🎨', title: 'Color Hunt', subtitle: 'Find the right color!', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', paid: false },
  { id: 'my-story', emoji: '📖', title: 'My Story', subtitle: 'Build sentences with pictures!', gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', paid: false },
  { id: 'match-it', emoji: '🔍', title: 'Match It', subtitle: 'Find the right picture!', gradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)', paid: true },
  { id: 'yes-no', emoji: '❓', title: 'Yes / No', subtitle: 'Is this right? You decide!', gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)', paid: true },
  { id: 'finish-it', emoji: '💬', title: 'Finish It', subtitle: 'Complete the sentence!', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', paid: true },
  { id: 'category-sort', emoji: '🗂', title: 'Category Sort', subtitle: 'Where does it belong?', gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', paid: true },
  { id: 'emotion-match', emoji: '🎭', title: 'Emotions', subtitle: 'How do they feel?', gradient: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)', paid: true },
  { id: 'sequence', emoji: '📋', title: 'Sequence', subtitle: 'What comes next?', gradient: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)', paid: true },
  { id: 'same-different', emoji: '👀', title: 'Same/Different', subtitle: 'Find the odd one out!', gradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', paid: true },
  { id: 'sound-match', emoji: '🔊', title: 'I Hear It', subtitle: 'Listen and find it!', gradient: 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)', paid: true },
  { id: 'turn-taker', emoji: '🎲', title: 'Turn Taker', subtitle: 'Take turns rolling dice!', gradient: 'linear-gradient(135deg, #f5af19 0%, #f12711 100%)', paid: true },
];

export default function GamesPanel() {
  const { t } = useT();
  const { sidePanel, closeSidePanel } = useUIStore();
  const [activeGame, setActiveGame] = useState<ActiveGame>('none');
  const profile = useAuthStore((s) => s.profile);

  if (sidePanel !== 'games') return null;

  const goBack = () => setActiveGame('none');
  const isPaid = !!profile;

  return (
    <PanelShell>
      {activeGame === 'bubble-pop' && <BubblePopGame onBack={goBack} />}
      {activeGame === 'color-hunt' && <ColorHuntGame onBack={goBack} />}
      {activeGame === 'my-story' && <MyStoryGame onBack={goBack} />}
      {activeGame === 'match-it' && <MatchItGame onBack={goBack} />}
      {activeGame === 'yes-no' && <YesNoGame onBack={goBack} />}
      {activeGame === 'finish-it' && <FinishItGame onBack={goBack} />}
      {activeGame === 'category-sort' && <CategorySortGame onBack={goBack} />}
      {activeGame === 'emotion-match' && <EmotionMatchGame onBack={goBack} />}
      {activeGame === 'sequence' && <SequenceGame onBack={goBack} />}
      {activeGame === 'same-different' && <SameDifferentGame onBack={goBack} />}
      {activeGame === 'sound-match' && <SoundMatchGame onBack={goBack} />}
      {activeGame === 'turn-taker' && <TurnTakerGame onBack={goBack} />}
      {activeGame === 'none' && (
        <>
          <div className="flex items-center justify-between px-4 py-3 border-b border-theme shrink-0">
            <span className="text-primary font-bold text-2xl md:text-3xl">🎮 {t('games')}</span>
            <button onClick={() => { tapFeedback(); closeSidePanel(); }} aria-label={t('close_panel')} className="aac-btn w-12 h-12 rounded-xl surface-key text-muted text-2xl flex items-center justify-center border border-theme">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {GAME_CARDS.map(card => {
                const locked = card.paid && !isPaid;
                return (
                  <button
                    key={card.id}
                    className={`rounded-3xl flex flex-col items-center justify-center gap-3 p-6 select-none shadow-xl transition-transform relative ${
                      locked ? 'opacity-60 cursor-not-allowed' : 'active:scale-95'
                    }`}
                    style={{ background: card.gradient, minHeight: '160px' }}
                    onClick={() => {
                      if (locked) return;
                      tapFeedback();
                      setActiveGame(card.id);
                    }}
                    disabled={locked}
                  >
                    {!card.paid && (
                      <span className="absolute top-2 right-2 bg-green-500 text-white text-xs font-black px-2 py-0.5 rounded-full shadow">FREE</span>
                    )}
                    {locked && (
                      <span className="absolute top-2 right-2 text-2xl">🔒</span>
                    )}
                    <span className="text-5xl">{card.emoji}</span>
                    <span className="text-white font-black text-xl">{card.title}</span>
                    <span className="text-white/80 text-sm text-center">{card.subtitle}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </PanelShell>
  );
}
