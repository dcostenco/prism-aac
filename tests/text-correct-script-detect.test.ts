/**
 * Script-aware lang disambiguation — `disambiguateLangByScript`.
 *
 * Pins the regression we just fixed: AAC users with portal language
 * left at 'en' but typing in Cyrillic / Hebrew / Arabic / etc. were
 * getting NO autocorrect suggestions because the model received
 * "Language: English" + non-Latin text → returned input unchanged.
 *
 * The helper now overrides the lang hint to match the dominant script.
 */
import { describe, it, expect } from 'vitest';
import { disambiguateLangByScript } from '@/services/textCorrectService';

describe('disambiguateLangByScript', () => {
    it('overrides en → ru when input is all Cyrillic', () => {
        // "Більше люблю кто" — the literal Ukrainian/Russian mix from the
        // user's bug screenshot. Script is fully Cyrillic.
        expect(disambiguateLangByScript('Більше люблю кто', 'en')).toBe('ru');
    });

    it('overrides en → he when input is Hebrew', () => {
        expect(disambiguateLangByScript('שלום עולם', 'en')).toBe('he');
    });

    it('overrides en → ar when input is Arabic', () => {
        expect(disambiguateLangByScript('مرحبا بالعالم', 'en')).toBe('ar');
    });

    it('overrides en → el when input is Greek', () => {
        expect(disambiguateLangByScript('γεια σας', 'en')).toBe('el');
    });

    it('overrides en → ko when input is Korean', () => {
        expect(disambiguateLangByScript('안녕하세요', 'en')).toBe('ko');
    });

    it('overrides en → ja when input is Hiragana/Katakana', () => {
        expect(disambiguateLangByScript('こんにちは', 'en')).toBe('ja');
        expect(disambiguateLangByScript('カタカナ', 'en')).toBe('ja');
    });

    it('preserves caller lang when input is plain Latin', () => {
        expect(disambiguateLangByScript('hello world', 'en')).toBe('en');
        expect(disambiguateLangByScript('hola mundo', 'es')).toBe('es');
    });

    it('preserves caller lang when input is mixed (less than 70% one script)', () => {
        // 4 Cyrillic letters + 14 Latin = ~22% Cyrillic → don't flip
        expect(disambiguateLangByScript('Меня call me later', 'en')).toBe('en');
    });

    it('does not flip when caller already matches the script', () => {
        // Already Russian, all Cyrillic — no override needed
        expect(disambiguateLangByScript('Привет мир', 'ru')).toBe('ru');
    });

    it('handles BCP-47 like en-US correctly', () => {
        expect(disambiguateLangByScript('Привет', 'en-US')).toBe('ru');
    });

    it('returns caller lang for empty / pure punctuation input', () => {
        expect(disambiguateLangByScript('', 'en')).toBe('en');
        expect(disambiguateLangByScript('!!!?...', 'en')).toBe('en');
        expect(disambiguateLangByScript('   123   ', 'en')).toBe('en');
    });

    it('70% threshold guard — mixed input below 70% does NOT flip', () => {
        // "Слово text" has 5 Cyrillic + 4 Latin letters = 5/9 ≈ 56% Cyrillic.
        // Below the 70% threshold → keep caller lang.
        expect(disambiguateLangByScript('Слово text', 'en')).toBe('en');
    });

    it('70% threshold guard — input ABOVE 70% does flip', () => {
        // "Привет hi" has 6 Cyrillic + 2 Latin letters = 6/8 = 75% Cyrillic
        // Above the threshold → flip.
        expect(disambiguateLangByScript('Привет hi', 'en')).toBe('ru');
    });

    it('Ukrainian-specific letters classified as Cyrillic (ru bucket)', () => {
        // Ukrainian uses ї, є, і, ґ — all Cyrillic block. We bucket all
        // Cyrillic into 'ru' for now (the model can handle uk text under a
        // ru hint without translation issues per our tested behavior).
        expect(disambiguateLangByScript('Їжа', 'en')).toBe('ru');
    });
});
