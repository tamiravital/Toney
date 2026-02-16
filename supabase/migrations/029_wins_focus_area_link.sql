-- Migration 029: Link wins to focus areas
-- Adds focus_area_id to wins + sim_wins for tracking which wins
-- are evidence of progress toward a specific focus area.

ALTER TABLE wins
ADD COLUMN IF NOT EXISTS focus_area_id UUID REFERENCES focus_areas(id) ON DELETE SET NULL;

ALTER TABLE sim_wins
ADD COLUMN IF NOT EXISTS focus_area_id UUID REFERENCES sim_focus_areas(id) ON DELETE SET NULL;
