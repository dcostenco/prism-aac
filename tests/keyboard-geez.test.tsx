/**
 * Ge'ez vowel-order row — wiring test.
 *
 * applyGeezVowelOrder() is unit-tested in keyboard-layouts.test.ts. This
 * suite covers the part unit tests cannot: that the row actually renders for
 * Amharic, does NOT render for other languages, and that tapping an order key
 * rewrites the character already in the message buffer.
 *
 * Why it matters: without this row the 33 Amharic consonant keys only ever
 * emit 1st-order (ግዕዝ) forms, which cannot spell most Amharic words. A silent
 * regression here would leave Amharic in the language picker while making the
 * language unwritable.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Keyboard from '@/components/Keyboard';
import { useMessageStore } from '@/store/messageStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useUIStore } from '@/store/uiStore';

vi.mock('@/services/feedback', () => ({
  tapFeedback: vi.fn(), keyFeedback: vi.fn(), deleteFeedback: vi.fn(),
}));
vi.mock('@/services/aacSpeak', () => ({ aacSpeak: vi.fn() }));
vi.mock('@/services/speechService', () => ({ speakWord: vi.fn() }));
vi.mock('@/services/azureTTS', () => ({ warmupAzureAudio: vi.fn() }));
vi.mock('@/services/aiChatBridge', () => ({ triggerAISubmit: vi.fn() }));
vi.mock('@/services/searchKeyBridge', () => ({ dispatchToSearch: () => false }));
vi.mock('@/engine/useT', () => ({
  useT: () => ({ t: (k: string) => k, ttsCode: 'en-US', rtl: false, ready: true }),
}));

function setLang(language: string) {
  useSettingsStore.setState({ ...useSettingsStore.getState(), language } as never);
}

describe("Ge'ez vowel-order row", () => {
  beforeEach(() => {
    useMessageStore.setState({ ...useMessageStore.getState(), text: '' } as never);
    useUIStore.setState({ ...useUIStore.getState(), keyboardMode: 'letters' } as never);
    setLang('en');
  });

  it('does not render for non-Amharic languages', () => {
    render(<Keyboard />);
    expect(screen.queryByTestId('geez-vowel-orders')).not.toBeInTheDocument();
  });

  it('renders 7 order keys for Amharic', () => {
    setLang('am');
    render(<Keyboard />);
    const row = screen.getByTestId('geez-vowel-orders');
    expect(row).toBeInTheDocument();
    expect(row.querySelectorAll('button')).toHaveLength(7);
  });

  it('inflects the last typed consonant', () => {
    setLang('am');
    useMessageStore.setState({ ...useMessageStore.getState(), text: 'ለ' } as never);
    render(<Keyboard />);
    // offset 1 = kaʿəb (u): ለ -> ሉ
    fireEvent.click(screen.getByRole('button', { name: /kaʿəb/ }));
    expect(useMessageStore.getState().text).toBe('ሉ');
  });

  it('only rewrites the final character, leaving earlier text intact', () => {
    setLang('am');
    useMessageStore.setState({ ...useMessageStore.getState(), text: 'ሰላም ለ' } as never);
    render(<Keyboard />);
    fireEvent.click(screen.getByRole('button', { name: /rabiʿ/ })); // offset 3 = a
    expect(useMessageStore.getState().text).toBe('ሰላም ላ');
  });

  it('leaves the buffer untouched when the last character is not a base consonant', () => {
    setLang('am');
    // Already inflected — inflecting again would walk into the next series.
    useMessageStore.setState({ ...useMessageStore.getState(), text: 'ሉ' } as never);
    render(<Keyboard />);
    fireEvent.click(screen.getByRole('button', { name: /salis/ }));
    expect(useMessageStore.getState().text).toBe('ሉ');
  });

  it('no-ops on an empty buffer', () => {
    setLang('am');
    render(<Keyboard />);
    fireEvent.click(screen.getByRole('button', { name: /kaʿəb/ }));
    expect(useMessageStore.getState().text).toBe('');
  });
});
