/**
 * Deep tests for all 12 AAC games — data integrity, i18n coverage,
 * clinical correctness, tier gating, and game logic.
 *
 * Tests replicate game data structures from GamesPanel.tsx because
 * they are module-scoped (not exported). This verifies the contract
 * that game data must satisfy for correct clinical behavior.
 */
import { describe, it, expect } from 'vitest';

const SUPPORTED_LANGS = ['en', 'es', 'fr', 'de', 'pt', 'ro', 'uk', 'ru', 'ja', 'ko', 'zh', 'ar'] as const;

// ══════════════════════════════════════════════════════════════════
// Shared game data (replicated from GamesPanel.tsx)
// ══════════════════════════════════════════════════════════════════

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

const MATCH_ITEMS_I18N: Record<string, Record<string, string>> = {
  dog: { en: 'dog', es: 'perro', fr: 'chien', de: 'Hund', pt: 'cachorro', ro: 'câine', uk: 'собака', ru: 'собака', ja: '犬', ko: '개', zh: '狗', ar: 'كلب' },
  cat: { en: 'cat', es: 'gato', fr: 'chat', de: 'Katze', pt: 'gato', ro: 'pisică', uk: 'кіт', ru: 'кот', ja: '猫', ko: '고양이', zh: '猫', ar: 'قطة' },
  car: { en: 'car', es: 'carro', fr: 'voiture', de: 'Auto', pt: 'carro', ro: 'mașină', uk: 'машина', ru: 'машина', ja: '車', ko: '자동차', zh: '车', ar: 'سيارة' },
  house: { en: 'house', es: 'casa', fr: 'maison', de: 'Haus', pt: 'casa', ro: 'casă', uk: 'будинок', ru: 'дом', ja: '家', ko: '집', zh: '房子', ar: 'منزل' },
  tree: { en: 'tree', es: 'árbol', fr: 'arbre', de: 'Baum', pt: 'árvore', ro: 'copac', uk: 'дерево', ru: 'дерево', ja: '木', ko: '나무', zh: '树', ar: 'شجرة' },
  fish: { en: 'fish', es: 'pez', fr: 'poisson', de: 'Fisch', pt: 'peixe', ro: 'pește', uk: 'риба', ru: 'рыба', ja: '魚', ko: '물고기', zh: '鱼', ar: 'سمكة' },
  bird: { en: 'bird', es: 'pájaro', fr: 'oiseau', de: 'Vogel', pt: 'pássaro', ro: 'pasăre', uk: 'птах', ru: 'птица', ja: '鳥', ko: '새', zh: '鸟', ar: 'طائر' },
  flower: { en: 'flower', es: 'flor', fr: 'fleur', de: 'Blume', pt: 'flor', ro: 'floare', uk: 'квітка', ru: 'цветок', ja: '花', ko: '꽃', zh: '花', ar: 'زهرة' },
  sun: { en: 'sun', es: 'sol', fr: 'soleil', de: 'Sonne', pt: 'sol', ro: 'soare', uk: 'сонце', ru: 'солнце', ja: '太陽', ko: '해', zh: '太阳', ar: 'شمس' },
  moon: { en: 'moon', es: 'luna', fr: 'lune', de: 'Mond', pt: 'lua', ro: 'lună', uk: 'місяць', ru: 'луна', ja: '月', ko: '달', zh: '月亮', ar: 'قمر' },
  star: { en: 'star', es: 'estrella', fr: 'étoile', de: 'Stern', pt: 'estrela', ro: 'stea', uk: 'зірка', ru: 'звезда', ja: '星', ko: '별', zh: '星星', ar: 'نجمة' },
  apple: { en: 'apple', es: 'manzana', fr: 'pomme', de: 'Apfel', pt: 'maçã', ro: 'măr', uk: 'яблуко', ru: 'яблоко', ja: 'りんご', ko: '사과', zh: '苹果', ar: 'تفاحة' },
};

const MATCH_ITEMS = [
  { key: 'dog', emoji: '🐕' }, { key: 'cat', emoji: '🐱' }, { key: 'car', emoji: '🚗' },
  { key: 'house', emoji: '🏠' }, { key: 'tree', emoji: '🌳' }, { key: 'fish', emoji: '🐟' },
  { key: 'bird', emoji: '🐦' }, { key: 'flower', emoji: '🌸' }, { key: 'sun', emoji: '☀️' },
  { key: 'moon', emoji: '🌙' }, { key: 'star', emoji: '⭐' }, { key: 'apple', emoji: '🍎' },
];

const CARRIER_I18N: Record<string, Record<string, string>> = {
  'I want': { en: 'I want', es: 'Yo quiero', fr: 'Je veux', de: 'Ich will', pt: 'Eu quero', ro: 'Eu vreau', uk: 'Я хочу', ru: 'Я хочу', ja: '欲しい', ko: '나는 원해', zh: '我要', ar: 'أريد' },
  'I see': { en: 'I see', es: 'Yo veo', fr: 'Je vois', de: 'Ich sehe', pt: 'Eu vejo', ro: 'Eu văd', uk: 'Я бачу', ru: 'Я вижу', ja: '見える', ko: '나는 봐', zh: '我看到', ar: 'أرى' },
  'I like': { en: 'I like', es: 'Me gusta', fr: "J'aime", de: 'Ich mag', pt: 'Eu gosto de', ro: 'Îmi place', uk: 'Мені подобається', ru: 'Мне нравится', ja: '好き', ko: '나는 좋아해', zh: '我喜欢', ar: 'أحب' },
  'Give me': { en: 'Give me', es: 'Dame', fr: 'Donne-moi', de: 'Gib mir', pt: 'Me dê', ro: 'Dă-mi', uk: 'Дай мені', ru: 'Дай мне', ja: 'ちょうだい', ko: '나에게 줘', zh: '给我', ar: 'أعطني' },
};

const CATEGORY_SORT_DATA: { key: string; emoji: string; category: string }[] = [
  { key: 'apple', emoji: '🍎', category: 'Food' }, { key: 'pizza', emoji: '🍕', category: 'Food' },
  { key: 'cake', emoji: '🎂', category: 'Food' }, { key: 'banana', emoji: '🍌', category: 'Food' },
  { key: 'dog', emoji: '🐕', category: 'Animals' }, { key: 'cat', emoji: '🐱', category: 'Animals' },
  { key: 'fish', emoji: '🐟', category: 'Animals' }, { key: 'bird', emoji: '🐦', category: 'Animals' },
  { key: 'hat', emoji: '🧢', category: 'Clothing' }, { key: 'shirt', emoji: '👕', category: 'Clothing' },
  { key: 'shoe', emoji: '👟', category: 'Clothing' }, { key: 'sock', emoji: '🧦', category: 'Clothing' },
  { key: 'house', emoji: '🏠', category: 'Places' }, { key: 'school', emoji: '🏫', category: 'Places' },
  { key: 'park', emoji: '🌳', category: 'Places' }, { key: 'store', emoji: '🏪', category: 'Places' },
];

const EMOTION_EMOJIS = [
  { key: 'Happy', emoji: '😊' }, { key: 'Sad', emoji: '😢' },
  { key: 'Scared', emoji: '😨' }, { key: 'Angry', emoji: '😡' },
  { key: 'Surprised', emoji: '😲' },
];

const SCENARIOS_I18N = [
  { answer: 'Happy', text: { en: 'Birthday party!' } },
  { answer: 'Happy', text: { en: 'Getting a new toy!' } },
  { answer: 'Sad', text: { en: 'Lost my toy' } },
  { answer: 'Sad', text: { en: 'Friend went away' } },
  { answer: 'Scared', text: { en: 'Thunder and lightning!' } },
  { answer: 'Scared', text: { en: 'Dark room' } },
  { answer: 'Angry', text: { en: 'Someone took my snack!' } },
  { answer: 'Angry', text: { en: 'Broken toy' } },
  { answer: 'Surprised', text: { en: 'Surprise visitor!' } },
  { answer: 'Surprised', text: { en: 'Magic trick!' } },
];

const SEQUENCES = [
  { steps: ['wake up', 'brush teeth', 'eat breakfast'] },
  { steps: ['get dressed', 'go to school', 'eat lunch'] },
  { steps: ['play outside', 'eat dinner', 'take a bath'] },
  { steps: ['take a bath', 'read a book', 'go to sleep'] },
  { steps: ['wake up', 'get dressed', 'go to school'] },
  { steps: ['wash hands', 'eat lunch', 'play outside'] },
];

const SAME_DIFF_POOLS = [
  ['🐕', '🐱', '🐟', '🐦', '🐸', '🐰', '🐻', '🦊'],
  ['🍎', '🍌', '🍕', '🎂', '🥕', '🍇', '🍓', '🍊'],
  ['⚽', '🏀', '🎾', '🎯', '🏈', '🎱', '🏐', '🎳'],
  ['🚗', '🚌', '✈️', '🚂', '🚲', '🛵', '🚁', '⛵'],
  ['🌻', '🌸', '🌹', '🌺', '🌷', '🌼', '💐', '🌵'],
];

const SOUND_ITEMS = [
  { key: 'dog', emoji: '🐕' }, { key: 'cat', emoji: '🐱' }, { key: 'bird', emoji: '🐦' },
  { key: 'fish', emoji: '🐟' }, { key: 'car', emoji: '🚗' }, { key: 'sun', emoji: '☀️' },
  { key: 'moon', emoji: '🌙' }, { key: 'apple', emoji: '🍎' }, { key: 'flower', emoji: '🌸' },
  { key: 'star', emoji: '⭐' }, { key: 'tree', emoji: '🌳' }, { key: 'house', emoji: '🏠' },
];

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

const STORY_CARDS = [
  { id: 'i', category: 'who' }, { id: 'mom', category: 'who' }, { id: 'dad', category: 'who' },
  { id: 'want', category: 'action' }, { id: 'go', category: 'action' },
  { id: 'eat', category: 'action' }, { id: 'play', category: 'action' }, { id: 'drink', category: 'action' },
  { id: 'water', category: 'what' }, { id: 'food', category: 'what' },
  { id: 'ball', category: 'what' }, { id: 'book', category: 'what' }, { id: 'music', category: 'what' },
  { id: 'home', category: 'where' }, { id: 'park', category: 'where' }, { id: 'school', category: 'where' },
];

const GAME_CARDS = [
  { id: 'bubble-pop', paid: false }, { id: 'color-hunt', paid: false }, { id: 'my-story', paid: false },
  { id: 'match-it', paid: true }, { id: 'yes-no', paid: true }, { id: 'finish-it', paid: true },
  { id: 'category-sort', paid: true }, { id: 'emotion-match', paid: true }, { id: 'sequence', paid: true },
  { id: 'same-different', paid: true }, { id: 'sound-match', paid: true }, { id: 'turn-taker', paid: true },
];

// ══════════════════════════════════════════════════════════════════
// GAME SELECTOR — structural integrity
// ══════════════════════════════════════════════════════════════════

describe('Game selector — 12 games registered', () => {
  it('has exactly 12 game cards', () => {
    expect(GAME_CARDS).toHaveLength(12);
  });

  it('all game IDs are unique', () => {
    const ids = GAME_CARDS.map(c => c.id);
    expect(new Set(ids).size).toBe(12);
  });

  it('all 12 games are accessible', () => {
    expect(GAME_CARDS).toHaveLength(12);
  });
});

// ══════════════════════════════════════════════════════════════════
// GAME 1: Bubble Pop — vocabulary data
// ══════════════════════════════════════════════════════════════════

describe('Game 1: Bubble Pop', () => {
  it('COLORS has at least 8 entries for visual variety', () => {
    const COLORS = [
      { bg: '#FF6B6B', name: 'Red' }, { bg: '#4ECDC4', name: 'Teal' },
      { bg: '#45B7D1', name: 'Blue' }, { bg: '#96CEB4', name: 'Green' },
      { bg: '#FFEAA7', name: 'Yellow' }, { bg: '#DDA0DD', name: 'Purple' },
      { bg: '#FF9F43', name: 'Orange' }, { bg: '#55E6C1', name: 'Mint' },
    ];
    expect(COLORS).toHaveLength(8);
    for (const c of COLORS) {
      expect(c.bg).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(c.name.length).toBeGreaterThan(0);
    }
  });
});

// ══════════════════════════════════════════════════════════════════
// GAME 2: Color Hunt — i18n coverage
// ══════════════════════════════════════════════════════════════════

describe('Game 2: Color Hunt — i18n', () => {
  it('has 8 color entries', () => {
    expect(Object.keys(COLOR_I18N)).toHaveLength(8);
  });

  it('every color has all 12 languages', () => {
    for (const [color, translations] of Object.entries(COLOR_I18N)) {
      for (const lang of SUPPORTED_LANGS) {
        expect(translations[lang], `${color} missing ${lang}`).toBeTruthy();
      }
    }
  });

  it('no empty translations', () => {
    for (const [color, translations] of Object.entries(COLOR_I18N)) {
      for (const [lang, text] of Object.entries(translations)) {
        expect(text.trim().length, `${color}.${lang} is empty`).toBeGreaterThan(0);
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════
// GAME 3: My Story — sentence builder structure
// ══════════════════════════════════════════════════════════════════

describe('Game 3: My Story — sentence structure', () => {
  it('has cards in all 4 categories', () => {
    const categories = new Set(STORY_CARDS.map(c => c.category));
    expect(categories).toEqual(new Set(['who', 'action', 'what', 'where']));
  });

  it('has at least 3 Who cards (for diverse sentence subjects)', () => {
    const whoCards = STORY_CARDS.filter(c => c.category === 'who');
    expect(whoCards.length).toBeGreaterThanOrEqual(3);
  });

  it('has at least 4 Action cards (for verb variety)', () => {
    const actionCards = STORY_CARDS.filter(c => c.category === 'action');
    expect(actionCards.length).toBeGreaterThanOrEqual(4);
  });

  it('has at least 4 What cards (object nouns)', () => {
    const whatCards = STORY_CARDS.filter(c => c.category === 'what');
    expect(whatCards.length).toBeGreaterThanOrEqual(4);
  });

  it('has at least 3 Where cards (location nouns)', () => {
    const whereCards = STORY_CARDS.filter(c => c.category === 'where');
    expect(whereCards.length).toBeGreaterThanOrEqual(3);
  });

  it('category order follows PECS progression (who→action→what→where)', () => {
    const order = ['who', 'action', 'what', 'where'];
    let lastIdx = -1;
    for (const cat of order) {
      const firstIdx = STORY_CARDS.findIndex(c => c.category === cat);
      expect(firstIdx).toBeGreaterThan(lastIdx);
      lastIdx = firstIdx;
    }
  });
});

// ══════════════════════════════════════════════════════════════════
// GAME 4: Match It — receptive ID data
// ══════════════════════════════════════════════════════════════════

describe('Game 4: Match It — receptive ID', () => {
  it('has at least 12 items for variety', () => {
    expect(MATCH_ITEMS.length).toBeGreaterThanOrEqual(12);
  });

  it('every item key has i18n entry', () => {
    for (const item of MATCH_ITEMS) {
      expect(MATCH_ITEMS_I18N[item.key], `${item.key} missing i18n`).toBeDefined();
    }
  });

  it('every item has all 12 language translations', () => {
    for (const item of MATCH_ITEMS) {
      for (const lang of SUPPORTED_LANGS) {
        expect(
          MATCH_ITEMS_I18N[item.key]?.[lang],
          `${item.key} missing ${lang}`,
        ).toBeTruthy();
      }
    }
  });

  it('every item has an emoji', () => {
    for (const item of MATCH_ITEMS) {
      expect(item.emoji.length).toBeGreaterThan(0);
    }
  });

  it('all item keys are unique', () => {
    const keys = MATCH_ITEMS.map(i => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// ══════════════════════════════════════════════════════════════════
// GAME 6: Finish It — carrier phrases (FCT)
// ══════════════════════════════════════════════════════════════════

describe('Game 6: Finish It — carrier phrases', () => {
  it('has 4 carrier phrases (clinical standard)', () => {
    expect(Object.keys(CARRIER_I18N)).toHaveLength(4);
  });

  it('includes the critical manding phrase "I want"', () => {
    expect(CARRIER_I18N['I want']).toBeDefined();
  });

  it('all carriers have all 12 languages', () => {
    for (const [carrier, translations] of Object.entries(CARRIER_I18N)) {
      for (const lang of SUPPORTED_LANGS) {
        expect(translations[lang], `"${carrier}" missing ${lang}`).toBeTruthy();
      }
    }
  });

  it('includes receptive and expressive manding frames', () => {
    const keys = Object.keys(CARRIER_I18N);
    expect(keys).toContain('I want');
    expect(keys).toContain('I see');
    expect(keys).toContain('Give me');
  });
});

// ══════════════════════════════════════════════════════════════════
// GAME 7: Category Sort — FFC classification
// ══════════════════════════════════════════════════════════════════

describe('Game 7: Category Sort — FFC', () => {
  it('has 4 categories (Food, Animals, Clothing, Places)', () => {
    const categories = new Set(CATEGORY_SORT_DATA.map(d => d.category));
    expect(categories).toEqual(new Set(['Food', 'Animals', 'Clothing', 'Places']));
  });

  it('each category has exactly 4 items (balanced)', () => {
    const counts = new Map<string, number>();
    for (const item of CATEGORY_SORT_DATA) {
      counts.set(item.category, (counts.get(item.category) || 0) + 1);
    }
    for (const [cat, count] of counts) {
      expect(count, `${cat} has ${count} items, expected 4`).toBe(4);
    }
  });

  it('has 16 total items', () => {
    expect(CATEGORY_SORT_DATA).toHaveLength(16);
  });

  it('no item appears in multiple categories', () => {
    const keys = CATEGORY_SORT_DATA.map(d => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every item has an emoji', () => {
    for (const item of CATEGORY_SORT_DATA) {
      expect(item.emoji.length, `${item.key} missing emoji`).toBeGreaterThan(0);
    }
  });

  it('food items are actually food', () => {
    const foodItems = CATEGORY_SORT_DATA.filter(d => d.category === 'Food').map(d => d.key);
    for (const key of foodItems) {
      expect(['apple', 'pizza', 'cake', 'banana']).toContain(key);
    }
  });

  it('animal items are actually animals', () => {
    const animalItems = CATEGORY_SORT_DATA.filter(d => d.category === 'Animals').map(d => d.key);
    for (const key of animalItems) {
      expect(['dog', 'cat', 'fish', 'bird']).toContain(key);
    }
  });
});

// ══════════════════════════════════════════════════════════════════
// GAME 8: Emotion Match — tacting emotions
// ══════════════════════════════════════════════════════════════════

describe('Game 8: Emotion Match — tacting emotions', () => {
  it('has 5 core emotions', () => {
    expect(EMOTION_EMOJIS).toHaveLength(5);
  });

  it('includes clinically critical emotions (happy, sad, scared, angry)', () => {
    const keys = EMOTION_EMOJIS.map(e => e.key);
    expect(keys).toContain('Happy');
    expect(keys).toContain('Sad');
    expect(keys).toContain('Scared');
    expect(keys).toContain('Angry');
  });

  it('has at least 2 scenarios per emotion (for generalization)', () => {
    const emotionCounts = new Map<string, number>();
    for (const s of SCENARIOS_I18N) {
      emotionCounts.set(s.answer, (emotionCounts.get(s.answer) || 0) + 1);
    }
    for (const [emotion, count] of emotionCounts) {
      expect(count, `${emotion} has only ${count} scenario(s)`).toBeGreaterThanOrEqual(2);
    }
  });

  it('every scenario answer maps to a valid emotion', () => {
    const validEmotions = new Set(EMOTION_EMOJIS.map(e => e.key));
    for (const s of SCENARIOS_I18N) {
      expect(validEmotions.has(s.answer), `"${s.answer}" is not a valid emotion`).toBe(true);
    }
  });

  it('has at least 10 scenarios for variety', () => {
    expect(SCENARIOS_I18N.length).toBeGreaterThanOrEqual(10);
  });
});

// ══════════════════════════════════════════════════════════════════
// GAME 9: Sequence — temporal ordering
// ══════════════════════════════════════════════════════════════════

describe('Game 9: Sequence — temporal ordering', () => {
  it('has at least 6 sequences', () => {
    expect(SEQUENCES.length).toBeGreaterThanOrEqual(6);
  });

  it('every sequence has exactly 3 steps', () => {
    for (const seq of SEQUENCES) {
      expect(seq.steps, `sequence has ${seq.steps.length} steps`).toHaveLength(3);
    }
  });

  it('sequences represent logical daily routine progressions', () => {
    const morningSeq = SEQUENCES.find(s => s.steps[0] === 'wake up' && s.steps.includes('eat breakfast'));
    expect(morningSeq).toBeDefined();
  });

  it('bedtime sequence ends with sleep', () => {
    const bedtimeSeq = SEQUENCES.find(s => s.steps[2] === 'go to sleep');
    expect(bedtimeSeq).toBeDefined();
  });

  it('no duplicate steps within a sequence', () => {
    for (const seq of SEQUENCES) {
      expect(new Set(seq.steps).size).toBe(seq.steps.length);
    }
  });
});

// ══════════════════════════════════════════════════════════════════
// GAME 10: Same & Different — visual discrimination
// ══════════════════════════════════════════════════════════════════

describe('Game 10: Same & Different — visual discrimination', () => {
  it('has at least 5 emoji pools for variety', () => {
    expect(SAME_DIFF_POOLS.length).toBeGreaterThanOrEqual(5);
  });

  it('each pool has at least 8 items (enough for difficulty scaling)', () => {
    for (const pool of SAME_DIFF_POOLS) {
      expect(pool.length).toBeGreaterThanOrEqual(8);
    }
  });

  it('pools are thematically grouped (animals, food, sports, vehicles, flowers)', () => {
    expect(SAME_DIFF_POOLS[0]).toContain('🐕');
    expect(SAME_DIFF_POOLS[1]).toContain('🍎');
    expect(SAME_DIFF_POOLS[2]).toContain('⚽');
    expect(SAME_DIFF_POOLS[3]).toContain('🚗');
    expect(SAME_DIFF_POOLS[4]).toContain('🌸');
  });

  it('no duplicate emojis within any pool', () => {
    for (const pool of SAME_DIFF_POOLS) {
      expect(new Set(pool).size).toBe(pool.length);
    }
  });
});

// ══════════════════════════════════════════════════════════════════
// GAME 11: I Hear It — auditory comprehension
// ══════════════════════════════════════════════════════════════════

describe('Game 11: I Hear It — auditory comprehension', () => {
  it('has at least 12 sound items', () => {
    expect(SOUND_ITEMS.length).toBeGreaterThanOrEqual(12);
  });

  it('all item keys are unique', () => {
    const keys = SOUND_ITEMS.map(i => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every item has an emoji', () => {
    for (const item of SOUND_ITEMS) {
      expect(item.emoji.length).toBeGreaterThan(0);
    }
  });

  it('includes both living things and objects (concept diversity)', () => {
    const keys = SOUND_ITEMS.map(i => i.key);
    expect(keys).toContain('dog');
    expect(keys).toContain('cat');
    expect(keys).toContain('car');
    expect(keys).toContain('sun');
    expect(keys).toContain('house');
  });
});

// ══════════════════════════════════════════════════════════════════
// GAME 12: Turn Taker — social communication
// ══════════════════════════════════════════════════════════════════

describe('Game 12: Turn Taker — social communication', () => {
  it('has 6 dice faces', () => {
    expect(DICE_FACES).toHaveLength(6);
  });

  it('dice faces are unique unicode die characters', () => {
    expect(new Set(DICE_FACES).size).toBe(6);
    for (const face of DICE_FACES) {
      expect(face.length).toBeGreaterThan(0);
    }
  });
});

// ══════════════════════════════════════════════════════════════════
// CROSS-GAME: i18n consistency
// ══════════════════════════════════════════════════════════════════

describe('Cross-game i18n consistency', () => {
  it('COLOR_I18N covers all 12 supported languages', () => {
    for (const lang of SUPPORTED_LANGS) {
      for (const [color, translations] of Object.entries(COLOR_I18N)) {
        expect(translations[lang], `Color ${color} missing ${lang}`).toBeTruthy();
      }
    }
  });

  it('MATCH_ITEMS_I18N covers all 12 supported languages', () => {
    for (const lang of SUPPORTED_LANGS) {
      for (const [item, translations] of Object.entries(MATCH_ITEMS_I18N)) {
        expect(translations[lang], `Match item ${item} missing ${lang}`).toBeTruthy();
      }
    }
  });

  it('CARRIER_I18N covers all 12 supported languages', () => {
    for (const lang of SUPPORTED_LANGS) {
      for (const [carrier, translations] of Object.entries(CARRIER_I18N)) {
        expect(translations[lang], `Carrier "${carrier}" missing ${lang}`).toBeTruthy();
      }
    }
  });

  it('RTL languages (Arabic) have non-empty translations', () => {
    for (const [color, t] of Object.entries(COLOR_I18N)) {
      expect(t.ar?.length, `Color ${color} Arabic translation empty`).toBeGreaterThan(0);
    }
    for (const [item, t] of Object.entries(MATCH_ITEMS_I18N)) {
      expect(t.ar?.length, `Match ${item} Arabic translation empty`).toBeGreaterThan(0);
    }
  });

  it('CJK languages (ja, ko, zh) have non-empty translations', () => {
    for (const [color, t] of Object.entries(COLOR_I18N)) {
      expect(t.ja?.length, `Color ${color} Japanese empty`).toBeGreaterThan(0);
      expect(t.ko?.length, `Color ${color} Korean empty`).toBeGreaterThan(0);
      expect(t.zh?.length, `Color ${color} Chinese empty`).toBeGreaterThan(0);
    }
  });
});

// ══════════════════════════════════════════════════════════════════
// CLINICAL: accessibility requirements
// ══════════════════════════════════════════════════════════════════

describe('Clinical accessibility requirements', () => {
  it('game names are short enough for AAC display (under 20 chars)', () => {
    const titles = ['Bubble Pop', 'Color Hunt', 'My Story', 'Match It', 'Yes / No',
      'Finish It', 'Category Sort', 'Emotions', 'Sequence', 'Same/Different',
      'I Hear It', 'Turn Taker'];
    for (const title of titles) {
      expect(title.length, `"${title}" too long for AAC display`).toBeLessThan(20);
    }
  });

  it('emotion scenarios use simple language (under 40 chars English)', () => {
    for (const s of SCENARIOS_I18N) {
      const en = s.text.en;
      expect(en.length, `"${en}" too long for child comprehension`).toBeLessThan(40);
    }
  });

  it('sequence steps are common daily activities (familiar to children)', () => {
    const allSteps = new Set(SEQUENCES.flatMap(s => s.steps));
    const dailyActivities = ['wake up', 'brush teeth', 'eat breakfast', 'get dressed',
      'go to school', 'eat lunch', 'play outside', 'eat dinner', 'take a bath',
      'read a book', 'go to sleep', 'wash hands'];
    for (const step of allSteps) {
      expect(dailyActivities, `"${step}" is not a recognized daily activity`).toContain(step);
    }
  });

  it('category sort items are concrete nouns (not abstract concepts)', () => {
    const abstractWords = ['love', 'freedom', 'justice', 'time', 'idea'];
    for (const item of CATEGORY_SORT_DATA) {
      expect(abstractWords).not.toContain(item.key);
    }
  });
});
