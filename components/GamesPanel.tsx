'use client';
import { useState, useCallback, useEffect, ReactNode } from 'react';
import { useUIStore } from '@/store/uiStore';
import { tapFeedback } from '@/services/feedback';
import { useT } from '@/engine/useT';
import { aacSpeak } from '@/services/aacSpeak';
import { useSettingsStore } from '@/store/settingsStore';

/* ── Shell (same pattern as CategoryPanel) ── */
function PanelShell({ children }: { children: ReactNode }) {
  const { t } = useT();
  return (
    <section
      aria-label={t('games')}
      className="flex-[3] min-h-0 flex flex-col surface-bar border-y border-theme"
    >
      {children}
    </section>
  );
}

/* ═════════════════════════════════════════════════════════════
   GAME 1: Match Game — cause-and-effect + vocabulary
   ═════════════════════════════════════════════════════════════ */

interface MatchCard {
  id: number;
  label: string;
  icon: string;
  matchId: number;
  flipped: boolean;
  matched: boolean;
}

const MATCH_PAIRS = [
  { label: 'Cat', icon: '🐱' },
  { label: 'Dog', icon: '🐶' },
  { label: 'Fish', icon: '🐟' },
  { label: 'Bird', icon: '🐦' },
  { label: 'Sun', icon: '☀️' },
  { label: 'Moon', icon: '🌙' },
];

function buildMatchDeck(): MatchCard[] {
  const pairs = MATCH_PAIRS.slice(0, 4);
  const cards: MatchCard[] = [];
  pairs.forEach((p, i) => {
    cards.push({ id: i * 2, label: p.label, icon: p.icon, matchId: i, flipped: false, matched: false });
    cards.push({ id: i * 2 + 1, label: p.label, icon: p.icon, matchId: i, flipped: false, matched: false });
  });
  // Fisher-Yates shuffle
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

function MatchGame({ onBack }: { onBack: () => void }) {
  const { t } = useT();
  const [cards, setCards] = useState<MatchCard[]>(buildMatchDeck);
  const [flippedIds, setFlippedIds] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [busy, setBusy] = useState(false);

  const allMatched = cards.every((c) => c.matched);

  const handleFlip = useCallback((id: number) => {
    if (busy) return;
    tapFeedback();
    const card = cards.find((c) => c.id === id);
    if (!card || card.flipped || card.matched) return;

    const newCards = cards.map((c) => c.id === id ? { ...c, flipped: true } : c);
    const newFlipped = [...flippedIds, id];
    setCards(newCards);
    setFlippedIds(newFlipped);

    if (newFlipped.length === 2) {
      setBusy(true);
      const [a, b] = newFlipped.map((fId) => newCards.find((c) => c.id === fId)!);
      if (a.matchId === b.matchId) {
        // Match found
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c) => c.matchId === a.matchId ? { ...c, matched: true } : c)
          );
          setScore((s) => s + 1);
          setFlippedIds([]);
          setBusy(false);
        }, 600);
      } else {
        // No match — flip back
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c) => newFlipped.includes(c.id) ? { ...c, flipped: false } : c)
          );
          setFlippedIds([]);
          setBusy(false);
        }, 1000);
      }
    }
  }, [cards, flippedIds, busy]);

  const resetGame = () => {
    tapFeedback();
    setCards(buildMatchDeck());
    setFlippedIds([]);
    setScore(0);
    setBusy(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-theme shrink-0">
        <button className="aac-btn min-h-[48px] px-3 rounded-xl surface-key text-muted font-bold border border-theme" onClick={() => { tapFeedback(); onBack(); }}>
          ← {t('back_to_games')}
        </button>
        <span className="text-primary font-bold text-xl">{t('match_game')}</span>
        <span className="text-primary font-bold">{t('score')}: {score}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {allMatched ? (
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <span className="text-6xl motion-safe:animate-bounce">🎉</span>
            <p className="text-primary font-bold text-2xl">{t('great_job')}</p>
            <button className="aac-btn min-h-[64px] px-6 rounded-xl bg-[#4CAF50] text-white font-bold text-xl" onClick={resetGame}>
              {t('play_again')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3 max-w-md mx-auto">
            {cards.map((card) => (
              <button
                key={card.id}
                className={`aac-btn min-h-[80px] min-w-[80px] rounded-xl border-2 border-theme font-bold text-center select-none motion-safe:transition-transform motion-safe:duration-300 ${
                  card.matched
                    ? 'bg-[#E8F5E9] dark:bg-[#1B5E20] border-[#4CAF50]'
                    : card.flipped
                    ? 'surface-key'
                    : 'bg-[#42A5F5] dark:bg-[#1565C0]'
                }`}
                onClick={() => handleFlip(card.id)}
                aria-label={card.flipped || card.matched ? card.label : t('card_face_down')}
                disabled={card.matched}
              >
                {card.flipped || card.matched ? (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-3xl">{card.icon}</span>
                    <span className="text-primary text-xs font-bold">{card.label}</span>
                  </div>
                ) : (
                  <span className="text-3xl">❓</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   GAME 2: Emotion Faces — emotion recognition
   ═════════════════════════════════════════════════════════════ */

interface EmotionRound {
  emoji: string;
  correct: string;
  options: string[];
}

function buildEmotionRounds(): EmotionRound[] {
  const emotions: Array<{ emoji: string; label: string }> = [
    { emoji: '😊', label: 'happy' },
    { emoji: '😢', label: 'sad' },
    { emoji: '😠', label: 'angry' },
    { emoji: '😨', label: 'scared' },
    { emoji: '😲', label: 'surprised' },
    { emoji: '😴', label: 'tired' },
  ];
  // Shuffle
  const shuffled = [...emotions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.map((e) => {
    const wrong = emotions.filter((o) => o.label !== e.label).map((o) => o.label);
    for (let i = wrong.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [wrong[i], wrong[j]] = [wrong[j], wrong[i]];
    }
    const options = [e.label, ...wrong.slice(0, 3)];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return { emoji: e.emoji, correct: e.label, options };
  });
}

function EmotionGame({ onBack }: { onBack: () => void }) {
  const { t, ttsCode, outputTtsCode } = useT();
  const { speechRate, speechVolume } = useSettingsStore();
  const [rounds] = useState<EmotionRound[]>(buildEmotionRounds);
  const [roundIdx, setRoundIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  const round = rounds[roundIdx];
  const gameOver = roundIdx >= rounds.length;

  const handlePick = (answer: string) => {
    tapFeedback();
    if (answer === round.correct) {
      setFeedback('correct');
      setScore((s) => s + 1);
      aacSpeak(round.correct, speechRate, speechVolume);
      setTimeout(() => {
        setFeedback(null);
        setRoundIdx((r) => r + 1);
      }, 1200);
    } else {
      setFeedback('wrong');
      setTimeout(() => setFeedback(null), 1200);
    }
  };

  const resetGame = () => {
    tapFeedback();
    setRoundIdx(0);
    setScore(0);
    setFeedback(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-theme shrink-0">
        <button className="aac-btn min-h-[48px] px-3 rounded-xl surface-key text-muted font-bold border border-theme" onClick={() => { tapFeedback(); onBack(); }}>
          ← {t('back_to_games')}
        </button>
        <span className="text-primary font-bold text-xl">{t('emotion_game')}</span>
        <span className="text-primary font-bold">{t('score')}: {score}</span>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-4 gap-6">
        {gameOver ? (
          <div className="flex flex-col items-center gap-4">
            <span className="text-6xl motion-safe:animate-bounce">🏆</span>
            <p className="text-primary font-bold text-2xl">{t('great_job')} {score}/{rounds.length}</p>
            <button className="aac-btn min-h-[64px] px-6 rounded-xl bg-[#4CAF50] text-white font-bold text-xl" onClick={resetGame}>
              {t('play_again')}
            </button>
          </div>
        ) : (
          <>
            <span className="text-8xl">{round.emoji}</span>

            {feedback === 'correct' && (
              <p className="text-[#4CAF50] font-bold text-2xl motion-safe:animate-bounce">{t('correct')}! 🎉</p>
            )}
            {feedback === 'wrong' && (
              <p className="text-[#F44336] font-bold text-xl">{t('try_again')} 💡</p>
            )}

            <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
              {round.options.map((opt) => (
                <button
                  key={opt}
                  className="aac-btn min-h-[64px] rounded-xl surface-key text-primary font-bold text-lg border border-theme select-none capitalize"
                  onClick={() => handlePick(opt)}
                  disabled={feedback !== null}
                >
                  {t(`emotion_${opt}`) || opt}
                </button>
              ))}
            </div>

            <p className="text-muted text-sm">{roundIdx + 1}/{rounds.length}</p>
          </>
        )}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   GAME 3: Word Builder — literacy / spelling
   ═════════════════════════════════════════════════════════════ */

interface WordChallenge {
  icon: string;
  word: string;
}

const WORD_LIST: WordChallenge[] = [
  { icon: '🐱', word: 'CAT' },
  { icon: '🐶', word: 'DOG' },
  { icon: '☀️', word: 'SUN' },
  { icon: '🐟', word: 'FISH' },
  { icon: '⭐', word: 'STAR' },
  { icon: '🌙', word: 'MOON' },
];

function scrambleLetters(word: string): string[] {
  const letters = word.split('');
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  // Ensure at least one letter is out of place
  if (letters.join('') === word) {
    [letters[0], letters[letters.length - 1]] = [letters[letters.length - 1], letters[0]];
  }
  return letters;
}

function WordBuilderGame({ onBack }: { onBack: () => void }) {
  const { t, ttsCode, outputTtsCode } = useT();
  const { speechRate, speechVolume } = useSettingsStore();
  const [wordIdx, setWordIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [scrambled, setScrambled] = useState<string[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | null>(null);

  const challenge = WORD_LIST[wordIdx];
  const gameOver = wordIdx >= WORD_LIST.length;

  useEffect(() => {
    if (!gameOver) {
      setScrambled(scrambleLetters(WORD_LIST[wordIdx].word));
      setSelected([]);
      setShowHint(false);
      setFeedback(null);
    }
  }, [wordIdx, gameOver]);

  const currentWord = selected.map((i) => scrambled[i]).join('');
  const isComplete = currentWord.length === challenge?.word.length;

  useEffect(() => {
    if (isComplete && currentWord === challenge?.word) {
      setFeedback('correct');
      setScore((s) => s + 1);
      aacSpeak(challenge.word.toLowerCase(), speechRate, speechVolume);
      const timeout = setTimeout(() => {
        setWordIdx((w) => w + 1);
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [isComplete, currentWord, challenge, speechRate, speechVolume, outputTtsCode]);

  const handleTapLetter = (idx: number) => {
    tapFeedback();
    if (selected.includes(idx)) {
      setSelected(selected.filter((s) => s !== idx));
    } else if (selected.length < (challenge?.word.length ?? 0)) {
      setSelected([...selected, idx]);
    }
  };

  const resetGame = () => {
    tapFeedback();
    setWordIdx(0);
    setScore(0);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-theme shrink-0">
        <button className="aac-btn min-h-[48px] px-3 rounded-xl surface-key text-muted font-bold border border-theme" onClick={() => { tapFeedback(); onBack(); }}>
          ← {t('back_to_games')}
        </button>
        <span className="text-primary font-bold text-xl">{t('word_builder')}</span>
        <span className="text-primary font-bold">{t('score')}: {score}</span>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-4 gap-4">
        {gameOver ? (
          <div className="flex flex-col items-center gap-4">
            <span className="text-6xl motion-safe:animate-bounce">🏆</span>
            <p className="text-primary font-bold text-2xl">{t('great_job')} {score}/{WORD_LIST.length}</p>
            <button className="aac-btn min-h-[64px] px-6 rounded-xl bg-[#4CAF50] text-white font-bold text-xl" onClick={resetGame}>
              {t('play_again')}
            </button>
          </div>
        ) : (
          <>
            <span className="text-7xl">{challenge.icon}</span>

            {/* Built word display */}
            <div className="flex gap-2">
              {challenge.word.split('').map((_, i) => (
                <div
                  key={i}
                  className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-2xl font-bold ${
                    selected[i] !== undefined
                      ? 'border-[#4CAF50] bg-[#E8F5E9] dark:bg-[#1B5E20] text-primary'
                      : 'border-theme surface-key text-muted'
                  }`}
                >
                  {selected[i] !== undefined ? scrambled[selected[i]] : (showHint && i === 0 ? challenge.word[0] : '_')}
                </div>
              ))}
            </div>

            {feedback === 'correct' && (
              <p className="text-[#4CAF50] font-bold text-2xl motion-safe:animate-bounce">{t('correct')}! 🎉</p>
            )}
            {isComplete && currentWord !== challenge.word && (
              <p className="text-[#F44336] font-bold text-lg">{t('try_again')} 💡</p>
            )}

            {/* Scrambled letter tiles */}
            <div className="flex gap-2 flex-wrap justify-center">
              {scrambled.map((letter, idx) => (
                <button
                  key={idx}
                  className={`aac-btn min-w-[56px] min-h-[56px] rounded-xl border-2 border-theme text-2xl font-bold select-none motion-safe:transition-all ${
                    selected.includes(idx)
                      ? 'opacity-30 scale-90'
                      : 'surface-key text-primary'
                  }`}
                  onClick={() => handleTapLetter(idx)}
                  disabled={feedback !== null}
                >
                  {letter}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                className="aac-btn min-h-[48px] px-4 rounded-xl surface-key text-primary font-bold border border-theme"
                onClick={() => { tapFeedback(); setShowHint(true); }}
              >
                💡 {t('hint')}
              </button>
              <button
                className="aac-btn min-h-[48px] px-4 rounded-xl surface-key text-muted font-bold border border-theme"
                onClick={() => { tapFeedback(); setSelected([]); setShowHint(false); }}
              >
                {t('clear')}
              </button>
            </div>

            <p className="text-muted text-sm">{wordIdx + 1}/{WORD_LIST.length}</p>
          </>
        )}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   GAME LAUNCHER
   ═════════════════════════════════════════════════════════════ */

type ActiveGame = 'none' | 'match' | 'emotion' | 'word-builder';

export default function GamesPanel() {
  const { t } = useT();
  const { sidePanel, closeSidePanel } = useUIStore();
  const [activeGame, setActiveGame] = useState<ActiveGame>('none');

  if (sidePanel !== 'games') return null;

  const closeBtn = 'aac-btn w-12 h-12 rounded-xl surface-key text-muted text-2xl flex items-center justify-center border border-theme';
  const headerRow = 'flex items-center justify-between px-4 py-3 border-b border-theme shrink-0';
  const headerTitle = 'text-primary font-bold text-2xl md:text-3xl';

  const goBack = () => setActiveGame('none');

  return (
    <PanelShell>
      {activeGame === 'match' && <MatchGame onBack={goBack} />}
      {activeGame === 'emotion' && <EmotionGame onBack={goBack} />}
      {activeGame === 'word-builder' && <WordBuilderGame onBack={goBack} />}
      {activeGame === 'none' && (
        <>
          <div className={headerRow}>
            <span className={headerTitle}>🎮 {t('games')}</span>
            <button onClick={() => { tapFeedback(); closeSidePanel(); }} aria-label={t('close_panel')} className={closeBtn}>
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
              {/* Match Game */}
              <button
                className="aac-btn min-h-[120px] rounded-2xl surface-key border-2 border-theme flex flex-col items-center justify-center gap-3 p-4 select-none"
                onClick={() => { tapFeedback(); setActiveGame('match'); }}
              >
                <span className="text-5xl">🃏</span>
                <span className="text-primary font-bold text-lg">{t('match_game')}</span>
                <span className="text-muted text-sm text-center">{t('match_game_desc')}</span>
              </button>

              {/* Emotion Faces */}
              <button
                className="aac-btn min-h-[120px] rounded-2xl surface-key border-2 border-theme flex flex-col items-center justify-center gap-3 p-4 select-none"
                onClick={() => { tapFeedback(); setActiveGame('emotion'); }}
              >
                <span className="text-5xl">😊</span>
                <span className="text-primary font-bold text-lg">{t('emotion_game')}</span>
                <span className="text-muted text-sm text-center">{t('emotion_game_desc')}</span>
              </button>

              {/* Word Builder */}
              <button
                className="aac-btn min-h-[120px] rounded-2xl surface-key border-2 border-theme flex flex-col items-center justify-center gap-3 p-4 select-none"
                onClick={() => { tapFeedback(); setActiveGame('word-builder'); }}
              >
                <span className="text-5xl">🔤</span>
                <span className="text-primary font-bold text-lg">{t('word_builder')}</span>
                <span className="text-muted text-sm text-center">{t('word_builder_desc')}</span>
              </button>
            </div>
          </div>
        </>
      )}
    </PanelShell>
  );
}
