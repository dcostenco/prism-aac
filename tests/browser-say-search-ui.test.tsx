import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The browser's Phase 0 controls, chosen in design review: a labelled Say | Search
// switch (the muted-speaker emoji read as "sound off" and Go turned a message
// into a web search), Speaking… with Stop, Undo for a removed Home tile, and a
// way into Settings from the browser.

const speech = vi.hoisted(() => ({ sayOrStop: vi.fn() }));
vi.mock('@/app/browser/browserSpeech', async () => {
  const { create } = await import('zustand');
  return { sayOrStop: speech.sayOrStop, useBrowserSpeech: create(() => ({ speaking: false })) };
});

import BrowserToolbar from '@/app/browser/BrowserToolbar';
import BrowserContent from '@/app/browser/BrowserContent';
import BrowserUndoBar, { UNDO_VISIBLE_MS } from '@/app/browser/BrowserUndoBar';
import { useBrowserSpeech } from '@/app/browser/browserSpeech';
import { useBrowserStore } from '@/app/browser/browserStore';
import { useMessageStore } from '@/store/messageStore';
import { useUIStore } from '@/store/uiStore';

const initial = useBrowserStore.getState();
const tileTitles = () => useBrowserStore.getState().pinnedBookmarks.map((b) => b.title);

beforeEach(() => {
  localStorage.clear();
  useBrowserStore.setState({ ...initial, speakMode: false, lastRemoved: null, url: '', isHome: true, history: [], historyIdx: -1 });
  useBrowserStore.getState().restoreDefaultBookmarks();
  useBrowserSpeech.setState({ speaking: false });
  useMessageStore.setState({ text: '' });
  useUIStore.setState({ showSettings: false });
  speech.sayOrStop.mockReset();
});
afterEach(() => { vi.useRealTimers(); });

describe('Say or Search, in words', () => {
  it('shows a labelled switch instead of the muted-speaker emoji', () => {
    render(<BrowserToolbar />);
    const say = screen.getByRole('button', { name: 'Say mode' });
    const search = screen.getByRole('button', { name: 'Search mode' });
    expect(say).toHaveTextContent('Say');
    expect(search).toHaveTextContent('Search');
    expect(search).toHaveAttribute('aria-pressed', 'true');
    expect(say).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();
    expect(screen.queryByText('🔇')).not.toBeInTheDocument();
  });

  it('in Say mode speaks the message and never searches', () => {
    useMessageStore.setState({ text: 'I want juice' });
    render(<BrowserToolbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Say mode' }));
    expect(screen.getByRole('button', { name: 'Say mode' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Go' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Say' }));
    expect(speech.sayOrStop).toHaveBeenCalledWith('I want juice');
    expect(useBrowserStore.getState()).toMatchObject({ isHome: true, url: '', history: [] });
    expect(useMessageStore.getState().text).toBe('I want juice');
  });

  it('shows Speaking… and a Stop button while speaking', () => {
    useBrowserStore.setState({ speakMode: true });
    useMessageStore.setState({ text: 'hello' });
    useBrowserSpeech.setState({ speaking: true });
    render(<BrowserToolbar />);
    expect(screen.getByTestId('browser-speaking')).toHaveTextContent('Speaking…');
    const stop = screen.getByRole('button', { name: 'Stop speaking' });
    expect(stop).toHaveTextContent('■ Stop');
    fireEvent.click(stop);
    expect(speech.sayOrStop).toHaveBeenCalledWith('hello');
  });

  it('the empty field invites a message in Say mode, a search in Search mode', () => {
    render(<BrowserToolbar />);
    expect(screen.getByRole('button', { name: 'Tap to type a URL or search' })).toHaveTextContent('Search or URL');
    fireEvent.click(screen.getByRole('button', { name: 'Say mode' }));
    const field = screen.getByRole('button', { name: 'Tap to type a message' });
    expect(field).toHaveTextContent('Type a message');
    expect(field).not.toHaveTextContent('Search');
  });
});

describe('removing a Home tile', () => {
  it('offers Undo, which puts the tile back', () => {
    render(<BrowserUndoBar />);
    act(() => useBrowserStore.getState().unpinBookmark('https://text.npr.org'));
    expect(screen.getByRole('status')).toHaveTextContent('NPR removed');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(tileTitles()).toContain('NPR');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps Undo on screen for 10 seconds', () => {
    vi.useFakeTimers();
    render(<BrowserUndoBar />);
    act(() => useBrowserStore.getState().unpinBookmark('https://weather.gov'));
    act(() => { vi.advanceTimersByTime(UNDO_VISIBLE_MS - 1); });
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(tileTitles()).not.toContain('Weather');
  });
});

describe('Settings from the browser', () => {
  it('opens from a labelled button on Home', () => {
    render(<BrowserContent />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(useUIStore.getState().showSettings).toBe(true);
  });

  it('names the button to press in each mode', () => {
    render(<BrowserContent />);
    expect(screen.getByText('Type below and tap Go to search or enter a URL')).toBeInTheDocument();
    act(() => useBrowserStore.getState().setSpeakMode(true));
    expect(screen.getByText('Type below and tap Say to speak it')).toBeInTheDocument();
  });
});
