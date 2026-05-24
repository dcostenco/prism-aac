/**
 * uiStore — panel toggles not covered by ui-store-hardening.test.ts.
 *
 * The hardening suite tests 6 panels (openAACChat, openSchedule, openGames,
 * openMarketplace, openComfortPlayer, openPdfReader). These tests cover the
 * three that were left out of that parameterised loop:
 *
 *   openAIChat — AI Chat panel. A broken toggle disables the AI chat
 *   feature for the entire session.
 *
 *   openCaregiver — Caregiver panel. A broken toggle locks AAC users'
 *   caregivers out of the monitoring view.
 *
 *   openOcrCapture — OCR text capture panel. A broken toggle prevents
 *   the user from scanning printed text.
 *
 * NOTE: replyToSender is not tested here because it uses
 * require('@/store/contactsStore') — a CJS dynamic require with a Vite
 * path alias that vitest's runtime does not resolve. That action is
 * exercised by E2E / integration-level tests instead.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '@/store/uiStore';

beforeEach(() => {
  useUIStore.setState({
    sidePanel: 'none',
    activeContactId: null,
    categoryPath: [],
    activeCategoryId: null,
  });
});

// ── openAIChat toggle ─────────────────────────────────────────────────────────

describe('uiStore — openAIChat toggle', () => {
  it('opens ai-chat when sidePanel is none', () => {
    useUIStore.getState().openAIChat();
    expect(useUIStore.getState().sidePanel).toBe('ai-chat');
  });

  it('closes ai-chat when already open', () => {
    useUIStore.getState().openAIChat();
    useUIStore.getState().openAIChat();
    expect(useUIStore.getState().sidePanel).toBe('none');
  });
});

// ── openCaregiver toggle ──────────────────────────────────────────────────────

describe('uiStore — openCaregiver toggle', () => {
  it('opens caregiver panel when sidePanel is none', () => {
    useUIStore.getState().openCaregiver();
    expect(useUIStore.getState().sidePanel).toBe('caregiver');
  });

  it('closes caregiver when already open', () => {
    useUIStore.getState().openCaregiver();
    useUIStore.getState().openCaregiver();
    expect(useUIStore.getState().sidePanel).toBe('none');
  });
});

// ── openOcrCapture toggle ─────────────────────────────────────────────────────

describe('uiStore — openOcrCapture toggle', () => {
  it('opens ocr-capture panel when sidePanel is none', () => {
    useUIStore.getState().openOcrCapture();
    expect(useUIStore.getState().sidePanel).toBe('ocr-capture');
  });

  it('closes ocr-capture when already open', () => {
    useUIStore.getState().openOcrCapture();
    useUIStore.getState().openOcrCapture();
    expect(useUIStore.getState().sidePanel).toBe('none');
  });
});
