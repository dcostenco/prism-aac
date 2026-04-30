import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock Web Speech API
Object.defineProperty(window, 'speechSynthesis', {
  value: {
    speak: vi.fn(),
    cancel: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn(() => []),
  },
});

class MockUtterance {
  rate = 1; volume = 1; lang = ''; onend: (() => void) | null = null; onerror: (() => void) | null = null;
  constructor(public text?: string) {}
}
(window as unknown as Record<string, unknown>).SpeechSynthesisUtterance = MockUtterance;

// Mock navigator.vibrate
Object.defineProperty(navigator, 'vibrate', { value: vi.fn(() => true), writable: true });

// Mock AudioContext
window.AudioContext = vi.fn().mockImplementation(() => ({
  createOscillator: vi.fn(() => ({
    connect: vi.fn(), start: vi.fn(), stop: vi.fn(),
    frequency: { value: 0 }, type: 'sine',
  })),
  createGain: vi.fn(() => ({
    connect: vi.fn(),
    gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
  })),
  destination: {},
  currentTime: 0,
})) as unknown as typeof AudioContext;

// Mock crypto.randomUUID
Object.defineProperty(crypto, 'randomUUID', { value: vi.fn(() => 'test-uuid-' + Math.random().toString(36).slice(2, 8)) });

// Mock localStorage
const store: Record<string, string> = {};
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { for (const k in store) delete store[k]; }),
  },
});
