/**
 * A caregiver can mute while an AI hint request is still pending. The late
 * response remains visible, but it must not restart audio after that choice.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MathTutorTool from '@/components/math/MathTutorTool';
import { useMathGridStore } from '@/store/mathGridStore';
import { useMessageStore } from '@/store/messageStore';
import { useSettingsStore } from '@/store/settingsStore';
import { aacSpeak } from '@/services/aacSpeak';
import { askAI } from '@/services/aiService';

vi.mock('@/services/aiService', async () => {
  const real = await vi.importActual<typeof import('@/services/aiService')>('@/services/aiService');
  return { ...real, askAI: vi.fn() };
});
vi.mock('@/services/aacSpeak', () => ({ aacSpeak: vi.fn() }));
vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  useMathGridStore.getState().reset();
  useMathGridStore.getState().commitGlyph('7');
  useMessageStore.setState({ soundEnabled: true });
  useSettingsStore.setState({ language: 'en', outputLanguage: 'en', speechRate: 0.5, speechVolume: 1 });
});

describe('MathTutorTool — mute during a pending hint', () => {
  it('shows the completed hint without speaking it after master mute turns off', async () => {
    let finish!: (value: { text: string }) => void;
    (askAI as ReturnType<typeof vi.fn>).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    render(<MathTutorTool />);

    await user.click(screen.getByTestId('math-tutor-hint'));
    await waitFor(() => expect(askAI).toHaveBeenCalledOnce());
    useMessageStore.setState({ soundEnabled: false });

    await act(async () => finish({ text: 'Look at the first number.' }));

    await expect(screen.findByText('Look at the first number.')).resolves.toBeInTheDocument();
    expect(aacSpeak).not.toHaveBeenCalled();
  });
});
