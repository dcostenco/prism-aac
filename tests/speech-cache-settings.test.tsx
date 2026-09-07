import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SpeechCacheSettings from '@/components/SpeechCacheSettings';
import { useSettingsStore } from '@/store/settingsStore';
import { speechAudioCache } from '@/services/speechAudioCache';
import { clearSavedSpeech } from '@/services/azureTTS';

vi.mock('@/services/azureTTS', () => ({ clearSavedSpeech: vi.fn(), getSpeechCacheScope: () => 'guest' }));
vi.mock('@/services/speechAudioCache', () => ({
  speechAudioCache: { stats: vi.fn() }, SPEECH_CACHE_POLICY: { maxBytes: 20 * 1024 * 1024 },
}));
beforeEach(() => {
  vi.resetAllMocks();
  useSettingsStore.setState({ speechCacheEnabled: true, language: 'en' });
  vi.mocked(speechAudioCache.stats).mockResolvedValue({ available: true, clips: 3, bytes: 1024 * 1024 });
  vi.mocked(clearSavedSpeech).mockResolvedValue(true);
});

describe('speech storage controls', () => {
  it('shows real usage and disabling retention clears audio without disabling speech', async () => {
    render(<SpeechCacheSettings />);
    expect(await screen.findByText(/3 clips.*1.0 MB/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Save speech on this device' }));
    expect(useSettingsStore.getState().speechCacheEnabled).toBe(false);
    await waitFor(() => expect(clearSavedSpeech).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });
  it('reports a failed clear instead of claiming that stored audio was removed', async () => {
    vi.mocked(clearSavedSpeech).mockResolvedValue(false);
    render(<SpeechCacheSettings />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear saved speech on this device' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not clear saved speech');
  });
});
