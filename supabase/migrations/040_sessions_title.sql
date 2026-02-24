-- Migration 040: Add missing title column to sessions + sim_sessions
-- This column was in migration 001 (on conversations table, renamed to sessions in 012)
-- but was lost on the DEV database. Without it, the entire session close update fails.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE sim_sessions ADD COLUMN IF NOT EXISTS title TEXT;
