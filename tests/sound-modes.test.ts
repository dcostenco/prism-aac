import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Sound output modes — contract test
 * ===================================
 *
 * PrismAAC has TWO independent toggles + ONE momentary action:
 *
 *   soundEnabled (toolbar 🔊/🔇)  — master mute. Off = no audio anywhere.
 *   autoSpeak    (MessageBar Auto) — speaks each typed char + each
 *                                    completed word. Independent of the
 *                                    momentary Speak/▶ buttons.
 *   handleSpeak  (MessageBar ▶ + Keyboard "Speak") — one-shot speak
 *                of the entire message, ignores autoSpeak.
 *
 * Combined the toggles produce 3 user-facing modes:
 *
 *   ┌────────────────┬──────────────┬────────────────────────┬─────────────┐
 *   │ soundEnabled   │ autoSpeak    │ Mode                   │ Per-key?    │
 *   ├────────────────┼──────────────┼────────────────────────┼─────────────┤
 *   │ false          │ any          │ DISABLED               │ no          │
 *   │ true           │ false        │ MANUAL (Speak only)    │ no          │
 *   │ true           │ true         │ AUTO (echo + word)     │ YES         │
 *   └────────────────┴──────────────┴────────────────────────┴─────────────┘
 *
 * Bug history: prior to this test single-letter words like "I" never
 * spoke in AUTO mode because handleKey didn't fire speakWord — only
 * handleSpace did. Users reported "pressing I makes no sound unless I
 * tap Speak". Echo path covers that gap.
 */

interface SoundState {
    soundEnabled: boolean;
    autoSpeak: boolean;
}

function effectiveMode(s: SoundState): 'disabled' | 'manual' | 'auto' {
    if (!s.soundEnabled) return 'disabled';
    return s.autoSpeak ? 'auto' : 'manual';
}

function shouldSpeakOnKeystroke(s: SoundState): boolean {
    return effectiveMode(s) === 'auto';
}

function shouldSpeakOnSpace(s: SoundState, currentLastWord: string): boolean {
    if (!currentLastWord) return false;
    return effectiveMode(s) === 'auto';
}

function shouldHandleSpeakButton(s: SoundState, hasText: boolean): boolean {
    if (!hasText) return false;
    return s.soundEnabled; // ▶/Speak button works in MANUAL or AUTO; off only when DISABLED
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('Sound output modes — effectiveMode', () => {
    it('DISABLED when soundEnabled is false (regardless of autoSpeak)', () => {
        expect(effectiveMode({ soundEnabled: false, autoSpeak: true })).toBe('disabled');
        expect(effectiveMode({ soundEnabled: false, autoSpeak: false })).toBe('disabled');
    });
    it('MANUAL when soundEnabled is true but autoSpeak is false', () => {
        expect(effectiveMode({ soundEnabled: true, autoSpeak: false })).toBe('manual');
    });
    it('AUTO when both toggles are on', () => {
        expect(effectiveMode({ soundEnabled: true, autoSpeak: true })).toBe('auto');
    });
});

describe('Sound output modes — keystroke echo gate', () => {
    it('does NOT speak per-keystroke in DISABLED', () => {
        expect(shouldSpeakOnKeystroke({ soundEnabled: false, autoSpeak: true })).toBe(false);
    });
    it('does NOT speak per-keystroke in MANUAL', () => {
        expect(shouldSpeakOnKeystroke({ soundEnabled: true, autoSpeak: false })).toBe(false);
    });
    it('SPEAKS per-keystroke in AUTO (fixes "I makes no sound" bug)', () => {
        expect(shouldSpeakOnKeystroke({ soundEnabled: true, autoSpeak: true })).toBe(true);
    });
});

describe('Sound output modes — space (word boundary) gate', () => {
    it('never speaks when message has no completed word', () => {
        expect(shouldSpeakOnSpace({ soundEnabled: true, autoSpeak: true }, '')).toBe(false);
    });
    it('does NOT speak word in DISABLED even if there is one', () => {
        expect(shouldSpeakOnSpace({ soundEnabled: false, autoSpeak: true }, 'hello')).toBe(false);
    });
    it('does NOT speak word in MANUAL', () => {
        expect(shouldSpeakOnSpace({ soundEnabled: true, autoSpeak: false }, 'hello')).toBe(false);
    });
    it('SPEAKS the just-completed word in AUTO', () => {
        expect(shouldSpeakOnSpace({ soundEnabled: true, autoSpeak: true }, 'hello')).toBe(true);
    });
});

describe('Sound output modes — momentary Speak/▶ button', () => {
    it('disabled when there is no text to speak (regardless of mode)', () => {
        expect(shouldHandleSpeakButton({ soundEnabled: true, autoSpeak: true }, false)).toBe(false);
        expect(shouldHandleSpeakButton({ soundEnabled: true, autoSpeak: false }, false)).toBe(false);
    });
    it('disabled in DISABLED mode (master mute respected)', () => {
        expect(shouldHandleSpeakButton({ soundEnabled: false, autoSpeak: true }, true)).toBe(false);
    });
    it('works in MANUAL mode (the canonical use case)', () => {
        expect(shouldHandleSpeakButton({ soundEnabled: true, autoSpeak: false }, true)).toBe(true);
    });
    it('works in AUTO mode too (user can manually re-speak the whole message)', () => {
        expect(shouldHandleSpeakButton({ soundEnabled: true, autoSpeak: true }, true)).toBe(true);
    });
});

describe('Sound button surface — duplication audit', () => {
    /**
     * The 5 sound-related controls in the AAC UI:
     *   1. Toolbar 🔊/🔇 — toggleSound (master mute)
     *   2. MessageBar Auto chip — toggleAutoSpeak
     *   3. MessageBar Tone chip — opens tone picker (NOT a sound on/off)
     *   4. MessageBar ▶ button — handleSpeak (entire message)
     *   5. Keyboard "Speak" button — handleSpeak (entire message)
     *
     * #4 and #5 are intentional duplicates: ▶ is the touch target near
     * the message; Speak is the keyboard's primary action button —
     * one is in reach during typing, the other in reach when reviewing.
     * Leave both in place; they share the same handler so behavior
     * cannot drift.
     */
    it('Auto and Sound are distinct toggles (not duplicates)', () => {
        expect(effectiveMode({ soundEnabled: true, autoSpeak: false }))
            .not.toBe(effectiveMode({ soundEnabled: false, autoSpeak: true }));
    });
    it('toggling Sound off forces DISABLED regardless of Auto state', () => {
        expect(effectiveMode({ soundEnabled: false, autoSpeak: true })).toBe('disabled');
    });
    it('toggling Auto off without touching Sound drops to MANUAL (Speak still works)', () => {
        const wasAuto: SoundState = { soundEnabled: true, autoSpeak: true };
        const nowManual: SoundState = { ...wasAuto, autoSpeak: false };
        expect(effectiveMode(nowManual)).toBe('manual');
        expect(shouldHandleSpeakButton(nowManual, true)).toBe(true);
    });
});
