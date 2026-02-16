-- Migration 030: Add milestone + focus_area_id to sessions
-- Milestones are short (5-15 word) progress markers generated at session close.
-- focus_area_id links a session's milestone to the growth lane it relates to.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS milestone TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS focus_area_id UUID REFERENCES focus_areas(id);

ALTER TABLE sim_sessions ADD COLUMN IF NOT EXISTS milestone TEXT;
ALTER TABLE sim_sessions ADD COLUMN IF NOT EXISTS focus_area_id UUID;
