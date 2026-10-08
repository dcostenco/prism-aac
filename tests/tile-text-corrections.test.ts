/**
 * Built-in tile texts are what a tile says aloud, so a wrong one puts the wrong word in a user's mouth. A review of every
 * visible word in 26 languages found tile texts that were another language's word (Dutch "Durst" is German), garbled
 * across two scripts (the Amharic Swing tile carried Tamil letters), a different meaning (the Swahili Taco tile said
 * "buttock"), or, for Traditional Chinese, a character-by-character conversion of the Simplified text that picked the
 * wrong character (the Dry tile said 幹, a profanity in Taiwan, for 乾).
 */
import { describe, expect, it } from 'vitest';
import { getPhraseText } from '@/constants/phraseTranslations';
import { DEFAULT_PHRASES } from '@/constants/phrases';
import type { SupportedLanguage } from '@/engine/i18n';

/** The letters each language's tiles are written in. Non-Latin languages may also carry Latin acronyms (BCBA, AAC, X光). */
const SCRIPTS: Record<string, RegExp> = {
  ru: /\p{Script=Cyrillic}/u, uk: /\p{Script=Cyrillic}/u, bg: /\p{Script=Cyrillic}/u,
  ar: /\p{Script=Arabic}/u, he: /\p{Script=Hebrew}/u, hi: /\p{Script=Devanagari}/u, bn: /\p{Script=Bengali}/u,
  am: /\p{Script=Ethiopic}/u, ko: /[\p{Script=Hangul}\p{Script=Han}]/u, ja: /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u,
  'zh-Hans': /\p{Script=Han}/u, 'zh-Hant': /\p{Script=Han}/u, 'zh-HK': /\p{Script=Han}/u,
};
const LATIN = ['es', 'fr', 'pt', 'ro', 'de', 'it', 'pl', 'nl', 'vi', 'tl', 'tr', 'id', 'sw'];

describe('every tile is written in its own language\'s script', () => {
  it.each([...Object.keys(SCRIPTS), ...LATIN])('%s', (lang) => {
    const own = SCRIPTS[lang] ?? /\p{Script=Latin}/u;
    const bad: string[] = [];
    for (const p of DEFAULT_PHRASES) {
      const text = getPhraseText(p.id, lang as SupportedLanguage, '');
      for (const ch of text) {
        // shared letters (the Japanese long-vowel mark ー, the Arabic tatweel ـ) belong to no one script
        if (!/\p{L}/u.test(ch) || own.test(ch) || /[\p{Script=Common}\p{Script=Inherited}]/u.test(ch)) continue;
        if (SCRIPTS[lang] && /\p{Script=Latin}/u.test(ch)) continue;
        bad.push(`${p.id}: ${text}`);
        break;
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('tile texts the review corrected', () => {
  // [language, tile, text]. Each replaced another language's word, a garbled or misspelled text, or a different meaning:
  // nl Durst (German), sw Tako (buttock), hi बेवकूफ (idiot), zh 滚 alone ("get lost!"), zh-Hant/zh-HK 幹 (a Taiwan profanity,
  // converted from 干; dry is 乾), ja/zh Hip お尻/臀部 (buttocks), ko 새요 ("it leaks", on Sour).
  it.each([
    ['nl', 'fe-thirsty', 'Dorst'],
    ['nl', 'cw-trade', 'Ruilen'],
    ['nl', 'hfs-sneeze', 'Niezen'],
    ['nl', 'cw-listen', 'Luister'],
    ['nl', 'fe-shy', 'Verlegen'],
    ['nl', 'fe-ashamed', 'Beschaamd'],
    ['ru', 'fe-content', 'Доволен'],
    ['ru', 'fe-thankful', 'Благодарен'],
    ['ru', 'qt-happy-hanukkah', 'С Ханукой'],
    ['uk', 'qt-happy-hanukkah', 'З Ханукою'],
    ['uk', 'cl-mittens', 'Рукавиці'],
    ['uk', 'qt-bye-bye', 'Бувай-бувай'],
    ['pl', 'cw-right-now', 'W tej chwili'],
    ['pl', 'ti-right-now', 'W tej chwili'],
    ['tr', 'fd-cereal', 'Mısır gevreği'],
    ['id', 'cw-build', 'Membangun'],
    ['id', 'cw-feel', 'Merasa'],
    ['id', 'cw-leave', 'Keluar'],
    ['tl', 'cw-do', 'Gawin'],
    ['tl', 'cw-build', 'Magtayo'],
    ['tl', 'dw-boring', 'Nakakabagot'],
    ['tl', 'sw-test', 'Pagsusulit'],
    ['tl', 'ac-clap', 'Pumalakpak'],
    ['tl', 'ac-hum', 'Humuni'],
    ['sw', 'fd-taco', 'Tortila iliyokunjwa na kujazwa'],
    ['sw', 'fm-tacos', 'Tortila zilizokunjwa na kujazwa'],
    ['sw', 'pp-family', 'Familia'],
    ['sw', 'tf-tablet', 'Tableti'],
    ['sw', 'fs-popcorn', 'Bisi'],
    ['sw', 'dw-sour', 'Chachu'],
    ['sw', 'pl-park', 'Bustani'],
    ['sw', 'hfs-sneeze', 'Kupiga chafya'],
    ['sw', 'tf-swing', 'Bembea'],
    ['sw', 'fm-snack', 'Vitafunio'],
    ['sw', 'dw-old', 'Kuukuu'],
    ['am', 'cl-sweatshirt', 'ስዌትሸርት'],
    ['am', 'tf-swing', 'ዥዋዥዌ'],
    ['am', 'qt-yay', 'እሰይ'],
    ['hi', 'fe-silly', 'मज़ाकिया'],
    ['hi', 'ps-classmate', 'सहपाठी'],
    ['hi', 'plh-bedroom', 'बेडरूम'],
    ['hi', 'pl-bedroom', 'बेडरूम'],
    ['hi', 'fe-frustrated', 'हताश'],
    ['he', 'fe-nervous', 'מתוח'],
    ['bn', 'qt-youre-welcome', 'কোনো ব্যাপার না'],
    ['bn', 'pp-grandpa', 'দাদু'],
    ['bn', 'td-tomorrow', 'আগামীকাল'],
    ['bn', 'qt-definitely', 'অবশ্যই'],
    ['bn', 'dw-hard', 'শক্ত'],
    ['bn', 'dw-salty', 'নোনতা'],
    ['ko', 'dw-sour', '셔요'],
    ['ko', 'help-thirsty', '목말라요'],
    ['ko', 'cw-let-me-try', '해볼게요'],
    ['ko', 'cw-try', '해봐요'],
    ['ko', 'dw-funny', '웃겨요'],
    ['ja', 'hb-hip', 'こし'],
    ['ja', 'tc-afternoon', 'ごご'],
    ['ja', 'cw-leave', 'でる'],
    ['ja', 'cw-any', 'なんでも'],
    ['ja', 'hb-foot', 'あし'],
    ['ja', 'hbp-foot', 'あし'],
    ['zh-Hans', 'ac-roll', '打滚'],
    ['zh-Hans', 'cw-spit', '吐口水'],
    ['zh-Hans', 'hb-hip', '髋部'],
    ['zh-Hans', 'fd-taco', '塔可'],
    ['zh-Hans', 'chip-b3', '塔可'],
    ['zh-Hans', 'ac-tag', '抓人游戏'],
    ['zh-Hans', 'sw-social-studies', '社会课'],
    ['zh-Hans', 'cw-versus', '对阵'],
    ['zh-Hans', 'fd-pasta', '意大利面'],
    ['zh-Hant', 'dw-dry', '乾'],
    ['zh-HK', 'dw-dry', '乾'],
    ['zh-Hant', 'fe-sleepy', '睏'],
    ['zh-HK', 'fe-sleepy', '睏'],
    ['zh-Hant', 'ac-tie', '綁'],
    ['zh-HK', 'ac-tie', '綁'],
    ['zh-Hant', 'dw-sticky', '黏'],
  ] as [SupportedLanguage, string, string][])('%s %s says "%s"', (lang, id, text) => {
    expect(getPhraseText(id, lang, '')).toBe(text);
  });

  it('no Traditional Chinese tile is the bare 幹', () => {
    // 幹 inside a phrase is "do" (幹得好 = well done, on qt-well-done); alone it is the profanity
    for (const lang of ['zh-Hant', 'zh-HK'] as SupportedLanguage[]) {
      expect(DEFAULT_PHRASES.filter((p) => getPhraseText(p.id, lang, '') === '幹').map((p) => p.id)).toEqual([]);
    }
  });
});

describe('Swahili tile texts a full audit corrected', () => {
  // A read of all 1,503 Swahili tiles, each fix checked by a second reviewer. Among them, tiles shown by default (the
  // core set): My said "Mimi" (I), Empty "Mwenye utupu" (can be heard as "naked"), Yay "Yupi" (which person?), Cut
  // "Mshororo" (a line of verse); and elsewhere Hippo "Kibarua" (a day labourer), Rainbow "Mvua ya mawe" (hail).
  it.each([
    ['cw-my', 'Yangu'],
    ['cw-whose', 'Ya nani'],
    ['cw-have', 'Kuwa na'],
    ['cw-catch', 'Daka'],
    ['cw-speak', 'Zungumza'],
    ['cw-tickle', 'Tekenya'],
    ['cw-open-2', 'Wazi'],
    ['cw-through', 'Kupitia'],
    ['cw-away', 'Mbali'],
    ['cw-whenever', 'Wakati wowote'],
    ['cw-wherever', 'Popote'],
    ['cw-both', 'Zote mbili'],
    ['qt-yay', 'Hoyee'],
    ['qt-i-missed-you', 'Nimekukosa'],
    ['fe-angry', 'Mwenye hasira'],
    ['fe-anxious', 'Mwenye wasiwasi'],
    ['fe-ticklish', 'Mwenye kutekenyeka'],
    ['fe-empty', 'Moyo mtupu'],
    ['qu-how-many', 'Ngapi?'],
    ['qu-what-is-for-snack', 'Vitafunio ni nini'],
    ['ac-slide', 'Teleza'],
    ['ac-march', 'Piga gwaride'],
    ['ac-floss', 'Safisha meno kwa uzi'],
    ['ac-race', 'Shindana mbio'],
    ['ac-snuggle', 'Kumbatiana'],
    ['ac-nod', 'Itikia kwa kichwa'],
    ['dw-pretty', 'Maridadi'],
    ['dw-yucky', 'Inachukiza'],
    ['dw-favorite', 'Ninachopenda zaidi'],
    ['dw-rough', 'Inakwaruza'],
    ['dw-wet', 'Imelowa'],
    ['dw-full', 'Imejaa'],
    ['pp-baby', 'Mtoto mchanga'],
    ['fd-fries', 'Chipsi'],
    ['fd-noodles', 'Tambi'],
    ['fd-peas', 'Njegere'],
    ['fv-peas', 'Njegere'],
    ['fd-pear', 'Peasi'],
    ['ff-pear', 'Peasi'],
    ['pl-basement', 'Chumba cha chini ya ardhi'],
    ['pl-mall', 'Jumba la maduka'],
    ['plo-zoo', 'Bustani ya wanyama'],
    ['sw-eraser', 'Kifutio'],
    ['hb-cut', 'Jeraha'],
    ['hb-scrape', 'Mkwaruzo'],
    ['an-hippo', 'Kiboko'],
    ['an-crab', 'Kaa'],
    ['an-starfish', 'Nyota ya bahari'],
    ['co-green', 'Kijani'],
    ['co-light-green', 'Kijani hafifu'],
    ['co-dark-green', 'Kijani kilichokolea'],
    ['co-purple', 'Zambarau'],
    ['co-brown', 'Kahawia'],
    ['co-gold', 'Dhahabu'],
    ['co-tan', 'Kahawia hafifu'],
    ['cl-socks', 'Soksi'],
    ['cl-jacket', 'Jaketi'],
    ['cl-boots', 'Buti'],
    ['cl-diaper', 'Nepi'],
    ['cl-pull-up', 'Nepi za kuvuta'],
    ['tr-skateboard', 'Ubao wa kuteleza'],
    ['tr-subway', 'Treni ya chini ya ardhi'],
    ['we-foggy', 'Ukungu'],
    ['we-rainbow', 'Upinde wa mvua'],
    ['tf-puzzle', 'Fumbo'],
    ['tf-slide', 'Mteremko wa kuteleza'],
    ['tf-stuffed-animal', 'Mnyama wa pamba'],
    ['tf-action-figure', 'Mwanasesere wa shujaa'],
    ['tc-noon', 'Saa sita mchana'],
    ['tc-midnight', 'Saa sita usiku'],
    ['ts-fall', 'Vuli'],
    ['fd-juice-2', 'Juisi'],
    ['fd-lemonade-2', 'Juisi ya limau'],
    ['pf-cousin', 'Binamu'],
    ['pf-caregiver', 'Mlezi'],
    ['hr-comb', 'Chana nywele'],
    ['ap-guinea', 'Kavia'],
    ['aw-tiger', 'Simbamarara'],
    ['ab-flamingo', 'Heroe'],
    ['ab-sparrow', 'Shomoro'],
    ['co-black', 'Nyeusi'],
    ['co-white', 'Nyeupe'],
    ['tr-boat', 'Boti'],
    ['ts-winter', 'Kipupwe'],
    ['hr-wash-hands', 'Nawa mikono'],
    ['qt-take-care', 'Jitunze'],
    ['pl-attic', 'Darini'],
    ['fd-crackers', 'Biskuti kavu'],
    ['as-starfish', 'Nyota ya bahari'],
    ['pf-baby', 'Mtoto mchanga'],
    ['plst-mall', 'Jumba la maduka'],
    ['cw-someone', 'Mtu fulani'],
    ['dw-quiet', 'Kimya'],
    ['an-bug', 'Mdudu'],
    ['co-dark-blue', 'Bluu iliyokolea'],
    ['fe-bored', 'Nimeboeka'],
    ['ti-holiday', 'Sikukuu'],
  ] as [string, string][])('sw %s says "%s"', (id, text) => {
    expect(getPhraseText(id, 'sw', '')).toBe(text);
  });
});

describe('Amharic tile texts a full audit corrected', () => {
  // A read of all 1,503 Amharic tiles, each fix checked by a second reviewer. Among the tiles shown by default: Sad said
  // አዛን (the Islamic call to prayer), "I am confused" said ተረብሻለሁ (I am disturbed), Great said ታላቅ (elder); elsewhere
  // Crab said ካንሰር (cancer), Giraffe ቀጣፊ (liar), Cup ክብሪት (matches), Beach the city Bahir Dar.
  it.each([
    ['fe-sad', 'አዝኛለሁ'],
    ['fe-hurt', 'ስሜቴ ተጎድቷል'],
    ['help-i-am-confused', 'ግራ ገብቶኛል'],
    ['help-my-battery-is-low', 'ባትሪዬ ሊያልቅ ነው'],
    ['fe-shy', 'ዓይናፋር'],
    ['fe-ticklish', 'ይኮረኩረኛል'],
    ['fe-itchy', 'ያሳክከኛል'],
    ['fe-worried', 'አሳስቦኛል'],
    ['fe-safe', 'ደህንነት ይሰማኛል'],
    ['fe-disappointed', 'ቅር ተሰኝቻለሁ'],
    ['fe-i-feel-weird', 'እንግዳ ስሜት ይሰማኛል'],
    ['cw-the', '-'],
    ['cw-at', 'ጋ'],
    ['cw-where-core', 'የት'],
    ['cw-such-as', 'ለምሳሌ'],
    ['cw-already', 'ቀድሞውኑ'],
    ['cw-almost', 'ትንሽ ቀረው'],
    ['cw-same-core', 'አንድ አይነት'],
    ['cw-open-2', 'ክፍት'],
    ['cw-up', 'ወደ ላይ'],
    ['cw-maybe', 'ምናልባት'],
    ['cw-let', 'ፍቀድ'],
    ['cw-stay', 'እዚሁ ቆይ'],
    ['cw-walk', 'ተራመድ'],
    ['cw-build', 'ገንባ'],
    ['cw-wake', 'ንቃ'],
    ['cw-jump', 'ዝለል'],
    ['cw-sing', 'ዝፈን'],
    ['cw-win', 'አሸንፍ'],
    ['cw-tell-me', 'ንገረኝ'],
    ['cw-lose', 'ጠፋብኝ'],
    ['cw-smile', 'ፈገግ በል'],
    ['cw-draw', 'ሥዕል ሳል'],
    ['cw-drop', 'ጣል'],
    ['qt-great', 'ግሩም'],
    ['qt-take-care', 'ራስህን ጠብቅ'],
    ['qt-bless-you', 'ይማርህ'],
    ['qt-oops', 'ውይ'],
    ['qt-maybe', 'ምናልባት'],
    ['qu-can-i', 'ይቻላል?'],
    ['qu-may-i-please', 'እባክህ ይቻላል?'],
    ['hb-bruise', 'ሰንበር'],
    ['hb-sharp-pain', 'የሚወጋ ሕመም'],
    ['hb-itchy-spot', 'የሚያሳክክ ቦታ'],
    ['ac-walk', 'ተራመድ'],
    ['ac-turn', 'አዙር'],
    ['ac-wave', 'እጅ አውለብልብ'],
    ['ac-point', 'ጠቁም'],
    ['ac-sing', 'ዝፈን'],
    ['ac-hop', 'ዝለል'],
    ['ac-fold', 'እጠፍ'],
    ['ac-brush-hair', 'ፀጉር አበጥር'],
    ['ac-comb', 'አበጥር'],
    ['ac-wake-up', 'ንቃ'],
    ['ac-pat', 'ቸብ ቸብ አድርግ'],
    ['ac-dust', 'አቧራ አራግፍ'],
    ['ac-roll-it', 'አንከባልለው'],
    ['ac-floss', 'በክር ጥርስ አጽዳ'],
    ['ac-draw', 'ሥዕል ሳል'],
    ['dw-slow', 'ዘገምተኛ'],
    ['dw-friendly', 'ተግባቢ'],
    ['dw-rough', 'ሸካራ'],
    ['dw-sour', 'ኮምጣጣ'],
    ['dw-spicy', 'የሚያቃጥል'],
    ['dw-loud', 'ጮክ ያለ'],
    ['dw-boring', 'አሰልቺ'],
    ['dw-helpful', 'አጋዥ'],
    ['pc-firefighter', 'እሳት አጥፊ'],
    ['fd-peas', 'አተር'],
    ['fv-peas', 'አተር'],
    ['fd-cup', 'ኩባያ'],
    ['fd-napkin', 'ሶፍት'],
    ['fd-straw', 'መምጠጫ'],
    ['fd-gum', 'ማስቲካ'],
    ['pl-pool', 'መዋኛ ገንዳ'],
    ['plo-pool', 'መዋኛ ገንዳ'],
    ['pl-dining-room', 'መመገቢያ ክፍል'],
    ['pl-beach', 'የባሕር ዳርቻ'],
    ['plo-beach', 'የባህር ዳርቻ'],
    ['pl-forest', 'ጫካ'],
    ['pl-temple', 'ቤተ መቅደስ'],
    ['pl-synagogue', 'ምኩራብ'],
    ['pl-airport', 'አውሮፕላን ማረፊያ'],
    ['sw-assembly', 'ስብሰባ'],
    ['sw-quiz', 'አጭር ፈተና'],
    ['hfs-sick', 'አሞኛል'],
    ['hfs-itch', 'አሳከከኝ'],
    ['hr-comb', 'ጸጉር ማበጠር'],
    ['ti-soon', 'በቅርቡ'],
    ['tc-quarter-past', 'ከሩብ'],
    ['tc-half-past', 'ተኩል'],
    ['tc-early', 'ቀደም ብሎ'],
    ['tc-late', 'ዘግይቷል'],
    ['an-rabbit', 'ጥንቸል'],
    ['ap-rabbit', 'ጥንቸል'],
    ['an-butterfly', 'ቢራቢሮ'],
    ['an-lizard', 'እንሽላሊት'],
    ['ap-lizard', 'እንሽላሊት'],
    ['an-giraffe', 'ቀጭኔ'],
    ['aw-giraffe', 'ቀጭኔ'],
    ['an-parrot', 'በቀቀን'],
    ['ab-parrot', 'በቀቀን'],
    ['an-whale', 'ዓሣ ነባሪ'],
    ['as-whale', 'ዓሣ ነባሪ'],
    ['an-crab', 'ሸርጣን'],
    ['as-crab', 'ሸርጣን'],
    ['af-donkey', 'አህያ'],
    ['aw-deer', 'አጋዘን'],
    ['ab-sparrow', 'ድንቢጥ'],
    ['co-dark-blue', 'ጠቆር ያለ ሰማያዊ'],
    ['co-dark-green', 'ጠቆር ያለ አረንጓዴ'],
    ['co-orange', 'ብርቱካናማ'],
    ['tr-wheelchair', 'ዊልቸር'],
    ['we-foggy', 'ጭጋጋማ'],
    ['tf-slide', 'መንሸራተቻ'],
    ['tf-coloring', 'ቀለም መቀባት'],
    ['tf-crayons', 'ከሪዮን'],
    ['cw-think', 'ይመስለኛል'],
    ['cw-everyone', 'ሁሉም ሰው'],
    ['cw-light', 'ቀላል'],
    ['dw-light', 'ቀላል'],
    ['fe-relaxed', 'ዘና ብያለሁ'],
    ['fe-loved', 'ተወድጄአለሁ'],
    ['fd-knife', 'ቢላዋ'],
    ['pl-dentist-office', 'የጥርስ ክሊኒክ'],
  ] as [string, string][])('am %s says "%s"', (id, text) => {
    expect(getPhraseText(id, 'am', '')).toBe(text);
  });
});

describe('Bengali tile texts a full audit corrected', () => {
  // A read of all 1,503 Bengali tiles in the West Bengal (Kolkata) register, each fix checked by a second reviewer.
  // Among the tiles shown by default: Whisper said ফুসফুস (lungs), "I feel sick" had the text of "I feel bad", Wait that
  // of Stand, Loved said "looks cute", Excited said "agitated"; elsewhere Cousin said "servant siblings" and
  // Bangladeshi forms (গোসল, দাদি, খালা, রংধনু) stood on tiles in a Kolkata set.
  it.each([
    ['hb-runny-nose', 'নাক দিয়ে জল পড়া'],
    ['cw-whisper', 'ফিসফিস করো'],
    ['cw-every', 'প্রত্যেক'],
    ['cw-too', 'এছাড়াও'],
    ['cw-wait', 'অপেক্ষা করো'],
    ['cw-look', 'তাকাও'],
    ['cw-smile', 'মুচকি হাসো'],
    ['cw-sit', 'বসো'],
    ['cw-bring', 'আনো'],
    ['cw-open', 'খোলো'],
    ['cw-catch', 'লুফে নাও'],
    ['cw-win', 'জেতো'],
    ['cw-swallow', 'গিলে ফেলো'],
    ['cw-smell', 'শুঁকে দেখো'],
    ['cw-throw', 'ছুঁড়ে দাও'],
    ['help-i-need-my-mom', 'মাকে চাই'],
    ['help-i-need-my-dad', 'বাবাকে চাই'],
    ['help-i-need-my-teacher', 'টিচারকে চাই'],
    ['hb-sick', 'আমার শরীর খারাপ লাগছে'],
    ['hb-chills', 'শীত শীত করা'],
    ['hb-dull-pain', 'চাপা ব্যথা'],
    ['hb-bruise', 'কালশিটে'],
    ['hb-knuckle', 'আঙুলের গাঁট'],
    ['fe-loved', 'ভালোবাসা পাচ্ছি'],
    ['fe-thankful', 'কৃতজ্ঞ বোধ করছি'],
    ['fe-comfortable', 'আরাম লাগছে'],
    ['fe-ashamed', 'লজ্জা লাগছে'],
    ['fe-excited', 'এক্সাইটেড'],
    ['fe-frustrated', 'মেজাজ খারাপ'],
    ['fe-mixed-up', 'সব গুলিয়ে যাচ্ছে'],
    ['fe-hungry', 'খিদে পেয়েছে'],
    ['qt-yay', 'হুররে'],
    ['qt-i-think-so', 'আমার তাই মনে হয়'],
    ['pf-cousin', 'কাজিন'],
    ['fm-tacos', 'টাকো'],
    ['an-turtle', 'কচ্ছপ'],
    ['ap-turtle', 'কচ্ছপ'],
    ['as-turtle', 'সমুদ্রের কচ্ছপ'],
    ['tf-bubbles', 'সাবানের বুদবুদ'],
    ['tf-train-set', 'ট্রেন সেট'],
    ['ac-whisper', 'ফিসফিস করা'],
    ['ac-stir', 'চামচ দিয়ে নাড়া'],
    ['ac-pat', 'আলতো চাপড় দেওয়া'],
    ['ac-tiptoe', 'পা টিপে টিপে হাঁটা'],
    ['ac-tip-toe', 'পা টিপে টিপে হাঁটা'],
    ['ac-mop', 'ঘর মোছা'],
    ['ac-tag', 'ছোঁয়াছুঁয়ি খেলা'],
    ['ac-spin', 'বনবন করে ঘোরা'],
    ['ac-take-a-bath', 'স্নান করা'],
    ['hr-bath', 'স্নান করা'],
    ['pp-grandma', 'দিদা'],
    ['pp-aunt', 'মাসি'],
    ['pp-uncle', 'কাকু'],
    ['pp-cousin', 'কাজিন'],
    ['dw-bitter', 'তেতো'],
    ['dw-cool', 'কুল'],
    ['dw-funny', 'হাসির'],
    ['fs-cheese', 'চিজ'],
    ['fd-bread', 'পাউরুটি'],
    ['fd-stir-fry', 'স্টির ফ্রাই'],
    ['fd-jello', 'জেলি'],
    ['sw-crayons', 'মোম রং'],
    ['sw-tape', 'সেলোটেপ'],
    ['tf-sandbox', 'বালির বাক্স'],
    ['tf-music', 'মিউজিক'],
    ['tf-sprinkler', 'জল ছিটানোর যন্ত্র'],
    ['co-rainbow', 'রামধনু'],
    ['we-rainbow', 'রামধনু'],
    ['we-lightning', 'বিদ্যুৎ চমকানো'],
    ['tc-noon', 'দুপুর বারোটা'],
    ['ti-weekend', 'উইকেন্ড'],
  ] as [string, string][])('bn %s says "%s"', (id, text) => {
    expect(getPhraseText(id, 'bn', '')).toBe(text);
  });
});

describe('over-corrections undone after a second model family reviewed them', () => {
  // Reviewers had changed these and a cross-family check (OpenAI Codex, blind) disagreed; each was verified in the table.
  // Vietnamese On "Bật" pairs with Off "Tắt" (Off is the device-off sense in every language), so changing it to "Trên"
  // broke the pair; Pie is the dessert (Japanese パイ, Spanish Pay, Russian Пирог): 馅饼 is a savoury stuffed pie, 派 is
  // the pie word in Mainland and Taiwan Chinese and 批 in Hong Kong.
  it.each([
    ['vi', 'cw-on', 'Bật'],
    ['vi', 'cw-above', 'Trên'],
    ['zh-Hans', 'fd-pie', '派'],
    ['zh-Hant', 'fd-pie', '派'],
    ['zh-HK', 'fd-pie', '批'],
  ] as [SupportedLanguage, string, string][])('%s %s says "%s"', (lang, id, text) => {
    expect(getPhraseText(id, lang, '')).toBe(text);
  });
});

describe('corrections from the gpt-6.1-sol cross-family review', () => {
  // Taiwan says 義大利麵 for pasta (generated 意大利麵 is the Mainland/Hong Kong form); Hong Kong says 捉 for the tag game.
  it.each([
    ['zh-Hant', 'fd-pasta', '義大利麵'],
    ['zh-HK', 'ac-tag', '捉人遊戲'],
  ] as [SupportedLanguage, string, string][])('%s %s says "%s"', (lang, id, text) => {
    expect(getPhraseText(id, lang, '')).toBe(text);
  });
});

describe('why the Swahili Taco tile is a description', () => {
  // "Tako" is Swahili for buttock and "Taco" is spoken the same way by a Swahili voice, so the spelling alone does not
  // keep the wrong word out of the user's mouth (gpt-6.1-sol, blind review). A description of the food has no sound-alike.
  it.each(['fd-taco', 'fm-tacos'])('sw %s is neither "Tako" nor "Taco"', (id) => {
    expect(getPhraseText(id, 'sw', '').toLowerCase()).not.toMatch(/^(tako|taco)s?$/);
  });
});
