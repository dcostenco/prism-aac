/**
 * Every visible word -> picture link (the top 2,000 words each language's bar shows). A link stays only
 * when the word's most common everyday use is what the picture shows. Romanian "noroc" is "hi / cheers" far more often than
 * "good luck", so it showed a misleading picture: links like it were removed in every language. Each word below
 * showed a picture before the review.
 */
import { describe, expect, it } from 'vitest';
import { loadPictureWords } from '@/constants/pictureWords';
import { builtInPhraseSymbolUrl, builtInVocabularySymbol } from '@/lib/builtInSymbols';

type Lang = Parameters<typeof builtInVocabularySymbol>[1];
const url = (word: string, lang: Lang) => builtInVocabularySymbol(word, lang)?.url ?? null;

describe('words whose everyday use is not the picture stay words', () => {
  it.each([
    // a greeting or a fixed phrase, not the picture's meaning
    ['ro', 'noroc'], ['ro', 'datorită'], ['nl', 'graag'], ['nl', 'gaat'], ['pl', 'zaraz'], ['es', 'por'],
    ['id', 'terima'], ['id', 'selamat'], ['id', 'minggu'], ['tl', 'magandang'],
    // Hebrew מזל is "luck" mostly inside מזל טוב (congratulations), the same trap as "noroc"; אחי is "bro"
    ['he', 'מזל'], ['he', 'אחי'], ['he', 'בא'], ['he', 'כלים'], ['he', 'פה'],
    // Arabic السلام is the greeting, أبو a name part (أبو أحمد), مرات "times" (it showed "bitter"), عليك "you must"
    ['ar', 'السلام'], ['ar', 'أبو'], ['ar', 'مرات'], ['ar', 'عليك'],
    // a function word or a second, more common meaning
    ['ro', 'mai'], ['ro', 'limbă'], ['de', 'sein'], ['fr', 'été'],
    ['pt', 'novo'], ['pt', 'embora'], ['es', 'siento'], ['it', 'salute'], ['pl', 'aparatu'],
    ['bg', 'син'], ['sw', 'ninapenda'], ['sw', 'nasikia'], ['sw', 'kwangu'], ['tl', 'ko'], ['tl', 'puwede'],
    // a person, number or gender the picture does not show
    ['es', 'unos'], ['ru', 'ее'], ['pl', 'ludzie'], ['tr', 'üzgünüm'], ['bg', 'жадна'], ['id', 'ngantuk'], ['tl', 'inaantok'], ['ar', 'الخوف'],
    // a negated verb under the picture of the action ("I don't want" under Want)
    ['tr', 'istemiyorum'], ['tr', 'durmuyor'],
    // a tile text that is a different word in this language (the Dutch Thirsty tile said the German "Durst")
    ['ru', 'довольно'], ['uk', 'день'], ['nl', 'durst'], ['sw', 'tako'], ['sw', 'pamoja'],
    // Hindi helper verbs finish another verb (बैठ गया = sat down), not "go"; के is "of"; चलो is "let's go"
    ['hi', 'गया'], ['hi', 'के'], ['hi', 'चलो'],
    // Bengali কি marks a yes/no question, হবে is "will be"; the tile texts কাল (yesterday or tomorrow), স্বাগতম (the greeting
    // "welcome", on the You're welcome tile) and দাদা (elder brother, on the Grandpa tile) say something else
    ['bn', 'কি'], ['bn', 'হবে'], ['bn', 'কাল'], ['bn', 'স্বাগতম'], ['bn', 'দাদা'],
    // Amharic አለ is "there is", not "is"; መጥቶኛል is "I am sleepy", not "come"; ብሎኛል finishes ደስ ብሎኛል (I am glad), not "say";
    // ተዘጋጅተሃል is "you are ready" under an "I am ready" picture; the Yay tile's እፎይ is "phew"; ወይን is mostly "wine"
    ['am', 'አለ'], ['am', 'መጥቶኛል'], ['am', 'ብሎኛል'], ['am', 'ተዘጋጅተሃል'], ['am', 'እፎይ'], ['am', 'ወይን'],
    // Vietnamese syllables that mostly live inside a compound: nhẫn is kiên nhẫn (patience) more than "ring", cáo is báo cáo
    // (report) more than "fox"; anh is "older brother" or "he" as often as "you"; the On tile's bật is "switch on"
    ['vi', 'xin'], ['vi', 'nhẫn'], ['vi', 'cáo'], ['vi', 'anh'], ['vi', 'bật'],
    // Korean 수 / 것 are bound nouns (할 수 있어요 = can do; 그것 = that); the Sour tile's 새요 is "it leaks", the Catch tile's
    // 받아요 is mostly "receive", the Playground tile's 운동장 is a sports field
    ['ko', '수'], ['ko', '것'], ['ko', '새요'], ['ko', '받아요'], ['ko', '운동장'],
    // Japanese に is a particle; すぎる is "too much" under the Too ("also") picture; 元気 is mostly お元気ですか (how are you);
    // the Hip tile's お尻 is "buttocks"; 自分 reads "myself" under the Yourself picture
    ['ja', 'に'], ['ja', 'すぎる'], ['ja', '元気'], ['ja', 'お尻'], ['ja', '自分'],
    // Chinese 之 / 于 are literary function characters; the Roll tile's bare 滚 reads "get lost!", the Spit tile's 吐 reads
    // "vomit", the Hip tile's 臀部 is "buttocks"
    ['zh-Hans', '之'], ['zh-Hans', '于'], ['zh-Hans', '滚'], ['zh-Hans', '吐'], ['zh-Hans', '臀部'],
    // Traditional tiles are converted from Simplified character by character: the Dry tile's 幹 is a Taiwan profanity
    // (dry is 乾), 土豆 is "peanut" in Taiwan, 困 is "trapped"; in Hong Kong 走 is "leave" and 喊 is "cry"
    ['zh-Hant', '之'], ['zh-Hant', '幹'], ['zh-Hant', '土豆'], ['zh-Hant', '困'],
    ['zh-HK', '之'], ['zh-HK', '幹'], ['zh-HK', '走'], ['zh-HK', '喊'],
  ] as [Lang, string][])('%s "%s" shows no picture', async (lang, word) => {
    await loadPictureWords(lang);
    expect(url(word, lang)).toBeNull();
  });
});

describe('explicit basic AAC meanings preserve useful pictures', () => {
  it.each([
    ['he', 'לך', 'cw-go-core.png'], ['de', 'gleich', 'cw-same-core.png'],
    ['fr', 'il', 'cw-he.png'], ['it', 'perché', 'qu-why.png'],
    ['uk', 'що', 'qu-what.png'], ['bg', 'да', 'cw-yes-core.png'],
    ['ru', 'день', 'w-day.png'],
  ] as [Lang, string, string][])('%s "%s" uses the reviewed primary meaning', async (lang, word, file) => {
    expect(url(word, lang)).toBe(`/prism-aac/symbols/${file}`);
    await loadPictureWords(lang);
    expect(url(word, lang)).toBe(`/prism-aac/symbols/${file}`);
  });
});

describe('a corrected tile text whose everyday use is not the tile\'s picture stays a word', () => {
  it.each([
    // Amharic ሶፍት is tissue paper, ተኩል "and a half" in general, አጋዘን an antelope, ውይ any "oh!", ይቻላል "it is possible"
    ['am', 'ሶፍት'], ['am', 'ተኩል'], ['am', 'አጋዘን'], ['am', 'ውይ'], ['am', 'ይቻላል'],
    // Bengali জেলি is fruit jelly; Hindi हताश is despondent, not angry
    ['bn', 'জেলি'], ['hi', 'हताश'],
    // Japanese あし is the leg as often as the foot; こし is the waist or lower back
    ['ja', 'あし'], ['ja', 'こし'],
    // Swahili chachu is yeast, fumbo a riddle, inakwaruza "it scratches", teleza any slipping, vuli the short rainy season
    ['sw', 'chachu'], ['sw', 'fumbo'], ['sw', 'inakwaruza'], ['sw', 'teleza'], ['sw', 'vuli'],
    // Tagalog humuni is a bird's chirping; Hong Kong 批 is a batch or "approve"; Taiwan 搔癢 is scratching an itch
    ['tl', 'humuni'], ['zh-HK', '批'], ['zh-Hant', '搔癢'],
  ] as [Lang, string][])('%s "%s" stays a word', async (lang, word) => {
    expect(builtInVocabularySymbol(word, lang)).toEqual({ url: null }); // before its table loads
    await loadPictureWords(lang);
    expect(builtInVocabularySymbol(word, lang)).toEqual({ url: null });
  });
});

describe('a corrected tile text is that tile\'s own word', () => {
  // The Dutch Thirsty tile said the German "Durst"; it now says "Dorst" (ik heb dorst = I am thirsty), so the bar shows the
  // tile's own picture for it, and the German spelling shows nothing.
  it('nl "dorst" shows the Thirsty picture and "durst" shows none', async () => {
    await loadPictureWords('nl');
    expect(url('dorst', 'nl')).toBe('/prism-aac/symbols/fe-thirsty.png');
    expect(url('durst', 'nl')).toBeNull();
  });
});

describe('a built-in tile never borrows the picture of another meaning', () => {
  // The texture tile "Hard" (next to Soft: Duro, Hart, Твёрдый) reused the "difficult" weightlifter of the core tile "Hard"
  // (Difícil, Schwer, Трудно). It shows its word until a drawing of something hard to the touch exists.
  it('the texture "Hard" tile shows no weightlifter; the core "Hard" tile keeps it', () => {
    expect(builtInPhraseSymbolUrl('dw-hard')).toBeNull();
    expect(builtInPhraseSymbolUrl('cw-hard')).toBe('/prism-aac/symbols/cw-hard.png');
  });

  it.each([['vi', 'cứng'], ['es', 'duro'], ['ru', 'твёрдый'], ['de', 'harte'], ['it', 'dura'], ['es', 'duros'], ['pl', 'ciężko']] as [Lang, string][])(
    '%s "%s" (hard to the touch, or both meanings) shows no weightlifter', async (lang, word) => {
      await loadPictureWords(lang);
      expect(url(word, lang)).not.toBe('/prism-aac/symbols/cw-hard.png');
    },
  );

  // The English word "hard" now has two meanings in the app and stays a word, so links judged "difficult" name the
  // weightlifter by its id instead of through the English word.
  it.each([['ru', 'сложно'], ['de', 'schwierig'], ['es', 'difíciles'], ['zh-Hans', '困难'], ['ko', '어렵'], ['pl', 'trudno']] as [Lang, string][])(
    '%s "%s" (difficult) still shows the weightlifter', async (lang, word) => {
      await loadPictureWords(lang);
      expect(url(word, lang)).toBe('/prism-aac/symbols/cw-hard.png');
    },
  );
});

describe('a word with two Unicode spellings', () => {
  // Hindi ज़ is one code point (U+095B) or ज + nukta (U+091C U+093C), and the lookup matches spellings exactly. The Cheese
  // tile's spelling stays a word (everyday चीज़ is "thing"); canonical spellings share this safeguard.
  it('Hindi canonical spellings retain the same no-cheese safeguard', async () => {
    await loadPictureWords('hi');
    expect(url('\u091A\u0940\u091C\u093C', 'hi')).toBeNull();
    expect(url('\u091A\u0940\u095B', 'hi')).toBeNull();
  });
});
