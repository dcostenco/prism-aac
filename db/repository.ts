import { getDatabase } from './schema';
import { Category, Phrase, OrderingSequence, OrderingStep, OrderingOption } from '../types';

// ── Categories ──

export async function getCategories(parentId: string | null = null): Promise<Category[]> {
  const db = await getDatabase();
  if (parentId === null) {
    return db.getAllAsync<Category>(
      'SELECT id, name, icon, parent_id as parentId, sort_order as sortOrder, is_custom as isCustom, created_at as createdAt FROM categories WHERE parent_id IS NULL ORDER BY sort_order'
    );
  }
  return db.getAllAsync<Category>(
    'SELECT id, name, icon, parent_id as parentId, sort_order as sortOrder, is_custom as isCustom, created_at as createdAt FROM categories WHERE parent_id = ? ORDER BY sort_order',
    [parentId]
  );
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Category>(
    'SELECT id, name, icon, parent_id as parentId, sort_order as sortOrder, is_custom as isCustom, created_at as createdAt FROM categories WHERE id = ?',
    [id]
  );
}

// ── Phrases ──

export async function getPhrasesByCategory(categoryId: string): Promise<Phrase[]> {
  const db = await getDatabase();
  return db.getAllAsync<Phrase>(
    `SELECT id, category_id as categoryId, text, display_text as displayText, image_uri as imageUri,
            tts_override as ttsOverride, tone, sort_order as sortOrder, is_custom as isCustom,
            usage_count as usageCount, last_used as lastUsed, created_at as createdAt
     FROM phrases WHERE category_id = ? ORDER BY sort_order`,
    [categoryId]
  );
}

export async function incrementPhraseUsage(phraseId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE phrases SET usage_count = usage_count + 1, last_used = datetime('now') WHERE id = ?",
    [phraseId]
  );
}

export async function addCustomPhrase(
  id: string,
  categoryId: string,
  text: string,
  tone: string = 'friendly'
): Promise<void> {
  const db = await getDatabase();
  const maxOrder = await db.getFirstAsync<{ m: number }>(
    'SELECT COALESCE(MAX(sort_order), -1) as m FROM phrases WHERE category_id = ?',
    [categoryId]
  );
  await db.runAsync(
    `INSERT INTO phrases (id, category_id, text, tone, sort_order, is_custom)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [id, categoryId, text, tone, (maxOrder?.m ?? -1) + 1]
  );
}

// ── Ordering ──

export async function getOrderingSequences(categoryId: string): Promise<OrderingSequence[]> {
  const db = await getDatabase();
  return db.getAllAsync<OrderingSequence>(
    'SELECT id, name, category_id as categoryId, sort_order as sortOrder FROM ordering_sequences WHERE category_id = ? ORDER BY sort_order',
    [categoryId]
  );
}

export async function getOrderingSteps(sequenceId: string): Promise<OrderingStep[]> {
  const db = await getDatabase();
  return db.getAllAsync<OrderingStep>(
    'SELECT id, sequence_id as sequenceId, label, step_order as stepOrder FROM ordering_steps WHERE sequence_id = ? ORDER BY step_order',
    [sequenceId]
  );
}

export async function getOrderingOptions(stepId: string): Promise<OrderingOption[]> {
  const db = await getDatabase();
  return db.getAllAsync<OrderingOption>(
    'SELECT id, step_id as stepId, text, image_uri as imageUri, sort_order as sortOrder FROM ordering_options WHERE step_id = ? ORDER BY sort_order',
    [stepId]
  );
}

// ── Prediction data ──

export async function recordWord(word: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO word_frequency (word, count, last_used) VALUES (?, 1, datetime('now'))
     ON CONFLICT(word) DO UPDATE SET count = count + 1, last_used = datetime('now')`,
    [word.toLowerCase()]
  );
}

export async function recordBigram(word1: string, word2: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO bigrams (word1, word2, count, last_used) VALUES (?, ?, 1, datetime('now'))
     ON CONFLICT(word1, word2) DO UPDATE SET count = count + 1, last_used = datetime('now')`,
    [word1.toLowerCase(), word2.toLowerCase()]
  );
}

export async function getTopBigrams(word1: string, limit: number = 10): Promise<{ word2: string; count: number }[]> {
  const db = await getDatabase();
  return db.getAllAsync(
    'SELECT word2, count FROM bigrams WHERE word1 = ? ORDER BY count DESC LIMIT ?',
    [word1.toLowerCase(), limit]
  );
}

export async function getTopWords(limit: number = 20): Promise<{ word: string; count: number }[]> {
  const db = await getDatabase();
  return db.getAllAsync(
    'SELECT word, count FROM word_frequency ORDER BY count DESC LIMIT ?',
    [limit]
  );
}

export async function getRecentWords(minutesAgo: number = 10, limit: number = 20): Promise<{ word: string; count: number }[]> {
  const db = await getDatabase();
  return db.getAllAsync(
    `SELECT word, count FROM word_frequency
     WHERE last_used >= datetime('now', '-' || ? || ' minutes')
     ORDER BY count DESC LIMIT ?`,
    [minutesAgo, limit]
  );
}

export async function decayPredictions(): Promise<void> {
  const db = await getDatabase();
  // 5% decay for entries older than 7 days
  await db.runAsync(
    `UPDATE word_frequency SET count = MAX(1, CAST(count * 0.95 AS INTEGER))
     WHERE last_used < datetime('now', '-7 days')`
  );
  await db.runAsync(
    `UPDATE bigrams SET count = MAX(1, CAST(count * 0.95 AS INTEGER))
     WHERE last_used < datetime('now', '-7 days')`
  );
}

// ── Settings ──

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?',
    [key, value, value]
  );
}
