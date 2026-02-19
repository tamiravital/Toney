-- Add language column to profiles and sim_profiles
-- NULL = not yet determined (triggers auto-detection)
-- 'en' = confirmed English
-- 'he', 'es', etc. = ISO 639-1 language codes

ALTER TABLE profiles ADD COLUMN language TEXT DEFAULT NULL;
ALTER TABLE sim_profiles ADD COLUMN language TEXT DEFAULT NULL;
