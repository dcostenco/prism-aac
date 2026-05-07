/**
 * inboxService — cross-account safety. The persisted lastSeenMs
 * timestamp must reset when the active profile changes (sign-out,
 * account switch on a shared tablet) so user B doesn't silently miss
 * messages older than user A's last poll.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAuthStore } from '@/store/authStore';
import { startInboxPolling, stopInboxPolling } from '@/services/inboxService';

const LAST_SEEN_KEY = 'prism-aac-inbox-last-seen-ms';
const fetchMock = vi.fn();

beforeEach(() => {
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockReset();
  // Default to "no contacts to fetch" so polling is a no-op apart from
  // the auth subscription we're testing.
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ messages: [] }), { status: 200 }));
  if (typeof window !== 'undefined') window.localStorage.clear();
  useAuthStore.setState({
    profile: { email: 'alice@example.com', name: 'Alice', plan: 'standard', isPlatformAdmin: false },
    loaded: true, loading: false,
  });
});

afterEach(() => {
  stopInboxPolling();
  vi.clearAllMocks();
});

describe('inboxService — cross-account safety', () => {
  it('clears lastSeenMs from localStorage when the active profile changes', async () => {
    // Seed a value as if Alice had been polling.
    window.localStorage.setItem(LAST_SEEN_KEY, '1600000000000');
    expect(window.localStorage.getItem(LAST_SEEN_KEY)).not.toBeNull();

    startInboxPolling();
    await Promise.resolve();
    // Alice signs out, Bob signs in.
    useAuthStore.setState({
      profile: { email: 'bob@example.com', name: 'Bob', plan: 'standard', isPlatformAdmin: false },
      loaded: true, loading: false,
    });
    await Promise.resolve();
    // The auth subscription should have wiped Alice's stale value so
    // Bob's first poll uses since=0 and gets his full backlog.
    expect(window.localStorage.getItem(LAST_SEEN_KEY)).toBeNull();
  });

  it('clears lastSeenMs on sign-out (profile -> null)', async () => {
    window.localStorage.setItem(LAST_SEEN_KEY, '1600000000000');
    startInboxPolling();
    await Promise.resolve();
    useAuthStore.setState({ profile: null, loaded: true, loading: false });
    await Promise.resolve();
    expect(window.localStorage.getItem(LAST_SEEN_KEY)).toBeNull();
  });

  it('does NOT clear lastSeenMs when the same user is set again', async () => {
    window.localStorage.setItem(LAST_SEEN_KEY, '1600000000000');
    startInboxPolling();
    await Promise.resolve();
    // Same email — e.g. authStore.refresh() refreshed a non-changed
    // profile. Must not clear the stale value.
    useAuthStore.setState({
      profile: { email: 'alice@example.com', name: 'Alice', plan: 'standard', isPlatformAdmin: false },
      loaded: true, loading: false,
    });
    await Promise.resolve();
    expect(window.localStorage.getItem(LAST_SEEN_KEY)).toBe('1600000000000');
  });
});
