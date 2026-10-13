/**
 * Picture words for other languages: a predicted word in that language, as the
 * prediction bar shows it ("perros", "puedes"), shares the picture of the
 * English word with the same meaning. The tables ship with the app and load
 * with the language's predictions; nothing is sent anywhere to find a picture.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupportedLanguage } from '@/engine/i18n';
import { DEFAULT_PHRASES } from '@/constants/phrases';
import { getPhraseText } from '@/constants/phraseTranslations';
import spatialGrammarPictures from '@/constants/generated/spatialGrammarPictures.json';
import basicVocabularyPictures from '@/constants/generated/basicVocabularyPictures.json';

interface Table { words: Record<string, string>; choose: Record<string, string>; keep?: string[] }
const TABLES = Object.fromEntries(
  Object.entries(import.meta.glob('../constants/generated/pictureWords/*.json', { eager: true, import: 'default' }))
    .map(([path, t]) => [path.split('/').pop()!.replace('.json', ''), t as Table]),
) as Record<string, Table>;
const LANGS = Object.keys(TABLES).sort() as SupportedLanguage[];

async function fresh() {
  vi.resetModules();
  const words = await import('@/constants/pictureWords');
  const symbols = await import('@/lib/builtInSymbols');
  return { ...words, ...symbols };
}

beforeEach(() => { vi.resetModules(); });

// Every language with prediction data (English has its own pictures) ships a table; a language added later without
// one would keep showing plain words in the bar, so adding it here must be a decision, not an oversight.
it('ships a table for every language with prediction data', async () => {
  const { SUPPORTED_SEED_LANGS } = await import('@/constants/predictionSeeds');
  expect([...LANGS].sort()).toEqual(SUPPORTED_SEED_LANGS.filter((l) => l !== 'en').sort());
});

// A table file without its line in importTable never loads: the language would silently keep showing words.
it.each(LANGS)('loads the %s table it ships', async (lang) => {
  const { loadPictureWords, pictureWordSource } = await fresh();
  const [word, en] = Object.entries(TABLES[lang].words)[0];
  expect(pictureWordSource(word, lang)).toBeNull();
  await loadPictureWords(lang);
  expect(pictureWordSource(word, lang)).toBe(en);
});

describe.each(LANGS)('%s picture word table', (lang) => {
  const { words: table, choose } = TABLES[lang];

  it('points every word at an English word or a phrase that has a picture', async () => {
    const { builtInVocabularySymbol } = await fresh();
    // Languages without a lemmatizer ship hand links only (vi, bn, am: about 150-250 words).
    expect(Object.keys(table).length).toBeGreaterThan(100);
    const files = (await import('@/constants/generated/phraseSymbols.json')).default.phrases as Record<string, string>;
    const hasPicture = (en: string) => (en.startsWith('@') ? Boolean(files[en.slice(1)]) : Boolean(builtInVocabularySymbol(en, 'en')?.url));
    expect(Object.entries(table).filter(([, en]) => !hasPicture(en))).toEqual([]);
  });

  it('an overlapping word link never introduces a picture outside its built-in candidates', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    // except a day-of-the-month tile whose spelling is also a number or "first" (lib/builtInSymbols.ts lets the table decide)
    const dates = new Set(DEFAULT_PHRASES.filter((p) => p.id.startsWith('tdate-')).map((p) => getPhraseText(p.id, lang, p.text).toLowerCase()));
    const overlaps = Object.keys(table).filter((w) => !dates.has(w) && builtInVocabularySymbol(w, lang) !== null);
    if (!overlaps.length) return;
    await loadPictureWords(lang);
    const files = (await import('@/constants/generated/phraseSymbols.json')).default.phrases as Record<string, string>;
    const fold = (word: string) => lang === 'tr'
      ? word.toLocaleLowerCase('tr').replace(/i\u0307/g, 'i') : word.toLowerCase();
    for (const word of overlaps) {
      const primary = (spatialGrammarPictures.aliases as Record<string, Record<string, string>>)[lang]?.[word];
      const candidates = DEFAULT_PHRASES.filter(p => p.id === primary || fold(getPhraseText(p.id, lang, p.text)).normalize('NFC') === fold(word).normalize('NFC'))
        .flatMap(p => files[p.id] ? [`/prism-aac/symbols/${files[p.id]}`] : []);
      const actual = builtInVocabularySymbol(word, lang)?.url;
      const reviewedPrimary = (basicVocabularyPictures.languages as Record<string, Record<string, { file: string; means: string }>>)[lang]?.[word];
      if (reviewedPrimary) {
        expect(reviewedPrimary.means.length).toBeGreaterThan(10);
        candidates.push(`/prism-aac/symbols/${reviewedPrimary.file}`);
      }
      if (actual) expect(candidates, word).toContain(actual);
    }
  });

  it('lists lowercase single words only', () => {
    expect(Object.keys(table).filter((w) => w !== w.toLowerCase() || /\s/.test(w))).toEqual([]);
  });

  it('only ever chooses one of the word\'s own built-in phrases', async () => {
    const { DEFAULT_PHRASES } = await import('@/constants/phrases');
    const { getPhraseText } = await import('@/constants/phraseTranslations');
    const { englishSourceFor } = await import('@/constants/reverseTranslation');
    const norm = (t: string) => t.trim().toLowerCase().replace(/^[\p{P}\s]+|[\p{P}\s]+$/gu, '');
    // The same two ways builtInVocabularySymbol finds a word's phrases: the phrase's own translation, or the
    // core list's English source ("нравится" -> like).
    const own = (word: string, id: string) => {
      const p = DEFAULT_PHRASES.find((x) => x.id === id);
      return Boolean(p) && (norm(getPhraseText(p!.id, lang, p!.text)) === word || norm(englishSourceFor(word, lang) ?? '') === norm(p!.text));
    };
    expect(Object.entries(choose).filter(([word, id]) => !own(word, id))).toEqual([]);
  });

  it('never both chooses a picture for a word and keeps it a word', () => {
    // A kept word shows no picture, so a "choose" entry for it would contradict the table (the exporter drops it).
    const keep = new Set(TABLES[lang].keep ?? []);
    expect(Object.keys(TABLES[lang].choose).filter((w) => keep.has(w))).toEqual([]);
  });

  it('shows each chosen picture once the table is loaded', async () => {
    const { builtInVocabularySymbol, loadPictureWords, reviewedVocabularyPictureChoices } = await fresh();
    await loadPictureWords(lang);
    const files = (await import('@/constants/generated/phraseSymbols.json')).default.phrases as Record<string, string>;
    expect(Object.keys(choose).length).toBeGreaterThan(10);
    for (const [word, id] of Object.entries(choose)) {
      const alternatives = (basicVocabularyPictures.alternatives as Record<string, Record<string, { files: string[] }>>)[lang]?.[word];
      if (alternatives) {
        // An explicitly reviewed homograph retains the older choice as one
        // candidate, rather than forcing it over the newly reviewed senses.
        expect(alternatives.files, word).toContain(files[id]);
        expect(builtInVocabularySymbol(word, lang)?.url, word).toBeNull();
        expect(reviewedVocabularyPictureChoices(word, lang), word).toEqual(alternatives.files);
      } else {
        expect(builtInVocabularySymbol(word, lang)?.url, word).toBe(`/prism-aac/symbols/${files[id]}`);
      }
    }
  });
});

describe('Spanish', () => {
  const { words: table } = TABLES.es;

  it('shows the article pictures, and never "if" for accentless si', () => {
    // Grammar words show their main meaning, never a misleading one:
    // accentless "si" is usually "sí" (yes), so it does not show "if".
    for (const w of ['el', 'la', 'los', 'las']) expect(table[w], w).toBe('the');
    for (const w of ['un', 'una']) expect(table[w], w).toBe('a');
    // the plurals mean "some / a few" (unos días, unas cosas), not the singular "a"
    for (const w of ['unos', 'unas']) expect(table[w], w).toBeUndefined();
    expect(table.si).toBeUndefined();
  });

  it('keeps a misleading choice as a word', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('su', 'es')).toEqual({ url: null }); // his / her: a gender mismatch either way
    await loadPictureWords('es');
    expect(builtInVocabularySymbol('su', 'es')).toEqual({ url: null });
  });

  // Links past rank 6,000: the words that passed review ship, the misleading ones do not.
  it('links reviewed words beyond the first 6,000 and every form of querer to Want', () => {
    expect(table.medicamento).toBe('medicine');
    expect(table.vecinas).toBe('neighbor');
    expect(table.cansados).toBe('tired');
    for (const w of ['quiere', 'quieren', 'querer', 'quería', 'quisiera']) expect(table[w], w).toBe('want');
  });

  it('drops the links the second review removed (offensive, a different verb, a different noun)', () => {
    // zorra is an insult, valer is "to be worth", grano is a grain or a pimple, sep is mostly "yep".
    for (const w of ['zorra', 'valer', 'valga', 'grano', 'sep', 'donar', 'pechos', 'mona', 'venda']) expect(table[w], w).toBeUndefined();
    // Clitic and reflexive pronouns are not the pictured pronouns.
    for (const w of ['le', 'les', 'se', 'ellas', 'consigo']) expect(table[w], w).toBeUndefined();
  });

  // Links past rank 12,000.
  it('links reviewed words beyond the first 12,000', () => {
    expect(table.cocinando).toBe('cook');
    expect(table.almorzar).toBe('lunch');
    expect(table.agarran).toBe('take');
  });

  it('ships each word with the picture it was checked against (a rebuild once moved avergüenzo from Ashamed to Embarrassed)', () => {
    expect(table['avergüenzo']).toBe('ashamed');
    expect(table.huevo).toBe('egg');
  });

  // Links from English glosses (pilot): only habla and través shipped.
  it('keeps the two gloss links that shipped, and drops the English-homograph traps', () => {
    expect(table.habla).toBe('speak');
    expect(table['través']).toBe('through');
    // plaza is a town square, never the geometric square the English word Square shows.
    expect(table.plaza).toBeUndefined();
  });

  it('drops the links the third review removed (a verb that is not the pictured word, a slang interjection, a plural-only noun)', () => {
    // circula is "circulates", not "round"; pasaste is "you passed", not "happened"; pegan is "they hit" as often as "glue";
    // tías are aunts (the picture is an uncle); hala is the Spanish interjection (not "pull"); lente is a lens (glasses
    // are lentes); donado and dones are "donated" and "gifts", not a donut.
    for (const w of ['circula', 'pasaste', 'pegan', 'pronta', 'tías', 'hala', 'nadas', 'donado', 'dones', 'lente']) {
      expect(table[w], w).toBeUndefined();
    }
  });
});

describe('Russian', () => {
  const { words: table, choose } = TABLES.ru;

  it('shows the English picture for Russian forms once the table is loaded', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('собаки', 'ru')).toBeNull();
    await loadPictureWords('ru');
    expect(builtInVocabularySymbol('собаки', 'ru')).toEqual(builtInVocabularySymbol('dog', 'en'));
    expect(builtInVocabularySymbol('можешь', 'ru')).toEqual(builtInVocabularySymbol('can', 'en'));
  });

  it('keeps a word typed as a dictionary word on its own picture, not on the lemma it folds into', () => {
    // simplemma folds больше ("more") into большой ("big"); the typed word decides.
    expect(table['больше']).toBe('more');
    expect(table['большая']).toBe('big');
  });

  it('shows the enjoy sense of "like" for нравится, and keeps a two-meaning word as a word', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    // the Russian phrase is the enjoy sense; the English source "Like" (enjoy / similar) no longer adds the other sense
    expect(builtInVocabularySymbol('нравится', 'ru')).toEqual({ url: '/prism-aac/symbols/cw-like.png' });
    await loadPictureWords('ru');
    expect(choose['нравится']).toBe('cw-like');
    expect(builtInVocabularySymbol('нравится', 'ru')).toEqual({ url: '/prism-aac/symbols/cw-like.png' });
    expect(table['нравятся']).toBe('@cw-like');
    // есть is both "eat" and "there is": no choice, it stays a word.
    expect(choose['есть']).toBeUndefined();
    expect(builtInVocabularySymbol('есть', 'ru')).toEqual({ url: null });
  });

  it('drops the removed links (давай is "let\'s", not "give")', () => {
    expect(table['давай']).toBeUndefined();
    expect(table['стоит']).toBeUndefined();
  });

  // Links past rank 6,000: the words that passed review ship, the misleading ones do not.
  it('links reviewed words beyond the first 6,000, and the months by id where the English word is a verb', () => {
    expect(table['ветром']).toBe('wind');
    expect(table['таблетки']).toBe('pill');
    expect(table['месяце']).toBe('month');
    // March / May have no picture under their English word; the hand links point at the picture ids.
    expect(table['марта']).toBe('@tm-mar');
    expect(table['мая']).toBe('@tm-may');
  });

  it('drops the links the second review removed (tape, dust, fever, a different plural or verb)', () => {
    // лента is a ribbon or a news feed (tape is скотч); пыль is the substance, not the person dusting; жара is a heat
    // wave (fever is жар); здоров is "healthy"; сны are "dreams"; слез is "tears"; языки are "languages"; носил is
    // "wore"; кредиты are loans, not the bank card; выбирает is "chooses", not the question "which?"; очко is a point.
    for (const word of ['лента', 'ленты', 'пыль', 'жара', 'здоров', 'сны', 'слез', 'языки', 'носил', 'кредиты', 'выбирает', 'очко']) {
      expect(table[word], word).toBeUndefined();
    }
  });

  // Links past rank 12,000.
  it('links reviewed words beyond the first 12,000', () => {
    expect(table['овцы']).toBe('sheep');
    expect(table['кита']).toBe('whale');
    expect(table['мультфильмы']).toBe('cartoon');
  });

  it('drops the links the third review removed (healthy is not "awesome", a bag is not a shoulder bag, a saw is not "drank")', () => {
    // здоровы / здоровых are "healthy", not "awesome"; острые is "sharp" as often as "spicy"; пакета is a plastic bag or a
    // package, not the shoulder bag; пила is a saw; выбери is "choose!", not the question "which"; роллы are sushi rolls,
    // not a wrap; портфель is a briefcase, not a backpack; налоговый is "tax", not "wow".
    for (const word of ['здоровы', 'здоровых', 'острые', 'пакета', 'пила', 'выбери', 'роллы', 'портфель', 'налоговый']) {
      expect(table[word], word).toBeUndefined();
    }
  });
});

describe('Portuguese', () => {
  const { words: table, choose } = TABLES.pt;

  it('shows the English picture for Portuguese forms once the table is loaded', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('cachorros', 'pt')).toBeNull();
    await loadPictureWords('pt');
    expect(builtInVocabularySymbol('cachorros', 'pt')).toEqual(builtInVocabularySymbol('dog', 'en'));
    expect(builtInVocabularySymbol('podes', 'pt')).toEqual(builtInVocabularySymbol('can', 'en'));
  });

  it('settles falar on Talk, and keeps "ainda" ambiguous and shows the primary spatial meaning of "em"', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('falar', 'pt')).toEqual({ url: null });
    await loadPictureWords('pt');
    expect(choose.falar).toBe('cw-talk');
    expect(builtInVocabularySymbol('falar', 'pt')).toEqual({ url: '/prism-aac/symbols/cw-talk.png' });
    expect(builtInVocabularySymbol('em', 'pt')).toEqual({url:'/prism-aac/symbols/cw-in.png'});
    for (const word of ['ainda']) {
      expect(choose[word], word).toBeUndefined();
      expect(builtInVocabularySymbol(word, 'pt'), word).toEqual({ url: null });
    }
  });

  it('drops the removed links (a clitic is not "the", elas is not "he", no bombs)', () => {
    for (const word of ['la', 'los', 'elas', 'irmãs', 'bomba', 'chega']) expect(table[word], word).toBeUndefined();
  });

  // Links past rank 6,000: the words that passed review ship, the misleading ones do not.
  it('links reviewed words beyond the first 6,000', () => {
    expect(table.medicamento).toBe('medicine');
    expect(table.porcos).toBe('pig');
    expect(table.ombros).toBe('shoulder');
  });

  it('drops the links the second review removed (killing, a body-part slang, a word of another country)', () => {
    // rapariga is "girl" in Portugal but derogatory in Brazil, and the picture shows a man; peitos reads as crude
    // ("breasts"); camisinha is "condom" in Brazil, not a shirt; matam, matei and matado are forms of killing, not the
    // noun "forest"; usá is a truncated clitic fragment, not a word.
    for (const word of ['matam', 'matei', 'matado', 'rapariga', 'peitos', 'camisinha', 'sexto', 'usá', 'culpar']) {
      expect(table[word], word).toBeUndefined();
    }
  });

  // Links past rank 12,000.
  it('links reviewed words beyond the first 12,000', () => {
    expect(table.banheiros).toBe('bathroom');
    expect(table.baralho).toBe('card game');
    expect(table.pente).toBe('comb');
  });

  it('drops the links the third review removed (killing, an insult, a wrong lexeme, a word that is not a word)', () => {
    // matem is "kill", the forest is "mata"; burra and burros are mostly the insult "stupid"; mangá is manga, the comic;
    // pata is a paw as often as a duck, porca a metal nut; fá is a musical note; ee is not a word.
    for (const word of ['matem', 'burra', 'burros', 'mangá', 'salvei', 'pata', 'porca', 'fá', 'ee', 'estada']) {
      expect(table[word], word).toBeUndefined();
    }
  });
});

describe('French', () => {
  const { words: table, choose } = TABLES.fr;

  it('shows the English picture for French forms once the table is loaded', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('chiens', 'fr')).toBeNull();
    await loadPictureWords('fr');
    expect(builtInVocabularySymbol('chiens', 'fr')).toEqual(builtInVocabularySymbol('dog', 'en'));
    expect(builtInVocabularySymbol('pouvons', 'fr')).toEqual(builtInVocabularySymbol('can', 'en'));
  });

  it('settles parler on Talk and content on Happy, and keeps "personne" (nobody / person) as a word', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('parler', 'fr')).toEqual({ url: null });
    await loadPictureWords('fr');
    expect(builtInVocabularySymbol('parler', 'fr')).toEqual({ url: '/prism-aac/symbols/cw-talk.png' });
    expect(choose.content).toBe('fe-happy');
    expect(choose.personne).toBeUndefined();
    expect(builtInVocabularySymbol('personne', 'fr')).toEqual({ url: null });
  });

  it('drops the removed links (possessives of another person, the church, "several")', () => {
    for (const word of ['église', 'observer', 'plusieurs']) expect(table[word], word).toBeUndefined();
    // mes / ma / vos were first keyed to "his" (another person's possessive) and removed; re-keyed to "my" and "your" they passed a second review
    expect(table.mes).toBe('my');
    expect(table.ma).toBe('my');
    expect(table.vos).toBe('your');
  });

  // Links past rank 6,000: the words that passed review ship, the misleading ones do not.
  it('links reviewed words beyond the first 6,000', () => {
    expect(table.pluies).toBe('rain');
    expect(table.dangereuses).toBe('dangerous');
    expect(table.achetez).toBe('buy');
  });

  it('drops the links the second review removed (fused grammar words, a possessive, "would like")', () => {
    // lorsqu'un is "when a", jusqu'a is "until", tienne is "yours", aimerait is "would like (to)", ie is not French.
    for (const word of ["lorsqu'un", "lorsqu'une", "puisqu'elle", "jusqu'a", 'tienne', 'aimerait', 'ie', 'sure', 'isle']) {
      expect(table[word], word).toBeUndefined();
    }
  });

  // Links past rank 12,000.
  it('links reviewed words beyond the first 12,000', () => {
    expect(table.chantent).toBe('sing');
    expect(table.vestes).toBe('jacket');
    expect(table.salades).toBe('salad');
  });

  it('drops the links the third review removed (fused grammar words, singulars of plural-only words, a runner-up)', () => {
    // lunette is a telescope and polices are fonts (the pictures are glasses and the police force: lunettes, police);
    // dauphine is a runner-up (the dolphin is dauphin); neuves is "new" (feminine), never the number nine.
    for (const word of ["lorsqu'elles", "jusqu'où", "j'te", "d'la", 'neuves', 'dauphine', 'lunette', 'polices', 'avoirs', 'attentions']) {
      expect(table[word], word).toBeUndefined();
    }
  });
});

describe('German', () => {
  const { words: table, choose } = TABLES.de;

  it('shows the English picture for German forms, capitalized nouns included, once the table is loaded', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('Hunde', 'de')).toBeNull();
    await loadPictureWords('de');
    // The prediction bar shows German nouns capitalized; the table is keyed lowercase.
    expect(builtInVocabularySymbol('Hunde', 'de')).toEqual(builtInVocabularySymbol('dog', 'en'));
    expect(builtInVocabularySymbol('hunde', 'de')).toEqual(builtInVocabularySymbol('dog', 'en'));
    expect(builtInVocabularySymbol('kannst', 'de')).toEqual(builtInVocabularySymbol('can', 'en'));
  });

  it('settles Nudeln on pasta, uses an unmarked person for sie, and preserves weiß ambiguity', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    await loadPictureWords('de');
    expect(choose.nudeln).toBe('fd-pasta');
    expect(builtInVocabularySymbol('sie', 'de')?.url).toBe('/prism-aac/symbols/w-g-third-person.png');
    for (const word of ['weiß']) {
      expect(choose[word], word).toBeUndefined();
      expect(builtInVocabularySymbol(word, 'de'), word).toEqual({ url: null });
    }
  });

  it('drops the removed links (sein is not "his", Krieg, Wein, religion, Chance is not dice)', () => {
    for (const word of ['sein', 'krieg', 'wein', 'weihnachten', 'chance']) expect(table[word], word).toBeUndefined();
  });

  // Links past rank 6,000: the words that passed review ship, the misleading ones do not.
  it('links reviewed words beyond the first 6,000', () => {
    expect(table.boote).toBe('boat');
    expect(table.stühle).toBe('chair');
    expect(table.wochenenden).toBe('weekend');
  });

  it('drops the links the second review removed (a different noun or verb, a prayer, a pigeon, a nerve)', () => {
    // tauben is "pigeons", not "numb"; beten ("to pray"), buchen ("to book") and gebet ("prayer") are not forms of
    // Bett, Buch or geben; keins is "none", not "nobody"; nerv is "nerve", not annoyed; parken is "to park a car", not
    // the green space; chip is a microchip; schale is a bowl or a peel, not a scarf; tüte is a bag, also slang for a joint.
    for (const word of ['tauben', 'beten', 'gebet', 'buchen', 'gebucht', 'keins', 'nerv', 'parken', 'chip', 'schale', 'tüte', 'gestrichen']) {
      expect(table[word], word).toBeUndefined();
    }
  });

  // Links past rank 12,000.
  it('links reviewed words beyond the first 12,000', () => {
    expect(table.moscheen).toBe('mosque');
    expect(table['frösche']).toBe('frog');
    expect(table['bahnhöfe']).toBe('train station');
  });

  it('drops the links the third review removed (a wrong lexeme, English words, a dove, a tray)', () => {
    // taube is a pigeon or deaf, wagte is "dared" (the car is Wagen), betet is "prays" (the bed is Bett), tablett is a
    // serving tray (the pill is Tablette), heiße is "my name is" as often as "hot"; market, rocket and legend are English.
    for (const word of ['taube', 'wagte', 'betet', 'tablett', 'linkes', 'heiße', 'market', 'rocket', 'legend', 'obs']) {
      expect(table[word], word).toBeUndefined();
    }
  });
});

describe('Ukrainian', () => {
  const { words: table, choose } = TABLES.uk;

  it('shows the English picture for Ukrainian forms once the table is loaded', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('собаки', 'uk')).toBeNull();
    await loadPictureWords('uk');
    expect(builtInVocabularySymbol('собаки', 'uk')).toEqual(builtInVocabularySymbol('dog', 'en'));
    expect(builtInVocabularySymbol('можеш', 'uk')).toEqual(builtInVocabularySymbol('can', 'en'));
  });

  it('settles говорити on Talk, and keeps "до" (to / until / before) and "сам" as words', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('говорити', 'uk')).toEqual({ url: null });
    await loadPictureWords('uk');
    expect(builtInVocabularySymbol('говорити', 'uk')).toEqual({ url: '/prism-aac/symbols/cw-talk.png' });
    for (const word of ['до', 'сам']) {
      expect(choose[word], word).toBeUndefined();
      expect(builtInVocabularySymbol(word, 'uk'), word).toEqual({ url: null });
    }
  });

  it('drops the removed links (мати is also "to have", може is also "maybe", religion)', () => {
    for (const word of ['мати', 'брати', 'може', 'купи', 'церкви']) expect(table[word], word).toBeUndefined();
  });

  // Links past rank 6,000: the words that passed review ship, the misleading ones do not.
  it('links reviewed words beyond the first 6,000', () => {
    expect(table['річка']).toBe('river');
    expect(table['вовка']).toBe('wolf');
    expect(table['щасливі']).toBe('happy');
  });

  it('drops the links the second review removed (choosing is not the question "which", a letter-only match)', () => {
    // обрав, вибрали and вибрав mean "chose", not the question "which"; біле is "white" and only looks like біль
    // ("pain"); мать reads as Russian "mother", not the Ukrainian "to have"; кара is "punishment", not curry;
    // п'ята is "fifth" as often as "heel"; стрічку is a ribbon, not sticky tape.
    for (const word of ['обрав', 'обрано', 'вибрали', 'вибрав', 'біле', 'мать', 'кара', "п'ята", 'стрічку', 'святі']) {
      expect(table[word], word).toBeUndefined();
    }
  });

  // Links past rank 12,000.
  it('links reviewed words beyond the first 12,000', () => {
    expect(table['ящик']).toBe('box');
    expect(table['мавпи']).toBe('monkey');
    expect(table['річкою']).toBe('river');
  });

  it('drops the links the third review removed (open is not discover, a clip is not roller skates, a stripe is not a smoothie)', () => {
    // відкрий is "open!", not "discover"; ролик is a video clip; стрічкою is a ribbon (tape is клейка стрічка); смуга is a
    // stripe (a smoothie is смузі); кроку is a footstep (the picture is a stair); піп is a priest; браун is the name Brown.
    for (const word of ['відкрий', 'ролик', 'стрічкою', 'смуга', 'кроку', 'ступені', 'піп', 'браун', 'твердо', 'кари']) {
      expect(table[word], word).toBeUndefined();
    }
  });
});

describe('Italian', () => {
  const { words: table, choose } = TABLES.it;

  it('shows the English picture for Italian forms once the table is loaded', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('cani', 'it')).toBeNull();
    await loadPictureWords('it');
    expect(builtInVocabularySymbol('cani', 'it')).toEqual(builtInVocabularySymbol('dog', 'en'));
    expect(builtInVocabularySymbol('aiutarmi', 'it')).toEqual(builtInVocabularySymbol('help', 'en'));
  });

  it('settles posso on Can, and keeps "suo" (his / her) as a word', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('posso', 'it')).toEqual({ url: '/prism-aac/symbols/cw-can.png' });
    await loadPictureWords('it');
    expect(builtInVocabularySymbol('posso', 'it')).toEqual({ url: '/prism-aac/symbols/cw-can.png' });
    expect(choose.suo).toBeUndefined();
    expect(builtInVocabularySymbol('suo', 'it')).toEqual({ url: null });
  });

  it('drops the removed links (sei is also "six", data is a date, piace is not "nice to meet you")', () => {
    for (const word of ['sei', 'data', 'piace', 'sedermi', 'passo', 'panna']) expect(table[word], word).toBeUndefined();
  });

  // Links from English glosses.
  it('links the reviewed gloss words and drops slang and English-homograph traps', () => {
    expect(table.concerto).toBe('concert');
    expect(table.bellissimo).toBe('beautiful');
    expect(table.festeggiare).toBe('celebrate');
    // frà and raga are youth slang, sore is a regional abbreviation; sentire is "feel" as often as "hear"; piano is a
    // floor, an instrument or "slowly"; volta is an occurrence, never clock time.
    for (const word of ['frà', 'raga', 'sore', 'sentire', 'piano', 'volta']) expect(table[word], word).toBeUndefined();
  });
});

describe('Romanian', () => {
  const { words: table, choose } = TABLES.ro;

  it('shows the English picture for Romanian forms once the table is loaded', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('câini', 'ro')).toBeNull();
    await loadPictureWords('ro');
    expect(builtInVocabularySymbol('câini', 'ro')).toEqual(builtInVocabularySymbol('dog', 'en'));
    expect(builtInVocabularySymbol('poți', 'ro')).toEqual(builtInVocabularySymbol('can', 'en'));
  });

  it('settles pot on Can, and keeps "încă" (still / yet), "tare" and "pui" as words', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('pot', 'ro')).toEqual({ url: '/prism-aac/symbols/cw-can.png' });
    await loadPictureWords('ro');
    expect(builtInVocabularySymbol('pot', 'ro')).toEqual({ url: '/prism-aac/symbols/cw-can.png' });
    for (const word of ['încă', 'tare', 'pui']) {
      expect(choose[word], word).toBeUndefined();
      expect(builtInVocabularySymbol(word, 'ro'), word).toEqual({ url: null });
    }
  });

  it('drops the removed links (dat is "given", not "yes"; marea, lei, vin; religion; putin)', () => {
    for (const word of ['dat', 'marea', 'lei', 'vin', 'biserica', 'prea', 'putin']) expect(table[word], word).toBeUndefined();
  });

  // Links past rank 6,000: the words that passed review ship, the misleading ones do not.
  it('links reviewed words beyond the first 6,000', () => {
    expect(table.pericolul).toBe('danger');
    expect(table['ușii']).toBe('door');
    expect(table.uscată).toBe('dry');
  });

  it('drops the links the second review removed (a rude interjection, hatred, a different verb or noun)', () => {
    // băi is a rude colloquial interjection; ură is "hatred" (the cheer is "ura"); soții reads as "the husbands" at least
    // as often as "wives"; fură is "steals", not a form of "to be"; voiam is "I wanted", not "you"; sarea is "the salt";
    // pin is "pine tree"; scade is a verb ("decreases"), not the adjective "low".
    for (const word of ['băi', 'ură', 'soții', 'fură', 'voiam', 'sarea', 'pin', 'scade', 'darul', 'mări']) {
      expect(table[word], word).toBeUndefined();
    }
  });

  // Links past rank 12,000.
  it('links reviewed words beyond the first 12,000', () => {
    expect(table.albinele).toBe('bee');
    expect(table.alune).toBe('nuts');
    expect(table.patului).toBe('bed');
  });

  it('drops the links the third review removed (masses, not tables; a gift, not "but"; ugly, not "yay"; a fragment)', () => {
    // mase are "masses" (tables are mese); daruri are gifts (the picture is the conjunction "but"); urat is "ugly"
    // typed without its accent; paie is straw or hay; corona is the virus; table is the game backgammon; îs is a
    // colloquial copula; nervoasă is irritated, not anxious.
    for (const word of ['mase', 'daruri', 'urat', 'paie', 'corona', 'table', 'îs', 'nervoasă', 'balon', 'pastă']) {
      expect(table[word], word).toBeUndefined();
    }
  });
});

describe('Arabic', () => {
  const { words: table } = TABLES.ar;

  it('shows the English picture for Arabic forms once the table is loaded', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('الموز', 'ar')).toBeNull();
    await loadPictureWords('ar');
    expect(builtInVocabularySymbol('الموز', 'ar')).toEqual(builtInVocabularySymbol('banana', 'en'));
  });

  // Links past rank 6,000: the words that passed review ship, the misleading ones do not.
  it('links reviewed words beyond the first 6,000', () => {
    expect(table['هاتفي']).toBe('phone');
    expect(table['الهدايا']).toBe('gift');
    expect(table['كتابي']).toBe('book');
  });

  it('drops the links the second review removed (drugs, dust, a bag, a rare homograph of the word)', () => {
    // مخدرات is "drugs" and showed a numb face; الغبار is the substance, not the person dusting; كيس is a sack, not the
    // shoulder bag; خيارات are "options", not cucumbers; يطالب is "demands", not the noun "student"; الصبح is "the
    // morning", not "become"; وعي is "awareness", not a disgusted face; اذن is usually "so / then", not the ear.
    for (const word of ['مخدرات', 'الغبار', 'كيس', 'خيارات', 'يطالب', 'الصبح', 'وعي', 'اذن', 'لقطة', 'طقوس']) {
      expect(table[word], word).toBeUndefined();
    }
  });

  // Links past rank 12,000.
  it('links reviewed words beyond the first 12,000', () => {
    expect(table['القبعة']).toBe('hat');
    expect(table['أطعمة']).toBe('food');
    expect(table['الحمامات']).toBe('bathroom');
  });

  it('drops the links the third review removed (a sexual word shown as "mosque", "drugs" as numb, a pocket, rituals)', () => {
    // الجماع is "sexual intercourse" (the mosque is الجامع); بالمخدرات is "with narcotics"; الجيب is a pocket, not
    // "bring"; الطقوس are rituals (weather is طقس); الكيس and أكياس are plastic bags, not the shoulder bag; يطالبون
    // is "they demand", not "student"; وعلماء is "and scientists", not "world".
    for (const word of ['الجماع', 'بالمخدرات', 'الجيب', 'الطقوس', 'الكيس', 'أكياس', 'يطالبون', 'وعلماء', 'نفوس']) {
      expect(table[word], word).toBeUndefined();
    }
  });

  // Links from English glosses.
  it('links the reviewed gloss words and drops plurals shown as one figure, "that" particles and homographs', () => {
    expect(table['القرار']).toBe('decision');
    expect(table['المؤتمر']).toBe('conference');
    expect(table['الدولي']).toBe('international');
    // الرجال is "men" (one figure shown); الرجل unvocalized is also "the leg" (second review); أن is the conjunction
    // "that", not a pointing figure; مرة is an occurrence, not clock time; باسم is a common first name; مني can also read
    // as a sexual word; مجال is a domain, not a grassy field.
    for (const word of ['الرجال', 'الرجل', 'أن', 'مرة', 'باسم', 'مني', 'مجال']) expect(table[word], word).toBeUndefined();
  });
});

describe('Polish', () => {
  const { words: table, choose } = TABLES.pl;

  it('shows the English picture for Polish forms once the table is loaded', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('psy', 'pl')).toBeNull();
    await loadPictureWords('pl');
    expect(builtInVocabularySymbol('psy', 'pl')).toEqual(builtInVocabularySymbol('dog', 'en'));
    expect(builtInVocabularySymbol('możesz', 'pl')).toEqual(builtInVocabularySymbol('can', 'en'));
  });

  it('settles mogę on Can, and keeps "jeszcze" (still / yet) as a word', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('mogę', 'pl')).toEqual({ url: '/prism-aac/symbols/cw-can.png' });
    await loadPictureWords('pl');
    expect(builtInVocabularySymbol('mogę', 'pl')).toEqual({ url: '/prism-aac/symbols/cw-can.png' });
    expect(choose.jeszcze).toBeUndefined();
    expect(builtInVocabularySymbol('jeszcze', 'pl')).toEqual({ url: null });
  });

  it('drops the removed links (raz, ma and mamy are not "mom", krok is not stairs)', () => {
    for (const word of ['raz', 'ma', 'mamy', 'krok', 'mecz']) expect(table[word], word).toBeUndefined();
  });
});

describe('Dutch', () => {
  const { words: table, choose } = TABLES.nl;

  it('shows the English picture for Dutch forms once the table is loaded', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('honden', 'nl')).toBeNull();
    await loadPictureWords('nl');
    expect(builtInVocabularySymbol('honden', 'nl')).toEqual(builtInVocabularySymbol('dog', 'en'));
    expect(builtInVocabularySymbol('kunnen', 'nl')).toEqual(builtInVocabularySymbol('can', 'en'));
  });

  it('settles "van" on Of (its main sense), and keeps "kip" (live chicken / food) as a word', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    await loadPictureWords('nl');
    expect(choose.van).toBe('cw-of');
    expect(builtInVocabularySymbol('van', 'nl')).toEqual({ url: '/prism-aac/symbols/cw-of.png' });
    expect(choose.kip).toBeUndefined();
    expect(builtInVocabularySymbol('kip', 'nl')).toEqual({ url: null });
  });

  it('drops the removed links (ben / bent are "am / are", uw is "your" formal, markt, kaart)', () => {
    for (const word of ['ben', 'bent', 'uw', 'markt', 'kaart', 'stap', 'pinda']) expect(table[word], word).toBeUndefined();
  });
});

describe('Bulgarian', () => {
  const { words: table, choose } = TABLES.bg;

  it('shows the English picture for Bulgarian forms once the table is loaded', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('велосипед', 'bg')).toBeNull();
    await loadPictureWords('bg');
    expect(builtInVocabularySymbol('велосипед', 'bg')).toEqual(builtInVocabularySymbol('bike', 'en'));
    expect(builtInVocabularySymbol('можем', 'bg')).toEqual(builtInVocabularySymbol('can', 'en'));
  });

  it('settles добре on Okay, and keeps "до" (beside / by / until) as a word', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('добре', 'bg')).toEqual({ url: null });
    await loadPictureWords('bg');
    expect(choose['добре']).toBe('qt-okay');
    expect(builtInVocabularySymbol('добре', 'bg')).toEqual({ url: '/prism-aac/symbols/qt-okay.png' });
    expect(choose['до']).toBeUndefined();
    expect(builtInVocabularySymbol('до', 'bg')).toEqual({ url: null });
  });

  it('drops the removed links (врата is also "neck", мечта is a dream, the church holiday, the button)', () => {
    for (const word of ['го', 'врата', 'мечта', 'коледа', 'карта', 'болит', 'копче', 'твърде']) expect(table[word], word).toBeUndefined();
  });
});

describe('Turkish', () => {
  const { words: table, choose } = TABLES.tr;

  it('shows the English picture for Turkish forms once the table is loaded', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('gidiyorum', 'tr')).toBeNull();
    await loadPictureWords('tr');
    expect(builtInVocabularySymbol('gidiyorum', 'tr')).toEqual(builtInVocabularySymbol('go', 'en'));
    expect(builtInVocabularySymbol('yoruldum', 'tr')).toEqual(builtInVocabularySymbol('tired', 'en'));
  });

  it('settles çok on Very, uses primary AAC open for aç, and preserves acı ambiguity', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('çok', 'tr')).toEqual({ url: null });
    await loadPictureWords('tr');
    expect(choose.çok).toBe('cw-very');
    expect(builtInVocabularySymbol('çok', 'tr')).toEqual({ url: '/prism-aac/symbols/cw-very.png' });
    expect(builtInVocabularySymbol('aç', 'tr')?.url).toBe('/prism-aac/symbols/cw-open.png');
    for (const word of ['acı']) {
      expect(choose[word], word).toBeUndefined();
      expect(builtInVocabularySymbol(word, 'tr'), word).toEqual({ url: null });
    }
  });

  it('drops the removed links (severim is not the neutral "love", ay is moon and month, oyuncak)', () => {
    for (const word of ['severim', 'sevmem', 'ay', 'oyuncak', 'kola', 'yüzme']) expect(table[word], word).toBeUndefined();
  });
});

describe('Indonesian', () => {
  const { words: table, choose } = TABLES.id;

  it('shows the English picture for Indonesian forms once the table is loaded', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('makanan', 'id')).toBeNull();
    await loadPictureWords('id');
    expect(builtInVocabularySymbol('makanan', 'id')).toEqual(builtInVocabularySymbol('food', 'en'));
    expect(builtInVocabularySymbol('mampu', 'id')).toEqual(builtInVocabularySymbol('can', 'en'));
  });

  it('settles ayam on the hen, and keeps "cium" (kiss / smell) and "sendiri" (myself / themselves) as words', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    await loadPictureWords('id');
    expect(choose.ayam).toBe('an-chicken');
    expect(builtInVocabularySymbol('ayam', 'id')).toEqual({ url: '/prism-aac/symbols/an-chicken.png' });
    for (const word of ['cium', 'sendiri']) {
      expect(choose[word], word).toBeUndefined();
      expect(builtInVocabularySymbol(word, 'id'), word).toEqual({ url: null });
    }
  });

  it('drops the removed links (hati is the liver or heart, lalu is "then", garis is not a ruler, terlalu is "too much", boleh is "may")', () => {
    for (const word of ['hati', 'hatiku', 'lalu', 'garis', 'berubah', 'mainan', 'terlalu', 'boleh']) expect(table[word], word).toBeUndefined();
  });
});

describe('Swahili', () => {
  const { words: table, choose } = TABLES.sw;

  it('shows the English picture for Swahili forms once the table is loaded', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('unataka', 'sw')).toBeNull();
    await loadPictureWords('sw');
    expect(builtInVocabularySymbol('unataka', 'sw')).toEqual(builtInVocabularySymbol('want', 'en'));
    expect(builtInVocabularySymbol('tunaweza', 'sw')).toEqual(builtInVocabularySymbol('can', 'en'));
  });

  it('settles kuku on the hen, and keeps "kama" (if / like) and "ndege" (bird / airplane) as words', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    await loadPictureWords('sw');
    expect(choose.kuku).toBe('an-chicken');
    expect(builtInVocabularySymbol('kuku', 'sw')).toEqual({ url: '/prism-aac/symbols/an-chicken.png' });
    for (const word of ['kama', 'ndege']) {
      expect(choose[word], word).toBeUndefined();
      expect(builtInVocabularySymbol(word, 'sw'), word).toEqual({ url: null });
    }
  });

  it('drops the removed links (a negated verb is not its positive picture, ilikuwa is "was", mto and majini are homographs)', () => {
    for (const word of ['siwezi', 'sipendi', 'ilikuwa', 'nawe', 'upi', 'mto', 'majini', 'makofi']) expect(table[word], word).toBeUndefined();
  });
});

describe('Tagalog', () => {
  const { words: table, choose } = TABLES.tl;

  it('shows the English picture for Tagalog forms, English loanwords included, once the table is loaded', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('kayang', 'tl')).toBeNull();
    await loadPictureWords('tl');
    expect(builtInVocabularySymbol('kayang', 'tl')).toEqual(builtInVocabularySymbol('can', 'en'));
    expect(builtInVocabularySymbol('homework', 'tl')).toEqual(builtInVocabularySymbol('homework', 'en'));
    expect(builtInVocabularySymbol('aking', 'tl')).toEqual(builtInVocabularySymbol('my', 'en'));
  });

  it('settles gusto on Want, and keeps "huli" (last / late / caught) as a word', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('gusto', 'tl')).toEqual({ url: '/prism-aac/symbols/cw-want.png' });
    await loadPictureWords('tl');
    expect(choose.gusto).toBe('cw-want');
    expect(builtInVocabularySymbol('gusto', 'tl')).toEqual({ url: '/prism-aac/symbols/cw-want.png' });
    expect(choose.huli).toBeUndefined();
    expect(builtInVocabularySymbol('huli', 'tl')).toEqual({ url: null });
  });

  it('drops the removed links (mahal is expensive and dear, kita is a pronoun pair, araw, bakasyon, cream)', () => {
    // puwede is "may" (permission), not the strength picture; ko is mostly the doer (gusto ko = I want), not "my"
    for (const word of ['mahal', 'kita', 'araw', 'bakasyon', 'pangarap', 'palabas', 'cream', 'puwede', 'ko']) expect(table[word], word).toBeUndefined();
  });
});

describe('Hebrew', () => {
  const { words: table, choose } = TABLES.he;

  it('shows the English picture for Hebrew forms once the table is loaded', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('כלבים', 'he')).toBeNull();
    await loadPictureWords('he');
    expect(builtInVocabularySymbol('כלבים', 'he')).toEqual(builtInVocabularySymbol('dog', 'en'));
    expect(builtInVocabularySymbol('הזמן', 'he')).toEqual(builtInVocabularySymbol('time', 'en'));
  });

  it('settles ספר on the book, and keeps "חום" (fever / heat / brown) and "כדור" (pill / ball) as words', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    await loadPictureWords('he');
    expect(choose['ספר']).toBe('sw-book');
    expect(builtInVocabularySymbol('ספר', 'he')).toEqual({ url: '/prism-aac/symbols/sw-book.png' });
    for (const word of ['חום', 'כדור']) {
      expect(choose[word], word).toBeUndefined();
      expect(builtInVocabularySymbol(word, 'he'), word).toEqual({ url: null });
    }
  });

  it('drops the removed links (forms of "to be" are not "hi", לחץ is pressure, שפה is also lips, חופשה, אנשים)', () => {
    for (const word of ['להיות', 'היה', 'לחץ', 'שפה', 'חופשה', 'אנשים']) expect(table[word], word).toBeUndefined();
  });
});

describe('Arabic', () => {
  const { words: table, choose } = TABLES.ar;

  it('shows the English picture for Arabic forms once the table is loaded', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('يمكننا', 'ar')).toBeNull();
    await loadPictureWords('ar');
    expect(builtInVocabularySymbol('يمكننا', 'ar')).toEqual(builtInVocabularySymbol('can', 'en'));
    expect(builtInVocabularySymbol('أخي', 'ar')).toEqual(builtInVocabularySymbol('brother', 'en'));
  });

  it('settles دجاج on food chicken, distinguishes from and who, and preserves ظهر ambiguity', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    await loadPictureWords('ar');
    expect(choose['دجاج']).toBe('fd-chicken');
    expect(builtInVocabularySymbol('دجاج', 'ar')).toEqual({ url: '/prism-aac/symbols/fd-chicken.png' });
    expect(builtInVocabularySymbol('من', 'ar')?.url).toBe('/prism-aac/symbols/cw-from.png');
    expect(builtInVocabularySymbol('من؟', 'ar')?.url).toBe('/prism-aac/symbols/qu-who.png');
    for (const word of ['ظهر']) {
      expect(choose[word], word).toBeUndefined();
      expect(builtInVocabularySymbol(word, 'ar'), word).toEqual({ url: null });
    }
  });

  it('drops the removed links (السلطة is also "the authority", البيض is also "white", names, houses of worship, slang)', () => {
    for (const word of ['السلطة', 'البيض', 'سرطان', 'المسجد', 'الكنيسة', 'علي', 'هى', 'هاي']) expect(table[word], word).toBeUndefined();
  });
});

describe('Hindi', () => {
  const { words: table, choose } = TABLES.hi;

  it('shows the English picture for Hindi forms, loanwords in Devanagari included, once the table is loaded', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('कुत्ते', 'hi')).toBeNull();
    await loadPictureWords('hi');
    expect(builtInVocabularySymbol('कुत्ते', 'hi')).toEqual(builtInVocabularySymbol('dog', 'en'));
    expect(builtInVocabularySymbol('सकते', 'hi')).toEqual(builtInVocabularySymbol('can', 'en'));
    expect(builtInVocabularySymbol('मूवी', 'hi')).toEqual(builtInVocabularySymbol('movie', 'en'));
  });

  it('settles नमस्ते on Hello, and keeps "जल्दी" (soon / early / hurry) and "छुट्टी" (day off / holiday) as words', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    await loadPictureWords('hi');
    expect(choose['नमस्ते']).toBe('qt-hello');
    expect(builtInVocabularySymbol('नमस्ते', 'hi')).toEqual({ url: '/prism-aac/symbols/qt-hello.png' });
    for (const word of ['जल्दी', 'छुट्टी']) {
      expect(choose[word], word).toBeUndefined();
      expect(builtInVocabularySymbol(word, 'hi'), word).toEqual({ url: null });
    }
  });

  it('drops the removed links (हूँ and रहा are auxiliaries, मिल is not "meet", बच्चे, चीज is "thing", बाइक is a motorcycle)', () => {
    for (const word of ['हूँ', 'रहा', 'मिल', 'बच्चे', 'मौका', 'चीज', 'बाइक', 'स्नेक']) expect(table[word], word).toBeUndefined();
  });
});

describe('Vietnamese', () => {
  const { words: table, choose } = TABLES.vi;

  it('shows the English picture for hand-linked Vietnamese words once the table is loaded', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('bước', 'vi')).toBeNull();
    await loadPictureWords('vi');
    expect(builtInVocabularySymbol('bước', 'vi')).toEqual(builtInVocabularySymbol('step', 'en'));
    expect(builtInVocabularySymbol('chiên', 'vi')).toEqual(builtInVocabularySymbol('fry', 'en'));
  });

  it('settles gà on the hen and không on Not, and keeps "kéo" (pull / scissors) as a word', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    await loadPictureWords('vi');
    expect(choose['gà']).toBe('an-chicken');
    expect(builtInVocabularySymbol('gà', 'vi')).toEqual({ url: '/prism-aac/symbols/an-chicken.png' });
    expect(choose['không']).toBe('cw-not');
    expect(choose['kéo']).toBeUndefined();
    expect(builtInVocabularySymbol('kéo', 'vi')).toEqual({ url: null });
  });

  it('drops the removed hand links (sâu is both "deep" and "worm"; máy and xe are mostly parts of compounds)', () => {
    for (const word of ['sâu', 'máy', 'xe']) expect(table[word], word).toBeUndefined();
  });
});

describe('Bengali', () => {
  const { words: table, choose } = TABLES.bn;

  it('shows the English picture for hand-linked Bengali words once the table is loaded', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('ঘুম', 'bn')).toBeNull();
    await loadPictureWords('bn');
    expect(builtInVocabularySymbol('ঘুম', 'bn')).toEqual(builtInVocabularySymbol('sleep', 'en'));
    expect(builtInVocabularySymbol('গেম', 'bn')).toEqual(builtInVocabularySymbol('game', 'en'));
  });

  it('settles আমার on My, keeps দুপুর as Afternoon, and pictures বাচ্চা with a child', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    await loadPictureWords('bn');
    expect(choose['আমার']).toBe('cw-my');
    expect(choose['দুপুর']).toBeUndefined();
    expect(builtInVocabularySymbol('দুপুর', 'bn')?.url).toBe('/prism-aac/symbols/ti-afternoon.png');
    expect(choose['বাচ্চা']).toBeUndefined();
    expect(builtInVocabularySymbol('বাচ্চা', 'bn')?.url).toBe('/prism-aac/symbols/pp-kid.png');
  });

  it('drops the removed hand link (দোল is mainly the Holi festival; swing is দোলনা)', () => {
    expect(table['দোল']).toBeUndefined();
  });

  // The first review of the Bengali table words. The seed spells ড় and য় as single letters, a review may type them as
  // letter plus nukta: compare in one spelling.
  const nfc = (w: string) => w.normalize('NFC');
  const byNfc = Object.fromEntries(Object.entries(table).map(([w, en]) => [nfc(w), en]));

  it('links the reviewed table words', () => {
    expect(byNfc[nfc('বিড়াল')]).toBe('cat');
    expect(byNfc[nfc('কোথায়')]).toBe('where');
    expect(byNfc[nfc('বড়')]).toBe('big');
  });

  it('drops the removed table links (a postposition, an auxiliary verb, "quickly" shown as early)', () => {
    // দিয়ে is "by / with", হয় is the verb "is / becomes", তাড়াতাড়ি is "quickly", not "early".
    for (const word of ['দিয়ে', 'হয়', 'তাড়াতাড়ি']) expect(byNfc[nfc(word)], word).toBeUndefined();
  });
});

describe('Amharic', () => {
  const { words: table, choose } = TABLES.am;

  it('shows the English picture for hand-linked Amharic words once the table is loaded', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('ሃይ', 'am')).toBeNull();
    await loadPictureWords('am');
    expect(builtInVocabularySymbol('ሃይ', 'am')).toEqual(builtInVocabularySymbol('hi', 'en'));
    expect(builtInVocabularySymbol('መሄድ', 'am')).toEqual(builtInVocabularySymbol('go', 'en'));
  });

  it('settles ዶሮ on the hen, and keeps "ክፍል" (room / class / part) as a word', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    await loadPictureWords('am');
    expect(choose['ዶሮ']).toBe('an-chicken');
    expect(builtInVocabularySymbol('ዶሮ', 'am')).toEqual({ url: '/prism-aac/symbols/an-chicken.png' });
    expect(choose['ክፍል']).toBeUndefined();
    expect(builtInVocabularySymbol('ክፍል', 'am')).toEqual({ url: null });
  });

  it('drops the removed hand links (መሳል is draw, cough and sharpen; ጥበብ is also wisdom)', () => {
    for (const word of ['መሳል', 'ጥበብ']) expect(table[word], word).toBeUndefined();
  });
});

describe('Korean', () => {
  const { words: table, choose } = TABLES.ko;

  it('shows the English picture for hand-linked Korean words once the table is loaded', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('공부', 'ko')).toBeNull();
    await loadPictureWords('ko');
    expect(builtInVocabularySymbol('공부', 'ko')).toEqual(builtInVocabularySymbol('study', 'en'));
    expect(builtInVocabularySymbol('나라', 'ko')).toEqual(builtInVocabularySymbol('country', 'en'));
  });

  it('settles 병원 on Hospital and 부끄러워요 on Shy, and keeps "눈" (eye / snow) and "배" (pear / stomach / boat) as words', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    await loadPictureWords('ko');
    expect(choose['병원']).toBe('pl-hospital');
    expect(choose['부끄러워요']).toBe('fe-shy');
    for (const word of ['눈', '배']) {
      expect(choose[word], word).toBeUndefined();
      expect(builtInVocabularySymbol(word, 'ko'), word).toEqual({ url: null });
    }
  });

  it('drops the removed hand link (날 is also a contraction of "me" and "blade")', () => {
    expect(table['날']).toBeUndefined();
  });

  // Hand links: the everyday words that passed review ship, the misleading ones do not.
  it('links the second round of everyday words', () => {
    expect(table['강']).toBe('river');
    expect(table['위험']).toBe('dangerous');
  });

  it('drops the removed links (mayor, credit card, a couple shown for the husband)', () => {
    // 시장 is also the mayor; 카드 is mostly a credit card, not a greeting card; the picture for 남편 shows a couple;
    // 별 is mostly 별로 (not really), 불 also the negative prefix and "light".
    for (const word of ['시장', '카드', '남편', '별', '불']) expect(table[word], word).toBeUndefined();
  });

  // Links from English glosses.
  it('links the reviewed gloss words and drops month/moon, work/one/day and quotative endings', () => {
    expect(table['건물']).toBe('building');
    expect(table['결정']).toBe('decision');
    expect(table['그러나']).toBe('but');
    // 달 is a month as often as the moon, 일 is work, the number one or a day, 다고 is a quotative ending, 단계 a step
    // (never a theatre stage), 여러분 addresses a whole audience, 가지 is "kind" (or an eggplant).
    for (const word of ['달', '일', '다고', '단계', '여러분', '가지']) expect(table[word], word).toBeUndefined();
  });
});

describe('Japanese', () => {
  const { words: table, choose } = TABLES.ja;

  it('shows the English picture for hand-linked Japanese words once the table is loaded', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('お金', 'ja')).toBeNull();
    await loadPictureWords('ja');
    expect(builtInVocabularySymbol('お金', 'ja')).toEqual(builtInVocabularySymbol('money', 'en'));
    expect(builtInVocabularySymbol('一緒', 'ja')).toEqual(builtInVocabularySymbol('together', 'en'));
  });

  it('shows the weather pictures for 寒い and 暑い (the object pictures mean 冷たい and 熱い), and keeps "まだ" as a word', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    await loadPictureWords('ja');
    expect(choose['寒い']).toBe('we-cold');
    expect(choose['暑い']).toBe('we-hot');
    expect(choose['大丈夫']).toBe('qt-no-problem');
    expect(choose['まだ']).toBeUndefined();
    expect(builtInVocabularySymbol('まだ', 'ja')).toEqual({ url: null });
  });

  // Hand links: the everyday words that passed review ship, the misleading ones do not.
  it('links the second round of everyday words', () => {
    expect(table['銀行']).toBe('bank');
    expect(table['弁護士']).toBe('attorney');
    expect(table['町']).toBe('city');
    expect(table['妻']).toBe('wife');
  });

  it('drops the removed links (moon, video, manga, light, a match, cherry blossoms, a couple)', () => {
    // 月 is also the moon; 動画 is a video, not the cinema picture; 漫画 is not a plain book; 光 is light, the picture is a
    // feather; 試合 is a sports match, the picture is dice; 桜 is cherry blossom, the picture is generic flowers; the
    // picture for 夫 shows a couple.
    for (const word of ['月', '動画', '漫画', '光', '試合', '桜', '夫']) expect(table[word], word).toBeUndefined();
  });
});

describe.each(['zh-Hans', 'zh-Hant', 'zh-HK'] as const)('Chinese (%s)', (lang) => {
  const { words: table, choose } = TABLES[lang];

  it('shows the English picture for hand-linked words, in either script, once the table is loaded', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('世界', lang)).toBeNull();
    await loadPictureWords(lang);
    // The lists hold Traditional single characters and a shared Simplified word list; the table follows both.
    expect(builtInVocabularySymbol('世界', lang)).toEqual(builtInVocabularySymbol('world', 'en'));
    expect(builtInVocabularySymbol(lang === 'zh-Hant' ? '兩' : '两', lang)).toEqual(builtInVocabularySymbol('two', 'en'));
  });

  it('settles 好 on Good and primary AAC 是 on Yes, preserving 空 and 背 ambiguity', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    await loadPictureWords(lang);
    expect(choose['好']).toBe('dw-good');
    expect(builtInVocabularySymbol('是', lang)?.url).toBe('/prism-aac/symbols/cw-yes-core.png');
    for (const word of ['空', '背']) {
      expect(choose[word], word).toBeUndefined();
      expect(builtInVocabularySymbol(word, lang), word).toEqual({ url: null });
    }
  });

  // Hand links: the everyday words that passed review ship, the misleading ones do not.
  it('links the second round of everyday words, in the script of the language', () => {
    // The shared word list is Simplified in all three; Traditional single characters follow their own script.
    expect([table['天气'], table['河'], table['病']]).toEqual(['weather', 'river', 'sick']);
    expect(table[lang === 'zh-Hans' ? '树' : '樹']).toBe('tree');
  });

  it('drops the removed links (moon, a message, a drum, a couple, slang)', () => {
    // 月 is also the moon; 消息 is mostly a chat message, not the newspaper; 训练 showed a drummer; 丈夫 showed a couple;
    // 喜爱 showed romantic love; 玻璃 is the material (a drinking glass is 玻璃杯) and regional slang.
    for (const word of ['月', '消息', '训练', '丈夫', '喜爱', '玻璃']) expect(table[word], word).toBeUndefined();
  });
});

describe('Chinese (Hong Kong Cantonese words)', () => {
  it('links the Cantonese words the list spells in Cantonese (俾 give, 咩 what)', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('俾', 'zh-HK')).toBeNull();
    await loadPictureWords('zh-HK');
    expect(builtInVocabularySymbol('俾', 'zh-HK')).toEqual(builtInVocabularySymbol('give', 'en'));
    expect(builtInVocabularySymbol('咩', 'zh-HK')).toEqual(builtInVocabularySymbol('what', 'en'));
  });
});

describe('lookup', () => {
  it('shows the English picture for a Spanish form once the table is loaded', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    expect(builtInVocabularySymbol('perros', 'es')).toBeNull();
    await loadPictureWords('es');
    expect(builtInVocabularySymbol('perros', 'es')).toEqual(builtInVocabularySymbol('dog', 'en'));
    expect(builtInVocabularySymbol('puedes', 'es')).toEqual(builtInVocabularySymbol('can', 'en'));
    expect(builtInVocabularySymbol('perros', 'es')?.url).toBeTruthy();
  });

  it('follows a direct picture link for a sense whose English word has two pictures', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    await loadPictureWords('es');
    expect(TABLES.es.words.gusta).toBe('@cw-like');
    expect(builtInVocabularySymbol('gusta', 'es')).toEqual({ url: '/prism-aac/symbols/cw-like.png' });
  });

  it('keeps built-in vocabulary on its own picture', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    const before = builtInVocabularySymbol('perro', 'es');
    await loadPictureWords('es');
    expect(builtInVocabularySymbol('perro', 'es')).toEqual(before);
  });

  it('leaves a language without a table as it was', async () => {
    const { builtInVocabularySymbol, loadPictureWords } = await fresh();
    await loadPictureWords('ja');
    expect(builtInVocabularySymbol('できます', 'ja')).toBeNull();
  });
});

describe('a word that is also an object property', () => {
  // The tables are plain objects: a lookup of "constructor" (a Spanish and a Romanian word) answered with Object's own
  // constructor function, and the picture lookup threw on it ("source?.startsWith is not a function").
  it('is an ordinary word without a picture, never an inherited property', async () => {
    const { builtInVocabularySymbol, loadPictureWords, pictureWordSource, pictureChoice } = await fresh();
    const inherited = Object.getOwnPropertyNames(Object.prototype);
    for (const lang of LANGS) {
      await loadPictureWords(lang);
      for (const word of inherited) {
        expect(pictureWordSource(word, lang), `${lang} source ${word}`).toBeNull();
        expect(pictureChoice(word, lang), `${lang} choice ${word}`).toBeNull();
        expect(() => builtInVocabularySymbol(word, lang), `${lang} ${word}`).not.toThrow();
      }
    }
  });
});

describe('prediction tile', () => {
  it('switches from the word to the picture when the table arrives', async () => {
    const words = await import('@/constants/pictureWords');
    const { usePredictionPicture } = await import('@/hooks/usePredictionPicture');
    const { result } = renderHook(() => usePredictionPicture('perros', 'es', 'symbols'));
    expect(result.current.picture).toBe('text');
    await words.loadPictureWords('es');
    await waitFor(() => expect(result.current.picture).toBe('symbol'));
    expect(result.current.pictureUrl).toMatch(/\/prism-aac\/symbols\//);
  });
  // Hand links, end to end through the hook the prediction bar uses: a word and no picture until the
  // table arrives, then the picture.
  it.each([['ko', '강'], ['ja', '銀行'], ['zh-Hans', '杯'], ['zh-Hant', '樹'], ['zh-HK', '樹']] as const)(
    'switches a second-round %s word (%s) from the word to the picture when the table arrives',
    async (lang, word) => {
      const words = await import('@/constants/pictureWords');
      const { usePredictionPicture } = await import('@/hooks/usePredictionPicture');
      const { result } = renderHook(() => usePredictionPicture(word, lang, 'symbols'));
      expect(result.current.picture).toBe('text');
      await words.loadPictureWords(lang);
      await waitFor(() => expect(result.current.picture).toBe('symbol'));
      expect(result.current.pictureUrl).toMatch(/\/prism-aac\/symbols\//);
    },
  );
});

/**
 * Links from English glosses: every uncovered top-1000 word was glossed in English, linked to the English word's
 * picture when it has one, and checked word by word. The examples below are links that shipped, and
 * words it removed (English-homograph pictures, demonstratives on conjunctions, plurals shown as one figure, slang).
 */
// GLOSS-ROUND-DATA-START
const GLOSS_ROUND: [string, Record<string, string>, string[]][] = [
  ["fr", {"blanche": "white", "dollars": "dollar"}, ["bout", "compagnie", "importe", "marche"]],
  ["pt", {"faculdade": "college", "festival": "festival"}, ["humanos", "educação", "classe", "companhia"]],
  ["de", {"grossen": "big", "freuen": "happy"}, ["unternehmen", "her", "dran", "entfernt"]],
  ["ro", {"vii": "come"}, ["duce", "dus", "vedere", "realizat", "noua"]],
  ["uk", {"коштів": "money", "видно": "see"}, ["само", "слід", "влади", "влада"]],
  ["ru", {"долларов": "dollar", "сборной": "team"}, ["течение", "благодаря", "власти", "власть"]],
  ["pl", {"przećwiczymy": "practice", "wytłumaczysz": "explain"}, ["dowiedzieć", "plac", "szczęścia", "nauczyć"]],
  ["nl", {"lievelingsseizoen": "season", "lievelingsliedje": "song"}, ["te", "om", "staat", "caesarsalade"]],
  ["bg", {"разбърквам": "stir", "приложение": "app"}, ["качвам", "класна", "оправям", "шопска"]],
  ["tr", {"tamamlayabilir": "finish", "açıklayabilir": "explain"}, ["almam", "gitmem", "içmem", "yapmama"]],
  ["id", {"berhitung": "count", "merayakan": "celebrate"}, ["sekali", "cat", "sub", "cream"]],
  ["sw", {"nimechangamkia": "excited", "unanifurahisha": "happy"}, ["kifungua", "yenye", "mwenye", "maonyesho"]],
  ["tl", {"makakapagpaliwanag": "explain", "makakapagpakita": "show"}, ["po", "magpatingin", "umuwi", "gaano"]],
  ["he", {"משפחתית": "family", "בנדנדות": "swing"}, ["להכיר", "תשמרי", "לעלות", "עולים"]],
  ["hi", {"ब्रेकफास्ट": "breakfast", "समझाएंगे": "explain"}, ["पाऊंगा", "पता", "लेकर", "नाटक"]],
  ["vi", {"socola": "chocolate", "muffin": "muffin"}, ["bánh", "em", "bị", "đang"]],
  ["bn", {"হোমওয়ার্কের": "homework", "হোমওয়ার্কটা": "homework"}, ["পড়ার", "পড়াটা", "চালাতে", "নাড়া"]],
  ["am", {"ታስደስተኛለህ": "happy", "ማስታወሻዬን": "note"}, ["እመቤቴ", "መበላት", "የታሪክ", "ታሪኩ"]],
  ["ja", {"グループ": "group", "スポーツ": "sport"}, ["いっ", "うち", "たり", "やら"]],
  ["zh-Hans", {"人物": "person", "土地": "land"}, ["以", "祝", "太", "当时"]],
  ["zh-Hant", {"办公室": "office", "学校": "school"}, ["以", "祝", "太", "当时"]],
  ["zh-HK", {"办公室": "office", "学校": "school"}, ["以", "祝", "太", "当时"]],
];
// GLOSS-ROUND-DATA-END

describe.each(GLOSS_ROUND)('links from English glosses, %s', (lang, links, removed) => {
  const { words: table } = TABLES[lang];

  it('ships the reviewed links', () => {
    for (const [word, en] of Object.entries(links)) expect(table[word], word).toBe(en);
  });

  it('does not ship the removed links', () => {
    for (const word of removed) expect(table[word], word).toBeUndefined();
  });
});

/**
 * The words whose English meaning got a NEW picture in Phase 2 (blanket, swim, really, without ...) were linked
 * to it and checked. The examples are links that shipped, and words that were removed.
 */
// GLOSS-ROUND2-DATA-START
const GLOSS_ROUND2: [string, Record<string, string>, string[]][] = [
  ["fr", {"président": "president", "sortie": "exit"}, ["arrive", "enfin", "ministre", "plupart"]],
  ["pt", {"presidente": "president", "futebol": "football"}, ["ministro", "própria", "próprio", "senhor"]],
  ["de", {"fussball": "football", "insbesondere": "especially"}, ["allerdings", "echt", "eigenen", "eigentlich"]],
  ["ro", {"președintele": "president", "președinte": "president"}, ["ajunge", "ajuns", "astfel", "chiar"]],
  ["uk", {"президента": "president", "президент": "president"}, ["ж", "же", "крім", "навіть"]],
  ["ru", {"президента": "president", "президент": "president"}, ["ведь", "даже", "же", "кроме"]],
  ["ar", {"الرئيس": "president", "الخروج": "exit"}, ["أصوات", "إلا", "خاصة", "دون"]],
  ["it", {"lavastoviglie": "dishwasher", "deambulatore": "walker"}, ["signore", "coperta", "gonfia", "cronologia"]],
  ["pl", {"cheeseburgera": "cheeseburger", "wszechświecie": "universe"}, ["pana", "panie", "chodzika", "dziennik"]],
  ["nl", {"lievelingsspeelgoed": "toy", "huiswerkkalender": "calendar"}, ["echt", "liggen", "flauw", "tijdbalk"]],
  ["bg", {"микровълнова": "microwave", "възглавница": "pillow"}, ["снимам", "дори", "мотор", "мента"]],
  ["tr", {"battaniyemi": "blanket", "battaniyem": "blanket"}, ["en", "efendim", "uzanmak", "dana"]],
  ["id", {"cheeseburger": "cheeseburger", "nebulizerku": "nebulizer"}, ["pak", "ulang", "langsung", "pacu"]],
  ["sw", {"kujinyoosha": "stretch", "magurudumu": "wheel"}, ["hivi", "bwana", "bakora", "kuchoma"]],
  ["tl", {"cheeseburger": "cheeseburger", "panghimagas": "dessert"}, ["nangangatog", "walker", "timeline", "shake"]],
  ["he", {"האינהלציה": "nebulizer", "הדיאגרמה": "diagram"}, ["בקר", "לקראת", "ביומן", "ההליכון"]],
  ["hi", {"नेब्यूलाइज़र": "nebulizer", "माइक्रोवेव": "microwave"}, ["सर", "वॉकर", "छड़ी", "टाइमलाइन"]],
  ["vi", {"cappuccino": "cappuccino", "pepperoni": "pepperoni"}, ["hành", "giãn", "chăn", "lò"]],
  ["bn", {"ক্যাম্পিংয়ে": "camping", "নেবুলাইজারটা": "nebulizer"}, ["লেবু", "শেক", "ওয়াকারটা", "টাইমলাইনটা"]],
  ["am", {"ፍሎውቻርቱን": "flowchart", "ብርድልብሴን": "blanket"}, ["ዋና", "ጌታዬ", "እንኳን", "ሼክ"]],
  ["ko", {"대통령": "president", "목소리": "voice"}, ["라도", "보다", "꼭", "나왔"]],
  ["ja", {"声": "voice", "それぞれ": "each"}, ["ああ", "でる", "より", "出し"]],
  ["zh-Hans", {"总统": "president", "先生": "mister"}, ["一定", "出", "出来", "甚至"]],
  ["zh-Hant", {"总统": "president", "先生": "mister"}, ["一定", "出", "出来", "当然"]],
  ["zh-HK", {"总统": "president", "先生": "mister"}, ["一定", "出", "出来", "当然"]],
  ["es", {"presidente": "president", "fútbol": "football"}, ["embargo", "incluso", "ministro", "propia"]],
];
// GLOSS-ROUND2-DATA-END

describe.each(GLOSS_ROUND2)('links for new word pictures, %s', (lang, links, removed) => {
  const { words: table } = TABLES[lang];

  it('ships the reviewed links', () => {
    for (const [word, en] of Object.entries(links)) expect(table[word], word).toBe(en);
  });

  it('does not ship the removed links', () => {
    for (const word of removed) expect(table[word], word).toBeUndefined();
  });
});

/**
 * The words whose English meaning got a picture on the third attempt (pump, dryer, nausea, quite, somewhat) were linked
 * to it and checked. The examples are links that shipped, and words that were removed.
 */
// GLOSS-ROUND3-DATA-START
const GLOSS_ROUND3: [string, Record<string, string>, string[]][] = [
  ["de", {"ziemlich": "quite"}, ["ganz", "durchaus"]],
  ["uk", {}, ["дещо"]],
  ["ru", {}, ["вполне"]],
  ["it", {"asciugatrice": "dryer", "nausea": "nausea"}, ["pompa"]],
  ["pl", {}, ["pompy", "suszarkę"]],
  ["nl", {}, ["pomp"]],
  ["bg", {"доста": "quite"}, []],
  ["id", {"pompa": "pump", "mual": "nauseous"}, []],
  ["sw", {"kichefuchefu": "nausea", "pampu": "pump"}, ["kiasi", "kaushio"]],
  ["tl", {"nasusuka": "nauseous", "dryer": "dryer"}, ["pump"]],
  ["he", {"בחילה": "nausea"}, ["משאבת", "מייבש"]],
  ["hi", {"पंप": "pump"}, ["ड्रायर"]],
  ["vi", {"bơm": "pump"}, []],
  ["bn", {"কিছুটা": "somewhat"}, ["পাম্পের"]],
  ["am", {"የማቅለሽለሽ": "nausea", "ፓምፕ": "pump"}, ["ማድረቂያውን"]],
  ["ja", {}, ["結構", "なかなか"]],
  ["zh-Hans", {}, ["相当"]],
  ["zh-Hant", {}, ["相当"]],
  ["zh-HK", {}, ["相当"]],
  ["tr", {"pompa": "pump"}, ["pompası", "bulanıyor", "kurutma"]],
];
// GLOSS-ROUND3-DATA-END

describe.each(GLOSS_ROUND3)('links for retried pictures, %s', (lang, links, removed) => {
  const { words: table } = TABLES[lang];

  it('ships the reviewed links', () => {
    for (const [word, en] of Object.entries(links)) expect(table[word], word).toBe(en);
  });

  it('does not ship the removed links', () => {
    for (const word of removed) expect(table[word], word).toBeUndefined();
  });
});

describe('Turkish "titriyorum" (I am shivering)', () => {
  // The shaking drawing is a smiling figure with motion lines; the shivering-in-a-blanket drawing fits the word better,
  // and a review of that exact link kept it.
  it('shows the chills picture', () => {
    expect(TABLES.tr.words.titriyorum).toBe('chills');
  });
});

/**
 * The words whose English meaning got an abstract-word picture in Phase 3 (system, result, goal, economy, politics, media ...) were linked
 * to it and checked. The examples are links that shipped, and words that were removed.
 */
// GLOSS-ROUND4-DATA-START
const GLOSS_ROUND4: [string, Record<string, string>, string[]][] = [
  ["es", {"organización": "organization", "información": "information"}, ["artículo", "artículos", "política", "político"]],
  ["fr", {"développement": "development", "organisation": "organization"}, ["article", "articles", "conseil", "politique"]],
  ["pt", {"desenvolvimento": "development", "informações": "information"}, ["política", "possível", "série", "artigo"]],
  ["de", {"informationen": "information", "gesellschaft": "society"}, ["möglich", "artikel", "erreicht", "erreichen"]],
  ["ro", {"activitatea": "activity", "consiliului": "council"}, ["membrii", "membru", "politică", "posibil"]],
  ["uk", {"національного": "national", "національної": "national"}, ["рада", "раді", "статті", "діяльності"]],
  ["ru", {"государственного": "state", "государственной": "state"}, ["результате", "совета", "совет", "деятельности"]],
  ["ar", {"المعلومات": "information", "السياسية": "politics"}, ["النظام", "حالة", "الحالة", "أعضاء"]],
  ["it", {"pressione": "pressure", "presentazione": "presentation"}, ["analisi", "rivedere", "crisi", "mente"]],
  ["pl", {"wydarzeniu": "event", "prawdziwa": "real"}, ["rady", "radę", "poprowadzi", "efekty"]],
  ["nl", {"presentatie": "presentation", "activiteit": "activity"}, ["lukt", "doornemen", "inzet", "light"]],
  ["bg", {"презентация": "presentation", "настройка": "setting"}, ["успявам"]],
  ["tr", {"gelişimimle": "development", "etkinlik": "activity"}, ["olay", "durumdayım", "hale"]],
  ["id", {"analisisnya": "analysis", "presentasi": "presentation"}, ["latar"]],
  ["sw", {"kuongoza": "lead", "presha": "pressure"}, ["shughuli", "hakiki"]],
  ["tl", {"pressure": "pressure", "magtagumpay": "succeed"}, ["repasuhin", "tangi", "tagpuan"]],
  ["he", {"הפעילות": "activity", "התוצאות": "result"}, ["מצליח", "ניתוח", "דיאט", "הניתוח"]],
  ["hi", {"एक्टिविटी": "activity", "विश्लेषण": "analysis"}, ["मन", "प्रेशर"]],
  ["vi", {}, ["giải", "chì", "cảnh", "kiêng"]],
  ["bn", {"বিশ্লেষণের": "analysis", "অনুষ্ঠানটা": "event"}, ["মন", "মনের", "মনে", "প্রেসার"]],
  ["am", {"ለአእምሮዬ": "mind", "እውነተኛ": "real"}, ["ለዝግጅቱ", "ግብ", "ይመራል", "ስርዓቱ"]],
  ["ko", {"멤버": "member", "시스템": "system"}, ["마음", "상태", "제작", "개발"]],
  ["ja", {"メンバー": "member", "イベント": "event"}, ["可能", "心", "状態", "サービス"]],
  ["zh-Hans", {"成员": "member", "委员会": "committee"}, ["信息", "生产", "达", "公开"]],
  ["zh-Hant", {"成员": "member", "委员会": "committee"}, ["信息", "生产", "达", "公开"]],
  ["zh-HK", {"成员": "member", "委员会": "committee"}, ["信息", "生产", "达", "公开"]],
];
// GLOSS-ROUND4-DATA-END

describe.each(GLOSS_ROUND4)('links for abstract pictures, %s', (lang, links, removed) => {
  const { words: table } = TABLES[lang];

  it('ships the reviewed links', () => {
    for (const [word, en] of Object.entries(links)) expect(table[word], word).toBe(en);
  });

  it('does not ship the removed links', () => {
    for (const word of removed) expect(table[word], word).toBeUndefined();
  });
});

/**
 * The words whose English meaning got an everyday-word picture in Phase 2b (vegetable, towel, fan, laboratory, autumn ...), the rebuilt word-level zh / ja / ko seeds and the kana readings of Japanese words were linked
 * to it and checked. The examples are links that shipped, and words that were removed.
 */
// GLOSS-ROUND5-DATA-START
const GLOSS_ROUND5: [string, Record<string, string>, string[]][] = [
  ["es", {}, ["puerto", "red"]],
  ["fr", {"euros": "euro", "partout": "everywhere"}, ["cher"]],
  ["pt", {"bairro": "neighborhood"}, ["rede", "porto", "cabo"]],
  ["de", {"überall": "everywhere"}, ["fans"]],
  ["ro", {"aproximativ": "approximately"}, ["galerie"]],
  ["uk", {"газу": "gas", "газ": "gas"}, ["мережі"]],
  ["ru", {"евро": "euro", "примерно": "approximately"}, ["сети", "капитан"]],
  ["ar", {}, ["حي", "شبكة"]],
  ["it", {"ventilatore": "fan", "geografia": "geography"}, ["fiera", "tesoro", "fette", "fritte"]],
  ["pl", {"eksperyment": "experiment", "wyluzować": "relax"}, ["festyn", "plasterki", "wiatraka", "pędzlu"]],
  ["nl", {"knutselproject": "craft", "aardrijkskunde": "geography"}, ["pakje", "schijfjes", "kwast", "bak"]],
  ["bg", {"босилек": "basil", "червей": "worm"}, ["кърпа", "желязо"]],
  ["tr", {"vantilatör": "fan", "panayıra": "fair"}, ["dilim", "fısfısım", "dilimi", "maden"]],
  ["id", {"eksperimen": "experiment", "geografi": "geography"}, ["sepotong", "sikat", "irisan", "kuas"]],
  ["sw", {"jiografia": "geography", "shangilia": "cheer"}, ["kuokwa", "uliookwa", "kituo", "kituoni"]],
  ["tl", {"eksperimento": "experiment", "bentilador": "fan"}, ["hiwa", "skate", "skating", "brush"]],
  ["he", {"גיאוגרפיה": "geography", "נקניקיות": "sausage"}, ["פרוסות", "יצירה", "ליריד", "פסטל"]],
  ["hi", {"स्केटिंग": "skate", "स्पागेटी": "spaghetti"}, ["सफाई", "चीयर", "विंग्स", "ड्रेसिंग"]],
  ["vi", {"insulin": "insulin", "pretzel": "pretzel"}, ["khăn", "lát", "hen", "cải"]],
  ["bn", {"স্পাগেটি": "spaghetti", "ইনসুলিন": "insulin"}, ["ওঠার", "ক্র্যাকার", "উঠতে", "মেজে"]],
  ["am", {"አትክልት": "vegetable", "የጥርስ": "tooth"}, ["የተጠበሰ", "ጋዝ", "ተነሥ", "ተቦረሽ"]],
  ["ko", {"떨어뜨렸어요": "drop", "그만할래요": "stop"}, ["마음이", "나와요", "돼요", "됐어요"]],
  ["ja", {"こちょこちょ": "tickle", "ショッピング": "shopping"}, ["願い", "とかす", "まっ", "かんじ"]],
  ["zh-Hans", {"感觉不好": "sick", "两人桌": "table"}, ["心里", "过得", "还好", "一个个"]],
  ["zh-Hant", {"打電話": "phone", "兩人桌": "table"}, ["了", "一下", "心裡", "過得"]],
  ["zh-HK", {"打電話": "phone", "兩人桌": "table"}, ["了", "一下", "心裏", "着"]],
];
// GLOSS-ROUND5-DATA-END

describe.each(GLOSS_ROUND5)('links for everyday pictures and rebuilt CJK seeds, %s', (lang, links, removed) => {
  const { words: table } = TABLES[lang];

  it('ships the reviewed links', () => {
    for (const [word, en] of Object.entries(links)) expect(table[word], word).toBe(en);
  });

  it('does not ship the removed links', () => {
    for (const word of removed) expect(table[word], word).toBeUndefined();
  });
});

describe('Japanese kana spellings linked by reading', () => {
  // The app's Japanese phrases are often written in kana for a pictured word (ぼうし for a picture whose phrase is 帽子), so a
  // predicted kana word was matched to the one picture whose phrase has the same reading. Homophones that reach two meanings
  // (くらい dark/about, せき cough/seat, はく sweep/vomit, まつ wait/pine, ゆう say/evening) were removed by the review.
  it('ships the unambiguous readings', () => {
    const t = TABLES.ja.words;
    expect(t['ぼうし']).toBe('@cl-hat');
    expect(t['おんがく']).toBe('@sw-music');
    expect(t['いしゃ']).toBe('@pp-doctor');
    expect(t['ねつ']).toBe('@hb-fever');
  });

  it('does not ship the homophones', () => {
    const t = TABLES.ja.words;
    for (const w of ['くらい', 'せき', 'はく', 'まえ', 'まつ', 'ゆう', 'わるい']) expect(t[w], w).toBeUndefined();
  });
});

/**
 * Blocker repairs: links re-keyed to the right English word (German bin/sind/war = be, Romanian va/vei/vom = will, French mes/ma/nos = my/our, Arabic جداً = very), demonstratives, day-of-the-month tiles that are also numbers or "first", reflexive pronouns, and the words of the wave 8 pictures
 * to it and checked. The examples are links that shipped, and words that were removed.
 */
// GLOSS-ROUND6-DATA-START
const GLOSS_ROUND6: [string, Record<string, string>, string[]][] = [
  ["es", {"primero": "first"}, ["fuerzas", "formación", "estado", "le"]],
  ["fr", {"leurs": "their", "mes": "my"}, ["se", "or", "formation", "forces"]],
  ["pt", {"histórias": "story", "possui": "have"}, ["si", "formação", "forças", "acordo"]],
  ["de", {"nächsten": "next"}, ["seite", "selbst", "sich", "gegenüber"]],
  ["ro", {"dau": "give", "dea": "give"}, ["se", "își", "ai", "nouă"]],
  ["uk", {"матері": "mother", "березня": "@tm-mar"}, ["сама", "себе", "сил", "собою"]],
  ["ru", {"известно": "know", "первое": "first"}, ["самое", "самом", "себе", "себя"]],
  ["ar", {"جداً": "very", "بدلا": "instead"}, ["آخر", "أنه", "العامة", "بأنه"]],
  ["it", {}, ["si", "contorno"]],
  ["pl", {"dokładnie": "exactly"}, ["się", "siebie", "sobie", "sobą"]],
  ["nl", {"eerste": "first"}, []],
  ["bg", {"първи": "first"}, ["се"]],
  ["tr", {}, ["tam"]],
  ["id", {}, ["pas"]],
  ["sw", {}, ["pembeni"]],
  ["tl", {}, ["sarili"]],
  ["he", {}, ["תוספת", "ראשון"]],
  ["vi", {}, ["tự"]],
  ["bn", {}, ["নিজের", "দিকটা", "নিজেকে", "সাইডে"]],
  ["am", {}, ["ራሴን", "ራስህን", "በራስህ", "በኃይል"]],
  ["ko", {"지퍼": "zipper"}, ["자신", "자기", "쪽", "본인"]],
  ["ja", {"トレーニング": "workout", "ジッパー": "zipper"}, ["側"]],
  ["zh-Hans", {"拉链": "zipper"}, ["到底", "自己"]],
  ["zh-Hant", {"拉鏈": "zipper"}, ["到底", "自己"]],
  ["zh-HK", {"拉鏈": "zipper"}, ["到底", "自己"]],
];
// GLOSS-ROUND6-DATA-END

describe.each(GLOSS_ROUND6)('blocker repairs, %s', (lang, links, removed) => {
  const { words: table } = TABLES[lang];

  it('ships the reviewed links', () => {
    for (const [word, en] of Object.entries(links)) expect(table[word], word).toBe(en);
  });

  it('does not ship the removed links', () => {
    for (const word of removed) expect(table[word], word).toBeUndefined();
  });
});

describe('links re-keyed to the right English word (blocker repairs)', () => {
  // The matcher had keyed these to another picture ("his", "want", "grandpa"), they were removed, and nobody
  // proposed the right key: German bin / sind / war are forms of "be", Romanian vei / vom / veți are "will", French mes / ma
  // are "my", Arabic جداً is "very" (not "grandpa").
  it.each([
    ['de', { bin: 'be', bist: 'be', sind: 'be', war: 'be', sei: 'be', wäre: 'be', gewesen: 'be' }],
    ['ro', { vei: 'will', vom: 'will', veți: 'will', ar: 'would', aș: 'would', dau: 'give', noastră: 'our' }],
    ['fr', { mes: 'my', ma: 'my', nos: 'our', tes: 'your', vos: 'your', te: 'you', leurs: 'their' }],
    ['ar', { 'جداً': 'very', 'فعلا': 'really', 'بدلا': 'instead' }],
    ['uk', { 'березня': '@tm-mar', 'травня': '@tm-may', 'матері': 'mother' }],
  ] as const)('%s', (lang, links) => {
    for (const [word, en] of Object.entries(links)) expect(TABLES[lang].words[word], word).toBe(en);
  });
});
