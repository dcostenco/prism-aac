-- PrismAAC: User profile sync table for hivemind mode
-- Run this in the Supabase SQL editor for the project

CREATE TABLE IF NOT EXISTS public.aac_profiles (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       TEXT NOT NULL DEFAULT 'default',
  device_id     TEXT NOT NULL,
  custom_categories JSONB DEFAULT '[]'::jsonb,
  custom_phrases    JSONB DEFAULT '[]'::jsonb,
  word_freq     JSONB DEFAULT '{}'::jsonb,
  bigrams       JSONB DEFAULT '{}'::jsonb,
  history       JSONB DEFAULT '[]'::jsonb,
  settings      JSONB DEFAULT '{}'::jsonb,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, device_id)
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_aac_profiles_user ON aac_profiles(user_id);

-- Enable RLS
ALTER TABLE aac_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: anon/authenticated users can read/write their own rows
-- For initial setup, allow all access (tighten with auth later)
CREATE POLICY "aac_profiles_all" ON aac_profiles
  FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for hivemind sync
ALTER PUBLICATION supabase_realtime ADD TABLE aac_profiles;
