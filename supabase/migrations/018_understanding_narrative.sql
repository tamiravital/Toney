-- Migration 018: Understanding Narrative
-- Core change: single evolving clinical narrative on profiles replaces
-- shredded user_knowledge writes from close pipeline.
-- user_knowledge table stays (used by focus card reflections) but
-- the close pipeline no longer writes to it.

-- 1. profiles.understanding — the Strategist's cumulative clinical narrative
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS understanding TEXT;
ALTER TABLE sim_profiles ADD COLUMN IF NOT EXISTS understanding TEXT;

-- 2. sessions.narrative_snapshot — snapshot of understanding BEFORE this session's evolution
--    Used for trajectory tracking / progress visibility
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS narrative_snapshot TEXT;
ALTER TABLE sim_sessions ADD COLUMN IF NOT EXISTS narrative_snapshot TEXT;
