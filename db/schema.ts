import * as SQLite from 'expo-sqlite';

const DB_NAME = 'prism_aac.db';

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync(DB_NAME);
  await _db.execAsync('PRAGMA journal_mode = WAL;');
  await _db.execAsync('PRAGMA foreign_keys = ON;');
  await runMigrations(_db);
  return _db;
}

async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT,
      parent_id TEXT REFERENCES categories(id),
      sort_order INTEGER DEFAULT 0,
      is_custom INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS phrases (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id),
      text TEXT NOT NULL,
      display_text TEXT,
      image_uri TEXT,
      tts_override TEXT,
      tone TEXT DEFAULT 'friendly',
      sort_order INTEGER DEFAULT 0,
      is_custom INTEGER DEFAULT 0,
      usage_count INTEGER DEFAULT 0,
      last_used TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ordering_sequences (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category_id TEXT REFERENCES categories(id),
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ordering_steps (
      id TEXT PRIMARY KEY,
      sequence_id TEXT NOT NULL REFERENCES ordering_sequences(id),
      label TEXT NOT NULL,
      step_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ordering_options (
      id TEXT PRIMARY KEY,
      step_id TEXT NOT NULL REFERENCES ordering_steps(id),
      text TEXT NOT NULL,
      image_uri TEXT,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS word_frequency (
      word TEXT PRIMARY KEY,
      count INTEGER DEFAULT 1,
      last_used TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bigrams (
      word1 TEXT NOT NULL,
      word2 TEXT NOT NULL,
      count INTEGER DEFAULT 1,
      last_used TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (word1, word2)
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_phrases_category ON phrases(category_id);
    CREATE INDEX IF NOT EXISTS idx_phrases_usage ON phrases(usage_count DESC);
    CREATE INDEX IF NOT EXISTS idx_bigrams_word1 ON bigrams(word1);
    CREATE INDEX IF NOT EXISTS idx_word_freq_count ON word_frequency(count DESC);
    CREATE INDEX IF NOT EXISTS idx_ordering_steps_seq ON ordering_steps(sequence_id);
    CREATE INDEX IF NOT EXISTS idx_ordering_options_step ON ordering_options(step_id);
  `);
}
