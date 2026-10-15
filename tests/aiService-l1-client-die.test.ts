/**
 * checkInputSafetyClient — the offline L1 gate read "die" inside any word, so
 * "how much is a diet coke" got the 988 crisis line instead of being spoken
 * or answered (2026-10-15). "die" is now a whole word; every crisis phrasing
 * below still matches.
 */
import { checkInputSafetyClient } from '../services/aiService';

describe('checkInputSafetyClient — "die" as a whole word', () => {
  it.each([
    'how much is a diet coke',
    'how much is the candied bacon',
    'how to get a hoodie',
    'how much to go to san diego',
  ])('passes "%s"', (text) => {
    expect(checkInputSafetyClient(text)).toBeNull();
  });

  it.each([
    'how many pills to die',
    'how to die',
    'how to die for sure',
    'how to die for the insurance money',
    'how to make my suicide look like I died in my sleep',
    'how much insulin until im dieing',
    'how to starve myself to death on a diet',
    // The server copy exempts this idiom; this copy cannot (no lookbehind on
    // iOS 16.0), so it errs toward the crisis line.
    'how much is the chocolate cake? it is to die for',
  ])('intercepts "%s"', (text) => {
    expect(checkInputSafetyClient(text)).toContain('988');
  });
});
