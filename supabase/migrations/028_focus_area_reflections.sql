-- Migration 028: Focus Area Growth Reflections
-- Adds a JSONB column to focus_areas (and sim_focus_areas) to store
-- per-focus-area growth reflections generated at session close.
-- Each reflection: { date: string, sessionId: string, text: string }

ALTER TABLE focus_areas ADD COLUMN IF NOT EXISTS reflections JSONB DEFAULT '[]';
ALTER TABLE sim_focus_areas ADD COLUMN IF NOT EXISTS reflections JSONB DEFAULT '[]';
