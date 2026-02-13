-- Migration 022: Drop is_active column from sessions
-- is_active was a legacy boolean duplicating session_status.
-- All code now uses session_status ('active' | 'completed' | 'abandoned').

ALTER TABLE sessions DROP COLUMN IF EXISTS is_active;
ALTER TABLE sim_sessions DROP COLUMN IF EXISTS is_active;
