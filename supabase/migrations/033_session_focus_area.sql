-- Migration 033: Add focus_area_id to sessions for check-in tracking
-- When a session is opened from a focus-area check-in suggestion,
-- this tracks which focus area the session is about.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS focus_area_id UUID REFERENCES focus_areas(id) ON DELETE SET NULL;
ALTER TABLE sim_sessions ADD COLUMN IF NOT EXISTS focus_area_id UUID REFERENCES sim_focus_areas(id) ON DELETE SET NULL;
