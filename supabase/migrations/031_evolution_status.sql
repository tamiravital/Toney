-- Track whether background evolution (evolveAndSuggest) completed after session close.
-- 'pending' = close returned but after() hasn't finished yet
-- 'completed' = after() finished successfully
-- 'failed' = after() threw an error
-- On next session open, sessions with status != 'completed' get retried.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS evolution_status TEXT DEFAULT 'pending';
ALTER TABLE sim_sessions ADD COLUMN IF NOT EXISTS evolution_status TEXT DEFAULT 'pending';

-- Backfill: all existing completed sessions already had their evolution run
UPDATE sessions SET evolution_status = 'completed' WHERE session_status = 'completed';
UPDATE sim_sessions SET evolution_status = 'completed' WHERE session_status = 'completed';
