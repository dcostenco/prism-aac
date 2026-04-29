import { SubscriptionTier } from '../types';

const API_BASE = 'https://synalux.ai/prism-aac/api/v1';

interface SyncPayload {
  categories: unknown[];
  phrases: unknown[];
  wordFrequency: unknown[];
  bigrams: unknown[];
  settings: Record<string, string>;
}

export async function backupToCloud(
  payload: SyncPayload,
  authToken: string
): Promise<{ success: boolean; backupId: string }> {
  const response = await fetch(`${API_BASE}/backup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Backup failed: ${response.status}`);
  }

  return response.json();
}

export async function restoreFromCloud(
  authToken: string,
  backupId?: string
): Promise<SyncPayload> {
  const url = backupId
    ? `${API_BASE}/restore/${backupId}`
    : `${API_BASE}/restore/latest`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${authToken}` },
  });

  if (!response.ok) {
    throw new Error(`Restore failed: ${response.status}`);
  }

  return response.json();
}

export async function validateSubscription(
  authToken: string
): Promise<{ tier: SubscriptionTier; expiresAt: string; isActive: boolean }> {
  const response = await fetch(`${API_BASE}/subscription/validate`, {
    headers: { 'Authorization': `Bearer ${authToken}` },
  });

  if (!response.ok) {
    throw new Error(`Subscription check failed: ${response.status}`);
  }

  return response.json();
}

export async function getAzureTTSToken(
  authToken: string
): Promise<{ key: string; region: string }> {
  const response = await fetch(`${API_BASE}/tts/token`, {
    headers: { 'Authorization': `Bearer ${authToken}` },
  });

  if (!response.ok) {
    throw new Error(`TTS token request failed: ${response.status}`);
  }

  return response.json();
}
