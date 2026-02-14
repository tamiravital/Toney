-- ============================================================
-- Migration 027: Kill coaching_briefings, add coaching plan to sessions
-- ============================================================
-- coaching_briefings was a middleman between the Strategist and Coach.
-- Now coaching plan fields live directly on the sessions row, and the
-- system prompt is built from pure code at each request.

-- Add coaching plan fields to sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS hypothesis TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS leverage_point TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS curiosities TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS opening_direction TEXT;

-- Same for sim
ALTER TABLE sim_sessions ADD COLUMN IF NOT EXISTS hypothesis TEXT;
ALTER TABLE sim_sessions ADD COLUMN IF NOT EXISTS leverage_point TEXT;
ALTER TABLE sim_sessions ADD COLUMN IF NOT EXISTS curiosities TEXT;
ALTER TABLE sim_sessions ADD COLUMN IF NOT EXISTS opening_direction TEXT;

-- Drop coaching_briefings (both prod and sim)
DROP TABLE IF EXISTS coaching_briefings;
DROP TABLE IF EXISTS sim_coaching_briefings;
