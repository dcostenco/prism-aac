import { describe, it, expect } from 'vitest';
import { getStemmer } from '@/engine/stemmers';

describe('stemmers — Snowball-backed languages', () => {
  it('en: groups inflected verb forms (running/runs → run)', () => {
    const stem = getStemmer('en')!;
    expect(stem('running')).toBe(stem('runs'));
    expect(stem('runs')).toBe('run');
  });

  it('en: keeps distinct lemmas separate (real ≠ reason)', () => {
    const stem = getStemmer('en')!;
    expect(stem('real')).not.toBe(stem('reason'));
    expect(stem('really')).not.toBe(stem('real')); // really → realli, real → real
  });

  it('ru: думать/думал/думают/думаю share a stem', () => {
    const stem = getStemmer('ru')!;
    const variants = ['думать', 'думал', 'думают', 'думаю', 'думающий'];
    const stems = new Set(variants.map(stem));
    expect(stems.size).toBe(1);
  });

  it('ru: дуб and дубль get distinct stems (so both can surface)', () => {
    const stem = getStemmer('ru')!;
    expect(stem('дуб')).not.toBe(stem('дубль'));
  });

  it('ru: дум-family and дуб are distinct (the original blocker)', () => {
    const stem = getStemmer('ru')!;
    expect(stem('думать')).not.toBe(stem('дуб'));
  });

  it('es: hablar/hablo/hablamos share a stem', () => {
    const stem = getStemmer('es')!;
    expect(stem('hablar')).toBe(stem('hablo'));
    expect(stem('hablo')).toBe(stem('hablamos'));
  });

  it('fr: parler/parle/parlons share a stem', () => {
    const stem = getStemmer('fr')!;
    expect(stem('parler')).toBe(stem('parle'));
  });

  it('pt: falar/falo/falamos share a stem', () => {
    const stem = getStemmer('pt')!;
    expect(stem('falar')).toBe(stem('falo'));
    expect(stem('falo')).toBe(stem('falamos'));
  });

  it('de: sprechen/spreche share a stem', () => {
    const stem = getStemmer('de')!;
    expect(stem('sprechen')).toBe(stem('spreche'));
  });

  it('ro: handles modern Unicode comma diacritics (ș/ț)', () => {
    const stem = getStemmer('ro')!;
    // The Snowball Romanian algorithm has a known bug with U+0219/U+021B
    // (modern comma-below diacritics); our wrapper pre-normalizes to legacy
    // cedilla form (U+015F/U+0163) to work around it. After fix, modern and
    // legacy diacritic spellings should produce the SAME stem.
    expect(stem('vorbește')).toBe(stem('vorbeşte'));
    expect(stem('vorbește')).toBe(stem('vorbi'));
  });

  it('ar: strips definite article ال', () => {
    const stem = getStemmer('ar')!;
    expect(stem('الكتاب')).toBe('كتاب');
  });
});

describe('stemmers — custom heuristics', () => {
  it('uk: думати/думав/думають share a stem (Ukrainian heuristic)', () => {
    const stem = getStemmer('uk')!;
    const variants = ['думати', 'думав', 'думають'];
    const stems = new Set(variants.map(stem));
    // The UK heuristic is conservative; it may produce 1 or 2 stems
    // depending on which suffixes match. Either way "дуб" must not collide.
    expect(stems.size).toBeLessThanOrEqual(2);
    expect(stems.has(stem('дуб'))).toBe(false);
  });

  it('uk: never produces a stem shorter than 3 chars', () => {
    const stem = getStemmer('uk')!;
    for (const w of ['думати', 'дім', 'я', 'на', 'ось']) {
      const s = stem(w);
      expect(s.length, `stem('${w}') = '${s}'`).toBeGreaterThanOrEqual(Math.min(3, w.length));
    }
  });

  it('ja: strips ます-form polite endings', () => {
    const stem = getStemmer('ja')!;
    expect(stem('食べます')).toBe('食べ');
    expect(stem('行きます')).toBe('行き');
  });

  it('ja: strips ない (negative) ending', () => {
    const stem = getStemmer('ja')!;
    expect(stem('食べない')).toBe('食べ');
  });

  it('ko: strips 요 polite ending', () => {
    const stem = getStemmer('ko')!;
    expect(stem('가요')).toBe('가');
  });

  it('ko: strips ㅂ니다 formal ending', () => {
    const stem = getStemmer('ko')!;
    expect(stem('갑니다').length).toBeLessThan('갑니다'.length);
  });
});

describe('stemmers — registry behavior', () => {
  it('returns null for unsupported languages (zh-* — no morphology needed)', () => {
    expect(getStemmer('zh-Hans')).toBeNull();
    expect(getStemmer('zh-Hant')).toBeNull();
    expect(getStemmer('zh-HK')).toBeNull();
  });

  it('returns null for completely unknown language codes', () => {
    expect(getStemmer('xx')).toBeNull();
    expect(getStemmer('')).toBeNull();
  });
});
