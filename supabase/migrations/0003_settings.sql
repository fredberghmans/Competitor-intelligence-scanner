-- Simple key-value settings table for app-wide configuration.
-- Used to store AI provider choice and API keys set via the Settings UI.
-- Falls back to environment variables if a key is not present here.

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Allow authenticated users to read and write settings
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read settings"
  ON settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can upsert settings"
  ON settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update settings"
  ON settings FOR UPDATE
  TO authenticated
  USING (true);

-- Seed defaults (can be overridden via UI)
INSERT INTO settings (key, value) VALUES
  ('ai_provider', 'anthropic')
ON CONFLICT (key) DO NOTHING;
