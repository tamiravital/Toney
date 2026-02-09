-- Consolidate simulator tables into sim_* naming.
-- sim_profiles IS the persona now — no separate table needed.

-- Add persona-specific columns to sim_profiles
ALTER TABLE sim_profiles ADD COLUMN IF NOT EXISTS user_prompt TEXT;
ALTER TABLE sim_profiles ADD COLUMN IF NOT EXISTS source_user_id UUID;

-- Add sim_profile_id directly to simulator_runs (replaces persona_id)
ALTER TABLE simulator_runs ADD COLUMN IF NOT EXISTS sim_profile_id UUID REFERENCES sim_profiles(id) ON DELETE SET NULL;

-- Drop FK constraint on persona_id so we can drop simulator_personas
ALTER TABLE simulator_runs DROP CONSTRAINT IF EXISTS simulator_runs_persona_id_fkey;

-- Rename simulator_runs → sim_runs
ALTER TABLE simulator_runs RENAME TO sim_runs;

-- Drop v1-only tables (all data now lives in sim_messages)
DROP TABLE IF EXISTS simulator_messages;
DROP TABLE IF EXISTS simulator_personas;
