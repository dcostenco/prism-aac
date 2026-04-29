import * as SQLite from 'expo-sqlite';
import { DEFAULT_CATEGORIES } from '../constants/defaultCategories';
import { ALL_DEFAULT_PHRASES } from '../constants/defaultPhrases';
import { DEFAULT_ORDERING_SEQUENCES } from '../constants/orderingSequences';

export async function seedDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  // Check if already seeded
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories'
  );
  if (result && result.count > 0) return;

  // Seed categories
  for (const cat of DEFAULT_CATEGORIES) {
    await db.runAsync(
      `INSERT OR IGNORE INTO categories (id, name, icon, parent_id, sort_order, is_custom)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [cat.id, cat.name, cat.icon, cat.parentId, cat.sortOrder, cat.isCustom ? 1 : 0]
    );
  }

  // Seed phrases
  for (const p of ALL_DEFAULT_PHRASES) {
    await db.runAsync(
      `INSERT OR IGNORE INTO phrases (id, category_id, text, display_text, image_uri, tts_override, tone, sort_order, is_custom, usage_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.id, p.categoryId, p.text, p.displayText, p.imageUri, p.ttsOverride, p.tone, p.sortOrder, p.isCustom ? 1 : 0, 0]
    );
  }

  // Seed ordering sequences
  for (const seq of DEFAULT_ORDERING_SEQUENCES) {
    await db.runAsync(
      `INSERT OR IGNORE INTO ordering_sequences (id, name, category_id, sort_order)
       VALUES (?, ?, ?, ?)`,
      [seq.id, seq.name, seq.categoryId, seq.sortOrder]
    );

    for (const step of seq.steps) {
      await db.runAsync(
        `INSERT OR IGNORE INTO ordering_steps (id, sequence_id, label, step_order)
         VALUES (?, ?, ?, ?)`,
        [step.id, seq.id, step.label, step.stepOrder]
      );

      for (const opt of step.options) {
        await db.runAsync(
          `INSERT OR IGNORE INTO ordering_options (id, step_id, text, sort_order)
           VALUES (?, ?, ?, ?)`,
          [opt.id, step.id, opt.text, opt.sortOrder]
        );
      }
    }
  }
}
