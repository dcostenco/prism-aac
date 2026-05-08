/**
 * MathTutorTool — output-language wiring.
 *
 * User report May 2026: outputLanguage=ro selected, math hint came
 * back in English. Two bugs landed in commit 3a68a09:
 *   1. The tutor was reading settings.language (UI lang) instead of
 *      settings.outputLanguage (TTS / AI response lang). For an
 *      asymmetric pair (input=en, output=ro) the kid wants Romanian
 *      guidance even if the toolbar is in English.
 *   2. The route's system prompt said "respond in {langName}" but the
 *      heavily-English user prompt overrode it. Appending an explicit
 *      "Respond in Romanian. Use natural Romanian phrasing…" directive
 *      to the END of the user message makes the model commit to the
 *      target language.
 *
 * This pins both behaviours by inspecting what askAI was called with.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import MathTutorTool from '@/components/math/MathTutorTool';
import { useSettingsStore } from '@/store/settingsStore';
import { useMathGridStore } from '@/store/mathGridStore';

vi.mock('@/services/aiService', async () => {
  // Re-export the real LANG_NAMES so MathTutorTool's lookup still
  // resolves "Romanian" / "Spanish" / etc. while askAI is mocked.
  const real = await vi.importActual<typeof import('@/services/aiService')>(
    '@/services/aiService',
  );
  return { ...real, askAI: vi.fn() };
});

vi.mock('@/services/aacSpeak', () => ({ aacSpeak: vi.fn() }));
vi.mock('@/services/feedback', () => ({ tapFeedback: vi.fn() }));

// Resolve the mock AFTER the hoisted vi.mock call has been registered.
let askAIMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  // Pull the hoisted mock so we can configure / inspect it.
  const aiSvc = await import('@/services/aiService');
  askAIMock = aiSvc.askAI as unknown as ReturnType<typeof vi.fn>;
  askAIMock.mockReset();
  askAIMock.mockResolvedValue({ text: '', lines: [] });
  // Reset stores between tests
  useMathGridStore.getState().reset();
  // Put a cell in the grid so ask() doesn't bail on empty expression
  useMathGridStore.getState().commitGlyph('5');
});

describe('MathTutorTool: response-language directive', () => {
  it('passes outputLanguage (NOT language) as the lang arg to askAI', async () => {
    useSettingsStore.setState({ language: 'en', outputLanguage: 'ro' });
    const user = userEvent.setup();
    render(<MathTutorTool />);
    await user.click(screen.getByTestId('math-tutor-hint'));

    await waitFor(() => expect(askAIMock).toHaveBeenCalled());
    // askAI signature: (prompt, context, onChunk, language)
    const [, , , lang] = askAIMock.mock.calls[0];
    expect(lang).toBe('ro');
  });

  it('falls back to language when outputLanguage is unset', async () => {
    useSettingsStore.setState({ language: 'fr', outputLanguage: undefined as unknown as 'fr' });
    const user = userEvent.setup();
    render(<MathTutorTool />);
    await user.click(screen.getByTestId('math-tutor-hint'));

    await waitFor(() => expect(askAIMock).toHaveBeenCalled());
    const [, , , lang] = askAIMock.mock.calls[0];
    expect(lang).toBe('fr');
  });

  it('appends "Respond in {LangName}." directive to the user prompt for ro', async () => {
    useSettingsStore.setState({ language: 'en', outputLanguage: 'ro' });
    const user = userEvent.setup();
    render(<MathTutorTool />);
    await user.click(screen.getByTestId('math-tutor-hint'));

    await waitFor(() => expect(askAIMock).toHaveBeenCalled());
    const [prompt] = askAIMock.mock.calls[0] as [string, unknown, unknown, unknown];
    expect(prompt).toMatch(/Respond in Romanian\./);
    expect(prompt).toMatch(/natural Romanian phrasing/);
    // Directive must be at the TAIL — that's where current models
    // weight it most.
    const tail = prompt.slice(-180);
    expect(tail).toMatch(/Respond in Romanian/);
  });

  it('uses the correct LangName for Spanish', async () => {
    useSettingsStore.setState({ language: 'en', outputLanguage: 'es' });
    const user = userEvent.setup();
    render(<MathTutorTool />);
    await user.click(screen.getByTestId('math-tutor-hint'));

    await waitFor(() => expect(askAIMock).toHaveBeenCalled());
    const [prompt] = askAIMock.mock.calls[0] as [string, unknown, unknown, unknown];
    expect(prompt).toMatch(/Respond in Spanish\./);
  });

  it('appends "Respond in English." for en→en (no-op-friendly default)', async () => {
    useSettingsStore.setState({ language: 'en', outputLanguage: 'en' });
    const user = userEvent.setup();
    render(<MathTutorTool />);
    await user.click(screen.getByTestId('math-tutor-hint'));

    await waitFor(() => expect(askAIMock).toHaveBeenCalled());
    const [prompt] = askAIMock.mock.calls[0] as [string, unknown, unknown, unknown];
    expect(prompt).toMatch(/Respond in English\./);
  });
});
