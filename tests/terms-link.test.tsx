import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TermsLink from '@/components/TermsLink';
import { useMessageStore } from '@/store/messageStore';
import { useUIStore } from '@/store/uiStore';
import { useSettingsStore } from '@/store/settingsStore';

beforeEach(() => {
  useSettingsStore.setState({ language: 'en' });
  useMessageStore.setState({ text: 'More please', undoStack: ['More'] });
  useUIStore.setState({ showSettings: true });
});

describe('Terms reading preserves communication in memory', () => {
  it('opens a cached same-origin reader without navigating or persisting the message', () => {
    const store = vi.spyOn(Storage.prototype, 'setItem');
    render(<TermsLink>Terms of use</TermsLink>);
    fireEvent.click(screen.getByRole('link', { name: 'Terms of use' }));
    expect(screen.getByRole('dialog', { name: 'Terms of use' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    expect(screen.getByTitle('Terms of use')).toHaveAttribute('src', '/prism-aac/terms');
    expect(useMessageStore.getState().text).toBe('More please');
    expect(useMessageStore.getState().undoStack).toEqual(['More']);
    expect(store).not.toHaveBeenCalled();
    store.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByTestId('aac-terms-reader')).not.toBeInTheDocument();
    expect(useUIStore.getState().showSettings).toBe(false);
    expect(useMessageStore.getState().text).toBe('More please');
  });

  it('only accepts a close message from this exact same-origin frame', () => {
    render(<TermsLink>Terms of use</TermsLink>);
    fireEvent.click(screen.getByRole('link', { name: 'Terms of use' }));
    const frame = screen.getByTitle('Terms of use') as HTMLIFrameElement;
    fireEvent(window, new MessageEvent('message', { origin: 'https://other.example', source: frame.contentWindow, data: { type: 'aac-terms-close' } }));
    fireEvent(window, new MessageEvent('message', { origin: window.location.origin, source: window, data: { type: 'aac-terms-close' } }));
    expect(screen.getByTestId('aac-terms-reader')).toBeInTheDocument();
    fireEvent(window, new MessageEvent('message', { origin: window.location.origin, source: frame.contentWindow, data: { type: 'aac-terms-close' } }));
    expect(screen.queryByTestId('aac-terms-reader')).not.toBeInTheDocument();
    expect(useMessageStore.getState().text).toBe('More please');
  });
});
