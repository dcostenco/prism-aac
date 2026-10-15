/**
 * The math tutor says why the cloud cannot answer when the portal refuses it
 * (no cloud subscription, or the month's allowance used up), instead of telling
 * the child to check the internet.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import MathTutorTool from '@/components/math/MathTutorTool';
import { useSettingsStore } from '@/store/settingsStore';
import { useMathGridStore } from '@/store/mathGridStore';

vi.mock('@/services/aiService', async () => {
  const real = await vi.importActual<typeof import('@/services/aiService')>('@/services/aiService');
  return { ...real, askAI: vi.fn() };
});
vi.mock('@/services/aacSpeak', () => ({ aacSpeak: vi.fn() }));
vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn() }));

let askAIMock: ReturnType<typeof vi.fn>;
let CloudAccessError: typeof import('@/services/aiService').CloudAccessError;

beforeEach(async () => {
  const aiSvc = await import('@/services/aiService');
  askAIMock = aiSvc.askAI as unknown as ReturnType<typeof vi.fn>;
  CloudAccessError = aiSvc.CloudAccessError;
  askAIMock.mockReset();
  useMathGridStore.getState().reset();
  useMathGridStore.getState().commitGlyph('5');
  useSettingsStore.setState({ language: 'en', outputLanguage: 'en' });
});

async function askForHint() {
  const user = userEvent.setup();
  render(<MathTutorTool />);
  await user.click(screen.getByTestId('math-tutor-hint'));
  await waitFor(() => expect(askAIMock).toHaveBeenCalled());
}

describe('MathTutorTool: a cloud refusal', () => {
  it('no subscription: says a cloud subscription is needed', async () => {
    askAIMock.mockRejectedValue(new CloudAccessError('payment_required', 'Cloud access requires a subscription.'));
    await askForHint();
    expect(await screen.findByText(/needs a cloud subscription/)).toBeInTheDocument();
    expect(screen.queryByText(/Check your internet/)).not.toBeInTheDocument();
  });

  it('allowance used: says it renews next month', async () => {
    askAIMock.mockRejectedValue(new CloudAccessError('exhausted', 'Your cloud allowance has been used.'));
    await askForHint();
    expect(await screen.findByText(/allowance is used up/)).toBeInTheDocument();
  });

  it('a real outage still says to check the internet', async () => {
    askAIMock.mockRejectedValue(new Error('No AI available — check internet connection or start local Ollama'));
    await askForHint();
    expect(await screen.findByText(/Check your internet/)).toBeInTheDocument();
  });

  it('a follow-up refused after a first answer also says a subscription is needed', async () => {
    askAIMock.mockResolvedValueOnce({ text: 'Count the dots. **Say:** "Show me again"', lines: [] });
    await askForHint();
    const followUp = await screen.findByRole('button', { name: /Show me again/ });
    askAIMock.mockRejectedValueOnce(new CloudAccessError('payment_required', 'Cloud access requires a subscription.'));
    followUp.click();
    expect(await screen.findByText(/needs a cloud subscription/)).toBeInTheDocument();
    expect(screen.queryByText(/Could not get a response/)).not.toBeInTheDocument();
  });

  it('a follow-up that fails for another reason keeps the old message', async () => {
    askAIMock.mockResolvedValueOnce({ text: 'Count the dots. **Say:** "Show me again"', lines: [] });
    await askForHint();
    const followUp = await screen.findByRole('button', { name: /Show me again/ });
    askAIMock.mockRejectedValueOnce(new Error('network down'));
    followUp.click();
    expect(await screen.findByText(/Could not get a response/)).toBeInTheDocument();
  });
});
