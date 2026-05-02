'use client';
import { useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import { useUIStore } from '@/store/uiStore';
import { usePredictionStore } from '@/store/predictionStore';
import { useScheduleStore } from '@/store/scheduleStore';
import { tapFeedback } from '@/services/feedback';
import { useT } from '@/engine/useT';
import { aacSpeak } from '@/services/aacSpeak';
import { useSettingsStore } from '@/store/settingsStore';
import { DEFAULT_PHRASES } from '@/constants/phrases';
import { getPhraseText } from '@/constants/phraseTranslations';

function PanelShell({ children }: { children: ReactNode }) {
  const { t } = useT();
  return (
    <section aria-label={t('games')} className="flex-[3] min-h-0 flex flex-col surface-bar border-y border-theme">
      {children}
    </section>
  );
}

type ActiveGame = 'none' | 'bubble-pop' | 'color-hunt' | 'my-story';

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
    .filter(([w]) => w.length > 1 && w.length < 12)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 30)
    .map(([w]) => w.charAt(0).toUpperCase() + w.slice(1));

  if (topWords.length < 8) {
    const defaults = DEFAULT_PHRASES.slice(0, 20).map(p => {
      const text = getPhraseText(p.id, lang as never, p.text);
      return text.split(/\s+/)[0];
    }).filter(w => w.length > 1 && w.length < 10);
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
  const rafRef = useRef(0);
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
        y: 100 + Math.random() * 20,
        size: 60 + Math.random() * 30,
        color: color.bg,
        speed: 0.3 + Math.random() * 0.4 + level * 0.05,
        popped: false,
      });
    }
    setBubbles(newBubbles);
  }, [level, language]);

  useEffect(() => { spawnBubbles(); }, [spawnBubbles]);

  useEffect(() => {
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
  }, []);

  const allGone = bubbles.length > 0 && bubbles.every(b => b.popped || b.y < -15);

  useEffect(() => {
    if (allGone && !celebration) {
      setCelebration(true);
      setTimeout(() => {
        setCelebration(false);
        setLevel(l => l + 1);
        spawnBubbles();
      }, 2000);
    }
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
        <div className="text-right">
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

const COLOR_VOCAB = [
  { name: 'Red', bg: '#FF6B6B', emoji: '🔴' },
  { name: 'Blue', bg: '#45B7D1', emoji: '🔵' },
  { name: 'Green', bg: '#96CEB4', emoji: '🟢' },
  { name: 'Yellow', bg: '#FFEAA7', emoji: '🟡' },
  { name: 'Purple', bg: '#DDA0DD', emoji: '🟣' },
  { name: 'Orange', bg: '#FF9F43', emoji: '🟠' },
  { name: 'Pink', bg: '#FD79A8', emoji: '🩷' },
  { name: 'Brown', bg: '#B8860B', emoji: '🟤' },
];

function ColorHuntGame({ onBack }: { onBack: () => void }) {
  const { t } = useT();
  const { speechRate, speechVolume } = useSettingsStore();
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
    setTimeout(() => aacSpeak(`Find ${tgt.name}`, speechRate, speechVolume), 300);
  }, [round, speechRate, speechVolume]);

  useEffect(() => { newRound(); }, [newRound]);

  const handleTap = (color: typeof COLOR_VOCAB[0], idx: number) => {
    tapFeedback();
    setTappedIdx(idx);
    if (color.name === target?.name) {
      setFeedback('correct');
      setScore(s => s + 1);
      aacSpeak(`Yes! ${color.name}!`, speechRate, speechVolume);
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
          Find {target?.emoji} {target?.name}!
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
            <span className="text-white font-black text-2xl md:text-3xl drop-shadow-lg">{color.name}</span>
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
  word: string;
  emoji: string;
  color: string;
  category: 'who' | 'action' | 'what' | 'where';
}

const STORY_CARDS: StoryCard[] = [
  { id: 'i', word: 'I', emoji: '🧒', color: '#FF6B6B', category: 'who' },
  { id: 'mom', word: 'Mom', emoji: '👩', color: '#FF6B6B', category: 'who' },
  { id: 'dad', word: 'Dad', emoji: '👨', color: '#FF6B6B', category: 'who' },
  { id: 'want', word: 'want', emoji: '🙏', color: '#4ECDC4', category: 'action' },
  { id: 'go', word: 'go', emoji: '🚶', color: '#4ECDC4', category: 'action' },
  { id: 'eat', word: 'eat', emoji: '🍽️', color: '#4ECDC4', category: 'action' },
  { id: 'play', word: 'play', emoji: '🎈', color: '#4ECDC4', category: 'action' },
  { id: 'drink', word: 'drink', emoji: '🥤', color: '#4ECDC4', category: 'action' },
  { id: 'water', word: 'water', emoji: '💧', color: '#45B7D1', category: 'what' },
  { id: 'food', word: 'food', emoji: '🍕', color: '#45B7D1', category: 'what' },
  { id: 'ball', word: 'ball', emoji: '⚽', color: '#45B7D1', category: 'what' },
  { id: 'book', word: 'book', emoji: '📖', color: '#45B7D1', category: 'what' },
  { id: 'music', word: 'music', emoji: '🎵', color: '#45B7D1', category: 'what' },
  { id: 'home', word: 'home', emoji: '🏠', color: '#96CEB4', category: 'where' },
  { id: 'park', word: 'park', emoji: '🌳', color: '#96CEB4', category: 'where' },
  { id: 'school', word: 'school', emoji: '🏫', color: '#96CEB4', category: 'where' },
];

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  who: { label: 'Who?', color: '#FF6B6B' },
  action: { label: 'Does what?', color: '#4ECDC4' },
  what: { label: 'What?', color: '#45B7D1' },
  where: { label: 'Where?', color: '#96CEB4' },
};

function MyStoryGame({ onBack }: { onBack: () => void }) {
  const { t } = useT();
  const { speechRate, speechVolume } = useSettingsStore();
  const [sentence, setSentence] = useState<StoryCard[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('who');

  const addCard = (card: StoryCard) => {
    tapFeedback();
    aacSpeak(card.word, speechRate, speechVolume);
    setSentence(prev => [...prev, card]);

    const categories = ['who', 'action', 'what', 'where'];
    const nextIdx = categories.indexOf(card.category) + 1;
    if (nextIdx < categories.length) setActiveCategory(categories[nextIdx]);
  };

  const speakSentence = () => {
    tapFeedback();
    const text = sentence.map(c => c.word).join(' ');
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
                <span className="text-white font-bold text-lg">{card.word}</span>
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
              <span className="text-white font-bold text-sm md:text-base">{card.word}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   GAME SELECTOR — colorful cards with previews
   ═════════════════════════════════════════════════════════════ */

export default function GamesPanel() {
  const { t } = useT();
  const { sidePanel, closeSidePanel } = useUIStore();
  const [activeGame, setActiveGame] = useState<ActiveGame>('none');

  if (sidePanel !== 'games') return null;

  const goBack = () => setActiveGame('none');

  return (
    <PanelShell>
      {activeGame === 'bubble-pop' && <BubblePopGame onBack={goBack} />}
      {activeGame === 'color-hunt' && <ColorHuntGame onBack={goBack} />}
      {activeGame === 'my-story' && <MyStoryGame onBack={goBack} />}
      {activeGame === 'none' && (
        <>
          <div className="flex items-center justify-between px-4 py-3 border-b border-theme shrink-0">
            <span className="text-primary font-bold text-2xl md:text-3xl">🎮 {t('games')}</span>
            <button onClick={() => { tapFeedback(); closeSidePanel(); }} aria-label={t('close_panel')} className="aac-btn w-12 h-12 rounded-xl surface-key text-muted text-2xl flex items-center justify-center border border-theme">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">

              <button
                className="rounded-3xl flex flex-col items-center justify-center gap-3 p-6 select-none shadow-xl active:scale-95 transition-transform"
                style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', minHeight: '160px' }}
                onClick={() => { tapFeedback(); setActiveGame('bubble-pop'); }}
              >
                <span className="text-5xl">🫧</span>
                <span className="text-white font-black text-xl">Bubble Pop</span>
                <span className="text-white/80 text-sm text-center">Pop bubbles to hear your words!</span>
              </button>

              <button
                className="rounded-3xl flex flex-col items-center justify-center gap-3 p-6 select-none shadow-xl active:scale-95 transition-transform"
                style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', minHeight: '160px' }}
                onClick={() => { tapFeedback(); setActiveGame('color-hunt'); }}
              >
                <span className="text-5xl">🎨</span>
                <span className="text-white font-black text-xl">Color Hunt</span>
                <span className="text-white/80 text-sm text-center">Find the right color!</span>
              </button>

              <button
                className="rounded-3xl flex flex-col items-center justify-center gap-3 p-6 select-none shadow-xl active:scale-95 transition-transform"
                style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', minHeight: '160px' }}
                onClick={() => { tapFeedback(); setActiveGame('my-story'); }}
              >
                <span className="text-5xl">📖</span>
                <span className="text-white font-black text-xl">My Story</span>
                <span className="text-white/80 text-sm text-center">Build sentences with pictures!</span>
              </button>

            </div>
          </div>
        </>
      )}
    </PanelShell>
  );
}
