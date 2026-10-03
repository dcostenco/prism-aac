import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Toolbar from '@/components/Toolbar';
import { DEFAULT_TOOLBAR_ORDER, useSettingsStore } from '@/store/settingsStore';
import { useUIStore } from '@/store/uiStore';
import { PRISM_AAC_BASE_PATH } from '@/lib/appPaths';

// In the Prism AAC Browser iOS app, "Back to AAC Board" opens the board in the
// same view. That view has no back gesture and no native controls, so without a
// way back the browser could only be reached again by closing and reopening
// the app.

vi.mock('@/engine/useT', () => ({
  useT: () => ({ t: (k: string) => k, ttsCode: 'en-US', rtl: false, ready: true }),
}));
vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn(), keyFeedback: vi.fn(), alertFeedback: vi.fn(), speakFeedback: vi.fn() }));
vi.mock('@/services/voiceInputService', () => ({
  isVoiceInputSupported: () => true,
  startVoiceInput: vi.fn(() => null),
}));
vi.mock('@/lib/marketplace/registry', () => ({
  getHandler: () => undefined,
}));
vi.mock('@/store/marketplaceStore', () => ({
  useMarketplaceStore: { getState: () => ({ findBySlug: () => null }) },
}));

// The bridges as each iOS shell injects them at document start (ContentView.swift
// in prism-aac/ios-native and in the Prism AAC Browser app). Only the Browser
// shell navigates.
const noop = () => {};
const PRISM_AAC_SHELL_BRIDGE = { speak: noop, stopSpeech: noop, startVoice: noop, stopVoice: noop, emergency: noop,
  freeMemoryMB: noop, askAI: noop, openSettings: noop, requestReview: noop, signInWithApple: noop, subscription: noop };
const PRISM_AAC_BROWSER_SHELL_BRIDGE = { speak: noop, stopSpeech: noop, startVoice: noop, stopVoice: noop, emergency: noop,
  freeMemoryMB: noop, askAI: noop, openSettings: noop, requestReview: noop, navigateTo: noop, goBack: noop, goForward: noop };
type BridgeWindow = { prismNativeBridge?: Record<string, () => void> };

const realLocation = window.location;
beforeEach(() => {
  useSettingsStore.setState({
    installedApps: [],
    toolbarConfig: { order: [...DEFAULT_TOOLBAR_ORDER], enabled: {} },
  });
  useUIStore.setState({ sidePanel: 'none' });
  Object.defineProperty(window, 'location', {
    configurable: true, writable: true,
    value: { ...realLocation, href: 'https://synalux.ai/prism-aac', pathname: '/prism-aac' },
  });
});
afterEach(() => {
  delete (window as BridgeWindow).prismNativeBridge;
  Object.defineProperty(window, 'location', { configurable: true, writable: true, value: realLocation });
});

// The toolbar button shows where the toolbar row has room for it; on narrow
// screens a bar under the toolbar shows instead. globals.css picks one, so
// jsdom (no stylesheet) renders both.
describe('a way back to the browser from the AAC board', () => {
  it.each([
    ['toolbar button', 'aac-toolbar-browser-button'],
    ['bar under the toolbar', 'aac-browser-return-bar'],
  ])('the labelled %s in the Prism AAC Browser app returns to the browser', (_variant, testId) => {
    (window as BridgeWindow).prismNativeBridge = PRISM_AAC_BROWSER_SHELL_BRIDGE;
    render(<Toolbar />);
    const button = screen.getByTestId(testId);
    expect(button).toHaveAccessibleName('toolbar_browser');
    // A word on the control, not an icon alone.
    expect(button).toHaveTextContent('toolbar_browser');
    fireEvent.click(button);
    expect(window.location.href).toBe(`${PRISM_AAC_BASE_PATH}/browser`);
  });

  it.each([
    ['the Prism AAC app', PRISM_AAC_SHELL_BRIDGE],
    ['a web browser, whose own Back button already returns', undefined],
  ])('does not show either in %s', (_where, bridge) => {
    if (bridge) (window as BridgeWindow).prismNativeBridge = bridge;
    render(<Toolbar />);
    expect(screen.queryByRole('button', { name: 'toolbar_browser' })).not.toBeInTheDocument();
  });
});
