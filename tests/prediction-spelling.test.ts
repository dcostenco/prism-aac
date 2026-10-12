// @vitest-environment node
import { expect, it } from 'vitest';
import { getPredictions, recordWord, recordBigram, recordTrigram } from '@/engine/predictionEngine';
import { isAllowedInLang } from '@/lib/langAllowlist';
import { loadPredictionSeed } from '@/constants/predictionSeeds';
import type { WordFreqEntry } from '@/types';
import { predictionWordKey, preferredPredictionSpelling, matchesPredictionPrefix, matchesPredictionContext } from '@/engine/predictionSpellings';
import { ensureLangCorpusLoaded } from '@/lib/langAllowlist';
import { usePredictionStore } from '@/store/predictionStore';
import { resolveVocabularyPicture, reviewedVocabularyPictureChoices } from '@/lib/builtInSymbols';
import { loadPictureWords } from '@/constants/pictureWords';
const entry = (count: number): WordFreqEntry => ({ count, lastUsed: 0 });
const predict = (text: string, lang: string, words: Record<string, WordFreqEntry>, bigrams: Record<string, WordFreqEntry> = {}) =>
 getPredictions(text, words, bigrams, {bigramWeight:.8,frequencyWeight:.2,recencyWeight:0,maxResults:5,recencyWindowMs:0}, undefined, [], new Set(), undefined, lang);

it('Russian plain-e typing can complete the standard ё spelling', () => {
 expect(predict('я иде', 'ru', {'идёт':entry(70),'идея':entry(60)})).toContain('идёт');
});
it('an approved alternate spelling does not occupy two suggestion slots', () => {
 const out=predict('я ид', 'ru', {'идет':entry(80),'идёт':entry(70),'иду':entry(60)});
 expect(out).toContain('идёт');expect(out).not.toContain('идет');expect(out.filter(w=>w==='идёт')).toHaveLength(1);
});
it('spatial context survives the approved идет/идёт alternate spelling', () => {
 const out=predict('я идет ', 'ru', {'в':entry(1),'дом':entry(500)}, {'идёт|в':entry(80)});
 expect(out[0]).toBe('в');
});
it('distinct все and всё meanings remain distinct suggestions', () => {
 const out=predict('я вс', 'ru', {'все':entry(80),'всё':entry(70)});
 expect(out).toContain('все');expect(out).toContain('всё');
});
it('French combining accents are word content, not an end-of-word marker', () => {
 const out=predict('je cafe\u0301', 'fr', {'caféine':entry(20),'pain':entry(500),'soupe':entry(400)});
 expect(out[0]).toBe('caféine');
});
it('Korean decomposed syllables complete the canonical dictionary spelling', () => {
 expect(predict('저는 '+ '아'.normalize('NFD'), 'ko', {'아파요':entry(20),'학교':entry(500)})).toContain('아파요');
});
it('Hindi vowel marks retain the partial word for completion', () => {
 expect(predict('मुझे कृ', 'hi', {'कृपया':entry(20),'पानी':entry(500)} )[0]).toBe('कृपया');
});
it('Romanian legacy cedilla input finds comma-below dictionary spelling', () => {
 expect(predict('eu şco', 'ro', {'școală':entry(20),'acasă':entry(500)})).toContain('școală');
});
it('Romanian accentless be input retains its complete-word context', () => {
 const words={'ești':entry(80),'obosit':entry(20),'estic':entry(200),'estimat':entry(180)};
 const out=predict('tu esti','ro',words,{'ești|obosit':entry(100)});
 expect(out).toContain('obosit');
 expect(out).not.toContain('estic');expect(out).not.toContain('estimat');
});
it('an explicit accentless alias can complete from a shorter ordinary spelling', () => {
 expect(matchesPredictionPrefix('ești','est','ro')).toBe(true);
 expect(preferredPredictionSpelling('esti','ro')).toBe('ești');
 expect(predictionWordKey('est','ro')).toBe('est');
});
it('accentless matching never merges different standard meanings', () => {
 for(const [lang,a,b] of [['ro','fata','fața'],['es','si','sí'],['pt','e','é'],['fr','sur','sûr'],['de','schon','schön']] as const){
  expect(predictionWordKey(a,lang)).not.toBe(predictionWordKey(b,lang));
 }
});
it('actual Romanian accentless and accented copula input agree and retain illustrated context', async () => {
 await Promise.all([ensureLangCorpusLoaded('ro'), loadPictureWords('ro')]);
 usePredictionStore.getState().updatePredictions('tu esti','ro');
 const plain=[...usePredictionStore.getState().predictions];
 usePredictionStore.getState().updatePredictions('tu ești','ro');
 expect(usePredictionStore.getState().predictions).toEqual(plain);
 expect(plain).toContain('bine');
 expect(plain.some(word=>/^estim|^estic/.test(word))).toBe(false);
 expect(plain.every(word=>!!resolveVocabularyPicture(word,'ro').url || reviewedVocabularyPictureChoices(word,'ro','tu esti').length>0)).toBe(true);
});
it('Vietnamese base-vowel typing finds time without merging poetry or another explicit tone', () => {
 expect(matchesPredictionPrefix('thời','thơ','vi')).toBe(true);
 expect(matchesPredictionPrefix('thời','thờ','vi')).toBe(true);
 expect(matchesPredictionPrefix('thời','thở','vi')).toBe(false);
 expect(matchesPredictionPrefix('thời','tho','vi')).toBe(false);
 expect(predictionWordKey('thơ','vi')).not.toBe(predictionWordKey('thời','vi'));
 expect(matchesPredictionContext('thời|gian','thơ|','vi')).toBe(false);
});
it('Korean unfinished syllable input finds eyes without rewriting the complete-word identity', () => {
 expect(matchesPredictionPrefix('눈','누','ko')).toBe(true);
 expect(matchesPredictionPrefix('눈','ㄴ','ko')).toBe(true);
 expect(predictionWordKey('눈','ko')).not.toBe(predictionWordKey('누','ko'));
 expect(matchesPredictionContext('눈|아파요','누|','ko')).toBe(false);
});
it('Turkish capital I preserves dotless-I word identity', () => {
 const out=predict('ben IŞ', 'tr', {'ışık':entry(20),'işçi':entry(500)});
 expect(out).toContain('ışık');expect(out).not.toContain('işçi');
});
it('spelling-aware matching leaves caller dictionaries unchanged', () => {
 const words={'идет':entry(80),'идёт':entry(70)};const before=JSON.stringify(words);
 predict('я ид','ru',words);expect(JSON.stringify(words)).toBe(before);
});

it('reviewed same-word spellings combine context and prefix evidence before ranking', () => {
 const words={'weiß':entry(1),'weiss':entry(100),'weit':entry(99),'weihnachten':entry(98)};
 const before=JSON.stringify(words);
 expect(predict('ich wei','de',words,{'ich|weiß':entry(10)})[0]).toBe('weiß');
 expect(JSON.stringify(words)).toBe(before);
 expect(predictionWordKey('weiss','de')).toBe('weiß');
});

it('actual German basic know completes from ordinary keys and keeps its context picture', async () => {
 await Promise.all([ensureLangCorpusLoaded('de'), loadPictureWords('de')]);
 usePredictionStore.getState().updatePredictions('ich wei','de');
 expect(usePredictionStore.getState().predictions).toContain('weiß');
 expect(reviewedVocabularyPictureChoices('weiß','de','ich wei')).toEqual(['cw-know.png']);
});

it('explicit Russian ё input does not broaden to a distinct е meaning', () => {
 const out=predict('я всё','ru',{'всем':entry(100),'всё-таки':entry(50)});
 expect(out).toContain('всё-таки');expect(out).not.toContain('всем');
});

it('Turkish sentence capitals retain dotted and dotless dictionary identities', () => {
 const out=predict('merhaba. ', 'tr', {'istiyorum':entry(200),'ışık':entry(100)});
 expect(out).toContain('İstiyorum');
 expect(out).toContain('Işık');
 expect(out.map(word=>predictionWordKey(word,'tr'))).toContain('istiyorum');
});

it('learned French combining accents survive the final language gate', async () => {
 await Promise.all([loadPredictionSeed('fr'), loadPredictionSeed('en')]);
 expect(isAllowedInLang('cafe\u0301ine','fr')).toBe(true);
 expect(isAllowedInLang('cafe\u0301ine','en')).toBe(false);
});

it('locale-aware learning preserves Turkish word and context identity', () => {
 const words=recordWord({},'Işık','tr');
 expect(words['ışık']?.count).toBe(1);expect(words['işık']).toBeUndefined();
 const bigrams=recordBigram({},'İSTİYORUM','IŞIK','tr');
 expect(bigrams['istiyorum|ışık']?.count).toBe(1);
 const trigrams=recordTrigram({},'BEN','İSTİYORUM','IŞIK','tr');
 expect(trigrams['ben|istiyorum|ışık']?.count).toBe(1);
});

it('punctuation never becomes a learned context token', () => {
 expect(recordBigram({},'«я»','идёт','ru')['я|идёт']?.count).toBe(1);
});

it.each(['__proto__','constructor','toString'])('unknown locale %s cannot turn a prototype property into a spelling', lang => {
 expect(predictionWordKey('constructor',lang)).toBe('constructor');
 expect(preferredPredictionSpelling('constructor',lang)).toBe('constructor');
});
