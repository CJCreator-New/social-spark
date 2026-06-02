-- Add optional brand_examples and default_framework to profiles
ALTER TABLE IF EXISTS profiles
  ADD COLUMN IF NOT EXISTS brand_examples text[],
  ADD COLUMN IF NOT EXISTS default_framework text;

-- No default values to avoid surprising existing users.
